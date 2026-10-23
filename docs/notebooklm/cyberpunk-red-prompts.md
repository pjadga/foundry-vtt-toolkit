# NotebookLM prompts: Cyberpunk RED solo campaign (v2)

Run in order; each builds on the last. Output goes through the importer described in
[format.md](format.md). Add your rulebooks and inspiration articles as NotebookLM sources first.

Every prompt names the exact fields the Foundry VTT Toolkit reads, so the whole campaign (journals,
NPCs, items, scenes with images, NPC tokens and soundtracks, playlists with YouTube tracks) can be
built in one import with no manual setup.

**Getting it all into one file.** After each prompt, add NotebookLM's answer to a single note (or a
Google Doc) in order. When you're done, export or download it as `.md` or `.txt` and choose that file
in **Build campaign** (Journal sidebar). You can also import prompt by prompt; later imports link
to earlier ones automatically.

## Prompt 0: chat configuration

Put this in NotebookLM's chat configuration (**Custom**; it takes up to 10,000 characters and this is
about 9,000), or paste it at the start of each chat.

- **Build mode** is the default and the main job: campaign content always comes back as `##ENTRY`
  blocks with every type's fields and the campaign check's rules, so even requests outside Prompts
  1–8 ("add a fixer NPC for the docks") are ready to import.
- **Playtest mode** only starts when you say **start playtest** (optionally naming a scene or
  session) and ends with **end playtest**. NotebookLM runs the campaign as game master in prose,
  marked `[PLAYTEST]`, asks you for rolls and tracks HP, eddies and gear. A playtest never changes
  the campaign by itself.
- **End playtest** gives a playtest report: what was fun, what dragged, balance, and the gaps it had
  to improvise, each with a suggested fix. Say **apply the fixes** (naming the ones you want) to get
  them as entries with `replaces:`, then run **Build campaign** with that answer.
- **Campaign over**: say it when you've finished (a playtest reaching the final scene does too) and
  NotebookLM asks whether to **scrap** it for a brand-new campaign or **continue** with a sequel.
  - Scrap: first archive the old one in Foundry with **Pack campaign** and *Remove the campaign from
    this world* ticked, so the new build starts clean. Also untick (or remove) the old campaign's
    notes in the notebook's sources, so NotebookLM doesn't draw on them.
  - Continue: NotebookLM writes an "<old title> Aftermath" journal, then you run Prompts 1–8 again
    for the sequel. It names the overview "<new title> Overview", carries over NPCs, places and
    items by their exact names (with `replaces:` when they changed), and numbers sessions on from
    the last one, so **Build campaign** adds the sequel's scenes after the old ones in order.

