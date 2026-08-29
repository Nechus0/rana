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
