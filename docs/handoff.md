# Handoff: where things stand (23 October 2026)

This note lets a new Claude session, on any machine, carry on from the session that built most of the
module. How the code works is in [../CLAUDE.md](../CLAUDE.md) and [user-guide.md](user-guide.md); this
file is what was in flight, what's open, and why things are the way they are. Update or delete it as
items close.

Server-specific details (host, SSH key, paths, Foundry login) are **not** here, because this
repository is public. They're in `docs/handoff.local.md` on the machine you work from, a git-ignored
file the user copies between machines.

## State

- **`main`** has everything: the NotebookLM importer (Build campaign), scene images
  (Pollinations, Cloudflare, Gemini), YouTube playlists, the GM Assistant with sources, combat
  resolution and narration, and Pack campaign. 92 tests pass.
- **The cpr-test server** runs `main` as of `705ef01` (the narration fixes below), deployed from the
  home machine on 23 October. All 35 module files match the repository, checked with
  `git hash-object`.
- **NotebookLM:** the user's notebook ("Cyberpunk RED Single Player Mode") has the current Prompt 0
  (9,023 characters) in **Configure Chat → Custom**, with response length **Longer**. Edit Prompt 0 in
  `docs/notebooklm/cyberpunk-red-prompts.md` and the notebook together.
- **Campaign designer skill** (28 October, `.claude/skills/campaign-designer/`, uncommitted until the
  user says): designs a campaign and drives NotebookLM in the user's Edge profile through the Claude in
  Chrome extension. Tested on the user's `QA Campaign Designer` notebook (they keep it): created and
  renamed it, pasted a text source, uploaded five PDFs (a Cyberpunk Edgerunners mission kit, its
  rulebook, handbook, a scenario and a cyberware book), set Prompt 0 (9,023 characters) as the chat
  configuration, ran a query and read four entries back, which passed the campaign check. Not yet run
  from a real pitch end to end (intake through hand-off), and only Cyberpunk RED has a profile.
- **First real campaign through the skill** (28 October, `campaigns/section-9/`, git-ignored): a
  12-session Cyberpunk RED campaign for five players, "Section 9", from the user's pitch (Ghost in the
  Shell / Psycho-Pass inspired). 74 entries; the rulebooks (core, Black Chrome, three Hardened packs,
  split under 9 MB) went into a new NotebookLM notebook named Section 9 with a group version of
  Prompt 0; seven refinement queries replaced 67 of the entries; the merged
  `output/campaign.txt` passes the campaign check and extra stat, skill and item checks. Not yet built
  in Foundry (the user runs **Build campaign** with `output/campaign.txt`). The skill's answer
  receiver and driving notes were extended (`answer-sink.mjs`, batched uploads).
- **Section 9 built in cpr-test** (28 October): Build campaign made 39 journals, 17 NPC actors (stats
  and 63 skills each), 14 items, 4 playlists (6 YouTube tracks each, picked with the key already in
  that browser) and, from 27 Pollinations images the user approved, 27 scenes (12 locations and 15
  story scenes, with hidden NPC tokens, a journal pin and a soundtrack each; images in
  `worlds/cpr-test/assets/section-9`, 1015 px wide, watermarked). A first build without images made
  everything but the scenes. The world held another campaign's "Campaign Overview" and Street, Tension
  and Finale playlists, so those four entries were renamed "Section 9 ..." first; the new documents
  share that campaign's journal folders. Side effects of the import that were put back by hand: the
  other campaign's eight story scenes had been renumbered and interleaved (restored to 1 to 8 with
  sort 100 to 800; Section 9's are 09 to 23), and the track picker had filled that campaign's empty
  Tension and Finale playlists (picks removed). Re-running Build campaign would renumber the scenes
  again. Not played or tested with players.
