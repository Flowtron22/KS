import { compileModelRange } from "./model-range-compiler.mjs";
import { compileAttachment } from "./attachment-compiler.mjs";
import { compileEquipment } from "./wargear-compiler.mjs";
import { duplicatePriceRule } from "./duplicate-price.mjs";
import { compileCopyLimits } from "./unit-limits-compiler.mjs";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const rawDir = new URL("../../research/raw/", import.meta.url),
  out = new URL("../public/armies/", import.meta.url);
const commit = "cc58ee3b2c23f90af9d00e7bf234cd703b762299";
// Regenerate from the pinned public repository if the local research cache is absent.
try {
  await readdir(rawDir);
} catch {
  await mkdir(rawDir, { recursive: true });
  const res = await fetch(
    `https://api.github.com/repos/BSData/wh40k-11e/git/trees/${commit}`,
  );
  if (!res.ok) throw Error(`GitHub tree: ${res.status}`);
  const tree = await res.json();
  if (tree.truncated) throw Error("Source tree truncated");
  for (const f of tree.tree.filter(
    (f) => f.type === "blob" && f.path.endsWith(".json"),
  )) {
    const response = await fetch(
      `https://raw.githubusercontent.com/BSData/wh40k-11e/${commit}/${encodeURIComponent(f.path)}`,
    );
    if (!response.ok)
      throw Error(`Source download: ${response.status} ${f.path}`);
    await writeFile(new URL(f.path, rawDir), await response.text());
  }
}
const catalogues = [];
for (const file of await readdir(rawDir)) {
  const raw = await readFile(new URL(file, rawDir), "utf8");
  const j = JSON.parse(raw);
  catalogues.push({
    ...(j.catalogue ?? j.gameSystem),
    file,
    sha256: createHash("sha256").update(raw).digest("hex"),
  });
}
const byCatalogue = new Map(catalogues.map((c) => [c.id, c]));
const fields = new Set([
  "M",
  "T",
  "Sv",
  "W",
  "LD",
  "OC",
  "InSv",
  "Range",
  "A",
  "BS",
  "WS",
  "S",
  "AP",
  "D",
]);
const excluded =
  /Crusade|Battle Honours|Weapon Modifications|Battle Scars|Blackstone|Requisition|Boarding Actions/i;
