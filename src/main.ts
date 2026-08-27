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
  EIGENE_VERSION, zeigeEinstellungen, zeigePapierkorb, zeigeSicherung,
} from "./views/settings";
import { offeneZuordnungen, zeigeZuordnung } from "./views/patients";
import { bindePatient, ladePatient, renderPatient } from "./views/patientview";
import { confirmDialog, el, esc, icon, marke, on, qsa, relDate, toast } from "./ui/kit";

import { zeigePatientStammdaten } from "./views/patient_dialog";
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
    <!-- Diese Leiste IST der Fensterrahmen. Windows zeichnet keinen
         eigenen mehr (decorations: false in tauri.conf.json), deshalb
         trägt sie die Ziehfläche und die drei Fensterknöpfe rechts.
         Das Merkmal data-tauri-drag-region verschiebt das Fenster;
         Knöpfe und Felder darin sind davon ausgenommen, sonst liesse
         sich nichts mehr anklicken. -->
    <header class="topbar" id="topbar" data-tauri-drag-region>
      <div class="topbar-left" data-tauri-drag-region>
        <span class="brand" data-tauri-drag-region>
          ${marke}
          <span class="brand-name">Rana</span>
          <span class="brand-version">arvalis</span>
          <span class="brand-ver-num">${esc(EIGENE_VERSION)}</span>
        </span>
      </div>
      <!-- Zwischen Marke und Fensterknöpfen steht nichts. Der Name der
           Patientin, der Speicherstand und das Menü sassen hier und
           gehören nicht hierher: das eine ist Zusammenhang der Arbeit,
           das andere ihr Stand, das dritte ein Vorrat an Befehlen. Die
           Fensterleiste beantwortet nur die Frage, welches Fenster das
           ist — und wie man es schliesst. -->
      <div class="topbar-center" data-tauri-drag-region></div>
      <div class="topbar-right">
        <div class="win-ctrls">
          <button class="win-ctrl" id="winMin" title="Minimieren" aria-label="Minimieren">${icon.winMin}</button>
          <button class="win-ctrl" id="winMax" title="Maximieren" aria-label="Maximieren">${icon.winMax}</button>
          <button class="win-ctrl win-close" id="winClose" title="Schliessen" aria-label="Schliessen">${icon.winClose}</button>
        </div>
      </div>
    </header>
    <div class="shell" id="shell">
      ${railHtml()}
      <main class="work">
        <header class="work-head">
          <div class="work-actions-top" style="position: absolute; top: 16px; right: 24px; z-index: 50; display: flex; align-items: center; gap: 16px;">
            <span class="save-indicator" id="saveIndicator">
              <span class="save-dot"></span>
              <span class="save-text">Gespeichert</span>
            </span>
            <div class="menuwrap">
              <button class="btn btn-quiet btn-icon" id="btnMehr"
                      title="Menü" aria-label="Menü"
                      aria-haspopup="menu" aria-expanded="false">${icon.dots}</button>
              <div class="menu" id="mehrMenu" role="menu" hidden>
                <button class="menu-item" role="menuitem" id="mnuEinstellungen">${icon.gear}<span>Einstellungen</span></button>
                <button class="menu-item" role="menuitem" id="mnuSicherung">${icon.save}<span>Sicherung</span></button>
                <button class="menu-item" role="menuitem" id="mnuPapierkorb">${icon.trash}<span>Papierkorb</span></button>
                <div class="menu-sep"></div>
                <button class="menu-item" role="menuitem" id="mnuZuordnen" hidden>
                  ${icon.merge}<span id="mnuZuordnenText">Berichte zuordnen</span>
                </button>
              </div>
            </div>
          </div>
          <!-- Der Zusammenhang steht über der Arbeit, nicht über dem
               Fenster: wessen Antrag hier offen ist, welcher Schritt es
               ist, und ob alles gesichert ist. -->
          <div class="work-head-titel">
            <div class="work-title">
              <span class="work-eyebrow" id="workEyebrow"></span>
              <h2 id="workTitel"></h2>
            </div>
            <span class="spacer"></span>
          </div>
          <nav class="stepbar" role="tablist" aria-label="Arbeitsschritte">
            ${SCHRITTE.map((s, i) => `
              <button class="stepbar-step" role="tab" data-schritt="${i}" aria-selected="false"
                      title="${esc(s.titel)}">
                <span class="stepbar-node">${i + 1}</span>
                <span class="stepbar-label">${esc(s.kurz)}</span>
                <span class="stepbar-flag" aria-hidden="true"></span>
              </button>`).join("")}
          </nav>
        </header>
        <div class="work-body" id="work-body" tabindex="-1">
          <div class="work-inner" id="workInner"></div>
        </div>
      </main>
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
    <nav class="rail" id="rail" aria-label="Seitenschiene" data-ansicht="faelle">
      <!-- Der Umschalter sitzt in der Schiene, nicht in der Fensterleiste.
           Dort oben klemmte er zwischen Marke und Patientennamen in
           vierundvierzig Pixel Höhe. Hier steht er über dem, was er
           schaltet, hat die volle Breite und trägt die Beschriftungen
           ohne Gedränge. -->
      <div class="rail-tabs" id="railTabs" role="tablist" aria-label="Ansicht der Seitenschiene">
        <button role="tab" data-ansicht="faelle" aria-selected="true">Patienten</button>
        <button role="tab" data-ansicht="fortschritt" aria-selected="false">Fortschritt</button>
        <button role="tab" data-ansicht="bausteine" aria-selected="false">Bausteine</button>
      </div>

      <div class="rail-body" id="railFaelle" role="tabpanel">
        <div class="case-search">
          ${icon.search}
          <input type="search" id="fallSuche" placeholder="Patient suchen …"
                 aria-label="Patienten durchsuchen">
        </div>

        <div class="rail-filters">
          <select id="fallSort" class="rail-select" aria-label="Patienten ordnen nach">
            ${(Object.keys(S.SORT_NAMEN) as S.SortSchluessel[]).map((k) => `
              <option value="${k}" ${S.state.sortierung === k ? "selected" : ""}>${esc(S.SORT_KURZ[k])}</option>`).join("")}
          </select>
          <select id="fallFilter" class="rail-select" aria-label="Patienten filtern">
            ${(Object.keys(S.FILTER_NAMEN) as S.FilterSchluessel[]).map((k) => `
              <option value="${k}" ${S.state.filter === k ? "selected" : ""}>${esc(S.FILTER_NAMEN[k])}</option>`).join("")}
          </select>
        </div>

        <div class="rail-zaehler"><span id="fallZaehler"></span></div>

        <ul class="case-list" id="fallListe" role="list"></ul>
      </div>
      
      <!-- Die weiteren Ansichten derselben Schiene. „Fortschritt"
           ersetzt die Spalte, die bis 2.1 rechts stand. -->
      <div class="rail-body rail-scroll" id="railFortschritt" role="tabpanel" hidden></div>
      <div class="rail-body rail-scroll" id="railBausteine" role="tabpanel" hidden></div>

      <!-- Der Knopf zum Einklappen sass in der Fensterleiste ganz oben
           — weit weg von der Spalte, die er einklappt, und in einer
           Zeile, die sonst nur Marke, Name und Fensterknöpfe trägt.
           Hier steht er am Fuss der Schiene selbst. -->
      <div class="rail-foot">
        <button class="btn btn-primary" id="btnNeuerFall"
                title="Neuen Patienten anlegen (Strg+N)">${icon.plus} Neuer Patient</button>

        <button class="btn btn-quiet btn-icon" id="btnRailToggle"
                title="Seitenschiene einklappen" aria-label="Seitenschiene einklappen"
                aria-expanded="true">${icon.panelL}</button>
      </div>

      <div class="rail-collapsed" id="railCollapsed">
        <button class="rail-tab" id="btnRailExpand" title="Seitenschiene anzeigen">
          <span class="rail-tab-label">Fälle</span>
        </button>
      </div>
    </nav>`;
}

function bindeRail(): void {
  on(el("btnNeuerFall"), "click", () => { void neuerFall(); });
  window.addEventListener("bausteine-geandert", () => { void zeichneBausteine(); });

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

  for (const b of qsa<HTMLButtonElement>(".stepbar-step")) {
    on(b, "click", () => geheZu(parseInt(b.dataset.schritt!, 10)));
  }

  on(el("fallSort"), "change", () => {
    S.setzeSortierung(el<HTMLSelectElement>("fallSort").value as S.SortSchluessel, S.state.sortAuf);
    zeichneFallListe();
  });
  on(el("fallFilter"), "change", () => {
    S.setzeFilter(el<HTMLSelectElement>("fallFilter").value as S.FilterSchluessel);
    zeichneFallListe();
  });


  zeichneFallListe();
}

function bindeTopbar(): void {
  const knopf = el("btnMehr");
  const menu = el("mehrMenu");

  const schliesse = (): void => {
    menu.hidden = true;
    knopf.setAttribute("aria-expanded", "false");
  };

  on(knopf, "click", (e) => {
    e.stopPropagation();
    const auf = menu.hidden;
    menu.hidden = !auf;
    knopf.setAttribute("aria-expanded", String(auf));
  });
  // Ein Klick irgendwo sonst schliesst. Der Klick im Menü selbst nicht,
  // sonst schlösse es sich, bevor der Menüpunkt reagieren kann.
  on(menu, "click", (e) => { e.stopPropagation(); });
  on(document, "click", schliesse);
  on(document, "keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape") schliesse();
  });

  const punkt = (id: string, tue: () => void): void => {
    const b = document.getElementById(id);
    if (b) on(b, "click", () => { schliesse(); tue(); });
  };

  punkt("mnuEinstellungen", () => { void zeigeEinstellungen(neuZeichnen); });
  punkt("mnuSicherung",     () => { void zeigeSicherung(neuZeichnen); });
  punkt("mnuPapierkorb",    () => { void zeigePapierkorb(neuZeichnen); });
  punkt("mnuZuordnen",      () => {
    void zeigeZuordnung().then(async (n) => {
      if (n) await S.refreshCases();
      await pruefeZuordnung();
      zeichneFallListe();
    });
  });

  void pruefeZuordnung();

  // Der Einklapp-Knopf sitzt jetzt am Fuss der Schiene. Angemeldet
  // wird er weiterhin hier, weil das Gerüst zu diesem Zeitpunkt
  // vollständig steht — die Schiene eingeschlossen.
  on(el("btnRailToggle"), "click", toggleRail);

  bindeFensterknoepfe();

  for (const b of qsa<HTMLButtonElement>("#railTabs [data-ansicht]")) {
    on(b, "click", () => zeigeAnsicht(b.dataset.ansicht as Ansicht));
  }
  zeigeAnsicht(ansicht);
}

// ---------------------------------------------------------------
// Was in der Seitenschiene steht
// ---------------------------------------------------------------

type Ansicht = "faelle" | "fortschritt" | "bausteine";

const ANSICHT_KEY = "rana-rail-ansicht";
let ansicht: Ansicht = (() => {
  try {
    const g = globalThis.localStorage?.getItem(ANSICHT_KEY);
    return g === "fortschritt" || g === "bausteine" ? g : "faelle";
  } catch { return "faelle"; }
})();

/**
 * Schaltet die Schiene um.
 *
 * Der Knopf „Neue Patientin" unten bleibt nur bei der Fallliste
 * stehen — unter einer Bausteinliste hiesse er nichts.
 */
function zeigeAnsicht(neu: Ansicht): void {
  ansicht = neu;
  try { globalThis.localStorage?.setItem(ANSICHT_KEY, neu); } catch { /* egal */ }

  el("rail").dataset.ansicht = neu;
  for (const b of qsa<HTMLButtonElement>("#railTabs [data-ansicht]")) {
    b.setAttribute("aria-selected", String(b.dataset.ansicht === neu));
  }
  el("railFaelle").hidden = neu !== "faelle";
  el("railFortschritt").hidden = neu !== "fortschritt";
  el("railBausteine").hidden = neu !== "bausteine";
  (el("btnNeuerFall") as HTMLElement).hidden = neu !== "faelle";

  if (neu === "fortschritt") zeichneFortschritt();
  if (neu === "bausteine") void zeichneBausteine();
}

/**
 * Die drei Fensterknöpfe rechts.
 *
 * Seit das Fenster ohne Systemrahmen läuft, gibt es keinen anderen Weg
 * mehr, es zu minimieren oder zu schliessen — deshalb ist ein Fehler
 * hier kein Schönheitsfehler. Schlägt das Laden der Fenster-Schnitt-
 * stelle fehl, werden die Knöpfe ausgeblendet statt untätig
 * stehenzubleiben.
 */
function bindeFensterknoepfe(): void {
  void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
    const fenster = getCurrentWindow();

    on(el("winMin"), "click", () => { void fenster.minimize(); });
    on(el("winClose"), "click", () => { void fenster.close(); });

    const knopfMax = el("winMax");
    const zeichneMax = async (): Promise<void> => {
      const voll = await fenster.isMaximized();
      knopfMax.innerHTML = voll ? icon.winRest : icon.winMax;
      knopfMax.title = voll ? "Wiederherstellen" : "Maximieren";
      knopfMax.setAttribute("aria-label", knopfMax.title);
    };
    on(knopfMax, "click", () => { void fenster.toggleMaximize().then(zeichneMax); });
    await zeichneMax();

    // Ein Doppelklick auf die Leiste maximiert — wie bei jedem Fenster.
    on(el("topbar"), "dblclick", (e) => {
      if ((e.target as HTMLElement).closest("button, input, select, .menu")) return;
      void fenster.toggleMaximize().then(zeichneMax);
    });
  }).catch(() => {
    document.getElementById("winMin")?.parentElement?.remove();
  });
}

/**
 * Blendet den Menüpunkt für die Zuordnung ein, solange Berichte ohne
 * Patientin dastehen — und blendet ihn wieder aus, wenn alle zugeordnet
 * sind. So steht im Menü nie eine Zeile, die nichts zu tun hätte.
 */
async function pruefeZuordnung(): Promise<void> {
  const punkt = document.getElementById("mnuZuordnen");
  const text = document.getElementById("mnuZuordnenText");
  const trenner = document.querySelector<HTMLElement>("#mehrMenu .menu-sep");
  if (!punkt || !text) return;

  const n = await offeneZuordnungen();
  punkt.hidden = n === 0;
  if (trenner) trenner.hidden = n === 0;
  text.textContent = n === 1 ? "1 Bericht zuordnen" : `${n} Berichte zuordnen`;
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

function zeichneFallListe(): void {
  const box = el("fallListe");
  const gruppen = S.sichtbareGruppen();
  const cases = gruppen.flatMap((g) => g.berichte);

  // Die Zeile sagt, was die Liste zeigt — in Worten, nicht als nackte
  // Zahl. Bei aktiver Suche oder gesetztem Filter steht dabei, wovon.
  const zaehler = document.getElementById("fallZaehler");
  if (zaehler) {
    const p = gruppen.filter((g) => g.patient).length;
    const a = cases.length;
    const eingeschraenkt = !!S.state.query.trim() || S.state.filter !== "alle";
    const teil = `${p} ${p === 1 ? "Patient" : "Patienten"} · ${a} ${a === 1 ? "Antrag" : "Anträge"}`;
    zaehler.textContent = a === 0
      ? (eingeschraenkt ? "nichts gefunden" : "")
      : eingeschraenkt
        ? `${teil} von ${S.state.patients.length}`
        : teil;
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

  // Zwei Ebenen ohne Zierrat. Die Zahl hinter dem Namen ist entfallen:
  // sie stand da, ohne etwas zu beantworten — bei elf Patientinnen mit
  // je einer „1" war sie nur Rauschen. Wie viele Anträge es sind, sagt
  // jetzt die Übersicht im Arbeitsbereich, und wer aufklappt, sieht sie
  // ohnehin einzeln. Nur ab zwei Anträgen steht noch ein Hinweis da.
  box.innerHTML = gruppen.map((g) => {
    const pid = g.patient?.id ?? "__ohne__";
    const auf = suche || S.state.offen.has(pid) || g.berichte.some((c) => c.id === S.state.activeId);
    const mehrere = g.berichte.length > 1;

    const kopf = `
      <div class="pat-zeile ${S.state.patientAnsicht === pid ? "is-gewaehlt" : ""}">
        <button class="pat-item" data-pat="${esc(pid)}"
                aria-expanded="${auf}"
                ${g.patient ? "" : 'data-lose="ja"'}>
          <span class="pat-caret ${mehrere ? "" : "ist-leer"}" aria-hidden="true">${icon.caret}</span>
          <span class="pat-name">${esc(g.label)}</span>
        </button>
        ${g.patient
          ? `<button class="pat-weg" data-patweg="${esc(g.patient.id)}"
                     data-patname="${esc(g.label)}"
                     title="${esc(g.label)} in den Papierkorb legen"
                     aria-label="${esc(g.label)} in den Papierkorb legen"
                     >${icon.close}</button>`
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
        <button class="case-weg" data-fallweg="${esc(c.id)}"
                data-fallname="${esc(c.antrag_nr ? `${c.antrag_nr}. Fortführungsantrag` : "Antrag ohne Nummer")}"
                title="Diesen Antrag in den Papierkorb legen"
                aria-label="Diesen Antrag in den Papierkorb legen">${icon.close}</button>
      </li>`).join("") : "";

    return `<li class="pat-gruppe">${kopf}<ul class="case-sub" role="list">${kinder}</ul></li>`;
  }).join("");

  // Ein Zuhörer am Behälter statt einer je Eintrag. Bei fünfzig
  // Patientinnen sind das fünfzig Anmeldungen weniger — und sie
  // überleben das Neuzeichnen der Liste.
  if (!box.dataset.gebunden) {
    box.dataset.gebunden = "ja";

    on(box, "click", (e) => {
      // Erst die Kreuze prüfen: sie liegen innerhalb der Zeile, und
      // ohne diese Reihenfolge würde stattdessen der Fall gewechselt
      // oder die Patientin auf- und zugeklappt.
      const pw = (e.target as HTMLElement).closest<HTMLElement>("[data-patweg]");
      if (pw) {
        e.stopPropagation();
        void patientinInPapierkorb(pw.dataset.patweg!, pw.dataset.patname ?? "");
        return;
      }
      const fw = (e.target as HTMLElement).closest<HTMLElement>("[data-fallweg]");
      if (fw) {
        e.stopPropagation();
        const id = fw.dataset.fallweg!;
        void fallInPapierkorb(id, fw.dataset.fallname ?? "").then((weg) => {
          if (weg && id === S.state.activeId) void naechstenFallOeffnen();
          else if (weg) void S.refreshCases().then(zeichneFallListe);
        });
        return;
      }

      const p = (e.target as HTMLElement).closest<HTMLElement>("[data-pat]");
      if (p) {
        // Ein Klick auf die Patientin zeigt ihre Übersicht — dort
        // stehen ihre Anträge mit Datum, und dort legt man den nächsten
        // an. Wer auf das Dreieck klickt, will nur auf- und zuklappen.
        const pid = p.dataset.pat!;
        const aufsDreieck = !!(e.target as HTMLElement).closest(".pat-caret");
        if (aufsDreieck) {
          S.klappe(pid);
          zeichneFallListe();
        } else {
          void zeigePatient(pid);
        }
        return;
      }
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-fall]");
      if (b) void oeffneFall(b.dataset.fall!);
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

/**
 * Legt eine Patientin samt allen ihren Anträgen in den Papierkorb.
 *
 * Bewusst mit Zahl in der Rückfrage: „Frau Pauer löschen" klingt nach
 * einem Eintrag, es sind aber womöglich vier Berichte. Endgültig
 * entfernt wird nichts — dafür gibt es den Papierkorb, und der hält
 * dreissig Tage.
 */
async function patientinInPapierkorb(patientId: string, name: string): Promise<void> {
  const berichte = S.state.cases.filter((c) => c.patient_id === patientId);
  const n = berichte.length;

  const ja = await confirmDialog(
    "In den Papierkorb legen",
    n === 1
      ? `„${name}" wird mit ihrem einen Antrag in den Papierkorb gelegt. `
        + `Dort bleibt sie dreissig Tage und lässt sich jederzeit zurückholen.`
      : `„${name}" wird mit allen ${n} Anträgen in den Papierkorb gelegt. `
        + `Dort bleiben sie dreissig Tage und lassen sich jederzeit zurückholen.`,
    "In den Papierkorb",
    true,
  );
  if (!ja) return;

  try {
    for (const c of berichte) await api.trashCase(c.id);
    // Die Patientin selbst verschwindet mit ihrem letzten sichtbaren
    // Bericht aus der Liste; ihr Datensatz bleibt, damit die Berichte
    // beim Wiederherstellen ihre Stammdaten wiederfinden.
    toast(
      n === 1 ? "In den Papierkorb gelegt." : `${n} Anträge in den Papierkorb gelegt.`,
      "ok", 3200,
    );
  } catch (e) {
    toast(api.errorText(e), "danger");
    return;
  }

  if (berichte.some((c) => c.id === S.state.activeId)) await naechstenFallOeffnen();
  else { await S.refreshCases(); zeichneFallListe(); }
}



