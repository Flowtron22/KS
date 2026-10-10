import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  newArmy,
  addUnit,
  unitPoints,
  validateArmy,
} from "../src/army-core.js";
import {
  defaultChoices,
  canSelectModel,
  loadoutCounts,
  loadoutIssues,
  resizeLoadout,
} from "../src/army-loadout.js";
import { armyShareData, renderArmyImages } from "../src/army-share.js";
import { equipmentView } from "../src/army-equipment-view.js";
const knights = JSON.parse(
  await readFile(
    new URL("../public/armies/imperial-knights.json", import.meta.url),
  ),
);
const custodes = JSON.parse(
  await readFile(
    new URL("../public/armies/adeptus-custodes.json", import.meta.url),
  ),
);
const crusader = knights.units.find((u) => u.name === "Knight Crusader");
function nodes(n) {
  return [n, ...(n.children ?? []).flatMap(nodes)];
}
function choose(row, name, option) {
  const group = nodes(crusader.equipment.tree).find(
    (n) => n.kind === "group" && n.name === name,
  );
  row.loadout.models[0].choices[group.id] = group.children.find(
    (c) => c.name === option,
  ).id;
  row.wargear = loadoutCounts(crusader, row.loadout);
}
function weaponNames(unit, row) {
  return Object.keys(row.wargear).map(
    (id) => unit.options.find((o) => o.id === id).name,
  );
}
test("Crusader fixed weapons and default loadout come from source selection groups", () => {
  const a = newArmy(knights),
    r = addUnit(a, crusader);
  assert.deepEqual(
    weaponNames(crusader, r).sort(),
    [
      "Thermal cannon",
      "Avenger gatling cannon",
      "Heavy flamer",
      "Meltagun",
      "Titanic feet",
    ].sort(),
  );
  assert.ok(
    loadoutIssues(crusader, r).every((x) => x.includes("source review")),
  );
  assert.equal(validateArmy(a, knights).units[0].models, 1);
});
test("Crusader arm bundle replaces thermal cannon, includes paired stubber and charges once", () => {
  const r = addUnit(newArmy(knights), crusader),
    before = unitPoints(crusader, r);
  choose(
    r,
    "Thermal Cannon",
    "Rapid-fire battlecannon and Questoris heavy stubber",
  );
  assert.ok(!weaponNames(crusader, r).includes("Thermal cannon"));
  assert.ok(weaponNames(crusader, r).includes("Rapid-fire battle cannon"));
  assert.ok(weaponNames(crusader, r).includes("Questoris heavy stubber"));
  assert.equal(unitPoints(crusader, r), before + 15);
  choose(r, "Thermal Cannon", "Thermal cannon");
  assert.equal(unitPoints(crusader, r), before);
});
test("Carapace and secondary choices cannot equip their alternatives simultaneously", () => {
  const r = addUnit(newArmy(knights), crusader);
  choose(r, "Carapace-mounted Weapon", "Twin Icarus autocannon");
  choose(r, "Carapace-mounted Weapon", "Stormspear rocket pod");
  choose(r, "Meltagun", "Questoris heavy stubber");
  const names = weaponNames(crusader, r);
  assert.ok(names.includes("Stormspear rocket pod"));
  assert.ok(!names.includes("Twin Icarus autocannon"));
  assert.ok(!names.includes("Meltagun"));
  assert.equal(equipmentView(crusader, r).includes("data-wargear"), false);
});
test("Model choices stay independent and resize preserves surviving model equipment", () => {
  const u = custodes.units.find((u) => u.name === "Custodian Guard"),
    r = addUnit(newArmy(custodes), u);
  const shield = u.equipment.models.find((m) => /Sentinel blade/i.test(m.name));
  r.loadout.models[1] = {
    type: shield.id,
    choices: defaultChoices(shield),
    quantities: {},
  };
  r.wargear = loadoutCounts(u, r.loadout);
  assert.ok(weaponNames(u, r).some((n) => /Sentinel blade/i.test(n)));
  assert.equal(
    Object.values(r.wargear).reduce((a, b) => a + b, 0) >= r.models,
    true,
  );
  r.models = 5;
  resizeLoadout(u, r);
  assert.equal(r.loadout.models.length, 5);
  assert.equal(r.loadout.models[1].type, shield.id);
});
test("Imported loadouts reject injected quantities, extra weapons, and unknown choices", () => {
  const a = newArmy(knights);
  addUnit(a, crusader);
  const forged = structuredClone(a);
  forged.units[0].wargear["13ea-1f02-677-7538"] = 1;
  assert.throws(() => validateArmy(forged, knights), /counts/);
  const q = structuredClone(a);
  q.units[0].loadout.models[0].quantities["2b0-2a2-db03-357f"] = 9;
  assert.throws(() => validateArmy(q, knights), /quantity/);
  const choice = structuredClone(a);
  choice.units[0].loadout.models[0].choices["fake"] = "fake";
  assert.throws(() => validateArmy(choice, knights), /choice/);
});
test("Legacy armies preserve wargear and require explicit equipment configuration", () => {
  const a = newArmy(knights),
    r = addUnit(a, crusader);
  delete r.loadout;
  assert.deepEqual(validateArmy(a, knights).units[0].wargear, r.wargear);
  assert.match(loadoutIssues(crusader, r)[0], /Legacy/);
});
test("Share content includes Detachments, disposition, Warlord, loadout, costs and attachments", () => {
  const a = newArmy(knights);
  a.detachments = [knights.detachments[0].id];
  a.disposition = knights.detachments[0].dispositions[0];
  const r = addUnit(a, crusader);
  r.warlord = true;
  r.enhancement = crusader.options.find((o) => o.type === "enhancement").id;
  const info = armyShareData(a, knights);
  assert.equal(info.detachments[0], knights.detachments[0].name);
  assert.equal(info.disposition, a.disposition);
  assert.equal(info.units[0].warlord, true);
  assert.ok(info.units[0].enhancement);
  assert.ok(info.units[0].weapons.some((w) => w.includes("Avenger")));
  assert.equal(info.units[0].points, unitPoints(crusader, r));
});

