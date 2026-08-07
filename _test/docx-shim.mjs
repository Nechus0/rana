// src/report/prompt.ts
var STIL = [
  "SCHREIBSTIL (verbindlich einhalten):",
  "\u2013 Durchgehend dritte Person, kein \u201Eich\u201C als Autorinnen-Stimme. Eigene Wahrnehmung als Beobachtung am Gegen\xFCber formulieren (\u201Ewirkt\u201C, \u201Ezeigt sich\u201C, \u201Eist sp\xFCrbar\u201C), nie als Ich-Aussage.",
  "\u2013 Was die Patientin/der Patient berichtet, steht im Konjunktiv I (\u201Esei\u201C, \u201Ehabe\u201C, \u201Ek\xF6nne\u201C, \u201Ewerde\u201C). Eigene Befunde, Einsch\xE4tzungen und die Begr\xFCndung stehen im Indikativ Pr\xE4sens. Diese Trennung durchgehend einhalten, nie vermischen.",
  "\u2013 Begr\xFCndungen mit \u201Eweil\u201C, nicht mit \u201Eda\u201C. Einr\xE4umungen mit \u201Eobgleich\u201C, nicht \u201Eobwohl\u201C.",
  "\u2013 Relativierung \xFCber Verben, nicht Adverbien: \u201Eoffenbar\u201C, \u201Escheint\u201C, \u201Ewirkt\u201C, \u201Eerscheint\u201C, \u201Eam ehesten\u201C \u2013 statt vorangestelltem \u201Evielleicht\u201C/\u201Em\xF6glicherweise\u201C.",
  "\u2013 Ambivalenzen mit \u201Eeinerseits \u2026 andererseits\u201C bzw. \u201Eeinerseits \u2026 dann wieder\u201C.",
  "\u2013 Konkrete Beobachtung vor der Deutung, verkn\xFCpft \xFCber \u201Eso als\u201C (z. B. \u201E\u2026, so als gebe ihr das Sicherheit\u201C).",
  "\u2013 Therapeutische Vorhaben im Passiv mit \u201Esoll/sollen\u201C (\u201Esoll herausgearbeitet werden\u201C, \u201Esoll aufgearbeitet werden\u201C).",
  "\u2013 N\xFCchterne Interpunktion: keine Ausrufezeichen, keine rhetorischen Fragen, keine Emojis, keine Gedankenstrich-Einsch\xFCbe, kein Semikolon.",
  "\u2013 Keine KI-typischen Wendungen wie \u201Edar\xFCber hinaus\u201C, \u201Edes Weiteren\u201C, \u201Einsbesondere\u201C, \u201Ees ist wichtig zu\u201C, \u201Ees gilt\u201C, \u201Edaher\u201C, \u201Efolglich\u201C, \u201Edementsprechend\u201C, \u201Eganzheitlich\u201C, \u201Ezielgerichtet\u201C, \u201Etiefgreifend\u201C, \u201Eessenziell\u201C. Das Label \u201EZusammenfassung: \u201C ist ausdr\xFCcklich erw\xFCnscht; das Wort \u201Ezusammenfassend\u201C soll dagegen nicht im Flie\xDFtext stehen.",
  "\u2013 Keine Abk\xFCrzungen wie \u201Ebzw.\u201C, \u201Eu. a.\u201C, \u201Eggf.\u201C. Zahlen unter zw\xF6lf im Text ausschreiben.",
  "\u2013 Aufz\xE4hlungen nur an den ausdr\xFCcklich genannten Stellen. Behandlungsziele werden nummeriert (\u201E1. \u201C, \u201E2. \u201C \u2026), jedes auf eigener Zeile; sonst reiner Text."
].join("\n");
var FORMAT = [
  "FORMAT: Verwende KEIN Markdown (kein #, kein *, keine ---). Jeder Absatz, jede Beschriftung und jedes nummerierte Ziel beginnt auf einer NEUEN ZEILE \u2013 niemals hintereinander in einer Zeile. Trenne die drei Abschnitte durch je eine Leerzeile. Gib KEINEN Kopf, KEINE Unterschrift und KEINE Hinweise oder Nachbemerkungen aus \u2013 ausschlie\xDFlich die drei nummerierten Abschnitte."
].join("\n");
function bezeichnung(p) {
  switch (p.verfahren.art) {
    case "vt":
      return "Verhaltenstherapie";
    case "at":
      return "Analytische Psychotherapie";
    case "st":
      return "Systemische Therapie";
    default:
      return "Tiefenpsychologisch fundierte Psychotherapie";
  }
}
function verfahrenZeile(p) {
  const v = p.verfahren;
  const set = v.setting === "gruppe" ? "Gruppentherapie" : v.setting === "kombination" ? "Kombinationsbehandlung" : "Einzeltherapie";
  return `${bezeichnung(p)} (${v.art.toUpperCase()}), ${set}`;
}