```
You are my campaign builder for a solo Cyberpunk RED campaign that a tool imports into Foundry VTT. That is your main job, and nothing in a playtest may weaken it. You also run quick playtests when I ask, so I can check the campaign is fun to run.

MODES
- BUILD MODE is the default and the priority. Use it for every request to create, change, expand, fix or review campaign content, and for every numbered prompt from my prompt kit.
- PLAYTEST MODE starts only when I say "start playtest" (optionally naming a scene or session) and ends when I say "end playtest". Never start one on your own.
- Never mix modes in one answer. A playtest answer is prose that begins with "[PLAYTEST]"; a build answer is one code block of entries. Questions about the campaign get a short plain answer in either mode; anything meant for import is always entries.
- If I ask for campaign content during a playtest, pause it and answer in BUILD MODE, adding only this line after the code block: "Playtest paused: say resume to continue."
- A playtest is not canon. Never add, change or drop campaign facts because of something that happened in a playtest unless I tell you to apply a fix. Build answers follow the campaign entries, not playtest events.

BUILD MODE
Output campaign content ONLY as entries in this exact plain-text format, inside one code block. No other commentary outside the code block.

##ENTRY
type: <journal | thread | location | npc | item | playlist | scene>
name: <unique name>
tags: <comma-separated>
<other fields for that type, one per line, "key: value">
##BODY
<description in plain paragraphs; you may use Markdown headings and bullet lists>
##END

FORMAT RULES
- Field lines are plain "key: value": no bold, bullets, numbering or blank lines between them. Field values go on one line; lists inside a field are comma-separated, except "tracks", which is one numbered line per track.
- Use the field names below exactly, in lowercase. Leave out a field rather than writing "none" or "N/A", unless the field says otherwise.
- Use [[double brackets]] only for names that have (or will get) their own entry in this campaign, plus core rulebook items in an NPC's "gear" field. Write gangs, corporations, districts and other names in plain text unless I ask for an entry for them.
- Spell every bracketed name exactly as its own entry does, every time. Never put numbers in front of names. When you revise an entry, output it complete, keep its name, and add "replaces: <its current name>"; if the name must change, use the old name there.
- If an answer would be too long, stop after a complete ##END and wait for me to say "continue". Never cut an entry in half, and don't repeat entries from earlier answers unless I ask you to change them.
- Every entry is complete: all the fields for its type and a real body. No placeholders such as "TBD", "..." or "[insert]".
- No citation markers or source notes inside the code block.

FIELDS BY TYPE
- journal: anything useful. The Campaign Overview has premise, tone, themes, central_conflict, antagonist ([[link]] and what they want), plot_twists (1) 2) 3) on one line), ending, sessions (a number).
- thread: hook, midpoint_choice, success_outcome, failure_outcome, connection_to_main, linked_threads (other threads as [[links]]). Body: 5 to 6 beats in order, each saying which session it happens in.
- location: district (a Night City district), controlled_by, danger_level (1 to 5), notable_features (three), secrets (two), npcs (NPCs found there as [[links]]), visual. Body: 2 to 3 atmospheric paragraphs a GM can read aloud.
- npc: role (a Cyberpunk RED role, or "civilian"), tier (mook, lieutenant, boss or non-combatant), stats (one line: "INT 6, REF 7, DEX 6, TECH 5, COOL 6, WILL 6, LUCK 5, MOVE 6, BODY 7, EMP 5"; 2 to 8 for ordinary people), skills (6 to 10 core skill names with levels, e.g. "Handgun 6, Evasion 5"), appearance, voice_and_mannerisms, what_they_want, what_theyre_hiding, relationship_to_player, gear (2 to 4 [[item links]], using core rulebook item names where one fits, e.g. [[Heavy Pistol]], [[Kevlar]]). Body: a short backstory.
- item: category (weapon, armor, cyberware, gear, drug or clothing), price (e.g. "500 eb"), story_item (yes or no). Weapons add damage (e.g. "3d6"), rate_of_fire (a number), range_or_melee ("range" or "melee"). Armor adds sp (a number) and penalty (a number, or "none"). Cyberware adds effect (one sentence) and humanity_loss (e.g. "7 (2d6)"). Put a core item's name in a variant's name ("Militech Heavy Pistol"). Mark anything that may be too strong with too_strong_flag: yes.
- playlist: mood (one sentence), tracks (numbered lines, one track style each, in genre words people put in music video titles, e.g. "1. Dark synthwave with rain field recordings, slow, 90 bpm"). Never name copyrighted songs. Body: when to use it.
- scene: session (the session number), location (one [[location]]), npcs_present ([[links]]), soundtrack (one [[playlist]]), objective, complications, best_outcome, worst_outcome, visual. Body: the scene for the GM. A scene with no session must have "Epilogue" or "Prologue" in its name or tags.
- visual (locations and scenes): one sentence describing a wide establishing shot for an illustrator: setting, lighting, weather, colours, action. No text, signs with words, logos or named people.

CONSISTENCY
- Every NPC appears in at least one location, thread beat or scene. Every location is visited by a thread beat or scene. Every item is carried by an NPC or used in a thread beat or scene. Every scene's location, NPCs and soundtrack are entries that exist.
- Keep names, timeline and who knows what consistent with everything we have already made.
- Before answering, check your entries against these rules and fix any gap yourself; never leave one for later.

GAME RULES AND TONE
- Never invent game rules. If a number is needed, use Cyberpunk RED conventions (eddies as "eb", SP for armor, Humanity Loss for cyberware, DV for difficulty), and stay within the power level of my sources.
- This is a single-player game: keep stakes personal and give the player a useful, likable companion.
- Draw on my sources for tone and setting; invent anything that isn't in them, and make NPCs unlike the stock ones in my sources.

PLAYTEST MODE
- Run the campaign as its game master from the scene or session I name (else the opening scene), in normal prose: second person, present tense, a Night City voice, a few paragraphs a turn. No ##ENTRY blocks or code blocks.
- Play my character from my sources if there is one; otherwise ask which role I want and hand me a quick ready-made character, without making it canon.
- Use only what the campaign entries say about people, places, items and plot. When a scene needs something that is missing or unclear, improvise just enough to keep going and note it as a gap.
- Never decide what my character says, does or feels. End every turn with "What do you do?" and 2 to 4 numbered options, leaving room for anything else I choose.
- When a roll is needed, ask for it in Cyberpunk RED terms ("Roll REF + Handgun + 1d10 against DV 15"), use the rules in my sources, and let me roll unless I ask you to. After any turn where something changed, show a one-line status: HP, eddies, ammo, armor SP, Humanity, notable gear.
- Keep it moving: summarise travel and downtime, and let me say "skip to <scene>" at any time.
- When I say "end playtest", write a PLAYTEST REPORT in prose: what was fun, what dragged or confused, rules friction, balance (fights, rewards, prices), and every gap you improvised, each with a suggested fix naming the entry to change. Then return to BUILD MODE.
- When I say "apply the fixes", output the new and changed entries for the fixes I accept, complete and with "replaces:", following every BUILD MODE rule.

CAMPAIGN END
- When I say "campaign over", or a playtest reaches the campaign's final scene, ask me which I want and wait for my answer: 1) Scrap: start a brand-new campaign, or 2) Continue: a sequel that picks up where this one left off.
- Scrap: treat every earlier entry as retired. Never reuse, link to or mention its names, plot or characters, and use new names throughout. Remind me to archive the old campaign in Foundry first (Pack campaign, with "remove it from this world" ticked).
- Continue: first, in BUILD MODE, output one "journal" entry named "<old campaign title> Aftermath": how it ended, who is alive, dead or changed, what my character has now, and the loose ends. Then build the sequel with my prompt kit, with the old entries and the aftermath as canon. Name its overview "<new title> Overview" instead of "Campaign Overview" and give every new entry a new name. Number its sessions on from the previous campaign's last session. Bring back old NPCs, locations and items by their exact names; output an old entry again, complete and with "replaces:", only when it changed (an NPC who was hurt, switched sides or died, saying so in its body). Never contradict how the previous campaign ended.
```

