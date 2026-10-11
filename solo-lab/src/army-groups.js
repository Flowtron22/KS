export const armyGroups = [
  { id: "characters", name: "Characters" },
  { id: "battleline", name: "Battleline" },
  { id: "transports", name: "Dedicated Transports" },
  { id: "other", name: "Other Datasheets" },
];

export function armyGroup(unit) {
  const categories = new Set([...(unit?.categories ?? []), unit?.role]);
  if (categories.has("Character")) return "characters";
  if (categories.has("Battleline")) return "battleline";
  if (categories.has("Dedicated Transport")) return "transports";
  return "other";
}

// Group references for display only: roster order determines escalating costs.
export function groupArmyItems(items, category = armyGroup) {
  return armyGroups
    .map((group) => ({
      ...group,
      items: items.filter((item) => category(item) === group.id),
    }))
    .filter((group) => group.items.length);
}
