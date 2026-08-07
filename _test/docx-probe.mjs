// Prüft die Word-Ausgabe an einem erfundenen Fall: Erzeugt Rana eine
// Datei, die Word wirklich öffnet? Und stehen die richtigen Dinge drin?
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

// Der gebaute Bündel enthält alles; Blob und TextEncoder gibt es in Node.
globalThis.window = { matchMedia: () => ({ matches: false }) };

const { buildDocx } = await import("./docx-shim.mjs");

const fall = {
  f_name: "Maria Bergmann", f_chiffre: "M.B.-1987", f_nr: "2",
  f_gebdatum: "1987-04-12", f_geschlecht: "weiblich",
  f_kasse: "AOK Niedersachsen",
  f_bewilligt: "60", f_verbraucht: "58", f_beantragt: "40",
  f_frequenz: "wöchentlicher Frequenz",
  f_sozio: "Lehrerin, in Partnerschaft, keine Kinder",
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

// Ein Text, wie ihn ein Modell liefert — samt der typischen Unarten:
// angeklebte Ziele, Markdown-Reste, verklebte Beschriftung.
const bericht = `1. Bisheriger Behandlungsverlauf seit dem letzten Bericht
Zu Behandlungsbeginn zeigte sich eine ausgeprägte depressive Symptomatik.
Die Patientin berichtet, sie habe sich zunehmend zurückgezogen.

Im weiteren Verlauf wurde die biografische Arbeit vertieft.

Zusammenfassung: Es zeigt sich eine deutliche Besserung des Antriebs, obgleich die Grübelneigung fortbesteht.

2. Aktuelle Diagnose(n) und aktueller psychischer Befund
Diagnose(n): F33.1 rezidivierende depressive Störung, gegenwärtig mittelgradig (gesichert).

Psychischer Befund: Wach, orientiert, im Antrieb gebessert. 【BITTE ERGÄNZEN: Suizidalität】

3. Begründung der Notwendigkeit der Fortführung, weitere Planung und Prognose
Die Fortführung ist notwendig, weil die erarbeiteten Muster noch nicht gefestigt sind. Weitere Behandlungsziele:1. Festigung der erarbeiteten Bewältigungsstrategien.2. Aufarbeitung der beruflichen Belastung.3. Stabilisierung des Selbstwerts.
Methodik und Setting: Die Behandlung soll als tiefenpsychologisch fundierte Psychotherapie im Einzelsetting fortgeführt werden. Beantragt werden weitere 40 Sitzungen bei wöchentlicher Frequenz.

Prognose: Günstig sind Motivation und Umstellungsfähigkeit. Die geplante Behandlung ist damit ausreichend begründet und erfolgversprechend.`;

const blob = buildDocx(bericht, fall, profil);
const buf = Buffer.from(await blob.arrayBuffer());
writeFileSync(new URL("probe.docx", import.meta.url), buf);
console.log("Datei erzeugt:", buf.length, "Bytes");
