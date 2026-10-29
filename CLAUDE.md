# CLAUDE.md

Macros and a module for FoundryVTT v13. See `README.md` for layout and release steps.

## Conventions

- **Target v13.** Use `foundry.applications.api.DialogV2` and ApplicationV2, not the legacy `Dialog`/`FormApplication`.
- **Macros are standalone.** No imports, no build step. They run as the body of an async function, so top-level `await` and `return` are valid. Start each with the header block (Name / System / Foundry / Type).
- **Every macro is in the Custom-Macros compendium**, which ships in its own module,
  `macros-module/` (id `foundry-vtt-toolkit-macros`, Foundry v12 and v13, no scripts; pack in
  `macros-module/packs/custom-macros`, LevelDB). The release workflow stamps and zips both modules and
  publishes the macros manifest as `macros-module.json`. After adding or changing a file in `macros/`, run `npm run build:packs` and commit the pack
  with `scripts/packs.sha256`; a test fails until you do. The build needs `npm ci` first (the
  Foundry CLI, which uses a native LevelDB package). The pure part, names from the header and stable
  ids from the path, is `scripts/macro-pack.mjs`; a new `macros/` subfolder needs an entry in its
  `FOLDERS`. `.gitattributes` keeps `macros-module/packs/**` binary. Macros carry `_stats.coreVersion`
  (`CORE_VERSION`) set to the **oldest** Foundry the macros module supports (12.343) and an `author`
  field (null): v12 rejects a macro without `author` and refuses to migrate documents stamped with a
  newer version than its own, while v13 migrates older ones when a world launches (it rewrites the
  pack's files on the server, so check a deployed pack by its records). v13 also requires a non-null
  author, so its first launch with a new pack logs "author: may not be undefined" once per macro and
  fills in the current GM; no single value satisfies both versions, so that one-time warning is
  expected. Raise the stamp only with the module's minimum version.
- **Guard system macros** on `game.system.id` and return a notification, never throw.
- **Module code is ES modules** (`.mjs`). Per-system code lives in `module/scripts/systems/` and is registered in `SYSTEM_MODULES` in `main.mjs`.
- **Namespace** CSS under `.fvtk` and lang keys under `FVTK.`.
- **Version** is stamped into `module.json` by the release workflow from the git tag. Don't bump it by hand.

## Open items

- The sw25 and cpred macros only log actor data. Field paths are not yet mapped.
- No license chosen yet.

## Campaign designer skill

`.claude/skills/campaign-designer/` (`SKILL.md`, `systems/<id>.md`, `notebooklm.md`) designs a campaign
for Build campaign to import: intake → rules digest → bible (`##ENTRY` draft, checked) → NotebookLM kit
and refinement → hand-off. Work lives in `campaigns/<name>/` (git-ignored: rulebooks are copyrighted).
`scripts/campaign-tools.mjs` (pure `extractPrompt0`, `report`, tested) writes the notebook's Prompt 0
from the prompt kit and runs `campaignCheck`; add a system by writing its profile and adding its kit to
`KITS`. NotebookLM has no consumer API, so the skill drives its page with the Claude in Chrome tools;
`notebooklm.md` has the working steps and gotchas (the file input is caught by hooking
`HTMLInputElement.prototype.click`; `file_upload` only reads project folders and about 10 MB a call;
`javascript_tool` shows about 1,000 characters, so long answers go to `scripts/answer-sink.mjs`, a
127.0.0.1 receiver that accepts POSTs from notebook.google.com only (Edge asks the user to allow
local-device access the first time); the site is now Gemini Notebook at notebook.google.com). Never put server details or rulebook text in the skill files.

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
`docs/images/cloudflare-worker.js`, because Cloudflare's API sends no CORS headers; or Gemini
`generateContent` with `responseModalities: ["IMAGE"]` and `imageConfig.aspectRatio`, image in
`candidates[0].content.parts[].inlineData`, key in the `x-goog-api-key` header; pure, tested
`geminiImageError` / `geminiImagePart`), `review.mjs`
(ApplicationV2 review window that uploads kept images with `FilePicker.upload`). `openImporter` runs it
after the confirm step and adds the uploaded paths to the folder's images before `importEntries`.
Gemini image models have no free tier: a key without billing gets 429 with a `…FreeTier` quotaId and
`limit: 0`, which `geminiImageError` reports as "needs billing" without retrying. OpenAI isn't used.

## GM Assistant

