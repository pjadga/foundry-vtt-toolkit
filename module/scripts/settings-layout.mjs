/**
 * How the toolkit's settings are laid out in Configure Settings: in groups, with keys hidden. Pure
 * (no Foundry globals), so it can be tested with `node --test`. The page work is in settings-ui.mjs.
 */

/** Groups in display order: a lang key for the heading, and the settings in it. */
export const SETTING_GROUPS = [
  { label: "FVTK.SettingsGroup.Keys", keys: ["geminiApiKey", "youtubeApiKey", "openaiApiKey", "cloudflareWorkerUrl", "cloudflareWorkerToken"] },
  { label: "FVTK.SettingsGroup.Assistant", keys: ["assistantModel", "geminiModel"] },
  { label: "FVTK.SettingsGroup.Images", keys: ["imageProvider", "imageStyle", "imageAutoApprove", "geminiImageModel", "openaiImageModel", "openaiImageQuality"] },
  { label: "FVTK.SettingsGroup.YouTube", keys: ["youtubeAutoPick"] },
  { label: "FVTK.SettingsGroup.Combat", keys: ["combatNarration", "combatResolution", "combatApplyDamage"] },
  { label: "FVTK.SettingsGroup.Other", keys: [] }
];

/** Settings whose values are secrets: shown as dots until revealed. */
export const SECRET_SETTINGS = ["geminiApiKey", "youtubeApiKey", "openaiApiKey", "cloudflareWorkerToken"];

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
