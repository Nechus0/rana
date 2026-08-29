/**
 * Der Auftrag an Claude.
 *
 * Er ist bewusst in zwei Teile geschnitten:
 *
 *   systemPrompt()  — die Regeln. Bei jedem Bericht gleich, solange
 *                     sich das Praxisprofil nicht ändert. Dieser Teil
 *                     wird zwischengespeichert und kostet ab dem
 *                     zweiten Bericht nur noch ein Zehntel.
 *   userPrompt()    — die Falldaten. Jedes Mal anders.
 *
 * Der Schnitt ist keine Formsache: er macht den Löwenanteil der
 * Eingabekosten aus. Deshalb darf in den Systemteil nichts
 * Fallbezogenes geraten — sonst fällt der Zwischenspeicher aus.
 *
 * Die Stilregeln stammen aus dem Vorgängerprogramm. Sie sind über
 * viele Berichte hinweg abgestimmt und werden hier unverändert
 * übernommen; neu ist nur, dass sie vom Verfahren abhängen.
 */

import type { Felder, Profile } from "../core/ipc";
import { artVon, gliederung, korridor } from "./gliederung";
import type { Antragsart, Punkt } from "./gliederung";

// ===============================================================
// Gemeinsame Regeln
// ===============================================================

function umfang(p: Profile, punkte: Punkt[], art: Antragsart): string {
  const K = korridor(art, p);
  // Die Richtwerte aus der Gliederung auf den Korridor skalieren.
  const summe = punkte.reduce((a, x) => a + x.anteil, 0) || 1;
  const zeilen = punkte.map((x, i) => {
    const z = Math.round((x.anteil / summe) * K.soll / 10) * 10;
    return `  Abschnitt ${i + 1} — ${x.titel}: HÖCHSTENS ${z.toLocaleString("de-DE")} Zeichen (etwa ${Math.round(z / 7.8)} Wörter, ${Math.max(1, Math.round(z / 380))} Absätze).`;
  });

  return [
    "UMFANG – DIE WICHTIGSTE VORGABE ÜBERHAUPT:",
    `Der fertige Bericht muss auf ZWEI SEITEN passen. Das sind bei diesem Satzspiegel ${K.soll.toLocaleString("de-DE")} Zeichen Fliesstext — nicht mehr.`,
    `Diese Zahl ist kleiner, als sie wirkt: Briefkopf, Titel, Datenkasten und Unterschrift belegen bereits eine halbe Seite, und jede der ${punkte.length} Überschriften kostet weiteren Platz, den kein Zeichen füllt.`,
    `Untergrenze ${K.min.toLocaleString("de-DE")}, Obergrenze ${K.max.toLocaleString("de-DE")} Zeichen. Die Obergrenze ist eine harte Grenze, keine Anregung.`,
    "",
    "BUDGET JE ABSCHNITT — halte dich daran, Abschnitt für Abschnitt:",
    ...zeilen,
    "",
    "SO ARBEITEST DU DAS BUDGET AB: Schreibe jeden Abschnitt einzeln und prüfe seine Länge, BEVOR du den nächsten beginnst. Ein Abschnitt, der sein Budget überzieht, nimmt den Platz eines späteren — und der fehlt dann dort, wo der Gutachter seine Entscheidung trifft.",
    "",
    "SPARSAMKEIT IST TEIL DER AUFGABE. Der Leitfaden verlangt ausdrücklich, dass der Bericht auf die für das Verständnis der Störung und für die Behandlung relevanten Angaben BEGRENZT bleibt, und er erlaubt ausdrücklich stichwortartige Angaben.",
    "  – Erzähle nicht Sitzung für Sitzung nach, sondern ergebnisorientiert: was sich verändert hat und woran das erkennbar ist.",
    "  – Ein Beispiel je Aussage genügt. Wo zwei dasselbe belegen, nimm eines.",
    "  – Keine Aussage zweimal, auch nicht in anderen Worten und in einem anderen Abschnitt.",
    "  – Keine Wendungen ohne Fallbezug, keine Füllsätze, keine Vorbemerkungen wie „Im Folgenden wird dargestellt“.",
    "",
    `Liegst du unter ${K.min.toLocaleString("de-DE")} Zeichen, führe die klinisch bedeutsamen Punkte konkreter aus. Strecke den Text aber niemals ohne Grundlage: reichen die gelieferten Angaben nicht, schreibe lieber kürzer.`,
  ].join("\n");
}

/**
 * Der Schreibstil. Diese Regeln sind der Grund, warum die Berichte
 * nicht nach Maschine klingen, und sie gelten für jedes Verfahren.
 */
const STIL = [
  "SCHREIBSTIL (verbindlich einhalten):",
  "– Durchgehend dritte Person, kein „ich“ als Autorinnen-Stimme. Eigene Wahrnehmung als Beobachtung am Gegenüber formulieren („wirkt“, „zeigt sich“, „ist spürbar“), nie als Ich-Aussage.",
  "– Was die Patientin/der Patient berichtet, steht im Konjunktiv I („sei“, „habe“, „könne“, „werde“). Eigene Befunde, Einschätzungen und die Begründung stehen im Indikativ Präsens. Diese Trennung durchgehend einhalten, nie vermischen.",
  "– Begründungen mit „weil“, nicht mit „da“. Einräumungen mit „obgleich“, nicht „obwohl“.",
  "– Relativierung über Verben, nicht Adverbien: „offenbar“, „scheint“, „wirkt“, „erscheint“, „am ehesten“ – statt vorangestelltem „vielleicht“/„möglicherweise“.",
  "– Ambivalenzen mit „einerseits … andererseits“ bzw. „einerseits … dann wieder“.",
  "– Konkrete Beobachtung vor der Deutung, verknüpft über „so als“ (z. B. „…, so als gebe ihr das Sicherheit“).",
  "– Therapeutische Vorhaben im Passiv mit „soll/sollen“ („soll herausgearbeitet werden“, „soll aufgearbeitet werden“).",
  "– Nüchterne Interpunktion: keine Ausrufezeichen, keine rhetorischen Fragen, keine Emojis, keine Gedankenstrich-Einschübe, kein Semikolon.",
  "– Keine KI-typischen Wendungen wie „darüber hinaus“, „des Weiteren“, „insbesondere“, „es ist wichtig zu“, „es gilt“, „daher“, „folglich“, „dementsprechend“, „ganzheitlich“, „zielgerichtet“, „tiefgreifend“, „essenziell“. Auch „zusammenfassend“ nicht.",
  "– KEINE bewertenden Schlusssätze über die eigene Arbeit. Sätze wie „Die geplante Behandlung ist damit ausreichend begründet und erfolgversprechend“ nehmen dem Gutachter die Entscheidung vorweg, die ihm zusteht, und der Leitfaden verlangt sie nicht. Der Bericht endet mit der letzten inhaltlichen Aussage.",
  "– Keine Abkürzungen wie „bzw.“, „u. a.“, „ggf.“. Zahlen unter zwölf im Text ausschreiben.",
  "– Aufzählungen nur an den ausdrücklich genannten Stellen. Behandlungsziele werden nummeriert („1. “, „2. “ …), jedes auf eigener Zeile; sonst reiner Text.",
].join("\n");

