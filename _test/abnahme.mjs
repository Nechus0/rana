// Abnahmekriterien aus Rana-Aenderungen-PTV3-Leitfaden-Prompt.md
import { readFileSync, writeFileSync } from "node:fs";
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
// Seit 2.7.0 steht die Zielbilanz als LETZTER Absatz und traegt die
// Symptomveraenderung mit. Der Absatz "Zusammenfassung", der bis 2.6.1
// dahinter stand, wiederholte sie nur und ist entfallen.
pruef("(2) Zielbilanz als letzter Absatz mit Symptomveraenderung",
  sys.includes("LETZTER Absatz") && sys.includes("Von den zuletzt vereinbarten Zielen")
  && /Symptomatik und des Funktionsniveaus/.test(sys));
pruef("(2b) keine erfundene Zusammenfassung mehr",
  /KEINEN Absatz .Zusammenfassung/.test(sys) && !sys.includes('Label „Zusammenfassung: “'));
pruef("(2c) kein bewertender Schlusssatz mehr",
  /KEINE bewertenden Schlusss/.test(sys)
  && !sys.includes("ausreichend begründet und erfolgversprechend.“"));
pruef("(3) Methoden im Absatz Methodik und Setting", sys.includes("Behandlungsmethoden und -techniken bleiben unverändert"));
pruef("(4) Abschlussplanung im Absatz Prognose", sys.includes("Planung des Therapieabschlusses"));
pruef("Überschrift 1 am Leitfaden-Wortlaut", sys.includes("1. Behandlungsverlauf seit dem letzten Bericht und Erreichung der Therapieziele"));
pruef("Überschrift 2 am Leitfaden-Wortlaut", sys.includes("2. Aktuelle Diagnosen gemäß ICD-10 und aktueller psychischer Befund"));
pruef("Überschrift 3 am Leitfaden-Wortlaut", sys.includes("3. Begründung der Fortführung, weitere Therapieplanung und Prognose"));
// Der Korridor kommt seit 2.7.2 aus dem Satzspiegel, nicht aus einer
// festen Zahl: sieben Ueberschriften kosten eine Viertelseite, die
// kein Zeichen fuellt. Deshalb hat der Umwandlungsbericht ein
// deutlich kleineres Budget als der Fortfuehrungsbericht.
pruef("Budget je Abschnitt genannt", /BUDGET JE ABSCHNITT/.test(sys));
const sysU = M.systemPrompt(profil, "umwandlung");
const kF = M.korridor("fortfuehrung", profil);
const kU = M.korridor("umwandlung", profil);
pruef(`Umwandlung hat ein kleineres Budget (${kF.soll} gegen ${kU.soll})`, kU.soll < kF.soll - 800);
pruef("beide Korridore stehen im Prompt",
  sys.includes(kF.soll.toLocaleString("de-DE")) && sysU.includes(kU.soll.toLocaleString("de-DE")));
