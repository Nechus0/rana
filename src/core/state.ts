/**
 * Der Zustand der Anwendung.
 *
 * Ein einziges Objekt, ein einziger Weg, es zu ändern. Wer etwas
 * ändert, ruft `patch()`; wer davon erfahren will, meldet sich mit
 * `subscribe()` an. Das ist wenig Ordnung, aber genug für eine
 * Anwendung dieser Grösse, und es macht nachvollziehbar, wer wann was
 * verändert hat.
 *
 * Gespeichert wird verzögert: nach jeder Änderung läuft eine kurze
 * Uhr, und erst wenn sie abläuft, geht der Fall in die Datenbank.
 * So wird nicht bei jedem Tastendruck geschrieben, aber es geht auch
 * nichts verloren.
 */

import * as api from "./ipc";
import type {
  BudgetState, Case, CaseSummary, Felder, PatientSummary, Profile,
} from "./ipc";

export const FELDER = [
  // Stammdaten
  "f_name", "f_chiffre", "f_nr", "f_gebdatum", "f_geschlecht", "f_kasse",
  "f_bewilligt", "f_verbraucht", "f_beantragt", "f_frequenz", "f_sozio",
  // Vorbericht
  "f_vorbericht", "f_lastreport", "f_diag_alt", "f_psychodyn", "f_ziele_alt",
  // Verlauf
  "f_verlauf", "f_befund", "f_diag_neu", "f_begruendung", "f_prognose",
  // Nachgezogen fuer die Leitfadenkonformitaet (PTV 3, Muster 4.2017).
  // Bewusst HINTEN angehaengt: aeltere Faelle kennen diese Schluessel
  // nicht und werden von leererFall() einfach leer vorbelegt.
  "f_beginn", "f_ausgangslage", "f_zielstatus", "f_methoden", "f_abschluss",
] as const;

export type FeldName = (typeof FELDER)[number];

/** Was für einen vollständigen Bericht wirklich vorliegen muss. */
export const PFLICHT: { feld: FeldName; label: string; schritt: number }[] = [
  { feld: "f_chiffre",     label: "Chiffre",                 schritt: 0 },
  { feld: "f_gebdatum",    label: "Geburtsdatum",            schritt: 0 },
  { feld: "f_bewilligt",   label: "Bisher bewilligte Stunden", schritt: 0 },
  { feld: "f_verbraucht",  label: "Davon verbraucht",        schritt: 0 },
  { feld: "f_beantragt",   label: "Jetzt beantragt",         schritt: 0 },
  { feld: "f_frequenz",    label: "Frequenz",                schritt: 0 },
  { feld: "f_ausgangslage", label: "Ausgangslage bei Therapiebeginn", schritt: 2 },
  { feld: "f_verlauf",     label: "Behandlungsverlauf",      schritt: 2 },
  { feld: "f_zielstatus",  label: "Stand der zuletzt vereinbarten Therapieziele", schritt: 2 },
  { feld: "f_befund",      label: "Psychischer Befund",      schritt: 2 },
  { feld: "f_diag_neu",    label: "Aktuelle Diagnose(n)",    schritt: 2 },
  { feld: "f_begruendung", label: "Begründung der Fortführung", schritt: 2 },
  { feld: "f_prognose",    label: "Prognose",                schritt: 2 },
  { feld: "f_abschluss",   label: "Planung des Therapieabschlusses", schritt: 2 },
];

/**
 * Wonach die Fallliste geordnet wird.
 *
 * „zuletzt“ ist die Vorgabe, weil man beim Öffnen fast immer da
 * weitermacht, wo man aufgehört hat. Die übrigen sind zum Suchen:
 * nach Namen, wenn man jemanden bestimmten sucht; nach Anlage,
 * wenn man wissen will was neu ist; nach Antragsnummer, wenn man
 * sehen will, wer beim ersten und wer beim dritten Antrag steht.
 */
export type SortSchluessel = "zuletzt" | "name" | "angelegt" | "nummer";

