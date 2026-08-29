/**
 * Die fünf Arbeitsschritte.
 *
 * Jeder Schritt gibt sein Markup zurück und meldet sich anschliessend
 * für seine Ereignisse an. Der Rahmen (main.ts) kümmert sich um
 * Navigation, Speichern und die Kontextspalte.
 *
 * Schritt 4 ist der eigentliche Grund für diesen Bau: Wo früher
 * kopiert, das Fenster gewechselt und eine Datei zurückgeladen werden
 * musste, steht jetzt ein Knopf.
 */

import * as api from "../core/ipc";
import { F_DIAGNOSEN } from "../core/icd10";
import { LEITFADEN } from "../core/leitfaden";
import { buildDocx } from "../report/docx";
import { expandPrompt, klarnamen, kuerzePrompt, systemPrompt, userPrompt } from "../report/prompt";
import { fileBase, metrik, renderDocHTML } from "../report/render";
import * as S from "../core/state";
import { confirmDialog, dialog, download, el, esc, icon, on, qs, qsa, toast } from "../ui/kit";
import { open, save } from "@tauri-apps/plugin-dialog";

export const SCHRITTE = [
  { titel: "Fall-Stammdaten",           kurz: "Stammdaten" },
  { titel: "Letzter Bericht",            kurz: "Vorbericht" },
  { titel: "Verlauf und aktueller Stand", kurz: "Verlauf" },
  { titel: "Bericht formulieren",        kurz: "Formulieren" },
  { titel: "Ausgabe",                    kurz: "Ausgabe" },
];

/**
 * Beim Umwandlungsantrag heissen die Schritte 2 und 3 anders, weil
 * sie anderes enthalten: es gibt keinen Vorbericht, dafür die
 * Vorgeschichte, und Schritt 3 trägt Plan und Umwandlungsbegründung.
 */
const SCHRITTE_UMW = [
  { titel: "Fall-Stammdaten",             kurz: "Stammdaten" },
  { titel: "Vorgeschichte und Befund",    kurz: "Vorgeschichte" },
  { titel: "Behandlungsplan und Umwandlung", kurz: "Plan" },
  { titel: "Bericht formulieren",         kurz: "Formulieren" },
  { titel: "Ausgabe",                     kurz: "Ausgabe" },
];

/** Die Schrittnamen des gerade offenen Falls. */
export function schritte(): { titel: string; kurz: string }[] {
  return S.antragsart() === "umwandlung" ? SCHRITTE_UMW : SCHRITTE;
}

// ---------------------------------------------------------------
// Feldbausteine
// ---------------------------------------------------------------

const f = (k: string) => S.state.fields[k] ?? "";

/** Kurz zur Hand: ist dieser Fall ein Umwandlungsantrag? */
const umwandlung = () => S.antragsart() === "umwandlung";

function input(id: string, label: string, opts: {
  typ?: string; ph?: string; note?: string; liste?: string[]; span?: number;
} = {}): string {
  const fehlt = S.PFLICHT.some((p) => p.feld === id) && !f(id).trim();
  const listId = opts.liste ? `${id}_list` : "";
  return `
    <div class="field ${fehlt ? "is-missing" : ""}" ${opts.span ? `style="grid-column: span ${opts.span}"` : ""}>
      <label for="${id}">
        ${esc(label)}${opts.note ? ` <span class="field-note">${esc(opts.note)}</span>` : ""}
        ${LEITFADEN[id] ? `<span class="spacer"></span>${leitfadenZeichen(id)}` : ""}
      </label>
      ${leitfadenBlase(id)}
      <input id="${id}" data-feld="${id}" type="${opts.typ ?? "text"}"
             value="${esc(f(id))}" placeholder="${esc(opts.ph ?? "")}"
             ${listId ? `list="${listId}"` : ""}>
      ${opts.liste ? `<datalist id="${listId}">${opts.liste.map((o) => `<option value="${esc(o)}"></option>`).join("")}</datalist>` : ""}
    </div>`;
}

/**
 * Das Info-Zeichen am Feld.
 *
 * Es steht nur dort, wo der Leitfaden wirklich etwas verlangt — ein
 * Zeichen an jedem Feld wäre Tapete und würde genau dort übersehen, wo
 * es zählt. Der Inhalt kommt aus `core/leitfaden.ts`; hier steht nur,
 * wie er aussieht.
 */
function leitfadenZeichen(id: string): string {
  const h = LEITFADEN[id];
  if (!h) return "";
  return `<button class="btn btn-sm btn-quiet btn-icon lf-zeichen" data-leitfaden="${id}"
                  type="button" title="Was der Leitfaden hier verlangt"
                  aria-label="Was der Leitfaden hier verlangt">${icon.info}</button>`;
}

/** Der Inhalt der Blase — dieselbe Form für Textfelder und Eingaben. */
function leitfadenBlase(id: string): string {
  const h = LEITFADEN[id];
  if (!h) return "";
  return `
    <div class="lf-blase" id="lf_${esc(id)}" role="note" hidden>
      <p class="lf-verlangt">${esc(h.verlangt)}</p>
      <ul class="lf-punkte">
        ${h.punkte.map((p) => `<li>${esc(p)}</li>`).join("")}
      </ul>
      ${h.warum ? `<p class="lf-warum">${esc(h.warum)}</p>` : ""}
      ${h.umwandlung ? `
        <p class="lf-umwandlung">
          <b>Bei einem Umwandlungsantrag (Kurzzeit- in Langzeittherapie):</b>
          ${esc(h.umwandlung)}
        </p>` : ""}
      <p class="lf-quelle">PTV-3-Leitfaden der KBV, Muster 4.2017</p>
    </div>`;
}

function textarea(id: string, label: string, opts: {
  ph?: string; note?: string; hoch?: number; bausteine?: boolean; icd10?: boolean;
} = {}): string {
  const fehlt = S.PFLICHT.some((p) => p.feld === id) && !f(id).trim();
  return `
    <div class="field ${fehlt ? "is-missing" : ""}">
      <label for="${id}" style="align-items: center;">
        ${esc(label)}${opts.note ? ` <span class="field-note">${esc(opts.note)}</span>` : ""}
        <span class="spacer"></span>
        ${leitfadenZeichen(id)}
        <button class="btn btn-sm btn-quiet btn-icon" data-gross="${id}" type="button"
                title="Feld gross öffnen (Strg+Umschalt+E)"
                aria-label="Feld gross öffnen">${icon.gross}</button>
        ${opts.bausteine !== false
          ? `<button class="btn btn-sm btn-quiet" data-bausteine="${id}" type="button"
                     title="Eigene Textbausteine für dieses Feld">Bausteine</button>`
          : ""}
      </label>
      ${leitfadenBlase(id)}
      ${opts.icd10
        // Das Suchfeld stand vorher im Etikett und erbte von dort
        // Versalien, Sperrung und Schriftgrad — es sah aus wie ein
        // Fehler. Es steht jetzt in einer eigenen Zeile darüber, mit
        // eigener Beschriftung.
        ? `<div class="icd10-zeile">
             <label class="icd10-marke" for="${id}_search">ICD-10 suchen</label>
             <input type="search" list="icd10-list" id="${id}_search"
                    class="icd10-search" placeholder="z. B. F32 oder Depression"
                    autocomplete="off">
           </div>`
        : ""}
      <textarea id="${id}" data-feld="${id}" placeholder="${esc(opts.ph ?? "")}"
                ${opts.hoch ? `style="min-height:${opts.hoch}px"` : ""}>${esc(f(id))}</textarea>
      <div class="field-fuss">
        <span class="field-balken" data-balken="${id}"><i></i></span>
        <span class="field-zaehler" data-zaehler="${id}"></span>
      </div>
    </div>`;
}

