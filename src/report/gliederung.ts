/**
 * Die Gliederung des Berichts — je Antragsart eine andere.
 *
 * Der Leitfaden (Muster PTV 3, Fassung 4.2017) kennt zwei Berichte
 * mit verschiedener Gliederung, und das ist keine Formalie: der
 * Bericht zum Fortführungsantrag darf voraussetzen, dass dem
 * Gutachter ein Erstbericht vorliegt, und beschränkt sich deshalb auf
 * drei Punkte. Der Bericht zum Erst- oder Umwandlungsantrag setzt
 * nichts voraus und hat sieben.
 *
 * Bis Fassung 2.6.1 schrieb Rana immer die dreiteilige Fassung. Bei
 * einem Umwandlungsantrag fehlten damit vier Pflichtangaben, unter
 * anderem der somatische Befund samt Konsiliarbericht — und der
 * Bericht trug die Überschrift „seit dem letzten Bericht“ für einen
 * Bericht, den es nie gegeben hat.
 *
 * Diese Datei ist die einzige Stelle, an der die Gliederung steht.
 * Prompt, Zerlegung des Rohtextes, Anzeige und Word-Ausgabe holen sie
 * hier ab; keine von ihnen zählt noch selbst bis drei.
 */

import type { Profile } from "../core/ipc";

export type Antragsart = "fortfuehrung" | "umwandlung";

export interface Punkt {
  /** Die Überschrift, wörtlich nach Leitfaden. */
  titel: string;
  /**
   * Ältere oder abgekürzte Schreibweisen derselben Überschrift.
   *
   * Modelle geben die Überschrift gern leicht verkürzt aus, und
   * Berichte aus früheren Fassungen tragen die alte. Beides muss
   * beim Zerlegen abgestreift werden, sonst steht die Überschrift
   * ein zweites Mal als Fließtext im Abschnitt.
   */
  alt?: string[];
  /** Richtwert in Zeichen, damit die Summe zwei Seiten ergibt. */
  anteil: number;
}

/** „Psychodynamik“ oder „funktionales Bedingungsmodell“ — je Verfahren. */
function modellwort(p: Profile): string {
  return p.verfahren.art === "vt"
    ? "zum funktionalen Bedingungsmodell"
    : p.verfahren.art === "st"
    ? "zum systemischen Verständnis"
    : "zur Psychodynamik";
}

/**
 * Die drei Punkte des Fortführungsberichts.
 *
 * Ausdrücklich exportiert und ohne Profil: render.ts braucht sie als
 * Vorgabe, wenn `parseSections` ohne Gliederung aufgerufen wird — und
 * dann müssen die alten Schreibweisen mitkommen, sonst bleibt die
 * Überschrift eines vor 2.0 gespeicherten Berichts als Fließtext im
 * Abschnitt stehen.
 */
export const FORTFUEHRUNG: Punkt[] = [
  {
    titel: "Behandlungsverlauf seit dem letzten Bericht und Erreichung der Therapieziele",
    alt: ["Bisheriger Behandlungsverlauf seit dem letzten Bericht"],
    anteil: 2750,
  },
  {
    titel: "Aktuelle Diagnosen gemäß ICD-10 und aktueller psychischer Befund",
    alt: ["Aktuelle Diagnose(n) und aktueller psychischer Befund"],
    anteil: 750,
  },
  {
    titel: "Begründung der Fortführung, weitere Therapieplanung und Prognose",
    alt: ["Begründung der Notwendigkeit der Fortführung, weitere Planung und Prognose"],
    anteil: 1450,
  },
];

