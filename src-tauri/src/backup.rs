//! Sicherung und Wiederherstellung.
//!
//! Der Vorgänger lag im Speicher des Browsers. Ein geleerter
//! Zwischenspeicher hätte die Fallakten vernichtet. Das darf in einer
//! Praxis nicht passieren, deshalb ist die Sicherung hier keine
//! Zusatzfunktion, sondern Bestandteil.
//!
//! Eine Sicherungsdatei (.ranasic) enthält:
//!   * alle Fälle, auch die im Papierkorb
//!   * die Einstellungen
//!   * den Datenbankschlüssel
//!
//! Das Ganze ist mit einem Passwort verschlüsselt, das die Nutzerin
//! beim Sichern vergibt. Der Anthropic-Schlüssel ist NICHT enthalten —
//! er gehört in den Tresor des jeweiligen Rechners und soll nicht in
//! einer Datei mitwandern.
//!
//! Die tägliche Sicherung läuft ohne Passwort, weil sie im geschützten
//! Benutzerprofil liegt und mit demselben Schlüssel arbeitet wie die
//! Datenbank. Sieben Stände werden rollierend gehalten.

use crate::error::{RanaError, Result};
use crate::patients::Patient;
use crate::secrets;
use crate::store::{Case, Store};
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    AeadCore, Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const MAGIC: &str = "RANA-SICHERUNG-1";
pub const AUTO_KEEP: usize = 7;

#[derive(Serialize, Deserialize)]
struct Envelope {
    magic: String,
    created_at: i64,
    /// Zufallswert, aus dem zusammen mit dem Passwort der Schlüssel entsteht.
    salt: String,
    nonce: String,
    payload: String,
}

#[derive(Serialize, Deserialize)]
struct Payload {
    cases: Vec<Case>,
    /// Seit Fassung 2.0. Fehlt in älteren Sicherungen — dann bleibt
    /// die Liste leer und die eingelesenen Berichte stehen zunächst
    /// ohne Patientin da, so wie vor der Umstellung. Ohne dieses Feld
    /// verwiesen die Berichte nach dem Wiederherstellen auf
    /// Patientinnen, die es nicht mehr gäbe.
    #[serde(default)]
    patients: Vec<Patient>,
    settings: Vec<(String, String)>,
    /// Ohne ihn wären die Fälle auf einem anderen Rechner nicht lesbar.
    db_key: String,
    app_version: String,
}

// ---------------------------------------------------------------
// Schlüssel aus Passwort
// ---------------------------------------------------------------

/// Leitet einen Schlüssel aus Passwort und Zufallswert ab.
///
/// PBKDF2 mit HMAC-SHA-256 und 600.000 Runden. Das ist die Zahl, die
/// das OWASP für dieses Verfahren empfiehlt, und sie macht das
/// Durchprobieren von Passwörtern teuer genug. Kein selbstgebautes
/// Verfahren — bei Krypto ist das die einzige vertretbare Haltung.
const KDF_ROUNDS: u32 = 600_000;

fn derive(password: &str, salt: &[u8]) -> [u8; 32] {
    let mut out = [0u8; 32];
    pbkdf2::pbkdf2_hmac::<sha2::Sha256>(password.as_bytes(), salt, KDF_ROUNDS, &mut out);
    out
}

fn seal_with(key: &[u8; 32], plain: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ct = cipher
        .encrypt(&nonce, plain)
        .map_err(|_| RanaError::Message("Die Sicherung liess sich nicht verschlüsseln.".into()))?;
    Ok((nonce.to_vec(), ct))
}

fn unseal_with(key: &[u8; 32], nonce: &[u8], ct: &[u8]) -> Result<Vec<u8>> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    cipher.decrypt(Nonce::from_slice(nonce), ct).map_err(|_| {
        RanaError::Message(
            "Die Sicherung liess sich nicht öffnen. Das Passwort ist falsch, oder die Datei ist beschädigt.".into(),
        )
    })
}

// ---------------------------------------------------------------
// Sichern
// ---------------------------------------------------------------

pub fn write_backup(store: &Store, path: &Path, password: &str) -> Result<usize> {
    if password.chars().count() < 8 {
        return Err(RanaError::Message(
            "Das Passwort der Sicherung muss mindestens acht Zeichen haben. Ohne es lassen sich die Daten nicht wiederherstellen — bitte sicher notieren.".into(),
        ));
    }

    let cases = store.export_all()?;
    let count = cases.len();

    let payload = Payload {
        cases,
        patients: store.alle_patienten()?,
        settings: collect_settings(store)?,
        db_key: secrets::export_db_key_b64()?,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    };
    let plain = serde_json::to_vec(&payload)?;

    let mut salt = [0u8; 16];
    use rand::RngCore;
    rand::thread_rng().fill_bytes(&mut salt);

    let key = derive(password, &salt);
    let (nonce, ct) = seal_with(&key, &plain)?;

    let env = Envelope {
        magic: MAGIC.into(),
        created_at: crate::store::now_ms(),
        salt: B64.encode(salt),
        nonce: B64.encode(nonce),
        payload: B64.encode(ct),
    };

    std::fs::write(path, serde_json::to_vec_pretty(&env)?)?;
    Ok(count)
}

