import test from "node:test";
import assert from "node:assert/strict";
import { tableResults, cardLines, combatantCounts, tokensToAdd } from "../module/scripts/import/kinds.mjs";
import { parseBundle, LIST_FIELDS } from "../module/scripts/import/parser.mjs";
import { campaignCheck } from "../module/scripts/import/check.mjs";

const bundle = `##ENTRY
type: table
name: Street Rumours
tags: rumours
formula: 1d6
results:
1. A courier saw something.
2-3. Nobody talks.
- bullet: a bulleted result
##BODY
Roll when the crew asks around.
##END
##ENTRY
type: cards
name: Fate Deck
tags: cards
stack_type: Deck
cards:
1. Ambush: the crew is jumped
2. **Windfall**: 500 eb
3. Blank
##BODY
Draw one per session.
##END
##ENTRY
type: encounter
name: Dock Fight
tags: fight
combatants: [[Concord Response Guard]] x3, [[Ada Reyes]], 2 x [[Concord Response Guard]]
##BODY
They hold the gate.
##END`;

test("list fields keep numbered and bulleted lines, even ones that look like fields", () => {
  assert.deepEqual(LIST_FIELDS, ["tracks", "results", "cards"]);
  const { entries } = parseBundle(bundle);
  assert.deepEqual(entries.map(e => e.type), ["table", "cards", "encounter"]);
  assert.match(entries[0].fields.results, /bullet: a bulleted result/);
  assert.match(entries[1].fields.cards, /3\. Blank/);
});

test("tableResults reads ranges and the formula", () => {
  const { entries } = parseBundle(bundle);
  const { formula, results } = tableResults(entries[0].fields);
  assert.equal(formula, "1d6");
  assert.deepEqual(results.map(r => r.range), [[1, 1], [2, 3], [4, 4]]);
  assert.equal(results[2].text, "bullet: a bulleted result");
  assert.equal(tableResults({ results: "1. a\n2. b\n3. c" }).formula, "1d3");
  assert.equal(tableResults({ formula: "d10", results: "1. a" }).formula, "1d10");
  assert.equal(tableResults({ formula: "roll it", results: "1. a\n2. b" }).formula, "1d2");
  assert.equal(tableResults({}).formula, "1d6");
});

test("cardLines splits names from effects and reads the stack type", () => {
  const { entries } = parseBundle(bundle);
  assert.deepEqual(cardLines(entries[1].fields), {
    type: "deck",
    cards: [{ name: "Ambush", text: "the crew is jumped" }, { name: "Windfall", text: "500 eb" }, { name: "Blank", text: "" }]
  });
  assert.equal(cardLines({ stack_type: "a hand of cards" }).type, "hand");
  assert.equal(cardLines({}).type, "deck");
});

test("combatantCounts adds up each NPC's count", () => {
  const { entries } = parseBundle(bundle);
  assert.deepEqual(combatantCounts(entries[2].fields.combatants), [{ name: "Concord Response Guard", count: 5 }, { name: "Ada Reyes", count: 1 }]);
  assert.deepEqual(combatantCounts("[[A]] ×2; [[B]] (4)\n[[C]]"), [{ name: "A", count: 2 }, { name: "B", count: 4 }, { name: "C", count: 1 }]);
  assert.deepEqual(combatantCounts("[[A]] x99"), [{ name: "A", count: 20 }]);
  assert.deepEqual(tokensToAdd([{ name: "A", count: 3 }, { name: "B", count: 1 }], n => (n === "A" ? 1 : 2)), [{ name: "A", add: 2 }]);
});

test("campaignCheck ties tables, card stacks and encounters to scenes", () => {
  const scene = (fields = {}) => `##ENTRY
type: scene
name: Gate Night
tags: s
session: 1
location: [[Docks]]
npcs_present: [[Concord Response Guard]]
soundtrack: [[Tension]]
visual: Rain on the gate.
${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("\n")}
##BODY
x
##END`;
  const rest = `##ENTRY
type: location
name: Docks
tags: l
visual: Wet concrete.
##BODY
x
##END
##ENTRY
type: playlist
name: Tension
tags: p
tracks:
1. Dark synth
##BODY
x
##END
##ENTRY
type: npc
name: Concord Response Guard
tags: n
##BODY
x
##END
##ENTRY
type: npc
name: Ada Reyes
tags: n
##BODY
x
##END`;
  const unused = campaignCheck(parseBundle(`${bundle}\n${scene()}\n${rest}`).entries).map(i => `${i.entry}: ${i.problem}`);
  assert.ok(unused.includes("Street Rumours: rollable table is used by no scene (add it to a scene's tables: field)"));
  assert.ok(unused.includes("Fate Deck: card stack is used by no scene (add it to a scene's card_stacks: field)"));
  assert.ok(unused.includes("Dock Fight: encounter is used by no scene (add it to a scene's encounter: field)"));
  const used = campaignCheck(parseBundle(`${bundle}\n${scene({ encounter: "[[Dock Fight]]", tables: "[[Street Rumours]]", card_stacks: "[[Fate Deck]]" })}\n${rest}`).entries);
  assert.deepEqual(used, []);
  const wrong = campaignCheck(parseBundle(`${bundle}\n${scene({ encounter: "[[Street Rumours]]", tables: "[[Dock Fight]]", card_stacks: "[[Fate Deck]]" })}\n${rest}`).entries).map(i => i.problem);
  assert.ok(wrong.includes("encounter: [[Street Rumours]] is the table entry, not an encounter"));
  assert.ok(wrong.some(p => /tables: \[\[Dock Fight\]\] is the encounter entry/.test(p)));
  const empty = campaignCheck(parseBundle("##ENTRY\ntype: encounter\nname: Empty\ntags: x\ncombatants: [[Docks]]\n##BODY\nx\n##END\n" + rest).entries).map(i => i.problem);
  assert.ok(empty.includes("combatants: [[Docks]] is the location entry, not an NPC"));
});
