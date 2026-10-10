// Homogeneous units, one weapon profile per attack sequence. No automatic abilities.
export function expression(value) {
  const s = String(value).replace(/\s/g, "").toUpperCase();
  if (/^\d+$/.test(s) && +s <= 100) return { flat: +s, count: 0, sides: 0 };
  const m = s.match(/^(\d*)D(3|6)(?:\+(\d+))?$/);
  if (!m || +(m[1] || 1) > 10 || +(m[3] || 0) > 100)
    throw Error(
      `Unsupported dice value: ${value}. Use a number, D3, D6, or 2D6+1.`,
    );
  return { flat: +(m[3] || 0), count: +(m[1] || 1), sides: +m[2] };
}
export function seeded(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const die = (rng, sides = 6) => 1 + Math.floor(rng() * sides);
function amount(expr, rng, rolls) {
  let n = expr.flat;
  for (let i = 0; i < expr.count; i++) {
    const v = die(rng, expr.sides);
    n += v;
    rolls?.push({ value: v, sides: expr.sides, pass: true });
  }
  return n;
}
export const woundTarget = (s, t) =>
  s >= 2 * t ? 2 : s > t ? 3 : s === t ? 4 : 2 * s <= t ? 6 : 5;
function integer(v, min, max, label) {
  if (!Number.isInteger(v) || v < min || v > max)
    throw Error(`${label} must be a whole number from ${min} to ${max}.`);
}
export function validateScenario(s) {
  if (
    !s ||
    !["fight", "shoot"].includes(s.phase) ||
    ![0, 1].includes(s.first) ||
    typeof s.fightBack !== "boolean" ||
    !Array.isArray(s.units) ||
    s.units.length !== 2
  )
    throw Error("Invalid scenario.");
  integer(s.seed, 0, 4294967295, "Seed");
  for (const u of s.units) {
    if (!u || typeof u.name !== "string" || u.name.length > 150)
      throw Error("Invalid unit name.");
    for (const [k, min, max] of [
      ["models", 1, 100],
      ["wounds", 1, 100],
      ["toughness", 1, 100],
      ["save", 2, 7],
      ["invuln", 2, 7],
      ["fnp", 2, 7],
      ["frontWounds", 1, u.wounds],
      ["bearers", 0, u.models],
    ])
      integer(u[k], min, max, k);
    if (typeof u.cover !== "boolean") throw Error("Invalid cover setting.");
    const w = u.weapon;
    if (!w || typeof w.name !== "string" || w.name.length > 200)
      throw Error("Choose a weapon profile.");
    const a = expression(w.attacks);
    expression(w.damage);
    if ((a.flat + a.count * a.sides) * u.bearers > 2000)
      throw Error(
        "This lab supports up to 2,000 attacks per unit per sequence.",
      );
    for (const [k, min, max] of [
      ["hit", 2, 6],
      ["strength", 1, 100],
      ["ap", -10, 0],
      ["hitMod", -1, 1],
      ["woundMod", -1, 1],
    ])
      integer(w[k], min, max, k);
    for (const k of ["hitReroll", "woundReroll"])
      if (!["none", "ones", "failed"].includes(w[k]))
        throw Error("Invalid re-roll setting.");
  }
  return structuredClone(s);
}
export function saveTarget(target, weapon, phase) {
  // Benefit of Cover does not improve a 3+ (or better) save against AP 0.
  const cover =
    phase === "shoot" && target.cover && !(target.save <= 3 && weapon.ap === 0)
      ? 1
      : 0;
  return Math.max(2, Math.min(target.save - weapon.ap - cover, target.invuln));
}
function check(rng, target, modifier, reroll, critical, trace) {
  let v = die(rng),
    original = null;
  const passes = (n) =>
    n !== 1 && ((critical && n === 6) || n + modifier >= target);
  if ((reroll === "ones" && v === 1) || (reroll === "failed" && !passes(v))) {
    original = v;
    v = die(rng);
  }
  const pass = passes(v);
  trace?.push({ value: v, pass, original });
  return pass;
}
export function resolveAttack(
  attacker,
  defender,
  hp,
  phase,
  rng,
  trace = false,
  attackerHp = null,
) {
  const w = attacker.weapon,
    hit = [],
    wound = [],
    save = [],
    damage = [],
    fnp = [],
    attackDice = [];
  const left = attackerHp ? attackerHp.length : attacker.models;
  // Selected weapon bearers are allocated survivors first; mixed profiles are not modelled.
  const bearers = Math.min(attacker.bearers, left),
    a = expression(w.attacks),
    d = expression(w.damage);
  let attacks = 0,
    hits = 0,
    wounds = 0,
    unsaved = 0,
    damageRolled = 0,
    damageLost = 0;
  for (let i = 0; i < bearers; i++)
    attacks += amount(a, rng, trace ? attackDice : null);
  const wt = woundTarget(w.strength, defender.toughness),
    st = saveTarget(defender, w, phase);
  for (let i = 0; i < attacks; i++) {
    if (check(rng, w.hit, w.hitMod, w.hitReroll, true, trace ? hit : null))
      hits++;
  }
  for (let i = 0; i < hits; i++)
    if (check(rng, wt, w.woundMod, w.woundReroll, true, trace ? wound : null))
      wounds++;
  const before = hp.length;
  for (let i = 0; i < wounds; i++) {
    // Resolve damage sequentially; excess normal damage never spills to another model.
    if (!hp.length) break;
    if (check(rng, st, 0, "none", false, trace ? save : null)) continue;
    unsaved++;
    let n = amount(d, rng, null);
    damageRolled += n;
    if (trace) damage.push({ value: n, pass: true, expression: w.damage });
    if (defender.fnp <= 6) {
      let lost = 0;
      for (let j = 0; j < n; j++)
        if (!check(rng, defender.fnp, 0, "none", false, trace ? fnp : null))
          lost++;
      n = lost;
    }
    const lost = Math.min(hp[0], n);
    hp[0] -= lost;
    damageLost += lost;
    if (hp[0] === 0) hp.shift();
  }
  return {
    attacks,
    hits,
    wounds,
    unsaved,
    damageRolled,
    damageLost,
    killed: before - hp.length,
    remaining: hp.reduce((a, b) => a + b, 0),
    modelsLeft: hp.length,
    hitTarget: w.hit,
    woundTarget: wt,
    saveTarget: st,
    trace: trace ? { attackDice, hit, wound, save, damage, fnp } : null,
  };
}
export function runScenario(s, rng = seeded(s.seed), trace = false) {
  const hp = s.units.map((u) => [
    u.frontWounds,
    ...Array(u.models - 1).fill(u.wounds),
  ]);
  const first = s.first,
    other = 1 - first,
    events = [];
  events.push({
    side: first,
    ...resolveAttack(
      s.units[first],
      s.units[other],
      hp[other],
      s.phase,
      rng,
      trace,
      hp[first],
    ),
  });
  if (s.phase === "fight" && s.fightBack && hp[other].length)
    events.push({
      side: other,
      ...resolveAttack(
        s.units[other],
        s.units[first],
        hp[first],
        s.phase,
        rng,
        trace,
        hp[other],
      ),
    });
  return {
    events,
    hp,
    damage: s.units.map(
      (u, i) =>
        u.frontWounds +
        (u.models - 1) * u.wounds -
        hp[i].reduce((a, b) => a + b, 0),
    ),
    killed: s.units.map((u, i) => u.models - hp[i].length),
  };
}
export function simulate(
  s,
  trials,
  rng = seeded(s.seed),
  onProgress = () => {},
) {
  validateScenario(s);
  integer(trials, 1, 100000, "Trials");
  const result = {
    trials,
    sides: [0, 1].map(() => ({
      damage: 0,
      killed: 0,
      destroyed: 0,
      histogram: {},
    })),
  };
  for (let i = 0; i < trials; i++) {
    const r = runScenario(s, rng);
    for (let side = 0; side < 2; side++) {
      const out = result.sides[side];
      out.damage += r.damage[side];
      out.killed += r.killed[side];
      out.destroyed += r.hp[side].length === 0 ? 1 : 0;
      out.histogram[r.damage[side]] = (out.histogram[r.damage[side]] || 0) + 1;
    }
    if ((i + 1) % 1000 === 0) onProgress(i + 1);
  }
  for (const out of result.sides) {
    out.damage /= trials;
    out.killed /= trials;
    out.destroyChance = out.destroyed / trials;
    const p = out.destroyChance,
      z = 1.96,
      den = 1 + (z * z) / trials,
      center = (p + (z * z) / (2 * trials)) / den,
      half =
        (z *
          Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials))) /
        den;
    out.interval = [Math.max(0, center - half), Math.min(1, center + half)];
  }
  return result;
}
