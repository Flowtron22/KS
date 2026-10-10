// Explicit alternatives from the pinned catalogue. These are conditional, post-activation experiments.
// Never combine mutually exclusive options or resolve prerequisite resource/test mechanics implicitly.
export function armyOptions(name, faction) {
  const owners = {
    "Dark Pacts": ["Chaos Space Marines"],
    "Doctrina Imperatives": ["Adeptus Mechanicus"],
    "Harbingers of Dread": ["Chaos Knights"],
    "Waaagh!": ["Orks"],
    "Nurgle's Gift (Aura)": ["Death Guard"],
    "For The Greater Good": ["T'au Empire"],
    "Prioritised Efficiency": ["Leagues of Votann"],
    "Shadow Puppeteer (Psychic)": ["Thousand Sons"],
    "Oath of Moment": [
      "Space Marines",
      "Black Templars",
      "Blood Angels",
      "Dark Angels",
      "Deathwatch",
      "Imperial Fists",
      "Iron Hands",
      "Raven Guard",
      "Salamanders",
      "Space Wolves",
      "Ultramarines",
      "White Scars",
    ],
  };
  if (faction && owners[name] && !owners[name].includes(faction)) return [];
  const opt = (suffix, phase, effects, condition, exclusive) => ({
    suffix,
    phase,
    effects,
    condition,
    exclusive,
  });
  if (name === "Shadow Puppeteer (Psychic)")
    return [
      opt(
        "Enemy hit rolls",
        "both",
        { incomingHitMod: -1 },
        "Ritual manifested; the enemy attacking this unit is the selected target within 24 inches and visible.",
      ),
      opt(
        "Psychic test 12+: enemy wound rolls",
        "both",
        { incomingWoundMod: -1 },
        "Ritual manifested with a test result of 12+; incoming attacks are from its selected enemy target.",
      ),
    ];
  if (name === "Dark Pacts")
    return [
      opt(
        "Lethal Hits",
        "both",
        { lethalHits: true },
        "Pact test and any D3 self-damage already resolved.",
        "dark-pact",
      ),
      opt(
        "Sustained Hits 1",
        "both",
        { sustainedHits: 1 },
        "Pact test and any D3 self-damage already resolved.",
        "dark-pact",
      ),
    ];
  if (name === "Doctrina Imperatives")
    return [
      opt(
        "Protector: BS",
        "shoot",
        { skillBonus: 1 },
        "Protector active; unit has Doctrina Imperatives.",
        "doctrina-skill",
      ),
      opt(
        "Protector: Battleline defence",
        "fight",
        { incomingHitMod: -1 },
        "Protector active; unit is Battleline or within 6 inches of friendly Battleline.",
        "doctrina-battleline",
      ),
      opt(
        "Conqueror: WS",
        "fight",
        { skillBonus: 1 },
        "Conqueror active; unit has Doctrina Imperatives.",
        "doctrina-skill",
      ),
      opt(
        "Conqueror: Battleline AP",
        "both",
        { apBonus: 1 },
        "Conqueror active; unit is Battleline or within 6 inches of friendly Battleline.",
        "doctrina-battleline",
      ),
    ];
  if (name === "Harbingers of Dread")
    return [
      opt(
        "Doom",
        "both",
        { woundMod: 1 },
        "Doom acquired; enemy is Battle-shocked.",
      ),
      opt(
        "Darkness",
        "shoot",
        { stealth: true },
        "Darkness acquired; the complete unit has Stealth.",
      ),
    ];
  if (name === "Waaagh!")
    return [
      opt(
        "Riled up",
        "both",
        { invuln: 5 },
        "Eligible Orks; War Cry or another valid rule has made this unit riled up.",
      ),
    ];
  if (name === "Nurgle's Gift (Aura)")
    return [
      opt(
        "Afflicted: Toughness",
        "both",
        { targetToughnessBonus: -1 },
        "Enemy is within current Contagion Range and is Afflicted.",
      ),
      opt(
        "Rattlejoint Ague",
        "both",
        { targetSaveBonus: 1 },
        "Rattlejoint chosen for army; enemy is Afflicted.",
        "plague",
      ),
    ];
  if (name === "For The Greater Good")
    return [
      opt(
        "Guided at Spotted target",
        "shoot",
        { skillBonus: 1 },
        "Eligible Guided unit targeting the enemy marked by an eligible Observer.",
      ),
      opt(
        "Markerlight Observer",
        "shoot",
        { ignoresCover: true },
        "The Observer marking this Spotted target has Markerlight.",
      ),
    ];
  if (name === "Prioritised Efficiency")
    return [
      opt(
        "Hostile Acquisition",
        "both",
        { hitMod: 1 },
        "Hostile Acquisition active; enemy within objective range.",
        "yield",
      ),
      opt(
        "Fortify Takeover: attacks",
        "both",
        { hitMod: 1 },
        "Fortify Takeover active; own unit within a controlled objective.",
        "yield",
      ),
      opt(
        "Fortify Takeover: defence",
        "both",
        { incomingWoundMod: -1 },
        "Fortify Takeover active; unit is not a Vehicle and incoming Strength exceeds Toughness.",
      ),
    ];
  if (name === "Oath of Moment")
    return [
      opt(
        "Chosen target: hits",
        "both",
        { hitReroll: "failed" },
        "Unit has Oath of Moment; this is the chosen target.",
      ),
      opt(
        "Codex Marines: wounds",
        "both",
        { woundMod: 1 },
        "Codex Space Marines Detachment; army contains no Blood Angels, Dark Angels, Deathwatch or Space Wolves; chosen target.",
      ),
    ];
  return [];
}
