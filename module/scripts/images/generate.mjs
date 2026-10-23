/**
 * Free image generation for scene backgrounds.
 *
 * - pollinations: image.pollinations.ai, no account or key. Anonymous use is limited to one image
 *   every 45 seconds per IP address (answered with 402 FREE_LIMIT) and adds a small watermark.
 * - cloudflare: Cloudflare Workers AI (FLUX.1 schnell) through the GM's own Worker
 *   (docs/images/cloudflare-worker.js), on Cloudflare's free daily allowance. Better quality, no
 *   watermark; images are square.
 * - gemini: Google's Gemini image models ("Nano Banana") with the GM's Gemini API key. Best quality,
 *   any aspect ratio, no visible watermark (SynthID only), but image models have no free tier: the
 *   key's project needs billing, at a few cents an image.
 */

const POLLINATIONS = "https://image.pollinations.ai/prompt/";
export const POLLINATIONS_GAP_MS = 46_000;
const TIMEOUT_MS = 90_000;
const MAX_TRIES = 3;
// Rate-limit answers are retried longer: they only mean "wait".
const MAX_LIMITED_TRIES = 5;
export const SIZE = { width: 1344, height: 768 };
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/";
// Nano Banana 2 Lite: the fastest and cheapest image model (October 2026, about $0.03 an image).
export const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-lite-image";
// A rate limit that asks for a longer wait than this is reported instead of waited out.
const MAX_GEMINI_WAIT_S = 60;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let nextPollinationsAt = 0;

