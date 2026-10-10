# KS — 40K Army Builder and Combat Lab

A personal browser lab for building Warhammer 40,000 armies and comparing unit-versus-unit attack scenarios. The army builder covers the 11th-edition community faction/chapter catalogues. The Combat calculator resolves one Shooting or Fight phase, with optional surviving attacks back, animated dice and repeated simulations.

## Deploy on Vercel

Import `Flowtron22/KS` and use:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root Directory | `solo-lab` |
| Framework Preset | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

No environment variables or backend service are required. `solo-lab/vercel.json` records the build settings. Army catalogues are checked in under `solo-lab/public/armies/` and are copied into the production build; Vercel does not need to download or regenerate them.

Production: https://codex-imperium.vercel.app. Pushes to `main` trigger the connected Vercel deployment.

Army and combat scenario saves use browser-local storage. Export/import JSON to transfer between hosting domains. Old battle checkpoints are not combat scenarios; existing army saves remain supported.

## Develop

```sh
cd solo-lab
npm ci
npm run dev
```

Run `npm test` for the army/combat tests and `npm run build` for a production build. See [the app README](solo-lab/README.md) for controls, data provenance and implementation limits.

## Project files

- `solo-lab/`: app source, styles, tests, dependency lockfile, generated faction JSON and the army importer.
- `research/`: design notes and processed factual research data with source IDs and hashes.
- `tools/research-40k.mjs`: reproducible research collection script.
- `output/`: preview screenshots.

Dependencies, build output, hosting-specific local metadata, environment files and downloaded source caches are excluded from Git. The army importer can recreate `research/raw/` from its pinned public source when that cache is absent.

## Current implementation and next work

Army flow: Faction → Points → Detachments → Units → Review. Build two independent armies, inspect characteristics, designate a Warlord, record Leader/Support attachments and export/import army JSON.

The data snapshot is pinned to BSData commit `cc58ee3b2c23f90af9d00e7bf234cd703b762299` (9 October 2026), not a live feed. Official points reconciliation and full roster legality are unfinished. Weapon quantities are currently recorded manually; the next army-builder improvement is default equipment plus legal model-specific weapon replacements, followed by fuller Warlord, Enhancement and attachment restrictions.

Combat starts with 5 Custodian Guard versus 1 Cerastus Knight Lancer. Choose units from any faction catalogue, or load unit/model counts from saved Army A/B. Use one homogeneous defensive profile and one weapon profile per unit. Every faction now has a source-linked ability library. Choose supported army/unit/aura effects and weapon keywords, or configure manual modifiers. The library exposes unimplemented rules as references; it does not fully automate every official rule. Verified September Custodes Ka’tahs, Trajann’s Captain-General aura and Guard Impenetrable Defence remain available. The combat Guard profile uses the official September preview; other Custodes and Army Lists still use the older snapshot. See the app README for conditions and unsupported rules.
