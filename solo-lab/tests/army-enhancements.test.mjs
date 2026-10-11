import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { enhancementAllowed, enhancementAvailability, enhancementBudget, armyEnhancementIssues } from "../src/army-enhancements.js";
import { newArmy, addUnit, armySummary } from "../src/army-core.js";
import { armyValidation } from "../src/army-export.js";
import { matchesUnitKeywords } from "../src/unit-keywords.js";
import { equipmentView } from "../src/army-equipment-view.js";

async function catalogue(name) {
  return JSON.parse(await readFile(new URL(`../public/armies/${name}.json`, import.meta.url), "utf8"));
}

test("Slash bearer alternatives restore Cybork Boosta without weakening Detachment or bearer limits", async () => {
  const data = await catalogue("orks"), army = newArmy(data);
  const dreadMob = data.detachments.find((entry) => entry.name === "Dread Mob");
  for (const name of ["Big Mek", "Big Mek Dakkarig", "Big Mek with Shokk Attack Gun", "Mek"]) {
    const unit = data.units.find((entry) => entry.name === name);
    const option = unit.options.find((entry) => entry.name === "Cybork Boosta");
    assert.ok(option, name);
    army.detachments = [];
    assert.equal(enhancementAllowed(option, unit, army), false, name);
    army.detachments = [dreadMob.id];
    assert.equal(enhancementAllowed(option, unit, army), true, name);
  }
  const warboss = data.units.find((entry) => entry.name === "Warboss");
  assert.equal(enhancementAllowed(warboss.options.find((entry) => entry.name === "Cybork Boosta"), warboss, army), false);
  assert.equal(matchesUnitKeywords({name:"Other",categories:["Big Mek Dakkarig"]}, "BIG MEK/MEK"), false);
});

test("Slash Upgrade alternatives remain unit-specific", async () => {
  const data = await catalogue("orks"), army = newArmy(data);
  army.detachments = [data.detachments.find((entry) => entry.name === "Taktikal Brigade").id];
  for (const name of ["Kommandos", "Stormboyz", "Boyz"]) {
    const unit = data.units.find((entry) => entry.name === name);
    const option = unit.options.find((entry) => entry.name === "Throat-slittas");
    assert.equal(enhancementAllowed(option, unit, army), name !== "Boyz", name);
  }
});

test("Big Mek equipment exposes both replacement groups and fixed Dakkarig weapons", async () => {
  const data = await catalogue("orks"), army = newArmy(data);
  const mek = data.units.find((entry) => entry.name === "Big Mek");
  const html = equipmentView(mek, addUnit(army, mek));
  for (const name of ["Drilla", "Power Klaw", "Kustom mega-blasta", "Traktor Blasta"])
    assert.ok(html.includes(name), name);
  assert.equal((html.match(/data-equipment-choice=/g) ?? []).length, 2);
  const rig = data.units.find((entry) => entry.name === "Big Mek Dakkarig");
  const fixed = equipmentView(rig, addUnit(army, rig));
  assert.doesNotMatch(fixed, /data-equipment-choice=/);
  for (const name of ["Blitzkannon", "Multi-busta Launcha", "Stompy Feet"])
    assert.ok(fixed.includes(name), name);
  const shokk = data.units.find((entry) => entry.name === "Big Mek with Shokk Attack Gun");
  assert.equal(shokk.points, 110);
  const shokkView = equipmentView(shokk, addUnit(army, shokk));
  assert.doesNotMatch(shokkView, /data-equipment-choice=/);
  for (const name of ["Shokk Attack Gun", "Big Mek&#39;s Toolz"])
    assert.ok(shokkView.includes(name), name);
});

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

