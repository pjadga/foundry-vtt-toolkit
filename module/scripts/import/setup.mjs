/**
 * Layout rules for setting up imported scenes (NPC tokens, the journal pin). No Foundry globals, so
 * it can be tested with `node --test`.
 */
import { findLinks } from "./parser.mjs";

/** Names in a field: its [[links]], or, with none, its comma-separated parts. */
export function namesIn(field) {
  const text = String(field ?? "");
  const links = findLinks(text);
  if (links.length) return links;
  return [...new Set(text.split(/[,;\n]/).map(s => s.replace(/^[\s*-]+|\s+$/g, "")).filter(Boolean))];
}

/**
 * Top-left positions for `count` tokens of `size` pixels in rows across the lower middle of a
 * scene, a token's width apart, wrapping to new rows when one is full.
 * @returns {{x: number, y: number}[]}
 */
export function tokenPositions(count, { width, height, size = 100 }) {
  const step = Math.round(size * 1.25);
  const perRow = Math.max(1, Math.floor((width * 0.8) / step));
  const out = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const left = Math.round(width / 2 - (inRow * step) / 2 + (step - size) / 2);
    const x = left + (i % perRow) * step;
    const y = Math.round(height * 0.62) + row * step;
    out.push({ x: Math.max(0, Math.min(width - size, x)), y: Math.max(0, Math.min(height - size, y)) });
  }
  return out;
}

/** Where the scene's journal pin goes: the top-left corner, clear of the edge. */
export function notePosition({ width, height }) {
  const margin = Math.round(Math.min(width, height) * 0.06);
  return { x: margin, y: margin };
}
