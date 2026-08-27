const svg = (d) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const icon = {
  plus:   svg('<path d="M10 4v12M4 10h12"/>'),
  search: svg('<circle cx="9" cy="9" r="5.2"/><path d="M13 13l4 4"/>'),
  trash:  svg('<path d="M4 6h12M8.5 6V4.5h3V6M6 6l.8 9.5h6.4L14 6"/>'),
  gear:   svg('<circle cx="10" cy="10" r="2.6"/><path d="M10 3v1.6M10 15.4V17M17 10h-1.6M4.6 10H3"/>'),
  save:   svg('<path d="M4 4h9l3 3v9H4z"/><path d="M7 4v4h5V4M7 16v-4h6v4"/>'),
  check:  svg('<path d="M4.5 10.5l3.5 3.5 7.5-8"/>'),
  caret:  svg('<path d="M8 5.5l4.5 4.5L8 14.5"/>'),
  close:  svg('<path d="M6 6l8 8M14 6l-8 8"/>'),
  merge:  svg('<path d="M5 4v4a4 4 0 0 0 4 4h6"/><path d="M5 16v-2"/><path d="M12.5 9.5L15 12l-2.5 2.5"/>'),
  dots:   svg('<circle cx="10" cy="5" r="1.3" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="10" cy="15" r="1.3" fill="currentColor" stroke="none"/>'),
  panelL: svg('<path d="M3 4h5v12H3zM10 4h7M10 8h7M10 12h5"/>'),
  panelR: svg('<path d="M12 4h5v12h-5zM3 4h7M3 8h7M3 12h5"/>'),
  gross:  svg('<path d="M8 4H4v4M12 4h4v4M8 16H4v-4M12 16h4v-4"/>'),
  winMin:   svg('<path d="M5 10h10"/>'),
  winMax:   svg('<rect x="5.5" y="5.5" width="9" height="9" rx="1"/>'),
  winClose: svg('<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>'),
};

const patientinnen = [
  ["Alexandra Inhoff", 1], ["Bettina Gudd", 1], ["Britta Uhden", 2],
  ["Gisela Fronek", 1], ["Kirsten Warning", 1], ["Pape, Tanja", 2],
  ["Pauer, Katrin", 3], ["Sabine Neemann", 1], ["Scherf, Ines", 1],
  ["Simone Müller-Mühlenhardt", 1], ["Vißer, Claudia", 3],
];

const SORT_KURZ = ["Zuletzt", "Name", "Angelegt", "Antrag"];
const FILTER = ["Alle", "Ohne Bericht", "Mit Bericht"];

const fallListe = patientinnen.map(([name, n]) => {
  const auf = name === "Vißer, Claudia";
  const kinder = auf ? [3, 2, 1].map((nr) => `
    <li>
      <button class="case-item" aria-current="${nr === 3}">
        <span class="case-item-text">
          <span class="case-item-name">${nr}. Fortführungsantrag</span>
          <span class="case-item-meta">V36-025825A09.10.1962</span>
        </span>
        ${nr === 1 ? `<span class="case-item-fertig">${icon.check}</span>` : ""}
      </button>
      <button class="case-weg" title="In den Papierkorb">${icon.close}</button>
    </li>`).join("") : "";
  return `
    <li class="pat-gruppe">
      <div class="pat-zeile">
        <button class="pat-item" aria-expanded="${auf}">
          <span class="pat-caret">${icon.caret}</span>
          <span class="pat-name">${name}</span>
          <span class="pat-zahl">${n}</span>
        </button>
        <button class="pat-plus" title="Folgeantrag">${icon.plus}</button>
        <button class="pat-weg" title="In den Papierkorb">${icon.close}</button>
      </div>
      <ul class="case-sub" role="list">${kinder}</ul>
    </li>`;
}).join("");

const SCHRITTE = ["Stammdaten", "Vorbericht", "Verlauf", "Formulieren", "Ausgabe"];
const luecken = [
  ["Davon verbraucht", 1], ["Jetzt beantragt", 1], ["Frequenz", 1],
  ["Ausgangslage bei Therapiebeginn", 3], ["Behandlungsverlauf", 3],
  ["Psychischer Befund", 3], ["Prognose", 3],
];

