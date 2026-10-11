import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  unitAvailability,
  unitCopyLimit,
  modelCountAllowed,
  combatModelMax,
  constrainCombatModels,
} from "../src/unit-limits.js";
import {
  newArmy,
  addUnit,
  armySummary,
  validateArmy,
} from "../src/army-core.js";
import {
  canSelectModel,
  defaultChoices,
  loadoutCounts,
  loadoutIssues,
  resizeLoadout,
} from "../src/army-loadout.js";
import { renderUnitCard } from "../src/combat-unit-view.js";
import { compileCopyLimits } from "../tools/unit-limits-compiler.mjs";
import { compileEquipment } from "../tools/wargear-compiler.mjs";
import { compileModelRange } from "../tools/model-range-compiler.mjs";
const read = async (name) =>
  JSON.parse(
    await readFile(
      new URL("../public/armies/" + name + ".json", import.meta.url),
      "utf8",
    ),
  );
const sm = await read("space-marines"),
  tyranids = await read("tyranids");
test("Alternative model packages are not summed and root copy caps do not become squad sizes", async () => {
  const fixture = {
    id: "unit",
    type: "model",
    min: 1,
    max: 3,
    children: [
      {
        id: "composition",
        min: 2,
        max: 2,
        children: [{ id: "model", type: "model", min: 2, max: 2 }],
      },
    ],
  };
  assert.deepEqual(
    compileModelRange(fixture, {
      children: (n) => n.children ?? [],
      bounds: (n) => ({ min: n.min ?? 0, max: n.max ?? null }),
    }),
    { min: 2, max: 2 },
  );
  const data = await read("world-eaters");
  assert.deepEqual(data.units.find((u) => u.name === "Jakhals").models, {
    min: 10,
    max: 20,
  });
});
test("Multi-weapon defaults fill required slots without selecting optional bundles", async () => {
  const data = await read("chaos-knights");
  const unit = data.units.find((u) => u.name === "War Dog Moirax");
  const row = addUnit(newArmy(data), unit);
  assert.deepEqual(loadoutIssues(unit, row), []);
  assert.equal(
    Object.values(row.wargear).reduce((sum, n) => sum + n, 0),
    3,
  );
  const nodes = (n) => [n, ...(n.children ?? []).flatMap(nodes)];
  const bundle = nodes(unit.equipment.tree).find(
    (n) => n.kind === "bundle" && n.max === 2,
  );
  assert.equal(row.loadout.models[0].quantities[bundle.id], 0);
});
test("Grouped source modifiers retain review instead of losing ancestor conditions", () => {
  const weapon = {
    id: "weapon",
    name: "Weapon",
    constraints: [
      {
        id: "cap",
        field: "selections",
        scope: "parent",
        type: "max",
        value: 1,
      },
    ],
    modifierGroups: [
      {
        conditions: [
          {
            scope: "roster",
            field: "selections",
            type: "atLeast",
            childId: "detachment",
            value: 1,
          },
        ],
        modifiers: [{ field: "cap", type: "set", value: 2 }],
      },
    ],
  };
  const unit = { id: "unit", type: "model", name: "Unit", children: [weapon] };
  const equipment = compileEquipment(unit, {
    children: (n) => n.children ?? [],
    bounds: (n) => ({ min: 0, max: n === weapon ? 1 : null }),
    options: [{ id: "weapon", type: "weapon" }],
  });
  assert.equal(equipment.tree.children[0].boundsRules, undefined);
  assert.ok(equipment.review.some((message) => message.includes("Weapon")));
});
test("Copy limits agree for Battleline, Dedicated Transports, ordinary units and Epic Heroes", () => {
  const army = newArmy(sm);
  for (const [name, strike, incursion] of [
    ["Intercessor Squad", 6, 4],
    ["Rhino", 6, 4],
    ["Whirlwind", 3, 2],
    ["Canis Rex", 1, 1],
  ]) {
    const unit = sm.units.find((u) => u.name === name);
    assert.ok(unit, name);
    army.battleSize = "strike";
    assert.equal(unitCopyLimit(unit, army), strike);
    for (let n = 0; n < strike; n++) addUnit(army, unit);
    assert.equal(unitAvailability(unit, army).available, false);
    addUnit(army, unit);
    assert.ok(
      armySummary(army, sm).issues.some(
        (i) => i.includes(name) && i.includes("copies"),
      ),
    );
    army.battleSize = "incursion";
    assert.equal(unitCopyLimit(unit, army), incursion);
  }
});
test("Source Detachment exceptions apply only when selected", () => {
  const unit = {
    constraints: [
      { id: "cap", field: "selections", scope: "force", type: "max", value: 3 },
    ],
    modifiers: [
      {
        field: "cap",
        type: "set",
        value: 6,
        conditions: [
          {
            field: "selections",
            scope: "roster",
            type: "atLeast",
            value: 1,
            childId: "detachment",
          },
        ],
      },
    ],
  };
  const copyLimits = compileCopyLimits(
    unit,
    new Map([
      ["detachment", { costs: [{ name: "Detachment Points", value: 1 }] }],
    ]),
  );
  const u = { categories: [], copyLimits };
  const army = { battleSize: "strike", detachments: [] };
  assert.equal(unitCopyLimit(u, army), 3);
  army.detachments = ["detachment"];
  assert.equal(unitCopyLimit(u, army), 6);
});
test("Barbgaunt builder counts reject 99; calculator accepts casualties and gates experiments", () => {
  const unit = tyranids.units.find((u) => u.name === "Barbgaunts");
  assert.equal(modelCountAllowed(unit, 5), true);
  assert.equal(modelCountAllowed(unit, 10), true);
  assert.equal(modelCountAllowed(unit, 99), false);
  assert.equal(modelCountAllowed(unit, 1), false);
  const army = newArmy(tyranids),
    row = addUnit(army, unit);
  row.models = 99;
  assert.throws(() => validateArmy(army, tyranids));
  const scenario = { models: 99, bearers: 99 };
  assert.equal(combatModelMax(unit, scenario), 10);
  assert.equal(combatModelMax(unit, scenario, true), 100);
  constrainCombatModels(unit, scenario);
  assert.deepEqual(scenario, { models: 10, bearers: 10 });
  scenario.models = 1;
  constrainCombatModels(unit, scenario);
  assert.equal(scenario.models, 1);
  assert.equal(combatModelMax(unit, { guardCodex: true }), 3);
});
test("Required Sergeant and squad-wide grenade limits block invalid replacement; resizing preserves legal equipment", () => {
  const unit = sm.units.find((u) => u.name === "Intercessor Squad"),
    army = newArmy(sm),
    row = addUnit(army, unit);
  const normal = unit.equipment.models.find((m) => m.name === "Intercessor");
  const grenade = unit.equipment.models.find(
    (m) => m.name === "Intercessor w/ Grenade Launcher",
  );
  assert.equal(canSelectModel(unit, row, 0, normal.id), false);
  assert.equal(canSelectModel(unit, row, 1, grenade.id), true);
  row.loadout.models[1] = {
    type: grenade.id,
    choices: defaultChoices(grenade),
    quantities: {},
  };
  row.wargear = loadoutCounts(unit, row.loadout);
  assert.equal(canSelectModel(unit, row, 2, grenade.id), false);
  row.models = 10;
  resizeLoadout(unit, row);
  assert.equal(canSelectModel(unit, row, 2, grenade.id), true);
  row.models = 5;
  resizeLoadout(unit, row);
  assert.equal(row.loadout.models[1].type, grenade.id);
  assert.ok(!loadoutIssues(unit, row).some((i) => i.includes("composition")));
});
test("Calculator view exposes datasheet maximum and explicitly labels Experiment mode", () => {
  const source = tyranids.units.find((u) => u.name === "Barbgaunts");
  const u = {
    name: source.name,
    models: 5,
    bearers: 5,
    wounds: 1,
    frontWounds: 1,
    toughness: 4,
    save: 4,
    invuln: 7,
    fnp: 7,
    cover: false,
    effects: {},
    weapon: {
      name: "Custom",
      attacks: "1",
      hit: 3,
      strength: 4,
      ap: 0,
      damage: "1",
    },
    ruleSelections: [],
  };
  const pick = {
    unit: source.id,
    data: {
      ...tyranids,
      combatRules: {
        definitions: {},
        groups: {},
        units: {},
        weapons: {},
        entries: [],
      },
    },
    ruleScope: "unit",
  };
  const html = renderUnitCard(0, u, pick, {
    factions: [],
    phase: "shoot",
    first: 0,
  });
  assert.match(html, /data-field="models"[^>]*max="10"/);
  const experimental = renderUnitCard(0, u, pick, {
    factions: [],
    phase: "shoot",
    first: 0,
    experiment: true,
  });
  assert.match(experimental, /data-field="models"[^>]*max="100"/);
  assert.match(experimental, /Experimental/);
});
