import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { armyGroup, groupArmyItems } from "../src/army-groups.js";
import { armyRosterView } from "../src/army-roster-view.js";
import { newArmy, addUnit, unitPoints } from "../src/army-core.js";
import { armyShareData, renderArmyImages } from "../src/army-share.js";

test("Datasheets use familiar sections, with characters taking precedence", () => {
  assert.equal(
    armyGroup({ categories: ["Battleline", "Character"] }),
    "characters",
  );
  assert.equal(armyGroup({ role: "Dedicated Transport" }), "transports");
  assert.equal(armyGroup({ categories: ["Infantry"] }), "other");
  assert.equal(armyGroup({ categories: ["Character", "Epic Hero"] }), "epic-heroes");
  assert.equal(armyGroup({ categories: ["Fortification"] }), "fortifications");
  const unit = { categories: ["Battleline"] };
  assert.deepEqual(
    groupArmyItems([unit]).map((g) => g.name),
    ["Battleline"],
  );
  assert.equal(groupArmyItems([unit])[0].items[0], unit);
});

test("Imperial Knight allies keep separate faction sections in roster and share data", async () => {
  const data = JSON.parse(await readFile(new URL("../public/armies/imperial-knights.json", import.meta.url), "utf8"));
  const army = newArmy(data);
  for (const name of ["Canis Rex", "Knight Crusader", "Skitarii Marshal", "Warhound Titan", "Searchlight"])
    addUnit(army, data.units.find((unit) => unit.name === name));
  const groups = groupArmyItems(army.units, (row) => armyGroup(data.units.find((unit) => unit.id === row.unitId)));
  assert.deepEqual(groups.map((group) => group.name), ["Epic Heroes", "Characters", "Allies: Adeptus Mechanicus", "Allies: Adeptus Titanicus", "Allies: Unaligned Forces"]);
  assert.equal(groups.flatMap((group) => group.items).length, army.units.length);
  const shared = armyShareData(army, data);
  assert.deepEqual(shared.units.map((unit) => unit.group), army.units.map((row) => armyGroup(data.units.find((unit) => unit.id === row.unitId))));
});

test("Grouped roster and image preserve every row, attachments and escalating points", async () => {
  const data = JSON.parse(
    await readFile(
      new URL("../public/armies/genestealer-cults.json", import.meta.url),
      "utf8",
    ),
  );
  const army = newArmy(data);
  const names = [
    "Achilles Ridgerunners",
    "Goliath Truck",
    "Neophyte Hybrids",
    "Locus",
    "Achilles Ridgerunners",
  ];
  for (const name of names)
    addUnit(
      army,
      data.units.find((u) => u.name === name),
    );
  const other = data.units.find((u) => u.name === names[0]);
  other.duplicatePriceRules = [{ every: 1, value: 25 }];
  army.units[3].attachment = army.units[2].id;
  const original = structuredClone(army);
  const html = armyRosterView(army, data, army.units[3].id);
  assert.deepEqual(army, original);
  assert.ok(html.indexOf("Characters") < html.indexOf("Battleline"));
  assert.ok(html.indexOf("Battleline") < html.indexOf("Dedicated Transports"));
  assert.ok(
    html.indexOf("Dedicated Transports") < html.indexOf("Other Datasheets"),
  );
  for (const row of army.units)
    assert.equal(html.split(`data-edit-unit="${row.id}"`).length - 1, 1);
  const info = armyShareData(army, data);
  assert.deepEqual(
    info.units.map((row) => row.id),
    army.units.map((row) => row.id),
  );
  assert.equal(info.units[3].attachmentId, army.units[2].id);
  assert.equal(info.units[4].points, unitPoints(other, army.units[4], army));
  assert.equal(info.units[4].points - info.units[0].points, 25);
  const old = globalThis.document,
    painted = [];
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({
        measureText: (text) => ({ width: text.length * 10 }),
        fillRect() {},
        strokeRect() {},
        fillText: (text) => painted.push(text),
      }),
    }),
  };
  try {
    renderArmyImages(info);
    const headings = painted.filter((text) =>
      [
        "CHARACTERS",
        "BATTLELINE",
        "DEDICATED TRANSPORTS",
        "OTHER DATASHEETS",
      ].includes(text),
    );
    assert.deepEqual(headings, [
      "BATTLELINE",
      "DEDICATED TRANSPORTS",
      "OTHER DATASHEETS",
    ]);
    for (const row of info.units)
      assert.equal(
        painted.filter((text) => text.includes(` × ${row.label} ·`)).length,
        1,
      );
  } finally {
    if (old === undefined) delete globalThis.document;
    else globalThis.document = old;
  }
});
