import { weaponRule } from "./rule-effects.js";
const effectLabels = {
  singleHitReroll: "One failed Hit re-roll",
  singleWoundReroll: "One failed Wound re-roll",
  lethalHits: "Lethal Hits",
  sustainedHits: "Sustained Hits",
  devastatingWounds: "Devastating Wounds",
  ignoresCover: "Ignores Cover",
  stealth: "Stealth (shooting cover)",
  torrent: "Torrent",
  hitReroll: "Hit re-rolls",
  woundReroll: "Wound re-rolls",
  skillBonus: "BS/WS improvement",
  strengthBonus: "Strength bonus",
  attacksBonus: "Extra attacks per bearer",
  apBonus: "AP improvement",
  damageBonus: "Damage bonus",
  hitMod: "Hit roll modifier",
  woundMod: "Wound roll modifier",
  incomingHitMod: "Enemy hit roll modifier",
  incomingWoundMod: "Enemy wound roll modifier",
  fnp: "Feel No Pain",
  invuln: "Invulnerable Save",
  targetToughnessBonus: "Enemy Toughness modifier",
  targetSaveBonus: "Worsen enemy Save",
};
export function prepareRules(u, pick, phase) {
  const library = pick.data.combatRules;
  u.ruleSelections ??= [];
  u.rulesConfirmed ??= false;
  const choices = u.ruleSelections.map((id) => {
    const r = library.definitions[id];
    if (!r || !Object.hasOwn(library.groups, id) || r.status !== "components")
      throw Error("Scenario contains an unavailable combat rule.");
    if (u.guardCodex && library.units[pick.unit]?.includes(id))
      throw Error(
        "Older Guard abilities cannot be combined with the September Guard profile.",
      );
    if (
      pick.data.name === "Adeptus Custodes" &&
      /Martial Ka|Captain.General/.test(r.name)
    )
      throw Error("Use the verified Custodes controls for this rule.");
    const keys = u.ruleComponents?.[id] ?? Object.keys(r.effects);
    if (
      !Array.isArray(keys) ||
      new Set(keys).size !== keys.length ||
      keys.some((k) => !Object.hasOwn(r.effects, k))
    )
      throw Error("Invalid rule component selection.");
    return {
      name: r.name,
      phase: r.phase,
      effects: Object.fromEntries(keys.map((k) => [k, r.effects[k]])),
    };
  });
  const chosen = u.ruleSelections.map((id) => library.definitions[id]);
  const groups = new Set();
  for (const r of chosen)
    if (r.exclusive) {
      if (groups.has(r.exclusive))
        throw Error("Mutually exclusive army-rule options selected.");
      groups.add(r.exclusive);
    }
  if (
    chosen.some((r) => /Doctrina Imperatives.*Protector/.test(r.name)) &&
    chosen.some((r) => /Doctrina Imperatives.*Conqueror/.test(r.name))
  )
    throw Error("Choose Protector or Conqueror, not both.");
  if (u.weaponRules)
    choices.push(
      weaponRule(
        u.guardCodex
          ? phase === "shoot" &&
            !!pick.weapon &&
            u.weapon.name === "Guardian Spear"
            ? "Assault, Rapid Fire 2"
            : ""
          : (library.weapons[pick.weapon] ?? ""),
        u.weaponConditions,
      ),
    );
  u.ruleEffects = choices
    .filter((r) => Object.keys(r.effects).length)
    .map(({ name, phase, effects }) => ({
      name,
      phase,
      effects,
    }));
}
export function rulePicker(i, u, pick, esc, phase) {
  const library = pick.data.combatRules,
    own = new Set(library.units[pick.unit] ?? []),
    query = (pick.ruleSearch ?? "").toLowerCase();
  const all = Object.keys(library.groups).map((id) => library.definitions[id]);
  const candidates = all
    .filter(
      (r) =>
        (pick.ruleScope === "all" ||
          own.has(r.id) ||
          library.groups[r.id] === "army") &&
        r.name.toLowerCase().includes(query),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const old = (r) =>
    (u.guardCodex && own.has(r.id)) ||
    (pick.data.name === "Adeptus Custodes" &&
      /Martial Ka|Captain.General/.test(r.name));
  const source = (r) =>
    `https://github.com/BSData/wh40k-11e/blob/${library.commit}/${encodeURIComponent(r.source.file)}`;
  const label = (r) =>
    Object.entries(r.effects)
      .map(
        ([k, v]) =>
          `${effectLabels[k] ?? k}${v === true ? "" : ": " + (v === "failed" ? "re-roll failed" : v === "ones" ? "re-roll 1s" : v)}`,
      )
      .join(" · ");
  const selected = (u.ruleSelections ?? [])
    .map((id) => library.definitions[id])
    .filter(Boolean);
  const check = (key, text, value) =>
    `<label class="check"><input type="checkbox" data-rule-check="${key}" aria-label="Unit ${i ? "B" : "A"} ${esc(text)}" ${value ? "checked" : ""}>${esc(text)}</label>`;
  const keywords = u.guardCodex
    ? u.weapon.name === "Guardian Spear" && phase === "shoot"
      ? "Assault, Rapid Fire 2"
      : ""
    : (library.weapons[pick.weapon] ?? "");
  const parsed = weaponRule(keywords, u.weaponConditions);
  return `<details class="rule-library" data-panel="rule-library"><summary>Army & unit abilities</summary><details class="rule-explanation" data-panel="rule-data"><summary>Data & eligibility</summary><p class="fine">Community snapshot, 9 October 2026; not fully reconciled with current Codexes. Only the listed effects apply. Check eligibility, target, Leader, bearer, range and costs.</p></details><div class="defence-fields"><label>Show rules<select data-rule-scope aria-label="Unit ${i ? "B" : "A"} rule scope"><option value="unit" ${pick.ruleScope !== "all" ? "selected" : ""}>This unit and army rules</option><option value="all" ${pick.ruleScope === "all" ? "selected" : ""}>All faction source entries / auras</option></select></label><label>Find an ability<input type="search" data-rule-search aria-label="Unit ${i ? "B" : "A"} find an ability" value="${esc(pick.ruleSearch ?? "")}" placeholder="Oath, order, aura…"></label></div><label>Named rule<select data-rule-choice aria-label="Unit ${i ? "B" : "A"} named rule"><option value="">Choose an ability…</option>${candidates.map((r) => `<option value="${esc(r.id)}" ${r.status !== "components" || old(r) ? "disabled" : ""}>${esc(r.name)} · ${old(r) ? "older profile / use verified controls" : r.status === "components" ? "calculated effects" : "reference only"}</option>`).join("")}</select></label><div class="selected-rules">${selected
    .map(
      (r) =>
        `<article><strong>${esc(r.name)}</strong><button class="mini" data-rule-remove="${esc(r.id)}" aria-label="Remove ${esc(r.name)} from Unit ${i ? "B" : "A"}">Remove ×</button><p>${r.phase === "both" ? "Shooting / Fight" : r.phase === "fight" ? "Fight" : "Shooting"} phase</p>${Object.entries(
          r.effects,
        )
          .map(
            ([key, value]) =>
              `<label class="check"><input type="checkbox" data-rule-component="${esc(r.id)}" data-component-key="${key}" aria-label="Unit ${i ? "B" : "A"} ${esc(r.name)} ${esc(effectLabels[key] ?? key)}" ${(u.ruleComponents?.[r.id] ?? Object.keys(r.effects)).includes(key) ? "checked" : ""}>${esc(label({ effects: { [key]: value } }))}</label>`,
          )
          .join(
            "",
          )}<details class="rule-explanation" data-panel="rule-condition-${esc(r.id)}"><summary>Conditions & source</summary><p>${r.limitations.map(esc).join(" ")}</p><a target="_blank" rel="noreferrer" href="${source(r)}">Source ↗</a></details></article>`,
    )
    .join(
      "",
    )}</div>${check("rulesConfirmed", "Confirm all selected rule conditions and availability", u.rulesConfirmed)}<p class="fine">Unchecked means selected rules and weapon keywords are inactive. Repeated keywords and re-rolls do not stack. Different numerical bonuses combine before caps. Disable effects whose conditions are not met. A limited re-roll is used on the first eligible failed roll.</p><details class="reference-rules" data-panel="reference-rules"><summary>Reference entries / omitted mechanics (${candidates.filter((r) => r.status === "reference" || old(r)).length})</summary>${candidates
    .filter((r) => r.status === "reference" || old(r))
    .map(
      (r) =>
        `<p><strong>${esc(r.name)}</strong> — ${old(r) ? "Older data; use verified controls where available." : esc(r.summary)} <a target="_blank" rel="noreferrer" href="${source(r)}">Source ↗</a></p>`,
    )
    .join(
      "",
    )}</details></details><details class="weapon-rule-panel" data-panel="weapon-rules"><summary>Weapon keywords${keywords ? " · " + esc(keywords) : " · none in this profile"}</summary>${check("weaponRules", "Apply supported weapon keywords", u.weaponRules)}${check("halfRange", "Target is within half weapon range", u.weaponConditions?.halfRange)}${check("heavyEligible", "Heavy: unengaged, not set up this turn, moved at most 3 inches", u.weaponConditions?.heavyEligible)}${check("charged", "Attacking unit made a charge move this turn", u.weaponConditions?.charged)}<p class="fine">${parsed.unsupported.length ? "Not calculated: " + esc(parsed.unsupported.join(", ")) + ". " : ""}Hazardous tests, Precision allocation, Cleave and extra weapon profiles are not resolved. Torrent has no hit dice or critical hits. Lethal Hits always auto-wound; those wounds cannot trigger Devastating Wounds.</p></details>`;
}
