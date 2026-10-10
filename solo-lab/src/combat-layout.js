const $ = (id) => document.getElementById(id);
const text = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fold = (className, title) => {
  const el = document.createElement("details");
  el.className = className;
  el.innerHTML = `<summary>${title}</summary>`;
  return el;
};

export function mountCombatLayout() {
  const view = $("combat-view");
  const dashboard = document.createElement("div");
  dashboard.className = "combat-dashboard";
  dashboard.innerHTML = `<section class="simulation-stage panel"><div class="table-heading"><span class="eyebrow">DICE TABLE</span><span id="table-status">Ready to roll</span></div><div id="arena" class="arena" aria-label="Matchup preview"></div><div id="table-actions" class="table-actions"></div></section><aside class="outcome-panel panel" aria-label="Simulation results"></aside>`;
  const stage = dashboard.querySelector(".simulation-stage");
  stage.insertBefore(
    view.querySelector(".scenario-bar"),
    dashboard.querySelector("#arena"),
  );
  const actions = dashboard.querySelector("#table-actions");
  actions.append($("roll"), $("simulate"));
  const settings = fold("run-settings", "Roll settings");
  settings.append(view.querySelector(".experiment-controls"));
  const replay = document.createElement("label");
  replay.className = "check";
  replay.innerHTML =
    '<input id="replay-seed" type="checkbox"> Replay this seed';
  settings.querySelector(".experiment-controls").append(replay);
  actions.append(settings);
  const dicePanel = $("dice-output").parentElement;
  dicePanel.classList.add("live-dice");
  const exports = document.createElement("div");
  exports.className = "report-exports";
  exports.append($("export-roll"), $("export-results"));
  dicePanel.querySelector(".panel-top").remove();
  stage.append(dicePanel);
  const outcome = dashboard.querySelector(".outcome-panel");
  outcome.innerHTML =
    '<div class="table-heading"><span id="outcome-title" class="eyebrow">EXPECTED RESULT</span><span>Repeat & compare</span></div>';
  outcome.append($("results"));
  view.querySelector(".experiment-output").remove();
  view.prepend(dashboard);
  const setup = document.createElement("div");
  setup.className = "setup-heading";
  setup.innerHTML =
    '<div><span class="eyebrow">THE MATCHUP</span><h2>Choose your units</h2></div><span>Pick a weapon. Add abilities if you need them.</span>';
  view.insertBefore(setup, view.querySelector(".matchup"));
  const notes = fold("calculation-notes", "Rules, assumptions & data");
  const oldNotes = view.querySelector(".rules-note");
  oldNotes.replaceWith(notes);
  notes.append(oldNotes);
  const files = fold("file-tools", "Save files & export results");
  const oldFiles = view.querySelector(".scenario-files");
  oldFiles.replaceWith(files);
  files.append(exports, oldFiles);
  $("description").textContent =
    "Pick two units. Watch the dice. Test the odds.";
}

export function compactUnit(root, u, open = []) {
  const body = root.querySelector(".unit-body");
  const picker = body.querySelector(".unit-picker");
  const tools = fold("catalogue-tools", "Search units / saved army");
  tools.append(
    picker.querySelector("[data-search]").parentElement,
    picker.querySelector("[data-saved]"),
    picker.querySelector('[id^="saved-"]'),
  );
  picker.append(tools);
  body.querySelector("h2").remove();
  const tokens = body.querySelector(".model-tokens");
  tokens.removeAttribute("aria-hidden");
  const basics = document.createElement("div");
  basics.className = "unit-basics";
  basics.append(
    body.querySelector('[data-field="models"]').parentElement,
    tokens,
  );
  tokens.innerHTML = `<span>✠</span><b class="profile-badges">T ${text(u.toughness)} <i>·</i> Sv ${u.save > 6 ? "—" : text(u.save) + "+"} <i>·</i> W ${text(u.wounds)}</b>`;
  picker.after(basics);
  const defence = fold("profile-edit", "Defence & wounds");
  defence.append(
    body.querySelector("[data-profile]").parentElement,
    body.querySelector(".characteristics"),
    body.querySelector(".defence-fields"),
    body.querySelector('[data-field="cover"]').parentElement,
  );
  const weaponLabel = body.querySelector("[data-weapon]").parentElement;
  body.querySelector(".weapon-header").remove();
  basics.after(weaponLabel);
  const weapon = fold(
    "weapon-edit",
    `Weapon stats <span>${text(u.weapon.attacks)} A · ${text(u.weapon.hit)}+ ${document.getElementById("fight").classList.contains("active") ? "WS" : "BS"} · S ${text(u.weapon.strength)} · AP ${text(u.weapon.ap)} · D ${text(u.weapon.damage)}</span>`,
  );
  weapon.append(
    body.querySelector(".weapon-fields"),
    body.querySelector(".fine"),
    body.querySelector(".modifiers"),
  );
  weaponLabel.after(weapon, defence);
  const effects = body.querySelector(".effects-panel");
  const count =
    (u.ruleSelections?.length ?? 0) +
    (u.effects.katah !== "none" ? 1 : 0) +
    (u.weaponRules ? 1 : 0);
  const abilities = fold(
    "unit-abilities",
    `Abilities & auras <span>${count ? count + " selected" : "Optional"}</span>`,
  );
  const audit = effects.querySelector(".effects-summary");
  effects.before(abilities);
  effects.querySelector(".weapon-header").remove();
  abilities.append(effects);
  const explanations = fold("rule-explanation", "Rule notes & data sources");
  for (const p of effects.querySelectorAll(
    ":scope > .fine, :scope > .data-warning, .katah-panel > .fine",
  ))
    explanations.append(p);
  if (explanations.children.length > 1) effects.append(explanations);
  abilities.after(audit);
  const preview = body.querySelector(".sequence-preview");
  const calculation = fold("unit-calculation", "Attack calculation");
  preview.replaceWith(calculation);
  calculation.append(preview);
  for (const selector of open)
    root.querySelector(selector)?.setAttribute("open", "");
}

