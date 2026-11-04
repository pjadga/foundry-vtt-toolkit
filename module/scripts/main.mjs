import { openImporter, importEntries, parseBundle, relink, registerType, orderScenes } from "./import/importer.mjs";
import { importPlaylist } from "./youtube/playlists.mjs";
import { YouTubePicker, chooseAndPick } from "./youtube/picker.mjs";
import { autoPickTracks } from "./youtube/tracks.mjs";
import { openPacker, packAdventure, clearCampaign } from "./import/adventure.mjs";
import { campaignPacks, clearCampaignPacks } from "./import/campaign-packs.mjs";
import { setupFileButtons, importFiles, exportFiles } from "./import/json-files.mjs";
import { addTabAction } from "./toolkit-menu.mjs";
import { setupSettingsUI, registerServiceMenus } from "./settings-ui.mjs";
import { importTable, importCards } from "./import/kinds-import.mjs";
import { openAssistant, setupAssistant, ask as askAssistant } from "./assistant/assistant.mjs";
import { openSources, syncSources } from "./assistant/sources-sync.mjs";
import { setupNarration } from "./narration/narration.mjs";
import { DEFAULT_ASSISTANT_MODEL } from "./assistant/gemini.mjs";
import { setupYouTubePlayback } from "./youtube/player.mjs";
import { DEFAULT_MODEL as GEMINI_DEFAULT_MODEL } from "./youtube/gemini.mjs";
import { DEFAULT_STYLE as IMAGE_DEFAULT_STYLE } from "./images/prompts.mjs";
import { DEFAULT_GEMINI_IMAGE_MODEL as GEMINI_IMAGE_DEFAULT_MODEL, DEFAULT_OPENAI_IMAGE_MODEL } from "./images/generate.mjs";

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
  game.settings.register(MODULE_ID, "youtubeAutoPick", {
    name: "FVTK.Settings.YouTubeAutoPick.Name",
    hint: "FVTK.Settings.YouTubeAutoPick.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  // The GM Assistant (Journal sidebar, or /gm in chat) uses the same Gemini key.
  game.settings.register(MODULE_ID, "assistantModel", {
    name: "FVTK.Settings.AssistantModel.Name",
    hint: "FVTK.Settings.AssistantModel.Hint",
    scope: "client",
    config: true,
    type: String,
    default: DEFAULT_ASSISTANT_MODEL
  });
  // Gemini narrates attacks in chat. Only the active GM's browser (which has the key) writes it.
  game.settings.register(MODULE_ID, "combatNarration", {
    name: "FVTK.Settings.CombatNarration.Name",
    hint: "FVTK.Settings.CombatNarration.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      auto: "FVTK.Settings.CombatNarration.Auto",
      review: "FVTK.Settings.CombatNarration.Review",
      off: "FVTK.Settings.CombatNarration.Off"
    },
    default: "auto"
  });
  // Cyberpunk RED: resolve attacks by the rules (range DV or Evasion) and post the result.
  game.settings.register(MODULE_ID, "combatResolution", {
    name: "FVTK.Settings.CombatResolution.Name",
    hint: "FVTK.Settings.CombatResolution.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "combatApplyDamage", {
    name: "FVTK.Settings.CombatApplyDamage.Name",
    hint: "FVTK.Settings.CombatApplyDamage.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      npcs: "FVTK.Settings.CombatApplyDamage.Npcs",
      all: "FVTK.Settings.CombatApplyDamage.All",
      off: "FVTK.Settings.CombatApplyDamage.Off"
    },
    default: "npcs"
  });
  // The assistant's source library: a folder of the GM's files, synced to Gemini File Search.
  game.settings.register(MODULE_ID, "sourcesFolder", { scope: "client", config: false, type: String, default: "" });
  game.settings.register(MODULE_ID, "assistantUseSources", { scope: "client", config: false, type: Boolean, default: true });
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
      gemini: "FVTK.Settings.ImageProvider.Gemini",
      openai: "FVTK.Settings.ImageProvider.OpenAI",
      manual: "FVTK.Settings.ImageProvider.Manual"
    },
    default: "pollinations"
  });
  // Gemini image model, with the Gemini API key above. Image models need billing on the key.
  game.settings.register(MODULE_ID, "geminiImageModel", {
    name: "FVTK.Settings.GeminiImageModel.Name",
    hint: "FVTK.Settings.GeminiImageModel.Hint",
    scope: "client",
    config: true,
    type: String,
    default: GEMINI_IMAGE_DEFAULT_MODEL
  });
  // OpenAI GPT Image, with Pollinations as the backup when a request fails.
  game.settings.register(MODULE_ID, "openaiApiKey", {
    name: "FVTK.Settings.OpenAIKey.Name",
    hint: "FVTK.Settings.OpenAIKey.Hint",
    scope: "client",
    config: true,
    type: String,
    default: ""
  });
  game.settings.register(MODULE_ID, "openaiImageModel", {
    name: "FVTK.Settings.OpenAIImageModel.Name",
    hint: "FVTK.Settings.OpenAIImageModel.Hint",
    scope: "client",
    config: true,
    type: String,
    default: DEFAULT_OPENAI_IMAGE_MODEL
  });
  game.settings.register(MODULE_ID, "openaiImageQuality", {
    name: "FVTK.Settings.OpenAIImageQuality.Name",
    hint: "FVTK.Settings.OpenAIImageQuality.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      low: "FVTK.Settings.OpenAIImageQuality.Low",
      medium: "FVTK.Settings.OpenAIImageQuality.Medium",
      high: "FVTK.Settings.OpenAIImageQuality.High"
    },
    default: "medium"
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
  // Gemini, YouTube and OpenAI settings live in their own dialogs, opened from the settings page.
  registerServiceMenus();
});

