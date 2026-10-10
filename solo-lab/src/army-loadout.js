// Equipment choices are scoped to individual models; counts are derived, never free-form.
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
export function newLoadout(unit, count) {
  const e = unit.equipment;
  if (!e?.tree) return null;
  const types = e.models.length ? e.models : [e.tree];
  const models = [];
  for (const t of types)
    for (let n = 0; n < t.min && models.length < count; n++)
      models.push({ type: t.id, choices: defaultChoices(t), quantities: {} });
  while (models.length < count) {
    const t =
      types.find(
        (t) =>
          models.filter((m) => m.type === t.id).length <
            (e.models.length ? (t.max ?? count) : count) &&
          compositionIssues(unit, [...models, { type: t.id }], false).length ===
            0,
      ) ?? types[0];
    models.push({ type: t.id, choices: defaultChoices(t), quantities: {} });
  }
  return { version: 1, models };
}
function compositionIssues(unit, models, checkMinimum = true) {
  if (!unit.equipment.models.length) return [];
  const issues = [];
  function visit(n) {
    if (n.kind === "model") return [n.id];
    const ids = (n.children ?? []).flatMap(visit);
    if (n.kind === "group" && ids.length) {
      const count = models.filter((m) => ids.includes(m.type)).length;
      if ((checkMinimum && count < n.min) || (n.max !== null && count > n.max))
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
  const models = row.loadout.models.map((m, i) => (i === index ? { type } : m));
  return (
    (t.max === null || models.filter((m) => m.type === type).length <= t.max) &&
    compositionIssues(unit, models, false).length === 0
  );
}
export function resizeLoadout(unit, row) {
  if (!row.loadout) return;
  const types = unit.equipment.models.length
    ? unit.equipment.models
    : [unit.equipment.tree];
  const models = row.loadout.models.slice(0, row.models);
  for (const t of types) {
    while (models.filter((m) => m.type === t.id).length < t.min) {
      if (models.length >= row.models) {
        const index = models.findLastIndex(
          (m) =>
            models.filter((x) => x.type === m.type).length >
            (types.find((x) => x.id === m.type)?.min ?? 0),
        );
        if (index < 0) break;
        models.splice(index, 1);
      }
      models.push({ type: t.id, choices: defaultChoices(t), quantities: {} });
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
    models.push({ type: t.id, choices: defaultChoices(t), quantities: {} });
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
    ],
    types = unit.equipment.models.length
      ? unit.equipment.models
      : [unit.equipment.tree];
  if (row.loadout.models.length !== row.models)
    issues.push("Equipment model count does not match the unit.");
  if (unit.equipment.models.length)
    for (const t of types) {
      const count = row.loadout.models.filter((m) => m.type === t.id).length;
      if (count < t.min || (t.max !== null && count > t.max))
        issues.push(t.name + ": check model composition.");
    }
  function visit(n, m, selected = false) {
    if (!n) {
      issues.push("Unknown model equipment.");
      return;
    }
    if (n.kind === "weapon") {
      const q = m.quantities[n.id] ?? (selected ? Math.max(1, n.min) : n.min);
      if (
        !Number.isInteger(q) ||
        q < n.min ||
        q > (n.max ?? Math.max(1, n.min))
      )
        issues.push(n.name + ": equipment quantity outside source bounds.");
      return;
    }
    if (n.kind === "group" && n.max === 1) {
      const chosen = m.choices[n.id];
      if (!chosen && !n.min) return;
      const child = n.children.find((c) => c.id === chosen);
      if (!child) issues.push(n.name + ": choose one option.");
      else visit(child, m, true);
      return;
    }
    for (const c of n.children ?? []) visit(c, m);
    if (n.kind === "group") {
      const selected = (n.children ?? []).reduce(
        (sum, c) =>
          sum + (c.kind === "weapon" ? (m.quantities[c.id] ?? c.min) : 1),
        0,
      );
      if (selected < n.min)
        issues.push(n.name + ": equipment selection is incomplete.");
      if (n.max !== null && selected > n.max)
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
    if (n.kind === "weapon") weapons.set(n.id, n);
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