/**
 * Die vier Bestandteile, die der Gutachter vermisst hat.
 *
 * Sie stehen bewusst als LETZTES im Systemteil: was am Ende eines
 * langen Auftrags steht, wird zuverlaessiger befolgt als was in der
 * Mitte steht. Inhaltlich wiederholt die Liste nur, was oben schon
 * im Aufbau steht — die Wiederholung ist Absicht.
 */
const PRUEFLISTE_FORT = [
  "PFLICHTBESTANDTEILE NACH LEITFADEN — PRÜFE VOR DEM ANTWORTEN, DASS ALLE VIER VORHANDEN SIND:",
  "1. Ausgangslage bei Therapiebeginn als erster Absatz von Abschnitt 1.",
  "2. Bilanz zu den zuletzt vereinbarten Therapiezielen als LETZTER Absatz von Abschnitt 1, mit der Symptomveränderung im selben Absatz.",
  "3. Aussage zu den Behandlungsmethoden und -techniken im Absatz „Methodik und Setting“.",
  "4. Satz zur Planung des Therapieabschlusses im Absatz „Prognose“.",
].join("\n");

/**
 * Dasselbe für den Umwandlungsbericht.
 *
 * Der Leitfaden nennt für ihn eigene Pflichtangaben, die im
 * Fortführungsbericht nicht vorkommen — allen voran den somatischen
 * Befund samt Konsiliarbericht. Genau die fehlten in den Berichten,
 * die Rana bis 2.6.1 für einen Umwandlungsantrag erzeugt hat.
 */
const PRUEFLISTE_UMW = [
  "PFLICHTBESTANDTEILE NACH LEITFADEN — PRÜFE VOR DEM ANTWORTEN, DASS ALLE SECHS VORHANDEN SIND:",
  "1. Familienstand und Zahl der Kinder in Abschnitt 1 (der Leitfaden nennt sie ausdrücklich).",
  "2. Das Krankheitsverständnis der Patientin bzw. des Patienten in Abschnitt 2.",
  "3. Abschnitt 3 überhaupt — somatischer Befund und Konsiliarbericht. Liegen keine Angaben vor, steht dort 【BITTE ERGÄNZEN: somatischer Befund / Konsiliarbericht】, niemals nichts.",
  "4. Die Begründung von Setting, Sitzungszahl und Behandlungsfrequenz in Abschnitt 6.",
  "5. Die Bilanz zu den Zielen der Kurzzeittherapie in Abschnitt 7, jedes Ziel als erreicht, teilweise erreicht oder offen eingeordnet.",
  "6. Ein eigener Satz in Abschnitt 7, der begründet, warum die Kurzzeittherapie nicht ausreicht und was die Langzeittherapie leisten soll.",
].join("\n");

function format(n: number): string {
  const wort = n === 3 ? "drei" : "sieben";
  return "FORMAT: Verwende KEIN Markdown (kein #, kein *, keine ---). Jeder Absatz, jede Beschriftung und jedes nummerierte Ziel beginnt auf einer NEUEN ZEILE – niemals hintereinander in einer Zeile. "
    + `Trenne die ${wort} Abschnitte durch je eine Leerzeile. Gib KEINEN Kopf, KEINE Unterschrift und KEINE Hinweise oder Nachbemerkungen aus – ausschließlich die ${wort} nummerierten Abschnitte.`;
}

// ===============================================================
// Verfahrensabhängiger Teil
// ===============================================================

/**
 * Die erlaubten Absatzbeschriftungen.
 *
 * Sie sind für alle Verfahren gleich, weil sie der Gliederung des
 * Formblatts folgen und nicht der Therapieschule. Was sich je
 * Verfahren unterscheidet, ist der INHALT der Absätze — das steht
 * weiter unten in `aufbau()`.
 *
 * Die Liste ist abschliessend. Ohne diese Härte erfindet jedes Modell
 * früher oder später eigene Zwischenüberschriften, und der Bericht
 * verliert die Form, die der Gutachter erwartet.
 */
const BESCHRIFTUNGEN_FORT = [
  "„Diagnose(n): “",
  "„Psychischer Befund: “",
  "„Somatischer Befund: “",
  "„Methodik und Setting: “",
  "„Prognose: “",
] as const;

/**
 * Beim Umwandlungsbericht tragen die Gliederungspunkte selbst schon
 * die Bezeichnung, die im Fortführungsbericht als Beschriftung nötig
 * war — „Psychischer Befund“ ist dort Teil von Überschrift 2. Es
 * bleiben die wenigen, die innerhalb eines Punktes trennen.
 */
const BESCHRIFTUNGEN_UMW = [
  "„Psychischer Befund: “",
  "„Krankheitsverständnis: “",
  "„Somatischer Befund: “",
  "„Diagnose(n): “",
  "„Methodik und Setting: “",
  "„Prognose: “",
] as const;

/** Die Deutungsebene je Verfahren — in beiden Berichtstypen gebraucht. */
function deutungsebene(p: Profile): string {
  return p.verfahren.art === "vt"
    ? "verhaltensanalytische Einordnung (auslösende und aufrechterhaltende Bedingungen)"
    : p.verfahren.art === "st"
    ? "systemische Einordnung (Muster, Kontext, Funktion des Symptoms im System)"
    : "psychodynamische Einordnung (Situation, Konflikt, Struktur, Abwehr)";
}

