/**
 * NotebookLM "table", "cards" and "encounter" entries: the parts that need no Foundry globals, so
 * they can be tested with `node --test`. The Foundry side is in kinds-import.mjs.
 *
 *   table:     formula ("1d6"), results (numbered lines, "1. ..." or "2-3. ...")
 *   cards:     stack_type (deck, hand or pile), cards (numbered lines, "1. Name: what it does")
 *   encounter: combatants ("[[Concord Response Guard]] x3, [[Ada Reyes]]")
 * A scene uses them with `encounter:`, `tables:` and `card_stacks:` ([[links]]).
 */
import { findLinks } from "./parser.mjs";

/** Numbered lines -> [{from, to, text}]; bullets and unnumbered lines count on from the last. */
function numbered(text) {
  const out = [];
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.trim().replace(/^[-*•+]\s+/, "");
    if (!line) continue;
    const m = line.match(/^(\d+)(?:\s*[-–—]\s*(\d+))?\s*[.):]\s*(.+)$/);
    const next = (out.at(-1)?.to ?? 0) + 1;
    if (m) {
      const from = Number(m[1]);
      out.push({ from, to: Math.max(from, Number(m[2] ?? m[1])), text: m[3].trim() });
    } else out.push({ from: next, to: next, text: line });
  }
  return out;
}

/**
 * A rollable table's results and formula. Ranges come from the numbers ("2-3." covers 2 and 3); the
 * formula is the entry's own when it has one, else one die that covers every result ("1d6").
 * @returns {{formula: string, results: {range: [number, number], text: string}[]}}
 */
export function tableResults(fields) {
  const lines = numbered(fields.results);
  const results = lines.map(l => ({ range: [l.from, l.to], text: l.text }));
  const top = Math.max(0, ...lines.map(l => l.to));
  const own = String(fields.formula ?? "").trim().replace(/^d/i, "1d");
  const formula = /^\d*d\d+([+-]\d+)?$/i.test(own) ? own : top ? `1d${top}` : "1d6";
  return { formula, results };
}

/**
 * A card stack's cards and type. "1. Ambush: the crew is jumped" -> {name: "Ambush", text: "the crew
 * is jumped"}; a card with no colon is all name.
 * @returns {{type: "deck"|"hand"|"pile", cards: {name: string, text: string}[]}}
 */
export function cardLines(fields) {
  const type = ["deck", "hand", "pile"].find(t => String(fields.stack_type ?? "").toLowerCase().includes(t)) ?? "deck";
  const cards = numbered(fields.cards).map(({ text }) => {
    const m = text.match(/^(.+?)\s*[:–—]\s+(.+)$/);
    return m ? { name: m[1].replace(/\*\*/g, "").trim(), text: m[2].trim() } : { name: text.replace(/\*\*/g, "").trim(), text: "" };
  });
  return { type, cards };
}

/**
 * An encounter's combatants: each [[NPC]] with how many ("x3", "×3", "(3)" or "3 x" around it).
 * @returns {{name: string, count: number}[]}
 */
export function combatantCounts(text) {
  const out = [];
  for (const part of String(text ?? "").split(/[,;\n]/)) {
    const [name] = findLinks(part);
    if (!name) continue;
    const m = part.match(/(?:[x×]\s*(\d+))|(?:\((\d+)\))|(?:(\d+)\s*[x×]\s*\[\[)/i);
    const count = Math.min(20, Math.max(1, Number(m?.[1] ?? m?.[2] ?? m?.[3] ?? 1)));
    const same = out.find(c => c.name === name);
    if (same) same.count += count;
    else out.push({ name, count });
  }
  return out;
}

/**
 * Tokens to add so a scene has `count` of each combatant: how many more of each actor, given the
 * tokens of each it already has.
 * @param {{name: string, count: number}[]} wanted
 * @param {(name: string) => number} have
 * @returns {{name: string, add: number}[]}
 */
export function tokensToAdd(wanted, have) {
  return wanted.map(({ name, count }) => ({ name, add: Math.max(0, count - have(name)) })).filter(t => t.add > 0);
}
