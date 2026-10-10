import { collectRules } from "./rule-effects.js";
export const KATAH_SOURCE =
  "https://www.warhammer-community.com/en-gb/articles/vygelghy/new-army-rules-from-codex-adeptus-custodes/";
export const EFFECT_DEFAULTS = {
  katah: "none",
  katahEligible: false,
  readied: false,
  custodes: false,
  captainGeneral: false,
  impenetrableDefence: false,
  targetType: "other",
  lethalHits: false,
  sustainedHits: 0,
  criticalHit: 6,
  skillBonus: 0,
  strengthBonus: 0,
  attacksBonus: 0,
  apBonus: 0,
  damageBonus: 0,
  incomingHitMod: 0,
  incomingWoundMod: 0,
  apReduction: 0,
  damageReduction: 0,
  ignoreHitMods: false,
  ignoreWoundMods: false,
  note: "",
};
export const KATAHS = [
  ["none", "No Ka’tah"],
  ["rendax", "Rendax — Lethal Hits vs Monster/Vehicle"],
  ["dacatarai", "Dacatarai — re-roll hit 1s vs other targets"],
  ["kaptaris", "Kaptaris — enemy melee hit rolls −1"],
  ["salvus", "Salvus — ignore shooting BS, hit and wound modifiers"],
];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function active(u, phase) {
  const e = { ...EFFECT_DEFAULTS, ...u.effects };
  return e.katahEligible &&
    e.readied &&
    ((phase === "fight" &&
      ["rendax", "dacatarai", "kaptaris"].includes(e.katah)) ||
      (phase === "shoot" && e.katah === "salvus"))
    ? e.katah
    : "none";
}
export function effectiveAttack(attacker, defender, phase) {
  const attackRules = collectRules(attacker, phase),
    defenceRules = collectRules(defender, phase);
  const ar = attackRules.values,
    dr = defenceRules.values;
  const a = { ...EFFECT_DEFAULTS, ...attacker.effects },
    b = { ...EFFECT_DEFAULTS, ...defender.effects },
    w = { ...attacker.weapon },
    applied = [];
  applied.push(
    ...attackRules.labels.map((name) => `${name} (selected components)`),
    ...defenceRules.labels.map(
      (name) => `Target: ${name} (selected components)`,
    ),
  );
  for (const key of [
    "skillBonus",
    "strengthBonus",
    "attacksBonus",
    "apBonus",
    "damageBonus",
  ])
    a[key] += ar[key] ?? 0;
  for (const key of [
    "incomingHitMod",
    "incomingWoundMod",
    "apReduction",
    "damageReduction",
  ])
    b[key] += dr[key] ?? 0;
  a.lethalHits ||= !!ar.lethalHits;
  a.sustainedHits = Math.max(a.sustainedHits, ar.sustainedHits ?? 0);
  a.criticalHit = Math.min(a.criticalHit, ar.criticalHit ?? 6);
  a.ignoreHitMods ||= !!ar.ignoreHitMods;
  a.ignoreWoundMods ||= !!ar.ignoreWoundMods;
  w.hitMod += ar.hitMod ?? 0;
  w.woundMod += ar.woundMod ?? 0;
  const rerollBest = (x, y) =>
    x === "failed" || y === "failed"
      ? "failed"
      : x === "ones" || y === "ones"
        ? "ones"
        : "none";
  w.hitReroll = rerollBest(w.hitReroll, ar.hitReroll);
  w.woundReroll = rerollBest(w.woundReroll, ar.woundReroll);
  const stance = active(attacker, phase),
    defence = active(defender, phase),
    big = ["monster", "vehicle"].includes(b.targetType);
  let lethal = a.lethalHits,
    sustained = a.sustainedHits,
    reroll = w.hitReroll;
  if (
    a.custodes &&
    a.captainGeneral &&
    !["monster", "vehicle"].includes(a.targetType)
  ) {
    if (reroll === "none") reroll = "ones";
    if (w.woundReroll === "none") w.woundReroll = "ones";
    applied.push("Captain-General: re-roll hit and wound 1s");
  }
  if (attacker.guardCodex && a.impenetrableDefence && !big) {
    sustained = Math.max(sustained, 1);
    applied.push("Impenetrable Defence: Sustained Hits 1");
  }
  if (stance === "rendax" && big) {
    lethal = true;
    applied.push("Rendax: Lethal Hits");
  }
  if (stance === "dacatarai" && !big) {
    if (reroll === "none") reroll = "ones";
    applied.push("Dacatarai: re-roll hit 1s");
  }
  const ignoreHit = a.ignoreHitMods || stance === "salvus",
    ignoreWound = a.ignoreWoundMods || stance === "salvus";
  if (stance === "salvus")
    applied.push("Salvus: BS, hit and wound modifiers ignored");
  if (defence === "kaptaris") applied.push("Target Kaptaris: −1 to hit");
  w.hit = clamp(w.hit - (stance === "salvus" ? 0 : a.skillBonus), 2, 6);
  w.strength = clamp(w.strength + a.strengthBonus, 1, 100);
  w.ap = clamp(w.ap - a.apBonus + b.apReduction, -10, 0);
  w.hitMod = ignoreHit
    ? 0
    : clamp(
        w.hitMod + b.incomingHitMod - (defence === "kaptaris" ? 1 : 0),
        -1,
        1,
      );
  w.woundMod = ignoreWound ? 0 : clamp(w.woundMod + b.incomingWoundMod, -1, 1);
  w.hitReroll = reroll;
  if (attacker.effects?.lethalHits) applied.push("Lethal Hits (manual)");
  if (attacker.effects?.sustainedHits)
    applied.push(`Sustained Hits ${attacker.effects.sustainedHits} (manual)`);
  if (a.skillBonus && stance !== "salvus")
    applied.push(
      `BS/WS improvement ${a.skillBonus > 0 ? "+" : ""}${a.skillBonus}`,
    );
  if (a.strengthBonus)
    applied.push(
      `Strength ${a.strengthBonus > 0 ? "+" : ""}${a.strengthBonus}`,
    );
  if (a.attacksBonus) applied.push(`Attacks per bearer +${a.attacksBonus}`);
  if (a.apBonus) applied.push(`AP improvement +${a.apBonus}`);
  if (a.damageBonus) applied.push(`Damage +${a.damageBonus}`);
  if (b.incomingHitMod)
    applied.push(`Incoming hit modifier ${b.incomingHitMod}`);
  if (b.incomingWoundMod)
    applied.push(`Incoming wound modifier ${b.incomingWoundMod}`);
  if (b.apReduction) applied.push(`Target worsens AP by ${b.apReduction}`);
  if (b.damageReduction)
    applied.push(`Target reduces damage by ${b.damageReduction} (minimum 1)`);
  if (a.ignoreHitMods && stance !== "salvus")
    applied.push("Hit modifiers ignored");
  if (a.ignoreWoundMods && stance !== "salvus")
    applied.push("Wound modifiers ignored");
  if (a.criticalHit !== 6) applied.push(`Critical hits on ${a.criticalHit}+`);
  return {
    weapon: w,
    lethalHits: lethal,
    sustainedHits: sustained,
    criticalHit: a.criticalHit,
    attacksBonus:
      a.attacksBonus +
      (ar.rapidFire ?? 0) +
      (ar.blast ?? 0) * Math.floor(defender.models / 5),
    damageBonus: a.damageBonus + (ar.melta ?? 0),
    damageReduction: b.damageReduction,
    singleHitReroll: ar.singleHitReroll ?? 0,
    singleWoundReroll: ar.singleWoundReroll ?? 0,
    devastatingWounds: !!ar.devastatingWounds,
    torrent: !!ar.torrent,
    criticalWound:
      ar[
        {
          infantry: "antiInfantry",
          monster: "antiMonster",
          vehicle: "antiVehicle",
        }[b.targetType]
      ] ?? 6,
    defender: {
      ...defender,
      toughness: clamp(
        defender.toughness + (ar.targetToughnessBonus ?? 0),
        1,
        100,
      ),
      save: clamp(defender.save + (ar.targetSaveBonus ?? 0), 2, 7),
      invuln: Math.min(defender.invuln, dr.invuln ?? 7),
      fnp: Math.min(defender.fnp, dr.fnp ?? 7),
      cover:
        !ar.ignoresCover &&
        (defender.cover || (phase === "shoot" && dr.stealth)),
    },
    applied,
  };
}
