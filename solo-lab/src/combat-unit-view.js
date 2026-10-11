import { escapeHtml as esc, option as opt } from "./ui-html.js";
import { rulePicker } from "./rule-picker.js";
import { KATAHS, KATAH_SOURCE } from "./combat-effects.js";
import { combatModelMax } from "./unit-limits.js";

export function weaponProfiles(unit, phase) {
  return (unit?.profiles ?? []).filter(
    (p) => p.type === (phase === "fight" ? "Melee Weapons" : "Ranged Weapons"),
  );
}
export function abilityCount(u) {
  return (
    (u.ruleSelections?.length ?? 0) +
    (u.effects.katah !== "none" ? 1 : 0) +
    (u.weaponRules ? 1 : 0) +
    (u.effects.captainGeneral ? 1 : 0) +
    (u.effects.impenetrableDefence ? 1 : 0)
  );
}
export function weaponSummary(u, phase) {
  const w = u.weapon;
  return `${w.attacks} A · ${w.hit}+ ${phase === "fight" ? "WS" : "BS"} · S ${w.strength} · AP ${w.ap} · D ${w.damage}`;
}
function field(i, k, label, value, min, max, type = "number") {
  return `<label>${label}<input data-field="${k}" aria-label="Unit ${i ? "B" : "A"} ${label}" type="${type}" ${type === "number" ? `min="${min}" max="${max}" step="1"` : ""} value="${esc(value)}"></label>`;
}
function select(i, k, label, values, value) {
  return `<label>${label}<select data-field="${k}" aria-label="Unit ${i ? "B" : "A"} ${label}">${values.map(([v, l]) => opt(v, l, value)).join("")}</select></label>`;
}
function effectsPanel(i, u, pick, phase) {
  const e = u.effects,
    check = (key, label) =>
      `<label class="check"><input data-field="effects.${key}" aria-label="Unit ${i ? "B" : "A"} ${label}" type="checkbox" ${e[key] ? "checked" : ""}>${label}</label>`;
  const custodes = pick.data?.name === "Adeptus Custodes";
  return `<section class="effects-panel">
 ${custodes ? `<div class="katah-panel"><label>Martial Ka’tah<select data-field="effects.katah" aria-label="Unit ${i ? "B" : "A"} Martial Ka’tah">${KATAHS.map(([id, label]) => opt(id, label, e.katah)).join("")}<option disabled>Conservai — actions (outside this calculator)</option><option disabled>Calistus — movement (outside this calculator)</option></select></label><div class="katah-checks">${check("katahEligible", "Unit has Martial Ka’tah")}${check("readied", "Unit is readied")}</div><details class="rule-explanation" data-panel="katah-notes"><summary>Rule notes & source</summary><p class="fine">Codex preview rules (optional scenario). Only one Ka’tah is selected; phase and target conditions are checked. Eligibility and readiness are your scenario assumptions. <a href="${KATAH_SOURCE}" target="_blank" rel="noreferrer">Rule source ↗</a></p></details></div><div class="katah-checks">${check("custodes", "Unit has ADEPTUS CUSTODES keyword")}${check("captainGeneral", "Trajann’s Captain-General aura (within 6 inches)")}${u.guardCodex ? check("impenetrableDefence", "Impenetrable Defence: either unit is in range of an objective") : ""}</div><details class="rule-explanation" data-panel="custodes-notes"><summary>Aura notes & data sources</summary><p class="fine">Captain-General grants hit and wound re-rolls of 1 to eligible Custodes, excluding Monsters and Vehicles. Confirm aura range yourself. Impenetrable Defence grants Sustained Hits 1 against other targets; repeated Sustained Hits effects use the highest value.</p><p class="data-warning">${u.guardCodex ? "Guard uses the September preview: T7, W5, Guardian Spear A6 / S8 in melee. Squads contain 3 models; larger counts here are experimental. Assault movement is outside this calculator; enable weapon keywords for Rapid Fire." : "This profile uses the same catalogue as Army Lists."} Other Custodes and Army Lists still use the older snapshot. <a href="https://www.warhammer-community.com/en-gb/articles/2xxurx9j/first-look-adeptus-custodes-datasheets/" target="_blank" rel="noreferrer">Datasheet and aura source ↗</a></p></details>` : ""}
 ${rulePicker(i, u, pick, esc, phase)}<div class="defence-fields">${select(
   i,
   "effects.targetType",
   "Unit target type",
   [
     ["infantry", "Infantry"],
     ["monster", "Monster"],
     ["vehicle", "Vehicle"],
     ["other", "Other"],
   ],
   e.targetType,
 )}${select(
   i,
   "effects.sustainedHits",
   "Sustained Hits",
   [
     [0, "None"],
     [1, "1"],
     [2, "2"],
     [3, "3"],
   ],
   e.sustainedHits,
 )}${select(
   i,
   "effects.criticalHit",
   "Critical Hit",
   [
     [6, "6+"],
     [5, "5+"],
     [4, "4+"],
   ],
   e.criticalHit,
 )}</div><div class="keyword-checks">${check("lethalHits", "Lethal Hits")}</div>
 <details class="modifiers" data-panel="effect-modifiers"><summary>Buffs, debuffs and defensive effects</summary><div class="defence-fields">${select(
   i,
   "effects.skillBonus",
   "BS/WS improvement",
   [
     [-2, "Worsen by 2"],
     [-1, "Worsen by 1"],
     [0, "None"],
     [1, "Improve by 1"],
     [2, "Improve by 2"],
   ],
   e.skillBonus,
 )}${field(i, "effects.strengthBonus", "Strength bonus", e.strengthBonus, -5, 5)}${field(i, "effects.attacksBonus", "Extra A per model", e.attacksBonus, 0, 5)}${field(i, "effects.apBonus", "AP improvement", e.apBonus, 0, 3)}${field(i, "effects.damageBonus", "Extra damage", e.damageBonus, 0, 5)}${select(i, "effects.incomingHitMod", "Enemy hit rolls", mods, e.incomingHitMod)}${select(i, "effects.incomingWoundMod", "Enemy wound rolls", mods, e.incomingWoundMod)}${field(i, "effects.apReduction", "Worsen incoming AP", e.apReduction, 0, 3)}${field(i, "effects.damageReduction", "Reduce incoming damage", e.damageReduction, 0, 5)}</div>${check("ignoreHitMods", "Ignore hit roll modifiers")}${check("ignoreWoundMods", "Ignore wound roll modifiers")}${field(i, "effects.note", "Ability or aura note", e.note, null, null, "text")}<p class="fine">Manual effects apply in the selected phase. Your note labels them; it does not activate a rule. Check aura range and eligibility yourself. Damage reduction has a minimum of 1; hit and wound modifiers are capped at ±1.</p></details></section>`;
}
const saves = [
    [2, "2+"],
    [3, "3+"],
    [4, "4+"],
    [5, "5+"],
    [6, "6+"],
    [7, "None"],
  ],
  mods = [
    [-1, "−1"],
    [0, "None"],
    [1, "+1"],
  ],
  rerolls = [
    ["none", "None"],
    ["ones", "Re-roll 1s"],
    ["failed", "Re-roll failed"],
  ];

