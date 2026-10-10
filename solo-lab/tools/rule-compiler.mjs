// Conservative extraction of numerical combat facts. Original rule prose stays in the local cache.
// Conditions are not inferred as true: every imported effect requires explicit scenario confirmation.
export function compileRule(name, prose) {
  const text = prose
    .replace(/[\*\^]/g, "")
    .replace(/[\u00a0\u2011]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const effects = {},
    limitations = [];
  const phase =
    /melee (?:attack|weapon)/i.test(text) &&
    !/ranged (?:attack|weapon)/i.test(text)
      ? "fight"
      : /ranged (?:attack|weapon)|Ballistic Skill/i.test(text) &&
          !/melee (?:attack|weapon)/i.test(text)
        ? "shoot"
        : "both";
  // Choices, dice pools and branched effects need an explicit preset rather than guessed combined effects.
  const branching =
    /select one of|choose one of|following abilities|below.*below|if .*otherwise|either.*or.*ability|all other|for each|instead/i.test(
      text,
    );
  if (!branching) {
    if (/you can re.?roll one Hit roll/i.test(text))
      effects.singleHitReroll = 1;
    if (/you can re.?roll one Wound roll/i.test(text))
      effects.singleWoundReroll = 1;
    if (/\[LETHAL HITS\]/i.test(text)) effects.lethalHits = true;
    const sustained = text.match(/\[SUSTAINED HITS (\d)\]/i);
    if (sustained) effects.sustainedHits = +sustained[1];
    if (/\[DEVASTATING WOUNDS\]/i.test(text)) effects.devastatingWounds = true;
    if (/\[IGNORES COVER\]/i.test(text)) effects.ignoresCover = true;
    if (/\[TWIN.LINKED\]/i.test(text)) effects.woundReroll = "failed";
    if (/you can re.?roll (?:the |that )?Hit roll/i.test(text))
      effects.hitReroll = "failed";
    else if (/re.?roll (?:a |the )?Hit rolls? of 1/i.test(text))
      effects.hitReroll = "ones";
    if (/you can re.?roll (?:the |that )?Wound roll/i.test(text))
      effects.woundReroll = "failed";
    else if (/re.?roll (?:a |the )?Wound rolls? of 1/i.test(text))
      effects.woundReroll = "ones";
    for (const [pattern, key] of [
      [
        /add (\d) to the (?:Attacks characteristic|Attacks and Strength characteristics)/i,
        "attacksBonus",
      ],
      [/add (\d) to the Strength characteristic/i, "strengthBonus"],
      [
        /improve the (?:Ballistic|Weapon) Skill characteristic.*?by (\d)/i,
        "skillBonus",
      ],
      [/improve the Armour Penetration characteristic.*?by (\d)/i, "apBonus"],
      [/add (\d) to the Damage characteristic/i, "damageBonus"],
    ]) {
      const m = text.match(pattern);
      if (m) effects[key] = +m[1];
    }
    if (/add (\d) to the Attacks and Strength characteristics/i.test(text))
      effects.strengthBonus = effects.attacksBonus;
    const incoming =
      /attack targets this unit|attack that targets this unit|attack is allocated to this model/i.test(
        text,
      );
    const hit = text.match(
      /(add|subtract) 1 (?:to|from) (?:the|that) Hit roll/i,
    );
    if (hit)
      effects[incoming ? "incomingHitMod" : "hitMod"] =
        hit[1].toLowerCase() === "add" ? 1 : -1;
    const wound = text.match(
      /(add|subtract) 1 (?:to|from) (?:the|that) Wound roll/i,
    );
    if (wound)
      effects[incoming ? "incomingWoundMod" : "woundMod"] =
        wound[1].toLowerCase() === "add" ? 1 : -1;
    const fnp = text.match(/Feel No Pain (\d)\+/i);
    if (fnp && !/Psychic|mortal wounds|once per|on a|on an/i.test(text))
      effects.fnp = +fnp[1];
    const inv = text.match(/(\d)\+ (?:invulnerable save|InSv)/i);
    if (inv) effects.invuln = +inv[1];
    if (/has (?:the )?Stealth|have (?:the )?Stealth/i.test(text))
      effects.stealth = true;
  }
  if (/once per|once in|once each|once a/i.test(text))
    limitations.push("Limited use: availability must be confirmed.");
  if (/leading|attached/i.test(text))
    limitations.push("Requires the specified Leader or attachment.");
  if (/within \d+|within range|closest|visible|objective/i.test(text))
    limitations.push(
      "Range, visibility or objective condition must be confirmed.",
    );
  if (
    /below|battle.shocked|destroyed|remaining|charged|charge move|remained stationary/i.test(
      text,
    )
  )
    limitations.push("Requires the source’s unit state or movement condition.");
  if (/token|points|CP|test|roll.*D6|ritual|blessing|pact/i.test(text))
    limitations.push(
      "Resource costs, prerequisite tests and self-damage are not resolved.",
    );
  if (/this model|the bearer/i.test(text))
    limitations.push(
      "May affect only the bearer: choose the affected weapon bearers, not the whole squad.",
    );
  const count = Object.keys(effects).length;
  return {
    phase,
    effects,
    status: count ? "components" : "reference",
    limitations,
    summary: count
      ? "Selected combat components only; confirm the complete source conditions."
      : "No automatic effect in this attack calculator. Open the source and use manual controls where applicable.",
  };
}
