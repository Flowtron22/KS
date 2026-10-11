import { matchesUnitKeywords } from "./unit-keywords.js";
export function enhancementAllowed(option, unit, army) {
  if (option?.type !== "enhancement" || unit?.categories?.includes("Epic Hero"))
    return false;
  if (!option.upgrade && !unit?.categories?.includes("Character")) return false;
  function matches(rule) {
    if (rule.clauses) return rule.mode === "any" ? rule.clauses.some(matches) : rule.clauses.every(matches);
    const present = (rule.unitId && unit.id === rule.unitId) || matchesUnitKeywords(unit, rule.keyword);
    return rule.not ? !present : present;
  }
  if (option.bearer?.hiddenWhen.some(matches) || option.bearer?.review.length) return false;
  return !!option.requiredDetachments?.some((id) => army.detachments.includes(id));
}

export function attachedEnhancementIssues(army, data) {
  const rows = new Map(army.units.map((row) => [row.id, row]));
  const groups = new Map();
  for (const row of army.units) {
    let root = row;
    const seen = new Set([row.id]);
    while (root.attachment && rows.has(root.attachment) && !seen.has(root.attachment)) {
      root = rows.get(root.attachment);
      seen.add(root.id);
    }
    if (!groups.has(root.id)) groups.set(root.id, []);
    groups.get(root.id).push(row);
  }
  const issues = [];
  for (const [id, members] of groups) {
    const root = rows.get(id);
    const unit = data.units.find((unit) => unit.id === root.unitId);
    const max = unit?.attachedEnhancementMax ?? 1;
    const count = members.filter((row) => row.enhancement).length;
    if (count > max) issues.push(`${unit?.name ?? "Attached unit"}: attached unit Enhancement limit ${count}/${max}.`);
  }
  return issues;
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
  const candidate = { ...army, units: army.units.map((entry) => entry.id === row?.id ? { ...entry, enhancement: option.id } : entry) };
  const previous = new Set(attachedEnhancementIssues(army, data));
  if (attachedEnhancementIssues(candidate, data).some((issue) => !previous.has(issue)))
    return { available: false, reason: "Attached unit Enhancement limit" };
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
