# NotebookLM bundle format

The importer (`module/scripts/import/`, **Build campaign** in the Journal sidebar) reads plain-text
entries. NotebookLM is told to write them by the custom instruction in
[cyberpunk-red-prompts.md](cyberpunk-red-prompts.md) (Prompt 0).

**What one build does:** preview with the campaign check (below) → generate missing scene images
(review window) → import journals, items, NPCs and playlists → build, number and set up scenes →
pick YouTube tracks → a summary of what was built and skipped, with a button to activate the
build's first scene. The preview marks entries imported before: they are kept as they are unless
**Replace** is ticked or the entry has `replaces:`.

**Campaign check.** The preview lists gaps that would leave the campaign hard to run: `[[links]]`
that match no entry or document, NPCs in no scene, location or thread, items no one uses, locations
no scene or thread visits, scenes without `session`, `location`, `npcs_present`, `soundtrack` or
`visual`, locations without `visual`, a scene `location:` or `soundtrack:` that names the wrong kind
of entry, and playlists without tracks. Links and connections count what is already in the world, so
importing prompt by prompt doesn't raise false alarms. You can import anyway. **Copy fix prompt**
copies a prompt that asks NotebookLM to fix them with `replaces:` entries; build again with its
answer and those entries update what is already there.

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
- Field lines with bold keys (`**name:** Rook`, `**Danger Level**: 3`), bullets (`- type: npc`) or a
  bold value are read as plain fields. A bulleted line counts as a field only when its key looks
  like one (`npcs_present`, not `Darksynth`), and inside a `tracks:` list only for `type`, `name`,
  `tags`, `replaces`, `image` and `map`, so bulleted track lines with colons stay tracks.
- If an entry appears twice (NotebookLM repeats revised entries), the later copy is used.
- `replaces: <name>` (from the consistency-check prompt) replaces that existing document, keeping its
  id so links to it survive, even when "Replace ... that already exist" is not ticked. The entry's
  `name` becomes the document's name, so it can also rename. It is not shown as a field.

## Types

| `type` | Imported as | Folder |
| --- | --- | --- |
| `journal` | Journal entry | NotebookLM / Campaign |
| `location` | Journal entry, plus a scene when it has an image | NotebookLM / Locations (Journal and Scenes) |
| `thread` | Journal entry | NotebookLM / Story Threads |
| `scene` | Journal entry, plus a scene when it or its location has an image | NotebookLM / Scenes (Journal and Scenes) |
| `item` (Cyberpunk RED) | Item | NotebookLM / Items (Items) |
| `npc` (Cyberpunk RED) | Mook actor | NotebookLM / NPCs (Actors) |
| `playlist` | Playlist (tracks are picked from YouTube afterwards) | NotebookLM / Playlists (Playlists) |
| `npc` and `item` (other systems) | Not yet; listed as skipped | |

### Fields the toolkit reads

Any other `key: value` line is kept and shown on the journal or sheet. These drive automation:

| Type | Fields |
| --- | --- |
| all | `type`, `name`, `tags`, `replaces` (see above), `image` / `map` (scene background) |
| `journal` | anything; the Campaign Overview's `antagonist`, `plot_twists`, `ending`, `sessions` are shown as a list |
| `thread` | `hook`, `midpoint_choice`, `success_outcome`, `failure_outcome`, `connection_to_main`, `linked_threads` |
| `location` | `district`, `controlled_by`, `danger_level`, `notable_features`, `secrets`, `npcs` (placed as hidden tokens on its scene), `visual` (image prompt) |
| `scene` | `session` (numbering), `location` (image fallback), `npcs_present` (hidden tokens), `soundtrack` (the playlist that plays when the scene is activated), `objective`, `complications`, `best_outcome`, `worst_outcome`, `visual` (image prompt) |
| `npc` (Cyberpunk RED) | `role`, `tier`, `stats`, `skills`, `gear`, `appearance`, `voice_and_mannerisms`, the rest as GM-only notes |
| `item` (Cyberpunk RED) | `category`, `price`, `damage`, `rate_of_fire`, `range_or_melee`, `sp`, `penalty`, `effect`, `humanity_loss`, `story_item`, `too_strong_flag` |
| `playlist` | `mood`, `tracks` (one numbered line each) |