Hooks.once("ready", async () => {
  const api = {
    id: MODULE_ID,
    log,
    system: null,
    files: { import: importFiles, export: exportFiles },
    importer: { open: openImporter, importEntries, parseBundle, relink, registerType, orderScenes, pack: openPacker, packAdventure, clearCampaign, campaignPacks, clearCampaignPacks },
    youtube: { pick: playlist => new YouTubePicker(playlist).render({ force: true }), choose: chooseAndPick, autoPick: autoPickTracks },
    assistant: { open: openAssistant, ask: askAssistant, sources: openSources, syncSources }
  };
  game.modules.get(MODULE_ID).api = api;

  registerType("table", { label: "Rollable tables", documentName: "RollTable", folder: "Tables", order: 5, import: importTable });
  registerType("cards", { label: "Card stacks", documentName: "Cards", folder: "Card Stacks", order: 5, import: importCards });
  registerType("playlist", { label: "Playlists (pick YouTube tracks afterwards)", documentName: "Playlist", folder: "Playlists", order: 5, import: importPlaylist });
  setupYouTubePlayback();
  setupAssistant();
  setupNarration();

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

// Each tab's toolkit actions sit in one Toolkit menu. Build campaign builds into the world
// compendiums, so it lives on the Compendium tab.
addTabAction("renderCompendiumDirectory", { label: "FVTK.Import.Button", icon: "fa-solid fa-wand-magic-sparkles", onClick: () => openImporter() });
addTabAction("renderCompendiumDirectory", { label: "FVTK.Adventure.Button", icon: "fa-solid fa-box-archive", onClick: () => openPacker() });
addTabAction("renderJournalDirectory", { label: "FVTK.Assistant.Button", icon: "fa-solid fa-robot", onClick: () => openAssistant() });
addTabAction("renderPlaylistDirectory", { label: "FVTK.YouTube.Button", icon: "fa-brands fa-youtube", onClick: () => chooseAndPick() });
setupFileButtons();
setupSettingsUI();

function log(...args) {
  if (game.settings.get(MODULE_ID, "debug")) console.log(`${MODULE_ID} |`, ...args);
}
