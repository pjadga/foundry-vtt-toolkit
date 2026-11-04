/**
 * How the toolkit's settings are laid out in Configure Settings: a button per service (Gemini,
 * YouTube, OpenAI) that opens a dialog with that service's settings, the rest in headed groups, and
 * keys hidden. Pure (no Foundry globals), so it can be tested with `node --test`. The page work is in
 * settings-ui.mjs.
 */

/** Settings shown in a service's dialog instead of on the settings page. */
export const SERVICE_MENUS = {
  gemini: { label: "FVTK.Service.Gemini", icon: "fa-solid fa-gem", keys: ["geminiApiKey", "assistantModel", "geminiModel", "geminiImageModel"] },
  youtube: { label: "FVTK.Service.YouTube", icon: "fa-brands fa-youtube", keys: ["youtubeApiKey", "youtubeAutoPick"] },
  openai: { label: "FVTK.Service.OpenAI", icon: "fa-solid fa-wand-magic-sparkles", keys: ["openaiApiKey", "openaiImageModel", "openaiImageQuality"] }
};

/** Whether a setting lives in a service dialog (so it isn't shown on the settings page). */
export const inServiceMenu = key => Object.values(SERVICE_MENUS).some(m => m.keys.includes(key));

/** Groups on the settings page in display order: a lang key for the heading, and the settings in it. */
export const SETTING_GROUPS = [
  { label: "FVTK.SettingsGroup.Images", keys: ["imageProvider", "imageStyle", "imageAutoApprove"] },
  { label: "FVTK.SettingsGroup.Combat", keys: ["combatNarration", "combatResolution", "combatApplyDamage"] },
  { label: "FVTK.SettingsGroup.Other", keys: [] }
];

/** Settings whose values are secrets: shown as dots until revealed. */
export const SECRET_SETTINGS = ["geminiApiKey", "youtubeApiKey", "openaiApiKey"];

/**
 * The settings on the page, sorted into the groups. A setting no group names goes in the last
 * group ("Other"); empty groups are left out.
 * @param {string[]} keys The toolkit's settings shown on the page, in page order.
 * @returns {{label: string, keys: string[]}[]}
 */
export function groupSettings(keys) {
  const named = new Set(SETTING_GROUPS.flatMap(g => g.keys));
  const groups = SETTING_GROUPS.map(g => ({ label: g.label, keys: g.keys.filter(k => keys.includes(k)) }));
  groups.at(-1).keys.push(...keys.filter(k => !named.has(k)));
  return groups.filter(g => g.keys.length);
}
