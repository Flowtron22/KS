import test from "node:test";
import assert from "node:assert/strict";
import { EFFECT_DEFAULTS, effectiveAttack } from "../src/combat-effects.js";
import { resolveAttack, simulate, validateScenario } from "../src/combat.js";
const unit = (effects = {}) => ({
  name: "Test",
  models: 1,
  bearers: 1,
  wounds: 100,
  frontWounds: 100,
  toughness: 10,
  save: 7,
  invuln: 7,
  fnp: 7,
  cover: false,
  weapon: {
    name: "Weapon",
    attacks: "1",
    damage: "2",
    hit: 2,
    strength: 4,
    ap: 0,
    hitMod: 0,
    woundMod: 0,
    hitReroll: "none",
    woundReroll: "none",
  },
  effects: { ...EFFECT_DEFAULTS, ...effects },
});
const stance = (id) => unit({ katah: id, katahEligible: true, readied: true });
test("Captain-General requires eligible Custodes and preserves stronger re-rolls", () => {
  const a = unit({
    custodes: true,
    captainGeneral: true,
    targetType: "infantry",
  });
  for (const phase of ["fight", "shoot"]) {
    const w = effectiveAttack(a, unit(), phase).weapon;
    assert.equal(w.hitReroll, "ones");
    assert.equal(w.woundReroll, "ones");
  }
  a.weapon.hitReroll = "failed";
  assert.equal(effectiveAttack(a, unit(), "fight").weapon.hitReroll, "failed");
  a.weapon.hitReroll = "none";
  for (const targetType of ["monster", "vehicle"]) {
    a.effects.targetType = targetType;
    assert.equal(effectiveAttack(a, unit(), "fight").weapon.hitReroll, "none");
  }
  a.effects.targetType = "infantry";
  a.effects.custodes = false;
  assert.equal(effectiveAttack(a, unit(), "fight").weapon.woundReroll, "none");
});
test("Impenetrable Defence checks Guard and target eligibility without stacking Sustained Hits", () => {
  const a = unit({ impenetrableDefence: true }),
    b = unit({ targetType: "infantry" });
  assert.equal(effectiveAttack(a, b, "fight").sustainedHits, 0);
  a.guardCodex = true;
  assert.equal(effectiveAttack(a, b, "fight").sustainedHits, 1);
  assert.equal(effectiveAttack(a, b, "shoot").sustainedHits, 1);
  a.effects.sustainedHits = 2;
  assert.equal(effectiveAttack(a, b, "fight").sustainedHits, 2);
  a.effects.sustainedHits = 0;
  b.effects.targetType = "vehicle";
  assert.equal(effectiveAttack(a, b, "fight").sustainedHits, 0);
});
test("Rendax checks target type, phase, readiness and eligibility", () => {
  const a = stance("rendax"),
    b = unit({ targetType: "vehicle" });
  assert.equal(effectiveAttack(a, b, "fight").lethalHits, true);
  assert.equal(effectiveAttack(a, b, "shoot").lethalHits, false);
  b.effects.targetType = "infantry";
  assert.equal(effectiveAttack(a, b, "fight").lethalHits, false);
  b.effects.targetType = "monster";
  a.effects.readied = false;
  assert.equal(effectiveAttack(a, b, "fight").lethalHits, false);
  a.effects.readied = true;
  a.effects.katahEligible = false;
  assert.equal(effectiveAttack(a, b, "fight").lethalHits, false);
});
test("Dacatarai does not apply against monsters or vehicles and does not duplicate re-rolls", () => {
  const a = stance("dacatarai"),
    b = unit({ targetType: "infantry" });
  assert.equal(effectiveAttack(a, b, "fight").weapon.hitReroll, "ones");
  a.weapon.hitReroll = "failed";
  assert.equal(effectiveAttack(a, b, "fight").weapon.hitReroll, "failed");
  a.weapon.hitReroll = "none";
  b.effects.targetType = "vehicle";
  assert.equal(effectiveAttack(a, b, "fight").weapon.hitReroll, "none");
});
test("Kaptaris is defensive, melee only and combines modifiers before capping", () => {
  const a = unit(),
    b = stance("kaptaris");
  assert.equal(effectiveAttack(a, b, "fight").weapon.hitMod, -1);
  assert.equal(effectiveAttack(a, b, "shoot").weapon.hitMod, 0);
  a.weapon.hitMod = 1;
  assert.equal(effectiveAttack(a, b, "fight").weapon.hitMod, 0);
  b.effects.incomingHitMod = -1;
  a.weapon.hitMod = 0;
  assert.equal(effectiveAttack(a, b, "fight").weapon.hitMod, -1);
});
test("Salvus ignores BS and hit/wound modifiers in shooting", () => {
  const a = stance("salvus"),
    b = unit({ incomingHitMod: -1, incomingWoundMod: -1 });
  a.effects.skillBonus = 1;
  const w = effectiveAttack(a, b, "shoot").weapon;
  assert.equal(w.hit, 2);
  assert.equal(w.hitMod, 0);
  assert.equal(w.woundMod, 0);
  assert.equal(effectiveAttack(a, b, "fight").weapon.hitMod, -1);
});
test("Lethal Hits bypass wound rolls while Sustained extra hits still roll to wound", () => {
  const a = unit({ lethalHits: true, sustainedHits: 1 }),
    b = unit();
  let rolls = [0.99, 0, 0.99];
  const r = resolveAttack(
    a,
    b,
    [100],
    "fight",
    () => rolls.shift() ?? 0.99,
    true,
  );
  assert.equal(r.hits, 2);
  assert.equal(r.extraHits, 1);
  assert.equal(r.autoWounds, 1);
  assert.equal(r.trace.wound.length, 1);
  assert.equal(r.wounds, 1);
  assert.equal(r.damageLost, 2);
});
test("sustained hits add the selected number and altered critical thresholds work", () => {
  const a = unit({ sustainedHits: 2, criticalHit: 5 }),
    b = unit();
  let rolls = [0.75, 0.99, 0.99, 0.99];
  const r = resolveAttack(
    a,
    b,
    [100],
    "fight",
    () => rolls.shift() ?? 0.99,
    true,
  );
  assert.equal(r.hits, 3);
  assert.equal(r.extraHits, 2);
  assert.equal(r.trace.wound.length, 3);
});
test("critical effects use final re-rolled result once", () => {
  const a = unit({ lethalHits: true, sustainedHits: 1 });
  a.weapon.hitReroll = "ones";
  let rolls = [0, 0.99, 0.99, 0.99, 0.99];
  const r = resolveAttack(
    a,
    unit(),
    [100],
    "fight",
    () => rolls.shift() ?? 0.99,
    true,
  );
  assert.equal(r.autoWounds, 1);
  assert.equal(r.extraHits, 1);
  assert.equal(r.trace.hit[0].original, 1);
});
test("buffs leave base characteristics intact and defensive AP reduces incoming penetration", () => {
  const a = unit({ skillBonus: 1, strengthBonus: 3, apBonus: 2 }),
    b = unit({ apReduction: 1 }),
    before = structuredClone(a);
  const w = effectiveAttack(a, b, "shoot").weapon;
  assert.equal(w.hit, 2);
  assert.equal(w.strength, 7);
  assert.equal(w.ap, -1);
  assert.deepEqual(a, before);
});
test("damage reduction applies per unsaved attack with a minimum of one, before FNP", () => {
  const a = unit({ damageBonus: 1 }),
    b = unit({ damageReduction: 5 });
  const r = resolveAttack(a, b, [100], "fight", () => 0.99, true);
  assert.equal(r.damageRolled, 3);
  assert.equal(r.damageLost, 1);
  b.fnp = 2;
  const next = resolveAttack(a, b, [100], "fight", () => 0.99, true);
  assert.equal(next.trace.fnp.length, 1);
  assert.equal(next.damageLost, 0);
});
test("additional attacks are per selected bearer", () => {
  const a = unit({ attacksBonus: 2 });
  a.models = 2;
  a.bearers = 2;
  assert.equal(resolveAttack(a, unit(), [100], "fight", () => 0.99).attacks, 6);
});
test("new effects validate strictly while legacy scenarios remain compatible", () => {
  const s = {
    phase: "fight",
    first: 0,
    fightBack: false,
    seed: 42,
    units: [unit(), unit()],
  };
  assert.doesNotThrow(() => validateScenario(s));
  s.units[0].effects.sustainedHits = "1";
  assert.throws(() => validateScenario(s));
  delete s.units[0].effects;
  delete s.units[1].effects;
  assert.doesNotThrow(() => validateScenario(s));
});
test("Rendax increases damage versus a high-Toughness vehicle in Monte Carlo", () => {
  const a = unit(),
    b = unit({ targetType: "vehicle" });
  a.weapon.attacks = "25";
  const s = {
      phase: "fight",
      first: 0,
      fightBack: false,
      seed: 10,
      units: [a, b],
    },
    base = simulate(s, 10000).sides[1].damage;
  a.effects.katah = "rendax";
  a.effects.katahEligible = true;
  a.effects.readied = true;
  const enhanced = simulate(s, 10000).sides[1].damage;
  assert.ok(enhanced > base + 3);
});
