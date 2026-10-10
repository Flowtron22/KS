export const RULE_NUMBERS = {
  singleHitReroll: [0, 1],
  singleWoundReroll: [0, 1],
  sustainedHits: [0, 3],
  criticalHit: [4, 6],
  skillBonus: [-2, 2],
  strengthBonus: [-5, 5],
  attacksBonus: [0, 10],
  apBonus: [0, 3],
  damageBonus: [0, 10],
  hitMod: [-1, 1],
  woundMod: [-1, 1],
  incomingHitMod: [-1, 1],
  incomingWoundMod: [-1, 1],
  apReduction: [0, 3],
  damageReduction: [0, 10],
  fnp: [2, 7],
  invuln: [2, 7],
  targetToughnessBonus: [-5, 5],
  targetSaveBonus: [-2, 2],
  antiInfantry: [2, 7],
  antiMonster: [2, 7],
  antiVehicle: [2, 7],
  blast: [0, 5],
  rapidFire: [0, 10],
  melta: [0, 10],
};
export const RULE_FLAGS = [
  "lethalHits",
  "devastatingWounds",
  "ignoresCover",
  "stealth",
  "torrent",
  "ignoreHitMods",
  "ignoreWoundMods",
];
export function validateRuleEffects(u) {
  if (u.ruleComponents !== undefined) {
    if (
      !u.ruleComponents ||
      typeof u.ruleComponents !== "object" ||
      Array.isArray(u.ruleComponents) ||
      Object.keys(u.ruleComponents).length > 100
    )
      throw Error("Invalid rule components.");
    for (const [id, keys] of Object.entries(u.ruleComponents))
      if (
        id.length > 100 ||
        !Array.isArray(keys) ||
        keys.length > 40 ||
        keys.some((k) => typeof k !== "string" || k.length > 60)
      )
        throw Error("Invalid rule component keys.");
  }
  if (u.weaponRules !== undefined && typeof u.weaponRules !== "boolean")
    throw Error("Invalid weapon rule setting.");
  if (u.weaponConditions !== undefined) {
    if (
      !u.weaponConditions ||
      typeof u.weaponConditions !== "object" ||
      Array.isArray(u.weaponConditions)
    )
      throw Error("Invalid weapon conditions.");
    for (const [key, value] of Object.entries(u.weaponConditions))
      if (
        !["halfRange", "heavyEligible", "charged"].includes(key) ||
        typeof value !== "boolean"
      )
        throw Error("Invalid weapon condition.");
  }
  if (
    u.ruleSelections !== undefined &&
    (!Array.isArray(u.ruleSelections) ||
      u.ruleSelections.length > 30 ||
      u.ruleSelections.some(
        (id) => typeof id !== "string" || id.length > 100,
      ) ||
      new Set(u.ruleSelections).size !== u.ruleSelections.length)
  )
    throw Error("Invalid rule selections.");
  if (u.rulesConfirmed !== undefined && typeof u.rulesConfirmed !== "boolean")
    throw Error("Invalid rule confirmation.");
  if (u.ruleEffects === undefined) return;
  if (!Array.isArray(u.ruleEffects) || u.ruleEffects.length > 40)
    throw Error("Too many rule effects.");
  for (const r of u.ruleEffects) {
    if (
      !r ||
      typeof r.name !== "string" ||
      r.name.length > 200 ||
      !["fight", "shoot", "both"].includes(r.phase) ||
      !r.effects ||
      typeof r.effects !== "object" ||
      Array.isArray(r.effects)
    )
      throw Error("Invalid combat rule.");
    for (const [k, v] of Object.entries(r.effects)) {
      if (RULE_NUMBERS[k]) {
        const [min, max] = RULE_NUMBERS[k];
        if (!Number.isInteger(v) || v < min || v > max)
          throw Error(`Invalid rule value: ${k}.`);
      } else if (RULE_FLAGS.includes(k)) {
        if (typeof v !== "boolean") throw Error("Invalid rule flag.");
      } else if (["hitReroll", "woundReroll"].includes(k)) {
        if (!["none", "ones", "failed"].includes(v))
          throw Error("Invalid rule re-roll.");
      } else throw Error(`Unsupported rule component: ${k}.`);
    }
  }
}
export function collectRules(u, phase, role = "all") {
  const values = {},
    labels = [];
  if (!u.rulesConfirmed) return { values, labels };
  for (const r of u.ruleEffects ?? []) {
    if (r.phase !== "both" && r.phase !== phase) continue;
    const defensive = [
      "incomingHitMod",
      "incomingWoundMod",
      "fnp",
      "invuln",
      "stealth",
    ];
    if (
      Object.keys(r.effects).some(
        (k) =>
          role === "all" ||
          (role === "defence" ? defensive.includes(k) : !defensive.includes(k)),
      )
    )
      labels.push(r.name);
    for (const [k, v] of Object.entries(r.effects)) {
      if (RULE_FLAGS.includes(k)) values[k] = values[k] || v;
      else if (
        [
          "sustainedHits",
          "blast",
          "rapidFire",
          "melta",
          "singleHitReroll",
          "singleWoundReroll",
        ].includes(k)
      )
        values[k] = Math.max(values[k] ?? 0, v);
      else if (
        [
          "criticalHit",
          "fnp",
          "invuln",
          "antiInfantry",
          "antiMonster",
          "antiVehicle",
        ].includes(k)
      )
        values[k] = Math.min(values[k] ?? 7, v);
      else if (["hitReroll", "woundReroll"].includes(k))
        values[k] =
          values[k] === "failed" || v === "failed"
            ? "failed"
            : values[k] === "ones" || v === "ones"
              ? "ones"
              : "none";
      else values[k] = (values[k] ?? 0) + v;
    }
  }
  return { values, labels };
}
export function weaponRule(keywords, settings = {}) {
  const effects = {},
    unsupported = [];
  for (const token of keywords
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)) {
    let m;
    if (/^Lethal Hits$/i.test(token)) effects.lethalHits = true;
    else if ((m = token.match(/^Sustained Hits (\d+)$/i)))
      effects.sustainedHits = +m[1];
    else if (/^Devastating Wounds$/i.test(token))
      effects.devastatingWounds = true;
    else if (/^Twin.linked$/i.test(token)) effects.woundReroll = "failed";
    else if (/^Ignores Cover$/i.test(token)) effects.ignoresCover = true;
    else if (/^Torrent$/i.test(token)) effects.torrent = true;
    else if ((m = token.match(/^Anti-(Infantry|Monster|Vehicle) (\d)\+$/i)))
      effects["anti" + m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()] =
        +m[2];
    else if ((m = token.match(/^Blast(?: (\d+))?$/i)))
      effects.blast = +(m[1] ?? 1);
    else if ((m = token.match(/^Rapid Fire (\d+)$/i))) {
      if (settings.halfRange) effects.rapidFire = +m[1];
    } else if ((m = token.match(/^Melta (\d+)$/i))) {
      if (settings.halfRange) effects.melta = +m[1];
    } else if (/^Heavy$/i.test(token)) {
      if (settings.heavyEligible) effects.hitMod = 1;
    } else if (/^Lance$/i.test(token)) {
      if (settings.charged) effects.woundMod = 1;
    } else unsupported.push(token);
  }
  return {
    name: "Selected weapon keywords",
    phase: "both",
    effects,
    unsupported,
  };
}