export const SORT_NAMEN: Record<SortSchluessel, string> = {
  zuletzt:  "Zuletzt bearbeitet",
  name:     "Name",
  angelegt: "Angelegt",
  nummer:   "Antragsnummer",
};

const SORT_KEY = "rana-sortierung";

/**
 * Liest eine gemerkte Einstellung — abgesichert.
 *
 * `localStorage` gibt es nur im Fenster. Die Abnahmeprüfungen laden
 * dieses Modul aber in Node, und ein Zugriff beim Laden des Moduls
 * liess sie mit „localStorage is not defined“ scheitern. Ausserdem
 * wirft der Zugriff in manchen Browserlagen selbst dann, wenn es das
 * Objekt gibt. Beides fängt diese Hülle ab.
 */
function merkeLesen(schluessel: string, vorgabe: string): string {
  try {
    return globalThis.localStorage?.getItem(schluessel) ?? vorgabe;
  } catch {
    return vorgabe;
  }
}

function merkeSchreiben(schluessel: string, wert: string): void {
  try {
    globalThis.localStorage?.setItem(schluessel, wert);
  } catch {
    /* Eine nicht gemerkte Voreinstellung ist kein Grund zu scheitern. */
  }
}

export interface State {
  profile: Profile | null;
  cases: CaseSummary[];
  /** Die Personen. Jeder Bericht hängt an genau einer von ihnen. */
  patients: PatientSummary[];
  /** Zu welcher Patientin der offene Bericht gehört. */
  patientId: string | null;
  /** Welche Patientinnen in der Liste aufgeklappt sind. */
  offen: Set<string>;
  activeId: string | null;
  fields: Felder;
  report: string;
  step: number;
  budget: BudgetState | null;
  /** Wahr, solange Daten zur Schnittstelle unterwegs sind. */
  transmitting: boolean;
  /** Papierkorbansicht statt Fallliste. */
  showTrash: boolean;
  query: string;
  dirty: boolean;
  sortierung: SortSchluessel;
  /** true = aufsteigend (A–Z, ältestes zuerst, 1 zuerst). */
  sortAuf: boolean;
}

export const state: State = {
  profile: null,
  cases: [],
  patients: [],
  patientId: null,
  offen: new Set<string>(),
  activeId: null,
  fields: {},
  report: "",
  step: 0,
  budget: null,
  transmitting: false,
  showTrash: false,
  query: "",
  dirty: false,
  sortierung: merkeLesen(SORT_KEY, "zuletzt") as SortSchluessel,
  sortAuf: merkeLesen(SORT_KEY + "-auf", "0") === "1",
};

/**
 * Ordnet die Fallliste. Läuft in der Oberfläche und nicht in der
 * Datenbank: die Übersichten liegen ohnehin alle im Speicher, und so
 * lässt sich die Reihenfolge ohne neue Abfrage umstellen.
 */
export function sortiereFaelle(liste: CaseSummary[]): CaseSummary[] {
  const richtung = state.sortAuf ? 1 : -1;
  const zahl = (v: string) => {
    const n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  };

  const sortiert = [...liste].sort((a, b) => {
    switch (state.sortierung) {
      case "name":
        // Nach deutschem Alphabet, damit Ö nicht hinter Z landet.
        return a.label.localeCompare(b.label, "de", { sensitivity: "base" }) * richtung;
      case "angelegt":
        return (a.created_at - b.created_at) * richtung;
      case "nummer": {
        const d = zahl(a.antrag_nr) - zahl(b.antrag_nr);
        // Bei gleicher Nummer nach Namen, sonst springt die Liste.
        return d !== 0 ? d * richtung
                       : a.label.localeCompare(b.label, "de", { sensitivity: "base" });
      }
      default:
        return (a.updated_at - b.updated_at) * richtung;
    }
  });
  return sortiert;
}

export function setzeSortierung(s: SortSchluessel, auf: boolean): void {
  state.sortierung = s;
  state.sortAuf = auf;
  merkeSchreiben(SORT_KEY, s);
  merkeSchreiben(SORT_KEY + "-auf", auf ? "1" : "0");
  notify();
}

