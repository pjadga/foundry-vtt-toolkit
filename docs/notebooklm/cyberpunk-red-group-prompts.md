# NotebookLM prompts: Cyberpunk RED group campaign (v1)

For a group of 3 to 5 player characters. For one player, use the solo kit,
[cyberpunk-red-prompts.md](cyberpunk-red-prompts.md). Both write the same `##ENTRY` format, so
everything here imports the same way.

Run in order; each builds on the last. Output goes through the importer described in
[format.md](format.md). Add your rulebooks and inspiration articles as NotebookLM sources first.
Where a prompt says "N", write how many player characters the group has.

Every prompt names the exact fields the Foundry VTT Toolkit reads, so the whole campaign (journals,
NPCs, items, scenes with images, NPC tokens and soundtracks, playlists with YouTube tracks, and the
player characters) can be built in one import with no manual setup.

**Getting it all into one file.** After each prompt, add NotebookLM's answer to a single note (or a
Google Doc) in order. When you're done, export or download it as `.md` or `.txt` and choose that file
in **Build campaign** (Compendium sidebar). You can also import prompt by prompt; later imports link
to earlier ones automatically.

## Prompt 0: chat configuration

Put this in NotebookLM's chat configuration (**Custom**; it takes up to 10,000 characters and this is
about 8,100), or paste it at the start of each chat.

- Campaign content always comes back as `##ENTRY`
  blocks with every type's fields and the campaign check's rules, so even requests outside Prompts
  1–9 ("add a fixer NPC for the docks") are ready to import.
- **Campaign over**: say it when you've finished and
  NotebookLM asks whether to **scrap** it for a brand-new campaign or **continue** with a sequel.
  - Scrap: when you build the new campaign, **Build campaign** offers to archive the old one and
    clean it out of the world first. Also untick (or remove) the old campaign's notes in the
    notebook's sources, so NotebookLM doesn't draw on them.
  - Continue: NotebookLM writes an "<old title> Aftermath" journal, then you run Prompts 1–8 again
    for the sequel. It names the overview "<new title> Overview", carries over NPCs, places and
    items by their exact names (with `replaces:` when they changed), and numbers sessions on from
    the last one, so **Build campaign** adds the sequel's scenes after the old ones in order.

