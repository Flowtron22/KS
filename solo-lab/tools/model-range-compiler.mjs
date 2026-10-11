// Alternative model packages describe choices, not models to add together.
export function compileModelRange(unit, { children, bounds }) {
  function count(node, seen = new Set()) {
    const key = node.targetId ?? node.id;
    if (seen.has(key)) return { min: 0, max: 0 };
    const next = new Set(seen).add(key);
    const nodes = children(node).filter((n) => !n.hidden);
    const ranges = nodes.map((n) => count(n, next));
    const models = ranges.filter((r) => r.max > 0);
    const b = bounds(node);
    if (node.type === "model" && !(node === unit && models.length))
      return { min: b.min, max: b.max ?? Math.max(1, b.min) };
    if (
      node !== unit &&
      nodes.some((n) => n.type === "model") &&
      (b.min || b.max !== null)
    )
      return {
        min: b.min,
        max:
          b.max === 1
            ? Math.max(1, ...models.map((r) => r.max))
            : (b.max ?? b.min),
      };
    if (node !== unit && b.max === 1 && models.length)
      return {
        min: b.min ? Math.min(...models.map((r) => r.min)) : 0,
        max: Math.max(...models.map((r) => r.max)),
      };
    return {
      min: ranges.reduce((sum, r) => sum + r.min, 0),
      max: ranges.reduce((sum, r) => sum + r.max, 0),
    };
  }
  const range = count(unit);
  return { min: range.min || 1, max: Math.max(range.min || 1, range.max || 1) };
}