`module/scripts/assistant/`: `context.mjs` (pure, tested: `ENTRY_RULES`, a verbatim copy of Prompt 0's
format, fields and consistency rules that `tests/assistant.test.mjs` checks against the prompt kit,
so edit both together; `contextText`; `systemPrompt`; `entriesIn`), `gemini.mjs` (chat call,
lite model by default, other models 30 s then lite), `assistant.mjs` (`campaignContext` from
`campaignDocuments`, one shared conversation, ApplicationV2 window, `/gm` via the `chatMessage` hook,
Build button via `renderChatMessageHTML`). Answers render through `resolveLinks` outside code blocks;
brackets inside code blocks are escaped so Foundry's inline-roll enricher doesn't read `[[Name]]`.
`openImporter({ text })` starts Build campaign with entries filled in.
Images: `drawing.mjs` (pure, tested: `imageRequest` spots "draw a portrait of …", `imagePlanRequest` /
`parseImagePlan` have Gemini chat write `{prompt, subject, kind}` (`IMAGE_PLAN_SCHEMA`, askGemini's `schema`), `imageTargets` picks actors or
scenes from the subject, the request and the previous answer's links). `draw` in `assistant.mjs`
generates with the scene image provider (`imageSettings` from the importer; Gemini when that is Off),
1:1 for portraits, 16:9 for scenes; `saveImage` uploads to the Build campaign image folder
(portraits in `portraits/`, names get a time suffix so cached images don't show); `useImage` sets an
actor's `img`, prototype token and placed tokens, or a scene's `background.src` and thumbnail. `/gm`
saves at once, since chat needs a file.
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

## Working across machines and the cloud

The user works from a work machine, a home machine and cloud sessions, with GitHub keeping them in
step. Pull before starting and push before finishing.

- **Cloud sessions** make code changes on a branch, run `npm test`, and push the branch. They can't
  deploy or test in Foundry (no SSH key, no browser in the user's world), so they stop there and
  say which branch is ready for a local session.
- **Local sessions** (on whichever machine the user is at) pull that branch, run `npm test`, deploy
  it to cpr-test, and test it live. They merge into `main` and push only with the user's OK.
- Point-in-time state (what's open, what's deployed) goes in `docs/handoff.md`; update it when that
  changes.

## What a feature or fix commit includes

The user expects the docs to keep up with the code, so a feature or bug fix isn't done until these
are updated, in the same commit or one right after it:

- **Tests:** new or changed pure logic gets tests in `tests/`, and `npm test` passes.
- **`CHANGELOG.md`:** an entry under the unreleased version.
  - Features go in their feature's section (Combat, GM Assistant, Macros…).
  - Fixes go under *Fixed before release*, saying what was wrong. After the first release, they go
    under the new version's *Fixed* heading instead.
  - Name the setting, button or macro the user sees.
- **`docs/user-guide.md`:** anything the user sees or does. That means the feature's section, the
  **Settings** table for a new setting, **Troubleshooting** for a new error message, **Known issues**
  for a new limit, and **Privacy** for anything new sent to an outside service.
- **`README.md`:** a new folder, macro or headline feature.
- **NotebookLM fields:** if a field the toolkit reads is added or changed, update:
  - `docs/notebooklm/format.md`;
  - Prompt 0 in `docs/notebooklm/cyberpunk-red-prompts.md`, kept under 10,000 characters;
  - `ENTRY_RULES` in `assistant/context.mjs` (the test checks it matches Prompt 0).

  Then tell the user to paste the new Prompt 0 into the notebook's **Configure Chat**.
- **`module/lang/en.json`:** every new string, under `FVTK.`.
- **`CLAUDE.md`:** new architecture, gotchas or conventions a future session needs.
- **`docs/handoff.md`:** what's deployed to cpr-test (the commit, and whether it was checked with
  `git hash-object`), what was tested live, and the open items that closed or appeared.

Nothing server-specific goes in any of these, because the repository is public.

## Verifying changes

`npm test` runs every pure test in `tests/*.test.mjs` with `node --test` (no Foundry needed). JSON files
must parse (`module/module.json`, `module/lang/en.json`) and `.mjs` files should pass `node --check`.
Real verification means loading the module in a Foundry v13 world.

**This repository is public.** Never commit server addresses, SSH key names, logins, API keys, or the
user's email. Server-specific details live in `docs/handoff.local.md`, which is git-ignored and kept on
each machine by hand.

## Testing in the cpr-test world

- **`cpr-test` is a sandbox** (the user's test world for this toolkit, running Cyberpunk RED 0.93-dev
  on Foundry v13). Changing its settings, client settings and test data is fine without asking.
- **Ask first** before touching any other world, the server's other Foundry install, or restarting
  servers. Never type passwords or API keys: the user enters keys in the browser, and they are
  client settings that stay in that browser.
- **Deploy** by packing `module/` and extracting it over the module folder on the server, then
  reload the Foundry page (F5). There is no build step. Pack what's committed with
  `git -c core.autocrlf=false archive --format=tar.gz -o fvtk.tgz HEAD:module`, copy it with `scp`,
  then `tar -xzf fvtk.tgz -C <Data>/modules/foundry-vtt-toolkit` over `ssh`. Archiving the
  `HEAD:module` subtree doesn't see the root `.gitattributes`, so without `core.autocrlf=false` a
  Windows machine packs CRLF files. Check with `git hash-object` on the server, which has git.
  The macros module deploys the same way from `HEAD:macros-module` into
  `<Data>/modules/foundry-vtt-toolkit-macros`, and must be enabled in the world.
  Foundry reads a module's compendiums when a world launches and keeps them open, so a deploy that
  changes `macros-module/packs/` or a module's `packs` needs the world relaunched; deploy a pack
  change with the world closed (or relaunch it right after), since the server holds the old files.
  Foundry can also rewrite a pack's files itself (migration, compaction), so check a deployed pack
  by its records (read it with `classic-level`), not with `git hash-object`.
  The host, user, key and paths are in `docs/handoff.local.md`. Module styles are bundled by Foundry,
  so CSS changes also need a reload.
- **Deploying from Windows:** `.gitattributes` keeps text files LF in every checkout, so a deploy
  from a Windows clone matches the repository byte for byte. Compare deployed files with
  `git hash-object`, not checksums of a CRLF working tree. If a clone made before `.gitattributes`
  still has CRLF files, refresh it once with `git rm -r --cached -q . && git reset --hard -q`, on a
  clean tree.
- **Windows PowerShell and `ssh`:**
  - PowerShell 5.1 drops the inner quotes from arguments it passes to `ssh`, so a quoted remote
    command arrives broken.
  - Piping a script into `ssh` puts a byte-order mark in front of it, so bash fails on the first
    line.
  - Write the remote commands to a file and redirect it through `cmd`:
    `cmd /c "ssh -i <key> <user>@<host> bash -s < script.sh"`, which passes the bytes unchanged.
  - Git Bash works on the work machine; on the home machine it fails with fork errors, so use
    PowerShell there.
- **Test documents** get a `QA ` name prefix (plus a `qa-` folder for files) and are deleted
  afterwards. Delete your own test chat messages too, and restore any actor you damaged. Leave the
  user's own rolls and documents alone.
- **Roy's macros stay installed:** cpr-test keeps **Roy's Declarations** (hotbar slot 0) and
  **Roy's History** (slot 9). After a change, overwrite their command with the latest version
  (create them only if missing); don't delete them after a test, and leave the lines they wrote
  and your token targets in place. To get an uncommitted macro into the page, copy it into a `qa-`
  folder in the server's Data folder, `fetch` it from there, then remove the folder. Test them as the
  player user who owns Roy's sheet, not as the GM; which user and world are in
  `docs/handoff.local.md`.
- **Rolling like a player in Cyberpunk RED:** `item.createRoll("attack" | "damage" | "skill", actor)`,
  `await roll.roll()`, set `roll.entityData = { actor: actor.id, token: token.id }` (otherwise the card
  has no speaker), then `CPRChat.RenderRollCard(roll)`. `CPRChat` comes from
  `/systems/cyberpunk-red-core/modules/chat/cpr-chat.js`.
- **Browser gotchas:**
  - Sound only plays after a real click on the page, which a scripted call doesn't count as.
  - `foundry.utils` is frozen: assigning a stub to one of its functions (such as `saveDataToFile`)
    fails silently and the real one still runs. A browser-pane download lands in the user's real
    Downloads folder, so ask before testing one.
  - A reload can land on the join screen; rejoin as described in `docs/handoff.local.md`.
  - Pollinations allows one image per 45 s per IP address, shared with any other use from the
    same network.
- **Gemini and YouTube keys** belong to the user. Don't print them, and keep testing light on their
  daily quotas.