async function neuerFall(): Promise<void> {
  // Wenn kein aktiver Patient ausgewählt ist, legen wir zuerst einen an
  // oder wenn explizit der Button "Neuer Patient" geklickt wird.
  await zeigePatientStammdaten(null, async (patient) => {
    // Nach dem Speichern des neuen Patienten:
    // Leeren Fall anlegen und zuordnen.
    const caseId = await S.neuerFall();
    await api.assignReport(caseId, patient.id);
    await S.refreshCases();
    S.state.offen.clear();
    zeichneFallListe();
    toast("Neue Patientin angelegt.", "ok", 2500);
    await oeffneFall(caseId);
  });
}

/**
 * Öffnet einen Antrag.
 *
 * Ein Klick auf den bereits offenen Antrag tut nichts mehr. Vorher
 * schloss er ihn — man landete auf „Kein Fall ausgewählt", ohne das
 * gewollt zu haben, und musste ihn wieder heraussuchen.
 */
async function oeffneFall(id: string): Promise<void> {
  S.state.patientAnsicht = null;
  if (id === S.state.activeId) { zeichneFallListe(); zeichneSchritt(); return; }
  await S.ladeFall(id);
  // Alle anderen zugeklappt lassen:
  S.state.offen.clear();
  zeichneFallListe();
  zeichneSchritt();
}

