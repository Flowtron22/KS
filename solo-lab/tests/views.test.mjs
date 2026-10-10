import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { combatShell } from "../src/combat-shell.js";
import { renderUnitCard } from "../src/combat-unit-view.js";
import { arenaMarkup } from "../src/combat-layout.js";
import { singleRollReport, simulationReport } from "../src/combat-reports.js";
import { EFFECT_DEFAULTS } from "../src/combat-effects.js";
import { simulate } from "../src/combat.js";

const json = (file) =>
  JSON.parse(readFileSync(new URL("../public/" + file, import.meta.url)));
const data = json("armies/adeptus-custodes.json");
data.combatRules = json("rules/adeptus-custodes.json");
const index = json("armies/index.json");
const source = data.units.find((u) => u.name === "Custodian Guard");
const fixture = () => {
  const u = {
    name: "Guard",
    models: 5,
    bearers: 5,
    toughness: 7,
    save: 2,
    invuln: 4,
    fnp: 7,
    wounds: 5,
    frontWounds: 5,
    cover: false,
    guardCodex: true,
    effects: { ...EFFECT_DEFAULTS, targetType: "infantry" },
    ruleSelections: [],
    weaponRules: false,
    weapon: {
      name: "Guardian Spear",
      attacks: "6",
      hit: 2,
      strength: 8,
      ap: -2,
      damage: "2",
      hitMod: 0,
      woundMod: 0,
      hitReroll: "none",
      woundReroll: "none",
    },
  };
  const pick = {
    data,
    faction: data.id,
    unit: source.id,
    profile: source.profiles.find((p) => p.type === "Unit").id,
    weapon: source.profiles.find((p) => p.name === "Guardian Spear").id,
  };
  return { u, pick };
};

test("Final shell owns exactly one of every controller target", () => {
  const ids = [...combatShell().matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of [
    "arena",
    "roll",
    "simulate",
    "results",
    "unit-0",
    "unit-1",
    "seed",
    "replay-seed",
    "army-builder-root",
    "export-roll",
    "export-results",
  ])
    assert.ok(ids.includes(id), id);
  assert.ok(
    combatShell().indexOf("combat-dashboard") <
      combatShell().indexOf('class="matchup"'),
  );
});

test("Phase-dependent unit and keyword displays render without browser state", () => {
  const { u, pick } = fixture();
  const render = (phase) =>
    renderUnitCard(0, u, pick, { factions: index.factions, phase, first: 0 });
  assert.match(render("shoot"), /Weapon keywords · Assault, Rapid Fire 2/);
  assert.match(render("shoot"), /Unit A BS/);
  assert.doesNotMatch(
    render("fight"),
    /Weapon keywords · Assault, Rapid Fire 2/,
  );
  assert.match(render("fight"), /Unit A WS/);
});

test("Expandable sections have unique identities even when styling is shared", () => {
  const { u, pick } = fixture();
  const html = renderUnitCard(0, u, pick, {
    factions: index.factions,
    phase: "fight",
    first: 0,
  });
  const keys = [...html.matchAll(/data-panel="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(keys.length, new Set(keys).size);
  assert.ok(keys.includes("weapon-modifiers"));
  assert.ok(keys.includes("effect-modifiers"));
});

test("Imported names and custom weapon text cannot become executable markup", () => {
  const { u, pick } = fixture();
  u.name = "<img src=x onerror=alert(1)>";
  u.weapon.attacks = '"><script>alert(1)</script>';
  const card = renderUnitCard(0, u, pick, {
    factions: index.factions,
    phase: "fight",
    first: 0,
  });
  assert.doesNotMatch(card, /<script>|<img src=x/);
  const scene = arenaMarkup({ units: [u, u], first: 0, phase: "fight" });
  assert.doesNotMatch(scene, /<img src=x/);
  assert.match(scene, /&lt;img/);
});

test("Overflow tokens count undisplayed survivors after casualties", () => {
  const { u } = fixture();
  u.models = 20;
  const s = { units: [u, { ...u, models: 1 }], first: 0, phase: "fight" };
  assert.match(arenaMarkup(s, [5, 0]), /extra-models">\+5/);
  assert.doesNotMatch(arenaMarkup(s, [15, 0]), /extra-models/);
  assert.match(arenaMarkup(s, [15, 0]), /<b>5<\/b> \/ 20 models/);
});

test("Simulation report follows attack order; single-roll losses remain distinct", () => {
  const { u } = fixture();
  const s = {
    units: [
      { ...u, name: "Target A" },
      { ...u, name: "Attacker B" },
    ],
    first: 1,
    phase: "fight",
    fightBack: true,
    seed: 7,
  };
  const r = simulate(s, 100);
  const html = simulationReport(r, s);
  assert.match(html, /outcome-score[\s\S]*?<p>Target A<\/p>/);
  assert.match(html, /Attacker B attacks first/);
  const roll = singleRollReport({ damage: [8, 3], killed: [1, 0] }, s);
  assert.match(roll, /<strong>8<\/strong>/);
  assert.doesNotMatch(roll, /Chance unit is destroyed/);
});
