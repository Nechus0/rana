/**
 * Die Übersicht einer Patientin.
 *
 * Bis 2.2 war die Seitenschiene der einzige Ort, an dem eine Patientin
 * vorkam — als aufklappbare Zeile mit einem Kreuz und einem Pluszeichen,
 * die beide erst beim Überfahren erschienen. Wer wissen wollte, wann ein
 * Antrag angelegt wurde, musste ihn öffnen; wer einen neuen anlegen
 * wollte, musste das Pluszeichen finden.
 *
 * Diese Ansicht macht die Patientin zu einem eigenen Gegenstand: ihre
 * Stammdaten, ihre Anträge mit Datum und Stand, und die Handgriffe, die
 * sie betreffen — als Knöpfe mit Beschriftung, nicht als Zeichen am
 * Rand.
 */

import * as api from "../core/ipc";
import * as S from "../core/state";
import { confirmDialog, esc, icon, on, qsa, relDate, toast } from "../ui/kit";
import { zeigePatientStammdaten } from "./patient_dialog";

export interface PatientAnsichtHandler {
  /** Einen Antrag öffnen. */
  oeffnen: (caseId: string) => void;
  /** Nächsten Fortführungsantrag anlegen. */
  folgeantrag: (patientId: string) => void;
  /** Nach einer Änderung alles neu zeichnen. */
  neuZeichnen: () => void;
}

/** Was die Übersicht braucht — in einem Rutsch geholt. */
export interface PatientDaten {
  patient: api.Patient;
  berichte: api.CaseSummary[];
}

export async function ladePatient(patientId: string): Promise<PatientDaten> {
  const [patient, berichte] = await Promise.all([
    api.getPatient(patientId),
    api.reportsForPatient(patientId),
  ]);
  return { patient, berichte };
}

// ---------------------------------------------------------------
// Darstellung
// ---------------------------------------------------------------

const stammfeld = (label: string, wert: string) => wert.trim()
  ? `<div class="stamm-feld"><dt>${esc(label)}</dt><dd>${esc(wert)}</dd></div>`
  : "";

/** Ein Datum aus einem Feld, so wie es dasteht — oder ein Strich. */
const oder = (v: string | undefined) => (v ?? "").trim() || "—";

