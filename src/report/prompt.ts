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

// ===============================================================
// Gemeinsame Regeln
// ===============================================================

function umfang(p: Profile): string {
  const L = p.layout;
  return [
    "UMFANG – ZIELKORRIDOR, WICHTIGSTE VORGABE:",
    "Der Leitfaden schreibt vor, dass der Bericht in der Regel zwei Seiten umfasst. Diese zwei Seiten sollen GUT GEFÜLLT sein.",
    `Ziele bewusst an das OBERE Ende: rund ${L.ziel_soll.toLocaleString("de-DE")} Zeichen, mindestens ${L.ziel_min.toLocaleString("de-DE")} und höchstens ${L.ziel_max.toLocaleString("de-DE")}. In Wörtern sind das etwa ${Math.round(L.ziel_min / 7.8)} bis ${Math.round(L.ziel_max / 7.8)}.`,
    "Eine halb leere zweite Seite ist der schlechtere Fehler als ein knapper Überhang. Ziele deshalb lieber etwas zu hoch als zu niedrig.",
    "Verteilung, gemessen an Berichten, die zwei Seiten füllen:",
    "  Abschnitt 1: rund 2.750 Zeichen (etwa 350 Wörter) in SIEBEN Absätzen: Ausgangslage, drei bis vier Verlaufsabsätze, die Zielbilanz, zuletzt der Bilanzabsatz.",
    "  Abschnitt 2: rund 750 Zeichen (etwa 95 Wörter), verteilt auf die zwei bis drei Beschriftungen.",
    "  Abschnitt 3: rund 1.450 Zeichen (etwa 185 Wörter): Begründung, drei bis vier Behandlungsziele, Methodik und Setting, Prognose mit geplantem Abschluss.",
    `Zähle beim Schreiben mit. Liegst du unter ${L.ziel_min.toLocaleString("de-DE")} Zeichen, führe die klinisch bedeutsamen Punkte KONKRETER aus: beobachtetes Verhalten im Setting, Beispiele aus dem Verlauf, fachliche Einordnung, Bezug zu den Therapiezielen.`,
    "ABER: Strecke den Text niemals ohne Grundlage. Reichen die gelieferten Angaben nicht aus, um den Zielumfang mit entscheidungsrelevantem Inhalt zu füllen, schreibe lieber kürzer. Keine Füllsätze, keine Wiederholungen zwischen den Abschnitten, keine allgemeinen Wendungen ohne Fallbezug.",
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
  "– Keine KI-typischen Wendungen wie „darüber hinaus“, „des Weiteren“, „insbesondere“, „es ist wichtig zu“, „es gilt“, „daher“, „folglich“, „dementsprechend“, „ganzheitlich“, „zielgerichtet“, „tiefgreifend“, „essenziell“. Das Label „Zusammenfassung: “ ist ausdrücklich erwünscht; das Wort „zusammenfassend“ soll dagegen nicht im Fließtext stehen.",
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
const PRUEFLISTE = [
  "PFLICHTBESTANDTEILE NACH LEITFADEN — PRÜFE VOR DEM ANTWORTEN, DASS ALLE VIER VORHANDEN SIND:",
  "1. Ausgangslage bei Therapiebeginn als erster Absatz von Abschnitt 1.",
  "2. Bilanz zu den zuletzt vereinbarten Therapiezielen als vorletzter Absatz von Abschnitt 1.",
  "3. Aussage zu den Behandlungsmethoden und -techniken im Absatz „Methodik und Setting“.",
  "4. Satz zur Planung des Therapieabschlusses im Absatz „Prognose“.",
].join("\n");

const FORMAT = [
  "FORMAT: Verwende KEIN Markdown (kein #, kein *, keine ---). Jeder Absatz, jede Beschriftung und jedes nummerierte Ziel beginnt auf einer NEUEN ZEILE – niemals hintereinander in einer Zeile. Trenne die drei Abschnitte durch je eine Leerzeile. Gib KEINEN Kopf, KEINE Unterschrift und KEINE Hinweise oder Nachbemerkungen aus – ausschließlich die drei nummerierten Abschnitte.",
].join("\n");

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
const BESCHRIFTUNGEN = [
  "„Zusammenfassung: “",
  "„Diagnose(n): “",
  "„Psychischer Befund: “",
  "„Somatischer Befund: “",
  "„Methodik und Setting: “",
  "„Prognose: “",
] as const;

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
    "ES GIBT GENAU SECHS ERLAUBTE BESCHRIFTUNGEN, WÖRTLICH SO UND SONST KEINE:",
    "  " + BESCHRIFTUNGEN.join(" · "),
    "Erfinde KEINE weiteren Beschriftungen. Absätze in Abschnitt 1 (außer dem letzten) beginnen OHNE Beschriftung, als normaler Fließtext. Formulierungen wie „Ausgangslage: “, „Biografische Arbeit: “, „Berufliche Situation: “ oder „Therapieziele: “ sind untersagt.",
    "Eine Beschriftung steht am ABSATZANFANG, gefolgt von Doppelpunkt und Leerzeichen. Der Text danach ist normaler Fließtext im beschriebenen Stil.",
    "Ein Satz mitten im Text darf selbstverständlich einen Doppelpunkt enthalten – das ist keine Beschriftung und wird nicht hervorgehoben.",
    "",
    "Abschnitt 1 – mehrere Absätze in dieser Reihenfolge:",
    "  (a) Ausgangslage zu Behandlungsbeginn: Zeitpunkt des Therapiebeginns, auslösende Situation, Symptomatik und Funktionsniveau, zugrunde liegender Konflikt, ggf. Medikation. Dieser Absatz ist PFLICHT und muss den Fall so umreißen, dass er auch ohne den Erstbericht verständlich ist, weil dem Gutachter der Erstbericht häufig nicht vorliegt.",
    `  (b) Danach je ein eigener Absatz pro bearbeitetem Themenbereich, möglichst in zeitlicher Reihenfolge ${themen}.`,
    `  Für die Deutung gilt: konkrete Beobachtung zuerst, dann die ${deutungsebene}.`,
    "  (c) VORLETZTER Absatz, ohne Beschriftung und PFLICHT: die Bilanz zu den zuletzt vereinbarten Therapiezielen. Der Leitfaden verlangt das Behandlungsergebnis ausdrücklich „in Bezug auf die Erreichung bzw. Nichterreichung der Therapieziele“. Jedes zuletzt vereinbarte Ziel wird darin sinngemäß benannt und als erreicht, teilweise erreicht oder noch offen eingeordnet, mit kurzer Begründung. Als Fließtext, NICHT als Aufzählung. Beginne den Absatz mit „Von den zuletzt vereinbarten Zielen …“. Sind keine früheren Ziele geliefert, schreibe stattdessen 【BITTE ERGÄNZEN: Stand der zuletzt vereinbarten Therapieziele】.",
    "  (d) Als LETZTER Absatz eine Bilanz mit dem Label „Zusammenfassung: “ – darin knapp, was sich bei Symptomatik und Funktionsniveau gebessert hat und was offen bleibt. WICHTIG: Nach dem Doppelpunkt beginnt ein vollständiger, eigenständiger Satz, der ohne das Label lesbar ist – also „Zusammenfassung: Es zeigt sich eine deutliche Besserung …“ und NICHT „Zusammenfassend zeigt sich …“. Das gilt für alle Beschriftungen.",
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
    "  Der Leitfaden verlangt im selben Absatz eine Aussage zu geänderten Behandlungsmethoden und -techniken: Ist dazu etwas angegeben, wird es in einem Satz genannt. Ist nichts angegeben, endet der Absatz mit „Die Behandlungsmethoden und -techniken bleiben unverändert.“",
    "  (d) Ein Absatz „Prognose: “ – günstige Faktoren, Veränderungshindernisse. Nach den Veränderungshindernissen folgt PFLICHT ein eigener Satz zur Planung des Therapieabschlusses, weil der Leitfaden diese ausdrücklich verlangt, etwa „Der Abschluss ist nach Bearbeitung der genannten Ziele vorgesehen.“ Sind weiterführende Maßnahmen nach Therapieende angegeben, folgt dazu ein weiterer kurzer Satz. Erst danach endet der Absatz mit dem festen Schlusssatz: „Die geplante Behandlung ist damit ausreichend begründet und erfolgversprechend.“",
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

export function systemPrompt(p: Profile): string {
  const rolle =
    p.verfahren.qualifikation === "aerztlich"
      ? "eine ärztliche Psychotherapeutin"
      : p.verfahren.qualifikation === "kjp"
      ? "ein Kinder- und Jugendlichenpsychotherapeut bzw. eine Kinder- und Jugendlichenpsychotherapeutin"
      : "ein psychologischer Psychotherapeut bzw. eine psychologische Psychotherapeutin";

  const gruppe = p.verfahren.zielgruppe === "kj" ? "eines Kindes bzw. Jugendlichen" : "einer erwachsenen Person";

  return [
    `Du bist ${rolle} und schreibst den Text für den Bericht an den Gutachter zu einem FORTFÜHRUNGSANTRAG einer ${bezeichnung(p)} ${gruppe} (Formblatt PTV 3).`,
    "Schreibe AUSSCHLIESSLICH die drei folgenden Gliederungspunkte in deutscher Fachsprache, sachlich und relevanzorientiert.",
    "",
    umfang(p),
    "",
    STIL,
    "",
    "WICHTIG: Erfinde nichts. Nutze nur die gelieferten Angaben. Fehlt eine erforderliche Pflichtangabe, schreibe an der Stelle 【BITTE ERGÄNZEN: …】.",
    "Die Person wird im Bericht NIE mit Klarnamen bezeichnet, sondern durchgehend als „die Patientin“ bzw. „der Patient“ oder über die Chiffre. Erfinde keinen Namen und übernimm keinen, falls doch einer in den Angaben steht.",
    "Gib GENAU diese drei Überschriften mit exaktem Wortlaut aus, jede auf EIGENER ZEILE, beginnend mit „1.“, „2.“ bzw. „3.“, gefolgt vom Text im nächsten Absatz:",
    "1. Behandlungsverlauf seit dem letzten Bericht und Erreichung der Therapieziele",
    "2. Aktuelle Diagnosen gemäß ICD-10 und aktueller psychischer Befund",
    "3. Begründung der Fortführung, weitere Therapieplanung und Prognose",
    "",
    aufbau(p),
    "",
    FORMAT,
    "",
    PRUEFLISTE,
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
  const zeilen = [
    "— Vorgeschichte (aus letztem Bericht) —",
    "Bisherige Diagnose(n): " + leer(f.f_diag_alt),
    (p.verfahren.art === "vt"
      ? "Bedingungsmodell / Verhaltensanalyse: "
      : p.verfahren.art === "st"
      ? "Systemisches Verständnis: "
      : "Psychodynamik: ") + leer(f.f_psychodyn),
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
    "Geänderte Behandlungsmethoden und -techniken (zu Punkt 3): " +
      (f.f_methoden && f.f_methoden.trim()
        ? f.f_methoden.trim()
        : "(keine Angabe – den Absatz „Methodik und Setting“ deshalb mit dem Satz „Die Behandlungsmethoden und -techniken bleiben unverändert.“ abschliessen, NICHT mit 【BITTE ERGÄNZEN】)"),
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
    `ZUM SCHLUSS NOCHMALS DER UMFANG: rund ${L.ziel_soll.toLocaleString("de-DE")} Zeichen, mindestens ${L.ziel_min.toLocaleString("de-DE")}, höchstens ${L.ziel_max.toLocaleString("de-DE")}. Abschnitt 1 hat sieben Absätze. Ziele an das obere Ende, damit die zweite Seite gefüllt ist, aber strecke nichts ohne Grundlage. Zähle nach, bevor du antwortest.`
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