const gruppe = (num: string | null, titel: string, body: string) => `
  <section class="group">
    <div class="group-head">
      ${num ? `<span class="group-num">${esc(num)}</span>` : ""}
      <span class="group-title">${esc(titel)}</span>
    </div>
    <div class="group-body">${body}</div>
  </section>`;

// ===============================================================
// Schritt 1 · Stammdaten
// ===============================================================

function schritt1(): string {
  return gruppe(null, "Falldaten für diesen Antrag", `
    <p class="hint" style="margin-bottom: var(--s5)">
      Die Grunddaten der Patientin (Name, Geburtsdatum, Chiffre, etc.) sind fest 
      mit der Person verknüpft. Du kannst sie in der Patienten-Übersicht bearbeiten.
      Hier trägst du nur ein, was spezifisch für diesen Antrag ist.
    </p>
    <!-- Die Antragsart steht ganz oben, weil sie alles darunter
         beeinflusst: bei einer Umwandlung gibt es keinen letzten
         Bericht, und Beschriftungen wie „seit dem letzten Bericht"
         fragen dann nach etwas, das es nicht gibt. -->
    <div class="field" style="margin-bottom: var(--s5)">
      <label for="f_antragsart" style="align-items: center;">
        Art des Antrags
        <span class="field-note">bestimmt die Beschriftungen und den Auftrag an Claude</span>
        ${leitfadenZeichen("f_antragsart")}
      </label>
      ${leitfadenBlase("f_antragsart")}
      <select id="f_antragsart" data-feld="f_antragsart">
        ${(Object.keys(S.ANTRAGSART_NAMEN) as S.Antragsart[]).map((k) => `
          <option value="${k}" ${S.antragsart() === k ? "selected" : ""}>${esc(S.ANTRAGSART_NAMEN[k])}</option>`).join("")}
      </select>
    </div>

    <div class="grid-3">
      ${input("f_nr", umwandlung() ? "Lfd. Nr. des Antrags" : "Lfd. Nr. des Fortführungsantrags",
              { span: 3, typ: "number", ph: "1", note: "je Antrag hochzählen" })}
      ${input("f_bewilligt", "Bisher bewilligt", { typ: "number", note: "Std." })}
      ${input("f_verbraucht", "Davon verbraucht", { typ: "number", note: "Std." })}
      ${input("f_beantragt", "Jetzt beantragt", { typ: "number", note: "weitere Std." })}
      ${input("f_frequenz", "Frequenz", {
        span: 3,
        note: "für „Methodik und Setting“",
        ph: "wöchentlich",
        liste: [
          "wöchentlicher Frequenz",
          "vierzehntägiger Frequenz",
          "zunächst wöchentlicher, später vierzehntägiger Frequenz",
          "in der Regel wöchentlicher Frequenz",
        ],
      })}
    </div>
    <div id="warnungen"></div>
    <div class="row" style="margin-top: var(--s5)">
      <button class="btn" id="btnFolgeantrag" type="button"
              title="Legt den nächsten Antrag derselben Patientin an und übernimmt, was gleich bleibt">
        ${icon.plus} Folgeantrag aus diesem Fall
      </button>
      <span class="hint">Patientendaten, Ausgangslage und Psychodynamik werden übernommen.</span>
    </div>`);
}

// ===============================================================
// Schritt 2 · Vorbericht
// ===============================================================

/**
 * Schritt 2 trägt beim Umwandlungsantrag etwas völlig anderes.
 *
 * Beim Fortführungsantrag geht es um den letzten Bericht — es MUSS
 * einen geben, sonst wäre es keine Fortführung. Die Frage „liegt ein
 * Vorbericht vor?" ist deshalb entfallen; sie hatte nur eine Antwort.
 *
 * Beim Umwandlungsantrag gibt es keinen. Dafür verlangt der Leitfaden
 * die Angaben des Erstberichts, und die stehen jetzt hier statt den
 * Schritt leer zu lassen: Symptomatik, Krankheitsverständnis,
 * somatischer Befund, Lebensgeschichte, Psychodynamik, Ziele der
 * Kurzzeittherapie.
 */
function schritt2(): string {
  return umwandlung() ? schritt2Umwandlung() : schritt2Fortfuehrung();
}

function schritt2Fortfuehrung(): string {
  return `
    <p class="hint" style="margin-bottom: var(--s5)">
      Der Bericht knüpft an den letzten an. Was hier steht, dient als Hintergrund
      für die Formulierung und wird nicht wörtlich übernommen.
    </p>

    ${gruppe(null, "Text des letzten Berichts", `
      <div class="row" style="margin-bottom: var(--s3)">
        <button class="btn btn-sm" id="btnUploadVorbericht" type="button" title="Word (.docx) oder PDF laden">
          ${icon.word} Datei einlesen (Word / PDF)
        </button>
      </div>
      <div class="field">
        <label for="f_lastreport" style="align-items: center;">
          Hier einfügen
          <span class="field-note">bleibt auf dem Gerät, geht nur als Hintergrund in die Formulierung</span>
          ${leitfadenZeichen("f_lastreport")}
        </label>
        ${leitfadenBlase("f_lastreport")}
        <textarea id="f_lastreport" data-feld="f_lastreport" style="min-height:190px"
                  placeholder="Kompletten Text des letzten Berichts hier einfügen …">${esc(f("f_lastreport"))}</textarea>
      </div>`)}

    ${gruppe(null, "Vorgeschichte", `
      ${textarea("f_diag_alt", "Bisherige ICD-10-Diagnose(n)", { ph: "F33.1 rezidivierende depressive Störung, gegenwärtig mittelgradig …", icd10: true })}
      ${textarea("f_psychodyn", psychodynLabel(), { ph: psychodynPh() })}
      ${textarea("f_ziele_alt", "Zuletzt formulierte Therapieziele", { note: "Bezugspunkt für den Verlauf", ph: "Je Ziel eine Zeile …" })}`)}`;
}