test("Used Freeblade Enhancements cannot be selected twice, but remain editable on their owner", async () => {
  const data = await catalogue("imperial-knights"), army = newArmy(data);
  army.detachments = [data.detachments.find((entry) => entry.name === "Freeblade Company").id];
  const unit = data.units.find((unit) => unit.name === "Knight Crusader");
  const option = unit.options.find((entry) => entry.name === "Sanctuary");
  const first = addUnit(army, unit), second = addUnit(army, unit);
  first.enhancement = option.id;
  assert.equal(enhancementAvailability(option, unit, army, data, first).available, true);
  assert.deepEqual(enhancementAvailability(option, unit, army, data, second), { available: false, reason: "Army limit 1/1" });
  first.enhancement = null;
  assert.equal(enhancementAvailability(option, unit, army, data, second).available, true);
});

test("Army budget blocks new choices and recovers after removal or battle-size changes", async () => {
  const data = await catalogue("imperial-knights"), army = newArmy(data);
  army.detachments = [data.detachments.find((entry) => entry.name === "Freeblade Company").id];
  army.battleSize = "incursion";
  const unit = data.units.find((unit) => unit.name === "Knight Crusader");
  const options = unit.options.filter((entry) => enhancementAllowed(entry, unit, army));
  addUnit(army, unit).enhancement = options[0].id;
  addUnit(army, unit).enhancement = options[1].id;
  const row = addUnit(army, unit);
  assert.deepEqual(enhancementBudget(army, data), { used: 2, max: 2 });
  assert.equal(enhancementAvailability(options[2], unit, army, data, row).available, false);
  row.enhancement = options[2].id;
  assert.ok(armyEnhancementIssues(army, data).some((issue) => issue.includes("3/2")));
  army.battleSize = "strike";
  assert.deepEqual(armyEnhancementIssues(army, data), []);
  row.enhancement = null;
  army.battleSize = "incursion";
  army.units[0].enhancement = null;
  assert.equal(enhancementAvailability(options[2], unit, army, data, row).available, true);
});

test("Throne-bonded Upgrade can equip three Armigers, counts once and requires its own Detachment", async () => {
  const data = await catalogue("imperial-knights"), army = newArmy(data);
  const unit = data.units.find((unit) => unit.name === "Armiger Warglaive");
  const option = unit.options.find((entry) => entry.name === "Gyro-optimised Actuators");
  const detachment = data.detachments.find((entry) => entry.name === "Throne-bonded Outriders");
  assert.equal(option.upgrade, true);
  assert.equal(option.armyMax, 3);
  assert.deepEqual(option.requiredDetachments, [detachment.id]);
  army.detachments = [detachment.id];
  for (let count = 0; count < 3; count++) {
    const row = addUnit(army, unit);
    assert.equal(enhancementAvailability(option, unit, army, data, row).available, true);
    row.enhancement = option.id;
  }
  assert.deepEqual(enhancementBudget(army, data), { used: 1, max: 4 });
  assert.deepEqual(armyEnhancementIssues(army, data), []);
  const fourth = addUnit(army, unit);
  assert.equal(enhancementAvailability(option, unit, army, data, fourth).available, false);
  fourth.enhancement = option.id;
  assert.ok(armyEnhancementIssues(army, data).some((issue) => issue.includes("Upgrade limit of 3")));
});

test("Multiple selected Detachments grant their own Enhancements; duplicates are errors", async () => {
  const data = await catalogue("imperial-knights");
  const army = newArmy(data);
  const unit = data.units.find((unit) => unit.name === "Knight Crusader");
  army.detachments = data.detachments.filter((entry) => ["Valourstrike Lance", "Dominus Foebreakers"].includes(entry.name)).map((entry) => entry.id);
  const enhancement = unit.options.find((entry) => entry.name === "Augury Halo");
  assert.equal(enhancementAllowed(enhancement, unit, army), false);
  assert.equal(enhancementAllowed(unit.options.find((entry) => entry.name === "Bearer of the Iron Chalice"), unit, army), true);
  assert.equal(enhancementAllowed(unit.options.find((entry) => entry.name === "Blessed Plate"), unit, army), false);
  const dominus = data.units.find((entry) => entry.name === "Knight Castellan");
  assert.equal(enhancementAllowed(dominus.options.find((entry) => entry.name === "Blessed Plate"), dominus, army), true);
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
