# Cyberpunk RED (`cpred`)

Foundry system id `cyberpunk-red-core`. Prompt kit: `docs/notebooklm/cyberpunk-red-prompts.md`, whose
Prompt 0 is the notebook's chat configuration and the authority on entry fields. Importer: NPC and item
entries become real actors and items (`module/scripts/systems/cpred.mjs`, `cpred-npc.mjs`,
`cpred-items.mjs`); everything else imports as journals, scenes and playlists.

## Digest checklist (stage 2)

Read these from the rulebook and note the page for each. Skip what the campaign doesn't need.

- **Stats and skills:** the ten stats and their usual range for ordinary people; the core skill names
  (NPCs must use them exactly); typical skill levels for a mook, lieutenant and boss.
- **Roles and role abilities:** the role names an NPC may have.
- **Combat:** damage by weapon type, rate of fire, armor SP and penalties, DVs (ranged DV tables), wound
  states. Enough to price a fight, not the whole chapter.
- **Items and prices:** the rulebook's weapon, armor, cyberware, drug and gear names with price in eb,
  so variants are named after real items ("Militech Heavy Pistol") and priced in line.
- **Cyberware:** humanity loss values and what cyberware does, so entries stay at the rulebook's power.
- **Setting:** 2045, the Time of the Red, Night City districts, gangs and corporations the campaign may
  use, and the tone the book sets.
- **The user's extra sources** (mission kits, DLC): their NPCs, scenarios and items, by the book's own
  names. A scenario in a mission kit is a source of scenes and NPCs to build on, not to copy.

## Entry types and fields

Use Prompt 0's FIELDS BY TYPE exactly (journal, thread, location, npc, item, playlist, scene), with its
format and consistency rules. The points a bible most often gets wrong:

- A `location` needs `visual:`; a `scene` needs `session`, `location`, `npcs_present`, `soundtrack` and
  `visual:` (an Epilogue or Prologue has no session).
- An NPC's `stats` is one line of all ten stats; `skills` use core skill names with levels; `gear` is
  2 to 4 `[[item]]` links, preferring core item names so the importer finds them in the system's
  compendium.
- Items: weapons have `damage`, `rate_of_fire`, `range_or_melee`; armor `sp` and `penalty`;
  cyberware `effect` and `humanity_loss`. Variants carry the core item's name.
- A campaign is for one player character: give them a likable companion and personal stakes.
- Three `playlist` entries (Street, Tension, Finale) with `tracks:` as genre words, never song names.

## Query list (stage 4)

Prompts 1 to 8 of the kit, in this order. For each, keep the kit's wording, then add one paragraph of
this campaign's canon from the bible (names to keep, what to deepen). Tell NotebookLM to **refine and
extend** the bible's entries, keeping names exactly and using `replaces:` on any it changes.

1. Campaign concept (the Campaign Overview journal)
2. Story threads
3. Locations
4. NPCs
5. Items
6. Playlists
7. Scenes
8. Consistency check

Add queries where the rulebook matters: for example "which weapons and cyberware in my sources fit this
NPC's tier" before the NPC and item queries, so those entries follow the books.

## Importer notes

- Build campaign previews with the campaign check, then generates scene images, imports everything,
  places NPC tokens and music, and gives a summary. The user does that in Foundry.
- NPC stats become the actor's stats; gear links are looked up in the system's compendium, so use core
  names where a core item fits.
