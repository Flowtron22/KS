import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { armyDatasheetView } from "../src/army-datasheet-view.js";

test("Lancer datasheet shows weapon keywords and native ability descriptions", () => {
  const data = JSON.parse(readFileSync(new URL("../public/armies/imperial-knights.json", import.meta.url)));
  const unit = data.units.find((entry) => entry.name === "Cerastus Knight Lancer");
  const html = armyDatasheetView(unit);
  for (const name of ["Lance", "Assault", "Sustained Hits 2", "Shock Charge", "Code Chivalric", "Super-Heavy Walker", "Damaged: 1-10 Wounds Remaining"])
    assert.ok(html.includes(name), name);
  assert.ok(!unit.abilities.some((ability) => /Bearer of|Cybork|Honour/.test(ability.name)));
  assert.doesNotMatch(html, /Abilities and weapon keywords are not included/);
});

test("Ability descriptions and names render as safe text", () => {
  const html = armyDatasheetView({profiles:[], abilities:[{name:'<img>',description:'<script>alert(1)</script>'}]});
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|<img>/);
});
