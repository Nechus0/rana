//! Sicherung und Wiederherstellung mit Patientinnen.
use pruef::{backup, patients, store::{Case, Store}};
use serde_json::json;

fn store(wo: &str) -> Store {
    let dir = std::env::temp_dir().join(format!("rana-sich-{wo}"));
    let _ = std::fs::remove_dir_all(&dir);
    Store::open(&dir).unwrap()
}

fn fall(name: &str, nr: &str) -> Case {
    let mut fields = serde_json::Map::new();
    fields.insert("f_name".into(), json!(name));
    fields.insert("f_nr".into(), json!(nr));
    fields.insert("f_ausgangslage".into(), json!("Erschoepfung"));
    Case {
        id: uuid::Uuid::new_v4().to_string(),
        fields, report: String::new(), patient_id: None,
        updated_at: 0, created_at: 0, deleted_at: None,
    }
}

#[test]
fn patientinnen_ueberleben_die_sicherung() {
    let a = store("a");
    patients::bericht_speichern(&a, fall("Katrin Pauer", "1")).unwrap();
    patients::bericht_speichern(&a, fall("Pauer, Katrin", "2")).unwrap();
    assert_eq!(patients::list_patients(&a).unwrap().len(), 1);

    let datei = std::env::temp_dir().join("rana-sicherung.rana");
    backup::write_backup(&a, &datei, "geheimwort").unwrap();

    // Auf einem leeren Speicher wiederherstellen.
    let b = store("b");
    assert_eq!(patients::list_patients(&b).unwrap().len(), 0);
    backup::read_backup(&b, &datei, "geheimwort", true).unwrap();

    let p = patients::list_patients(&b).unwrap();
    assert_eq!(p.len(), 1, "die Patientin ist mitgewandert");
    assert_eq!(p[0].report_count, 2, "beide Berichte haengen wieder an ihr");
    assert_eq!(patients::reports_without_patient(&b).unwrap().len(), 0);

    // Und die Stammdaten sind ueber den Bericht wieder lesbar.
    let berichte = patients::reports_for_patient(&b, &p[0].id).unwrap();
    let gelesen = patients::bericht_lesen(&b, &berichte[0].id).unwrap();
    assert_eq!(gelesen.fields["f_ausgangslage"], json!("Erschoepfung"));
}

#[test]
fn alte_sicherung_ohne_patientinnen_laesst_sich_lesen() {
    // Eine Sicherung aus 1.2 kennt das Feld `patients` nicht. Sie muss
    // sich trotzdem einlesen lassen; die Berichte stehen danach ohne
    // Patientin da und koennen zugeordnet werden.
    let a = store("c");
    a.save_case(fall("Tanja Pape", "1")).unwrap();

    let datei = std::env::temp_dir().join("rana-alt.rana");
    backup::write_backup(&a, &datei, "geheimwort").unwrap();

    let b = store("d");
    let n = backup::read_backup(&b, &datei, "geheimwort", true).unwrap();
    assert_eq!(n, 1);
    assert_eq!(patients::reports_without_patient(&b).unwrap().len(), 1);
    assert_eq!(patients::merge_noetig(&b).unwrap(), 1);
}
