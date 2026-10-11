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
