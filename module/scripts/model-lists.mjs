/**
 * Choices for the model settings' dropdowns: from the provider's own model list (fetched with the
 * GM's key when the dialog opens), else a short built-in list. Pure, so it can be tested with
 * `node --test`; the fetching is in settings-ui.mjs.
 */

/** Which list each model setting draws from. */
export const MODEL_SETTINGS = {
  assistantModel: "gemini-text",
  geminiModel: "gemini-text",
  geminiImageModel: "gemini-image",
  openaiImageModel: "openai-image"
};

/** Shown when the provider's list can't be fetched (no key, offline); the current value is always added. */
export const FALLBACK_MODELS = {
  "gemini-text": ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-pro-latest"],
  "gemini-image": ["gemini-3.1-flash-lite-image", "gemini-nano-banana-2.1", "gemini-3-pro-image"],
  "openai-image": ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "gpt-image-1.5"]
};

// Gemini models that can't chat or draw scenes: embeddings, speech, live audio, AQA and the like.
const NOT_TEXT = /(embedding|embed|aqa|tts|audio|live|native-audio|transcribe|imagen|veo|image|nano-banana|learnlm|robotics|computer-use)/i;

/**
 * Model ids from Gemini's ListModels answer (`{models: [{name: "models/x", supportedGenerationMethods}]}`)
 * for one use: "gemini-text" (chat) or "gemini-image" (image output). Aliases ending in "-latest"
 * come first, then the rest newest-looking first.
 * @returns {string[]}
 */
export function geminiModels(answer, kind) {
  const ids = (answer?.models ?? [])
    .filter(m => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map(m => String(m.name ?? "").replace(/^models\//, ""))
    // Only Gemini itself: agents (deep research, antigravity) are slow, and Gemma has no system
    // instructions, which the assistant and the picker use.
    .filter(id => /^gemini-/i.test(id) && !/deep-research/i.test(id))
    .filter(id => (kind === "gemini-image" ? /image|nano-banana/i.test(id) && !/imagen/i.test(id) : !NOT_TEXT.test(id)));
  return sortModels(ids);
}

/** GPT Image model ids from OpenAI's /v1/models answer (`{data: [{id}]}`), newest-looking first. */
export function openaiImageModels(answer) {
  return sortModels((answer?.data ?? []).map(m => String(m.id ?? "")).filter(id => /^gpt-image/i.test(id)));
}

/** "-latest" aliases first, then by version number (highest first), then by name. */
function sortModels(ids) {
  const version = id => Number(id.match(/(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  return [...new Set(ids)].sort((a, b) => {
    const latest = Number(b.endsWith("-latest")) - Number(a.endsWith("-latest"));
    return latest || version(b) - version(a) || a.localeCompare(b);
  });
}

/**
 * The options for a dropdown: the fetched list (or the fallback when it's empty), with the current
 * value kept even when the provider no longer lists it, so opening the dialog never changes a setting.
 * @param {string[]} fetched
 * @param {string} kind
 * @param {string} current
 * @returns {string[]}
 */
export function modelOptions(fetched, kind, current) {
  const list = fetched?.length ? fetched : FALLBACK_MODELS[kind] ?? [];
  const value = String(current ?? "").trim();
  return value && !list.includes(value) ? [value, ...list] : [...list];
}

/** Strength labels, weakest to strongest. */
export const STRENGTHS = ["Low", "Medium", "High", "Extra", "Max"];

/**
 * A plain-English strength for a model, from its name: Lite models are Low, Flash Medium, Pro High,
 * Ultra or Deep Think Max; image models the same way (Nano Banana is Flash-class); GPT Image Flare is
 * Medium, Sunburst High, older GPT Image Low. "Extra" marks a newer generation's Pro (3.5 or later).
 * Null when the name gives no clue (a codename), rather than a guess.
 * @param {string} id
 * @returns {string|null}
 */
export function modelStrength(id) {
  const name = String(id ?? "").toLowerCase();
  if (/ultra|deep-?think|\bmax\b/.test(name)) return "Max";
  if (/^gpt-image/.test(name)) {
    if (/sunburst/.test(name)) return "High";
    if (/flare/.test(name)) return "Medium";
    return "Low";
  }
  if (!/^gemini-/.test(name)) return null;
  const version = Number(name.match(/^gemini-(\d+(?:\.\d+)?)/)?.[1] ?? NaN);
  if (/lite/.test(name)) return "Low";
  if (/-pro\b|-pro-/.test(name) || name.endsWith("-pro")) return version >= 3.5 ? "Extra" : "High";
  if (/flash|nano-banana/.test(name)) return "Medium";
  return null;
}

/** "gemini-flash-latest (Medium)"; the bare id when the strength is unknown. */
export function modelLabel(id) {
  const strength = modelStrength(id);
  return strength ? `${id} (${strength})` : id;
}
