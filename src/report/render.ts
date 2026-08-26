/**
 * Vom Rohtext zum gesetzten Bericht.
 *
 * Diese Datei ist die Übernahme der Aufbereitung aus dem
 * Vorgängerprogramm. Sie wurde dort über viele echte Berichte hinweg
 * geschliffen und fängt eine Menge ab, was Sprachmodelle beim
 * Formatieren anstellen: verklebte Aufzählungen, verlorene
 * Absatzumbrüche, erfundene Zwischenüberschriften, angehängte
 * Nachbemerkungen.
 *
 * Geändert wurde nur die Anbindung: statt aus Formularfeldern des
 * Fensters zu lesen, bekommt jede Funktion die Daten übergeben. Die
 * Erkennungsregeln selbst sind unangetastet — sie zu „verbessern“
 * wäre der schnellste Weg, funktionierende Ausgabe zu zerstören.
 */

import type { Felder, Profile } from "../core/ipc";
import { verfahrenZeile } from "./prompt";

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/**
 * Die Überschriften im fertigen Bericht.
 *
 * Wortlaut nach dem Leitfaden (Muster PTV 3, Version 4.2017). Sie
 * muessen mit den Überschriften uebereinstimmen, die der Prompt vom
 * Modell verlangt — siehe PROMPT_TITLES weiter unten.
 */
export const ABSCHNITTE = [
  "Behandlungsverlauf seit dem letzten Bericht und Erreichung der Therapieziele",
  "Aktuelle Diagnosen gemäß ICD-10 und aktueller psychischer Befund",
  "Begründung der Fortführung, weitere Therapieplanung und Prognose",
];

