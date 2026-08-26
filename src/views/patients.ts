/**
 * Berichte den Patientinnen zuordnen.
 *
 * Bis Fassung 1.2 war jeder Bericht ein eigener Fall. Für dieselbe
 * Person standen dann zwei, drei Einträge in der Liste — mit
 * denselben Stammdaten, jeweils von Hand gepflegt. Fassung 2.0 legt
 * die Berichte unter die Patientin.
 *
 * Der Altbestand lässt sich nicht stillschweigend umsortieren. Ob
 * „Berg" und „Bergmann" dieselbe Person sind, weiss nur die
 * Behandlerin. Rana rechnet deshalb einen Vorschlag aus und legt ihn
 * vor; geändert wird erst auf Bestätigung, und jede Gruppe und jeder
 * einzelne Bericht lässt sich vorher abwählen.
 */

import * as api from "../core/ipc";
import type { MergeGruppe } from "../core/ipc";
import { dialog, esc, icon, qs, qsa, toast } from "../ui/kit";

/**
 * Zeigt den Vorschlag. Gibt zurück, wie viele Berichte zugeordnet
 * wurden — 0, wenn abgebrochen wurde.
 */
export async function zeigeZuordnung(): Promise<number> {
  let gruppen: MergeGruppe[];
  try {
    gruppen = await api.mergeProposal();
  } catch (e) {
    toast(api.errorText(e), "danger");
    return 0;
  }

  // Gruppen, die schon vollständig zugeordnet sind, kommen gar nicht
  // erst in den Dialog — der Vorschlag enthält sie trotzdem, weil er
  // den ganzen Bestand beschreibt.
  const offen = await api.reportsWithoutPatient();
  const offeneIds = new Set(offen.map((c) => c.id));
  const zuTun = gruppen
    .map((g) => ({ ...g, report_ids: g.report_ids.filter((id) => offeneIds.has(id)) }))
    .filter((g) => g.report_ids.length > 0);

  if (!zuTun.length) {
    toast("Alle Berichte sind bereits einer Patientin zugeordnet.", "ok");
    return 0;
  }

  const mehrfach = zuTun.filter((g) => g.report_ids.length > 1).length;
  const einzeln = zuTun.length - mehrfach;

  const zeile = (g: typeof zuTun[number], i: number): string => {
    const berichte = g.report_ids
      .map((id) => {
        const c = offen.find((x) => x.id === id);
        const nr = c?.antrag_nr ? `${esc(c.antrag_nr)}. Antrag` : "ohne Nummer";
        const wie = c?.label ? ` &middot; eingetragen als „${esc(c.label)}"` : "";
        return `
          <label class="merge-bericht">
            <input type="checkbox" data-bericht="${esc(id)}" data-gruppe="${i}" checked>
            <span>${nr}${wie}</span>
          </label>`;
      })
      .join("");

    const abweichend = g.schreibweisen.length > 1
      ? `<p class="merge-schreibweisen">${g.schreibweisen.map((s) => esc(s)).join(" &middot; ")}</p>`
      : "";

    return `
      <li class="merge-gruppe" data-idx="${i}">
        <div class="merge-kopf">
          <label class="merge-an">
            <input type="checkbox" data-gruppe-an="${i}" checked>
            <span class="sr-only">Diese Patientin anlegen</span>
          </label>
          <input class="merge-name" type="text" data-name="${i}"
                 value="${esc(g.name)}" aria-label="Name der Patientin">
          <span class="merge-zahl">${g.report_ids.length}</span>
        </div>
        ${abweichend}
        <div class="merge-berichte">${berichte}</div>
      </li>`;
  };

  let zugeordnet = 0;

  await dialog({
    title: "Berichte den Patientinnen zuordnen",
    breit: true,
    confirm: "Zuordnen",
    cancel: "Später",
    body: `
      <p class="hint">
        Rana hat ${offen.length} noch nicht zugeordnete ${offen.length === 1 ? "Bericht" : "Berichte"}
        gefunden und schlägt ${zuTun.length} ${zuTun.length === 1 ? "Patientin" : "Patientinnen"} vor${
          mehrfach
            ? `, davon ${mehrfach} mit mehreren Anträgen`
            : ""
        }${einzeln && mehrfach ? ` und ${einzeln} mit einem einzigen` : ""}.
      </p>
      <p class="hint">
        Namen lassen sich hier noch ändern. Wer abgewählt wird, bleibt
        unzugeordnet und kann später von Hand zugeordnet werden — es
        geht dabei kein Bericht verloren.
      </p>
      <ul class="merge-liste">${zuTun.map(zeile).join("")}</ul>`,

    onOpen: (root) => {
      // Die Gruppenschaltung nimmt ihre Berichte mit.
      for (const box of qsa<HTMLInputElement>("[data-gruppe-an]", root)) {
        box.addEventListener("change", () => {
          const i = box.dataset.gruppeAn!;
          const li = qs<HTMLElement>(`.merge-gruppe[data-idx="${i}"]`, root)!;
          li.classList.toggle("is-aus", !box.checked);
          for (const b of qsa<HTMLInputElement>(`[data-gruppe="${i}"]`, li)) {
            b.checked = box.checked;
            b.disabled = !box.checked;
          }
          qs<HTMLInputElement>(`[data-name="${i}"]`, li)!.disabled = !box.checked;
        });
      }
    },

    onConfirm: async (root) => {
      const auswahl: MergeGruppe[] = [];

      for (let i = 0; i < zuTun.length; i++) {
        const an = qs<HTMLInputElement>(`[data-gruppe-an="${i}"]`, root);
        if (!an?.checked) continue;

        const ids = qsa<HTMLInputElement>(`[data-gruppe="${i}"]`, root)
          .filter((b) => b.checked)
          .map((b) => b.dataset.bericht!);
        if (!ids.length) continue;

        const name = qs<HTMLInputElement>(`[data-name="${i}"]`, root)!.value.trim();
        auswahl.push({
          name: name || zuTun[i].name,
          schreibweisen: zuTun[i].schreibweisen,
          report_ids: ids,
          anzahl: ids.length,
        });
      }

      if (!auswahl.length) {
        toast("Nichts ausgewählt — es wurde nichts geändert.", "info");
        return true;
      }

      try {
        zugeordnet = await api.mergeApply(auswahl);
        toast(
          `${zugeordnet} ${zugeordnet === 1 ? "Bericht" : "Berichte"} zugeordnet, ` +
          `${auswahl.length} ${auswahl.length === 1 ? "Patientin" : "Patientinnen"} angelegt.`,
          "ok"
        );
        return true;
      } catch (e) {
        toast(api.errorText(e), "danger");
        return false;
      }
    },
  });

  return zugeordnet;
}

/**
 * Beim Start: liegen unzugeordnete Berichte vor, wird einmal darauf
 * hingewiesen. Nicht als Dialog, der sich vor die Arbeit schiebt,
 * sondern als Zeile in der Seitenschiene — der Hinweis kann warten.
 */
export async function offeneZuordnungen(): Promise<number> {
  try {
    return await api.mergePending();
  } catch {
    return 0;
  }
}

export const zuordnungIcon = icon.merge;