export function renderArena(scenario, killed = [0, 0]) {
  $("arena").innerHTML = scenario.units
    .map((u, i) => {
      const left = Math.max(0, u.models - killed[i]);
      const vehicle =
        u.effects.targetType === "vehicle" ||
        u.effects.targetType === "monster";
      const n = Math.min(u.models, vehicle ? 3 : 10);
      return `<div class="arena-side side-${i}"><div class="arena-name"><span>${i === scenario.first ? "ATTACKS FIRST" : "TARGET"}</span><strong>${text(u.name)}</strong><small>${text(u.weapon.name)}</small></div><div class="arena-tokens ${vehicle ? "large-tokens" : ""}">${Array.from({ length: n }, (_, j) => `<span class="battle-token ${j >= left ? "destroyed" : ""}" aria-hidden="true"><span>${vehicle ? "♜" : "✠"}</span></span>`).join("")}${u.models > n ? `<span class="extra-models">+${u.models - n}</span>` : ""}</div><div class="arena-count"><b>${left}</b> / ${u.models} models <span>${scenario.phase === "fight" ? "Fight" : "Shooting"} phase</span></div></div>`;
    })
    .join('<div class="arena-vs" aria-hidden="true">VS<span>⚔</span></div>');
}

export function updateProfileBadges(root, u) {
  const count =
    (u.ruleSelections?.length ?? 0) +
    (u.effects.katah !== "none" ? 1 : 0) +
    (u.weaponRules ? 1 : 0) +
    (u.effects.captainGeneral ? 1 : 0) +
    (u.effects.impenetrableDefence ? 1 : 0);
  const active = root.querySelector(".unit-abilities > summary > span");
  if (active) active.textContent = count ? `${count} selected` : "Optional";
  const b = root.querySelector(".profile-badges");
  if (b)
    b.innerHTML = `T ${text(u.toughness)} <i>·</i> Sv ${u.save > 6 ? "—" : text(u.save) + "+"} <i>·</i> W ${text(u.wounds)}`;
  const w = root.querySelector(".weapon-edit > summary > span");
  if (w)
    w.textContent = `${u.weapon.attacks} A · ${u.weapon.hit}+ ${$("fight").classList.contains("active") ? "WS" : "BS"} · S ${u.weapon.strength} · AP ${u.weapon.ap} · D ${u.weapon.damage}`;
}

export function renderSingleRoll(r, s) {
  $("outcome-title").textContent = "THIS ROLL";
  $("results").innerHTML =
    `<div class="result-heading"><strong>Dice resolved</strong><small>Seed ${s.seed} · one attack sequence</small></div>${s.units.map((u, i) => `<section class="result-unit"><h3>${text(u.name)}<span>damage received</span></h3><div class="result-stats"><div><strong>${r.damage[i]}</strong><small>Wounds lost</small></div><div><strong>${r.killed[i]}</strong><small>Models destroyed</small></div><div><strong>${u.models - r.killed[i]}</strong><small>Models left</small></div></div></section>`).join("")}<p class="result-footnote">One roll can swing either way. Run simulations to measure how often it works.</p>`;
}

export function dieFace(value) {
  const patterns = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9],
  };
  if (!patterns[value]) return text(value);
  return `<span class="die-value">${text(value)}</span><span class="face-pips" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i class="${patterns[value].includes(i + 1) ? "pip-on" : ""}"></i>`).join("")}</span>`;
}
