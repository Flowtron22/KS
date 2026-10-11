export function compileAttachment(profiles, categories) {
  const rules = profiles.filter((p) => ["Leader", "Support"].includes(p.name));
  const role =
    rules.some((p) => p.name === "Support") || categories.includes("Support")
      ? "Support"
      : rules.length || categories.includes("Leader")
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
          .split(/\r?\n/)
          .filter((line) => /^\s*[-•]\s/.test(line))
          .map((line) =>
            line
              .replace(/^\s*[-•]\s*/, "")
              .replace(/[*^_]/g, "")
              .trim(),
          ),
      ),
    ),
  ];
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