// ---------------------------------------------------------------
// Beobachter
// ---------------------------------------------------------------

type Listener = (s: State) => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) fn(state);
}

export function patch(p: Partial<State>): void {
  Object.assign(state, p);
  notify();
}

// ---------------------------------------------------------------
// Fälle
// ---------------------------------------------------------------

/**
 * Holt die Fallübersichten — immer vollständig, nie gefiltert.
 *
 * Vorher ging die Suche bei jedem Tastendruck nach Rust und liess
 * dort JEDEN Fall entschlüsseln. Zwei Fehler auf einmal: bei schnellem
 * Tippen kamen die Antworten in falscher Reihenfolge zurück und die
 * Liste zeigte Treffer zu einem älteren Suchwort, und bei fünfzig
 * Patientinnen waren es fünfzig Entschlüsselungen je Anschlag.
 *
 * Jetzt wird einmal geladen und im Fenster gefiltert. Das ist sofort,
 * kann nicht durcheinandergeraten und skaliert.
 */
export async function refreshCases(): Promise<void> {
  state.cases = await api.listCases("", state.showTrash);
  state.patients = await api.listPatients();
  notify();
}

// ---------------------------------------------------------------
// Zwei Ebenen: die Person, darunter ihre Berichte
// ---------------------------------------------------------------

export interface Gruppe {
  /** Fehlt bei den noch nicht zugeordneten Berichten. */
  patient: PatientSummary | null;
  label: string;
  berichte: CaseSummary[];
}

/**
 * Stellt die Liste her, wie sie in der Seitenschiene steht: je Person
 * eine Zeile, darunter ihre Berichte.
 *
 * Gefiltert wird über beide Ebenen zugleich. Wer „pau" tippt, sieht
 * die Patientin Pauer mit allen ihren Berichten; wer „3" tippt, sieht
 * jede Patientin, die einen dritten Antrag hat — aber nur diesen.
 * Deshalb wird erst je Bericht geprüft und die Person zusätzlich als
 * Ganzes: passt sie selbst, bleiben alle ihre Berichte stehen.
 */
export function sichtbareGruppen(): Gruppe[] {
  const q = state.query.trim().toLowerCase();
  const woerter = q ? q.split(/\s+/).filter(Boolean) : [];

  const passt = (heu: string): boolean =>
    woerter.every((w) => heu.toLowerCase().includes(w));

  const nachPatient = new Map<string, CaseSummary[]>();
  const ohne: CaseSummary[] = [];
  for (const c of state.cases) {
    if (c.patient_id) {
      const liste = nachPatient.get(c.patient_id) ?? [];
      liste.push(c);
      nachPatient.set(c.patient_id, liste);
    } else {
      ohne.push(c);
    }
  }

  const gruppen: Gruppe[] = [];

  for (const p of state.patients) {
    const alle = nachPatient.get(p.id) ?? [];
    const personPasst = !woerter.length || passt(`${p.label} ${p.chiffre}`);
    const berichte = personPasst
      ? alle
      : alle.filter((c) => passt(`${c.label} ${c.chiffre} ${c.antrag_nr}`));

    // Eine Patientin ohne sichtbaren Bericht verschwindet aus der
    // Liste — es sei denn, sie selbst ist der Treffer und hat noch
    // gar keinen Bericht.
    if (!berichte.length && !(personPasst && !alle.length)) continue;

    gruppen.push({ patient: p, label: p.label, berichte: sortiereFaelle(berichte) });
  }

  gruppen.sort((a, b) => vergleicheGruppen(a, b));

  const ohneGefiltert = woerter.length
    ? ohne.filter((c) => passt(`${c.label} ${c.chiffre} ${c.antrag_nr}`))
    : ohne;
  if (ohneGefiltert.length) {
    gruppen.push({
      patient: null,
      label: "Ohne Zuordnung",
      berichte: sortiereFaelle(ohneGefiltert),
    });
  }

  return gruppen;
}

