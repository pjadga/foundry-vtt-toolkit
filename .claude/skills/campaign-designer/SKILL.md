---
name: campaign-designer
description: Design a tabletop RPG campaign for Foundry VTT from a rulebook and a rough idea. Fills in threads, locations, NPCs, items and scenes, checks them, then drives NotebookLM (Gemini Notebook) in the user's browser to refine the campaign and hands the result to the toolkit's Build campaign importer. Use when the user wants to create, plan or refine a campaign, or run campaign queries in NotebookLM.
---

# Campaign designer

Turns a game system, its rulebook and the user's rough direction into a campaign the toolkit's **Build
campaign** importer can build in Foundry VTT. You write the draft, then use NotebookLM (through the
user's browser) to ground it in the rulebooks and refine it.

Supported systems are in `systems/`: **Cyberpunk RED** (`cpred`) is done. Sword World 2.5 and D&D 5e are
not yet; say so and offer to write their profile (see "Adding a system").

## Files

Everything for one campaign lives in `campaigns/<name>/`, which is git-ignored (rulebook PDFs are
copyrighted and the repo is public). Never commit anything from `campaigns/`.

| File | What |
| --- | --- |
| `brief.md` | System, the user's direction, constraints (sessions, tone, what to avoid) |
| `sources/` | Rulebook PDFs and other sources the user gave |
| `rules-digest.md` | What the campaign must get right, from the rulebook (stage 2) |
| `bible.entries.txt` | The draft campaign in the toolkit's `##ENTRY` format (stage 3) |
| `notebooklm/prompt-0.txt` | The notebook's chat configuration (stage 4) |
| `notebooklm/queries.md` | The queries to run, in order, with what each is for (stage 4) |
| `output/campaign.txt` | The refined campaign exported from NotebookLM (stage 5) |

## Stages

Do them in order and keep the user's decisions; ask only for what you can't work out. Say which stage
you're on.

### 1. Intake

Ask for, or confirm: the **system** (a profile in `systems/` must exist), where the **rulebook files**
are (copy them into `campaigns/<name>/sources/`; the browser upload tool can only read project
folders), the **direction** in the user's words, and anything fixed (number of sessions, solo or
group, tone, themes, existing characters). Write `brief.md`. Pick a short campaign name.

### 2. Rules digest

Read the rulebook a few pages at a time, starting with the contents. The Read tool's `pages` option
needs `pdftoppm`; if it says that isn't installed, extract the text instead: PyMuPDF (`import
pymupdf`) writes each book's text to `campaigns/<name>/text/<book>.txt` with `=== PAGE n ===` markers,
and `pdftotext -layout -f N -l M` keeps tables readable (weapon, armor and cyberware tables are
unreadable without `-layout`). Read slices with Bash (`awk` on the page markers) or Read with offsets.
The printed page number is usually the PDF page minus one; cite printed numbers. Follow the system profile's digest checklist and write `rules-digest.md`: only what the
campaign needs, with page numbers. Say which parts you read and which you skipped; never fill a gap
from memory and present it as the rulebook. If the rulebook is large, read the relevant chapters and
say so.

### 3. Campaign bible

From the brief and digest, write `bible.entries.txt` (a campaign is 70 or more entries, so write it in
parts, `bible/01-journals-threads.txt`, `02-locations-playlists.txt`, `03-npcs.txt`,
`04-items-scenes.txt`, and join them with `cat`): a complete campaign in `##ENTRY` format, using
the system profile's field list, which is the same format Prompt 0 tells NotebookLM to use. Fill in
what the user didn't say, connect the threads, and make every NPC, location and item earn its place:
each NPC in a scene, location or thread, each location visited, each item carried or used, each scene
with a session, location, NPCs, soundtrack and `visual:`.

Then run the check and fix every gap before going on:

```
node scripts/campaign-tools.mjs check campaigns/<name>/bible.entries.txt
```

Show the user a short summary (premise, threads, cast, twist, ending), not the whole bible, and let
them change direction now: later stages are slower.

### 4. NotebookLM kit and refinement

