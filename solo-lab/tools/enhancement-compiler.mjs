// Preserve Boolean bearer restrictions instead of guessing from Enhancement names.
export function compileEnhancementBearer(nodes, map) {
  const hiddenWhen = [], review = new Set();
  const descriptions = nodes.flatMap((node) => [
    ...(node.profiles ?? []),
    ...(node.infoLinks ?? []).map((link) => map.get(link.targetId)).filter(Boolean),
  ]).flatMap((profile) => profile.characteristics ?? []).filter((characteristic) => characteristic.name === "Description").map((characteristic) => (characteristic.$text ?? "").replace(/[*^_]/g, ""));
  const bearerText = descriptions.map((text) => text.match(/^([^.!\n]+?) (?:model|unit)s? only\./i)?.[1]).find(Boolean);
  if (bearerText && !/\bor\b|\bexcluding\b|\bwith\b/i.test(bearerText))
    hiddenWhen.push({ keyword: bearerText.trim(), not: true });
  function condition(rule) {
    if (!["ancestor", "root-entry"].includes(rule.scope) ||
      !["instanceOf", "notInstanceOf"].includes(rule.type)) return null;
    const reference = map.get(rule.childId);
    const name = reference?.name ?? rule.childName ?? bearerText;
    if (!name) {
      review.add("Enhancement bearer restriction needs source review.");
      return null;
    }
    return { keyword: name, unitId: rule.childId, not: rule.type === "notInstanceOf" };
  }
  function group(rule) {
    const clauses = [...(rule.conditions ?? []).map(condition), ...(rule.conditionGroups ?? []).map(group)];
    if (!clauses.length || (rule.type !== "or" && clauses.includes(null))) return null;
    const applicable = clauses.filter(Boolean);
    if (!applicable.length) return null;
    return { mode: rule.type === "or" ? "any" : "all", clauses: applicable };
  }
  for (const node of nodes) {
    for (const modifier of node.modifiers ?? []) {
      if (modifier.field !== "hidden" || modifier.type !== "set" || ![true, "true"].includes(modifier.value)) continue;
      const expression = group({ ...modifier, type: "and" });
      if (expression) hiddenWhen.push(expression);
    }
  }
  return { hiddenWhen, review: [...review] };
}
