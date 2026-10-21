# NotebookLM prompts: Cyberpunk RED solo campaign

Run in order; each builds on the last. Output goes through the importer described in
[format.md](format.md). Add your rulebooks and inspiration articles as NotebookLM sources first.

## Prompt 0: output format

Put this in NotebookLM's chat custom instructions (or paste it at the start of each chat).

```
Whenever I ask you to create campaign content, output it ONLY as entries in this exact plain-text format, inside one code block. No commentary outside the code block.

##ENTRY
type: <journal | location | npc | item | thread | scene | playlist>
name: <unique name>
tags: <comma-separated>
<other fields for that type, one per line, "key: value">
##BODY
<description in plain paragraphs; you may use Markdown headings and bullet lists>
##END

Rules:
- Use exact names when referring to other entries so they can be linked, e.g. [[Dex Morrow]].
- Never invent game rules. If a number is needed, use Cyberpunk RED conventions (eddies as "eb", SP for armor, Humanity Loss for cyberware, DV for difficulty).
- Draw on my sources for tone and setting; invent anything that isn't in them.
```

## Prompt 1: campaign concept

```
Design a Cyberpunk RED campaign for ONE player character, set in Night City in 2045. Output as a single "journal" entry named "Campaign Overview" with these fields: premise (2 sentences), tone, themes, the central conflict, the main antagonist and what they want, three big plot twists, and the ending the story builds toward (give me one satisfying ending, not several). Aim for roughly 12 sessions. Keep it grounded: street-level stakes that grow into something the player cares about personally.
```

## Prompt 2: story threads

```
Using the Campaign Overview, create 4 story threads as "thread" entries: one main thread and three side threads. Each needs: hook (how the player gets pulled in), 5 to 6 beats in order, the choice the player faces at the midpoint, what happens if they succeed or fail, and how it connects back to the main thread. Give every thread a field "linked_threads". The side threads should each feed something concrete (an ally, an item, a clue) into the finale. Name every NPC and location you use exactly, in [[double brackets]].
```

## Prompt 3: locations

```
Create 10 locations as "location" entries for the campaign. Include a mix: a home base for the player, a fixer's hangout, a corporate site, a Combat Zone or gang-held location, a netrunning-relevant site, and a place tied to the final act. Fields for each: district (Night City districts), who controls it, danger level (1 to 5), 3 notable features, 2 secrets, and the NPCs found there as [[links]]. In the body, describe the place in 2 to 3 atmospheric paragraphs a GM can read aloud.
```

## Prompt 4: NPCs

```
Create 12 NPCs as "npc" entries. Include allies, rivals, a fixer, a recurring contact, the main antagonist, and a companion who can travel with the player (this is a single-player game, so the companion should be useful and likable). Fields for each: role (Cyberpunk RED role, or "civilian"), tier (mook, lieutenant, boss, or non-combatant), stats (one line: "INT 6, REF 7, DEX 6, TECH 5, COOL 6, WILL 6, LUCK 5, MOVE 6, BODY 7, EMP 5", values 2 to 8 for ordinary people), skills (one line of their 6 to 10 most important skills with levels, using Cyberpunk RED core skill names, e.g. "Handgun 6, Evasion 5, Persuasion 4"), appearance, voice and mannerisms, what they want, what they're hiding, their relationship to the player, and 2 to 4 pieces of gear or cyberware as [[item links]] using the item names from the Cyberpunk RED core rulebook where one fits (e.g. [[Heavy Pistol]], [[Kevlar]], [[Cyberarm]]). In the body, write a short backstory. Make them memorable and unlike the stock NPCs in my sources.
```

## Prompt 5: items

```
Create 15 items as "item" entries for the campaign: 5 weapons, 3 armor pieces, 4 cyberware pieces, 3 other gear items. Fields: category, price (in eb), and for the type: weapon (damage, rate of fire, range or melee), armor (SP, penalty), cyberware (effect, Humanity Loss). Make at least 4 of them unique story items with a history tied to a thread or NPC. Mark each with "story_item: yes/no". Stay within the power level of the items in my sources, and flag any you think might be too strong.
```

## Prompt 6: scenes and music

```
Create 8 key scenes as "scene" entries for the main thread: opening, three mid-campaign set pieces, the lead-up to the finale, the finale, and the epilogue. Fields: location as [[link]], NPCs present as [[links]], objective, complications, and the best and worst outcomes. Then create 3 "playlist" entries (street, tension, finale), each with a mood description and a list of 6 suggested track styles or genres, e.g. "dark synthwave, slow, 90 bpm". Don't name copyrighted songs.
```

## Prompt 7: consistency check

```
Review everything we've built. List contradictions in names, timeline, or who knows what. Identify any thread that never pays off, any NPC with no connection to a thread, and any item that is never used. Then fix them by outputting only the entries that need to change, in the same format, with a field "replaces: <old name>".
```
