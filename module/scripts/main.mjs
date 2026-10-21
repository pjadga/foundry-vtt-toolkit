import { openImporter, importEntries, parseBundle, relink } from "./import/importer.mjs";

const MODULE_ID = "foundry-vtt-toolkit";

// Add an entry here to give a game system its own code. The key is game.system.id.
const SYSTEM_MODULES = {
  dnd5e: "./systems/dnd5e.mjs",
  sw25: "./systems/sw25.mjs",
  "cyberpunk-red-core": "./systems/cpred.mjs"
};

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "debug", {
    name: "FVTK.Settings.Debug.Name",
    hint: "FVTK.Settings.Debug.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
});

Hooks.once("ready", async () => {
  const api = { id: MODULE_ID, log, system: null, importer: { open: openImporter, importEntries, parseBundle, relink } };
  game.modules.get(MODULE_ID).api = api;

  const path = SYSTEM_MODULES[game.system.id];
  if (path) {
    try {
      api.system = await import(path);
      api.system.register?.(api);
      log(`Loaded system support for ${game.system.id}`);
    } catch (err) {
      console.error(`${MODULE_ID} | Failed to load ${game.system.id} support`, err);
    }
  }
});

// GM-only "Import from NotebookLM" button in the Journal sidebar.
Hooks.on("renderJournalDirectory", (app, html) => {
  if (!game.user.isGM || html.querySelector(".fvtk-import")) return;
  const actions = html.querySelector(".header-actions");
  if (!actions) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fvtk-import";
  button.innerHTML = `<i class="fa-solid fa-file-import"></i> ${game.i18n.localize("FVTK.Import.Button")}`;
  button.addEventListener("click", () => openImporter());
  actions.append(button);
});

function log(...args) {
  if (game.settings.get(MODULE_ID, "debug")) console.log(`${MODULE_ID} |`, ...args);
}
