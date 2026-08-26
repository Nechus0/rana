/**
 * Einstellungen, Sicherung, Verbrauch, Papierkorb.
 *
 * Alles, was nicht zum Schreiben eines Berichts gehört, aber dazu,
 * dass man der Anwendung eine Praxis anvertrauen kann.
 */

import { save as saveDialog, open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import * as api from "../core/ipc";
import * as S from "../core/state";
import { confirmDialog, dialog, esc, eur, icon, on, qs, qsa, relDate, toast } from "../ui/kit";

const CONSOLE_LIMITS = "https://platform.claude.com/settings/limits";

/** Steht auch in package.json, Cargo.toml und tauri.conf.json. */
export const EIGENE_VERSION = "1.1.2";

// ===============================================================
// Einstellungen
// ===============================================================

export async function zeigeEinstellungen(neuZeichnen: () => void): Promise<void> {
  const p = await api.getProfile();
  const key = await api.apiKeyStatus();

  await dialog({
    title: "Einstellungen",
    confirm: "Übernehmen",
    body: `
      <div class="group">
        <div class="group-head"><span class="group-title">Praxis und Behandler:in</span></div>
        <div class="grid-1-2" style="margin-bottom:var(--s4)">
          ${txt("e_titel", "Titel", p.behandler.titel)}
          ${txt("e_name", "Name", p.behandler.name)}
        </div>
        <div class="grid-2">
          <div class="span-all">${txt("e_funktion", "Funktion", p.behandler.funktion)}</div>
          <div class="span-all">${txt("e_strasse", "Strasse", p.praxis.strasse)}</div>
          ${txt("e_plz", "PLZ", p.praxis.plz)}
          ${txt("e_ort", "Ort", p.praxis.ort)}
          ${txt("e_tel", "Telefon", p.praxis.telefon)}
          ${txt("e_mail", "E-Mail", p.praxis.email)}
        </div>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Claude-Zugang</span></div>
        <div class="field">
          <label>Hinterlegter Schlüssel</label>
          <div class="row">
            <code style="font-family:var(--face-record);font-size:12px;color:var(--reed)">
              ${key.vorhanden ? esc(key.maskiert ?? "") : "keiner hinterlegt"}
            </code>
            <span class="spacer"></span>
            <button class="btn" id="e_keyNeu" type="button">Ersetzen</button>
            <button class="btn" id="e_keyTest" type="button" ${key.vorhanden ? "" : "disabled"}>Testen</button>
            <button class="btn btn-danger" id="e_keyWeg" type="button" ${key.vorhanden ? "" : "disabled"}>Entfernen</button>
          </div>
          <div class="key-state" id="e_keyState"></div>
        </div>
        <div class="field">
          <label for="e_model">Modell</label>
          <select id="e_model">
            <option value="claude-opus-5" ${p.api.model === "claude-opus-5" ? "selected" : ""}>Opus 5</option>
            <option value="claude-sonnet-5" ${p.api.model === "claude-sonnet-5" ? "selected" : ""}>Sonnet 5</option>
          </select>
        </div>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Grenzen</span></div>
        <div class="grid-2">
          ${num("e_budget", "Monatsbudget (€)", p.budget.monthly_eur)}
          ${num("e_daily", "Berichte je Tag", p.budget.daily_reports)}
        </div>
        <p class="hint" style="margin-top:10px">
          Die Grenze bei Anthropic bleibt davon unberührt.
          <a href="#" id="e_console">Dort prüfen</a>.
        </p>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Bericht</span></div>
        <div class="field">
          <label for="e_untertitel">Untertitel</label>
          <input id="e_untertitel" value="${esc(p.layout.untertitel)}">
        </div>
        <div class="grid-3" style="margin-top:12px">
          ${num("e_min", "Mindestens", p.layout.ziel_min)}
          ${num("e_soll", "Zielwert", p.layout.ziel_soll)}
          ${num("e_max", "Höchstens", p.layout.ziel_max)}
        </div>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Erscheinungsbild & System</span></div>
        <div class="grid-2" style="align-items: center; gap: 16px;">
          <label class="switch" style="grid-column: span 2;">
            <input type="checkbox" id="e_theme">
            <span class="switch-track"></span>
            <span>Dunkler Modus</span>
          </label>
          <button class="btn" id="e_btnUpdate" type="button">Nach Aktualisierung suchen</button>
          <button class="btn" id="e_btnUeber" type="button">Über Rana</button>
        </div>
      </div>`,

    onOpen: (root) => {
      const themeToggle = qs<HTMLInputElement>("#e_theme", root)!;
      themeToggle.checked = document.documentElement.dataset.theme === "dark";
      on(themeToggle, "change", () => {
        const THEMA_KEY = "rana-thema";
        const dunkel = themeToggle.checked;
        if (!dunkel) delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = "dark";
        localStorage.setItem(THEMA_KEY, dunkel ? "dark" : "light");
      });

      on(qs<HTMLElement>("#e_btnUpdate", root)!, "click", () => { void zeigeAktualisierung(); });
      on(qs<HTMLElement>("#e_btnUeber", root)!, "click", () => { void zeigeUeber(); });

      on(qs<HTMLElement>("#e_console", root)!, "click", (e) => {
        e.preventDefault();
        void openUrl(CONSOLE_LIMITS);
      });

      on(qs<HTMLElement>("#e_keyNeu", root)!, "click", () => { void schluesselErsetzen(); });

      on(qs<HTMLElement>("#e_keyTest", root)!, "click", async () => {
        const box = qs<HTMLElement>("#e_keyState", root)!;
        box.className = "key-state";
        box.innerHTML = `<span class="spinner"></span> <span>Prüfe …</span>`;
        try {
          await api.testApiKey();
          box.className = "key-state ok";
          box.innerHTML = `${icon.check} <span>Der Schlüssel funktioniert.</span>`;
        } catch (e) {
          box.className = "key-state bad";
          box.innerHTML = `${icon.warn} <span>${esc(api.errorText(e))}</span>`;
        }
      });

      on(qs<HTMLElement>("#e_keyWeg", root)!, "click", async () => {
        const ok = await confirmDialog(
          "Schlüssel entfernen",
          "Ohne Schlüssel kann Rana keine Berichte mehr formulieren. Die Falldaten bleiben unberührt.",
          "Entfernen", true
        );
        if (!ok) return;
        await api.clearApiKey();
        toast("Schlüssel entfernt.");
      });
    },

    onConfirm: async (root) => {
      const v = (id: string) => qs<HTMLInputElement>(`#${id}`, root)?.value.trim() ?? "";
      const n = (id: string, f: number) => {
        const x = parseFloat(v(id));
        return isNaN(x) ? f : x;
      };

      const neu: api.Profile = {
        ...p,
        behandler: { titel: v("e_titel"), name: v("e_name"), funktion: v("e_funktion") },
        praxis: {
          ...p.praxis,
          strasse: v("e_strasse"), plz: v("e_plz"), ort: v("e_ort"),
          telefon: v("e_tel"), email: v("e_mail"),
          brief_ort: p.praxis.brief_ort || v("e_ort"),
        },
        api: { ...p.api, model: qs<HTMLSelectElement>("#e_model", root)!.value },
        budget: {
          monthly_eur: n("e_budget", p.budget.monthly_eur),
          daily_reports: Math.max(1, Math.round(n("e_daily", p.budget.daily_reports))),
        },
        layout: {
          ...p.layout,
          untertitel: v("e_untertitel"),
          ziel_min: Math.round(n("e_min", p.layout.ziel_min)),
          ziel_soll: Math.round(n("e_soll", p.layout.ziel_soll)),
          ziel_max: Math.round(n("e_max", p.layout.ziel_max)),
        },
      };

      if (neu.layout.ziel_min >= neu.layout.ziel_max) {
        toast("Der Mindestwert muss unter dem Höchstwert liegen.", "danger");
        return false;
      }

      await api.saveProfile(neu);
      S.patch({ profile: neu });
      await S.refreshBudget();
      toast("Einstellungen übernommen.", "ok");
      neuZeichnen();
      return true;
    },
  });
}

const txt = (id: string, label: string, wert: string) => `
  <div class="field">
    <label for="${id}">${esc(label)}</label>
    <input id="${id}" value="${esc(wert)}">
  </div>`;

const num = (id: string, label: string, wert: number) => `
  <div class="field">
    <label for="${id}">${esc(label)}</label>
    <input id="${id}" type="number" value="${wert}">
  </div>`;

async function schluesselErsetzen(): Promise<void> {
  await dialog({
    title: "Schlüssel ersetzen",
    confirm: "Speichern und testen",
    body: `
      <div class="field">
        <label for="k_neu">Neuer API-Schlüssel</label>
        <input id="k_neu" type="password" placeholder="sk-ant-…" autocomplete="off" spellcheck="false"
               style="font-family:var(--face-record);font-size:12px">
      </div>
      <p class="hint">Er wird im Windows-Tresor abgelegt und ist danach nur noch maskiert sichtbar.</p>`,
    onConfirm: async (r) => {
      const k = qs<HTMLInputElement>("#k_neu", r)!.value.trim();
      if (!k) return false;
      try {
        await api.setApiKey(k);
        await api.testApiKey();
        toast("Schlüssel gespeichert und geprüft.", "ok");
        return true;
      } catch (e) {
        toast(api.errorText(e), "danger");
        return false;
      }
    },
  });
}

// ===============================================================
// Verbrauch
// ===============================================================

export async function zeigeVerbrauch(): Promise<void> {
  const b = await api.budgetState();
  const monate = await api.monthlyUsage(6);

  const balken = (pct: number) => {
    const cls = pct >= 100 ? "stop" : pct >= 90 ? "warn" : "";
    return `<div class="budget-bar"><div class="budget-fill ${cls}" style="--used:${Math.min(100, pct)}%"></div></div>`;
  };

  await dialog({
    title: "Verbrauch",
    cancel: "Schliessen",
    body: `
      <div class="group">
        <div class="group-head"><span class="group-title">Dieser Monat</span></div>
        <div class="budget">
          <div class="budget-row">
            <span class="budget-amount">${eur(b.month_spent_eur)}</span>
            <span class="budget-of">von ${eur(b.month_limit_eur)}</span>
          </div>
          ${balken(b.month_pct)}
          <p class="hint" style="margin-top:8px">
            ${b.today_reports} von ${b.daily_limit} Berichten heute ·
            der nächste kostet voraussichtlich ${eur(b.estimate_eur)}
          </p>
        </div>
        ${b.level === "gestoppt" ? `
          <div class="notice notice-danger" style="margin-top:14px">
            Rana sendet gerade nichts. Unter „Einstellungen“ lässt sich die Grenze anheben.
          </div>`
        : b.level === "warnung" ? `
          <div class="notice notice-warn" style="margin-top:14px">
            Über 90 % des Monatsbudgets verbraucht.
          </div>` : ""}
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Letzte Monate</span></div>
        ${monate.length ? `
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tbody>
              ${monate.map(([m, kosten, n]) => `
                <tr style="border-bottom:1px solid var(--line)">
                  <td style="padding:8px 0;font-family:var(--face-record);font-size:12px;color:var(--reed)">${esc(monatName(m))}</td>
                  <td style="padding:8px 0;text-align:right;font-family:var(--face-record);font-variant-numeric:tabular-nums">${eur(kosten)}</td>
                  <td style="padding:8px 0 8px 20px;text-align:right;color:var(--reed)">${n} ${n === 1 ? "Aufruf" : "Aufrufe"}</td>
                </tr>`).join("")}
            </tbody>
          </table>` : `<p class="hint">Noch kein Verbrauch aufgezeichnet.</p>`}
      </div>

      <div class="notice">
        Der Zähler rechnet mit den Marken, die Anthropic nach jedem Aufruf zurückmeldet,
        und einem festen Umrechnungskurs von 0,95 € je Dollar. Er ist bewusst eher hoch
        angesetzt, damit die Grenze zuverlässig auslöst — die Abrechnung bei Anthropic
        fällt in der Regel etwas niedriger aus.
      </div>`,
  });
}

function monatName(m: string): string {
  const [j, mm] = m.split("-");
  const namen = ["Januar", "Februar", "März", "April", "Mai", "Juni",
                 "Juli", "August", "September", "Oktober", "November", "Dezember"];
  return `${namen[parseInt(mm, 10) - 1] ?? m} ${j}`;
}

// ===============================================================
// Sicherung
// ===============================================================

export async function zeigeSicherung(neuZeichnen: () => void): Promise<void> {
  const auto = await api.listAutoBackups();

  await dialog({
    title: "Sicherung",
    cancel: "Schliessen",
    body: `
      <div class="notice notice-info">
        Eine Sicherung enthält alle Fälle, die Einstellungen und den Schlüssel zur
        Verschlüsselung — <b>nicht</b> den Anthropic-Schlüssel. Sie ist mit einem
        Passwort geschützt, das hier vergeben wird. Ohne dieses Passwort lässt sich
        die Datei nicht mehr öffnen. Bitte sicher notieren.
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Von Hand</span></div>
        <div class="row">
          <button class="btn btn-primary" id="b_sichern" type="button">${icon.save} Sicherung anlegen</button>
          <button class="btn" id="b_lesen" type="button">${icon.archive} Wiederherstellen</button>
        </div>
      </div>

      <div class="group">
        <div class="group-head"><span class="group-title">Täglich, von selbst</span></div>
        <p class="hint" style="margin-bottom:12px">
          Rana legt bei jedem ersten Start des Tages einen Stand an und hält die letzten sieben.
          Diese Stände brauchen kein Passwort — sie liegen im geschützten Benutzerprofil.
        </p>
        ${auto.length ? `
          <div style="display:flex;flex-direction:column;gap:4px">
            ${auto.map(([pfad, groesse]) => `
              <div class="row" style="gap:8px">
                <span class="record-num small" style="flex:1">${esc(dateiName(pfad))}</span>
                <span class="small muted">${Math.round(groesse / 1024)} kB</span>
                <button class="btn btn-sm" data-auto="${esc(pfad)}" type="button">Wiederherstellen</button>
              </div>`).join("")}
          </div>` : `<p class="hint">Noch kein Stand vorhanden.</p>`}
      </div>`,

    onOpen: (root) => {
      on(qs<HTMLElement>("#b_sichern", root)!, "click", () => { void sicherungSchreiben(); });
      on(qs<HTMLElement>("#b_lesen", root)!, "click", () => { void sicherungLesen(neuZeichnen); });
      for (const b of qsa<HTMLButtonElement>("[data-auto]", root)) {
        on(b, "click", () => { void autoWiederherstellen(b.dataset.auto!, neuZeichnen); });
      }
    },
  });
}

const dateiName = (p: string) => p.split(/[\\/]/).pop() ?? p;

async function sicherungSchreiben(): Promise<void> {
  const heute = new Date().toISOString().slice(0, 10);
  const pfad = await saveDialog({
    title: "Sicherung ablegen",
    defaultPath: `Rana-Sicherung-${heute}.ranasic`,
    filters: [{ name: "Rana-Sicherung", extensions: ["ranasic"] }],
  });
  if (!pfad) return;

  await dialog({
    title: "Passwort für die Sicherung",
    confirm: "Sichern",
    body: `
      <div class="field">
        <label for="sic_pw">Passwort <span class="field-note">mindestens acht Zeichen</span></label>
        <input id="sic_pw" type="password" autocomplete="new-password">
      </div>
      <div class="field">
        <label for="sic_pw2">Wiederholen</label>
        <input id="sic_pw2" type="password" autocomplete="new-password">
      </div>
      <div class="notice notice-warn">
        Ohne dieses Passwort ist die Sicherung endgültig unlesbar. Es gibt keinen Weg zurück.
      </div>`,
    onConfirm: async (r) => {
      const a = qs<HTMLInputElement>("#sic_pw", r)!.value;
      const b = qs<HTMLInputElement>("#sic_pw2", r)!.value;
      if (a !== b) { toast("Die beiden Passwörter stimmen nicht überein.", "danger"); return false; }
      try {
        const n = await api.writeBackup(pfad, a);
        toast(`${n} ${n === 1 ? "Fall" : "Fälle"} gesichert.`, "ok");
        return true;
      } catch (e) {
        toast(api.errorText(e), "danger");
        return false;
      }
    },
  });
}

async function sicherungLesen(neuZeichnen: () => void): Promise<void> {
  const pfad = await openDialog({
    title: "Sicherung öffnen",
    multiple: false,
    filters: [{ name: "Rana-Sicherung", extensions: ["ranasic"] }],
  });
  if (!pfad || typeof pfad !== "string") return;

  await dialog({
    title: "Wiederherstellen",
    confirm: "Wiederherstellen",
    danger: true,
    body: `
      <div class="field">
        <label for="res_pw">Passwort der Sicherung</label>
        <input id="res_pw" type="password" autocomplete="off">
      </div>
      <label class="switch">
        <input type="checkbox" id="res_replace">
        <span class="switch-track"></span>
        <span>Vorhandene Fälle vorher entfernen</span>
      </label>
      <div class="notice notice-warn">
        Ohne Häkchen werden die Fälle aus der Sicherung zu den vorhandenen hinzugefügt;
        gleiche Kennungen werden überschrieben.
      </div>`,
    onConfirm: async (r) => {
      const pw = qs<HTMLInputElement>("#res_pw", r)!.value;
      const replace = qs<HTMLInputElement>("#res_replace", r)!.checked;
      try {
        const n = await api.readBackup(pfad, pw, replace);
        toast(`${n} ${n === 1 ? "Fall" : "Fälle"} wiederhergestellt.`, "ok");
        await S.refreshCases();
        neuZeichnen();
        return true;
      } catch (e) {
        toast(api.errorText(e), "danger");
        return false;
      }
    },
  });
}

async function autoWiederherstellen(pfad: string, neuZeichnen: () => void): Promise<void> {
  const ok = await confirmDialog(
    "Stand wiederherstellen",
    `„${dateiName(pfad)}“ ersetzt alle derzeit vorhandenen Fälle. Was seitdem entstanden ist, geht dabei verloren.`,
    "Wiederherstellen", true
  );
  if (!ok) return;
  try {
    const n = await api.restoreAutoBackup(pfad);
    toast(`${n} ${n === 1 ? "Fall" : "Fälle"} wiederhergestellt.`, "ok");
    await S.refreshCases();
    neuZeichnen();
  } catch (e) {
    toast(api.errorText(e), "danger");
  }
}

// ===============================================================
// Papierkorb
// ===============================================================

export async function zeigePapierkorb(neuZeichnen: () => void): Promise<void> {
  const liste = await api.listCases("", true);

  await dialog({
    title: "Papierkorb",
    cancel: "Schliessen",
    body: `
      <p class="hint">
        Gelöschte Fälle bleiben 30 Tage erhalten und werden danach endgültig entfernt.
      </p>
      ${liste.length ? `
        <div style="display:flex;flex-direction:column;gap:6px">
          ${liste.map((c) => `
            <div class="row" style="gap:8px;padding:8px 0;border-bottom:1px solid var(--line)">
              <div style="flex:1;min-width:0">
                <div style="font-weight:550">${esc(c.label)}</div>
                <div class="small muted">
                  ${c.purge_in_days !== null
                    ? `noch ${c.purge_in_days} ${c.purge_in_days === 1 ? "Tag" : "Tage"}`
                    : ""}
                  · zuletzt geändert ${esc(relDate(c.updated_at))}
                </div>
              </div>
              <button class="btn btn-sm" data-zurueck="${esc(c.id)}" type="button">Zurückholen</button>
              <button class="btn btn-sm btn-danger" data-endgueltig="${esc(c.id)}"
                      data-label="${esc(c.label)}" type="button">Endgültig</button>
            </div>`).join("")}
        </div>` : `<p class="hint">Der Papierkorb ist leer.</p>`}`,

    onOpen: (root) => {
      for (const b of qsa<HTMLButtonElement>("[data-zurueck]", root)) {
        on(b, "click", async () => {
          await api.restoreCase(b.dataset.zurueck!);
          await S.refreshCases();
          b.closest<HTMLElement>(".row")?.remove();
          toast("Fall zurückgeholt.", "ok");
          neuZeichnen();
        });
      }
      for (const b of qsa<HTMLButtonElement>("[data-endgueltig]", root)) {
        on(b, "click", async () => {
          const ok = await confirmDialog(
            "Endgültig entfernen",
            `„${b.dataset.label}“ wird unwiderruflich gelöscht. `
              + `Bitte prüfen, ob die Aufbewahrungsfrist abgelaufen ist.`,
            "Endgültig löschen", true
          );
          if (!ok) return;
          await api.purgeCase(b.dataset.endgueltig!);
          await S.refreshCases();
          b.closest<HTMLElement>(".row")?.remove();
          toast("Endgültig entfernt.");
          neuZeichnen();
        });
      }
    },
  });
}

// ===============================================================
// Über Rana
// ===============================================================

export async function zeigeUeber(): Promise<void> {
  await dialog({
    title: "Über Rana",
    cancel: "Schliessen",
    body: `
      <div style="display:flex;gap:20px;align-items:flex-start">
        <div style="flex:1">
          <p style="font-family:var(--face-display);font-size:24px;font-weight:600;letter-spacing:-.02em">Rana</p>
          <p style="font-family:var(--face-display);font-style:italic;color:var(--reed);margin-top:2px">arvalis · 1.0.0</p>
          <p class="hint" style="margin-top:16px">
            Rana arvalis, der Moorfrosch, ist ein unauffälliges braunes Tier, das sich
            für wenige Tage im Frühjahr leuchtend blau färbt und danach wieder verblasst.
            Diese Anwendung hält es genauso: sie bleibt ruhig, und sie wird blau
            genau dann, wenn Daten das Gerät verlassen.
          </p>
        </div>
      </div>
      <div class="notice">
        <b>Wo die Daten liegen.</b> Verschlüsselt im Windows-Benutzerprofil.
        Der Schlüssel steht im Windows-Tresor.<br><br>
        <b>Was hinausgeht.</b> Beim Formulieren die klinischen Angaben und die Chiffre —
        nie der Klarname. Sonst nichts: keine Nutzungsstatistik, keine Absturzberichte.
      </div>`,
  });
}

/**
 * Aktualisierung — ausschliesslich auf Anforderung.
 *
 * Der Vorgänger prüfte still beim Start. Das war bequem und stand im
 * Widerspruch zu dem, was das README verspricht: dass Rana ruhig
 * bleibt, solange sie nichts sendet. Ein Programm, das beim Start
 * unbemerkt GitHub anruft, hält dieses Versprechen nicht.
 *
 * Deshalb passiert hier nichts von selbst. Die Prüfung läuft nur, wenn
 * dieser Dialog geöffnet und der Knopf gedrückt wird — und sie ist
 * dabei die ganze Zeit sichtbar.
 *
 * Heruntergeladen wird nur, was mit Anjas privatem Schlüssel signiert
 * ist. Ein untergeschobener Installer wird von der Signaturprüfung
 * verworfen, bevor er ausgeführt wird.
 */
export async function zeigeAktualisierung(): Promise<void> {
  await dialog({
    title: "Aktualisierung",
    cancel: "Schliessen",
    body: `
      <p class="hint">
        Rana prüft nur, wenn Sie es hier auslösen — nie von selbst und nie im
        Hintergrund. Geprüft wird gegen die Veröffentlichungen auf GitHub.
      </p>
      <div class="row" style="margin-top:4px">
        <button class="btn btn-primary" id="u_pruefen" type="button">Nach Aktualisierung suchen</button>
        <span class="spacer"></span>
        <span class="record-num small muted">installiert: ${esc(EIGENE_VERSION)}</span>
      </div>
      <div class="key-state" id="u_status" style="min-height:24px"></div>
      <div id="u_details"></div>`,

    onOpen: (root) => {
      const knopf = qs<HTMLButtonElement>("#u_pruefen", root)!;
      const status = qs<HTMLElement>("#u_status", root)!;
      const details = qs<HTMLElement>("#u_details", root)!;

      on(knopf, "click", async () => {
        knopf.disabled = true;
        details.innerHTML = "";
        status.className = "key-state";
        status.innerHTML = `<span class="spinner"></span> <span>Frage bei GitHub nach …</span>`;

        try {
          const { check } = await import("@tauri-apps/plugin-updater");
          const gefunden = await check();

          if (!gefunden) {
            status.className = "key-state ok";
            status.innerHTML = `${icon.check} <span>Rana ist auf dem neuesten Stand.</span>`;
            knopf.disabled = false;
            return;
          }

          status.className = "key-state ok";
          status.innerHTML = `${icon.check} <span>Fassung ${esc(gefunden.version)} liegt vor.</span>`;
          details.innerHTML = `
            <div class="notice" style="margin-top:12px">
              ${gefunden.body ? `<p style="margin-bottom:10px">${esc(gefunden.body).slice(0, 600)}</p>` : ""}
              <p class="hint">
                Der Installer wird heruntergeladen, seine Signatur geprüft und
                anschliessend ausgeführt. Rana startet danach neu. Ihre Fälle
                bleiben unberührt.
              </p>
            </div>
            <div class="row" style="margin-top:12px">
              <button class="btn btn-primary" id="u_install" type="button">Herunterladen und installieren</button>
              <span class="hint" id="u_fortschritt"></span>
            </div>`;

          on(qs<HTMLElement>("#u_install", details)!, "click", async () => {
            const btn = qs<HTMLButtonElement>("#u_install", details)!;
            const fort = qs<HTMLElement>("#u_fortschritt", details)!;
            btn.disabled = true;

            let gesamt = 0;
            let geladen = 0;
            try {
              await gefunden.downloadAndInstall((e) => {
                // Der Fortschritt wird angezeigt, weil hier gerade Daten
                // fliessen — auch das soll nicht unsichtbar passieren.
                if (e.event === "Started") {
                  gesamt = e.data.contentLength ?? 0;
                  fort.textContent = "Lade …";
                } else if (e.event === "Progress") {
                  geladen += e.data.chunkLength;
                  fort.textContent = gesamt
                    ? `${Math.round((geladen / gesamt) * 100)} %`
                    : `${Math.round(geladen / 1024)} kB`;
                } else if (e.event === "Finished") {
                  fort.textContent = "Signatur geprüft, installiere …";
                }
              });

              const { relaunch } = await import("@tauri-apps/plugin-process");
              await relaunch();
            } catch (e) {
              btn.disabled = false;
              fort.textContent = "";
              status.className = "key-state bad";
              status.innerHTML = `${icon.warn} <span>${esc(api.errorText(e))}</span>`;
            }
          });
        } catch (e) {
          // Kein Netz, kein Server, keine Veröffentlichung — alles davon
          // ist harmlos. Gesagt wird es trotzdem, weil die Nutzerin die
          // Prüfung ausdrücklich angestossen hat.
          status.className = "key-state bad";
          status.innerHTML = `${icon.warn} <span>Die Prüfung ist fehlgeschlagen: ${esc(api.errorText(e))}</span>`;
          knopf.disabled = false;
        }
      });
    },
  });
}
