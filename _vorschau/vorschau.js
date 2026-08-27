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
  gross:  svg('<path d="M8 4H4v4M12 4h4v4M8 16H4v-4M12 16h4v-4"/>'),
  winMin:   svg('<path d="M5 10h10"/>'),
  winMax:   svg('<rect x="5.5" y="5.5" width="9" height="9" rx="1"/>'),
  winClose: svg('<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>'),
};
const marke = `<svg class="marke" viewBox="0 0 24 24" aria-hidden="true">`
  + `<circle cx="12" cy="12" r="9" fill="none" stroke="#3a6faf" stroke-width="2"/>`
  + `<circle cx="12" cy="12" r="4.2" fill="#4e93e0"/></svg>`;

const patientinnen = [
  ["Alexandra Inhoff", 1], ["Bettina Gudd", 1], ["Britta Uhden", 2],
  ["Gisela Fronek", 1], ["Kirsten Warning", 1], ["Pape, Tanja", 2],
  ["Pauer, Katrin", 3], ["Sabine Neemann", 1], ["Scherf, Ines", 1],
  ["Simone Müller-Mühlenhardt", 1], ["Vißer, Claudia", 3],
];

const fallListe = patientinnen.map(([name, n]) => {
  const auf = name === "Vißer, Claudia";
  const kinder = auf ? [3, 2, 1].map((nr) => `
    <li>
      <button class="case-item" aria-current="${nr === 3}">
        <span class="case-item-text">
          <span class="case-item-name">${nr}. Fortführungsantrag</span>
          <span class="case-item-meta">vor 3 Tagen</span>
        </span>
        ${nr === 1 ? `<span class="case-item-fertig">${icon.check}</span>` : ""}
      </button>
      <button class="case-weg">${icon.close}</button>
    </li>`).join("") : "";
  return `
    <li class="pat-gruppe">
      <div class="pat-zeile ${auf ? "is-gewaehlt" : ""}">
        <button class="pat-item" aria-expanded="${auf}">
          <span class="pat-caret ${n > 1 ? "" : "ist-leer"}">${icon.caret}</span>
          <span class="pat-name">${name}</span>
          ${n > 1 ? `<span class="pat-zahl">${n} Anträge</span>` : ""}
        </button>
        <button class="pat-weg">${icon.close}</button>
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

const antraege = [
  [3, "vor 3 Tagen", "heute", false],
  [2, "vor 8 Monaten", "vor 8 Monaten", true],
  [1, "vor 2 Jahren", "vor 2 Jahren", true],
];

document.getElementById("app").innerHTML = `
<header class="topbar">
  <div class="topbar-left">
    <button class="topbar-rail-toggle" aria-expanded="true">${icon.panelL}</button>
    <span class="brand">
      ${marke}
      <span class="brand-name">Rana</span>
      <span class="brand-version">arvalis</span>
      <span class="brand-ver-num">2.3.0</span>
    </span>
  </div>
  <div class="topbar-center"><span class="topbar-patient">Vißer, Claudia</span></div>
  <div class="topbar-right">
    <span class="save-indicator"><span class="save-dot"></span><span class="save-text">Gespeichert</span></span>
    <div class="menuwrap"><button class="btn btn-sm btn-quiet btn-icon">${icon.dots}</button></div>
    <div class="win-ctrls">
      <button class="win-ctrl">${icon.winMin}</button>
      <button class="win-ctrl">${icon.winMax}</button>
      <button class="win-ctrl win-close">${icon.winClose}</button>
    </div>
  </div>
</header>

<div class="shell">
  <nav class="rail">
    <div class="rail-tabs" role="tablist">
      <button role="tab" aria-selected="true">Patienten</button>
      <button role="tab" aria-selected="false">Fortschritt</button>
      <button role="tab" aria-selected="false">Bausteine</button>
    </div>

    <div class="rail-body" id="railFaelle">
      <div class="case-search">
        ${icon.search}
        <input type="search" placeholder="Patient suchen …">
      </div>
      <div class="rail-filters">
        <select class="rail-select">${["Zuletzt","Name","Angelegt","Anträge"].map((v) => `<option>${v}</option>`).join("")}</select>
        <select class="rail-select">${["Alle","Offene","Erledigte"].map((v) => `<option>${v}</option>`).join("")}</select>
      </div>
      <div class="rail-zaehler"><span>11 Patienten · 15 Anträge</span></div>
      <ul class="case-list">${fallListe}</ul>
    </div>

    <div class="rail-foot">
      <button class="btn btn-sm btn-primary">${icon.plus} Neue Patientin</button>
    </div>
  </nav>

  <main class="work">
    <header class="work-head">
      <nav class="stepbar" role="tablist" style="display:none"></nav>
      <div class="work-head-titel">
        <div class="work-title">
          <span class="work-eyebrow">Patientin</span>
          <h2>Vißer, Claudia</h2>
        </div>
      </div>
    </header>
    <div class="work-body">
      <div class="work-inner">
        <section class="group">
          <div class="group-head"><span class="group-title">Vißer, Claudia</span></div>
          <dl class="stammblatt">
            <div class="stamm-feld"><dt>Chiffre</dt><dd>V36-025825A09.10.1962</dd></div>
            <div class="stamm-feld"><dt>Geburtsdatum</dt><dd>09.10.1962</dd></div>
            <div class="stamm-feld"><dt>Kostenträger</dt><dd>Beihilfe</dd></div>
            <div class="stamm-feld"><dt>Therapiebeginn</dt><dd>14.03.2023</dd></div>
            <div class="stamm-feld"><dt>Angelegt</dt><dd>vor 2 Jahren</dd></div>
          </dl>
        </section>

        <section class="group">
          <div class="group-head">
            <span class="group-title">Anträge</span>
            <span class="spacer"></span>
            <button class="btn btn-sm btn-primary">${icon.plus} Nächster Fortführungsantrag</button>
          </div>
          <table class="antragstabelle">
            <thead><tr><th>Antrag</th><th>Angelegt</th><th>Zuletzt geändert</th><th>Bericht</th><th></th></tr></thead>
            <tbody>
              ${antraege.map(([nr, a, g, fertig]) => `
                <tr ${nr === 3 ? 'class="ist-offen"' : ""}>
                  <td class="nr">${nr}.</td>
                  <td>${a}</td>
                  <td>${g}</td>
                  <td>${fertig ? `<span class="ist-fertig">${icon.check} formuliert</span>` : `<span class="ist-offen-text">offen</span>`}</td>
                  <td class="handgriffe">
                    <button class="btn btn-sm">Öffnen</button>
                    <button class="btn btn-sm btn-quiet btn-icon">${icon.trash}</button>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
          <p class="hint" style="margin-top:var(--s3)">
            Der nächste Antrag übernimmt die Stammdaten, zählt die laufende
            Nummer hoch und rechnet das zuletzt beantragte Kontingent zum
            bewilligten hinzu.
          </p>
        </section>

        <section class="group">
          <div class="group-head"><span class="group-title">Diese Patientin</span></div>
          <p class="hint" style="margin-bottom:var(--s3)">
            Alles landet im Papierkorb und bleibt dort dreissig Tage.
          </p>
          <button class="btn btn-danger">${icon.trash} Patientin in den Papierkorb</button>
        </section>
      </div>
    </div>
  </main>

  <template id="tplFortschritt">
      <section class="ctx-block">
        <span class="record">Vollständigkeit</span>
        <div class="completeness">
          <div class="comp-value">21<small> %</small></div>
          <div class="comp-bar"><div class="comp-fill" style="--comp:21%"></div></div>
        </div>
        ${[[1, "Fall-Stammdaten"], [3, "Behandlungsverlauf"]].map(([nr, titel]) => `
          <div class="gap-gruppe">
            <div class="gap-kopf"><span class="gap-num">${nr}</span><span class="gap-schritt">${titel}</span></div>
            <ul class="gap-list">
              ${luecken.filter(([, n]) => n === nr).map(([t]) => `<li><button class="gap-item">${t}</button></li>`).join("")}
            </ul>
          </div>`).join("")}
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
  </template>
</div>`;

// Die Bereiche einhängen und die Reiter schalten lassen.
const rail = document.querySelector(".rail");
const mach = (id, tpl) => {
  const d = document.createElement("div");
  d.className = "rail-body rail-scroll";
  d.id = id;
  d.hidden = true;
  d.innerHTML = document.getElementById(tpl).innerHTML;
  return d;
};
const fort = mach("railFortschritt", "tplFortschritt");
const baus = mach("railBausteine", "tplBausteine");
rail.querySelector(".rail-foot").before(fort, baus);

const panes = { Patienten: document.getElementById("railFaelle"), Fortschritt: fort, Bausteine: baus };
for (const b of document.querySelectorAll(".rail-tabs button")) {
  b.addEventListener("click", () => {
    for (const x of document.querySelectorAll(".rail-tabs button")) {
      x.setAttribute("aria-selected", String(x === b));
    }
    const wahl = b.textContent.trim();
    for (const [name, p] of Object.entries(panes)) p.hidden = name !== wahl;
    rail.querySelector(".rail-foot").hidden = wahl !== "Patienten";
  });
}