// ---------------------------------------------------------------
// Werkzeug
// ---------------------------------------------------------------

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function dateLong(d = new Date()): string {
  return `${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDate(iso: string): string {
  if (!iso) return iso;
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso;
}

/** „(38 Jahre)“ hinter dem Geburtsdatum. */
export function ageSuffix(iso: string): string {
  if (!iso) return "";
  const b = new Date(iso);
  if (isNaN(b.getTime())) return "";
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a > 0 && a < 130 ? ` (${a} Jahre)` : "";
}

/** Offene Pflichtangaben sichtbar machen. */
function highlightPH(html: string): string {
  return html.replace(/【\s*([^】]*?)\s*】/g, (_m, inner: string) => {
    const t = inner.replace(/^BITTE ERG[ÄA]NZEN/i, "Bitte ergänzen");
    return `<span class="doc-ph">${t}</span>`;
  });
}

// ---------------------------------------------------------------
// Beschriftungen
// ---------------------------------------------------------------

/**
 * NUR diese Beschriftungen werden als Überschrift gesetzt. Alles andere
 * bleibt normaler Text.
 *
 * Ohne diese feste Liste würde jeder gewöhnliche Satz mit einem frühen
 * Doppelpunkt zur Überschrift („Die berufliche Wiedereingliederung
 * gelang: …“) — im Bericht ist das eindeutig Fließtext.
 */
const DOC_LABELS: { re: RegExp; out: string }[] = [
  { re: /^(zusammenfassung|zusammenfassend)$/i, out: "Zusammenfassung" },
  { re: /^diagnosen?(\(n\))?$/i,     out: "Diagnose(n)" },
  { re: /^psychischer befund$/i,     out: "Psychischer Befund" },
  { re: /^somatischer befund$/i,     out: "Somatischer Befund" },
  { re: /^methodi?k? und setting$/i, out: "Methodik und Setting" },
  { re: /^prognose$/i,               out: "Prognose" },
];

export function splitLabel(text: string): { label: string; rest: string } | null {
  const m = String(text ?? "").match(/^\s*([^:<\n]{2,40}):\s+([\s\S]*)$/);
  if (!m) return null;
  const raw = m[1].trim();
  for (const l of DOC_LABELS) {
    if (l.re.test(raw)) return { label: l.out, rest: m[2] };
  }
  return null;
}

// ---------------------------------------------------------------
// Aufzählungen
// ---------------------------------------------------------------

export interface Liste { lead: string; items: string[]; ordered: boolean }

/**
 * Erkennt Aufzählungen. Punktzeichen (•, –, *) ergeben eine Liste mit
 * Aufzählungspunkten, Ziffern eine nummerierte Liste.
 */
export function toList(block: string): Liste | null {
  if (/(^|\n)\s*[•–—*-]\s+/.test(block)) {
    const lines = block.split(/\n/);
    const lead: string[] = [];
    const items: string[] = [];
    let started = false;
    for (const l of lines) {
      const mm = l.match(/^\s*[•–—*-]\s+(.*)$/);
      if (mm) { started = true; items.push(mm[1].trim()); }
      else if (!started) { lead.push(l); }
      else if (items.length) { items[items.length - 1] += " " + l.trim(); }
    }
    if (items.length >= 2) return { lead: lead.join(" ").trim(), items, ordered: false };
  }

  if (/(^|\n)\s*\d+[.)]\s+/.test(block)) {
    const lines = block.split(/\n/);
    const lead: string[] = [];
    const items: string[] = [];
    let started = false, ended = false;
    for (const l of lines) {
      if (ended) continue;
      const mm = l.match(/^\s*\d+[.)]\s+(.*)$/);
      if (mm) { started = true; items.push(mm[1].trim()); }
      else if (!started) { lead.push(l); }
      else if (splitLabel(l)) { ended = true; }   // Beschriftung beendet die Aufzählung
      else if (items.length) { items[items.length - 1] += " " + l.trim(); }
    }
    if (items.length >= 2) return { lead: lead.join(" ").trim(), items, ordered: true };
  }

  // Ziele in der Form „(1) … (2) …“
  const idx = block.search(/\(1\)/);
  if (idx >= 0) {
    const lead = block.slice(0, idx).trim();
    const rest = block.slice(idx);
    const items: string[] = [];
    const re = /\((\d+)\)\s*([\s\S]*?)(?=\(\d+\)|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest))) items.push(m[2].trim().replace(/\s+/g, " "));
    if (items.length >= 2) return { lead, items, ordered: true };
  }
  return null;
}

// ---------------------------------------------------------------
// Absätze
// ---------------------------------------------------------------

const ABKUERZUNG = /(?:^|\s)(?:Dr|Prof|Nr|Abs|Art|Bd|Hr|Fr|St|Jh|Ziff)$/;

/**
 * Absatzumbrüche wiederherstellen.
 *
 * Das bearbeitbare Feld verschluckt beim Zurücklesen regelmäßig
 * Leerzeilen, wodurch Sätze aneinanderkleben
 * („…Selbstvertrauen.Ein zentraler…“). Es wird nur dort eingegriffen,
 * wo gar kein Leerzeichen steht — das ist immer ein verlorener
 * Umbruch, nie normale Tippweise.
 */
function repairBreaks(t: string): string {
  return String(t ?? "").replace(
    /([a-zäöüß]{2,}|[0-9])\.(?=[A-ZÄÖÜ])/g,
    (m, pre: string, off: number, s: string) => {
      if (ABKUERZUNG.test(s.slice(Math.max(0, off - 12), off + pre.length))) return m;
      return pre + ".\n";
    }
  );
}

/**
 * Absätze bestimmen: Leerzeilen trennen; innerhalb eines Blocks trennt
 * auch ein einzelner Umbruch — außer der Block ist eine Aufzählung.
 */
export function splitParas(txt: string): string[] {
  const out: string[] = [];
  for (const chunk of repairBreaks(txt).split(/\n{2,}/)) {
    if (!chunk.trim()) continue;
    if (toList(chunk)) { out.push(chunk); continue; }
    for (const l of chunk.split(/\n/)) if (l.trim()) out.push(l);
  }
  return out;
}

function renderProse(txt: string): string {
  if (!txt) return "";
  let out = "";
  for (let b of splitParas(txt)) {
    b = b.trim();
    if (!b) continue;

    const lst = toList(b);
    if (lst) {
      if (lst.lead) out += `<p class="doc-p">${highlightPH(esc(lst.lead).replace(/\n/g, " "))}</p>`;
      const tag = lst.ordered ? "ol" : "ul";
      const cls = lst.ordered ? "doc-ol" : "doc-ul";
      out += `<${tag} class="${cls}">`;
      for (const it of lst.items) out += `<li>${highlightPH(esc(it))}</li>`;
      out += `</${tag}>`;
      continue;
    }

    const lab = splitLabel(b);
    if (lab) {
      out += `<p class="doc-p"><span class="doc-lead">${esc(lab.label)}</span> `
           + `${highlightPH(esc(lab.rest).replace(/\n/g, " "))}</p>`;
      continue;
    }

    out += `<p class="doc-p">${highlightPH(esc(b).replace(/\n/g, " "))}</p>`;
  }
  return out;
}

// ---------------------------------------------------------------
// Verklebtes trennen
// ---------------------------------------------------------------

/**
 * Aufzählungszeichen und Beschriftungen, die ohne Zeilenumbruch am
 * Vortext kleben („…Konflikte• Vollständige…“), auf eigene Zeilen
 * setzen. Ohne das greift die Aufzählung nicht.
 */
function ungluelines(raw: string): string {
  let r = String(raw ?? "").replace(/([^\n])\s*[•▪]\s*/g, "$1\n• ");

  // Angeklebte Ziffern einer Aufzählung („…ziele:1. Aufarbeitung…“).
  // Nur wenn die Ziffer unmittelbar auf einen Buchstaben oder
  // Doppelpunkt folgt — so bleiben ICD-Codes wie „F34.1“ und Angaben
  // wie „36 Sitzungen“ unangetastet.
  r = r.replace(/([a-zäöüßA-ZÄÖÜ:])(\d{1,2})\.\s+(?=[A-ZÄÖÜ])/g, "$1\n$2. ");

  const namen = "Zusammenfassung|Zusammenfassend|Diagnose\\(n\\)|Diagnosen|"
              + "Psychischer Befund|Somatischer Befund|Methodik und Setting|"
              + "Methode und Setting|Prognose";
  // Leerzeile davor, damit die Beschriftung ein eigener Absatz wird und
  // nicht in eine davorstehende Aufzählung hineingezogen wird.
  r = r.replace(new RegExp(`([^\\n])\\s*(${namen}):\\s+`, "g"), "$1\n\n$2: ");
  return r;
}

/**
 * Zerlegt mehrere Ziele, die in einer Zeile aneinanderkleben
 * („1. Ziel A werden.2. Ziel B werden.“), in einzelne Zeilen.
 * Getrennt wird nur am Satzende und nie hinter einer Ziffer — so
 * bleiben Angaben wie „F34.1“ unangetastet.
 */
function splitInlineGoals(s: string): string[] {
  const str = String(s ?? "");
  const re = /\d{1,2}\.\s+(?=[A-ZÄÖÜ])/g;
  const idx: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(str))) {
    const before = str.slice(0, m.index);
    if (m.index === 0 || (/[.)]\s*$/.test(before) && !/\d\.\s*$/.test(before))) {
      idx.push(m.index);
    }
  }
  if (idx.length < 2) return [str];
  const out: string[] = [];
  for (let i = 0; i < idx.length; i++) {
    out.push(str.slice(idx[i], i + 1 < idx.length ? idx[i + 1] : str.length).trim());
  }
  return out.filter(Boolean);
}

/** Die Behandlungsziele durchnummerieren, was immer davor stand. */
function numberGoals(raw: string): string {
  // Nur eine echte Abschnittsüberschrift beendet die Aufzählung — nicht
  // ein Ziel, das das Modell versehentlich nummeriert hat.
  const SECLINE = /^[123][.)]\s+(Bisher|Aktuelle|Begründ)/i;
  const lines = String(raw ?? "").split(/\n/);
  const out: string[] = [];
  let inGoals = false, n = 0;

  for (const l of lines) {
    const t = l.trim();

    if (inGoals) {
      if (!t || splitLabel(t) || SECLINE.test(t)) { inGoals = false; n = 0; out.push(l); continue; }
      for (let g of splitInlineGoals(t)) {
        g = g.trim();
        if (!g) continue;
        n++;
        out.push(`${n}. ${g.replace(/^([•▪–—*-]|\d+[.)])\s+/, "")}`);
      }
      continue;
    }

    out.push(l);

    // Auch eine Zeile, die auf „Behandlungsziele:“ endet und die Ziele
    // gleich angeklebt enthält, leitet die Aufzählung ein.
    const cue = t.match(/^(.*behandlungsziele\s*:)\s*(\S[\s\S]*)$/i);
    if (cue) {
      out[out.length - 1] = cue[1];
      inGoals = true; n = 0;
      for (let g of splitInlineGoals(cue[2].trim())) {
        g = g.trim();
        if (!g) continue;
        n++;
        out.push(`${n}. ${g.replace(/^([•▪–—*-]|\d+[.)])\s+/, "")}`);
      }
      continue;
    }
    if (/behandlungsziele\s*:\s*$/i.test(t)) { inGoals = true; n = 0; }
  }
  return out.join("\n");
}

// ---------------------------------------------------------------
// Die drei Abschnitte herauslösen
// ---------------------------------------------------------------

/**
 * Die Überschriften, die das Modell ausgibt — je Abschnitt mehrere
 * Schreibweisen.
 *
 * Der erste Eintrag ist der aktuelle Wortlaut aus dem Prompt. Die
 * weiteren sind die Fassungen bis Version 1.0.0: Berichte, die davor
 * gespeichert wurden, sollen sich unveraendert oeffnen lassen, ohne
 * dass ihre alte Überschrift als Text im Absatz stehen bleibt.
 */
const PROMPT_TITLES: string[][] = [
  [
    "Behandlungsverlauf seit dem letzten Bericht und Erreichung der Therapieziele",
    "Bisheriger Behandlungsverlauf seit dem letzten Bericht",
  ],
  [
    "Aktuelle Diagnosen gemäß ICD-10 und aktueller psychischer Befund",
    "Aktuelle Diagnose(n) und aktueller psychischer Befund",
  ],
  [
    "Begründung der Fortführung, weitere Therapieplanung und Prognose",
    "Begründung der Notwendigkeit der Fortführung, weitere Planung und Prognose",
  ],
];

export function parseSections(raw: string): [string, string, string] {
  let r = (raw ?? "").replace(/\r/g, "").replace(/^﻿/, "");

  // Nachbemerkung am Ende entfernen — Modelle hängen gern
  // „--- **Hinweis:** …“ an.
  r = r.replace(/\s*-{2,}\s*\**\s*Hinweis\b[\s\S]*$/i, "").trim();

  // Markdown-Vorsätze entfernen und vor den drei Gliederungspunkten
  // einen Umbruch erzwingen, auch wenn sie als „## 2.“ oder angeklebt
  // ausgegeben wurden.
  r = r
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/\*\*/g, " ")
    .replace(
      /([^\n])\s*#{0,6}\s*([123])[.)]\s+(?=(?:Bisher|Aktuelle\s+Diagnos|Begründ|Diagnose\(n\)|Behandlungsverlauf))/g,
      "$1\n$2. "
    );

  r = numberGoals(ungluelines(r));

  const stripTitle = (rest: string, idx: number): string => {
    for (const t of PROMPT_TITLES[idx] ?? []) {
      const e = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const nach = rest.replace(new RegExp(`^\\s*${e}\\s*[:.]?\\s*`), "");
      if (nach !== rest) return nach;
    }
    return rest;
  };

  const lines = r.split(/\n/);
  const secs: [string, string, string] = ["", "", ""];
  let cur = -1, want = 1;
  let buf: string[] = [];
  const headRe = /^\s*([123])[.)]\s+/;
  const flush = () => { if (cur >= 0) secs[cur] = buf.join("\n").trim(); buf = []; };

  for (const ln of lines) {
    if (/^\s*_{5,}/.test(ln)) continue;
    const m = ln.match(headRe);
    if (m && parseInt(m[1], 10) === want) {
      flush();
      cur = want - 1;
      want++;
      // Inhalt, der auf derselben Zeile hinter der Überschrift steht, behalten.
      const rest = stripTitle(ln.replace(headRe, ""), cur);
      if (rest.trim()) buf.push(rest);
      continue;
    }
    if (cur >= 0) buf.push(ln);
  }
  flush();

  if (!secs[0] && !secs[1] && !secs[2]) secs[0] = r.trim();
  return secs;
}

// ---------------------------------------------------------------
// Die Kopfzeilen des Dokuments
// ---------------------------------------------------------------

const g = (f: Felder, k: string) => (f[k] ?? "").trim();

function metaValStunden(f: Felder): string {
  const ph = (v: string) => (v ? `${esc(v)} Std.` : '<span class="doc-ph">[… Std.]</span>');
  const bea = g(f, "f_beantragt");
  let beaTxt = bea ? `<b>weitere ${esc(bea)} Sitzungen</b>` : "<b>weitere Sitzungen</b>";
  if (g(f, "f_frequenz")) beaTxt += ` (${esc(g(f, "f_frequenz"))})`;
  return `Bisher bewilligt: ${ph(g(f, "f_bewilligt"))} · davon durchgeführt: `
       + `${ph(g(f, "f_verbraucht"))} · jetzt beantragt: ${beaTxt}`;
}

/**
 * Die Zeile „Patient:in“ der Metabox.
 *
 * Das Geburtsdatum steht IMMER darin, auch wenn das Sozio-Feld
 * ausgefüllt ist. Enthält der eigene Text bereits ein Datum oder
 * „geb.“, wird nichts doppelt ergänzt.
 */
export function sozioText(f: Felder): string {
  const s = g(f, "f_sozio");
  const gb = g(f, "f_gebdatum");
  const geb = gb ? `geb. ${fmtDate(gb)}${ageSuffix(gb)}` : "geb. [Geburtsdatum fehlt]";
  const hatDatum = /geb\.|geboren|\d{1,2}\.\d{1,2}\.\d{2,4}/i.test(s);
  if (s) return hatDatum ? s : `${geb}, ${s}`;
  const parts = [geb];
  if (g(f, "f_geschlecht")) parts.push(g(f, "f_geschlecht"));
  return parts.join(", ");
}

function sozioLine(f: Felder): string {
  return esc(sozioText(f)).replace(
    /\[Geburtsdatum fehlt\]/g,
    '<span class="doc-ph">[Geburtsdatum fehlt]</span>'
  );
}

function verfahrenLine(f: Felder, p: Profile): string {
  let base = verfahrenZeile(p);
  if (g(f, "f_kasse")) base += ` · ${esc(g(f, "f_kasse"))}`;
  // Der Therapiebeginn gehoert in den Kopf, weil der Gutachter den
  // Behandlungszeitraum sonst nur aus dem Fliesstext erschliessen kann.
  if (g(f, "f_beginn")) base += ` · Beginn ${esc(fmtDate(g(f, "f_beginn")))}`;
  return base;
}

function footerInner(f: Felder, p: Profile, fixed: boolean): string {
  const L = "Fortführungsbericht"
          + (g(f, "f_chiffre") ? ` · Anonymisierungscode ${esc(g(f, "f_chiffre"))}` : "");
  const R = esc(p.behandler.name) + (p.behandler.funktion ? `, ${esc(p.behandler.funktion)}` : "");
  const cls = fixed ? "" : ' class="doc-foot"';
  const st = fixed ? ' style="width:100%"' : "";
  return `<table${cls}${st}><tr><td>${L}</td><td class="r">${R}</td></tr></table>`;
}

/** Anschrift der Praxis für den Briefkopf. */
function anschrift(p: Profile): string {
  const a = [p.praxis.strasse, [p.praxis.plz, p.praxis.ort].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  let out = esc(a);
  if (p.praxis.telefon) out += `<br>Tel. ${esc(p.praxis.telefon)}`;
  if (p.praxis.email) out += `<br>${esc(p.praxis.email)}`;
  return out;
}

// ---------------------------------------------------------------
// Das ganze Dokument
// ---------------------------------------------------------------

export function renderDocHTML(
  report: string,
  f: Felder,
  p: Profile,
  opts: { footer?: "none" | "normal" } = {}
): string {
  const secs = parseSections(report);
  const nr = g(f, "f_nr") || "1";
  const ort = p.praxis.brief_ort || p.praxis.ort;
  const ortDatum = (ort ? `${esc(ort)}, ` : "") + dateLong();
  const name = p.behandler.titel
    ? `${p.behandler.titel} ${p.behandler.name}`.trim()
    : p.behandler.name;

  let h = '<div class="doc-page">';

  h += '<table class="doc-head"><tr><td>'
     + `<div class="name">${esc(name || "—")}</div>`
     + `<div class="role">${esc(p.behandler.funktion)}</div></td>`
     + `<td class="contact">${anschrift(p)}</td></tr></table>`;

  h += '<div class="doc-rule"></div>';
  h += `<table class="doc-subrow"><tr><td>${esc(nr)}. Fortführungsantrag</td>`
     + `<td class="r">${ortDatum}</td></tr></table>`;

  h += '<div class="doc-title">Bericht an die Gutachterin / den Gutachter</div>';
  h += `<div class="doc-subtitle">${esc(p.layout.untertitel || "zum Fortführungsantrag")}</div>`;

  h += '<div class="doc-meta"><table>'
     + `<tr><td class="k">Anonymisierungscode</td><td class="v">`
     + (g(f, "f_chiffre") ? esc(g(f, "f_chiffre")) : '<span class="doc-ph">[Chiffre]</span>')
     + "</td></tr>"
     + `<tr><td class="k">Patient:in</td><td class="v">${sozioLine(f)}</td></tr>`
     + `<tr><td class="k">Verfahren</td><td class="v">${verfahrenLine(f, p)}</td></tr>`
     + `<tr><td class="k">Stundenkontingent</td><td class="v">${metaValStunden(f)}</td></tr>`
     + "</table></div>";

  for (let i = 0; i < 3; i++) {
    h += `<div class="doc-sec"><table class="doc-sech"><tr>`
       + `<td class="n">${i + 1}</td><td class="t">${esc(ABSCHNITTE[i])}</td></tr></table>`;
    const body = renderProse(secs[i]);
    h += (body || '<p class="doc-p"><span class="doc-ph">[Noch nicht formuliert]</span></p>')
       + "</div>";
  }

  h += `<div class="doc-sign">${ortDatum}<div class="sline"></div>`
     + `<div class="sname">${esc(name)}</div>`
     + `<div class="srole">${esc(p.behandler.funktion)}</div></div>`;

  if (opts.footer !== "none") h += footerInner(f, p, false);
  h += "</div>";
  return h;
}

/**
 * Dateiname zum Wiederfinden im eigenen Ablagesystem.
 *
 * Der Klarname steht ausschließlich hier, nie im Bericht selbst und
 * nie in einer Anfrage an die Schnittstelle.
 */
export function fileBase(f: Felder): string {
  let nm = g(f, "f_name") || g(f, "f_chiffre") || "Fall";
  nm = nm.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  const d = new Date().toISOString().slice(0, 10);
  return `Fortfuehrungsbericht ${nm} ${d}`;
}

// ---------------------------------------------------------------
// Länge
// ---------------------------------------------------------------

export interface Metrik {
  zeichen: number;
  woerter: number;
  luecken: number;
  /** "kurz" · "gut" · "lang" */
  urteil: "kurz" | "gut" | "lang";
  hinweis: string;
}

/**
 * Gemessen, nicht geschätzt: aus Testberichten des Vorgängers wurden
 * die Seiten gezählt. Bis 5.362 Zeichen sind es zwei Seiten, ab 5.659
 * drei.
 */
export function metrik(report: string, p: Profile): Metrik {
  const ohne = report.replace(/【\s*([^】]*?)\s*】/g, "$1");
  const zeichen = ohne.trim().length;
  const woerter = ohne.trim() ? ohne.trim().split(/\s+/).length : 0;
  const luecken = (report.match(/【/g) || []).length;
  const L = p.layout;

  let urteil: Metrik["urteil"] = "gut";
  let hinweis = "füllt die zwei Seiten";
  if (zeichen < L.ziel_min) {
    urteil = "kurz";
    hinweis = `noch ${(L.ziel_min - zeichen).toLocaleString("de-DE")} Zeichen bis zum Korridor`;
  } else if (zeichen > L.ziel_max) {
    urteil = "lang";
    hinweis = "über dem Korridor, läuft womöglich auf eine dritte Seite";
  }
  return { zeichen, woerter, luecken, urteil, hinweis };
}
