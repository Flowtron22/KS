import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { newArmy, addUnit, armySummary } from "../src/army-core.js";
import {
  canSelectModel,
  defaultChoices,
  defaultQuantities,
  loadoutCounts,
  loadoutIssues,
} from "../src/army-loadout.js";
const read = async (faction) =>
  JSON.parse(
    await readFile(
      new URL(`../public/armies/${faction}.json`, import.meta.url),
      "utf8",
    ),
  );

test("Native Mechanicus units only receive ally warnings when selected in another faction", async () => {
  for (const faction of ["adeptus-mechanicus", "imperial-knights"]) {
    const data = await read(faction),
      army = newArmy(data);
    for (const name of [
      "Skitarii Marshal",
      "Tech-Priest Dominus",
      "Skitarii Vanguard",
    ]) {
      const unit = data.units.find((u) => u.name === name);
      assert.equal(unit.allied, faction === "imperial-knights");
      addUnit(army, unit);
    }
    assert.equal(
      armySummary(army, data).issues.filter((issue) =>
        issue.includes("allied-unit"),
      ).length,
      faction === "imperial-knights" ? 3 : 0,
    );
  }
});

test("Vanguard special weapons reduce the ordinary model requirement without a permanent warning", async () => {
  const data = await read("adeptus-mechanicus"),
    army = newArmy(data);
  const unit = data.units.find((u) => u.name === "Skitarii Vanguard"),
    row = addUnit(army, unit);
  assert.deepEqual(loadoutIssues(unit, row), []);
  const plasma = unit.equipment.models.find((model) =>
    model.name.includes("plasma caliver"),
  );
  const ordinary = unit.equipment.models.find((model) =>
    model.name.includes("radium carbine"),
  );
  const index = row.loadout.models.findIndex(
    (model) => model.type === ordinary.id,
  );
  assert.ok(canSelectModel(unit, row, index, plasma.id));
  row.loadout.models[index] = {
    type: plasma.id,
    choices: defaultChoices(plasma),
    quantities: defaultQuantities(plasma),
  };
  row.wargear = loadoutCounts(unit, row.loadout);
  assert.deepEqual(loadoutIssues(unit, row), []);
  const second = row.loadout.models.findIndex(
    (model) => model.type === ordinary.id,
  );
  assert.equal(canSelectModel(unit, row, second, plasma.id), false);
});

test("Exaction Squad primary catalogue discount is calculated rather than flagged as unknown", async () => {
  for (const [faction, cost] of [
    ["agents-of-the-imperium", 90],
    ["imperial-knights", 85],
  ]) {
    const data = await read(faction),
      unit = data.units.find((u) => u.name === "Exaction Squad");
    assert.equal(unit.points, cost);
    assert.equal(unit.conditionalPrice, false);
  }
});
