const normalize = (value) => String(value).replace(/^Faction:\s*/i, "").replace(/[*^_]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export function matchesUnitKeywords(unit, phrase) {
  const wanted = normalize(phrase);
  if (normalize(unit.name) === wanted) return true;
  const keywords = [...new Set((unit.categories ?? []).map(normalize))].filter(Boolean);
  if (keywords.includes(wanted)) return true;
  // A phrase such as IMPERIAL KNIGHTS DOMINUS requires both keywords.
  const seen = new Set();
  function consume(rest) {
    if (!rest) return true;
    if (seen.has(rest)) return false;
    seen.add(rest);
    return keywords.some((keyword) => rest === keyword || (rest.startsWith(keyword + " ") && consume(rest.slice(keyword.length + 1))));
  }
  return consume(wanted);
}