pruef("die Verteilung nennt jeden Abschnitt einzeln",
  (sysU.match(/HÖCHSTENS [\d.]+ Zeichen \(etwa/g) || []).length === 7);

// Die Schaetzung muss die gemessenen Berichte treffen. Zwei echte
// Punkte: der Fortfuehrungsbericht mit 7.095 Zeichen lief auf knapp
// zweieinhalb Seiten, der Umwandlungsbericht mit 5.394 auf 2,4.
const absatz = (n) => Array.from({ length: n }, (_, i) => "x".repeat(400)).join("\n\n");
const sA = M.seitenSchaetzung("x".repeat(7095).replace(/(.{400})/g, "$1\n\n"), 3);
const sB = M.seitenSchaetzung("x".repeat(5394).replace(/(.{400})/g, "$1\n\n"), 7);
pruef(`7.095 Zeichen bei 3 Abschnitten: ${sA.toFixed(2)} Seiten (gemessen ~2,5)`,
  sA > 2.2 && sA < 2.8);
pruef(`5.394 Zeichen bei 7 Abschnitten: ${sB.toFixed(2)} Seiten (gemessen 2,4)`,
  sB > 2.2 && sB < 2.6);
pruef("dieselbe Zeichenzahl braucht bei sieben Abschnitten mehr Platz",
  M.seitenSchaetzung(absatz(12), 7) > M.seitenSchaetzung(absatz(12), 3));
// Statt sieben Absaetzen jetzt hoechstens zwei Verlaufsabsaetze — das
// sitzungsweise Protokoll war der groesste Einzelposten der Ueberlaenge.
pruef("hoechstens zwei Verlaufsabsaetze", sys.includes("HÖCHSTENS ZWEI Absätze zum Verlauf"));
pruef("Verlauf ergebnisorientiert statt Sitzungsprotokoll",
  /ERGEBNISORIENTIERT/.test(sys) && /NICHT als Nacherzählung/.test(sys));
pruef("harte Obergrenze benannt", /harte Grenze, keine Anregung/.test(sys));
pruef("Therapiebeginn übergeben", up.includes("Therapiebeginn: 02.05.2024"));
pruef("Ausgangslage übergeben", up.includes("Autonomie-Abhängigkeits-Konflikt"));
pruef("Zielstatus übergeben", up.includes("Ziel 2 teilweise"));
pruef("Methoden übergeben", up.includes("imaginative Stabilisierungsübungen"));
pruef("Abschluss übergeben", up.includes("ambulante Nachsorge"));
pruef("Schlusszeile nennt die Obergrenze", /HÖCHSTENS 5\.100/.test(up) && /kürze selbst/.test(up));

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
pruef("Umwandlung nennt die siebenteilige Gliederung",
  /SIEBENTEILIGEN Gliederung/.test(pUmw));
pruef("Umwandlung fragt die Kurzzeitziele ab",
  /Kurzzeittherapie vereinbarte Ziele/.test(pUmw));
pruef("Umwandlung fragt die Umwandlungsbegruendung ab",
  /Warum die Kurzzeittherapie nicht ausreicht/.test(pUmw));
pruef("Umwandlung fragt den Konsiliarbericht ab",
  /Konsiliarbericht/.test(pUmw));
pruef("Umwandlung fragt das Krankheitsverstaendnis ab",
  /Krankheitsverständnis/.test(pUmw));

console.log("\n=== Kriterium 5b - der Systemteil des Umwandlungsberichts ===");
const sUmw = M.systemPrompt(profil, "umwandlung");
const sFort = M.systemPrompt(profil, "fortfuehrung");
pruef("sieben Ueberschriften, wortlautgetreu", [
  "1. Relevante soziodemographische Daten",
  "2. Symptomatik und psychischer Befund",
  "3. Somatischer Befund und Konsiliarbericht",
  "5. Diagnose zum Zeitpunkt der Antragstellung",
  "6. Behandlungsplan und Prognose",
  "7. Zusätzlich erforderliche Angaben zum Umwandlungsantrag",
].every((t) => sUmw.includes(t)));
pruef("Punkt 4 nennt das Verfahrensmodell",
  /4\. Behandlungsrelevante Angaben zur Lebensgeschichte, zur Krankheitsanamnese und zur Psychodynamik/.test(sUmw));
pruef("Abschnitt 3 darf nie leer bleiben",
  /darf NIEMALS leer bleiben/.test(sUmw));
pruef("psychodynamische Diagnose fuer TP verlangt",
  /psychodynamische bzw. neurosenpsychologische Diagnose/.test(sUmw));
pruef("Setting und Frequenz begruenden, nicht nennen",
  /BEGRÜNDUNG von Setting, Sitzungszahl und Behandlungsfrequenz/.test(sUmw));
pruef("kein Fortfuehrungs-Aufbau im Umwandlungsbericht",
  !sUmw.includes("seit dem letzten Bericht und Erreichung"));
pruef("Fortfuehrungsbericht bleibt dreiteilig",
  sFort.includes("1. Behandlungsverlauf seit dem letzten Bericht") && !sFort.includes("7."));

console.log("\n=== Kriterium 5c - die Gliederung selbst ===");
pruef("Fortfuehrung hat drei Punkte", M.gliederung("fortfuehrung", profil).length === 3);
pruef("Umwandlung hat sieben Punkte", M.gliederung("umwandlung", profil).length === 7);
const secsUmw = M.parseSections(
  M.gliederung("umwandlung", profil).map((x, i) => `${i + 1}. ${x.titel}\nInhalt ${i + 1}.`).join("\n\n"),
  M.gliederung("umwandlung", profil),
);
pruef("sieben Abschnitte werden zerlegt", secsUmw.length === 7);
pruef("jede Ueberschrift wird abgestreift",
  secsUmw.every((s, i) => s.trim() === `Inhalt ${i + 1}.`));
pruef("f_antragsart ist ein Feld", M.FELDER.includes("f_antragsart"));
pruef("Vorgabewert ist Fortfuehrung", M.leererFall(profil).f_antragsart === "fortfuehrung");

console.log("\n=== Kriterium 6 - Kuerzen verliert keine Pflichtinhalte ===");
const kp = M.kuerzePrompt("Ein Entwurf.", profil);
pruef("Kuerzen nennt die vier Pflichtbestandteile",
  /Ausgangslage/.test(kp) && /Therapiezielen/.test(kp)
  && /Methodik und Setting/.test(kp) && /Therapieabschlusses/.test(kp));
pruef("Kuerzen schuetzt Diagnosen und Gliederung",
  /ICD-10/.test(kp) && /Kein Gliederungspunkt darf verschwinden/.test(kp));
pruef("Kuerzen nimmt sich zuerst das Sitzungsprotokoll vor",
  /Sitzungsweise Nacherzählung/.test(kp));

// Beim Umwandlungsbericht schuetzt das Kuerzen andere Angaben — allen
// voran den Abschnitt, den es im Fortfuehrungsbericht gar nicht gibt.
const kpUmw = M.kuerzePrompt("Ein Entwurf.", profil, "umwandlung");
pruef("Kuerzen schuetzt den Konsiliarbericht",
  /Er darf niemals ganz wegfallen/.test(kpUmw) && /somatischer Befund und Konsiliarbericht/.test(kpUmw));
pruef("Kuerzen schuetzt die Umwandlungsbegruendung",
  /Begründung der Umwandlung in Abschnitt 7/.test(kpUmw));
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

console.log("\n=== Kriterium 8 - Umwandlungsbericht von Ende zu Ende ===");
// Ein vollstaendiger Durchlauf: Gliederung → Rohtext → Anzeige → Word.
// Die Einzelteile sind oben geprueft; hier geht es darum, dass sie
// zusammen einen Bericht ergeben, in dem nirgends mehr die falsche
// Antragsart steht.
const umwFall = {
  ...M.leererFall(profil),
  f_antragsart: "umwandlung",
  f_chiffre: "V36-025825", f_gebdatum: "1962-10-09", f_nr: "1",
  f_bewilligt: "24", f_verbraucht: "24", f_beantragt: "36", f_frequenz: "woechentlich",
};
const punkte = M.gliederung("umwandlung", profil);
const rohtext = punkte.map((x, i) => `${i + 1}. ${x.titel}\n\nInhalt zu Punkt ${i + 1}.`).join("\n\n");
const html = M.renderDocHTML(rohtext, umwFall, profil);
const f = umwFall;
const p = profil;
const text = rohtext;

pruef("sieben Abschnittsueberschriften", (html.match(/class="t">/g) || []).length === 7);
pruef("Kopfzeile sagt Umwandlungsantrag", /Umwandlungsantrag<\/td>/.test(html));
// Das Profil traegt einen eigenen Untertitel mit dem Wort
// „Fortführungsantrag". Er soll erhalten bleiben — nur das eine Wort
// wird getauscht, sonst stuende die falsche Antragsart im Bericht.
pruef("Untertitel nennt den Umwandlungsantrag", /doc-subtitle">[^<]*Umwandlungsantrag/.test(html));

// Wer einen eigenen Untertitel hinterlegt hat — manche Beihilfestellen
// verlangen einen bestimmten Wortlaut —, behaelt ihn. Getauscht wird
// nur das eine Wort, das die Antragsart nennt.
const pBeihilfe = { ...p, layout: { ...p.layout, untertitel: "zum Fortführungsantrag auf Anerkennung der Beihilfefähigkeit" } };
pruef("eigener Untertitel bleibt erhalten",
  M.untertitel("umwandlung", pBeihilfe) === "zum Umwandlungsantrag auf Anerkennung der Beihilfefähigkeit");
pruef("eigener Untertitel beim Fortfuehrungsantrag unangetastet",
  M.untertitel("fortfuehrung", pBeihilfe) === "zum Fortführungsantrag auf Anerkennung der Beihilfefähigkeit");
pruef("Fusszeile sagt Umwandlungsbericht", /Umwandlungsbericht/.test(html));
pruef("nirgends mehr Fortfuehrungsantrag", !/Fortführungsantrag/.test(html));
pruef("nirgends mehr 'seit dem letzten Bericht'", !/seit dem letzten Bericht/.test(html));
pruef("Dateiname traegt Umwandlungsbericht", M.fileBase(f).startsWith("Umwandlungsbericht"));
pruef("jeder Abschnitt hat seinen Inhalt",
  punkte.every((_, i) => html.includes(`Inhalt zu Punkt ${i + 1}.`)));

const blob = M.buildDocx(text, f, p);
const buf = Buffer.from(await blob.arrayBuffer());
pruef("Word-Datei ist ein ZIP", buf.subarray(0, 2).toString() === "PK");
pruef("Word-Datei nicht leer", buf.length > 10000);

// Zum Vergleich der Fortfuehrungsbericht — er darf sich nicht geaendert haben.
console.log("\n=== Fortfuehrungsbericht unveraendert ===");
const fF = { ...M.leererFall(p), f_chiffre: "A.B.-1970", f_nr: "2" };
const tF = M.gliederung("fortfuehrung", p)
  .map((x, i) => `${i + 1}. ${x.titel}\n\nInhalt zu Punkt ${i + 1}.`).join("\n\n");
const hF = M.renderDocHTML(tF, fF, p);
pruef("drei Abschnittsueberschriften", (hF.match(/class="t">/g) || []).length === 3);
pruef("Kopfzeile sagt 2. Fortfuehrungsantrag", /2\. Fortführungsantrag<\/td>/.test(hF));
pruef("Fusszeile sagt Fortfuehrungsbericht", /Fortführungsbericht/.test(hF));
pruef("Dateiname traegt Fortfuehrungsbericht", M.fileBase(fF).startsWith("Fortfuehrungsbericht"));


console.log("\n=== Kriterium 9 - jede Pflichtangabe hat auch ein Feld ===");
// Eine Pflichtangabe ohne Eingabefeld ist schlimmer als keine: die
// Fortschrittsanzeige meldet eine Luecke, der Klick darauf springt in
// den Schritt — und dort ist nichts zu sehen. Genau das passierte in
// 2.7.0 mit dem psychischen Befund im Umwandlungspfad.
const stepsQuelle = readFileSync(new URL("../src/views/steps.ts", import.meta.url), "utf8");
const teilVon = (von, bis) => stepsQuelle.slice(stepsQuelle.indexOf(von), stepsQuelle.indexOf(bis));
const feldeIn = (b) => new Set((b.match(/"f_[a-z_]+"/g) || []).map((x) => x.slice(1, -1)));
// Chiffre, Geburtsdatum und Soziodemografie stehen an der Patientin,
// nicht am Antrag — sie werden in der Patientenuebersicht gepflegt.
const amPatienten = ["f_chiffre", "f_gebdatum", "f_sozio"];
const schrittBloecke = {
  eins: teilVon("function schritt1", "function schritt2("),
  zweiFort: teilVon("function schritt2Fortfuehrung", "function schritt2Umwandlung"),
  zweiUmw: teilVon("function schritt2Umwandlung", "/** Die Beschriftung folgt"),
  dreiFort: teilVon("function schritt3Fortfuehrung", "function schritt3Umwandlung"),
  dreiUmw: teilVon("function schritt3Umwandlung", "// Schritt 4"),
};
for (const art of ["fortfuehrung", "umwandlung"]) {
  const teile = art === "umwandlung"
    ? [schrittBloecke.eins, schrittBloecke.zweiUmw, schrittBloecke.dreiUmw]
    : [schrittBloecke.eins, schrittBloecke.zweiFort, schrittBloecke.dreiFort];
  const vorhanden = new Set(teile.flatMap((b) => [...feldeIn(b)]));
  const ohne = M.pflicht(art).map((x) => x.feld)
    .filter((x) => !vorhanden.has(x) && !amPatienten.includes(x));
  pruef(`${art}: alle ${M.pflicht(art).length} Pflichtangaben haben ein Feld (${ohne.join(", ") || "-"})`,
    ohne.length === 0);
}

export { profil, gefuellt, leerFelder, fehler };
console.log(`\n=== Zwischenstand: ${fehler} Fehler ===`);
process.exitCode = fehler ? 1 : 0;
