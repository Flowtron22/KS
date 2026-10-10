import "./battle.css";
import "./combat.css";
import "./dashboard.css";
import { combatShell } from "./combat-shell.js";
import { bindUnitControls } from "./combat-unit-controller.js";
import { renderUnitCard, weaponProfiles } from "./combat-unit-view.js";
import { capturePanels, restorePanels } from "./ui-panels.js";
import { escapeHtml as esc, option as opt } from "./ui-html.js";
import { renderArena, updateProfileBadges } from "./combat-layout.js";
import {
  sequenceReport,
  simulationReport,
  singleRollReport,
} from "./combat-reports.js";
import { prepareRules } from "./rule-picker.js";
import { EFFECT_DEFAULTS, effectiveAttack } from "./combat-effects.js";
import {
  validateScenario,
  seeded,
  runScenario,
  woundTarget,
  saveTarget,
} from "./combat.js";

const $ = (id) => document.getElementById(id);
const num = (s) => (/^\d+\+?$/.test(String(s ?? "")) ? parseInt(s) : null);
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
const weapons = (u) => weaponProfiles(u, scenario.phase);
$("app").innerHTML = combatShell();
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
  const rulesResponse = await fetch("/rules/" + f.file);
  if (!rulesResponse.ok) throw Error("Could not load faction rules.");
  d.combatRules = await rulesResponse.json();
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
    hit:
      num(p.stats.WS ?? p.stats.BS) ??
      (/Torrent/i.test(picks[i].data.combatRules.weapons[p.id] ?? "") ? 2 : 0),
    strength: num(p.stats.S) ?? 0,
    ap: /^-?\d+$/.test(p.stats.AP ?? "") ? -Math.abs(Number(p.stats.AP)) : 0,
  });
  if (scenario.units[i].guardCodex && p.name === "Guardian Spear") {
    Object.assign(w, {
      attacks: scenario.phase === "fight" ? "6" : "2",
      hit: 2,
      strength: scenario.phase === "fight" ? 8 : 5,
      ap: scenario.phase === "fight" ? -2 : -1,
      damage: "2",
    });
  }
  if (!num(p.stats.WS ?? p.stats.BS) || !num(p.stats.S))
    notice(
      /Torrent/i.test(picks[i].data.combatRules.weapons[p.id] ?? "")
        ? "Torrent profile: enable supported weapon keywords and confirm conditions. Its displayed BS/WS is ignored while Torrent is active."
        : "This weapon needs manual characteristics. Check its unsupported values before calculating.",
    );
}
function unitFromCatalogue(i, u, models = u.models.min) {
  picks[i].unit = u.id;
  picks[i].profile = u.profiles.find((p) => p.type === "Unit")?.id;
  picks[i].weapon = weapons(u)[0]?.id ?? "";
  const stats = u.profiles.find((p) => p.id === picks[i].profile)?.stats ?? {};
  scenario.units[i] = {
    name: u.name,
    ruleSelections: [],
    rulesConfirmed: false,
    weaponRules: false,
    weaponConditions: {
      halfRange: false,
      heavyEligible: false,
      charged: false,
    },
    models,
    wounds: num(stats.W) ?? 0,
    toughness: num(stats.T) ?? 0,
    save: num(stats.Sv) ?? 7,
    invuln: num(stats.InSv) ?? 7,
    fnp: 7,
    frontWounds: num(stats.W) ?? 0,
    bearers: models,
    cover: false,
    effects: {
      ...EFFECT_DEFAULTS,
      custodes: picks[i].data?.name === "Adeptus Custodes",
      targetType: u.categories.includes("Vehicle")
        ? "vehicle"
        : u.categories.includes("Monster")
          ? "monster"
          : u.categories.includes("Infantry")
            ? "infantry"
            : "other",
      katahEligible: u.name === "Custodian Guard",
      readied: u.name === "Custodian Guard",
    },
    weapon: { ...baseWeapon },
  };
  if (
    u.name === "Custodian Guard" &&
    picks[i].data?.name === "Adeptus Custodes"
  )
    upgradeGuard(i);
  applyWeapon(i);
  if (!num(stats.W) || !num(stats.T) || !num(stats.Sv))
    notice(
      "Incomplete unit profile: check and enter characteristics manually.",
    );
}
function upgradeGuard(i) {
  Object.assign(scenario.units[i], {
    guardCodex: true,
    name: "Custodian Guard Sodality",
    toughness: 7,
    wounds: 5,
    frontWounds: 5,
    save: 2,
    invuln: 4,
  });
  const source = picks[i].data.units.find((u) => u.id === picks[i].unit);
  picks[i].profile = source.profiles.find((p) => p.type === "Unit")?.id;
  picks[i].weapon =
    weapons(source).find((p) => p.name === "Guardian Spear")?.id ?? "";
}
function renderUnit(i) {
  const root = $("unit-" + i);
  const open = capturePanels(root);
  root.innerHTML = renderUnitCard(i, scenario.units[i], picks[i], {
    factions: index.factions,
    phase: scenario.phase,
    first: scenario.first,
  });
  restorePanels(root, open);
  bindUnit(i);
}
function preview() {
  renderArena(scenario);
  scenario.units.forEach((u, i) => prepareRules(u, picks[i], scenario.phase));
  for (let i = 0; i < 2; i++) {
    const u = scenario.units[i],
      v = scenario.units[1 - i],
      effect = effectiveAttack(u, v, scenario.phase),
      w = effect.weapon,
      st = saveTarget(effect.defender, w, scenario.phase);
    updateProfileBadges($("unit-" + i), u, scenario.phase);
    $("preview-" + i).textContent =
      `${u.bearers} × (${w.attacks}${effect.attacksBonus ? " + " + effect.attacksBonus : ""}) attacks → ${w.hit}+ to hit${w.hitMod ? " (" + (w.hitMod > 0 ? "+" : "") + w.hitMod + ")" : ""} → ${woundTarget(w.strength, effect.defender.toughness)}+ to wound${w.woundMod ? " (" + (w.woundMod > 0 ? "+" : "") + w.woundMod + ")" : ""} → ${st > 6 ? "no successful save" : st + "+ save"} → ${w.damage}${effect.damageBonus ? " + " + effect.damageBonus : ""} damage`;
    const e = u.effects,
      conditions = [];
    if ((u.ruleSelections?.length || u.weaponRules) && !u.rulesConfirmed)
      conditions.push(
        "Selected source rules and weapon keywords inactive: confirm all conditions and availability.",
      );
    if (u.rulesConfirmed)
      for (const r of u.ruleEffects ?? [])
        if (r.phase !== "both" && r.phase !== scenario.phase)
          conditions.push(`${r.name}: inactive in this phase.`);
    if (
      e.captainGeneral &&
      (!e.custodes || ["monster", "vehicle"].includes(e.targetType))
    )
      conditions.push(
        "Captain-General inactive: requires a Custodes unit excluding Monsters and Vehicles.",
      );
    if (
      e.impenetrableDefence &&
      (!u.guardCodex || ["monster", "vehicle"].includes(v.effects.targetType))
    )
      conditions.push(
        "Impenetrable Defence inactive: requires current Guard attacking a non-Monster/Vehicle target.",
      );
    if (e.katah !== "none") {
      if (!e.katahEligible || !e.readied)
        conditions.push("Ka’tah inactive: confirm ability and readiness.");
      else if ((scenario.phase === "shoot") !== (e.katah === "salvus"))
        conditions.push("Ka’tah inactive in this phase.");
      else if (
        e.katah === "rendax" &&
        !["monster", "vehicle"].includes(v.effects.targetType)
      )
        conditions.push("Rendax inactive: target is not a Monster or Vehicle.");
      else if (
        e.katah === "dacatarai" &&
        ["monster", "vehicle"].includes(v.effects.targetType)
      )
        conditions.push("Dacatarai inactive against Monster/Vehicle targets.");
      else if (e.katah === "kaptaris")
        conditions.push(
          "Kaptaris applies to enemy melee attacks targeting this unit.",
        );
    }
    $("effects-summary-" + i).innerHTML =
      `${effect.applied.map((label) => `<span>${esc(label)}</span>`).join("")}${conditions.map((label) => `<p>${esc(label)}</p>`).join("")}${e.note ? `<p>Manual note: ${esc(e.note)}</p>` : ""}`;
  }
  $("title").innerHTML =
    `${esc(scenario.units[0].models + " " + scenario.units[0].name)} <span>VS</span> ${esc(scenario.units[1].models + " " + scenario.units[1].name)}`;
}
function changed() {
  document.querySelector(".simulation-stage").classList.remove("has-roll");
  results = null;
  lastRoll = null;
  $("results").innerHTML =
    '<div class="empty-results"><span class="odds-mark">%</span><h3>How often does it work?</h3><p>Run simulations to see average damage and the chance of destroying each unit.</p></div>';
  $("dice-output").innerHTML =
    '<div class="dice-idle"><span class="idle-die">⚄</span><div><h3>Let the dice decide.</h3><p>Roll attacks once, or run thousands to test the odds.</p></div></div>';
  $("export-results").disabled = $("export-roll").disabled = true;
  $("table-status").textContent = "Ready to roll";
  $("outcome-title").textContent = "EXPECTED RESULT";
  preview();
}
function bindUnit(i) {
  bindUnitControls(i, $("unit-" + i), {
    pick: picks[i],
    getScenario: () => scenario,
    catalogue,
    num,
    unitFromCatalogue,
    renderUnit,
    changed,
    preview,
    setBusy,
    notice,
    applyWeapon,
    chooseSaved,
    upgradeGuard,
  });
}
async function chooseSaved(i) {
  if (busy) return;
  setBusy(true);
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
  } finally {
    setBusy(false);
  }
}
function render() {
  $("fight").classList.toggle("active", scenario.phase === "fight");
  $("shoot").classList.toggle("active", scenario.phase === "shoot");
  for (let i = 0; i < 2; i++) renderUnit(i);
  $("first").value = String(scenario.first);
  $("fight-back").checked = scenario.fightBack;
  $("fight-back").disabled = scenario.phase === "shoot";
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
  scenario.units.forEach((u, i) => prepareRules(u, picks[i], scenario.phase));
  scenario.units.forEach((u, i) => {
    if (
      !u.guardCodex &&
      /Torrent/i.test(
        picks[i].data.combatRules.weapons[picks[i].weapon] ?? "",
      ) &&
      !(u.weaponRules && u.rulesConfirmed)
    )
      throw Error(
        "Torrent profile: enable supported weapon keywords and confirm conditions, or select a custom profile for your experiment.",
      );
  });
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
    rulesVersion: 1,
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
  next.units.forEach((u, i) => prepareRules(u, nextPicks[i], next.phase));
  scenario = next;
  picks = nextPicks;
  scenario.units.forEach((u, i) => {
    const source = picks[i].data.units.find((v) => v.id === picks[i].unit);
    u.effects = {
      ...EFFECT_DEFAULTS,
      targetType: source.categories.includes("Vehicle")
        ? "vehicle"
        : source.categories.includes("Monster")
          ? "monster"
          : source.categories.includes("Infantry")
            ? "infantry"
            : "other",
      ...u.effects,
    };
  });
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
  notice("Custodes vs Lancer loaded. No abilities selected.");
}
$("roll").onclick = async () => {
  if (busy) return;
  try {
    if (!$("replay-seed").checked) {
      scenario.seed = crypto.getRandomValues(new Uint32Array(1))[0];
      $("seed").value = scenario.seed;
    }
    const s = checked(),
      pace = $("pace").value;
    notice("");
    setBusy(true);
    const r = runScenario(s, seeded(s.seed), true);
    document.querySelector(".simulation-stage").classList.add("has-roll");
    lastRoll = { scenario: s, seed: s.seed, ...r };
    $("dice-output").innerHTML =
      r.events.map((e) => sequenceReport(e, s)).join("") +
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
      $("table-status").textContent =
        el.querySelector(".stage-heading")?.firstChild?.textContent ??
        "Damage resolved";
      el.classList.add("revealed");
      if (delay) await new Promise((r) => setTimeout(r, delay));
    }
    renderArena(s, r.killed);
    $("table-status").textContent = "Roll complete";
    if (!results) {
      $("outcome-title").textContent = "THIS ROLL";
      $("results").innerHTML = singleRollReport(r, s);
    }
    notice(
      `Roll complete · seed ${s.seed}. Enable Replay this seed in Roll settings to repeat it.`,
    );
  } catch (e) {
    notice(e.message);
  } finally {
    setBusy(false);
  }
};
function renderResults(r, s) {
  $("outcome-title").textContent = "EXPECTED RESULT";
  $("results").innerHTML = simulationReport(r, s);
}
$("simulate").onclick = () => {
  if (busy) return;
  try {
    const s = checked(),
      trials = Number($("trials").value);
    setBusy(true);
    notice("Simulating…");
    renderArena(s);
    $("table-status").textContent = "Testing the odds…";
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
      $("table-status").textContent =
        data.result.trials.toLocaleString() + " simulations complete";
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
  if (busy) return;
  setBusy(true);
  try {
    const value = localStorage.getItem("ks-combat-scenario");
    if (!value) throw Error("No saved combat scenario in this browser.");
    await restore(JSON.parse(value));
  } catch (e) {
    notice(e.message);
  } finally {
    setBusy(false);
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
  if (busy) return;
  setBusy(true);
  try {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 100000) throw Error("Scenario file is too large.");
    await restore(JSON.parse(await f.text()));
  } catch (e) {
    notice(e.message);
  } finally {
    e.target.value = "";
    setBusy(false);
  }
};
$("example").onclick = async () => {
  if (busy) return;
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
      : "Pick two units. Watch the dice. Test the odds.";
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
