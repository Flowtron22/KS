import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateRuleEffects, weaponRule } from "../src/rule-effects.js";
import { effectiveAttack } from "../src/combat-effects.js";
import { resolveAttack } from "../src/combat.js";
import { prepareRules } from "../src/rule-picker.js";
import { compileRule } from "../tools/rule-compiler.mjs";
const index = JSON.parse(
  readFileSync(new URL("../public/armies/index.json", import.meta.url)),
);
const unit = (rules = []) => ({
  name: "Test",
  models: 2,
  bearers: 1,
  wounds: 5,
  frontWounds: 5,
  toughness: 4,
  save: 2,
  invuln: 7,
  fnp: 7,
  cover: false,
  weapon: {
    name: "Test",
    attacks: "1",
    hit: 3,
    strength: 4,
    ap: 0,
    damage: "3",
    hitMod: 0,
    woundMod: 0,
    hitReroll: "none",
    woundReroll: "none",
  },
  rulesConfirmed: true,
  ruleEffects: rules,
});
const rule = (effects, phase = "both") => ({
  name: "Test rule",
  phase,
  effects,
});
test("Every faction catalogue has source-linked rule and weapon coverage; every compiled component validates", () => {
  for (const f of index.factions) {
    const data = JSON.parse(
        readFileSync(new URL("../public/rules/" + f.file, import.meta.url)),
      ),
      army = JSON.parse(
        readFileSync(new URL("../public/armies/" + f.file, import.meta.url)),
      );
    assert.equal(data.commit, index.commit);
    assert.equal(data.name, f.name);
    assert.ok(Object.keys(data.definitions).length);
    for (const u of army.units) {
      assert.ok(Array.isArray(data.units[u.id]));
      for (const id of data.units[u.id]) assert.ok(data.definitions[id]);
    }
    for (const r of Object.values(data.definitions)) {
      assert.ok(r.source.file && r.source.entryId);
      assert.ok(!("description" in r));
      validateRuleEffects(unit([rule(r.effects, r.phase)]));
    }
  }
});
test("Source conditions and phase gate imported rules without changing base stats", () => {
  const a = unit([rule({ skillBonus: 1, strengthBonus: 2 }, "shoot")]),
    b = unit(),
    base = structuredClone(a);
  assert.equal(effectiveAttack(a, b, "shoot").weapon.hit, 2);
  assert.equal(effectiveAttack(a, b, "fight").weapon.hit, 3);
  a.rulesConfirmed = false;
  assert.equal(effectiveAttack(a, b, "shoot").weapon.hit, 3);
  a.rulesConfirmed = true;
  assert.deepEqual(a, base);
});
test("Repeated keyword and reroll effects use highest strength, numerical modifiers cap after summing", () => {
  const a = unit([
    rule({ sustainedHits: 1, hitReroll: "ones", hitMod: 1 }),
    rule({ sustainedHits: 2, hitReroll: "failed", hitMod: 1 }),
  ]);
  const result = effectiveAttack(a, unit(), "shoot");
  assert.equal(result.sustainedHits, 2);
  assert.equal(result.weapon.hitReroll, "failed");
  assert.equal(result.weapon.hitMod, 1);
});
test("11e Stealth grants shooting cover; Ignores Cover removes it", () => {
  const a = unit(),
    b = unit([rule({ stealth: true })]);
  assert.equal(effectiveAttack(a, b, "shoot").defender.cover, true);
  assert.equal(effectiveAttack(a, b, "fight").defender.cover, false);
  a.ruleEffects = [rule({ ignoresCover: true })];
  assert.equal(effectiveAttack(a, b, "shoot").defender.cover, false);
});
test("Torrent auto-hits without hit dice or Lethal/Sustained critical hits", () => {
  const a = unit([rule({ torrent: true, lethalHits: true, sustainedHits: 3 })]);
  const r = resolveAttack(a, unit(), [5, 5], "shoot", () => 0.99, true);
  assert.equal(r.hits, 1);
  assert.equal(r.autoWounds, 0);
  assert.equal(r.extraHits, 0);
  assert.equal(r.trace.hit.length, 0);
});
test("Anti critical wounds trigger Devastating Wounds, bypass saves and do not spill across models", () => {
  const a = unit([rule({ antiInfantry: 4, devastatingWounds: true })]),
    b = unit();
  b.effects = { targetType: "infantry" };
  a.weapon.damage = "8";
  const r = resolveAttack(a, b, [5, 5], "shoot", () => 0.6, true);
  assert.equal(r.devastating, 1);
  assert.equal(r.trace.save.length, 0);
  assert.equal(r.damageLost, 5);
  assert.equal(r.killed, 1);
});
test("Lethal auto-wounds cannot also trigger Devastating Wounds", () => {
  const a = unit([rule({ lethalHits: true, devastatingWounds: true })]);
  const r = resolveAttack(a, unit(), [5, 5], "shoot", () => 0.99, true);
  assert.equal(r.autoWounds, 1);
  assert.equal(r.devastating, 0);
  assert.equal(r.trace.wound.length, 0);
  assert.equal(r.trace.save.length, 1);
});
test("Blast, Rapid Fire, Melta, Heavy and Lance use explicit conditions", () => {
  const r = weaponRule("Blast 2, Rapid Fire 2, Melta 2, Heavy, Lance", {
    halfRange: true,
    heavyEligible: true,
    charged: true,
  });
  const a = unit([r]),
    b = unit();
  b.models = 12;
  const e = effectiveAttack(a, b, "shoot");
  assert.equal(e.attacksBonus, 6);
  assert.equal(e.damageBonus, 2);
  assert.equal(e.weapon.hitMod, 1);
  assert.equal(e.weapon.woundMod, 1);
  assert.deepEqual(
    weaponRule("Rapid Fire 2, Melta 2, Heavy, Lance").effects,
    {},
  );
});
test("Faction rule selections reject unavailable IDs and mutually exclusive Dark Pact options", () => {
  const data = JSON.parse(
      readFileSync(
        new URL("../public/rules/chaos-space-marines.json", import.meta.url),
      ),
    ),
    ids = Object.values(data.definitions)
      .filter((r) => r.exclusive === "dark-pact")
      .map((r) => r.id);
  const a = unit();
  a.ruleSelections = ids;
  const pick = {
    data: { name: data.name, combatRules: data },
    unit: "test",
    weapon: "",
  };
  assert.throws(() => prepareRules(a, pick, "fight"), /exclusive/);
  a.ruleSelections = ["unknown"];
  assert.throws(() => prepareRules(a, pick, "fight"), /unavailable/);
});
test("Compiler does not combine Dark Pact choices or guess movement effects", () => {
  assert.equal(
    compileRule(
      "Choice",
      "Select one of the following abilities: [LETHAL HITS] or [SUSTAINED HITS 1].",
    ).status,
    "reference",
  );
  assert.equal(
    compileRule("Move", "This unit can make an advance move.").status,
    "reference",
  );
  assert.deepEqual(
    compileRule(
      "Buff",
      "Each time a model in this unit makes a ranged attack, add 1 to the Hit roll.",
    ).effects,
    { hitMod: 1 },
  );
});
test("Serialized rule effects reject unknown operators, invalid numbers and duplicate selections", () => {
  assert.throws(() => validateRuleEffects(unit([rule({ arbitrary: 1 })])));
  assert.throws(() => validateRuleEffects(unit([rule({ skillBonus: 100 })])));
  const a = unit();
  a.ruleSelections = ["x", "x"];
  assert.throws(() => validateRuleEffects(a));
});
test("One failed hit and wound re-roll applies at most once each per attack sequence", () => {
  const a = unit([rule({ singleHitReroll: 1, singleWoundReroll: 1 })]);
  a.weapon.attacks = "5";
  const misses = resolveAttack(a, unit(), [5, 5], "shoot", () => 0, true);
  assert.equal(misses.trace.hit.filter((d) => d.original !== null).length, 1);
  let rolls = Array(5).fill(0.99).concat(Array(7).fill(0));
  const wounds = resolveAttack(
    a,
    unit(),
    [5, 5],
    "shoot",
    () => rolls.shift() ?? 0,
    true,
  );
  assert.equal(wounds.trace.wound.filter((d) => d.original !== null).length, 1);
});
test("Imported ability components can be disabled individually and unknown components are rejected", () => {
  const data = {
    definitions: {
      x: {
        name: "Conditional buff",
        status: "components",
        phase: "both",
        effects: { hitMod: 1, woundMod: 1 },
      },
    },
    groups: { x: "unit" },
    units: { u: ["x"] },
    weapons: {},
  };
  const a = unit();
  a.ruleSelections = ["x"];
  a.ruleComponents = { x: ["hitMod"] };
  prepareRules(a, { unit: "u", data: { combatRules: data } }, "fight");
  assert.deepEqual(a.ruleEffects[0].effects, { hitMod: 1 });
  a.ruleComponents.x = ["arbitrary"];
  assert.throws(() =>
    prepareRules(a, { unit: "u", data: { combatRules: data } }, "fight"),
  );
});
test("Mixed weapon and variable-per-resource rules stay reference-only", () => {
  assert.equal(
    compileRule(
      "Fire and Fury",
      "Add 1 to the Attacks characteristic of Torrent weapons, and all other ranged weapons have [SUSTAINED HITS 1].",
    ).status,
    "reference",
  );
  assert.equal(
    compileRule(
      "Variable buff",
      "For each die discarded, add 1 to the Attacks characteristic.",
    ).status,
    "reference",
  );
});

test("Default Breacher abilities exclude optional campaign trees for unrelated units", () => {
 const d=JSON.parse(readFileSync(new URL("../public/rules/t-au-empire.json",import.meta.url)));
 const names=d.units["afc0-2b21-8ddc-3b2a"].map(id=>d.definitions[id].name);
 assert.ok(names.includes("Breach and Clear"));
 assert.ok(!names.includes("Merciless Marksmen"));
 assert.ok(!names.includes("Predatory Roar (Aura)"));
});
