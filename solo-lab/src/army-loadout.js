// Equipment choices are scoped to individual models; counts are derived, never free-form.
import {
  equipmentBounds,
  equipmentSelectionCounts,
  equipmentRestrictionIssues,
} from "./equipment-limits.js";
export function defaultChoices(tree, choices = {}) {
  if (!tree) return choices;
  if (tree.kind === "group" && tree.max === 1) {
    const selected =
      tree.children.find((n) => n.id === tree.default) ??
      (tree.min ? tree.children[0] : null);
    choices[tree.id] = selected?.id ?? "";
  }
  for (const n of tree.children ?? []) defaultChoices(n, choices);
  return choices;
}
export function defaultQuantities(tree, quantities = {}, choice = false) {
  if (!tree) return quantities;
  for (const child of tree.children ?? [])
    defaultQuantities(
      child,
      quantities,
      tree.kind === "group" && tree.max === 1,
    );
  if (tree.kind === "bundle" && tree.max !== null && !choice)
    quantities[tree.id] = tree.min;
  if (
    tree.kind === "group" &&
    tree.max !== 1 &&
    tree.children.every((n) => ["weapon", "bundle"].includes(n.kind))
  ) {
    let remaining =
      tree.min -
      tree.children.reduce((sum, n) => sum + (quantities[n.id] ?? n.min), 0);
    const children = [...tree.children].sort(
      (a, b) => Number(b.id === tree.default) - Number(a.id === tree.default),
    );
    for (const child of children) {
      if (remaining <= 0) break;
      const current = quantities[child.id] ?? child.min;
      const take = Math.min(
        remaining,
        (child.max ?? Math.max(1, child.min)) - current,
      );
      if (take > 0) quantities[child.id] = current + take;
      remaining -= take;
    }
  }
  return quantities;
}
export function newLoadout(unit, count) {
  const e = unit.equipment;
  if (!e?.tree) return null;
  const types = e.models.length ? e.models : [e.tree];
  const models = [];
  for (const t of types)
    for (let n = 0; n < t.min && models.length < count; n++)
      models.push({
        type: t.id,
        choices: defaultChoices(t),
        quantities: defaultQuantities(t),
      });
  while (models.length < count) {
    const t =
      types.find(
        (t) =>
          models.filter((m) => m.type === t.id).length <
            (e.models.length ? (t.max ?? count) : count) &&
          compositionIssues(unit, [...models, { type: t.id }], false).length ===
            0,
      ) ?? types[0];
    models.push({
      type: t.id,
      choices: defaultChoices(t),
      quantities: defaultQuantities(t),
    });
  }
  return { version: 1, models };
}
function compositionIssues(unit, models, checkMinimum = true) {
  if (!unit.equipment.models.length) return [];
  const issues = [];
  const counts = equipmentSelectionCounts(unit, models);
  function visit(n) {
    if (n.kind === "model") return [n.id];
    const ids = (n.children ?? []).flatMap(visit);
    if (n.kind === "group" && ids.length) {
      const bounds = equipmentBounds(n, counts);
      const count = models.filter((m) => ids.includes(m.type)).length;
      if (
        (checkMinimum && count < bounds.min) ||
        (bounds.max !== null && count > bounds.max)
      )
        issues.push(n.name + ": check model composition.");
    }
    return ids;
  }
  visit(unit.equipment.tree);
  return issues;
}
export function canSelectModel(unit, row, index, type) {
  const t = unit.equipment.models.find((t) => t.id === type);
  if (!t) return false;
  const models = row.loadout.models.map((m, i) =>
    i === index
      ? { type, choices: defaultChoices(t), quantities: defaultQuantities(t) }
      : m,
  );
  const bounds = equipmentBounds(t, equipmentSelectionCounts(unit, models));
  const counts = equipmentSelectionCounts(unit, models);
  return (
    (bounds.max === null ||
      models.filter((m) => m.type === type).length <= bounds.max) &&
    compositionIssues(unit, models, false).length === 0 &&
    unit.equipment.models.every((type) => {
      const minimum = equipmentBounds(type, counts).min;
      return models.filter((m) => m.type === type.id).length >= minimum;
    }) &&
    equipmentRestrictionIssues(unit, models).length === 0
  );
}
export function resizeLoadout(unit, row) {
  if (!row.loadout) return;
  const types = unit.equipment.models.length
    ? unit.equipment.models
    : [unit.equipment.tree];
  const models = row.loadout.models.slice(0, row.models);
  for (const t of types) {
    const minimum = () =>
      equipmentBounds(t, equipmentSelectionCounts(unit, models)).min;
    while (models.filter((m) => m.type === t.id).length < minimum()) {
      if (models.length >= row.models) {
        const index = models.findLastIndex(
          (m) =>
            models.filter((x) => x.type === m.type).length >
            equipmentBounds(
              types.find((x) => x.id === m.type),
              equipmentSelectionCounts(unit, models),
            ).min,
        );
        if (index < 0) break;
        models.splice(index, 1);
      }
      models.push({
        type: t.id,
        choices: defaultChoices(t),
        quantities: defaultQuantities(t),
      });
    }
  }
  while (models.length < row.models) {
    const t =
      types.find(
        (t) =>
          models.filter((m) => m.type === t.id).length <
            (unit.equipment.models.length
              ? (t.max ?? row.models)
              : row.models) &&
          compositionIssues(unit, [...models, { type: t.id }], false).length ===
            0,
      ) ?? types[0];
    models.push({
      type: t.id,
      choices: defaultChoices(t),
      quantities: defaultQuantities(t),
    });
  }
  row.loadout.models = models;
  row.wargear = loadoutCounts(unit, row.loadout);
}
export function loadoutCounts(unit, loadout) {
  const counts = {};
  const types = unit.equipment?.models?.length
    ? unit.equipment.models
    : [unit.equipment?.tree];
  function visit(n, m, selected = false) {
    if (!n) return;
    if (n.kind === "weapon") {
      const qty = m.quantities[n.id] ?? (selected ? Math.max(1, n.min) : n.min);
      if (qty) counts[n.id] = (counts[n.id] ?? 0) + qty;
      return;
    }
    if (n.kind === "group" && n.max === 1) {
      visit(
        n.children.find((c) => c.id === m.choices[n.id]),
        m,
        true,
      );
      return;
    }
    if (n.kind === "bundle" && n.max !== null) {
      const qty = m.quantities[n.id] ?? (selected ? Math.max(1, n.min) : n.min);
      for (let i = 0; i < qty; i++)
        for (const c of n.children ?? []) visit(c, m);
      return;
    }
    for (const c of n.children ?? []) visit(c, m);
  }
  for (const m of loadout?.models ?? [])
    visit(
      types.find((t) => t?.id === m.type),
      m,
    );
  return counts;
}
export function loadoutIssues(unit, row) {
  if (!unit.equipment?.tree) return ["Equipment choices need source review."];
  if (!row.loadout)
    return ["Legacy wargear: configure model equipment before sharing."];
  const issues = [
      ...unit.equipment.review,
      ...compositionIssues(unit, row.loadout.models),
      ...equipmentRestrictionIssues(unit, row.loadout.models),
    ],
    types = unit.equipment.models.length
      ? unit.equipment.models
      : [unit.equipment.tree];
  if (row.loadout.models.length !== row.models)
    issues.push("Equipment model count does not match the unit.");
  const selectionCounts = equipmentSelectionCounts(unit, row.loadout.models);
  if (unit.equipment.models.length)
    for (const t of types) {
      const bounds = equipmentBounds(
        t,
        equipmentSelectionCounts(unit, row.loadout.models),
      );
      const count = row.loadout.models.filter((m) => m.type === t.id).length;
      if (count < bounds.min || (bounds.max !== null && count > bounds.max))
        issues.push(t.name + ": check model composition.");
    }
  function visit(n, m, selected = false) {
    if (!n) {
      issues.push("Unknown model equipment.");
      return;
    }
    const bounds = equipmentBounds(n, selectionCounts);
    if (n.kind === "bundle" && n.max !== null) {
      const qty = m.quantities[n.id] ?? (selected ? Math.max(1, n.min) : n.min);
      if (qty < bounds.min || qty > bounds.max)
        issues.push(n.name + ": equipment quantity outside source bounds.");
      if (!qty) return;
    }
    if (n.kind === "weapon") {
      const q = m.quantities[n.id] ?? (selected ? Math.max(1, n.min) : n.min);
      if (
        !Number.isInteger(q) ||
        q < bounds.min ||
        q > (bounds.max ?? Math.max(1, bounds.min))
      )
        issues.push(n.name + ": equipment quantity outside source bounds.");
      return;
    }
    if (n.kind === "group" && n.max === 1) {
      const chosen = m.choices[n.id];
      if (!chosen && !bounds.min) return;
      if (chosen && bounds.max === 0)
        issues.push(n.name + ": selection limit exceeded.");
      const child = n.children.find((c) => c.id === chosen);
      if (!child) issues.push(n.name + ": choose one option.");
      else visit(child, m, true);
      return;
    }
    for (const c of n.children ?? []) visit(c, m);
    if (n.kind === "group") {
      const selected = (n.children ?? []).reduce(
        (sum, c) =>
          sum +
          (["weapon", "bundle"].includes(c.kind)
            ? (m.quantities[c.id] ?? c.min)
            : 1),
        0,
      );
      if (selected < bounds.min)
        issues.push(n.name + ": equipment selection is incomplete.");
      if (bounds.max !== null && selected > bounds.max)
        issues.push(n.name + ": selection limit exceeded.");
    }
  }
  for (const m of row.loadout.models)
    visit(
      types.find((t) => t.id === m.type),
      m,
    );
  return [...new Set(issues)];
}
export function validateLoadout(unit, row) {
  const l = row.loadout;
  if (!l) return;
  if (
    l.version !== 1 ||
    !Array.isArray(l.models) ||
    l.models.length !== row.models
  )
    throw Error("Invalid model loadout.");
  const weapons = new Map(),
    choiceIds = new Map();
  function walk(n) {
    if (!n) return;
    if (n.kind === "weapon" || (n.kind === "bundle" && n.max !== null))
      weapons.set(n.id, n);
    if (n.kind === "group" && n.max === 1)
      choiceIds.set(n.id, new Set(n.children.map((c) => c.id)));
    (n.children ?? []).forEach(walk);
  }
  walk(unit.equipment?.tree);
  const types = unit.equipment?.models?.length
    ? unit.equipment.models
    : [unit.equipment?.tree];
  for (const m of l.models) {
    if (
      !types.some((t) => t?.id === m.type) ||
      !m.choices ||
      !m.quantities ||
      Array.isArray(m.choices) ||
      Array.isArray(m.quantities)
    )
      throw Error("Invalid equipment model.");
    for (const [id, value] of Object.entries(m.choices))
      if (!choiceIds.has(id) || (value !== "" && !choiceIds.get(id).has(value)))
        throw Error("Unknown weapon choice.");
    for (const [id, q] of Object.entries(m.quantities)) {
      const weapon = weapons.get(id);
      if (
        !weapon ||
        !Number.isInteger(q) ||
        q < weapon.min ||
        q > (weapon.max ?? Math.max(1, weapon.min))
      )
        throw Error("Invalid equipment quantity.");
    }
  }
  // Incomplete composition is a review issue, not a reason to discard an in-progress save.
  const derived = loadoutCounts(unit, l);
  if (
    JSON.stringify(Object.entries(derived).sort()) !==
    JSON.stringify(
      Object.entries(row.wargear)
        .filter(([, q]) => q)
        .sort(),
    )
  )
    throw Error("Equipment counts do not match selected loadouts.");
}