/** Wie der Punkt 4 des Leitfadens je Verfahren heisst. */
function modellName(p: Profile): string {
  return p.verfahren.art === "vt"
    ? "funktionales Bedingungsmodell"
    : p.verfahren.art === "st"
    ? "systemisches Verständnis"
    : "Psychodynamik";
}

/**
 * Der Aufbau des Berichts zum UMWANDLUNGSANTRAG.
 *
 * Sieben Gliederungspunkte statt drei. Der Leitfaden behandelt den
 * Umwandlungsantrag zusammen mit dem Erstantrag: der Gutachter kennt
 * den Fall nicht, also muss der Bericht ihn vollständig darstellen —
 * einschliesslich somatischem Befund und Konsiliarbericht, die im
 * Fortführungsbericht gar nicht vorkommen.
 *
 * Punkt 7 trägt dann das, was den Umwandlungs- vom Erstantrag
 * unterscheidet: der bisherige Verlauf der Kurzzeittherapie und die
 * Begründung, warum sie nicht ausreicht.
 */
function aufbauUmwandlung(p: Profile): string {
  return [
    "AUFBAU DER SIEBEN ABSCHNITTE – GENAU DIESER VORLAGE FOLGEN:",
    "",
    "Grundregel: Jeder inhaltliche Gedanke bekommt einen EIGENEN ABSATZ, getrennt durch eine LEERZEILE. Ein Absatz umfasst etwa drei bis sechs Sätze. Die Abschnitte 1, 3 und 5 sind kurz und dürfen aus einem einzigen knappen Absatz bestehen.",
    "",
    "ERLAUBTE BESCHRIFTUNGEN, WÖRTLICH SO UND SONST KEINE:",
    "  " + BESCHRIFTUNGEN_UMW.join(" · "),
    "Erfinde KEINE weiteren Beschriftungen und wiederhole niemals die Überschrift des Abschnitts als Beschriftung. Es gibt insbesondere KEINE Beschriftung „Zusammenfassung“ — der Bericht hat keine.",
    "",
    "Abschnitt 1 – Relevante soziodemographische Daten:",
    "  EIN Satz, höchstens zwei: aktuell ausgeübter Beruf, Familienstand, Zahl der Kinder, dazu die Lebenssituation, soweit sie für die Behandlung bedeutsam ist.",
    "  Familienstand und Kinderzahl sind vom Leitfaden ausdrücklich verlangt. Fehlt eine der beiden Angaben, schreibe dafür 【BITTE ERGÄNZEN: Familienstand】 bzw. 【BITTE ERGÄNZEN: Zahl der Kinder】.",
    "  Keine Namen, keine Orte, keine Arbeitgeber — nur die Art der Tätigkeit.",
    "",
    "Abschnitt 2 – Symptomatik und psychischer Befund, in dieser Reihenfolge:",
    "  (a) Ein Absatz ohne Beschriftung: die geschilderte Symptomatik mit Angaben zu SCHWERE und VERLAUF, im Konjunktiv I. Dazu Auffälligkeiten bei der Kontaktaufnahme und im Erscheinungsbild.",
    "  Dieser Absatz beschreibt den HEUTIGEN Zustand. Was die Patientin zu Beginn erreichen wollte, sind ihre damaligen Therapieziele — die gehören in Abschnitt 7 und nicht hierher.",
    "  (b) „Psychischer Befund: “ – der aktuelle Befund.",
    "  (c) „Krankheitsverständnis: “ – wie die Patientin bzw. der Patient sich die Beschwerden erklärt. Der Leitfaden verlangt das ausdrücklich; liegt nichts vor, schreibe 【BITTE ERGÄNZEN: Krankheitsverständnis】.",
    "  Keine psychodiagnostischen Testverfahren erwähnen oder erfinden — es werden keine durchgeführt.",
    "",
    "Abschnitt 3 – Somatischer Befund und Konsiliarbericht:",
    "  Ein knapper Absatz ohne Beschriftung: somatische Befunde einschliesslich des Konsiliarberichts, aktuelle Medikation, Suchtmittelkonsum soweit bedeutsam, sowie frühere psychotherapeutische, psychosomatische oder psychiatrische Behandlungen.",
    "  Dieser Abschnitt darf NIEMALS leer bleiben. Liegen keine Angaben vor, schreibe 【BITTE ERGÄNZEN: somatischer Befund und Konsiliarbericht】. Der Gutachter braucht die somatische Abklärung, und ohne sie ist der Antrag unvollständig.",
    "",
    `Abschnitt 4 – Lebensgeschichte, Krankheitsanamnese und ${modellName(p)}:`,
    "  (a) Ein Absatz zur behandlungsrelevanten Lebensgeschichte und zur Krankheitsanamnese. Nur was die Störung verständlich macht — keine vollständige Biografie.",
    p.verfahren.art === "vt"
      ? "  (b) Ein Absatz zum funktionalen Bedingungsmodell: Verhaltensanalyse, prädisponierende, auslösende und aufrechterhaltende Bedingungen, dazu knapp das übergeordnete Störungsmodell."
      : p.verfahren.art === "st"
      ? "  (b) Ein Absatz zum systemischen Verständnis: Muster im System, Kontext und Funktion des Symptoms, dysfunktionale Beziehungsmuster."
      : "  (b) Ein Absatz zur Psychodynamik: auslösende Situation, intrapsychische Konfliktebene und aktualisierte Konflikte, Abwehrmechanismen, strukturelle Ebene, dysfunktionale Beziehungsmuster. Der Leitfaden nennt diese fünf einzeln; benenne die Abwehr also ausdrücklich und lasse die strukturelle Ebene nicht aus.",
    "",
    "Abschnitt 5 – Diagnose zum Zeitpunkt der Antragstellung:",
    "  (a) „Diagnose(n): “ – ICD-10-Kode und Bezeichnung, mit Angabe der Diagnosesicherheit.",
    ...(p.verfahren.art === "tp" || p.verfahren.art === "at"
      ? ["  (b) Direkt danach im selben Absatz die psychodynamische bzw. neurosenpsychologische Diagnose. Der Leitfaden verlangt sie für die tiefenpsychologisch fundierte und die analytische Psychotherapie ausdrücklich; sie fehlt sonst regelmässig."]
      : []),
    "  (c) Differenzialdiagnostische Angaben nur, wenn sie für die Entscheidung erforderlich sind.",
    "",
    "Abschnitt 6 – Behandlungsplan und Prognose, in dieser Reihenfolge:",
    "  ACHTUNG, häufigster Fehler: Abschnitt 6 blickt NACH VORN. Er sagt, was geschehen SOLL. Er sagt NICHT, was bisher erreicht wurde und warum die Kurzzeittherapie nicht reicht — das steht in Abschnitt 7 und darf hier nicht vorweggenommen werden. Sätze wie „Die Fortführung ist erforderlich, weil die erreichten Veränderungen noch nicht gefestigt sind“ gehören NICHT hierher: sie ziehen den Schluss, bevor der Gutachter die Belege gelesen hat.",
    "  (a) Ein Absatz ohne Beschriftung zum individuellen Behandlungsplan, der mit dem Satzteil „Behandlungsziele:“ endet.",
    "  (b) Direkt danach die mit der Patientin reflektierten Ziele als NUMMERIERTE Aufzählung. JEDES Ziel auf EIGENER ZEILE, beginnend mit „1. “, „2. “, „3. “. Höchstens vier Ziele, je höchstens 20 Wörter.",
    `  (c) „Methodik und Setting: “ – die geplanten Behandlungstechniken und -methoden. Der Absatz beginnt mit „Die Behandlung soll als ${p.verfahren.art === "tp" ? "tiefenpsychologisch fundierte Psychotherapie" : bezeichnung(p).toLowerCase()} im ${settingWort(p)} fortgeführt werden.“`,
    "  Danach PFLICHT: die BEGRÜNDUNG von Setting, Sitzungszahl und Behandlungsfrequenz. Der Leitfaden verlangt für den Umwandlungsantrag ausdrücklich eine Begründung, nicht bloss eine Nennung — also warum gerade dieses Setting, warum gerade diese Zahl an Sitzungen, warum diese Frequenz.",
    "  Die Zahl der Sitzungen nennst du GENAU SO, wie sie unter „JETZT BEANTRAGT“ steht. Rechne sie nicht um, addiere nichts hinzu und schreibe keine Gesamtzahl einschliesslich der Kurzzeittherapie: im Kopf des Berichts steht die beantragte Zahl, und eine zweite Zahl im Text widerspricht ihr.",
    "  Ist eine Kooperation mit anderen Berufsgruppen angegeben, folgt dazu ein kurzer Satz.",
    "  (d) „Prognose: “ – Motivation, Umstellungsfähigkeit, innere und äussere Veränderungshindernisse. Danach PFLICHT ein eigener Satz zur Planung des Therapieabschlusses.",
    "",
    "Abschnitt 7 – Zusätzlich erforderliche Angaben zum Umwandlungsantrag, in dieser Reihenfolge:",
    "  (a) Ein bis zwei Absätze zum BISHERIGEN Behandlungsverlauf seit Therapiebeginn und zur Veränderung der Symptomatik. Schreibe ERGEBNISORIENTIERT: was sich verändert hat und woran das erkennbar ist. Erzähle NICHT Sitzung für Sitzung nach.",
    `  Für die Deutung gilt: konkrete Beobachtung zuerst, dann die ${deutungsebene(p)}.`,
    "  (b) Ein Absatz mit der Bilanz zu den Zielen der KURZZEITTHERAPIE. Jedes Ziel sinngemäß benennen und als erreicht, teilweise erreicht oder noch offen einordnen, mit kurzer Begründung. Als Fließtext, NICHT als Aufzählung. Beginne mit „Von den für die Kurzzeittherapie vereinbarten Zielen …“.",
    "  (c) Ein Absatz, der die Notwendigkeit der Umwandlung begründet: warum der Umfang der Kurzzeittherapie nicht ausreicht und was die Langzeittherapie leisten soll. Dieser Absatz ist die Frage, über die der Gutachter entscheidet — ohne ihn ist der Bericht wertlos.",
    "  Schreibe NIEMALS „seit dem letzten Bericht“. Es gab keinen: die Kurzzeittherapie verlangt keinen Bericht an den Gutachter.",
  ].join("\n");
}

