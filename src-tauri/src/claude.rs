//! Der Weg nach draussen.
//!
//! Dies ist die einzige Stelle im Programm, an der eine Netzverbindung
//! aufgebaut wird, und sie geht ausschliesslich an api.anthropic.com.
//!
//! Vier Dinge passieren hier, in dieser Reihenfolge:
//!
//!   1. Die Klarnamensperre. Enthält irgendein Teil der Anfrage den
//!      Klarnamen der Patientin, wird abgebrochen, bevor irgendetwas
//!      das Gerät verlässt.
//!   2. Der Kostenwächter (budget.rs).
//!   3. Der Aufbau der Anfrage mit Zwischenspeicherung des Regelteils.
//!   4. Das Lesen der Antwort Stück für Stück, damit die Oberfläche
//!      den Text entstehen lassen kann.

use crate::budget;
use crate::error::{RanaError, Result};
use crate::secrets;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter};

const ENDPOINT: &str = "https://api.anthropic.com/v1/messages";
const API_VERSION: &str = "2023-06-01";

/// Feste Obergrenze je Aufruf. Der Bericht soll rund 1.800 Marken lang
/// werden; 4.000 lassen reichlich Luft und begrenzen zugleich den
/// teuersten denkbaren Einzelaufruf auf etwa elf Cent.
const MAX_TOKENS: u32 = 4_000;

const RETRIES: u32 = 2;

#[derive(Deserialize, Debug)]
pub struct GenerateRequest {
    pub model: String,
    /// Der unveränderliche Regelteil. Er wird zwischengespeichert.
    pub system: String,
    /// Die Falldaten. Ändern sich bei jedem Bericht.
    pub user: String,
    /// Klarnamen, die nicht hinausgehen dürfen.
    #[serde(default)]
    pub forbidden_names: Vec<String>,
    /// "report" oder "expand" — nur für die Verbrauchsübersicht.
    #[serde(default = "default_kind")]
    pub kind: String,
}

fn default_kind() -> String {
    "report".into()
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct GenerateResult {
    pub text: String,
    pub input_tokens: u64,
    pub cached_tokens: u64,
    pub output_tokens: u64,
    pub cost_eur: f64,
    pub stop_reason: String,
}

// ---------------------------------------------------------------
// Die Klarnamensperre
// ---------------------------------------------------------------

/// Prüft, ob ein zu schützender Name im Text vorkommt.
///
/// Verglichen wird ohne Rücksicht auf Gross- und Kleinschreibung und an
/// Wortgrenzen, damit „Berger" nicht in „Bergerkrankung" anschlägt.
/// Einzelne Buchstaben und sehr kurze Bruchstücke werden übergangen —
/// sie würden nur Fehlalarme erzeugen.
pub fn find_clear_name(text: &str, names: &[String]) -> Option<String> {
    let hay = text.to_lowercase();

    for full in names {
        // Der ganze Name und jeder einzelne Namensteil werden geprüft.
        // In den Feldern steht oft nur der Nachname.
        let mut parts: Vec<String> = full
            .split_whitespace()
            .map(|p| p.trim_matches(|c: char| !c.is_alphanumeric()).to_string())
            .filter(|p| p.chars().count() >= 3)
            .collect();
        let whole = full.trim();
        if whole.chars().count() >= 3 {
            parts.push(whole.to_string());
        }

        for part in parts {
            let needle = part.to_lowercase();
            if contains_word(&hay, &needle) {
                return Some(part);
            }
        }
    }
    None
}

fn contains_word(hay: &str, needle: &str) -> bool {
    if needle.is_empty() {
        return false;
    }
    let hb: Vec<char> = hay.chars().collect();
    let nb: Vec<char> = needle.chars().collect();
    if nb.len() > hb.len() {
        return false;
    }
    for start in 0..=(hb.len() - nb.len()) {
        if hb[start..start + nb.len()] != nb[..] {
            continue;
        }
        let before_ok = start == 0 || !is_wordish(hb[start - 1]);
        let after_i = start + nb.len();
        let after_ok = after_i >= hb.len() || !is_wordish(hb[after_i]);
        if before_ok && after_ok {
            return true;
        }
    }
    false
}

fn is_wordish(c: char) -> bool {
    c.is_alphanumeric() || c == '-'
}

// ---------------------------------------------------------------
// Der Aufruf
// ---------------------------------------------------------------

fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .connect_timeout(std::time::Duration::from_secs(20))
        .user_agent("Rana/1.0")
        // Nur verschlüsselte Verbindungen, Zertifikate werden geprüft.
        .https_only(true)
        .build()
        .map_err(Into::into)
}

