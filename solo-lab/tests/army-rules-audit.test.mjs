import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { newArmy, addUnit, armySummary, unitPoints } from "../src/army-core.js";
import { armyAllyIssues } from "../src/army-allies.js";
import { enhancementAllowed, enhancementAvailability, attachedEnhancementIssues } from "../src/army-enhancements.js";
import { eligibleBodyguard, attachmentCandidates } from "../src/army-attachments.js";
import { compileEnhancementBearer } from "../tools/enhancement-compiler.mjs";
const read = async (name) => JSON.parse(await readFile(new URL(`../public/armies/${name}.json`, import.meta.url), "utf8"));

test("Bearer Boolean conditions keep AND/OR, unit IDs and unresolved restrictions", () => {
  const map = new Map([["a", { name: "Infantry" }], ["b", { name: "Psyker" }]]);
  const bearer = compileEnhancementBearer([{ modifiers: [{ field: "hidden", type: "set", value: true, conditionGroups: [{ type: "or", conditions: [{ scope: "ancestor", childId: "a", type: "notInstanceOf" }, { scope: "ancestor", childId: "b", type: "instanceOf" }] }] }] }], map);
  const option = { type: "enhancement", requiredDetachments: ["d"], bearer };
  const army = { detachments: ["d"] };
  assert.equal(enhancementAllowed(option, { id: "u", categories: ["Character", "Infantry"] }, army), true);
  assert.equal(enhancementAllowed(option, { id: "u", categories: ["Character", "Infantry", "Psyker"] }, army), false);
  assert.equal(enhancementAllowed(option, { id: "u", categories: ["Character"] }, army), false);
  const unknown = compileEnhancementBearer([{ modifiers: [{ field: "hidden", type: "set", value: true, conditions: [{ scope: "ancestor", childId: "missing", type: "notInstanceOf" }] }] }], map);
  assert.equal(unknown.review.length, 1);
});

test("Leader and Support share one Enhancement slot; attachment and selection cannot bypass it", async () => {
  const data = await read("space-marines"), army = newArmy(data);
  army.detachments = [data.detachments.find((entry) => entry.name === "Gladius Task Force").id];
  const bodyguard = addUnit(army, data.units.find((unit) => unit.name === "Intercessor Squad"));
  const captainUnit = data.units.find((unit) => unit.name === "Captain");
  const supportUnit = data.units.find((unit) => unit.name === "Lieutenant");
  const leader = addUnit(army, captainUnit), support = addUnit(army, supportUnit);
  leader.attachment = bodyguard.id;
  support.attachment = bodyguard.id;
  const leaderOption = captainUnit.options.find((option) => enhancementAllowed(option, captainUnit, army));
  const supportOption = supportUnit.options.find((option) => enhancementAllowed(option, supportUnit, army) && option.id !== leaderOption.id);
  assert.ok(leaderOption && supportOption);
  leader.enhancement = leaderOption.id;
  assert.equal(enhancementAvailability(supportOption, supportUnit, army, data, support).available, false);
  support.enhancement = supportOption.id;
  assert.ok(attachedEnhancementIssues(army, data).some((issue) => issue.includes("2/1")));
  support.attachment = null;
  assert.ok(!attachmentCandidates(army, data, support).some((entry) => entry.id === bodyguard.id));
  support.enhancement = null;
  assert.ok(attachmentCandidates(army, data, support).some((entry) => entry.id === bodyguard.id));
});

test("Inquisitor keyword targets mean Battleline AND Imperium AND Infantry", async () => {
  const data = await read("space-marines");
  const inquisitor = data.units.find((unit) => unit.name === "Inquisitor");
  assert.equal(eligibleBodyguard(inquisitor, data.units.find((unit) => unit.name === "Intercessor Squad")), true);
  assert.equal(eligibleBodyguard(inquisitor, data.units.find((unit) => unit.name === "Land Raider")), false);
  assert.equal(eligibleBodyguard(inquisitor, { name: "Other", categories: ["Battleline", "Infantry"] }), false);
});

test("Questor Forgepact enforces permission, allowed datasheets, points and Warlord restriction", async () => {
  const data = await read("imperial-knights"), army = newArmy(data);
  const marshal = addUnit(army, data.units.find((unit) => unit.name === "Skitarii Marshal"));
  assert.ok(armyAllyIssues(army, data, unitPoints).some((issue) => issue.includes("requires Questor Forgepact")));
  army.detachments = [data.detachments.find((entry) => entry.name === "Questor Forgepact").id];
  assert.deepEqual(armyAllyIssues(army, data, unitPoints), []);
  marshal.warlord = true;
  assert.ok(armyAllyIssues(army, data, unitPoints).some((issue) => issue.includes("cannot be your Warlord")));
  marshal.warlord = false;
  marshal.pointsOverride = 501;
  assert.ok(armyAllyIssues(army, data, unitPoints).some((issue) => issue.includes("501/500")));
});

test("Assigned Agents applies category caps and independent Retinue exemptions", async () => {
  const data = await read("imperial-knights"), army = newArmy(data);
  army.battleSize = "incursion";
  for (const name of ["Inquisitor", "Inquisitorial Agents", "Exaction Squad"])
    addUnit(army, data.units.find((unit) => unit.name === name));
  assert.deepEqual(armyAllyIssues(army, data, unitPoints), []);
  addUnit(army, data.units.find((unit) => unit.name === "Exaction Squad"));
  assert.ok(armyAllyIssues(army, data, unitPoints).some((issue) => issue.includes("Retinue 2/1")));
  army.battleSize = "strike";
  assert.deepEqual(armyAllyIssues(army, data, unitPoints), []);
  addUnit(army, data.units.find((unit) => unit.name === "Warhound Titan"));
  assert.ok(armyAllyIssues(army, data, unitPoints).some((issue) => issue.includes("check allied-unit eligibility")));
});

test("Superseded Custodes army catalogue cannot silently pass as current rules", async () => {
  const data = await read("adeptus-custodes"), army = newArmy(data);
  addUnit(army, data.units.find((unit) => unit.name === "Custodian Guard"));
  assert.ok(armySummary(army, data).issues.some((issue) => issue.includes("September 2026 Codex")));
});

test("Marine and chapter catalogues disclose unreconciled Codex changes", async () => {
  for (const name of ["space-marines", "blood-angels", "ultramarines"]) {
    const data = await read(name);
    assert.ok(data.ruleReview.some((issue) => issue.includes("September 2026 Codex")), name);
  }
  assert.deepEqual((await read("grey-knights")).ruleReview, []);
});
