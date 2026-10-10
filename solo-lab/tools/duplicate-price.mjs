// Recognize only the source's ordered, same-datasheet duplicate surcharge.
export function duplicatePriceRule(modifier, unitId) {
  if (modifier.type !== "increment" || !Number.isFinite(modifier.value) ||
      modifier.conditions || modifier.repeats || modifier.conditionGroups?.length !== 1) return null;
  const group = modifier.conditionGroups[0];
  if (group.type !== "and" || group.conditions || group.conditionGroups ||
      group.localConditionGroups?.length !== 1) return null;
  const local = group.localConditionGroups[0];
  if (local.field !== "selections" || local.scope !== "parent" ||
      local.type !== "atLeast" || local.repeats !== 1 ||
      !Number.isInteger(local.value) || local.value < 1 ||
      local.conditions?.length !== 2) return null;
  const before = local.conditions.find(q => q.type === "before");
  const same = local.conditions.find(q => q.type === "instanceOf");
  if (before?.scope !== "self" || before.childId !== "any" || before.value !== 1 ||
      same?.scope !== "self" || same.childId !== unitId || same.value !== 1) return null;
  return { value: modifier.value, every: local.value };
}
