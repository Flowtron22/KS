import "./battle.css";
import "./combat.css";
import {
  validateScenario,
  seeded,
  runScenario,
  woundTarget,
  saveTarget,
} from "./combat.js";

const $ = (id) => document.getElementById(id),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const num = (s) => (/^\d+\+?$/.test(String(s ?? "")) ? parseInt(s) : null);
const opt = (v, label, selected) =>
  `<option value="${esc(v)}" ${String(v) === String(selected) ? "selected" : ""}>${esc(label)}</option>`;
const baseWeapon = {
  name: "Custom weapon",
  attacks: "1",
  hit: 3,
  strength: 4,
  ap: 0,
  damage: "1",
  hitMod: 0,
  woundMod: 0,
  hitReroll: "none",
  woundReroll: "none",
};
let index,
  cache = new Map(),
  picks = [{}, {}],
  scenario = {
    phase: "fight",
    first: 0,
    fightBack: true,
    seed: 40000,
    units: [],
  },
  busy = false,
  worker,
  results = null,
  lastRoll = null,
  armyMounted = false;
const weapons = (u) =>
  (u?.profiles ?? []).filter(
    (p) =>
      p.type ===
      (scenario.phase === "fight" ? "Melee Weapons" : "Ranged Weapons"),
  );
$("app").innerHTML =
  `<header><a class="brand" href="#"><span class="brand-seal">✠</span><span>40K<span class="brand-sub">COMBAT LAB</span></span></a><nav aria-label="Workspace"><button id="combat-tab" class="nav active">Combat calculator</button><button id="army-tab" class="nav">Army Lists</button></nav><span class="version"><i></i> EXPERIMENT</span></header>
<main><div class="page-heading"><div><div class="eyebrow">ONE PHASE / TWO UNITS</div><h1 id="title">WHAT DOES YOUR UNIT DO?</h1><p id="description">Pick a matchup. Roll the attacks. Find out how often it works.</p></div><div class="heading-actions"><button id="save-scenario" class="button">Save scenario</button><button id="load-scenario" class="button">Load saved</button><button id="example" class="button dark">Custodes vs Lancer</button></div></div><div id="notice" role="status" aria-live="polite"></div>
<section id="combat-view"><div class="scenario-bar panel"><div class="phase-switch"><button id="fight" class="active">Fight phase</button><button id="shoot">Shooting phase</button></div><label>Attacks first<select id="first"><option value="0">Unit A</option><option value="1">Unit B</option></select></label><label class="check"><input id="fight-back" type="checkbox" checked> Survivors fight back</label><button id="swap" class="button">Swap units ⇄</button></div>
<div class="matchup"><section id="unit-0" class="panel combat-unit"></section><div class="versus">VS</div><section id="unit-1" class="panel combat-unit"></section></div>
<section class="rules-note"><strong>What this calculates</strong><p>One weapon profile per unit, shared by the chosen weapon bearers. All models in a unit use the same Toughness, Save and Wounds. Normal damage does not spill between models. Fight back uses surviving models, with selected weapon bearers surviving first. Each run starts fresh.</p><p><b>Abilities, weapon keywords, Detachments, Enhancements and Stratagems are not applied automatically.</b> Set supported effects manually. Range, charges, engagement and fight order are assumed.</p></section>
<div class="experiment-controls panel"><label>Random seed<input id="seed" type="number" min="0" max="4294967295" value="40000"></label><button id="new-seed" class="mini">New seed ↻</button><label>Dice animation<select id="pace"><option value="normal">Normal</option><option value="fast">Fast</option><option value="instant">Instant</option></select></label><button id="roll" class="button orange">⚄ Roll attacks</button><label>Number of simulations<select id="trials"><option value="1000">1,000</option><option value="10000" selected>10,000</option><option value="50000">50,000</option></select></label><button id="simulate" class="button dark">Run simulations →</button></div>
<div class="experiment-output"><section class="panel"><div class="panel-top"><span class="eyebrow">ATTACK SEQUENCE</span><button id="export-roll" class="mini" disabled>Export rolls JSON</button></div><div id="dice-output" aria-live="polite"></div></section><section class="panel"><div class="panel-top"><span class="eyebrow">SIMULATION RESULTS</span><button id="export-results" class="mini" disabled>Export results JSON</button></div><div id="results" aria-live="polite"></div></section></div><div class="scenario-files"><button id="export-scenario" class="mini">Export scenario JSON</button><label class="import-label">Import scenario JSON<input id="import-scenario" type="file" accept="application/json" hidden></label></div></section>
<section id="army-view" hidden><div id="army-builder-root"></div></section><footer><span>40K COMBAT LAB · PROTOTYPE</span><span>Community stat snapshot · 9 Oct 2026 · points not officially verified</span><a href="https://github.com/BSData/wh40k-11e/tree/cc58ee3b2c23f90af9d00e7bf234cd703b762299" target="_blank" rel="noreferrer">Data source ↗</a></footer></main>`;
function notice(s) {
  $("notice").textContent = s;
}
async function catalogue(id) {
  if (cache.has(id)) return cache.get(id);
  const f = index.factions.find((f) => f.id === id);
  if (!f) throw Error("Unknown faction.");
  const res = await fetch("/armies/" + f.file);
  if (!res.ok) throw Error("Could not load faction.");
  const d = await res.json();
  cache.set(id, d);
  return d;
}
function applyWeapon(i) {
  const u = picks[i].data?.units.find((u) => u.id === picks[i].unit),
    p = weapons(u).find((p) => p.id === picks[i].weapon),
    w = scenario.units[i].weapon;
  if (!p) {
    w.name = "Custom weapon";
    return;
  }
  Object.assign(w, {
    name: p.name,
    attacks: p.stats.A ?? "",
    damage: p.stats.D ?? "",
    hit: num(p.stats.WS ?? p.stats.BS) ?? 0,
    strength: num(p.stats.S) ?? 0,
    ap: /^-?\d+$/.test(p.stats.AP ?? "") ? -Math.abs(Number(p.stats.AP)) : 0,
  });
  if (!num(p.stats.WS ?? p.stats.BS) || !num(p.stats.S))
    notice(
      "This weapon needs manual characteristics. Automatic-hit weapons and keywords are not supported.",
    );
}
function unitFromCatalogue(i, u, models = u.models.min) {
  picks[i].unit = u.id;
  picks[i].profile = u.profiles.find((p) => p.type === "Unit")?.id;
  picks[i].weapon = weapons(u)[0]?.id ?? "";
  const stats = u.profiles.find((p) => p.id === picks[i].profile)?.stats ?? {};
  scenario.units[i] = {
    name: u.name,
    models,
    wounds: num(stats.W) ?? 0,
    toughness: num(stats.T) ?? 0,
    save: num(stats.Sv) ?? 7,
    invuln: num(stats.InSv) ?? 7,
    fnp: 7,
    frontWounds: num(stats.W) ?? 0,
    bearers: models,
    cover: false,
    weapon: { ...baseWeapon },
  };
  applyWeapon(i);
  if (!num(stats.W) || !num(stats.T) || !num(stats.Sv))
    notice(
      "Incomplete unit profile: check and enter characteristics manually.",
    );
}
function field(i, k, label, value, min, max, type = "number") {
  return `<label>${label}<input data-field="${k}" aria-label="Unit ${i ? "B" : "A"} ${label}" type="${type}" ${type === "number" ? `min="${min}" max="${max}" step="1"` : ""} value="${esc(value)}"></label>`;
}
function select(i, k, label, values, value) {
  return `<label>${label}<select data-field="${k}" aria-label="Unit ${i ? "B" : "A"} ${label}">${values.map(([v, l]) => opt(v, l, value)).join("")}</select></label>`;
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
function renderUnit(i) {
  const pick = picks[i],
    u = scenario.units[i],
    source = pick.data?.units.find((u) => u.id === pick.unit),
    w = u.weapon,
    query = pick.search ?? "";
  const filtered = (pick.data?.units ?? []).filter(
    (u) =>
      (!u.legend &&
        !u.narrative &&
        !u.allied &&
        u.profiles.some((p) => p.type === "Unit") &&
        u.name.toLowerCase().includes(query.toLowerCase())) ||
      u.id === pick.unit,
  );
  $("unit-" + i).innerHTML =
    `<div class="panel-top"><span class="eyebrow">UNIT ${i ? "B" : "A"} / ${i === scenario.first ? "ATTACKS FIRST" : "TARGET"}</span><span class="small-tag">${esc(pick.data?.name ?? "CUSTOM")}</span></div><div class="unit-body"><div class="unit-picker"><label>Faction<select data-faction aria-label="Unit ${i ? "B" : "A"} faction">${index.factions.map((f) => opt(f.id, f.name, pick.faction)).join("")}</select></label><label>Search units<input data-search aria-label="Unit ${i ? "B" : "A"} search units" type="search" placeholder="Search catalogue…" value="${esc(query)}"></label><label>Unit<select data-unit aria-label="Unit ${i ? "B" : "A"} unit">${filtered.map((u) => opt(u.id, u.name, pick.unit)).join("")}</select></label><button data-saved class="mini">Choose from saved Army ${i ? "B" : "A"} →</button><div id="saved-${i}"></div></div>
 <h2>${esc(u.name)}</h2><div class="model-tokens" aria-hidden="true">${Array.from({ length: Math.min(12, u.models) }, () => "<span>✠</span>").join("")}${u.models > 12 ? `<small>+${u.models - 12}</small>` : ""}</div><label>Defensive profile<select data-profile aria-label="Unit ${i ? "B" : "A"} defensive profile">${(
   source?.profiles ?? []
 )
   .filter((p) => p.type === "Unit")
   .map((p) => opt(p.id, p.name, pick.profile))
   .join("")}</select></label>
 <div class="characteristics">${field(i, "models", "Models", u.models, 1, 100)}${field(i, "toughness", "T", u.toughness, 1, 100)}${select(i, "save", "Sv", saves, u.save)}${field(i, "wounds", "W per model", u.wounds, 1, 100)}</div><div class="defence-fields">${select(i, "invuln", "Invulnerable Save", saves, u.invuln)}${select(i, "fnp", "Feel No Pain", saves, u.fnp)}${field(i, "frontWounds", "Wounds left on first model", u.frontWounds, 1, u.wounds)}</div><label class="check"><input data-field="cover" type="checkbox" ${u.cover ? "checked" : ""} ${scenario.phase === "fight" ? "disabled" : ""}> Benefit of Cover (shooting only)</label>
 <div class="weapon-header"><span class="eyebrow">${scenario.phase === "fight" ? "MELEE" : "RANGED"} WEAPON PROFILE</span><small>One profile per sequence</small></div><label>Weapon<select data-weapon aria-label="Unit ${i ? "B" : "A"} weapon">${weapons(
   source,
 )
   .map((p) => opt(p.id, p.name, pick.weapon))
   .join(
     "",
   )}${opt("", "Custom profile", pick.weapon)}</select></label><div class="weapon-fields">${field(i, "bearers", "Models using weapon", u.bearers, 0, u.models)}${field(i, "weapon.attacks", "A per model", w.attacks, null, null, "text")}${field(i, "weapon.hit", scenario.phase === "fight" ? "WS" : "BS", w.hit, 2, 6)}${field(i, "weapon.strength", "S", w.strength, 1, 100)}${field(i, "weapon.ap", "AP", w.ap, -10, 0)}${field(i, "weapon.damage", "D", w.damage, null, null, "text")}</div><p class="fine">A and D accept numbers or dice: D3, D6, 2D6+1. Edit profile values for your experiment.</p>
 <details class="modifiers"><summary>Modifiers and re-rolls</summary><div class="defence-fields">${select(i, "weapon.hitMod", "Hit modifier", mods, w.hitMod)}${select(i, "weapon.woundMod", "Wound modifier", mods, w.woundMod)}${select(i, "weapon.hitReroll", "Hit re-rolls", rerolls, w.hitReroll)}${select(i, "weapon.woundReroll", "Wound re-rolls", rerolls, w.woundReroll)}</div><p class="fine">Manual effects only. These controls do not activate a named ability or Stratagem.</p></details><div class="sequence-preview" id="preview-${i}"></div></div>`;
  bindUnit(i);
}
function preview() {
  for (let i = 0; i < 2; i++) {
    const u = scenario.units[i],
      v = scenario.units[1 - i],
      st = saveTarget(v, u.weapon, scenario.phase);
    $("preview-" + i).textContent =
      `${u.bearers} × ${u.weapon.attacks} attacks → ${u.weapon.hit}+ to hit${u.weapon.hitMod ? " (" + (u.weapon.hitMod > 0 ? "+" : "") + u.weapon.hitMod + ")" : ""} → ${woundTarget(u.weapon.strength, v.toughness)}+ to wound${u.weapon.woundMod ? " (" + (u.weapon.woundMod > 0 ? "+" : "") + u.weapon.woundMod + ")" : ""} → ${st > 6 ? "no successful save" : st + "+ save"} → ${u.weapon.damage} damage`;
  }
  $("title").innerHTML =
    `${esc(scenario.units[0].models + " " + scenario.units[0].name)} <span>VS</span> ${esc(scenario.units[1].models + " " + scenario.units[1].name)}`;
}
function changed() {
  results = null;
  lastRoll = null;
  $("results").innerHTML =
    '<div class="empty-results"><h3>How reliable is this matchup?</h3><p>Repeat this scenario across thousands of dice rolls.</p></div>';
  $("dice-output").innerHTML =
    '<div class="dice-idle"><span class="idle-die">⚄</span><h3>ROLL TO HIT</h3><p>Resolve one experiment, step by step.</p></div>';
  $("export-results").disabled = $("export-roll").disabled = true;
  preview();
}
function bindUnit(i) {
  const root = $("unit-" + i),
    pick = picks[i];
  root.querySelector("[data-faction]").onchange = async (e) => {
    setBusy(true);
    try {
      pick.data = await catalogue(e.target.value);
      pick.faction = pick.data.id;
      pick.search = "";
      const u = pick.data.units.find(
        (u) =>
          !u.legend &&
          !u.narrative &&
          !u.allied &&
          u.profiles.some((p) => p.type === "Unit"),
      );
      if (!u) throw Error("No unit profiles found.");
      unitFromCatalogue(i, u);
      renderUnit(i);
      changed();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };
  root.querySelector("[data-search]").oninput = (e) => {
    pick.search = e.target.value;
    const caret = e.target.selectionStart;
    renderUnit(i);
    const el = $("unit-" + i).querySelector("[data-search]");
    el.focus();
    el.setSelectionRange(caret, caret);
    preview();
  };
  root.querySelector("[data-unit]").onchange = (e) => {
    unitFromCatalogue(
      i,
      pick.data.units.find((u) => u.id === e.target.value),
    );
    renderUnit(i);
    changed();
  };
  root.querySelector("[data-profile]").onchange = (e) => {
    pick.profile = e.target.value;
    const stats = pick.data.units
      .find((u) => u.id === pick.unit)
      .profiles.find((p) => p.id === pick.profile).stats;
    Object.assign(scenario.units[i], {
      toughness: num(stats.T) ?? 0,
      save: num(stats.Sv) ?? 7,
      wounds: num(stats.W) ?? 0,
      frontWounds: num(stats.W) ?? 1,
      invuln: num(stats.InSv) ?? 7,
    });
    renderUnit(i);
    changed();
  };
  root.querySelector("[data-weapon]").onchange = (e) => {
    pick.weapon = e.target.value;
    applyWeapon(i);
    renderUnit(i);
    changed();
  };
  root.querySelectorAll("[data-field]").forEach((el) => {
    const update = () => {
      const [key, sub] = el.dataset.field.split("."),
        u = scenario.units[i],
        obj = sub ? u[key] : u,
        k = sub ?? key,
        allBearers = u.bearers === u.models;
      obj[k] =
        el.type === "checkbox"
          ? el.checked
          : el.type === "number"
            ? Number(el.value)
            : ["save", "invuln", "fnp", "hitMod", "woundMod"].includes(k)
              ? Number(el.value)
              : el.value;
      if (key === "models") {
        u.bearers = allBearers ? u.models : Math.min(u.bearers, u.models);
      }
      if (key === "wounds") {
        u.frontWounds = Math.min(u.frontWounds, u.wounds);
      }
      changed();
      if (key === "models") {
        $("unit-" + i).querySelector('[data-field="bearers"]').value =
          u.bearers;
        $("unit-" + i).querySelector('[data-field="bearers"]').max = u.models;
        root.querySelector('.model-tokens').innerHTML = Array.from(
          {length: Math.max(0, Math.min(12, u.models))}, () => '<span>✠</span>',
        ).join('') + (u.models > 12 ? `<small>+${u.models-12}</small>` : '');
      }
      if (key === "wounds") {
        $("unit-" + i).querySelector('[data-field="frontWounds"]').value =
          u.frontWounds;
        $("unit-" + i).querySelector('[data-field="frontWounds"]').max = u.wounds;
      }
    };
    if (el.tagName === "SELECT") el.onchange = update;
    else el.oninput = update;
  });
  root.querySelector("[data-saved]").onclick = () => chooseSaved(i);
}
async function chooseSaved(i) {
  try {
    const army = JSON.parse(localStorage.getItem("ks-armies-11e") ?? "null")?.[
      i
    ];
    if (!army?.units?.length)
      throw Error(`Save units in Army ${i ? "B" : "A"} first.`);
    const data = await catalogue(army.faction);
    $("saved-" + i).innerHTML =
      `<label>Saved unit<select id="saved-select-${i}"><option value="">Choose a unit…</option>${army.units.map((r) => opt(r.id, `${r.models} ${data.units.find((u) => u.id === r.unitId)?.name ?? "Unknown unit"}`, null)).join("")}</select></label>`;
    $("saved-select-" + i).onchange = (e) => {
      const row = army.units.find((r) => r.id === e.target.value);
      if (!row) return;
      const unit = data.units.find((u) => u.id === row.unitId);
      if (!unit) {
        notice("Saved unit is missing from the snapshot.");
        return;
      }
      picks[i] = { data, faction: data.id, search: "" };
      unitFromCatalogue(i, unit, row.models);
      renderUnit(i);
      changed();
      notice(
        "Unit and model count loaded. Choose weapon and defensive profiles; army wargear, attachments and abilities are not applied.",
      );
    };
  } catch (e) {
    notice(e.message);
  }
}
function render() {
  for (let i = 0; i < 2; i++) renderUnit(i);
  $("first").value = String(scenario.first);
  $("fight-back").checked = scenario.fightBack;
  $("fight-back").disabled = scenario.phase === "shoot";
  $("fight").classList.toggle("active", scenario.phase === "fight");
  $("shoot").classList.toggle("active", scenario.phase === "shoot");
  $("seed").value = scenario.seed;
  preview();
}
function setBusy(value) {
  busy = value;
  document
    .querySelectorAll(
      "#combat-view input,#combat-view select,#combat-view button,.heading-actions button,nav button",
    )
    .forEach((el) => (el.disabled = value));
  if (!value) {
    $("fight-back").disabled = scenario.phase === "shoot";
    document
      .querySelectorAll('[data-field="cover"]')
      .forEach((el) => (el.disabled = scenario.phase === "fight"));
    $("export-results").disabled = !results;
    $("export-roll").disabled = !lastRoll;
  }
}
function checked() {
  scenario.seed = Number($("seed").value);
  return validateScenario(scenario);
}
function download(name, value) {
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function payload() {
  return {
    schema: "combat-lab-1",
    scenario: checked(),
    picks: picks.map(({ faction, unit, profile, weapon }) => ({
      faction,
      unit,
      profile,
      weapon,
    })),
    dataCommit: index.commit,
  };
}
async function restore(value) {
  if (value?.schema !== "combat-lab-1")
    throw Error("This is not a Combat Lab scenario.");
  const next = validateScenario(value.scenario);
  if (!Array.isArray(value.picks) || value.picks.length !== 2)
    throw Error("Missing catalogue selections.");
  const nextPicks = [];
  for (const p of value.picks) {
    const data = await catalogue(p.faction),
      unit = data.units.find((u) => u.id === p.unit);
    if (
      !unit ||
      !unit.profiles.some((v) => v.id === p.profile && v.type === "Unit")
    )
      throw Error("Scenario unit profile is missing.");
    if (
      p.weapon &&
      !unit.profiles.some(
        (v) =>
          v.id === p.weapon &&
          v.type ===
            (next.phase === "fight" ? "Melee Weapons" : "Ranged Weapons"),
      )
    )
      throw Error("Scenario weapon is missing.");
    nextPicks.push({ ...p, data, search: "" });
  }
  scenario = next;
  picks = nextPicks;
  render();
  changed();
  notice("Scenario loaded.");
}
async function example() {
  const data = await Promise.all(
    ["Adeptus Custodes", "Imperial Knights"].map((name) =>
      catalogue(index.factions.find((f) => f.name === name).id),
    ),
  );
  scenario = {
    phase: "fight",
    first: 0,
    fightBack: true,
    seed: 40000,
    units: [],
  };
  picks = data.map((d) => ({ data: d, faction: d.id, search: "" }));
  unitFromCatalogue(
    0,
    data[0].units.find((u) => u.name === "Custodian Guard"),
    5,
  );
  unitFromCatalogue(
    1,
    data[1].units.find((u) => u.name === "Cerastus Knight Lancer"),
    1,
  );
  render();
  changed();
  notice(
    "5 Custodian Guard with Guardian Spears vs 1 Cerastus Knight Lancer, strike profile. Abilities and keywords are excluded.",
  );
}
function diceRow(label, rolls, detail) {
  return `<div class="dice-stage"><div class="stage-heading">${esc(label)}<b>${esc(detail)}</b></div><div class="dice-pool">${
    rolls
      .slice(0, 60)
      .map(
        (d) =>
          `<span class="die ${d.pass ? "" : "fail"}" title="${esc(d.original ? "Re-rolled " + d.original + " → " + d.value : d.value)}">${d.value}${d.original ? "<small>↻</small>" : ""}</span>`,
      )
      .join("") || "<small>No rolls</small>"
  }${rolls.length > 60 ? `<small>+${rolls.length - 60} rolls in JSON</small>` : ""}</div></div>`;
}
function sequence(e, s) {
  const u = s.units[e.side],
    v = s.units[1 - e.side],
    t = e.trace,
    rows = [];
  if (t.attackDice.length)
    rows.push(
      diceRow("Number of attacks", t.attackDice, e.attacks + " attacks"),
    );
  rows.push(
    diceRow("Hit rolls", t.hit, e.hits + " hits"),
    diceRow("Wound rolls", t.wound, e.wounds + " wounds"),
    diceRow("Saving throws", t.save, e.unsaved + " failed saves"),
    diceRow("Damage", t.damage, e.damageRolled + " rolled"),
  );
  if (v.fnp <= 6)
    rows.push(
      diceRow(
        "Feel No Pain",
        t.fnp,
        t.fnp.filter((d) => d.pass).length + " ignored",
      ),
    );
  return `<article class="attack-sequence"><div class="roll-heading"><strong>${esc(u.name)} → ${esc(v.name)}</strong><small>${esc(u.weapon.name)} · ${e.attacks} attacks · ${e.woundTarget}+ to wound · ${e.saveTarget > 6 ? "no successful save" : e.saveTarget + "+ save"}</small></div><div class="dice-stages">${rows.join("")}</div><div class="roll-result">${e.damageLost} wounds lost · ${e.killed} models destroyed · ${e.modelsLeft} models / ${e.remaining} wounds left</div></article>`;
}
$("roll").onclick = async () => {
  try {
    const s = checked(),
      pace = $("pace").value;
    notice("");
    setBusy(true);
    const r = runScenario(s, seeded(s.seed), true);
    lastRoll = { scenario: s, seed: s.seed, ...r };
    $("dice-output").innerHTML =
      r.events.map((e) => sequence(e, s)).join("") +
      (s.phase === "fight" && s.fightBack && r.events.length === 1
        ? '<p class="no-return">Target destroyed: no attacks back.</p>'
        : "");
    const delay =
      pace === "instant" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : pace === "fast"
          ? 120
          : 430;
    for (const el of $("dice-output").querySelectorAll(
      ".dice-stage,.roll-result",
    )) {
      el.classList.add("revealed");
      if (delay) await new Promise((r) => setTimeout(r, delay));
    }
    notice(
      `Resolved with seed ${s.seed}. Use New seed for another roll; the same seed reproduces the sequence.`,
    );
  } catch (e) {
    notice(e.message);
  } finally {
    setBusy(false);
  }
};
function renderResults(r, s) {
  $("results").innerHTML =
    `<div class="result-heading"><strong>${r.trials.toLocaleString()} simulations</strong><small>Seed ${s.seed} · ${s.phase === "fight" ? "Fight" : "Shooting"} phase · ${esc(s.units[s.first].name)} attacks first</small></div>${r.sides
      .map((out, i) => {
        const entries = Object.entries(out.histogram)
            .map(([d, n]) => [+d, n])
            .sort((a, b) => a[0] - b[0]),
          max = Math.max(...entries.map((e) => e[1]));
        return `<section class="result-unit"><h3>${esc(s.units[i].name)} <span>damage received</span></h3><div class="result-stats"><div><strong>${out.damage.toFixed(2)}</strong><small>Average wounds lost</small></div><div><strong>${out.killed.toFixed(2)}</strong><small>Average models destroyed</small></div><div><strong>${(out.destroyChance * 100).toFixed(1)}%</strong><small>Chance unit is destroyed</small></div></div><p>95% interval for destruction: ${(out.interval[0] * 100).toFixed(1)}–${(out.interval[1] * 100).toFixed(1)}%</p><details><summary>Wounds lost distribution</summary><div class="histogram">${entries.map(([d, n]) => `<div><span>${d} W</span><i style="width:${(n / max) * 100}%"></i><b>${((n / r.trials) * 100).toFixed(1)}%</b></div>`).join("")}</div></details></section>`;
      })
      .join(
        "",
      )}<p class="result-footnote">Wounds lost are capped at the unit’s remaining wounds. Each trial resets both units. Intervals describe sampling uncertainty, not missing rules.</p>`;
}
$("simulate").onclick = () => {
  try {
    const s = checked(),
      trials = Number($("trials").value);
    setBusy(true);
    notice("Simulating…");
    worker = new Worker(new URL("./combat-worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      if (data.done) {
        notice(
          `Simulating ${data.done.toLocaleString()} / ${trials.toLocaleString()}…`,
        );
        return;
      }
      worker.terminate();
      worker = null;
      if (data.error) {
        setBusy(false);
        notice(data.error);
        return;
      }
      results = {
        scenario: s,
        seed: s.seed,
        dataCommit: index.commit,
        ...data.result,
      };
      renderResults(data.result, s);
      setBusy(false);
      notice("Simulation complete.");
    };
    worker.onerror = () => {
      worker.terminate();
      worker = null;
      setBusy(false);
      notice("Simulation worker failed. Try again.");
    };
    worker.postMessage({ scenario: s, trials });
  } catch (e) {
    setBusy(false);
    notice(e.message);
  }
};
$("first").onchange = (e) => {
  scenario.first = Number(e.target.value);
  render();
  changed();
};
$("fight-back").onchange = (e) => {
  scenario.fightBack = e.target.checked;
  changed();
};
for (const phase of ["fight", "shoot"])
  $(phase).onclick = () => {
    scenario.phase = phase;
    for (let i = 0; i < 2; i++) {
      const u = picks[i].data.units.find((u) => u.id === picks[i].unit);
      picks[i].weapon = weapons(u)[0]?.id ?? "";
      applyWeapon(i);
    }
    render();
    changed();
  };
$("swap").onclick = () => {
  scenario.units.reverse();
  picks.reverse();
  render();
  changed();
};
$("new-seed").onclick = () => {
  $("seed").value = crypto.getRandomValues(new Uint32Array(1))[0];
  scenario.seed = Number($("seed").value);
  changed();
};
$("seed").onchange = () => {
  scenario.seed = Number($("seed").value);
  changed();
};
$("save-scenario").onclick = () => {
  try {
    localStorage.setItem("ks-combat-scenario", JSON.stringify(payload()));
    notice("Scenario saved in this browser.");
  } catch (e) {
    notice(e.message);
  }
};
$("load-scenario").onclick = async () => {
  try {
    const value = localStorage.getItem("ks-combat-scenario");
    if (!value) throw Error("No saved combat scenario in this browser.");
    await restore(JSON.parse(value));
  } catch (e) {
    notice(e.message);
  }
};
$("export-scenario").onclick = () => {
  try {
    download("combat-scenario.json", payload());
  } catch (e) {
    notice(e.message);
  }
};
$("export-results").onclick = () => download("combat-results.json", results);
$("export-roll").onclick = () => download("combat-rolls.json", lastRoll);
$("import-scenario").onchange = async (e) => {
  try {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 100000) throw Error("Scenario file is too large.");
    await restore(JSON.parse(await f.text()));
  } catch (e) {
    notice(e.message);
  } finally {
    e.target.value = "";
  }
};
$("example").onclick = async () => {
  setBusy(true);
  try {
    await example();
  } catch (e) {
    notice(e.message);
  } finally {
    setBusy(false);
  }
};
async function switchView(next) {
  $("combat-view").hidden = next !== "combat";
  $("army-view").hidden = next !== "army";
  $("combat-tab").classList.toggle("active", next === "combat");
  $("army-tab").classList.toggle("active", next === "army");
  document.querySelector(".heading-actions").hidden = next === "army";
  notice("");
  $("description").textContent =
    next === "army"
      ? "Build and save your armies. Choose saved units in the Combat calculator."
      : "Pick a matchup. Roll the attacks. Find out how often it works.";
  if (next === "army") {
    $("title").textContent = "ARMY LISTS";
    if (!armyMounted) {
      try {
        const { mountArmyBuilder } = await import("./army-builder.js");
        await mountArmyBuilder($("army-builder-root"), () =>
          switchView("combat"),
        );
        armyMounted = true;
      } catch (e) {
        notice(e.message);
      }
    }
  } else preview();
}
$("combat-tab").onclick = () => switchView("combat");
$("army-tab").onclick = () => switchView("army");
setBusy(true);
notice("Loading faction and unit profiles…");
try {
  const res = await fetch("/armies/index.json");
  if (!res.ok) throw Error("Could not load faction index.");
  index = await res.json();
  await example();
  setBusy(false);
} catch (e) {
  notice(e.message + " Reload to retry.");
  document.querySelectorAll("button").forEach((el) => (el.disabled = true));
}
