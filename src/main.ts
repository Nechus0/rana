/**
 * Rana · Einstieg und Anwendungsgerüst.
 *
 * Ablauf beim Start:
 *   1. Ist eingerichtet?  nein → Assistent
 *   2. Fallliste laden, letzten Fall öffnen
 *   3. Gerüst zeichnen: Schiene, Arbeitsfläche, Kontextspalte
 *
 * Die Blaufärbung bei Übertragung hängt an einem einzigen Merkmal am
 * Wurzelelement (`data-transmitting`). Sie wird ausschliesslich von
 * Rust gesetzt — die Oberfläche kann sie nicht vortäuschen und nicht
 * unterdrücken. Das macht sie zu einer verlässlichen Anzeige dafür,
 * dass gerade Daten das Gerät verlassen.
 */

import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-serif/600.css";
import "@fontsource/ibm-plex-serif/400-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";
import "./styles/setup.css";
import "./styles/document.css";

import * as api from "./core/ipc";
import * as S from "./core/state";
import { runSetup } from "./setup/wizard";
import { bindeSchritt, fallInPapierkorb, renderSchritt, SCHRITTE } from "./views/steps";
import {
  pruefeAktualisierung, zeigeEinstellungen, zeigePapierkorb,
  zeigeSicherung, zeigeUeber, zeigeVerbrauch,
} from "./views/settings";
import { debounce, el, esc, eur, icon, on, qsa, relDate, toast } from "./ui/kit";

// ===============================================================
// Start
// ===============================================================

async function main(): Promise<void> {
  stelleThemaHer();
  S.speichernBeimBeenden();

  // Die Blaufärbung. Nur Rust löst sie aus.
  await api.onTransmit((aktiv) => {
    document.documentElement.dataset.transmitting = aktiv ? "true" : "false";
    S.patch({ transmitting: aktiv });
  });

  if (!(await api.isConfigured())) {
    await runSetup(() => { void starteArbeitsansicht(); });
    return;
  }
  await starteArbeitsansicht();
}

async function starteArbeitsansicht(): Promise<void> {
  S.patch({ profile: await api.getProfile() });
  await S.refreshCases();
  await S.refreshBudget();

  if (S.state.cases.length) {
    await S.ladeFall(S.state.cases[0].id);
  } else {
    await S.neuerFall();
  }

  zeichneGeruest();
  S.subscribe(() => { aktualisiereRand(); });
  void pruefeAktualisierung();
}

// ===============================================================
// Gerüst
// ===============================================================

function zeichneGeruest(): void {
  el("app").innerHTML = `
    <div class="shell">
      ${railHtml()}
      <main class="work">
        <header class="work-head">
          <div class="work-title">
            <span class="work-eyebrow" id="workEyebrow"></span>
            <h2 id="workTitel"></h2>
          </div>
          <span class="spacer"></span>
          <span class="record" id="speicherStand"></span>
        </header>
        <div class="work-body" id="work-body" tabindex="-1">
          <div class="work-inner" id="workInner"></div>
        </div>
        <footer class="work-foot">
          <button class="btn" id="btnZurueck">${icon.back} Zurück</button>
          <span class="spacer"></span>
          <span class="hint" id="fussHinweis"></span>
          <button class="btn btn-primary" id="btnWeiter">Weiter ${icon.fwd}</button>
        </footer>
      </main>
      <aside class="context" id="context" aria-label="Übersicht"></aside>
    </div>`;

  bindeRail();
  bindeFuss();
  zeichneSchritt();
  tastenkuerzel();
}

// ---------------------------------------------------------------
// Seitenschiene
// ---------------------------------------------------------------