- **Custom-Macros compendium** (28 October): the module ships every macro in `macros/` as a
  compendium, built with `npm run build:packs`. Deployed to cpr-test (only `module.json` and
  `packs/`, so the rest of the module there is still `705ef01`'s), Foundry v13 restarted with pm2
  (the user's OK), and the user launched cpr-test. As Gamemaster: the compendium shows 10 macros in
  5 folders, locked, players as observers; Toggle Acted imported from it ran on Player One's token
  and the test copy was deleted. That first build had no `_stats`, so Foundry migrated the macros on
  launch and rewrote the pack's files on the server; the committed build has `_stats` and holds the
  same 15 records as the server's pack, but its files differ in bytes until the next deploy with the
  world closed.
- **Toggle Acted** (`macros/core/toggle-acted.js`, 28 October) was tested as the Roy player in QA
  Roy v12: with nothing selected it marked Roy's token, one then two selected tokens marked and
  cleared together, and a token's own tint came back. Not yet tried on Foundry v13, and not
  installed in that player's hotbar (the test macro was deleted).
- **Second machine:** the user's home machine has Node.js 24, npm 12, Git, a clone where
  `npm test` passes, the server's SSH key, `docs/handoff.local.md`, and both API keys in its browser.

## Open items

1. **Combat is tested live, ranged and melee.** On 23 October, in cpr-test, with Player One
   (`character`, Combat Knife) and NPC One (mook, Baseball Bat; 25/40 HP, body armor ablated by 1)
   on "1. Salvage in the Old Combat Zone". The user's own ranged test, then scripted rolls (messages
   deleted and actors restored afterwards), showed:
   - resolution, the Hit override, damage matching and auto-applied NPC damage work;
   - melee: a targeted NPC rolls Evasion automatically; a targeted character's card waits
     ("Defending") until their Evasion roll, then resolves;
   - the narrator gets the fire mode (single shots narrated as one round), whether a ranged target
     can dodge (REF 8+ only), and a natural 10 (narrated as spectacular);
   - the hit detail names the armor and its current SP (SP less ablation), halved for melee,
     matching the system's own damage card;
   - turning a narrated miss into a hit deletes the miss's narration.

   Not seen live: a natural 1, and autofire or aimed shots. Melee doesn't check that the tokens are
   adjacent.
2. **Gemini images need billing** on the user's Gemini key. Without it, the provider says so rather
   than failing silently. Not tested live, because the key is on the free tier.
3. **Branches:**
   - `claude/reverent-torvalds-b7384c` is merged and can be deleted.
   - `claude/quirky-keller-i3z8q3` is from the first scaffold. It still has "Use sw25-fvtt as the
     Sword World 2.5 system id", which is wrong: the installed system's id is `sw25` (as `main`
     uses); `sw25-fvtt` is only its GitHub repository's name. The branch can be deleted.
4. **Never tested end to end:** a complete NotebookLM v2 campaign (Prompts 1–8) built in one go with
   Build campaign. Parts were tested with QA bundles only.
5. **Known limits** the user knows about, all listed in the user guide's *Known issues*:
   - Story-scene numbering is shared by every campaign in a world.
   - Auto-pick fills every empty NotebookLM playlist, not just the ones being imported.
   - Combat doesn't model cover, ambushes, autofire multipliers or suppressive fire.
