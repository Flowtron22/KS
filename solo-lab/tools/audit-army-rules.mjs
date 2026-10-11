import { readFile, writeFile } from "node:fs/promises";
const armyDir = new URL("../public/armies/", import.meta.url);
const index = JSON.parse(await readFile(new URL("index.json", armyDir), "utf8"));
const factions = [];
for (const entry of index.factions) {
  const data = JSON.parse(await readFile(new URL(entry.file, armyDir), "utf8"));
  const units = data.units.filter((unit) => !unit.allied && !unit.legend && !unit.narrative);
  const enhancements = [...new Map(units.flatMap((unit) => unit.options.filter((option) => option.type === "enhancement")).map((option) => [option.id, option])).values()];
  factions.push({
    faction: data.name,
    units: units.length,
    equipment: units.filter((unit) => unit.equipment).length,
    equipmentRequiringReview: units.filter((unit) => unit.equipment?.review.length).map((unit) => unit.name),
    enhancements: enhancements.length,
    enhancementsRequiringReview: enhancements.filter((option) => !option.requiredDetachments.length || option.bearer?.review.length).map((option) => option.name),
    attachments: units.filter((unit) => unit.attachment).length,
    attachmentsRequiringReview: units.filter((unit) => unit.attachment && (!unit.attachment.targets.length || unit.attachment.review.length)).map((unit) => unit.name),
    freshnessReview: data.ruleReview ?? [],
  });
}
const report = {
  auditedOn: "2026-10-12",
  description: "Structural coverage audit of the pinned community snapshot. Counts measure compiler support, not official-rule certification. Per-unit review may also depend on the selected loadout.",
  source: "BSData/wh40k-11e cc58ee3b2c23f90af9d00e7bf234cd703b762299",
  liveSourceChecked: "3988a8bdd210f9d31ea5b6782d0016688ccb6815 (10 October 2026); Custodes still retains old squad composition",
  factions,
};
await writeFile(new URL("../../research/army-rules-audit.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(`${factions.length} catalogues audited; ${factions.reduce((sum, faction) => sum + faction.units, 0)} non-Legends, non-narrative native unit entries. See research/army-rules-audit.json.`);
