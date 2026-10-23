/**
 * Free image generation for scene backgrounds.
 *
 * - pollinations: image.pollinations.ai, no account or key. Anonymous use is rate-limited (about one
 *   image every 15 seconds) and adds a small watermark.
 * - cloudflare: Cloudflare Workers AI (FLUX.1 schnell) through the GM's own Worker
 *   (docs/images/cloudflare-worker.js), on Cloudflare's free daily allowance. Better quality, no
 *   watermark; images are square.
 */

const POLLINATIONS = "https://image.pollinations.ai/prompt/";
const POLLINATIONS_GAP_MS = 16_000;
const TIMEOUT_MS = 90_000;
const MAX_TRIES = 3;
export const SIZE = { width: 1344, height: 768 };

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let nextPollinationsAt = 0;

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
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= MAX_TRIES) throw new Error(`${response.status} ${(await response.text().catch(() => "")).slice(0, 120) || response.statusText}`);
    const after = Number(response.headers.get("retry-after"));
    await wait((Number.isFinite(after) && after > 0 ? after : 20) * 1000);
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