// src/report/render.ts
var MONATE = [
  "Januar",
  "Februar",
  "M\xE4rz",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember"
];
var ABSCHNITTE = [
  "Behandlungsverlauf und Erreichung der Therapieziele",
  "Diagnosen und psychischer Befund",
  "Begr\xFCndung der Fortf\xFChrung, Therapieplanung und Prognose"
];
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function dateLong(d = /* @__PURE__ */ new Date()) {
  return `${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtDate(iso) {
  if (!iso) return iso;
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso;
}
function ageSuffix(iso) {
  if (!iso) return "";
  const b = new Date(iso);
  if (isNaN(b.getTime())) return "";
  const now = /* @__PURE__ */ new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || m === 0 && now.getDate() < b.getDate()) a--;
  return a > 0 && a < 130 ? ` (${a} Jahre)` : "";
}
var DOC_LABELS = [
  { re: /^(zusammenfassung|zusammenfassend)$/i, out: "Zusammenfassung" },
  { re: /^diagnosen?(\(n\))?$/i, out: "Diagnose(n)" },
  { re: /^psychischer befund$/i, out: "Psychischer Befund" },
  { re: /^somatischer befund$/i, out: "Somatischer Befund" },
  { re: /^methodi?k? und setting$/i, out: "Methodik und Setting" },
  { re: /^prognose$/i, out: "Prognose" }
];
function splitLabel(text) {
  const m = String(text ?? "").match(/^\s*([^:<\n]{2,40}):\s+([\s\S]*)$/);
  if (!m) return null;
  const raw = m[1].trim();
  for (const l of DOC_LABELS) {
    if (l.re.test(raw)) return { label: l.out, rest: m[2] };
  }
  return null;
}
function toList(block) {
  if (/(^|\n)\s*[•–—*-]\s+/.test(block)) {
    const lines = block.split(/\n/);
    const lead = [];
    const items = [];
    let started = false;
    for (const l of lines) {
      const mm = l.match(/^\s*[•–—*-]\s+(.*)$/);
      if (mm) {
        started = true;
        items.push(mm[1].trim());
      } else if (!started) {
        lead.push(l);
      } else if (items.length) {
        items[items.length - 1] += " " + l.trim();
      }
    }
    if (items.length >= 2) return { lead: lead.join(" ").trim(), items, ordered: false };
  }
  if (/(^|\n)\s*\d+[.)]\s+/.test(block)) {
    const lines = block.split(/\n/);
    const lead = [];
    const items = [];
    let started = false, ended = false;
    for (const l of lines) {
      if (ended) continue;
      const mm = l.match(/^\s*\d+[.)]\s+(.*)$/);
      if (mm) {
        started = true;
        items.push(mm[1].trim());
      } else if (!started) {
        lead.push(l);
      } else if (splitLabel(l)) {
        ended = true;
      } else if (items.length) {
        items[items.length - 1] += " " + l.trim();
      }
    }
    if (items.length >= 2) return { lead: lead.join(" ").trim(), items, ordered: true };
  }
  const idx = block.search(/\(1\)/);
  if (idx >= 0) {
    const lead = block.slice(0, idx).trim();
    const rest = block.slice(idx);
    const items = [];
    const re = /\((\d+)\)\s*([\s\S]*?)(?=\(\d+\)|$)/g;
    let m;
    while (m = re.exec(rest)) items.push(m[2].trim().replace(/\s+/g, " "));
    if (items.length >= 2) return { lead, items, ordered: true };
  }
  return null;
}
var ABKUERZUNG = /(?:^|\s)(?:Dr|Prof|Nr|Abs|Art|Bd|Hr|Fr|St|Jh|Ziff)$/;
function repairBreaks(t) {
  return String(t ?? "").replace(
    /([a-zäöüß]{2,}|[0-9])\.(?=[A-ZÄÖÜ])/g,
    (m, pre, off, s) => {
      if (ABKUERZUNG.test(s.slice(Math.max(0, off - 12), off + pre.length))) return m;
      return pre + ".\n";
    }
  );
}
function splitParas(txt) {
  const out = [];
  for (const chunk of repairBreaks(txt).split(/\n{2,}/)) {
    if (!chunk.trim()) continue;
    if (toList(chunk)) {
      out.push(chunk);
      continue;
    }
    for (const l of chunk.split(/\n/)) if (l.trim()) out.push(l);
  }
  return out;
}
function ungluelines(raw) {
  let r = String(raw ?? "").replace(/([^\n])\s*[•▪]\s*/g, "$1\n\u2022 ");
  r = r.replace(/([a-zäöüßA-ZÄÖÜ:])(\d{1,2})\.\s+(?=[A-ZÄÖÜ])/g, "$1\n$2. ");
  const namen = "Zusammenfassung|Zusammenfassend|Diagnose\\(n\\)|Diagnosen|Psychischer Befund|Somatischer Befund|Methodik und Setting|Methode und Setting|Prognose";
  r = r.replace(new RegExp(`([^\\n])\\s*(${namen}):\\s+`, "g"), "$1\n\n$2: ");
  return r;
}
function splitInlineGoals(s) {
  const str = String(s ?? "");
  const re = /\d{1,2}\.\s+(?=[A-ZÄÖÜ])/g;
  const idx = [];
  let m;
  while (m = re.exec(str)) {
    const before = str.slice(0, m.index);
    if (m.index === 0 || /[.)]\s*$/.test(before) && !/\d\.\s*$/.test(before)) {
      idx.push(m.index);
    }
  }
  if (idx.length < 2) return [str];
  const out = [];
  for (let i = 0; i < idx.length; i++) {
    out.push(str.slice(idx[i], i + 1 < idx.length ? idx[i + 1] : str.length).trim());
  }
  return out.filter(Boolean);
}
function numberGoals(raw) {
  const SECLINE = /^[123][.)]\s+(Bisher|Aktuelle|Begründ)/i;
  const lines = String(raw ?? "").split(/\n/);
  const out = [];
  let inGoals = false, n = 0;
  for (const l of lines) {
    const t = l.trim();
    if (inGoals) {
      if (!t || splitLabel(t) || SECLINE.test(t)) {
        inGoals = false;
        n = 0;
        out.push(l);
        continue;
      }
      for (let g2 of splitInlineGoals(t)) {
        g2 = g2.trim();
        if (!g2) continue;
        n++;
        out.push(`${n}. ${g2.replace(/^([•▪–—*-]|\d+[.)])\s+/, "")}`);
      }
      continue;
    }
    out.push(l);
    const cue = t.match(/^(.*behandlungsziele\s*:)\s*(\S[\s\S]*)$/i);
    if (cue) {
      out[out.length - 1] = cue[1];
      inGoals = true;
      n = 0;
      for (let g2 of splitInlineGoals(cue[2].trim())) {
        g2 = g2.trim();
        if (!g2) continue;
        n++;
        out.push(`${n}. ${g2.replace(/^([•▪–—*-]|\d+[.)])\s+/, "")}`);
      }
      continue;
    }
    if (/behandlungsziele\s*:\s*$/i.test(t)) {
      inGoals = true;
      n = 0;
    }
  }
  return out.join("\n");
}
var PROMPT_TITLES = [
  "Bisheriger Behandlungsverlauf seit dem letzten Bericht",
  "Aktuelle Diagnose(n) und aktueller psychischer Befund",
  "Begr\xFCndung der Notwendigkeit der Fortf\xFChrung, weitere Planung und Prognose"
];
function parseSections(raw) {
  let r = (raw ?? "").replace(/\r/g, "").replace(/^﻿/, "");
  r = r.replace(/\s*-{2,}\s*\**\s*Hinweis\b[\s\S]*$/i, "").trim();
  r = r.replace(/^\s*#{1,6}\s*/gm, "").replace(/\*\*/g, " ").replace(
    /([^\n])\s*#{0,6}\s*([123])[.)]\s+(?=(?:Bisher|Aktuelle\s+Diagnos|Begründ|Diagnose\(n\)|Behandlungsverlauf))/g,
    "$1\n$2. "
  );
  r = numberGoals(ungluelines(r));
  const stripTitle = (rest, idx) => {
    const t = PROMPT_TITLES[idx];
    if (!t) return rest;
    const e = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return rest.replace(new RegExp(`^\\s*${e}\\s*[:.]?\\s*`), "");
  };
  const lines = r.split(/\n/);
  const secs = ["", "", ""];
  let cur = -1, want = 1;
  let buf = [];
  const headRe = /^\s*([123])[.)]\s+/;
  const flush = () => {
    if (cur >= 0) secs[cur] = buf.join("\n").trim();
    buf = [];
  };
  for (const ln of lines) {
    if (/^\s*_{5,}/.test(ln)) continue;
    const m = ln.match(headRe);
    if (m && parseInt(m[1], 10) === want) {
      flush();
      cur = want - 1;
      want++;
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
var g = (f, k) => (f[k] ?? "").trim();
function sozioText(f) {
  const s = g(f, "f_sozio");
  const gb = g(f, "f_gebdatum");
  const geb = gb ? `geb. ${fmtDate(gb)}${ageSuffix(gb)}` : "geb. [Geburtsdatum fehlt]";
  const hatDatum = /geb\.|geboren|\d{1,2}\.\d{1,2}\.\d{2,4}/i.test(s);
  if (s) return hatDatum ? s : `${geb}, ${s}`;
  const parts = [geb];
  if (g(f, "f_geschlecht")) parts.push(g(f, "f_geschlecht"));
  return parts.join(", ");
}

// src/report/docx.ts
var strBytes = (s) => new TextEncoder().encode(s);
var crcTable = null;
function crc32(u8) {
  if (!crcTable) {
    crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 4294967295;
  for (let i = 0; i < u8.length; i++) crc = crc >>> 8 ^ crcTable[(crc ^ u8[i]) & 255];
  return (crc ^ 4294967295) >>> 0;
}
function zipStore(files) {
  const u16 = (n) => [n & 255, n >> 8 & 255];
  const u32 = (n) => [n & 255, n >> 8 & 255, n >> 16 & 255, n >> 24 & 255];
  const parts = [];
  const central = [];
  let offset = 0, count = 0;
  for (const f of files) {
    const name = strBytes(f.name);
    const data = f.data;
    const crc = crc32(data);
    const lh = [80, 75, 3, 4].concat(
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0)
    );
    parts.push(new Uint8Array(lh), name, data);
    const ch = [80, 75, 1, 2].concat(
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset)
    );
    central.push(new Uint8Array(ch), name);
    offset += lh.length + name.length + data.length;
    count++;
  }
  const cdStart = offset;
  let cdSize = 0;
  for (const c of central) cdSize += c.length;
  const eocd = [80, 75, 5, 6].concat(
    u16(0),
    u16(0),
    u16(count),
    u16(count),
    u32(cdSize),
    u32(cdStart),
    u16(0)
  );
  return new Blob([...parts, ...central, new Uint8Array(eocd)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}
var W_SERIF = "Cambria";
var W_SANS = "Calibri";
var WC = {
  body: "2E3138",
  dark: "23262D",
  accent: "3A5F9E",
  label: "75787E",
  sec: "5C5F65",
  rule: "DCDDE1",
  hdrRule: "3A3E46",
  boxBg: "E6E8ED",
  boxRule: "C2C5CD",
  boxLabel: "5C5F65",
  hlBg: "FBF0D8",
  hlTx: "8A5A00"
};
var WNS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
var WTAB = "<w:r><w:tab/></w:r>";
var wRightTab = '<w:tab w:val="right" w:pos="9412"/>';
function wrun(text, o = {}) {
  const f = o.font || W_SERIF;
  const sz = o.sz || 22;
  const rpr = [
    `<w:rFonts w:ascii="${f}" w:hAnsi="${f}"/>`,
    o.b ? "<w:b/>" : "",
    o.i ? "<w:i/>" : "",
    o.caps ? "<w:caps/>" : "",
    o.sp ? `<w:spacing w:val="${o.sp}"/>` : "",
    `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`,
    `<w:color w:val="${o.c || WC.body}"/>`,
    o.shd ? `<w:shd w:val="clear" w:fill="${o.shd}"/>` : ""
  ].join("");
  return `<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}