function aufbau(p: Profile): string {
  const art = p.verfahren.art;

  // Abschnitt 1 unterscheidet sich am deutlichsten: die Themenbereiche,
  // die ein Verlauf sinnvollerweise abbildet, hängen am Verfahren.
  const themen =
    art === "vt"
      ? "(z. B. Psychoedukation, Verhaltensanalyse und Bedingungsmodell, Expositionsübungen, kognitive Umstrukturierung, Aufbau positiver Aktivitäten, Übertrag in den Alltag)"
      : art === "st"
      ? "(z. B. Auftrags- und Zielklärung, Arbeit an Beziehungsmustern im System, Ressourcen- und Ausnahmeorientierung, Übertrag in den Alltag)"
      : "(z. B. biografische Arbeit, Vertiefung des psychodynamischen Verständnisses, Arbeit an der Übertragungsbeziehung, berufliche Situation, aktuelle Belastungen)";

  const deutungsebene =
    art === "vt"
      ? "verhaltensanalytische Einordnung (auslösende und aufrechterhaltende Bedingungen)"
      : art === "st"
      ? "systemische Einordnung (Muster, Kontext, Funktion des Symptoms im System)"
      : "psychodynamische Einordnung (Situation, Konflikt, Struktur, Abwehr)";

  return [
    "AUFBAU DER ABSCHNITTE – GENAU DIESER VORLAGE FOLGEN:",
    "",
    "Grundregel: Jeder inhaltliche Gedanke bekommt einen EIGENEN ABSATZ, getrennt durch eine LEERZEILE. Niemals mehrere Themen zu einem langen Block zusammenziehen. Ein Absatz umfasst etwa drei bis sechs Sätze.",
    "",
    "ES GIBT GENAU FÜNF ERLAUBTE BESCHRIFTUNGEN, WÖRTLICH SO UND SONST KEINE:",
    "  " + BESCHRIFTUNGEN_FORT.join(" · "),
    "Erfinde KEINE weiteren Beschriftungen. Absätze in Abschnitt 1 (außer dem letzten) beginnen OHNE Beschriftung, als normaler Fließtext. Formulierungen wie „Ausgangslage: “, „Biografische Arbeit: “, „Berufliche Situation: “ oder „Therapieziele: “ sind untersagt.",
    "Eine Beschriftung steht am ABSATZANFANG, gefolgt von Doppelpunkt und Leerzeichen. Der Text danach ist normaler Fließtext im beschriebenen Stil.",
    "Ein Satz mitten im Text darf selbstverständlich einen Doppelpunkt enthalten – das ist keine Beschriftung und wird nicht hervorgehoben.",
    "",
    "Abschnitt 1 – mehrere Absätze in dieser Reihenfolge:",
    "  (a) Ausgangslage zu Behandlungsbeginn: Zeitpunkt des Therapiebeginns, auslösende Situation, Symptomatik und Funktionsniveau, zugrunde liegender Konflikt, ggf. Medikation. Dieser Absatz ist PFLICHT und muss den Fall so umreißen, dass er auch ohne den Erstbericht verständlich ist, weil dem Gutachter der Erstbericht häufig nicht vorliegt.",
    `  (b) HÖCHSTENS ZWEI Absätze zum Verlauf ${themen}. Nicht mehr. Schreibe ERGEBNISORIENTIERT — was sich verändert hat und woran das erkennbar ist —, NICHT als Nacherzählung der Sitzungen in zeitlicher Reihenfolge. Ein Beispiel je Aussage genügt; wo mehrere dasselbe belegen, nimm eines.`,
    `  Für die Deutung gilt: konkrete Beobachtung zuerst, dann die ${deutungsebene}.`,
    "  (c) LETZTER Absatz, ohne Beschriftung und PFLICHT: die Bilanz zu den zuletzt vereinbarten Therapiezielen. Der Leitfaden verlangt das Behandlungsergebnis ausdrücklich „in Bezug auf die Erreichung bzw. Nichterreichung der Therapieziele“. Jedes zuletzt vereinbarte Ziel wird darin sinngemäß benannt und als erreicht, teilweise erreicht oder noch offen eingeordnet, mit kurzer Begründung. Als Fließtext, NICHT als Aufzählung. Beginne den Absatz mit „Von den zuletzt vereinbarten Zielen …“. Sind keine früheren Ziele geliefert, schreibe stattdessen 【BITTE ERGÄNZEN: Stand der zuletzt vereinbarten Therapieziele】.",
    "  Derselbe Absatz schliesst mit ein bis zwei Sätzen zur Veränderung der Symptomatik und des Funktionsniveaus — was sich gebessert hat und was fortbesteht. Der Leitfaden verlangt beides, die Zielbilanz UND die Symptomveränderung; sie gehören in einen Absatz.",
    "  ES GIBT KEINEN Absatz „Zusammenfassung“. Der Leitfaden kennt ihn nicht, und er wiederholte bisher nur, was in der Zielbilanz unmittelbar davor schon steht. Schreibe ihn nicht.",
    "",
    "Abschnitt 2 – je ein eigener Absatz mit Label, in dieser Reihenfolge:",
    "  „Diagnose(n): “ – ICD-10-Code und Diagnosesicherheit.",
    "  „Psychischer Befund: “ – aktueller Befund.",
    "  „Somatischer Befund: “ – nur wenn Angaben vorliegen.",
    "  Kein Abschnitt „Testverfahren“ – es werden keine psychodiagnostischen Testverfahren durchgeführt. Testergebnisse niemals erwähnen oder erfinden.",
    "",
    "Abschnitt 3 – in dieser Reihenfolge:",
    "  (a) Ein Absatz ohne Label zur Begründung der Fortführung, der mit dem Satzteil „Weitere Behandlungsziele:“ endet.",
    "  (b) Direkt danach die Ziele als NUMMERIERTE Aufzählung. JEDES Ziel steht auf einer EIGENEN ZEILE, beginnend mit „1. “, „2. “, „3. “. Höchstens vier Ziele, je höchstens 20 Wörter. Niemals mehrere Ziele in eine Zeile schreiben.",
    `  (c) Ein Absatz „Methodik und Setting: “ – Verfahren, Frequenz und Zahl der beantragten Sitzungen. Der Absatz beginnt mit der Formulierung „Die Behandlung soll als ${p.verfahren.art === "tp" ? "tiefenpsychologisch fundierte Psychotherapie" : bezeichnung(p).toLowerCase()} im ${settingWort(p)} fortgeführt werden.“ – also „soll fortgeführt werden“ und niemals „wird fortgeführt“.`,
    "  Der Leitfaden verlangt im selben Absatz, dass Methodik und Setting ERLÄUTERT werden — nicht bloss genannt. Also: mit welchen Techniken weitergearbeitet wird, und warum Verfahren, Setting und Frequenz für diesen Fall angemessen sind. Ist unter „Methodik und Setting – Erläuterung“ etwas angegeben, wird es dafür verwendet; ist nichts angegeben, wird die Begründung aus Verfahren, Setting und Frequenz gebildet und bleibt knapp.",
    "  Der Absatz endet mit „Die Behandlungsmethoden und -techniken bleiben unverändert.“, sofern nichts anderes angegeben ist.",
    "  (d) Ein Absatz „Prognose: “ – günstige Faktoren, Veränderungshindernisse. Nach den Veränderungshindernissen folgt PFLICHT ein eigener Satz zur Planung des Therapieabschlusses, weil der Leitfaden diese ausdrücklich verlangt, etwa „Der Abschluss ist nach Bearbeitung der genannten Ziele vorgesehen.“ Sind weiterführende Maßnahmen nach Therapieende angegeben, folgt dazu ein weiterer kurzer Satz. Damit endet der Bericht — OHNE bewertenden Schlusssatz.",
  ].join("\n");
}

