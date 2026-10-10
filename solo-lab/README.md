# 40K Combat Lab

A browser army builder and unit-versus-unit combat calculator. The previous battlefield, movement, objectives and AI battle simulation have been removed. Existing Army List saves remain compatible.

## Combat calculator

The starting example is **5 Custodian Guard vs 1 Cerastus Knight Lancer**. Choose factions and units on either side, or choose a unit/model count from the saved Army A/B. Select the defensive profile and one weapon profile per unit. Saved army wargear, attachments, Enhancements and abilities are not applied to combat automatically.

Select Shooting or Fight phase, choose who attacks first, and optionally let surviving models fight back in melee. Configure model counts, Toughness, Save, Invulnerable Save, Wounds per model, wounds remaining on the first model, weapon bearers, A, BS/WS, S, AP and D. Profiles can be overridden for a controlled experiment. Model counts are experimental and are not restricted to legal squad sizes. Every model shares the chosen defensive profile.

Supported effects: hit/wound modifiers capped at +/-1, re-roll 1s or failed hit/wound rolls, Benefit of Cover in shooting, Feel No Pain, Lethal Hits, Sustained Hits, critical-hit thresholds, BS/WS changes, Strength/attacks/AP/damage bonuses, defensive hit/wound modifiers, AP reduction and damage reduction (minimum 1 before Feel No Pain). A and D accept integers, D3, D6, and expressions such as 2D6+1. Unsupported expressions fail validation; automatic-hit profiles need an explicit supported manual replacement. One weapon profile is resolved per unit; alternative strike/sweep profiles are separate choices. Named Custodes options use the September 2026 Codex preview: Rendax, Dacatarai, Kaptaris and Salvus check phase, target type, eligibility and readiness. Captain-General checks the receiving unit’s Custodes keyword and excludes Monsters/Vehicles; the range checkbox is a user assumption. Current Guard Impenetrable Defence assumes either unit is within objective range and excludes Monster/Vehicle targets. Repeated re-rolls do not stack; Sustained Hits uses the highest selected value. Conservai/Calistus, other unit abilities, other weapon keywords, Stratagems, Detachment rules, mixed defenders and mortal wounds remain unsupported.

**Roll attacks** displays attack-count dice when needed, Hit rolls, Wound rolls, Saving throws, Damage, and Feel No Pain rolls. Re-rolled dice show an arrow; hovering reveals the original result. The display limits each stage to 60 dice; JSON exports retain the complete trace. Excess normal damage does not spill to another model. Wounded models take damage first. Attacks back use surviving model counts, with selected weapon bearers assumed to survive first. Range, eligibility and fight order are supplied by the experiment rather than calculated from a battlefield.

**Run simulations** repeats the same scenario 1,000, 10,000 or 50,000 times in a web worker. Results show wounds lost and models destroyed on each side, chance of unit destruction, a 95% Wilson interval, and the wounds-lost distribution. Lost wounds are capped at remaining health; they are not uncapped raw damage. Every trial resets both units. Monte Carlo uncertainty does not account for omitted rules.

The same random seed reproduces a sequence or simulation batch. **New seed** generates another seed. Save/load one scenario locally or export/import scenario JSON. Export rolls and simulation results with the scenario and seed. Combat scenarios use `combat-lab-1`; legacy battlefield saves cannot be imported. Nothing is written back into Army List models after combat.

## Army Lists

Faction > Points > Detachments > Units > Review. The snapshot includes 34 main faction/chapter catalogues and two Titan auxiliary catalogues. Shared libraries/root imports are resolved. Allied, Legends and narrative entries are filtered by default. Configure model counts, Warlord, Leader/Support attachments, Enhancement selections, and manual wargear quantities. Build two independent browser-local armies and export/import JSON.

Army validation is partial: points budget, simple model-count prices, source model ranges, basic duplicate/Epic Hero limits, Warlord count, DP budget, Force Dispositions and attachment existence/counts. Complex conditional costs are flagged; unknown costs remain unknown. Weapon replacement rules, mixed composition, specific Bodyguard eligibility, allied restrictions and full Enhancement legality are unfinished. A passed basic check does not establish matched-play legality.

## Data and deployment

Faction JSON is in `public/armies/`, pinned to BSData commit `cc58ee3b2c23f90af9d00e7bf234cd703b762299` (9 October 2026). Numeric characteristics and selection facts are community data and have not been reconciled with the official points manual. Ability/rule prose is omitted. Regenerate with `node tools/import-armies.mjs`, using the local research cache or pinned public source. This is not a live or fully validated rules feed. The combat calculator overlays Custodian Guard Sodality defensive and Guardian Spear characteristics from the [official 24 September datasheet preview](https://www.warhammer-community.com/en-gb/articles/2xxurx9j/first-look-adeptus-custodes-datasheets/). Other Custodes profiles and Army Lists still use the older community snapshot. Ka’tahs are based on the [25 September army rules preview](https://www.warhammer-community.com/en-gb/articles/vygelghy/new-army-rules-from-codex-adeptus-custodes/). Saved older scenarios retain their characteristics until explicitly upgraded.

Production: https://codex-imperium.vercel.app. Vercel builds from the repository's `main` branch with root `solo-lab`, using `npm ci`, `npm run build` and output `dist`. No backend or environment variables are needed. Browser-local saves do not transfer automatically between domains.

## Development and verification

Run `npm ci`, `npm run dev`, `npm test`, and `npm run build`. Tests cover faction data/army validation and attack calculations: Strength thresholds, AP/cover/invulnerable saves, damage allocation, Feel No Pain, re-rolls, dice expressions, surviving attacks back, deterministic seeds and agreement with an analytic damage expectation. Browser checks cover profile selection, phase/order changes, worker simulations, saved army handoff, scenario persistence, validation and responsive layout.
