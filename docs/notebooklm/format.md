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
| `npc`, `item`, `scene`, `playlist` | Not yet; listed as skipped | |

Re-importing an entry with the same name skips it unless "Replace journals that already exist" is
ticked, which replaces its page.