function bezeichnung(p: Profile): string {
  switch (p.verfahren.art) {
    case "vt": return "Verhaltenstherapie";
    case "at": return "Analytische Psychotherapie";
    case "st": return "Systemische Therapie";
    default:   return "Tiefenpsychologisch fundierte Psychotherapie";
  }
}

function settingWort(p: Profile): string {
  switch (p.verfahren.setting) {
    case "gruppe":      return "Gruppensetting";
    case "kombination": return "kombinierten Einzel- und Gruppensetting";
    default:            return "Einzelsetting";
  }
}

export function verfahrenZeile(p: Profile): string {
  const v = p.verfahren;
  const set = v.setting === "gruppe" ? "Gruppentherapie"
            : v.setting === "kombination" ? "Kombinationsbehandlung" : "Einzeltherapie";
  return `${bezeichnung(p)} (${v.art.toUpperCase()}), ${set}`;
}

// ===============================================================
// Der Systemteil — zwischenspeicherbar
// ===============================================================

export function systemPrompt(p: Profile, art: Antragsart = "fortfuehrung"): string {
  const rolle =
    p.verfahren.qualifikation === "aerztlich"
      ? "eine ärztliche Psychotherapeutin"
      : p.verfahren.qualifikation === "kjp"
      ? "ein Kinder- und Jugendlichenpsychotherapeut bzw. eine Kinder- und Jugendlichenpsychotherapeutin"
      : "ein psychologischer Psychotherapeut bzw. eine psychologische Psychotherapeutin";

  const gruppe = p.verfahren.zielgruppe === "kj" ? "eines Kindes bzw. Jugendlichen" : "einer erwachsenen Person";
  const punkte = gliederung(art, p);
  const umw = art === "umwandlung";

  return [
    umw
      ? `Du bist ${rolle} und schreibst den Text für den Bericht an den Gutachter zu einem UMWANDLUNGSANTRAG — der Umwandlung einer Kurzzeit- in eine Langzeittherapie — bei einer ${bezeichnung(p)} ${gruppe} (Formblatt PTV 3).`
      : `Du bist ${rolle} und schreibst den Text für den Bericht an den Gutachter zu einem FORTFÜHRUNGSANTRAG einer ${bezeichnung(p)} ${gruppe} (Formblatt PTV 3).`,
    umw
      ? "Der Leitfaden sieht für den Umwandlungsantrag dieselbe Gliederung vor wie für den Erstantrag, ergänzt um einen siebten Punkt. Der Gutachter kennt den Fall NICHT: es gab zur Kurzzeittherapie keinen Bericht. Der Bericht muss den Fall deshalb vollständig darstellen und darf nichts als bekannt voraussetzen."
      : "Dem Gutachter liegt der bisherige Berichtsverlauf vor. Wiederhole ihn nicht, sondern schreibe ihn fort.",
    `Schreibe AUSSCHLIESSLICH die ${umw ? "sieben" : "drei"} folgenden Gliederungspunkte in deutscher Fachsprache, sachlich und relevanzorientiert.`,
    "",
    umfang(p, punkte, art),
    "",
    STIL,
    "",
    "WICHTIG: Erfinde nichts. Nutze nur die gelieferten Angaben. Fehlt eine erforderliche Pflichtangabe, schreibe an der Stelle 【BITTE ERGÄNZEN: …】.",
    "Die Person wird im Bericht NIE mit Klarnamen bezeichnet, sondern durchgehend als „die Patientin“ bzw. „der Patient“ oder über die Chiffre. Erfinde keinen Namen und übernimm keinen, falls doch einer in den Angaben steht.",
    `Gib GENAU diese ${umw ? "sieben" : "drei"} Überschriften mit exaktem Wortlaut aus, jede auf EIGENER ZEILE, beginnend mit der Nummer und einem Punkt, gefolgt vom Text im nächsten Absatz:`,
    ...punkte.map((x, i) => `${i + 1}. ${x.titel}`),
    "",
    umw ? aufbauUmwandlung(p) : aufbau(p),
    "",
    format(punkte.length),
    "",
    umw ? PRUEFLISTE_UMW : PRUEFLISTE_FORT,
  ].join("\n");
}

