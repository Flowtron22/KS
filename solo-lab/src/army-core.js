import {
  newLoadout,
  loadoutCounts,
  loadoutIssues,
  validateLoadout,
} from "./army-loadout.js";
import { modelCountAllowed, unitCopyLimit } from "./unit-limits.js";
import { attachmentIssues } from "./army-attachments.js";
export const PACK = "40k-11e-cc58ee3";
export function newArmy(faction) {
  return {
    schema: 1,
    pack: PACK,
    id: crypto.randomUUID(),
    name: `${faction.name} army`,
    faction: faction.id,
    limit: 2000,
    battleSize: "strike",
    detachments: [],
    disposition: "",
    units: [],
  };
}
export function addUnit(army, unit) {
  const row = {
    id: crypto.randomUUID(),
    unitId: unit.id,
    models: unit.models.min,
    warlord: false,
    attachment: null,
    enhancement: null,
    wargear: {},
    notes: "",
    pointsOverride: null,
  };
  row.loadout = newLoadout(unit, row.models);
  if (row.loadout) row.wargear = loadoutCounts(unit, row.loadout);
  army.units.push(row);
  return row;
}
function compare(q, n) {
  return (
    {
      atLeast: n >= q.value,
      greaterThan: n > q.value,
      atMost: n <= q.value,
      lessThan: n < q.value,
      equalTo: n === q.value,
    }[q.type] ?? false
  );
}
export function unitPoints(unit, row, army) {
  let value = unit.points;
  for (const r of unit.priceRules)
    if (r.conditions.every((q) => compare(q, row.models))) {
      if (r.type === "set") value = r.value;
      else if (r.type === "increment" && value !== null) value += r.value;
    }
  if (army && value !== null) {
    const index = army.units.indexOf(row);
    const previous = army.units
      .slice(0, Math.max(0, index))
      .filter((r) => r.unitId === row.unitId).length;
    for (const rule of unit.duplicatePriceRules ?? [])
      value += Math.floor(previous / rule.every) * rule.value;
  }
  if (row.pointsOverride !== null) value = row.pointsOverride;
  if (value === null) return null;
  if (row.enhancement)
    value +=
      unit.options.find(
        (o) => o.id === row.enhancement && o.type === "enhancement",
      )?.points ?? 0;
  for (const [id, count] of Object.entries(row.wargear))
    value +=
      (unit.options.find(
        (o) => o.id === id && ["weapon", "equipment"].includes(o.type),
      )?.points ?? 0) * count;
  return value;
}
export function armySummary(army, data) {
  let total = 0,
    unknown = 0;
  const issues = attachmentIssues(army, data),
    budget = army.battleSize === "incursion" ? 2 : 3,
    counts = new Map(),
    dp = army.detachments.reduce(
      (n, id) => n + (data.detachments.find((d) => d.id === id)?.dp ?? 0),
      0,
    );
  for (const row of army.units) {
    const unit = data.units.find((u) => u.id === row.unitId);
    if (!unit) {
      issues.push("A unit is missing from this catalogue.");
      continue;
    }
    issues.push(
      ...loadoutIssues(unit, row).map((issue) =>
        issue.startsWith(unit.name + ":") ? issue : unit.name + ": " + issue,
      ),
    );
    const pts = unitPoints(unit, row, army);
    if (pts === null) {
      unknown++;
      issues.push(`${unit.name}: unit points need review.`);
    } else total += pts;
    counts.set(unit.id, (counts.get(unit.id) ?? 0) + 1);
    if (!modelCountAllowed(unit, row.models))
      issues.push(`${unit.name}: model count is outside the source range.`);
    if (unit.conditionalPrice && row.pointsOverride === null)
      issues.push(`${unit.name}: conditional points need review.`);
    if (unit.allied)
      issues.push(`${unit.name}: check allied-unit eligibility.`);
  }
  if (total > army.limit)
    issues.unshift(`${total - army.limit} points over the limit.`);
  if (!army.units.length) issues.push("Add units to your army.");
  if (!data.auxiliary && !army.detachments.length)
    issues.push("Choose your Detachments.");
  if (dp > budget)
    issues.push(`${dp - budget} Detachment Points over the budget.`);
  const allowed = [
    ...new Set(
      army.detachments.flatMap(
        (id) => data.detachments.find((d) => d.id === id)?.dispositions ?? [],
      ),
    ),
  ];
  if (army.detachments.length && !allowed.includes(army.disposition))
    issues.push("Choose a Force Disposition granted by your Detachments.");
  const warlords = army.units.filter((u) => u.warlord);
  if (warlords.length !== 1) issues.push("Choose one Warlord.");
  for (const r of warlords) {
    const u = data.units.find((u) => u.id === r.unitId);
    if (!u?.categories.includes("Character"))
      issues.push("Your Warlord must be a Character.");
  }
  for (const [id, n] of counts) {
    const u = data.units.find((u) => u.id === id),
      cap = unitCopyLimit(u, army);
    if (n > cap)
      issues.push(`${u.name}: ${n} copies exceeds the basic limit of ${cap}.`);
  }
  if (
    army.units.filter((r) => r.enhancement).length >
    (army.battleSize === "incursion" ? 2 : 4)
  )
    issues.push(
      "Enhancement count exceeds the basic battle-size limit; Upgrade grouping needs manual review.",
    );
  return { total, unknown, dp, budget, allowed, issues: [...new Set(issues)] };
}
export function validateArmy(value, data) {
  if (
    !value ||
    value.schema !== 1 ||
    value.pack !== PACK ||
    value.faction !== data.id
  )
    throw Error("This army uses a different faction or data snapshot.");
  if (
    typeof value.name !== "string" ||
    value.name.length > 100 ||
    !Number.isInteger(value.limit) ||
    value.limit < 1 ||
    value.limit > 100000 ||
    !["incursion", "strike"].includes(value.battleSize)
  )
    throw Error("Invalid army settings.");
  if (
    !Array.isArray(value.units) ||
    value.units.length > 200 ||
    !Array.isArray(value.detachments) ||
    value.detachments.some(
      (id) => !data.detachments.some((d) => d.id === id),
    ) ||
    new Set(value.detachments).size !== value.detachments.length
  )
    throw Error("Invalid Detachments or army size.");
  const ids = new Set();
  for (const row of value.units) {
    const u = data.units.find((u) => u.id === row.unitId);
    if (
      !u ||
      typeof row.id !== "string" ||
      ids.has(row.id) ||
      !modelCountAllowed(u, row.models) ||
      typeof row.warlord !== "boolean" ||
      typeof row.notes !== "string" ||
      row.notes.length > 2000
    )
      throw Error("Invalid unit configuration.");
    ids.add(row.id);
    validateLoadout(u, row);
    if (
      row.pointsOverride !== null &&
      (!Number.isInteger(row.pointsOverride) ||
        row.pointsOverride < 0 ||
        row.pointsOverride > 100000)
    )
      throw Error("Invalid points override.");
    if (
      row.enhancement &&
      !u.options.some(
        (o) => o.type === "enhancement" && o.id === row.enhancement,
      )
    )
      throw Error("Unknown Enhancement.");
    if (
      !row.wargear ||
      typeof row.wargear !== "object" ||
      Array.isArray(row.wargear) ||
      Object.entries(row.wargear).some(
        ([id, n]) =>
          !u.options.some(
            (o) => ["weapon", "equipment"].includes(o.type) && o.id === id,
          ) ||
          !Number.isInteger(n) ||
          n < 0 ||
          n > 100,
      )
    )
      throw Error("Invalid wargear.");
  }
  for (const r of value.units)
    if (
      r.attachment !== null &&
      (!ids.has(r.attachment) || r.attachment === r.id)
    )
      throw Error("Invalid attachment.");
  return structuredClone(value);
}
