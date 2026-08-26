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
use crate::store::{now_ms, Case, CaseSummary, Store};
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
///
/// Geht als Vorschlag hinaus und kommt — von der Nutzerin bestätigt,
/// womöglich mit geändertem Namen oder ohne einzelne Berichte —
/// wieder herein. Deshalb in beide Richtungen serialisierbar.
#[derive(Serialize, Deserialize, Clone, Debug)]
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

// ---------------------------------------------------------------
// Zuordnen — und damit Doppelanlagen verhindern
// ---------------------------------------------------------------

/// Sucht eine vorhandene Patientin zu einem Namen.
///
/// Hier entscheidet sich, ob „Pape, Tanja" und „Tanja Pape" als eine
/// Person gelten. Die Prüfung läuft bei jedem Speichern — deshalb
/// entsteht ein zweiter Eintrag zur selben Person gar nicht erst,
/// statt ihn später mühsam zusammenführen zu müssen.
pub fn finde_patient(store: &Store, name: &str) -> Result<Option<Patient>> {
    let gesucht = namensschluessel(name);
    if gesucht.is_empty() {
        return Ok(None);
    }
    for p in store.alle_patienten()? {
        let vorhanden = p
            .fields
            .get("f_name")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if namensschluessel(vorhanden) == gesucht {
            return Ok(Some(p));
        }
    }
    Ok(None)
}