function panel(key, className, title, content) {
  return `<details class="${className}" data-panel="${key}"><summary>${title}</summary>${content}</details>`;
}

function defenceFields(i, u, pick, source, phase) {
  const profiles = (source?.profiles ?? []).filter(
    (p) => p.type === "Unit" && (!u.guardCodex || p.id === pick.profile),
  );
  return `<label>Defensive profile<select data-profile aria-label="Unit ${i ? "B" : "A"} defensive profile">${profiles.map((p) => opt(p.id, u.guardCodex ? "Guard Sodality · September preview" : p.name, pick.profile)).join("")}</select></label>
   <div class="characteristics">${field(i, "toughness", "T", u.toughness, 1, 100)}${select(i, "save", "Sv", saves, u.save)}${field(i, "wounds", "W per model", u.wounds, 1, 100)}</div>
   <div class="defence-fields">${select(i, "invuln", "Invulnerable Save", saves, u.invuln)}${select(i, "fnp", "Feel No Pain", saves, u.fnp)}${field(i, "frontWounds", "Wounds left on first model", u.frontWounds, 1, u.wounds)}</div>
   <label class="check"><input data-field="cover" type="checkbox" ${u.cover ? "checked" : ""} ${phase === "fight" ? "disabled" : ""}> Benefit of Cover (shooting only)</label>`;
}

