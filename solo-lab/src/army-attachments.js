import { attachedEnhancementIssues } from "./army-enhancements.js";
const normalize = (value) =>
  String(value).replace(/[*^_]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
export function attachmentRole(unit) {
  if (!unit) return null;
  return (
    unit.attachment?.role ??
    (unit.categories.includes("Support")
      ? "Support"
      : unit.categories.includes("Leader")
        ? "Leader"
        : null)
  );
}
export function eligibleBodyguard(unit, target) {
  if (!attachmentRole(unit) || !unit.attachment?.targets.length || !target)
    return false;
  const names = [target.name, ...target.categories].map(normalize);
  return unit.attachment.targets.some((name) => {
    const normalized = normalize(name);
    if (names.includes(normalized)) return true;
    // This is an intersection of keywords, not a datasheet name.
    return normalized === "battleline imperium infantry" &&
      ["battleline", "imperium", "infantry"].every((keyword) => names.includes(keyword));
  });
}
function exceptionAllows(source, others, bodyguard) {
  if (!source || !others.length || !bodyguard) return false;
  const matches = (names, unit) =>
    names.some((name) =>
      [unit.name, ...unit.categories].map(normalize).includes(normalize(name)),
    );
  return (source.attachment?.exceptions ?? []).some(
    (rule) =>
      (!rule.targets.length || matches(rule.targets, bodyguard)) &&
      others.some((other) => matches(rule.companions, other)),
  );
}
export function attachmentIssues(army, data) {
  const issues = attachedEnhancementIssues(army, data);
  const rows = new Map(army.units.map((row) => [row.id, row]));
  const unit = (row) => data.units.find((u) => u.id === row.unitId);
  function groupUnits(row, seen = new Set()) {
    if (seen.has(row.id)) return [];
    seen.add(row.id);
    return [
      unit(row),
      ...army.units
        .filter((child) => child.attachment === row.id)
        .flatMap((child) => groupUnits(child, seen)),
    ].filter(Boolean);
  }
  for (const row of army.units) {
    const source = unit(row),
      role = source && attachmentRole(source);
    if (!source) continue;
    if (role === "Support" && !row.attachment)
      issues.push(`${source.name}: Support needs a Bodyguard attachment.`);
    if (!row.attachment) continue;
    const target = rows.get(row.attachment);
    if (
      !role ||
      !target ||
      target === row ||
      !eligibleBodyguard(source, unit(target))
    )
      issues.push(`${source.name}: choose an eligible Bodyguard unit.`);
    if (!source.attachment?.targets.length)
      issues.push(`${source.name}: Bodyguard eligibility needs source review.`);
    const seen = new Set([row.id]);
    let parent = row;
    while (parent.attachment && rows.has(parent.attachment)) {
      if (seen.has(parent.attachment)) {
        issues.push(`${source.name}: attachment chain contains a cycle.`);
        break;
      }
      seen.add(parent.attachment);
      parent = rows.get(parent.attachment);
    }
    issues.push(
      ...(source.attachment?.review ?? []).map(
        (message) => `${source.name}: ${message}`,
      ),
    );
  }
  for (const target of army.units) {
    const attached = army.units.filter((row) => row.attachment === target.id);
    for (const role of ["Leader", "Support"]) {
      const peers = attached.filter(
        (row) => attachmentRole(unit(row)) === role,
      );
      const permittedPair =
        peers.length === 2 &&
        peers.some((row, i) =>
          exceptionAllows(unit(row), groupUnits(peers[1 - i]), unit(target)),
        );
      if (peers.length > 1 && !permittedPair)
        issues.push(
          `Only one ${role} can attach to ${unit(target)?.name ?? "each Bodyguard unit"}.`,
        );
    }
  }
  return [...new Set(issues)];
}
export function attachmentCandidates(army, data, row) {
  const source = data.units.find((u) => u.id === row.unitId);
  return army.units.filter((target) => {
    if (
      target.id === row.id ||
      !eligibleBodyguard(
        source,
        data.units.find((u) => u.id === target.unitId),
      )
    )
      return false;
    const candidate = {
      ...army,
      units: army.units.map((r) =>
        r.id === row.id ? { ...r, attachment: target.id } : r,
      ),
    };
    return !attachmentIssues(candidate, data).some((message) =>
      /cycle|Only one|attached unit Enhancement limit/.test(message),
    );
  });
}
