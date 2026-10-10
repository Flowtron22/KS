import { prepareRules } from "./rule-picker.js";

export function bindUnitControls(i, root, context) {
  const {
    pick,
    getScenario,
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
  } = context;
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
    const el = root.querySelector("[data-search]");
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
    Object.assign(getScenario().units[i], {
      toughness: num(stats.T) ?? 0,
      save: num(stats.Sv) ?? 7,
      wounds: num(stats.W) ?? 0,
      frontWounds: num(stats.W) ?? 1,
      invuln: num(stats.InSv) ?? 7,
    });
    if (getScenario().units[i].guardCodex)
      Object.assign(getScenario().units[i], {
        toughness: 7,
        save: 2,
        wounds: 5,
        frontWounds: 5,
        invuln: 4,
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
        u = getScenario().units[i],
        obj = sub ? u[key] : u,
        k = sub ?? key,
        allBearers = u.bearers === u.models;
      obj[k] =
        el.type === "checkbox"
          ? el.checked
          : el.type === "number"
            ? Number(el.value)
            : typeof obj[k] === "number"
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
        root.querySelector('[data-field="bearers"]').value = u.bearers;
        root.querySelector('[data-field="bearers"]').max = u.models;
      }
      if (key === "wounds") {
        root.querySelector('[data-field="frontWounds"]').value = u.frontWounds;
        root.querySelector('[data-field="frontWounds"]').max = u.wounds;
      }
    };
    if (el.tagName === "SELECT") el.onchange = update;
    else el.oninput = update;
  });
  root.querySelector("[data-saved]").onclick = () => chooseSaved(i);
  const refreshRules = (focusSearch = false) => {
    const weaponOpen = root.querySelector(".weapon-rule-panel").open;
    renderUnit(i);
    const nextRoot = root;
    nextRoot.querySelector(".rule-library").open = true;
    nextRoot.querySelector(".weapon-rule-panel").open = weaponOpen;
    if (focusSearch) {
      const input = nextRoot.querySelector("[data-rule-search]");
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    changed();
  };
  root.querySelector("[data-rule-scope]").onchange = (e) => {
    pick.ruleScope = e.target.value;
    refreshRules();
  };
  root.querySelector("[data-rule-search]").oninput = (e) => {
    pick.ruleSearch = e.target.value;
    refreshRules(true);
  };
  root.querySelector("[data-rule-choice]").onchange = (e) => {
    const u = getScenario().units[i];
    if (e.target.value && !u.ruleSelections.includes(e.target.value)) {
      if (u.ruleSelections.length >= 30) {
        notice("Maximum 30 named rules per scenario unit.");
        return;
      }
      u.ruleSelections.push(e.target.value);
      try {
        prepareRules(u, pick, getScenario().phase);
      } catch (err) {
        u.ruleSelections.pop();
        notice(err.message);
        refreshRules();
        return;
      }
      u.rulesConfirmed = false;
    }
    refreshRules();
  };
  root.querySelectorAll("[data-rule-remove]").forEach(
    (el) =>
      (el.onclick = () => {
        getScenario().units[i].ruleSelections = getScenario().units[
          i
        ].ruleSelections.filter((id) => id !== el.dataset.ruleRemove);
        if (getScenario().units[i].ruleComponents)
          delete getScenario().units[i].ruleComponents[el.dataset.ruleRemove];
        refreshRules();
      }),
  );
  root.querySelectorAll("[data-rule-check]").forEach(
    (el) =>
      (el.onchange = () => {
        const u = getScenario().units[i],
          key = el.dataset.ruleCheck;
        if (["rulesConfirmed", "weaponRules"].includes(key))
          u[key] = el.checked;
        else {
          u.weaponConditions ??= {};
          u.weaponConditions[key] = el.checked;
        }
        changed();
      }),
  );
  root.querySelectorAll("[data-rule-component]").forEach(
    (el) =>
      (el.onchange = () => {
        const u = getScenario().units[i],
          id = el.dataset.ruleComponent,
          key = el.dataset.componentKey;
        u.ruleComponents ??= {};
        const keys = new Set(
          u.ruleComponents[id] ??
            Object.keys(pick.data.combatRules.definitions[id].effects),
        );
        if (el.checked) keys.add(key);
        else keys.delete(key);
        u.ruleComponents[id] = [...keys];
        changed();
      }),
  );
  const guardUpdate = root.querySelector("[data-guard-update]");
  if (guardUpdate)
    guardUpdate.onclick = () => {
      upgradeGuard(i);
      getScenario().units[i].ruleSelections = [];
      applyWeapon(i);
      renderUnit(i);
      changed();
      notice(
        "September Guard defensive and Guardian Spear characteristics applied. Other Custodes profiles remain community data.",
      );
    };
}
