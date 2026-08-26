//! Die Patientin und ihre Berichte.
//!
//! Bis Fassung 1.1 war ein „Fall" gleich einem Bericht. Wer für
//! dieselbe Person einen zweiten Fortführungsantrag schrieb, legte
//! einen zweiten Fall an — mit demselben Namen, denselben Stammdaten,
//! derselben Ausgangslage. Alles doppelt gepflegt, und in der Liste
//! standen zwei Einträge, die dieselbe Person meinten.
//!
//! Seit Fassung 2.0 gilt: **eine Patientin, mehrere Berichte.** Was
//! über alle Berichte gleich bleibt, steht bei der Patientin; was sich
//! je Antrag ändert, beim Bericht.
//!
//! Die Aufteilung ist nicht willkürlich. Sie folgt der Frage: ändert
//! sich das zwischen zwei Fortführungsanträgen? Der Therapiebeginn
//! nicht. Die Ausgangslage bei Therapiebeginn nicht. Die Zahl der
//! verbrauchten Stunden sehr wohl.

use crate::error::Result;
use crate::store::{now_ms, Store};
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------
// Welches Feld gehört wohin
// ---------------------------------------------------------------

/// Felder, die bei der Patientin liegen und für jeden Bericht gelten.
///
/// Wer hier etwas ergänzt, muss bedenken: der Wert wird beim Öffnen
/// eines Berichts über dessen eigene Felder gelegt. Was hier steht,
/// gewinnt.
pub const PATIENT_FELDER: &[&str] = &[
    "f_name",       // Klarname — verlässt das Gerät nie
    "f_chiffre",
    "f_gebdatum",
    "f_geschlecht",
    "f_sozio",
    "f_kasse",
    "f_beginn",         // Therapiebeginn
    "f_therapiebeginn", // Schreibweise aus Fassung 1.1, wird mitgeführt
    "f_ausgangslage",   // beschreibt den Therapiebeginn, nicht den Antrag
    "f_psychodyn",      // die tragende Dynamik ändert sich nicht je Antrag
];

pub fn ist_patientenfeld(name: &str) -> bool {
    PATIENT_FELDER.contains(&name)
}

// ---------------------------------------------------------------
// Datensätze
// ---------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Patient {
    pub id: String,
    /// Die gemeinsamen Felder, gleiche Form wie beim Bericht.
    #[serde(default)]
    pub fields: serde_json::Map<String, serde_json::Value>,
    #[serde(default)]
    pub created_at: i64,
    #[serde(default)]
    pub updated_at: i64,
    #[serde(default)]
    pub deleted_at: Option<i64>,
}

#[derive(Serialize, Clone, Debug)]
pub struct PatientSummary {
    pub id: String,
    pub label: String,
    pub chiffre: String,
    pub created_at: i64,
    pub updated_at: i64,
    /// Wie viele Berichte an dieser Patientin hängen.
    pub report_count: usize,
    /// Höchste vergebene laufende Nummer — die nächste ist eins mehr.
    pub hoechste_nr: u32,
}

// ---------------------------------------------------------------
// Namen vergleichbar machen
// ---------------------------------------------------------------

/// Bringt einen Namen auf eine Form, in der sich zwei Schreibweisen
/// derselben Person gleichen.
///
/// Was zusammenfallen soll:
///   „Pauer, Katrin"  ·  „Katrin Pauer"  ·  „katrin  pauer "
///   „Müller-Mühlenhardt, Simone"  ·  „Simone Müller-Mühlenhardt"
///
/// Was getrennt bleiben muss:
///   „Katrin Pauer"  ·  „Katrin Bauer"
///
/// Vorgehen: Titel und Anreden weg, Umlaute auflösen, alles klein,
/// Satzzeichen weg, Bestandteile sortieren. Die Sortierung ist der
/// Kniff — sie macht die Reihenfolge von Vor- und Nachname
/// gleichgültig, ohne raten zu müssen, welches was ist.
pub fn namensschluessel(name: &str) -> String {
    const WEG: &[&str] = &[
        "herr", "frau", "hr", "fr", "dr", "prof", "med", "dipl", "psych",
    ];

    let entfaltet: String = name
        .chars()
        .flat_map(|c| match c.to_ascii_lowercase() {
            'ä' => "ae".chars().collect::<Vec<_>>(),
            'ö' => "oe".chars().collect(),
            'ü' => "ue".chars().collect(),
            'ß' => "ss".chars().collect(),
            _ => c.to_lowercase().collect(),
        })
        .collect();

    let mut teile: Vec<String> = entfaltet
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| !t.is_empty())
        .filter(|t| !WEG.contains(t))
        // Einzelbuchstaben sind Initialen und taugen nicht zum Vergleich.
        .filter(|t| t.chars().count() > 1)
        .map(|t| t.to_string())
        .collect();

    teile.sort();
    teile.join(" ")
}

// ---------------------------------------------------------------
// Der Zusammenführungs-Vorschlag
// ---------------------------------------------------------------

/// Eine Gruppe von Berichten, die vermutlich zur selben Person gehören.
#[derive(Serialize, Clone, Debug)]
pub struct MergeGruppe {
    /// Vorschlag für den anzuzeigenden Namen: die häufigste Schreibweise.
    pub name: String,
    /// Alle vorgefundenen Schreibweisen, damit die Nutzerin sieht,
    /// was hier zusammengelegt werden soll.
    pub schreibweisen: Vec<String>,
    /// Kennungen der betroffenen Berichte, älteste zuerst.
    pub report_ids: Vec<String>,
    /// Wie viele Berichte. Bei 1 gibt es nichts zusammenzuführen.
    pub anzahl: usize,
}

