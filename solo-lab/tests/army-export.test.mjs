import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  newArmy,
  addUnit,
  validateArmy,
  unitPoints,
} from "../src/army-core.js";
import {
  attachmentCandidates,
  attachmentIssues,
} from "../src/army-attachments.js";
import { createArmyExport, armyValidation } from "../src/army-export.js";
import { armyShareData, renderArmyImages } from "../src/army-share.js";
import { loadoutCounts } from "../src/army-loadout.js";
import { equipmentView } from "../src/army-equipment-view.js";
import { compileEquipment } from "../tools/wargear-compiler.mjs";
const read = async (name) =>
  JSON.parse(
    await readFile(
      new URL("../public/armies/" + name + ".json", import.meta.url),
      "utf8",
    ),
  );
const gc = await read("genestealer-cults"),
  eldar = await read("aeldari"),
  tyranids = await read("tyranids");
const find = (data, name) => data.units.find((unit) => unit.name === name);
const nodes = (node) => [node, ...(node.children ?? []).flatMap(nodes)];
test("Locus can select eligible infantry, never a truck, and imported bad attachments remain flagged drafts", () => {
  const army = newArmy(gc),
    locus = addUnit(army, find(gc, "Locus")),
    truck = addUnit(army, find(gc, "Goliath Truck")),
    bodyguard = addUnit(army, find(gc, "Neophyte Hybrids"));
  assert.ok(
    attachmentIssues(army, gc).some((issue) => issue.includes("Support needs")),
  );
  const choices = attachmentCandidates(army, gc, locus);
  assert.ok(choices.some((row) => row.id === bodyguard.id));
  assert.ok(!choices.some((row) => row.id === truck.id));
  locus.attachment = truck.id;
  const imported = validateArmy(army, gc);
  assert.equal(createArmyExport(imported, gc).validation.status, "errors");
  assert.ok(
    attachmentIssues(imported, gc).some((issue) =>
      issue.includes("eligible Bodyguard"),
    ),
  );
  locus.attachment = bodyguard.id;
  assert.deepEqual(attachmentIssues(army, gc), []);
  const second = addUnit(army, find(gc, "Locus"));
  second.attachment = bodyguard.id;
  assert.ok(
    attachmentIssues(army, gc).some((issue) =>
      issue.includes("Only one Support"),
    ),
  );
});
test("Video attachment chain exports every unit once, preserving exact target IDs and points", () => {
  const army = newArmy(eldar),
    eldrad = addUnit(army, find(eldar, "Eldrad Ulthran")),
    conclave = addUnit(army, find(eldar, "Warlock Conclave")),
    guardians = addUnit(army, find(eldar, "Storm Guardians")),
    warlock = addUnit(army, find(eldar, "Warlock"));
  eldrad.attachment = conclave.id;
  conclave.attachment = guardians.id;
  warlock.attachment = guardians.id;
  assert.deepEqual(attachmentIssues(army, eldar), []);
  const json = createArmyExport(army, eldar),
    image = armyShareData(army, eldar);
  assert.deepEqual(
    json.units.map((r) => r.id),
    army.units.map((r) => r.id),
  );
  assert.deepEqual(
    image.units.map((r) => r.id),
    army.units.map((r) => r.id),
  );
  assert.equal(
    image.units.find((r) => r.id === eldrad.id).attachmentId,
    conclave.id,
  );
  assert.equal(
    image.units.find((r) => r.id === conclave.id).attachmentId,
    guardians.id,
  );
  assert.equal(image.total, json.total);
  assert.equal(
    json.total,
    json.units.reduce((sum, r) => sum + r.calculatedPoints, 0),
  );
  assert.deepEqual(image.issues, json.validation.issues);
  const thirdSupport = addUnit(army, find(eldar, "Warlock"));
  thirdSupport.attachment = guardians.id;
  assert.ok(
    attachmentIssues(army, eldar).some((issue) =>
      issue.includes("Only one Support"),
    ),
  );
});
test("Export status distinguishes unresolved rules, hard errors, manual costs and empty drafts", () => {
  const army = newArmy(gc);
  assert.equal(createArmyExport(army, gc).validation.status, "draft");
  addUnit(army, find(gc, "Achilles Ridgerunners"));
  const review = armyValidation(army, {
    issues: ["Equipment limits need source review."],
  });
  assert.equal(review.status, "needs-review");
  assert.equal(review.errors.length, 0);
  const bad = armyValidation(army, {
    issues: ["Choose one Warlord.", "Equipment limits need source review."],
  });
  assert.equal(bad.status, "errors");
  assert.equal(bad.errors.length, 1);
  assert.equal(bad.review.length, 1);
  assert.equal(
    armyValidation(army, { issues: [] }).label,
    "BASIC CHECKS PASSED",
  );
  army.units[0].pointsOverride = 1;
  assert.equal(armyValidation(army, { issues: [] }).status, "needs-review");
});
test("Attachment cycles and third attachments are blocked, while unresolved eligibility is reviewed", () => {
  const a = newArmy(eldar),
    one = addUnit(a, find(eldar, "Warlock Conclave")),
    two = addUnit(a, find(eldar, "Storm Guardians"));
  one.attachment = two.id;
  two.attachment = one.id;
  assert.ok(
    attachmentIssues(a, eldar).some((issue) => issue.includes("cycle")),
  );
  assert.equal(attachmentCandidates(a, eldar, one).length, 0);
  const unknown = structuredClone(eldar);
  unknown.units.find((u) => u.id === one.unitId).attachment.targets = [];
  assert.ok(
    attachmentIssues(a, unknown).some((issue) =>
      issue.includes("eligibility needs source review"),
    ),
  );
});
test("Ridgerunner non-weapon equipment is exclusive per model and survives JSON and image export", () => {
  const army = newArmy(gc),
    unit = find(gc, "Achilles Ridgerunners"),
    row = addUnit(army, unit);
  const group = nodes(unit.equipment.tree).find(
    (n) =>
      n.kind === "group" && n.children.some((c) => c.name === "Survey augur"),
  );
  assert.equal(group.max, 1);
  const flare = group.children.find((c) => c.name === "Flare launcher"),
    survey = group.children.find((c) => c.name === "Survey augur");
  assert.equal(flare.kind, "equipment");
  assert.equal(survey.kind, "equipment");
  row.loadout.models[0].choices[group.id] = survey.id;
  row.wargear = loadoutCounts(unit, row.loadout);
  assert.equal(row.wargear[survey.id], 1);
  assert.equal(row.wargear[flare.id], undefined);
  assert.ok(equipmentView(unit, row).includes("Survey augur"));
  const exported = createArmyExport(army, gc);
  assert.equal(validateArmy(exported, gc).units[0].wargear[survey.id], 1);
  assert.ok(
    armyShareData(army, gc).units[0].weapons.some((text) =>
      text.includes("Survey augur"),
    ),
  );
  row.loadout.models[0].quantities[flare.id] = 1;
  row.wargear[flare.id] = 1;
  assert.throws(() => createArmyExport(army, gc), /counts do not match/);
});
test("Over-limit Guard and forged validation labels cannot produce a clean export", () => {
  const army = newArmy(tyranids),
    unit = find(tyranids, "Tyrant Guard");
  for (let i = 0; i < 4; i++) addUnit(army, unit);
  army.validation = { status: "checks-passed", issues: [] };
  const json = createArmyExport(army, tyranids),
    image = armyShareData(army, tyranids);
  assert.equal(json.validation.status, "errors");
  assert.ok(json.validation.errors.some((issue) => issue.includes("4 copies")));
  assert.deepEqual(image.validation, json.validation);
  assert.equal(image.units.length, 4);
  assert.deepEqual(
    image.units.map((u) => u.label),
    [
      "Tyrant Guard #1",
      "Tyrant Guard #2",
      "Tyrant Guard #3",
      "Tyrant Guard #4",
    ],
  );
  assert.equal(
    json.total,
    army.units.reduce((sum, r) => sum + unitPoints(unit, r, army), 0),
  );
});
test("Unsupported equipment leaves carry review rather than disappearing silently", () => {
  const unit = {
    id: "unit",
    type: "model",
    name: "Unit",
    children: [{ id: "unknown", type: "upgrade", name: "Mystery equipment" }],
  };
  const equipment = compileEquipment(unit, {
    children: (n) => n.children ?? [],
    bounds: () => ({ min: 0, max: null }),
    options: [],
  });
  assert.ok(
    equipment.review.some((message) => message.includes("Mystery equipment")),
  );
});
test("Every image page starts with the validation status, including pages with only review details", () => {
  const pages = [];
  const old = globalThis.document;
  globalThis.document = {
    createElement: () => {
      const painted = [];
      pages.push(painted);
      return {
        getContext: () => ({
          measureText: (text) => ({ width: text.length * 16 }),
          fillRect() {},
          strokeRect() {},
          fillText: (text, x, y) => painted.push({ text, x, y }),
        }),
      };
    },
  };
  try {
    const army = newArmy(gc);
    addUnit(army, find(gc, "Locus"));
    const info = armyShareData(army, gc);
    info.issues.push(
      ...Array.from({ length: 1000 }, (_, i) => "Equipment issue " + i),
    );
    const images = renderArmyImages(info);
    const painted = pages.filter((page) => page.length);
    assert.ok(images.length > 1);
    assert.ok(images.every((canvas) => canvas.height <= 10000));
    assert.ok(
      painted.every((page) => page[0].text === "ERRORS · COMMUNITY DATA"),
    );
    assert.ok(painted.every((page) => page[0].y === 64));
  } finally {
    if (old === undefined) delete globalThis.document;
    else globalThis.document = old;
  }
});