pub fn read_backup(store: &Store, path: &Path, password: &str, replace: bool) -> Result<usize> {
    let raw = std::fs::read(path)?;
    let env: Envelope = serde_json::from_slice(&raw).map_err(|_| {
        RanaError::Message("Diese Datei ist keine Rana-Sicherung.".into())
    })?;
    if env.magic != MAGIC {
        return Err(RanaError::Message(
            "Diese Datei stammt aus einer anderen Anwendung oder einer nicht unterstützten Fassung.".into(),
        ));
    }

    let salt = B64.decode(&env.salt).map_err(|_| RanaError::DecryptFailed)?;
    let nonce = B64.decode(&env.nonce).map_err(|_| RanaError::DecryptFailed)?;
    let ct = B64.decode(&env.payload).map_err(|_| RanaError::DecryptFailed)?;

    let key = derive(password, &salt);
    let plain = unseal_with(&key, &nonce, &ct)?;
    let payload: Payload = serde_json::from_slice(&plain)?;

    // Der Datenbankschlüssel aus der Sicherung muss übernommen werden,
    // sonst wären die wiederhergestellten Fälle sofort wieder unlesbar.
    if let Ok(bytes) = B64.decode(&payload.db_key) {
        if bytes.len() == 32 {
            let mut k = [0u8; 32];
            k.copy_from_slice(&bytes);
            secrets::set_db_key(&k)?;
        }
    }

    // Erst die Patientinnen, dann die Berichte. Andersherum zeigten
    // die Berichte für einen Augenblick auf Personen, die es noch
    // nicht gibt — und bei einem Abbruch dazwischen dauerhaft.
    for p in payload.patients {
        store.patient_schreiben(&p)?;
    }
    let n = store.import_cases(payload.cases, replace)?;
    for (k, v) in payload.settings {
        store.set_setting(&k, &v)?;
    }
    Ok(n)
}

fn collect_settings(store: &Store) -> Result<Vec<(String, String)>> {
    let mut out = Vec::new();
    for key in ["profile", "budget", "ui"] {
        if let Some(v) = store.get_setting(key)? {
            out.push((key.to_string(), v));
        }
    }
    Ok(out)
}

// ---------------------------------------------------------------
// Tägliche Sicherung
// ---------------------------------------------------------------

pub fn auto_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("sicherungen")
}

/// Legt einen Stand an, falls heute noch keiner existiert, und entfernt
/// die ältesten, sobald mehr als sieben vorhanden sind.
pub fn run_auto_backup(store: &Store, data_dir: &Path) -> Result<Option<PathBuf>> {
    let dir = auto_dir(data_dir);
    std::fs::create_dir_all(&dir)?;

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let target = dir.join(format!("rana-{today}.ranasic"));
    if target.exists() {
        return Ok(None);
    }

    // Die tägliche Sicherung nutzt den Datenbankschlüssel selbst als
    // Passwort. Sie liegt im geschützten Benutzerprofil und soll ohne
    // Zutun laufen; wer den Tresor hat, kommt ohnehin an die Daten.
    let pw = secrets::export_db_key_b64()?;
    write_backup(store, &target, &pw)?;

    // Aufräumen
    let mut files: Vec<PathBuf> = std::fs::read_dir(&dir)?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().map(|x| x == "ranasic").unwrap_or(false))
        .collect();
    files.sort();
    while files.len() > AUTO_KEEP {
        let oldest = files.remove(0);
        let _ = std::fs::remove_file(oldest);
    }

    Ok(Some(target))
}

/// Stellt aus einer täglichen Sicherung wieder her.
pub fn restore_auto(store: &Store, path: &Path) -> Result<usize> {
    let pw = secrets::export_db_key_b64()?;
    read_backup(store, path, &pw, true)
}

pub fn list_auto(data_dir: &Path) -> Vec<(String, i64)> {
    let dir = auto_dir(data_dir);
    let Ok(rd) = std::fs::read_dir(&dir) else {
        return Vec::new();
    };
    let mut out: Vec<(String, i64)> = rd
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|x| x == "ranasic").unwrap_or(false))
        .filter_map(|e| {
            let size = e.metadata().ok()?.len() as i64;
            Some((e.path().to_string_lossy().to_string(), size))
        })
        .collect();
    out.sort_by(|a, b| b.0.cmp(&a.0));
    out
}
