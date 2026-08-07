//! Das Praxisprofil.
//!
//! Der Vorgänger hatte Praxisadresse, Verfahren und Berufsbezeichnung
//! fest im Programmtext stehen. Rana weiss davon nichts, bis der
//! Einrichtungsassistent gelaufen ist. Alles hier ist Vorgabe für neu
//! angelegte Fälle und lässt sich später ändern.

use crate::budget::BudgetSettings;
use crate::error::Result;
use crate::store::Store;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Praxis {
    pub name: String,
    pub strasse: String,
    pub plz: String,
    pub ort: String,
    pub telefon: String,
    pub email: String,
    /// Ort für die Datumszeile im Bericht, meist derselbe wie oben.
    pub brief_ort: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Behandler {
    pub name: String,
    pub titel: String,
    /// Steht im Briefkopf und unter der Unterschrift.
    pub funktion: String,
}

/// Diese vier Angaben sind keine Kosmetik. Sie entscheiden, welche
/// Stilregeln und welche Gliederung in den Prompt gehen, und ob im
/// Bericht ein Konsiliarbericht erwähnt werden muss.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Verfahren {
    /// "tp" · "vt" · "at" · "st"
    pub art: String,
    /// "einzel" · "gruppe" · "kombination"
    pub setting: String,
    /// "erwachsene" · "kj"
    pub zielgruppe: String,
    /// "aerztlich" · "psychologisch" · "kjp"
    pub qualifikation: String,
}

impl Default for Verfahren {
    fn default() -> Self {
        Verfahren {
            art: "tp".into(),
            setting: "einzel".into(),
            zielgruppe: "erwachsene".into(),
            qualifikation: "aerztlich".into(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Layout {
    /// "fortfuehrung" · "erstantrag" (Erstantrag folgt im nächsten Bau)
    pub berichtsart: String,
    pub untertitel: String,
    /// Zielkorridor in Zeichen. Gemessen, nicht geschätzt: bis 5.362
    /// Zeichen sind es zwei Seiten, ab 5.659 drei.
    pub ziel_min: u32,
    pub ziel_soll: u32,
    pub ziel_max: u32,
    /// Akzentfarbe des Briefkopfs als Hexwert.
    pub akzent: String,
    pub schrift_text: String,
    pub schrift_kopf: String,
}

impl Default for Layout {
    fn default() -> Self {
        Layout {
            berichtsart: "fortfuehrung".into(),
            untertitel: String::new(),
            ziel_min: 4_800,
            ziel_soll: 4_950,
            ziel_max: 5_100,
            akzent: "#3A5F9E".into(),
            schrift_text: "Cambria".into(),
            schrift_kopf: "Calibri".into(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Api {
    pub model: String,
    /// Ob die Nutzerin bestätigt hat, in der Anthropic-Console eine
    /// Ausgabengrenze gesetzt zu haben. Der Assistent besteht darauf,
    /// weil das die einzige Grenze ist, die auch bei verlorenem
    /// Schlüssel noch greift.
    pub console_limit_bestaetigt: bool,
}

impl Default for Api {
    fn default() -> Self {
        Api { model: "claude-opus-5".into(), console_limit_bestaetigt: false }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Profile {
    pub praxis: Praxis,
    pub behandler: Behandler,
    pub verfahren: Verfahren,
    pub layout: Layout,
    pub api: Api,
    pub budget: BudgetSettings,
    /// Erst wenn dies gesetzt ist, startet Rana in die Arbeitsansicht.
    pub eingerichtet: bool,
}

const KEY: &str = "profile";

pub fn load(store: &Store) -> Result<Profile> {
    match store.get_setting(KEY)? {
        Some(json) => Ok(serde_json::from_str(&json).unwrap_or_default()),
        None => Ok(Profile::default()),
    }
}

pub fn save(store: &Store, profile: &Profile) -> Result<()> {
    store.set_setting(KEY, &serde_json::to_string(profile)?)
}

// ---------------------------------------------------------------
// Klartext für Bericht und Prompt
// ---------------------------------------------------------------

impl Verfahren {
    pub fn bezeichnung(&self) -> &'static str {
        match self.art.as_str() {
            "vt" => "Verhaltenstherapie",
            "at" => "Analytische Psychotherapie",
            "st" => "Systemische Therapie",
            _ => "Tiefenpsychologisch fundierte Psychotherapie",
        }
    }

    pub fn kuerzel(&self) -> &'static str {
        match self.art.as_str() {
            "vt" => "VT",
            "at" => "AP",
            "st" => "ST",
            _ => "TP",
        }
    }

    pub fn setting_text(&self) -> &'static str {
        match self.setting.as_str() {
            "gruppe" => "Gruppentherapie",
            "kombination" => "Kombinationsbehandlung aus Einzel- und Gruppentherapie",
            _ => "Einzeltherapie",
        }
    }

    /// Ärztinnen haben den somatischen Befund im Bericht und brauchen
    /// deshalb keinen Konsiliarbericht. Psychologische Psychotherapeut:innen
    /// müssen ihn beilegen.
    pub fn braucht_konsiliarbericht(&self) -> bool {
        self.qualifikation != "aerztlich"
    }
}