The prompt kit, [cyberpunk-red-prompts.md](cyberpunk-red-prompts.md), asks NotebookLM for exactly
these.

### Playlists and YouTube tracks

A `playlist` entry becomes a sequential Foundry playlist whose description holds its `mood` and
body. Its `tracks:` lines (numbered or bulleted, one per line) are kept for the YouTube picker;
replacing a playlist keeps the tracks already picked.

**Picking tracks.** In the Playlists sidebar, **YouTube tracks** (GM only) opens a window with one
row per track line. Each row searches YouTube with the official Data API v3 and lists embeddable
videos with channel, length and the search that found them. Click one to pick it, open it on YouTube
to listen first, or paste a link. **Save** replaces the playlist's YouTube tracks with the picks, in
row order. Nothing is downloaded.

**Picked during import.** With a YouTube key and **Pick YouTube tracks during import** on (the
default), every NotebookLM playlist that has no YouTube tracks yet is filled straight after the
import: each track line gets the top result of the same search as below, with a progress bar. It
stops a line after 2 searches (or once 2 videos are found), about 200 units a line, so a campaign's
three five-track playlists use about 3,000 of the 10,000 daily units. If the quota runs out it
stops, saves what it has and says so; open the picker the next day for the rest. Open the picker
any time to swap a pick.

YouTube matches the words in video titles, so a long NotebookLM description often finds nothing.
How a row is searched:

- **Without Gemini:** short searches cut from the description first, its genre and mood words
  ("darksynth epic orchestral synth instrumental"), then just its genres ("darksynth orchestral
  instrumental"), and the full description last. Up to 3 YouTube searches a row.
- **With a Gemini key** (optional): Gemini reads the description and the playlist's mood and
  suggests up to 3 real tracks and 3 short searches. Each suggestion is looked up on YouTube, and
  only real, embeddable videos are shown, labelled "Gemini pick" or "Gemini search". Up to 5
  YouTube searches a row. Gemini is also told what the playlist's other rows already have, so it
  suggests different songs and artists, and to match each line's energy and tempo.
- **Gemini models and failures:** the model setting defaults to `gemini-flash-lite-latest`, which
  answers in about a second (the full Flash model was often overloaded). If the chosen model is
  busy or gives no answer within 15 seconds, the lite model is tried, and the busy model is skipped
  for 10 minutes. If Gemini still fails, the row uses the plain searches and says why.
- Searches only return videos in YouTube's **Music** category that run at least two minutes, and
  drop reaction, review, tutorial, karaoke and lyric videos, which keeps out sound effects, talk and
  most vocal tracks. A playlist avoids picking the same video, or two uploads of the same suggested
  song, for different rows.
- Gemini can still suggest a track with vocals or a poor fit; each row shows its alternatives.
- A search you type yourself always runs first. A row stops once it has about 6 videos. A track
  picked by hand (or already saved) is kept when you search again; otherwise the top result is
  picked.

**Gemini key.** Get a free key at aistudio.google.com (Get API key) and paste it into Configure
Settings → Foundry VTT Toolkit → Gemini API key. Like the YouTube key it stays in your browser. The
model setting defaults to `gemini-flash-lite-latest`, Google's alias for its current Flash-Lite model; change
it only if Google retires that name. Track descriptions and playlist moods are sent to Gemini.

**API key.** Searching needs a YouTube Data API key: in Google Cloud Console create a project,
enable *YouTube Data API v3*, create an API key and restrict it to *YouTube Data API v3* and your
Foundry site (HTTP referrer). Put it in Configure Settings → Foundry VTT Toolkit. It is a client
setting, so it stays in your browser and is never sent to players. A search costs about 101 of the
free 10,000 daily units; a row uses up to 3 searches (5 with Gemini), so a six-track playlist uses
about 1,800–3,000 units. Pasted links work without a key.

**Playback.** Each track is a normal playlist sound (a silent placeholder file that loops) with the
video in its flags, so Foundry's play, pause, stop, next, volume and sync all work as usual. Every
connected client plays the video in YouTube's embedded player in a small **Now playing** window,
which stays visible at 356×200 as YouTube's embedding rules require (at least 200×200). The shared
start time lives in the sound's flags, so players who join late start at the right point and drift
over 2 seconds is corrected. Volume follows the sound's volume and each user's Music (or Ambience)
slider. When a video ends the active GM's client plays the next track (sequential and shuffle),
loops it (simultaneous) or stops (soundboard). Closing the window silences YouTube on that screen
until the track changes. Browsers only play sound after the first click on the page, as with any
Foundry audio. Some videos don't allow embedding; the GM sees a warning and can pick another.

Items are imported before NPCs, so an NPC whose gear names an item in the same import gets that item.

### Scenes

NotebookLM can't make images. Either let the toolkit generate them (see **Generated scene images**
below) or put yours in a folder under Foundry's user data (e.g. `worlds/<world>/assets/<campaign>/`)
and choose it as the **Scene image folder** in the import dialog (remembered for next time; with no
folder chosen it is `worlds/<world>/assets/notebooklm`). An image belongs to the location or scene whose name matches its
file name, ignoring case, punctuation, apostrophes and a leading "The": `the-overlook.jpg` → *The
Overlook*, `dr-chens-free-clinic.webp` → *Dr. Chen's Free Clinic*. An `image:` (or `map:`) line in an
entry overrides that: a file name in the folder, or a full path or URL.

