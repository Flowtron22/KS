import { escapeHtml as esc, escapeHtml as text } from "./ui-html.js";

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

function diceRow(label, rolls, detail) {
  return `<div class="dice-stage"><div class="stage-heading">${esc(label)}<b>${esc(detail)}</b></div><div class="dice-pool">${
    rolls
      .slice(0, 60)
      .map(
        (d) =>
          `<span class="die ${d.pass ? "" : "fail"}" title="${esc(d.original ? "Re-rolled " + d.original + " → " + d.value : d.value)}">${dieFace(d.value)}${d.original ? "<small>↻</small>" : ""}</span>`,
      )
      .join("") || "<small>No rolls</small>"
  }${rolls.length > 60 ? `<small>+${rolls.length - 60} rolls in JSON</small>` : ""}</div></div>`;
}
export function sequenceReport(e, s) {
  const u = s.units[e.side],
    v = s.units[1 - e.side],
    t = e.trace,
    rows = [];
  if (t.attackDice.length)
    rows.push(
      diceRow("Number of attacks", t.attackDice, e.attacks + " attacks"),
    );
  rows.push(
    diceRow(
      "Hit rolls",
      t.hit,
      e.hits + " hits" + (e.extraHits ? " · " + e.extraHits + " extra" : ""),
    ),
    diceRow(
      "Wound rolls",
      t.wound,
      e.wounds +
        " wounds" +
        (e.autoWounds ? " · " + e.autoWounds + " automatic" : "") +
        (e.devastating ? " · " + e.devastating + " devastating" : ""),
    ),
    diceRow("Saving throws", t.save, e.unsaved + " failed saves"),
    diceRow("Damage", t.damage, e.damageRolled + " rolled"),
  );
  if (t.fnp.length)
    rows.push(
      diceRow(
        "Feel No Pain",
        t.fnp,
        t.fnp.filter((d) => d.pass).length + " ignored",
      ),
    );
  return `<article class="attack-sequence"><div class="roll-heading"><strong>${esc(u.name)} → ${esc(v.name)}</strong><small>${esc(u.weapon.name)} · ${e.attacks} attacks · ${e.woundTarget}+ to wound · ${e.saveTarget > 6 ? "no successful save" : e.saveTarget + "+ save"}</small>${e.appliedEffects.length ? `<p class="applied-roll-effects">${e.appliedEffects.map(esc).join(" · ")}</p>` : ""}</div><div class="dice-stages">${rows.join("")}</div><div class="roll-result">${e.damageLost} wounds lost · ${e.killed} models destroyed · ${e.modelsLeft} models / ${e.remaining} wounds left</div></article>`;
}

export function singleRollReport(r, s) {
  return `<div class="result-heading"><strong>Dice resolved</strong><small>Seed ${s.seed} · one attack sequence</small></div>${s.units.map((u, i) => `<section class="result-unit"><h3>${text(u.name)}<span>damage received</span></h3><div class="result-stats"><div><strong>${r.damage[i]}</strong><small>Wounds lost</small></div><div><strong>${r.killed[i]}</strong><small>Models destroyed</small></div><div><strong>${u.models - r.killed[i]}</strong><small>Models left</small></div></div></section>`).join("")}<p class="result-footnote">One roll can swing either way. Run simulations to measure how often it works.</p>`;
}

export function simulationReport(r, s) {
  const target = 1 - s.first;
  const side = (i) => {
    const out = r.sides[i];
    const entries = Object.entries(out.histogram)
      .map(([d, n]) => [+d, n])
      .sort((a, b) => a[0] - b[0]);
    const max = Math.max(...entries.map((e) => e[1]));
    return `<section class="result-unit"><h3>${esc(s.units[i].name)}<span>damage received</span></h3><div class="result-stats"><div><strong>${out.damage.toFixed(2)}</strong><small>Average wounds lost</small></div><div><strong>${out.killed.toFixed(2)}</strong><small>Average models destroyed</small></div><div><strong>${(out.destroyChance * 100).toFixed(1)}%</strong><small>Chance unit is destroyed</small></div></div><details><summary>Distribution & confidence</summary><p>95% interval for destruction: ${(out.interval[0] * 100).toFixed(1)}–${(out.interval[1] * 100).toFixed(1)}%</p><div class="histogram">${entries.map(([d, n]) => `<div><span>${d} W</span><i style="width:${(n / max) * 100}%"></i><b>${((n / r.trials) * 100).toFixed(1)}%</b></div>`).join("")}</div></details></section>`;
  };
  return `<div class="outcome-score"><span>Destroy the target</span><strong>${(r.sides[target].destroyChance * 100).toFixed(1)}<small>%</small></strong><p>${esc(s.units[target].name)}</p></div><div class="result-heading"><strong>${r.trials.toLocaleString()} simulations</strong><small>${esc(s.units[s.first].name)} attacks first · ${s.phase === "fight" ? "Fight" : "Shooting"}</small></div>${side(target)}${s.phase === "fight" && s.fightBack ? `<details class="return-results"><summary>Survivors fight back</summary>${side(s.first)}</details>` : ""}<p class="result-footnote">Each trial starts fresh. <span>Seed ${s.seed}</span></p>`;
}
