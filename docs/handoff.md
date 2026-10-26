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
     Sword World 2.5 system id", while `main` uses `sw25`. Settle that with the open item in
     `CLAUDE.md`, then delete the branch.
4. **Never tested end to end:** a complete NotebookLM v2 campaign (Prompts 1–8) built in one go with
   Build campaign. Parts were tested with QA bundles only.
5. **Known limits** the user knows about, all listed in the user guide's *Known issues*:
   - Story-scene numbering is shared by every campaign in a world.
   - Auto-pick fills every empty NotebookLM playlist, not just the ones being imported.
   - Combat doesn't model cover, ambushes, autofire multipliers or suppressive fire.
6. **Roy's Declarations** now always asks what's happening and shows Gemini's line privately with
   copy buttons (no bank, kinds, shortcuts or chat posting). Tested with mocked Foundry and Gemini
   only; not yet run in Foundry v12 or v13.
7. **From `CLAUDE.md`:** the sw25 system id, mapping the sw25 and cpred macros, and choosing a license.

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