test("Squad model choices obey per-type maxima; unfinished composition survives save/load", () => {
  const u = custodes.units.find((u) => u.name === "Custodian Guard"),
    a = newArmy(custodes),
    r = addUnit(a, u),
    vexilla = u.equipment.models.find((t) => t.name.includes("Vexilla"));
  r.loadout.models[0] = {
    type: vexilla.id,
    choices: defaultChoices(vexilla),
    quantities: {},
  };
  r.wargear = loadoutCounts(u, r.loadout);
  assert.equal(canSelectModel(u, r, 1, vexilla.id), false);
  const incomplete = structuredClone(a);
  incomplete.units[0].loadout.models = incomplete.units[0].loadout.models.map(
    () => ({
      type: vexilla.id,
      choices: defaultChoices(vexilla),
      quantities: {},
    }),
  );
  incomplete.units[0].wargear = loadoutCounts(u, incomplete.units[0].loadout);
  assert.ok(
    loadoutIssues(u, incomplete.units[0]).some((i) =>
      i.includes("composition"),
    ),
  );
  assert.equal(validateArmy(incomplete, custodes).units.length, 1);
});

test("Long PNG exports paginate, retain every unit and fit oversized names inside the frame", () => {
  const painted = [];
  let current = [];
  const old = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({
        measureText: (text) => ({ width: text.length * 16 }),
        fillRect() {},
        strokeRect() {},
        fillText(text, x, y) {
          current.push({ text, x, y });
        },
      }),
    }),
  };
  try {
    const info = {
      name: "X".repeat(100),
      faction: "Imperial Knights",
      size: "Strike Force",
      total: 0,
      limit: 2000,
      dp: 2,
      budget: 3,
      unknown: 0,
      disposition: "Purge the Foe",
      detachments: ["Valourstrike Lance"],
      issues: Array.from({ length: 1000 }, (_, i) => "Equipment review " + i),
      units: Array.from({ length: 200 }, (_, i) => ({
        name: "UNIT-" + i,
        models: 1,
        points: 395,
        weapons: ["Thermal cannon"],
        notes: "Notes ".repeat(100),
      })),
    };
    const images = renderArmyImages(info);
    painted.push(...current);
    assert.ok(images.length > 1);
    assert.ok(images.every((c) => c.width === 1080 && c.height <= 10000));
    for (let i = 0; i < 200; i++)
      assert.ok(painted.some((line) => line.text.includes("UNIT-" + i + " ")));
    assert.ok(painted.every((line) => line.text.length * 16 <= 952));
  } finally {
    if (old === undefined) delete globalThis.document;
    else globalThis.document = old;
  }
});
