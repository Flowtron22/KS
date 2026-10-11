# Army rules audit — 11 October 2026

This audit distinguishes implemented checks, source restrictions that still need review, and source freshness. Passing automated tests is not proof that every current official datasheet is implemented.

## Authority and freshness

Use the current official Codex/Faction Pack, FAQ/errata, Balance Dataslate and Munitorum Field Manual together. Community JSON is an import format, not an authority that overrides those documents.

- [Official 11th-edition army-building article, 2 April 2026](https://www.warhammer-community.com/en-gb/articles/95fucn12/building-an-army-in-the-new-edition-of-warhammer-40000/): Incursion/Strike Force budgets, repeatable Upgrade grouping and Leader/Support attachments.
- [Official Knights faction focus, 18 May 2026](https://www.warhammer-community.com/en-gb/articles/pqqff7as/warhammer-40000-faction-focus-imperial-and-chaos-knights/): Questor Forgepact permits the specified five Mechanicus datasheets with a combined 500-point limit. The earlier April faction-pack PDF instead scales 250/500/750; this implementation follows the newer May rule. Later official errata still needs reconciliation.
- [Official Imperial Agents FAQ v1.4](https://assets.warhammer-community.com/eng_17-09_warhammer40000_codex_faqs_and_errata_imperial_agents-99xyh8dtl5-tdry3deuu6.pdf): Inquisitorial Agents and Voidsmen-at-Arms Retinue exemptions. Assigned Agents category budgets use the pinned catalogue's rule text; the older Codex remains valid under the official edition-transition guidance.
- [Official Custodes preview, 24 September 2026](https://www.warhammer-community.com/en-gb/articles/2xxurx9j/first-look-adeptus-custodes-datasheets/): Guard T7/W5 and maximum three Custodians before Leaders. The calculator explicitly applies this preview; the army catalogue still has old unit composition, costs and equipment. It now carries a freshness review instead of silently appearing current.
- [Official Space Marines preview, 14 September 2026](https://www.warhammer-community.com/en-gb/articles/paxsnmde/first-look-space-marines-datasheets/): revised datasheets and abilities confirm a newer Codex. Marine and chapter catalogues now disclose that these changes are not reconciled; Grey Knights are not included in this warning.
- [Official downloads hub](https://www.warhammer-community.com/en-gb/downloads/warhammer-40000/) links the live MFM and says it contains points and Leader targets. Direct requests to the live MFM returned 403 during this audit. Current official points and every Leader target could not be reconciled.

The pinned community snapshot remains `cc58ee3b2c23f90af9d00e7bf234cd703b762299`. The latest upstream commit checked was `3988a8bdd210f9d31ea5b6782d0016688ccb6815`, dated 10 October. Its Custodes file still has 4–5 Guard, and its commit message warns that Marines are not updated. Replacing the snapshot blindly would not resolve freshness.

## Confirmed implementation changes

- Load the source game-system graph as well as linked catalogues: common category references were previously missing.
- Compile Enhancement bearer predicates and explicit “model/unit only” text. Preserve Boolean alternatives and reject unresolved bearer restrictions rather than offering them as unrestricted options.
- Enforce one Enhancement across an attached unit, including its Leader/Support. Attachment selection and imported-army review use the same check.
- Recognise Inquisitor's `BATTLELINE IMPERIUM INFANTRY` Bodyguard target as an intersection of three keywords.
- Enforce Questor Forgepact selection, its permitted Mechanicus unit names, total allied cost and Mechanicus Warlord prohibition.
- Enforce Assigned Agents Character/Retinue/Requisitioned budgets, Imperium eligibility and the two Retinue exceptions. Dedicated Transport embarkation stays under review because no embarkation assignment exists in the app.
- Retain unsupported equipment constraints and other allied systems as explicit source-review cases. No fresh points or equipment have been invented for the new Custodes Codex.

## Remaining work

1. Obtain and reconcile current official MFM entries and current Codex/errata for Custodes and Marines; refresh points, models, equipment, Enhancements and Leader targets together.
2. Complete allied systems beyond Assigned Agents and Questor Forgepact: Knights, Titans, Chaos/Daemonic allies and faction-specific exceptions. Do not remove their review status before implementing their limits.
3. Compile the conditional equipment, bearer and attachment cases listed by the structural audit. Some require loadout-dependent or model-specific information beyond simple keywords.
4. Validate Warlord-specific abilities, transport embarkation and other faction-specific army restrictions. Those are not covered by the basic Character/Warlord check.

## New Recruit cross-check — 11 October 2026

Inspected the live [New Recruit builder](https://www.newrecruit.eu/app) in a temporary guest browser session, using its Warhammer 40,000 11th Edition system. Its My Games page showed a data update 20 hours ago. That is a dataset update indicator, not confirmation that every faction has its latest Codex.

Observed comparisons:

| Case | New Recruit | CODEX Imperium |
| --- | --- | --- |
| Custodian Guard | 4–5 models, initial four-model squad 180 points | Same older composition and initial cost; freshness review retained |
| Guard equipment | Guardian spear; sentinel blade/shield alternative; one vexilla/shield/misericordia model | Same imported model packages and maximum one vexilla model |
| Crusader in Freeblade Company | Avenger gatling cannon, heavy flamer and feet fixed; thermal cannon/battle cannon alternative; meltagun/stubber alternative; maximum one carapace weapon | Same equipment groups |
| Crusader cost | Thermal default 395; battle cannon 410; battle cannon plus Mysterious Guardian 445 | Same calculated totals |
| Freeblade Enhancements | Bringer of Justice 30, Hunter's Eye 25, Mysterious Guardian 35, Sanctuary 20; one per bearer | Same eligible choices, prices and per-bearer limit |
| Assigned Agents in Strike Force | Character/Retinue choices show two-per-category, Requisitioned one | Same category budgets; exemptions were checked separately against the official FAQ |

The builder displayed a catalogue announcement explicitly excluding Adeptus Astartes variants from completed MFM/Faction Pack updates, pending Space Marines Codex data. This corroborates the freshness review; it does not establish that every other faction has its latest Codex, and the Guard still shows the older composition.

[BSData](https://www.bsdata.net/) says its files are developed for New Recruit compatibility. Our importer uses BSData as well, so agreement can reflect a shared source rather than independent verification. The precise deployed New Recruit commit was not exposed in the inspected UI.

[New Recruit's news](https://www.newrecruit.eu/news) described its June 11th-edition update as experimental, generated from Faction Packs/MFM. This is historical context, not a claim that June's missing Leader support remains missing today. No live attachment pairing or every-faction eligibility sweep was performed in this spot-check.

Use New Recruit as a practical comparison for allowed selections, equipment packages and calculated totals. Keep official current rules as the authority when sources disagree. No runtime rules were changed based solely on this comparison.

Run `node solo-lab/tools/audit-army-rules.mjs` to regenerate [the per-faction structural report](army-rules-audit.json). Shared units occur in multiple chapter catalogues; its counts are catalogue entries, not unique miniatures or a percentage of official-rule accuracy.
