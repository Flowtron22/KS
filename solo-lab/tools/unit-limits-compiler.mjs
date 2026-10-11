const incursionId = "d62d-db22-4893-4bc0";
export function compileCopyLimits(unit, map) {
  const constraints = (unit.constraints ?? []).filter(
    (c) =>
      c.field === "selections" &&
      c.type === "max" &&
      ["force", "roster"].includes(c.scope),
  );
  if (!constraints.length) return undefined;
  const cap = Math.min(...constraints.map((c) => c.value));
  const result = { strike: cap, incursion: cap, detachments: [] };
  for (const modifier of unit.modifiers ?? []) {
    if (
      !constraints.some((c) => c.id === modifier.field) ||
      modifier.type !== "set" ||
      modifier.repeats ||
      modifier.conditionGroups ||
      !modifier.conditions?.length
    )
      continue;
    const conditions = modifier.conditions;
    if (
      !conditions.every(
        (q) =>
          q.field === "selections" &&
          q.type === "atLeast" &&
          q.value === 1 &&
          ["force", "roster"].includes(q.scope),
      )
    )
      continue;
    if (conditions.length === 1 && conditions[0].childId === incursionId)
      result.incursion = modifier.value;
    else if (
      conditions.every((q) =>
        map
          .get(q.childId)
          ?.costs?.some((c) => c.name === "Detachment Points" && c.value > 0),
      )
    )
      result.detachments.push({
        ids: conditions.map((q) => q.childId),
        max: modifier.value,
      });
  }
  return result;
}
