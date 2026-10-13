import { groupArmyItems, armyGroup } from "./army-groups.js";
import { unitPoints } from "./army-core.js";
import { escapeHtml as esc } from "./ui-html.js";

export function armyRosterView(army, data, selected) {
  const units = new Map(data.units.map((unit) => [unit.id, unit]));
  const copiesTogether = (rows) => {
    const copies = new Map();
    for (const row of rows) {
      if (!copies.has(row.unitId)) copies.set(row.unitId, []);
      copies.get(row.unitId).push(row);
    }
    return [...copies.values()].flat();
  };
  return groupArmyItems(army.units, (row) => armyGroup(units.get(row.unitId)))
    .map(
      (group) => `<section class="army-roster-group" aria-label="${group.name}">
        <h3 class="army-group-heading">${group.name}<span>${group.items.length}</span></h3>
        ${copiesTogether(group.items)
          .map((row) => {
            const unit = units.get(row.unitId);
            return `<div class="army-selected-unit ${selected === row.id ? "chosen" : ""}"><button data-edit-unit="${esc(row.id)}"><strong>${esc(unit.name)}</strong><small>${row.models} models${row.warlord ? " · WARLORD" : ""}${row.attachment ? " · ATTACHED" : ""}</small></button><b>${unitPoints(unit, row, army) ?? "?"}<small>PTS</small></b><button class="mini" data-remove-unit="${esc(row.id)}" aria-label="Remove ${esc(unit.name)}">×</button></div>`;
          })
          .join("")}
      </section>`,
    )
    .join("");
}
