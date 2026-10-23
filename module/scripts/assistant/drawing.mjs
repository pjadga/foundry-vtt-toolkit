/**
 * Images from the GM Assistant: spotting a request for one, asking Gemini to write the image prompt,
 * and which campaign documents the image could be used for. No Foundry globals, so it can be tested
 * with `node --test`.
 */
import { normalizeName, findLinks } from "../import/parser.mjs";

const POLITE = String.raw`^\s*(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?)?`;
// "background" alone is also a character's backstory, so only "background image" counts.
const NOUN = String.raw`(?:image|picture|portrait|illustration|drawing|painting|artwork|background\s+(?:image|picture|art)|token\s+image)`;
const REQUEST_PATTERNS = [
  new RegExp(`${POLITE}(?:draw|paint|sketch|illustrate)\\b`, "i"),
  new RegExp(`${POLITE}(?:make|create|generate|give|show)\\s+(?:me\\s+|us\\s+)?(?:an?\\s+|the\\s+|another\\s+|a\\s+new\\s+)?(?:\\w+\\s+)?${NOUN}s?\\b`, "i"),
  new RegExp(`^\\s*(?:an?\\s+)?${NOUN}\\s+(?:of|for)\\b`, "i"),
  /^\s*(?:image|picture|draw)\s*:/i
];
const PORTRAIT = /\b(portrait|headshot|mugshot|face|token|character|npc)\b/i;
const SCENE = /\b(scene|location|background|landscape|establishing|map|place|street|alley|room|building|district|bar|club|city|skyline|interior|exterior)\b/i;
const MAX_PROMPT = 900;

/**
 * Whether a message asks for an image ("draw a portrait of Rook", "image: the docks at dawn").
 * @param {string} text
 * @returns {{request: string, kind: "portrait"|"scene"|null}|null} kind is a guess from the words.
 */
export function imageRequest(text) {
  const request = String(text ?? "").trim();
  if (!request || !REQUEST_PATTERNS.some(p => p.test(request))) return null;
  return { request: request.replace(/^\s*(?:image|picture|draw)\s*:\s*/i, ""), kind: guessKind(request) };
}

/** "portrait" for a person, "scene" for a place, null when the words don't say. */
export function guessKind(text) {
  if (PORTRAIT.test(text)) return "portrait";
  if (SCENE.test(text)) return "scene";
  return null;
}

/** The JSON shape of Gemini's answer to imagePlanRequest (askGemini's `schema`). */
export const IMAGE_PLAN_SCHEMA = {
  type: "OBJECT",
  properties: {
    prompt: { type: "STRING" },
    subject: { type: "STRING" },
    kind: { type: "STRING", enum: ["portrait", "scene"] }
  },
  required: ["prompt", "subject", "kind"]
};

/** Aspect ratio for an image: square for portraits (it doubles as a token), 16:9 for scenes. */
export const aspectFor = kind => (kind === "portrait" ? "1:1" : "16:9");

/**
 * The message that asks Gemini to write the image prompt; it goes after the conversation so far,
 * with the campaign in the system instruction, so "draw her" and "draw Rook" use what it knows.
 * @param {string} request
 * @param {string} style The art style line (the scene image style setting).
 */
export function imagePlanRequest(request, style) {
  return [
    `Write the prompt for an image generator for this request: "${request}"`,
    "",
    'Reply with JSON only: {"prompt": "...", "subject": "...", "kind": "portrait" or "scene"}',
    `- prompt: one paragraph of at most ${MAX_PROMPT - 200} characters describing only what is visible, the subject first. For a person or creature: their appearance, clothing, expression and pose, head and shoulders, against a simple background. For a place or a moment: a wide establishing shot with the setting, lighting, weather, colours and action. Use what the campaign says about them (appearance, visual, description) and stay consistent with it. No names, no text, signs with words, logos or watermarks.`,
    `  End the prompt with this art style, leaving out framing words that don't fit a portrait: ${style}`,
    "- subject: the exact name of the campaign NPC, location or scene the image shows, spelled as in the campaign, or \"\" if it shows none of them.",
    '- kind: "portrait" for a person or creature, "scene" for a place or a moment.'
  ].join("\n");
}

/**
 * Gemini's reply to imagePlanRequest. JSON, possibly in a code fence; a reply that isn't JSON is
 * used as the prompt itself.
 * @param {string} text
 * @param {"portrait"|"scene"|null} [fallbackKind]
 * @returns {{prompt: string, subject: string, kind: "portrait"|"scene"}}
 */
export function parseImagePlan(text, fallbackKind = null) {
  const raw = String(text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    try {
      data = match ? JSON.parse(match[0]) : null;
    } catch {
      data = null;
    }
  }
  const prompt = String((data && typeof data === "object" ? data.prompt : raw) ?? "").replace(/\s+/g, " ").trim();
  if (!prompt) throw new Error("Gemini didn't write an image prompt");
  const subject = data && typeof data.subject === "string" ? data.subject.replace(/^\[\[|\]\]$/g, "").trim() : "";
  const kind = ["portrait", "scene"].includes(data?.kind) ? data.kind : fallbackKind ?? guessKind(prompt) ?? "scene";
  return { prompt: prompt.slice(0, MAX_PROMPT), subject, kind };
}

/**
 * Documents an image could be used for: actors (portrait and token) for a portrait, scenes
 * (background) for a scene. Taken from the plan's subject, [[links]] and names in the request, and
 * the [[links]] in the answer before it, in that order.
 * @param {{subject?: string, request?: string, previous?: string, kind: "portrait"|"scene"}} image
 * @param {{name: string, uuid: string, use: "portrait"|"background"}[]} docs Candidate documents.
 * @param {number} [max]
 * @returns {{name: string, uuid: string, use: "portrait"|"background"}[]}
 */
export function imageTargets({ subject = "", request = "", previous = "", kind }, docs, max = 3) {
  const use = kind === "portrait" ? "portrait" : "background";
  const usable = docs.filter(d => d.use === use);
  const plainRequest = ` ${normalizeName(request)} `;
  const named = usable.filter(d => normalizeName(d.name) && plainRequest.includes(` ${normalizeName(d.name)} `)).map(d => d.name);
  const wanted = [subject, ...findLinks(request), ...named, ...findLinks(previous)].map(normalizeName).filter(Boolean);
  const out = [];
  for (const name of wanted) {
    for (const doc of usable) if (normalizeName(doc.name) === name && !out.includes(doc)) out.push(doc);
  }
  return out.slice(0, max);
}