const dispositions = [
  "Take and Hold",
  "Disruption",
  "Purge the Foe",
  "Priority Assets",
  "Reconnaissance",
];
function walk(x, fn) {
  if (!x || typeof x !== "object") return;
  if (Array.isArray(x)) {
    x.forEach((v) => walk(v, fn));
    return;
  }
  fn(x);
  for (const v of Object.values(x)) if (typeof v === "object") walk(v, fn);
}
function makeGraph(c) {
  const map = new Map(),
    seen = new Set();
  function load(cat) {
    if (seen.has(cat.id)) return;
    seen.add(cat.id);
    for (const l of cat.catalogueLinks ?? []) {
      const dep = byCatalogue.get(l.targetId);
      if (!dep) throw Error(`Missing library ${l.name}`);
      load(dep);
    }
    walk(cat, (n) => {
      if (n.id) map.set(n.id, n);
    });
  }
  load(c);
  return map;
}
function profile(p) {
  const stats = Object.fromEntries(
    (p.characteristics ?? [])
      .filter((c) => fields.has(c.name))
      .map((c) => [c.name, c.$text ?? c.value ?? ""]),
  );
  return Object.keys(stats).length
    ? { id: p.id, name: p.name, type: p.typeName, stats }
    : null;
}
function bounds(n) {
  const a = (n.constraints ?? []).filter(
    (c) => c.field === "selections" && ["self", "parent"].includes(c.scope),
  );
  return {
    min: a.find((c) => c.type === "min")?.value ?? 0,
    max: a.find((c) => c.type === "max")?.value ?? null,
  };
}
function resolve(n, map) {
  const t = map.get(n.targetId);
  return n.targetId
    ? {
        ...t,
        ...n,
        type: t?.type ?? n.type,
        modifiers: [...(t?.modifiers ?? []), ...(n.modifiers ?? [])],
      }
    : n;
}
function available(n, c) {
  let hidden = !!n.hidden;
  function condition(q) {
    if (q.scope !== "primary-catalogue") return null;
    if (q.type === "instanceOf") return q.childId === c.id;
    if (q.type === "notInstanceOf") return q.childId !== c.id;
    return null;
  }
  function group(g) {
    const values = [
      ...(g.conditions ?? []).map(condition),
      ...(g.conditionGroups ?? []).map(group),
    ];
    if (!values.length || values.includes(null)) return null;
    return g.type === "or" ? values.some(Boolean) : values.every(Boolean);
  }
  for (const m of n.modifiers ?? [])
    if (m.field === "hidden" && m.type === "set") {
      const ok = group({ ...m, type: "and" });
      if (ok === true) hidden = m.value === true || m.value === "true";
    }
  return !hidden;
}
function children(n, map) {
  return [
    ...(n.selectionEntries ?? []),
    ...(n.selectionEntryGroups ?? []),
    ...(n.entryLinks ?? []),
  ]
    .filter((x) => !excluded.test(x.name ?? ""))
    .map((x) => resolve(x, map))
    .filter((x) => x.id);
}
function flatten(n, map, fn, path = [], seen = new Set()) {
  const key = n.targetId ?? n.id;
  if (seen.has(key) || path.length > 12) return;
  fn(n, path);
  const next = new Set(seen).add(key);
  for (const x of children(n, map))
    flatten(x, map, fn, [...path, n.name], next);
}
function roots(c, seen = new Set(), origin = c) {
  if (seen.has(c.id)) return [];
  seen.add(c.id);
  let result = [...(c.selectionEntries ?? []), ...(c.entryLinks ?? [])].map(
    (n) => ({ n, origin: c }),
  );
  for (const l of c.catalogueLinks ?? [])
    if (l.importRootEntries) {
      const dep = byCatalogue.get(l.targetId);
      result.push(...roots(dep, seen, origin));
    }
  return result;
}
function modelRange(u, map) {
  return compileModelRange(u, { children: (n) => children(n, map), bounds });
}
function enhancementDetachments(n, map) {
  const ids = new Set();
  walk(n.modifiers, (x) => {
    if (
      x.field === "selections" &&
      ["lessThan", "atMost"].includes(x.type) &&
      map
        .get(x.childId)
        ?.costs?.some((c) => c.name === "Detachment Points" && c.value > 0)
    )
      ids.add(x.childId);
  });
  return [...ids];
}
function unit(u, map, origin, c) {
  const range = modelRange(u, map),
    profiles = new Map(),
    options = [],
    attachmentProfiles = [],
    categories = [
      ...new Set(
        (u.categoryLinks ?? [])
          .map((x) => x.name ?? map.get(x.targetId)?.name)
          .filter(Boolean),
      ),
    ];
  flatten(u, map, (n, path) => {
    if (!path.length)
      attachmentProfiles.push(
        ...(n.profiles ?? []),
        ...(n.infoLinks ?? [])
          .filter((l) => l.type === "profile")
          .map((l) => map.get(l.targetId))
          .filter(Boolean),
      );
    for (const p of [
      ...(n.profiles ?? []),
      ...(n.infoLinks ?? [])
        .filter((l) => l.type === "profile")
        .map((l) => map.get(l.targetId))
        .filter(Boolean),
    ]) {
      const v = profile(p);
      if (v) profiles.set(v.id, v);
    }
    if (path.length && n.type === "model")
      options.push({
        id: n.id,
        name: n.name,
        path,
        bounds: bounds(n),
        type: "model",
      });
    if (
      path.length &&
      n.type === "upgrade" &&
      !/Warlord|Detachment|Honour|Experience/i.test(n.name ?? "")
    ) {
      const rawProfiles = [
        ...(n.profiles ?? []),
        ...(n.infoLinks ?? []).map((l) => map.get(l.targetId)).filter(Boolean),
      ];
      const ps = rawProfiles.map(profile).filter(Boolean);
      const enhancement = (n.costs ?? []).some(
        (k) => k.name === "Enhancements" && k.value > 0,
      );
      const weapon = ps.some((p) => /Weapons/i.test(p.type));
      const equipment =
        !enhancement &&
        !weapon &&
        !path.some((name) => /Enhancements?/i.test(name)) &&
        rawProfiles.some((p) => p.typeName === "Abilities") &&
        !children(n, map).length;
      if (enhancement || weapon || equipment)
        options.push({
          id: n.id,
          name: n.name,
          path,
          bounds: bounds(n),
          type: enhancement ? "enhancement" : weapon ? "weapon" : "equipment",
          requiredDetachments: enhancement
            ? enhancementDetachments(n, map)
            : [],
          points: n.costs?.find((c) => c.name === "pts")?.value ?? 0,
        });
    }
  });
  const cost = u.costs?.find((c) => c.name === "pts");
  const modifiers = (u.modifiers ?? []).filter((m) => m.field === cost?.typeId);
  // Only direct model-count conditions are evaluated. Retain every other price rule for review.
  const modelIds = new Set([
    u.id,
    "model",
    ...children(u, map)
      .filter(
        (x) =>
          x.type === "model" ||
          children(x, map).some((n) => n.type === "model"),
      )
      .map((n) => n.id),
  ]);
  const priceRules = modifiers
    .filter(
      (m) =>
        !m.conditionGroups &&
        !m.repeats &&
        m.conditions?.length &&
        m.conditions.every(
          (q) =>
            q.field === "selections" &&
            modelIds.has(q.childId) &&
            [
              "atLeast",
              "greaterThan",
              "atMost",
              "lessThan",
              "equalTo",
            ].includes(q.type),
        ),
    )
    .map((m) => ({
      type: m.type,
      value: m.value,
      conditions: m.conditions.map((q) => ({ type: q.type, value: q.value })),
    }));
  let groupedPrice = false;
  walk(u.modifierGroups, (n) => {
    if (
      n.field === cost?.typeId &&
      ["set", "increment", "decrement"].includes(n.type)
    )
      groupedPrice = true;
  });
  const duplicatePriceRules = modifiers
    .map((m) => duplicatePriceRule(m, u.targetId ?? u.id))
    .filter(Boolean);
  const conditionalPrice =
    modifiers.length !== priceRules.length + duplicatePriceRules.length ||
    groupedPrice ||
    !cost;
  const sizes = [
    ...new Set([
      range.min,
      range.max,
      ...priceRules.flatMap((r) =>
        r.conditions.map((q) =>
          q.type === "greaterThan" ? q.value + 1 : q.value,
        ),
      ),
    ]),
  ]
    .filter((n) => n >= range.min && n <= range.max)
    .sort((a, b) => a - b);
  const ownFaction = c.name.split(" - ").at(-1),
    isChapter = c.name.includes("Adeptus Astartes"),
    originName = origin.name;
  const keywords = categories
    .filter((k) => k.startsWith("Faction: "))
    .map((k) => k.slice(9));
  const expected = isChapter
    ? ["Adeptus Astartes", ownFaction]
    : ({
        Aeldari: ["Asuryani", "Harlequins", "Ynnari"],
        "Chaos Space Marines": ["Heretic Astartes"],
        "Chaos Daemons": ["Legiones Daemonica"],
        "Agents of the Imperium": ["Agents of the Imperium", "Imperial Agents"],
        "Adeptus Titanicus": ["Adeptus Titanicus"],
        "Titanicus Traitoris": ["Titanicus Traitoris"],
      }[ownFaction] ?? [ownFaction]);
  const allied =
    categories.some((k) => k.startsWith("Allies:")) ||
    originName === "Unaligned Forces" ||
    (keywords.length
      ? !keywords.some((k) => expected.includes(k))
      : origin.id !== c.id &&
        !origin.library &&
        !(isChapter && originName.endsWith("Space Marines")));
  return {
    id: u.targetId ?? u.id,
    name: u.name,
    categories,
    role:
      categories.find((x) =>
        /Character|Battleline|Dedicated Transport/i.test(x),
      ) ?? "Other units",
    legend: /Legends/i.test(
      u.name + " " + categories.join(" ") + " " + originName,
    ),
    narrative: /Crucible/i.test(u.name + " " + categories.join(" ")),
    hidden: !!u.hidden,
    allied,
    origin: originName,
    models: range,
    attachment: compileAttachment(attachmentProfiles, categories),
    copyLimits: compileCopyLimits(u, map),
    sizes,
    points: cost?.value ?? null,
    priceRules,
    duplicatePriceRules,
    conditionalPrice,
    profiles: [...profiles.values()],
    equipment: compileEquipment(u, {
      children: (n) => children(n, map),
      bounds,
      options,
    }),
    options: [...new Map(options.map((o) => [o.id, o])).values()],
    source: { file: origin.file, entryId: u.targetId ?? u.id },
  };
}
await mkdir(out, { recursive: true });
const index = [];
for (const c of catalogues.filter((c) => c.library === false)) {
  const map = makeGraph(c),
    root = roots(c),
    units = new Map(),
    detachments = new Map();
  for (const { n, origin } of root) {
    const u = resolve(n, map);
    if (!available(u, c)) continue;
    if (["unit", "model"].includes(u.type)) {
      const id = u.targetId ?? u.id;
      if (!units.has(id)) units.set(id, unit(u, map, origin, c));
    } else if (
      /Detachment/i.test(u.name ?? "") &&
      !excluded.test(u.name) &&
      (origin.id === c.id ||
        (origin.library &&
          origin.name
            .replace(/ - .*Library/, "")
            .includes(c.name.split(" - ").at(-1))) ||
        (c.name.includes("Adeptus Astartes") &&
          origin.name.endsWith("Space Marines")))
    )
      flatten(u, map, (x) => {
        const dp = x.costs?.find((k) => k.name === "Detachment Points")?.value;
        if (dp > 0 && available(x, c)) {
          const cats = (x.categoryLinks ?? []).map(
            (k) => k.name ?? map.get(k.targetId)?.name,
          );
          detachments.set(x.targetId ?? x.id, {
            id: x.targetId ?? x.id,
            name: x.name,
            dp,
            dispositions: cats.filter((k) => dispositions.includes(k)),
            hidden: !!x.hidden,
          });
        }
      });
  }
  const name = c.name.split(" - ").at(-1),
    group = c.name.split(" - ")[0],
    slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-$/, "");
  const data = {
    id: c.id,
    name,
    group,
    auxiliary: /Titanicus|Traitoris/.test(name),
    source: {
      repo: "BSData/wh40k-11e",
      commit,
      file: c.file,
      sha256: c.sha256,
      url: `https://github.com/BSData/wh40k-11e/blob/${commit}/${encodeURIComponent(c.file)}`,
    },
    units: [...units.values()].sort((a, b) => a.name.localeCompare(b.name)),
    detachments: [...detachments.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };
  await writeFile(new URL(slug + ".json", out), JSON.stringify(data));
  index.push({
    id: c.id,
    name,
    group,
    auxiliary: data.auxiliary,
    file: slug + ".json",
    units: data.units.length,
    detachments: data.detachments.length,
  });
  console.log(
    `${name}: ${data.units.length} units / ${data.detachments.length} detachments`,
  );
}
await writeFile(
  new URL("index.json", out),
  JSON.stringify(
    {
      edition: 11,
      checkedOn: "2026-10-10",
      commit,
      officialPointsVerified: false,
      factions: index.sort(
        (a, b) =>
          a.group.localeCompare(b.group) || a.name.localeCompare(b.name),
      ),
    },
    null,
    2,
  ),
);