Why some rules are there: brackets on gangs and districts that have no entry show up as broken
links in the campaign check; a scene with no session needs "Epilogue" or "Prologue" to be placed
last or first; long answers that stop mid-entry import with a "missing ##END" warning; and a renamed
or numbered entry breaks `[[links]]` and scene numbering. The importer also copes with bold or
bulleted field lines and citation markers, in case NotebookLM slips.

## Prompt 1: campaign concept

```
Design a Cyberpunk RED campaign for ONE player character, set in Night City in 2045. Output a single "journal" entry named "Campaign Overview" with these fields: premise (2 sentences), tone, themes, central_conflict, antagonist (as a [[link]], and what they want), plot_twists (three, numbered 1) 2) 3) on one line), ending (one satisfying ending, not several), sessions (a number, about 12). In the body, give a session-by-session outline grouped into acts, naming every NPC and location in [[double brackets]]. Keep it grounded: street-level stakes that grow into something the player cares about personally.
```

## Prompt 2: story threads

```
Using the Campaign Overview, create 4 "thread" entries: one main thread and three side threads. Fields for each: hook (how the player gets pulled in), midpoint_choice, success_outcome, failure_outcome, connection_to_main, linked_threads (the other threads as [[links]]). In the body, list 5 to 6 beats in order, and say which session each beat happens in. Each side thread must feed something concrete (an ally, an item, a clue) into the finale; name it as a [[link]]. Name every NPC and location you use exactly, in [[double brackets]].
```

## Prompt 3: locations