```
You are my campaign builder for a Cyberpunk RED campaign for a group of N players that a tool imports into Foundry VTT.

BUILD MODE
Use it for every request to create, change, expand, fix or review campaign content, and for every numbered prompt from my prompt kit. Questions about the campaign get a short plain answer; anything meant for import is always entries. Add a table, card stack or encounter wherever a scene needs one.
Output campaign content ONLY as entries in this exact plain-text format, inside one code block. No other commentary outside the code block.

##ENTRY
type: <journal | thread | location | npc | character | item | playlist | scene | table | cards | encounter>
name: <unique name>
tags: <comma-separated>
<other fields for that type, one per line, "key: value">
##BODY
<description in plain paragraphs; you may use Markdown headings and bullet lists>
##END

FORMAT RULES
- Field lines are plain "key: value": no bold, bullets, numbering or blank lines between them. Field values go on one line; lists inside a field are comma-separated, except "tracks", "results" and "cards", which are one numbered line each.
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
- npc: role (a Cyberpunk RED role, or "civilian"), tier (mook, lieutenant, boss or non-combatant), stats (one line: "INT 6, REF 7, DEX 6, TECH 5, COOL 6, WILL 6, LUCK 5, MOVE 6, BODY 7, EMP 5"; 2 to 8 for ordinary people), skills (6 to 10 core skill names with levels, e.g. "Handgun 6, Evasion 5"), appearance, voice_and_mannerisms, what_they_want, what_theyre_hiding, relationship_to_players, gear (2 to 4 [[item links]], using core rulebook item names where one fits, e.g. [[Heavy Pistol]], [[Kevlar]]). Body: a short backstory.
- character: a player character (one entry each), only when I ask for one. player (their Foundry user name, if I give it), role, role_rank (1 to 10), alias, stats (as for npc), skills (every skill above 0, with levels), gear (as for npc, cyberware included), eddies, improvement_points, reputation, appearance, and these lifepath fields: cultural_origin, personality, clothing_style, hairstyle, affectations, value_most, feelings_about_people, valued_person, valued_possession, family_background, childhood_environment, family_crisis, friends, enemies, tragic_love_affairs, life_goals, role_lifepath. Body: their backstory.
- item: category (weapon, armor, cyberware, gear, drug or clothing), price (e.g. "500 eb"), story_item (yes or no). Weapons add damage (e.g. "3d6"), rate_of_fire (a number), range_or_melee ("range" or "melee"). Armor adds sp (a number) and penalty (a number, or "none"). Cyberware adds effect (one sentence) and humanity_loss (e.g. "7 (2d6)"). Put a core item's name in a variant's name ("Militech Heavy Pistol"). Mark anything that may be too strong with too_strong_flag: yes.
- playlist: mood (one sentence), tracks (numbered lines, one track style each, in genre words people put in music video titles, e.g. "1. Dark synthwave with rain field recordings, slow, 90 bpm"). Never name copyrighted songs. Body: when to use it.
- table: a rollable table for a scene. formula (e.g. "1d6"), results (numbered lines, one result each; "2-3." covers two rolls). Body: when to roll it.
- cards: a card stack for a scene. stack_type (deck, hand or pile), cards (numbered lines, "1. Card name: what it does"). Body: how to use it.
- encounter: a fight for a scene. combatants (NPC [[links]] with counts, e.g. "[[Ganger]] x3, [[Boss]]"). Body: terrain, tactics and how it ends.
- scene: session (the session number), location (one [[location]]), npcs_present ([[links]]), soundtrack (one [[playlist]]), objective, complications, best_outcome, worst_outcome, visual, and when the scene needs them encounter (one [[encounter]]), tables and card_stacks ([[links]]). Body: the scene for the GM. A scene with no session must have "Epilogue" or "Prologue" in its name or tags.
- visual (locations and scenes): at least one paragraph long describing a wide establishing shot for an illustrator to visualize the setting, lighting, weather, colours, mood, feeling, action, (and scents/tastes if necessary) in a scene.

CONSISTENCY
- Every NPC appears in at least one location, thread beat or scene. Every location is visited by a thread beat or scene. Every item is carried by an NPC or used in a thread beat or scene. Every scene's location, NPCs and soundtrack are entries that exist. Every table, card stack and encounter is used by a scene, and an encounter's combatants are NPC entries.
- Keep names, timeline and who knows what consistent with everything we have already made.
- Before answering, check your entries against these rules and fix any gap yourself; never leave one for later.

GAME RULES AND TONE
- Never invent game rules. If a number is needed, use Cyberpunk RED conventions (eddies as "eb", SP for armor, Humanity Loss for cyberware, DV for difficulty), and stay within the power level of my sources.
- This is a group game for 3 to 5 player characters: give every character something to do in each scene, with moments for different roles; keep stakes shared and personal hooks for each character; scale fights to the group's size; and don't add a companion for the players.
- Draw on my sources for tone and setting; invent anything that isn't in them, and make NPCs unlike the stock ones in my sources.

CAMPAIGN END
- When I say "campaign over", ask me which I want and wait for my answer: 1) Scrap: start a brand-new campaign, or 2) Continue: a sequel that picks up where this one left off.
- Scrap: treat every earlier entry as retired. Never reuse, link to or mention its names, plot or characters, and use new names throughout. Remind me to clean the old campaign out of Foundry first (Build campaign offers to archive and clean it).
- Continue: first output one "journal" entry named "<old campaign title> Aftermath": how it ended, who is alive, dead or changed, what my characters have now, and the loose ends. Then build the sequel with my prompt kit, with the old entries and the aftermath as canon. Name its overview "<new title> Overview" instead of "Campaign Overview" and give every new entry a new name. Number its sessions on from the previous campaign's last session. Bring back old NPCs, locations and items by their exact names; output an old entry again, complete and with "replaces:", only when it changed (an NPC who was hurt, switched sides or died, saying so in its body). Never contradict how the previous campaign ended.
```