function schritt2Umwandlung(): string {
  const tp = S.state.profile?.verfahren.art === "tp" || S.state.profile?.verfahren.art === "at";
  return `
    <p class="hint" style="margin-bottom: var(--s5)">
      Zur Kurzzeittherapie gab es keinen Bericht an den Gutachter. Er kennt den Fall
      also nicht — der Umwandlungsbericht muss ihn vollständig darstellen. Was hier
      steht, wird zu den Gliederungspunkten 1 bis 5 des Berichts.
    </p>

    ${gruppe("2", "Symptomatik und Befund", `
      ${textarea("f_symptomatik", "Geschilderte Symptomatik", {
        note: "mit Schwere und Verlauf",
        hoch: 150,
        ph: "Was berichtet die Patientin? Seit wann, wie stark, gleichbleibend oder schwankend …",
      })}
      ${textarea("f_krankheitsverstaendnis", "Krankheitsverständnis", {
        note: "wie sie sich die Beschwerden selbst erklärt",
        ph: "Ihre eigene Deutung, auch wenn sie fachlich nicht trägt …",
      })}`)}

    ${gruppe("3", "Somatischer Befund und Konsiliarbericht", `
      ${textarea("f_somatisch", "Somatischer Befund, Konsiliarbericht, Medikation", {
        note: "Pflicht — auch wenn unauffällig",
        ph: "Ergebnis des Konsiliarberichts, aktuelle Medikation, Suchtmittel soweit bedeutsam …",
      })}
      ${textarea("f_vorbehandlung", "Frühere Behandlungen", {
        note: "psychotherapeutisch, psychosomatisch, psychiatrisch",
        ph: "Art, Zeitraum, Ergebnis — oder „keine Vorbehandlungen“ …",
      })}`)}

    ${gruppe("4", `Lebensgeschichte und ${psychodynLabel()}`, `
      ${textarea("f_lebensgeschichte", "Lebensgeschichte und Krankheitsanamnese", {
        note: "nur was die Störung erklärt",
        hoch: 150,
        ph: "Herkunftsfamilie, prägende Beziehungserfahrungen, Beginn und Entwicklung der Beschwerden …",
      })}
      ${textarea("f_psychodyn", psychodynLabel(), { hoch: 150, ph: psychodynPh() })}`)}

    ${gruppe("5", "Diagnose zum Zeitpunkt der Antragstellung", `
      ${textarea("f_diag_neu", "ICD-10-Diagnose(n)", { note: "mit Diagnosesicherheit", ph: "F34.1 Dysthymia, gesichert …", icd10: true })}
      ${tp ? textarea("f_diag_psychodyn", "Psychodynamische Diagnose", {
        note: "vom Leitfaden für TP und AP verlangt",
        ph: "Konflikt, Strukturniveau, vorherrschender Abwehrmodus …",
      }) : ""}
      ${textarea("f_differenzial", "Differenzialdiagnostik", {
        note: "nur wenn für die Entscheidung nötig",
        ph: "Abgrenzung gegen … weil …",
      })}`)}

    ${gruppe(null, "Ziele der Kurzzeittherapie", `
      ${textarea("f_ziele_alt", "Für die Kurzzeittherapie vereinbarte Ziele", {
        note: "Bezugspunkt für die Bilanz in Schritt 3",
        ph: "Je Ziel eine Zeile …",
      })}`)}`;
}

/** Die Beschriftung folgt dem eingerichteten Verfahren. */
function psychodynLabel(): string {
  switch (S.state.profile?.verfahren.art) {
    case "vt": return "Verhaltensanalyse und Bedingungsmodell";
    case "st": return "Systemisches Verständnis";
    default:   return "Psychodynamik";
  }
}
function psychodynPh(): string {
  switch (S.state.profile?.verfahren.art) {
    case "vt": return "Auslösende und aufrechterhaltende Bedingungen, Verhaltensanalyse …";
    case "st": return "Muster im System, Funktion des Symptoms, Kontext …";
    default:   return "Situation, Konflikt, Struktur, Abwehr …";
  }
}

// ===============================================================
// Schritt 3 · Verlauf
// ===============================================================

function schritt3(): string {
  return umwandlung() ? schritt3Umwandlung() : schritt3Fortfuehrung();
}

function schritt3Fortfuehrung(): string {
  return `
    <p class="hint" style="margin-bottom: var(--s5)">
      Stichworte genügen. Die Nummern zeigen, in welchen Gliederungspunkt
      des fertigen Berichts der Text einfliesst.
    </p>

    ${gruppe("1", "Behandlungsverlauf seit dem letzten Bericht", `
      ${textarea("f_ausgangslage", "Ausgangslage bei Therapiebeginn", {
        note: "auslösende Situation, Symptomatik, Psychodynamik",
        hoch: 150,
        ph: "Wodurch wurde die Behandlung ausgelöst? Symptomatik und Funktionsniveau zu Beginn, zugrunde liegender Konflikt …",
      })}
      ${textarea("f_verlauf", "Verlauf seit dem letzten Bericht", {
        note: "was sich verändert hat, nicht Sitzung für Sitzung",
        hoch: 190,
        ph: "Was wurde bearbeitet? Symptomveränderung im Behandlungszeitraum …",
      })}
      ${textarea("f_zielstatus", "Stand der zuletzt vereinbarten Therapieziele", {
        note: "je Ziel: erreicht / teilweise erreicht / noch offen",
        hoch: 150,
        ph: "Ziel 1 … erreicht. Ziel 2 … teilweise, weil … Ziel 3 … noch offen, weil …",
      })}`)}

    ${gruppe("2", "Aktuelle Diagnose(n) und psychischer Befund", `
      ${textarea("f_befund", "Aktueller psychischer Befund", { ph: "Antrieb, Affekt, Denken, Suizidalität soweit relevant …" })}
      ${textarea("f_diag_neu", "Aktuelle ICD-10-Diagnose(n)", { ph: "Mit Code und Diagnosesicherheit …", icd10: true })}`)}

    ${gruppe("3", "Begründung, Planung und Prognose", `
      ${textarea("f_begruendung", "Begründung und weitere Planung", {
        note: "Ziele, Methoden",
        ph: "Warum ist die Fortführung nötig? Weitere Planung, angepasste Ziele …",
      })}
      ${textarea("f_methoden", "Methodik und Setting", {
        note: "nur bei Änderung",
        ph: "Womit weitergearbeitet wird, falls sich etwas ändert …",
      })}
      ${textarea("f_prognose", "Prognose und geplanter Abschluss", { ph: "Günstige Faktoren, Veränderungshindernisse …" })}
      ${textarea("f_abschluss", "Planung des Therapieabschlusses", {
        note: "ggf. weiterführende Maßnahmen danach",
        ph: "Woran wird der Abschluss festgemacht? Was ist danach vorgesehen …",
      })}`)}`;
}

/**
 * Schritt 3 beim Umwandlungsantrag.
 *
 * Deutlich schlanker als beim Fortführungsantrag: Symptomatik, Befund
 * und Diagnose stehen bereits in Schritt 2, weil sie dort zu den
 * Gliederungspunkten 2 und 5 gehören. Hier bleiben die Punkte 6 und 7
 * — der Behandlungsplan und die Zusatzangaben zur Umwandlung.
 */
function schritt3Umwandlung(): string {
  return `
    <p class="hint" style="margin-bottom: var(--s5)">
      Stichworte genügen. Symptomatik, Befund und Diagnose stehen schon in
      Schritt 2. Hier folgen die letzten beiden Gliederungspunkte.
    </p>

    ${gruppe("6", "Behandlungsplan und Prognose", `
      ${textarea("f_begruendung", "Behandlungsplan und weitere Ziele", {
        note: "was in der Langzeittherapie bearbeitet werden soll",
        hoch: 150,
        ph: "Individueller Behandlungsplan, dann die weiteren Ziele …",
      })}
      ${textarea("f_methoden", "Methodik und Setting", {
        note: "Setting, Sitzungszahl und Frequenz BEGRÜNDEN — nicht nur nennen",
        hoch: 150,
        ph: "Warum dieses Setting, warum diese Zahl an Sitzungen, warum diese Frequenz für diesen Fall …",
      })}
      ${textarea("f_kooperation", "Kooperation mit anderen Berufsgruppen", {
        note: "falls vorhanden",
        ph: "Hausärztin, Fachärztin, Klinik …",
      })}
      ${textarea("f_prognose", "Prognose", {
        note: "Motivation, Umstellungsfähigkeit, Veränderungshindernisse",
        ph: "Günstige Faktoren, innere und äussere Hindernisse …",
      })}
      ${textarea("f_abschluss", "Planung des Therapieabschlusses", {
        note: "ggf. weiterführende Maßnahmen danach",
        ph: "Woran wird der Abschluss festgemacht? Was ist danach vorgesehen …",
      })}`)}

    ${gruppe("7", "Zusatzangaben zum Umwandlungsantrag", `
      ${textarea("f_verlauf", "Bisheriger Verlauf seit Therapiebeginn", {
        note: "was sich verändert hat, nicht Sitzung für Sitzung",
        hoch: 190,
        ph: "Was wurde in der Kurzzeittherapie bearbeitet? Wie hat sich die Symptomatik seither verändert …",
      })}
      ${textarea("f_zielstatus", "Stand der Ziele der Kurzzeittherapie", {
        note: "je Ziel: erreicht / teilweise erreicht / noch offen",
        hoch: 150,
        ph: "Ziel 1 … erreicht. Ziel 2 … teilweise, weil … Ziel 3 … noch offen, weil …",
      })}
      ${textarea("f_umwandlungsgrund", "Begründung der Umwandlung", {
        note: "die Frage, über die der Gutachter entscheidet",
        hoch: 150,
        ph: "Warum reicht der Umfang der Kurzzeittherapie nicht aus? Was kann nur über einen längeren Zeitraum bearbeitet werden …",
      })}`)}`;
}

