//! Die Falldatenbank.
//!
//! SQLite im Benutzerprofil. Jeder Falldatensatz liegt als einzelner,
//! mit AES-256-GCM verschlüsselter Block darin; der Schlüssel steht im
//! Windows-Tresor. Wer die Datei kopiert, hat damit nichts gewonnen.
//!
//! Im Klartext bleiben nur Felder, die zum Sortieren und Aufräumen nötig
//! sind und selbst nichts verraten: die Kennung, der Änderungszeitpunkt
//! und der Zeitpunkt des Löschens. Insbesondere steht kein Name, keine
//! Chiffre und keine Diagnose unverschlüsselt in der Datei.
//!
//! Gesucht wird, indem alles entschlüsselt und im Arbeitsspeicher
//! durchgesehen wird. Bei der Grössenordnung einer Praxis — einige
//! Dutzend bis wenige Hundert Fälle — ist das schneller als jeder Index
//! und verrät nichts an die Datei.

use crate::error::{RanaError, Result};
use crate::secrets;
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    AeadCore, Aes256Gcm, Key, Nonce,
};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

/// Fälle im Papierkorb werden nach dieser Frist endgültig entfernt.
pub const TRASH_DAYS: i64 = 30;

pub struct Store {
    conn: Mutex<Connection>,
    key: [u8; 32],
}

// ---------------------------------------------------------------
// Datensätze
// ---------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Case {
    pub id: String,
    /// Alle Feldinhalte des Falls. Bewusst als freie Abbildung, damit
    /// neue Felder keine Wanderung der Datenbank erfordern.
    #[serde(default)]
    pub fields: serde_json::Map<String, serde_json::Value>,
    /// Der formulierte Bericht.
    #[serde(default)]
    pub report: String,
    #[serde(default)]
    pub updated_at: i64,
    #[serde(default)]
    pub created_at: i64,
    #[serde(default)]
    pub deleted_at: Option<i64>,
}

/// Was die Fallliste in der Seitenschiene braucht — ohne den ganzen
/// Datensatz durch die Brücke zu schieben.
#[derive(Serialize)]
pub struct CaseSummary {
    pub id: String,
    pub label: String,
    pub chiffre: String,
    pub antrag_nr: String,
    pub updated_at: i64,
    /// Wann der Fall angelegt wurde. Die Oberfläche sortiert danach.
    pub created_at: i64,
    pub deleted_at: Option<i64>,
    pub has_report: bool,
    /// Tage bis zur endgültigen Entfernung, nur im Papierkorb gesetzt.
    pub purge_in_days: Option<i64>,
}

// ---------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------

impl Store {
    pub fn open(dir: &PathBuf) -> Result<Self> {
        std::fs::create_dir_all(dir)?;
        let path = dir.join("rana.db");
        let conn = Connection::open(&path).map_err(|_| RanaError::StoreLocked)?;

        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = FULL;
             PRAGMA foreign_keys = ON;

             CREATE TABLE IF NOT EXISTS cases (
               id          TEXT PRIMARY KEY,
               nonce       BLOB NOT NULL,
               payload     BLOB NOT NULL,
               updated_at  INTEGER NOT NULL,
               deleted_at  INTEGER
             );

             CREATE TABLE IF NOT EXISTS settings (
               key   TEXT PRIMARY KEY,
               value TEXT NOT NULL
             );

             -- Eigene Textbausteine, ebenfalls verschlüsselt: sie können
             -- Formulierungen enthalten, die auf Fälle zurückweisen.
             CREATE TABLE IF NOT EXISTS snippets (
               id         TEXT PRIMARY KEY,
               field      TEXT NOT NULL,
               nonce      BLOB NOT NULL,
               payload    BLOB NOT NULL,
               created_at INTEGER NOT NULL
             );

             -- Verbrauch. Enthält keine Inhalte, nur Zahlen, und bleibt
             -- deshalb im Klartext — so lässt sich die Abrechnung auch
             -- dann noch nachvollziehen, wenn der Tresor verloren ginge.
             CREATE TABLE IF NOT EXISTS usage (
               id            INTEGER PRIMARY KEY AUTOINCREMENT,
               at            INTEGER NOT NULL,
               model         TEXT NOT NULL,
               input_tokens  INTEGER NOT NULL,
               cached_tokens INTEGER NOT NULL DEFAULT 0,
               output_tokens INTEGER NOT NULL,
               cost_eur      REAL NOT NULL,
               kind          TEXT NOT NULL
             );
             CREATE INDEX IF NOT EXISTS usage_at ON usage(at);",
        )?;

