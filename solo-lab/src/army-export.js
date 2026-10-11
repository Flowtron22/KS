import { armySummary, validateArmy, unitPoints } from "./army-core.js";
export function armyValidation(army, summary) {
  const review = summary.issues.filter((message) =>
    /source review|needs? review|Legacy wargear|check allied|manual review/i.test(
      message,
    ),
  );
  const errors = summary.issues.filter((message) => !review.includes(message));
  if (army.units.some((row) => row.pointsOverride !== null))
    review.push("Manual points override: verify the source cost.");
  const status = !army.units.length
    ? "draft"
    : errors.length
      ? "errors"
      : review.length
        ? "needs-review"
        : "checks-passed";
  return {
    status,
    label: {
      draft: "DRAFT",
      errors: "ERRORS",
      "needs-review": "NEEDS REVIEW",
      "checks-passed": "BASIC CHECKS PASSED",
    }[status],
    complete: false,
    errors,
    review,
    issues: [...new Set([...errors, ...review])],
  };
}
export function createArmyExport(army, data) {
  // Export a checked snapshot. Incoming validation labels are never trusted.
  const snapshot = validateArmy(army, data);
  const summary = armySummary(snapshot, data);
  const units = snapshot.units.map((row) => ({
    ...row,
    calculatedPoints: unitPoints(
      data.units.find((u) => u.id === row.unitId),
      row,
      snapshot,
    ),
  }));
  const known = units.reduce(
    (sum, row) => sum + (row.calculatedPoints ?? 0),
    0,
  );
  if (
    known !== summary.total ||
    new Set(units.map((row) => row.id)).size !== units.length
  )
    throw Error("Army export does not match the roster.");
  return {
    ...snapshot,
    units,
    source: data.source,
    total: summary.total,
    unknownPoints: summary.unknown,
    validation: armyValidation(snapshot, summary),
  };
}
export function rosterLabel(army, row, data) {
  const unit = data.units.find((u) => u.id === row.unitId);
  const matches = army.units.filter((r) => r.unitId === row.unitId);
  return (
    unit.name +
    (matches.length > 1
      ? " #" + (matches.findIndex((r) => r.id === row.id) + 1)
      : "")
  );
}
