import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
globalThis.window = { matchMedia: () => ({ matches: false }) };
const M = await import("./bundle.mjs");
const { profil, gefuellt } = await import("./abnahme.mjs");

// Ein Bericht in der NEUEN Gestalt: Abschnitt 1 mit sieben Absätzen
// (Ausgangslage, vier Verlaufsabsätze, Zielbilanz, Bilanzabsatz).
const bericht = `1. Behandlungsverlauf seit dem letzten Bericht und Erreichung der Therapieziele
Die Behandlung begann am zweiten Mai zweitausendvierundzwanzig. Auslöser war eine über Monate eskalierende Konfliktsituation im Kollegium, in deren Folge sich eine ausgeprägte depressive Symptomatik mit Antriebsminderung, Ein- und Durchschlafstörungen und deutlichem sozialen Rückzug entwickelte. Das Funktionsniveau war erheblich eingeschränkt, die berufliche Tätigkeit konnte über acht Wochen nicht ausgeübt werden. Zugrunde liegt ein Autonomie-Abhängigkeits-Konflikt auf mittlerem Strukturniveau, der sich in einer ausgeprägten Anpassungsbereitschaft bei gleichzeitig unterdrückter Aggression zeigt. Eine medikamentöse Behandlung mit Sertralin besteht seit Behandlungsbeginn unverändert fort.

Im Berichtszeitraum wurde die biografische Arbeit vertieft. Die Patientin berichtet, sie habe schon als Kind die Rolle der Vermittlerin zwischen den Eltern eingenommen und früh gelernt, eigene Bedürfnisse zurückzustellen. In den Stunden wird spürbar, wie schwer es ihr fällt, Unmut zu benennen, ohne sich sogleich zu entschuldigen, so als drohe bei jeder Abgrenzung der Verlust der Zuwendung.

Ein zweiter Schwerpunkt lag auf der Übertragungsbeziehung. Wiederholt zeigte sich ein vorauseilendes Bemühen, es der Behandlerin recht zu machen, etwa durch übermässig ausführliche Vorbereitung der Stunden. Die Bearbeitung dieses Musters im geschützten Rahmen ermöglichte erste Erfahrungen, dass Widerspruch die Beziehung nicht gefährdet.

Die berufliche Situation bildete den dritten Schwerpunkt. Die Patientin nahm im Februar eine stufenweise Wiedereingliederung auf. Sie berichtet, sie habe erstmals eine Zusatzaufgabe abgelehnt, ohne anschliessend in Grübeln zu geraten. Einerseits erlebt sie das als Entlastung, dann wieder melden sich Schuldgefühle gegenüber den Kolleginnen.

Aktuelle Belastungen ergeben sich aus der ungeklärten Frage, ob die Wiedereingliederung in eine volle Stelle münden wird. Diese Unsicherheit greift das alte Muster auf und führt zeitweise zu einer Zunahme der Grübelneigung, ohne dass es zu einem Einbruch des Antriebs käme.

Von den zuletzt vereinbarten Zielen ist die Stabilisierung des Antriebs erreicht, weil die Patientin ihren Alltag durchgehend selbständig strukturiert und der Schlaf sich normalisiert hat. Die Aufarbeitung der beruflichen Überforderung ist teilweise erreicht, weil die auslösende Konfliktsituation verstanden und eingeordnet werden konnte, die Rückkehr in den vollen Umfang jedoch noch aussteht. Die Verbesserung der Abgrenzungsfähigkeit bleibt noch offen, weil das Abgrenzen bislang nur im geschützten Rahmen und in einzelnen beruflichen Situationen gelingt.

Zusammenfassung: Es zeigt sich eine deutliche Besserung von Antrieb, Schlaf und sozialer Teilhabe, obgleich die Grübelneigung in Belastungssituationen fortbesteht und die Abgrenzungsfähigkeit im beruflichen Umfeld noch nicht gefestigt ist.

2. Aktuelle Diagnosen gemäß ICD-10 und aktueller psychischer Befund
Diagnose(n): F33.1 rezidivierende depressive Störung, gegenwärtig mittelgradige Episode, gesichert.

Psychischer Befund: Wach, allseits orientiert, im Kontakt zugewandt. Der Antrieb ist gegenüber dem letzten Bericht deutlich gebessert, die Schwingungsfähigkeit erhalten. Das Denken ist formal geordnet, inhaltlich zeitweise um berufliche Fragen kreisend. Kein Anhalt für Suizidalität.

Somatischer Befund: Keine relevanten somatischen Begleiterkrankungen bekannt.

3. Begründung der Fortführung, weitere Therapieplanung und Prognose
Die Fortführung ist notwendig, weil die erarbeiteten Einsichten noch nicht in tragfähige Handlungsmuster übergegangen sind und die berufliche Wiedereingliederung als eigentliche Bewährungsprobe noch bevorsteht. Ein Abbruch zum jetzigen Zeitpunkt liesse die Patientin genau in der Situation allein, auf die die bisherige Arbeit vorbereitet hat. Weitere Behandlungsziele:
1. Festigung der Abgrenzungsfähigkeit im beruflichen Umfeld.
2. Bearbeitung der Schuldgefühle nach eigener Grenzsetzung.
3. Begleitung der vollständigen beruflichen Wiedereingliederung.

Methodik und Setting: Die Behandlung soll als tiefenpsychologisch fundierte Psychotherapie im Einzelsetting fortgeführt werden. Beantragt werden weitere 40 Sitzungen bei wöchentlicher Frequenz. Ergänzend werden imaginative Stabilisierungsübungen eingesetzt, um die Grübelneigung in Belastungssituationen aufzufangen.

Prognose: Günstig sind die hohe Motivation, die gute Reflexionsfähigkeit und die bereits erreichte Symptombesserung. Als Veränderungshindernis wirkt die anhaltende berufliche Unsicherheit, die das alte Muster immer wieder aktiviert. Der Abschluss ist nach gelungener Rückkehr in den Beruf und Bearbeitung der genannten Ziele vorgesehen. Im Anschluss ist eine ambulante Nachsorge in grösseren Abständen vorgesehen. Die geplante Behandlung ist damit ausreichend begründet und erfolgversprechend.`;

