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
import type { BudgetState, Case, CaseSummary, Felder, Profile } from "./ipc";

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

export async function refreshCases(): Promise<void> {
  state.cases = await api.listCases(state.query, state.showTrash);
  notify();
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
    updated_at: 0,
    created_at: 0,
    deleted_at: null,
  };
  await api.saveCase(c);
  await refreshCases();
  await ladeFall(id);
  return id;
}

export async function ladeFall(id: string): Promise<void> {
  // Ein noch nicht gespeicherter Stand darf beim Wechsel nicht verloren
  // gehen — deshalb zuerst sichern, dann wechseln.
  await speichereJetzt();
  const c = await api.getCase(id);
  patch({
    activeId: c.id,
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
    await api.saveCase({
      ...alt,
      fields: state.fields,
      report: state.report,
    });
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
