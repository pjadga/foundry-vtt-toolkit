import { test } from "node:test";
import assert from "node:assert/strict";
import { woundState, chatLog, previousLines, narrationPrompt, parseNarration, repeatsEarlier, missNarrations } from "../module/scripts/narration/prompt.mjs";

test("woundState follows Cyberpunk RED's thresholds", () => {
  assert.equal(woundState({ value: 40, max: 40 }), "unhurt");
  assert.equal(woundState({ value: 25, max: 40 }), "lightly wounded");
  assert.equal(woundState({ value: 19, max: 40 }), "seriously wounded");
  assert.equal(woundState({ value: 0, max: 40 }), "mortally wounded");
  assert.equal(woundState(undefined), null);
});

test("chatLog keeps the latest messages, squashed", () => {
  const messages = Array.from({ length: 25 }, (_, i) => ({ speaker: `S${i}`, text: `line   ${i}` }));
  const log = chatLog([...messages, { speaker: "X", text: "  " }], 3).split("\n");
  assert.deepEqual(log, ["S22: line 22", "S23: line 23", "S24: line 24"]);
});

test("previousLines finds what an NPC said before", () => {
  const narrations = [{ lines: [{ speaker: "Rook", line: "Not today." }] }, { lines: [{ speaker: "rook", line: "Again?" }, { speaker: "Vex", line: "Run!" }] }];
  assert.deepEqual(previousLines(narrations, "Rook"), ["Not today.", "Again?"]);
});

test("narrationPrompt: a player attacking an NPC", () => {
  const prompt = narrationPrompt({
    system: "Cyberpunk RED",
    scene: "The Overlook",
    attacker: { name: "Alloy", isPC: true },
    targets: [{ name: "Rook", isPC: false, profile: "Gruff bodyguard, speaks in clipped sentences.", wounds: "seriously wounded", previousLines: ["Not today."] }],
    card: "Heavy Pistol attack REF 8 + Handgun 6 + 1d10 = 21",
    log: "Rook: Not today."
  });
  assert.match(prompt, /player character is attacking/);
  assert.match(prompt, /only from Rook/);
  assert.match(prompt, /seriously wounded/);
  assert.match(prompt, /never repeat or closely paraphrase these\): "Not today\."/);
  assert.match(prompt, /never say whether it hits/);
  assert.match(prompt, /Heavy Pistol attack/);
  assert.match(prompt, /\n\nATTACKER\n/);
});

test("narrationPrompt: misses and hits", () => {
  const base = { attacker: { name: "Alloy", isPC: true }, targets: [{ name: "Rook", isPC: false }], card: "Katana" };
  const miss = narrationPrompt({ ...base, outcome: { result: "miss", detail: "9 vs Rook's Evasion 14" } });
  assert.match(miss, /The attack MISSES \(9 vs Rook's Evasion 14\)/);
  assert.ok(!miss.includes("never say whether it hits"));
  const hit = narrationPrompt({ ...base, round: "Round 2, Alloy's turn", outcome: { result: "hit", detail: "18 damage to the body, Critical Injury; Rook is now seriously wounded" } });
  assert.match(hit, /The attack HITS \(18 damage/);
  assert.match(hit, /COMBAT: Round 2, Alloy's turn/);
  assert.match(miss, /only if the detail says they dodge/);
  assert.ok(!miss.includes("the target ducks"));
  assert.match(hit, /a single shot is one round, never a burst or spray/);
  assert.match(hit, /the armor by its name and how much it stops/);
});

test("missNarrations finds a miss's narration to retract", () => {
  const messages = [
    { id: "a", narration: { result: "miss", source: "atk1" } },
    { id: "b", narration: { result: "hit", source: "dmg1" } },
    { id: "c", narration: { result: "miss", source: "atk2" } },
    { id: "d" },
    { id: "e", narration: { result: "miss", source: "atk1", review: true } }
  ];
  assert.deepEqual(missNarrations(messages, "atk1"), ["a", "e"]);
  assert.deepEqual(missNarrations(messages, "none"), []);
});

test("narrationPrompt: an NPC attacking", () => {
  const prompt = narrationPrompt({ attacker: { name: "Rook", isPC: false }, targets: [{ name: "Alloy", isPC: true }], card: "Assault Rifle autofire" });
  assert.match(prompt, /An NPC is attacking/);
  assert.match(prompt, /only from Rook\./);
  assert.ok(!prompt.includes("SCENE:"));
});

test("parseNarration keeps allowed, new lines only", () => {
  const speakers = [{ name: "Rook", previousLines: ["Not today."] }, { name: "Vex" }];
  const text = JSON.stringify({
    narration: "Alloy's pistol barks twice.",
    lines: [{ speaker: "Rook", line: "Not today!" }, { speaker: "Alloy", line: "Take that." }, { speaker: "vex", line: "“Cover me!”" }, { speaker: "Vex", line: "Again!" }]
  });
  assert.deepEqual(parseNarration(text, speakers), { narration: "Alloy's pistol barks twice.", lines: [{ speaker: "Vex", line: "Cover me!" }] });
  assert.deepEqual(parseNarration("not json", speakers), { narration: "not json", lines: [] });
});

test("repeatsEarlier spots copied wording", () => {
  const earlier = ["Player One swings the heavy barrel of an assault rifle around a rusted chassis, unleashing brass."];
  assert.equal(repeatsEarlier("Again, Player One swings the heavy barrel of an assault rifle at him.", earlier), true);
  assert.equal(repeatsEarlier("Player One fires a tight burst from cover.", earlier), false);
  const prompt = narrationPrompt({ attacker: { name: "A", isPC: true }, targets: [], card: "x", earlier, strict: true });
  assert.match(prompt, /EARLIER NARRATION/);
  assert.match(prompt, /Your last answer copied it/);
});
