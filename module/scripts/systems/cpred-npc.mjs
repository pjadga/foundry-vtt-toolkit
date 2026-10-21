/**
 * Cyberpunk RED NPC import: the parts that need no Foundry globals, so they can be tested with
 * `node --test`. The Foundry side is in cpred.mjs.
 */
import { normalizeName, humanize } from "../import/parser.mjs";

export const STAT_KEYS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];

/**
 * Toolkit defaults by NotebookLM "tier", used when an entry has no `stats:` or `skills:` line.
 * These are a starting point for the GM to adjust, not values from the rulebook. Combat tiers get
 * +1 REF, DEX and BODY.
 */
export const TIERS = {
  "non-combatant": { stat: 4, skill: 2, rank: 4, combat: false },
  mook: { stat: 5, skill: 4, rank: 2, combat: true },
  lieutenant: { stat: 6, skill: 6, rank: 4, combat: true },
  boss: { stat: 7, skill: 8, rank: 6, combat: true }
};
export const DEFAULT_TIER = "mook";
export const TIER_SKILLS = ["Athletics", "Brawling", "Evasion", "Handgun", "Melee Weapon", "Perception", "Shoulder Arms", "Stealth"];

export function tierOf(entry) {
  const t = normalizeName(entry.fields.tier ?? "").replace(/ /g, "-");
  return TIERS[t] ? t : DEFAULT_TIER;
}

/** "INT 6, REF 8, Body 7" -> {int: 6, ref: 8, body: 7}; unknown names are returned in `unknown`. */
export function parseStats(text) {
  const stats = {};
  const unknown = [];
  for (const [, name, value] of String(text ?? "").matchAll(/([A-Za-z]+)\s*[:=]?\s*(\d+)/g)) {
    const key = name.toLowerCase();
    if (STAT_KEYS.includes(key)) stats[key] = Number(value);
    else unknown.push(name);
  }
  return { stats, unknown };
}

/** "Handgun 6, Melee Weapon 4" -> [["Handgun", 6], ["Melee Weapon", 4]] */
export function parseSkills(text) {
  return String(text ?? "")
    .split(/[,;\n]/)
    .map(s => s.trim().match(/^(.+?)\s*[:=]?\s*\+?(\d+)$/))
    .filter(Boolean)
    .map(([, name, level]) => [name.trim(), Number(level)]);
}

/** Final stat values: tier defaults overridden by the entry's `stats:` line. Values are clamped to 1..10. */
export function buildStats(entry) {
  const tier = TIERS[tierOf(entry)];
  const stats = Object.fromEntries(STAT_KEYS.map(k => [k, tier.stat]));
  if (tier.combat) for (const k of ["ref", "dex", "body"]) stats[k] += 1;
  const parsed = parseStats(entry.fields.stats);
  Object.assign(stats, parsed.stats);
  for (const k of STAT_KEYS) stats[k] = Math.min(10, Math.max(1, stats[k]));
  return { stats, unknown: parsed.unknown };
}

/** Skill levels: tier defaults for TIER_SKILLS, overridden and extended by the entry's `skills:` line. */
export function buildSkills(entry) {
  const tier = TIERS[tierOf(entry)];
  const levels = new Map(TIER_SKILLS.map(s => [normalizeName(s), { name: s, level: tier.skill }]));
  for (const [name, level] of parseSkills(entry.fields.skills)) levels.set(normalizeName(name), { name, level: Math.min(10, level) });
  return [...levels.values()];
}

/**
 * Rulebook derived stats: HP = 10 + 5 x ceil((BODY + WILL) / 2); Humanity = EMP x 10 minus the
 * Humanity Loss of installed cyberware; current EMP = floor(Humanity / 10).
 * @param {object} stats
 * @param {number} humanityLoss Total static Humanity Loss of the NPC's cyberware.
 */
export function derivedStats(stats, humanityLoss = 0) {
  const humanity = stats.emp * 10 - humanityLoss;
  return { hp: 10 + 5 * Math.ceil((stats.body + stats.will) / 2), humanity, humanityMax: stats.emp * 10, emp: Math.max(-10, Math.floor(humanity / 10)) };
}

