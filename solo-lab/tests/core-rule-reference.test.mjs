import test from "node:test";
import assert from "node:assert/strict";
import { eligibleCoreStratagems, coreStratagemReference, weaponReference } from "../src/core-rule-reference.js";

test("Core Stratagem references respect static keyword exclusions", () => {
  const names = (categories) => eligibleCoreStratagems({ categories }).map((rule) => rule.name);
  const lancer = names(["Vehicle", "Walker", "Character", "Titanic"]);
  assert.ok(lancer.includes("Crushing Impact"));
  assert.ok(lancer.includes("Epic Challenge"));
  assert.ok(lancer.includes("Heroic Intervention"));
  assert.ok(!lancer.includes("Fire Overwatch"));
  assert.ok(!lancer.includes("Explosives"));
  assert.ok(!names(["Vehicle"]).includes("Heroic Intervention"));
  assert.ok(!names(["Aircraft"]).includes("Rapid Ingress"));
  assert.ok(names(["Infantry", "Grenades"]).includes("Explosives"));
  assert.ok(names(["Smoke"]).includes("Smokescreen"));
});

test("Weapon references distinguish supported effects from reference-only mechanics", () => {
  const html = weaponReference("Lance, Precision, Sustained Hits 2, Unknown <weapon>");
  assert.match(html, /Lance <span>Calculated/);
  assert.match(html, /Precision <span>Reference only/);
  assert.match(html, /Charge this turn/);
  assert.match(html, /Unknown &lt;weapon&gt;/);
  assert.doesNotMatch(html, /<weapon>/);
  assert.equal(weaponReference(""), "");
});

test("Stratagems from other phases stay collapsed and never imply automatic effects", () => {
  const html = coreStratagemReference({ categories: ["Vehicle", "Character"] }, "fight");
  assert.ok(html.indexOf("Epic Challenge") < html.indexOf('data-panel="other-core-phases"'));
  assert.ok(html.indexOf("Crushing Impact") > html.indexOf('data-panel="other-core-phases"'));
  assert.match(html, /Reference only/);
  assert.doesNotMatch(html, /type="checkbox"|data-rule-choice/);
});
