/**
 * Free image generation for scene backgrounds.
 *
 * - pollinations: image.pollinations.ai, no account or key. Anonymous use is limited to one image
 *   every 45 seconds per IP address (answered with 402 FREE_LIMIT) and adds a small watermark.
 * - cloudflare: Cloudflare Workers AI (FLUX.1 schnell) through the GM's own Worker
 *   (docs/images/cloudflare-worker.js), on Cloudflare's free daily allowance. Better quality, no
 *   watermark; images are square.
 */

const POLLINATIONS = "https://image.pollinations.ai/prompt/";
export const POLLINATIONS_GAP_MS = 46_000;
const TIMEOUT_MS = 90_000;
const MAX_TRIES = 3;
// Rate-limit answers are retried longer: they only mean "wait".
const MAX_LIMITED_TRIES = 5;
export const SIZE = { width: 1344, height: 768 };

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

async function pollinations(prompt, seed) {
  // One request at a time, spaced out for the anonymous rate limit.
  const delay = nextPollinationsAt - Date.now();
  if (delay > 0) await wait(delay);
  nextPollinationsAt = Date.now() + POLLINATIONS_GAP_MS;
  const params = new URLSearchParams({ width: String(SIZE.width), height: String(SIZE.height), seed: String(seed), nologo: "true", private: "true" });
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

/**
 * Generate one image.
 * @param {string} prompt
 * @param {{provider: "pollinations"|"cloudflare", seed?: number, url?: string, token?: string}} options
 * @returns {Promise<Blob>}
 */
export async function generateImage(prompt, { provider, seed = Math.floor(Math.random() * 1e9), url, token }) {
  if (provider === "pollinations") return pollinations(prompt, seed);
  if (provider === "cloudflare") return cloudflare(prompt, seed, { url, token });
  throw new Error(`unknown image provider "${provider}"`);
}

export const PROVIDERS = ["pollinations", "cloudflare"];
