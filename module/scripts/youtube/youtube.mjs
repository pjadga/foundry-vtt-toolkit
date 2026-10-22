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