fn body(req: &GenerateRequest, stream: bool) -> serde_json::Value {
    json!({
        "model": req.model,
        "max_tokens": MAX_TOKENS,
        "stream": stream,
        // Der Regelteil bekommt eine Zwischenspeicher-Markierung. Er ist
        // bei jedem Bericht identisch und macht den grössten Teil der
        // Eingabe aus; ab dem zweiten Bericht innerhalb der Speicherzeit
        // kostet er nur noch ein Zehntel.
        "system": [{
            "type": "text",
            "text": req.system,
            "cache_control": { "type": "ephemeral" }
        }],
        "messages": [{
            "role": "user",
            "content": [{ "type": "text", "text": req.user }]
        }]
    })
}

fn map_status(status: reqwest::StatusCode, body: &str) -> RanaError {
    match status.as_u16() {
        401 | 403 => RanaError::ApiKeyRejected,
        429 => {
            if body.contains("credit") || body.contains("billing") {
                RanaError::ApiOutOfCredit
            } else {
                RanaError::ApiOverloaded
            }
        }
        400 if body.contains("credit balance") => RanaError::ApiOutOfCredit,
        529 | 503 | 502 => RanaError::ApiOverloaded,
        _ => RanaError::Message(format!(
            "Anthropic hat die Anfrage abgelehnt (Status {status}). Bitte später erneut versuchen."
        )),
    }
}

/// Kurzer Aufruf, um zu prüfen, ob der Schlüssel gültig ist.
/// Kostet Bruchteile eines Cents und wird nicht in den Verbrauch
/// eingerechnet, weil er zur Einrichtung gehört.
pub async fn test_key(key: &str, model: &str) -> Result<()> {
    let res = client()?
        .post(ENDPOINT)
        .header("x-api-key", key)
        .header("anthropic-version", API_VERSION)
        .header("content-type", "application/json")
        .json(&json!({
            "model": model,
            "max_tokens": 4,
            "messages": [{ "role": "user", "content": "ok" }]
        }))
        .send()
        .await?;

    if res.status().is_success() {
        return Ok(());
    }
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    Err(map_status(status, &text))
}

/// Formuliert den Bericht und schiebt den Text laufend an die Oberfläche.
///
/// Ereignisse an das Frontend:
///   `rana://stream`     — ein weiteres Textstück
///   `rana://transmit`   — true beim Beginn, false am Ende. Steuert die
///                         Blaufärbung der Oberfläche.
pub async fn generate_streaming(
    app: &AppHandle,
    req: GenerateRequest,
    store: &crate::store::Store,
    budget_settings: &budget::BudgetSettings,
) -> Result<GenerateResult> {
    // ---- 1. Klarnamensperre --------------------------------------
    // Sie läuft VOR allem anderen, damit auch bei einem Fehler weiter
    // unten nichts hinausgegangen sein kann.
    let combined = format!("{}\n{}", req.system, req.user);
    if let Some(hit) = find_clear_name(&combined, &req.forbidden_names) {
        return Err(RanaError::ClearNameDetected { name: hit });
    }

    // ---- 2. Kostenwächter ----------------------------------------
    budget::guard(store, budget_settings, &req.model)?;

    // ---- 3. Schlüssel --------------------------------------------
    let key = secrets::get_api_key()?;

    // ---- 4. Senden, mit begrenzter Wiederholung ------------------
    let mut attempt = 0;
    loop {
        // Die Blaufärbung beginnt erst hier, unmittelbar vor dem
        // tatsächlichen Netzzugriff, und endet mit ihm.
        let _ = app.emit("rana://transmit", true);

        let outcome = stream_once(app, &key, &req).await;

        match outcome {
            Ok(mut result) => {
                let _ = app.emit("rana://transmit", false);
                result.cost_eur = budget::cost_eur(
                    &req.model,
                    result.input_tokens,
                    result.cached_tokens,
                    result.output_tokens,
                );
                store.record_usage(
                    &req.model,
                    result.input_tokens,
                    result.cached_tokens,
                    result.output_tokens,
                    result.cost_eur,
                    &req.kind,
                )?;
                return Ok(result);
            }
            Err(e) => {
                let _ = app.emit("rana://transmit", false);
                let retryable = matches!(e, RanaError::ApiOverloaded | RanaError::Offline);
                if retryable && attempt < RETRIES {
                    attempt += 1;
                    // Ein fehlgeschlagener Versuch kostet nichts, deshalb
                    // ist eine Wiederholung unbedenklich. Die Wartezeit
                    // wächst, damit ein überlasteter Dienst Luft bekommt.
                    let wait = 2u64.pow(attempt) * 1_000;
                    tokio::time::sleep(std::time::Duration::from_millis(wait)).await;
                    continue;
                }
                return Err(e);
            }
        }
    }
}