function weaponFields(i, u, phase) {
  const w = u.weapon;
  return `<div class="weapon-fields">${field(i, "bearers", "Models using weapon", u.bearers, 0, u.models)}${field(i, "weapon.attacks", "A per model", w.attacks, null, null, "text")}${field(i, "weapon.hit", phase === "fight" ? "WS" : "BS", w.hit, 2, 6)}${field(i, "weapon.strength", "S", w.strength, 1, 100)}${field(i, "weapon.ap", "AP", w.ap, -10, 0)}${field(i, "weapon.damage", "D", w.damage, null, null, "text")}</div>
   <p class="fine">A and D accept numbers or dice: D3, D6, 2D6+1. Edit profile values for your experiment.</p>
   ${panel("weapon-modifiers", "modifiers", "Modifiers and re-rolls", `<div class="defence-fields">${select(i, "weapon.hitMod", "Hit modifier", mods, w.hitMod)}${select(i, "weapon.woundMod", "Wound modifier", mods, w.woundMod)}${select(i, "weapon.hitReroll", "Hit re-rolls", rerolls, w.hitReroll)}${select(i, "weapon.woundReroll", "Wound re-rolls", rerolls, w.woundReroll)}</div><p class="fine">Manual effects only. These controls do not activate a named ability or Stratagem.</p>`)}`;
}

export function renderUnitCard(
  i,
  u,
  pick,
  { factions, phase, first, experiment = false },
) {
  const source = pick.data?.units.find((unit) => unit.id === pick.unit);
  const query = pick.search ?? "";
  const filtered = (pick.data?.units ?? []).filter(
    (unit) =>
      unit.id === pick.unit ||
      (!unit.legend &&
        !unit.narrative &&
        !unit.allied &&
        unit.profiles.some((p) => p.type === "Unit") &&
        unit.name.toLowerCase().includes(query.toLowerCase())),
  );
  const count = abilityCount(u);
  const maximum = source ? combatModelMax(source, u, experiment) : 100;
  return `<div class="panel-top"><span class="eyebrow">UNIT ${i ? "B" : "A"} / ${i === first ? "ATTACKS FIRST" : "TARGET"}</span><span class="small-tag">${esc(pick.data?.name ?? "CUSTOM")}</span></div>
   <div class="unit-body"><div class="unit-picker">
    <label>Faction<select data-faction aria-label="Unit ${i ? "B" : "A"} faction">${factions.map((f) => opt(f.id, f.name, pick.faction)).join("")}</select></label>
    <label>Unit<select data-unit aria-label="Unit ${i ? "B" : "A"} unit">${filtered.map((unit) => opt(unit.id, unit.name, pick.unit)).join("")}</select></label>
    ${panel("catalogue-tools", "catalogue-tools", "Search units / saved army", `<label>Search units<input data-search aria-label="Unit ${i ? "B" : "A"} search units" type="search" placeholder="Search catalogue…" value="${esc(query)}"></label><button data-saved class="mini">Choose from saved armies →</button><div id="saved-${i}"></div>`)}
   </div>
   ${pick.data?.name === "Adeptus Custodes" && source?.name === "Custodian Guard" ? `<div class="model-limit-note">${u.guardCodex ? 'Codex preview · 3 models <button data-guard-reset class="mini">Use catalogue profile</button>' : '<button data-guard-update class="mini">Try Codex preview · 3 models</button>'}</div>` : ""}
   <div class="unit-basics">${field(i, "models", "Models", u.models, 1, source ? combatModelMax(source, u, experiment) : 100)}<div class="model-tokens"><span aria-hidden="true">✠</span><b class="profile-badges">T ${esc(u.toughness)} <i>·</i> Sv ${u.save > 6 ? "—" : esc(u.save) + "+"} <i>·</i> W ${esc(u.wounds)}</b></div></div>
   <small class="model-limit-note">${experiment ? "Experimental · up to 100 models" : `Maximum ${maximum} ${maximum === 1 ? "model" : "models"}${maximum > 1 ? " · fewer for casualties" : ""}`}</small>
   <label>Weapon<select data-weapon aria-label="Unit ${i ? "B" : "A"} weapon">${weaponProfiles(
     source,
     phase,
   )
     .filter((p) => !u.guardCodex || p.name === "Guardian Spear")
     .map((p) => opt(p.id, p.name, pick.weapon))
     .join("")}${opt("", "Custom profile", pick.weapon)}</select></label>
   ${panel("weapon-edit", "weapon-edit", `Weapon stats <span>${esc(weaponSummary(u, phase))}</span>`, weaponFields(i, u, phase))}
   ${panel("profile-edit", "profile-edit", "Defence & wounds", defenceFields(i, u, pick, source, phase))}
   ${panel("unit-abilities", "unit-abilities", `Abilities & auras <span>${count ? count + " selected" : "Optional"}</span>`, effectsPanel(i, u, pick, phase))}
   <div id="effects-summary-${i}" class="effects-summary" aria-live="polite"></div>
   ${panel("unit-calculation", "unit-calculation", "Attack calculation", `<div class="sequence-preview" id="preview-${i}"></div>`)}
  </div>`;
}