/**
 * Zeigt die Übersicht einer Patientin im Arbeitsbereich.
 */
async function zeigePatient(patientId: string): Promise<void> {
  if (patientId === "__ohne__") {
    // Für die zuordnungslosen Berichte gibt es keine Patientin, die man
    // zeigen könnte — dort hilft nur das Aufklappen.
    S.klappe(patientId);
    zeichneFallListe();
    return;
  }

  await S.speichereJetzt();

  if (S.state.patientAnsicht === patientId) {
    S.state.patientAnsicht = null;
    S.state.activeId = "";
    S.state.offen.clear();
    zeichneFallListe();
    el("workEyebrow").textContent = "";
    el("workTitel").textContent = "";
    el("workInner").innerHTML = `
      <div class="empty-state">
        <p class="hint">Bitte wählen Sie links eine Patientin oder einen Antrag aus.</p>
      </div>`;
    const stepbar = document.querySelector(".stepbar") as HTMLElement | null;
    if (stepbar) stepbar.style.display = "none";
    return;
  }

  S.state.patientAnsicht = patientId;
  S.state.activeId = "";
  S.state.offen.clear();
  S.state.offen.add(patientId);
  zeichneFallListe();
  await zeichnePatientAnsicht();
}

async function zeichnePatientAnsicht(): Promise<void> {
  const pid = S.state.patientAnsicht;
  if (!pid) return;

  const stepbar = document.querySelector(".stepbar") as HTMLElement | null;
  if (stepbar) stepbar.style.display = "none";

  try {
    const daten = await ladePatient(pid);
    el("workEyebrow").textContent = "Patient";
    el("workTitel").textContent = daten.patient.fields.f_name?.trim() || "Ohne Namen";
    el("workInner").className = "work-inner";
    el("workInner").innerHTML = renderPatient(daten);

    bindePatient(daten, {
      oeffnen: (caseId) => { void oeffneFall(caseId); },
      folgeantrag: (patId) => {
        void S.folgeAntragFuerPatientin(patId).then((id) => {
          if (!id) return;
          S.state.patientAnsicht = null;
          neuZeichnen();
          toast("Nächster Fortführungsantrag angelegt.", "ok", 2500);
        }).catch((err) => toast(api.errorText(err), "danger"));
      },
      neuZeichnen: () => {
        if (S.state.patientAnsicht) void zeichnePatientAnsicht();
        else neuZeichnen();
        zeichneFallListe();
      },
    });
  } catch (e) {
    toast(api.errorText(e), "danger");
    S.state.patientAnsicht = null;
    zeichneSchritt();
  }
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
  // Steht die Übersicht einer Patientin im Arbeitsbereich, hat sie
  // Vorrang. Sonst überschriebe jede Zustandsänderung sie mit dem
  // gerade offenen Schritt.
  if (S.state.patientAnsicht) { void zeichnePatientAnsicht(); return; }

  const stepbar = document.querySelector(".stepbar") as HTMLElement | null;

  if (!S.state.activeId) {
    el("workEyebrow").textContent = "";
    el("workTitel").textContent = "Willkommen bei Rana";
    el("workInner").className = "work-inner";
    el("workInner").innerHTML = `
      <div style="text-align:center; padding: 120px 20px; color: var(--peat);">
        <svg width="48" height="48" viewBox="0 0 24 24" style="margin-bottom: var(--s5); color: var(--reed);">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
        <h3>Kein Fall ausgewählt</h3>
        <p style="margin-bottom: var(--s5); color: var(--reed);">Wählen Sie einen Patienten aus der Liste<br>oder legen Sie einen neuen Fall an.</p>
        <button class="btn btn-primary" id="btnEmptyNeuerFall">Neuen Fall anlegen</button>
      </div>
    `;
    if (stepbar) stepbar.style.display = "none";
    
    // Bind button
    const btn = document.getElementById("btnEmptyNeuerFall");
    if (btn) btn.addEventListener("click", () => { void neuerFall(); });
    
    return;
  }

  if (stepbar) stepbar.style.display = "";

  const n = S.state.step;

  // Die Augenbraue trägt den Zusammenhang: an wessen Antrag hier
  // gearbeitet wird, und an welchem. Der Name stand bis 2.3 in der
  // Fensterleiste — dort steht er weit weg von der Arbeit und
  // konkurriert mit dem Fenstertitel.
  const nr = S.state.fields.f_nr?.trim();
  const wer = S.state.fields.f_name?.trim();
  el("workEyebrow").textContent = [
    wer || null,
    nr ? `${nr}. Fortführungsantrag` : null,
  ].filter(Boolean).join(" · ");
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
  zeichneFortschritt();
  aktualisiereSpeicherstand();
}

