import { test } from "node:test";
import assert from "node:assert/strict";
import { namesIn, tokenPositions, notePosition } from "../module/scripts/import/setup.mjs";

test("namesIn prefers links, else comma-separated names", () => {
  assert.deepEqual(namesIn("[[Mama Rosa]], the [[Tyger Claws]] and [[Mama Rosa]]"), ["Mama Rosa", "Tyger Claws"]);
  assert.deepEqual(namesIn("Mama Rosa, Kenji; - Vex"), ["Mama Rosa", "Kenji", "Vex"]);
  assert.deepEqual(namesIn(undefined), []);
});

test("tokenPositions centres a row in the lower middle", () => {
  const [a, b] = tokenPositions(2, { width: 1000, height: 600, size: 100 });
  assert.equal(a.y, 372);
  assert.equal(b.x - a.x, 125);
  // Centred: the gap to the left edge matches the gap to the right edge.
  assert.ok(Math.abs(a.x - (1000 - (b.x + 100))) <= 1);
});

test("tokenPositions wraps and stays inside the scene", () => {
  const spots = tokenPositions(12, { width: 600, height: 400, size: 100 });
  assert.equal(spots.length, 12);
  assert.ok(new Set(spots.map(s => s.y)).size > 1);
  for (const { x, y } of spots) assert.ok(x >= 0 && x <= 500 && y >= 0 && y <= 300);
});

test("notePosition sits near the top-left corner", () => {
  assert.deepEqual(notePosition({ width: 1000, height: 500 }), { x: 30, y: 30 });
});
