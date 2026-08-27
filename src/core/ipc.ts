/**
 * Die Brücke zum Rust-Teil.
 *
 * Jeder Aufruf ist hier einmal beschrieben, damit die Oberfläche
 * nirgends mit rohen Zeichenketten hantiert und ein Tippfehler beim
 * Übersetzen auffällt und nicht erst im Betrieb.
 *
 * Fehler aus Rust kommen als { kind, message } an. `message` ist
 * bereits ein fertiger deutscher Satz und wird unverändert angezeigt.
 */

import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface RanaError {
  kind: string;
  message: string;
}

export function isRanaError(e: unknown): e is RanaError {
  return typeof e === "object" && e !== null && "kind" in e && "message" in e;
}

/** Holt aus einem unbekannten Fehler den Satz, der angezeigt werden soll. */
export function errorText(e: unknown): string {
  if (isRanaError(e)) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return tauriInvoke<T>(cmd, args);
}

// ---------------------------------------------------------------
// Typen
// ---------------------------------------------------------------

export type Felder = Record<string, string>;

export interface Case {
  id: string;
  fields: Felder;
  report: string;
  /** An welcher Patientin der Bericht hängt. Rust setzt das beim Speichern. */
  patient_id: string | null;
  updated_at: number;
  created_at: number;
  deleted_at: number | null;
}

