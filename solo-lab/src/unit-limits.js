export function modelRange(unit) {
  return { min: unit.models.min, max: unit.models.max };
}

export function modelCountAllowed(unit, count) {
  const { min, max } = modelRange(unit);
  return Number.isInteger(count) && count >= min && count <= max;
}

export function unitCopyLimit(unit, army) {
  if (unit.categories.includes("Epic Hero")) return 1;
  const size = army.battleSize === "incursion" ? "incursion" : "strike";
  const basic =
    (size === "incursion" ? 2 : 3) *
    (unit.categories.includes("Battleline") ||
    unit.categories.includes("Dedicated Transport")
      ? 2
      : 1);
  let cap = unit.copyLimits?.[size] ?? basic;
  for (const rule of unit.copyLimits?.detachments ?? [])
    if (rule.ids.every((id) => army.detachments.includes(id))) cap = rule.max;
  return cap;
}

export function unitAvailability(unit, army) {
  const count = army.units.filter((row) => row.unitId === unit.id).length;
  const max = unitCopyLimit(unit, army);
  return { count, max, available: count < max };
}

export function combatModelMax(unit, scenarioUnit, experiment = false) {
  if (experiment) return 100;
  // The explicitly selected September Guard profile has its own squad size.
  return scenarioUnit.guardCodex ? 3 : Math.min(100, modelRange(unit).max);
}

export function constrainCombatModels(unit, scenarioUnit, experiment = false) {
  const max = combatModelMax(unit, scenarioUnit, experiment);
  const allBearers = scenarioUnit.bearers === scenarioUnit.models;
  scenarioUnit.models = Math.max(1, Math.min(max, scenarioUnit.models));
  scenarioUnit.bearers = allBearers
    ? scenarioUnit.models
    : Math.min(scenarioUnit.bearers, scenarioUnit.models);
}
