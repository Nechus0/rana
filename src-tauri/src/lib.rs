//! Rana — Assistent für Berichte an den Gutachter.
//!
//! Diese Datei ist die Brücke. Sie legt fest, was die Oberfläche vom
//! Rechner verlangen darf, und sonst nichts. Alles Vertrauliche —
//! Schlüssel, Falldaten, Netzzugriff, Kostengrenze — liegt hinter
//! dieser Grenze und ist von aussen nicht zu erreichen.

mod backup;
mod budget;
mod claude;
mod error;
mod secrets;
mod settings;
mod store;

use error::{RanaError, Result};
use settings::Profile;
use std::path::PathBuf;
use std::sync::Arc;
use store::{Case, CaseSummary, Store};
use tauri::{Manager, State};

pub struct App {
    store: Arc<Store>,
    data_dir: PathBuf,
}

// ===============================================================
// Einrichtung
// ===============================================================

#[tauri::command]
fn get_profile(app: State<App>) -> Result<Profile> {
    settings::load(&app.store)
}

#[tauri::command]
fn save_profile(app: State<App>, profile: Profile) -> Result<()> {
    settings::save(&app.store, &profile)
}

/// Ob Rana in die Arbeitsansicht oder in den Assistenten startet.
#[tauri::command]
fn is_configured(app: State<App>) -> Result<bool> {
    Ok(settings::load(&app.store)?.eingerichtet)
}

// ===============================================================
// Der Schlüssel
// ===============================================================

#[tauri::command]
fn set_api_key(key: String) -> Result<()> {
    secrets::set_api_key(&key)
}

#[tauri::command]
fn clear_api_key() -> Result<()> {
    secrets::clear_api_key()
}

/// Die Oberfläche erfährt nur, dass ein Schlüssel da ist und wie seine
/// letzten vier Zeichen lauten. Auslesen kann sie ihn nicht.
#[tauri::command]
fn api_key_status() -> serde_json::Value {
    serde_json::json!({
        "vorhanden": secrets::has_api_key(),
        "maskiert": secrets::masked_api_key(),
    })
}

/// Prüft den hinterlegten Schlüssel mit einem sehr kurzen Aufruf.
#[tauri::command]
async fn test_api_key(app: State<'_, App>, key: Option<String>) -> Result<()> {
    let model = settings::load(&app.store)?.api.model;
    let key = match key {
        Some(k) if !k.trim().is_empty() => k,
        _ => secrets::get_api_key()?,
    };
    claude::test_key(&key, &model).await
}

// ===============================================================
// Fälle
// ===============================================================

#[tauri::command]
fn list_cases(app: State<App>, query: Option<String>, trashed: Option<bool>) -> Result<Vec<CaseSummary>> {
    app.store
        .list_cases(query.unwrap_or_default().as_str(), trashed.unwrap_or(false))
}

#[tauri::command]
fn get_case(app: State<App>, id: String) -> Result<Case> {
    app.store.get_case(&id)
}

#[tauri::command]
fn save_case(app: State<App>, case: Case) -> Result<Case> {
    app.store.save_case(case)
}

#[tauri::command]
fn trash_case(app: State<App>, id: String) -> Result<()> {
    app.store.trash_case(&id)
}

#[tauri::command]
fn restore_case(app: State<App>, id: String) -> Result<()> {
    app.store.restore_case(&id)
}

/// Endgültig. Die Oberfläche fragt vorher ausdrücklich nach.
#[tauri::command]
fn purge_case(app: State<App>, id: String) -> Result<()> {
    app.store.purge_case(&id)
}

// ===============================================================
// Textbausteine
// ===============================================================

#[tauri::command]
fn add_snippet(app: State<App>, field: String, text: String) -> Result<String> {
    app.store.add_snippet(&field, &text)
}

#[tauri::command]
fn list_snippets(app: State<App>, field: String) -> Result<Vec<(String, String)>> {
    app.store.list_snippets(&field)
}

#[tauri::command]
fn delete_snippet(app: State<App>, id: String) -> Result<()> {
    app.store.delete_snippet(&id)
}

// ===============================================================
// Formulieren
// ===============================================================

/// Der eigentliche Aufruf. Der Text kommt zusätzlich laufend als
/// Ereignis `rana://stream` an, damit er beim Entstehen sichtbar ist.
#[tauri::command]
async fn generate_report(
    app_handle: tauri::AppHandle,
    app: State<'_, App>,
    request: claude::GenerateRequest,
) -> Result<claude::GenerateResult> {
    let profile = settings::load(&app.store)?;
    if !profile.eingerichtet {
        return Err(RanaError::NotConfigured);
    }
    claude::generate_streaming(&app_handle, request, &app.store, &profile.budget).await
}

