# Release notes

The module's version is set from the git tag when a release is published. Nothing has been tagged
yet, so everything below is the first release.

## 0.1.0 (unreleased)

The first release. It turns a NotebookLM campaign into a ready-to-run Foundry VTT v13 world, with
music and a GM Assistant.

### Building a campaign from NotebookLM

- **Build campaign** (Journal sidebar) imports NotebookLM `##ENTRY` bundles, pasted or from a file.
  It turns them into journals (campaign, story threads, locations, scenes), playlists, and, in
  Cyberpunk RED, real items and mook NPCs.
- **Preview:** shows what each entry becomes, whether it's new, replaces an earlier import or is
  kept, and which image each scene gets.
- **Campaign check:** finds broken links, unconnected NPCs, unused items, unvisited locations and
  missing fields, with a **Copy fix prompt** for NotebookLM.
- **Replacing and re-linking:** `replaces:` entries update documents in place, keeping their ids.
  Later builds link earlier imports to anything new.
- **Summary:** shows what was built and skipped, with a button to activate the build's first scene.
- **Tolerant parsing:** copying out of NotebookLM is cleaned up (code fences, citations, escapes,
  bold or bulleted field lines).

### Scenes

- **Scenes:** locations and scenes with an image become gridless scenes sized to the image. Story
  scenes are numbered and sorted by session.
- **Scene setup:** hidden tokens for the NPCs present, a pin that opens the journal, and the scene's
  `soundtrack` playlist. Re-imports update only what the toolkit placed.
- **Scene images:** free generation for scenes without an image, through Pollinations (no account)
  or your own Cloudflare Workers AI Worker (FLUX.1 schnell), or Gemini's *Nano Banana* models on
  an API key with billing (a key without billing gets a clear message instead). A review window
  lets you regenerate, edit prompts and leave images out, and an optional setting keeps everything
  without review.

### Music

- **YouTube playlists:** tracks play for everyone through YouTube's visible embedded player, synced
  with Foundry's playlist controls. Nothing is downloaded.
- **YouTube track picker** (Playlists sidebar): searches with your YouTube Data API key. With a
  Gemini key, Gemini suggests searches and real tracks, checked on YouTube.
- **Auto-pick:** fills new playlists during a build, stops cleanly when the daily quota runs out,
  and avoids repeating tracks across playlists.

### GM Assistant

- **GM Assistant** (Journal sidebar, or `/gm <question>` in chat): a Gemini chat with the whole
  campaign as context. Answers link to campaign documents, and new content comes as entries with a
  **Build campaign** button.
- **Pictures:** "Draw a portrait of Rook", or the **Image** button. Gemini writes the prompt from
  the campaign and the scene image generator draws it. Pictures can be saved, or set as an actor's
  portrait and token or a scene's background.
- **Sources:** a Foundry folder of rulebooks and notes, synced to Gemini File Search. Answers search
  them and cite what they used, with PDF page numbers.

### Combat

- **Attack resolution** in Cyberpunk RED:
  - Ranged attacks are checked against the range DV, from the weapon's DV table and the distance
    between the tokens. NPCs with REF 8+ dodge when it's their better chance.
  - In melee, targeted NPCs roll Evasion automatically, and player characters are asked to roll it.
  - The defender wins ties. A Combat card shows the result, with Hit and Miss buttons for the GM.
- **Damage:** a damage roll confirms the hit, and is applied automatically to NPCs (optional for
  everyone) through the system's own Apply Damage.
- **Combat narration** by Gemini:
  - Misses are narrated straight away, and hits after damage, with the damage, Critical Injuries,
    armor and wound state.
  - Hits name the target's armor, its current SP (after ablation) and how much it stopped.
  - The narration knows the fire mode (single shot, aimed, autofire, thrown or melee) and any
    natural 10 or 1, and a target under REF 8 is never described dodging a bullet.
  - Changing a narrated miss into a hit, with the Hit button or by rolling damage, removes the miss's
    narration, so players don't read both.
  - NPCs react in their own voice, and NPC attackers taunt.
  - It follows the chat log and earlier narration, so lines and descriptions aren't repeated.

### Packing and campaign end

- **Pack campaign** (Compendium sidebar): packs the campaign into a Foundry Adventure, and can
  remove it from the world afterwards to start a new one.
- **NotebookLM prompt kit:**
  - Prompt 0 is a chat configuration with build mode (the default), playtest mode with reports and
    fixes, and the choice to scrap or continue when a campaign ends.
  - Prompts 1–8 write a complete Cyberpunk RED solo campaign.

### Cyberpunk RED

- **Items** are built on the closest core compendium item.
- **NPCs** get their role, stats, skills, HP, gear (equipped or installed), Humanity and EMP.
- **GM-only secret sections** are shown to owners on the system's sheets.

### Macros

