import { escapeHtml as text } from "./ui-html.js";
import { abilityCount, weaponSummary } from "./combat-unit-view.js";
const $ = (id) => document.getElementById(id);

export function renderArena(scenario, killed = [0, 0]) {
  $("arena").innerHTML = arenaMarkup(scenario, killed);
}

export function arenaMarkup(scenario, killed = [0, 0]) {
  return scenario.units
    .map((u, i) => {
      const left = Math.max(0, u.models - killed[i]);
      const vehicle =
        u.effects.targetType === "vehicle" ||
        u.effects.targetType === "monster";
      const n = Math.min(u.models, vehicle ? 3 : 10);
      const extra = Math.max(0, left - n);
      return `<div class="arena-side side-${i}"><div class="arena-name"><span>${i === scenario.first ? "ATTACKS FIRST" : "TARGET"}</span><strong>${text(u.name)}</strong><small>${text(u.weapon.name)}</small></div><div class="arena-tokens ${vehicle ? "large-tokens" : ""}">${Array.from({ length: n }, (_, j) => `<span class="battle-token ${j >= left ? "destroyed" : ""}" aria-hidden="true"><span>${vehicle ? "♜" : "✠"}</span></span>`).join("")}${extra ? `<span class="extra-models">+${extra}</span>` : ""}</div><div class="arena-count"><b>${left}</b> / ${u.models} models <span>${scenario.phase === "fight" ? "Fight" : "Shooting"} phase</span></div></div>`;
    })
    .join('<div class="arena-vs" aria-hidden="true">VS<span>⚔</span></div>');
}

export function updateProfileBadges(root, u, phase) {
  const count = abilityCount(u);
  const active = root.querySelector(".unit-abilities > summary > span");
  if (active) active.textContent = count ? `${count} selected` : "Optional";
  const b = root.querySelector(".profile-badges");
  if (b)
    b.innerHTML = `T ${text(u.toughness)} <i>·</i> Sv ${u.save > 6 ? "—" : text(u.save) + "+"} <i>·</i> W ${text(u.wounds)}`;
  const w = root.querySelector(".weapon-edit > summary > span");
  if (w) w.textContent = weaponSummary(u, phase);
}
