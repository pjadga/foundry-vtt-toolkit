import { openImporter, importEntries, parseBundle, relink, registerType, orderScenes } from "./import/importer.mjs";
import { importPlaylist } from "./youtube/playlists.mjs";
import { YouTubePicker, chooseAndPick } from "./youtube/picker.mjs";
import { setupYouTubePlayback } from "./youtube/player.mjs";
import { DEFAULT_MODEL as GEMINI_DEFAULT_MODEL } from "./youtube/gemini.mjs";
import { DEFAULT_STYLE as IMAGE_DEFAULT_STYLE } from "./images/prompts.mjs";

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
  // Last folder chosen in the NotebookLM importer for scene images.
  game.settings.register(MODULE_ID, "imageFolder", { scope: "client", config: false, type: String, default: "" });
  // Client scope: the key stays in the GM's own browser and is never sent to players.
  game.settings.register(MODULE_ID, "youtubeApiKey", {
    name: "FVTK.Settings.YouTubeKey.Name",
    hint: "FVTK.Settings.YouTubeKey.Hint",
    scope: "client",
    config: true,
    type: String,
    default: ""
  });
  // Optional: Gemini turns track descriptions into searches that find something on YouTube.
  game.settings.register(MODULE_ID, "geminiApiKey", {
    name: "FVTK.Settings.GeminiKey.Name",
    hint: "FVTK.Settings.GeminiKey.Hint",
    scope: "client",
    config: true,
    type: String,
    default: ""
  });
  game.settings.register(MODULE_ID, "geminiModel", {
    name: "FVTK.Settings.GeminiModel.Name",
    hint: "FVTK.Settings.GeminiModel.Hint",
    scope: "client",
    config: true,
    type: String,
    default: GEMINI_DEFAULT_MODEL
  });
  // Scene images for locations and scenes that have none, generated during a NotebookLM import.
  game.settings.register(MODULE_ID, "imageProvider", {
    name: "FVTK.Settings.ImageProvider.Name",
    hint: "FVTK.Settings.ImageProvider.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      none: "FVTK.Settings.ImageProvider.None",
      pollinations: "FVTK.Settings.ImageProvider.Pollinations",
      cloudflare: "FVTK.Settings.ImageProvider.Cloudflare"
    },
    default: "pollinations"
  });
  game.settings.register(MODULE_ID, "imageStyle", {
    name: "FVTK.Settings.ImageStyle.Name",
    hint: "FVTK.Settings.ImageStyle.Hint",
    scope: "client",
    config: true,
    type: String,
    default: IMAGE_DEFAULT_STYLE
  });
  game.settings.register(MODULE_ID, "imageAutoApprove", {
    name: "FVTK.Settings.ImageAutoApprove.Name",
    hint: "FVTK.Settings.ImageAutoApprove.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, "cloudflareWorkerUrl", {
    name: "FVTK.Settings.CloudflareUrl.Name",
    hint: "FVTK.Settings.CloudflareUrl.Hint",
    scope: "client",
    config: true,
    type: String,
    default: ""
  });
  game.settings.register(MODULE_ID, "cloudflareWorkerToken", {
    name: "FVTK.Settings.CloudflareToken.Name",
    hint: "FVTK.Settings.CloudflareToken.Hint",
    scope: "client",
    config: true,
    type: String,
    default: ""
  });
});

Hooks.once("ready", async () => {
  const api = {
    id: MODULE_ID,
    log,
    system: null,
    importer: { open: openImporter, importEntries, parseBundle, relink, registerType, orderScenes },
    youtube: { pick: playlist => new YouTubePicker(playlist).render({ force: true }), choose: chooseAndPick }
  };
  game.modules.get(MODULE_ID).api = api;

  registerType("playlist", { label: "Playlists (pick YouTube tracks afterwards)", documentName: "Playlist", folder: "Playlists", order: 5, import: importPlaylist });
  setupYouTubePlayback();

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

/** A GM-only button in a sidebar directory's header. */
function addHeaderButton(html, className, icon, label, onClick) {
  if (!game.user.isGM || html.querySelector(`.${className}`)) return;
  const actions = html.querySelector(".header-actions");
  if (!actions) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.innerHTML = `<i class="${icon}"></i> ${game.i18n.localize(label)}`;
  button.addEventListener("click", onClick);
  actions.append(button);
}

Hooks.on("renderJournalDirectory", (app, html) => addHeaderButton(html, "fvtk-import", "fa-solid fa-file-import", "FVTK.Import.Button", () => openImporter()));
Hooks.on("renderPlaylistDirectory", (app, html) => addHeaderButton(html, "fvtk-youtube", "fa-brands fa-youtube", "FVTK.YouTube.Button", () => chooseAndPick()));

function log(...args) {
  if (game.settings.get(MODULE_ID, "debug")) console.log(`${MODULE_ID} |`, ...args);
}