- Import from NotebookLM, Toggle Selected Tokens Hidden, Token Info and Whisper Roll to GM for any
  system.
- Party Passive Perception for D&D 5e.
- Actor data inspectors for Cyberpunk RED and Sword World 2.5.
- **Roy's Declarations** and **Roy's History** (`macros/characters/`), a player's own macros for a
  game they don't host, on Foundry v12 and v13 in any system:
  - It asks what's happening, then Gemini writes a fresh line for Roy "Slayer" Belmont that fits
    the moment: a battle cry, an introduction or a victory quirk. The Gemini key is kept in that
    browser.
  - One-click moments for what comes up most: Melee miss and hit; Protect ally, Block attack, Light
    and Heavy wound; Heal ally, Heal self, After combat and Before rest; Half and Low HP, Half and
    Low MP; Resting, Eating, Preparing and Celebrating. Typed text is added as detail.
  - Targeted tokens are named, as the enemy, ally or attacker the moment calls for, or as ally or
    enemy by disposition for a typed moment. Moments about Roy alone leave them out. A target line
    shows who is targeted as it changes, and warns when no one is.
  - Gemini gets 45 seconds to answer.
  - One window that stays open: the line appears in it, with Copy words, Copy with action and
    Another line, ready for the next moment. Waiting, errors and "copied" show in the window, not in
    Foundry's notifications, and nothing is posted to chat, so no other user sees anything. The
    Gemini key is entered in the window too.
  - Roy's History lists every line, newest first, to search, copy again, star (starred lines are
    always kept; the rest keep the latest 300) or delete. It is kept in that browser. Export saves
    every line as a text file.
  - Lines keep Roy's holy, retribution-paladin tone, vary their focus and move names, and are sent
    back once if they call his power dark.
  - Install guide: [docs/macros/roy-declarations.md](docs/macros/roy-declarations.md).

### Fixed before release

From end-to-end testing:

- **Scene images:** Pollinations' free limit (one image per 45 seconds, `402 FREE_LIMIT`) is waited
  out instead of failing. A failed upload no longer records a missing image path.
- **Image review:** the window keeps your cursor while it updates, unticked images aren't generated,
  failures are counted separately, and the cards no longer stretch to the window's height.
- **Campaign check:** no longer flags rulebook gear or epilogues, and earlier copies of the same
  bundle no longer hide gaps.
- **Existing scenes** get their one-time setup, and overwrite updates, without their image being
  supplied again.
- **Playlist links** now resolve in journals. Empty input says so. The preview marks entries that
  already exist.
- **GM Assistant:**
  - Entries Gemini writes without a code block are shown as code, not as Markdown, and keep their
    line breaks.
  - The lite model is the default, because the full model could hang for minutes.
- **Sources:** syncing uploads the actual file (not Foundry's 404 page), and waits for each document
  to finish indexing.
- **Wording:** "1 gap", "1 entry" and similar now read correctly.

From the first live combat tests:

- **Combat narration:**
  - A natural 10 or 1 reached the Combat card but not the narration; now it reaches both.
  - A single shot was narrated as a burst, because the fire mode wasn't passed on.
  - A REF 6 target was narrated sidestepping bullets.
  - The hit detail said only how much damage got through. It named an armor's base SP, ignoring
    ablation, so damage estimates for targets whose damage isn't applied automatically came out
    too low.
- **Roy's Declarations:** lines from the built-in bank often didn't suit the moment, so the bank, the
  menu of kinds and the click shortcuts are gone: every line is written by Gemini for what's
  happening. Posting to chat is gone too, so the player no longer juggles roll modes to preview a
  line.
- **Roy's Declarations** windows closed after every click and messages went to Foundry's
  notifications; it is now one window that stays open and keeps its messages inside. Saving an
  empty key field no longer removes the key: there is a Remove button for that.
- **Roy's Declarations:** lines kept calling Roy "the SlayArm", a title left over from the old
  built-in lines that isn't in his notebook. It's gone from his profile, which now names his right
  arm the way the notebook does: the Sacred Crusher, or his crushing arm.
- **Roy's Declarations:** the party came from the old built-in lines too, with one line each and a
  "Clusti" who isn't in the party. The party is now Keira, Maeve, Urist and Ùna, described from the
  notebook with only what Roy knows so far, and Roy treats everyone but Keira as companions he has
  just met. He still calls them the Slayer's Fellowship, a name he proclaimed to the Adventurer's
  Guild that no one agreed to or corrected. His profile also has his adventurer handle, Slayer,
  which he uses in the heat of combat and with NPCs he doesn't trust.
- **Roy's Declarations:** a line called Roy's weapon a blade. His weapon is now one `WEAPON` setting
  (his mace, the Star of Retribution), which Gemini is told is his only weapon, and which the
  profile and melee moments follow when it changes.

See [docs/user-guide.md](docs/user-guide.md#known-issues-and-limitations) for known issues.