A scene entry with no image of its own uses the image of the first `[[location]]` in its
`location:` field, from the same import or from an existing scene of that name. The preview shows
which image each entry gets.

Story scenes (from `scene` entries) are numbered and sorted in campaign order, e.g. `1. Salvage in
the Old Combat Zone` … `8. A Sanctuary on The Street`; their journals in NotebookLM / Scenes are
sorted the same way but keep their names, so `[[links]]` still work. The order comes from a
`session:` line if the entry has one, else the first "Session N" in its text; an epilogue goes last
and a prologue first. Every import renumbers the folder, so a scene added later slots into place,
and the number is ignored when matching names for replacement. Location scenes are not numbered.

Scenes are gridless, sized to the image, kept out of the player navigation bar, and their Notes open
the entry's journal. An existing scene is skipped unless the entry is being replaced; then it is
updated in place, so its tokens, walls and drawings survive. A scene is still created for a location
whose journal already existed.

Each scene the import creates or updates is also set up for play:

- **NPC tokens:** every NPC named in a scene's `npcs_present` (a location's `npcs`), as `[[links]]`
  or a comma-separated list, gets a **hidden** token from its actor, in a row across the lower
  middle, ready to reveal. Actors from the same import count, and NotebookLM imports win over other
  actors of the same name. An NPC who already has a token there isn't placed again; tokens a
  previous import placed for NPCs no longer listed are removed. Tokens you added yourself are never
  touched.
- **Journal pin:** a book pin in the top-left corner opens the entry's journal.
- **Soundtrack:** a scene's `soundtrack:` playlist becomes the scene's playlist, so Foundry starts it
  when you activate the scene (YouTube tracks included).

Names that match no actor or playlist are listed under **Skipped or not found** in the summary
that closes the build.

#### Generated scene images

Locations and scenes that have no image in the folder and no existing scene get an image generated
after you confirm the import, except a scene with no `visual:` line whose `[[location]]` is in the
same import: it uses the location's image. The
preview says how many. A **Scene images** window shows each one as it arrives with its prompt: edit
the prompt and **Regenerate** anything you don't like, untick what should stay without a scene, then
**Upload and import**. The images are saved to the scene image folder under the entry's name
(`neon-noodle-bar.jpg`), so the next import finds them instead of generating again. **Import without
images** carries on with none.

The prompt is the entry's `visual:` line (a location's opening description and `notable_features`
if it has none; for a scene, its location's visual and its opening), followed by the **Scene image
style** setting. Ask NotebookLM for a `visual:` line on every location (prompt kit, Prompt 3); it
gives far better images than the description.

Pick the generator in **Configure Settings → Foundry VTT Toolkit → Scene image generator**. Both are
free; the settings are per browser.

- **Pollinations** (default): no account or key. Free use is slow: one image every 45 seconds per
  internet connection (a campaign's 18 images take about 15 minutes; the window says how long is
  left, and a request turned away for coming too soon is retried). Images are about 1015×580, from
  a basic model, with a small "pollinations.ai" mark in the corner.