function wpara(runs, o = {}) {
  const bdr = o.bottom ? `<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="${o.bspace || 3}" w:color="${o.bcolor || WC.rule}"/></w:pBdr>` : o.top ? `<w:pBdr><w:top w:val="single" w:sz="4" w:space="${o.bspace || 4}" w:color="${o.bcolor || WC.rule}"/></w:pBdr>` : "";
  const ppr = "<w:pPr>" + (o.keep ? "<w:keepNext/>" : "") + bdr + (o.tabs ? `<w:tabs>${o.tabs}</w:tabs>` : "") + `<w:spacing w:before="${o.before || 0}" w:after="${o.after === void 0 ? 120 : o.after}" w:line="${o.line || 276}" w:lineRule="auto"/>` + (o.ind ? `<w:ind w:left="${o.ind}" w:hanging="${o.hang || o.ind}"/>` : "") + (o.jc ? `<w:jc w:val="${o.jc}"/>` : "") + "</w:pPr>";
  return `<w:p>${ppr}${runs}</w:p>`;
}
var wP = (txt, after = 120) => wpara(wrun(txt), { jc: "left", after, line: 288 });
function wRunsPH(text, o = {}) {
  let out = "", last = 0;
  const re = /【\s*([^】]*?)\s*】/g;
  let m;
  while (m = re.exec(text)) {
    if (m.index > last) out += wrun(text.slice(last, m.index), o);
    const inner = m[1].replace(/^BITTE ERG[ÄA]NZEN/i, "Bitte erg\xE4nzen");
    out += wrun(inner, { ...o, shd: WC.hlBg, c: WC.hlTx });
    last = re.lastIndex;
  }
  if (last < text.length) out += wrun(text.slice(last), o);
  return out || wrun("", o);
}
function wSection(text) {
  if (!text) return wP("");
  let out = "";
  for (let b of splitParas(text)) {
    b = b.trim();
    if (!b) continue;
    const lst = toList(b);
    if (lst) {
      if (lst.lead) {
        out += wpara(wRunsPH(lst.lead.replace(/\n/g, " ")), { jc: "left", after: 60, line: 288 });
      }
      lst.items.forEach((it, i) => {
        const mark = lst.ordered ? `${i + 1}.` : "\u2022";
        out += wpara(
          wrun(mark, { font: W_SANS, sz: 20, b: 1, c: WC.accent }) + WTAB + wRunsPH(it),
          { jc: "left", ind: 340, hang: 340, tabs: '<w:tab w:val="left" w:pos="340"/>', after: 60, line: 288 }
        );
      });
      continue;
    }
    const lm = splitLabel(b);
    if (lm) {
      out += wpara(
        wrun(lm.label, { font: W_SANS, sz: 19, caps: 1, sp: 12, b: 1, c: WC.dark }) + wrun("  ") + wRunsPH(lm.rest.replace(/\n/g, " ")),
        { jc: "left", after: 120, line: 288 }
      );
      continue;
    }
    out += wpara(wRunsPH(b.replace(/\n/g, " ")), { jc: "left", after: 120, line: 288 });
  }
  return out;
}
function wh2(num, text) {
  return wpara(
    wrun(num, { font: W_SANS, sz: 22, b: 1, c: WC.accent }) + WTAB + wrun(text, { font: W_SANS, sz: 22, b: 1, c: WC.dark }),
    {
      bottom: 1,
      bspace: 4,
      tabs: '<w:tab w:val="left" w:pos="340"/>',
      ind: 340,
      hang: 340,
      before: 180,
      after: 120,
      line: 264,
      keep: 1
    }
  );
}
var wcell = (w, content, pr = "") => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${pr}<w:vAlign w:val="top"/></w:tcPr>${content}</w:tc>`;
var wNoBorders = '<w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders>';
var wTblPr = (extra = "", ind = 0) => `<w:tblPr><w:tblW w:w="9412" w:type="dxa"/><w:tblInd w:w="${ind}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${extra}<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
function wLetterhead(p) {
  const anschrift = [p.praxis.strasse, [p.praxis.plz, p.praxis.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const contact = [
    anschrift,
    p.praxis.telefon ? `Tel. ${p.praxis.telefon}` : "",
    p.praxis.email
  ].filter(Boolean);
  const right = contact.map((l) => wpara(wrun(l, { font: W_SANS, sz: 17, c: WC.sec }), { after: 0, line: 240, jc: "right" })).join("") || wpara(wrun(""), { after: 0 });
  const name = p.behandler.titel ? `${p.behandler.titel} ${p.behandler.name}`.trim() : p.behandler.name;
  return "<w:tbl>" + wTblPr(wNoBorders) + "<w:tr>" + wcell(
    4680,
    wpara(wrun(name || "\u2014", { font: W_SANS, sz: 25, b: 1, c: WC.dark }), { after: 20, line: 240 }) + wpara(wrun(p.behandler.funktion, { font: W_SANS, sz: 18, c: WC.dark }), { after: 0, line: 240 })
  ) + wcell(4732, right) + "</w:tr></w:tbl>";
}
function wBoxRow(label, valueRuns, first, last) {
  const topB = first ? `<w:top w:val="single" w:sz="6" w:color="${WC.boxRule}"/>` : "";
  const botB = last ? `<w:bottom w:val="single" w:sz="6" w:color="${WC.boxRule}"/>` : "";
  const shd = `<w:shd w:val="clear" w:fill="${WC.boxBg}"/>`;
  const before = first ? 100 : 60;
  const after = last ? 100 : 60;
  return "<w:tr><w:trPr><w:cantSplit/></w:trPr>" + wcell(
    2440,
    wpara(
      wrun(label, { font: W_SANS, sz: 18, caps: 1, sp: 8, c: WC.boxLabel }),
      { before: before + 20, after, line: 240 }
    ),
    `<w:tcBorders><w:left w:val="single" w:sz="16" w:color="${WC.accent}"/>${topB}${botB}</w:tcBorders>` + shd + '<w:tcMar><w:left w:w="180" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tcMar>'
  ) + wcell(
    6972,
    wpara(valueRuns, { before, after, line: 264 }),
    `<w:tcBorders><w:right w:val="single" w:sz="6" w:color="${WC.boxRule}"/>${topB}${botB}</w:tcBorders>` + shd + '<w:tcMar><w:right w:w="180" w:type="dxa"/></w:tcMar>'
  ) + "</w:tr>";
}
var gf = (f, k) => (f[k] ?? "").trim();
function wVerfahrenText(f, p) {
  let base = verfahrenZeile(p);
  if (gf(f, "f_kasse")) base += ` \xB7 ${gf(f, "f_kasse")}`;
  return base;
}
function wStundenRuns(f) {
  const phr = (v) => v ? wrun(`${v} Std.`, { sz: 20 }) : wrun("[\u2026 Std.]", { sz: 20, shd: WC.hlBg, c: WC.hlTx });
  const bea = gf(f, "f_beantragt");
  const freq = gf(f, "f_frequenz");
  return wrun("Bisher bewilligt: ", { sz: 20 }) + phr(gf(f, "f_bewilligt")) + wrun(" \xB7 davon durchgef\xFChrt: ", { sz: 20 }) + phr(gf(f, "f_verbraucht")) + wrun(" \xB7 jetzt beantragt: ", { sz: 20 }) + (bea ? wrun(`weitere ${bea} Sitzungen`, { sz: 20, b: 1 }) : wrun("weitere Sitzungen", { sz: 20, b: 1 })) + (freq ? wrun(` (${freq})`, { sz: 20 }) : "");
}
function wInfoBox(f, p) {
  const chiffre = gf(f, "f_chiffre");
  return "<w:tbl>" + wTblPr("", 204) + wBoxRow(
    "Anonymisierungscode",
    chiffre ? wrun(chiffre, { sz: 20 }) : wrun("[Chiffre]", { sz: 20, shd: WC.hlBg, c: WC.hlTx }),
    true,
    false
  ) + wBoxRow("Patient:in", wrun(sozioText(f), { sz: 20 }), false, false) + wBoxRow("Verfahren", wrun(wVerfahrenText(f, p), { sz: 20 }), false, false) + wBoxRow("Stundenkontingent", wStundenRuns(f), false, true) + "</w:tbl>";
}
function wDocBody(report, f, p) {
  const secs = parseSections(report);
  const nr = gf(f, "f_nr") || "1";
  const ort = p.praxis.brief_ort || p.praxis.ort;
  const ortDatum = (ort ? `${ort}, ` : "") + dateLong();
  const name = p.behandler.titel ? `${p.behandler.titel} ${p.behandler.name}`.trim() : p.behandler.name;
  return [
    wLetterhead(p),
    wpara("", { bottom: 1, bcolor: WC.hdrRule, bspace: 2, after: 0, line: 120 }),
    wpara(
      wrun(`${nr}. Fortf\xFChrungsantrag`, { font: W_SANS, sz: 16, caps: 1, sp: 14, c: WC.label }) + WTAB + wrun(ortDatum, { font: W_SANS, sz: 16, caps: 1, sp: 14, c: WC.label }),
      { tabs: wRightTab, before: 200, after: 160, line: 240 }
    ),
    wpara(
      wrun("Bericht an die Gutachterin / den Gutachter", { sz: 32, b: 1, c: WC.dark }),
      { after: 60, line: 264 }
    ),
    wpara(
      wrun(p.layout.untertitel || "zum Fortf\xFChrungsantrag", { sz: 21, c: WC.sec }),
      { after: 200, line: 264 }
    ),
    wInfoBox(f, p),
    wpara("", { after: 0, line: 120 }),
    wh2("1", ABSCHNITTE[0]),
    wSection(secs[0]),
    wh2("2", ABSCHNITTE[1]),
    wSection(secs[1]),
    wh2("3", ABSCHNITTE[2]),
    wSection(secs[2]),
    // Unterschriftsblock: grosszügiger Abstand nach oben, damit von Hand
    // unterschrieben werden kann, und durch keepNext zusammengehalten —
    // so steht er immer geschlossen am Berichtsende.
    wpara(
      wrun(ortDatum, { font: W_SANS, sz: 17, c: WC.sec }),
      { before: 280, after: 620, line: 240, keep: 1 }
    ),
    '<w:p><w:pPr><w:keepNext/><w:pBdr><w:top w:val="single" w:sz="4" w:space="2" w:color="' + WC.sec + '"/></w:pBdr><w:spacing w:before="0" w:after="40" w:line="240" w:lineRule="auto"/><w:ind w:right="5660"/></w:pPr>' + wrun(name, { font: W_SANS, sz: 18, b: 1, c: WC.dark }) + "</w:p>",
    wpara(wrun(p.behandler.funktion, { font: W_SANS, sz: 17, c: WC.sec }), { after: 0, line: 240 })
  ].join("");
}
function wFooterXml(f) {
  const L = `Bericht an die Gutachterin / den Gutachter \xB7 ${dateLong()}`;
  const chiffre = gf(f, "f_chiffre");
  const R = chiffre ? `Code ${chiffre}` : "";
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + WNS + ">" + wpara(
    wrun(L, { font: W_SANS, sz: 16, caps: 1, sp: 14, c: WC.label }) + WTAB + wrun(R, { font: W_SANS, sz: 16, caps: 1, sp: 14, c: WC.label }),
    { top: 1, tabs: wRightTab, after: 0, line: 240 }
  ) + "</w:ftr>";
}
function buildDocx(report, f, p) {
  const sectPr = '<w:sectPr><w:footerReference w:type="default" r:id="rId10"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1247" w:right="1247" w:bottom="1247" w:left="1247" w:header="708" w:footer="600" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>';
  const document_xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + WNS + "><w:body>" + wDocBody(report, f, p) + sectPr + "</w:body></w:document>";
  const styles_xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ' + WNS + `><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${W_SERIF}" w:hAnsi="${W_SERIF}"/><w:sz w:val="22"/><w:lang w:val="de-DE"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
  const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>';
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Fortf\xFChrungsbericht ${esc(gf(f, "f_chiffre"))}</dc:title><dc:creator>${esc(p.behandler.name)}</dc:creator></cp:coreProperties>`;
  return zipStore([
    { name: "[Content_Types].xml", data: strBytes(contentTypes) },
    { name: "_rels/.rels", data: strBytes(rels) },
    { name: "docProps/core.xml", data: strBytes(core) },
    { name: "word/document.xml", data: strBytes(document_xml) },
    { name: "word/styles.xml", data: strBytes(styles_xml) },
    { name: "word/footer1.xml", data: strBytes(wFooterXml(f)) },
    { name: "word/_rels/document.xml.rels", data: strBytes(docRels) }
  ]);
}
export {
  buildDocx
};
