# Combat Lab code boundaries

The attack engine and faction data are independent of the browser. The app uses ordinary JavaScript modules; adding a UI framework or a general event bus is unnecessary for this lab.

| Module | Responsibility |
| --- | --- |
| `src/main.js` | Own scenario state, catalogue loading, persistence, simulation lifecycle and workspace navigation. |
| `src/combat-unit-controller.js` | Bind unit inputs and rule controls through explicitly supplied controller actions. Read current scenario state through its getter. |
| `src/combat-shell.js` | Render the final page structure once. |
| `src/combat-unit-view.js` | Render unit cards from data and the explicit phase; supply shared summary formatting. |
| `src/combat-reports.js` | Render dice traces, single-roll losses and simulation statistics from engine results. |
| `src/combat-layout.js` | Update the arena and summary badges. Accept phase as data, never infer it from button styling. |
| `src/ui-panels.js` | Preserve expanded panels by stable `data-panel` keys within each unit. |
| `src/ui-html.js` | Escape text and create escaped select options. |
| `src/rule-picker.js` | Render source rule choices and prepare confirmed numerical effects. |
| `src/combat.js`, `combat-effects.js`, `rule-effects.js` | Validate and resolve attack mechanics without DOM access. |
| `src/army-loadout.js` | Derive weapon counts from per-model choices; validate save structure and review composition constraints. |
| `src/army-equipment-view.js` | Render source equipment controls and bind equipment edits. |
| `src/army-share.js` | Build share content, draw paginated PNGs and manage local preview/download. |
| `tools/wargear-compiler.mjs` | Preserve equipment groups, bundles, defaults and static constraints from the pinned selection graph. |
| `tools/` and `public/` | Import pinned community data and retain its provenance. No runtime fetching of third-party rule pages. |

Render the final HTML directly. Do not construct a legacy page and move nodes around to simulate another layout. Template modules must remain usable without `document`; text from imports, custom profiles and saved scenarios must be escaped before entering HTML.

Give every expandable unit section a unique `data-panel` key. CSS classes describe appearance, not state or identity. New ability conditions should include the source rule ID in their key.

Keep scenario mutations in controllers and numerical mechanics in the engine. HTML rendering should not activate rules or modify base characteristics. Named-rule conditions and community-data limitations remain explicit assumptions, not inferred from the UI.

Validation: `npm run lint` catches undefined names, unused bindings, unreachable code and duplicate imports; `npm test` checks mechanics, data validation and view regressions; `npm run build` checks the production bundle. Browser checks cover interactions, saved scenarios and responsive layout. The existing CSS still includes older shared styles and dashboard overrides; consolidating that cascade is a separate cleanup, not a reason to change attack behaviour.