document.getElementById("app").innerHTML = `
<header class="topbar">
  <div class="topbar-left">
    <button class="topbar-rail-toggle" aria-expanded="true">${icon.panelL}</button>
    <span class="brand-name">Rana</span>
    <span class="brand-version">arvalis</span>
    <span class="brand-ver-num">2.2.0</span>
    <div class="segtabs" role="tablist">
      <button role="tab" aria-selected="true">Patienten</button>
      <button role="tab" aria-selected="false">Fortschritt</button>
      <button role="tab" aria-selected="false">Textbausteine</button>
    </div>
  </div>
  <div class="topbar-center"><span class="topbar-patient">Vißer, Claudia</span></div>
  <div class="topbar-right">
    <span class="save-indicator"><span class="save-dot"></span><span class="save-text">Gespeichert</span></span>
    <div class="menuwrap">
      <button class="btn btn-sm btn-quiet btn-icon">${icon.dots}</button>
      <div class="menu" role="menu" hidden>
        <button class="menu-item">${icon.gear}<span>Einstellungen</span></button>
        <button class="menu-item">${icon.save}<span>Sicherung</span></button>
        <button class="menu-item">${icon.trash}<span>Papierkorb</span></button>
        <div class="menu-sep"></div>
        <button class="menu-item">${icon.merge}<span>3 Berichte zuordnen</span></button>
      </div>
    </div>
    <button class="topbar-ctx-toggle" aria-expanded="true">${icon.panelR}</button>
    <div class="win-ctrls">
      <button class="win-ctrl">${icon.winMin}</button>
      <button class="win-ctrl">${icon.winMax}</button>
      <button class="win-ctrl win-close">${icon.winClose}</button>
    </div>
  </div>
</header>

<div class="shell">
  <nav class="rail">
    <div class="rail-body">
      <div class="rail-head">
        <span class="record">Fälle</span>
        <span class="record-num small muted">13</span>
      </div>
      <div class="case-search">
        ${icon.search}
        <input type="search" placeholder="Suchen …">
      </div>
      <div class="rail-filters">
        <select class="rail-select">${SORT_KURZ.map((v) => `<option>${v}</option>`).join("")}</select>
        <select class="rail-select">${FILTER.map((v) => `<option>${v}</option>`).join("")}</select>
      </div>
      <ul class="case-list">${fallListe}</ul>
    </div>
    <div class="rail-foot">
      <button class="btn btn-sm btn-primary">${icon.plus} Neue Patientin</button>
    </div>
  </nav>

  <main class="work">
    <header class="work-head">
      <nav class="stepbar" role="tablist">
        ${SCHRITTE.map((s, i) => `
          <button class="stepbar-step ${i === 0 ? "is-current" : ""} ${i === 2 ? "has-gap" : ""}"
                  role="tab" aria-selected="${i === 0}">
            <span class="stepbar-node">${i + 1}</span>
            <span class="stepbar-label">${s}</span>
            <span class="stepbar-flag"></span>
          </button>`).join("")}
      </nav>
      <div class="work-head-titel">
        <div class="work-title">
          <span class="work-eyebrow">Schritt 1 von 5</span>
          <h2>Fall-Stammdaten</h2>
        </div>
      </div>
    </header>
    <div class="work-body">
      <div class="work-inner">
        <section class="group">
          <div class="group-head"><span class="group-title">Textfeld mit Vergrösserungsknopf</span></div>
          <div class="field">
            <label for="v_verlauf" style="align-items:center">
              Behandlungsverlauf
              <span class="spacer"></span>
              <button class="btn btn-sm btn-quiet btn-icon" title="Feld gross öffnen">${icon.gross}</button>
              <button class="btn btn-sm btn-quiet" type="button">Bausteine</button>
            </label>
            <textarea id="v_verlauf" placeholder="Verlauf …"></textarea>
            <div class="field-fuss">
              <span class="field-balken" data-stand="kurz"><i></i></span>
              <span class="field-zaehler ist-kurz">0 Zeichen · Ziel 600–1400</span>
            </div>
          </div>
        </section>

        <section class="group">
          <div class="group-head"><span class="group-title">Praxis und Behandler:in — Feldbreiten wie im Einstellungsdialog</span></div>
          <div class="feldsatz">
            <div class="feldzeile">
              <div class="feld-schmal"><div class="field"><label>Titel</label><input value="Dr. med."></div></div>
              <div class="feld-weit"><div class="field"><label>Name</label><input value="Anja Roesick-Schulte"></div></div>
            </div>
            <div class="field"><label>Funktion</label><input value="Ärztliche Psychotherapeutin"></div>
            <div class="field"><label>Strasse und Hausnummer</label><input value="Musterstrasse 12"></div>
            <div class="feldzeile">
              <div class="feld-schmal"><div class="field"><label>PLZ</label><input value="26384"></div></div>
              <div class="feld-weit"><div class="field"><label>Ort</label><input value="Wilhelmshaven"></div></div>
            </div>
            <div class="feldzeile">
              <div class="feld-weit"><div class="field"><label>Telefon</label><input value="04421 000000"></div></div>
              <div class="feld-weit"><div class="field"><label>E-Mail</label><input value="praxis@example.de"></div></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </main>

  <template id="tplBereiche">
      <section class="ctx-block">
        <span class="record">Vollständigkeit</span>
        <div class="completeness">
          <div class="comp-value">21<small> %</small></div>
          <div class="comp-bar"><div class="comp-fill" style="--comp:21%"></div></div>
        </div>
        ${[[1, "Fall-Stammdaten"], [3, "Behandlungsverlauf"]].map(([nr, titel]) => `
          <div class="gap-gruppe">
            <div class="gap-kopf">
              <span class="gap-num">${nr}</span>
              <span class="gap-schritt">${titel}</span>
            </div>
            <ul class="gap-list">
              ${luecken.filter(([, n]) => n === nr).map(([t]) => `<li><button class="gap-item">${t}</button></li>`).join("")}
            </ul>
          </div>`).join("")}
      </section>
      <section class="ctx-block">
        <span class="record">Dieser Fall</span>
        <p class="hint">Chiffre V36-025825A09.10.1962<br>Zuletzt geändert gestern</p>
      </section>

  </template>

  <template id="tplBausteine">
      <section class="ctx-block">
        <span class="record">Behandlungsverlauf</span>
        <div class="baustein-liste">
          <button class="baustein">Die Behandlung wurde im vereinbarten Setting fortgeführt; die Sitzungen fanden regelmässig statt.</button>
          <button class="baustein">Im Berichtszeitraum kam es zu einer deutlichen Symptomreduktion.</button>
        </div>
      </section>
      <section class="ctx-block">
        <span class="record">Prognose</span>
        <div class="baustein-liste">
          <button class="baustein">Bei Fortführung der Behandlung ist eine weitere Stabilisierung zu erwarten.</button>
        </div>
      </section>
  </template>
</div>`;

// Die Bereiche in die Schiene hängen und die Reiter schalten lassen —
// so verhält sich die Vorschau wie das Programm.
const rail = document.querySelector(".rail");
const holen = (id) => document.getElementById(id).innerHTML;

const fort = document.createElement("div");
fort.className = "rail-body rail-scroll";
fort.id = "railFortschritt";
fort.hidden = true;
fort.innerHTML = holen("tplBereiche");

const baus = document.createElement("div");
baus.className = "rail-body rail-scroll";
baus.id = "railBausteine";
baus.hidden = true;
baus.innerHTML = holen("tplBausteine");

rail.querySelector(".rail-foot").before(fort, baus);

const panes = { Patienten: rail.querySelector(".rail-body"), Fortschritt: fort, Textbausteine: baus };
for (const b of document.querySelectorAll(".segtabs button")) {
  b.addEventListener("click", () => {
    for (const x of document.querySelectorAll(".segtabs button")) {
      x.setAttribute("aria-selected", String(x === b));
    }
    const wahl = b.textContent.trim();
    for (const [name, p] of Object.entries(panes)) p.hidden = name !== wahl;
    rail.querySelector(".rail-foot").hidden = wahl !== "Patienten";
  });
}
