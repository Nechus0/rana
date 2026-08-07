//! Der Tresor.
//!
//! Zwei Geheimnisse liegen im Windows Credential Manager:
//!
//!   * `api-key`  — der Anthropic-Schlüssel
//!   * `db-key`   — der 256-Bit-Schlüssel, mit dem die Falldaten
//!                  verschlüsselt sind
//!
//! Beide verlassen dieses Modul nie in Richtung Oberfläche. Das
//! Frontend kann den Schlüssel setzen und löschen, aber nicht lesen.
//! Es bekommt nur eine maskierte Form zu sehen. Selbst wenn im
//! Frontend etwas eingeschleust würde, wäre der Schlüssel nicht
//! abgreifbar — er existiert dort schlicht nicht.

use crate::error::{RanaError, Result};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use keyring::Entry;
use rand::RngCore;

const SERVICE: &str = "Rana";
const ACC_API: &str = "anthropic-api-key";
const ACC_DB: &str = "db-key";

fn entry(account: &str) -> Result<Entry> {
    Entry::new(SERVICE, account).map_err(Into::into)
}

// ---------------------------------------------------------------
// Anthropic-Schlüssel
// ---------------------------------------------------------------

pub fn set_api_key(key: &str) -> Result<()> {
    let key = key.trim();
    if key.is_empty() {
        return Err(RanaError::Message(
            "Es wurde kein Schlüssel eingegeben.".into(),
        ));
    }
    // Eine frühe Formprüfung erspart einen fehlschlagenden Aufruf und
    // fängt den häufigsten Fehler ab: einen halb kopierten Schlüssel.
    if !key.starts_with("sk-ant-") {
        return Err(RanaError::Message(
            "Das sieht nicht nach einem Anthropic-Schlüssel aus. Er beginnt mit „sk-ant-“. Bitte prüfen, ob der Text vollständig kopiert wurde.".into(),
        ));
    }
    if key.len() < 40 {
        return Err(RanaError::Message(
            "Der Schlüssel ist zu kurz. Vermutlich wurde nur ein Teil kopiert.".into(),
        ));
    }
    entry(ACC_API)?.set_password(key)?;
    Ok(())
}

pub fn get_api_key() -> Result<String> {
    match entry(ACC_API)?.get_password() {
        Ok(k) => Ok(k),
        Err(keyring::Error::NoEntry) => Err(RanaError::NoApiKey),
        Err(e) => Err(e.into()),
    }
}

pub fn has_api_key() -> bool {
    matches!(entry(ACC_API).and_then(|e| e.get_password().map_err(Into::into)), Ok(_))
}

pub fn clear_api_key() -> Result<()> {
    match entry(ACC_API)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.into()),
    }
}

/// Was die Oberfläche über den Schlüssel erfahren darf: dass es ihn gibt
/// und woran er wiederzuerkennen ist. Mehr nicht.
pub fn masked_api_key() -> Option<String> {
    let k = entry(ACC_API).ok()?.get_password().ok()?;
    let tail: String = k.chars().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect();
    Some(format!("sk-ant-…{tail}"))
}

// ---------------------------------------------------------------
// Datenbankschlüssel
// ---------------------------------------------------------------

/// Holt den Schlüssel der Falldatenbank. Existiert er noch nicht, wird
/// einer erzeugt — das passiert genau einmal, beim ersten Start.
///
/// Wichtig: Beim Wiederherstellen einer Sicherung darf hier NICHT still
/// ein neuer Schlüssel entstehen, sonst wären die alten Daten verloren.
/// Deshalb legt nur `ensure_db_key` an; `require_db_key` verlangt einen
/// vorhandenen.
pub fn ensure_db_key() -> Result<[u8; 32]> {
    if let Ok(existing) = require_db_key() {
        return Ok(existing);
    }
    let mut key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);
    entry(ACC_DB)?.set_password(&B64.encode(key))?;
    Ok(key)
}

pub fn require_db_key() -> Result<[u8; 32]> {
    let raw = match entry(ACC_DB)?.get_password() {
        Ok(v) => v,
        Err(keyring::Error::NoEntry) => return Err(RanaError::MissingDbKey),
        Err(e) => return Err(e.into()),
    };
    let bytes = B64.decode(raw.as_bytes()).map_err(|_| RanaError::MissingDbKey)?;
    if bytes.len() != 32 {
        return Err(RanaError::MissingDbKey);
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&bytes);
    Ok(key)
}

/// Nur für das Wiederherstellen einer Sicherung: den mitgelieferten
/// Schlüssel übernehmen, damit die Daten daraus lesbar sind.
pub fn set_db_key(key: &[u8; 32]) -> Result<()> {
    entry(ACC_DB)?.set_password(&B64.encode(key))?;
    Ok(())
}

pub fn export_db_key_b64() -> Result<String> {
    Ok(B64.encode(require_db_key()?))
}
