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

For development, symlink or copy `module/` to `<foundry data>/Data/modules/foundry-vtt-toolkit/`.

The entry point, `module/scripts/main.mjs`, loads `module/scripts/systems/<system>.mjs` for the
active game system. Add new system support by adding a file and a line in `SYSTEM_MODULES`.

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
| Sword World 2.5 | `sw25` (unverified, confirm against the installed system's `system.json`) |
| Cyberpunk RED Core | `cyberpunk-red-core` |