// ===============================================================
// Schritt 4 · Formulieren — der Kern
// ===============================================================

function schritt4(): string {
  const b = S.state.budget;
  const m = S.state.profile ? metrik(S.state.report, S.state.profile) : null;
  const offen = S.luecken();

  const anzahl = umwandlung() ? "sieben" : "drei";

  return `
    <p class="hint" style="margin-bottom: var(--s5)">
      Claude formuliert die ${anzahl} Gliederungspunkte in freier Form. Briefkopf, Metabox,
      Überschriften und Unterschrift kommen in Schritt 5 automatisch dazu. Ist der Entwurf
      zu lang, kürzt Rana ihn anschliessend selbst auf zwei Seiten.
    </p>

    ${offen.length ? `
      <div class="notice notice-warn" style="margin-bottom: var(--s5)">
        <b>${offen.length} ${offen.length === 1 ? "Angabe fehlt" : "Angaben fehlen"} noch.</b>
        Claude markiert die Stellen mit 【Bitte ergänzen】. Das Formulieren geht trotzdem —
        die Lücken lassen sich hinterher füllen.
      </div>` : ""}

    ${b && !b.may_send ? `
      <div class="notice notice-danger" style="margin-bottom: var(--s5)">
        <b>Rana sendet gerade nichts.</b>
        ${b.today_reports >= b.daily_limit
          ? `Das Tageslimit von ${b.daily_limit} Berichten ist erreicht.`
          : `Das Monatsbudget von ${b.month_limit_eur.toLocaleString("de-DE")} € ist ausgeschöpft.`}
        Unter „Einstellungen → Verbrauch“ lässt sich die Grenze anheben.
      </div>` : ""}

    <div class="row row-wrap" style="margin-bottom: var(--s4)">
      <button class="btn btn-primary btn-lg" id="btnFormulieren"
              ${b && !b.may_send ? "disabled" : ""}>
        ${icon.wand} Bericht formulieren
      </button>
      <button class="btn hidden" id="btnAbbrechen">${icon.stop} Abbrechen</button>

      <!-- Erscheint nur, wenn der Entwurf wirklich zu lang ist. Ein
           Knopf, der die meiste Zeit nichts zu tun hat, verstellt nur
           den Blick auf den einen, der zählt. -->
      ${m && m.urteil === "lang" ? `
        <button class="btn" id="btnKuerzen" ${b && !b.may_send ? "disabled" : ""}
                title="Auf zwei Seiten kürzen, ohne die Pflichtangaben zu verlieren">
          Auf zwei Seiten kürzen
        </button>` : ""}

      <span class="spacer"></span>
      <button class="btn btn-quiet btn-sm" id="btnPromptZeigen">Anfrage ansehen</button>
    </div>

    <!-- Der Fortschritt lief bis 2.6.1 als grosses Rad in der Mitte
         der Seite, mit dem Wort „Formuliere …" quer hineingesetzt. Ein
         Kreis kann keinen Text tragen, und in der Mitte einer sonst
         linksbündigen Seite stand er ohne Bezug. Jetzt: ein flacher
         Balken über dem Entwurf, mit der Beschriftung daneben — dort,
         wo das Ergebnis entsteht. -->
    <div class="lauf hidden" id="formulierenProgress" role="status" aria-live="polite">
      <div class="lauf-zeile">
        <span class="lauf-text" id="progressText">Formuliere …</span>
        <span class="lauf-zahl" id="progressPct"></span>
      </div>
      <div class="lauf-bahn"><div class="lauf-fuell" id="progressCircle"></div></div>
    </div>

    <!-- Die Kopfzeile des Entwurfs trug bisher alles in einer Zeile:
         „ENTWURF direkt bearbeitbar 6.104 Zeichen · 791 Wörter · über
         dem Korridor, läuft womöglich auf eine dritte Seite · 1 offen".
         Das lief bis an den Rand. Jetzt zwei Zeilen: links die
         Beschriftung, rechts die Zahlen, darunter das Urteil. -->
    <div class="entwurf-kopf">
      <div class="entwurf-kopf-zeile">
        <span class="entwurf-titel">Entwurf</span>
        <span class="field-note">direkt bearbeitbar</span>
        <span class="spacer"></span>
        <span class="record-num small" id="berichtZaehler">${m ? zaehlerZahlen(m) : ""}</span>
      </div>
      <div class="entwurf-urteil" id="berichtUrteil">${m ? zaehlerUrteil(m) : ""}</div>
    </div>
    <div class="paper-tray">
      <div class="paper-sheet" id="entwurf" contenteditable="true" spellcheck="true"
           role="textbox" aria-multiline="true" aria-label="Berichtsentwurf, bearbeitbar"
           >${esc(S.state.report)}</div>
    </div>`;
}

function zaehlerFarbe(m: ReturnType<typeof metrik>): string {
  return m.urteil === "gut" ? "var(--moss)" : m.urteil === "kurz" ? "var(--amber)" : "var(--brick)";
}

/** Zeile 1: nur die Zahlen. */
function zaehlerZahlen(m: ReturnType<typeof metrik>): string {
  return `<span style="color:${zaehlerFarbe(m)}">${m.zeichen.toLocaleString("de-DE")} Zeichen</span>`
    + ` <span class="muted">· ${m.woerter.toLocaleString("de-DE")} Wörter</span>`;
}

/** Schreibt beide Zeilen der Entwurfskopfzeile, soweit sie da sind. */
function zeigeZaehler(m: ReturnType<typeof metrik>): void {
  const z = document.getElementById("berichtZaehler");
  const u = document.getElementById("berichtUrteil");
  if (z) z.innerHTML = zaehlerZahlen(m);
  if (u) u.innerHTML = zaehlerUrteil(m);
}

/** Zeile 2: das Urteil in Worten, mit Platz zum Umbrechen. */
function zaehlerUrteil(m: ReturnType<typeof metrik>): string {
  const seiten = m.zeichen ? `rund ${(m.zeichen / 2840).toFixed(1).replace(".", ",")} Seiten · ` : "";
  return `<span style="color:${zaehlerFarbe(m)}">${seiten}${esc(m.hinweis)}</span>`
    + (m.luecken ? ` <span style="color:var(--amber)">· ${m.luecken} offene ${m.luecken === 1 ? "Stelle" : "Stellen"}</span>` : "");
}

// ===============================================================
// Schritt 5 · Ausgabe
// ===============================================================