async fn stream_once(
    app: &AppHandle,
    key: &str,
    req: &GenerateRequest,
) -> Result<GenerateResult> {
    let res = client()?
        .post(ENDPOINT)
        .header("x-api-key", key)
        .header("anthropic-version", API_VERSION)
        .header("content-type", "application/json")
        .json(&body(req, true))
        .send()
        .await?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(map_status(status, &text));
    }

    let mut out = GenerateResult::default();
    let mut buf = String::new();
    let mut bytes = res.bytes_stream();

    while let Some(chunk) = bytes.next().await {
        let chunk = chunk?;
        buf.push_str(&String::from_utf8_lossy(&chunk));

        // Server-Sent-Events: Blöcke sind durch eine Leerzeile getrennt.
        while let Some(idx) = buf.find("\n\n") {
            let block: String = buf.drain(..idx + 2).collect();
            for line in block.lines() {
                let Some(payload) = line.strip_prefix("data: ") else {
                    continue;
                };
                let Ok(v) = serde_json::from_str::<serde_json::Value>(payload) else {
                    continue;
                };

                match v.get("type").and_then(|t| t.as_str()) {
                    Some("content_block_delta") => {
                        if let Some(t) = v
                            .get("delta")
                            .and_then(|d| d.get("text"))
                            .and_then(|t| t.as_str())
                        {
                            out.text.push_str(t);
                            let _ = app.emit("rana://stream", t);
                        }
                    }
                    Some("message_start") => {
                        if let Some(u) = v.get("message").and_then(|m| m.get("usage")) {
                            out.input_tokens = u
                                .get("input_tokens")
                                .and_then(|x| x.as_u64())
                                .unwrap_or(0);
                            // Beim ersten Bericht wird der Regelteil in den
                            // Zwischenspeicher geschrieben, danach nur noch
                            // gelesen. Beides zählt getrennt.
                            let written = u
                                .get("cache_creation_input_tokens")
                                .and_then(|x| x.as_u64())
                                .unwrap_or(0);
                            let read = u
                                .get("cache_read_input_tokens")
                                .and_then(|x| x.as_u64())
                                .unwrap_or(0);
                            out.cached_tokens = read;
                            // Das Schreiben kostet etwas mehr als normale
                            // Eingabe; es wird konservativ als solche gezählt.
                            out.input_tokens += written;
                        }
                    }
                    Some("message_delta") => {
                        if let Some(u) = v.get("usage") {
                            if let Some(o) = u.get("output_tokens").and_then(|x| x.as_u64()) {
                                out.output_tokens = o;
                            }
                        }
                        if let Some(r) = v
                            .get("delta")
                            .and_then(|d| d.get("stop_reason"))
                            .and_then(|s| s.as_str())
                        {
                            out.stop_reason = r.to_string();
                        }
                    }
                    Some("error") => {
                        let msg = v
                            .get("error")
                            .and_then(|e| e.get("message"))
                            .and_then(|m| m.as_str())
                            .unwrap_or("Unbekannter Fehler");
                        if msg.contains("overloaded") {
                            return Err(RanaError::ApiOverloaded);
                        }
                        return Err(RanaError::Message(format!(
                            "Anthropic hat die Formulierung abgebrochen: {msg}"
                        )));
                    }
                    _ => {}
                }
            }
        }
    }

    if out.text.trim().is_empty() {
        return Err(RanaError::Message(
            "Die Schnittstelle hat keinen Text zurückgegeben. Bitte erneut versuchen.".into(),
        ));
    }
    Ok(out)
}

// ---------------------------------------------------------------

// ===============================================================
// Prüfstand
// ===============================================================
//
// Diese Tests sichern die beiden Stellen ab, an denen ein Fehler
// wirklich weh täte: ein Klarname, der hinausgeht, und Kosten, die
// unbemerkt entstehen. Sie laufen bei jedem Bau mit.

#[cfg(test)]
mod tests {
    use super::*;

    // ---- Klarnamensperre ----------------------------------------

