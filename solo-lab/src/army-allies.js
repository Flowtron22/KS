const faction = (unit) => unit.categories.find((category) => category.startsWith("Faction:"))?.slice(8).trim();
const forgepactUnits = new Set(["Tech-Priest Dominus", "Tech-Priest Manipulus", "Skitarii Marshal", "Skitarii Rangers", "Skitarii Vanguard"]);

// Implement explicit permissions only. Other ally systems keep their source review.
export function armyAllyIssues(army, data, points) {
  const entries = army.units.map((row) => ({ row, unit: data.units.find((unit) => unit.id === row.unitId) })).filter((entry) => entry.unit);
  const issues = [], unresolved = [];
  const forgepact = data.name === "Imperial Knights" && army.detachments.some((id) => data.detachments.find((entry) => entry.id === id)?.name === "Questor Forgepact");
  const mechanicus = [], agents = [];
  for (const entry of entries.filter((entry) => entry.unit.allied)) {
    if (data.name === "Imperial Knights" && faction(entry.unit) === "Adeptus Mechanicus") {
      if (!forgepact || !forgepactUnits.has(entry.unit.name))
        issues.push(`${entry.unit.name}: requires Questor Forgepact and a permitted Mechanicus datasheet.`);
      else mechanicus.push(entry);
      if (entry.row.warlord) issues.push(`${entry.unit.name}: a Mechanicus ally cannot be your Warlord.`);
    } else if (["Agents of the Imperium", "Imperial Agents"].includes(faction(entry.unit)) && data.name !== "Agents of the Imperium") agents.push(entry);
    else unresolved.push(entry);
  }
  if (agents.length) {
    if (!entries.every(({ unit }) => unit.categories.includes("Imperium")))
      issues.push("Assigned Agents requires every model in your army to have the Imperium keyword.");
    const cap = army.battleSize === "incursion" ? 1 : 2;
    const count = (keyword) => agents.filter(({ unit }) => unit.categories.includes(keyword)).length;
    const inquisitors = count("Inquisitor");
    const voidfarers = agents.filter(({ unit }) => unit.categories.includes("Character") && unit.categories.includes("Voidfarers")).length;
    const retinue = count("Retinue") - Math.min(inquisitors, agents.filter(({ unit }) => unit.name === "Inquisitorial Agents").length) - Math.min(voidfarers, agents.filter(({ unit }) => unit.name === "Voidsmen-at-Arms").length);
    for (const [name, used, max] of [["Characters", count("Character"), cap], ["Retinue", retinue, cap], ["Requisitioned", count("Requisitioned"), 1]])
      if (used > max) issues.push(`Assigned Agents: ${name} ${used}/${max}.`);
    for (const entry of agents) {
      if (entry.unit.categories.includes("Dedicated Transport"))
        issues.push(`${entry.unit.name}: allied transport must start with an embarked unit; embarkation needs source review.`);
      else if (!["Character", "Retinue", "Requisitioned"].some((keyword) => entry.unit.categories.includes(keyword)))
        unresolved.push(entry);
    }
  }
  if (mechanicus.length) {
    const total = mechanicus.reduce((total, entry) => total + (points(entry.unit, entry.row, army) ?? 0), 0);
    // Current May 2026 rules state 500 points, unlike the earlier 10e scale.
    if (total > 500) issues.push(`Questor Forgepact: Mechanicus allies ${total}/500 points.`);
  }
  for (const { unit } of unresolved) issues.push(`${unit.name}: check allied-unit eligibility.`);
  return issues;
}