function schritt5(): string {
  const p = S.state.profile!;
  const leer = !S.state.report.trim();
  const konsiliar = p.verfahren.qualifikation !== "aerztlich";

  return `
    <div class="row row-wrap" style="margin-bottom: var(--s5)">
      <button class="btn btn-primary" id="btnWord" ${leer ? "disabled" : ""}>${icon.word} Word (.docx)</button>
      <button class="btn" id="btnPdf" ${leer ? "disabled" : ""}>${icon.pdf} Als PDF sichern</button>
      <button class="btn" id="btnKopieren" ${leer ? "disabled" : ""}>${icon.copy} Text kopieren</button>
    </div>

    ${leer ? `
      <div class="notice notice-warn">
        Noch kein Bericht formuliert. Bitte zu Schritt 4 zurückgehen.
      </div>` : `
      <!-- Das Blatt fehlte hier: das Dokument lag ohne Rand direkt in
           der Ablage und sah dadurch nicht wie eine Seite aus. Die
           Ränder entsprechen jetzt denen der Word-Datei (1247 Twips,
           siehe sectPr in report/docx.ts). -->
      <div class="paper-tray">
        <div class="paper-sheet paper-doc">${renderDocHTML(S.state.report, S.state.fields, p)}</div>
      </div>

      <div class="notice notice-info" style="margin-top: var(--s5)">
        <b>Einzureichen:</b> Bericht, PTV 2b${konsiliar ? ", Konsiliarbericht (Muster 22b)" : ""}, ggf. Befundkopien (pseudonymisiert).
      </div>

      <!-- Das Beiblatt stand bis 2.6.1 als Tabelle mit sechs Pixeln
           Zeilenabstand in einer Ablage, deren Beschriftungsspalte
           nicht umbrechen durfte. Bei „Diagnose(n)" mit zwei Diagnosen
           lief der Wert dadurch bis an den Rand, und die zehn Zeilen
           klebten aneinander. Jetzt ein zweispaltiges Raster mit
           festen Spaltenbreiten und Luft dazwischen. -->
      ${gruppe(null, "Beiblatt PTV 2b", `
        <p class="hint">Angaben für das PTV 2b — zum Kopieren.</p>
        <dl class="ptv-liste selectable">
          ${ptv2bZeilen().map(([k, v]) => `
            <dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}
        </dl>
        <div class="row" style="margin-top: var(--s4)">
          <button class="btn btn-sm" id="btnPtv2b">${icon.copy} Angaben kopieren</button>
        </div>`)}
    `}`;
}

function ptv2bZeilen(): [string, string][] {
  const p = S.state.profile!;
  const v = { tp: "Tiefenpsychologisch fundierte Psychotherapie", vt: "Verhaltenstherapie",
              at: "Analytische Psychotherapie", st: "Systemische Therapie" }[p.verfahren.art];
  const s = { einzel: "Einzeltherapie", gruppe: "Gruppentherapie",
              kombination: "Kombination Einzel/Gruppe" }[p.verfahren.setting];
  return [
    ["Chiffre", f("f_chiffre") || "—"],
    ["Geburtsdatum", f("f_gebdatum") ? f("f_gebdatum").split("-").reverse().join(".") : "—"],
    ["Kostenträger", f("f_kasse") || "—"],
    ["Verfahren", `${v}, ${s}`],
    ["Bisher bewilligt", f("f_bewilligt") ? `${f("f_bewilligt")} Std.` : "—"],
    ["Davon verbraucht", f("f_verbraucht") ? `${f("f_verbraucht")} Std.` : "—"],
    ["Jetzt beantragt", f("f_beantragt") ? `${f("f_beantragt")} Sitzungen` : "—"],
    ["Frequenz", f("f_frequenz") || "—"],
    ["Diagnose(n)", f("f_diag_neu") || "—"],
    ["Behandler:in", [p.behandler.titel, p.behandler.name].filter(Boolean).join(" ")],
  ];
}

// ===============================================================
// Zusammenbau
// ===============================================================

export function renderSchritt(n: number): string {
  let html = "";
  switch (n) {
    case 0: html = schritt1(); break;
    case 1: html = schritt2(); break;
    case 2: html = schritt3(); break;
    case 3: html = schritt4(); break;
    default: html = schritt5(); break;
  }
  
  if (n === 1 || n === 2) {
    html += `\n<datalist id="icd10-list">
      ${F_DIAGNOSEN.map(d => `<option value="${d.code} ${d.name}"></option>`).join("")}
    </datalist>`;
  }
  
  return html;
}

// ---------------------------------------------------------------
// Ereignisse
// ---------------------------------------------------------------

/**
 * Öffnet ein Textfeld gross — fast über das ganze Fenster.
 *
 * Die Felder im Arbeitsbereich sind bewusst niedrig: sonst sähe man
 * von einem Schritt nur zwei davon. Zum Schreiben eines langen
 * Verlaufs ist das zu wenig. Hier bekommt das Feld dieselbe Schrift
 * und denselben Zeilenabstand, aber die volle Fensterhöhe.
 *
 * Geschrieben wird dabei **laufend** in den Zustand, nicht erst beim
 * Schliessen. Es gibt deshalb kein „Übernehmen" und kein „Verwerfen" —
 * und keine Möglichkeit, eine halbe Stunde Arbeit mit der Esc-Taste zu
 * verlieren. Das ist derselbe Grundsatz wie im übrigen Programm:
 * getippt ist gespeichert.
 */
function grossOeffnen(feldId: string): void {
  const original = document.getElementById(feldId) as HTMLTextAreaElement | null;
  if (!original) return;

  const beschriftung = original
    .closest(".field")?.querySelector("label")?.childNodes[0]?.textContent?.trim()
    ?? "Feld bearbeiten";

  void dialog({
    title: beschriftung,
    breit: true,
    voll: true,
    cancel: "Schliessen",
    body: `
      <textarea id="gross_ta" class="gross-feld"
                placeholder="${esc(original.placeholder)}">${esc(original.value)}</textarea>
      <div class="field-fuss">
        <span class="field-balken" data-balken="${esc(feldId)}"><i></i></span>
        <span class="field-zaehler" data-zaehler="${esc(feldId)}"></span>
      </div>`,

    onOpen: (root) => {
      const gross = qs<HTMLTextAreaElement>("#gross_ta", root)!;
      const balken = qs<HTMLElement>(`[data-balken="${feldId}"]`, root);
      const zaehler = qs<HTMLElement>(`[data-zaehler="${feldId}"]`, root);

      const zeigeStand = (): void => {
        const stand = S.fuellstand(feldId, gross.value.length);
        const ziel = S.ZIELUMFANG[feldId];
        if (balken && stand) balken.dataset.stand = stand;
        if (zaehler) {
          zaehler.textContent = ziel
            ? `${gross.value.length} Zeichen · Ziel ${ziel.von}–${ziel.bis}`
            : `${gross.value.length} Zeichen`;
          zaehler.className = "field-zaehler"
            + (stand && stand !== "leer" && stand !== "gut" ? ` ist-${stand}` : "");
        }
      };

      on(gross, "input", () => {
        original.value = gross.value;
        S.setzeFeld(feldId, gross.value);
        aktualisiereZaehler(original);
        zeigeStand();
      });

      zeigeStand();
      // Die Schreibmarke ans Ende, nicht an den Anfang: wer ein Feld
      // gross öffnet, will meist weiterschreiben.
      gross.focus();
      gross.setSelectionRange(gross.value.length, gross.value.length);
    },
  });
}

export function bindeSchritt(n: number, neuZeichnen: () => void): void {
  // Alle einfachen Felder hängen am selben Zustandsschreiber.
  for (const node of qsa<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-feld]")) {
    const name = node.dataset.feld!;
    on(node, "input", () => { S.setzeFeld(name, node.value); aktualisiereZaehler(node); });
    on(node, "change", () => S.setzeFeld(name, node.value));
    aktualisiereZaehler(node);
  }

  // Die Antragsart ist das einzige Feld, das die Beschriftungen um sich
  // herum ändert. Ohne Neuzeichnen bliebe „Lfd. Nr. des Fortführungs-
  // antrags" stehen, obwohl gerade auf Umwandlung umgestellt wurde.
  const art = document.getElementById("f_antragsart");
  if (art) on(art, "change", () => neuZeichnen());

  for (const btn of qsa<HTMLButtonElement>("[data-bausteine]")) {
    on(btn, "click", () => { void bausteinDialog(btn.dataset.bausteine!, neuZeichnen); });
  }

  for (const btn of qsa<HTMLButtonElement>("[data-gross]")) {
    on(btn, "click", () => grossOeffnen(btn.dataset.gross!));
  }

  // Die Leitfaden-Blase: eine ist offen, nie zwei. Sie bleibt offen,
  // bis man sie wieder schliesst — beim Tippen soll man nachlesen
  // können, ohne die Hand von der Tastatur zu nehmen.
  for (const btn of qsa<HTMLButtonElement>("[data-leitfaden]")) {
    on(btn, "click", () => {
      const blase = document.getElementById(`lf_${btn.dataset.leitfaden}`);
      if (!blase) return;
      const auf = blase.hidden;
      for (const b of qsa<HTMLElement>(".lf-blase")) b.hidden = true;
      for (const z of qsa<HTMLElement>("[data-leitfaden]")) z.classList.remove("ist-auf");
      blase.hidden = !auf;
      btn.classList.toggle("ist-auf", auf);
    });
  }

  // Strg+Umschalt+E öffnet das Feld gross, in dem die Schreibmarke steht.
  for (const ta of qsa<HTMLTextAreaElement>("textarea[data-feld]")) {
    on(ta, "keydown", (e) => {
      const k = e as KeyboardEvent;
      if (!k.ctrlKey || !k.shiftKey || k.key.toLowerCase() !== "e") return;
      k.preventDefault();
      grossOeffnen(ta.id);
    });
  }

  for (const search of qsa<HTMLInputElement>(".icd10-search")) {
    on(search, "input", () => {
      if (!search.value) return;
      const targetId = search.id.replace("_search", "");
      const target = qs<HTMLTextAreaElement>(`#${targetId}`);
      if (target) {
        const matched = F_DIAGNOSEN.some(d => `${d.code} ${d.name}` === search.value);
        if (matched) {
          const val = target.value.trim();
          target.value = val ? val + "\n" + search.value : search.value;
          search.value = "";
          S.setzeFeld(targetId, target.value);
          aktualisiereZaehler(target);
          target.focus();
        }
      }
    });
  }

  if (n === 0) {
    zeigeWarnungen();
    const fa = document.getElementById("btnFolgeantrag");
    if (fa) on(fa, "click", () => { void folgeAntragAnlegen(neuZeichnen); });
  }
  if (n === 1) bindeSchritt2();
  if (n === 3) bindeSchritt4(neuZeichnen);
  if (n === 4) bindeSchritt5();
}