function umwandlung(p: Profile): Punkt[] {
  return [
    {
      titel: "Relevante soziodemographische Daten",
      alt: ["Soziodemographische Daten", "Relevante soziodemografische Daten"],
      anteil: 200,
    },
    {
      titel: "Symptomatik und psychischer Befund",
      anteil: 850,
    },
    {
      titel: "Somatischer Befund und Konsiliarbericht",
      alt: ["Somatischer Befund / Konsiliarbericht", "Somatischer Befund"],
      anteil: 320,
    },
    {
      titel: `Behandlungsrelevante Angaben zur Lebensgeschichte, zur Krankheitsanamnese und ${modellwort(p)}`,
      alt: [
        "Behandlungsrelevante Angaben zur Lebensgeschichte und zur Krankheitsanamnese",
        "Lebensgeschichte, Krankheitsanamnese und Psychodynamik",
      ],
      anteil: 900,
    },
    {
      titel: "Diagnose zum Zeitpunkt der Antragstellung",
      alt: ["Diagnose zum Zeitpunkt der Antragsstellung"],
      anteil: 280,
    },
    {
      titel: "Behandlungsplan und Prognose",
      anteil: 1250,
    },
    {
      titel: "Zusätzlich erforderliche Angaben zum Umwandlungsantrag",
      alt: [
        "Zusätzlich erforderliche Angaben bei einem Umwandlungsantrag",
        "Zusätzliche Angaben zum Umwandlungsantrag",
      ],
      anteil: 1100,
    },
  ];
}

export function gliederung(art: Antragsart, p: Profile): Punkt[] {
  return art === "umwandlung" ? umwandlung(p) : FORTFUEHRUNG;
}

// ===============================================================
// Wie viele Zeichen passen auf zwei Seiten?
// ===============================================================

/**
 * Der Satzspiegel, in Zeilen gerechnet.
 *
 * Bis 2.7.1 rechnete Rana in Zeichen: ein fester Korridor von 4.700
 * bis 5.100, gleich welcher Bericht. Das ging schief, sobald der
 * Umwandlungsbericht kam. Er hat sieben Überschriften statt drei, und
 * jede kostet Platz, den kein Zeichen füllt — Rana meldete „zwei
 * Seiten", Word zeigte zweieinhalb.
 *
 * Gemessen an zwei echten Berichten:
 *   7.095 Zeichen · 3 Abschnitte · 16 Absätze  →  knapp 2,5 Seiten
 *   5.394 Zeichen · 7 Abschnitte · 18 Absätze  →  2,4 Seiten
 *
 * Dieselbe Seitenzahl bei 1.700 Zeichen weniger. Der Unterschied sind
 * die vier zusätzlichen Überschriften und zwei Absätze mehr.
 */
const SATZ = {
  /** 16 cm Satzbreite, 11 pt Serifenschrift. */
  zeichenJeZeile: 95,
  zeilenJeSeite: 45,
  /** Briefkopf, Titel, Untertitel, Metabox, Unterschriftsblock. */
  fest: 22,
  /** Überschrift samt Linie und Abstand. */
  jeUeberschrift: 2.5,
  /** Der Abstand nach einem Absatz. */
  jeAbsatz: 0.5,
} as const;

/** Wie viele Absätze ein Bericht dieser Gliederung üblicherweise hat. */
function absaetze(anzahlPunkte: number): number {
  return anzahlPunkte === 3 ? 16 : 18;
}

/**
 * Der Zielumfang in Zeichen für genau zwei Seiten.
 *
 * `seiten` erlaubt es, auch andere Umfänge auszurechnen — etwa die
 * Obergrenze bei 2,15 Seiten, weil ein Bericht, der drei Zeilen auf
 * die dritte Seite reicht, in der Praxis noch durchgeht.
 */
export function zeichenFuer(anzahlPunkte: number, seiten = 2): number {
  const frei = seiten * SATZ.zeilenJeSeite
    - SATZ.fest
    - anzahlPunkte * SATZ.jeUeberschrift
    - absaetze(anzahlPunkte) * SATZ.jeAbsatz;
  return Math.max(1000, Math.round(frei * SATZ.zeichenJeZeile / 50) * 50);
}

/**
 * Der Korridor für eine Gliederung: Untergrenze, Ziel, Obergrenze.
 *
 * Nicht mehr aus dem Profil, sondern aus dem Satzspiegel. Der
 * Profilwert `ziel_soll` bleibt als Stellschraube erhalten: wer ihn
 * ändert, verschiebt den ganzen Korridor mit — aber der Abstand
 * zwischen Fortführungs- und Umwandlungsbericht bleibt erhalten.
 */