6. **Roy's Declarations** is one ApplicationV2 window that stays open, with eighteen one-click
   moments (attacking, defending, healing, health and mana, roleplay), targeted tokens named and
   shown in a live target line (`targetToken` hook, removed on close), the Gemini key row and every
   message inside it: no notifications, no chat, no other windows. **Roy's History**
   (`roy-history.js`) lists the lines it saves in localStorage (`roy-declarations.history`), with
   search, star, delete and Export. Roy's profile, party, weapon (`WEAPON`) and "Slayer" handle now
   follow the user's NotebookLM notebook, with party secrets kept out. Both tested live on
   26 October in cpr-test (Foundry v13): layout, first run without a key, typed and quick moments
   with targets, copy, Another line, errors, closing mid-request, every history feature, the target
   line and the roleplay moments, with nothing reaching notifications or chat. Both stay installed
   in cpr-test (slots 0 and 9) and are overwritten with each change. Also tested on Foundry v12
   (12.343) the same day, in a `QA Roy v12` world with Sword World 2.5 (`sw25` 2.4.1) and a sheet
   for Roy: the window, target line, moments, copy, Another line, key row, one window per click,
   the hook removed on close, and the history's search, star, filter and delete all work; Export
   wasn't clicked, to avoid a download. The user keeps that world: it has Roy's full sheet (filled
   in on 27 October from the user's sheet; the sheet's own numbers match it: HP 26, MP 23, Defense
   6, Evasion 3, Accuracy 4, k20@12+3, priest magic power 4, EXP 3000/4160), Keira, a goblin, a
   `QA Roy test` scene and both macros (slots 0 and 9). The user's notes also had a JSON block that
   disagreed in places (Fighter 2, five spells); the sheet text was used, because its numbers add
   up. Categories (with colours and a history filter) were added and tested on v12 and v13 the
   same day, then the Rolls page: it reads the sw25 sheet's `.rollable[data-roll]` and
   `.powerrollable` elements from `sheet._renderInner(await sheet.getData())` without opening it,
   rolls through `sheet._onRoll` / `_onPowerRoll` with that element, and reads the result from the
   chat card's `.diceresult-total`. Those are sw25 sheet internals (2.4.1 on v12), so a different
   sw25 version may need checking. Tested on v12: accuracy, damage with a target, Cure Wounds,
   Fortitude, Willpower, live updates and Ask again. A Settings tab followed: the key, Always name a
   move, and Put Roy's line on roll cards, which writes the line first and adds it to the roll
   card's flavor in `preCreateChatMessage` (tested on v12, including Gemini failing before the
   roll). The user also rolls in QA Roy v12 now; leave their chat cards alone. A ★ Star link on a
   posted line followed: a deferred inline roll (`a.inline-roll` with `data-formula="0"` and a
   `data-flavor` naming the line), since the clicker runs none of our code; Roy's player's open
   window reads the star card in `createChatMessage`. It's a `selfroll`: Foundry still sends
   whispered rolls to every browser (others see a "privately rolled" stub), so his player's browser
   can read it, but it can't be whispered to one player (inline rolls only take the standard roll
   modes). Roy also keeps his faith to himself: no gods, his god's name or vampires in his words (`noGods` turns any slip into the Sacred Crusher). Tested across users: a player user owns Roy's
   sheet with its own copies of both macros (named in `docs/handoff.local.md`), and the user's
   Gamemaster click starred the line in that player's history. Roy's macros are now tested as that
   player, and on 27 October the user asked to focus on QA Roy v12 only, so cpr-test's copies of
   the two macros are a few changes behind (refresh them there if needed). A code review the same
   day removed leftovers (an old localStorage cleanup, a duplicate actor name, "dreven" in the
   word list) and shared the disposition and move helpers; tested as that player in QA Roy v12:
   target line, a typed line, a roll with its line, a line on a roll card with ★ Star, the blocked
   answer message (with a stubbed reply) and Roy's History. A **Character for rolls** setting then
   let the Rolls page read another sheet by name (localStorage `rollActor`); tested as that player:
   unknown and unowned names are refused, a saved name survives reopening, a missing one says so,
   and blank goes back to the assigned character. The user then gave that player (and Player2)
   ownership of Keira: switching to her read her sheet, and showed that a sheet with no weapon drew
   ": Accuracy" and ": Damage" buttons for the empty slot, which are now skipped (Keira 11 rolls,
   Roy still 33). No roll was made from Keira's sheet.
   The v12 install is now served over HTTPS on the same site as v13 (details in
   `docs/handoff.local.md`), so the two share localStorage: one Gemini key and one Roy history.
   Gemini (`gemini-3.5-flash-lite`) took 7 to 40 seconds per line that day,
   so the limit is 45 seconds; a resend for reused move names was dropped because it doubled the
   wait, and the prompt lists used move names instead.
7. **From `CLAUDE.md`:** mapping the sw25 and cpred macros, and choosing a license.

## Decisions, and why

- **Gemini `gemini-flash-lite-latest` is the default everywhere.** The full Flash model hung for
  minutes on the free tier. A chosen model gets 30 s before the lite one answers, and a busy model
  is skipped for 10 minutes.
- **Pollinations is the default image provider, waiting 45 s between images.** It's free with no
  account. Its free tier answers sooner requests with `402 FREE_LIMIT`, which is waited out.
  Cloudflare (the user's own Worker) and Gemini (needs billing) are the better-quality options.
- **Build mode comes first in Prompt 0, and playtests aren't canon.** The user's priority is building
  campaigns; playtest mode is for checking a campaign is fun.
- **Combat:**
  - A hit is narrated only after damage is rolled, which is how the GM confirms it; a miss is
    narrated straight away.
  - The defender wins ties, as in the rulebook.
  - Damage is applied automatically to NPCs only, so players keep control of their characters'
    sheets.
  - Narration never includes GM secrets or whispered messages, because players read it.
- **API keys are client settings,** so they never reach players and stay in the GM's browser.
- **The GM Assistant gets its own copy of the sources** through Gemini File Search, because NotebookLM
  has no API.
- **The importer never downloads from YouTube.** It plays tracks through YouTube's visible embedded
  player, as YouTube's rules require.
- **Sessions in their own worktree commit to their own branch.** They need the user's OK to merge, and
  they all deploy to the same server folder, so coordinate before deploying from one.
