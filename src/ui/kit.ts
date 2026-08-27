/**
 * Kleines Baukasten-Modul: Bausteine, die überall gebraucht werden.
 *
 * Bewusst ohne Rahmenwerk. Die Anwendung hat fünf Schritte und einen
 * Assistenten; dafür ein Rahmenwerk aufzuziehen würde die Anwendung
 * grösser und den Start langsamer machen, ohne etwas zu gewinnen.
 */

// ---------------------------------------------------------------
// DOM
// ---------------------------------------------------------------

export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const n = document.getElementById(id);
  if (!n) throw new Error(`Element „${id}“ fehlt.`);
  return n as T;
}

export const qs = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);

export const qsa = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

/** Text so einsetzen, dass er nie als Markup gelesen wird. */
export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function on<K extends keyof HTMLElementEventMap>(
  node: Element | Document | Window,
  type: K,
  fn: (e: HTMLElementEventMap[K]) => void
): void {
  node.addEventListener(type, fn as EventListener);
}

/** Ereignisse, die erst nach einer Ruhepause auslösen (Tippen, Suchen). */
export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms = 300) {
  let t: number | undefined;
  return (...a: A) => {
    if (t) clearTimeout(t);
    t = window.setTimeout(() => fn(...a), ms);
  };
}

// ---------------------------------------------------------------
// Zeichen
// ---------------------------------------------------------------

