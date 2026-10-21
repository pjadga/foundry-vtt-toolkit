# CLAUDE.md

Macros and a module for FoundryVTT v13. See `README.md` for layout and release steps.

## Conventions

- **Target v13.** Use `foundry.applications.api.DialogV2` and ApplicationV2, not the legacy `Dialog`/`FormApplication`.
- **Macros are standalone.** No imports, no build step. They run as the body of an async function, so top-level `await` and `return` are valid. Start each with the header block (Name / System / Foundry / Type).
- **Guard system macros** on `game.system.id` and return a notification, never throw.
- **Module code is ES modules** (`.mjs`). Per-system code lives in `module/scripts/systems/` and is registered in `SYSTEM_MODULES` in `main.mjs`.
- **Namespace** CSS under `.fvtk` and lang keys under `FVTK.`.
- **Version** is stamped into `module.json` by the release workflow from the git tag. Don't bump it by hand.

## Open items

- Confirm `sw25-fvtt` against the installed Sword World 2.5 system's `system.json` on the live server.
- The sw25 and cpred macros only log actor data. Field paths are not yet mapped.
- No license chosen yet.

## System notes

- **Cyberpunk RED Core** 0.92.x (latest release) is v12 only. v13 support (0.93) is on the upstream `dev` branch, unreleased; build it with `npm ci --ignore-scripts && npx gulp build` and copy `dist/` into `Data/systems/cyberpunk-red-core`. Its windows are ApplicationV2.
- D&D 5e 5.3.x supports v13 and v14.
- `npm run link` symlinks `module/` into a Foundry Data folder for development (set `FOUNDRY_DATA`).

## Verifying changes

No test suite. JSON files must parse (`jq . module/module.json module/lang/en.json`) and `.mjs`
files should pass `node --check`. Real verification means loading the module in a Foundry v13 world.