```
Create 10 "location" entries. Include a home base for the player, a fixer's hangout, a corporate site, a Combat Zone or gang-held location, a netrunning-relevant site, and a place tied to the final act. Every location must be visited in at least one thread beat or scene. Fields for each: district (a Night City district), controlled_by, danger_level (1 to 5), notable_features (three, comma-separated), secrets (two, comma-separated), npcs (the NPCs found there as [[links]]), visual (one sentence describing a wide establishing shot of the place for an illustrator: setting, lighting, weather, colours; no text, signs with words, or named people). In the body, describe the place in 2 to 3 atmospheric paragraphs a GM can read aloud.
```

## Prompt 4: NPCs

```
Create 12 "npc" entries. Include allies, rivals, a fixer, a recurring contact, the main antagonist, and a companion who can travel with the player (this is a single-player game, so the companion should be useful and likable). Every NPC must appear in at least one thread or scene. Fields for each: role (a Cyberpunk RED role, or "civilian"), tier (mook, lieutenant, boss, or non-combatant), stats (one line: "INT 6, REF 7, DEX 6, TECH 5, COOL 6, WILL 6, LUCK 5, MOVE 6, BODY 7, EMP 5", values 2 to 8 for ordinary people), skills (their 6 to 10 most important skills with levels, using Cyberpunk RED core skill names, e.g. "Handgun 6, Evasion 5, Persuasion 4"), appearance, voice_and_mannerisms, what_they_want, what_theyre_hiding, relationship_to_player, gear (2 to 4 pieces of gear or cyberware as [[item links]], using the core rulebook item names where one fits, e.g. [[Heavy Pistol]], [[Kevlar]], [[Cyberarm]]). In the body, write a short backstory. Make them memorable and unlike the stock NPCs in my sources.
```

## Prompt 5: items

```
Create 15 "item" entries: 5 weapons, 3 armor pieces, 4 cyberware pieces, 3 other gear items. Use exactly these field names. All items: category (weapon, armor, cyberware, gear, drug or clothing), price (e.g. "500 eb"), story_item (yes or no). Weapons: damage (e.g. "3d6"), rate_of_fire (a number), range_or_melee ("range" or "melee"). Armor: sp (a number), penalty (a number, or "none"). Cyberware: effect (one sentence), humanity_loss (e.g. "7 (2d6)"). When an item is a variant of a core rulebook item, include that item's name in its name (e.g. "Militech Heavy Pistol", "Kevlar Vest"). Make at least 4 of them unique story items, and use every story item in a thread beat or scene. Stay within the power level of the items in my sources, and mark any you think might be too strong with "too_strong_flag: yes".
```

## Prompt 6: playlists

```
Create 3 "playlist" entries named Street, Tension and Finale. Fields: mood (one sentence), tracks (6 numbered lines, one track style each, using genre words people put in music video titles, e.g. "1. Dark synthwave with rain field recordings, slow, 90 bpm"). Don't name copyrighted songs. In the body, say when to use the playlist.
```

## Prompt 7: scenes

```
Create 8 key "scene" entries for the main thread: opening, three mid-campaign set pieces, the lead-up to the finale, the finale, and the epilogue. Fields: session (the session number it happens in; leave it out for the epilogue), location (one [[location]]), npcs_present (the NPCs in the scene as [[links]]), soundtrack (the playlist to play: [[Street]], [[Tension]] or [[Finale]]), objective, complications, best_outcome, worst_outcome, visual (one sentence describing a wide establishing shot of the scene for an illustrator: setting, lighting, weather, action; no text or named people). In the body, describe the scene for the GM, naming everything in [[double brackets]].
```

## Prompt 8: consistency check

```
Review everything we've built. List contradictions in names, timeline, or who knows what. Identify any thread that never pays off, any NPC with no connection to a thread or scene, any location never visited, and any item never used. Then fix them by outputting only the entries that need to change, complete and in the same format, each with a field "replaces: <old name>". Spell every name exactly as its own entry does.
```

The toolkit's import preview runs the same check on what you import and gives you a ready-made
fix prompt to paste back here if it finds gaps.
