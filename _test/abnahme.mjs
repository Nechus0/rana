// Abnahmekriterien aus Rana-Aenderungen-PTV3-Leitfaden-Prompt.md
import { writeFileSync } from "node:fs";
globalThis.window = { matchMedia: () => ({ matches: false }) };
const M = await import("./bundle.mjs");

let fehler = 0;
const pruef = (name, ok, detail = "") => {
  console.log(`${ok ? "  OK  " : "  FEHL"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) fehler++;
};

const profil = {
  praxis: { name: "", strasse: "Musterweg 3", plz: "26382", ort: "Wilhelmshaven",
            telefon: "04421 773288", email: "praxis@example.de", brief_ort: "Wilhelmshaven" },
  behandler: { name: "Anja Roesick-Schulte", titel: "Dr. med.", funktion: "Ärztin – Psychotherapie" },
  verfahren: { art: "tp", setting: "einzel", zielgruppe: "erwachsene", qualifikation: "aerztlich" },
  layout: { berichtsart: "fortfuehrung", untertitel: "zum Fortführungsantrag",
            ziel_min: 4800, ziel_soll: 4950, ziel_max: 5100,
            akzent: "#3A5F9E", schrift_text: "Cambria", schrift_kopf: "Calibri" },
  api: { model: "claude-opus-5", console_limit_bestaetigt: true },
  budget: { monthly_eur: 10, daily_reports: 5 },
  eingerichtet: true,
};

const basis = {
  f_name: "Maria Bergmann", f_chiffre: "M.B.-1987", f_nr: "3",
  f_gebdatum: "1987-04-12", f_geschlecht: "weiblich", f_kasse: "Beihilfe",
  f_bewilligt: "60", f_verbraucht: "58", f_beantragt: "40",
  f_frequenz: "wöchentlicher Frequenz",
  f_sozio: "Lehrerin, in Partnerschaft, keine Kinder",
  f_ziele_alt: "1. Stabilisierung des Antriebs. 2. Aufarbeitung der beruflichen Überforderung. 3. Verbesserung der Abgrenzungsfähigkeit.",
};

const gefuellt = { ...basis,
  f_beginn: "2024-05-02",
  f_ausgangslage: "Auslöser war eine Konfliktsituation im Kollegium; ausgeprägte depressive Symptomatik, Antriebsminderung, Rückzug. Zugrunde liegend ein Autonomie-Abhängigkeits-Konflikt.",
  f_verlauf: "Biografische Arbeit vertieft, Übertragungsbeziehung bearbeitet, berufliche Situation.",
  f_zielstatus: "Ziel 1 erreicht. Ziel 2 teilweise, weil die berufliche Rückkehr noch aussteht. Ziel 3 noch offen.",
  f_befund: "Wach, orientiert, im Antrieb gebessert.",
  f_diag_neu: "F33.1 (gesichert).",
  f_begruendung: "Muster noch nicht gefestigt.",
  f_prognose: "Motivation günstig, Veränderungshindernis ist die berufliche Unsicherheit.",
  f_methoden: "Ergänzend imaginative Stabilisierungsübungen.",
  f_abschluss: "Abschluss nach Rückkehr in den Beruf, danach ambulante Nachsorge.",
};
const leerFelder = { ...basis,
  f_verlauf: "Biografische Arbeit vertieft.", f_befund: "Wach, orientiert.",
  f_diag_neu: "F33.1 (gesichert).", f_begruendung: "Muster noch nicht gefestigt.",
  f_prognose: "Motivation günstig.",
  f_beginn: "", f_ausgangslage: "", f_zielstatus: "", f_methoden: "", f_abschluss: "",
};

console.log("\n=== Kriterium 1 — gefüllte neue Felder erreichen den Prompt ===");
const sys = M.systemPrompt(profil);
const up = M.userPrompt(gefuellt, profil);
pruef("Prüfliste im Systemteil", sys.includes("PFLICHTBESTANDTEILE NACH LEITFADEN"));
pruef("(1) Ausgangslage als Pflichtabsatz", sys.includes("Dieser Absatz ist PFLICHT"));
pruef("(2) Zielbilanz als vorletzter Absatz", sys.includes("VORLETZTER Absatz") && sys.includes("Von den zuletzt vereinbarten Zielen"));
pruef("(3) Methoden im Absatz Methodik und Setting", sys.includes("Behandlungsmethoden und -techniken bleiben unverändert"));
pruef("(4) Abschlussplanung im Absatz Prognose", sys.includes("Planung des Therapieabschlusses"));
pruef("Überschrift 1 am Leitfaden-Wortlaut", sys.includes("1. Behandlungsverlauf seit dem letzten Bericht und Erreichung der Therapieziele"));
pruef("Überschrift 2 am Leitfaden-Wortlaut", sys.includes("2. Aktuelle Diagnosen gemäß ICD-10 und aktueller psychischer Befund"));
pruef("Überschrift 3 am Leitfaden-Wortlaut", sys.includes("3. Begründung der Fortführung, weitere Therapieplanung und Prognose"));
pruef("Umfangsverteilung 2.750 / 750 / 1.450", sys.includes("2.750") && sys.includes("750 Zeichen") && sys.includes("1.450"));
pruef("sieben Absätze in Abschnitt 1", sys.includes("SIEBEN Absätzen"));
pruef("Therapiebeginn übergeben", up.includes("Therapiebeginn: 02.05.2024"));
pruef("Ausgangslage übergeben", up.includes("Autonomie-Abhängigkeits-Konflikt"));
pruef("Zielstatus übergeben", up.includes("Ziel 2 teilweise"));
pruef("Methoden übergeben", up.includes("imaginative Stabilisierungsübungen"));
pruef("Abschluss übergeben", up.includes("ambulante Nachsorge"));
pruef("Schlusszeile nennt sieben Absätze", up.includes("Abschnitt 1 hat sieben Absätze"));

console.log("\n=== Kriterium 2 — leere neue Felder erzeugen Standardsätze statt Stillschweigen ===");
const up2 = M.userPrompt(leerFelder, profil);
pruef("Therapiebeginn als (keine Angabe)", up2.includes("Therapiebeginn: (keine Angabe)"));
pruef("Ausgangslage weiterhin als Zeile vorhanden", up2.includes("Ausgangslage bei Therapiebeginn (zu Punkt 1, Absatz a):"));
pruef("Zielstatus weiterhin als Zeile vorhanden", up2.includes("Stand der zuletzt vereinbarten Therapieziele (zu Punkt 1"));
pruef("Methoden → Standardsatz unverändert", up2.includes("bleiben unverändert.“ abschliessen"));
pruef("Abschluss → Standardsatz vorgesehen", up2.includes("Der Abschluss ist nach Bearbeitung der genannten Ziele vorgesehen."));
pruef("Standardsätze statt BITTE ERGÄNZEN", up2.includes("NICHT 【BITTE ERGÄNZEN】"));

console.log("\n=== Kriterium 4 — Altfall lädt ohne Verlust ===");
const altfall = { f_name: "Alt Bestand", f_chiffre: "A.B.-1970", f_nr: "7", f_verlauf: "Alter Verlaufstext", f_prognose: "Alte Prognose" };
const gemischt = { ...M.leererFall(profil), ...altfall };
pruef("alte Werte überleben", gemischt.f_verlauf === "Alter Verlaufstext" && gemischt.f_prognose === "Alte Prognose" && gemischt.f_nr === "7");
pruef("neue Felder leer initialisiert", ["f_beginn","f_ausgangslage","f_zielstatus","f_methoden","f_abschluss"].every((k) => gemischt[k] === ""));
pruef("kein Feld verschwindet", Object.keys(gemischt).length === M.FELDER.length);
const altHtml = M.renderDocHTML("", gemischt, profil);
pruef("Altfall rendert ohne Fehler", typeof altHtml === "string" && altHtml.length > 500);

console.log("\n=== Kriterium 4b — alter Bericht mit alten Überschriften zerfällt korrekt ===");
const alterBericht = `1. Bisheriger Behandlungsverlauf seit dem letzten Bericht
Zu Behandlungsbeginn zeigte sich eine depressive Symptomatik.

2. Aktuelle Diagnose(n) und aktueller psychischer Befund
Diagnose(n): F33.1 (gesichert).

3. Begründung der Notwendigkeit der Fortführung, weitere Planung und Prognose
Die Fortführung ist notwendig.`;
const alteSecs = M.parseSections(alterBericht);
pruef("alte Überschrift wird abgestreift", !alteSecs[0].includes("Bisheriger Behandlungsverlauf") && alteSecs[0].startsWith("Zu Behandlungsbeginn"));
pruef("alle drei Abschnitte erkannt", alteSecs.every((x) => x.trim().length > 5));

console.log("\n=== Kriterium 5 - Antragsart steuert den Prompt ===");
const fortF = { ...M.leererFall(profil), ...gefuellt, f_antragsart: "fortfuehrung" };
const umwF  = { ...M.leererFall(profil), ...gefuellt, f_antragsart: "umwandlung" };
const pFort = M.userPrompt(fortF, profil);
const pUmw  = M.userPrompt(umwF, profil);

pruef("Fortfuehrung nennt den letzten Bericht",
  pFort.includes("seit letztem Bericht") && !pFort.includes("UMWANDLUNG"));
pruef("Umwandlung nennt KEINEN letzten Bericht",
  pUmw.includes("seit Therapiebeginn") && !pUmw.includes("seit letztem Bericht"));
pruef("Umwandlung fordert die Begruendung der Umwandlung",
  pUmw.includes("UMWANDLUNG") && /Notwendigkeit der Umwandlung/.test(pUmw));
pruef("Umwandlung fordert Begruendung von Setting und Frequenz",
  /Setting, Sitzungszahl und Behandlungsfrequenz/.test(pUmw));
pruef("Umwandlung ordnet die Ziele der Kurzzeittherapie zu",
  pUmw.includes("Ziele der Kurzzeittherapie"));
pruef("f_antragsart ist ein Feld", M.FELDER.includes("f_antragsart"));
pruef("Vorgabewert ist Fortfuehrung", M.leererFall(profil).f_antragsart === "fortfuehrung");

console.log("\n=== Kriterium 6 - Kuerzen verliert keine Pflichtinhalte ===");
const kp = M.kuerzePrompt("Ein Entwurf.", profil);
pruef("Kuerzen nennt die vier Pflichtbestandteile",
  /Ausgangslage/.test(kp) && /Therapiezielen/.test(kp)
  && /Methodik und Setting/.test(kp) && /Therapieabschlusses/.test(kp));
pruef("Kuerzen schuetzt Diagnosen und Schlusssatz",
  /ICD-10/.test(kp) && /Schlusssatz/.test(kp));
pruef("Kuerzen erlaubt Ueberlaenge statt Verlust",
  /hinzunehmen/.test(kp));

console.log("\n=== Kriterium 7 - Leitfadenhinweise vorhanden ===");
// Selbsterklaerende Stammdaten brauchen keinen Hinweis; jedes andere
// Feld muss einen haben, sonst zeigt Rana ein Info-Zeichen ins Leere.
const ohneNoetig = ["f_name", "f_gebdatum", "f_geschlecht", "f_kasse", "f_beginn"];
const ohneHinweis = M.FELDER.filter((k) => !ohneNoetig.includes(k) && !M.LEITFADEN[k]);
pruef(`jedes erklaerungsbeduerftige Feld hat einen Hinweis (${ohneHinweis.join(", ") || "-"})`,
  ohneHinweis.length === 0);
pruef("Umwandlungs-Zusatz an den Feldern, die sich unterscheiden",
  ["f_nr", "f_vorbericht", "f_lastreport", "f_ziele_alt", "f_verlauf", "f_zielstatus", "f_methoden"]
    .every((k) => M.LEITFADEN[k] && M.LEITFADEN[k].umwandlung));
pruef("jeder Hinweis hat verlangt + punkte",
  Object.values(M.LEITFADEN).every((h) => h.verlangt && Array.isArray(h.punkte) && h.punkte.length > 0));

export { profil, gefuellt, leerFelder, fehler };
console.log(`\n=== Zwischenstand: ${fehler} Fehler ===`);
process.exitCode = fehler ? 1 : 0;
