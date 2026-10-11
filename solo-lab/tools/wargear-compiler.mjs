// Preserve selection structure; never infer replacement groups from weapon names.
export function compileEquipment(unit, { children, bounds, options }) {
  const weapons = new Set(
    options.filter((o) => o.type === "weapon").map((o) => o.id),
  );
  const review = new Set();
  const pending = [];
  function compile(n, seen = new Set()) {
    const key = n.targetId ?? n.id;
    if (seen.has(key)) return null;
    const next = new Set(seen).add(key);

    const nodes = children(n)
      .filter((x) => !x.hidden)
      .map((x) => compile(x, next))
      .filter(Boolean);
    if (!nodes.length && !weapons.has(n.id)) return null;
    const b = bounds(n);
    const constraintIds = new Set(
      (n.constraints ?? [])
        .filter(
          (c) =>
            c.field === "selections" && ["self", "parent"].includes(c.scope),
        )
        .map((c) => c.id),
    );
    const changes = [...(n.modifiers ?? [])];
    function scan(x) {
      if (!x || typeof x !== "object") return;
      if (
        x.field &&
        (constraintIds.has(x.field) || ["error", "hidden"].includes(x.field))
      )
        changes.push({ ...x, grouped: true });
      for (const v of Object.values(x)) if (typeof v === "object") scan(v);
    }
    scan(n.modifierGroups);
    pending.push({ n, changes, constraintIds });
    if (weapons.has(n.id))
      return {
        id: n.id,
        sourceId: n.targetId ?? n.id,
        name: n.name,
        kind: "weapon",
        ...b,
      };
    return {
      id: n.id,
      sourceId: n.targetId ?? n.id,
      name: n.name,
      kind:
        n.type === "model"
          ? "model"
          : n !== unit && n.type !== "upgrade" && (b.max !== null || b.min)
            ? "group"
            : "bundle",
      ...(n === unit && n.type !== "model" ? { min: 0, max: null } : b),
      default: n.defaultSelectionEntryId ?? null,
      children: nodes,
    };
  }
  const tree = compile(unit);
  const models = [];
  function findModels(n) {
    if (!n) return;
    if (n.kind === "model" && n.id !== unit.id) models.push(n);
    else (n.children ?? []).forEach(findModels);
  }
  if (unit.type !== "model") findModels(tree);
  const refs = new Set([unit.id, unit.targetId]);
  const nodes = new Map();
  function index(n) {
    if (!n) return;
    nodes.set(n.id, n);
    refs.add(n.id);
    refs.add(n.sourceId);
    (n.children ?? []).forEach(index);
  }
  index(tree);
  const scopes = new Set(["unit", unit.id, unit.targetId]);
  const operators = new Set([
    "atLeast",
    "atMost",
    "lessThan",
    "greaterThan",
    "equalTo",
  ]);
  const conditions = (list) =>
    list?.every(
      (q) =>
        q.field === "selections" &&
        scopes.has(q.scope) &&
        refs.has(q.childId) &&
        operators.has(q.type),
    )
      ? list.map((q) => ({ id: q.childId, type: q.type, value: q.value }))
      : null;
  const restrictions = [];
  for (const { n, changes, constraintIds } of pending) {
    const compiled = nodes.get(n.id);
    if (!compiled) continue;
    for (const c of n.constraints ?? [])
      if (c.field === "selections" && c.type === "max" && scopes.has(c.scope))
        restrictions.push({
          name: n.name,
          id: n.targetId ?? n.id,
          max: c.value,
        });
    for (const m of changes) {
      if (constraintIds.has(m.field)) {
        const c = n.constraints.find((c) => c.id === m.field);
        const tests = conditions(m.conditions ?? []);
        const repeats = m.repeats?.length === 1 ? m.repeats[0] : null;
        const repeat =
          repeats &&
          repeats.field === "selections" &&
          scopes.has(repeats.scope) &&
          refs.has(repeats.childId) &&
          repeats.value > 0 &&
          repeats.repeats === 1 &&
          !repeats.roundUp
            ? { id: repeats.childId, every: repeats.value }
            : null;
        if (
          !m.grouped &&
          !m.conditionGroups &&
          tests &&
          (!m.repeats || repeat) &&
          ["set", "increment", "decrement"].includes(m.type)
        ) {
          (compiled.boundsRules ??= []).push({
            bound: c.type,
            type: m.type,
            value: m.value,
            conditions: tests,
            ...(repeat ? { repeat } : {}),
          });
          continue;
        }
      }
      if (m.field === "error" && m.type === "add") {
        const list =
          m.conditions ??
          (m.conditionGroups?.length === 1 &&
          m.conditionGroups[0].type === "and" &&
          !m.conditionGroups[0].conditionGroups
            ? m.conditionGroups[0].conditions
            : null);
        const tests = conditions(list);
        if (tests?.length && !m.repeats && !m.grouped) {
          restrictions.push({
            name: n.name,
            message: m.value.replaceAll("{this}", n.name),
            conditions: tests,
          });
          continue;
        }
        review.add(
          n.name + ": conditional equipment limits need source review.",
        );
      }
      if (constraintIds.has(m.field) || (m.field === "hidden" && n !== unit))
        review.add(
          n.name + ": conditional equipment limits need source review.",
        );
    }
  }
  return { version: 1, tree, models, restrictions, review: [...review] };
}
