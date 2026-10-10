import test from "node:test";
import assert from "node:assert/strict";
import {
  expression,
  seeded,
  woundTarget,
  saveTarget,
  resolveAttack,
  runScenario,
  simulate,
  validateScenario,
} from "../src/combat.js";
const unit = (override = {}) => ({
  name: "Test",
  models: 5,
  wounds: 3,
  toughness: 6,
  save: 3,
  invuln: 7,
  fnp: 7,
  frontWounds: 3,
  bearers: 5,
  cover: false,
  weapon: {
    name: "Test weapon",
    attacks: "1",
    hit: 2,
    strength: 12,
    ap: -3,
    damage: "8",
    hitMod: 0,
    woundMod: 0,
    hitReroll: "none",
    woundReroll: "none",
  },
  ...override,
});
const scenario = () => ({
  phase: "fight",
  first: 0,
  fightBack: true,
  seed: 123,
  units: [unit(), unit()],
});
test("strength thresholds include equal, double and half", () =>
  assert.deepEqual(
    [
      woundTarget(12, 6),
      woundTarget(7, 6),
      woundTarget(6, 6),
      woundTarget(4, 6),
      woundTarget(3, 6),
    ],
    [2, 3, 4, 5, 6],
  ));
test("AP, invulnerable saves and cover use the best applicable save", () => {
  const u = unit(),
    w = u.weapon;
  assert.equal(saveTarget(u, w, "fight"), 6);
  u.invuln = 4;
  assert.equal(saveTarget(u, w, "fight"), 4);
  u.cover = true;
  u.invuln = 7;
  assert.equal(saveTarget(u, { ...w, ap: 0 }, "shoot"), 3);
  u.save = 4;
  assert.equal(saveTarget(u, { ...w, ap: 0 }, "shoot"), 3);
  assert.equal(saveTarget(u, { ...w, ap: 0 }, "fight"), 4);
  assert.equal(saveTarget({ ...u, save: 7 }, { ...w, ap: -4 }, "fight"), 7);
});
test("normal damage cannot spill between models", () => {
  const a = unit({ bearers: 1 }),
    b = unit({ save: 7 });
  const hp = [3, 3, 3];
  const r = resolveAttack(a, b, hp, "fight", () => 0.99, true);
  assert.equal(r.killed, 1);
  assert.equal(r.damageRolled, 8);
  assert.equal(r.damageLost, 3);
  assert.deepEqual(hp, [3, 3]);
});
test("a wounded model takes damage before a fresh model", () => {
  const a = unit({ bearers: 1 }),
    b = unit({ save: 7 });
  const hp = [1, 3];
  const r = resolveAttack(a, b, hp, "fight", () => 0.99);
  assert.equal(r.damageLost, 1);
  assert.deepEqual(hp, [3]);
});
test("unmodified ones fail even with positive modifiers", () => {
  const a = unit({ weapon: { ...unit().weapon, hitMod: 1 } });
  assert.equal(resolveAttack(a, unit(), [3, 3], "fight", () => 0).hits, 0);
});
test("an impossible save is not rescued by a six", () => {
  const b = unit({ save: 7 });
  assert.equal(
    resolveAttack(unit({ bearers: 1 }), b, [3], "fight", () => 0.99).unsaved,
    1,
  );
});
test("Feel No Pain rolls per damage point", () => {
  const a = unit({ bearers: 1 }),
    b = unit({ save: 7, fnp: 2 });
  const r = resolveAttack(a, b, [3], "fight", () => 0.99, true);
  assert.equal(r.trace.fnp.length, 8);
  assert.equal(r.damageLost, 0);
});
test("failed re-rolls occur once and expose original rolls", () => {
  const a = unit({
    bearers: 1,
    weapon: { ...unit().weapon, hitReroll: "failed" },
  });
  let rolls = [0, 0.99, 0.99, 0.99];
  const r = resolveAttack(
    a,
    unit({ save: 7 }),
    [3],
    "fight",
    () => rolls.shift() ?? 0.99,
    true,
  );
  assert.equal(r.hits, 1);
  assert.equal(r.trace.hit[0].original, 1);
});
test("variable attacks and damage are rolled with D3/D6 expressions", () => {
  assert.deepEqual(expression("2D6 + 1"), { count: 2, sides: 6, flat: 1 });
  assert.throws(() => expression("D20"));
  const a = unit({
    bearers: 1,
    weapon: { ...unit().weapon, attacks: "D3", damage: "D6+2" },
  });
  const r = resolveAttack(
    a,
    unit({ save: 7 }),
    [100],
    "fight",
    () => 0.99,
    true,
  );
  assert.equal(r.attacks, 3);
  assert.equal(r.damageRolled, 24);
  assert.equal(r.damageLost, 24);
});
test("survivors fight back and destroyed units do not", () => {
  let s = scenario();
  s.units[0].bearers = 2;
  s.units[1].save = 7;
  const r = runScenario(s, () => 0.99);
  assert.equal(r.events[1].attacks, 3);
  s.units[0].bearers = 5;
  assert.equal(runScenario(s, () => 0.99).events.length, 1);
  s.phase = "shoot";
  assert.equal(runScenario(s, () => 0.99).events.length, 1);
  s.phase = "fight";
  s.fightBack = false;
  assert.equal(runScenario(s, () => 0.99).events.length, 1);
});
test("same seed reproduces the sequence and simulation", () => {
  const s = scenario();
  assert.deepEqual(runScenario(s), runScenario(s));
  assert.deepEqual(simulate(s, 100), simulate(s, 100));
  assert.notDeepEqual(runScenario(s), runScenario({ ...s, seed: 124 }));
});
test("Monte Carlo agrees with analytic expectation for one damage shots", () => {
  const s = scenario();
  s.phase = "shoot";
  s.units[0] = unit({
    models: 1,
    bearers: 1,
    weapon: {
      ...unit().weapon,
      attacks: "1",
      hit: 3,
      strength: 6,
      ap: 0,
      damage: "1",
    },
  });
  s.units[1] = unit({
    models: 1,
    bearers: 1,
    wounds: 100,
    frontWounds: 100,
    save: 4,
  });
  const out = simulate(s, 50000).sides[1];
  assert.ok(Math.abs(out.damage - (4 / 6) * (3 / 6) * (3 / 6)) < 0.01);
  assert.equal(out.killed, 0);
});
test("scenario validation rejects inconsistent counts and unsupported characteristics", () => {
  const s = scenario();
  assert.deepEqual(validateScenario(s), s);
  s.units[0].bearers = 6;
  assert.throws(() => validateScenario(s));
  s.units[0].bearers = 5;
  s.units[0].weapon.attacks = "N/A";
  assert.throws(() => validateScenario(s));
  s.units[0].weapon.attacks = "1";
  s.units[0].frontWounds = 4;
  assert.throws(() => validateScenario(s));
  assert.throws(() => simulate(scenario(), 0));
});
test("independent trials leave input unchanged and account for all outcomes", () => {
  const s = scenario(),
    before = structuredClone(s),
    r = simulate(s, 1000, seeded(2));
  assert.deepEqual(s, before);
  for (const side of r.sides) {
    assert.equal(
      Object.values(side.histogram).reduce((a, b) => a + b, 0),
      1000,
    );
    assert.ok(side.interval[0] >= 0 && side.interval[1] <= 1);
    assert.ok(side.damage <= 15);
  }
});
