/**
 * YouTube helpers with no Foundry globals, so they can be tested with `node --test`.
 * Search lives in search.mjs, the picker in picker.mjs and playback in player.mjs.
 */

const ID = /^[\w-]{11}$/;

/**
 * The video id in a YouTube link or a bare id: watch?v=, youtu.be/, /embed/, /shorts/, /live/.
 * @param {string} input
 * @returns {string|null}
 */
export function videoIdFrom(input) {
  const s = String(input ?? "").trim();
  if (ID.test(s)) return s;
  let url;
  try {
    url = new URL(s.startsWith("http") ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  if (host === "youtu.be") return ID.test(url.pathname.slice(1, 12)) ? url.pathname.slice(1, 12) : null;
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;
  const v = url.searchParams.get("v");
  if (v && ID.test(v)) return v;
  const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
  return m ? m[1] : null;
}

/** "1. Low-fi synthwave\n2. Drone" -> ["Low-fi synthwave", "Drone"] */
export function trackLines(text) {
  return String(text ?? "")
    .split("\n")
    .map(line => line.replace(/^\s*(?:\d+\s*[.)]|[-*•])\s*/, "").trim())
    .filter(Boolean);
}

/**
 * A YouTube search for a NotebookLM track line: the description without its tempo, plus
 * "instrumental". "Ambient industrial drone with distorted electric cello, dark, 68 bpm" ->
 * "Ambient industrial drone with distorted electric cello dark instrumental".
 */
export function searchQuery(line) {
  const words = String(line)
    .replace(/\b\d+\s*bpm\b/gi, "")
    .replace(/[,;:()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /\binstrumental\b/i.test(words) ? words : `${words} instrumental`;
}

// Words people actually put in music video titles; used to cut a description down to a search.
const GENRE_WORDS = [
  "synthwave", "darksynth", "darkwave", "retrowave", "outrun", "cyberpunk", "industrial", "ambient", "drone", "techno",
  "electro", "electronic", "edm", "dubstep", "trance", "house", "idm", "downtempo", "trip-hop", "lofi", "lo-fi", "low-fi",
  "chillwave", "vaporwave", "jazz", "noir", "blues", "metal", "rock", "punk", "orchestral", "cinematic", "soundtrack",
  "score", "trailer", "piano", "cello", "sax", "saxophone", "guitar", "synth", "bass", "percussion", "drums", "choir"
];
const MOOD_WORDS = ["dark", "epic", "aggressive", "melancholic", "sad", "tense", "suspense", "stealth", "chill", "relaxing", "battle", "combat", "boss", "action", "emotional", "heroic", "calm", "eerie", "horror"];
const KNOWN = new Set([...GENRE_WORDS, ...MOOD_WORDS]);

/**
 * Searches to try in order for a track line, from the full description down to its key words,
 * since YouTube matches title words and long descriptions often find nothing:
 * 1. the description (searchQuery); 2. its genre and mood words; 3. its first genre words.
 * "High-energy darksynth with roaring distorted saws and epic orchestral synth brass" ->
 * [..., "darksynth epic orchestral synth instrumental", "darksynth orchestral instrumental"]
 * @returns {string[]} Distinct queries, longest first.
 */
export function fallbackQueries(line) {
  const full = searchQuery(line);
  const words = full.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter(Boolean);
  const known = [...new Set(words.filter(w => KNOWN.has(w) && w !== "instrumental"))];
  const genres = known.filter(w => GENRE_WORDS.includes(w));
  const queries = [full];
  if (known.length) queries.push(`${known.slice(0, 5).join(" ")} instrumental`);
  if (genres.length) queries.push(`${genres.slice(0, 2).join(" ")} instrumental`);
  else queries.push(`${words.filter(w => w !== "instrumental").slice(0, 3).join(" ")} instrumental`);
  return [...new Set(queries.map(q => q.trim()))].filter(q => q !== "instrumental");
}

// Titles of videos that are about a track rather than the track, or that mean it has vocals.
const NOT_A_TRACK = /\b(reaction|reacts?|reacting|review|tutorial|lesson|how to|explained|breakdown|analysis|karaoke|lyrics?|lyric video|sing along|podcast|interview)\b/i;

/** False for reaction, review, tutorial, lyric and similar videos. */
export function isLikelyTrack(title) {
  return !NOT_A_TRACK.test(String(title ?? ""));
}

/** ISO 8601 duration from the YouTube API ("PT1H2M3S") -> seconds. */
export function isoSeconds(iso) {
  const m = String(iso ?? "").match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const [, d = 0, h = 0, min = 0, s = 0] = m.map(x => Number(x ?? 0));
  return ((d * 24 + h) * 60 + min) * 60 + s;
}

/** 125 -> "2:05", 3725 -> "1:02:05" */
export function formatSeconds(total) {
  const t = Math.max(0, Math.round(total));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * Where a synced track should be now, in seconds.
 * @param {{startedAt?: number|null, pausedAt?: number|null}} state startedAt: server time (ms) the
 *   track would have started at to be where it is; pausedAt: position (s) it was paused at.
 * @param {number} now Server time in ms.
 */
export function expectedPosition(state, now) {
  if (state?.startedAt) return Math.max(0, (now - state.startedAt) / 1000);
  return Math.max(0, state?.pausedAt ?? 0);
}
