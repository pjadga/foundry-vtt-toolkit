/**
 * Cyberpunk RED item import: the parts that need no Foundry globals, so they can be tested with
 * `node --test`. The Foundry side is in cpred.mjs.
 */
import { normalizeName, humanize } from "../import/parser.mjs";

// NotebookLM "category" -> Cyberpunk RED item type.
const CATEGORY_TYPES = {
  weapon: "weapon",
  armor: "armor",
  armour: "armor",
  cyberware: "cyberware",
  gear: "gear",
  drug: "drug",
  clothing: "clothing",
  ammo: "ammo",
  ammunition: "ammo",
  program: "program",
  cyberdeck: "cyberdeck",
  vehicle: "vehicle",
  upgrade: "itemUpgrade"
};

/** CPR item type for an entry: its category, else a tag that names a category, else gear. */
export function itemType(entry) {
  const category = normalizeName(entry.fields.category ?? "");
  if (CATEGORY_TYPES[category]) return CATEGORY_TYPES[category];
  const tag = entry.tags.map(t => normalizeName(t)).find(t => CATEGORY_TYPES[t]);
  return tag ? CATEGORY_TYPES[tag] : "gear";
}

/** "1,000 eb" -> 1000; null when there is no number. */
export function parsePrice(text) {
  const m = String(text ?? "").replace(/,/g, "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** "3d6" or "2d6+2" -> normalized string; null when it is not a dice formula. */
export function parseDamage(text) {
  const m = String(text ?? "").replace(/\s+/g, "").toLowerCase().match(/^(\d+d\d+)([+-]\d+)?$/);
  return m ? m[1] + (m[2] ?? "") : null;
}

/** Positive integer from "2", "ROF 2"; null otherwise. */
export function parseInteger(text) {
  const m = String(text ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

/**
 * Armor penalty. The system has one number that applies to REF, DEX and MOVE, so "-2 MOVE, -2 REF"
 * becomes 2 (the largest). "none" or blank becomes 0.
 */
export function parsePenalty(text) {
  const nums = [...String(text ?? "").matchAll(/\d+/g)].map(m => Number(m[0]));
  return nums.length ? Math.max(...nums) : 0;
}

/** "7 (2d6)" -> {static: 7, roll: "2d6"}; either part may be missing. */
export function parseHumanityLoss(text) {
  const s = String(text ?? "");
  const roll = s.match(/\d+d\d+/i)?.[0].toLowerCase() ?? null;
  const fixed = s.replace(/\d+d\d+/gi, "").match(/\d+/)?.[0];
  return { static: fixed != null ? Number(fixed) : null, roll };
}

const isHeadArmor = entry => /\b(head|helmet|hood|mask)\b/.test(normalizeName(`${entry.name} ${entry.tags.join(" ")}`));

/**
 * The system-data changes an entry makes on top of its template item, as flat dotted keys, plus
 * the fields it used and anything it could not apply.
 * @param {object} entry
 * @param {string} type CPR item type (from itemType).
 * @param {boolean} hasTemplate Whether a compendium item is being used as the base.
 * @returns {{changes: Record<string, *>, used: string[], problems: string[]}}
 */
export function itemChanges(entry, type, hasTemplate) {
  const f = entry.fields;
  const changes = {};
  const used = ["category"];
  const problems = [];
  const take = (field, apply) => {
    if (f[field] == null || f[field] === "") return;
    used.push(field);
    if (apply(f[field]) === false) problems.push(`Could not read ${humanize(field).toLowerCase()} "${f[field]}"; kept the ${hasTemplate ? "template's" : "default"} value.`);
  };

  take("price", v => {
    const n = parsePrice(v);
    if (n == null) return false;
    changes["price.market"] = n;
  });

  if (type === "weapon" || f.damage) {
    take("damage", v => {
      const d = parseDamage(v);
      if (!d) return false;
      changes.damage = d;
    });
    take("rate_of_fire", v => {
      const n = parseInteger(v);
      if (n == null) return false;
      changes.rof = n;
    });
    take("range_or_melee", v => {
      const ranged = /range|ranged|shoot|gun/i.test(v);
      const melee = /melee/i.test(v);
      if (!ranged && !melee) return false;
      changes.isRanged = ranged;
      if (!hasTemplate) changes.weaponSkill = ranged ? "Handgun" : "Melee Weapon";
    });
  }

  if (type === "armor") {
    const location = isHeadArmor(entry) ? "headLocation" : "bodyLocation";
    take("sp", v => {
      const n = parseInteger(v);
      if (n == null) return false;
      changes[`${location}.sp`] = n;
      changes[location === "headLocation" ? "isHeadLocation" : "isBodyLocation"] = true;
    });
    take("penalty", v => {
      changes.penalty = parsePenalty(v);
    });
  }

  if (type === "cyberware") {
    take("humanity_loss", v => {
      const hl = parseHumanityLoss(v);
      if (hl.static == null && !hl.roll) return false;
      if (hl.static != null) changes["humanityLoss.static"] = hl.static;
      if (hl.roll) changes["humanityLoss.roll"] = hl.roll;
    });
  }

  return { changes, used, problems };
}

/**
 * Markdown for the item description: public text, and a GM-only section with the remaining
 * fields, what the item was based on and any problems.
 * @param {object} entry
 * @param {string[]} used Fields already applied to the item data.
 * @param {string|null} templateName Compendium item used as the base.
 * @param {string[]} problems
 * @returns {{public: string, secret: string}}
 */
export function itemDescription(entry, used, templateName, problems = []) {
  const line = (k, v) => `**${humanize(k)}:** ${String(v).replace(/\n/g, " ")}`;
  const pub = [];
  if (entry.fields.effect) pub.push(line("effect", entry.fields.effect));
  if (entry.body) pub.push(entry.body);

  const secret = Object.entries(entry.fields)
    .filter(([k]) => !used.includes(k) && k !== "effect" && k !== "too_strong_flag")
    .map(([k, v]) => line(k, v));
  if (/^y/i.test(entry.fields.too_strong_flag ?? "")) secret.push("**NotebookLM flagged this item as possibly too strong.** Check it before play.");
  secret.push(templateName ? `*Based on the compendium item ${templateName}.*` : "*No matching compendium item; built from the item type's defaults.*");
  for (const p of problems) secret.push(`*${p}*`);
  if (entry.tags.length) secret.push(line("tags", entry.tags.join(", ")));
  return { public: pub.join("\n\n"), secret: secret.join("  \n") };
}
