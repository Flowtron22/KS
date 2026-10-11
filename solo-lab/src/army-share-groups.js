import { groupArmyItems } from "./army-groups.js";

export function armyShareGroups(units) {
  const ids = new Set(units.map((unit) => unit.id).filter(Boolean));
  const visited = new Set();
  function branch(unit, depth = 0) {
    if (visited.has(unit)) return [];
    visited.add(unit);
    return [
      { unit, depth },
      ...units
        .filter((child) => unit.id && child.attachmentId === unit.id)
        .flatMap((child) => branch(child, depth + 1)),
    ];
  }
  const roots = units.filter(
    (unit) => !unit.attachmentId || !ids.has(unit.attachmentId),
  );
  const clusters = roots.map((unit) => ({ unit, entries: branch(unit) }));
  // Invalid imported cycles still appear once, with their existing review notes.
  for (const unit of units)
    if (!visited.has(unit)) clusters.push({ unit, entries: branch(unit) });
  return groupArmyItems(clusters, (cluster) => cluster.unit.group ?? "other");
}
