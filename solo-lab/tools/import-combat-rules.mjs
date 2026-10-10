import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { compileRule } from "./rule-compiler.mjs";
import { armyOptions } from "./army-rule-options.mjs";
const rawDir =
  process.argv[2] ?? new URL("../../research/raw/", import.meta.url);
const armyDir = new URL("../public/armies/", import.meta.url);
const index = JSON.parse(await readFile(new URL("index.json", armyDir)));
const cats = new Map();
for (const file of await readdir(rawDir)) {
  if (!file.endsWith(".json")) continue;
  const bytes = await readFile(
    typeof rawDir === "string" ? `${rawDir}/${file}` : new URL(file, rawDir),
  );
  const value = JSON.parse(bytes),
    c = value.catalogue ?? value.gameSystem;
  cats.set(c.id, {
    ...c,
    file,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
function walk(n, fn) {
  if (!n || typeof n !== "object") return;
  if (!Array.isArray(n)) fn(n);
  for (const v of Object.values(n)) if (typeof v === "object") walk(v, fn);
}
const ruleProfile = (n) =>
  n.typeName &&
  n.characteristics?.some((x) =>
    ["Description", "Effect", "Orders"].includes(x.name),
  );
const armyProfile = (n) =>
  /^(Orders|Quality|Deed|Blessings of Khorne|Rituals)$/.test(n.typeName ?? "");
const output = {
  version: 1,
  commit: index.commit,
  checkedOn: "2026-10-10",
  officialReconciled: false,
  definitions: {},
  factions: {},
};
for (const faction of index.factions) {
  const army = JSON.parse(await readFile(new URL(faction.file, armyDir))),
    cat = cats.get(faction.id),
    graph = new Map(),
    libraries = [],
    visited = new Set();
  if (cat.sha256 !== army.source.sha256)
    throw Error(
      `Raw source does not match the pinned army snapshot: ${faction.name}`,
    );
  function load(c) {
    if (visited.has(c.id)) return;
    visited.add(c.id);
    for (const l of c.catalogueLinks ?? []) {
      const d = cats.get(l.targetId);
      if (!d) throw Error(`Missing dependency ${l.targetId}`);
      load(d);
    }
    libraries.push(c);
    walk(c, (n) => {
      if (n.id) graph.set(n.id, { n, file: c.file });
    });
  }
  const system = cats.get(cat.gameSystemId);
  if (system) load(system);
  load(cat);
  const rules = new Map(),
    units = {},
    weapons = {};
  function add(n, group, provider) {
    if (graph.get(n.id)?.file === "Warhammer 40,000.json") return;
    if (
      !(ruleProfile(n) || typeof n.description === "string") ||
      !n.name ||
      /Crusade|Battle Honours|Battle Scars/i.test(n.name)
    )
      return;
    const text =
      n.description ??
      n.characteristics?.find((x) => x.name === "Description")?.$text ??
      n.characteristics?.find((x) => x.name === "Effect")?.$text ??
      n.characteristics?.find((x) => x.name === "Orders")?.$text ??
      "";
    const key = n.id,
      found = rules.get(key);
    if (found) {
      if (provider && !found.providers.includes(provider))
        found.providers.push(provider);
      return key;
    }
    const compiled = compileRule(n.name, text);
    for (const c of n.characteristics ?? [])
      if (["Warp Charge", "Roll"].includes(c.name))
        compiled.limitations.push(
          `Source prerequisite (${c.name}): ${c.$text}. Resolve this before the attack experiment.`,
        );
    rules.set(key, {
      id: key,
      name: n.name,
      group,
      providers: provider ? [provider] : [],
      ...compiled,
      type: n.typeName ?? "Army rule",
      source: { file: graph.get(key)?.file ?? cat.file, entryId: key },
    });
    const options = armyOptions(n.name, army.name);
    if (armyOptions(n.name).length) {
      rules.get(key).effects = {};
      rules.get(key).status = "reference";
    }
    for (let i = 0; i < options.length; i++) {
      const o = options[i],
        id = key + ":" + i;
      rules.set(id, {
        id,
        name: n.name + " — " + o.suffix,
        group: "army",
        providers: [],
        phase: o.phase,
        effects: o.effects,
        status: "components",
        exclusive: o.exclusive ?? null,
        limitations: [
          o.condition,
          "Only the listed combat effect is resolved; prerequisites and other parts remain outside this experiment.",
        ],
        summary: "Conditional army-rule combat effect.",
        source: { file: graph.get(key)?.file ?? cat.file, entryId: key },
      });
    }
    return key;
  }
  // Army rules directly declared by the faction and its imported faction libraries.
  for (const c of libraries.filter(
    (c) =>
      c.id === cat.id ||
      (c.library &&
        (c.name.includes(army.name) ||
          (army.name === "Aeldari" && c.name.includes("Aeldari")))),
  ))
    for (const n of c.rules ?? []) add(n, "army");
  function visit(n, ids, provider, seen = new Set(), depth = 0) {
    if (!n || depth > 20 || seen.has(n.id)) return;
    // Optional campaign trees contain rules for many unrelated units. Keep
    // them in the wider library, not the unit's default datasheet choices.
    if (
      /^(Crusade|Weapon Modifications|Battle Honours|Battle Traits)$/i.test(
        n.name ?? "",
      )
    )
      return;
    const next = new Set(seen).add(n.id);
    const id = add(n, "unit", provider);
    if (id) ids.add(id);
    if (/Weapons/.test(n.typeName ?? ""))
      weapons[n.id] =
        n.characteristics?.find((x) => x.name === "Keywords")?.$text ?? "";
    for (const link of n.infoLinks ?? []) {
      const target = graph.get(link.targetId)?.n;
      if (!target) throw Error(`Missing rule ${link.targetId}`);
      visit(target, ids, provider, next, depth + 1);
    }
    for (const k of [
      "profiles",
      "rules",
      "selectionEntries",
      "selectionEntryGroups",
      "entryLinks",
    ])
      for (const child of n[k] ?? []) {
        if (child.targetId) {
          const target = graph.get(child.targetId)?.n;
          if (target) visit(target, ids, provider, next, depth + 1);
        }
        visit(child, ids, provider, next, depth + 1);
      }
  }
  for (const u of army.units) {
    const ids = new Set();
    visit(graph.get(u.id)?.n, ids, u.name);
    units[u.id] = [...ids];
  }
  // Detachments, Enhancements and Stratagems are catalogued separately from units.
  for (const c of libraries.filter(
    (c) =>
      c.id === cat.id ||
      (c.library &&
        (c.name.includes(army.name) ||
          (army.name === "Aeldari" && c.name.includes("Aeldari")))),
  ))
    walk(c, (n) => {
      if (ruleProfile(n)) {
        if (!rules.has(n.id)) add(n, armyProfile(n) ? "army" : "faction");
        else if (armyProfile(n)) rules.get(n.id).group = "army";
      }
    });
  for (const [id, value] of rules) {
    const { providers, group, ...definition } = value;
    output.definitions[id] = definition;
  }
  output.factions[faction.id] = {
    name: faction.name,
    source: army.source,
    groups: Object.fromEntries([...rules].map(([id, r]) => [id, r.group])),
    units,
    weapons,
  };
  console.log(
    `${faction.name}: ${rules.size} rules, ${Object.keys(weapons).length} weapon profiles`,
  );
}
await mkdir(new URL("../public/rules/", import.meta.url), { recursive: true });
for (const f of index.factions) {
  const data = output.factions[f.id];
  const definitions = Object.fromEntries(
    Object.keys(data.groups).map((id) => [id, output.definitions[id]]),
  );
  await writeFile(
    new URL("../public/rules/" + f.file, import.meta.url),
    JSON.stringify({
      version: output.version,
      commit: output.commit,
      checkedOn: output.checkedOn,
      ...data,
      definitions,
    }),
  );
}
await writeFile(
  new URL("../public/rules/index.json", import.meta.url),
  JSON.stringify(
    {
      version: output.version,
      commit: output.commit,
      checkedOn: output.checkedOn,
      officialReconciled: false,
      factions: index.factions.map((f) => ({
        id: f.id,
        name: f.name,
        file: f.file,
        rules: Object.keys(output.factions[f.id].groups).length,
      })),
    },
    null,
    2,
  ),
);