export function renderPatient(d: PatientDaten): string {
  const f = d.patient.fields;
  const name = oder(f.f_name);

  // Das Kontingent steht beim jüngsten Antrag — er trägt den Stand,
  // der jetzt gilt.
  const juengster = d.berichte[0];

  return `
    <!-- Der Name steht schon als Überschrift des Arbeitsbereichs.
         Hier noch einmal wäre er eine Wiederholung ohne Gewinn. -->
    <section class="group">
      <div class="group-head">
        <span class="group-title">Stammdaten</span>
        <span class="spacer"></span>
        <button class="btn btn-sm btn-quiet btn-icon" data-patientedit="${esc(d.patient.id)}" title="Stammdaten bearbeiten" aria-label="Stammdaten bearbeiten">
          ${icon.pen}
        </button>
      </div>

      <dl class="stammblatt">
        ${stammfeld("Chiffre", oder(f.f_chiffre))}
        ${stammfeld("Geburtsdatum", oder(f.f_gebdatum))}
        ${stammfeld("Kostenträger", oder(f.f_kasse))}
        ${stammfeld("Therapiebeginn", oder(f.f_beginn || f.f_therapiebeginn))}
        ${stammfeld("Angelegt", relDate(d.patient.created_at))}
      </dl>
    </section>

    <section class="group">
      <div class="group-head">
        <span class="group-title">Anträge</span>
        <span class="spacer"></span>
        <button class="btn btn-sm btn-primary" data-neuerantrag="${esc(d.patient.id)}">
          ${icon.plus} Nächster Fortführungsantrag
        </button>
      </div>

      ${d.berichte.length ? `
        <table class="antragstabelle">
          <thead>
            <tr>
              <th>Antrag</th>
              <th>Angelegt</th>
              <th>Zuletzt geändert</th>
              <th>Bericht</th>
              <th><span class="sr-only">Handgriffe</span></th>
            </tr>
          </thead>
          <tbody>
            ${d.berichte.map((c) => `
              <tr ${c.id === S.state.activeId ? 'class="ist-offen"' : ""}>
                <!-- Die Nummer stand hier als eigene, schmale Spalte.
                     Ihre Überschrift war breiter als ihr Inhalt, und die
                     Ziffer sass verloren am linken Rand. Sie steht jetzt
                     in der Bezeichnung, so wie in der Seitenschiene. -->
                <td class="antrag">${c.antrag_nr
                  ? `<b>${esc(c.antrag_nr)}.</b> Fortführungsantrag`
                  : "Antrag ohne Nummer"}</td>
                <td>${esc(relDate(c.created_at))}</td>
                <td>${esc(relDate(c.updated_at))}</td>
                <td>${c.has_report
                      ? `<span class="ist-fertig">${icon.check} formuliert</span>`
                      : `<span class="ist-offen-text">offen</span>`}</td>
                <td class="handgriffe">
                  <button class="btn btn-sm" data-oeffnen="${esc(c.id)}">Öffnen</button>
                  <button class="btn btn-sm btn-quiet btn-icon" data-antragweg="${esc(c.id)}"
                          data-antragname="${esc(c.antrag_nr ? `${c.antrag_nr}. Fortführungsantrag` : "Antrag ohne Nummer")}"
                          title="In den Papierkorb legen"
                          aria-label="In den Papierkorb legen">${icon.close}</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>

        ${juengster ? `
          <p class="hint" style="margin-top:var(--s3)">
            Der nächste Antrag übernimmt die Stammdaten, zählt die laufende
            Nummer hoch und rechnet das zuletzt beantragte Kontingent zum
            bewilligten hinzu.
          </p>` : ""}
      ` : `<p class="hint">Noch kein Antrag angelegt.</p>`}
    </section>

    <section class="group">
      <div class="group-head"><span class="group-title">Dieser Patient</span></div>
      <p class="hint" style="margin-bottom:var(--s3)">
        Alles landet im Papierkorb und bleibt dort dreissig Tage.
        Endgültig entfernt wird nichts ohne eine zweite Rückfrage.
      </p>
      <button class="btn btn-danger" data-patientweg="${esc(d.patient.id)}"
              data-patientname="${esc(name)}">
        ${icon.close} Patient in den Papierkorb
      </button>
    </section>`;
}

// ---------------------------------------------------------------
// Ereignisse
// ---------------------------------------------------------------



export function bindePatient(d: PatientDaten, h: PatientAnsichtHandler): void {
  for (const b of qsa<HTMLButtonElement>("[data-patientedit]")) {
    on(b, "click", () => {
      void zeigePatientStammdaten(b.dataset.patientedit!, () => {
        h.neuZeichnen();
      });
    });
  }

  for (const b of qsa<HTMLButtonElement>("[data-oeffnen]")) {
    on(b, "click", () => h.oeffnen(b.dataset.oeffnen!));
  }

  for (const b of qsa<HTMLButtonElement>("[data-neuerantrag]")) {
    on(b, "click", () => h.folgeantrag(b.dataset.neuerantrag!));
  }

  for (const b of qsa<HTMLButtonElement>("[data-antragweg]")) {
    on(b, "click", () => {
      void (async () => {
        const ja = await confirmDialog(
          "In den Papierkorb legen",
          `„${b.dataset.antragname}" wird in den Papierkorb gelegt. Dort bleibt `
          + `er dreissig Tage und lässt sich jederzeit zurückholen.`,
          "In den Papierkorb", true,
        );
        if (!ja) return;
        try {
          await api.trashCase(b.dataset.antragweg!);
          await S.refreshCases();
          toast("In den Papierkorb gelegt.", "ok", 3200);
          h.neuZeichnen();
        } catch (e) {
          toast(api.errorText(e), "danger");
        }
      })();
    });
  }

  for (const b of qsa<HTMLButtonElement>("[data-patientweg]")) {
    on(b, "click", () => {
      void (async () => {
        const n = d.berichte.length;
        const ja = await confirmDialog(
          "In den Papierkorb legen",
          n === 1
            ? `„${b.dataset.patientname}" wird mit ihrem einen Antrag in den `
              + `Papierkorb gelegt. Dort bleibt sie dreissig Tage.`
            : `„${b.dataset.patientname}" wird mit allen ${n} Anträgen in den `
              + `Papierkorb gelegt. Dort bleiben sie dreissig Tage.`,
          "In den Papierkorb", true,
        );
        if (!ja) return;
        try {
          for (const c of d.berichte) await api.trashCase(c.id);
          await S.refreshCases();
          S.patch({ patientAnsicht: null });
          toast(
            n === 1 ? "In den Papierkorb gelegt." : `${n} Anträge in den Papierkorb gelegt.`,
            "ok", 3200,
          );
          h.neuZeichnen();
        } catch (e) {
          toast(api.errorText(e), "danger");
        }
      })();
    });
  }
}
