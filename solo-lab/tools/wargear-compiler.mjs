// Preserve selection structure; never infer replacement groups from weapon names.
export function compileEquipment(unit, { children, bounds, options }) {
  const weapons = new Set(
    options.filter((o) => o.type === "weapon").map((o) => o.id),
  );
  const review = new Set();
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
      if (x.field && constraintIds.has(x.field)) changes.push(x);
      for (const v of Object.values(x)) if (typeof v === "object") scan(v);
    }
    scan(n.modifierGroups);
    if (
      changes.some(
        (m) =>
          constraintIds.has(m.field) || (m.field === "hidden" && n !== unit),
      )
    )
      review.add(n.name + ": conditional equipment limits need source review.");
    if (weapons.has(n.id))
      return { id: n.id, name: n.name, kind: "weapon", ...b };
    return {
      id: n.id,
      name: n.name,
      kind:
        n.type === "model"
          ? "model"
          : b.max !== null || b.min
            ? "group"
            : "bundle",
      ...b,
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
  return { version: 1, tree, models, review: [...review] };
}