function aktualisiereSchrittleiste(): void {
  const schritte = qsa<HTMLElement>(".stepbar-step");
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

/**
 * Die offenen Pflichtangaben, nach Schritt gruppiert.
 *
 * Vorher stand vor jeder Zeile die Nummer ihres Schritts — bei sieben
 * Lücken also „1 1 1 3 3 3 3". Das liest sich wie eine kaputte
 * Aufzählung. Die Nummer steht jetzt einmal über der Gruppe, und
 * damit sagt sie auch etwas: wo die Lücken sitzen.
 */
function gapListe(offen: S.Luecke[]): string {
  const nachSchritt = new Map<number, S.Luecke[]>();
  for (const l of offen) {
    const liste = nachSchritt.get(l.schritt) ?? [];
    liste.push(l);
    nachSchritt.set(l.schritt, liste);
  }

  return [...nachSchritt.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([schritt, liste]) => `
      <div class="gap-gruppe">
        <div class="gap-kopf">
          <span class="gap-num">${schritt + 1}</span>
          <span class="gap-schritt">${esc(SCHRITTE[schritt]?.titel ?? "")}</span>
        </div>
        <ul class="gap-list">
          ${liste.map((l) => `
            <li><button class="gap-item" data-luecke="${esc(l.feld)}" data-schritt="${l.schritt}">
              ${esc(l.label)}
            </button></li>`).join("")}
        </ul>
      </div>`).join("");
}

function zeichneFortschritt(): void {
  const box = document.getElementById("railFortschritt");
  if (!box || box.hidden) return;

  const pct = S.vollstaendigkeit();
  const offen = S.luecken();
  const dieser = S.state.cases.find((c) => c.id === S.state.activeId);

  box.innerHTML = `
    <section class="ctx-block">
      <span class="record">Vollständigkeit</span>
      <div class="completeness">
        <div class="comp-value">${pct}<small> %</small></div>
        <div class="comp-bar">
          <div class="comp-fill ${pct === 100 ? "is-full" : ""}" style="--comp:${pct}%"></div>
        </div>
      </div>
      ${offen.length ? gapListe(offen) : `<p class="hint">Alle Pflichtangaben liegen vor.</p>`}
    </section>

    <section class="ctx-block">
      <span class="record">Dieser Fall</span>
      <p class="hint">
        ${S.state.fields.f_chiffre ? `Chiffre ${esc(S.state.fields.f_chiffre)}<br>` : ""}
        Zuletzt geändert ${esc(relDate(dieser?.updated_at ?? 0))}
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

}

// ---------------------------------------------------------------
// Textbausteine in der Seitenschiene
// ---------------------------------------------------------------

/**
 * Wohin ein Baustein eingefügt wird.
 *
 * Ein Klick in die Seitenschiene nimmt dem Textfeld den Fokus. Deshalb
 * wird gemerkt, wo die Schreibmarke zuletzt stand — sonst wüsste die
 * Liste nach dem Klick nicht mehr, wohin sie schreiben soll.
 */
let letztesFeld: HTMLTextAreaElement | HTMLInputElement | null = null;

document.addEventListener("focusin", (e) => {
  const z = e.target as HTMLElement;
  if (!z.closest("#workInner")) return;
  if (z instanceof HTMLTextAreaElement || z instanceof HTMLInputElement) letztesFeld = z;
});

/**
 * Alle eigenen Formulierungen an einer Stelle, nach Feld gruppiert.
 *
 * Bisher lagen sie hinter je einem Knopf im jeweiligen Feld — man fand
 * sie nur, wenn man schon wusste, wo sie liegen. Ein Klick hier fügt an
 * der Schreibmarke ein; das Verwalten bleibt beim Feld.
 */
async function zeichneBausteine(): Promise<void> {
  const box = document.getElementById("railBausteine");
  if (!box) return;

  let alle: [string, string, string][];
  try {
    alle = await api.listAllSnippets();
  } catch (e) {
    box.innerHTML = `<p class="hint" style="padding:var(--s3)">${esc(api.errorText(e))}</p>`;
    return;
  }

  if (!alle.length) {
    box.innerHTML = `
      <div class="rail-leer">
        <p class="hint">
          Noch keine Bausteine. Formulierungen, die immer wiederkehren,
          legen Sie über „Bausteine" am jeweiligen Feld ab — hier stehen
          sie dann alle beisammen.
        </p>
      </div>`;
    return;
  }

  const nachFeld = new Map<string, [string, string][]>();
  for (const [id, feld, text] of alle) {
    const liste = nachFeld.get(feld) ?? [];
    liste.push([id, text]);
    nachFeld.set(feld, liste);
  }

  box.innerHTML = [...nachFeld.entries()].map(([feld, liste]) => `
    <section class="ctx-block">
      <span class="record">${esc(S.FELD_NAMEN[feld] ?? feld)}</span>
      <div class="baustein-liste" style="display:flex; flex-direction:column; gap:6px;">
        ${liste.map(([id, text]) => `
          <div class="baustein-row" style="display:flex; gap:6px; align-items:flex-start;">
            <button class="baustein" style="flex:1; text-align:left;" data-baustein="${esc(id)}" title="An der Schreibmarke einfügen">
              ${esc(text.length > 160 ? text.slice(0, 160) + " …" : text)}
            </button>
            <button class="btn btn-quiet btn-icon" data-baustein-weg="${esc(id)}" title="Baustein löschen" aria-label="Löschen" style="flex:none; opacity:0.6;">
              ${icon.close}
            </button>
          </div>`).join("")}
      </div>
    </section>`).join("");

  const texte = new Map(alle.map(([id, , text]) => [id, text]));
  for (const b of qsa<HTMLButtonElement>("[data-baustein]", box)) {
    on(b, "click", () => fuegeBausteinEin(texte.get(b.dataset.baustein!) ?? ""));
  }
  for (const b of qsa<HTMLButtonElement>("[data-baustein-weg]", box)) {
    on(b, "click", async () => {
      await api.deleteSnippet(b.dataset.bausteinWeg!);
      void zeichneBausteine();
    });
  }
}

function fuegeBausteinEin(text: string): void {
  const feld = letztesFeld;
  if (!feld || !feld.isConnected) {
    toast("Bitte zuerst in das Feld klicken, in das der Baustein soll.", "info");
    return;
  }

  const a = feld.selectionStart ?? feld.value.length;
  const b = feld.selectionEnd ?? a;
  const davor = feld.value.slice(0, a);
  const danach = feld.value.slice(b);

  // Ein Leerzeichen dazwischen, wo keines ist — sonst klebt der
  // Baustein am vorigen Wort.
  const luecke = davor && !/\s$/.test(davor) ? " " : "";
  feld.value = davor + luecke + text + danach;

  const marke = (davor + luecke + text).length;
  feld.setSelectionRange(marke, marke);
  feld.focus();

  const name = feld.dataset.feld ?? feld.id;
  if (name) S.setzeFeld(name, feld.value);
  feld.dispatchEvent(new Event("input", { bubbles: true }));
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
      <h1 style="font-size:var(--t-xl);margin-bottom: var(--s3)">Rana konnte nicht starten</h1>
      <div class="notice notice-danger">${esc(api.errorText(e))}</div>
      <p class="hint" style="margin-top: var(--s4)">
        Läuft Rana bereits in einem anderen Fenster? Dann bitte dieses schliessen.
        Andernfalls hilft ein Neustart des Rechners; die Falldaten bleiben unberührt.
      </p>
    </div>`;
});
