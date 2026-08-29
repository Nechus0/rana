// Wie viele Zeichen passen wirklich auf zwei Seiten?
//
// Zwei gemessene Punkte aus echten Berichten:
//   A  Fortfuehrungsbericht, 3 Abschnitte, 7.095 Zeichen -> 3,0 Seiten
//   B  Umwandlungsbericht,   7 Abschnitte, 5.394 Zeichen -> 2,4 Seiten
//
// Der Unterschied zwischen beiden ist nicht nur die Zeichenzahl: B hat
// vier Ueberschriften mehr, und jede kostet Platz, den kein Zeichen
// fuellt. Ein Korridor, der nur Zeichen zaehlt, kann das nicht sehen —
// deshalb hat Rana bei B "2,0 Seiten" gemeldet und Word 2,4 gezeigt.

const ZEICHEN_JE_ZEILE = 95;   // 16 cm Satzbreite, 11 pt Serifenschrift
const ZEILEN_JE_SEITE  = 45;
const FEST             = 22;   // Briefkopf, Titel, Metabox, Unterschrift
const JE_UEBERSCHRIFT  = 2.5;  // Ueberschrift, Linie, Abstand
const JE_ABSATZ        = 0.5;  // Abstand nach dem Absatz

function seiten(zeichen, abschnitte, absaetze) {
  const zeilen = zeichen / ZEICHEN_JE_ZEILE
    + abschnitte * JE_UEBERSCHRIFT
    + absaetze * JE_ABSATZ
    + FEST;
  return zeilen / ZEILEN_JE_SEITE;
}

console.log("=== Modell gegen die Messung ===");
console.log("A  7.095 Z., 3 Abschnitte, 16 Absaetze:",
  seiten(7095, 3, 16).toFixed(2), "Seiten (gemessen 3,0)");
console.log("B  5.394 Z., 7 Abschnitte, 18 Absaetze:",
  seiten(5394, 7, 18).toFixed(2), "Seiten (gemessen 2,4)");

console.log("\n=== Was passt auf zwei Seiten? ===");
for (const [name, ab, ap] of [["Fortfuehrung", 3, 16], ["Umwandlung", 7, 18]]) {
  const zeilenFrei = 2 * ZEILEN_JE_SEITE - FEST - ab * JE_UEBERSCHRIFT - ap * JE_ABSATZ;
  const z = Math.round(zeilenFrei * ZEICHEN_JE_ZEILE / 100) * 100;
  console.log(`${name.padEnd(14)} ${ab} Abschnitte -> ${z.toLocaleString("de-DE")} Zeichen`);
}

console.log("\n=== Zur Kontrolle: der heutige Korridor ===");
console.log("ziel_soll 4.900 als Fortfuehrung:", seiten(4900, 3, 16).toFixed(2), "Seiten");
console.log("ziel_soll 4.900 als Umwandlung: ", seiten(4900, 7, 18).toFixed(2), "Seiten");
