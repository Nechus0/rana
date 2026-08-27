/**
 * Die Ersteinrichtung.
 *
 * Rana weiss beim ersten Start nichts: keine Praxis, kein Verfahren,
 * keinen Schlüssel. Alles, was der Vorgänger fest im Programmtext
 * stehen hatte, wird hier abgefragt.
 *
 * Fünf Seiten, ein Weg. Weiter geht es erst, wenn die Seite
 * beisammen ist — aber der Assistent hält nur dort auf, wo es ohne
 * die Angabe wirklich nicht geht.
 */

import * as api from "../core/ipc";
import { dialog, el, esc, icon, on, qs, qsa, toast } from "../ui/kit";
import { openUrl } from "@tauri-apps/plugin-opener";

const SEITEN = ["Praxis", "Verfahren", "Claude-Zugang", "Bericht", "Fertig"];

/** Wo die Ausgabengrenze gesetzt wird. Der Assistent führt dorthin. */
const CONSOLE_LIMITS = "https://platform.claude.com/settings/limits";
const CONSOLE_KEYS = "https://platform.claude.com/settings/keys";

export async function runSetup(onFertig: () => void): Promise<void> {
  const profil = await api.getProfile();
  let seite = 0;
  let keyGeprueft = false;

  const root = document.createElement("div");
  root.className = "setup";
  el("app").replaceChildren(root);

  // -----------------------------------------------------------
  // Gerüst
  // -----------------------------------------------------------

  function zeichne(): void {
    root.innerHTML = `
      <aside class="setup-side">
        <div class="setup-brand">
          <div class="name">Rana</div>
          <div class="version">arvalis</div>
          <p class="claim">Berichte an den Gutachter. Alle Falldaten bleiben verschlüsselt auf diesem Gerät.</p>
        </div>
        <nav class="setup-steps" aria-label="Einrichtungsschritte">
          ${SEITEN.map((s, i) => `
            <div class="setup-step ${i === seite ? "is-current" : i < seite ? "is-done" : ""}"
                 ${i === seite ? 'aria-current="step"' : ""}>
              <span class="setup-dot">${i < seite ? "✓" : i + 1}</span>
              <span>${esc(s)}</span>
            </div>`).join("")}
        </nav>
      </aside>

      <main class="setup-main">
        <div class="setup-body"><div class="setup-inner" id="setupInner"></div></div>
        <footer class="setup-foot">
          <button class="btn" id="btnZurueck" ${seite === 0 ? "disabled" : ""}>
            ${icon.back} Zurück
          </button>
          <span class="spacer"></span>
          <span class="hint" id="setupHinweis"></span>
          <button class="btn btn-primary btn-lg" id="btnWeiter">
            ${seite === SEITEN.length - 1 ? "Rana starten" : "Weiter"} ${seite === SEITEN.length - 1 ? "" : icon.fwd}
          </button>
        </footer>
      </main>`;

    qs<HTMLElement>("#setupInner")!.innerHTML = inhalt();
    binde();

    on(el("btnZurueck"), "click", () => { if (seite > 0) { lese(); seite--; zeichne(); } });
    on(el("btnWeiter"), "click", () => { void weiter(); });
  }

  // -----------------------------------------------------------
  // Die einzelnen Seiten
  // -----------------------------------------------------------

  function inhalt(): string {
    switch (seite) {
      case 0: return seitePraxis();
      case 1: return seiteVerfahren();
      case 2: return seiteZugang();
      case 3: return seiteBericht();
      default: return seiteFertig();
    }
  }

  const feld = (id: string, label: string, wert: string, ph = "", typ = "text", hinweis = "") => `
    <div class="field">
      <label for="${id}">${esc(label)}${hinweis ? ` <span class="field-note">${esc(hinweis)}</span>` : ""}</label>
      <input id="${id}" type="${typ}" value="${esc(wert)}" placeholder="${esc(ph)}">
    </div>`;

  function seitePraxis(): string {
    const p = profil.praxis, b = profil.behandler;
    return `
      <div class="setup-eyebrow">Schritt 1 von 5</div>
      <h2>Praxis und Behandler:in</h2>
      <p class="setup-lede">Diese Angaben stehen im Briefkopf jedes Berichts. Sie lassen sich später jederzeit ändern.</p>

      <div class="group">
        <div class="group-head"><span class="group-title">Wer schreibt</span></div>
        <div class="grid-3">
          ${feld("s_titel", "Titel", b.titel, "Dr. med.", "text", "optional")}
          <div style="grid-column: span 2">${feld("s_name", "Name", b.name, "Vorname Nachname")}</div>
          <div class="span-all">${feld("s_funktion", "Funktion", b.funktion, "Ärztin – Psychotherapie", "text", "steht im Kopf und unter der Unterschrift")}</div>
        </div>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Wo</span></div>
        <div class="grid-3">
          <div class="span-all">${feld("s_praxis", "Praxisname", p.name, "", "text", "optional")}</div>
          <div style="grid-column: span 2">${feld("s_strasse", "Strasse und Hausnummer", p.strasse)}</div>
          ${feld("s_plz", "PLZ", p.plz)}
          <div style="grid-column: span 2">${feld("s_ort", "Ort", p.ort)}</div>
          ${feld("s_briefort", "Ort für die Datumszeile", p.brief_ort, "wie oben", "text", "optional")}
          ${feld("s_tel", "Telefon", p.telefon)}
          <div style="grid-column: span 2">${feld("s_mail", "E-Mail", p.email, "", "email")}</div>
        </div>
      </div>`;
  }

  function seiteVerfahren(): string {
    const v = profil.verfahren;
    const wahl = (
      gruppe: string, wert: string, aktuell: string, titel: string, beschreibung: string
    ) => `
      <label class="choice">
        <input type="radio" name="${gruppe}" value="${wert}" ${wert === aktuell ? "checked" : ""}>
        <span class="choice-mark"></span>
        <span class="choice-text">
          <span class="choice-title">${esc(titel)}</span>
          <span class="choice-desc">${esc(beschreibung)}</span>
        </span>
      </label>`;

    return `
      <div class="setup-eyebrow">Schritt 2 von 5</div>
      <h2>Verfahren und Setting</h2>
      <p class="setup-lede">Diese vier Angaben sind keine Kosmetik. Sie bestimmen, welche Stilregeln und welche Gliederung Claude bekommt — ein verhaltenstherapeutischer Bericht enthält keine Psychodynamik, ein tiefenpsychologischer keine Verhaltensanalyse.</p>

      <div class="group">
        <div class="group-head"><span class="group-title">Richtlinienverfahren</span></div>
        <div class="choice-grid">
          ${wahl("art", "tp", v.art, "Tiefenpsychologisch fundierte Psychotherapie", "Psychodynamik, Konflikt und Struktur, Übertragungsbeziehung")}
          ${wahl("art", "vt", v.art, "Verhaltenstherapie", "Verhaltensanalyse, Bedingungsmodell, Expositionen, kognitive Umstrukturierung")}
          ${wahl("art", "at", v.art, "Analytische Psychotherapie", "Wie tiefenpsychologisch, mit höherer Frequenz und regressionsfördernderem Setting")}
          ${wahl("art", "st", v.art, "Systemische Therapie", "Muster im System, Auftragsklärung, Ressourcen- und Ausnahmeorientierung")}
        </div>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Setting</span></div>
        <div class="choice-grid two">
          ${wahl("setting", "einzel", v.setting, "Einzeltherapie", "")}
          ${wahl("setting", "gruppe", v.setting, "Gruppentherapie", "")}
          ${wahl("setting", "kombination", v.setting, "Kombination", "Einzel und Gruppe")}
        </div>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Zielgruppe</span></div>
        <div class="choice-grid two">
          ${wahl("zielgruppe", "erwachsene", v.zielgruppe, "Erwachsene", "")}
          ${wahl("zielgruppe", "kj", v.zielgruppe, "Kinder und Jugendliche", "Bezugspersonen werden im Bericht berücksichtigt")}
        </div>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Eigene Qualifikation</span></div>
        <div class="choice-grid">
          ${wahl("qualifikation", "aerztlich", v.qualifikation, "Ärztlich", "Der somatische Befund steht im Bericht. Ein Konsiliarbericht (Muster 22b) entfällt.")}
          ${wahl("qualifikation", "psychologisch", v.qualifikation, "Psychologisch", "Rana erinnert daran, den Konsiliarbericht beizulegen.")}
          ${wahl("qualifikation", "kjp", v.qualifikation, "Kinder- und Jugendlichenpsychotherapie", "Rana erinnert daran, den Konsiliarbericht beizulegen.")}
        </div>
      </div>`;
  }

  function seiteZugang(): string {
    const a = profil.api, b = profil.budget;
    return `
      <div class="setup-eyebrow">Schritt 3 von 5</div>
      <h2>Claude-Zugang</h2>
      <p class="setup-lede">Rana formuliert den Bericht über die Schnittstelle von Anthropic. Dafür wird ein eigener Schlüssel gebraucht. Er wird im Windows-Tresor abgelegt und ist danach auch für Rana selbst nur noch maskiert sichtbar.</p>

      <div class="group">
        <div class="group-head"><span class="group-title">Schlüssel</span></div>
        <div class="field">
          <label for="s_key">API-Schlüssel <span class="field-note">beginnt mit sk-ant-</span></label>
          <div class="key-row">
            <input id="s_key" type="password" placeholder="sk-ant-…" autocomplete="off" spellcheck="false">
            <button class="btn" id="btnZeigen" type="button" aria-label="Schlüssel anzeigen">Zeigen</button>
            <button class="btn" id="btnPruefen" type="button">Verbindung testen</button>
          </div>
          <div class="key-state" id="keyState"></div>
        </div>
        <p class="hint" style="margin-top: var(--s2)">
          Noch keinen Schlüssel? <a href="#" id="lnkKeys">In der Anthropic-Console anlegen</a> — dort unter „API keys“.
        </p>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Modell</span></div>
        <div class="field">
          <label for="s_model">Modell</label>
          <select id="s_model">
            <option value="claude-opus-5" ${a.model === "claude-opus-5" ? "selected" : ""}>Opus 5 — beste Qualität, empfohlen</option>
            <option value="claude-sonnet-5" ${a.model === "claude-sonnet-5" ? "selected" : ""}>Sonnet 5 — schneller und günstiger, etwas knapper</option>
          </select>
        </div>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Grenzen</span></div>
        <div class="grid-2">
          <div class="field">
            <label for="s_budget">Monatsbudget <span class="field-note">Euro</span></label>
            <input id="s_budget" type="number" min="1" step="1" value="${b.monthly_eur}">
          </div>
          <div class="field">
            <label for="s_daily">Höchstens Berichte je Tag</label>
            <input id="s_daily" type="number" min="1" step="1" value="${b.daily_reports}">
          </div>
        </div>
        <div class="notice notice-info" style="margin-top: var(--s4)">
          Ein Bericht kostet mit Opus 5 rund <b>fünf Cent</b>. Bei einem Bericht pro Tag sind das etwa
          <b>1,60 € im Monat</b>. Zehn Euro sind deshalb keine Einschränkung, sondern eine Reissleine:
          Rana hört auf zu senden, bevor unbemerkt Kosten entstehen.
        </div>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Die harte Grenze</span></div>
        <div class="notice notice-warn">
          Der Zähler in Rana schützt vor Versehen. Er schützt <b>nicht</b> davor, dass der Schlüssel
          einmal abhandenkommt — dann zählt nur noch die Grenze bei Anthropic selbst.
          Bitte dort einmalig ein Monatslimit setzen. Das ist die wichtigste Minute dieser Einrichtung.
        </div>
        <p class="hint" style="margin: var(--s3) 0 12px">
          <a href="#" id="lnkLimits">Ausgabengrenze in der Anthropic-Console öffnen</a> —
          empfohlen: Monatslimit 15 €, Kostenwarnung bei 10 €.
        </p>
        <label class="switch">
          <input type="checkbox" id="s_console" ${a.console_limit_bestaetigt ? "checked" : ""}>
          <span class="switch-track"></span>
          <span>Ich habe in der Anthropic-Console eine Ausgabengrenze gesetzt.</span>
        </label>
      </div>`;
  }

  function seiteBericht(): string {
    const L = profil.layout;
    return `
      <div class="setup-eyebrow">Schritt 4 von 5</div>
      <h2>Bericht und Layout</h2>
      <p class="setup-lede">Wie der fertige Bericht aussieht und wie lang er werden soll.</p>

      <div class="group">
        <div class="group-head"><span class="group-title">Berichtsart</span></div>
        <div class="choice-grid">
          <label class="choice">
            <input type="radio" name="berichtsart" value="fortfuehrung" checked>
            <span class="choice-mark"></span>
            <span class="choice-text">
              <span class="choice-title">Fortführungsantrag</span>
              <span class="choice-desc">Bericht zum Antrag auf Fortführung einer laufenden Behandlung</span>
            </span>
          </label>
          <label class="choice" style="opacity:.55">
            <input type="radio" name="berichtsart" value="erstantrag" disabled>
            <span class="choice-mark"></span>
            <span class="choice-text">
              <span class="choice-title">Erstantrag</span>
              <span class="choice-desc">Andere Gliederung. Vorgesehen, folgt im nächsten Bau.</span>
            </span>
          </label>
        </div>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Untertitel</span></div>
        <div class="field">
          <label for="s_untertitel">Steht unter der Überschrift des Berichts</label>
          <input id="s_untertitel" value="${esc(L.untertitel)}"
                 placeholder="zum Fortführungsantrag auf Anerkennung der Beihilfefähigkeit für Psychotherapie">
        </div>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Umfang</span></div>
        <p class="hint" style="margin-bottom: var(--s4)">
          Gemessen, nicht geschätzt: Testberichte wurden erzeugt und die Seiten gezählt.
          Bis 5.362 Zeichen sind es zwei Seiten, ab 5.659 drei. Der Korridor zielt bewusst
          an das obere Ende, damit die zweite Seite gefüllt ist.
        </p>
        <div class="grid-3">
          <div class="field">
            <label for="s_min">Mindestens <span class="field-note">Zeichen</span></label>
            <input id="s_min" type="number" step="50" value="${L.ziel_min}">
          </div>
          <div class="field">
            <label for="s_soll">Zielwert</label>
            <input id="s_soll" type="number" step="50" value="${L.ziel_soll}">
          </div>
          <div class="field">
            <label for="s_max">Höchstens</label>
            <input id="s_max" type="number" step="50" value="${L.ziel_max}">
          </div>
        </div>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Gestaltung</span></div>
        <div class="grid-3">
          <div class="field">
            <label for="s_akzent">Akzentfarbe des Briefkopfs</label>
            <input id="s_akzent" type="color" value="${esc(L.akzent)}" style="height:38px;padding:3px">
          </div>
          <div class="field">
            <label for="s_schrift">Textschrift</label>
            <select id="s_schrift">
              <option ${L.schrift_text === "Cambria" ? "selected" : ""}>Cambria</option>
              <option ${L.schrift_text === "Georgia" ? "selected" : ""}>Georgia</option>
              <option ${L.schrift_text === "Times New Roman" ? "selected" : ""}>Times New Roman</option>
            </select>
          </div>
          <div class="field">
            <label for="s_schriftkopf">Kopfschrift</label>
            <select id="s_schriftkopf">
              <option ${L.schrift_kopf === "Calibri" ? "selected" : ""}>Calibri</option>
              <option ${L.schrift_kopf === "Arial" ? "selected" : ""}>Arial</option>
            </select>
          </div>
        </div>
      </div>`;
  }

  function seiteFertig(): string {
    const p = profil;
    const fehlt = (v: string) => v ? esc(v) : '<span class="missing">nicht angegeben</span>';
    const verfahrenText = {
      tp: "Tiefenpsychologisch fundierte Psychotherapie",
      vt: "Verhaltenstherapie",
      at: "Analytische Psychotherapie",
      st: "Systemische Therapie",
    }[p.verfahren.art];
    const settingText = {
      einzel: "Einzeltherapie", gruppe: "Gruppentherapie", kombination: "Kombination",
    }[p.verfahren.setting];

    return `
      <div class="setup-eyebrow">Schritt 5 von 5</div>
      <h2>Alles beisammen</h2>
      <p class="setup-lede">Ein letzter Blick. Alles hiervon lässt sich später unter „Einstellungen“ ändern.</p>

      <dl class="summary">
        <div class="summary-row"><dt>Behandler:in</dt><dd>${fehlt([p.behandler.titel, p.behandler.name].filter(Boolean).join(" "))}${p.behandler.funktion ? `, ${esc(p.behandler.funktion)}` : ""}</dd></div>
        <div class="summary-row"><dt>Praxis</dt><dd>${fehlt([p.praxis.strasse, [p.praxis.plz, p.praxis.ort].filter(Boolean).join(" ")].filter(Boolean).join(", "))}</dd></div>
        <div class="summary-row"><dt>Verfahren</dt><dd>${esc(verfahrenText)}, ${esc(settingText)}</dd></div>
        <div class="summary-row"><dt>Zielgruppe</dt><dd>${p.verfahren.zielgruppe === "kj" ? "Kinder und Jugendliche" : "Erwachsene"}</dd></div>
        <div class="summary-row"><dt>Qualifikation</dt><dd>${p.verfahren.qualifikation === "aerztlich" ? "Ärztlich" : p.verfahren.qualifikation === "kjp" ? "Kinder- und Jugendlichenpsychotherapie" : "Psychologisch"}</dd></div>
        <div class="summary-row"><dt>Modell</dt><dd>${esc(p.api.model)}</dd></div>
        <div class="summary-row"><dt>Monatsbudget</dt><dd>${p.budget.monthly_eur.toLocaleString("de-DE")} €, höchstens ${p.budget.daily_reports} Berichte je Tag</dd></div>
        <div class="summary-row"><dt>Grenze bei Anthropic</dt><dd>${p.api.console_limit_bestaetigt ? "bestätigt" : '<span class="missing">nicht bestätigt</span>'}</dd></div>
      </dl>

      <div class="group">
        <div class="group-head"><span class="group-title">Was Rana mit den Daten macht</span></div>
        <div class="notice">
          <p style="margin-bottom: var(--s2)"><b>Auf diesem Gerät.</b> Alle Fälle liegen verschlüsselt im Benutzerprofil. Der Schlüssel dazu steht im Windows-Tresor. Wer die Datei kopiert, kann damit nichts anfangen.</p>
          <p style="margin-bottom: var(--s2)"><b>An Anthropic.</b> Beim Formulieren gehen die klinischen Angaben und die Chiffre an die Schnittstelle — <b>nie der Klarname</b>. Rana prüft jede Anfrage darauf und bricht ab, wenn ein Name darin steht.</p>
          <p><b>Sonst nirgendwohin.</b> Keine Cloud, keine Nutzungsstatistik, keine Absturzberichte. Die einzige Verbindung, die Rana aufbauen kann, geht an api.anthropic.com.</p>
        </div>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Fälle aus dem Vorgängerprogramm</span></div>
        <p class="hint" style="margin-bottom: var(--s3)">
          Rana übernimmt nichts von selbst. Wer die Fälle aus dem alten Artefakt weiterführen
          möchte, kann sie hier einlesen — das alte Artefakt bleibt dabei unverändert.
        </p>
        <button class="btn" id="btnLegacy" type="button">${icon.archive} Fälle übernehmen</button>
      </div>`;
  }

  // -----------------------------------------------------------
  // Verhalten
  // -----------------------------------------------------------

  function binde(): void {
    if (seite === 2) bindeZugang();
    if (seite === 4) bindeFertig();

    // Rückmeldung, sobald sich etwas ändert: der Hinweis unten rechts
    // verschwindet, sobald die Bedingung erfüllt ist.
    for (const n of qsa<HTMLElement>("input, select", root)) {
      on(n, "input", () => { lese(); pruefeHinweis(); });
      on(n, "change", () => { lese(); pruefeHinweis(); });
    }
    pruefeHinweis();
  }

  function bindeZugang(): void {
    const keyInput = el<HTMLInputElement>("s_key");
    const stateBox = el("keyState");

    // Ein bereits hinterlegter Schlüssel wird maskiert angezeigt.
    void api.apiKeyStatus().then((s) => {
      if (s.vorhanden && s.maskiert) {
        keyGeprueft = true;
        keyInput.placeholder = s.maskiert;
        stateBox.className = "key-state ok";
        stateBox.innerHTML = `${icon.check} <span>Ein Schlüssel ist hinterlegt. Ein neuer Eintrag ersetzt ihn.</span>`;
      }
    });

    on(el("btnZeigen"), "click", () => {
      const zeigen = keyInput.type === "password";
      keyInput.type = zeigen ? "text" : "password";
      el("btnZeigen").textContent = zeigen ? "Verbergen" : "Zeigen";
    });

    on(el("btnPruefen"), "click", () => { void pruefeSchluessel(); });
    on(keyInput, "input", () => {
      // Ein geänderter Schlüssel muss neu geprüft werden.
      if (keyInput.value.trim()) keyGeprueft = false;
      stateBox.className = "key-state";
      stateBox.textContent = "";
      pruefeHinweis();
    });

    on(el("lnkKeys"), "click", (e) => { e.preventDefault(); void openUrl(CONSOLE_KEYS); });
    on(el("lnkLimits"), "click", (e) => { e.preventDefault(); void openUrl(CONSOLE_LIMITS); });
  }

  async function pruefeSchluessel(): Promise<void> {
    const keyInput = el<HTMLInputElement>("s_key");
    const stateBox = el("keyState");
    const wert = keyInput.value.trim();

    stateBox.className = "key-state";
    stateBox.innerHTML = `<span class="spinner"></span> <span>Prüfe …</span>`;

    try {
      // Zuerst ablegen, dann prüfen: so wird genau der Schlüssel
      // getestet, mit dem später gearbeitet wird.
      if (wert) await api.setApiKey(wert);
      profil.api.model = el<HTMLSelectElement>("s_model").value;
      await api.saveProfile(profil);
      await api.testApiKey();

      keyGeprueft = true;
      stateBox.className = "key-state ok";
      stateBox.innerHTML = `${icon.check} <span>Der Schlüssel funktioniert.</span>`;
      keyInput.value = "";
      keyInput.type = "password";
      const s = await api.apiKeyStatus();
      if (s.maskiert) keyInput.placeholder = s.maskiert;
    } catch (e) {
      keyGeprueft = false;
      stateBox.className = "key-state bad";
      stateBox.innerHTML = `${icon.warn} <span>${esc(api.errorText(e))}</span>`;
    }
    pruefeHinweis();
  }

  function bindeFertig(): void {
    on(el("btnLegacy"), "click", () => { void legacyImport(); });
  }

  // -----------------------------------------------------------
  // Lesen und prüfen
  // -----------------------------------------------------------

  const wert = (id: string): string => {
    const n = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    return n ? n.value.trim() : "";
  };
  const zahl = (id: string, fallback: number): number => {
    const v = parseFloat(wert(id));
    return isNaN(v) ? fallback : v;
  };
  const radio = (name: string): string =>
    qs<HTMLInputElement>(`input[name="${name}"]:checked`, root)?.value ?? "";

  /** Überträgt die sichtbaren Felder ins Profil. */
  function lese(): void {
    if (seite === 0) {
      profil.behandler = {
        titel: wert("s_titel"), name: wert("s_name"), funktion: wert("s_funktion"),
      };
      profil.praxis = {
        name: wert("s_praxis"), strasse: wert("s_strasse"), plz: wert("s_plz"),
        ort: wert("s_ort"), telefon: wert("s_tel"), email: wert("s_mail"),
        brief_ort: wert("s_briefort") || wert("s_ort"),
      };
    }
    if (seite === 1) {
      const v = profil.verfahren;
      profil.verfahren = {
        art: (radio("art") || v.art) as typeof v.art,
        setting: (radio("setting") || v.setting) as typeof v.setting,
        zielgruppe: (radio("zielgruppe") || v.zielgruppe) as typeof v.zielgruppe,
        qualifikation: (radio("qualifikation") || v.qualifikation) as typeof v.qualifikation,
      };
    }
    if (seite === 2) {
      profil.api.model = wert("s_model") || profil.api.model;
      profil.api.console_limit_bestaetigt =
        (document.getElementById("s_console") as HTMLInputElement | null)?.checked ?? false;
      profil.budget = {
        monthly_eur: zahl("s_budget", profil.budget.monthly_eur),
        daily_reports: Math.max(1, Math.round(zahl("s_daily", profil.budget.daily_reports))),
      };
    }
    if (seite === 3) {
      profil.layout = {
        ...profil.layout,
        berichtsart: "fortfuehrung",
        untertitel: wert("s_untertitel"),
        ziel_min: Math.round(zahl("s_min", profil.layout.ziel_min)),
        ziel_soll: Math.round(zahl("s_soll", profil.layout.ziel_soll)),
        ziel_max: Math.round(zahl("s_max", profil.layout.ziel_max)),
        akzent: wert("s_akzent") || profil.layout.akzent,
        schrift_text: wert("s_schrift") || profil.layout.schrift_text,
        schrift_kopf: wert("s_schriftkopf") || profil.layout.schrift_kopf,
      };
    }
  }

  /**
   * Was noch fehlt, um weitergehen zu können.
   *
   * Der Assistent hält nur dort auf, wo es ohne die Angabe wirklich
   * nicht geht: ohne Namen kein Briefkopf, ohne geprüften Schlüssel
   * kein Bericht.
   */
  function fehlend(): string {
    if (seite === 0) {
      if (!wert("s_name")) return "Der Name gehört in den Briefkopf.";
      if (!wert("s_funktion")) return "Die Funktion steht unter der Unterschrift.";
      if (!wert("s_ort")) return "Der Ort wird für die Datumszeile gebraucht.";
    }
    if (seite === 2) {
      if (!keyGeprueft) return "Bitte die Verbindung einmal testen.";
      if (!(document.getElementById("s_console") as HTMLInputElement | null)?.checked) {
        return "Bitte die Ausgabengrenze bei Anthropic bestätigen.";
      }
    }
    if (seite === 3) {
      const min = zahl("s_min", 0), max = zahl("s_max", 0);
      if (min >= max) return "Der Mindestwert muss unter dem Höchstwert liegen.";
    }
    return "";
  }

  function pruefeHinweis(): void {
    const h = document.getElementById("setupHinweis");
    const b = document.getElementById("btnWeiter") as HTMLButtonElement | null;
    if (!h || !b) return;
    const f = fehlend();
    h.textContent = f;
    b.disabled = !!f;
  }

  async function weiter(): Promise<void> {
    lese();
    if (fehlend()) return;

    if (seite < SEITEN.length - 1) {
      // Zwischenstände sichern: bricht der Strom ab, ist nichts verloren.
      await api.saveProfile(profil);
      seite++;
      zeichne();
      return;
    }

    profil.eingerichtet = true;
    await api.saveProfile(profil);
    toast("Rana ist eingerichtet.", "ok");
    onFertig();
  }

  // -----------------------------------------------------------
  // Übernahme aus dem Vorgängerprogramm
  // -----------------------------------------------------------

  async function legacyImport(): Promise<void> {
    await dialog({
      title: "Fälle aus dem Vorgängerprogramm übernehmen",
      confirm: "Übernehmen",
      body: `
        <p class="hint">So kommen die Fälle heraus:</p>
        <ol class="hint" style="padding-left:18px;display:flex;flex-direction:column;gap:6px">
          <li>Das alte Artefakt öffnen.</li>
          <li>Mit <b>F12</b> die Entwicklerwerkzeuge öffnen, Reiter <b>Console</b>.</li>
          <li>Dort eingeben: <code style="font-family:var(--face-record);font-size:var(--t-sm)">copy(localStorage.ptv3_cases_v1)</code></li>
          <li>Der Inhalt liegt jetzt in der Zwischenablage. Unten einfügen.</li>
        </ol>
        <div class="field">
          <label for="legacyJson">Inhalt einfügen</label>
          <textarea id="legacyJson" placeholder='{"cases":{…}}' spellcheck="false"
                    style="font-family:var(--face-record);font-size:var(--t-sm);min-height:150px"></textarea>
        </div>
        <div class="notice">Das alte Artefakt wird dabei nicht verändert. Hier wird nur gelesen.</div>`,
      onConfirm: async (r) => {
        const json = qs<HTMLTextAreaElement>("#legacyJson", r)!.value.trim();
        if (!json) { toast("Es wurde nichts eingefügt.", "danger"); return false; }
        try {
          const n = await api.importLegacy(json);
          toast(`${n} ${n === 1 ? "Fall" : "Fälle"} übernommen.`, "ok");
          return true;
        } catch (e) {
          toast(api.errorText(e), "danger");
          return false;
        }
      },
    });
  }

  zeichne();
}
