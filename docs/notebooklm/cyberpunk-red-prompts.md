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

## Prompt 0: output format

Put this in NotebookLM's chat custom instructions (or paste it at the start of each chat).

```
Whenever I ask you to create campaign content, output it ONLY as entries in this exact plain-text format, inside one code block. No commentary outside the code block.

##ENTRY
type: <journal | thread | location | npc | item | playlist | scene>
name: <unique name>
tags: <comma-separated>
<other fields for that type, one per line, "key: value", using exactly the field names I ask for>
##BODY
<description in plain paragraphs; you may use Markdown headings and bullet lists>
##END

Rules:
- Refer to other entries by their exact name in double brackets, e.g. [[Dex Morrow]], and spell names exactly the same way every time.
- Never invent game rules. If a number is needed, use Cyberpunk RED conventions (eddies as "eb", SP for armor, Humanity Loss for cyberware, DV for difficulty).
- Field values go on one line. Lists inside a field are comma-separated, except "tracks", which is one numbered line per track.
- Draw on my sources for tone and setting; invent anything that isn't in them.
```

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
