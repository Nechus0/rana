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

import { zeigeEinstellungen, EIGENE_VERSION } from "./views/settings";
import { el, esc, eur, icon, on, qsa, relDate, toast } from "./ui/kit";

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
  // Hier stand einmal eine Abfrage bei GitHub beim Start. Sie ist
  // entfernt: das README sagt zu, dass Rana von sich aus nichts ins
  // Netz schickt, und eine Zusage, die nur meistens gilt, ist keine.
  // Die Prüfung läuft ausschliesslich über Einstellungen →
  // Aktualisierung, auf Klick und sichtbar.
}

// ===============================================================
// Gerüst
// ===============================================================

function zeichneGeruest(): void {
  el("app").innerHTML = `
    <header class="topbar" id="topbar">
      <div class="topbar-left">
        <button class="topbar-rail-toggle" id="btnRailToggle"
                title="Seitenschiene ein-/ausklappen" aria-label="Seitenschiene ein-/ausklappen"
                aria-expanded="true">${icon.panelL}</button>
        <span class="brand-name">Rana</span>
        <span class="brand-version">arvalis</span>
        <span class="brand-ver-num">${esc(EIGENE_VERSION)}</span>
      </div>
      <div class="topbar-center">
        <span class="topbar-patient" id="topbarPatient"></span>
      </div>
      <div class="topbar-right">
        <span class="save-indicator" id="saveIndicator">
          <span class="save-dot"></span>
          <span class="save-text">Gespeichert</span>
        </span>
        <button class="btn btn-sm btn-quiet btn-icon" id="btnEinstellungen"
                title="Einstellungen" aria-label="Einstellungen">${icon.dots}</button>
        <button class="topbar-ctx-toggle" id="btnCtxToggle"
                title="Übersicht ein-/ausklappen" aria-label="Übersicht ein-/ausklappen"
                aria-expanded="true">${icon.panelR}</button>
      </div>
    </header>
    <div class="shell" id="shell">
      ${railHtml()}
      <main class="work">
        <header class="work-head">
          <nav class="stepbar" role="tablist" aria-label="Arbeitsschritte">
            ${SCHRITTE.map((s, i) => `
              <button class="stepbar-step" role="tab" data-schritt="${i}" aria-selected="false"
                      title="${esc(s.titel)}">
                <span class="stepbar-node">${i + 1}</span>
                <span class="stepbar-label">${esc(s.kurz)}</span>
                <span class="stepbar-flag" aria-hidden="true"></span>
              </button>`).join("")}
          </nav>
          <div class="work-head-titel">
            <div class="work-title">
              <span class="work-eyebrow" id="workEyebrow"></span>
              <h2 id="workTitel"></h2>
            </div>
            <span class="spacer"></span>
          </div>
        </header>
        <div class="work-body" id="work-body" tabindex="-1">
          <div class="work-inner" id="workInner"></div>
        </div>
      </main>
      <aside class="context" id="context" aria-label="Übersicht">
        <div class="context-body" id="contextBody"></div>
        <div class="context-collapsed" id="contextCollapsed">
          <button class="rail-tab" id="btnCtxExpand" title="Übersicht anzeigen">
            <span class="rail-tab-label">Übersicht</span>
          </button>
        </div>
      </aside>
    </div>`;

  bindeTopbar();
  bindeRail();
  zeichneSchritt();
  tastenkuerzel();
}

// ---------------------------------------------------------------
// Seitenschiene
// ---------------------------------------------------------------

function railHtml(): string {
  return `
    <nav class="rail" id="rail" aria-label="Fälle">
      <div class="rail-body" id="railBody">
        <div class="rail-head">
          <span class="record">Fälle</span>
          <span class="record-num small muted" id="fallZaehler"></span>
        </div>

        <div class="case-search">
          ${icon.search}
          <input type="search" id="fallSuche" placeholder="Suchen …" aria-label="Fälle durchsuchen">
        </div>

        <div class="row rail-filters">
          <select id="fallSort" aria-label="Fälle ordnen nach" style="flex:1;">
            ${(Object.keys(S.SORT_NAMEN) as S.SortSchluessel[]).map((k) => `
              <option value="${k}" ${S.state.sortierung === k ? "selected" : ""}>Sortierung: ${esc(S.SORT_NAMEN[k])}</option>`).join("")}
          </select>
          <select id="fallFilter" aria-label="Fälle filtern" style="flex:1;">
            <option value="alle">Alle zeigen</option>
          </select>
        </div>

        <ul class="case-list" id="fallListe" role="list"></ul>
      </div>
      
      <div class="rail-foot">
        <button class="btn btn-sm" id="btnNeuerFall" title="Neuen Fall anlegen (Strg+N)">${icon.plus} Neuer Patient</button>
        <button class="btn btn-sm btn-quiet" id="btnOrdner" title="Patienten aus Ordner laden">${icon.save} Aus Ordner</button>
      </div>

      <div class="rail-collapsed" id="railCollapsed">
        <button class="rail-tab" id="btnRailExpand" title="Fälle anzeigen">
          <span class="rail-tab-label">Fälle</span>
        </button>
      </div>
    </nav>`;
}

