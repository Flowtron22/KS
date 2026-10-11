import test from "node:test";
import assert from "node:assert/strict";
import {
  readArmyLibrary,
  writeArmyLibrary,
  addArmySlot,
  renameArmySlot,
  removeArmySlot,
} from "../src/army-library.js";
import { armyLibraryView } from "../src/army-library-view.js";
const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

test("Legacy Army A/B survive migration and ten named armies reload independently", () => {
  const store = storage();
  const old = [
    { id: "a", name: "Knights", units: [{ id: "row-a" }] },
    { id: "b", name: "Sisters", units: [{ id: "row-b" }] },
  ];
  store.setItem("ks-armies-11e", JSON.stringify(old));
  const library = readArmyLibrary(store);
  assert.deepEqual(library.armies, old);
  for (let i = 2; i < 10; i++) {
    addArmySlot(library);
    renameArmySlot(library, `Experiment ${i}`);
  }
  assert.throws(() => addArmySlot(library), /full/);
  writeArmyLibrary(store, library);
  assert.deepEqual(readArmyLibrary(store), library);
  assert.deepEqual(library.armies.slice(0, 2), old);
});

test("Duplicating an army copies equipment and attachments without sharing mutable objects", () => {
  const library = {
    armies: [
      {
        id: "original",
        name: "Test",
        units: [
          { id: "bodyguard", wargear: { gun: 1 } },
          { id: "leader", attachment: "bodyguard" },
        ],
      },
    ],
    names: ["Test"],
    active: 0,
  };
  addArmySlot(library, true);
  assert.notEqual(library.armies[1].id, library.armies[0].id);
  assert.equal(library.armies[1].units[1].attachment, "bodyguard");
  library.armies[1].units[0].wargear.gun = 2;
  renameArmySlot(library, "Copied army");
  assert.equal(library.armies[0].units[0].wargear.gun, 1);
  assert.equal(library.armies[0].name, "Test");
});

test("Deleting a slot keeps selection and names aligned, including the last army", () => {
  const library = {
    armies: [null, null, null],
    names: ["One", "Two", "Three"],
    active: 1,
  };
  removeArmySlot(library);
  assert.deepEqual(library.names, ["One", "Three"]);
  assert.equal(library.active, 1);
  removeArmySlot(library);
  removeArmySlot(library);
  assert.deepEqual(library, {
    armies: [null],
    names: ["New army 1"],
    active: 0,
  });
});

test("Named selector escapes user input, has a ten-list cap and requires a separate delete confirmation", () => {
  const library = {
    armies: Array(10).fill(null),
    names: Array(10).fill("<script>"),
    active: 9,
  };
  const html = armyLibraryView(library, { factions: [] }, false);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes('id="new-army" disabled'));
  assert.ok(html.includes('value="9" selected'));
  assert.ok(html.includes('id="delete-army-confirm" hidden'));
  assert.equal((html.match(/<option/g) ?? []).length, 10);
});
