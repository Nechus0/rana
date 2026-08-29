/**
 * Was der Leitfaden an welcher Stelle verlangt.
 *
 * Quelle: „Leitfaden zum Erstellen des Berichts an die Gutachterin oder
 * den Gutachter" der KBV zum Formblatt PTV 3 (Muster 4.2017), Abschnitt
 * „Fortführungsantrag".
 *
 * Der Anlass für diese Datei war eine Rüge: ein Gutachter schrieb, ihm
 * fehle die Grundlage für die Beurteilung. Der Abgleich ergab, dass die
 * Angaben teils vorhanden, aber unvollständig waren — nicht aus
 * Nachlässigkeit, sondern weil an keiner Stelle stand, was genau
 * erwartet wird. Ein Feld namens „Behandlungsverlauf" beantwortet die
 * Frage nicht, was in einen Behandlungsverlauf gehört.
 *
 * Jeder Eintrag hat deshalb drei Teile:
 *   `verlangt`  — was der Leitfaden fordert, in einem Satz
 *   `punkte`    — woraus sich das zusammensetzt
 *   `warum`     — weshalb der Gutachter es braucht; das ist der Teil,
 *                 der beim Schreiben am meisten hilft
 *
 * Bewusst keine Zitate aus dem Leitfaden, sondern seine Anforderungen
 * in eigenen Worten: der Text ist urheberrechtlich geschützt, und eine
 * Handreichung, die man beim Tippen liest, muss ohnehin kürzer sein als
 * ihre Quelle.
 */

export interface Leitfadenhinweis {
  verlangt: string;
  punkte: string[];
  warum?: string;
  /**
   * Was zusätzlich gilt, wenn es kein Fortführungs-, sondern ein
   * Umwandlungsantrag ist (Kurzzeit- in Langzeittherapie).
   *
   * Der Leitfaden kennt zwei Berichte mit unterschiedlicher
   * Gliederung. Der Bericht zum **Fortführungsantrag** hat drei
   * Punkte und setzt einen vorigen Bericht voraus. Der Bericht zum
   * **Erst- oder Umwandlungsantrag** hat sieben und beschreibt den
   * Fall von Grund auf: soziodemographische Daten, Symptomatik und
   * Befund, somatischer Befund, Lebensgeschichte und Psychodynamik
   * beziehungsweise Bedingungsmodell, Diagnose, Behandlungsplan und
   * Prognose — und als Punkt 7 zusätzlich den bisherigen Verlauf und
   * die Begründung, warum umgewandelt werden soll.
   *
   * Rana schreibt bislang nur den Fortführungsbericht. Wer damit
   * einen Umwandlungsantrag begründet, liefert die falsche
   * Gliederung. Bis das zweite Muster gebaut ist, steht der
   * Unterschied wenigstens hier.
   */
  umwandlung?: string;
}