const svg = (d: string, extra = "") =>
  `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" `
  + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${extra}</svg>`;

export const icon = {
  plus:    svg('<path d="M10 4v12M4 10h12"/>'),
  search:  svg('<circle cx="9" cy="9" r="5.2"/><path d="M13 13l4 4"/>'),
  trash:   svg('<path d="M4 6h12M8.5 6V4.5h3V6M6 6l.8 9.5h6.4L14 6"/>'),
  restore: svg('<path d="M4 10a6 6 0 1 0 2-4.5"/><path d="M3.5 3.5V7H7"/>'),
  gear:    svg('<circle cx="10" cy="10" r="2.6"/><path d="M10 3v1.6M10 15.4V17M17 10h-1.6M4.6 10H3M14.9 5.1l-1.1 1.1M6.2 13.8l-1.1 1.1M14.9 14.9l-1.1-1.1M6.2 6.2L5.1 5.1"/>'),
  save:    svg('<path d="M4 4h9l3 3v9H4z"/><path d="M7 4v4h5V4M7 16v-4h6v4"/>'),
  word:    svg('<path d="M5 3h7l3 3v11H5z"/><path d="M12 3v3h3"/><path d="M7.2 10l1 4 1.3-3 1.3 3 1-4"/>'),
  pdf:     svg('<path d="M5 3h7l3 3v11H5z"/><path d="M12 3v3h3"/><path d="M7.5 14v-4h1.2a1.2 1.2 0 0 1 0 2.4H7.5"/>'),
  copy:    svg('<rect x="7" y="7" width="9" height="9" rx="1.4"/><path d="M13 7V5.4A1.4 1.4 0 0 0 11.6 4H5.4A1.4 1.4 0 0 0 4 5.4v6.2A1.4 1.4 0 0 0 5.4 13H7"/>'),
  wand:    svg('<path d="M4 16l8-8M13.5 3.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"/><path d="M15.5 11.2l.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5z"/>'),
  stop:    svg('<rect x="5.5" y="5.5" width="9" height="9" rx="1.4"/>'),
  chart:   svg('<path d="M4 16V9M8.7 16V4M13.3 16v-5M18 16V7"/>'),
  archive: svg('<rect x="3.5" y="5" width="13" height="3" rx="1"/><path d="M5 8v7.5h10V8M8.2 11h3.6"/>'),
  back:    svg('<path d="M11.5 5L6.5 10l5 5"/>'),
  fwd:     svg('<path d="M8.5 5l5 5-5 5"/>'),
  moon:    svg('<path d="M15.5 11.4A6 6 0 0 1 8.6 4.5a6 6 0 1 0 6.9 6.9z"/>'),
  check:   svg('<path d="M4.5 10.5l3.5 3.5 7.5-8"/>'),
  warn:    svg('<path d="M10 3.5l7 12.5H3z"/><path d="M10 8v3.4M10 13.6v.1"/>'),
  info:    svg('<circle cx="10" cy="10" r="7"/><path d="M10 9v4.5M10 6.6v.1"/>'),
  sortDown: svg('<path d="M10 4v12M6 12l4 4 4-4"/>'),
  key:     svg('<circle cx="7" cy="10" r="3"/><path d="M10 10h7M14.5 10v2.4M16.6 10v1.8"/>'),
  // Zeigt nach rechts; aufgeklappt dreht ihn die Formatvorlage.
  caret:   svg('<path d="M8 5.5l4.5 4.5L8 14.5"/>'),
  person:  svg('<circle cx="10" cy="7" r="3"/><path d="M4.5 16.5a5.5 5.5 0 0 1 11 0"/>'),
  close:   svg('<path d="M6 6l8 8M14 6l-8 8"/>'),
  merge:   svg('<path d="M5 4v4a4 4 0 0 0 4 4h6"/><path d="M5 16v-2"/><path d="M12.5 9.5L15 12l-2.5 2.5"/>'),
  dots:    svg('<circle cx="10" cy="5" r="1.3" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="10" cy="15" r="1.3" fill="currentColor" stroke="none"/>'),
  panelL:  svg('<path d="M3 4h5v12H3zM10 4h7M10 8h7M10 12h5"/>'),
  panelR:  svg('<path d="M12 4h5v12h-5zM3 4h7M3 8h7M3 12h5"/>'),

  // Die drei Fensterknöpfe. Bewusst in den Strichstärken von Windows
  // gehalten — sie sollen wie Systemknöpfe wirken, nicht wie Zierrat.
  winMin:   svg('<path d="M5 10h10"/>'),
  winMax:   svg('<rect x="5.5" y="5.5" width="9" height="9" rx="1"/>'),
  winRest:  svg('<rect x="7" y="4.5" width="8" height="8" rx="1"/><path d="M12.5 15.5h-7a1 1 0 0 1-1-1v-7"/>'),
  winClose: svg('<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>'),

  // Vier nach aussen zeigende Ecken: das Feld gross öffnen.
  gross:   svg('<path d="M8 4H4v4M12 4h4v4M8 16H4v-4M12 16h4v-4"/>'),
};

// ---------------------------------------------------------------
// Meldungen
// ---------------------------------------------------------------

type ToastKind = "info" | "ok" | "danger";

export function toast(text: string, kind: ToastKind = "info", ms = 5200): void {
  const box = document.getElementById("toasts");
  if (!box) return;

  const t = document.createElement("div");
  t.className = "toast" + (kind === "ok" ? " is-ok" : kind === "danger" ? " is-danger" : "");
  t.innerHTML = `<span style="flex:1">${esc(text)}</span>`
    + `<button class="toast-close" aria-label="Meldung schliessen">×</button>`;

  const close = () => {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 200);
  };
  qs("button", t)!.addEventListener("click", close);
  box.appendChild(t);

  // Fehlermeldungen bleiben länger stehen — sie enthalten meist eine
  // Handlungsanweisung, die gelesen werden muss.
  setTimeout(close, kind === "danger" ? ms * 2 : ms);
}

// ---------------------------------------------------------------
// Dialoge
// ---------------------------------------------------------------

export interface DialogOpts {
  title: string;
  body: string;
  /** Breiter Dialog für Ansichten mit seitlichem Verzeichnis. */
  breit?: boolean;
  /** Nimmt fast das ganze Fenster ein — zum Schreiben langer Texte. */
  voll?: boolean;
  /** Beschriftung des bestätigenden Knopfes. */
  confirm?: string;
  cancel?: string;
  danger?: boolean;
  /** Wird nach dem Aufbau aufgerufen, um Felder vorzubelegen. */
  onOpen?: (root: HTMLElement) => void;
  /** Gibt false zurück, um den Dialog offen zu lassen. */
  onConfirm?: (root: HTMLElement) => boolean | Promise<boolean>;
}

export function dialog(opts: DialogOpts): Promise<boolean> {
  return new Promise((resolve) => {
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.setAttribute("role", "dialog");
    scrim.setAttribute("aria-modal", "true");
    scrim.setAttribute("aria-label", opts.title);

    scrim.innerHTML = `
      <div class="dialog${opts.breit ? " dialog-breit" : ""}${opts.voll ? " dialog-voll" : ""}">
        <div class="dialog-head"><h3>${esc(opts.title)}</h3></div>
        <div class="dialog-body">${opts.body}</div>
        <div class="dialog-foot">
          <button class="btn" data-cancel>${esc(opts.cancel ?? "Abbrechen")}</button>
          ${opts.confirm
            ? `<button class="btn ${opts.danger ? "btn-danger" : "btn-primary"}" data-ok>${esc(opts.confirm)}</button>`
            : ""}
        </div>
      </div>`;

    const root = scrim.querySelector<HTMLElement>(".dialog")!;
    document.body.appendChild(scrim);

    const close = (v: boolean) => {
      document.removeEventListener("keydown", onKey);
      scrim.remove();
      resolve(v);
    };

    // Tastaturbedienung: Escape schliesst, Tab bleibt im Dialog.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(false); return; }
      if (e.key !== "Tab") return;
      const f = qsa<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        root
      ).filter((n) => !n.hasAttribute("disabled"));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);

    qs("[data-cancel]", root)!.addEventListener("click", () => close(false));
    scrim.addEventListener("click", (e) => { if (e.target === scrim) close(false); });

    const okBtn = qs<HTMLButtonElement>("[data-ok]", root);
    okBtn?.addEventListener("click", async () => {
      if (opts.onConfirm) {
        okBtn.disabled = true;
        const proceed = await opts.onConfirm(root);
        okBtn.disabled = false;
        if (!proceed) return;
      }
      close(true);
    });

    opts.onOpen?.(root);
    // Der Fokus geht auf das erste Feld, sonst auf den bestätigenden Knopf.
    (qs<HTMLElement>("input, textarea, select", root) ?? okBtn ?? qs<HTMLElement>("[data-cancel]", root))?.focus();
  });
}

/** Kurze Rückfrage ohne Eingabefelder. */
export const confirmDialog = (title: string, text: string, confirm = "Ja", danger = false) =>
  dialog({ title, body: `<p class="hint">${esc(text)}</p>`, confirm, danger });

// ---------------------------------------------------------------
// Zahlen und Datum
// ---------------------------------------------------------------

export const eur = (n: number) =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

export function relDate(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const tage = Math.floor((Date.now() - ms) / 86_400_000);
  if (tage === 0) return "heute";
  if (tage === 1) return "gestern";
  if (tage < 7) return `vor ${tage} Tagen`;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ---------------------------------------------------------------
// Datei anbieten
// ---------------------------------------------------------------

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