/// Legt eine Patientin an oder gibt die vorhandene zurück.
pub fn patient_sichern(
    store: &Store,
    felder: &serde_json::Map<String, serde_json::Value>,
) -> Result<Option<Patient>> {
    let name = felder
        .get("f_name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    // Ohne Namen keine Patientin. Der Bericht bleibt dann einfach
    // zuordnungslos — das ist ein gültiger Zwischenzustand, solange
    // die Nutzerin den Namen noch nicht eingetragen hat.
    if namensschluessel(&name).is_empty() {
        return Ok(None);
    }

    let mut p = match finde_patient(store, &name)? {
        Some(p) => p,
        None => Patient {
            id: uuid::Uuid::new_v4().to_string(),
            created_at: now_ms(),
            ..Default::default()
        },
    };

    // Nur die gemeinsamen Felder wandern zur Patientin, und leere
    // Werte überschreiben keine gefüllten: wer im zweiten Bericht die
    // Ausgangslage nicht noch einmal einträgt, soll sie nicht verlieren.
    for feld in PATIENT_FELDER {
        if let Some(v) = felder.get(*feld) {
            let leer = v.as_str().map(|s| s.trim().is_empty()).unwrap_or(false);
            if !leer {
                p.fields.insert((*feld).to_string(), v.clone());
            }
        }
    }

    Ok(Some(store.save_patient(p)?))
}

/// Speichert einen Bericht und hält die Patientin dabei nach.
///
/// Der Bericht behält **alle** Felder, auch die gemeinsamen. Das ist
/// Absicht: jeder Bericht bleibt für sich lesbar, auch wenn die
/// Patientin später entfernt oder umbenannt wird. Die Patientin ist
/// die maßgebliche Quelle, nicht die einzige.
pub fn bericht_speichern(store: &Store, mut case: Case) -> Result<Case> {
    if let Some(p) = patient_sichern(store, &case.fields)? {
        case.patient_id = Some(p.id);
    }
    store.save_case(case)
}

/// Liest einen Bericht und legt die Patientendaten darüber.
pub fn bericht_lesen(store: &Store, id: &str) -> Result<Case> {
    let mut case = store.get_case(id)?;
    if let Some(pid) = case.patient_id.clone() {
        if let Ok(p) = store.patient_lesen(&pid) {
            case.fields = Store::felder_vereinen(&p.fields, &case.fields);
        }
    }
    Ok(case)
}

/// Hängt einen Bericht ausdrücklich an eine Patientin.
pub fn bericht_zuordnen(store: &Store, case_id: &str, patient_id: &str) -> Result<()> {
    let p = store.patient_lesen(patient_id)?;
    let mut c = store.get_case(case_id)?;
    c.patient_id = Some(p.id.clone());
    c.fields = Store::felder_vereinen(&p.fields, &c.fields);
    store.save_case(c)?;
    Ok(())
}

// ---------------------------------------------------------------
// Listen für die Oberfläche
// ---------------------------------------------------------------

/// Alle Patientinnen mit Anzahl der Berichte und höchster laufender
/// Nummer. Letztere trägt die Oberfläche beim Folgeantrag vor.
pub fn list_patients(store: &Store) -> Result<Vec<PatientSummary>> {
    use std::collections::HashMap;

    let mut anzahl: HashMap<String, usize> = HashMap::new();
    let mut hoechste: HashMap<String, u32> = HashMap::new();

    for c in store.export_all()? {
        if c.deleted_at.is_some() {
            continue;
        }
        let Some(pid) = c.patient_id.clone() else { continue };
        *anzahl.entry(pid.clone()).or_insert(0) += 1;

        let nr = c
            .fields
            .get("f_nr")
            .and_then(|v| v.as_str())
            .and_then(|s| s.trim().parse::<u32>().ok())
            .unwrap_or(0);
        let e = hoechste.entry(pid).or_insert(0);
        if nr > *e {
            *e = nr;
        }
    }

    let mut out: Vec<PatientSummary> = store
        .alle_patienten()?
        .into_iter()
        .map(|p| {
            let name = p
                .fields
                .get("f_name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            let chiffre = p
                .fields
                .get("f_chiffre")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            PatientSummary {
                label: if !name.is_empty() {
                    name
                } else if !chiffre.is_empty() {
                    chiffre.clone()
                } else {
                    "Ohne Namen".to_string()
                },
                chiffre,
                report_count: *anzahl.get(&p.id).unwrap_or(&0),
                hoechste_nr: *hoechste.get(&p.id).unwrap_or(&0),
                created_at: p.created_at,
                updated_at: p.updated_at,
                id: p.id,
            }
        })
        .collect();

    out.sort_by(|a, b| a.label.to_lowercase().cmp(&b.label.to_lowercase()));
    Ok(out)
}

/// Die Berichte einer Patientin, jüngster Antrag zuerst.
pub fn reports_for_patient(store: &Store, patient_id: &str) -> Result<Vec<CaseSummary>> {
    let mut liste: Vec<CaseSummary> = store
        .list_cases("", false)?
        .into_iter()
        .filter(|c| c.patient_id.as_deref() == Some(patient_id))
        .collect();
    liste.sort_by(|a, b| {
        let na = a.antrag_nr.trim().parse::<u32>().unwrap_or(0);
        let nb = b.antrag_nr.trim().parse::<u32>().unwrap_or(0);
        nb.cmp(&na).then(b.created_at.cmp(&a.created_at))
    });
    Ok(liste)
}

/// Berichte, die noch an keiner Patientin hängen. Nach der Umstellung
/// sind das die Altbestände; im laufenden Betrieb solche ohne Namen.
pub fn reports_without_patient(store: &Store) -> Result<Vec<CaseSummary>> {
    Ok(store
        .list_cases("", false)?
        .into_iter()
        .filter(|c| c.patient_id.is_none())
        .collect())
}

// ---------------------------------------------------------------
// Zusammenführen — erst nach Bestätigung
// ---------------------------------------------------------------

/// Führt die bestätigten Gruppen zusammen.
///
/// Aufgerufen wird das ausschliesslich mit Gruppen, die die Nutzerin
/// im Dialog stehen gelassen hat. `merge_vorschlag` allein ändert
/// nichts.
///
/// Bei den gemeinsamen Feldern gewinnt der **jüngste** Bericht, der
/// zu dem Feld überhaupt etwas sagt. Begründung: die Ausgangslage
/// wird über die Jahre eher präzisiert als verschlechtert, und ein
/// leeres Feld im letzten Antrag heisst „unverändert", nicht „gelöscht".
///
/// Die Berichte behalten ihre eigenen Feldinhalte. Wer einen alten
/// Bericht öffnet, sieht danach zwar die Stammdaten der Patientin
/// darübergelegt, verliert aber nichts.
pub fn merge_anwenden(store: &Store, gruppen: &[MergeGruppe]) -> Result<usize> {
    let mut zugeordnet = 0usize;

    for g in gruppen {
        if g.report_ids.is_empty() {
            continue;
        }

        // Älteste zuerst einsammeln, damit spätere Werte gewinnen.
        let mut berichte: Vec<Case> = Vec::new();
        for id in &g.report_ids {
            if let Ok(c) = store.get_case(id) {
                berichte.push(c);
            }
        }
        if berichte.is_empty() {
            continue;
        }
        berichte.sort_by_key(|c| c.created_at);

        // An eine schon bestehende Patientin anknüpfen, falls einer
        // der Berichte bereits zugeordnet ist — sonst entstünde beim
        // zweiten Durchlauf eine zweite Patientin zur selben Person.
        let vorhandene = berichte
            .iter()
            .find_map(|c| c.patient_id.clone())
            .and_then(|pid| store.patient_lesen(&pid).ok())
            .or(finde_patient(store, &g.name)?);

        let mut p = vorhandene.unwrap_or_else(|| Patient {
            id: uuid::Uuid::new_v4().to_string(),
            created_at: berichte[0].created_at,
            ..Default::default()
        });

        for c in &berichte {
            for feld in PATIENT_FELDER {
                if let Some(v) = c.fields.get(*feld) {
                    let leer = v.as_str().map(|s| s.trim().is_empty()).unwrap_or(false);
                    if !leer {
                        p.fields.insert((*feld).to_string(), v.clone());
                    }
                }
            }
        }

        // Der Anzeigename ist die Wahl der Nutzerin, nicht die des
        // jüngsten Berichts.
        if !g.name.trim().is_empty() && g.name != "Ohne Namen" {
            p.fields.insert(
                "f_name".to_string(),
                serde_json::Value::String(g.name.trim().to_string()),
            );
        }

        let p = store.save_patient(p)?;

        for mut c in berichte {
            if c.patient_id.as_deref() == Some(p.id.as_str()) {
                continue;
            }
            c.patient_id = Some(p.id.clone());
            store.save_case(c)?;
            zugeordnet += 1;
        }
    }

    Ok(zugeordnet)
}

/// Wie viele Berichte noch ohne Patientin dastehen. Die Oberfläche
/// bietet den Zusammenführungs-Dialog nur an, wenn das mehr als null ist.
pub fn merge_noetig(store: &Store) -> Result<usize> {
    Ok(reports_without_patient(store)?.len())
}

// ---------------------------------------------------------------
// Prüfstand für das Datenmodell
// ---------------------------------------------------------------
//
// Diese Prüfungen laufen gegen eine echte SQLite-Datei mit echter
// Verschlüsselung — nur der Schlüssel kommt aus `open_fuer_test`
// statt aus dem Windows-Tresor. Sie sichern genau die Zusage ab, um
// derentwillen Fassung 2.0 gebaut wurde: eine Person, ein Eintrag,
// und beim Umstellen geht kein Bericht verloren.

#[cfg(test)]
mod datenmodell {
    use super::*;
    use serde_json::json;

    fn store(wo: &str) -> Store {
        let dir = std::env::temp_dir().join(format!("rana-test-{wo}"));
        let _ = std::fs::remove_dir_all(&dir);
        Store::open_fuer_test(&dir).unwrap()
    }

    fn fall(name: &str, nr: &str, extra: Vec<(&str, &str)>) -> Case {
        let mut fields = serde_json::Map::new();
        fields.insert("f_name".into(), json!(name));
        fields.insert("f_nr".into(), json!(nr));
        for (k, v) in extra {
            fields.insert(k.into(), json!(v));
        }
        Case {
            id: uuid::Uuid::new_v4().to_string(),
            fields,
            report: String::new(),
            patient_id: None,
            updated_at: 0,
            created_at: 0,
            deleted_at: None,
        }
    }

    /// Ein Bestand, wie er aus Fassung 1.1 kommt: lauter Berichte ohne
    /// Patientin, mit gedrehten Schreibweisen.
    fn altbestand(wo: &str) -> Store {
        let s = store(wo);
        for (name, nr) in [
            ("Pauer, Katrin", "1"),
            ("Katrin Pauer", "2"),
            ("Pape, Tanja", "1"),
            ("Tanja Pape", "2"),
            ("Simone Berg", "1"),
            ("Simone Bergmann", "1"),
        ] {
            s.save_case(fall(name, nr, vec![])).unwrap();
        }
        s
    }

    // -- Doppelanlage kann gar nicht erst entstehen ---------------

    #[test]
    fn gleicher_name_andere_schreibweise_ergibt_eine_patientin() {
        let s = store("dup");
        bericht_speichern(&s, fall("Pauer, Katrin", "1", vec![])).unwrap();
        bericht_speichern(&s, fall("Katrin Pauer", "2", vec![])).unwrap();

        let p = list_patients(&s).unwrap();
        assert_eq!(p.len(), 1, "zwei Schreibweisen, eine Patientin");
        assert_eq!(p[0].report_count, 2);
        assert_eq!(p[0].hoechste_nr, 2, "die nächste Nummer wäre 3");
    }

    #[test]
    fn zwei_personen_bleiben_zwei_eintraege() {
        let s = store("getrennt");
        bericht_speichern(&s, fall("Katrin Pauer", "1", vec![])).unwrap();
        bericht_speichern(&s, fall("Katrin Bauer", "1", vec![])).unwrap();
        assert_eq!(list_patients(&s).unwrap().len(), 2);
    }

    #[test]
    fn bericht_ohne_namen_bleibt_zuordnungslos() {
        let s = store("ohnename");
        bericht_speichern(&s, fall("", "1", vec![])).unwrap();
        assert_eq!(list_patients(&s).unwrap().len(), 0);
        assert_eq!(reports_without_patient(&s).unwrap().len(), 1);
    }

    // -- Stammdaten leben bei der Patientin -----------------------

    #[test]
    fn leeres_feld_ueberschreibt_kein_gefuelltes() {
        let s = store("leer");
        bericht_speichern(
            &s,
            fall("Tanja Pape", "1", vec![("f_ausgangslage", "Erschöpfung")]),
        )
        .unwrap();
        let zweiter =
            bericht_speichern(&s, fall("Pape, Tanja", "2", vec![("f_ausgangslage", "")])).unwrap();

        let gelesen = bericht_lesen(&s, &zweiter.id).unwrap();
        assert_eq!(
            gelesen.fields["f_ausgangslage"],
            json!("Erschöpfung"),
            "die Ausgangslage kommt von der Patientin"
        );
    }

    #[test]
    fn geaenderte_stammdaten_wirken_auf_alte_berichte() {
        let s = store("stamm");
        let erster = bericht_speichern(&s, fall("Simone Berg", "1", vec![("f_kasse", "AOK")])).unwrap();
        bericht_speichern(&s, fall("Simone Berg", "2", vec![("f_kasse", "TK")])).unwrap();

        assert_eq!(bericht_lesen(&s, &erster.id).unwrap().fields["f_kasse"], json!("TK"));
    }

    #[test]
    fn berichtseigene_felder_bleiben_je_bericht_verschieden() {
        let s = store("eigen");
        let a = bericht_speichern(&s, fall("Lena Frisch", "1", vec![("f_verlauf", "erstes Jahr")])).unwrap();
        let b = bericht_speichern(&s, fall("Lena Frisch", "2", vec![("f_verlauf", "zweites Jahr")])).unwrap();

        assert_eq!(bericht_lesen(&s, &a.id).unwrap().fields["f_verlauf"], json!("erstes Jahr"));
        assert_eq!(bericht_lesen(&s, &b.id).unwrap().fields["f_verlauf"], json!("zweites Jahr"));
    }

    // -- Der Altbestand ------------------------------------------

    #[test]
    fn vorschlag_gruppiert_richtig_und_aendert_nichts() {
        let s = altbestand("alt1");
        let v = merge_vorschlag(&s).unwrap();

        assert_eq!(v.len(), 4, "vier Personen aus sechs Berichten");
        assert_eq!(v[0].anzahl, 2);
        assert_eq!(v[1].anzahl, 2);
        assert!(
            v.iter().any(|g| g.name == "Simone Bergmann") && v.iter().any(|g| g.name == "Simone Berg"),
            "Berg und Bergmann bleiben getrennt"
        );
        assert_eq!(list_patients(&s).unwrap().len(), 0, "der Vorschlag allein legt nichts an");
    }

    #[test]
    fn zusammenfuehren_ordnet_alle_berichte_zu() {
        let s = altbestand("alt2");
        let v = merge_vorschlag(&s).unwrap();
        assert_eq!(merge_anwenden(&s, &v).unwrap(), 6);

        assert_eq!(list_patients(&s).unwrap().len(), 4);
        assert_eq!(reports_without_patient(&s).unwrap().len(), 0);
        assert_eq!(s.export_all().unwrap().len(), 6, "kein Bericht geht verloren");
    }

    #[test]
    fn zweimal_zusammenfuehren_legt_keine_zweite_patientin_an() {
        let s = altbestand("alt3");
        let v = merge_vorschlag(&s).unwrap();
        merge_anwenden(&s, &v).unwrap();

        let v2 = merge_vorschlag(&s).unwrap();
        assert_eq!(merge_anwenden(&s, &v2).unwrap(), 0, "beim zweiten Lauf bleibt nichts zu tun");
        assert_eq!(list_patients(&s).unwrap().len(), 4);
    }

    #[test]
    fn nur_bestaetigte_gruppen_werden_zusammengefuehrt() {
        let s = altbestand("alt4");
        let v = merge_vorschlag(&s).unwrap();
        assert_eq!(merge_anwenden(&s, &v[0..1]).unwrap(), 2);

        assert_eq!(list_patients(&s).unwrap().len(), 1);
        assert_eq!(reports_without_patient(&s).unwrap().len(), 4);
    }

    #[test]
    fn abgewaehlter_bericht_bleibt_draussen() {
        let s = altbestand("alt5");
        let mut v = merge_vorschlag(&s).unwrap();
        let entfernt = v[0].report_ids.pop().unwrap();
        v[0].anzahl = v[0].report_ids.len();

        merge_anwenden(&s, &v[0..1]).unwrap();
        assert!(reports_without_patient(&s).unwrap().iter().any(|c| c.id == entfernt));
    }

    #[test]
    fn juengster_bericht_gewinnt_bei_den_stammdaten() {
        let s = store("juengst");
        let mut alt = fall("Nora Kling", "1", vec![("f_kasse", "AOK")]);
        alt.created_at = 1_000;
        let mut neu = fall("Kling, Nora", "2", vec![("f_kasse", "Barmer")]);
        neu.created_at = 2_000;
        s.save_case(alt).unwrap();
        s.save_case(neu).unwrap();

        let v = merge_vorschlag(&s).unwrap();
        merge_anwenden(&s, &v).unwrap();

        let p = list_patients(&s).unwrap();
        assert_eq!(s.patient_lesen(&p[0].id).unwrap().fields["f_kasse"], json!("Barmer"));
    }

    #[test]
    fn patientin_entfernen_laesst_die_berichte_stehen() {
        let s = store("entfernen");
        bericht_speichern(&s, fall("Ruth Salz", "1", vec![])).unwrap();
        bericht_speichern(&s, fall("Ruth Salz", "2", vec![])).unwrap();

        let p = list_patients(&s).unwrap();
        s.patient_entfernen(&p[0].id).unwrap();

        assert_eq!(list_patients(&s).unwrap().len(), 0);
        assert_eq!(s.export_all().unwrap().len(), 2, "die Berichte bleiben");
        assert_eq!(reports_without_patient(&s).unwrap().len(), 2);
    }

    #[test]
    fn berichte_kommen_neuester_antrag_zuerst() {
        let s = store("reihen");
        bericht_speichern(&s, fall("Ida Wolf", "1", vec![])).unwrap();
        bericht_speichern(&s, fall("Ida Wolf", "3", vec![])).unwrap();
        bericht_speichern(&s, fall("Ida Wolf", "2", vec![])).unwrap();

        let p = list_patients(&s).unwrap();
        let r = reports_for_patient(&s, &p[0].id).unwrap();
        let nrn: Vec<&str> = r.iter().map(|c| c.antrag_nr.as_str()).collect();
        assert_eq!(nrn, vec!["3", "2", "1"]);
    }
}
