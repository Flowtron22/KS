export const armyGroups = [
  { id: "epic-heroes", name: "Epic Heroes" },
  { id: "characters", name: "Characters" },
  { id: "battleline", name: "Battleline" },
  { id: "transports", name: "Dedicated Transports" },
  { id: "other", name: "Other Datasheets" },
  { id: "fortifications", name: "Fortifications" },
];

export function armyGroup(unit) {
  const categories = new Set([...(unit?.categories ?? []), unit?.role]);
  if (unit?.allied) {
    const explicit = [...categories].find((name) => name?.startsWith("Allies:"));
    const faction = [...categories].find((name) => name?.startsWith("Faction:"));
    const name = (explicit ?? faction)?.split(":").slice(1).join(":").trim()
      ?? unit.origin?.replace(/^(Imperium|Chaos|Xenos) - /, "") ?? "Other Allies";
    return "allies:" + (name === "Agents of the Imperium" ? "Imperial Agents" : name);
  }
  if (categories.has("Epic Hero")) return "epic-heroes";
  if (categories.has("Character")) return "characters";
  if (categories.has("Battleline")) return "battleline";
  if (categories.has("Dedicated Transport")) return "transports";
  if (categories.has("Fortification")) return "fortifications";
  return "other";
}

// Group references for display only: roster order determines escalating costs.
export function groupArmyItems(items, category = armyGroup) {
  const assigned = items.map((item) => ({ item, group: category(item) }));
  const allies = [...new Set(assigned.map((entry) => entry.group))]
    .filter((id) => id.startsWith("allies:"))
    .sort()
    .map((id) => ({ id, name: "Allies: " + id.slice(7) }));
  return [...armyGroups, ...allies]
    .map((group) => ({
      ...group,
      items: assigned.filter((entry) => entry.group === group.id).map((entry) => entry.item),
    }))
    .filter((group) => group.items.length);
}
