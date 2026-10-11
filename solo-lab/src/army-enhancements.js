export function enhancementAllowed(option, unit, army) {
  if (option?.type !== "enhancement" || unit?.categories?.includes("Epic Hero"))
    return false;
  return !!option.requiredDetachments?.some((id) => army.detachments.includes(id));
}

export function enhancementIssues(unit, row, army) {
  if (!row.enhancement) return [];
  const option = unit.options.find((option) => option.id === row.enhancement);
  if (!enhancementAllowed(option, unit, army))
    return [`${unit.name}: ${option?.name ?? "Enhancement"} is not available with your selected Detachments.`];
  return [];
}

export function enhancementBudget(army, data, excludeRow = null) {
  const choices = new Set();
  for (const row of army.units) {
    if (row.id === excludeRow?.id || !row.enhancement) continue;
    const option = data.units.find((unit) => unit.id === row.unitId)?.options.find((option) => option.id === row.enhancement);
    choices.add(option?.upgrade ? row.enhancement : row.id);
  }
  return { used: choices.size, max: army.battleSize === "incursion" ? 2 : 4 };
}

export function enhancementAvailability(option, unit, army, data, row) {
  if (!enhancementAllowed(option, unit, army))
    return { available: false, reason: "Unavailable" };
  const others = army.units.filter((entry) => entry.id !== row?.id && entry.enhancement === option.id);
  const cap = option.upgrade ? option.armyMax : 1;
  if (others.length >= cap)
    return { available: false, reason: `Army limit ${cap}/${cap}` };
  const budget = enhancementBudget(army, data, row);
  if (!(option.upgrade && others.length) && budget.used >= budget.max)
    return { available: false, reason: `Enhancement limit ${budget.max}/${budget.max}` };
  return { available: true, reason: "", count: others.length, max: cap };
}

export function armyEnhancementIssues(army, data) {
  const issues = [], counts = new Map();
  for (const row of army.units) {
    if (!row.enhancement) continue;
    const option = data.units.find((unit) => unit.id === row.unitId)?.options.find((option) => option.id === row.enhancement);
    if (!option) continue;
    const count = (counts.get(option.id)?.count ?? 0) + 1;
    counts.set(option.id, { option, count });
  }
  for (const { option, count } of counts.values()) {
    const cap = option.upgrade ? option.armyMax : 1;
    if (count > cap) issues.push(option.upgrade
      ? `${option.name}: ${count} selections exceeds the Upgrade limit of ${cap}.`
      : "Each Enhancement can only be selected once.");
  }
  const budget = enhancementBudget(army, data);
  if (budget.used > budget.max)
    issues.push(`Enhancements: ${budget.used}/${budget.max} choices; remove ${budget.used - budget.max}.`);
  return issues;
}
