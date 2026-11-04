/**
 * Image prompts and file names for generated scene images. No Foundry globals, so it can be tested
 * with `node --test`.
 */
import { normalizeName, findLinks } from "../import/parser.mjs";

export const DEFAULT_STYLE = "cinematic concept art, wide establishing shot, atmospheric lighting, rich colour, highly detailed";
// A paragraph of `visual:` plus the style; FLUX reads about 256 tokens, Pollinations takes it in the URL.
const MAX_PROMPT = 1200;

/** Markdown and [[links]] -> plain prose. */
export function plainText(markdown) {
  return String(markdown ?? "")
    .replace(/\[\[([^\]\n]+)\]\]/g, "$1")
    .replace(/^#+\s.*$/gm, "") // headings are titles, not description
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The first `count` sentences of a text. */
function sentences(text, count) {
  return (text.match(/[^.!?]+[.!?]+/g) ?? [text]).slice(0, count).map(s => s.trim()).join(" ");
}

/**
 * The image prompt for a location or scene entry: what to show, then the style line (image models
 * weigh the start of a prompt most, so the subject goes first). Uses the
 * entry's `visual:` field when it has one; otherwise a location's opening description and notable
 * features, or a scene's location visual and opening description.
 * @param {object} entry
 * @param {{style?: string, location?: object|null}} [options] location: the scene's location entry.
 */
export function imagePrompt(entry, { style = DEFAULT_STYLE, location = null } = {}) {
  const f = entry.fields ?? {};
  let subject = plainText(f.visual);
  if (!subject) {
    const body = sentences(plainText(entry.body), 2);
    if (entry.type === "scene") {
      const place = location ? plainText(location.fields?.visual) || sentences(plainText(location.body), 1) : plainText(f.location);
      subject = [place, body].filter(Boolean).join(" ");
    } else {
      subject = [body, f.notable_features && `Features: ${plainText(f.notable_features)}.`].filter(Boolean).join(" ");
    }
  }
  subject = (subject || plainText(entry.name)).replace(/\.$/, "");
  const tail = `. ${String(style || DEFAULT_STYLE).trim().replace(/\.$/, "")}.`;
  // Shorten the subject, never the style.
  const room = MAX_PROMPT - tail.length;
  if (subject.length > room) subject = subject.slice(0, room).replace(/\s+\S*$/, "").replace(/[,;:]$/, "");
  return `${subject}${tail}`;
}

/** "Dr. Chen's Free Clinic" -> "dr-chens-free-clinic"; matches findImage's name matching. */
export function imageFileName(name, extension = "jpg") {
  const slug = normalizeName(name).replace(/\s+/g, "-") || "scene";
  return `${slug}.${extension}`;
}

/**
 * Which entries need a generated image: locations without one, and scenes without one that either
 * have a `visual:` of their own or no location to borrow from (`has` says whether an entry already
 * has an image).
 * @param {object[]} entries
 * @param {(entry: object) => boolean} has
 * @returns {{entry: object, location: object|null}[]}
 */
export function imagesNeeded(entries, has) {
  const locations = new Map(entries.filter(e => e.type === "location").map(e => [normalizeName(e.name), e]));
  const out = [];
  for (const e of entries) {
    if (e.type === "location" && !has(e)) out.push({ entry: e, location: null });
    if (e.type !== "scene" || has(e)) continue;
    const loc = findLinks(e.fields?.location ?? "").map(n => locations.get(normalizeName(n))).find(Boolean) ?? null;
    // A scene reuses its location's image (there already or being generated) unless it describes its own.
    if (!loc || plainText(e.fields?.visual)) out.push({ entry: e, location: loc });
  }
  return out;
}

/**
 * Which review card a pasted image goes to: the card the GM is on (focused or under the pointer),
 * else the first ticked card that has no image yet and isn't generating, else any ticked card
 * without an image.
 * @param {{include: boolean, blob: any, status: string}[]} jobs
 * @param {number} [preferred] Index of the card the GM is on, or -1.
 * @returns {number} -1 when there is nowhere to put it.
 */
export function pasteTarget(jobs, preferred = -1) {
  if (preferred >= 0 && preferred < jobs.length) return preferred;
  const free = jobs.findIndex(j => j.include && !j.blob && j.status !== "generating");
  return free >= 0 ? free : jobs.findIndex(j => j.include && !j.blob);
}

/**
 * Pixel size to keep a pasted image at: as it is, or scaled down to `max` on its longer side.
 * @returns {{width: number, height: number}}
 */
export function fitWithin(width, height, max = 2560) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * The prompt as a request to a chat assistant such as ChatGPT, for Copy prompt: it names the scene
 * and asks for a wide picture, since chat image tools draw squares unless told otherwise.
 * @param {string} name The entry's name.
 * @param {string} prompt The image prompt.
 * @returns {string}
 */
export function chatImageRequest(name, prompt) {
  const scene = String(name ?? "").trim();
  const subject = scene ? `the scene "${scene}" in my tabletop role-playing campaign` : "a scene in my tabletop role-playing campaign";
  return `Please create an image for ${subject}. Make it a wide landscape picture (16:9) that I can use as the scene's background.\n\n${String(prompt ?? "").trim()}`;
}

/**
 * Zoom an image view around a point (the mouse pointer), keeping that point still.
 * @param {{scale: number, x: number, y: number}} view Current scale and top-left offset.
 * @param {number} px Pointer x.
 * @param {number} py Pointer y.
 * @param {boolean} zoomIn
 * @returns {{scale: number, x: number, y: number}} scale stays between 0.1 and 8.
 */
export function zoomAt({ scale, x, y }, px, py, zoomIn) {
  const next = Math.min(8, Math.max(0.1, scale * (zoomIn ? 1.2 : 1 / 1.2)));
  return { scale: next, x: px - ((px - x) * next) / scale, y: py - ((py - y) * next) / scale };
}