/**
 * Der Zähler unter einem Schreibfeld.
 *
 * Zeigt nicht nur, wie viel dasteht, sondern auch wie viel erwartet
 * wird. Ohne den Zielwert schreibt man entweder zu knapp — dann fehlt
 * Claude das Material — oder ins Uferlose.
 */
function aktualisiereZaehler(node: HTMLElement): void {
  const id = (node as HTMLInputElement).dataset.feld;
  if (!id) return;
  const z = qs<HTMLElement>(`[data-zaehler="${id}"]`);
  if (!z) return;

  const len = (node as HTMLTextAreaElement).value.length;
  const ziel = S.ZIELUMFANG[id];

  if (!ziel) {
    z.textContent = len ? `${len.toLocaleString("de-DE")} Zeichen` : "";
    z.className = "field-zaehler";
    return;
  }

  const stand = S.fuellstand(id, len);
  const spanne = ziel.von > 0
    ? `${ziel.von}–${ziel.bis}`
    : `bis ${ziel.bis}`;

  const wort =
    stand === "leer"      ? (ziel.hinweis ?? `etwa ${spanne} Zeichen`)
    : stand === "kurz"    ? `${len} von etwa ${spanne} — noch etwas knapp`
    : stand === "reichlich" ? `${len} Zeichen — reichlich, das ist in Ordnung`
    : `${len} von etwa ${spanne} Zeichen`;

  z.textContent = wort;
  z.className = `field-zaehler ist-${stand ?? "neutral"}`;

  // Ein schmaler Balken macht das Verhältnis auf einen Blick sichtbar.
  const balken = qs<HTMLElement>(`[data-balken="${id}"]`);
  if (balken) {
    const anteil = Math.min(100, Math.round((len / Math.max(1, ziel.bis)) * 100));
    balken.style.setProperty("--fuell", `${anteil}%`);
    balken.dataset.stand = stand ?? "neutral";
  }
}

function zeigeWarnungen(): void {
  const box = document.getElementById("warnungen");
  if (!box) return;
  const w = S.warnungen();
  box.innerHTML = w.length
    ? w.map((t) => `<div class="notice notice-warn" style="margin-top: var(--s4)">${esc(t)}</div>`).join("")
    : "";
}

function bindeSchritt2(): void {
  // Die Frage „liegt ein Vorbericht vor?" ist mit 2.7.0 entfallen.
  // Beim Fortführungsantrag muss es einen geben, sonst wäre es keine
  // Fortführung; beim Umwandlungsantrag kann es keinen geben. In
  // beiden Fällen hatte die Frage nur eine Antwort.
  const btnUpload = document.getElementById("btnUploadVorbericht");
  if (btnUpload) {
    on(btnUpload, "click", async () => {
      try {
        const file = await open({
          multiple: false,
          filters: [{ name: "Dokumente", extensions: ["pdf", "docx"] }],
        });
        if (file && typeof file === "string") {
          toast("Lese Datei aus …");
          const text = await api.extractReportText(file);
          if (text) {
            const ta = document.getElementById("f_lastreport") as HTMLTextAreaElement;
            const current = ta.value.trim();
            ta.value = current ? current + "\n\n" + text : text;
            S.setzeFeld("f_lastreport", ta.value);
            toast("Text erfolgreich eingefügt.", "ok");
          } else {
            toast("Kein Text in der Datei gefunden.", "info");
          }
        }
      } catch (e) {
        toast(api.errorText(e), "danger");
      }
    });
  }
}

// ---------------------------------------------------------------
// Schritt 4: der Aufruf
// ---------------------------------------------------------------

let abbruch = false;

function bindeSchritt4(neuZeichnen: () => void): void {
  const entwurf = el("entwurf");

  on(entwurf, "input", () => {
    S.setzeBericht(entwurf.innerText);
    const p = S.state.profile;
    if (p) zeigeZaehler(metrik(S.state.report, p));
  });

  // Einfügen nur als reiner Text — sonst gerät fremdes Markup in den
  // Entwurf und von dort in die Word-Ausgabe.
  entwurf.addEventListener("paste", (e) => {
    e.preventDefault();
    const t = (e as ClipboardEvent).clipboardData?.getData("text/plain") ?? "";
    document.execCommand("insertText", false, t);
  });

  on(el("btnFormulieren"), "click", () => { void formuliere("report", neuZeichnen); });
  on(el("btnAbbrechen"), "click", () => { abbruch = true; toast("Wird abgebrochen …"); });
  on(el("btnPromptZeigen"), "click", () => { void zeigePrompt(); });

  const btnKuerzen = document.getElementById("btnKuerzen");
  if (btnKuerzen) on(btnKuerzen, "click", () => { void formuliere("kuerzen", neuZeichnen); });
}

