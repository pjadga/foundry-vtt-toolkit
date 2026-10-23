/**
 * Image prompts and file names for generated scene images. No Foundry globals, so it can be tested
 * with `node --test`.
 */
import { normalizeName, findLinks } from "../import/parser.mjs";

export const DEFAULT_STYLE = "cinematic concept art, wide establishing shot, atmospheric lighting, rich colour, highly detailed, no text, no letters, no watermark";
const MAX_PROMPT = 700;

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