/** A readable message from an error response body (JSON `error.message` or `message`, else text). */
export function errorMessage(text) {
  try {
    const data = JSON.parse(text);
    const message = data?.error?.message ?? data?.message ?? (typeof data?.error === "string" ? data.error : null);
    if (message) return String(message);
  } catch {
    // Not JSON.
  }
  return String(text ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}

/**
 * Whether an error response is worth retrying, and after how many seconds. A rate limit (429, or
 * Pollinations' 402 "Free limit reached: 1 image every 45 seconds") waits as long as it says.
 * @returns {{retry: boolean, limited: boolean, seconds: number}}
 */
export function retryAfter(status, text, header) {
  const limited = status === 429 || (status === 402 && /limit/i.test(text));
  const seconds = Number(header) || Number(String(text).match(/every (\d+) seconds/i)?.[1]) || 20;
  return { retry: limited || status >= 500, limited, seconds: seconds + 2 };
}

/** Pixel size for an aspect ratio ("16:9"), about the area of SIZE, in multiples of 16. */
export function sizeFor(aspectRatio = "16:9") {
  const [w, h] = String(aspectRatio).split(":").map(Number);
  // Scene backgrounds keep the size they always had (near enough 16:9).
  if (aspectRatio === "16:9" || !(w > 0 && h > 0)) return { ...SIZE };
  const height = Math.round(Math.sqrt((SIZE.width * SIZE.height * h) / w) / 16) * 16;
  return { width: Math.round((height * w) / h / 16) * 16, height };
}

/**
 * A readable error for a failed Gemini image request, and whether it is worth retrying. A key on the
 * free tier gets 429 with a quota "limit: 0" for image models: that needs billing, not waiting.
 * @param {number} status
 * @param {object} data The parsed response body.
 * @param {string} model
 * @returns {{message: string, retry: boolean, seconds: number, billing: boolean}}
 */
export function geminiImageError(status, data, model) {
  const error = data?.error ?? {};
  const full = String(error.message ?? "");
  const first = full.split("\n")[0].trim();
  const details = Array.isArray(error.details) ? error.details : [];
  const freeTier = details.some(d => (d?.violations ?? []).some(v => /FreeTier/i.test(v?.quotaId ?? ""))) || /free[_ ]tier/i.test(full);
  const out = { message: first || `HTTP ${status}`, retry: false, seconds: 0, billing: false };
  if (status === 429 && (freeTier || /limit: 0\b/.test(full))) {
    return { ...out, billing: true, message: "Gemini image models need billing on the API key's Google Cloud project (a few cents an image; set it up under Billing at aistudio.google.com). A free-tier key can't make images: choose Pollinations or Cloudflare in the toolkit settings to generate for free" };
  }
  if (status === 429) {
    const seconds = Math.ceil(parseFloat(details.find(d => d?.retryDelay)?.retryDelay) || 20) + 1;
    return { ...out, retry: seconds <= MAX_GEMINI_WAIT_S, seconds, message: `Gemini's rate limit for ${model} was reached, try again later (${out.message})` };
  }
  if (status >= 500) return { ...out, retry: true, seconds: 5, message: `Gemini is busy or failed (${status}): ${out.message}` };
  if (status === 400 && /api key/i.test(full)) return { ...out, message: "Gemini refused the API key: check the Gemini API key in the toolkit settings" };
  if (status === 404) return { ...out, message: `Gemini has no model "${model}": check the Gemini image model in the toolkit settings` };
  return { ...out, message: `${status}: ${out.message}` };
}

/**
 * The image in a Gemini generateContent response: the last image part that isn't an interim
 * "thought" image. Throws a readable error when the answer has none (blocked, or text only).
 * @returns {{mimeType: string, data: string}} data is base64.
 */
export function geminiImagePart(data) {
  const candidate = data?.candidates?.[0];
  const parts = (candidate?.content?.parts ?? []).filter(p => !p.thought);
  const image = parts.map(p => p.inlineData ?? p.inline_data).filter(d => d?.data).at(-1);
  if (image) return { mimeType: image.mimeType ?? image.mime_type ?? "image/png", data: image.data };
  const blocked = data?.promptFeedback?.blockReason;
  const reason = blocked ?? candidate?.finishReason ?? "empty answer";
  if (blocked || /SAFETY|PROHIBITED|BLOCKLIST|SPII/i.test(reason)) throw new Error(`Gemini declined to draw this (${reason}): try rewording the prompt`);
  const text = parts.map(p => p.text ?? "").join(" ").replace(/\s+/g, " ").trim().slice(0, 200);
  throw new Error(`Gemini returned no image (${reason})${text ? `: ${text}` : ""}`);
}

async function fetchImage(url, options = {}) {
  for (let attempt = 1; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response;
    try {
      response = await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (attempt >= MAX_TRIES) throw new Error(err.name === "AbortError" ? `no image within ${TIMEOUT_MS / 1000} seconds` : err.message);
      await wait(5_000);
      continue;
    } finally {
      clearTimeout(timer);
    }
    if (response.ok && response.headers.get("content-type")?.startsWith("image/")) return response.blob();
    const text = await response.text().catch(() => "");
    const { retry, limited, seconds } = retryAfter(response.status, text, response.headers.get("retry-after"));
    if (!retry || attempt >= (limited ? MAX_LIMITED_TRIES : MAX_TRIES)) throw new Error(`${response.status}: ${errorMessage(text) || response.statusText}`);
    await wait(seconds * 1000);
  }
}

async function pollinations(prompt, seed, aspectRatio) {
  // One request at a time, spaced out for the anonymous rate limit.
  const delay = nextPollinationsAt - Date.now();
  if (delay > 0) await wait(delay);
  nextPollinationsAt = Date.now() + POLLINATIONS_GAP_MS;
  const { width, height } = sizeFor(aspectRatio);
  const params = new URLSearchParams({ width: String(width), height: String(height), seed: String(seed), nologo: "true", private: "true" });
  try {
    return await fetchImage(`${POLLINATIONS}${encodeURIComponent(prompt)}?${params}`);
  } finally {
    nextPollinationsAt = Date.now() + POLLINATIONS_GAP_MS;
  }
}

async function cloudflare(prompt, seed, { url, token }) {
  if (!url) throw new Error("set the Cloudflare Worker URL in the toolkit settings");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetchImage(url, { method: "POST", headers, body: JSON.stringify({ prompt, seed }) });
}

async function gemini(prompt, { key, model, aspectRatio }) {
  if (!key) throw new Error("set your Gemini API key in the toolkit settings");
  model ||= DEFAULT_GEMINI_IMAGE_MODEL;
  // The key goes in a header, not the URL, so it stays out of logs and error messages.
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } }
    })
  };
  for (let attempt = 1; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response;
    let data;
    try {
      response = await fetch(`${GEMINI_API}${encodeURIComponent(model)}:generateContent`, { ...options, signal: controller.signal });
      data = await response.json().catch(() => ({}));
    } catch (err) {
      if (attempt >= MAX_TRIES) throw new Error(err.name === "AbortError" ? `no image within ${TIMEOUT_MS / 1000} seconds` : err.message);
      await wait(5_000);
      continue;
    } finally {
      clearTimeout(timer);
    }
    if (response.ok) {
      const image = geminiImagePart(data);
      const bytes = Uint8Array.from(atob(image.data), c => c.charCodeAt(0));
      return new Blob([bytes], { type: image.mimeType });
    }
    const { message, retry, seconds } = geminiImageError(response.status, data, model);
    if (!retry || attempt >= MAX_TRIES) throw new Error(message);
    await wait(seconds * 1000);
  }
}

/**
 * Generate one image.
 * @param {string} prompt
 * @param {{provider: "pollinations"|"cloudflare"|"gemini", seed?: number, url?: string, token?: string,
 *   key?: string, model?: string, aspectRatio?: string}} options url/token for Cloudflare, key/model for
 *   Gemini. aspectRatio is "16:9" unless given; Cloudflare ignores it (its images are square).
 * @returns {Promise<Blob>}
 */
export async function generateImage(prompt, { provider, seed = Math.floor(Math.random() * 1e9), url, token, key, model, aspectRatio = "16:9" }) {
  if (provider === "pollinations") return pollinations(prompt, seed, aspectRatio);
  if (provider === "cloudflare") return cloudflare(prompt, seed, { url, token });
  if (provider === "gemini") return gemini(prompt, { key, model, aspectRatio });
  throw new Error(`unknown image provider "${provider}"`);
}

export const PROVIDERS = ["pollinations", "cloudflare", "gemini"];
