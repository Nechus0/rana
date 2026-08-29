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