/// Schlägt vor, welche vorhandenen Berichte zur selben Patientin
/// gehören. Ändert nichts — das entscheidet die Nutzerin.
pub fn merge_vorschlag(store: &Store) -> Result<Vec<MergeGruppe>> {
    use std::collections::HashMap;

    let mut nach_schluessel: HashMap<String, Vec<(String, String, i64)>> = HashMap::new();

    for c in store.export_all()? {
        if c.deleted_at.is_some() {
            continue;
        }
        let name = c
            .fields
            .get("f_name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();

        // Ohne Namen lässt sich nichts zuordnen — solche Berichte
        // bekommen jeweils eine eigene Patientin.
        let schluessel = if name.is_empty() {
            format!("__ohne__{}", c.id)
        } else {
            namensschluessel(&name)
        };

        nach_schluessel
            .entry(schluessel)
            .or_default()
            .push((c.id.clone(), name, c.created_at));
    }

    let mut gruppen: Vec<MergeGruppe> = nach_schluessel
        .into_values()
        .map(|mut eintraege| {
            eintraege.sort_by_key(|(_, _, angelegt)| *angelegt);

            let mut schreibweisen: Vec<String> = eintraege
                .iter()
                .map(|(_, n, _)| n.clone())
                .filter(|n| !n.is_empty())
                .collect();
            schreibweisen.sort();
            schreibweisen.dedup();

            // Als Anzeigename die längste Schreibweise — sie enthält
            // meist beide Namensteile, während kurze abgekürzt sind.
            let name = schreibweisen
                .iter()
                .max_by_key(|s| s.chars().count())
                .cloned()
                .unwrap_or_else(|| "Ohne Namen".to_string());

            MergeGruppe {
                name,
                schreibweisen,
                anzahl: eintraege.len(),
                report_ids: eintraege.into_iter().map(|(id, _, _)| id).collect(),
            }
        })
        .collect();

    // Erst die Gruppen mit echtem Zusammenführungsbedarf, dann der Rest.
    gruppen.sort_by(|a, b| b.anzahl.cmp(&a.anzahl).then(a.name.cmp(&b.name)));
    Ok(gruppen)
}

// ---------------------------------------------------------------
// Prüfstand
// ---------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::namensschluessel as k;

    #[test]
    fn gedrehte_schreibweise_faellt_zusammen() {
        assert_eq!(k("Pauer, Katrin"), k("Katrin Pauer"));
        assert_eq!(k("Müller-Mühlenhardt, Simone"), k("Simone Müller-Mühlenhardt"));
        assert_eq!(k("Pape, Tanja"), k("Tanja Pape"));
    }

    #[test]
    fn schreibweise_und_leerraum_egal() {
        assert_eq!(k("  katrin   PAUER "), k("Katrin Pauer"));
        assert_eq!(k("Gisela Fronek"), k("FRONEK, gisela"));
    }

    #[test]
    fn umlaute_werden_aufgeloest() {
        assert_eq!(k("Müller"), k("Mueller"));
        assert_eq!(k("Weiß"), k("Weiss"));
        assert_eq!(k("Jörg Käse"), k("Joerg Kaese"));
    }

    #[test]
    fn anreden_und_titel_stoeren_nicht() {
        assert_eq!(k("Frau Katrin Pauer"), k("Katrin Pauer"));
        assert_eq!(k("Dr. med. Katrin Pauer"), k("Pauer, Katrin"));
    }

    #[test]
    fn verschiedene_personen_bleiben_getrennt() {
        assert_ne!(k("Katrin Pauer"), k("Katrin Bauer"));
        assert_ne!(k("Simone Müller"), k("Simone Müller-Mühlenhardt"));
        assert_ne!(k("Anna Berg"), k("Anna Bergmann"));
    }

    #[test]
    fn initialen_zaehlen_nicht_als_namensteil() {
        // „Katrin M. Pauer" und „Katrin Pauer" sind dieselbe Person.
        assert_eq!(k("Katrin M. Pauer"), k("Katrin Pauer"));
    }

    #[test]
    fn leerer_name_ergibt_leeren_schluessel() {
        assert_eq!(k(""), "");
        assert_eq!(k("   "), "");
    }
}

// ---------------------------------------------------------------
// Speicher
// ---------------------------------------------------------------

impl Store {
    pub fn save_patient(&self, mut p: Patient) -> Result<Patient> {
        let now = now_ms();
        if p.created_at == 0 {
            p.created_at = now;
        }
        p.updated_at = now;
        self.patient_schreiben(&p)?;
        Ok(p)
    }

    /// Legt die Patientenfelder über die Berichtsfelder. Die Patientin
    /// gewinnt — sie ist die eine Quelle für alles Gemeinsame.
    pub fn felder_vereinen(
        patient: &serde_json::Map<String, serde_json::Value>,
        bericht: &serde_json::Map<String, serde_json::Value>,
    ) -> serde_json::Map<String, serde_json::Value> {
        let mut out = bericht.clone();
        for feld in PATIENT_FELDER {
            if let Some(v) = patient.get(*feld) {
                out.insert((*feld).to_string(), v.clone());
            }
        }
        out
    }

    /// Trennt einen gemischten Feldsatz wieder auf.
    pub fn felder_trennen(
        alle: &serde_json::Map<String, serde_json::Value>,
    ) -> (
        serde_json::Map<String, serde_json::Value>,
        serde_json::Map<String, serde_json::Value>,
    ) {
        let mut patient = serde_json::Map::new();
        let mut bericht = serde_json::Map::new();
        for (k, v) in alle {
            if ist_patientenfeld(k) {
                patient.insert(k.clone(), v.clone());
            } else {
                bericht.insert(k.clone(), v.clone());
            }
        }
        (patient, bericht)
    }
}
