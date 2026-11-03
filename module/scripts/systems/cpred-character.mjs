/**
 * Cyberpunk RED player character import: the parts that need no Foundry globals, so they can be
 * tested with `node --test`. The Foundry side is in cpred.mjs; stats, skills and gear work as for
 * NPCs (cpred-npc.mjs), without tier defaults.
 */
import { humanize } from "../import/parser.mjs";
import { STAT_KEYS, parseStats, parseSkills } from "./cpred-npc.mjs";

/** A stat the entry leaves out. */
export const DEFAULT_STAT = 5;
/** Role ability rank when the entry has no role_rank: a starting character's. */
export const DEFAULT_RANK = 4;

/** NotebookLM field -> the character sheet's lifepath field (system.lifepath.<key>). */
export const LIFEPATH_FIELDS = {
  cultural_origin: "culturalOrigin",
  personality: "personality",
  clothing_style: "clothingStyle",
  hairstyle: "hairStyle",
  affectations: "affectations",
  value_most: "valueMost",
  feelings_about_people: "aboutPeople",
  valued_person: "valuedPerson",
  valued_possession: "valuedPossession",
  family_background: "familyBackground",
  childhood_environment: "childhoodEnvironment",
  family_crisis: "familyCrisis",
  friends: "friends",
  enemies: "enemies",
  tragic_love_affairs: "tragicLoveAffairs",
  life_goals: "lifeGoals",
  role_lifepath: "roleLifepath"
};

/** NotebookLM field -> ledger on the sheet (system.<key>.value). */
export const LEDGER_FIELDS = { eddies: "wealth", improvement_points: "improvementPoints", reputation: "reputation" };

/** "2,500 eb" -> 2500; null when there is no number. */
export function parseAmount(text) {
  const match = String(text ?? "").replace(/(\d),(?=\d{3}(?!\d))/g, "$1").match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

/** Stats from the entry's `stats:` line, DEFAULT_STAT for any left out, clamped to 1..10. */
export function characterStats(entry) {
  const parsed = parseStats(entry.fields.stats);
  const stats = Object.fromEntries(STAT_KEYS.map(k => [k, Math.min(10, Math.max(1, parsed.stats[k] ?? DEFAULT_STAT))]));
  const missing = STAT_KEYS.filter(k => !(k in parsed.stats));
  return { stats, unknown: parsed.unknown, missing };
}

/** Skill levels from the entry's `skills:` line, clamped to 0..10. */
export function characterSkills(entry) {
  return parseSkills(entry.fields.skills).map(([name, level]) => ({ name, level: Math.min(10, level) }));
}

/** Role ability rank from `role_rank:` (1..10), else DEFAULT_RANK. */
export function roleRank(entry) {
  const rank = parseAmount(entry.fields.role_rank);
  return rank === null ? DEFAULT_RANK : Math.min(10, Math.max(1, rank));
}

/** Ledger values the entry gives: {wealth: 2500, ...}. */
export function ledgers(entry) {
  const out = {};
  for (const [field, key] of Object.entries(LEDGER_FIELDS)) {
    const value = parseAmount(entry.fields[field]);
    if (value !== null) out[key] = value;
  }
  return out;
}

/** Lifepath text the entry gives, by sheet key: {culturalOrigin: "...", ...}. */
export function lifepath(entry) {
  const out = {};
  for (const [field, key] of Object.entries(LIFEPATH_FIELDS)) if (entry.fields[field]) out[key] = String(entry.fields[field]);
  return out;
}

// Fields that go somewhere else on the sheet; the rest are listed in its notes.
const HANDLED_FIELDS = ["player", "role", "role_rank", "stats", "skills", "gear", "alias", "appearance", ...Object.keys(LEDGER_FIELDS), ...Object.keys(LIFEPATH_FIELDS)];

/**
 * Markdown for the character's notes: fields with no place on the sheet, the gear report and what
 * the import could not apply. Nothing is secret: the player owns the sheet and would see it.
 * @param {object} entry
 * @param {{matched: {wanted: string, name: string, exact: boolean}[], missing: string[]}} gear
 * @param {string[]} problems
 * @returns {{public: string, secret: string}}
 */
export function characterNotes(entry, gear, problems = []) {
  const line = (k, v) => `**${humanize(k)}:** ${String(v).replace(/\n/g, " ")}`;
  const lines = Object.entries(entry.fields)
    .filter(([k]) => !HANDLED_FIELDS.includes(k))
    .map(([k, v]) => line(k, v));
  const got = gear.matched.filter(g => !g.exact).map(g => `${g.wanted} (sheet: ${g.name})`);
  if (got.length) lines.push(line("gear matched", got.join(", ")));
  if (gear.missing.length) lines.push(line("gear not in the compendium", gear.missing.map(g => `[[${g}]]`).join(", ")));
  if (entry.tags.length) lines.push(line("tags", entry.tags.join(", ")));
  for (const p of problems) lines.push(`*${p}*`);
  return { public: lines.join("  \n"), secret: "" };
}