// ===============================================================
// Der Fallteil — jedes Mal neu
// ===============================================================

const leer = (v: string | undefined) => (v && v.trim() ? v.trim() : "(keine Angabe)");

/** ISO-Datum aus dem Formular als deutsches Datum. Leer bleibt leer. */
function deDatum(v: string | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((v ?? "").trim());
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "(keine Angabe)";
}

export function userPrompt(f: Felder, p: Profile): string {
  const art = artVon(f);
  const modell = p.verfahren.art === "vt"
    ? "Bedingungsmodell / Verhaltensanalyse: "
    : p.verfahren.art === "st"
    ? "Systemisches Verständnis: "
    : "Psychodynamik: ";

  // Beim Umwandlungsantrag gibt es keinen Vorbericht, dafür verlangt
  // der Leitfaden die Angaben, die sonst im Erstbericht stünden.
  const zeilen = art === "umwandlung" ? [
    "— Zu Punkt 1: Soziodemographische Daten —",
    "Beruf, Familienstand, Kinder, Lebenssituation: " + leer(f.f_sozio),
    "",
    "— Zu Punkt 2: Symptomatik und Befund —",
    "Geschilderte Symptomatik mit Schwere und Verlauf: " + leer(f.f_symptomatik),
    "Aktueller psychischer Befund: " + leer(f.f_befund),
    "Krankheitsverständnis der Patientin/des Patienten: " + leer(f.f_krankheitsverstaendnis),
    "",
    "— Zu Punkt 3: Somatischer Befund und Konsiliarbericht —",
    // Bis 2.7.1 waren das zwei Felder. Sie sind zusammengelegt, aber
    // was in der alten Fassung schon eingetragen wurde, geht nicht
    // verloren: es hängt hier weiterhin mit dran.
    "Somatische Befunde, Konsiliarbericht, Medikation, Suchtmittel, frühere Behandlungen: "
      + leer([f.f_somatisch, f.f_vorbehandlung].filter((x) => x?.trim()).join(" ")),
    "",
    "— Zu Punkt 4: Lebensgeschichte und " + (p.verfahren.art === "vt" ? "Bedingungsmodell" : "Psychodynamik") + " —",
    "Behandlungsrelevante Lebensgeschichte und Krankheitsanamnese: " + leer(f.f_lebensgeschichte),
    modell + leer(f.f_psychodyn),
    "",
    "— Zu Punkt 5: Diagnose —",
    "ICD-10-Diagnose(n) mit Diagnosesicherheit: " + leer(f.f_diag_neu),
    "Psychodynamische / neurosenpsychologische Diagnose: " + leer(f.f_diag_psychodyn),
    "Differenzialdiagnostische Angaben: " + leer(f.f_differenzial),
    "",
    "— Zu Punkt 6: Behandlungsplan und Prognose —",
    "Behandlungsplan und weitere Ziele: " + leer(f.f_begruendung),
    "Methodik, Setting und Kooperation – zu begründen: "
      + leer([f.f_methoden, f.f_kooperation].filter((x) => x?.trim()).join(" ")),
    "Prognose / Veränderungshindernisse: " + leer(f.f_prognose),
    "",
    "— Zu Punkt 7: Zusatzangaben zum Umwandlungsantrag —",
    "Therapiebeginn: " + deDatum(f.f_beginn),
    "Bisheriger Behandlungsverlauf seit Therapiebeginn: " + leer(f.f_verlauf),
    "Für die Kurzzeittherapie vereinbarte Ziele: " + leer(f.f_ziele_alt),
    "Stand dieser Ziele (jedes einordnen): " + leer(f.f_zielstatus),
    "Warum die Kurzzeittherapie nicht ausreicht: " + leer(f.f_umwandlungsgrund),
    "",
    "— ART DES ANTRAGS: UMWANDLUNG einer Kurzzeit- in eine Langzeittherapie —",
    "Es gab KEINEN vorigen Bericht an den Gutachter; die Kurzzeittherapie braucht keinen. Schreibe deshalb niemals „seit dem letzten Bericht“.",
    "Der Bericht folgt der SIEBENTEILIGEN Gliederung des Erst- und Umwandlungsberichts, nicht der dreiteiligen des Fortführungsberichts.",
  ] : [
    "— Vorgeschichte (aus letztem Bericht) —",
    "Bisherige Diagnose(n): " + leer(f.f_diag_alt),
    modell + leer(f.f_psychodyn),
    "Zuletzt formulierte Therapieziele: " + leer(f.f_ziele_alt),
    "",
    "— Verlauf & aktueller Stand —",
    "Therapiebeginn: " + deDatum(f.f_beginn),
    "Ausgangslage bei Therapiebeginn (zu Punkt 1, Absatz a): " + leer(f.f_ausgangslage),
    "Behandlungsverlauf seit letztem Bericht (zu Punkt 1): " + leer(f.f_verlauf),
    "Stand der zuletzt vereinbarten Therapieziele (zu Punkt 1 – jedes Ziel einordnen): " + leer(f.f_zielstatus),
    "Aktueller psychischer Befund (zu Punkt 2): " + leer(f.f_befund),
    "Aktuelle ICD-10-Diagnose(n) (zu Punkt 2): " + leer(f.f_diag_neu),
    "Begründung Fortführung / weitere Planung / geänderte Ziele und Methoden (zu Punkt 3): " + leer(f.f_begruendung),
    "Prognose / Veränderungshindernisse (zu Punkt 3): " + leer(f.f_prognose),

    // Das Feld hiess bis 2.5.4 „Geänderte Behandlungsmethoden“ und
    // fragte nach einer Änderung. Das geht am Leitfaden vorbei: er
    // verlangt keine Änderungsmeldung, sondern eine Erläuterung von
    // Methodik und Setting — womit behandelt wird und warum Verfahren,
    // Frequenz und Rahmen für diesen Fall die richtigen sind. Die
    // Methode bleibt in aller Regel dieselbe; erklärt werden muss sie
    // trotzdem.
    "Methodik und Setting – Erläuterung (zu Punkt 3): " +
      (f.f_methoden && f.f_methoden.trim()
        ? f.f_methoden.trim()
        : "(keine Angabe – die Erläuterung deshalb aus Verfahren, Setting und Frequenz bilden und den Absatz mit dem Satz „Die Behandlungsmethoden und -techniken bleiben unverändert.“ abschliessen, NICHT mit 【BITTE ERGÄNZEN】)"),
    "Planung des Therapieabschlusses / weiterführende Maßnahmen (zu Punkt 3): " +
      (f.f_abschluss && f.f_abschluss.trim()
        ? f.f_abschluss.trim()
        : "(keine Angabe – im Absatz „Prognose“ deshalb den Standardsatz „Der Abschluss ist nach Bearbeitung der genannten Ziele vorgesehen.“ verwenden, NICHT 【BITTE ERGÄNZEN】)"),
    "",
    "— Rahmendaten für „Methodik und Setting“ (liegen vor, NICHT als fehlend markieren) —",
    "Verfahren: " + verfahrenZeile(p),
    "Kostenträger: " + leer(f.f_kasse),
    "Bisher bewilligt: " + leer(f.f_bewilligt) + " Stunden",
    "Davon durchgeführt: " + leer(f.f_verbraucht) + " Stunden",
    "JETZT BEANTRAGT: " + leer(f.f_beantragt) + " weitere Sitzungen",
  ];

  // Die Frequenz nur dann als bekannt ausweisen, wenn sie wirklich
  // hinterlegt ist — sonst soll Claude sie als Lücke markieren.
  zeilen.push(
    f.f_frequenz && f.f_frequenz.trim()
      ? `FREQUENZ: ${f.f_frequenz.trim()}\nDiese Frequenz im Absatz „Methodik und Setting“ ausdrücklich nennen. Sie ist bekannt – niemals 【BITTE ERGÄNZEN】 dafür schreiben.`
      : "FREQUENZ: (keine Angabe) – hierfür an der betreffenden Stelle 【BITTE ERGÄNZEN: Frequenz】 schreiben."
  );
  zeilen.push(
    "Diese Zahl der beantragten Sitzungen im Absatz „Methodik und Setting“ ausdrücklich nennen. Sie ist bekannt – niemals 【BITTE ERGÄNZEN】 dafür schreiben."
  );

  const L = p.layout;
  zeilen.push(
    "",
    `ZUM SCHLUSS NOCHMALS DER UMFANG: rund ${L.ziel_soll.toLocaleString("de-DE")} Zeichen, mindestens ${L.ziel_min.toLocaleString("de-DE")}, HÖCHSTENS ${L.ziel_max.toLocaleString("de-DE")}. Das entspricht zwei Seiten und ist die Vorgabe des Leitfadens. Zähle nach, bevor du antwortest, und kürze selbst, wenn du darüber liegst.`
  );

  return zeilen.join("\n");
}

