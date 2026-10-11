import { escapeHtml as esc, option } from "./ui-html.js";
import {
  defaultChoices,
  defaultQuantities,
  newLoadout,
  loadoutCounts,
  loadoutIssues,
  canSelectModel,
} from "./army-loadout.js";
import {
  equipmentRestrictionIssues,
  equipmentBounds,
  equipmentSelectionCounts,
} from "./equipment-limits.js";
function choiceIssues(unit, row, index, group, value) {
  const models = row.loadout.models.map((m, i) =>
    i === index ? { ...m, choices: { ...m.choices, [group]: value } } : m,
  );
  return [
    ...equipmentRestrictionIssues(unit, models),
    ...loadoutIssues(unit, {
      ...row,
      loadout: { ...row.loadout, models },
    }).filter(
      (issue) =>
        issue.includes("selection limit exceeded") ||
        issue.includes("equipment quantity outside source bounds"),
    ),
  ];
}
export function equipmentView(unit, row) {
  if (!row.loadout)
    return '<section class="equipment-picker"><h3>Equipment</h3><p>Choose model equipment to replace the old manual quantities.</p><button id="reset-equipment" class="button">Configure equipment</button></section>';
  const types = unit.equipment.models.length
    ? unit.equipment.models
    : [unit.equipment.tree];
  const counts = equipmentSelectionCounts(unit, row.loadout.models);
  function node(n, m, index, selected = false) {
    const bounds = equipmentBounds(n, counts);
    if (n.kind === "weapon") {
      const count =
        m.quantities[n.id] ?? (selected ? Math.max(1, n.min) : n.min);
      if (selected || n.min === n.max)
        return (
          '<span class="fixed-weapon">' +
          esc(n.name) +
          (count > 1 ? " ×" + count : "") +
          "</span>"
        );
      return (
        "<label>" +
        esc(n.name) +
        '<input type="number" min="' +
        bounds.min +
        '" max="' +
        (bounds.max ?? Math.max(1, bounds.min)) +
        '" value="' +
        count +
        '" data-equipment-qty="' +
        esc(n.id) +
        '" data-model="' +
        index +
        '"></label>'
      );
    }
    if (n.kind === "group" && n.max === 1) {
      const id = m.choices[n.id],
        chosen = n.children.find((c) => c.id === id);
      return (
        "<label>" +
        esc(n.name) +
        '<select data-equipment-choice="' +
        esc(n.id) +
        '" data-model="' +
        index +
        '">' +
        (!bounds.min ? option("", "None", id) : "") +
        n.children
          .map(
            (c) =>
              `<option value="${esc(c.id)}" ${c.id === id ? "selected" : ""} ${choiceIssues(unit, row, index, n.id, c.id).length ? "disabled" : ""}>${esc(c.name)}</option>`,
          )
          .join("") +
        "</select></label>" +
        (chosen && chosen.kind !== "weapon" ? node(chosen, m, index, true) : "")
      );
    }
    if (n.kind === "bundle" && n.max !== null && !selected) {
      const count = m.quantities[n.id] ?? n.min;
      return `<div class="equipment-group"><label>${esc(n.name)}<input type="number" min="${bounds.min}" max="${bounds.max}" value="${count}" data-equipment-qty="${esc(n.id)}" data-model="${index}"></label>${count ? (n.children ?? []).map((c) => node(c, m, index)).join("") : ""}</div>`;
    }
    return (
      '<div class="equipment-group">' +
      (n.kind === "group"
        ? "<small>" +
          esc(n.name) +
          " · choose " +
          n.min +
          "–" +
          (n.max ?? "source limit") +
          "</small>"
        : "") +
      (n.children ?? []).map((c) => node(c, m, index)).join("") +
      "</div>"
    );
  }
  const issues = loadoutIssues(unit, row);
  return (
    '<section class="equipment-picker"><h3>Equipment</h3>' +
    row.loadout.models
      .map((m, index) => {
        const t = types.find((t) => t.id === m.type);
        const selector =
          types.length > 1
            ? '<label>Model<select data-equipment-type="' +
              index +
              '">' +
              types
                .map(
                  (t) =>
                    '<option value="' +
                    esc(t.id) +
                    '" ' +
                    (t.id === m.type ? "selected " : "") +
                    (!canSelectModel(unit, row, index, t.id)
                      ? "disabled "
                      : "") +
                    ">" +
                    esc(t.name) +
                    "</option>",
                )
                .join("") +
              "</select></label>"
            : "";
        const controls = selector + node(t, m, index);
        return row.models === 1
          ? controls
          : '<details data-panel="equipment-model-' +
              index +
              '" ' +
              (index === 0 ? "open" : "") +
              "><summary>Model " +
              (index + 1) +
              " · " +
              esc(t.name) +
              "</summary>" +
              controls +
              "</details>";
      })
      .join("") +
    (row.models > 1
      ? '<button id="copy-equipment" class="mini">Use model 1 choices for matching models</button>'
      : "") +
    (issues.length
      ? '<p class="equipment-warning">' + issues.map(esc).join("<br>") + "</p>"
      : "") +
    '<p class="equipment-feedback equipment-warning" role="status"></p></section>'
  );
}
export function bindEquipment(target, unit, row, onChange) {
  const reset = target.querySelector("#reset-equipment");
  if (reset)
    reset.onclick = () => {
      row.loadout = newLoadout(unit, row.models);
      row.wargear = loadoutCounts(unit, row.loadout);
      onChange();
    };
  target.querySelectorAll("[data-equipment-choice]").forEach(
    (el) =>
      (el.onchange = () => {
        const issues = choiceIssues(
          unit,
          row,
          Number(el.dataset.model),
          el.dataset.equipmentChoice,
          el.value,
        );
        if (issues.length) {
          el.value =
            row.loadout.models[Number(el.dataset.model)].choices[
              el.dataset.equipmentChoice
            ];
          target.querySelector(".equipment-feedback").textContent = issues[0];
          return;
        }
        row.loadout.models[Number(el.dataset.model)].choices[
          el.dataset.equipmentChoice
        ] = el.value;
        row.wargear = loadoutCounts(unit, row.loadout);
        onChange();
      }),
  );
  target.querySelectorAll("[data-equipment-qty]").forEach(
    (el) =>
      (el.onchange = () => {
        const q = Number(el.value);
        if (!Number.isInteger(q) || q < Number(el.min) || q > Number(el.max)) {
          el.reportValidity();
          return;
        }
        const model = row.loadout.models[Number(el.dataset.model)],
          previous = model.quantities[el.dataset.equipmentQty];
        model.quantities[el.dataset.equipmentQty] = q;
        if (
          equipmentRestrictionIssues(unit, row.loadout.models).length ||
          loadoutIssues(unit, row).some((issue) =>
            issue.includes("selection limit exceeded"),
          )
        ) {
          if (previous === undefined)
            delete model.quantities[el.dataset.equipmentQty];
          else model.quantities[el.dataset.equipmentQty] = previous;
          el.value = previous ?? el.min;
          target.querySelector(".equipment-feedback").textContent =
            "Choose within this equipment group’s limit.";
          return;
        }
        row.wargear = loadoutCounts(unit, row.loadout);
        onChange();
      }),
  );
  target.querySelectorAll("[data-equipment-type]").forEach(
    (el) =>
      (el.onchange = () => {
        const index = Number(el.dataset.equipmentType);
        if (!canSelectModel(unit, row, index, el.value)) {
          el.value = row.loadout.models[index].type;
          target.querySelector(".equipment-feedback").textContent =
            "That model choice exceeds the unit limit.";
          return;
        }
        const t = unit.equipment.models.find((t) => t.id === el.value);
        row.loadout.models[index] = {
          type: t.id,
          choices: defaultChoices(t),
          quantities: defaultQuantities(t),
        };
        row.wargear = loadoutCounts(unit, row.loadout);
        onChange();
      }),
  );
  const copy = target.querySelector("#copy-equipment");
  if (copy)
    copy.onclick = () => {
      const previous = structuredClone(row.loadout.models);
      const first = row.loadout.models[0];
      for (const m of row.loadout.models)
        if (m.type === first.type) {
          m.choices = { ...first.choices };
          m.quantities = { ...first.quantities };
        }
      const issues = equipmentRestrictionIssues(unit, row.loadout.models);
      if (issues.length) {
        row.loadout.models = previous;
        target.querySelector(".equipment-feedback").textContent = issues[0];
        return;
      }
      row.wargear = loadoutCounts(unit, row.loadout);
      onChange();
    };
}
