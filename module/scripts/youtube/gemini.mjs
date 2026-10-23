/**
 * Gemini suggestions for the YouTube picker: short searches and real tracks for a track line.
 * Nothing Gemini says is used directly; the picker looks every suggestion up with the YouTube API
 * and shows only real, embeddable videos. No Foundry globals, so the pure parts are testable.
 */

const API = "https://generativelanguage.googleapis.com/v1beta";
// The lite model answers this kind of question in about a second; the full Flash model was often
// overloaded or took over 40 seconds (October 2026). Both are aliases that follow Google's releases.
export const DEFAULT_MODEL = "gemini-flash-lite-latest";
const FALLBACK_MODEL = "gemini-flash-lite-latest";
const MAX_QUERIES = 3;
const MAX_TRACKS = 3;

// Asks for JSON in this shape, so the answer can be parsed without guessing.
const SCHEMA = {
  type: "OBJECT",
  properties: {
    queries: { type: "ARRAY", items: { type: "STRING" } },
    tracks: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { artist: { type: "STRING" }, title: { type: "STRING" } }, required: ["artist", "title"] }
    }
  },
  required: ["queries", "tracks"]
};

const MAX_AVOID = 15;

/**
 * @param {string} line The NotebookLM track description.
 * @param {{name?: string, mood?: string}} playlist
 * @param {string[]} [avoid] Tracks already picked or suggested for the playlist's other lines.
 */
export function buildPrompt(line, playlist = {}, avoid = []) {
  const taken = [...new Set(avoid.map(s => String(s).trim()).filter(Boolean))].slice(0, MAX_AVOID);
  return [
    "You help a game master find background music on YouTube for a tabletop roleplaying game session.",
    playlist.name ? `Playlist: ${playlist.name}${playlist.mood ? ` (mood: ${playlist.mood})` : ""}.` : "",
    `Track wanted: ${line}`,
    "",
    "Match this track's energy, tempo and instrumentation, not just its genre: a slow ambient or stealth description needs slow, sparse music, an aggressive one needs fast, heavy music.",
    `Return up to ${MAX_QUERIES} short YouTube search queries (2 to 6 words each) using the genre and style words people put in music video titles, such as "darksynth", "dark ambient", "cyberpunk music"; add "instrumental" where it helps.`,
    `Also return up to ${MAX_TRACKS} real, existing instrumental tracks by real artists that fit, likely to be on YouTube. Only include tracks you are confident exist. No vocals.`,
    taken.length ? `These are already used for other tracks in this playlist; suggest different songs, and prefer different artists: ${taken.join("; ")}.` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Gemini's JSON answer -> cleaned suggestions: queries trimmed to 8 words, tracks as "artist title"
 * searches, duplicates and junk removed.
 * @param {string} text
 * @returns {{queries: string[], tracks: {artist: string, title: string, query: string}[]}}
 */
export function parseSuggestions(text) {
  let data;
  try {
    data = JSON.parse(String(text ?? "").replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return { queries: [], tracks: [] };
  }
  const clean = s => String(s ?? "").replace(/\s+/g, " ").trim();
  const queries = [...new Set((Array.isArray(data.queries) ? data.queries : []).map(q => clean(q).split(" ").slice(0, 8).join(" ")).filter(q => q.length > 2))].slice(0, MAX_QUERIES);
  const tracks = [];
  for (const t of Array.isArray(data.tracks) ? data.tracks : []) {
    const artist = clean(t?.artist);
    const title = clean(t?.title);
    if (!artist || !title) continue;
    const query = `${artist} ${title}`;
    if (!tracks.some(x => x.query.toLowerCase() === query.toLowerCase())) tracks.push({ artist, title, query });
  }
  return { queries, tracks: tracks.slice(0, MAX_TRACKS) };
}

const TIMEOUT_MS = 15_000;
// Waits before retrying a model that is overloaded (429, 500, 503).
const RETRY_DELAYS_MS = [2_000];

/** A Gemini failure; `busy` is true for overload and timeouts, which usually pass. */
export class GeminiError extends Error {
  constructor(message, busy = false) {
    super(message);
    this.busy = busy;
  }
}

const isBusy = status => status === 429 || status >= 500;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ask Gemini for searches and tracks for one line: the chosen model first, then, if it is busy or
 * slow, the lite model. Each request is cut off after TIMEOUT_MS; overload errors are retried
 * before moving on.
 * @param {string} line
 * @param {{name?: string, mood?: string}} playlist
 * @param {string} key The GM's Gemini API key.
 * @param {string} [model]
 * @param {string[]} [avoid] See buildPrompt.
 * @throws {GeminiError}
 */
export async function suggestSearches(line, playlist, key, model = DEFAULT_MODEL, avoid = []) {
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: buildPrompt(line, playlist, avoid) }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.7 }
  });
  const wanted = [...new Set([model || DEFAULT_MODEL, FALLBACK_MODEL])];
  // Skip models that were busy recently, unless that leaves nothing to try.
  const models = wanted.filter(m => !(busyUntil.get(m) > Date.now()));
  if (!models.length) models.push(FALLBACK_MODEL);
  for (const [i, name] of models.entries()) {
    try {
      return await generate(name, body, key);
    } catch (err) {
      if (err.busy) busyUntil.set(name, Date.now() + BUSY_SKIP_MS);
      // A busy or slow model is worth one try with the lighter one; anything else is final.
      if (!err.busy || i === models.length - 1) throw err;
    }
  }
}

// A model that was overloaded or timed out is skipped for this long, so each row doesn't wait on it.
const BUSY_SKIP_MS = 10 * 60_000;
const busyUntil = new Map();

async function generate(model, body, key) {
  const url = `${API}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response;
    let data;
    try {
      response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: controller.signal });
      data = await response.json().catch(() => ({}));
    } catch (err) {
      if (err.name === "AbortError") throw new GeminiError(`no answer within ${TIMEOUT_MS / 1000} seconds`, true);
      throw new GeminiError(err.message);
    } finally {
      clearTimeout(timer);
    }
    if (response.ok) {
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("") ?? "";
      return parseSuggestions(text);
    }
    const message = data.error?.message ?? `${response.status} ${response.statusText}`;
    if (!isBusy(response.status)) throw new GeminiError(message);
    if (attempt >= RETRY_DELAYS_MS.length) throw new GeminiError(message, true);
    await wait(RETRY_DELAYS_MS[attempt]);
  }
}
