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

`openImporter` is the Build campaign flow: preview with `campaignCheck` (`check.mjs`, pure, tested)
→ image review → `importEntries` → auto-pick tracks → summary. `adventure.mjs` packs every
NotebookLM-flagged document, and everything in the NotebookLM folders, into an Adventure in the world
pack `world.notebooklm-campaigns` (Compendium sidebar button, `api.importer.pack`); with *Remove the
campaign from this world* ticked, `clearCampaign` deletes it afterwards, only if the adventure holds
every document (an Adventure's contents are Sets of documents, not id-keyed collections).

`module/scripts/import/parser.mjs` is pure (no Foundry globals) so it stays testable; Foundry calls live in
`importer.mjs`. Format and supported types: `docs/notebooklm/format.md`. Journals, locations and threads
import as journals; system modules add other types with `api.importer.registerType` (Cyberpunk RED
registers `item` and `npc`, see `systems/cpred.mjs`, with pure rules in `systems/cpred-items.mjs` and
`systems/cpred-npc.mjs`; handler `order` makes items import before NPCs). Locations and scene entries
also become Foundry scenes when an image matches (`findImage` in the parser, `importScenes` in the
importer; images come from the dialog's image folder via `FilePicker.browse`). `setupScene` then
places hidden NPC tokens, a journal pin and the `soundtrack` playlist (once, flag `setup`, for an
existing scene that isn't being replaced) (pure layout in `setup.mjs`;
what it placed is flagged `placed` so re-imports update only that). `playlist` entries
become Foundry playlists (`youtube/playlists.mjs`, registered in `main.mjs`).

## Scene images

`module/scripts/images/`: `prompts.mjs` (pure, tested: prompt from `visual:`, file names that
`findImage` matches, `imagesNeeded`), `generate.mjs` (Pollinations, no key, one request per 45 s per IP
(402 FREE_LIMIT when sooner, retried), returns about 1015×580 with a watermark; or Cloudflare Workers AI through the GM's own Worker,
`docs/images/cloudflare-worker.js`, because Cloudflare's API sends no CORS headers), `review.mjs`
(ApplicationV2 review window that uploads kept images with `FilePicker.upload`). `openImporter` runs it
after the confirm step and adds the uploaded paths to the folder's images before `importEntries`.
Gemini and OpenAI image APIs need billing, so they are not used.

## GM Assistant

`module/scripts/assistant/`: `context.mjs` (pure, tested: `ENTRY_RULES`, a verbatim copy of Prompt 0's
format, fields and consistency rules that `tests/assistant.test.mjs` checks against the prompt kit,
so edit both together; `contextText`; `systemPrompt`; `entriesIn`), `gemini.mjs` (chat call,
lite model by default, other models 30 s then lite), `assistant.mjs` (`campaignContext` from
`campaignDocuments`, one shared conversation, ApplicationV2 window, `/gm` via the `chatMessage` hook,
Build button via `renderChatMessageHTML`). Answers render through `resolveLinks` outside code blocks;
brackets inside code blocks are escaped so Foundry's inline-roll enricher doesn't read `[[Name]]`.
`openImporter({ text })` starts Build campaign with entries filled in.
Sources: `sources.mjs` (pure, tested: `classify`, `syncPlan`, `citations` from `groundingMetadata`),
`filesearch.mjs` (File Search REST from the browser, which CORS allows: resumable
`uploadToFileSearchStore`, then poll the *document* until `STATE_ACTIVE`, because the returned
`.../upload/operations/...` name never reports done), `sources-sync.mjs` (folder walk with
`FilePicker.browse` and HEAD for size/Last-Modified; each document's customMetadata holds its
`path` in the folder and `fingerprint`, so the store is the sync record; the store is found by
display name per world). `askGemini` adds `tools: [{file_search: {file_search_store_names}}]`, which
works with `system_instruction` on `generateContent`.

## Combat narration

`module/scripts/narration/`: `rules.mjs` (pure, tested: `rangeDV`, `shouldDodge`, `hits` with the
defender winning ties, `criticalInjury`, `damageEffect`), `prompt.mjs` (pure, tested: the outcome-aware
prompt, `chatLog`, `previousLines`, `repeatsEarlier`, `parseNarration`), `narration.mjs` (hooks). Every
roller's client stamps `game.user.targets` onto roll messages in `preCreateChatMessage`, since Foundry
doesn't record them. Only the active GM's client resolves and narrates, because it has the Gemini key.
Cyberpunk RED gotchas:
- Rolls lose their CPR state when they go to chat (`CPRRoll#toJSON` empties options), so attacks are
  recognised by roll class (`CPRAttackRoll` and subclasses, `CPRDamageRoll`, `CPRSkillRoll`).
- An attack's real total (d10 plus stat and skill) is only in the card's `.d10-number-div`; the
  message roll's total is the d10 alone.
- Damage cards carry each target's Apply Damage data on their `[data-action="applyDamage"]`
  buttons; `actor._applyDamage` is called with them and the dialog's defaults.
- DV tables are RollTables in the compendium named by the system's `dvRollTableCompendium` setting.

State lives in the Combat card's `flags.foundry-vtt-toolkit.resolution` (status hit, miss,
awaiting, unresolved or done), and everything runs through one queue, in roll order.

## YouTube playback

`module/scripts/youtube/`: `youtube.mjs` (pure helpers incl. `fallbackQueries`, tested), `search.mjs`
(Data API v3 with the GM's client-scoped key, oEmbed fallback), `gemini.mjs` (optional Gemini search
suggestions, client-scoped key, model setting default `gemini-flash-lite-latest`, busy models skipped for 10 min; pure prompt/parse parts
tested), `tracks.mjs` (`TrackSearch`: Gemini plan plus searches per row, shared by the picker and
`autoPickTracks`, which `openImporter` runs after an import with a smaller search budget),
`picker.mjs` (ApplicationV2 track picker; Gemini output is only ever used as YouTube search terms,
never shown or saved unchecked), `player.mjs` (playback).
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
