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
import { bindeSchritt, fallInPapierkorb, renderSchritt, SCHRITTE, schritte } from "./views/steps";

import {
  EIGENE_VERSION, zeigeEinstellungen,
} from "./views/settings";
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

  // Die Prüfung läuft NACH dem Aufbau der Ansicht und stört sie nicht:
  // sie fragt bei GitHub nach und meldet sich nur, wenn es etwas gibt.
  // Bis 2.6.1 fand sie ausschliesslich auf Knopfdruck in den
  // Einstellungen statt — wer nicht dorthin ging, erfuhr nie von einer
  // neuen Fassung.
  void pruefeUpdate();
}

/**
 * Sieht beim Start nach, ob eine neuere Fassung vorliegt.
 *
 * Kein Dialog, der sich vor die Arbeit schiebt: eine Meldung unten,
 * die von selbst verschwindet, und ein Weg in die Einstellungen, wo
 * die Installation steht. Fehlt das Netz, passiert schlicht nichts —
 * eine Fehlermeldung über einen Dienst, nach dem niemand gefragt hat,
 * wäre eine Zumutung.
 */
async function pruefeUpdate(): Promise<void> {
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    // Dieselbe Zielangabe wie in den Einstellungen: der NSIS-Installer
    // läuft im Benutzerprofil und kommt ohne Rückfrage der
    // Benutzerkontensteuerung aus.
    const gefunden = await check({ target: "windows-x86_64-nsis" });
    if (!gefunden) return;

    toast(
      `Fassung ${gefunden.version} liegt vor — installiert ist ${EIGENE_VERSION}. `
      + "Unter Einstellungen → Aktualisierung lässt sie sich einspielen.",
      "info", 14000,
    );
  } catch {
    // Kein Netz, keine Meldung.
  }
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
        <!-- Zwei Zeilen, nicht eine.
             Titel und Schrittleiste standen nebeneinander auf einer
             Grundlinie: die grosse Serifenschrift links, die fünf Kreise
             rechts daneben. Das ist seit 2.7.0 anders. -->
        <!-- Zwei Zeilen mit je einer Aufgabe.

             Zeile 1 — die Dokumentzeile — beantwortet, woran gerade
             gearbeitet wird: links der Weg zurück zur Liste, dann
             Patientin und Antrag, rechts der Speicherstand und das
             Menü. Das Menü sass bis 2.6.1 in derselben Zeile wie der
             grosse Serifentitel, ganz aussen rechts neben dem Wort
             „Gespeichert"; ein Knopf ohne Nachbarn am Rand einer sonst
             leeren Zeile sieht verrutscht aus, weil er es ist.

             Zeile 2 ist die Schrittleiste über die volle Breite. Der
             Titel des Schritts steht nicht mehr hier, sondern als
             Überschrift im Inhalt — dort, wo er hingehört, und wo er
             beim Blättern mitwandert statt Platz festzuhalten. -->
        <header class="work-head">
          <div class="doczeile">
            <button class="btn btn-quiet btn-sm doczeile-zurueck" id="btnZurListe"
                    title="Zur Patientenliste (Strg+L)">
              ${icon.panelL} <span>Patienten</span>
            </button>
            <span class="doczeile-trenner" aria-hidden="true"></span>
            <span class="doczeile-wer" id="workEyebrow"></span>
            <span class="spacer"></span>
            <span class="save-indicator" id="saveIndicator">
              <span class="save-dot"></span>
              <span class="save-text">Gespeichert</span>
            </span>
            <button class="btn btn-quiet btn-icon" id="btnSettings"
                    title="Menü und Einstellungen" aria-label="Menü und Einstellungen"
                    aria-haspopup="menu">${icon.dots}</button>
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
          <div class="work-inner">
            <h2 class="work-title" id="workTitel"></h2>
            <div id="workInner"></div>
          </div>

          <!-- Vor und zurück, mit dem NAMEN des Ziels. Die Schrittleiste
               oben sagt, wo man ist; hier steht, wohin es weitergeht.
               Beides zugleich am oberen Rand unterzubringen hiesse, den
               Weg dort zu suchen, wo man gerade nicht liest. -->
          <nav class="schrittnav" aria-label="Schritt wechseln">
            <button class="btn schrittnav-zurueck" id="btnSchrittZurueck">
              ${icon.caretL} <span class="schrittnav-wort">Zurück</span>
              <span class="schrittnav-ziel" id="zielZurueck"></span>
            </button>
            <span class="spacer"></span>
            <button class="btn btn-primary schrittnav-weiter" id="btnSchrittWeiter">
              <span class="schrittnav-wort">Weiter</span>
              <span class="schrittnav-ziel" id="zielWeiter"></span> ${icon.caretR}
            </button>
          </nav>
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
      </div>

      <div class="rail-body" id="railFaelle" role="tabpanel">
        <div class="case-search">
          ${icon.search}
          <input type="search" id="fallSuche" placeholder="Patient suchen …"
                 aria-label="Patienten durchsuchen">
        </div>

        <!-- Der Filter als drei Schalter statt als Auswahlfeld: bei
             drei Möglichkeiten ist ein Aufklappmenü ein Klick zu viel,
             und man sieht nie, was sonst noch zur Wahl stünde. Die
             Ordnung bleibt ein Feld — sie wird selten geändert. -->
        <div class="rail-filters">
          <div class="rail-chips" role="group" aria-label="Patienten filtern">
            ${(Object.keys(S.FILTER_NAMEN) as S.FilterSchluessel[]).map((k) => `
              <button class="rail-chip" data-filter="${k}" type="button"
                      aria-pressed="${S.state.filter === k}">${esc(S.FILTER_NAMEN[k])}</button>`).join("")}
          </div>
        </div>

        <!-- Die Ordnung steht in der Zählerzeile, nicht neben den
             Schaltern: dort blieben für drei Beschriftungen und ein
             Auswahlfeld zusammen 220 Pixel, und „Zu schreiben" wurde
             zu „Zu s…". Hier hat jedes von beiden seine Breite. -->
        <div class="rail-zaehler">
          <span id="fallZaehler"></span>
          <span class="spacer"></span>
          <select id="fallSort" class="rail-sort" aria-label="Patienten ordnen nach">
            ${(Object.keys(S.SORT_NAMEN) as S.SortSchluessel[]).map((k) => `
              <option value="${k}" ${S.state.sortierung === k ? "selected" : ""}>${esc(S.SORT_KURZ[k])}</option>`).join("")}
          </select>
        </div>

        <ul class="case-list" id="fallListe" role="list"></ul>
      </div>
      
      <!-- Die weiteren Ansichten derselben Schiene. „Fortschritt"
           ersetzt die Spalte, die bis 2.1 rechts stand. -->
      <div class="rail-body rail-scroll" id="railFortschritt" role="tabpanel" hidden></div>

      <!-- Der Knopf zum Einklappen sass in der Fensterleiste ganz oben
           — weit weg von der Spalte, die er einklappt, und in einer
           Zeile, die sonst nur Marke, Name und Fensterknöpfe trägt.
           Hier steht er am Fuss der Schiene selbst. -->
      <!-- „Neuer Patient" gehört zur Patientenliste, nicht zum
           Fortschritt: unter einer Lückenliste beantwortet der Knopf
           keine Frage, die man dort stellt. Er wird deshalb mit der
           Ansicht ausgeblendet. Der Einklapp-Knopf bleibt immer da —
           er gilt der Schiene selbst. -->
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
  for (const chip of qsa<HTMLButtonElement>("[data-filter]")) {
    on(chip, "click", () => {
      S.setzeFilter(chip.dataset.filter as S.FilterSchluessel);
      for (const c of qsa<HTMLButtonElement>("[data-filter]")) {
        c.setAttribute("aria-pressed", String(c === chip));
      }
      zeichneFallListe();
    });
  }


  zeichneFallListe();
}