function railHtml(): string {
  return `
    <nav class="rail" aria-label="Fälle und Schritte">
      <div class="brand">
        <span class="brand-name">Rana</span>
        <span class="brand-version">arvalis</span>
      </div>

      <div class="rail-head">
        <span class="record">Fälle</span>
        <button class="btn btn-sm btn-quiet btn-icon" id="btnNeuerFall"
                title="Neuen Fall anlegen (Strg+N)" aria-label="Neuen Fall anlegen">${icon.plus}</button>
      </div>

      <div class="case-search">
        ${icon.search}
        <input type="search" id="fallSuche" placeholder="Suchen …" aria-label="Fälle durchsuchen">
      </div>

      <ul class="case-list" id="fallListe" role="list"></ul>

      <div class="spine" id="spine" role="tablist" aria-label="Arbeitsschritte">
        ${SCHRITTE.map((s, i) => `
          <button class="spine-step" role="tab" data-schritt="${i}" aria-selected="false">
            <span class="spine-node">${i + 1}</span>
            <span class="spine-label">${esc(s.kurz)}</span>
            <span class="spine-flag" aria-hidden="true"></span>
          </button>`).join("")}
      </div>

      <div class="rail-foot">
        <button class="rail-link" id="lnkVerbrauch">${icon.chart} Verbrauch <span class="spacer"></span>
          <span class="record-num small" id="railVerbrauch"></span></button>
        <button class="rail-link" id="lnkSicherung">${icon.save} Sicherung</button>
        <button class="rail-link" id="lnkPapierkorb">${icon.trash} Papierkorb</button>
        <button class="rail-link" id="lnkEinstellungen">${icon.gear} Einstellungen</button>
        <button class="rail-link" id="lnkThema">${icon.moon} Dunkler Modus</button>
        <button class="rail-link" id="lnkUeber">${icon.info} Über Rana</button>
      </div>
    </nav>`;
}

function bindeRail(): void {
  on(el("btnNeuerFall"), "click", () => { void neuerFall(); });

  on(el("fallSuche"), "input", debounce(() => {
    S.state.query = el<HTMLInputElement>("fallSuche").value;
    void S.refreshCases().then(zeichneFallListe);
  }, 220));

  for (const b of qsa<HTMLButtonElement>("[data-schritt]")) {
    on(b, "click", () => geheZu(parseInt(b.dataset.schritt!, 10)));
  }

  on(el("lnkVerbrauch"),     "click", () => { void zeigeVerbrauch(); });
  on(el("lnkSicherung"),     "click", () => { void zeigeSicherung(neuZeichnen); });
  on(el("lnkPapierkorb"),    "click", () => { void zeigePapierkorb(neuZeichnen); });
  on(el("lnkEinstellungen"), "click", () => { void zeigeEinstellungen(neuZeichnen); });
  on(el("lnkUeber"),         "click", () => { void zeigeUeber(); });
  on(el("lnkThema"),         "click", wechsleThema);

  zeichneFallListe();
}

