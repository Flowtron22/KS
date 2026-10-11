import { armyGroup, groupArmyItems } from "./army-groups.js";
import { armyRosterView } from "./army-roster-view.js";
import { unitAvailability, modelCountAllowed } from "./unit-limits.js";
import { attachmentRole, attachmentCandidates } from "./army-attachments.js";
import {
  armyValidation,
  createArmyExport,
  rosterLabel,
} from "./army-export.js";
import { equipmentView, bindEquipment } from "./army-equipment-view.js";
import { resizeLoadout } from "./army-loadout.js";
import { openArmyShare } from "./army-share.js";
import { capturePanels, restorePanels } from "./ui-panels.js";
import { captureArmyScroll, restoreArmyScroll } from "./army-scroll.js";
import {
  newArmy,
  addUnit,
  unitPoints,
  armySummary,
  validateArmy,
} from "./army-core.js";
import "./army-builder.css";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const marks = { Imperium: "✠", Chaos: "✶", Xenos: "◇" };
export async function mountArmyBuilder(root) {
  root.innerHTML =
    '<p class="muted">Loading 11th-edition faction catalogues…</p>';
  const index = await (await fetch("/armies/index.json")).json(),
    cache = new Map();
  let side = 0,
    step = 0,
    data = null,
    selected = null,
    search = "",
    factionSearch = "",
    role = "All units",
    legends = false,
    allies = false,
    message = "",
    loading = false;
  let armies = [null, null];
  try {
    const saved = JSON.parse(localStorage.getItem("ks-armies-11e") ?? "null");
    if (Array.isArray(saved) && saved.length === 2) armies = saved;
  } catch {}
  async function getData(id) {
    if (cache.has(id)) return cache.get(id);
    const f = index.factions.find((f) => f.id === id);
    if (!f) throw Error("Unknown faction.");
    const res = await fetch("/armies/" + f.file);
    if (!res.ok) throw Error("The faction catalogue could not be loaded.");
    const d = await res.json();
    cache.set(id, d);
    return d;
  }
  async function resume(startAtFaction = false) {
    if (armies[side]) {
      try {
        data = await getData(armies[side].faction);
        armies[side] = validateArmy(armies[side], data);
        step = startAtFaction ? 0 : 3;
      } catch {
        armies[side] = null;
        data = null;
        step = 0;
        message =
          "Saved army could not be loaded. Choose a faction to start again.";
      }
    } else {
      data = null;
      step = 0;
    }
    selected = null;
    render();
  }
  function save() {
    try {
      localStorage.setItem("ks-armies-11e", JSON.stringify(armies));
    } catch {
      message = "Browser storage is full. Export your army JSON to keep it.";
    }
  }
  function current() {
    return armies[side];
  }
  function summary() {
    return armySummary(current(), data);
  }
  function options(values, value) {
    return values
      .map(
        (v) =>
          `<option value="${esc(v.id ?? v)}" ${(v.id ?? v) === value ? "selected" : ""}>${esc(v.name ?? v)}</option>`,
      )
      .join("");
  }
  function stageHead(n, title, text) {
    return `<div class="builder-stage-head"><div><span class="eyebrow">STEP ${n} / 5</span><h2>${title}</h2><p>${text}</p></div></div>`;
  }
  function factionCards() {
    const list = index.factions.filter((f) =>
      f.name.toLowerCase().includes(factionSearch.toLowerCase()),
    );
    return (
      ["Imperium", "Chaos", "Xenos"]
        .map(
          (group) =>
            `<section class="faction-group"><h3>${group}<span>${list.filter((f) => f.group === group && !f.auxiliary).length} FACTIONS / CHAPTERS</span></h3><div class="faction-cards">${list
              .filter((f) => f.group === group && !f.auxiliary)
              .map(
                (f) =>
                  `<button class="faction-card ${group.toLowerCase()}" data-faction="${f.id}"><span class="faction-emblem">${marks[group]}</span><strong>${esc(f.name)}</strong><span>${f.detachments} Detachments <b>→</b></span></button>`,
              )
              .join("")}</div></section>`,
        )
        .join("") +
      `<details class="auxiliary-factions"><summary>Titan armies / auxiliary catalogues</summary><div class="faction-cards">${list
        .filter((f) => f.auxiliary)
        .map(
          (f) =>
            `<button class="faction-card" data-faction="${f.id}"><span class="faction-emblem">▰</span><strong>${esc(f.name)}</strong><span>Auxiliary catalogue →</span></button>`,
        )
        .join("")}</div></details>`
    );
  }
  function pointsStage() {
    const a = current();
    return (
      stageHead(
        2,
        "Choose your battle size",
        "Set a points limit and name your army.",
      ) +
      `<div class="points-cards">${[
        ["incursion", "Incursion", "1,000", 2, 1000],
        ["strike", "Strike Force", "2,000", 3, 2000],
      ]
        .map(
          ([id, name, pts, dp, limit]) =>
            `<button class="points-card ${a.battleSize === id && a.limit === limit ? "chosen" : ""}" data-size="${id}" data-limit="${limit}"><span>${name}</span><strong>${pts}<small>POINTS</small></strong><p>${dp} Detachment Points</p></button>`,
        )
        .join(
          "",
        )}</div><div class="army-fields"><label>Army name<input id="army-name" maxlength="100" value="${esc(a.name)}"></label><label>Points limit<input id="army-limit" type="number" min="1" max="100000" value="${a.limit}"></label><label>Battle-size rules<select id="army-size"><option value="incursion" ${a.battleSize === "incursion" ? "selected" : ""}>Incursion · 2 DP</option><option value="strike" ${a.battleSize === "strike" ? "selected" : ""}>Strike Force · 3 DP</option></select></label></div><p class="builder-caption">Custom points limits use the selected battle-size rules.</p><button class="button orange" data-step="2">Choose Detachments →</button>`
    );
  }
  function detachStage() {
    const a = current(),
      s = summary();
    return (
      stageHead(
        3,
        "Choose your Detachments",
        "Combine Detachments within your Detachment Points budget.",
      ) +
      `<div class="dp-strip"><strong>${s.dp} / ${s.budget} DP</strong><span>${s.dp > s.budget ? "Over budget" : `${s.budget - s.dp} Detachment Points remaining`}</span></div><div class="detachment-cards">${data.detachments.map((d) => `<button class="detachment-card ${a.detachments.includes(d.id) ? "chosen" : ""}" data-detachment="${d.id}"><span class="selection-check">${a.detachments.includes(d.id) ? "✓" : "+"}</span><div><strong>${esc(d.name)}</strong><small>${esc(d.dispositions.join(" · ") || "Force Disposition needs source review")}</small></div><b>${d.dp} DP</b></button>`).join("") || "<p>This auxiliary catalogue has no standalone Detachments.</p>"}</div><label class="disposition-field">Force Disposition<select id="disposition"><option value="">Choose a Force Disposition</option>${options(s.allowed, a.disposition)}</select></label><button class="button orange" data-step="3">Add units →</button>`
    );
  }
  function filtered() {
    return data.units.filter(
      (u) =>
        (legends || (!u.legend && !u.narrative)) &&
        (allies || !u.allied) &&
        u.name.toLowerCase().includes(search.toLowerCase()) &&
        (role === "All units" ||
          (role === "Other units" && armyGroup(u) === "other") ||
          u.categories.includes(role)),
    );
  }
  function unitCatalogue() {
    const list = filtered();
    return `<div class="catalogue-controls"><input id="unit-search" type="search" placeholder="Search units…" aria-label="Search units" value="${esc(search)}"><select id="unit-role" aria-label="Unit category">${options(["All units", { id: "Character", name: "Characters" }, "Battleline", { id: "Dedicated Transport", name: "Dedicated Transports" }, { id: "Other units", name: "Other Datasheets" }, "Infantry", "Vehicle", "Monster"], role)}</select></div><div class="catalogue-toggles"><label><input id="show-legends" type="checkbox" ${legends ? "checked" : ""}> Legends / narrative</label><label><input id="show-allies" type="checkbox" ${allies ? "checked" : ""}> Allied entries</label><span>${list.length} units</span></div><div class="unit-catalogue">${
      groupArmyItems(list)
        .map(
          (group) =>
            `<section class="catalogue-group" aria-label="${group.name}"><h3 class="army-group-heading">${group.name}<span>${group.items.length}</span></h3>${group.items
              .map((u) => {
                const { count, max, available } = unitAvailability(
                  u,
                  current(),
                );
                return `<article class="catalogue-row"><button class="catalogue-detail" data-inspect="${u.id}"><span class="catalogue-symbol">${u.role === "Character" ? "✠" : u.role === "Battleline" ? "▥" : u.categories.includes("Vehicle") ? "▰" : "◇"}</span><span><strong>${esc(u.name)}</strong><small>${esc(u.role)} · ${u.models.min === u.models.max ? u.models.min : u.models.min + "–" + u.models.max} models${u.allied ? " · ALLIED" : ""}</small></span></button><span class="catalogue-points">${u.points ?? "?"}<small>PTS${u.conditionalPrice ? " *" : ""}</small></span><span class="unit-copy-count">${count}/${max}</span><button class="add-unit" data-add-unit="${u.id}" aria-label="Add ${esc(u.name)}" ${available ? "" : "disabled"} title="Maximum ${max} units">＋</button></article>`;
              })
              .join("")}</section>`,
        )
        .join("") || '<p class="empty-army">No units match these filters.</p>'
    }</div>`;
  }
  function armyList() {
    const a = current(),
      s = summary();
    return `<aside class="panel army-list-panel"><div class="army-list-top"><span class="eyebrow">YOUR ARMY / ${side ? "B" : "A"}</span><h2>${esc(a.name)}</h2><p>${esc(data.name)} · ${a.battleSize === "incursion" ? "Incursion" : "Strike Force"}</p><div class="army-points ${s.total > a.limit ? "over" : ""}"><strong>${s.unknown ? "≥ " : ""}${s.total.toLocaleString()}</strong><span>/ ${a.limit.toLocaleString()}<small>POINTS</small></span></div><div class="points-track"><i style="width:${Math.min(100, (s.total / a.limit) * 100)}%"></i></div><div class="points-remaining">${s.unknown ? s.unknown + " units need points review" : s.total > a.limit ? s.total - a.limit + " points over" : a.limit - s.total + " points remaining"}<b>${s.dp}/${s.budget} DP</b></div><p class="army-detachments">${esc(a.detachments.map((id) => data.detachments.find((d) => d.id === id)?.name).join(" + ") || "No Detachments selected")}</p></div><div class="army-roster">${
      armyRosterView(a, data, selected) ||
      '<div class="empty-army"><span>＋</span><h3>Your army starts here.</h3><p>Add units from the catalogue.<br>Select a unit to configure it.</p></div>'
    }</div><div class="army-list-bottom"><button class="button orange" data-step="4">Review army →</button><div><button class="mini" id="save-army">Save army</button><button class="mini" id="export-army">Export JSON</button></div></div></aside>`;
  }
  function review() {
    const s = summary();
    const validation = armyValidation(current(), s);
    return (
      stageHead(
        5,
        "Review your army",
        "Check your points, Warlord and attachments before saving.",
      ) +
      `<div class="review-grid">${armyList()}<section class="panel review-checks"><h3>Army checks</h3><p class="army-validation" data-status="${validation.status}">${validation.label}</p>${validation.issues.length ? `<ul>${validation.issues.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}<button id="save-review" class="button orange">Save army</button><button id="export-review" class="button">Export army JSON</button><button id="share-army" class="button orange">Share army image</button></section></div>`
    );
  }
  function render() {
    const scroll = captureArmyScroll(root);
    const panels = capturePanels(root);
    const focused = root.contains(document.activeElement)
        ? document.activeElement
        : null,
      fid = focused?.id,
      caret = focused?.selectionStart;
    root.innerHTML = `<div class="army-builder"><div class="builder-toolbar"><div class="army-side-tabs"><button data-army-side="0" class="${side === 0 ? "active" : ""}">ARMY A <small>${esc(armies[0] ? index.factions.find((f) => f.id === armies[0].faction)?.name : "Choose faction")}</small></button><button data-army-side="1" class="${side === 1 ? "active" : ""}">ARMY B <small>${esc(armies[1] ? index.factions.find((f) => f.id === armies[1].faction)?.name : "Choose faction")}</small></button></div><div><label class="button import-label">Import army JSON<input id="army-import" type="file" accept="application/json" hidden></label><span class="edition-tag">11TH EDITION</span></div></div><div class="builder-steps">${["Faction", "Points", "Detachments", "Units", "Review"].map((name, i) => `<button data-step="${i}" class="${i === step ? "active" : i < step ? "complete" : ""}" ${i && !data ? "disabled" : ""}><span>${i + 1}</span>${name}</button>`).join("")}</div>${message ? `<div class="builder-message" role="status">${esc(message)}</div>` : ""}<div class="builder-body">${loading ? "<p>Loading faction…</p>" : step === 0 ? stageHead(1, "Choose your faction", "Choose a faction, set your points limit and build your army.") + `<input id="faction-search" class="faction-search" type="search" placeholder="Search factions or Space Marine chapters…" aria-label="Search factions" value="${esc(factionSearch)}">` + factionCards() : step === 1 ? pointsStage() : step === 2 ? detachStage() : step === 3 ? `<div class="army-build-grid"><section class="panel catalogue-panel"><div class="panel-top"><span class="eyebrow">${esc(data.name)} / ADD UNITS</span><button class="mini" data-step="2">Edit Detachments</button></div>${unitCatalogue()}</section>${armyList()}</div>` : review()}</div><div class="army-source-note"><strong>Community data · 9 Oct 2026</strong><span>Points and datasheet characteristics from BSData. Conditional rules still need review.</span>${data ? `<a href="${esc(data.source.url)}" target="_blank" rel="noreferrer">View source ↗</a>` : '<a href="https://github.com/BSData/wh40k-11e" target="_blank" rel="noreferrer">View source ↗</a>'}</div><div id="unit-config"></div></div>`;
    bind();
    if (selected && step === 3) renderConfig();
    if (fid) {
      const el = root.querySelector("#" + fid);
      el?.focus({ preventScroll: true });
      if (typeof caret === "number" && el?.type === "search")
        el.setSelectionRange(caret, caret);
    }
    restorePanels(root, panels);
    restoreArmyScroll(root, scroll);
  }
  function bind() {
    root.querySelectorAll("[data-army-side]").forEach(
      (el) =>
        (el.onclick = async () => {
          side = Number(el.dataset.armySide);
          message = "";
          search = "";
          role = "All units";
          await resume();
        }),
    );
    root.querySelectorAll("[data-step]").forEach(
      (el) =>
        (el.onclick = () => {
          step = Number(el.dataset.step);
          selected = null;
          message = "";
          render();
        }),
    );
    root.querySelectorAll("[data-faction]").forEach(
      (el) =>
        (el.onclick = async () => {
          loading = true;
          render();
          try {
            const d = await getData(el.dataset.faction);
            data = d;
            if (current()?.faction !== d.id) armies[side] = newArmy(d);
            step = 1;
            message = "";
            save();
          } catch (e) {
            message = e.message;
          }
          loading = false;
          render();
        }),
    );
    const on = (id, event, fn) => {
      const el = root.querySelector("#" + id);
      if (el) el[event] = fn;
    };
    on("faction-search", "oninput", (e) => {
      factionSearch = e.target.value;
      render();
    });
    on("army-name", "oninput", (e) => {
      current().name = e.target.value;
      save();
    });
    on("army-limit", "oninput", (e) => {
      current().limit = Math.min(
        100000,
        Math.max(1, Math.round(Number(e.target.value) || 2000)),
      );
      save();
    });
    on("army-size", "onchange", (e) => {
      current().battleSize = e.target.value;
      save();
      render();
    });
    root.querySelectorAll("[data-size]").forEach(
      (el) =>
        (el.onclick = () => {
          current().battleSize = el.dataset.size;
          current().limit = Number(el.dataset.limit);
          save();
          render();
        }),
    );
    root.querySelectorAll("[data-detachment]").forEach(
      (el) =>
        (el.onclick = () => {
          const a = current(),
            id = el.dataset.detachment;
          a.detachments = a.detachments.includes(id)
            ? a.detachments.filter((d) => d !== id)
            : [...a.detachments, id];
          if (!summary().allowed.includes(a.disposition)) a.disposition = "";
          save();
          render();
        }),
    );
    on("disposition", "onchange", (e) => {
      current().disposition = e.target.value;
      save();
    });
    on("unit-search", "oninput", (e) => {
      search = e.target.value;
      render();
    });
    on("unit-role", "onchange", (e) => {
      role = e.target.value;
      render();
    });
    on("show-legends", "onchange", (e) => {
      legends = e.target.checked;
      render();
    });
    on("show-allies", "onchange", (e) => {
      allies = e.target.checked;
      render();
    });
    root.querySelectorAll("[data-add-unit]").forEach(
      (el) =>
        (el.onclick = () => {
          if (current().units.length >= 200) {
            message = "The lab supports up to 200 units per army.";
            render();
            return;
          }
          const unit = data.units.find((u) => u.id === el.dataset.addUnit);
          const availability = unitAvailability(unit, current());
          if (!availability.available) {
            message = `Maximum ${availability.max} units of ${unit.name}.`;
            render();
            return;
          }
          addUnit(current(), unit);
          save();
          render();
        }),
    );
    root.querySelectorAll("[data-inspect]").forEach(
      (el) =>
        (el.onclick = () => {
          selected = "catalogue:" + el.dataset.inspect;
          renderConfig();
        }),
    );
    root.querySelectorAll("[data-edit-unit]").forEach(
      (el) =>
        (el.onclick = () => {
          selected = el.dataset.editUnit;
          step = 3;
          render();
        }),
    );
    root.querySelectorAll("[data-remove-unit]").forEach(
      (el) =>
        (el.onclick = () => {
          const id = el.dataset.removeUnit;
          current().units = current().units.filter((r) => r.id !== id);
          current().units.forEach((r) => {
            if (r.attachment === id) r.attachment = null;
          });
          if (selected === id) selected = null;
          save();
          render();
        }),
    );
    for (const id of ["save-army", "save-review"])
      on(id, "onclick", () => {
        save();
        message = "Army saved in this browser.";
        render();
      });
    for (const id of ["export-army", "export-review"])
      on(id, "onclick", exportArmy);
    on("share-army", "onclick", async () => {
      try {
        await openArmyShare(
          root.querySelector("#unit-config"),
          current(),
          data,
        );
      } catch (e) {
        message = e.message;
        render();
      }
    });
    on("army-import", "onchange", async (e) => {
      try {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 2e6) throw Error("Army file is too large.");
        const value = JSON.parse(await f.text()),
          d = await getData(value.faction);
        const a = validateArmy(value, d);
        armies[side] = a;
        data = d;
        step = 3;
        selected = null;
        message = "Army imported.";
        save();
        render();
      } catch (err) {
        message = err.message;
        render();
      }
    });
  }
  function exportArmy() {
    const payload = createArmyExport(current(), data),
      blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = current().name.replace(/[^a-z0-9]+/gi, "-") + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function renderConfig() {
    const row = current().units.find((r) => r.id === selected),
      unit = data.units.find(
        (u) => u.id === (row?.unitId ?? selected?.replace("catalogue:", "")),
      );
    if (!unit) return;
    const target = root.querySelector("#unit-config");
    const sameUnit =
      target.querySelector("#config-title")?.textContent === unit.name;
    const openPanels = capturePanels(target);
    const scroll = captureArmyScroll(root);
    const focused = target.contains(document.activeElement)
      ? document.activeElement
      : null;
    const focusId = focused?.id;
    const focusEquipment = focused
      ? ["equipmentChoice", "equipmentQty", "equipmentType"].find(
          (key) => key in focused.dataset,
        )
      : null;
    const focusValue = focusEquipment ? focused.dataset[focusEquipment] : null;
    const focusModel = focused?.dataset.model;
    const stat = unit.profiles.find((p) => p.type === "Unit"),
      weapons = unit.profiles.filter((p) => /Weapons/.test(p.type)),
      enhancements = unit.options.filter(
        (o) =>
          o.type === "enhancement" &&
          (!o.requiredDetachments?.length ||
            o.requiredDetachments.some((id) =>
              current().detachments.includes(id),
            ) ||
            o.id === row?.enhancement),
      );
    target.innerHTML = `<div class="config-overlay"><section class="unit-config-panel" role="dialog" aria-modal="true" aria-labelledby="config-title"><div class="panel-top"><span class="eyebrow">${row ? "CONFIGURE UNIT" : "DATASHEET CHARACTERISTICS"}</span><button id="close-config" class="mini" aria-label="Close unit configuration">✕</button></div><h2 id="config-title">${esc(unit.name)}</h2><p class="muted">${esc(
      unit.categories
        .filter((c) => !c.startsWith("Faction:"))
        .slice(0, 6)
        .join(" · "),
    )}</p>${stat ? `<div class="stat-grid">${["M", "T", "Sv", "W", "LD", "OC"].map((k) => `<div><small>${k === "LD" ? "Ld" : k}</small><strong>${esc(stat.stats[k] ?? "–")}</strong></div>`).join("")}</div>` : ""}${
      row
        ? `<div class="config-fields"><label>Models<input id="config-models" type="number" min="${unit.models.min}" max="${unit.models.max}" value="${row.models}"></label><strong>${unitPoints(unit, row, armies[side]) ?? "?"} points</strong></div><p class="fine">Source model range: ${unit.models.min}–${unit.models.max}. Choose equipment for each model below.</p>${unit.categories.includes("Character") ? `<label class="warlord-choice"><input id="config-warlord" type="checkbox" ${row.warlord ? "checked" : ""}> Warlord</label>` : ""}${
            attachmentRole(unit)
              ? `<label>Attach ${attachmentRole(unit)} to<select id="config-attachment"><option value="">${attachmentRole(unit) === "Support" ? "Choose a Bodyguard unit" : "Unattached"}</option>${options(
                  attachmentCandidates(current(), data, row).map((r) => ({
                    id: r.id,
                    name: rosterLabel(current(), r, data),
                  })),
                  row.attachment,
                )}${row.attachment && !attachmentCandidates(current(), data, row).some((r) => r.id === row.attachment) ? `<option value="${esc(row.attachment)}" selected disabled>Current attachment · needs review</option>` : ""}</select></label>`
              : ""
          }${
            enhancements.length
              ? `<label>Enhancement<select id="config-enhancement"><option value="">None</option>${options(
                  enhancements.map((o) => ({
                    id: o.id,
                    name: o.name + " · " + o.points + " pts",
                  })),
                  row.enhancement,
                )}</select></label><p class="fine">Check the selected Enhancement against your Detachments and unit eligibility.</p>`
              : ""
          }${equipmentView(unit, row)}<label>Loadout / model composition notes<textarea id="config-notes" maxlength="2000" rows="2" placeholder="Sergeant equipment, weapon replacements, special models…">${esc(row.notes)}</textarea></label>${unit.conditionalPrice || unit.points === null ? `<label>Reviewed unit points override<input id="config-override" type="number" min="0" max="100000" placeholder="Use source calculation" value="${row.pointsOverride ?? ""}"></label><p class="fine">Override the unit cost after checking conditional rules. Enhancement and paid wargear costs are added separately.</p>` : ""}`
        : ""
    }<details><summary>Weapon characteristics</summary><div class="weapon-table-wrap"><table class="builder-weapons"><thead><tr>${["Weapon", "Range", "A", "BS / WS", "S", "AP", "D"].map((s) => `<th>${s}</th>`).join("")}</tr></thead><tbody>${weapons.map((w) => `<tr>${[w.name, w.stats.Range ?? "Melee", w.stats.A, w.stats.BS ?? w.stats.WS, w.stats.S, w.stats.AP, w.stats.D].map((v) => `<td>${esc(v ?? "–")}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details><p class="fine">Characteristics only. Abilities and weapon keywords are not included in the battle engine.</p><button id="done-config" class="button orange">${row ? "Done" : "Back to units"}</button></section></div>`;
    function refreshTotals() {
      target.querySelector(".config-fields strong").textContent =
        (unitPoints(unit, row, armies[side]) ?? "?") + " points";
      const panel = root.querySelector(".army-list-panel");
      if (panel) {
        panel.outerHTML = armyList();
        bind();
      }
    }
    target.querySelector("#close-config").onclick = target.querySelector(
      "#done-config",
    ).onclick = () => {
      selected = null;
      render();
    };
    const on = (id, event, fn) => {
      const el = target.querySelector("#" + id);
      if (el) el[event] = fn;
    };
    on("config-models", "oninput", (e) => {
      const n = Number(e.target.value);
      if (modelCountAllowed(unit, n)) {
        row.models = n;
        resizeLoadout(unit, row);
        save();
        renderConfig();
        refreshTotals();
      }
    });
    on("config-warlord", "onchange", (e) => {
      current().units.forEach((r) => (r.warlord = false));
      row.warlord = e.target.checked;
      save();
      render();
    });
    on("config-attachment", "onchange", (e) => {
      row.attachment = e.target.value || null;
      save();
      render();
    });
    on("config-enhancement", "onchange", (e) => {
      row.enhancement = e.target.value || null;
      save();
      render();
    });
    on("config-notes", "oninput", (e) => {
      row.notes = e.target.value;
      save();
    });
    on("config-override", "oninput", (e) => {
      row.pointsOverride =
        e.target.value === ""
          ? null
          : Math.min(
              100000,
              Math.max(0, Math.round(Number(e.target.value) || 0)),
            );
      save();
      refreshTotals();
    });
    if (row)
      bindEquipment(target, unit, row, () => {
        save();
        renderConfig();
        refreshTotals();
      });
    const dialog = target.querySelector("[role=dialog]");
    dialog.onkeydown = (e) => {
      if (e.key === "Escape") {
        selected = null;
        render();
      }
      if (e.key === "Tab") {
        const items = [
          ...dialog.querySelectorAll("button,input,select,textarea,summary"),
        ].filter((x) => !x.disabled && x.getClientRects().length);
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    if (sameUnit) restorePanels(target, openPanels);
    let focusTarget = focusId ? target.querySelector("#" + focusId) : null;
    if (focusEquipment)
      focusTarget = [...target.querySelectorAll("input,select")].find(
        (el) =>
          el.dataset[focusEquipment] === focusValue &&
          el.dataset.model === focusModel,
      );
    (focusTarget ?? target.querySelector("#close-config")).focus({
      preventScroll: true,
    });
    if (sameUnit) restoreArmyScroll(root, scroll);
  }
  await resume(true);
}