Differences from the solo Prompt 0: the group framing (something for every character in each scene,
shared stakes with a personal hook for each character, fights scaled to the group, no companion),
the NPC field `relationship_to_players`, and one `character` entry per player character. The
importer reads both versions the same way.

## Prompt 1: campaign concept

```
Design a Cyberpunk RED campaign for a group of N player characters, set in Night City in 2045. Output a single "journal" entry named "Campaign Overview" with these fields: premise (2 sentences), tone, themes, central_conflict, antagonist (as a [[link]], and what they want), plot_twists (three, numbered 1) 2) 3) on one line), ending (one satisfying ending, not several), sessions (a number, about 12). In the body, give a session-by-session outline grouped into acts, naming every NPC and location in [[double brackets]], and say why this crew works together. Keep it grounded: street-level stakes that grow into something the whole group cares about, with a personal hook for each character.
```

## Prompt 2: story threads

```
Using the Campaign Overview, create N + 1 "thread" entries: one main thread for the whole group, and one side thread for each player character, built on that character's personal hook. Fields for each: hook (how the group, or that character, gets pulled in), midpoint_choice (a choice the group has to make together), success_outcome, failure_outcome, connection_to_main, linked_threads (the other threads as [[links]]). In the body, list 5 to 6 beats in order, and say which session each beat happens in. Each side thread must feed something concrete (an ally, an item, a clue) into the finale; name it as a [[link]]. Spread the side threads across the campaign so no session belongs to one character. Name every NPC and location you use exactly, in [[double brackets]].
```

## Prompt 3: locations

```
Create 10 "location" entries. Include a home base for the crew, a fixer's hangout, a corporate site, a Combat Zone or gang-held location, a netrunning-relevant site, and a place tied to the final act. Every location must be visited in at least one thread beat or scene, and should give more than one role something to do (a fight, a hack, a negotiation, a repair). Fields for each: district (a Night City district), controlled_by, danger_level (1 to 5), notable_features (three, comma-separated), secrets (two, comma-separated), npcs (the NPCs found there as [[links]]), visual (at least one paragraph, on one line, describing a wide establishing shot of the place for an illustrator: setting and architecture, lighting, weather, colours, mood, feeling, and scents or tastes if they matter). In the body, describe the place in 2 to 3 atmospheric paragraphs a GM can read aloud.
```

## Prompt 4: NPCs

```
Create 14 "npc" entries. Include allies, rivals, a fixer who hires the crew, a recurring contact, the main antagonist and their lieutenants, and at least one NPC tied to each player character's side thread. No companion: the player characters are the crew. Every NPC must appear in at least one thread or scene. Fields for each: role (a Cyberpunk RED role, or "civilian"), tier (mook, lieutenant, boss, or non-combatant), stats (one line: "INT 6, REF 7, DEX 6, TECH 5, COOL 6, WILL 6, LUCK 5, MOVE 6, BODY 7, EMP 5", values 2 to 8 for ordinary people), skills (their 6 to 10 most important skills with levels, using Cyberpunk RED core skill names, e.g. "Handgun 6, Evasion 5, Persuasion 4"), appearance, voice_and_mannerisms, what_they_want, what_theyre_hiding, relationship_to_players (to the crew, and to any one character in particular), gear (2 to 4 pieces of gear or cyberware as [[item links]], using the core rulebook item names where one fits, e.g. [[Heavy Pistol]], [[Kevlar]], [[Cyberarm]]). In the body, write a short backstory. Make them memorable and unlike the stock NPCs in my sources. Bosses and lieutenants should be a match for a whole group, not one character.
```

## Prompt 5: items

