import { escapeHtml as esc } from "./ui-html.js";
import { weaponReference } from "./core-rule-reference.js";

export function armyDatasheetView(unit) {
  const weapons = unit.profiles.filter((profile) => /Weapons/.test(profile.type));
  const rows = weapons.map((weapon) => {
    const keywords = weapon.stats.Keywords ?? "";
    return `<tr><td><strong>${esc(weapon.name)}</strong><div class="datasheet-keywords">${weaponReference(keywords)}</div></td>${[weapon.stats.Range ?? "Melee", weapon.stats.A, weapon.stats.BS ?? weapon.stats.WS, weapon.stats.S, weapon.stats.AP, weapon.stats.D].map((value) => `<td>${esc(value ?? "–")}</td>`).join("")}</tr>`;
  }).join("");
  const abilities = (unit.abilities ?? []).map((ability) => `<details class="datasheet-ability"><summary>${esc(ability.name)}</summary><p>${esc(ability.description.replace(/\*\*|\^/g, ""))}</p></details>`).join("");
  return `<details data-panel="datasheet-weapons" open><summary>Weapons & abilities</summary><div class="weapon-table-wrap"><table class="builder-weapons"><thead><tr>${["Weapon", "Range", "A", "BS / WS", "S", "AP", "D"].map((name) => `<th>${name}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></details>${abilities ? `<section class="datasheet-abilities"><h3>Unit abilities</h3>${abilities}</section>` : ""}<a class="fine" href="${esc(unit.source ? `https://github.com/BSData/wh40k-11e/blob/cc58ee3b2c23f90af9d00e7bf234cd703b762299/${encodeURIComponent(unit.source.file)}` : "https://github.com/BSData/wh40k-11e")}" target="_blank" rel="noreferrer">Catalogue rule source ↗</a>`;
}
