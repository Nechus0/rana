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
import { buildDocx } from "../report/docx";
import { expandPrompt, klarnamen, systemPrompt, userPrompt } from "../report/prompt";
import { fileBase, metrik, renderDocHTML } from "../report/render";
import * as S from "../core/state";
import { confirmDialog, dialog, download, el, esc, icon, on, qs, qsa, toast } from "../ui/kit";
import { open } from "@tauri-apps/plugin-dialog";

export const SCHRITTE = [
  { titel: "Fall-Stammdaten",           kurz: "Stammdaten" },
  { titel: "Letzter Bericht",            kurz: "Vorbericht" },
  { titel: "Verlauf und aktueller Stand", kurz: "Verlauf" },
  { titel: "Bericht formulieren",        kurz: "Formulieren" },
  { titel: "Ausgabe",                    kurz: "Ausgabe" },
];

// ---------------------------------------------------------------
// Feldbausteine
// ---------------------------------------------------------------

const f = (k: string) => S.state.fields[k] ?? "";

function input(id: string, label: string, opts: {
  typ?: string; ph?: string; note?: string; liste?: string[]; span?: number;
} = {}): string {
  const fehlt = S.PFLICHT.some((p) => p.feld === id) && !f(id).trim();
  const listId = opts.liste ? `${id}_list` : "";
  return `
    <div class="field ${fehlt ? "is-missing" : ""}" ${opts.span ? `style="grid-column: span ${opts.span}"` : ""}>
      <label for="${id}">${esc(label)}${opts.note ? ` <span class="field-note">${esc(opts.note)}</span>` : ""}</label>
      <input id="${id}" data-feld="${id}" type="${opts.typ ?? "text"}"
             value="${esc(f(id))}" placeholder="${esc(opts.ph ?? "")}"
             ${listId ? `list="${listId}"` : ""}>
      ${opts.liste ? `<datalist id="${listId}">${opts.liste.map((o) => `<option value="${esc(o)}"></option>`).join("")}</datalist>` : ""}
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
        <button class="btn btn-sm btn-quiet btn-icon" data-gross="${id}" type="button"
                title="Feld gross öffnen (Strg+Umschalt+E)"
                aria-label="Feld gross öffnen">${icon.gross}</button>
        ${opts.bausteine !== false
          ? `<button class="btn btn-sm btn-quiet" data-bausteine="${id}" type="button"
                     title="Eigene Textbausteine für dieses Feld">Bausteine</button>`
          : ""}
      </label>
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
  return gruppe(null, "Grunddaten des Falls", `
    <div class="grid-3">
      ${input("f_name", "Patient:in", { span: 3, note: "Klarname, nur zur Fallauswahl und für den Dateinamen. Steht nie im Bericht und geht nie an die Schnittstelle." })}
      ${input("f_chiffre", "Chiffre / Pseudonym", { ph: "A.M.-1974" })}
      ${input("f_nr", "Lfd. Nr. des Fortführungsantrags", { typ: "number", ph: "1", note: "je Antrag hochzählen" })}
      ${input("f_gebdatum", "Geburtsdatum", { typ: "date" })}
      ${input("f_beginn", "Therapiebeginn", { typ: "date", note: "Datum der ersten Sitzung" })}
      <div class="field">
        <label for="f_geschlecht">Geschlecht</label>
        <select id="f_geschlecht" data-feld="f_geschlecht">
          ${["", "weiblich", "männlich", "divers"].map((o) =>
            `<option value="${esc(o)}" ${f("f_geschlecht") === o ? "selected" : ""}>${o || "—"}</option>`).join("")}
        </select>
      </div>
      ${input("f_kasse", "Krankenkasse / Kostenträger", { span: 2, ph: "Beihilfe / AOK Niedersachsen" })}
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
      ${input("f_sozio", "Soziodemographische Angaben", {
        span: 3,
        note: "eine kurze Zeile im Berichtskopf — pseudonymisiert",
        ph: "Lehrerin, in Partnerschaft, keine Kinder",
      })}
    </div>
    <div id="warnungen"></div>
    <div class="row" style="margin-top: var(--s5)">
      <button class="btn" id="btnFolgeantrag" type="button"
              title="Legt den nächsten Antrag derselben Patientin an und übernimmt, was gleich bleibt">
        ${icon.plus} Folgeantrag aus diesem Fall
      </button>
      <span class="hint">Stammdaten, Ausgangslage und Psychodynamik werden übernommen.</span>
    </div>`);
}

// ===============================================================
// Schritt 2 · Vorbericht
// ===============================================================

function schritt2(): string {
  const hat = f("f_vorbericht") === "ja";
  return `
    <p class="hint" style="margin-bottom: var(--s5)">
      Dieser Schritt ist freiwillig. Ohne Vorbericht kann er übersprungen werden — die
      Angaben dienen nur als Hintergrund für die Formulierung und stehen nicht wörtlich
      im Bericht.
    </p>

    <label class="switch" style="margin-bottom: var(--s5)">
      <input type="checkbox" id="cbVorbericht" ${hat ? "checked" : ""}>
      <span class="switch-track"></span>
      <span>Ein Vorbericht liegt vor</span>
    </label>

    <div id="vorberichtBlock" class="${hat ? "" : "hidden"}">
      ${gruppe(null, "Text des letzten Berichts", `
        <div class="row" style="margin-bottom: var(--s3)">
          <button class="btn btn-sm" id="btnUploadVorbericht" type="button" title="Word (.docx) oder PDF laden">
            ${icon.word} Datei einlesen (Word / PDF)
          </button>
        </div>
        <div class="field">
          <label for="f_lastreport">
            Hier einfügen
            <span class="field-note">bleibt auf dem Gerät, geht nur als Hintergrund in die Formulierung</span>
          </label>
          <textarea id="f_lastreport" data-feld="f_lastreport" style="min-height:190px"
                    placeholder="Kompletten Text des letzten Berichts hier einfügen …">${esc(f("f_lastreport"))}</textarea>
        </div>`)}

      ${gruppe(null, "Vorgeschichte", `
        <p class="hint">
          Freiwillig. Dient als Hintergrund für die Formulierung und wird nicht wörtlich übernommen.
        </p>
        ${textarea("f_diag_alt", "Bisherige ICD-10-Diagnose(n)", { ph: "F33.1 rezidivierende depressive Störung, gegenwärtig mittelgradig …", icd10: true })}
        ${textarea("f_psychodyn", psychodynLabel(), { ph: psychodynPh() })}
        ${textarea("f_ziele_alt", "Zuletzt formulierte Therapieziele", { note: "Bezugspunkt für den Verlauf", ph: "Je Ziel eine Zeile …" })}`)}
    </div>`;
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
      ${textarea("f_begruendung", "Begründung und weitere Planung", { note: "Ziele, Methoden", ph: "Warum ist die Fortführung nötig? Weitere Planung, angepasste Ziele …" })}
      ${textarea("f_methoden", "Geänderte Behandlungsmethoden und -techniken", {
        note: "darf leer bleiben, dann gilt „unverändert“",
        ph: "Nur ausfüllen, wenn sich an Methoden oder Techniken etwas geändert hat …",
      })}
      ${textarea("f_prognose", "Prognose und geplanter Abschluss", { ph: "Günstige Faktoren, Veränderungshindernisse …" })}
      ${textarea("f_abschluss", "Planung des Therapieabschlusses", {
        note: "ggf. weiterführende Maßnahmen danach",
        ph: "Woran wird der Abschluss festgemacht? Was ist danach vorgesehen …",
      })}`)}`;
}

// ===============================================================
// Schritt 4 · Formulieren — der Kern
// ===============================================================

function schritt4(): string {
  const b = S.state.budget;
  const m = S.state.profile ? metrik(S.state.report, S.state.profile) : null;
  const offen = S.luecken();

  return `
    <p class="hint" style="margin-bottom: var(--s5)">
      Claude formuliert die drei Gliederungspunkte in freier Form. Briefkopf, Metabox,
      Überschriften und Unterschrift kommen in Schritt 5 automatisch dazu. Der Text
      unten ist danach direkt bearbeitbar.
    </p>

    ${offen.length ? `
      <div class="notice notice-warn" style="margin-bottom: var(--s5)">
        <b>${offen.length} ${offen.length === 1 ? "Angabe fehlt" : "Angaben fehlen"} noch.</b>
        Claude markiert die Stellen mit 【Bitte ergänzen】. Das Formulieren geht trotzdem —
        die Lücken lassen sich hinterher füllen.
      </div>` : ""}

    <div class="row row-wrap" style="margin-bottom: var(--s5)">
      <button class="btn btn-primary btn-lg" id="btnFormulieren"
              ${b && !b.may_send ? "disabled" : ""}>
        ${icon.wand} Bericht formulieren
      </button>
      <button class="btn hidden" id="btnAbbrechen">${icon.stop} Abbrechen</button>
      <span class="spacer"></span>
      <button class="btn btn-quiet btn-sm" id="btnPromptZeigen">Anfrage ansehen</button>
    </div>

    <div class="progress-ring-container hidden" id="formulierenProgress">
      <div class="progress-ring">
        <svg viewBox="0 0 36 36" class="progress-ring-svg">
          <circle class="progress-ring-bg" cx="18" cy="18" r="15.9" />
          <circle class="progress-ring-fill" cx="18" cy="18" r="15.9"
                  stroke-dasharray="100" stroke-dashoffset="100" id="progressCircle" />
        </svg>
        <span class="progress-ring-text" id="progressText">Formuliere …</span>
      </div>
    </div>

    ${b && !b.may_send ? `
      <div class="notice notice-danger" style="margin-bottom: var(--s5)">
        <b>Rana sendet gerade nichts.</b>
        ${b.today_reports >= b.daily_limit
          ? `Das Tageslimit von ${b.daily_limit} Berichten ist erreicht.`
          : `Das Monatsbudget von ${b.month_limit_eur.toLocaleString("de-DE")} € ist ausgeschöpft.`}
        Unter „Einstellungen → Verbrauch“ lässt sich die Grenze anheben.
      </div>` : ""}

    <div class="field" style="margin-bottom:6px">
      <label>
        Entwurf
        <span class="field-note">direkt bearbeitbar</span>
        <span class="spacer"></span>
        <span class="record-num small" id="berichtZaehler">${m ? zaehlerText(m) : ""}</span>
      </label>
    </div>
    <div class="paper-tray">
      <div class="paper-sheet" id="entwurf" contenteditable="true" spellcheck="true"
           role="textbox" aria-multiline="true" aria-label="Berichtsentwurf, bearbeitbar"
           >${esc(S.state.report)}</div>
    </div>`;
}

function zaehlerText(m: ReturnType<typeof metrik>): string {
  const farbe = m.urteil === "gut" ? "var(--moss)" : m.urteil === "kurz" ? "var(--amber)" : "var(--brick)";
  return `<span style="color:${farbe}">${m.zeichen.toLocaleString("de-DE")} Zeichen</span>`
    + ` <span class="muted">· ${m.woerter.toLocaleString("de-DE")} Wörter · ${esc(m.hinweis)}</span>`
    + (m.luecken ? ` <span style="color:var(--amber)">· ${m.luecken} offen</span>` : "");
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

      ${gruppe(null, "Beiblatt PTV 2b", `
        <p class="hint">Angaben für das PTV 2b — zum Kopieren.</p>
        <div class="paper-tray" style="padding: var(--s4)">
          <table style="width:100%;border-collapse:collapse;font-size:var(--t-sm)" class="selectable">
            ${ptv2bZeilen().map(([k, v]) => `
              <tr>
                <td style="padding:6px 14px 6px 0;color:var(--reed);white-space:nowrap;vertical-align:top;
                           font-family:var(--face-record);font-size:var(--t-xs);letter-spacing:.06em;text-transform:uppercase">${esc(k)}</td>
                <td style="padding:6px 0;vertical-align:top">${esc(v)}</td>
              </tr>`).join("")}
          </table>
        </div>
        <button class="btn btn-sm" id="btnPtv2b" style="align-self:flex-start">${icon.copy} Angaben kopieren</button>`)}
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

  for (const btn of qsa<HTMLButtonElement>("[data-bausteine]")) {
    on(btn, "click", () => { void bausteinDialog(btn.dataset.bausteine!, neuZeichnen); });
  }

  for (const btn of qsa<HTMLButtonElement>("[data-gross]")) {
    on(btn, "click", () => grossOeffnen(btn.dataset.gross!));
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
  const cb = document.getElementById("cbVorbericht") as HTMLInputElement | null;
  if (!cb) return;
  on(cb, "change", () => {
    S.setzeFeld("f_vorbericht", cb.checked ? "ja" : "nein");
    // Zuklappen heisst nur ausblenden — eingetragene Texte bleiben erhalten.
    el("vorberichtBlock").classList.toggle("hidden", !cb.checked);
  });

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
    if (p) el("berichtZaehler").innerHTML = zaehlerText(metrik(S.state.report, p));
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
}

async function formuliere(kind: "report" | "expand", neuZeichnen: () => void): Promise<void> {
  const p = S.state.profile;
  if (!p) return;

  const entwurf = el("entwurf");
  const btn = el<HTMLButtonElement>("btnFormulieren");
  const btnAb = el<HTMLButtonElement>("btnAbbrechen");

  // Der Klarname darf die Anfrage nicht erreichen. Rust prüft das noch
  // einmal, aber hier lässt sich früher und freundlicher warnen.
  const namen = klarnamen(S.state.fields);
  const system = systemPrompt(p);
  const user = kind === "expand" ? expandPrompt(S.state.report, p) : userPrompt(S.state.fields, p);

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
  const circle = document.getElementById("progressCircle") as SVGCircleElement | null;
  const pText = document.getElementById("progressText");
  if (progress) progress.classList.remove("hidden");

  let gesammelt = kind === "expand" ? "" : "";
  const stopStream = await api.onStream((chunk) => {
    if (abbruch) return;
    gesammelt += chunk;
    entwurf.textContent = gesammelt;
    const zielZeichen = 4000;
    const fortschritt = Math.min(95, Math.round((gesammelt.length / zielZeichen) * 100));
    if (circle) circle.style.strokeDashoffset = String(100 - fortschritt);
    if (pText) pText.textContent = `${fortschritt} %`;
    // Mitlaufen lassen: der Blick bleibt am entstehenden Text.
    entwurf.scrollIntoView({ block: "end", behavior: "smooth" });
    el("berichtZaehler").innerHTML = zaehlerText(metrik(gesammelt, p));
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
    toast(
      `Fertig. ${m.zeichen.toLocaleString("de-DE")} Zeichen, ${m.hinweis}. Kosten: ${kosten} €${gespart}`,
      m.urteil === "gut" ? "ok" : "info"
    );

  } catch (e) {
    toast(api.errorText(e), "danger");
  } finally {
    if (progress) progress.classList.add("hidden");
    stopStream();
    btn.disabled = false;
    btnAb.classList.add("hidden");
    neuZeichnen();
  }
}

async function zeigePrompt(): Promise<void> {
  const p = S.state.profile;
  if (!p) return;
  const system = systemPrompt(p);
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

  on(word, "click", () => {
    const blob = buildDocx(S.state.report, S.state.fields, p);
    download(blob, `${fileBase(S.state.fields)}.docx`);
    toast("Word-Datei gesichert.", "ok");
  });

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
                    aria-label="Baustein löschen">${icon.trash}</button>
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
          toast("Baustein gelöscht.");
        });
      }

      on(qs<HTMLElement>("#snipSpeichern", root)!, "click", async () => {
        const t = qs<HTMLTextAreaElement>("#snipNeu", root)!.value.trim();
        if (!t) return;
        await api.addSnippet(feldId, t);
        toast("Baustein gespeichert.", "ok");
        neuZeichnen();
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
  neuZeichnen();
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