function bindeTopbar(): void {
  on(el("btnSettings"), "click", () => { void zeigeEinstellungen(neuZeichnen); });

  // Der Einklapp-Knopf sitzt jetzt am Fuss der Schiene. Angemeldet
  // wird er weiterhin hier, weil das Gerüst zu diesem Zeitpunkt
  // vollständig steht — die Schiene eingeschlossen.
  on(el("btnRailToggle"), "click", toggleRail);

  // Der Weg zurück zur Liste. Ist sie eingeklappt, holt er sie
  // hervor; ist sie da, führt er zur Übersicht der Patientin.
  on(el("btnZurListe"), "click", () => {
    const rail = el("rail");
    if (rail.classList.contains("collapsed")) { toggleRail(); return; }
    const pid = S.state.cases.find((c) => c.id === S.state.activeId)?.patient_id;
    if (pid) void zeigePatient(pid);
  });

  on(el("btnSchrittZurueck"), "click", () => geheZu(S.state.step - 1));
  on(el("btnSchrittWeiter"), "click", () => geheZu(S.state.step + 1));

  bindeFensterknoepfe();

  for (const b of qsa<HTMLButtonElement>("#railTabs [data-ansicht]")) {
    on(b, "click", () => zeigeAnsicht(b.dataset.ansicht as Ansicht));
  }
  zeigeAnsicht(ansicht);
}

