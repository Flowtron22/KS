export function compileAttachment(profiles, categories, associations = []) {
  const rules = profiles.filter((p) => ["Leader", "Support"].includes(p.name));
  const links = associations.filter((a) =>
    ["Leading", "Supporting"].includes(a.name),
  );
  const role =
    rules.some((p) => p.name === "Support") ||
    categories.includes("Support") ||
    links.some((a) => a.name === "Supporting")
      ? "Support"
      : rules.length || categories.includes("Leader") || links.length
        ? "Leader"
        : null;
  if (!role) return null;
  const descriptions = rules.map(
    (p) =>
      p.characteristics?.find((c) => c.name === "Description")?.$text ?? "",
  );
  const targets = [
    ...new Set(
      descriptions.flatMap((text) =>
        text
          // Some catalogues put the entire Bodyguard list after the colon.
          .replace(
            /following units?[^\S\r\n]*:[^\S\r\n]*([^\s][^\r\n]*)/gi,
            (_, list) =>
              "following units:\n" +
              list
                .split(/,\s*/)
                .map((name) => "- " + name.trim())
                .join("\n"),
          )
          .split(/\r?\n/)
          .filter((line) => /^\s*[-•■▪●]\s/.test(line))
          .map((line) =>
            line
              .replace(/^\s*[-•■▪●]\s*/, "")
              .replace(/[*^_]/g, "")
              .replace(/[.]$/, "")
              .trim(),
          ),
      ),
    ),
  ];
  if (!targets.length) {
    // Only an explicit OR of unit identities is safe to use as a fallback.
    for (const link of links) {
      const groups = link.conditionGroups ?? [];
      if (
        groups.length !== 1 ||
        groups[0].type !== "or" ||
        groups[0].conditionGroups?.length ||
        link.conditions?.length
      )
        continue;
      const conditions = groups[0].conditions ?? [];
      if (
        conditions.every(
          (c) =>
            c.type === "instanceOf" &&
            c.field === "selections" &&
            c.scope === "self" &&
            c.value === 1 &&
            c.childName,
        )
      )
        targets.push(...conditions.map((c) => c.childName));
    }
  }
  const review = [];
  if (!targets.length)
    review.push("Bodyguard eligibility needs source review.");
  const exceptions = [];
  const names = (text) =>
    [...text.matchAll(/\*\*([^*]+)\*\*/g)].map((match) =>
      match[1].replace(/\^/g, "").trim(),
    );
  for (const text of descriptions) {
    if (
      /\b(?:unless|only if|only be|must|cannot|provided|as long as)\b/i.test(
        text,
      )
    )
      review.push("Additional Bodyguard conditions need source review.");
    if (!/even if|already attached|already been attached/i.test(text)) continue;
    const sentence = text.split(/\r?\n/).find((line) => /even if/i.test(line));
    const at = sentence?.search(/even if/i);
    const companions = sentence ? names(sentence.slice(at)) : [];
    if (companions.length && /already.*attached/i.test(sentence)) {
      exceptions.push({ targets: names(sentence.slice(0, at)), companions });
    } else review.push("Additional attachment conditions need source review.");
  }
  return { role, targets, exceptions, review: [...new Set(review)] };
}