// Gear words that mean body armor, mapped to the compendium's body variant.
const ARMOR_ALIASES = [
  ["heavy armorjack", "Heavy Armorjack (Body)"],
  ["medium armorjack", "Medium Armorjack (Body)"],
  ["armorjack", "Light Armorjack (Body)"],
  ["kevlar", "Kevlar® (Body)"],
  ["flak", "Flak (Body)"],
  ["leathers", "Leathers (Body)"],
  ["leather jacket", "Leathers (Body)"],
  ["metalgear", "Metalgear® (Body)"],
  ["metal chestplate", "Metalgear® (Body)"]
];

// Everyday names NotebookLM uses for things the compendium names differently, applied to both
// sides before matching.
const TERM_ALIASES = [
  [/\bsub ?machine ?guns?\b/g, "smg"],
  [/\bpop up\b/g, "popup"],
  [/\b(trauma|medical|med|first aid) kit\b/g, "medtech bag"]
];
const gearKey = name => TERM_ALIASES.reduce((k, [re, to]) => k.replace(re, to), normalizeName(name));

/**
 * Find the compendium item for a piece of NotebookLM gear.
 * 1. exact name (after TERM_ALIASES); 2. body-armor alias; 3. the longest multi-word compendium
 * name contained in the gear name as whole words ("Militech Heavy Pistol" -> "Heavy Pistol").
 * Single-word partial matches are not used: "Medtech Trauma Kit" must not become the Medtech role.
 * @param {string} name
 * @param {{name: string, uuid: string, type: string}[]} index Compendium entries of gear types.
 * @returns {{name: string, uuid: string, type: string, exact: boolean}|null}
 */
export function matchGear(name, index) {
  const k = gearKey(name);
  const keyed = index.map(i => ({ ...i, key: gearKey(i.name) }));
  const exact = keyed.find(i => i.key === k);
  if (exact) return { ...exact, exact: normalizeName(exact.name) === normalizeName(name) };

  const padded = ` ${k} `;
  if (!/\bhead\b|\bhelmet\b/.test(k)) {
    const alias = ARMOR_ALIASES.find(([word]) => padded.includes(` ${word} `));
    const hit = alias && keyed.find(i => i.name === alias[1]);
    if (hit) return { ...hit, exact: false };
  }

  const partial = keyed
    .filter(i => i.key.includes(" ") && padded.includes(` ${i.key} `))
    .sort((a, b) => b.key.length - a.key.length)[0];
  return partial ? { ...partial, exact: false } : null;
}

// Fields shown openly on the sheet; every other field goes in the GM-only secret section.
const PUBLIC_FIELDS = ["role", "tier", "appearance", "voice_and_mannerisms"];
const HANDLED_FIELDS = ["gear", "stats", "skills"];

/**
 * Markdown for the actor's notes.
 * @param {object} entry
 * @param {{matched: {wanted: string, name: string, exact: boolean}[], missing: string[]}} gear
 * @param {string[]} problems Things the import could not apply, shown to the GM.
 * @returns {{public: string, secret: string}}
 */
export function npcNotes(entry, gear, problems = []) {
  const line = (k, v) => `**${humanize(k)}:** ${String(v).replace(/\n/g, " ")}`;
  const pub = PUBLIC_FIELDS.filter(k => entry.fields[k]).map(k => line(k, entry.fields[k]));
  const parts = [pub.join("  \n")];
  if (entry.body) parts.push(entry.body);

  const secret = Object.entries(entry.fields)
    .filter(([k]) => !PUBLIC_FIELDS.includes(k) && !HANDLED_FIELDS.includes(k))
    .map(([k, v]) => line(k, v));
  if (gear.matched.length || gear.missing.length) {
    const got = gear.matched.map(g => (g.exact ? g.name : `${g.wanted} (sheet: ${g.name})`));
    if (got.length) secret.push(line("gear on sheet", got.join(", ")));
    if (gear.missing.length) secret.push(line("gear not in the compendium", gear.missing.map(g => `[[${g}]]`).join(", ")));
  }
  if (entry.tags.length) secret.push(line("tags", entry.tags.join(", ")));
  for (const p of problems) secret.push(`*${p}*`);
  return { public: parts.filter(Boolean).join("\n\n"), secret: secret.join("  \n") };
}