// ---------------------------------------------------------------
// Was in der Seitenschiene steht
// ---------------------------------------------------------------

type Ansicht = "faelle" | "fortschritt";

const ANSICHT_KEY = "rana-rail-ansicht";
let ansicht: Ansicht = (() => {
  try {
    const g = globalThis.localStorage?.getItem(ANSICHT_KEY);
    return g === "fortschritt" ? g : "faelle";
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

  if (neu === "fortschritt") zeichneFortschritt();
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
      case "name": return c.chiffre || "";
      default:     return relDate(c.updated_at);
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

    const kopf = `
      <div class="pat-zeile ${S.state.patientAnsicht === pid ? "is-gewaehlt" : ""}">
        <button class="pat-item" data-pat="${esc(pid)}"
                aria-expanded="${auf}"
                ${g.patient ? "" : 'data-lose="ja"'}>
          <span class="pat-caret" aria-hidden="true">${icon.caret}</span>
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
    const whr = document.querySelector(".work-head-row") as HTMLElement | null;
    if (whr) whr.style.display = "none";
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
  const whr = document.querySelector(".work-head-row") as HTMLElement | null;
  if (whr) whr.style.display = "flex";

  try {
    const daten = await ladePatient(pid);
    const geschlecht = (daten.patient.fields.f_geschlecht || "").trim().toLowerCase();
    el("workEyebrow").textContent = geschlecht === "weiblich" ? "PATIENTIN" : "PATIENT";
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

  const kopf = document.querySelector(".work-head") as HTMLElement | null;
  const nav = document.querySelector(".schrittnav") as HTMLElement | null;

  if (!S.state.activeId) {
    el("workEyebrow").textContent = "";
    el("workTitel").textContent = "";
    el("workInner").innerHTML = `
      <div class="leerstelle">
        <h3>Kein Antrag geöffnet</h3>
        <p>Wählen Sie links eine Patientin aus oder legen Sie eine neue an.</p>
        <button class="btn btn-primary" id="btnEmptyNeuerFall">${icon.plus} Neuer Patient</button>
      </div>`;
    if (kopf) kopf.classList.add("leer");
    if (nav) nav.hidden = true;

    const btn = document.getElementById("btnEmptyNeuerFall");
    if (btn) btn.addEventListener("click", () => { void neuerFall(); });
    return;
  }

  if (kopf) kopf.classList.remove("leer");
  if (nav) nav.hidden = false;

  const n = S.state.step;
  const SS = schritte();

  // Die Dokumentzeile trägt den Zusammenhang: an wessen Antrag hier
  // gearbeitet wird, und an welchem. Beim Umwandlungsantrag ohne
  // laufende Nummer — es gibt nur einen.
  const nr = S.state.fields.f_nr?.trim();
  const wer = S.state.fields.f_name?.trim();
  const umw = S.antragsart() === "umwandlung";
  el("workEyebrow").textContent = [
    wer || null,
    umw ? "Umwandlungsantrag" : nr ? `${nr}. Fortführungsantrag` : null,
  ].filter(Boolean).join(" · ");
  el("workTitel").textContent = SS[n].titel;

  // Die Schrittleiste trägt beim Umwandlungsantrag andere Namen.
  qsa<HTMLElement>(".stepbar-step").forEach((b, i) => {
    const s = SS[i];
    if (!s) return;
    const lab = b.querySelector(".stepbar-label");
    if (lab) lab.textContent = s.kurz;
    b.title = s.titel;
  });

  // Schritt 4 und 5 brauchen mehr Platz: dort liegt das Blatt.
  const inner = el("workInner").parentElement;
  if (inner) inner.className = "work-inner" + (n >= 3 ? " wide" : "");
  el("workInner").innerHTML = renderSchritt(n);
  bindeSchritt(n, neuZeichnen);

  aktualisiereSchrittnav(n, SS);
  aktualisiereRand();
}

/**
 * Beschriftet „Zurück" und „Weiter" mit dem Namen des Ziels.
 *
 * „Weiter" allein sagt nur, dass es weitergeht. „Weiter · Verlauf"
 * sagt, wohin — und das ist der Unterschied zwischen einer Schaltung
 * und einer Wegweisung. Am Anfang und am Ende fällt der jeweilige
 * Knopf weg statt untätig dazustehen.
 */
function aktualisiereSchrittnav(n: number, SS: { titel: string; kurz: string }[]): void {
  const zur = document.getElementById("btnSchrittZurueck") as HTMLButtonElement | null;
  const wei = document.getElementById("btnSchrittWeiter") as HTMLButtonElement | null;
  if (!zur || !wei) return;

  zur.hidden = n <= 0;
  wei.hidden = n >= SS.length - 1;

  const zz = document.getElementById("zielZurueck");
  const zw = document.getElementById("zielWeiter");
  if (zz) zz.textContent = n > 0 ? SS[n - 1].kurz : "";
  if (zw) zw.textContent = n < SS.length - 1 ? SS[n + 1].kurz : "";
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
          <span class="gap-schritt">${esc(schritte()[schritt]?.titel ?? "")}</span>
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

  // Der Block „Dieser Fall" ist mit 2.7.0 entfallen. Er zeigte die
  // Chiffre und das Änderungsdatum — die Chiffre steht in Schritt 1
  // und im Bericht, das Datum in der Patientenübersicht. Hier stand
  // beides ohne Bezug zur Überschrift „Fortschritt" und beantwortete
  // keine Frage, die man an dieser Stelle stellt.
  box.innerHTML = `
    <section class="ctx-block">
      <div class="fort-kopf">
        <span class="record">Vollständigkeit</span>
        <span class="fort-pct ${pct === 100 ? "is-full" : ""}">${pct} %</span>
      </div>
      <div class="comp-bar">
        <div class="comp-fill ${pct === 100 ? "is-full" : ""}" style="--comp:${pct}%"></div>
      </div>
      ${offen.length
        ? `<p class="fort-lead">${offen.length} ${offen.length === 1 ? "Angabe fehlt" : "Angaben fehlen"}. Ein Klick führt hin.</p>${gapListe(offen)}`
        : `<p class="fort-lead is-voll">Alle Pflichtangaben liegen vor.</p>`}
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
