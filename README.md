# foundry-vtt-toolkit

Macros and a module for FoundryVTT **v13**. Targets system-agnostic use plus D&D 5e,
Sword World 2.5 and Cyberpunk RED.

## Layout

| Path | What it is |
| --- | --- |
| `macros/` | Standalone scripts. Paste the file contents into a new Script macro in Foundry. |
| `macros/core/` | Work in any system. |
| `macros/dnd5e/`, `macros/sw25/`, `macros/cpred/` | System-specific. Each guards on `game.system.id`. |
| `module/` | The installable module (`module.json`, ES module entry point, lang, styles). |
| `.github/workflows/release.yml` | Tag `vX.Y.Z` to build `module.zip` and publish a release. |

## Using a macro

1. In Foundry, create a macro, set **Type** to *Script*.
2. Paste the contents of the `.js` file.

Each macro starts with a header giving its name, the system it needs and the Foundry version.

## Using the module

Install from the manifest URL (available once a release exists):

```
https://github.com/pjadga/foundry-vtt-toolkit/releases/latest/download/module.json
```

For development, run `FOUNDRY_DATA="<path>/Data" npm run link` to symlink `module/` into `<foundry data>/Data/modules/foundry-vtt-toolkit/`, or copy it by hand.

The entry point, `module/scripts/main.mjs`, loads `module/scripts/systems/<system>.mjs` for the
active game system. Add new system support by adding a file and a line in `SYSTEM_MODULES`.

## Importing from NotebookLM

Write campaign material in NotebookLM using the prompts in
[docs/notebooklm/cyberpunk-red-prompts.md](docs/notebooklm/cyberpunk-red-prompts.md), copy the output,
then click **Import from NotebookLM** in Foundry's Journal sidebar (GM only) and paste it. Format:
[docs/notebooklm/format.md](docs/notebooklm/format.md). Journals, locations and story threads import
as journals; in a Cyberpunk RED world items import as real weapons, armor, cyberware and gear, and
NPCs as mook actors with role, stats, skills and gear. Scenes and playlists are next.

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
