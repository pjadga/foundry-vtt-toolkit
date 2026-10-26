# foundry-vtt-toolkit

Macros and a module for FoundryVTT **v13**. Targets system-agnostic use plus D&D 5e,
Sword World 2.5 and Cyberpunk RED.

**Documentation:** the [user guide](docs/user-guide.md) covers features, screenshots,
troubleshooting and known issues. Release notes are in [CHANGELOG.md](CHANGELOG.md).

## Layout

| Path | What it is |
| --- | --- |
| `macros/` | Standalone scripts. Paste the file contents into a new Script macro in Foundry. |
| `macros/core/` | Work in any system. |
| `macros/dnd5e/`, `macros/sw25/`, `macros/cpred/` | System-specific. Each guards on `game.system.id`. |
| `macros/characters/` | Macros for a player's own character, usable in a game you don't host. |
| `module/` | The installable module (`module.json`, ES module entry point, lang, styles). |
| `.github/workflows/release.yml` | Tag `vX.Y.Z` to build `module.zip` and publish a release. |

## Using a macro

1. In Foundry, create a macro, set **Type** to *Script*.
2. Paste the contents of the `.js` file.

Each macro starts with a header giving its name, the system it needs and the Foundry version.

**Roy's Declarations** (`macros/characters/roy-declarations.js`) asks what's happening and has
Gemini write a chuunibyou line for the player character Roy "Slayer" Belmont that fits it, in a
private window, to copy into chat. **Roy's History** (`macros/characters/roy-history.js`) lists
every line it has written. See [docs/macros/roy-declarations.md](docs/macros/roy-declarations.md)
for installing them as a player in a game you don't host.

## Using the module

Install from the manifest URL (available once a release exists):

```
https://github.com/pjadga/foundry-vtt-toolkit/releases/latest/download/module.json
```

For development, run `FOUNDRY_DATA="<path>/Data" npm run link` to symlink `module/` into `<foundry data>/Data/modules/foundry-vtt-toolkit/`, or copy it by hand.

The entry point, `module/scripts/main.mjs`, loads `module/scripts/systems/<system>.mjs` for the
active game system. Add new system support by adding a file and a line in `SYSTEM_MODULES`.

## Building a campaign from NotebookLM

Write the campaign in NotebookLM with the prompts in
[docs/notebooklm/cyberpunk-red-prompts.md](docs/notebooklm/cyberpunk-red-prompts.md), collect the
answers in one file, then click **Build campaign** in Foundry's Journal sidebar (GM only) and choose
it. One run:

1. checks the campaign for gaps (broken links, unused NPCs and items, unvisited locations, scenes
   missing fields) and gives you a fix prompt to paste back into NotebookLM;
2. generates scene images for locations and scenes that have none, free (Pollinations, or your own
   Cloudflare Worker) or with Gemini on a key with billing, for you to review;
3. imports journals, locations and story threads, and in a Cyberpunk RED world real weapons, armor,
   cyberware and gear, and NPCs as mook actors with role, stats, skills and gear;
4. builds Foundry scenes in campaign order, each with hidden NPC tokens, a journal pin and its
   soundtrack playlist;
5. fills the playlists with YouTube tracks (with your own YouTube Data API key, optionally helped by
   Gemini), which play for everyone through YouTube's embedded player, synced with Foundry's
   playlist controls. Nothing is downloaded;
6. offers to activate the first scene.

**GM Assistant** (Journal sidebar, or `/gm <question>` in chat) is a Gemini chat inside Foundry with
the whole campaign as context. Its answers link to your journals and actors. Any new NPCs, places or
fixes it writes go straight to Build campaign with one click. Ask it to draw an NPC or a place and
it writes the prompt from the campaign, draws it with the scene image generator, and can make it
the actor's portrait and token or the scene's background.

**Pack campaign** in the Compendium sidebar then packs the whole campaign into one Foundry Adventure
(world compendium *NotebookLM Campaigns*) that another world on the same server can import.

Details: [docs/notebooklm/format.md](docs/notebooklm/format.md).

## Releasing

```
git tag v0.1.0 && git push origin v0.1.0
```

The workflow writes the version and download URL into `module.json`, zips `module/`, and attaches
`module.json` and `module.zip` to the release.

## System IDs

| System | `game.system.id` |
| --- | --- |
| D&D 5e | `dnd5e` |
| Sword World 2.5 | `sw25` |
| Cyberpunk RED Core | `cyberpunk-red-core` (v13 needs the unreleased 0.93 `dev` build; see CLAUDE.md) |
