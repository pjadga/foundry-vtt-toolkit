/**
 * Campaign check: the gaps a NotebookLM bundle leaves for running the campaign in Foundry, and a
 * prompt that asks NotebookLM to fix them. No Foundry globals, so it can be tested with `node --test`.
 */
import { normalizeName, findLinks } from "./parser.mjs";

const IS_BOOKEND = /\b(epilogue|prologue|aftermath)\b/i;

/**
 * @param {object[]} entries From parseBundle.
 * @param {{known?: (name: string) => boolean, linkedElsewhere?: (name: string) => boolean}} [world]
 *   known: a document of that name already exists; linkedElsewhere: something already in the world
 *   links to it.
 * @returns {{entry: string|null, problem: string}[]}
 */
export function campaignCheck(entries, { known = () => false, linkedElsewhere = () => false } = {}) {
  const issues = [];
  const add = (entry, problem) => issues.push({ entry, problem });
  const names = new Set(entries.map(e => normalizeName(e.name)));
  // Who links to whom, by normalized name, ignoring an entry's links to itself.
  const linkedFrom = new Map();
  for (const e of entries) {
    for (const link of e.links) {
      const key = normalizeName(link);
      if (key === normalizeName(e.name)) continue;
      if (!linkedFrom.has(key)) linkedFrom.set(key, []);
      linkedFrom.get(key).push(e);
    }
  }
  const from = e => linkedFrom.get(normalizeName(e.name)) ?? [];
  const field = (e, key) => String(e.fields[key] ?? "").trim();

  // Broken links, once per missing name.
  const broken = new Map();
  for (const e of entries) {
    for (const link of e.links) {
      const key = normalizeName(link);
      if (names.has(key) || known(link) || broken.has(key)) continue;
      broken.set(key, { link, by: e.name });
    }
  }
  for (const { link, by } of broken.values()) add(by, `links to [[${link}]], but there is no entry with that exact name (add one, or use an existing name)`);

  // Only judge connections when the bundle has the story to connect to.
  const story = entries.some(e => e.type === "scene" || e.type === "thread");
  for (const e of entries) {
    const linked = from(e).length > 0 || linkedElsewhere(e.name);
    if (story && e.type === "npc" && !linked) add(e.name, "NPC is in no scene, location or thread");
    if (story && e.type === "item" && !linked) add(e.name, "item is never used: no NPC carries it and no scene or thread mentions it");
    if (story && e.type === "location" && !from(e).some(o => o.type === "scene" || o.type === "thread") && !linkedElsewhere(e.name)) {
      add(e.name, "location is never visited by a scene or thread");
    }
    if (e.type === "location" && !field(e, "visual")) add(e.name, "location has no visual: line for its scene image");
    if (e.type === "scene") {
      const missing = ["location", "npcs_present", "soundtrack", "visual"].filter(k => !field(e, k));
      if (!field(e, "session") && !IS_BOOKEND.test(`${e.name} ${e.tags.join(" ")}`)) missing.unshift("session");
      if (missing.length) add(e.name, `scene has no ${missing.join(", ")} field${missing.length > 1 ? "s" : ""}`);
      for (const name of findLinks(field(e, "location"))) {
        const target = entries.find(o => normalizeName(o.name) === normalizeName(name));
        if (target && target.type !== "location") add(e.name, `location: [[${name}]] is the ${target.type} entry, not a location`);
      }
      for (const name of findLinks(field(e, "soundtrack"))) {
        const target = entries.find(o => normalizeName(o.name) === normalizeName(name));
        if (target && target.type !== "playlist") add(e.name, `soundtrack: [[${name}]] is the ${target.type} entry, not a playlist`);
      }
    }
    if (e.type === "playlist" && !field(e, "tracks")) add(e.name, "playlist has no tracks: lines");
  }
  return issues;
}

/** A prompt to paste into NotebookLM that asks it to fix the issues. */
export function fixPrompt(issues) {
  if (!issues.length) return "";
  const lines = issues.map(i => `- ${i.entry ? `"${i.entry}": ` : ""}${i.problem}.`);
  return [
    "The Foundry VTT Toolkit checked the campaign and found these gaps:",
    ...lines,
    "",
    "Fix every one. Output only the entries that change or are new, complete and in the same ##ENTRY format as before. Give each changed entry a field \"replaces: <its current name>\". Spell every name exactly as its own entry does. Output everything in one code block."
  ].join("\n");
}
