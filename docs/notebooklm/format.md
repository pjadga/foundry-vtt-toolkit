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

## Types

| `type` | Imported as | Folder |
| --- | --- | --- |
| `journal` | Journal entry | NotebookLM / Campaign |
| `location` | Journal entry | NotebookLM / Locations |
| `thread` | Journal entry | NotebookLM / Story Threads |
| `npc` (Cyberpunk RED) | Mook actor | NotebookLM / NPCs (Actors) |
| `npc` (other systems), `item`, `scene`, `playlist` | Not yet; listed as skipped | |

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
