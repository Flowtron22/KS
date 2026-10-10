# 40K Battle Simulator

A browser army builder with a solo Three.js battle prototype. Use **Army lists**, **Battle**, and **Simulations**. Each army in the basic battle can be controlled by the player, by AI, or by AI with confirmation before each action.

## Army lists

Faction → Points → Detachments → Units → Review. The JSON snapshot includes all 34 main faction/chapter catalogues in BSData's 11th-edition repository, plus two Titan auxiliary catalogues. Faction libraries and their root imports are resolved. Primary-catalogue visibility restrictions filter units and Detachments; faction keywords separate allied entries. Legends/narrative and allied entries are optional catalogue filters.

Build Army A and Army B independently. Choose Incursion (1,000 points / 2 DP) or Strike Force (2,000 points / 3 DP), or a custom points limit using either rules set. Select multiple Detachments and an available Force Disposition. Search units, add repeated units, change model counts, inspect numeric datasheet/weapon profiles, designate a Warlord, record Leader/Support attachments, choose source Enhancements and record wargear quantities/notes. Army changes save locally; export/import is separate from battle JSON.

Data: `public/armies/index.json` and one lazily loaded JSON per faction. Regenerate with `node tools/import-armies.mjs`; it uses the local research cache or downloads the pinned repository when that cache is absent. The snapshot is fixed to commit `cc58ee3b2c23f90af9d00e7bf234cd703b762299`, dated 9 October 2026. Generated files contain names, characteristics and selection facts, without copying ability/rule prose. They are community data and have not been reconciled with the official Munitorum Field Manual.

Army validation is partial: points budget, simple model-count price modifiers, source model ranges, basic duplicate/Epic Hero limits, Warlord count, DP budget, granted Force Dispositions and attachment existence/counts. Complex conditional price rules are flagged for review; unknown costs stay unknown. A reviewed points override is recorded explicitly. Mixed model composition, weapon replacement/quantity rules, specific Bodyguard eligibility, detachment-specific limits, allied eligibility and Enhancement/Upgrade grouping are not fully evaluated. Do not interpret a passed basic check as a legal matched-play list. The army review states this limitation.

The basic battle bridge accepts supported fixed-loadout Marine units in Army A and Ork units in Army B, 1–6 units per side. It rejects unsupported armies/configurations with a visible explanation while retaining the saved roster. Full-faction army building does not imply full-faction battle simulation.

## Run locally

`npm install`, then `npm run dev`. `npm test` checks the battle engine and army data/logic; `npm run build` creates `dist/`.

## Play

Select a friendly unit, then select **Move** and click its destination. Select an enemy unit and choose **Shoot · roll dice** or **Fight**. Hit rolls, wound rolls and saving throws appear beside the battlefield. The dice animations and attack effects do not change the random outcomes.

Each unit can move once and attack once during its army's turn. **End turn** changes the active army. Set an army to **AI opponent**, then use **Next AI action** or **Play AI turn**. **Confirm AI actions** offers one action at a time for approval; the player can also act manually. AI changes cannot interrupt an attack already resolving.

**Save battle** stores one checkpoint in this browser. **Load saved battle** restores it, including its random stream. JSON export/import transfers a battle between sessions. Simulations play both armies with the basic AI over 100–1,000 different random seeds. Win estimates and mean victory points describe only this scenario, rules and AI.

## Included units

Space Marines: Intercessor Squad, Heavy Intercessor Squad and Hellblaster Squad. Orks: Boyz with sluggas, Nobz with big choppas, and Boyz with shootas. Datasheet and weapon numbers were selected from BSData's 11th-edition community snapshot, commit `cc58ee3b2c23f90af9d00e7bf234cd703b762299` (9 October 2026). This is a fixed, simplified subset; selection costs have not been checked against the official points manual. All model profiles within a unit are treated identically, including sergeants and Boss Nob replacements. Plasma uses its standard profile only.

The full source inventory and factual collection remain in `../research/`. This prototype is not a complete or faithfully validated 11th-edition implementation.

## Basic rules and limitations

40 × 26 inch playable area, with a decorative surrounding surface. Solid ruins block straight-line movement and visibility. Model tokens are drawn individually but share a unit footprint. Melee has a simplified 3 inch reach without a charge roll. Attacks use separate shooting and melee profiles. Damage allocation is fixed front-to-back with no excess damage spilling between models. Objectives compare surviving model counts multiplied by OC within 3.5 inches of the unit centre. Each controlled objective gives 1 VP after both armies take a turn. Battles end after five rounds or army elimination.

No edition-specific phase sequence, stratagems, unit/army abilities, leaders, mixed model/loadout profiles, weapon keywords, cover, reserves, charge rolls, rerolls, or reaction windows yet. Ld is displayed but battle-shock is not implemented. These omissions are stated in the interface. Saved battles use rules pack `ks-basic-0.2`; previous training-pack saves are incompatible.

The AI prioritizes nearby melee attacks, then available shooting, then progress toward objectives. Replayable xorshift32 dice use rejection sampling and are for a local lab, not a competitive online fairness protocol. Simulations run in a web worker using the same rendering-independent engine as visible play.

## Checks

Nineteen tests cover battle integrity, deterministic saves, terrain, casualties, bots, melee, import validation, all-faction coverage, shared-library resolution, primary-catalogue restrictions, squad-size pricing, DP/Force Disposition checks and unknown costs. Browser QA covers faction → points → Detachments → units, live squad-size prices, independent army slots, Warlord/attachment configuration, saves, export/import, the existing battle and simulated outcomes.