function bindeRail(): void {
  on(el("btnNeuerFall"), "click", () => { void neuerFall(); });
  on(el("btnOrdner"), "click", () => { toast("Verzeichnisauswahl folgt in Kürze."); });

  // Kein Umweg über Rust mehr: die Übersichten liegen bereits im
  // Speicher, gefiltert wird hier. Damit entfällt auch die Verzögerung
  // — die Liste folgt dem Tippen unmittelbar.
  on(el("fallSuche"), "input", () => {
    S.state.query = el<HTMLInputElement>("fallSuche").value;
    zeichneFallListe();
  });
  // Escape leert die Suche, ohne dass man das Feld erst markieren muss.
  on(el("fallSuche"), "keydown", (e) => {
    if ((e as KeyboardEvent).key !== "Escape") return;
    const feld = el<HTMLInputElement>("fallSuche");
    if (!feld.value) return;
    feld.value = "";
    S.state.query = "";
    zeichneFallListe();
  });

  for (const b of qsa<HTMLButtonElement>("[data-schritt]")) {
    on(b, "click", () => geheZu(parseInt(b.dataset.schritt!, 10)));
  }

  on(el("fallSort"), "change", () => {
    S.setzeSortierung(el<HTMLSelectElement>("fallSort").value as S.SortSchluessel, S.state.sortAuf);
    zeichneFallListe();
  });


  zeichneFallListe();
}

function bindeTopbar(): void {
  on(el("btnEinstellungen"), "click", () => { void zeigeEinstellungen(neuZeichnen); });

  // Sidebar ein-/ausklappen
  on(el("btnRailToggle"), "click", toggleRail);

  // Kontextspalte ein-/ausklappen
  on(el("btnCtxToggle"), "click", toggleContext);
  const expandCtx = document.getElementById("btnCtxExpand");
  if (expandCtx) on(expandCtx, "click", toggleContext);
}

function toggleRail(): void {
  const rail = el("rail");
  const collapsed = rail.classList.toggle("collapsed");
  el("btnRailToggle").setAttribute("aria-expanded", String(!collapsed));

  const expandBtn = document.getElementById("btnRailExpand");
  if (expandBtn && !expandBtn.dataset.bound) {
    expandBtn.dataset.bound = "1";
    on(expandBtn, "click", toggleRail);
  }
}

function toggleContext(): void {
  const ctx = el("context");
  const collapsed = ctx.classList.toggle("collapsed");
  el("btnCtxToggle").setAttribute("aria-expanded", String(!collapsed));
}