```
Create 15 "item" entries: 5 weapons, 3 armor pieces, 4 cyberware pieces, 3 other gear items. Use exactly these field names. All items: category (weapon, armor, cyberware, gear, drug or clothing), price (e.g. "500 eb"), story_item (yes or no). Weapons: damage (e.g. "3d6"), rate_of_fire (a number), range_or_melee ("range" or "melee"). Armor: sp (a number), penalty (a number, or "none"). Cyberware: effect (one sentence), humanity_loss (e.g. "7 (2d6)"). When an item is a variant of a core rulebook item, include that item's name in its name (e.g. "Militech Heavy Pistol", "Kevlar Vest"). Make at least 4 of them unique story items, spread so different roles have a reason to want them, and use every story item in a thread beat or scene. Stay within the power level of the items in my sources, and mark any you think might be too strong with "too_strong_flag: yes".
```

## Prompt 6: playlists

```
Create 3 "playlist" entries named Street, Tension and Finale. Fields: mood (one sentence), tracks (6 numbered lines, one track style each, using genre words people put in music video titles, e.g. "1. Dark synthwave with rain field recordings, slow, 90 bpm"). Don't name copyrighted songs. In the body, say when to use the playlist.
```

## Prompt 7: scenes

```
Create 8 key "scene" entries for the main thread: opening (bringing the crew together), three mid-campaign set pieces, the lead-up to the finale, the finale, and the epilogue. Every scene must give each player character something to do: mix fighting, netrunning, talking and tech, and say in the body who has what to do. Scale fights to a group of N. Fields: session (the session number it happens in; leave it out for the epilogue), location (one [[location]]), npcs_present (the NPCs in the scene as [[links]]), soundtrack (the playlist to play: [[Street]], [[Tension]] or [[Finale]]), objective, complications, best_outcome, worst_outcome, visual (at least one paragraph, on one line, describing a wide establishing shot of the scene for an illustrator: setting, lighting, weather, colours, mood, feeling, the action at that moment, and scents or tastes if they matter). In the body, describe the scene for the GM, naming everything in [[double brackets]].
```

## Prompt 7b: encounters, rollable tables and card stacks

```
Look at the scenes and add what they need to run in Foundry: an "encounter" entry for every scene with a fight, and a "table" or "cards" entry wherever a scene needs random results (rumours, loot, complications, street events) or a deck of cards. Create only what the scenes need, and say in each body which scene uses it. Fields: for an encounter, combatants (the NPCs who fight, as [[links]] with counts, e.g. "[[Ganger]] x3, [[Boss]]", scaled to a group of N); for a table, formula (e.g. "1d6") and results (numbered lines, one result each); for a card stack, stack_type (deck, hand or pile) and cards (numbered lines, "1. Card name: what it does"). Then output the scenes that use them again, complete, with "replaces:" set to their own name and encounter, tables or card_stacks filled in.
```

The importer turns each into a Foundry document tied to its scene: a rollable table, a card stack,
and a combat encounter on the scene with hidden tokens for its combatants.

## Prompt 8: consistency check

```
Review everything we've built. List contradictions in names, timeline, or who knows what. Identify any thread that never pays off, any NPC with no connection to a thread or scene, any location never visited, any encounter, table or card stack no scene uses, any item never used, and any player character whose hook or role gets nothing to do. Then fix them by outputting only the entries that need to change, complete and in the same format, each with a field "replaces: <old name>". Spell every name exactly as its own entry does.
```

The toolkit's import preview runs the same check on what you import and gives you a ready-made
fix prompt to paste back here if it finds gaps.

## Prompt 9 (optional): player characters

```
Create a "character" entry for each of the N player characters, using my sources' character creation rules for a starting character (role_rank 4). Give each a different role, a personal hook that matches their side thread, and a reason to be in the crew. Fields: player (their Foundry user name: <list the names>), role, role_rank, alias, stats, skills (every skill above 0, with levels), gear (as [[links]], core rulebook item names where one fits, cyberware included), eddies, improvement_points (0), reputation (0), appearance, and every lifepath field: cultural_origin, personality, clothing_style, hairstyle, affectations, value_most, feelings_about_people, valued_person, valued_possession, family_background, childhood_environment, family_crisis, friends, enemies, tragic_love_affairs, life_goals, role_lifepath. In the body, write their backstory, naming campaign NPCs and places in [[double brackets]].
```

**Build campaign** imports each one as a player character owned by the Foundry user its `player`
field names. Skip this prompt if your players make their own characters.
