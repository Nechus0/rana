/**
 * Word-Ausgabe.
 *
 * Das .docx wird von Hand als OOXML aufgebaut und in ein ZIP ohne
 * Kompression gepackt. Kein Fremdpaket — das ist Absicht: das Layout
 * ist gegen echte Word-Dateien geprüft, und eine Bibliothek, die beim
 * nächsten Versionssprung anders setzt, würde genau das zerstören.
 *
 * Übernommen aus dem Vorgängerprogramm. Geändert ist nur, woher die
 * Praxisdaten kommen — sie stehen jetzt im Profil statt im Code.
 *
 * Zerlegt wird der Text mit denselben Funktionen wie in der Vorschau
 * (render.ts). Vorschau und Word dürfen nie auseinanderlaufen.
 */

import type { Felder, Profile } from "../core/ipc";
import {
  ABSCHNITTE, dateLong, esc, fmtDate, parseSections, sozioText,
  splitLabel, splitParas, toList,
} from "./render";
import { verfahrenZeile } from "./prompt";

// ---------------------------------------------------------------
// ZIP ohne Kompression
// ---------------------------------------------------------------

interface ZipFile { name: string; data: Uint8Array<ArrayBuffer> }

/**
 * TypeScript unterscheidet seit Kurzem zwischen Uint8Array über einem
 * ArrayBuffer und über einem SharedArrayBuffer; nur der erste taugt als
 * Blob-Bestandteil. Diese Hilfe hält den Unterschied an einer Stelle.
 */
type Bytes = Uint8Array<ArrayBuffer>;

const strBytes = (s: string): Bytes => new TextEncoder().encode(s) as Bytes;

