/**
 * Wie viel Luft hat der Korridor nach oben?
 *
 * Der Patch fügt Abschnitt 1 einen siebten Absatz hinzu und verlängert
 * die Überschriften. Beides kostet senkrechten Platz. Die Vorgabe
 * 4.800–5.100 muss also neu gegen die Wirklichkeit gehalten werden:
 * Berichte wachsender Länge erzeugen, nach PDF wandeln, Seiten zählen.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
globalThis.window = { matchMedia: () => ({ matches: false }) };
const M = await import("./bundle.mjs");
const { profil, gefuellt } = await import("./abnahme.mjs");
const basis = `1. Behandlungsverlauf seit dem letzten Bericht und Erreichung der Therapieziele
Die Behandlung begann am zweiten Mai zweitausendvierundzwanzig. Auslöser war eine über Monate eskalierende Konfliktsituation im Kollegium, in deren Folge sich eine ausgeprägte depressive Symptomatik mit Antriebsminderung, Ein- und Durchschlafstörungen und deutlichem sozialen Rückzug entwickelte. Das Funktionsniveau war erheblich eingeschränkt, die berufliche Tätigkeit konnte über acht Wochen nicht ausgeübt werden. Zugrunde liegt ein Autonomie-Abhängigkeits-Konflikt auf mittlerem Strukturniveau. Eine medikamentöse Behandlung mit Sertralin besteht unverändert fort.

Im Berichtszeitraum wurde die biografische Arbeit vertieft. Die Patientin berichtet, sie habe schon als Kind die Rolle der Vermittlerin zwischen den Eltern eingenommen.@1

Ein zweiter Schwerpunkt lag auf der Übertragungsbeziehung. Wiederholt zeigte sich ein vorauseilendes Bemühen, es der Behandlerin recht zu machen.@2

Die berufliche Situation bildete den dritten Schwerpunkt. Die Patientin nahm im Februar eine stufenweise Wiedereingliederung auf.@3

Aktuelle Belastungen ergeben sich aus der ungeklärten Frage, ob die Wiedereingliederung in eine volle Stelle münden wird.@4

Von den zuletzt vereinbarten Zielen ist die Stabilisierung des Antriebs erreicht, weil die Patientin ihren Alltag durchgehend selbständig strukturiert. Die Aufarbeitung der beruflichen Überforderung ist teilweise erreicht, weil die Rückkehr in den vollen Umfang noch aussteht. Die Verbesserung der Abgrenzungsfähigkeit bleibt noch offen, weil das Abgrenzen bislang nur im geschützten Rahmen gelingt.

Zusammenfassung: Es zeigt sich eine deutliche Besserung von Antrieb, Schlaf und sozialer Teilhabe, obgleich die Grübelneigung fortbesteht.

2. Aktuelle Diagnosen gemäß ICD-10 und aktueller psychischer Befund
Diagnose(n): F33.1 rezidivierende depressive Störung, gegenwärtig mittelgradige Episode, gesichert.

Psychischer Befund: Wach, allseits orientiert, im Kontakt zugewandt. Der Antrieb ist deutlich gebessert, die Schwingungsfähigkeit erhalten. Kein Anhalt für Suizidalität.

Somatischer Befund: Keine relevanten somatischen Begleiterkrankungen bekannt.

3. Begründung der Fortführung, weitere Therapieplanung und Prognose
Die Fortführung ist notwendig, weil die erarbeiteten Einsichten noch nicht in tragfähige Handlungsmuster übergegangen sind.@5 Weitere Behandlungsziele:
1. Festigung der Abgrenzungsfähigkeit im beruflichen Umfeld.
2. Bearbeitung der Schuldgefühle nach eigener Grenzsetzung.
3. Begleitung der vollständigen beruflichen Wiedereingliederung.

Methodik und Setting: Die Behandlung soll als tiefenpsychologisch fundierte Psychotherapie im Einzelsetting fortgeführt werden. Beantragt werden weitere 40 Sitzungen bei wöchentlicher Frequenz. Ergänzend werden imaginative Stabilisierungsübungen eingesetzt.

Prognose: Günstig sind die hohe Motivation und die bereits erreichte Symptombesserung. Als Veränderungshindernis wirkt die anhaltende berufliche Unsicherheit.@6 Der Abschluss ist nach gelungener Rückkehr in den Beruf vorgesehen. Im Anschluss ist eine ambulante Nachsorge vorgesehen. Die geplante Behandlung ist damit ausreichend begründet und erfolgversprechend.`;

const FUELL = [
  " In den Stunden wird spürbar, wie schwer es ihr fällt, Unmut zu benennen.",
  " Sie berichtet, sie habe die Belastung lange für selbstverständlich gehalten.",
  " Einerseits erlebt sie das als Entlastung, dann wieder melden sich Schuldgefühle.",
  " Die Bearbeitung konnte an konkreten Situationen der letzten Wochen ansetzen.",
];
function bauen(ziel) {
  const f = [0,0,0,0,0,0];
  const mk = () => {
    let t = basis;
    for (let i = 0; i < 6; i++) {
      let a = "";
      for (let n = 0; n < f[i]; n++) a += FUELL[(i + n) % FUELL.length];
      t = t.replace(`@${i+1}`, a);
    }
    return t;
  };
  let i = 0;
  while (mk().length < ziel && i < 200) { f[i % 6]++; i++; }
  return mk();
}

mkdirSync("_test/k", { recursive: true });
console.log("\n  Zeichen   Seiten");
console.log("  ────────────────");
let letzteZwei = 0, ersteDrei = 0;
for (const ziel of [4700, 4900, 5100, 5200, 5300, 5450, 5600]) {
  const t = bauen(ziel);
  const m = M.metrik(t, profil);
  const blob = M.buildDocx(t, gefuellt, profil);
  writeFileSync(`_test/k/b${ziel}.docx`, Buffer.from(await blob.arrayBuffer()));
  execSync(`soffice --headless --convert-to pdf --outdir _test/k _test/k/b${ziel}.docx`, { stdio: "pipe", timeout: 120000 });
  const s = parseInt(/Pages:\s+(\d+)/.exec(execSync(`pdfinfo _test/k/b${ziel}.pdf`).toString())[1], 10);
  if (s === 2) letzteZwei = m.zeichen; else if (!ersteDrei) ersteDrei = m.zeichen;
  console.log(`  ${String(m.zeichen).padStart(6)}   ${String(s).padStart(6)}${s > 2 ? "   ← dritte Seite" : ""}`);
}
console.log(`\n  Zwei Seiten noch bei ${letzteZwei} Zeichen, dritte ab ${ersteDrei}.`);
console.log(`  Korridor-Obergrenze 5.100 → Puffer ${letzteZwei - 5100} Zeichen.\n`);