        let key = secrets::ensure_db_key()?;
        let store = Store { conn: Mutex::new(conn), key };
        store.purge_expired()?;
        Ok(store)
    }

    pub fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf> {
        use tauri::Manager;
        app.path()
            .app_data_dir()
            .map_err(|_| RanaError::Message("Der Anwendungsordner lässt sich nicht bestimmen.".into()))
    }

    // -----------------------------------------------------------
    // Verschlüsseln
    // -----------------------------------------------------------

    fn seal(&self, plain: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&self.key));
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ct = cipher
            .encrypt(&nonce, plain)
            .map_err(|_| RanaError::Message("Der Datensatz liess sich nicht verschlüsseln.".into()))?;
        Ok((nonce.to_vec(), ct))
    }

    fn unseal(&self, nonce: &[u8], ct: &[u8]) -> Result<Vec<u8>> {
        if nonce.len() != 12 {
            return Err(RanaError::DecryptFailed);
        }
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&self.key));
        cipher
            .decrypt(Nonce::from_slice(nonce), ct)
            .map_err(|_| RanaError::DecryptFailed)
    }

    // -----------------------------------------------------------
    // Fälle
    // -----------------------------------------------------------

    pub fn save_case(&self, mut case: Case) -> Result<Case> {
        let now = now_ms();
        if case.created_at == 0 {
            case.created_at = now;
        }
        case.updated_at = now;

        let json = serde_json::to_vec(&case)?;
        let (nonce, payload) = self.seal(&json)?;

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO cases (id, nonce, payload, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
               nonce = excluded.nonce,
               payload = excluded.payload,
               updated_at = excluded.updated_at,
               deleted_at = excluded.deleted_at",
            params![case.id, nonce, payload, case.updated_at, case.deleted_at],
        )?;
        Ok(case)
    }

    pub fn get_case(&self, id: &str) -> Result<Case> {
        let conn = self.conn.lock().unwrap();
        let (nonce, payload): (Vec<u8>, Vec<u8>) = conn
            .query_row(
                "SELECT nonce, payload FROM cases WHERE id = ?1",
                params![id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .map_err(|_| RanaError::Message("Dieser Fall ist nicht mehr vorhanden.".into()))?;
        drop(conn);
        Ok(serde_json::from_slice(&self.unseal(&nonce, &payload)?)?)
    }

    fn all_rows(&self, trashed: bool) -> Result<Vec<Case>> {
        let conn = self.conn.lock().unwrap();
        let sql = if trashed {
            "SELECT nonce, payload FROM cases WHERE deleted_at IS NOT NULL ORDER BY updated_at DESC"
        } else {
            "SELECT nonce, payload FROM cases WHERE deleted_at IS NULL ORDER BY updated_at DESC"
        };
        let mut stmt = conn.prepare(sql)?;
        let rows: Vec<(Vec<u8>, Vec<u8>)> = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<std::result::Result<_, _>>()?;
        drop(stmt);
        drop(conn);

        let mut out = Vec::with_capacity(rows.len());
        for (nonce, payload) in rows {
            // Ein einzelner unlesbarer Datensatz darf nicht die ganze
            // Liste unbrauchbar machen — er wird übersprungen.
            if let Ok(plain) = self.unseal(&nonce, &payload) {
                if let Ok(c) = serde_json::from_slice::<Case>(&plain) {
                    out.push(c);
                }
            }
        }
        Ok(out)
    }

    /// Fallliste, wahlweise gefiltert. Der Suchbegriff wird über Klarname,
    /// Chiffre und Diagnose geprüft — alles erst nach dem Entschlüsseln.
    pub fn list_cases(&self, query: &str, trashed: bool) -> Result<Vec<CaseSummary>> {
        let q = query.trim().to_lowercase();
        let mut out = Vec::new();

        for c in self.all_rows(trashed)? {
            let name = field(&c, "f_name");
            let chiffre = field(&c, "f_chiffre");
            let nr = field(&c, "f_nr");

            if !q.is_empty() {
                let hay = format!(
                    "{} {} {} {}",
                    name,
                    chiffre,
                    field(&c, "f_diag_neu"),
                    field(&c, "f_kasse")
                )
                .to_lowercase();
                if !hay.contains(&q) {
                    continue;
                }
            }

            let label = if !name.is_empty() {
                name
            } else if !chiffre.is_empty() {
                chiffre.clone()
            } else {
                "Ohne Namen".to_string()
            };

            let purge_in_days = c.deleted_at.map(|d| {
                let elapsed = (now_ms() - d) / 86_400_000;
                (TRASH_DAYS - elapsed).max(0)
            });

            out.push(CaseSummary {
                id: c.id.clone(),
                label,
                chiffre,
                antrag_nr: nr,
                updated_at: c.updated_at,
                created_at: c.created_at,
                deleted_at: c.deleted_at,
                has_report: !c.report.trim().is_empty(),
                purge_in_days,
            });
        }
        Ok(out)
    }

    /// In den Papierkorb legen. Nicht löschen — die Aufbewahrungsfristen
    /// einer Praxis vertragen keinen unwiderruflichen Klick.
    pub fn trash_case(&self, id: &str) -> Result<()> {
        let mut c = self.get_case(id)?;
        c.deleted_at = Some(now_ms());
        self.save_case(c)?;
        Ok(())
    }

    pub fn restore_case(&self, id: &str) -> Result<()> {
        let mut c = self.get_case(id)?;
        c.deleted_at = None;
        self.save_case(c)?;
        Ok(())
    }

    /// Endgültig entfernen. Wird nur nach ausdrücklicher Bestätigung
    /// aufgerufen und ist nicht rückgängig zu machen.
    pub fn purge_case(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM cases WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// Räumt beim Start auf, was die Frist überschritten hat.
    pub fn purge_expired(&self) -> Result<usize> {
        let cutoff = now_ms() - TRASH_DAYS * 86_400_000;
        let conn = self.conn.lock().unwrap();
        let n = conn.execute(
            "DELETE FROM cases WHERE deleted_at IS NOT NULL AND deleted_at < ?1",
            params![cutoff],
        )?;
        Ok(n)
    }

    // -----------------------------------------------------------
    // Einstellungen
    // -----------------------------------------------------------

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        Ok(conn
            .query_row("SELECT value FROM settings WHERE key = ?1", params![key], |r| {
                r.get::<_, String>(0)
            })
            .ok())
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    // -----------------------------------------------------------
    // Textbausteine
    // -----------------------------------------------------------

    pub fn add_snippet(&self, field_id: &str, text: &str) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        let (nonce, payload) = self.seal(text.as_bytes())?;
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO snippets (id, field, nonce, payload, created_at) VALUES (?1,?2,?3,?4,?5)",
            params![id, field_id, nonce, payload, now_ms()],
        )?;
        Ok(id)
    }

    pub fn list_snippets(&self, field_id: &str) -> Result<Vec<(String, String)>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, nonce, payload FROM snippets WHERE field = ?1 ORDER BY created_at DESC",
        )?;
        let rows: Vec<(String, Vec<u8>, Vec<u8>)> = stmt
            .query_map(params![field_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
            .collect::<std::result::Result<_, _>>()?;
        drop(stmt);
        drop(conn);

        Ok(rows
            .into_iter()
            .filter_map(|(id, n, p)| {
                self.unseal(&n, &p)
                    .ok()
                    .and_then(|b| String::from_utf8(b).ok())
                    .map(|t| (id, t))
            })
            .collect())
    }

    pub fn delete_snippet(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM snippets WHERE id = ?1", params![id])?;
        Ok(())
    }

    // -----------------------------------------------------------
    // Verbrauch
    // -----------------------------------------------------------

    pub fn record_usage(
        &self,
        model: &str,
        input: u64,
        cached: u64,
        output: u64,
        cost_eur: f64,
        kind: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO usage (at, model, input_tokens, cached_tokens, output_tokens, cost_eur, kind)
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![now_ms(), model, input as i64, cached as i64, output as i64, cost_eur, kind],
        )?;
        Ok(())
    }

    pub fn spend_since(&self, since_ms: i64) -> Result<f64> {
        let conn = self.conn.lock().unwrap();
        Ok(conn
            .query_row(
                "SELECT COALESCE(SUM(cost_eur), 0.0) FROM usage WHERE at >= ?1",
                params![since_ms],
                |r| r.get::<_, f64>(0),
            )
            .unwrap_or(0.0))
    }

    pub fn calls_since(&self, since_ms: i64) -> Result<u32> {
        let conn = self.conn.lock().unwrap();
        Ok(conn
            .query_row(
                "SELECT COUNT(*) FROM usage WHERE at >= ?1 AND kind = 'report'",
                params![since_ms],
                |r| r.get::<_, i64>(0),
            )
            .unwrap_or(0) as u32)
    }

    /// Verbrauch je Monat für die Übersicht, jüngster zuerst.
    pub fn monthly_usage(&self, months: u32) -> Result<Vec<(String, f64, u32)>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT strftime('%Y-%m', at/1000, 'unixepoch') AS m,
                    SUM(cost_eur), COUNT(*)
             FROM usage GROUP BY m ORDER BY m DESC LIMIT ?1",
        )?;
        let rows = stmt
            .query_map(params![months], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?, r.get::<_, i64>(2)? as u32))
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    // -----------------------------------------------------------
    // Sicherung
    // -----------------------------------------------------------

    /// Alle Fälle im Klartext, für die verschlüsselte Sicherungsdatei.
    /// Der Aufrufer ist dafür verantwortlich, das Ergebnis sofort wieder
    /// zu verschlüsseln — es verlässt den Arbeitsspeicher nie unverpackt.
    pub fn export_all(&self) -> Result<Vec<Case>> {
        let mut all = self.all_rows(false)?;
        all.extend(self.all_rows(true)?);
        Ok(all)
    }

    pub fn import_cases(&self, cases: Vec<Case>, replace: bool) -> Result<usize> {
        if replace {
            let conn = self.conn.lock().unwrap();
            conn.execute("DELETE FROM cases", [])?;
        }
        let mut n = 0;
        for c in cases {
            self.save_case(c)?;
            n += 1;
        }
        Ok(n)
    }
}

// ---------------------------------------------------------------

fn field(c: &Case, key: &str) -> String {
    c.fields
        .get(key)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

pub fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}