const m = M.metrik(bericht, profil);
console.log(`Zeichen: ${m.zeichen ?? JSON.stringify(m)}  (Korridor ${profil.layout.ziel_min}–${profil.layout.ziel_max})`);

const secs = M.parseSections(bericht);
const abs1 = secs[0].split(/\n\s*\n/).filter((x) => x.trim()).length;
console.log(`Absätze in Abschnitt 1: ${abs1} (erwartet 7)`);

const blob = M.buildDocx(bericht, gefuellt, profil);
const buf = Buffer.from(await blob.arrayBuffer());
writeFileSync("_test/abnahme.docx", buf);
console.log("DOCX:", buf.length, "Bytes");

execSync("soffice --headless --convert-to pdf --outdir _test _test/abnahme.docx", { stdio: "pipe" });
const info = execSync("pdfinfo _test/abnahme.pdf").toString();
const seiten = /Pages:\s+(\d+)/.exec(info)[1];
console.log("PDF-Seiten:", seiten);

// Kriterium 5 — laufende Nummer im Berichtskopf
const html = M.renderDocHTML(bericht, { ...gefuellt, f_nr: "3" }, profil);
console.log("Kopf enthält „3. Fortführungsantrag“:", html.includes("3. Fortführungsantrag"));
console.log("Kopf enthält „Beginn 02.05.2024“:", html.includes("Beginn 02.05.2024"));
const pdftxt = execSync("pdftotext _test/abnahme.pdf - 2>/dev/null || true").toString();
console.log("PDF-Text enthält Nr. 3:", /3\.\s*Fortführungsantrag/i.test(pdftxt));
console.log("PDF-Text enthält Beginn:", /Beginn\s+02\.05\.2024/.test(pdftxt));