export interface Patient {
  id: string;
  fields: Felder;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface PatientSummary {
  id: string;
  label: string;
  chiffre: string;
  created_at: number;
  updated_at: number;
  report_count: number;
  /** Höchste vergebene laufende Nummer; die nächste ist eins mehr. */
  hoechste_nr: number;
}

/** Ein Vorschlag, welche Altberichte zur selben Person gehören. */
export interface MergeGruppe {
  name: string;
  schreibweisen: string[];
  report_ids: string[];
  anzahl: number;
}

export interface CaseSummary {
  id: string;
  label: string;
  chiffre: string;
  antrag_nr: string;
  patient_id: string | null;
  updated_at: number;
  created_at: number;
  deleted_at: number | null;
  has_report: boolean;
  purge_in_days: number | null;
}

export interface Praxis {
  name: string; strasse: string; plz: string; ort: string;
  telefon: string; email: string; brief_ort: string;
}
export interface Behandler { name: string; titel: string; funktion: string; }
export interface Verfahren {
  art: "tp" | "vt" | "at" | "st";
  setting: "einzel" | "gruppe" | "kombination";
  zielgruppe: "erwachsene" | "kj";
  qualifikation: "aerztlich" | "psychologisch" | "kjp";
}
export interface Layout {
  berichtsart: "fortfuehrung" | "erstantrag";
  untertitel: string;
  ziel_min: number; ziel_soll: number; ziel_max: number;
  akzent: string; schrift_text: string; schrift_kopf: string;
}
export interface Api { model: string; console_limit_bestaetigt: boolean; }
export interface BudgetSettings { monthly_eur: number; daily_reports: number; }

export interface Profile {
  praxis: Praxis;
  behandler: Behandler;
  verfahren: Verfahren;
  layout: Layout;
  api: Api;
  budget: BudgetSettings;
  eingerichtet: boolean;
}

export interface BudgetState {
  month_spent_eur: number;
  month_limit_eur: number;
  month_pct: number;
  today_reports: number;
  daily_limit: number;
  level: "ok" | "hinweis" | "warnung" | "gestoppt";
  may_send: boolean;
  estimate_eur: number;
}

export interface GenerateResult {
  text: string;
  input_tokens: number;
  cached_tokens: number;
  output_tokens: number;
  cost_eur: number;
  stop_reason: string;
}

// ---------------------------------------------------------------
// Einrichtung
// ---------------------------------------------------------------

export const getProfile   = () => call<Profile>("get_profile");
export const saveProfile  = (profile: Profile) => call<void>("save_profile", { profile });
export const isConfigured = () => call<boolean>("is_configured");

// ---------------------------------------------------------------
// Schlüssel
// ---------------------------------------------------------------

export const setApiKey    = (key: string) => call<void>("set_api_key", { key });
export const clearApiKey  = () => call<void>("clear_api_key");
export const apiKeyStatus = () =>
  call<{ vorhanden: boolean; maskiert: string | null }>("api_key_status");
/** Prüft einen Schlüssel. Ohne Argument den bereits hinterlegten. */
export const testApiKey   = (key?: string) => call<void>("test_api_key", { key: key ?? null });

// ---------------------------------------------------------------
// Fälle
// ---------------------------------------------------------------

export const listCases   = (query = "", trashed = false) =>
  call<CaseSummary[]>("list_cases", { query, trashed });
export const getCase     = (id: string) => call<Case>("get_case", { id });
export const saveCase    = (c: Case) => call<Case>("save_case", { case: c });
export const trashCase   = (id: string) => call<void>("trash_case", { id });
export const restoreCase = (id: string) => call<void>("restore_case", { id });
export const purgeCase   = (id: string) => call<void>("purge_case", { id });

// ---------------------------------------------------------------
// Patientinnen
// ---------------------------------------------------------------

export const listPatients        = () => call<PatientSummary[]>("list_patients");
export const getPatient          = (id: string) => call<Patient>("get_patient", { id });
export const savePatient         = (patient: Patient) => call<Patient>("save_patient", { patient });
export const reportsForPatient   = (patientId: string) =>
  call<CaseSummary[]>("reports_for_patient", { patientId });
export const reportsWithoutPatient = () => call<CaseSummary[]>("reports_without_patient");
export const assignReport        = (caseId: string, patientId: string) =>
  call<void>("assign_report", { caseId, patientId });
/** Entfernt die Patientin, nicht ihre Berichte. */
export const removePatient       = (id: string) => call<void>("remove_patient", { id });

/** Schlägt vor, welche Altberichte zusammengehören. Ändert nichts. */
export const mergeProposal = () => call<MergeGruppe[]>("merge_proposal");
/** Führt aus, was die Nutzerin bestätigt hat. */
export const mergeApply    = (groups: MergeGruppe[]) => call<number>("merge_apply", { groups });
/** Wie viele Berichte noch ohne Patientin dastehen. */
export const mergePending  = () => call<number>("merge_pending");

// ---------------------------------------------------------------
// Textbausteine
// ---------------------------------------------------------------

export const addSnippet    = (field: string, text: string) =>
  call<string>("add_snippet", { field, text });
export const listSnippets  = (field: string) =>
  call<[string, string][]>("list_snippets", { field });
/** Alle Bausteine: [Kennung, Feld, Text]. */
export const listAllSnippets = () =>
  call<[string, string, string][]>("list_all_snippets");
export const deleteSnippet = (id: string) => call<void>("delete_snippet", { id });

// ---------------------------------------------------------------
// Formulieren
// ---------------------------------------------------------------

export interface GenerateRequest {
  model: string;
  system: string;
  user: string;
  forbidden_names: string[];
  kind: "report" | "expand";
}

export const generateReport = (request: GenerateRequest) =>
  call<GenerateResult>("generate_report", { request });

/** Prüft einen Text auf Klarnamen, ohne etwas zu senden. */
export const checkClearNames = (text: string, names: string[]) =>
  call<string | null>("check_clear_names", { text, names });

/** Textstücke, während Claude schreibt. */
export const onStream = (fn: (chunk: string) => void) =>
  listen<string>("rana://stream", (e) => fn(e.payload));

/** Wahr, solange Daten übertragen werden. Steuert die Blaufärbung. */
export const onTransmit = (fn: (active: boolean) => void) =>
  listen<boolean>("rana://transmit", (e) => fn(e.payload));

// ---------------------------------------------------------------
// Verbrauch
// ---------------------------------------------------------------

export const budgetState  = () => call<BudgetState>("budget_state");
export const monthlyUsage = (months = 6) =>
  call<[string, number, number][]>("monthly_usage", { months });

// ---------------------------------------------------------------
// Sicherung
// ---------------------------------------------------------------

export const writeBackup = (path: string, password: string) =>
  call<number>("write_backup", { path, password });
export const readBackup = (path: string, password: string, replace: boolean) =>
  call<number>("read_backup", { path, password, replace });
export const listAutoBackups = () => call<[string, number][]>("list_auto_backups");
export const restoreAutoBackup = (path: string) =>
  call<number>("restore_auto_backup", { path });

export const importLegacy = (json: string) => call<number>("import_legacy", { json });

export const extractReportText = (path: string) => call<string>("extract_report_text", { path });