let crcTable: number[] | null = null;
function crc32(u8: Bytes): number {
  if (!crcTable) {
    crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < u8.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ u8[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: ZipFile[]): Blob {
  const u16 = (n: number) => [n & 255, (n >> 8) & 255];
  const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];

  const parts: Bytes[] = [];
  const central: Bytes[] = [];
  let offset = 0, count = 0;

  for (const f of files) {
    const name = strBytes(f.name);
    const data = f.data;
    const crc = crc32(data);

    const lh = [0x50, 0x4b, 0x03, 0x04].concat(
      u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0)
    );
    parts.push(new Uint8Array(lh) as Bytes, name, data);

    const ch = [0x50, 0x4b, 0x01, 0x02].concat(
      u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset)
    );
    central.push(new Uint8Array(ch) as Bytes, name);

    offset += lh.length + name.length + data.length;
    count++;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const c of central) cdSize += c.length;

  const eocd = [0x50, 0x4b, 0x05, 0x06].concat(
    u16(0), u16(0), u16(count), u16(count), u32(cdSize), u32(cdStart), u16(0)
  );

  return new Blob([...parts, ...central, new Uint8Array(eocd) as Bytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

// ---------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------

const W_SERIF = "Cambria";
const W_SANS = "Calibri";

/**
 * Farben ausschliesslich für das Word-Dokument.
 *
 * boxBg, boxRule und boxLabel sind bewusst kräftiger als am Bildschirm:
 * Tintenstrahl- und Laserdruck verschlucken sehr helle Flächen fast
 * vollständig.
 */
const WC = {
  body: "2E3138", dark: "23262D", accent: "3A5F9E", label: "75787E",
  sec: "5C5F65", rule: "DCDDE1", hdrRule: "3A3E46",
  boxBg: "E6E8ED", boxRule: "C2C5CD", boxLabel: "5C5F65",
  hlBg: "FBF0D8", hlTx: "8A5A00",
};

const WNS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
          + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const WTAB = "<w:r><w:tab/></w:r>";
const wRightTab = '<w:tab w:val="right" w:pos="9412"/>';

interface RunOpts {
  font?: string; b?: boolean | number; i?: boolean | number;
  caps?: boolean | number; sp?: number; sz?: number; c?: string; shd?: string;
}

function wrun(text: string, o: RunOpts = {}): string {
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
    o.shd ? `<w:shd w:val="clear" w:fill="${o.shd}"/>` : "",
  ].join("");
  return `<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

interface ParaOpts {
  bottom?: boolean | number; top?: boolean | number;
  bspace?: number; bcolor?: string;
  keep?: boolean | number; tabs?: string;
  before?: number; after?: number; line?: number;
  ind?: number; hang?: number; jc?: string;
}

function wpara(runs: string, o: ParaOpts = {}): string {
  const bdr = o.bottom
    ? `<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="${o.bspace || 3}" w:color="${o.bcolor || WC.rule}"/></w:pBdr>`
    : o.top
    ? `<w:pBdr><w:top w:val="single" w:sz="4" w:space="${o.bspace || 4}" w:color="${o.bcolor || WC.rule}"/></w:pBdr>`
    : "";

  // Reihenfolge nach OOXML-Schema: keepNext → pBdr → tabs → spacing →
  // ind → jc. Sonst kann Word den Zusammenhalt der Absätze verwerfen.
  const ppr = "<w:pPr>"
    + (o.keep ? "<w:keepNext/>" : "")
    + bdr
    + (o.tabs ? `<w:tabs>${o.tabs}</w:tabs>` : "")
    + `<w:spacing w:before="${o.before || 0}" w:after="${o.after === undefined ? 120 : o.after}" `
    + `w:line="${o.line || 276}" w:lineRule="auto"/>`
    + (o.ind ? `<w:ind w:left="${o.ind}" w:hanging="${o.hang || o.ind}"/>` : "")
    + (o.jc ? `<w:jc w:val="${o.jc}"/>` : "")
    + "</w:pPr>";
  return `<w:p>${ppr}${runs}</w:p>`;
}

const wP = (txt: string, after = 120) => wpara(wrun(txt), { jc: "left", after, line: 288 });

/** Offene Pflichtangaben im Word-Dokument gelb hinterlegen. */
function wRunsPH(text: string, o: RunOpts = {}): string {
  let out = "", last = 0;
  const re = /【\s*([^】]*?)\s*】/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out += wrun(text.slice(last, m.index), o);
    const inner = m[1].replace(/^BITTE ERG[ÄA]NZEN/i, "Bitte ergänzen");
    out += wrun(inner, { ...o, shd: WC.hlBg, c: WC.hlTx });
    last = re.lastIndex;
  }
  if (last < text.length) out += wrun(text.slice(last), o);
  return out || wrun("", o);
}

function wSection(text: string): string {
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
        const mark = lst.ordered ? `${i + 1}.` : "•";
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
        wrun(lm.label, { font: W_SANS, sz: 19, caps: 1, sp: 12, b: 1, c: WC.dark })
          + wrun("  ")
          + wRunsPH(lm.rest.replace(/\n/g, " ")),
        { jc: "left", after: 120, line: 288 }
      );
      continue;
    }

    out += wpara(wRunsPH(b.replace(/\n/g, " ")), { jc: "left", after: 120, line: 288 });
  }
  return out;
}

function wh2(num: string, text: string): string {
  return wpara(
    wrun(num, { font: W_SANS, sz: 22, b: 1, c: WC.accent })
      + WTAB
      + wrun(text, { font: W_SANS, sz: 22, b: 1, c: WC.dark }),
    {
      bottom: 1, bspace: 4, tabs: '<w:tab w:val="left" w:pos="340"/>',
      ind: 340, hang: 340, before: 180, after: 120, line: 264, keep: 1,
    }
  );
}

// ---------------------------------------------------------------
// Tabellen
// ---------------------------------------------------------------

const wcell = (w: number, content: string, pr = "") =>
  `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${pr}<w:vAlign w:val="top"/></w:tcPr>${content}</w:tc>`;

const wNoBorders = "<w:tblBorders><w:top w:val=\"none\"/><w:left w:val=\"none\"/>"
  + "<w:bottom w:val=\"none\"/><w:right w:val=\"none\"/>"
  + "<w:insideH w:val=\"none\"/><w:insideV w:val=\"none\"/></w:tblBorders>";

const wTblPr = (extra = "", ind = 0) =>
  `<w:tblPr><w:tblW w:w="9412" w:type="dxa"/><w:tblInd w:w="${ind}" w:type="dxa"/>`
  + `<w:tblLayout w:type="fixed"/>${extra}`
  + '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/>'
  + '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>';

function wLetterhead(p: Profile): string {
  const anschrift = [p.praxis.strasse, [p.praxis.plz, p.praxis.ort].filter(Boolean).join(" ")]
    .filter(Boolean).join(", ");
  const contact = [
    anschrift,
    p.praxis.telefon ? `Tel. ${p.praxis.telefon}` : "",
    p.praxis.email,
  ].filter(Boolean);

  const right = contact
    .map((l) => wpara(wrun(l, { font: W_SANS, sz: 17, c: WC.sec }), { after: 0, line: 240, jc: "right" }))
    .join("") || wpara(wrun(""), { after: 0 });

  const name = p.behandler.titel
    ? `${p.behandler.titel} ${p.behandler.name}`.trim()
    : p.behandler.name;

  return "<w:tbl>" + wTblPr(wNoBorders) + "<w:tr>"
    // Funktionszeile schwarz statt in der Akzentfarbe — sonst wirkt der
    // Kopf im Druck unruhig.
    + wcell(4680,
        wpara(wrun(name || "—", { font: W_SANS, sz: 25, b: 1, c: WC.dark }), { after: 20, line: 240 })
        + wpara(wrun(p.behandler.funktion, { font: W_SANS, sz: 18, c: WC.dark }), { after: 0, line: 240 }))
    + wcell(4732, right)
    + "</w:tr></w:tbl>";
}

function wBoxRow(label: string, valueRuns: string, first: boolean, last: boolean): string {
  // Der Rahmen der Box ist eigens definiert (boxRule), damit die feinen
  // Linien im übrigen Dokument unverändert bleiben.
  const topB = first ? `<w:top w:val="single" w:sz="6" w:color="${WC.boxRule}"/>` : "";
  const botB = last ? `<w:bottom w:val="single" w:sz="6" w:color="${WC.boxRule}"/>` : "";
  const shd = `<w:shd w:val="clear" w:fill="${WC.boxBg}"/>`;
  const before = first ? 100 : 60;
  const after = last ? 100 : 60;

  return '<w:tr><w:trPr><w:cantSplit/></w:trPr>'
    + wcell(2440,
        wpara(wrun(label, { font: W_SANS, sz: 18, caps: 1, sp: 8, c: WC.boxLabel }),
              { before: before + 20, after, line: 240 }),
        `<w:tcBorders><w:left w:val="single" w:sz="16" w:color="${WC.accent}"/>${topB}${botB}</w:tcBorders>`
        + shd + '<w:tcMar><w:left w:w="180" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tcMar>')
    + wcell(6972,
        wpara(valueRuns, { before, after, line: 264 }),
        `<w:tcBorders><w:right w:val="single" w:sz="6" w:color="${WC.boxRule}"/>${topB}${botB}</w:tcBorders>`
        + shd + '<w:tcMar><w:right w:w="180" w:type="dxa"/></w:tcMar>')
    + "</w:tr>";
}

const gf = (f: Felder, k: string) => (f[k] ?? "").trim();

function wVerfahrenText(f: Felder, p: Profile): string {
  let base = verfahrenZeile(p);
  if (gf(f, "f_kasse")) base += ` · ${gf(f, "f_kasse")}`;
  // Gleicher Aufbau wie in der Vorschau, damit beide nie auseinanderlaufen.
  if (gf(f, "f_beginn")) base += ` · Beginn ${fmtDate(gf(f, "f_beginn"))}`;
  return base;
}

function wStundenRuns(f: Felder): string {
  const phr = (v: string) =>
    v ? wrun(`${v} Std.`, { sz: 20 }) : wrun("[… Std.]", { sz: 20, shd: WC.hlBg, c: WC.hlTx });
  const bea = gf(f, "f_beantragt");
  const freq = gf(f, "f_frequenz");
  return wrun("Bisher bewilligt: ", { sz: 20})
    + phr(gf(f, "f_bewilligt"))
    + wrun(" · davon durchgeführt: ", { sz: 20 })
    + phr(gf(f, "f_verbraucht"))
    + wrun(" · jetzt beantragt: ", { sz: 20 })
    + (bea ? wrun(`weitere ${bea} Sitzungen`, { sz: 20, b: 1 }) : wrun("weitere Sitzungen", { sz: 20, b: 1 }))
    + (freq ? wrun(` (${freq})`, { sz: 20 }) : "");
}

function wInfoBox(f: Felder, p: Profile): string {
  const chiffre = gf(f, "f_chiffre");
  return "<w:tbl>" + wTblPr("", 204)
    + wBoxRow("Anonymisierungscode",
        chiffre ? wrun(chiffre, { sz: 20 }) : wrun("[Chiffre]", { sz: 20, shd: WC.hlBg, c: WC.hlTx }),
        true, false)
    // Dieselbe Funktion wie in der Vorschau, damit beide nie auseinanderlaufen.
    + wBoxRow("Patient:in", wrun(sozioText(f), { sz: 20 }), false, false)
    + wBoxRow("Verfahren", wrun(wVerfahrenText(f, p), { sz: 20 }), false, false)
    + wBoxRow("Stundenkontingent", wStundenRuns(f), false, true)
    + "</w:tbl>";
}

// ---------------------------------------------------------------
// Der Textkörper
// ---------------------------------------------------------------

function wDocBody(report: string, f: Felder, p: Profile): string {
  const secs = parseSections(report);
  const nr = gf(f, "f_nr") || "1";
  const ort = p.praxis.brief_ort || p.praxis.ort;
  const ortDatum = (ort ? `${ort}, ` : "") + dateLong();
  const name = p.behandler.titel
    ? `${p.behandler.titel} ${p.behandler.name}`.trim()
    : p.behandler.name;

  return [
    wLetterhead(p),
    wpara("", { bottom: 1, bcolor: WC.hdrRule, bspace: 2, after: 0, line: 120 }),

    wpara(
      wrun(`${nr}. Fortführungsantrag`, { font: W_SANS, sz: 16, caps: 1, sp: 14, c: WC.label })
        + WTAB
        + wrun(ortDatum, { font: W_SANS, sz: 16, caps: 1, sp: 14, c: WC.label }),
      { tabs: wRightTab, before: 200, after: 160, line: 240 }
    ),

    wpara(wrun("Bericht an die Gutachterin / den Gutachter", { sz: 32, b: 1, c: WC.dark }),
          { after: 60, line: 264 }),
    wpara(wrun(p.layout.untertitel || "zum Fortführungsantrag", { sz: 21, c: WC.sec }),
          { after: 200, line: 264 }),

    wInfoBox(f, p),
    wpara("", { after: 0, line: 120 }),

    wh2("1", ABSCHNITTE[0]), wSection(secs[0]),
    wh2("2", ABSCHNITTE[1]), wSection(secs[1]),
    wh2("3", ABSCHNITTE[2]), wSection(secs[2]),

    // Unterschriftsblock: grosszügiger Abstand nach oben, damit von Hand
    // unterschrieben werden kann, und durch keepNext zusammengehalten —
    // so steht er immer geschlossen am Berichtsende.
    wpara(wrun(ortDatum, { font: W_SANS, sz: 17, c: WC.sec }),
          { before: 280, after: 620, line: 240, keep: 1 }),
    '<w:p><w:pPr><w:keepNext/><w:pBdr><w:top w:val="single" w:sz="4" w:space="2" w:color="'
      + WC.sec + '"/></w:pBdr><w:spacing w:before="0" w:after="40" w:line="240" w:lineRule="auto"/>'
      + '<w:ind w:right="5660"/></w:pPr>'
      + wrun(name, { font: W_SANS, sz: 18, b: 1, c: WC.dark }) + "</w:p>",
    wpara(wrun(p.behandler.funktion, { font: W_SANS, sz: 17, c: WC.sec }), { after: 0, line: 240 }),
  ].join("");
}

function wFooterXml(f: Felder): string {
  const L = `Bericht an die Gutachterin / den Gutachter · ${dateLong()}`;
  const chiffre = gf(f, "f_chiffre");
  const R = chiffre ? `Code ${chiffre}` : "";
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + WNS + ">"
    + wpara(
        wrun(L, { font: W_SANS, sz: 16, caps: 1, sp: 14, c: WC.label })
          + WTAB
          + wrun(R, { font: W_SANS, sz: 16, caps: 1, sp: 14, c: WC.label }),
        { top: 1, tabs: wRightTab, after: 0, line: 240 }
      )
    + "</w:ftr>";
}

// ---------------------------------------------------------------
// Die fertige Datei
// ---------------------------------------------------------------

export function buildDocx(report: string, f: Felder, p: Profile): Blob {
  const sectPr = '<w:sectPr><w:footerReference w:type="default" r:id="rId10"/>'
    + '<w:pgSz w:w="11906" w:h="16838"/>'
    + '<w:pgMar w:top="1247" w:right="1247" w:bottom="1247" w:left="1247" '
    + 'w:header="708" w:footer="600" w:gutter="0"/>'
    + '<w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>';

  const document_xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document '
    + WNS + "><w:body>" + wDocBody(report, f, p) + sectPr + "</w:body></w:document>";

  const styles_xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ' + WNS + ">"
    + "<w:docDefaults><w:rPrDefault><w:rPr>"
    + `<w:rFonts w:ascii="${W_SERIF}" w:hAnsi="${W_SERIF}"/>`
    + '<w:sz w:val="22"/><w:lang w:val="de-DE"/></w:rPr></w:rPrDefault>'
    + '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="288" w:lineRule="auto"/>'
    + "</w:pPr></w:pPrDefault></w:docDefaults>"
    + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">'
    + '<w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>';

  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
    + "</Relationships>";

  const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + '<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
    + "</Relationships>";

  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    + '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
    + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
    + "</Types>";

  // In den Dateieigenschaften steht die Chiffre, nie der Klarname.
  const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
    + 'xmlns:dc="http://purl.org/dc/elements/1.1/">'
    + `<dc:title>Fortführungsbericht ${esc(gf(f, "f_chiffre"))}</dc:title>`
    + `<dc:creator>${esc(p.behandler.name)}</dc:creator></cp:coreProperties>`;

  return zipStore([
    { name: "[Content_Types].xml", data: strBytes(contentTypes) },
    { name: "_rels/.rels", data: strBytes(rels) },
    { name: "docProps/core.xml", data: strBytes(core) },
    { name: "word/document.xml", data: strBytes(document_xml) },
    { name: "word/styles.xml", data: strBytes(styles_xml) },
    { name: "word/footer1.xml", data: strBytes(wFooterXml(f)) },
    { name: "word/_rels/document.xml.rels", data: strBytes(docRels) },
  ]);
}
