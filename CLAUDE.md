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

## NotebookLM import

`module/scripts/import/parser.mjs` is pure (no Foundry globals) so it stays testable; Foundry calls live in
`importer.mjs`. Format and supported types: `docs/notebooklm/format.md`. Journals, locations and threads
import as journals; system modules add other types with `api.importer.registerType` (Cyberpunk RED
registers `item` and `npc`, see `systems/cpred.mjs`, with pure rules in `systems/cpred-items.mjs` and
`systems/cpred-npc.mjs`; handler `order` makes items import before NPCs). Locations and scene entries
also become Foundry scenes when an image matches (`findImage` in the parser, `importScenes` in the
importer; images come from the dialog's image folder via `FilePicker.browse`). `playlist` entries
become Foundry playlists (`youtube/playlists.mjs`, registered in `main.mjs`).

## YouTube playback

`module/scripts/youtube/`: `youtube.mjs` (pure helpers incl. `fallbackQueries`, tested), `search.mjs`
(Data API v3 with the GM's client-scoped key, oEmbed fallback), `gemini.mjs` (optional Gemini search
suggestions, client-scoped key, model setting default `gemini-flash-lite-latest`, busy models skipped for 10 min; pure prompt/parse parts
tested), `picker.mjs` (ApplicationV2 track picker; Gemini output is only ever used as YouTube search
terms, never shown or saved unchecked), `player.mjs` (playback).
A YouTube track is a PlaylistSound with `path` = `assets/silence.wav`, `repeat: true` and the video in
`flags.foundry-vtt-toolkit.youtube`; every client plays it in a visible ≥200×200 embedded player (YouTube
policy: don't hide or shrink it). Shared timing: `startedAt` (server ms) while playing, `pausedAt` (s)
while paused, written by the user who changed playback. Gotchas: the playlist's own controls (play,
next, stopAll) update sounds via `updatePlaylist` with a `sounds` array, not `updatePlaylistSound`, so
both hooks are handled; `stopAll` leaves a stale `pausedTime`, so pause vs stop is read from the change
(`pausedTime` set = pause). No downloading from YouTube.

Cyberpunk RED sheets enrich notes/descriptions without `secrets: true`, so secret sections are hidden
in view mode for everyone, GM included. `showSecretsToOwner` in `systems/cpred.mjs` (render hooks for
`ActorSheetV2`/`ItemSheetV2`) re-enriches `<prose-mirror>` fields that contain secrets, for owners only.

Cyberpunk RED gotcha: `CPRActor.create` only adds core skills/cyberware when no `system` data is given,
and on that path it drops the passed `items` and resolves before the actor is in `game.actors`. The NPC
importer therefore builds the full actor itself and uses the base `Actor.create`.

## System notes

- **Cyberpunk RED Core** 0.92.x (latest release) is v12 only. v13 support (0.93) is on the upstream `dev` branch, unreleased; build it with `npm ci --ignore-scripts && npx gulp build` and copy `dist/` into `Data/systems/cyberpunk-red-core`. Its windows are ApplicationV2.
- D&D 5e 5.3.x supports v13 and v14.
- `npm run link` symlinks `module/` into a Foundry Data folder for development (set `FOUNDRY_DATA`).

## Verifying changes

`npm test` runs the NotebookLM parser tests (`tests/parser.test.mjs`, no Foundry needed). JSON files must parse (`jq . module/module.json module/lang/en.json`) and `.mjs`
files should pass `node --check`. Real verification means loading the module in a Foundry v13 world.
