//! Fehler, die an die Oberfläche gehen.
//!
//! Grundsatz: Was hier ankommt, wird der Nutzerin unverändert gezeigt.
//! Deshalb steht in jeder Meldung, was passiert ist UND was zu tun ist —
//! nie ein blosser Statuscode. Technische Einzelheiten gehen ins
//! Protokoll, nicht auf den Bildschirm.

use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum RanaError {
    #[error("Es ist kein Schlüssel hinterlegt. Bitte in den Einstellungen unter „Claude-Zugang“ eintragen.")]
    NoApiKey,

    #[error("Der hinterlegte Schlüssel wird von Anthropic abgelehnt. Bitte in den Einstellungen prüfen, ob er vollständig kopiert wurde.")]
    ApiKeyRejected,

    #[error("Anthropic meldet, dass für diesen Schlüssel kein Guthaben mehr verfügbar ist. Bitte die Abrechnung in der Anthropic-Console prüfen.")]
    ApiOutOfCredit,

    #[error("Die Schnittstelle ist gerade überlastet. Rana hat es mehrfach versucht. Bitte in einigen Minuten erneut formulieren.")]
    ApiOverloaded,

    #[error("Keine Verbindung zu Anthropic. Bitte die Internetverbindung prüfen.")]
    Offline,

    #[error("Das Monatsbudget von {limit:.2} € ist ausgeschöpft ({used:.2} € verbraucht). Rana sendet nichts mehr, bis das Budget angehoben wird oder der Monat wechselt.")]
    BudgetExhausted { used: f64, limit: f64 },

    #[error("Das Tageslimit von {limit} Berichten ist erreicht. Es schützt vor einem Programmfehler, der ungewollt Kosten verursacht. In den Einstellungen anpassbar.")]
    DailyLimit { limit: u32 },

    /// Die Sperre, die verhindert, dass Klarnamen das Gerät verlassen.
    #[error("Rana hat abgebrochen: der Text enthält den Klarnamen „{name}“. Klarnamen dürfen die Schnittstelle nicht erreichen. Bitte die betroffene Stelle durch die Chiffre ersetzen.")]
    ClearNameDetected { name: String },

    #[error("Die Falldatenbank lässt sich nicht öffnen. Möglicherweise läuft Rana bereits in einem anderen Fenster.")]
    StoreLocked,

    #[error("Der Schlüssel zur Falldatenbank fehlt im Windows-Tresor. Ohne ihn lassen sich vorhandene Fälle nicht entschlüsseln. Bitte eine Sicherung wiederherstellen.")]
    MissingDbKey,

    #[error("Die Falldaten liessen sich nicht entschlüsseln. Die Datei gehört möglicherweise zu einer anderen Installation.")]
    DecryptFailed,

    #[error("Die Ersteinrichtung ist noch nicht abgeschlossen.")]
    NotConfigured,

    #[error("{0}")]
    Message(String),
}

// Innere Fehler bekommen eine verständliche Aussenseite. Die technische
// Ursache bleibt im Text erhalten, weil sie bei der Fehlersuche hilft,
// aber sie steht nie allein da.
impl From<rusqlite::Error> for RanaError {
    fn from(e: rusqlite::Error) -> Self {
        RanaError::Message(format!(
            "Die Falldatenbank hat einen Fehler gemeldet. Bitte Rana neu starten. Technische Angabe: {e}"
        ))
    }
}

impl From<std::io::Error> for RanaError {
    fn from(e: std::io::Error) -> Self {
        RanaError::Message(format!(
            "Auf eine Datei konnte nicht zugegriffen werden. Technische Angabe: {e}"
        ))
    }
}

impl From<serde_json::Error> for RanaError {
    fn from(e: serde_json::Error) -> Self {
        RanaError::Message(format!(
            "Ein gespeicherter Datensatz ist beschädigt. Technische Angabe: {e}"
        ))
    }
}

impl From<keyring::Error> for RanaError {
    fn from(e: keyring::Error) -> Self {
        match e {
            keyring::Error::NoEntry => RanaError::NoApiKey,
            other => RanaError::Message(format!(
                "Der Windows-Tresor ist nicht erreichbar. Technische Angabe: {other}"
            )),
        }
    }
}

impl From<reqwest::Error> for RanaError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() || e.is_connect() {
            RanaError::Offline
        } else {
            RanaError::Message(format!(
                "Die Verbindung zu Anthropic ist fehlgeschlagen. Technische Angabe: {e}"
            ))
        }
    }
}

/// Was die Oberfläche bekommt: eine Kennung zum Verzweigen und einen
/// fertigen deutschen Satz zum Anzeigen.
#[derive(Serialize)]
pub struct WireError {
    pub kind: &'static str,
    pub message: String,
}

impl serde::Serialize for RanaError {
fn serialize<S: serde::Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        let kind = match self {
            RanaError::NoApiKey => "no_api_key",
            RanaError::ApiKeyRejected => "api_key_rejected",
            RanaError::ApiOutOfCredit => "out_of_credit",
            RanaError::ApiOverloaded => "overloaded",
            RanaError::Offline => "offline",
            RanaError::BudgetExhausted { .. } => "budget_exhausted",
            RanaError::DailyLimit { .. } => "daily_limit",
            RanaError::ClearNameDetected { .. } => "clear_name",
            RanaError::StoreLocked => "store_locked",
            RanaError::MissingDbKey => "missing_db_key",
            RanaError::DecryptFailed => "decrypt_failed",
            RanaError::NotConfigured => "not_configured",
            RanaError::Message(_) => "error",
        };
        WireError {
            kind,
            message: self.to_string(),
        }
        .serialize(s)
    }
}

pub type Result<T> = std::result::Result<T, RanaError>;
