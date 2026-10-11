import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { enhancementAllowed } from "../src/army-enhancements.js";
import { newArmy, addUnit, armySummary } from "../src/army-core.js";
import { armyValidation } from "../src/army-export.js";

async function catalogue(name) {
  return JSON.parse(await readFile(new URL(`../public/armies/${name}.json`, import.meta.url), "utf8"));
}

test("Knight Enhancements inherit the parent Detachment restriction and follow changes", async () => {
  const data = await catalogue("imperial-knights");
  const army = newArmy(data);
  const unit = data.units.find((unit) => unit.name === "Knight Crusader");
  const row = addUnit(army, unit);
  const freeblade = data.detachments.find((entry) => entry.name === "Freeblade Company");
  const valourstrike = data.detachments.find((entry) => entry.name === "Valourstrike Lance");
  const guardian = unit.options.find((entry) => entry.name === "Mysterious Guardian");
  const sigil = unit.options.find((entry) => entry.name === "Bearer of the Lancer's Sigil");
  assert.deepEqual(guardian.requiredDetachments, [freeblade.id]);
  assert.equal(enhancementAllowed(guardian, unit, army), false);
  army.detachments = [freeblade.id];
  assert.equal(enhancementAllowed(guardian, unit, army), true);
  assert.equal(enhancementAllowed(sigil, unit, army), false);
  row.enhancement = guardian.id;
  army.detachments = [valourstrike.id];
  assert.ok(armyValidation(army, armySummary(army, data)).errors.some((issue) => issue.includes("Mysterious Guardian")));
  row.enhancement = null;
  assert.ok(!armySummary(army, data).issues.some((issue) => issue.includes("Mysterious Guardian")));
});

test("Multiple selected Detachments grant their own Enhancements; duplicates are errors", async () => {
  const data = await catalogue("imperial-knights");
  const army = newArmy(data);
  const unit = data.units.find((unit) => unit.name === "Knight Crusader");
  army.detachments = data.detachments.filter((entry) => ["Valourstrike Lance", "Dominus Foebreakers"].includes(entry.name)).map((entry) => entry.id);
  const enhancement = unit.options.find((entry) => entry.name === "Augury Halo");
  assert.equal(enhancementAllowed(enhancement, unit, army), false);
  for (const name of ["Bearer of the Iron Chalice", "Blessed Plate"])
    assert.equal(enhancementAllowed(unit.options.find((entry) => entry.name === name), unit, army), true);
  const option = unit.options.find((entry) => entry.name === "Bearer of the Iron Chalice");
  addUnit(army, unit).enhancement = option.id;
  addUnit(army, unit).enhancement = option.id;
  assert.ok(armySummary(army, data).issues.includes("Each Enhancement can only be selected once."));
  assert.equal(enhancementAllowed(option, { categories: ["Epic Hero"] }, army), false);
});

test("Chaos equal-to-zero and Space Marine parent/name references retain Detachment gates", async () => {
  for (const [faction, name, detachment] of [["chaos-knights", "Malevolent Heraldry", "Traitoris Lance"], ["space-marines", "Liberator", "Armoured Speartip"]]) {
    const data = await catalogue(faction);
    const option = data.units.flatMap((unit) => unit.options).find((entry) => entry.type === "enhancement" && entry.name === name);
    assert.ok(option.requiredDetachments.includes(data.detachments.find((entry) => entry.name === detachment).id));
  }
});
