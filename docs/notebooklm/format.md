# NotebookLM bundle format

The importer (`module/scripts/import/`) reads plain-text entries. NotebookLM is told to write them
by the custom instruction in [cyberpunk-red-prompts.md](cyberpunk-red-prompts.md) (Prompt 0).

```
##ENTRY
type: journal
name: Campaign Overview
tags: cyberpunk-red, campaign
premise: One line per field, "key: value".
sessions: 12
##BODY
Markdown body. Refer to other entries as [[Exact Name]].
##END
```

- `type` and `name` are required. `tags` is comma-separated. Any other `key: value` line becomes a
  field and is listed at the top of the journal page. Indented lines continue the previous field.
- `[[Name]]` becomes a link to the journal of that name (in the same paste, or already in the
  world). Matching ignores case, quotes, punctuation and a leading "The". Unknown names become bold
  text, and are linked automatically by a later import that adds them (unless the page was edited).
- Paste the text, or choose the `.md`/`.txt` file NotebookLM exports. Cleaned automatically: code
  fences, citations like `[1, 2-4]`, backslash escapes (`\#\#ENTRY`, `\[\[Name\]\]`), trailing spaces
  and HTML entities. If the line breaks were lost the importer says so; copy again from the code block.
- If an entry appears twice (NotebookLM repeats revised entries), the later copy is used.
- `replaces: <name>` (from the consistency-check prompt) replaces that existing document, keeping its
  id so links to it survive, even when "Replace ... that already exist" is not ticked. The entry's
  `name` becomes the document's name, so it can also rename. It is not shown as a field.

## Types

| `type` | Imported as | Folder |
| --- | --- | --- |
| `journal` | Journal entry | NotebookLM / Campaign |
| `location` | Journal entry | NotebookLM / Locations |
| `thread` | Journal entry | NotebookLM / Story Threads |
| `item` (Cyberpunk RED) | Item | NotebookLM / Items (Items) |
| `npc` (Cyberpunk RED) | Mook actor | NotebookLM / NPCs (Actors) |
| `npc` and `item` (other systems), `scene`, `playlist` | Not yet; listed as skipped | |

Items are imported before NPCs, so an NPC whose gear names an item in the same import gets that item.

### Cyberpunk RED items

The closest core compendium item of the same type is copied as a template (same matching as NPC
gear), so weapon type, skill, DV table and ammo stay valid; the entry's fields are applied on top.
With no match the item starts from the type's defaults. The template's book and page are cleared.

| Field | Used for |
| --- | --- |
| `category` | Item type: weapon, armor, cyberware, gear, drug, clothing, ammo, program, cyberdeck, vehicle, upgrade (else a tag naming one, else gear) |
| `price` | Market price (`"1,000 eb"` → 1000) |
| `damage`, `rate_of_fire`, `range_or_melee` | Weapon damage formula, ROF, ranged or melee (melee items without a template get the Melee Weapon skill) |
| `sp`, `penalty` | Body SP, or head SP when the name or tags say head/helmet; the system has one penalty number, so the largest given is used |
| `humanity_loss` | `"7 (2d6)"` → static 7, roll 2d6 |
| `effect`, body | Description |
| everything else (`story_item`, ...), `too_strong_flag: yes`, the template used | GM-only secret section of the description |

Armor cyberware such as Subdermal Armor is two items in this system (cyberware for Humanity Loss,
armor for SP); an NPC given the cyberware also gets the compendium armor of the same name.

**GM-only sections.** Cyberpunk RED's own sheets hide secret sections in the normal view for
everyone, GM included. With the toolkit enabled, sheets show them to users who own the document (the
GM, or a player viewing their own character), as Foundry's core sheets do; anyone else still sees the
field without them.

### Cyberpunk RED NPCs

Handled by `module/scripts/systems/cpred.mjs`; the pure rules are in `cpred-npc.mjs`.

| Field | Used for |
| --- | --- |
| `role` | Role item from the system's roles compendium, rank by tier; `civilian` adds none |
| `tier` | `non-combatant`, `mook`, `lieutenant` or `boss` (anything else counts as `mook`). Sets default stats, skill levels and role rank (see `TIERS`); these are toolkit defaults to adjust, not rulebook values |
| `stats` | `INT 6, REF 8, ...` overrides the tier defaults (clamped 1 to 10) |
| `skills` | `Handgun 6, Evasion 5` sets core skill levels; unknown skills are noted for the GM |
| `gear` | `[[links]]` matched to the system's core compendiums (exact name, body-armor names such as "Kevlar Vest", everyday terms such as "submachine gun", or a multi-word item name inside the gear name). Weapons and armor are equipped, cyberware installed. Unmatched gear is listed in the notes |
| `appearance`, `voice_and_mannerisms`, body | Notes on the sheet |
| everything else (`what_they_want`, `what_theyre_hiding`, ...) | A GM-only secret section of the notes |

The actor gets all core skills and core cyberware like a new mook. HP is 10 + 5 × ceil((BODY +
WILL) / 2); Humanity is EMP × 10 minus the static Humanity Loss of the gear cyberware, and EMP drops
by one per 10 lost.

Re-importing an entry with the same name skips it unless "Replace journals that already exist" is
ticked, which replaces its page.