/** Ordnet die Personenzeilen nach derselben Regel wie die Berichte. */
function vergleicheGruppen(a: Gruppe, b: Gruppe): number {
  const r = state.sortAuf ? 1 : -1;
  switch (state.sortierung) {
    case "name":
      return a.label.localeCompare(b.label, "de") * (state.sortAuf ? 1 : -1);
    case "angelegt":
      return ((a.patient?.created_at ?? 0) - (b.patient?.created_at ?? 0)) * r;
    case "nummer":
      return ((a.patient?.hoechste_nr ?? 0) - (b.patient?.hoechste_nr ?? 0)) * r;
    default:
      return ((a.patient?.updated_at ?? 0) - (b.patient?.updated_at ?? 0)) * r;
  }
}

/** Klappt eine Patientin auf oder zu. */
export function klappe(patientId: string): void {
  if (state.offen.has(patientId)) state.offen.delete(patientId);
  else state.offen.add(patientId);
}

/**
 * Was in der Liste stehen soll: gefiltert und geordnet.
 *
 * Gesucht wird in Name, Chiffre und Antragsnummer. Mehrere Wörter
 * müssen alle vorkommen, ihre Reihenfolge ist gleichgültig — so
 * findet „pau kat" auch „Pauer, Katrin".
 */
export function sichtbareFaelle(): CaseSummary[] {
  const q = state.query.trim().toLowerCase();
  let liste = state.cases;

  if (q) {
    const woerter = q.split(/\s+/).filter(Boolean);
    liste = liste.filter((c) => {
      const heu = `${c.label} ${c.chiffre} ${c.antrag_nr}`.toLowerCase();
      return woerter.every((w) => heu.includes(w));
    });
  }
  return sortiereFaelle(liste);
}

export function leererFall(profile: Profile | null): Felder {
  const f: Felder = {};
  for (const k of FELDER) f[k] = "";
  // Vorbelegungen aus dem Profil, die für jeden neuen Fall gleich sind.
  if (profile) f.f_nr = "1";
  return f;
}

export async function neuerFall(): Promise<string> {
  const id = crypto.randomUUID();
  const c: Case = {
    id,
    fields: leererFall(state.profile),
    report: "",
    patient_id: null,
    updated_at: 0,
    created_at: 0,
    deleted_at: null,
  };
  await api.saveCase(c);
  await refreshCases();
  await ladeFall(id);
  return id;
}

/**
 * Legt den nächsten Fortführungsantrag derselben Patientin an.
 *
 * Bisher hiess das: neuen Fall anlegen und Name, Chiffre,
 * Geburtsdatum, Kostenträger, Therapiebeginn, Ausgangslage und
 * Psychodynamik von Hand erneut eintragen — bei jedem Antrag. Genau
 * daher stammen die Doppeleinträge in der Fallliste.
 *
 * Was übernommen wird, folgt der Frage: ändert sich das zwischen zwei
 * Anträgen? Der Name nicht. Die Ausgangslage bei Therapiebeginn nicht.
 * Der Verlauf sehr wohl — der beginnt leer.
 *
 * Drei Dinge werden dabei mitgedacht, die sonst leicht untergehen:
 *   · die laufende Nummer zählt hoch,
 *   · das bisher bewilligte Kontingent wächst um das zuletzt
 *     beantragte — denn was beantragt war, ist inzwischen bewilligt,
 *   · der alte Bericht wandert in das Vorbericht-Feld und seine
 *     Diagnose in „bisherige Diagnose", damit der neue Bericht einen
 *     Bezugspunkt hat.
 */
export async function folgeAntrag(): Promise<string> {
  await speichereJetzt();
  return folgeAntragAus({ ...state.fields }, state.report, state.patientId);
}

/**
 * Derselbe Vorgang, aber für eine Patientin, deren letzter Bericht
 * gerade nicht offen ist.
 *
 * Damit lässt sich der nächste Antrag unmittelbar aus der Liste
 * anlegen — ohne den alten Bericht erst zu suchen, zu öffnen und
 * dann den Knopf zu drücken. Drei Schritte weniger, und der häufigste
 * Vorgang in Rana überhaupt.
 */