function zeichneFallListe(): void {
  const box = el("fallListe");
  const cases = S.state.cases;

  if (!cases.length) {
    box.innerHTML = `<li class="case-empty">${
      S.state.query ? "Nichts gefunden." : "Noch kein Fall angelegt."
    }</li>`;
    return;
  }

  box.innerHTML = cases.map((c) => `
    <li>
      <button class="case-item" data-fall="${esc(c.id)}"
              aria-current="${c.id === S.state.activeId}">
        <span class="case-item-name">${esc(c.label)}</span>
        ${c.antrag_nr ? `<span class="case-item-nr">#${esc(c.antrag_nr)}</span>` : ""}
      </button>
    </li>`).join("");

  for (const b of qsa<HTMLButtonElement>("[data-fall]", box)) {
    on(b, "click", () => { void wechsleFall(b.dataset.fall!); });
    // Rechtsklick auf einen Fall bietet das Löschen an.
    b.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const c = cases.find((x) => x.id === b.dataset.fall);
      if (c) void fallInPapierkorb(c.id, c.label).then((weg) => {
        if (weg && c.id === S.state.activeId) void naechstenFallOeffnen();
        else zeichneFallListe();
      });
    });
  }
}

async function neuerFall(): Promise<void> {
  await S.neuerFall();
  zeichneFallListe();
  zeichneSchritt();
  toast("Neuer Fall angelegt.", "ok", 2500);
  (document.getElementById("f_name") as HTMLInputElement | null)?.focus();
}

async function wechsleFall(id: string): Promise<void> {
  if (id === S.state.activeId) return;
  await S.ladeFall(id);
  zeichneFallListe();
  zeichneSchritt();
}

async function naechstenFallOeffnen(): Promise<void> {
  await S.refreshCases();
  if (S.state.cases.length) await S.ladeFall(S.state.cases[0].id);
  else await S.neuerFall();
  zeichneFallListe();
  zeichneSchritt();
}

// ---------------------------------------------------------------
// Schritte
// ---------------------------------------------------------------

function geheZu(n: number): void {
  if (n < 0 || n >= SCHRITTE.length) return;
  void S.speichereJetzt();
  S.state.step = n;
  zeichneSchritt();
  el("work-body").scrollTo({ top: 0, behavior: "smooth" });
}

const neuZeichnen = () => { zeichneSchritt(); zeichneFallListe(); };

function zeichneSchritt(): void {
  const n = S.state.step;

  el("workEyebrow").textContent = `Schritt ${n + 1} von ${SCHRITTE.length}`;
  el("workTitel").textContent = SCHRITTE[n].titel;

  // Schritt 5 braucht mehr Platz: dort liegt das Blatt.
  el("workInner").className = "work-inner" + (n >= 3 ? " wide" : "");
  el("workInner").innerHTML = renderSchritt(n);
  bindeSchritt(n, neuZeichnen);

  el<HTMLButtonElement>("btnZurueck").disabled = n === 0;
  const weiter = el<HTMLButtonElement>("btnWeiter");
  weiter.classList.toggle("hidden", n === SCHRITTE.length - 1);

  aktualisiereRand();
}

function bindeFuss(): void {
  on(el("btnZurueck"), "click", () => geheZu(S.state.step - 1));
  on(el("btnWeiter"),  "click", () => geheZu(S.state.step + 1));
}

// ---------------------------------------------------------------
// Alles am Rand: Spur, Kontextspalte, Speicherstand
// ---------------------------------------------------------------

function aktualisiereRand(): void {
  aktualisiereSpur();
  aktualisiereKontext();
  aktualisiereSpeicherstand();
}

function aktualisiereSpur(): void {
  const schritte = qsa<HTMLElement>("[data-schritt]");
  if (!schritte.length) return;

  schritte.forEach((b, i) => {
    const aktuell = i === S.state.step;
    b.classList.toggle("is-current", aktuell);
    b.classList.toggle("is-done", i < S.state.step);
    b.classList.toggle("has-gap", S.lueckenImSchritt(i));
    b.setAttribute("aria-selected", String(aktuell));
  });

  // Die Spur füllt sich bis zum aktuellen Knoten.
  const spine = document.getElementById("spine");
  if (spine && schritte.length > 1) {
    const anteil = S.state.step / (schritte.length - 1);
    const hoehe = (schritte[schritte.length - 1].offsetTop - schritte[0].offsetTop) * anteil;
    spine.style.setProperty("--spine-progress", `${Math.max(0, hoehe)}px`);
  }
}

function aktualisiereKontext(): void {
  const box = document.getElementById("context");
  if (!box) return;

  const pct = S.vollstaendigkeit();
  const offen = S.luecken();
  const b = S.state.budget;

  box.innerHTML = `
    <section class="ctx-block">
      <span class="record">Vollständigkeit</span>
      <div class="completeness">
        <div class="comp-value">${pct}<small> %</small></div>
        <div class="comp-bar">
          <div class="comp-fill ${pct === 100 ? "is-full" : ""}" style="--comp:${pct}%"></div>
        </div>
      </div>
      ${offen.length ? `
        <ul class="gap-list">
          ${offen.map((l) => `
            <li><button class="gap-item" data-luecke="${esc(l.feld)}" data-schritt="${l.schritt}">
              ${esc(l.label)}
            </button></li>`).join("")}
        </ul>`
      : `<p class="hint">Alle Pflichtangaben liegen vor.</p>`}
    </section>

    ${b ? `
      <section class="ctx-block">
        <span class="record">Verbrauch</span>
        <div class="budget">
          <div class="budget-row">
            <span class="budget-amount">${eur(b.month_spent_eur)}</span>
            <span class="budget-of">von ${eur(b.month_limit_eur)}</span>
          </div>
          <div class="budget-bar">
            <div class="budget-fill ${b.level === "gestoppt" ? "stop" : b.level === "warnung" ? "warn" : ""}"
                 style="--used:${Math.min(100, b.month_pct)}%"></div>
          </div>
          <p class="hint">${b.today_reports} von ${b.daily_limit} Berichten heute</p>
        </div>
      </section>` : ""}

    <section class="ctx-block">
      <span class="record">Dieser Fall</span>
      <p class="hint">
        ${S.state.fields.f_chiffre ? `Chiffre ${esc(S.state.fields.f_chiffre)}<br>` : ""}
        Zuletzt geändert ${esc(relDate(Date.now()))}
      </p>
    </section>`;

  // Ein Klick auf eine Lücke springt genau dorthin.
  for (const g of qsa<HTMLButtonElement>("[data-luecke]", box)) {
    on(g, "click", () => {
      geheZu(parseInt(g.dataset.schritt!, 10));
      setTimeout(() => {
        const f = document.getElementById(g.dataset.luecke!);
        f?.focus();
        f?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 60);
    });
  }

  const rv = document.getElementById("railVerbrauch");
  if (rv && b) rv.textContent = eur(b.month_spent_eur);
}

function aktualisiereSpeicherstand(): void {
  const n = document.getElementById("speicherStand");
  if (!n) return;
  n.textContent = S.state.dirty ? "nicht gespeichert" : "gespeichert";
  n.style.color = S.state.dirty ? "var(--amber)" : "var(--reed)";
}

// ---------------------------------------------------------------
// Tastatur
// ---------------------------------------------------------------

/**
 * Durchgängige Tastaturbedienung.
 *
 * Die Kürzel greifen nie, während in einem Feld getippt wird — mit
 * Ausnahme derer mit Strg, denn die kollidieren nicht mit Text.
 */
function tastenkuerzel(): void {
  on(document, "keydown", (e) => {
    const ke = e as KeyboardEvent;
    const imFeld = !!(document.activeElement as HTMLElement | null)?.closest(
      "input, textarea, select, [contenteditable='true']"
    );

    if (ke.ctrlKey || ke.metaKey) {
      switch (ke.key.toLowerCase()) {
        case "s": ke.preventDefault(); void S.speichereJetzt().then(() => toast("Gespeichert.", "ok", 1800)); return;
        case "n": ke.preventDefault(); void neuerFall(); return;
        case "f": ke.preventDefault(); el("fallSuche").focus(); return;
        case ",": ke.preventDefault(); void zeigeEinstellungen(neuZeichnen); return;
      }
      // Strg + 1…5 springt direkt zu einem Schritt.
      const n = parseInt(ke.key, 10);
      if (n >= 1 && n <= SCHRITTE.length) { ke.preventDefault(); geheZu(n - 1); return; }
    }

    if (imFeld) return;

    // Ohne Zusatztaste: Pfeile blättern durch die Schritte.
    if (ke.key === "ArrowRight") { ke.preventDefault(); geheZu(S.state.step + 1); }
    if (ke.key === "ArrowLeft")  { ke.preventDefault(); geheZu(S.state.step - 1); }
  });
}

// ---------------------------------------------------------------
// Helles und dunkles Moor
// ---------------------------------------------------------------

const THEMA_KEY = "rana-thema";

function stelleThemaHer(): void {
  const gespeichert = localStorage.getItem(THEMA_KEY);
  if (gespeichert === "dark") document.documentElement.dataset.theme = "dark";
  else if (!gespeichert && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.dataset.theme = "dark";
  }
}

function wechsleThema(): void {
  const dunkel = document.documentElement.dataset.theme === "dark";
  if (dunkel) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = "dark";
  localStorage.setItem(THEMA_KEY, dunkel ? "light" : "dark");

  const l = document.getElementById("lnkThema");
  if (l) l.innerHTML = `${icon.moon} ${dunkel ? "Dunkler" : "Heller"} Modus`;
}

// ---------------------------------------------------------------

void main().catch((e) => {
  // Kommt der Start nicht durch, darf kein leeres Fenster stehen bleiben.
  el("app").innerHTML = `
    <div style="max-width:520px;margin:14vh auto;padding:0 24px">
      <h1 style="font-size:24px;margin-bottom:12px">Rana konnte nicht starten</h1>
      <div class="notice notice-danger">${esc(api.errorText(e))}</div>
      <p class="hint" style="margin-top:16px">
        Läuft Rana bereits in einem anderen Fenster? Dann bitte dieses schliessen.
        Andernfalls hilft ein Neustart des Rechners; die Falldaten bleiben unberührt.
      </p>
    </div>`;
});
