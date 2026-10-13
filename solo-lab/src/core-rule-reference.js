import { escapeHtml as esc } from "./ui-html.js";
import { weaponRule } from "./rule-effects.js";

// Short reference notes; neither these cards nor their visibility grant eligibility.
const keywordNotes = [
  [/^Lance$/i, "Charge this turn: +1 wound roll."],
  [/^Heavy$/i, "Unengaged, not newly set up, moved ≤3 inches: +1 hit."],
  [/^Lethal Hits$/i, "Critical hits can auto-wound."],
  [/^Sustained Hits \d+$/i, "Critical hits generate extra hits."],
  [/^Devastating Wounds$/i, "Critical wounds bypass saves; no damage spillover."],
  [/^Twin.linked$/i, "Re-roll wounds."],
  [/^Torrent$/i, "Automatic hits; no critical hits."],
  [/^Ignores Cover$/i, "Target loses cover."],
  [/^Anti-.+ \d\+$/i, "Listed target: listed wound threshold becomes critical."],
  [/^Blast(?: \d+)?$/i, "Extra attacks per five target models."],
  [/^Cleave(?: \d+)?$/i, "Single target: extra attacks per five models."],
  [/^(Rapid Fire|Melta) \d+$/i, "Bonus within half range."],
  [/^Precision$/i, "Character allocation: check visibility."],
];

export function weaponReference(keywords, conditions = {}) {
  return keywords.split(",").map((value) => value.trim()).filter(Boolean).map((name) => {
    const note = keywordNotes.find(([pattern]) => pattern.test(name))?.[1];
    const calculated = !weaponRule(name, conditions).unsupported.length;
    return `<details class="rule-reference-card"><summary>${esc(name)} <span>${calculated ? "Calculated · conditions apply" : "Reference only"}</span></summary><p>${esc(note ?? "This ability’s conditions need review.")}</p></details>`;
  }).join("");
}

const stratagems = [
  { name: "Command Re-roll", cp: 1, phase: "any", when: "After an eligible roll.", note: "Re-roll one die; charge rolls in full." },
  { name: "Epic Challenge", cp: 1, phase: "fight", keyword: "Character", when: "After selection to fight.", note: "One Character gains melee Precision." },
  { name: "Insane Bravery", cp: 1, phase: "command", when: "Before Battle-shock.", note: "Automatic success; once per battle." },
  { name: "Explosives", cp: 1, phase: "shoot", anyKeywords: ["Explosives", "Grenades"], when: "Unengaged, eligible, no Advance.", note: "Visible, unengaged target within 8 inches; six dice, 4+ mortals." },
  { name: "Crushing Impact", cp: 1, phase: "charge", anyKeywords: ["Monster", "Vehicle"], when: "After charging.", note: "Engaged target; Toughness dice. Check mortal-wound sequence." },
  { name: "Rapid Ingress", cp: 1, phase: "movement", exclude: "Aircraft", when: "Opponent’s Movement ends.", note: "Reserves ingress; not round one." },
  { name: "Fire Overwatch", cp: 1, phase: "movement", exclude: "Titanic", when: "Opponent’s Movement ends.", note: "Unengaged; snap shooting restrictions apply." },
  { name: "Smokescreen", cp: 1, phase: "shoot", keyword: "Smoke", when: "Opponent’s Shooting starts.", note: "Cover; check screening visibility." },
  { name: "Heroic Intervention", cp: "1–2", phase: "charge", when: "Opponent’s Charge ends.", note: "Unengaged, within 12 inches; check modes and Vehicle restrictions.", vehicleRestriction: true },
  { name: "Counteroffensive", cp: 2, phase: "fight", when: "Opponent’s Fight step, after enemy attacks.", note: "Eligible unit gains Fights First; select next." },
];

export function eligibleCoreStratagems(unit) {
  const has = (keyword) => unit?.categories?.includes(keyword);
  return stratagems.filter((rule) =>
    (!rule.keyword || has(rule.keyword)) &&
    (!rule.anyKeywords || rule.anyKeywords.some(has)) &&
    (!rule.exclude || !has(rule.exclude)) &&
    (!rule.vehicleRestriction || !has("Vehicle") || has("Character") || has("Walker")));
}

export function coreStratagemReference(unit, phase) {
  const candidates = eligibleCoreStratagems(unit);
  const phaseLabels = { any: "Any phase", shoot: "Shooting", fight: "Fight", command: "Command", charge: "Charge", movement: "Movement" };
  const card = (rule) => `<details class="rule-reference-card"><summary>${esc(rule.name)} <span>${esc(rule.cp)} CP · ${esc(phaseLabels[rule.phase])}</span></summary><p>${esc(rule.when)} ${esc(rule.note)}</p><small>Reference only · check target, timing and CP.</small></details>`;
  return `<div class="core-stratagem-reference"><p class="fine">Core Stratagems · 11th edition. Keyword matches only; battlefield conditions still apply.</p>${candidates.filter((rule) => rule.phase === "any" || rule.phase === phase).map(card).join("")}<details data-panel="other-core-phases"><summary>Other phases</summary>${candidates.filter((rule) => rule.phase !== "any" && rule.phase !== phase).map(card).join("")}</details></div>`;
}