export async function folgeAntragFuerPatientin(patientId: string): Promise<string | null> {
  await speichereJetzt();
  const berichte = await api.reportsForPatient(patientId);
  if (!berichte.length) return null;

  // reports_for_patient liefert den jüngsten Antrag zuerst.
  const letzter = await api.getCase(berichte[0].id);
  return folgeAntragAus(letzter.fields, letzter.report, patientId);
}

async function folgeAntragAus(
  alt: Felder,
  altBericht: string,
  patientId: string | null,
): Promise<string> {
  const bleibt = [
    "f_name", "f_chiffre", "f_gebdatum", "f_geschlecht", "f_sozio",
    "f_kasse", "f_beginn", "f_therapiebeginn", "f_ausgangslage",
    "f_psychodyn", "f_frequenz",
  ];

  const neu = leererFall(state.profile);
  for (const k of bleibt) if (alt[k]) neu[k] = alt[k];

  // Laufende Nummer hochzählen.
  const nr = parseInt(alt.f_nr ?? "", 10);
  neu.f_nr = String(isNaN(nr) ? 2 : nr + 1);

  // Was beantragt war, ist jetzt bewilligt.
  const bewilligt = parseInt(alt.f_bewilligt ?? "", 10);
  const beantragt = parseInt(alt.f_beantragt ?? "", 10);
  if (!isNaN(bewilligt)) {
    neu.f_bewilligt = String(bewilligt + (isNaN(beantragt) ? 0 : beantragt));
  }

  // Der alte Bericht wird zum Vorbericht.
  if (altBericht.trim()) {
    neu.f_vorbericht = "ja";
    neu.f_lastreport = altBericht;
  }
  if (alt.f_diag_neu) neu.f_diag_alt = alt.f_diag_neu;

  const zieleAlt = zieleAusBericht(altBericht);
  if (zieleAlt) neu.f_ziele_alt = zieleAlt;

  const id = crypto.randomUUID();
  await api.saveCase({
    id, fields: neu, report: "",
    // Rust hängt den Bericht anhand des Namens ohnehin an dieselbe
    // Patientin; die Angabe hier spart den Umweg über den Namen.
    patient_id: patientId,
    updated_at: 0, created_at: 0, deleted_at: null,
  });
  await refreshCases();
  await ladeFall(id);
  return id;
}

/**
 * Zieht die nummerierten Behandlungsziele aus einem fertigen Bericht.
 *
 * Sie stehen dort als eigene Zeilen hinter einem Satz, der auf
 * „Behandlungsziele:" endet. Findet sich nichts, bleibt das Feld leer —
 * lieber nichts als etwas Falsches.
 */
function zieleAusBericht(text: string): string {
  if (!text) return "";
  const zeilen = text.split(/\n/);
  const start = zeilen.findIndex((z) => /behandlungsziele\s*:\s*$/i.test(z.trim()));
  if (start < 0) return "";

  const ziele: string[] = [];
  for (const z of zeilen.slice(start + 1)) {
    const t = z.trim();
    if (!t) break;
    const m = t.match(/^\d+[.)]\s+(.*)$/);
    if (!m) break;
    ziele.push(m[1]);
  }
  return ziele.join("\n");
}

export async function ladeFall(id: string): Promise<void> {
  // Ein noch nicht gespeicherter Stand darf beim Wechsel nicht verloren
  // gehen — deshalb zuerst sichern, dann wechseln.
  await speichereJetzt();
  const c = await api.getCase(id);
  // Die Patientin des offenen Berichts wird aufgeklappt, sonst sähe
  // man nach dem Wechsel nicht, wo man gelandet ist.
  if (c.patient_id) state.offen.add(c.patient_id);
  patch({
    activeId: c.id,
    patientId: c.patient_id,
    fields: { ...leererFall(state.profile), ...c.fields },
    report: c.report,
    step: 0,
    dirty: false,
  });
}

