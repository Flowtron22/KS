function compare(count, condition) {
  return (
    {
      atLeast: count >= condition.value,
      atMost: count <= condition.value,
      lessThan: count < condition.value,
      greaterThan: count > condition.value,
      equalTo: count === condition.value,
    }[condition.type] ?? false
  );
}
export function equipmentSelectionCounts(unit, models) {
  const counts = {};
  const add = (id, value) => {
    if (id) counts[id] = (counts[id] ?? 0) + value;
  };
  function composition(n) {
    if (!n) return [];
    const ids =
      n.kind === "model" ? [n.id] : (n.children ?? []).flatMap(composition);
    if (ids.length) {
      const count = models.filter((m) => ids.includes(m.type)).length;
      counts[n.id] = count;
      if (n.sourceId) counts[n.sourceId] = count;
    }
    return ids;
  }
  composition(unit.equipment.tree);
  const types = unit.equipment.models.length
    ? unit.equipment.models
    : [unit.equipment.tree];
  function weapons(n, m, selected = false) {
    if (!n) return;
    if (n.kind === "weapon") {
      const qty =
        m.quantities?.[n.id] ?? (selected ? Math.max(1, n.min) : n.min);
      add(n.id, qty);
      if (n.sourceId !== n.id) add(n.sourceId, qty);
    } else if (n.kind === "group" && n.max === 1) {
      weapons(
        n.children.find((c) => c.id === m.choices?.[n.id]),
        m,
        true,
      );
    } else if (n.kind === "bundle" && n.max !== null) {
      const qty =
        m.quantities?.[n.id] ?? (selected ? Math.max(1, n.min) : n.min);
      for (let i = 0; i < qty; i++)
        (n.children ?? []).forEach((c) => weapons(c, m));
    } else (n.children ?? []).forEach((c) => weapons(c, m));
  }
  for (const model of models)
    weapons(
      types.find((t) => t.id === model.type),
      model,
    );
  counts[unit.id] = models.length;
  return counts;
}
export function equipmentBounds(node, counts) {
  const bounds = { min: node.min, max: node.max };
  for (const rule of node.boundsRules ?? []) {
    if (!rule.conditions.every((q) => compare(counts[q.id] ?? 0, q))) continue;
    const value =
      rule.value *
      (rule.repeat
        ? Math.floor((counts[rule.repeat.id] ?? 0) / rule.repeat.every)
        : 1);
    if (rule.type === "set") bounds[rule.bound] = value;
    else if (bounds[rule.bound] !== null)
      bounds[rule.bound] += rule.type === "decrement" ? -value : value;
  }
  return bounds;
}
export function equipmentRestrictionIssues(unit, models) {
  const counts = equipmentSelectionCounts(unit, models);
  return (unit.equipment.restrictions ?? []).flatMap((rule) => {
    if (rule.conditions)
      return rule.conditions.every((q) => compare(counts[q.id] ?? 0, q))
        ? [rule.message]
        : [];
    return (counts[rule.id] ?? 0) > rule.max
      ? [`${rule.name}: maximum ${rule.max} per unit.`]
      : [];
  });
}