1. `node scripts/campaign-tools.mjs prompt0 <system> campaigns/<name>` writes `notebooklm/prompt-0.txt`
   from the prompt kit (it checks the 10,000-character limit). The kit's Prompt 0 is written for a
   **solo** campaign ("a solo Cyberpunk RED campaign", "single-player: … a likable companion"). For a
   group, edit the copy in `notebooklm/prompt-0.txt` (never the kit) to say "a group of N player
   characters", drop the companion line, and keep every other rule; check it stays under the limit.
   Rulebook PDFs over about 9 MB can't go through the browser upload tool in one piece: split them by
   page range with PyMuPDF (`doc.insert_pdf` into new files, saved with `garbage=4, deflate=True`),
   keeping each part under 9 MB, and upload the parts.
2. Write `notebooklm/queries.md`: the system profile's query list, each one tailored to this campaign.
   Every query says what to refine and names the bible entries it must keep as canon, so NotebookLM
   improves the draft instead of replacing it. End with the consistency check.
3. Drive NotebookLM as in `notebooklm.md`: a new notebook named after the campaign, the rulebooks,
   `bible.entries.txt` and `rules-digest.md` as sources, Prompt 0 as the chat configuration, then each
   query in order, saving each answer under `campaigns/<name>/notebooklm/answers/NN-<query>.txt`
   through the answer receiver. Ask for at most 9 or 10 entries per query. After the last query,
   merge the answers over the bible (later copies win; drop a `replaces:` equal to the entry's own
   name), unlink any core item name outside `gear:`, and run the check on the result.
   NotebookLM's own consistency query is a weak check (it said "nothing to fix"); your checks on
   stats, skill names, item fields and session coverage are the real ones.
4. Report what changed against the bible in a few lines. Where NotebookLM contradicts the rulebook or
   the user's brief, say so; don't hide it.

Always confirm with the user before the first browser action of a session, and never type a password
or touch a notebook you didn't create. If any browser step fails twice, stop and say what happened.

### 5. Hand-off

Join the answers into `output/campaign.txt` (the later copy of an entry wins; `replaces:` fields stay),
then run the check on it and fix gaps by asking NotebookLM with the fix prompt the check prints, until
it's clean. Then tell the user to run **Build campaign** in Foundry's Journal sidebar with that file.
Before building, compare the campaign's entry names with the world's existing journals, actors, items,
scenes and playlists (the importer keeps an existing document and skips yours, which leaves your links
pointing at the old one): name the overview "<Campaign> Overview" and prefix playlists with the
campaign name, then fix every `[[link]]` and `soundtrack:`. Never tick **Replace** in a world that holds
another campaign. Scenes are only created when an image matches (the importer says "no image, so no
scene"), so decide on images before building: generate them (Pollinations is free, one per 45 s, and
the review window needs the user), or supply images named after the entries.
A build also renumbers every imported story scene in the world together (restore the other campaign's
names and `sort` afterwards) and the track picker fills any imported playlist with no tracks, even
an old campaign's empty one (remove those picks); list the world's scenes and playlists before and
after. Building in Foundry is the importer's job; don't try to create the documents yourself. If the user
wants it built now, follow CLAUDE.md's testing section (cpr-test world, ask before touching anything
else).

## Rules that matter

- **The rulebook beats your memory.** Stats, costs, damage and names come from the digest or are
  marked as invented. Never present an invented rule as the rulebook's.
- **Names are exact.** `[[Brackets]]` only for names with their own entry (plus core items in an NPC's
  `gear`); spell them the same everywhere; no numbers in front. The importer links by exact name.
- **Don't hand NotebookLM secrets of the repo.** Sources are the user's rulebooks and the bible only.
- **Copyright.** Rulebooks stay in `campaigns/`. Don't quote long passages into the bible; summarise.
- **Playtest and Campaign over** are Prompt 0 modes the user can run in the notebook themselves.

## Adding a system

Write `systems/<id>.md` like `systems/cyberpunk-red.md`: the system id, a digest checklist, the entry
fields per type with the system's own terms, the query list, and what the importer does for it. Then:
add the kit to `KITS` in `scripts/campaign-tools.mjs` (a prompt kit file with a Prompt 0 code block
under 10,000 characters). Only Cyberpunk RED has importer handlers for NPC and item entries
(`module/scripts/systems/cpred.mjs`); other systems import as journals, scenes and playlists until a
handler is added with `api.importer.registerType`.