/** Ein einzelnes Feld ändern. Löst das verzögerte Speichern aus. */
export function setzeFeld(name: string, wert: string): void {
  if (state.fields[name] === wert) return;
  state.fields[name] = wert;
  state.dirty = true;
  planeSpeichern();
  notify();
}

export function setzeBericht(text: string): void {
  if (state.report === text) return;
  state.report = text;
  state.dirty = true;
  planeSpeichern();
  notify();
}

// ---------------------------------------------------------------
// Speichern
// ---------------------------------------------------------------

let saveTimer: number | undefined;
let saving = false;

function planeSpeichern(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void speichereJetzt(), 900);
}

export async function speichereJetzt(): Promise<void> {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = undefined; }
  if (!state.activeId || !state.dirty || saving) return;

  saving = true;
  try {
    const alt = await api.getCase(state.activeId);
    // Rust kann beim Speichern eine Patientin angelegt oder den
    // Bericht einer vorhandenen zugeordnet haben — etwa, sobald der
    // Name eingetragen wird. Das kommt hier zurück.
    const gespeichert = await api.saveCase({
      ...alt,
      fields: state.fields,
      report: state.report,
    });
    if (gespeichert.patient_id) {
      state.patientId = gespeichert.patient_id;
      state.offen.add(gespeichert.patient_id);
    }
    state.dirty = false;
    notify();
    // Die Beschriftung in der Fallliste kann sich geändert haben.
    void refreshCases();
  } finally {
    saving = false;
  }
}

/** Beim Schliessen des Fensters nichts verlieren. */
export function speichernBeimBeenden(): void {
  window.addEventListener("beforeunload", () => { void speichereJetzt(); });
  // Auch beim Wegklicken — Windows blendet Fenster aus, ohne zu schliessen.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void speichereJetzt();
  });
}

// ---------------------------------------------------------------
// Vollständigkeit
// ---------------------------------------------------------------

/**
 * Wie viel Text ein Feld ungefähr tragen sollte.
 *
 * Hergeleitet, nicht geraten: Der fertige Bericht hat einen gemessenen
 * Korridor von rund 4.950 Zeichen, verteilt auf 2.750 / 750 / 1.450 je
 * Abschnitt. Daraus ergibt sich, wie viel Rohmaterial ein Feld liefern
 * muss, damit Claude daraus den zugehörigen Absatz bauen kann.
 *
 * Bewusst mit Vorrat: der Zielwert liegt etwa ein Drittel ÜBER dem, was
 * am Ende im Bericht landet. Ein Modell kann kürzen und verdichten, aber
 * nichts erfinden — zu wenig Material lässt sich nicht ausgleichen, zu
 * viel schon. Deshalb ist der obere Rand grosszügig und erst deutlich
 * darüber wird gewarnt.
 *
 * Die Zahlen sind Anhaltspunkte, keine Grenzen. Rana hindert niemanden
 * am Weiterschreiben.
 */
export const ZIELUMFANG: Record<string, { von: number; bis: number; hinweis?: string }> = {
  // --- Gliederungspunkt 1 --------------------------------------
  // Die Ausgangslage wird zu einem Absatz von rund 450 Zeichen.
  f_ausgangslage: { von: 250, bis: 600 },
  // Der Verlauf trägt drei bis vier Absätze — das grösste Feld.
  f_verlauf:      { von: 600, bis: 1400 },
  // Die Zielbilanz wird ein Absatz, je Ziel ein bis zwei Sätze.
  f_zielstatus:   { von: 200, bis: 550 },

  // --- Gliederungspunkt 2 ---------------------------------------
  f_befund:       { von: 150, bis: 450 },
  f_diag_neu:     { von: 40,  bis: 250 },

  // --- Gliederungspunkt 3 ---------------------------------------
  f_begruendung:  { von: 250, bis: 700 },
  f_methoden:     { von: 0,   bis: 300, hinweis: "darf leer bleiben" },
  f_prognose:     { von: 150, bis: 450 },
  f_abschluss:    { von: 80,  bis: 350 },

  // --- Vorgeschichte, geht nur als Hintergrund in den Prompt -----
  f_diag_alt:     { von: 0, bis: 300, hinweis: "Hintergrund" },
  f_psychodyn:    { von: 0, bis: 500, hinweis: "Hintergrund" },
  f_ziele_alt:    { von: 0, bis: 400, hinweis: "Hintergrund" },

  // --- Stammdaten ------------------------------------------------
  f_sozio:        { von: 0, bis: 160, hinweis: "eine Zeile" },
};