/// Prüft einen Text auf Klarnamen, ohne etwas zu senden. Die Oberfläche
/// benutzt das, um vor dem Absenden zu warnen statt hinterher.
#[tauri::command]
fn check_clear_names(text: String, names: Vec<String>) -> Option<String> {
    claude::find_clear_name(&text, &names)
}

// ===============================================================
// Verbrauch
// ===============================================================

#[tauri::command]
fn budget_state(app: State<App>) -> Result<budget::BudgetState> {
    let profile = settings::load(&app.store)?;
    budget::state(&app.store, &profile.budget, &profile.api.model)
}

#[tauri::command]
fn monthly_usage(app: State<App>, months: Option<u32>) -> Result<Vec<(String, f64, u32)>> {
    app.store.monthly_usage(months.unwrap_or(6))
}

// ===============================================================
// Sicherung
// ===============================================================

#[tauri::command]
fn write_backup(app: State<App>, path: String, password: String) -> Result<usize> {
    backup::write_backup(&app.store, std::path::Path::new(&path), &password)
}

#[tauri::command]
fn read_backup(app: State<App>, path: String, password: String, replace: bool) -> Result<usize> {
    backup::read_backup(&app.store, std::path::Path::new(&path), &password, replace)
}

#[tauri::command]
fn list_auto_backups(app: State<App>) -> Vec<(String, i64)> {
    backup::list_auto(&app.data_dir)
}

#[tauri::command]
fn restore_auto_backup(app: State<App>, path: String) -> Result<usize> {
    backup::restore_auto(&app.store, std::path::Path::new(&path))
}

// ===============================================================
// Übernahme aus dem Vorgängerprogramm
// ===============================================================

/// Liest die Fälle aus einer Ausleitung des alten HTML-Artefakts.
///
/// Ausdrücklich nur auf Anforderung. Es passiert nichts von selbst, und
/// das alte Artefakt wird dabei nicht verändert — hier wird nur gelesen.
#[tauri::command]
fn import_legacy(app: State<App>, json: String) -> Result<usize> {
    #[derive(serde::Deserialize)]
    struct LegacyCase {
        #[serde(default)]
        id: String,
        #[serde(default)]
        data: serde_json::Map<String, serde_json::Value>,
        #[serde(default)]
        report: String,
        #[serde(rename = "updatedAt", default)]
        updated_at: i64,
    }
    #[derive(serde::Deserialize)]
    struct LegacyStore {
        #[serde(default)]
        cases: std::collections::HashMap<String, LegacyCase>,
    }

    let parsed: LegacyStore = serde_json::from_str(&json).map_err(|_| {
        RanaError::Message(
            "Diese Datei enthält keine Fälle aus dem Vorgängerprogramm. Erwartet wird der Inhalt des Eintrags „ptv3_cases_v1“.".into(),
        )
    })?;

    let mut n = 0;
    for (_, lc) in parsed.cases {
        let id = if lc.id.is_empty() {
            uuid::Uuid::new_v4().to_string()
        } else {
            lc.id
        };
        app.store.save_case(Case {
            id,
            fields: lc.data,
            report: lc.report,
            updated_at: lc.updated_at,
            created_at: lc.updated_at,
            deleted_at: None,
        })?;
        n += 1;
    }
    Ok(n)
}

// ===============================================================
// Start
// ===============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // Die Aktualisierung wird ausschliesslich von Hand ausgelöst
        // (Einstellungen → „Nach Aktualisierung suchen"). Rana ruft
        // GitHub nie von selbst an — siehe das Versprechen im README.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let data_dir = Store::data_dir(&app.handle())?;
            let store = Arc::new(Store::open(&data_dir)?);

            // Die tägliche Sicherung läuft still beim Start. Schlägt sie
            // fehl, darf das die Anwendung nicht am Starten hindern —
            // gemeldet wird es trotzdem.
            if let Err(e) = backup::run_auto_backup(&store, &data_dir) {
                log::warn!("Tägliche Sicherung fehlgeschlagen: {e}");
            }

            app.manage(App { store, data_dir });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_profile,
            save_profile,
            is_configured,
            set_api_key,
            clear_api_key,
            api_key_status,
            test_api_key,
            list_cases,
            get_case,
            save_case,
            trash_case,
            restore_case,
            purge_case,
            add_snippet,
            list_snippets,
            delete_snippet,
            generate_report,
            check_clear_names,
            budget_state,
            monthly_usage,
            write_backup,
            read_backup,
            list_auto_backups,
            restore_auto_backup,
            import_legacy,
        ])
        .run(tauri::generate_context!())
        .expect("Rana konnte nicht gestartet werden");
}
