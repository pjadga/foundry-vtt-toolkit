# Project brief: the Foundry VTT Toolkit

*Written on 23 October 2026 by the Claude session that built most of this project, for the session
that continues it on the user's home machine (or anywhere else). Read this first, then
[CLAUDE.md](../CLAUDE.md) and [handoff.md](handoff.md). Server-specific details (host, SSH key, paths,
Foundry login) are deliberately not in this file, because this repository is public. They're in
`docs/handoff.local.md`, a git-ignored file the user copies onto each machine.*

---

## Contents

1. [The goal, in the user's words](#1-the-goal-in-the-users-words)
2. [How we work together](#2-how-we-work-together)
3. [The big picture: how the pieces fit](#3-the-big-picture-how-the-pieces-fit)
4. [The environment](#4-the-environment)
5. [The repository](#5-the-repository)
6. [How the project got here: a history](#6-how-the-project-got-here-a-history)
7. [Feature by feature](#7-feature-by-feature)
8. [The NotebookLM side](#8-the-notebooklm-side)
9. [Testing: how, and what's been tested](#9-testing-how-and-whats-been-tested)
10. [Decisions and their reasons](#10-decisions-and-their-reasons)
11. [Known limits and rough edges](#11-known-limits-and-rough-edges)
12. [Where we left off](#12-where-we-left-off)
13. [How to start on the home machine](#13-how-to-start-on-the-home-machine)
14. [Recipes for common changes](#14-recipes-for-common-changes)
15. [Ideas that came up but weren't built](#15-ideas-that-came-up-but-werent-built)
16. [Glossary](#16-glossary)

---

## 1. The goal, in the user's words

The user runs **Cyberpunk RED** solo, as a single player with a game master, in **Foundry VTT v13**.
Their stated end goal, early in the project:

> "My end goal is to have NotebookLM produce a full campaign complete with all details to feed into
> the Foundry Toolkit to implement, search, build and setup the campaign for running without any
> manual steps needed."

Three preferences shaped almost every decision since:

- **Automation over manual steps.** When something can be done for the GM, do it, and leave a
  clear override. Their words about combat: "Any automation here would be amazing for making
  combat quicker."
- **Free options first.** The user said: "I'd like to stick to as much automation and free options
  as possible." Paid services, like Gemini image generation, are offered as options and never as
  the default.
- **Building matters more than playing.** When the NotebookLM chat configuration grew a playtest
  mode, the user was explicit: "The Build Mode is far more important than the Play Mode. Play Mode
  is just for testing the campaign quickly to see if it's enjoyable to run."

**NotebookLM** (Google's notebook product, now branded "Gemini Notebook" at notebook.google.com) is
where the campaign is written. It's grounded in the user's 84 sources: official rulebooks and DLC,
actual-play podcasts, adventures, community discussion, fan fiction, slang glossaries and the user's
own campaign notes. NotebookLM has no API for personal notebooks, so the bridge is text. NotebookLM
answers in a structured plain-text format (`##ENTRY` blocks). The user collects the answers into one
file, and the toolkit's **Build campaign** turns that file into a ready-to-run Foundry world.

The toolkit has grown beyond the importer since then. It now also includes:

- free scene image generation;
- YouTube soundtracks played inside Foundry;
- a Gemini-powered **GM Assistant** in Foundry that knows the campaign and the user's rulebooks;
- automated Cyberpunk RED combat resolution, with cinematic narration;
- packing a campaign as a Foundry Adventure, with a way to scrap it or continue with a sequel.

## 2. How we work together

These are the working habits that developed over the project. A new session should keep to them.

**Communication**

- The user reads plain explanations, not jargon. Say what something does and why, with concrete
  examples ("15 vs DV 16 at 7 m: miss").
- When a decision is the user's to make, ask one clear question with the choices, and recommend
  one. When it isn't, make a sensible choice and say what it was.
- Report what was actually verified versus only written. Say when something hasn't been tested
  live.
- Use "they/them" for the user.

**Commits and pushes**

- The user usually asks for "commit and push" explicitly, often after each step of a larger plan.
  Don't push without that, and ask if it's unclear.
- Commit messages are descriptive and end with the attribution line Claude Code provides.
- Work happens on `main` in this checkout. Sessions started in their own worktree commit to their
  own `claude/...` branch, and those branches are merged into `main` only with the user's OK.

**Safety rules the user agreed to or asked for**

- **cpr-test is a sandbox.** The user said, on 22 October, that it's fine to change settings in
  that Foundry world. Changing its settings, client settings and test data is fine without asking.
  Anything else needs asking first: the other world (`wbtw`), the server's separate v12 install,
  and restarting servers.
- **Never type passwords or API keys.** The user enters their YouTube and Gemini keys in the
  browser themselves. Those are client settings, stored only in that browser. Never print or log a
  key. Log search words, never URLs containing a key.
- **No downloading from YouTube.** Music plays only through YouTube's official embedded player,
  which must stay visible and at least 200×200 pixels, as YouTube's rules require. Early on, the
  user said they had music-industry permission to download. The decision was still to build
  embedded playback, which needs no permission and works for everyone.
- **This repository is public.** Never commit server addresses, SSH key names, logins, API keys or
  the user's email. Server specifics go in the git-ignored `docs/handoff.local.md`.
- **Don't create accounts for the user** (for example a Cloudflare account). Explain how, and let
  them do it.
- **Test data is temporary.**
  - Test documents get a `QA ` name prefix, and test files a `qa-` folder; delete them afterwards.
  - Delete your own test chat messages, and restore any actor you damaged.
  - Leave the user's own rolls and documents alone. The user sometimes tests in the same world at
    the same time.

**When unsure.** The user values getting it right over getting it fast. They asked for a full test
pass ("Test the module thoroughly for any bugs or defects… If any bugs or defects are found note
them and move onto the next test. At the end attempt to fix the problems and test again"), and that
approach worked well. It found 22 issues, all fixed and retested.

## 3. The big picture: how the pieces fit

```
NotebookLM notebook (84 sources)
   │  Prompt 0 = chat configuration (format, fields, rules, modes)
   │  Prompts 1–8 = write the campaign, step by step
   ▼
One .md/.txt file of ##ENTRY blocks
   │
   ▼  Build campaign (Journal sidebar)
Foundry VTT v13 world (Cyberpunk RED 0.93-dev)
   ├─ Preview + campaign check (gaps → a fix prompt to paste back into NotebookLM)
   ├─ Scene images generated for places without one (Pollinations / Cloudflare / Gemini), reviewed
   ├─ Journals (campaign, threads, locations, scenes), items, NPC actors, playlists
   ├─ Scenes: numbered by session, hidden NPC tokens, journal pin, soundtrack playlist
   ├─ YouTube tracks auto-picked for each playlist line (YouTube Data API, Gemini-assisted)
   └─ Summary, with "Activate" for the first scene
During play
   ├─ YouTube music synced for everyone through the embedded player ("Now playing" window)
   ├─ GM Assistant: Gemini chat that knows the campaign + the user's synced rulebooks;
   │   writes new ##ENTRY content (one click to Build campaign) and draws pictures
   └─ Combat: rolls are resolved by the rules (DV / Evasion), the results narrated by Gemini,
       damage applied to NPCs
Afterwards
   └─ Pack campaign → a Foundry Adventure; optionally clear the world for a new campaign,
      or build a sequel that carries on
```

The NotebookLM side and the Foundry side are kept in step on purpose:

- **One format and set of fields:** the entry format and field list exist once, in Prompt 0 of the
  prompt kit. The GM Assistant uses a verbatim copy (`ENTRY_RULES`), and a test fails if the two
  differ.
- **The same gaps:** the campaign check flags exactly the gaps Prompt 0's consistency rules tell
  NotebookLM to avoid.
- **One fix loop:** the toolkit's fix prompt asks NotebookLM for `replaces:` entries, and the
  importer applies them.

## 4. The environment

**Machines**

- **The work machine** (Windows 11, where this project was mostly built). It has the repository
  clone, Git Bash and PowerShell, the Claude desktop app, and the SSH key used to deploy.
- **The home machine** (Windows). As of 23 October it has Node.js 24.22.1, npm 12.2.1, Git 2.56 and
  a clone on a mapped drive (`Z:\Co-Work\foundry-vtt-toolkit`), where `npm test` passes, 89 of 89.
  It doesn't yet have its own SSH key for the server, or the user's API keys in its browser. An old
  global npm 9.7.1 in the user's AppData folder was shadowing Node's npm; it was updated.
- **The cloud.** Cloud sessions can change code from anywhere. They can't deploy or test in
  Foundry (see the workflow in `CLAUDE.md`).

**The Foundry server.** This is a Linux server the user runs. It hosts:

- a **Foundry v13** install with the module and the **cpr-test** world;
- a separate **v12** install;
- another world, **wbtw**.

Cyberpunk RED Core's v13 support (0.93) isn't released. It was built from the system's upstream
`dev` branch (`npm ci --ignore-scripts && npx gulp build`, then `dist/` copied into
`Data/systems/cyberpunk-red-core`). The installed system reports `0.93.0-dev`. Its windows are
ApplicationV2.

**The cpr-test world:**

- **Users:** a single GM user. There are no player users, but the user has made a player character
  actor, *Player One* (type `character`), and an NPC, *NPC One* (a mook), on the active scene
  "1. Salvage in the Old Combat Zone", for combat tests.
- **An imported campaign:** eight numbered story scenes, "1. Salvage in the Old Combat Zone" to
  "8. A Sanctuary on The Street", plus location scenes, journals, about 13 NPC actors, items, and
  three playlists (Street, Tension, Finale). Street has YouTube tracks; Finale and Tension had none
  at last check.
- **Image folder:** the world's image folder setting points at the campaign's images folder
  (`assets/overlook`). Generated images default to `assets/notebooklm`.

**Browsers.** The Claude desktop app has a built-in browser pane, which this session used for Foundry
and NotebookLM. It has its own sign-ins and its own client settings, separate from the user's Chrome.
The user's API keys were entered there by the user. A session on the home machine has its own pane,
so the keys need entering there again.

**Deploying.** Pack `module/`, copy it to the server, extract it over the module folder, then reload
Foundry. The exact commands are in `docs/handoff.local.md`; the generic version is in `CLAUDE.md`.
There's no build step. A `.github/workflows/release.yml` workflow publishes a release when a `vX.Y.Z`
tag is pushed, but nothing has been tagged yet.

## 5. The repository

```
foundry-vtt-toolkit/
├─ CLAUDE.md                 conventions, architecture notes, gotchas, testing, workflow (read this)
├─ README.md                 layout, using macros and the module, building a campaign, releasing
├─ CHANGELOG.md              release notes: everything is "0.1.0 (unreleased)"
├─ docs/
│  ├─ user-guide.md          the user-facing manual, with 13 screenshots (features, settings,
│  │                         troubleshooting, known issues, privacy, API)
│  ├─ handoff.md             point-in-time state and open items (keep current)
│  ├─ handoff.local.md       NOT COMMITTED: server specifics, copied by hand
│  ├─ project-brief.md       this file
│  ├─ images/
│  │  ├─ cloudflare-worker.js   the Cloudflare Worker the user deploys for FLUX images
│  │  └─ screenshots/        the user guide's screenshots
│  └─ notebooklm/
│     ├─ cyberpunk-red-prompts.md   the prompt kit: Prompt 0 (chat config) and Prompts 1–8
│     ├─ format.md                  the ##ENTRY format, every field, and how each is used
│     └─ examples/                  a sample entry
├─ macros/                   standalone Script macros (core, cpred, dnd5e, sw25)
├─ module/                   the installable module
│  ├─ module.json            manifest (version stamped by the release workflow)
│  ├─ lang/en.json           every string, under FVTK.*
│  ├─ styles/toolkit.css     everything under .fvtk
│  ├─ assets/silence.wav     the silent placeholder for YouTube tracks
│  └─ scripts/
│     ├─ main.mjs            settings, API, sidebar buttons, system loading
│     ├─ import/             parser (pure), importer, check (pure), setup (pure), adventure
│     ├─ images/             prompts (pure), generate, review window
│     ├─ youtube/            youtube (pure), search, gemini, tracks, picker, player, playlists
│     ├─ assistant/          context (pure), gemini, assistant, sources (pure), filesearch,
│     │                      sources-sync, drawing (pure)
│     ├─ narration/          rules (pure), prompt (pure), narration
│     └─ systems/            cpred (+ cpred-items, cpred-npc pure rules), dnd5e, sw25
└─ tests/                    node --test files for every pure module (89 tests)
```

**Conventions** (also in `CLAUDE.md`):

- **Foundry API:** target v13 only, with ApplicationV2 and DialogV2 and none of the legacy
  `Dialog`/`FormApplication`.
- **Code style:** module code is plain ES modules with no build step. Namespace CSS under `.fvtk`,
  and lang keys under `FVTK.`.
- **Testability:** the testable logic lives in pure files with no Foundry globals, tested with
  `npm test`.
- **Versions:** never bump the version by hand.
- **Comments and naming** match the surrounding code: comments say why, and they're sparse.
- **Checks before committing:** `npm test`, `node --check` on changed `.mjs` files, and both JSON
  files must parse.

**The API** for macros is `game.modules.get("foundry-vtt-toolkit").api`:

| Part | Calls |
| --- | --- |
| `importer` | `open`, `importEntries`, `parseBundle`, `relink`, `registerType`, `orderScenes`, `pack`, `packAdventure`, `clearCampaign` |
| `youtube` | `pick`, `choose`, `autoPick` |
| `assistant` | `open`, `ask`, `sources`, `syncSources`, and image drawing |

## 6. How the project got here: a history

**21 October**

The repository started as a scaffold of macros and a v13 module, merged as PR #1. The macros come
first: a token-info macro, a link script, and notes on Cyberpunk RED. Then the NotebookLM importer
arrived, in steps:

- **Journals, locations and story threads:** the parser and the importer.
- **NPCs as Cyberpunk RED mook actors.** This uncovered the system gotcha that `CPRActor.create`
  drops passed items, so the importer builds the whole actor itself.
- **Items as real Cyberpunk RED items**, built on the closest compendium item.
- **Secrets on sheets.** GM-only secret sections are shown to owners on the system's sheets, which
  otherwise hide secrets even from the GM.
- **`replaces:`** support: an entry can supersede an earlier document and keep its id, so links
  survive.

**22 October**

A big day:

- **Scenes and YouTube.**
  - Scene import from an image folder, matching file names to entry names.
  - Story scenes numbered in campaign order by session.
  - Synced YouTube playlists played through the embedded player.
- **YouTube search fixes.** Searching for long descriptions ("High-energy darksynth with roaring
  distorted saws…") found nothing embeddable, so:
  - searches fall back to shorter, genre-word versions of the description;
  - an optional Gemini step turns each description into real track suggestions and short searches,
    each checked on YouTube.

  Several fixes followed:

  | Problem | Fix |
  | --- | --- |
  | Gemini hung | The lite model became the default, with a timeout |
  | Junk results | Results limited to the Music category, at least 2 minutes long, with a title filter |
  | The same songs repeating | An avoid list |
  | Cramped layout | Picker grid fixed |
  | Play didn't sync | Both playlist hooks handled |
  | Stop left an old pause state | Pause told apart from stop by reading the change |

- **The user's goal.** The user then stated the end goal of a full campaign with no manual steps,
  and asked to "complete all steps necessary to automate as much as possible", committing and
  pushing after each step. Six steps were planned and built in order:
  1. **Prompt kit v2:** exact field names for full automation.
  2. **Free scene image generation:** Pollinations by default, the user's Cloudflare Worker as an
     option, and a review window.
  3. **Auto-picked YouTube tracks** during import.
  4. **Scene setup:** hidden NPC tokens, a journal pin, and the soundtrack playlist.
  5. **Build campaign:** the whole flow in one run, with a campaign check, a fix prompt and a
     summary.
  6. **Pack campaign:** a Foundry Adventure.

**23 October**

- **The full test pass.** The user asked for thorough testing, so a realistic 21-entry QA campaign
  was built through the real dialogs, and every path exercised. 19 defects were found and fixed,
  plus three more found while retesting. Among them:
  - **Pollinations' new limit:** its free tier now allows one image per 45 seconds and answers
    `402 FREE_LIMIT` to faster requests, so it's waited out.
  - **False alarms in the campaign check:** it flagged rulebook gear as broken links, and epilogues
    without a session.
  - **A sync bug:** the sync uploaded Foundry's 404 page instead of the file.
  - **Existing scenes** weren't set up unless their image was supplied again.
  - **The image review window:** it lost the cursor on every refresh, unticked images were still
    generated, and its cards stretched to the window's height.
  - **The build summary:** it listed skipped items only in the console.
- **Prompt 0 grew in stages**, each committed:
  - a formatting and bracket discipline after the test pass;
  - a full chat configuration with every type's fields (about 4,900 characters);
  - play mode and session logging, about 6,400 characters;
  - a rework putting build mode first, with playtests that aren't canon, about 7,800;
  - the campaign-end choice of scrap or sequel, 9,023 characters, close to NotebookLM's
    10,000-character limit.

  The parser was also made to accept bold and bulleted field lines, in case NotebookLM slips.
- **Campaign end.** Pack campaign can now clear the world after packing, to start fresh.
- **The GM Assistant:** a Gemini chat inside Foundry with the campaign as context, plus `/gm` in
  chat.
- **Sources for the assistant.** A Foundry folder of files is synced to a Gemini File Search store,
  and answers cite their sources.
- **Documentation.** The user guide was written, with 13 screenshots taken in cpr-test, and the
  CHANGELOG with it. Taking the screenshots turned up three more fixes.
- **Combat.** The first version narrated attacks. The user then asked for hit narration to wait
  until damage is rolled, misses narrated as misses, and as much automation as possible, and gave
  Cyberpunk RED's combat rules in full. The result is automated resolution (range DV, Evasion, the
  defender winning ties), damage applied to NPCs, outcome-aware narration, and a repeat check.
- **Gemini image generation**, built in a separate session the user started:
  - a third image provider, which needs billing;
  - pictures from the GM Assistant, with buttons to make a picture an actor's portrait and token,
    or a scene's background.

  It was merged into `main` as `b7488bb`.
- **The NotebookLM notebook's chat configuration** was updated to the current Prompt 0.
- **The handoff:** a handoff note, a testing section in `CLAUDE.md`, and a workflow for working
  across machines and cloud sessions.

## 7. Feature by feature

### 7.1 The `##ENTRY` format and the parser

An entry is a block:

```
##ENTRY
type: npc
name: Rook
tags: cyberpunk-red, npc, bodyguard
role: Solo
gear: [[Heavy Pistol]], [[Kevlar]]
##BODY
Crane's bodyguard...
##END
```

Field lines come before `##BODY`, one `key: value` per line, with lowercase field names. A line
without a key continues the previous field, which is how `tracks:` holds numbered lines. The parser
(`import/parser.mjs`, pure) tolerates what copying from NotebookLM does:

- code fences and citations like `[1, 2-4]`, which are stripped, keeping `[[links]]`;
- backslash escapes (`\#\#ENTRY`) and HTML entities;
- trailing spaces;
- bold keys (`**name:** X`), bulleted field lines, and bold values.

A bulleted line only counts as a field if its key looks like one. Inside a `tracks:` list, it counts
only for the entry fields (type, name, tags, replaces, image, map), so `- Darksynth: heavy bass`
stays a track.

- **Repeats and missing breaks:** if an entry appears twice, the later copy wins. Lost line breaks
  are detected, with a warning to copy again from the code block.
- **`[[Name]]` links:** `normalizeName` matches loosely, ignoring case, quotes, punctuation,
  apostrophes and a leading "The". `resolveLinks` turns a link into a Foundry `@UUID[...]{Name}`
  link, or bold text when nothing matches, because a leftover `[[...]]` would be read by Foundry's
  inline-roll enricher.
- **`replaces: <name>`** supersedes that document even without the overwrite box ticked, keeping its
  id so other documents' links survive.
- **`image:` or `map:`** names a file or path for the entry's scene background.

### 7.2 Build campaign (the importer)

`import/importer.mjs` has `openImporter`, which is the Build campaign flow:

1. **The dialog:** paste text or choose a file; choose the image folder (default
   `worlds/<world>/assets/notebooklm`); tick Replace to overwrite existing documents.
   `openImporter({ text })` opens it with text filled in, which is how the GM Assistant hands over
   entries.
2. **The preview** (`previewHTML`) shows, per entry:
   - the type and destination;
   - whether it's new, replaces an earlier import, or is kept;
   - the image each scene gets, or that one will be generated;
   - its links.

   It also shows parser warnings, the [campaign check](#73-the-campaign-check) and how many images
   will be generated.
3. **Images.** `imageJobs` decides what needs generating, and the review window (§7.4) makes it.
4. **`importEntries`** does the import:
   - It decides every entry's id up front, so links resolve between entries of any type in the
     bundle, and to existing documents.
   - It creates or updates journals. Markdown pages are always created as embedded documents,
     because nested creation loses their rendered HTML.
   - It calls registered type handlers in `order` (items before NPCs, playlists at 5).
   - It imports scenes, then `orderScenes`, then `relink`, which re-resolves links in earlier
     imports the GM hasn't edited.
5. **Auto-pick** YouTube tracks (§7.6).
6. **The summary** (`showSummary`):
   - created and updated counts;
   - scenes;
   - tracks picked;
   - "already imported and kept" as one count, not 21 lines;
   - campaign check gaps;
   - a folding list of skipped and not-found items;
   - **Activate** for this build's first story scene.

**Where things go:** everything sits under a "NotebookLM" root folder per document type, with
subfolders Campaign, Story Threads, Locations and Scenes for journals, plus NPCs, Items and
Playlists. The world-wide scene folders are Locations and Scenes. Documents carry
`flags.foundry-vtt-toolkit.source = "notebooklm"`, plus `type`, `tags`, and `raw`/`generated` (the
Markdown with links, and what was generated, so relinking can tell whether the GM edited a page).

### 7.3 The campaign check

`import/check.mjs` (pure) runs `campaignCheck(entries, { known, linkedElsewhere })` in the preview.
It flags:

- **broken links:** a `[[link]]` that matches no entry and no document in the world. It looks only
  at an entry's own links, outside an NPC's `gear` field, because rulebook gear is resolved from
  the system's compendium;
- **unconnected entries,** checked only when the bundle has a story (scenes or threads):
  - NPCs in no scene, location or thread;
  - items no one uses;
  - locations no scene or thread visits. A journal mentioning a location doesn't count as a visit;
- **missing scene fields:** scenes without `session`, `location`, `npcs_present`, `soundtrack` or
  `visual`. A scene needs no session if `progressionKey` finds one in its text or it's an
  epilogue or prologue;
- **missing location visuals:** locations without `visual`;
- **wrong-kind references:** a scene's `location:` or `soundtrack:` naming the wrong kind of entry;
- **empty playlists:** playlists with no tracks.

**`linkedElsewhere`** returns the entry types of world documents that link to a name. It ignores
earlier copies of the bundle's own entries; that fixed a bug where re-imports hid real gaps.

**`fixPrompt(issues)`** builds a prompt to paste into NotebookLM. It asks for `replaces:` entries, so
the next build updates in place.

### 7.4 Scene images

- **`images/prompts.mjs`** (pure):
  - `imagePrompt` puts the subject first, from the `visual:` line or the description, then the
    *Scene image style* setting. Image models weigh the start of a prompt most.
  - `imageFileName` produces names that `findImage` matches (`dr-chens-free-clinic.jpg`).
  - `imagesNeeded` decides what needs an image. A scene with no `visual:` borrows its location's
    image; a scene with its own visual gets its own.
- **`images/generate.mjs`**: three providers.
  - **Pollinations** (the default): free, no key. It allows one image per 45 seconds per IP
    address, and answers sooner requests with `402 FREE_LIMIT`, so requests are spaced 46 seconds
    apart and rate limits retried. Images are about 1015×580, from a basic model with a small
    watermark. The browser can't read `Retry-After` across origins, so the wait is parsed from the
    error body.
  - **Cloudflare Workers AI:** FLUX.1 schnell through a Worker the user deploys themselves, from
    `docs/images/cloudflare-worker.js`, because Cloudflare's API sends no CORS headers. It's free
    within the daily allowance, makes square images, and is better quality.
  - **Gemini** ("Nano Banana" image models), from the other session. It needs billing on the key:
    a free-tier key gets a 429 with a `...FreeTier` quota and `limit: 0`, which is reported as
    "needs billing" and not retried. It costs about $0.03 an image with the default model,
    `gemini-3.1-flash-lite-image`, set by the *Gemini image model* setting. Images are 16:9 for
    scenes.
- **`images/review.mjs`:** the ApplicationV2 review window.
  - It generates one image at a time, with an editable prompt per card. **Regenerate** retries a
    card; unticked cards aren't generated.
  - It keeps the cursor while it refreshes, shows the time left on Pollinations, and counts
    failures separately.
  - Uploads use `FilePicker.upload`, and a falsy or path-less result counts as a failure.
  - *Keep generated images without review* uploads everything without asking.

### 7.5 Scenes and scene setup

- **Building scenes:** `importScenes` creates gridless scenes sized to the image, kept out of
  navigation, with their notes opening the journal.
  - **Existing scenes** are found before an image is needed, so they keep their own background.
    They're updated in place only when being replaced, which keeps tokens, walls and drawings.
  - **Story scenes** are numbered by `orderScenes` through `progressionKey` (the `session:` field,
    else "Session N" in the text, else last for an epilogue or first for a prologue) and
    `numberInOrder`.
- **`setupScene`** sets each scene up for play:
  - **hidden NPC tokens** from `npcs_present` (a location's `npcs`), laid out by `setup.mjs`;
  - a **book pin** in the top-left corner, opening the journal;
  - the **`soundtrack:`** playlist as the scene's playlist, so activating the scene plays it.

  What it placed is flagged `placed`, so re-imports update only that; tokens the GM added are never
  touched. A scene that existed before scene setup gets it once (flag `setup`).

### 7.6 YouTube playlists

- **Playlists:** a `playlist` entry becomes a sequential playlist. Its `tracks:` lines are style
  descriptions, not song names, kept in flags.
- **Picking tracks:** `youtube/tracks.mjs` `TrackSearch` plans the searches for one line:
  - a search the GM typed comes first;
  - then, with a Gemini key, Gemini's real track suggestions and short searches. Gemini is told
    which tracks the playlist already has, and to match energy and tempo;
  - then shorter genre-word fallbacks, cut from the description.

  Results come from the YouTube Data API v3 (`search.mjs`). Only embeddable videos in the Music
  category that run at least two minutes are kept, with reaction, review, tutorial and lyric videos
  dropped. Tracks aren't repeated within a playlist, or across playlists during auto-pick.
- **The picker** (YouTube tracks, in the Playlists sidebar) shows the results for each line, lets
  the GM paste a link, and saves.
- **Auto-pick**, after a build, uses a smaller search budget: about 200 of the free 10,000 daily
  quota units per line, and it stops cleanly when the quota runs out.
- **Playback** (`player.mjs`):
  - A YouTube track is a normal PlaylistSound with `path` set to `assets/silence.wav` and
    `repeat: true`, holding the video in `flags.foundry-vtt-toolkit.youtube`. Foundry's own
    controls drive it.
  - Every client plays the video in the visible "Now playing" window, 356×200.
  - Shared timing lives in the flags: `startedAt` while playing and `pausedAt` while paused. Late
    joiners start at the right point, and drift over 2 seconds is corrected.
  - When a video ends, the active GM's client moves on to the next track.
  - Closing the window silences YouTube on that screen until the track changes.
  - Browsers only play sound after a real click on the page.

### 7.7 The GM Assistant

`assistant/assistant.mjs`, from the Journal sidebar or with `/gm <question>` in chat. The window and
chat share one conversation, kept until a reload or **New chat**.

- **Context:** `campaignContext` collects every NotebookLM document: journals with their raw
  Markdown and secrets, NPCs with their notes and gear, items, playlists, and the story scene
  order. `contextText` (pure) groups and caps it, at 12,000 characters per document and 400,000 in
  all. It's sent as the system instruction with every question, so answers reflect the world as it
  is now. About 98,000 characters for the cpr-test campaign.
- **The system prompt** (`context.mjs`): answers are grounded in the campaign, short Markdown for
  questions, and `##ENTRY` blocks in one code block for new content. `ENTRY_RULES` is a verbatim
  copy of Prompt 0's format, fields and consistency rules, and `tests/assistant.test.mjs` fails if
  they drift apart. **Edit Prompt 0 and `ENTRY_RULES` together.**
- **Answers** render through `resolveLinks`, so campaign names become links. Inside code blocks,
  brackets are escaped so the inline-roll enricher doesn't read them. Entries Gemini writes without
  a code block are wrapped in one, and Foundry's `code { white-space: nowrap }` is overridden so
  entries keep their line breaks.
- **New content:** an answer containing entries gets **Build campaign with this entry**, which
  opens the importer with the entries filled in. **Whisper to GM chat** posts the answer to chat,
  and **Copy** copies it.
- **The model** is `gemini-flash-lite-latest` by default, from the *GM Assistant model* setting.
  A chosen model gets 30 seconds before the lite one answers, and a busy model is skipped for 10
  minutes. The full Flash model once hung for two and a half minutes.
- **Pictures** (`drawing.mjs`, pure, from the other session):
  - `imageRequest` spots requests ("draw a portrait of Rook", "image: the vault door"), and there's
    an **Image** button too.
  - Gemini writes the image prompt from the campaign, such as an NPC's appearance or a location's
    `visual:`. The scene image generator draws it, or Gemini when scene images are off.
  - **Save** uploads it (portraits go in a `portraits/` subfolder).
  - **Portrait and token: <actor>** and **Background: <scene>** apply it, with confirmation.
    `imageTargets` picks those documents from the request, the plan's subject, or the last answer.

### 7.8 Sources for the GM Assistant

NotebookLM can't share its sources, so the assistant gets its own copy:

- **The files:** a Foundry folder, `worlds/<world>/sources` by default, subfolders included. The
  **Sources** dialog can change it, and **Add files…** opens Foundry's file browser there.
- **Sync** (`sources-sync.mjs`):
  - It walks the folder with `FilePicker.browse`, and reads each file's size and Last-Modified
    time from a HEAD request.
  - `sources.mjs` (pure) `classify` decides which files File Search can read (PDF, TXT, MD, CSV,
    JSON, XML, YAML, HTML, DOCX, XLSX; up to 100 MB). `syncPlan` decides what to upload, replace
    (new copy first, then the old one deleted) or remove.
  - Each document's customMetadata records its `path` in the folder and a `fingerprint`, so **the
    store itself is the sync record**.
  - The store is found by its display name per world ("Foundry VTT Toolkit sources: <world id>"),
    so any browser with the same key uses it.
- **The REST calls** (`filesearch.mjs`) go straight from the browser, which CORS allows. An upload
  is a resumable `uploadToFileSearchStore`, then **the document is polled until `STATE_ACTIVE`**,
  because the returned `.../upload/operations/...` name never reports done.
- **Answers:** with sources on, `askGemini` adds
  `tools: [{ file_search: { file_search_store_names } }]`, which works with `system_instruction` on
  `generateContent`. `citations()` (pure) turns `groundingMetadata.groundingChunks` into a folding
  "Sources:" list under each answer, with PDF page numbers and the passage read. Rules questions
  are answered from the rulebooks; for the campaign's own people, places and plot, the campaign
  documents win.
- **Free-tier limits:** about 1 GB of index, roughly 330 MB of files. Indexing costs $0.15 per
  million tokens once, if the free tier charges for it at all. Free-tier data may be used by Google
  to improve its products, unlike NotebookLM's.
- **Not used yet:** the user hasn't synced their real sources. Only the QA test library was synced,
  then deleted.

### 7.9 Combat: resolution and narration (Cyberpunk RED)

`narration/` has `rules.mjs` and `prompt.mjs` (both pure and tested) and `narration.mjs` (the hooks).
The design follows the user's own summary of Cyberpunk RED's combat rules.

**Targets.** Foundry doesn't record targets on chat messages. Every roller's client stamps
`game.user.targets` onto its roll messages in `preCreateChatMessage`. Players need the module
enabled; it is, as it's a world module.

**Who does the work.** Only the active GM's client resolves and narrates, because it has the Gemini
key. Everything runs through one queue, in roll order.

**Recognising rolls.** Cyberpunk RED drops a roll's state when it goes to chat (`CPRRoll#toJSON`
empties `options`), so rolls are recognised by class: `CPRAttackRoll` and its aimed, autofire and
suppressive subclasses, `CPRDamageRoll`, and `CPRSkillRoll`. An attack's real total (the d10 plus
stat and skill) is **only in the card's `.d10-number-div`**; the message roll's total is the d10
alone.

**Resolution** (when *Resolve attacks automatically* is on). A player character attacking an NPC,
or an NPC attacking, posts a public **Combat** card.

- **Ranged and thrown:**
  - The DV comes from the weapon's `system.dvTable`, a RollTable in the compendium named by the
    system's `dvRollTableCompendium` setting, with the "(Autofire)" variant for autofire. The
    distance is the token-centre distance, rounded.
  - An NPC with REF 8 or more dodges with Evasion when its average check, DEX + Evasion + 5.5,
    beats the DV. A player character with REF 8+ gets a "may dodge" note.
- **Melee and brawling** (`!system.isRanged`):
  - A targeted NPC rolls Evasion automatically, with the system's own roll and card.
  - A targeted player character is asked to roll Evasion; the card waits, and their Evasion roll
    resolves it.
- **The outcome:** the defender wins ties (`hits = total > defence`). Natural 10s and 1s are
  already in the total, and colour the narration.
- **Miss:** narrated at once.
- **Hit:** the card says "Roll damage", and narration waits.
- **GM overrides:** **Hit** and **Miss** buttons on every card. Rolling damage after a miss counts
  as the GM confirming a hit. If the range can't be measured, for example when the GM views
  another scene, the card asks the GM.

**Damage.** A `CPRDamageRoll` is matched to the attacker's oldest open hit, within the last 40
messages; with ROF 2, two damage rolls match two hits. Without a match, it uses the targets on the
damage card.

- **Applying it:** with *Apply damage on a hit* (NPCs only by default; everyone, or off), it calls
  `actor._applyDamage(...)` with the card's apply-button data and the dialog's defaults (role and
  effect reductions, shields and brain-damage reduction all on). The system handles SP, ablation
  and the Critical Injury bonus, and the damage card is marked as applied.
- **Otherwise,** `damageEffect` estimates the result: melee halves SP (rounded up), two or more 6s
  are a Critical Injury adding 5 that ignores armor, and the wound state comes from the HP left.

**Narration** (`prompt.mjs`), from Gemini with a JSON schema answer (`{ narration, lines }`). It knows:

- the outcome: miss, hit with what the damage did, or only the attempt;
- the attack card;
- the round and whose turn it is;
- the NPCs' **public** notes, appearance and voice;
- their wound states;
- the last 20 **public** chat messages;
- the six most recent narrations, listed as wording not to reuse.

NPC lines are at most 20 words, in their own voice, and never repeat anything they've said before.
`parseNarration` drops a repeated line, and if a narration shares a six-word run with an earlier one
(`repeatsEarlier`), Gemini is asked again. It never describes death unless the target is mortally
wounded, and never adds game numbers to the prose. GM secrets and whispered messages are never
included, because players read it.

The *Combat narration* setting can post for everyone (the default), show the GM first (whispered,
with Post and Discard buttons), or be off. Suppressive fire, and attacks in other systems, get
attempt narration only.

**Not modelled:** cover, ambushes, situational modifiers, suppressive fire effects and autofire
damage multipliers. The GM uses the Hit and Miss buttons for those.

### 7.10 Pack campaign and campaign end

`import/adventure.mjs`:

- **Packing:** **Pack campaign** (Compendium sidebar) packs every NotebookLM document, everything in
  the NotebookLM folders, and the folders, into one Adventure in `world.notebooklm-campaigns`,
  created on first use. Packing again under the same name replaces it. The cover is the first
  story scene.
- **Using it elsewhere:** Import Adventure keeps the documents' ids, so links, tokens and pins work
  in another world. Images aren't copied; they stay at their paths, so the other world must be on
  the same server.
- **Clearing the world:** with *Remove the campaign from this world after packing it* ticked,
  `holdsAll` first checks the adventure holds every document. An Adventure's contents are Sets of
  documents, not id-keyed collections, and an earlier version got this wrong. Then it asks for
  confirmation and `clearCampaign` deletes the campaign. Import Adventure restores it.
- **Prompt 0's campaign-end section:** "campaign over" makes NotebookLM ask whether to scrap or
  continue.
  - **Scrap:** NotebookLM retires every old name, and tells you to pack and clear first.
  - **Continue:** it writes an "<old title> Aftermath" journal, then builds a sequel. The sequel
    reuses old entries by their exact names, uses `replaces:` for changed ones, and numbers its
    sessions on from the old campaign's, so its scenes sort after the old ones.

### 7.11 Cyberpunk RED import specifics

`systems/cpred.mjs`, with the pure rules in `cpred-items.mjs` and `cpred-npc.mjs`.

**Items:**

- An item is built on the closest core compendium item of its type, matched by exact name, armor
  aliases or whole-word partials, so weapon skills, DV tables and ammo stay valid.
- Damage, ROF, SP (body or head), penalty, Humanity Loss (`"7 (2d6)"` becomes static 7 with a 2d6
  roll) and price are applied on top.
- GM-only fields go into a secret section of the description.

**NPCs:**

- **Base:** mook actors built in full and created with the base `Actor.create`, because
  `CPRActor.create` drops passed items.
- **Role:** a role item, with its rank from the tier.
- **Stats:** tier defaults, overridden and clamped by the `stats:` line.
- **Skills:** all core skills, with levels from the `skills:` line.
- **Gear:** matched to the compendiums, with weapons and armor equipped and cyberware installed.
  An NPC given armor cyberware also gets the matching armor item.
- **Derived values:** HP is 10 + 5 × ceil((BODY + WILL) / 2). Humanity is EMP × 10 minus static
  cyberware Humanity Loss, and EMP drops by one per 10 Humanity lost.
- **Notes:** public notes on the sheet, plus a GM-only secret section, which lists gear not found
  in the compendium.

**Secrets:** `showSecretsToOwner` re-renders the system's ProseMirror fields so secret sections show
to owners, the GM included. The system's own sheets hide them from everyone.

### 7.12 Settings

All are client settings, in the GM's browser:

| Setting | Default |
| --- | --- |
| YouTube Data API key | none |
| Pick YouTube tracks during import | on |
| Gemini API key | none |
| GM Assistant model | `gemini-flash-lite-latest` |
| Combat narration | post for everyone |
| Resolve attacks automatically | on |
| Apply damage on a hit | NPCs only |
| Gemini model (for music suggestions) | `gemini-flash-lite-latest` |
| Scene image generator | Pollinations |
| Gemini image model | `gemini-3.1-flash-lite-image` |
| Scene image style | "cinematic concept art, wide establishing shot…" |
| Keep generated images without review | off |
| Cloudflare Worker URL and token | none |
| Debug logging | off |

The dialogs also remember, in hidden settings: the image folder, the sources folder, and whether to
search the sources.

## 8. The NotebookLM side

### The notebook

The user's notebook is **"Cyberpunk RED Single Player Mode"**, with 84 sources in groups: Actual
Play Podcasts, Adventures & Campaigns, Community & Discussion, Fan Fiction, Miscellaneous, Official
Rulebooks & DLC, Overlook Campaign Notes, and Slang & Glossaries. Its chat history includes a live
solo game: "What is your move before the heist, Alloy?", with the player character named Alloy.

The chat configuration is under **Notebook configuration → Configure Chat**, with the conversational
goal set to **Custom** and the response length to **Longer**. It holds Prompt 0, **9,023 of 10,000
characters**, updated on 23 October and checked after saving, character for character. It had held
an older 1,861-character version and been switched back to Default.

### Prompt 0, the chat configuration

Prompt 0 lives in `docs/notebooklm/cyberpunk-red-prompts.md`. Its sections:

- **Purpose and modes.** BUILD MODE is the default and the priority. PLAYTEST MODE runs only
  between "start playtest" and "end playtest". The modes are never mixed. A content request during
  a playtest pauses it, and playtests aren't canon.
- **BUILD MODE:** entries only, in one code block, with the `##ENTRY` template.
- **FORMAT RULES:**
  - plain `key: value` lines;
  - lowercase field names, leaving out unknown fields;
  - brackets only for names with their own entry, plus rulebook gear;
  - stable names, with `replaces:` for changes and no numbers in front of names;
  - stop at a complete `##END` when an answer runs long;
  - complete entries, with no placeholders and no citations.
- **FIELDS BY TYPE:** every type's fields and value formats (journal, thread, location, npc, item,
  playlist, scene and visual).
- **CONSISTENCY:** every NPC, location and item is connected, references exist, and NotebookLM
  checks its own answer before replying.
- **GAME RULES AND TONE:** no invented rules, Cyberpunk RED conventions, single-player stakes, and a
  useful companion.
- **PLAYTEST MODE:** NotebookLM is the GM, in prose marked `[PLAYTEST]`.
  - It plays the user's character, or hands over a quick ready-made one that isn't canon.
  - It uses only what the entries say, and notes the gaps it improvises.
  - It never decides the player's actions, and offers 2–4 numbered options.
  - It asks for rolls in Cyberpunk RED terms and lets the user roll.
  - It shows a one-line status after any turn where something changed.
  - "skip to <scene>" jumps ahead.
  - "End playtest" gives a report of what was fun, what dragged, balance and the gaps, each with a
    suggested fix. "Apply the fixes" turns the accepted ones into `replaces:` entries.
- **CAMPAIGN END:** scrap or continue (§7.10).

### Prompts 1–8

1. The campaign concept: a "Campaign Overview" journal.
2. Story threads (4).
3. Locations (10, each with a `visual`).
4. NPCs (12).
5. Items (15).
6. Playlists: Street, Tension and Finale, each with six track-style lines.
7. Scenes (8: opening, set pieces, finale, epilogue).
8. A consistency check, answered with `replaces:` entries.

The user collects the answers in one note or Google Doc, downloads it as `.md` or `.txt`, and
chooses it in Build campaign.

**Editing rules:** when Prompt 0 changes, update the prompt kit, the GM Assistant's `ENTRY_RULES`
(the test enforces this), and the notebook's Configure Chat, which the user pastes or asks a
session to update in the browser. Check the character count stays under 10,000.

## 9. Testing: how, and what's been tested

**Unit tests:** `npm test` runs 89 tests across the pure modules, in about 0.2 seconds, with no
Foundry. They cover:

- the parser, check, setup, image prompts and generator error handling;
- YouTube helpers and Gemini prompts;
- Cyberpunk RED item and NPC rules;
- the GM Assistant's context, drawing and sources;
- combat rules and narration prompts.

New pure helpers get tests. Code that touches Foundry is kept out of the pure files.

**Live tests** in cpr-test, through the browser pane, have covered:

- a 21-entry QA campaign built through the real dialogs: preview, check, image review, upload,
  summary, re-import with and without Replace, `replaces:` fix bundles, and a GM's manual token
  changes surviving;
- image generation with Pollinations under its 45-second limit;
- auto-pick across playlists, the picker, playback starting from scene activation, and the Now
  playing window;
- the GM Assistant: questions, entries handed to Build campaign, `/gm`, and sources with
  citations, including PDF pages;
- Pack campaign: packing, clearing and restoring QA data, and the confirmation;
- combat:
  - a rifle against its DV;
  - the GM override, then damage applied (15 rolled, 4 SP, 11 through, HP 40 → 29);
  - a knife against an NPC's automatic Evasion;
  - an NPC's pistol against a player character;
  - an NPC's knife waiting for a player character's Evasion.

**Not tested live:**

- Gemini images: the key is on the free tier.
- A real NotebookLM v2 campaign run end to end. Only QA bundles were used.
- The user's own combat session, with the latest resolution flow.
- Real player users on other computers, and the user's real sources synced to File Search.

**How to test live:** see `CLAUDE.md`, *Testing in the cpr-test world*. In brief:

- deploy, then reload;
- use the browser pane with the user's keys, never typing keys yourself;
- name test documents `QA …` and delete them afterwards;
- make Cyberpunk RED rolls the way the sheet does (below);
- remember a real click is needed before audio plays;
- avoid running Pollinations from the shell while testing, because the limit is shared by IP;
- keep testing light on the user's YouTube and Gemini quotas.

A Cyberpunk RED roll the way the sheet makes it:

```js
const item = actor.items.find(i => i.type === "weapon");
const roll = item.createRoll("attack", actor);
await roll.roll();
roll.entityData = { actor: actor.id, token: token.id };
await CPRChat.RenderRollCard(roll);
```

`CPRChat` is imported from `/systems/cyberpunk-red-core/modules/chat/cpr-chat.js`.

## 10. Decisions and their reasons

- **NotebookLM writes, the toolkit imports.** NotebookLM grounds the campaign in 84 sources, and
  has no API, so the hand-off is a text format. The format is strict, and the parser is tolerant.
- **The prompt kit and the toolkit share one contract.** Prompt 0's fields are what the importer
  reads, and the campaign check mirrors Prompt 0's consistency rules.
- **Free defaults.** Pollinations for images, and free tiers for YouTube and Gemini. Paid options
  (Gemini images) are opt-in, and say so plainly.
- **The lite Gemini model is the default** for music search, the assistant and narration. The full
  model hung for minutes on the free tier.
- **API keys are client settings,** so they stay in the GM's browser and never reach players. The
  user enters them; Claude never types them.
- **YouTube through the embedded player only.** No downloading; the player stays visible and at
  least 200×200, under YouTube's rules.
- **A silent placeholder file for YouTube tracks,** so Foundry's playlist controls, volume and sync
  work unchanged.
- **Gridless scenes sized to the image, and kept out of navigation:** the scenes are illustrations
  for theatre of the mind. Their grid scale is 2 m per 100 pixels, which combat range uses.
- **`replaces:` keeps ids,** so links and tokens survive revisions.
- **Re-imports touch only what the toolkit made,** using `placed` and `generated` flags. Never
  overwrite the GM's own edits, tokens or pages.
- **Build mode comes first in Prompt 0, and playtests aren't canon.** That's the user's priority.
- **The GM Assistant's context is the whole campaign, sent every time.** It's simple, always
  current, and about 25,000 tokens, well within limits.
- **The assistant gets its own copy of the sources** through Gemini File Search. NotebookLM can't
  share them, and the unofficial NotebookLM tools need the user's Google login cookies on a server,
  which was rejected as unsafe and fragile.
- **The File Search store is its own sync record,** with the path and fingerprint in each document's
  metadata. That works across browsers and machines, with no local manifest.
- **Combat:**
  - A hit is narrated only after damage is rolled, which is how the GM confirms it; a miss is
    narrated at once. The user specified this.
  - The defender wins ties, as in the rulebook.
  - The GM can override anything with Hit and Miss.
  - Damage is applied automatically to NPCs only, so players keep control of their own sheets.
  - Narration never includes secrets or whispers, because players read it.
- **Campaign end is NotebookLM's question to ask,** and the toolkit supports both answers: pack and
  clear, or a sequel numbered on from the old campaign.
- **Server specifics are kept out of the repo,** because it's public.
- **Workflow:** cloud sessions change code and push a branch; local sessions deploy, test on
  cpr-test, and merge with the user's OK.

## 11. Known limits and rough edges

These are also in the user guide's *Known issues* section.

- **One numbering per world:** story-scene numbering is shared by every campaign in a world. Pack
  and clear first, or build a sequel numbered on.
- **Replacing NPCs and items:** re-importing a changed NPC or item replaces the whole document, so
  hand edits on its sheet are lost. Journals the GM edited by hand aren't re-linked.
- **Auto-pick's reach:** it fills *every* NotebookLM playlist without tracks, not just the ones in
  the current build. Its picks match descriptions loosely, and can be full albums or have vocals.
- **Pollinations:** basic quality and a watermark. **Cloudflare:** square images.
- **Packing doesn't copy images.**
- **The GM Assistant:** its conversation isn't saved. Very large worlds get cut to fit.
- **Combat:** see §7.9 for what isn't modelled. Range uses token centres. A very fast combat can
  hit Gemini's free-tier limit of requests per minute.
- **Other systems:** in systems other than Cyberpunk RED, `npc` and `item` entries are skipped.
  Combat resolution is Cyberpunk RED only.
- **Unfinished macros:** the sw25 and cpred macros only log actor data.

**Security note for the user** (raised, not acted on): the Foundry server is reachable from the
internet, and its GM login has no password. Setting one in Foundry's user configuration would close
that.

## 12. Where we left off

As of 23 October 2026:

**Code:** `main` is on GitHub at `e77d17d`, which adds the workflow section, on top of `2021678`
(the handoff) and `b7488bb` (the Gemini image merge). All 89 tests pass, and there's nothing
uncommitted.

**The server:** cpr-test runs `main` as of **`55a891f`**. That has the docs and combat, but not the
Gemini image work. Deploy current `main` before testing images.

**Open items, roughly in order:**

1. **The user's own combat test** with the new resolution flow, using Player One and NPC One on
   "1. Salvage in the Old Combat Zone". An earlier round of the user's rolls is still in that chat,
   from before resolution existed. Ask how it went and fix what they find.
2. **Deploy `main`** to cpr-test, so Gemini images and the assistant's drawing are there.
3. **Gemini images** need billing on the user's key. Only then can they be tested live. Until
   then, the assistant draws with the scene image generator, Pollinations by default.
4. **Run a real NotebookLM v2 campaign** through Build campaign end to end, and fix what it finds.
   This is the original goal's real test.
5. **Sync the user's real sources** to the GM Assistant: rulebook PDFs, notes, transcripts. Watch
   the free-tier size, and Google's free-tier data terms.
6. **Branches:**
   - `claude/reverent-torvalds-b7384c` is merged and can be deleted.
   - `claude/quirky-keller-i3z8q3` is from the first scaffold. It has "Use sw25-fvtt as the Sword
     World 2.5 system id", while `main` uses `sw25`. Check the installed system's `system.json` on
     the server, settle it, then delete the branch.
7. **The home machine:** its own SSH key added to the server, the API keys entered in its browser,
   and `docs/handoff.local.md` copied in.
8. **From `CLAUDE.md`'s open items:** map the sw25 and cpred macros' field paths, and choose a
   license. The user hasn't chosen one; ask, don't assume.
9. **No release has been tagged.** When the user wants one, tag `vX.Y.Z` and the workflow publishes
   it. Move CHANGELOG's "unreleased" heading to the version and date.

**Things the user said no, or not now, to:**

- a README section on setting up a second machine ("Not now"; the handoff covers it);
- moving this session to the cloud (it stayed local);
- writing a separate play-mode notebook. The user chose one notebook with modes in Prompt 0.

## 13. How to start on the home machine

1. **Get current:** `git pull` in the clone. Make sure `docs/handoff.local.md` is there; the user
   has a copy.
2. **Read** `CLAUDE.md`, `docs/handoff.md` and this brief. Run `npm test`, and expect 89 to pass.
3. **Set up deploying:**
   - Help the user make an SSH key for this machine (`ssh-keygen -t ed25519`), and add its public
     half to the server's `~/.ssh/authorized_keys`. The work machine has access already, or the
     user can do it on the server.
   - Fill in this machine's key path in `handoff.local.md`.
   - Test with a harmless command, such as listing the module folder, before deploying.
4. **The browser:** open Foundry in the session's browser pane. The user signs in and enters their
   YouTube and Gemini keys in Configure Settings → Foundry VTT Toolkit, because they're stored per
   browser.
5. **Ask the user what's next.** Start with open item 1 (their combat test) or 2 (deploying
   `main`).
6. **As you go:** keep `docs/handoff.md` current, commit and push when the user asks, and follow
   the safety rules in §2.

## 14. Recipes for common changes

These are the changes most likely to come up, with the steps that keep everything in step. Each
ends the same way: `npm test`, `node --check` on changed files, both JSON files parse, deploy to
cpr-test and try it, then commit and push when the user asks.

### Add or change a field NotebookLM writes

A field is part of the contract between NotebookLM and the toolkit, so it lives in several places.

1. **Prompt 0** in `docs/notebooklm/cyberpunk-red-prompts.md`, under FIELDS BY TYPE. Keep Prompt 0
   under 10,000 characters; measure the block between its code fences.
2. **The prompt for that type** among Prompts 1–8, if the field should be asked for there.
3. **`docs/notebooklm/format.md`**, in "Fields the toolkit reads" and the type's section.
4. **The code that reads it:** the importer, a system handler (`systems/cpred*.mjs`), scene setup,
   the campaign check (if it should be required), or image prompts.
5. **The GM Assistant's `ENTRY_RULES`** in `assistant/context.mjs`. Copy the changed Prompt 0 text
   in exactly: `tests/assistant.test.mjs` fails until the copy matches the prompt kit.
6. **The notebook:** the user pastes the new Prompt 0 into Configure Chat, or asks a session to do
   it in the browser pane. Check it saved, and that the count still shows under 10,000.

### Add a setting

1. **Register it** in `main.mjs`, inside the `init` hook, with `scope: "client"` for anything
   per-GM (the keys, providers and modes are all client settings), `config: true` to show it in
   Configure Settings, and `name`/`hint` lang keys.
2. **Add the strings** to `module/lang/en.json` under `FVTK.Settings.<Name>.Name` and `.Hint`, plus
   any choice labels.
3. **Document it** in the user guide's Settings table, and here in §7.12.

Read it with `game.settings.get("foundry-vtt-toolkit", key)`. Remember that a client setting set in
the browser pane only affects that browser.

### Add an entry type, or a system

**A new entry type:** call `api.importer.registerType(type, { label, documentName, folder, order,
import })` from a system module (see `systems/cpred.mjs`). `import(entry, ctx)` creates or replaces
one document, using `ctx.id` with `keepId`, `ctx.existing`, `ctx.folder`, `ctx.flags`, `ctx.lookup`
for links, and `ctx.notes`/`ctx.track` for notes that relinking can update. Put the pure rules in
their own file with tests, like `cpred-npc.mjs`.

**A new system:** add a file under `module/scripts/systems/`, and a line to `SYSTEM_MODULES` in
`main.mjs`, keyed by `game.system.id`. Combat resolution is Cyberpunk RED only. Another system
would need its own attack, damage and defence recognition in `narration.mjs`; dnd5e attacks are
already recognised for attempt narration.

### Change combat behaviour

- **Rules** (what hits, DV, dodging, damage estimates) go in `narration/rules.mjs`, with tests in
  `tests/rules.test.mjs`.
- **What the narration is told** goes in `narration/prompt.mjs`, with tests in
  `tests/narration.test.mjs`.
- **Flow** (which messages trigger what, the Combat card, applying damage) is in
  `narration/narration.mjs`. Everything goes through `enqueue`, so it stays in roll order. Only the
  active GM's client runs it.

**To test it live:**

1. Target with `token.setTarget(true, { releaseOthers: true })`.
2. Roll the way the sheet does (§9).
3. Watch for the Combat card and the narration.
4. Clean up: delete the test messages, restore HP and armor ablation (`system.derivedStats.hp.value`
   on the token actor, and `system.bodyLocation.ablation` on the armor item), and remove temporary
   items.

The user may be rolling in the same world at the same time; tell their messages from yours by time
and speaker.

### Change the GM Assistant

- **What it knows:** `campaignContext()` in `assistant.mjs`. Keep GM secrets out of anything players
  will see; the assistant's answers are GM-only, but combat narration isn't.
- **How it answers:** `systemPrompt()` in `context.mjs`, which is tested.
- **Rendering:** `renderAnswer()`. Remember the inline-roll enricher and the `nowrap` on `code`.
- **Model calls:** `assistant/gemini.mjs` (`askGemini`, with the optional `stores` for File Search
  and `schema` for JSON answers). Never log the URL, because it contains the key.

### Deploy and check

1. Pack and copy as in `docs/handoff.local.md`.
2. Reload Foundry in the browser pane (F5). If the reload lands on the join screen, rejoin as in the
   local notes.
3. Check the module loaded: `game.modules.get("foundry-vtt-toolkit").api` should exist, and
   Configure Settings should show the new settings.

Styles are bundled by Foundry, so a CSS change needs a full reload; there's no separate stylesheet
link to refresh. Browsers cache module files, so if behaviour looks old, reload again or check the
served file with `fetch(url, { cache: "no-store" })`.

### Update the docs after a change

- **The user guide** (`docs/user-guide.md`) for anything the user sees: the feature section,
  Settings, Troubleshooting, Known issues and Privacy (for anything new sent to an outside
  service).
- **The release notes** (`CHANGELOG.md`), under the unreleased version.
- **`CLAUDE.md`** for architecture, gotchas and conventions a future session needs.
- **`docs/handoff.md`** for what's open and what's deployed.

Check the links resolve, and that nothing server-specific went in; the repository is public.

## 15. Ideas that came up but weren't built

- **Narrating damage applied to player characters** from NPC attacks. It's estimated rather than
  applied, by design (NPCs-only is the default), but the hit narration covers it.
- **A per-scene range-band picker** for gridless scenes, for when the token distance isn't
  meaningful. The Hit and Miss buttons cover it today.
- **Using Foundry's combat tracker more,** for example narrating a new round or a defeated NPC.
  Only the round and turn are read today.
- **A saved GM Assistant conversation,** which would survive reloads.
- **Unofficial NotebookLM access** through cookie-based tools. This was rejected: it puts the
  user's Google login on a server, and breaks without notice.
- **A separate notebook for playing,** suggested and declined.

## 16. Glossary

- **`##ENTRY` bundle:** NotebookLM's output, a series of entries in the toolkit's text format.
- **Build campaign:** the importer's Journal-sidebar button, `openImporter`.
- **Campaign check:** the preview's list of gaps (`campaignCheck`), with a **fix prompt** for
  NotebookLM.
- **`replaces:`:** an entry field meaning "this supersedes that existing document, and keeps its
  id".
- **Prompt 0:** the NotebookLM chat configuration, kept in the prompt kit. **Prompts 1–8** write a
  campaign.
- **Build mode, playtest mode, campaign end:** Prompt 0's modes.
- **Story scenes:** scenes from `scene` entries, numbered by session. **Location scenes** come
  from `location` entries, and aren't numbered.
- **Scene setup:** hidden NPC tokens, the journal pin and the soundtrack, applied by
  `setupScene`.
- **Auto-pick:** YouTube tracks chosen during a build (`autoPickTracks`). **The picker** is the
  YouTube tracks window.
- **Now playing:** the visible embedded YouTube player window on every client.
- **GM Assistant:** the Gemini chat in Foundry. **Sources:** its File Search library.
- **Combat card:** the public resolution card (`flags.foundry-vtt-toolkit.resolution`), with
  status hit, miss, awaiting, unresolved or done.
- **DV:** Difficulty Value. **SP:** armor Stopping Power. **ROF:** rate of fire. **REF, DEX:**
  Cyberpunk RED stats. **Evasion:** the skill used to dodge.
- **Mook:** Cyberpunk RED's simple NPC actor type. **`character`:** its player character type.
- **cpr-test:** the sandbox Foundry world. **wbtw:** another world, not to be touched without
  asking.
- **`docs/handoff.local.md`:** git-ignored server notes, copied between machines.