async function formuliere(
  kind: "report" | "expand" | "kuerzen",
  neuZeichnen: () => void,
): Promise<void> {
  const p = S.state.profile;
  if (!p) return;

  const entwurf = el("entwurf");
  const btn = el<HTMLButtonElement>("btnFormulieren");
  const btnAb = el<HTMLButtonElement>("btnAbbrechen");
  const b = S.state.budget;
  let nachkuerzen = false;

  // Der Klarname darf die Anfrage nicht erreichen. Rust prüft das noch
  // einmal, aber hier lässt sich früher und freundlicher warnen.
  const namen = klarnamen(S.state.fields);
  const art = S.antragsart();
  const system = systemPrompt(p, art);
  const user =
      kind === "expand"  ? expandPrompt(S.state.report, p)
    : kind === "kuerzen" ? kuerzePrompt(S.state.report, p, art)
    : userPrompt(S.state.fields, p);

  const treffer = await api.checkClearNames(`${system}\n${user}`, namen);
  if (treffer) {
    await dialog({
      title: "Klarname in der Anfrage",
      body: `<div class="notice notice-danger">
               Der Text enthält den Namen <b>${esc(treffer)}</b>. Klarnamen dürfen die
               Schnittstelle nicht erreichen. Rana hat deshalb nichts gesendet.
             </div>
             <p class="hint">Bitte die betroffene Stelle — meist die soziodemographische
             Zeile oder ein Verlaufsfeld — durch die Chiffre ersetzen.</p>`,
      cancel: "Verstanden",
    });
    return;
  }

  abbruch = false;
  btn.disabled = true;
  btnAb.classList.remove("hidden");

  if (kind === "report") entwurf.textContent = "";

  const progress = document.getElementById("formulierenProgress");
  const circle = document.getElementById("progressCircle") as HTMLElement | null;
  const pText = document.getElementById("progressText");
  if (progress) progress.classList.remove("hidden");

  const pZahl = document.getElementById("progressPct");
  if (pText) {
    pText.textContent = kind === "kuerzen" ? "Kürze auf zwei Seiten …" : "Formuliere …";
  }

  let gesammelt = "";
  const stopStream = await api.onStream((chunk) => {
    if (abbruch) return;
    gesammelt += chunk;
    entwurf.textContent = gesammelt;
    // Am Zielumfang gemessen, nicht an einer festen Zahl: beim
    // Umwandlungsbericht sind sieben Abschnitte zu schreiben.
    const fortschritt = Math.min(97, Math.round((gesammelt.length / p.layout.ziel_soll) * 100));
    if (circle) circle.style.width = `${fortschritt}%`;
    if (pZahl) pZahl.textContent = `${fortschritt} %`;
    // Mitlaufen lassen: der Blick bleibt am entstehenden Text.
    entwurf.scrollIntoView({ block: "end", behavior: "smooth" });
    zeigeZaehler(metrik(gesammelt, p));
  });

  try {
    const res = await api.generateReport({
      model: p.api.model,
      system,
      user,
      forbidden_names: namen,
      kind,
    });

    S.setzeBericht(res.text);
    entwurf.textContent = res.text;
    await S.speichereJetzt();
    await S.refreshBudget();

    const m = metrik(res.text, p);
    const kosten = res.cost_eur.toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const gespart = res.cached_tokens > 0 ? " · Regelteil aus dem Zwischenspeicher" : "";

    // Ein abgeschnittener Bericht sah aus wie ein fertiger. Wer den
    // Abbruch übersah, reichte einen halben Bericht ein — deshalb ist
    // das hier eine Warnung und keine Randbemerkung.
    if (res.stop_reason === "max_tokens") {
      toast(
        "Der Bericht ist unvollständig: Anthropic hat an der Längengrenze abgebrochen. "
        + "Bitte den Entwurf prüfen und noch einmal formulieren lassen.",
        "danger", 12000,
      );
    } else if (kind === "report" && m.urteil === "lang" && !abbruch && b?.may_send !== false) {
      // Der Leitfaden gibt zwei Seiten vor, und das Modell hält sie
      // aus eigener Kraft nicht ein — gemessen an den bisherigen
      // Berichten überzieht es regelmässig um vierzig Prozent. Rana
      // misst deshalb selbst und hängt die Kürzungsrunde an, statt
      // einen zu langen Entwurf als fertig hinzustellen.
      //
      // Die Runde läuft NICHT von hier aus, sondern nach dem
      // finally-Block: sonst liefe das Aufräumen der ersten Anfrage
      // erst nach der zweiten, und der Ereignishorcher hinge doppelt.
      nachkuerzen = true;
      toast(
        `${m.zeichen.toLocaleString("de-DE")} Zeichen — deutlich über zwei Seiten. Rana kürzt selbst nach.`,
        "info", 6000,
      );
    } else {
      toast(
        `Fertig. ${m.zeichen.toLocaleString("de-DE")} Zeichen, ${m.hinweis}. Kosten: ${kosten} €${gespart}`,
        m.urteil === "gut" ? "ok" : "info"
      );
    }

  } catch (e) {
    toast(api.errorText(e), "danger");
  } finally {
    if (progress) progress.classList.add("hidden");
    stopStream();
    btn.disabled = false;
    btnAb.classList.add("hidden");
    neuZeichnen(); window.dispatchEvent(new Event("bausteine-geandert"));
  }

  if (nachkuerzen) await formuliere("kuerzen", neuZeichnen);
}

async function zeigePrompt(): Promise<void> {
  const p = S.state.profile;
  if (!p) return;
  const system = systemPrompt(p, S.antragsart());
  const user = userPrompt(S.state.fields, p);

  await dialog({
    title: "Was an Anthropic übermittelt wird",
    cancel: "Schliessen",
    body: `
      <p class="hint">
        Genau dieser Text geht an die Schnittstelle — nichts weiter. Der obere Teil ist
        bei jedem Bericht gleich und wird zwischengespeichert; nur der untere ändert sich.
        Ein Klarname steht nirgends darin.
      </p>
      <div class="field">
        <label>Regeln <span class="field-note">${system.length.toLocaleString("de-DE")} Zeichen, zwischengespeichert</span></label>
        <textarea readonly spellcheck="false" style="min-height:170px;font-family:var(--face-record);font-size:var(--t-xs)">${esc(system)}</textarea>
      </div>
      <div class="field">
        <label>Falldaten <span class="field-note">${user.length.toLocaleString("de-DE")} Zeichen</span></label>
        <textarea readonly spellcheck="false" style="min-height:170px;font-family:var(--face-record);font-size:var(--t-xs)">${esc(user)}</textarea>
      </div>`,
  });
}

// ---------------------------------------------------------------
// Schritt 5: Ausgabe
// ---------------------------------------------------------------

function bindeSchritt5(): void {
  const p = S.state.profile!;
  const word = document.getElementById("btnWord");
  if (!word) return;

  // Bis 2.6.1 landete die Datei still im Download-Ordner. Jetzt fragt
  // der Speicherdialog des Systems, wohin — mit dem Dateinamen aus
  // Antragsart, Name und Datum als Vorschlag.
  on(word, "click", () => { void wordSichern(p); });

  on(el("btnPdf"), "click", () => pdfSichern());

  on(el("btnKopieren"), "click", () => {
    void navigator.clipboard.writeText(S.state.report);
    toast("Berichtstext kopiert.", "ok");
  });

  const ptv = document.getElementById("btnPtv2b");
  if (ptv) {
    on(ptv, "click", () => {
      const text = ptv2bZeilen().map(([k, v]) => `${k}: ${v}`).join("\n");
      void navigator.clipboard.writeText(text);
      toast("Angaben für das PTV 2b kopiert.", "ok");
    });
  }
}