- **Cloudflare Workers AI**: FLUX.1 schnell, much better images and no watermark, on Cloudflare's
  free daily allowance (enough for dozens of images a day). Images are square. It needs a free
  Cloudflare account and a small Worker you deploy once:
  1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Worker**, name it (e.g.
     `fvtk-images`), **Deploy**, then **Edit code**, replace the code with
     [`docs/images/cloudflare-worker.js`](../images/cloudflare-worker.js) and **Deploy**.
  2. The Worker's **Settings → Bindings → Add → Workers AI**, variable name `AI`.
  3. **Settings → Variables and secrets → Add**, type **Secret**, name `TOKEN`, any long random value.
  4. In the toolkit settings set the generator to Cloudflare, **Cloudflare Worker URL** to the
     Worker's `https://….workers.dev` address and **Cloudflare Worker token** to the same value.

With **Keep generated images without review** on, the window only shows progress: everything that
generated is uploaded and the import carries on by itself.

### Packing the campaign as an Adventure

**Pack campaign** in the Compendium sidebar (GM only) packs everything a build made (documents
flagged as NotebookLM imports) and anything you put in its NotebookLM folders: scenes with their
tokens and pins, actors, items, journals, playlists with their YouTube tracks, and the folders. They
go into one Adventure in the world compendium *NotebookLM Campaigns*, which the toolkit creates the
first time. Packing again under the same name replaces that adventure. The adventure's cover is the
first story scene, and its overview lists the scenes in order.

To play the campaign in another world, export or move that compendium there (or into a module) and
use **Import Adventure**. Documents keep their ids, so `[[links]]`, tokens and journal pins still
work. Images are not copied: they stay at their paths in the user data folder, so the other world
must be on the same server, or you copy the image folder along with it.

**Starting over or continuing.** When a campaign ends, NotebookLM asks whether to scrap it or
continue with a sequel (prompt kit, Prompt 0).

- **Scrap:** tick *Remove the campaign from this world* when you pack. After packing, the toolkit
  checks that the adventure holds every document, asks you to confirm, then deletes the campaign's
  scenes, actors, items, journals, playlists and NotebookLM folders, so the next **Build campaign**
  starts clean. Image files are kept. **Import Adventure** on the packed adventure brings it all back.
- **Continue:** don't remove anything; build the sequel into the same world. Returning NPCs, places
  and items match by name (changed ones come with `replaces:`), and the sequel's sessions are
  numbered on from the old campaign's, so its scenes are numbered after the old ones. Packing
  first is still a good backup.

### GM Assistant

**GM Assistant** in the Journal sidebar (GM only) is a Gemini chat inside Foundry that knows the
campaign. It uses your Gemini API key from the settings (the same one as the YouTube picker), on
Google's free tier.

- **What it knows:** every NotebookLM journal, thread, location and scene (with their GM secrets),
  the NPCs (notes and gear), items, playlists and the story scenes in order. The window shows how
  much that is. It's sent with every question, so the assistant always sees the world as it is now,
  including anything you've imported or edited since the last question. It doesn't have your
  NotebookLM sources, so it doesn't know the rulebooks: for a rule it gives the usual convention
  and names the rule to check.
- **Asking:** type in the window (Enter sends, Shift+Enter for a new line), or type
  `/gm <question>` in the chat box. Chat answers are whispered to the GMs only. Both share one
  conversation, so follow-up questions work; **New chat** starts over, and so does reloading.
- **Answers:** short Markdown, with campaign names as links to their documents.
- **New content:** ask for an NPC, location, scene, item or fix and the answer comes as `##ENTRY`
  blocks in the same format as the prompt kit, changes with `replaces:`. **Build campaign with this
  entry** (in the window or on the chat message) opens Build campaign with the entries filled in.
  You see the usual preview and campaign check before anything is imported.
- **Whisper to GM chat** posts a window answer to the chat log; **Copy** copies it.
- **Model:** *GM Assistant model* in the settings, `gemini-flash-lite-latest` by default (a few
  seconds an answer). Another model gets 30 seconds before the lite one answers instead, and is
  skipped for 10 minutes after being busy or slow.

The campaign, GM secrets included, and your questions are sent to Google's Gemini API with each
question. NotebookLM is still the better place to write the campaign, since it draws on all your
sources. The assistant is for quick questions, ideas and small additions while you prepare or
play.

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