// ===============================================================
// Nachfassen, wenn der Entwurf zu knapp geraten ist
// ===============================================================

export function expandPrompt(entwurf: string, p: Profile): string {
  const L = p.layout;
  const ist = entwurf.replace(/【\s*([^】]*?)\s*】/g, "$1").trim().length;
  return [
    `Der folgende Entwurf ist mit ${ist.toLocaleString("de-DE")} Zeichen zu kurz. Der Zielkorridor liegt bei ${L.ziel_min.toLocaleString("de-DE")} bis ${L.ziel_max.toLocaleString("de-DE")} Zeichen.`,
    "Führe ihn aus, ohne neue Sachverhalte zu erfinden: Beobachtungen im Setting konkreter beschreiben, Beispiele aus dem geschilderten Verlauf ausformulieren, den Bezug zu den Therapiezielen deutlicher machen.",
    "Wo die gelieferten Angaben nichts hergeben, lasse die Stelle wie sie ist. Erfinde nichts hinzu.",
    "Behalte Gliederung, Überschriften, Beschriftungen und Stil exakt bei. Gib den vollständigen überarbeiteten Text aus, nichts sonst.",
    "",
    "— ENTWURF —",
    entwurf,
  ].join("\n");
}

// ===============================================================
// Kürzen, wenn der Entwurf über zwei Seiten hinausgeht
// ===============================================================