function zeichneFallListe(): void {
  const box = el("fallListe");
  const gruppen = S.sichtbareGruppen();
  const cases = gruppen.flatMap((g) => g.berichte);

  // Trefferzeile: bei aktiver Suche sieht man, wie viele von wie vielen
  // übrig sind — sonst rät man, ob die Liste vollständig ist.
  const zaehler = document.getElementById("fallZaehler");
  if (zaehler) {
    const gesamt = S.state.cases.length;
    zaehler.textContent = S.state.query.trim()
      ? `${cases.length} von ${gesamt}`
      : (gesamt ? String(gesamt) : "");
  }

  if (!cases.length) {
    box.innerHTML = `<li class="case-empty">${
      S.state.query ? "Nichts gefunden." : "Noch kein Fall angelegt."
    }</li>`;
    return;
  }

  // Die zweite Zeile zeigt, wonach gerade geordnet ist. So sieht man
  // die Sortierung an den Einträgen selbst und nicht nur am Auswahlfeld.
  const zusatz = (c: api.CaseSummary): string => {
    switch (S.state.sortierung) {
      case "angelegt": return `angelegt ${relDate(c.created_at)}`;
      case "nummer":   return c.antrag_nr ? `${c.antrag_nr}. Antrag` : "ohne Nummer";
      case "name":     return c.chiffre || "";
      default:         return relDate(c.updated_at);
    }
  };

  // Zwei Ebenen: oben die Person, darunter ihre Berichte. Aufgeklappt
  // wird, wo der offene Bericht liegt oder wo die Suche einen Treffer
  // hat — sonst müsste man bei jeder Suche erst klicken, um zu sehen,
  // was gefunden wurde.
  const suche = !!S.state.query.trim();

  box.innerHTML = gruppen.map((g) => {
    const pid = g.patient?.id ?? "__ohne__";
    const auf = suche || S.state.offen.has(pid) || g.berichte.some((c) => c.id === S.state.activeId);
    const zahl = g.patient ? g.patient.report_count : g.berichte.length;

    // Der Folgeantrag sitzt an der Person, nicht am Bericht. Das ist
    // der häufigste Vorgang überhaupt und kostet so einen Klick
    // statt vier.
    const kopf = `
      <div class="pat-zeile">
        <button class="pat-item" data-pat="${esc(pid)}"
                aria-expanded="${auf}"
                ${g.patient ? "" : 'data-lose="ja"'}>
          <span class="pat-caret" aria-hidden="true">${icon.caret}</span>
          <span class="pat-name">${esc(g.label)}</span>
          <span class="pat-zahl">${zahl}</span>
        </button>
        ${g.patient && g.patient.report_count
          ? `<button class="pat-plus" data-folge="${esc(g.patient.id)}"
                     title="Nächsten Fortführungsantrag für ${esc(g.label)} anlegen"
                     aria-label="Nächsten Fortführungsantrag für ${esc(g.label)} anlegen"
                     >${icon.plus}</button>`
          : ""}
      </div>`;

    const kinder = auf ? g.berichte.map((c) => `
      <li>
        <button class="case-item" data-fall="${esc(c.id)}"
                aria-current="${c.id === S.state.activeId}">
          <span class="case-item-text">
            <span class="case-item-name">${c.antrag_nr ? `${esc(c.antrag_nr)}. Fortführungsantrag` : "Antrag ohne Nummer"}</span>
            <span class="case-item-meta">${esc(zusatz(c))}</span>
          </span>
          ${c.has_report ? `<span class="case-item-fertig" title="Bericht formuliert">${icon.check}</span>` : ""}
        </button>
      </li>`).join("") : "";

    return `<li class="pat-gruppe">${kopf}<ul class="case-sub" role="list">${kinder}</ul></li>`;
  }).join("");

  // Ein Zuhörer am Behälter statt einer je Eintrag. Bei fünfzig
  // Patientinnen sind das fünfzig Anmeldungen weniger — und sie
  // überleben das Neuzeichnen der Liste.
  if (!box.dataset.gebunden) {
    box.dataset.gebunden = "ja";

    on(box, "click", (e) => {
      const f = (e.target as HTMLElement).closest<HTMLElement>("[data-folge]");
      if (f) {
        void S.folgeAntragFuerPatientin(f.dataset.folge!).then((id) => {
          if (id) { neuZeichnen(); toast("Nächster Fortführungsantrag angelegt.", "ok", 2500); }
        }).catch((err) => toast(api.errorText(err), "danger"));
        return;
      }
      const p = (e.target as HTMLElement).closest<HTMLElement>("[data-pat]");
      if (p) {
        S.klappe(p.dataset.pat!);
        zeichneFallListe();
        return;
      }
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-fall]");
      if (b) void wechsleFall(b.dataset.fall!);
    });

    box.addEventListener("contextmenu", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-fall]");
      if (!b) return;
      e.preventDefault();
      const c = S.state.cases.find((x) => x.id === b.dataset.fall);
      if (!c) return;
      void fallInPapierkorb(c.id, c.label).then((weg) => {
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
  if (id === S.state.activeId) {
    await S.schliesseFall();
  } else {
    await S.ladeFall(id);
  }
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
  const stepbar = document.querySelector(".stepbar") as HTMLElement | null;
  const ctx = document.querySelector(".context") as HTMLElement | null;

  if (!S.state.activeId) {
    el("workEyebrow").textContent = "";
    el("workTitel").textContent = "Willkommen bei Rana";
    el("workInner").className = "work-inner";
    el("workInner").innerHTML = `
      <div style="text-align:center; padding: 120px 20px; color: var(--peat);">
        <svg width="48" height="48" viewBox="0 0 24 24" style="margin-bottom: 20px; color: var(--reed);">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
        <h3>Kein Fall ausgewählt</h3>
        <p style="margin-bottom: 24px; color: var(--reed);">Wählen Sie einen Patienten aus der Liste<br>oder legen Sie einen neuen Fall an.</p>
        <button class="btn btn-primary" id="btnEmptyNeuerFall">Neuen Fall anlegen</button>
      </div>
    `;
    if (stepbar) stepbar.style.display = "none";
    if (ctx) ctx.style.display = "none";
    
    // Bind button
    const btn = document.getElementById("btnEmptyNeuerFall");
    if (btn) btn.addEventListener("click", () => { void neuerFall(); });
    
    return;
  }

  if (stepbar) stepbar.style.display = "";
  if (ctx) ctx.style.display = "";

  const n = S.state.step;

  el("workEyebrow").textContent = `Schritt ${n + 1} von ${SCHRITTE.length}`;
  el("workTitel").textContent = SCHRITTE[n].titel;

  // Schritt 5 braucht mehr Platz: dort liegt das Blatt.
  el("workInner").className = "work-inner" + (n >= 3 ? " wide" : "");
  el("workInner").innerHTML = renderSchritt(n);
  bindeSchritt(n, neuZeichnen);

  aktualisiereRand();
}



// ---------------------------------------------------------------
// Alles am Rand: Spur, Kontextspalte, Speicherstand
// ---------------------------------------------------------------

function aktualisiereRand(): void {
  aktualisiereSchrittleiste();
  aktualisiereKontext();
  aktualisiereSpeicherstand();
  aktualisiereTopbar();
}

function aktualisiereTopbar(): void {
  const tp = document.getElementById("topbarPatient");
  if (tp) tp.textContent = S.state.fields.f_name || "";
}

function aktualisiereSchrittleiste(): void {
  const schritte = qsa<HTMLElement>("[data-schritt]");
  if (!schritte.length) return;

  schritte.forEach((b, i) => {
    const aktuell = i === S.state.step;
    b.classList.toggle("is-current", aktuell);
    b.classList.toggle("is-done", i < S.state.step);
    b.classList.toggle("has-gap", S.lueckenImSchritt(i));
    b.setAttribute("aria-selected", String(aktuell));
  });

  // Die Verbindungslinien färben sich allein über die Klassen
  // is-done und is-current — es braucht keine gerechnete Länge mehr.
}

function aktualisiereKontext(): void {
  const box = document.getElementById("contextBody");
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
              <span class="gap-num">${l.schritt + 1}</span>
              ${esc(l.label)}
            </button></li>`).join("")}
        </ul>`
      : `<p class="hint">Alle Pflichtangaben liegen vor.</p>`}
    </section>

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
  const dot = document.querySelector(".save-dot");
  const txt = document.querySelector(".save-text");
  if (!dot || !txt) return;

  if (S.state.dirty) {
    dot.classList.add("unsaved");
    (txt as HTMLElement).textContent = "Ungespeichert";
  } else {
    dot.classList.remove("unsaved");
    (txt as HTMLElement).textContent = "Gespeichert";
  }
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

export function istDunklesThema(): boolean {
  return document.documentElement.dataset.theme === "dark";
}

export function wechsleThema(): void {
  const dunkel = istDunklesThema();
  if (dunkel) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = "dark";
  localStorage.setItem(THEMA_KEY, dunkel ? "light" : "dark");
}

// ---------------------------------------------------------------

void main().catch((e) => {
  // Kommt der Start nicht durch, darf kein leeres Fenster stehen bleiben.
  el("app").innerHTML = `
    <div style="max-width:520px;margin:14vh auto;padding:0 24px">
      <h1 style="font-size:var(--t-xl);margin-bottom:12px">Rana konnte nicht starten</h1>
      <div class="notice notice-danger">${esc(api.errorText(e))}</div>
      <p class="hint" style="margin-top:16px">
        Läuft Rana bereits in einem anderen Fenster? Dann bitte dieses schliessen.
        Andernfalls hilft ein Neustart des Rechners; die Falldaten bleiben unberührt.
      </p>
    </div>`;
});
