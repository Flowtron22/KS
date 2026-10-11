import test from "node:test";
import assert from "node:assert/strict";
import { armyShareGroups } from "../src/army-share-groups.js";
import { renderArmyImages } from "../src/army-share.js";

test("Image groups place Characters with exact attached squad IDs, including nested Support", () => {
  const units = [
    { id: "marshal", group: "characters", attachmentId: "squad2" },
    { id: "squad1", group: "battleline" },
    { id: "dominus", group: "characters", attachmentId: "squad1" },
    { id: "squad2", group: "battleline" },
    { id: "solo", group: "characters" },
    { id: "support", group: "characters", attachmentId: "marshal" },
  ];
  const before = structuredClone(units),
    groups = armyShareGroups(units);
  assert.deepEqual(units, before);
  assert.deepEqual(
    groups.map((g) => g.name),
    ["Characters", "Battleline"],
  );
  assert.deepEqual(
    groups[0].items[0].entries.map((e) => e.unit.id),
    ["solo"],
  );
  assert.deepEqual(
    groups[1].items.map((g) => g.entries.map((e) => [e.unit.id, e.depth])),
    [
      [
        ["squad1", 0],
        ["dominus", 1],
      ],
      [
        ["squad2", 0],
        ["marshal", 1],
        ["support", 2],
      ],
    ],
  );
});

test("Broken attachments and cycles never drop or duplicate exported units", () => {
  const units = [
    { id: "a", attachmentId: "b" },
    { id: "b", attachmentId: "a" },
    { id: "c", attachmentId: "missing" },
  ];
  const entries = armyShareGroups(units).flatMap((g) =>
    g.items.flatMap((c) => c.entries),
  );
  assert.deepEqual(entries.map((e) => e.unit.id).sort(), ["a", "b", "c"]);
});

test("Image export indents attached Characters and keeps a squad together when paginating", () => {
  const pages = [],
    old = globalThis.document;
  globalThis.document = {
    createElement: () => {
      const painted = [];
      pages.push(painted);
      return {
        getContext: () => ({
          measureText: (text) => ({ width: text.length * 10 }),
          fillRect() {},
          strokeRect() {},
          fillText: (text, x) => painted.push({ text, x }),
        }),
      };
    },
  };
  const units = Array.from({ length: 35 }, (_, i) => ({
    id: `s${i}`,
    name: `SQUAD-${i}`,
    group: "battleline",
    models: 10,
    points: 85,
    weapons: ["Radium carbine"],
    composition: ["1 Alpha", "9 Vanguard"],
  }));
  units.unshift(
    ...units.map((u, i) => ({
      id: `c${i}`,
      name: `CHARACTER-${i}`,
      attachmentId: u.id,
      attachment: u.name,
      group: "characters",
      models: 1,
      points: 60,
      weapons: ["Pistol"],
      enhancement: "Omniscient",
    })),
  );
  try {
    const canvases = renderArmyImages({
      name: "TEST ARMY",
      faction: "Imperial Knights",
      size: "Strike Force",
      total: 5075,
      limit: 6000,
      dp: 3,
      budget: 3,
      detachments: [],
      disposition: "Test",
      units,
      issues: [],
    });
    assert.ok(canvases.length > 1);
    const drawn = pages.filter((p) => p.length);
    for (let i = 0; i < 35; i++) {
      const squadPage = drawn.find((page) =>
        page.some((line) => line.text.startsWith(`10 × SQUAD-${i} ·`)),
      );
      const character = squadPage.find((line) =>
        line.text.startsWith(`↳ 1 × CHARACTER-${i} ·`),
      );
      assert.ok(character);
      assert.equal(character.x, 100);
    }
    assert.ok(!drawn.flat().some((line) => line.text === "CHARACTERS"));
    assert.equal(
      drawn.flat().filter((line) => line.text.startsWith("↳ 1 × CHARACTER-"))
        .length,
      35,
    );
  } finally {
    if (old === undefined) delete globalThis.document;
    else globalThis.document = old;
  }
});