/**
 * Bringt einen zu langen Entwurf auf den Korridor zurück.
 *
 * Das Gegenstück zu `expandPrompt`, und das wichtigere von beiden:
 * gemessen an den Verbrauchsdaten schreibt das Modell regelmässig
 * das Doppelte des Zielumfangs. Ein Bericht über zwei Seiten wird vom
 * Gutachter nicht besser gelesen, sondern schlechter.
 *
 * Der Kern dieser Anweisung ist nicht das Kürzen, sondern was dabei
 * **nicht** verlorengehen darf. Der Leitfaden verlangt vier Angaben
 * ausdrücklich; ein Bericht, dem beim Kürzen die Zielbilanz oder die
 * Abschlussplanung abhandenkommt, ist kürzer und zugleich unbrauchbar.
 * Deshalb stehen die vier hier noch einmal, als Bedingung und nicht
 * als Erinnerung.
 */
export function kuerzePrompt(entwurf: string, p: Profile, art: Antragsart = "fortfuehrung"): string {
  const L = p.layout;
  const ist = entwurf.replace(/【\s*([^】]*?)\s*】/g, "$1").trim().length;
  const weg = ist - L.ziel_soll;

  return [
    `Der folgende Entwurf ist mit ${ist.toLocaleString("de-DE")} Zeichen zu lang.`,
    `Der Zielkorridor liegt bei ${L.ziel_min.toLocaleString("de-DE")} bis ${L.ziel_max.toLocaleString("de-DE")} Zeichen; angestrebt sind ${L.ziel_soll.toLocaleString("de-DE")}.`,
    `Es müssen also rund ${Math.max(0, weg).toLocaleString("de-DE")} Zeichen weichen.`,
    "",
    "WAS NICHT WEICHEN DARF — das verlangt der Leitfaden ausdrücklich:",
    ...(art === "umwandlung" ? [
      "1. Familienstand und Zahl der Kinder in Abschnitt 1.",
      "2. Das Krankheitsverständnis in Abschnitt 2.",
      "3. Abschnitt 3 — somatischer Befund und Konsiliarbericht. Er darf niemals ganz wegfallen.",
      "4. Abwehr und strukturelle Ebene in Abschnitt 4, soweit sie dort stehen.",
      "5. Die Begründung von Setting, Sitzungszahl und Frequenz in Abschnitt 6.",
      "6. Der Satz zur Planung des Therapieabschlusses in Abschnitt 6.",
      "7. Die Zielbilanz und die Begründung der Umwandlung in Abschnitt 7, beide vollständig.",
    ] : [
      "1. Die Ausgangslage bei Therapiebeginn als erster Absatz von Abschnitt 1. Sie muss den Fall auch ohne den Erstbericht verständlich machen.",
      "2. Die Bilanz zu den zuletzt vereinbarten Therapiezielen als letzter Absatz von Abschnitt 1, mit der Aussage, was erreicht und was nicht erreicht wurde, und mit der Symptomveränderung.",
      "3. Die Aussage zu den Behandlungsmethoden und -techniken im Absatz Methodik und Setting, einschliesslich Verfahren, Frequenz und Zahl der beantragten Sitzungen.",
      "4. Der Satz zur Planung des Therapieabschlusses im Absatz Prognose.",
    ]),
    "",
    "Ebenfalls unverändert bleiben: Gliederung, alle Überschriften, alle Beschriftungen, die Diagnosen mit ICD-10-Kodierung und die nummerierten Behandlungsziele. Kein Gliederungspunkt darf verschwinden.",
    "",
    "WORAN GEKÜRZT WIRD, in dieser Reihenfolge:",
    "  (a) Wiederholungen zwischen den Abschnitten — dieselbe Aussage steht oft zweimal.",
    "  (b) Sitzungsweise Nacherzählung: aus „Zunächst wurde besprochen … Im weiteren Verlauf schilderte …“ wird die Aussage, was sich dabei verändert hat.",
    "  (c) Ausschmückende Nebensätze und Wendungen ohne Fallbezug.",
    "  (d) Beispiele, wo mehrere dasselbe belegen: eines genügt.",
    "  (e) Erst zuletzt einzelne klinische Beobachtungen, und dann die am wenigsten entscheidungsrelevanten.",
    "",
    "Streiche niemals eine Angabe, die für die Beurteilung gebraucht wird, nur um die Zahl zu erreichen. Bleibt der Text danach über dem Korridor, ist das hinzunehmen — ein unvollständiger Bericht ist schlechter als ein langer.",
    "Gib den vollständigen gekürzten Text aus, nichts sonst. Keine Vorbemerkung, keine Erläuterung, was du gekürzt hast.",
    "",
    "— ENTWURF —",
    entwurf,
  ].join("\n");
}

// ===============================================================
// Klarnamen, die nicht hinausgehen dürfen
// ===============================================================

/**
 * Sammelt alles, was als Klarname gilt. Die Rust-Seite prüft damit
 * die Anfrage, bevor sie das Gerät verlässt.
 *
 * Bewusst grosszügig: lieber ein Fehlalarm zu viel als ein Name im Netz.
 */
export function klarnamen(f: Felder): string[] {
  const out: string[] = [];
  const name = (f.f_name || "").trim();
  if (name) out.push(name);
  return out;
}