/** "kurz" · "gut" · "reichlich" — oder null, wenn kein Ziel hinterlegt ist. */
export type Fuellstand = "leer" | "kurz" | "gut" | "reichlich" | null;

export function fuellstand(feld: string, laenge: number): Fuellstand {
  const z = ZIELUMFANG[feld];
  if (!z) return null;
  if (laenge === 0) return "leer";
  if (laenge < z.von) return "kurz";
  // Erst deutlich über dem oberen Rand wird es „reichlich" — ein
  // Überhang ist Arbeitsvorrat, kein Fehler.
  if (laenge > z.bis * 1.5) return "reichlich";
  return "gut";
}

export interface Luecke { feld: string; label: string; schritt: number }

export function luecken(): Luecke[] {
  return PFLICHT.filter((p) => !(state.fields[p.feld] ?? "").trim());
}

export function vollstaendigkeit(): number {
  const offen = luecken().length;
  return Math.round(((PFLICHT.length - offen) / PFLICHT.length) * 100);
}

export function lueckenImSchritt(schritt: number): boolean {
  return luecken().some((l) => l.schritt === schritt);
}

// ---------------------------------------------------------------
// Verbrauch
// ---------------------------------------------------------------

export async function refreshBudget(): Promise<void> {
  try {
    state.budget = await api.budgetState();
    notify();
  } catch {
    // Der Verbrauch ist Beiwerk. Lässt er sich nicht lesen, arbeitet
    // die Anwendung weiter — der Wächter in Rust greift ohnehin.
  }
}

// ---------------------------------------------------------------
// Plausibilität
// ---------------------------------------------------------------

/**
 * Prüfungen, die die Nutzerin vor einem peinlichen Fehler im Antrag
 * bewahren. Sie blockieren nichts, sie weisen hin.
 */
export function warnungen(): string[] {
  const w: string[] = [];
  const f = state.fields;
  const zahl = (k: string) => {
    const v = parseInt(f[k] ?? "", 10);
    return isNaN(v) ? null : v;
  };

  const bew = zahl("f_bewilligt");
  const ver = zahl("f_verbraucht");
  const bea = zahl("f_beantragt");

  if (bew !== null && ver !== null && ver > bew) {
    w.push(`Es sind ${ver} Stunden verbraucht, aber nur ${bew} bewilligt. Bitte prüfen.`);
  }
  if (bew !== null && ver !== null && bew - ver > 10) {
    w.push(`Es sind noch ${bew - ver} bewilligte Stunden offen. Ein Fortführungsantrag ist meist erst kurz vor Ausschöpfung sinnvoll.`);
  }
  if (bea !== null && bea > 100) {
    w.push(`${bea} beantragte Sitzungen sind ungewöhnlich viel. Bitte prüfen, ob die Zahl stimmt.`);
  }

  // Der Klarname darf nicht in die soziodemographische Zeile geraten —
  // sie steht im Bericht.
  const name = (f.f_name ?? "").trim();
  const sozio = (f.f_sozio ?? "").trim();
  if (name && sozio) {
    for (const teil of name.split(/\s+/)) {
      if (teil.length >= 3 && sozio.toLowerCase().includes(teil.toLowerCase())) {
        w.push(`Die Zeile „Soziodemographische Angaben“ enthält den Klarnamen „${teil}“. Sie steht im Bericht — bitte durch die Chiffre ersetzen.`);
        break;
      }
    }
  }
  return w;
}