/**
 * PDF-Ausgabe.
 *
 * Hier bin ich einen Kompromiss eingegangen, und der soll benannt sein:
 * Ein PDF von Hand zu erzeugen hiesse, das gesamte Layout samt
 * Schrifteinbettung ein zweites Mal zu bauen — mit dem Risiko, dass es
 * vom Word-Dokument abweicht. Stattdessen wird das fertige Dokument in
 * ein eigenes Fenster gesetzt und dessen PDF-Ausgabe benutzt. Unter
 * Windows steht dort „Microsoft Print to PDF“ bereits zur Wahl.
 *
 * Ergebnis: pixelgleich zur Vorschau, kein zweites Layout, das
 * auseinanderlaufen kann. Preis: ein Systemdialog.
 */
/**
 * Fragt, wohin die Word-Datei soll, und schreibt sie dorthin.
 *
 * Schlägt der Dialog fehl — etwa weil die Datei-Berechtigung im
 * Systempaket fehlt —, fällt Rana auf den alten Weg zurück, statt
 * gar nichts zu tun. Ein Bericht, der im Download-Ordner landet, ist
 * immer noch besser als einer, der verschwindet.
 */
async function wordSichern(p: api.Profile): Promise<void> {
  const blob = buildDocx(S.state.report, S.state.fields, p);
  const name = `${fileBase(S.state.fields)}.docx`;

  try {
    const ziel = await save({
      defaultPath: name,
      filters: [{ name: "Word-Dokument", extensions: ["docx"] }],
    });
    if (!ziel) return; // abgebrochen — das ist keine Störung
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await api.saveBytes(ziel, bytes);
    toast("Word-Datei gespeichert.", "ok");
  } catch (e) {
    download(blob, name);
    toast(`Speicherdialog nicht verfügbar (${api.errorText(e)}) — Datei im Download-Ordner abgelegt.`, "info", 8000);
  }
}

function pdfSichern(): void {
  const p = S.state.profile!;
  const html = renderDocHTML(S.state.report, S.state.fields, p, { footer: "none" });

  const rahmen = document.createElement("iframe");
  rahmen.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(rahmen);

  const doc = rahmen.contentDocument!;
  const stile = qsa<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style')
    .map((n) => n.outerHTML).join("");

  doc.open();
  doc.write(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
    <title>${esc(fileBase(S.state.fields))}</title>${stile}</head>
    <body class="pdf-root">${html}</body></html>`);
  doc.close();

  // Kurz warten, bis Schriften und Stile stehen — sonst bricht die
  // Seite an der falschen Stelle um.
  setTimeout(() => {
    rahmen.contentWindow?.focus();
    rahmen.contentWindow?.print();
    setTimeout(() => rahmen.remove(), 1500);
  }, 350);
}

// ---------------------------------------------------------------
// Textbausteine
// ---------------------------------------------------------------

async function bausteinDialog(feldId: string, neuZeichnen: () => void): Promise<void> {
  const liste = await api.listSnippets(feldId);

  await dialog({
    title: "Textbausteine",
    cancel: "Schliessen",
    body: `
      <p class="hint">
        Formulierungen, die immer wieder gebraucht werden. Ein Klick fügt sie an der
        Schreibmarke ein. Bausteine liegen verschlüsselt auf dem Gerät.
      </p>
      <div id="snipListe" style="display:flex;flex-direction:column;gap:6px">
        ${liste.length ? liste.map(([id, text]) => `
          <div class="row" style="gap:6px;align-items:flex-start">
            <button class="btn btn-sm" style="flex:1;justify-content:flex-start;text-align:left;white-space:normal"
                    data-einfuegen="${esc(text)}">${esc(text.length > 150 ? text.slice(0, 150) + " …" : text)}</button>
            <button class="btn btn-sm btn-danger btn-icon" data-loeschen="${esc(id)}"
                    aria-label="Baustein löschen">${icon.close}</button>
          </div>`).join("")
          : `<p class="hint">Noch keine Bausteine für dieses Feld.</p>`}
      </div>
      <div class="field">
        <label for="snipNeu">Neuen Baustein anlegen</label>
        <textarea id="snipNeu" placeholder="Text …" style="min-height:80px"></textarea>
      </div>
      <button class="btn btn-sm" id="snipSpeichern" style="align-self:flex-start">${icon.plus} Speichern</button>`,

    onOpen: (root) => {
      for (const b of qsa<HTMLButtonElement>("[data-einfuegen]", root)) {
        on(b, "click", () => {
          const ta = document.getElementById(feldId) as HTMLTextAreaElement | null;
          if (!ta) return;
          const pos = ta.selectionStart ?? ta.value.length;
          const vorher = ta.value.slice(0, pos);
          const nachher = ta.value.slice(ta.selectionEnd ?? pos);
          const luecke = vorher && !/\s$/.test(vorher) ? " " : "";
          ta.value = vorher + luecke + b.dataset.einfuegen + nachher;
          S.setzeFeld(feldId, ta.value);
          ta.focus();
          toast("Baustein eingefügt.", "ok", 2200);
        });
      }

      for (const b of qsa<HTMLButtonElement>("[data-loeschen]", root)) {
        on(b, "click", async () => {
          await api.deleteSnippet(b.dataset.loeschen!);
          b.parentElement?.remove();
          toast("Baustein gelöscht."); window.dispatchEvent(new Event("bausteine-geandert"));
        });
      }

      on(qs<HTMLElement>("#snipSpeichern", root)!, "click", async () => {
        const t = qs<HTMLTextAreaElement>("#snipNeu", root)!.value.trim();
        if (!t) return;
        await api.addSnippet(feldId, t);
        toast("Baustein gespeichert.", "ok");
        neuZeichnen(); window.dispatchEvent(new Event("bausteine-geandert"));
      });
    },
  });
}

// ---------------------------------------------------------------
// Fall löschen — mit Frist
// ---------------------------------------------------------------

/**
 * Fragt vor dem Anlegen nach — der laufende Fall bleibt erhalten,
 * aber ein unbeabsichtigter Sprung in einen neuen Fall ist trotzdem
 * verwirrend.
 */
async function folgeAntragAnlegen(neuZeichnen: () => void): Promise<void> {
  const name = (S.state.fields.f_name ?? "").trim();
  const nr = parseInt(S.state.fields.f_nr ?? "", 10);
  const naechste = isNaN(nr) ? 2 : nr + 1;

  const ok = await confirmDialog(
    "Folgeantrag anlegen",
    `Es entsteht der ${naechste}. Fortführungsantrag${name ? ` für ${name}` : ""}. `
      + "Stammdaten, Ausgangslage und Psychodynamik werden übernommen, "
      + "das bisher bewilligte Kontingent um die zuletzt beantragten Stunden erhöht. "
      + "Der jetzige Bericht wandert in das Vorbericht-Feld. Der laufende Fall bleibt unverändert.",
    "Anlegen"
  );
  if (!ok) return;

  await S.folgeAntrag();
  neuZeichnen(); window.dispatchEvent(new Event("bausteine-geandert"));
  toast(`${naechste}. Fortführungsantrag angelegt — Verlauf und Befund sind leer.`, "ok", 6000);
}

export async function fallInPapierkorb(id: string, label: string): Promise<boolean> {
  const ok = await confirmDialog(
    "In den Papierkorb legen",
    `„${label}“ wird in den Papierkorb gelegt und nach 30 Tagen endgültig entfernt. `
      + `Bis dahin lässt er sich jederzeit zurückholen.`,
    "In den Papierkorb"
  );
  if (!ok) return false;
  await api.trashCase(id);
  await S.refreshCases();
  toast("In den Papierkorb gelegt. Wiederherstellbar für 30 Tage.", "ok");
  return true;
}