export const LEITFADEN: Record<string, Leitfadenhinweis> = {

  // ---- Schritt 1 · Stammdaten --------------------------------

  f_antragsart: {
    verlangt: "Welche Art Antrag dieser Bericht begründet.",
    punkte: [
      "Fortführungsantrag: die Langzeittherapie läuft, es gab schon einen Bericht.",
      "Umwandlungsantrag: aus einer Kurzzeittherapie soll eine Langzeittherapie werden. Dafür gab es noch keinen Bericht.",
      "Die Wahl ändert die Beschriftungen der Felder und das, was Rana an Claude weitergibt.",
    ],
    warum: "Der Leitfaden kennt für beide verschiedene Anforderungen. Beim Umwandlungsantrag verlangt er zusätzlich eine Begründung, warum die Kurzzeittherapie nicht ausreicht — und die Begründung von Setting, Sitzungszahl und Frequenz.",
  },

  f_chiffre: {
    verlangt: "Eine Kennung, unter der die Patientin im Bericht durchgängig erscheint.",
    punkte: [
      "Der Bericht geht pseudonymisiert an den Gutachter.",
      "Klarnamen dürfen darin nicht vorkommen — auch nicht in Nebensätzen.",
      "Üblich sind Initialen mit Geburtsjahr, etwa „A.M.-1974“.",
    ],
    warum: "Der Gutachter entscheidet ohne Kenntnis der Person. Die Chiffre hält die Fälle auseinander, ohne sie zu benennen.",
  },

  f_bewilligt: {
    verlangt: "Das bisher bewilligte Stundenkontingent.",
    punkte: [
      "Die Summe aller bisher bewilligten Stunden, nicht nur der letzten Bewilligung.",
      "Bei der ersten Fortführung also das Kontingent aus dem Erstantrag.",
    ],
    warum: "Der Gutachter prüft, wo der Fall im Gesamtkontingent des Verfahrens steht.",
  },

  f_verbraucht: {
    verlangt: "Die tatsächlich durchgeführten Stunden zum Zeitpunkt des Antrags.",
    punkte: [
      "Gezählt werden erbrachte Sitzungen, nicht geplante.",
      "Weicht die Zahl stark vom bewilligten Kontingent ab, gehört der Grund in den Verlauf.",
    ],
    warum: "Aus dem Verhältnis von bewilligt zu verbraucht liest der Gutachter die tatsächliche Behandlungsdichte ab.",
  },

  f_beantragt: {
    verlangt: "Die Zahl der jetzt zusätzlich beantragten Stunden.",
    punkte: [
      "Nur die neuen Stunden, nicht die Gesamtsumme.",
      "Die Zahl muss zur Planung in Abschnitt 3 passen: was in diesen Stunden erreicht werden soll.",
    ],
  },

  f_frequenz: {
    verlangt: "Die vereinbarte Sitzungsfrequenz.",
    punkte: [
      "Etwa „wöchentlich“, „vierzehntägig“, „wöchentlich, in Krisen häufiger“.",
      "Sie erscheint im Bericht im Absatz „Methodik und Setting“.",
    ],
    warum: "Frequenz, Setting und beantragte Stundenzahl müssen zueinander passen; der Gutachter rechnet das nach.",
  },

  f_sozio: {
    verlangt: "Eine knappe soziodemographische Einordnung — pseudonymisiert.",
    punkte: [
      "Alter, Lebenssituation, berufliche Situation, soweit für die Behandlung bedeutsam.",
      "Eine Zeile genügt.",
      "Keine Namen, keine Orte, keine Arbeitgeber.",
    ],
    warum: "Der Gutachter braucht ein Bild der Lebenswirklichkeit, in der die Störung besteht — nicht die Identität.",
  },

  // ---- Schritt 2 · Vorbericht --------------------------------

  f_vorbericht: {
    verlangt: "Ob es zu dieser Behandlung schon einmal einen Bericht an den Gutachter gab.",
    punkte: [
      "Beim Fortführungsantrag gibt es ihn — und Rana knüpft daran an, statt Bekanntes zu wiederholen.",
      "Beim Umwandlungsantrag gibt es ihn nicht: die Kurzzeittherapie verlangte keinen.",
      "Ohne Vorbericht muss der Bericht den Fall aus sich heraus verständlich machen.",
    ],
    umwandlung: "Bei der Umwandlung Kurzzeit → Langzeit bleibt das Feld leer. Das ist kein Versäumnis, sondern der Normalfall.",
  },

  f_lastreport: {
    verlangt: "Den Wortlaut des letzten Berichts, damit der neue daran anschliesst.",
    punkte: [
      "Rana liest daraus, was dem Gutachter bereits bekannt ist.",
      "Der neue Bericht wiederholt es dann nicht, sondern schreibt den Verlauf fort.",
      "Der Text bleibt auf dem Gerät verschlüsselt; an Anthropic geht er nur pseudonymisiert.",
    ],
    warum: "Der Leitfaden will keinen zweiten Erstbericht, sondern die Entwicklung seit dem letzten Mal.",
    umwandlung: "Entfällt beim Umwandlungsantrag — es gibt keinen vorigen Bericht.",
  },

  f_diag_alt: {
    verlangt: "Die Diagnose(n), unter denen die Behandlung bisher lief, mit ICD-10-Kode.",
    punkte: [
      "Mit Kode und Bezeichnung, nicht nur der Kode.",
      "Sie dient dem Vergleich: Rana kann so benennen, was sich seither geändert hat.",
      "Bleibt die Diagnose gleich, ist auch das eine Aussage.",
    ],
    umwandlung: "Hier stehen die Diagnosen der Kurzzeittherapie.",
  },

  f_nr: {
    verlangt: "Die laufende Nummer dieses Antrags in dieser Behandlung.",
    punkte: [
      "Der erste Fortführungsantrag ist die 1, der nächste die 2.",
      "Sie erscheint im Kopf des Berichts und ordnet ihn dem Verlauf zu.",
    ],
    umwandlung: "Beim Umwandlungsantrag ist es die Nummer des Antrags, nicht die eines Fortführungsantrags.",
  },

  // ---- Nur beim Umwandlungsantrag ---------------------------
  // Der Leitfaden verlangt für ihn die sieben Punkte des
  // Erstberichts. Diese Felder tragen die vier, die Rana bis 2.6.1
  // gar nicht abgefragt hat.

  f_symptomatik: {
    verlangt: "Die geschilderte Symptomatik — mit Angaben zu Schwere und Verlauf.",
    punkte: [
      "Was die Patientin selbst berichtet, nicht Ihre Einordnung.",
      "Schwere und Verlauf sind ausdrücklich verlangt: seit wann, wie stark, gleichbleibend oder schwankend.",
      "Dazu Auffälligkeiten bei der Kontaktaufnahme und im Erscheinungsbild.",
    ],
    warum: "Der Gutachter muss das Krankheitsbild aus dem Bericht heraus verstehen. Beim Umwandlungsantrag hat er keinen Erstbericht, auf den er zurückgreifen könnte.",
  },

  f_krankheitsverstaendnis: {
    verlangt: "Wie die Patientin sich ihre Beschwerden selbst erklärt.",
    punkte: [
      "Ihre eigene Deutung, auch wenn sie fachlich nicht trägt.",
      "Ob sie einen Zusammenhang zwischen Belastung und Symptomen sieht.",
      "Was sie sich von der Behandlung verspricht.",
    ],
    warum: "Der Leitfaden nennt es als eigenen Unterpunkt. Es sagt dem Gutachter etwas über die Behandelbarkeit, das aus dem Befund allein nicht hervorgeht.",
  },

  f_somatisch: {
    verlangt: "Den somatischen Befund und den Konsiliarbericht.",
    punkte: [
      "Was der Konsiliarbericht ergeben hat — auch wenn er unauffällig war.",
      "Aktuelle Medikation, psychopharmakologisch und sonstige.",
      "Suchtmittelkonsum, soweit für die Behandlung bedeutsam.",
    ],
    warum: "Dieser Punkt ist der häufigste Grund für Rückfragen. Der Gutachter muss sehen, dass eine körperliche Ursache abgeklärt ist — bei somatoformen Beschwerden ist das die eigentliche Frage.",
  },

  f_vorbehandlung: {
    verlangt: "Frühere psychotherapeutische, psychosomatische oder psychiatrische Behandlungen.",
    punkte: [
      "Art, Zeitraum und Ergebnis, in einem Satz je Behandlung.",
      "Auch stationäre Aufenthalte.",
      "Gab es keine, genügt „keine Vorbehandlungen“ — das ist ebenfalls eine Auskunft.",
    ],
  },

  f_lebensgeschichte: {
    verlangt: "Die behandlungsrelevanten Angaben zur Lebensgeschichte und zur Krankheitsanamnese.",
    punkte: [
      "Nur was die Störung verständlich macht — keine vollständige Biografie.",
      "Herkunftsfamilie, prägende Beziehungserfahrungen, Brüche.",
      "Wann die Beschwerden erstmals auftraten und wie sie sich entwickelt haben.",
    ],
    warum: "Der Leitfaden verlangt sie ausdrücklich „behandlungsrelevant“. Alles, was die Behandlung nicht erklärt, gehört nicht hinein und kostet nur Platz.",
  },

  f_diag_psychodyn: {
    verlangt: "Die psychodynamische bzw. neurosenpsychologische Diagnose.",
    punkte: [
      "Der Leitfaden verlangt sie für TP und AP zusätzlich zur ICD-10-Diagnose.",
      "Etwa: Konflikt, Strukturniveau, vorherrschender Abwehrmodus.",
      "Bei Verhaltenstherapie und systemischer Therapie entfällt sie.",
    ],
    warum: "Sie fehlt in fast jedem Bericht — und sie ist der Punkt, an dem der Gutachter erkennt, ob das Verfahren zum Fall passt.",
  },

  f_differenzial: {
    verlangt: "Differenzialdiagnostische Angaben, falls erforderlich.",
    punkte: [
      "Nur wenn eine Abgrenzung für die Entscheidung wirklich nötig ist.",
      "Etwa Dysthymia gegen rezidivierende depressive Störung.",
      "Sonst bleibt das Feld leer.",
    ],
  },

  f_kooperation: {
    verlangt: "Die Kooperation mit anderen Berufsgruppen.",
    punkte: [
      "Hausärztin, Fachärztin, Klinik, Sozialdienst.",
      "Ein Satz genügt.",
      "Gibt es keine, bleibt das Feld leer.",
    ],
  },

  f_umwandlungsgrund: {
    verlangt: "Warum die Kurzzeittherapie nicht ausreicht und was die Langzeittherapie leisten soll.",
    punkte: [
      "Was der Umfang der Kurzzeittherapie ermöglicht hat — und wo er endet.",
      "Was nur über einen längeren Zeitraum bearbeitet werden kann.",
      "Konkret am Fall, nicht allgemein über Kurzzeittherapien.",
    ],
    warum: "Dies ist die Frage, über die der Gutachter entscheidet. Der Leitfaden nennt sie als eigenen Unterpunkt des Umwandlungsantrags. Ohne sie ist der Bericht wertlos, gleich wie gut der Rest ist.",
  },

  f_psychodyn: {
    verlangt: "Die tragende Dynamik des Falls.",
    punkte: [
      "Bei tiefenpsychologischem Vorgehen: Situation, Konflikt, Struktur, Abwehr.",
      "Bei Verhaltenstherapie: Bedingungsmodell und Verhaltensanalyse.",
      "Freiwillig — dient als Hintergrund und wird nicht wörtlich übernommen.",
    ],
  },

  f_ziele_alt: {
    verlangt: "Die im letzten Antrag vereinbarten Therapieziele.",
    punkte: [
      "So, wie sie damals formuliert wurden.",
      "Rana zieht sie beim Folgeantrag aus dem vorigen Bericht heraus.",
    ],
    warum: "Ohne die alten Ziele fehlt der Massstab, an dem sich das Behandlungsergebnis messen lässt. Genau das verlangt der Leitfaden.",
    umwandlung: "Beim Umwandlungsantrag stehen hier die Ziele, die für die Kurzzeittherapie vereinbart wurden — sie sind der Massstab, an dem sich zeigt, warum die Kurzzeittherapie nicht ausreicht.",
  },

  // ---- Schritt 3 · Verlauf -----------------------------------

  f_ausgangslage: {
    verlangt: "Die Ausgangslage zu Therapiebeginn.",
    punkte: [
      "Beschwerdebild und Beeinträchtigung, wie sie sich beim Beginn darstellten.",
      "Der auslösende Zusammenhang, soweit bekannt.",
      "So knapp, dass der Fall auch ohne den Erstbericht verständlich ist.",
    ],
    warum: "Bei Beihilfeanträgen liegt dem Gutachter der Erstbericht meist nicht vor. Ohne die Ausgangslage kann er keine Entwicklung beurteilen.",
  },

  f_verlauf: {
    verlangt: "Den Behandlungsverlauf seit dem letzten Bericht.",
    umwandlung:
      "Beim Umwandlungsantrag gibt es keinen letzten Bericht — die Kurzzeittherapie "
      + "brauchte keinen. Gemeint ist dann der BISHERIGE Behandlungsverlauf seit "
      + "Therapiebeginn und die Veränderung der Symptomatik.",
    punkte: [
      "Was in den Sitzungen bearbeitet wurde — Themen, Schwerpunkte, Wendepunkte.",
      "Beobachtbare Veränderungen: Symptomatik, Alltag, Beziehungen, Arbeitsfähigkeit.",
      "Auch Stagnation, Rückschritte und Krisen; sie sprechen nicht gegen die Fortführung.",
      "Konkret statt zusammenfassend: ein Beispiel trägt mehr als drei Allgemeinplätze.",
    ],
    warum: "Dies ist der Kern des Berichts. Der Gutachter beurteilt daran, ob die Behandlung wirkt und ob die Fortführung begründet ist.",
  },

  f_zielstatus: {
    verlangt: "Eine Bilanz zu jedem der zuletzt vereinbarten Ziele.",
    umwandlung:
      "Beim Umwandlungsantrag sind es die Ziele der Kurzzeittherapie. Der Leitfaden "
      + "verlangt auch hier das Ergebnis in Bezug auf ihre Erreichung bzw. "
      + "Nichterreichung — und darauf stützt sich die Begründung der Umwandlung.",
    punkte: [
      "Jedes Ziel einzeln: erreicht, teilweise erreicht oder nicht erreicht.",
      "Bei teilweise oder nicht erreicht: woran es lag.",
      "Nicht erreichte Ziele sind kein Mangel — sie tragen den Antrag.",
    ],
    warum: "Der Leitfaden verlangt das Behandlungsergebnis ausdrücklich in Bezug auf Erreichung und Nichterreichung der Therapieziele. Fehlt diese Bilanz, fehlt dem Gutachter die Grundlage.",
  },

  f_befund: {
    verlangt: "Den aktuellen psychischen Befund.",
    punkte: [
      "Bewusstsein, Orientierung, Antrieb, Affekt, Denken, Wahrnehmung.",
      "Suizidalität, soweit relevant — und ausdrücklich, wenn ausgeschlossen.",
      "Der Befund zum Zeitpunkt des Antrags, nicht zu Behandlungsbeginn.",
    ],
    warum: "Er begründet die Diagnose und zeigt, wo die Patientin jetzt steht.",
  },

  f_diag_neu: {
    verlangt: "Die aktuellen Diagnosen nach ICD-10.",
    punkte: [
      "Code und Klartext, etwa „F33.1 rezidivierende depressive Störung, gegenwärtig mittelgradig“.",
      "Mit Diagnosesicherheit, wo sie nicht gesichert ist.",
      "Komorbiditäten gehören dazu, wenn sie die Behandlung beeinflussen.",
    ],
    warum: "Die Diagnose muss den psychischen Befund tragen und zur beantragten Behandlung passen.",
  },

  f_begruendung: {
    verlangt: "Die Begründung, warum die Behandlung fortgeführt werden soll.",
    punkte: [
      "Was noch zu bearbeiten ist und warum es Zeit braucht.",
      "Danach die weiteren Behandlungsziele — höchstens vier, je ein Satz.",
      "Die Ziele müssen in den beantragten Stunden erreichbar sein.",
    ],
    warum: "Der Gutachter entscheidet über die Fortführung; dies ist die Stelle, an der sie begründet wird.",
  },

  f_methoden: {
    verlangt: "Beim Fortführungsantrag: geänderte Behandlungsmethoden und -techniken.",
    punkte: [
      "Der Leitfaden fragt hier nur nach Änderungen. Bleibt die Methode dieselbe — der Regelfall —, darf das Feld leer bleiben.",
      "Rana schliesst den Absatz dann mit „Die Behandlungsmethoden und -techniken bleiben unverändert.“",
      "Ausfüllen also nur, wenn sich am Vorgehen tatsächlich etwas geändert hat.",
    ],
    umwandlung:
      "Beim Umwandlungsantrag verlangt der Leitfaden mehr: Setting, Sitzungszahl und "
      + "Behandlungsfrequenz müssen ausdrücklich BEGRÜNDET werden, dazu die im Fall geplanten "
      + "Behandlungstechniken und -methoden. Hier gehört dann hin, warum Einzeltherapie in "
      + "dieser Frequenz und diesem Umfang für diesen Fall das Richtige ist.",
  },

  f_prognose: {
    verlangt: "Eine Einschätzung des weiteren Verlaufs.",
    punkte: [
      "Günstige Faktoren: Ressourcen, Bündnis, Umfeld, bisherige Fortschritte.",
      "Veränderungshindernisse: was den Fortschritt bremst.",
      "Beides gehört hinein — eine nur günstige Prognose wirkt ungeprüft.",
    ],
  },

  f_abschluss: {
    verlangt: "Die Planung des Therapieabschlusses.",
    punkte: [
      "Woran der Abschluss festgemacht wird.",
      "Ob eine Ausschleichphase mit grösseren Abständen vorgesehen ist.",
      "Weiterführende Massnahmen danach, soweit geplant.",
    ],
    warum: "Der Leitfaden verlangt die Abschlussplanung ausdrücklich. Sie zeigt, dass die Behandlung ein Ende hat und wie es aussieht.",
  },
};
