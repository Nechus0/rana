import * as api from "../core/ipc";
import { esc, dialog, toast } from "../ui/kit";

export async function zeigePatientStammdaten(patientId: string | null, onSaved?: (p: api.Patient) => void): Promise<void> {
  let patient: api.Patient;
  
  if (patientId) {
    patient = await api.getPatient(patientId);
  } else {
    patient = {
      id: crypto.randomUUID(),
      fields: {},
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    };
  }

  const f = (k: string) => patient.fields[k] || "";

  const html = `
    <div class="grid-2" style="gap: var(--s4) var(--s4); padding: 4px 0">
      <div class="field" style="grid-column: span 2">
        <label for="p_name">Klarname (Vor- und Nachname) <span class="field-note">Wird nie in den Bericht exportiert</span></label>
        <input type="text" id="p_name" value="${esc(f("f_name"))}" placeholder="z. B. Claudia Vißer">
      </div>
      
      <div class="field">
        <label for="p_chiffre">Chiffre / Pseudonym</label>
        <input type="text" id="p_chiffre" value="${esc(f("f_chiffre"))}" placeholder="z. B. V36-10.1962">
      </div>
      
      <div class="field">
        <label for="p_gebdatum">Geburtsdatum</label>
        <input type="date" id="p_gebdatum" value="${esc(f("f_gebdatum"))}">
      </div>
      
      <div class="field">
        <label for="p_geschlecht">Geschlecht</label>
        <select id="p_geschlecht">
          ${["", "weiblich", "männlich", "divers"].map(o => 
            `<option value="${esc(o)}" ${f("f_geschlecht") === o ? "selected" : ""}>${o || "—"}</option>`
          ).join("")}
        </select>
      </div>
      
      <div class="field">
        <label for="p_beginn">Therapiebeginn <span class="field-note">Datum der 1. Sitzung</span></label>
        <input type="date" id="p_beginn" value="${esc(f("f_beginn") || f("f_therapiebeginn"))}">
      </div>

      <div class="field" style="grid-column: span 2">
        <label for="p_kasse">Krankenkasse / Kostenträger</label>
        <input type="text" id="p_kasse" value="${esc(f("f_kasse"))}" placeholder="z. B. Beihilfe / AOK Niedersachsen">
      </div>

      <div class="field" style="grid-column: span 2">
        <label for="p_sozio">Soziodemographische Angaben <span class="field-note">Für den Berichtskopf</span></label>
        <input type="text" id="p_sozio" value="${esc(f("f_sozio"))}" placeholder="z. B. Lehrerin, in Partnerschaft, keine Kinder">
      </div>
    </div>
  `;

  await dialog({
    title: patientId ? "Patientin bearbeiten" : "Neue Patientin anlegen",
    body: html,
    confirm: "Speichern",
    cancel: "Abbrechen",
    breit: true,
    onOpen: (root) => {
      setTimeout(() => (root.querySelector("#p_name") as HTMLInputElement)?.focus(), 50);
    },
    onConfirm: async (root) => {
      const v = (id: string) => (root.querySelector("#" + id) as HTMLInputElement).value;
      
      const name = v("p_name").trim();
      if (!name) {
        toast("Bitte einen Namen angeben.", "danger");
        return false;
      }
      
      patient.fields["f_name"] = name;
      patient.fields["f_chiffre"] = v("p_chiffre");
      patient.fields["f_gebdatum"] = v("p_gebdatum");
      patient.fields["f_geschlecht"] = v("p_geschlecht");
      patient.fields["f_beginn"] = v("p_beginn");
      patient.fields["f_kasse"] = v("p_kasse");
      patient.fields["f_sozio"] = v("p_sozio");

      try {
        const saved = await api.savePatient(patient);
        if (onSaved) onSaved(saved);
        return true;
      } catch (e) {
        toast(api.errorText(e), "danger");
        return false;
      }
    }
  });
}
