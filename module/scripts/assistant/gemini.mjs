/**
 * Gemini chat for the GM Assistant, with the GM's own key (client setting). The campaign goes in the
 * system instruction on every request, so the answer always reflects what is in the world now.
 */
import { GeminiError } from "../youtube/gemini.mjs";

const API = "https://generativelanguage.googleapis.com/v1beta";
// The lite model answers questions over the whole campaign in a few seconds and writes good entries.
// The full Flash model hung for minutes in testing (October 2026), so it is only used when chosen.
export const DEFAULT_ASSISTANT_MODEL = "gemini-flash-lite-latest";
const FALLBACK_MODEL = "gemini-flash-lite-latest";
// A long answer over a large campaign can take a while; a chosen model that isn't the lite one gets
// less time before the lite model is asked instead.
const TIMEOUT_MS = 120_000;
const FIRST_TRY_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 3_000;
// A model that was busy or slow is skipped for this long.
const BUSY_SKIP_MS = 10 * 60_000;
const busyUntil = new Map();

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const isBusy = status => status === 429 || status >= 500;

async function generate(model, body, key, timeout) {
  const url = `${API}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    let response;
    let data;
    try {
      response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: controller.signal });
      data = await response.json().catch(() => ({}));
    } catch (err) {
      if (err.name === "AbortError") throw new GeminiError(`no answer within ${timeout / 1000} seconds`, true);
      throw new GeminiError(err.message);
    } finally {
      clearTimeout(timer);
    }
    if (response.ok) {
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map(p => p.text ?? "").join("").trim() ?? "";
      if (!text) throw new GeminiError(`no answer (${candidate?.finishReason ?? data.promptFeedback?.blockReason ?? "empty"})`);
      return { text, model, tokens: data.usageMetadata?.totalTokenCount ?? null, grounding: candidate.groundingMetadata ?? null };
    }
    const message = data.error?.message ?? `${response.status} ${response.statusText}`;
    if (!isBusy(response.status)) throw new GeminiError(message);
    if (attempt >= 1) throw new GeminiError(message, true);
    await wait(RETRY_DELAY_MS);
  }
}

/**
 * Ask Gemini, with the chosen model first and the lite model if that one is busy or slow. With
 * `stores`, Gemini searches those File Search stores and returns what it used in `grounding`.
 * @param {{system: string, history: {role: "user"|"model", text: string}[], stores?: string[], json?: boolean}} chat
 *   json: ask for a JSON answer.
 * @param {string} key
 * @param {string} [model]
 * @returns {Promise<{text: string, model: string, tokens: number|null, grounding: object|null}>}
 * @throws {GeminiError}
 */
export async function askGemini({ system, history, stores = [], json = false }, key, model = DEFAULT_ASSISTANT_MODEL) {
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: system }] },
    contents: history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    ...(stores.length ? { tools: [{ file_search: { file_search_store_names: stores } }] } : {}),
    generationConfig: { temperature: 0.8, ...(json ? { responseMimeType: "application/json" } : {}) }
  });
  const wanted = [...new Set([model || DEFAULT_ASSISTANT_MODEL, FALLBACK_MODEL])];
  const models = wanted.filter(m => !(busyUntil.get(m) > Date.now()));
  if (!models.length) models.push(FALLBACK_MODEL);
  for (const [i, name] of models.entries()) {
    const last = i === models.length - 1;
    try {
      return await generate(name, body, key, last ? TIMEOUT_MS : FIRST_TRY_TIMEOUT_MS);
    } catch (err) {
      if (err.busy && !last) busyUntil.set(name, Date.now() + BUSY_SKIP_MS);
      if (!err.busy || last) throw err;
    }
  }
}