    #[test]
    fn nachname_wird_erkannt() {
        let n = vec!["Maria Bergmann".to_string()];
        assert_eq!(
            find_clear_name("Frau Bergmann berichtet, sie sei erschöpft.", &n),
            Some("Bergmann".into())
        );
    }

    #[test]
    fn vorname_wird_erkannt() {
        let n = vec!["Maria Bergmann".to_string()];
        assert_eq!(find_clear_name("Maria kam pünktlich.", &n), Some("Maria".into()));
    }

    #[test]
    fn pseudonymisierter_text_geht_durch() {
        let n = vec!["Maria Bergmann".to_string()];
        assert_eq!(find_clear_name("Die Patientin berichtet, sie sei erschöpft.", &n), None);
        assert_eq!(find_clear_name("Chiffre A.M.-1974, geb. 12.03.1974", &n), None);
    }

    #[test]
    fn teilwoerter_loesen_keinen_fehlalarm_aus() {
        let n = vec!["Berg".to_string()];
        assert_eq!(find_clear_name("Freude am Bergsteigen", &n), None);
        assert_eq!(find_clear_name("Herr Berg kam pünktlich", &n), Some("Berg".into()));
    }

    #[test]
    fn gross_und_kleinschreibung_egal() {
        let n = vec!["Bergmann".to_string()];
        assert!(find_clear_name("BERGMANN", &n).is_some());
        assert!(find_clear_name("bergmann", &n).is_some());
    }

    #[test]
    fn zu_kurze_namensteile_werden_uebergangen() {
        // Zweibuchstabige Teile würden in fast jedem Text anschlagen.
        let n = vec!["Li Wang".to_string()];
        assert_eq!(find_clear_name("die Familie ist ihr wichtig", &n), None);
        assert_eq!(find_clear_name("Frau Wang berichtet", &n), Some("Wang".into()));
    }

    #[test]
    fn zusammengesetzte_woerter_schlagen_nicht_an() {
        let n = vec!["Roesick".to_string()];
        assert_eq!(find_clear_name("Roesick", &n), Some("Roesick".into()));
        assert_eq!(find_clear_name("Roesickstrasse", &n), None);
    }

    #[test]
    fn satzzeichen_direkt_am_namen() {
        let n = vec!["Bergmann".to_string()];
        for t in ["Frau Bergmann.", "(Bergmann)", "Bergmann, 38", "\u{201e}Bergmann\u{201c}"] {
            assert!(find_clear_name(t, &n).is_some(), "nicht erkannt in: {t}");
        }
    }

    // ---- Kosten -------------------------------------------------

    #[test]
    fn ein_bericht_kostet_etwa_fuenf_cent() {
        // Gemessene Grössenordnung: 2.400 Marken hinein, 1.800 hinaus.
        let c = budget::cost_eur("claude-opus-5", 2_400, 0, 1_800);
        assert!(c > 0.03 && c < 0.07, "erwartet rund 5 Cent, war {c:.4} €");
    }

    #[test]
    fn ein_bericht_pro_tag_bleibt_weit_unter_dem_budget() {
        let monat = budget::cost_eur("claude-opus-5", 2_400, 0, 1_800) * 31.0;
        assert!(monat < 3.0, "ein Bericht täglich sollte unter 3 € liegen, war {monat:.2} €");
    }

    #[test]
    fn zwischenspeicher_senkt_die_kosten() {
        let ohne = budget::cost_eur("claude-opus-5", 2_400, 0, 1_800);
        let mit = budget::cost_eur("claude-opus-5", 400, 2_000, 1_800);
        assert!(mit < ohne, "der Zwischenspeicher muss günstiger sein: {mit:.4} vs {ohne:.4}");
    }

    #[test]
    fn teuerster_denkbarer_aufruf_ist_begrenzt() {
        // MAX_TOKENS steht fest auf 4.000. Selbst bei voll ausgereizter
        // Eingabe bleibt ein einzelner Aufruf zweistellig in Cent.
        let schlimmstenfalls = budget::cost_eur("claude-opus-5", 8_000, 0, MAX_TOKENS as u64);
        assert!(schlimmstenfalls < 0.15, "Obergrenze verletzt: {schlimmstenfalls:.4} €");
    }

    #[test]
    fn unbekanntes_modell_wird_teuer_gerechnet() {
        // Lieber zu früh bremsen als zu spät.
        let a = budget::cost_eur("irgendwas-neues", 1_000, 0, 1_000);
        let b = budget::cost_eur("claude-opus-5", 1_000, 0, 1_000);
        assert_eq!(a, b);
    }
}