export function korridor(art: Antragsart, p: Profile): { min: number; soll: number; max: number } {
  const n = gliederung(art, p).length;
  const soll = zeichenFuer(n, 2);
  // Wer den Zielumfang im Profil verstellt hat, soll das behalten —
  // aber als Verhältnis, nicht als absolute Zahl.
  const faktor = p.layout.ziel_soll ? p.layout.ziel_soll / 4900 : 1;
  const s = Math.round(soll * faktor / 50) * 50;
  return {
    min: Math.round(s * 0.9 / 50) * 50,
    soll: s,
    max: Math.round(zeichenFuer(n, 2.15) * faktor / 50) * 50,
  };
}

/**
 * Die geschätzte Seitenzahl eines fertigen Berichts.
 *
 * Zählt, was wirklich Platz braucht: Text, Absatzabstände,
 * Überschriften und die feste Ausstattung des Blattes.
 */
export function seitenSchaetzung(text: string, anzahlPunkte: number): number {
  const roh = text.replace(/【\s*([^】]*?)\s*】/g, "$1").trim();
  if (!roh) return 0;
  // Absätze im Text zählen statt schätzen — das ist genauer als ein
  // Richtwert, sobald wirklich Text da ist.
  const ap = roh.split(/\n\s*\n/).filter((x) => x.trim()).length;
  const zeilen = roh.length / SATZ.zeichenJeZeile
    + anzahlPunkte * SATZ.jeUeberschrift
    + ap * SATZ.jeAbsatz
    + SATZ.fest;
  return zeilen / SATZ.zeilenJeSeite;
}

/** Nur die Überschriften — für Anzeige und Word-Ausgabe. */
export function titel(art: Antragsart, p: Profile): string[] {
  return gliederung(art, p).map((x) => x.titel);
}

/**
 * Wie der Antrag heisst — im Kopf des Dokuments, in der Fusszeile, im
 * Dateinamen und in der Liste.
 */
export const ANTRAGSWORT: Record<Antragsart, string> = {
  fortfuehrung: "Fortführungsantrag",
  umwandlung:   "Umwandlungsantrag",
};

export const BERICHTSWORT: Record<Antragsart, string> = {
  fortfuehrung: "Fortführungsbericht",
  umwandlung:   "Umwandlungsbericht",
};

/** Für Dateinamen: ohne Umlaute, ohne Leerzeichen am Anfang. */
export const DATEIWORT: Record<Antragsart, string> = {
  fortfuehrung: "Fortfuehrungsbericht",
  umwandlung:   "Umwandlungsbericht",
};

/**
 * Der Untertitel unter „Bericht an die Gutachterin / den Gutachter“.
 *
 * Das Profil darf einen eigenen setzen — manche Beihilfestellen
 * verlangen einen bestimmten Wortlaut. Steht dort nichts, richtet er
 * sich nach der Antragsart, und nicht mehr fest nach „Fortführung“.
 */
export function untertitel(art: Antragsart, p: Profile): string {
  const eigen = (p.layout.untertitel ?? "").trim();

  if (art !== "umwandlung") return eigen || "zum Fortführungsantrag";

  // Beim Umwandlungsantrag darf der eigene Untertitel nicht einfach
  // übernommen werden: er stammt aus einer Zeit, in der Rana nur den
  // Fortführungsbericht kannte, und trägt deshalb fast immer das Wort
  // „Fortführungsantrag". Dann stünde über einem Umwandlungsbericht
  // die falsche Antragsart — genau der Fehler, um den es hier geht.
  //
  // Der Zusatz, den manche Beihilfestellen verlangen, bleibt dabei
  // erhalten: ausgetauscht wird nur das eine Wort.
  if (!eigen) return "zum Umwandlungsantrag (Kurzzeit- in Langzeittherapie)";
  if (/Fortführungsantrag/i.test(eigen)) {
    return eigen.replace(/Fortführungsantrag/gi, "Umwandlungsantrag");
  }
  return eigen;
}

/**
 * Liest die Antragsart aus den Feldern.
 *
 * Fälle aus Fassungen vor 2.6.0 haben das Feld nicht. Sie sind
 * durchweg Fortführungsanträge — Rana konnte damals nichts anderes.
 */
export function artVon(f: Record<string, string> | null | undefined): Antragsart {
  return (f?.f_antragsart ?? "").trim() === "umwandlung" ? "umwandlung" : "fortfuehrung";
}
