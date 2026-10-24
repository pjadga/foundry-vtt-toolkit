import { test } from "node:test";
import assert from "node:assert/strict";
import { attackKind, rangeDV, shouldDodge, hits, natural, criticalInjury, damageEffect, attackFacts, damageDetail, resolutionLine } from "../module/scripts/narration/rules.mjs";

const RIFLE = [
  { range: [0, 6], dv: "17" },
  { range: [7, 12], dv: "16" },
  { range: [13, 25], dv: "15" },
  { range: [26, 50], dv: "13" },
  { range: [51, 100], dv: "15" },
  { range: [101, 200], dv: "20" },
  { range: [201, 400], dv: "25" },
  { range: [401, 800], dv: "30" }
];

test("attackKind sorts weapons into ranged, thrown and melee", () => {
  assert.equal(attackKind({ isRanged: true, weaponType: "assaultRifle" }), "ranged");
  assert.equal(attackKind({ isRanged: true, weaponType: "thrownWeapon" }), "thrown");
  assert.equal(attackKind({ isRanged: false, weaponType: "mediumMelee" }), "melee");
  assert.equal(attackKind({ isRanged: false, weaponType: "unarmed" }), "melee");
});

test("rangeDV reads the weapon's bands", () => {
  assert.equal(rangeDV(RIFLE, 6.4), 17);
  assert.equal(rangeDV(RIFLE, 6.6), 16);
  assert.equal(rangeDV(RIFLE, 30), 13);
  assert.equal(rangeDV(RIFLE, 900), null);
  assert.equal(rangeDV(RIFLE, NaN), null);
});

test("shouldDodge: REF 8+ and a better chance than the DV", () => {
  assert.equal(shouldDodge({ ref: 8, dex: 7, evasion: 6 }, 15), true);
  assert.equal(shouldDodge({ ref: 8, dex: 4, evasion: 2 }, 17), false);
  assert.equal(shouldDodge({ ref: 7, dex: 9, evasion: 9 }, 13), false);
});

test("the defender wins ties", () => {
  assert.equal(hits(16, 15), true);
  assert.equal(hits(15, 15), false);
  assert.equal(hits(9, 17), false);
});

test("natural 10s and 1s, and Critical Injuries", () => {
  assert.equal(natural(10), "critical");
  assert.equal(natural(1), "fumble");
  assert.equal(natural(6), null);
  assert.equal(criticalInjury([6, 6, 1]), true);
  assert.equal(criticalInjury([6, 4, 3, 3, 1]), false);
});

test("damageEffect: armor, melee halving, crit bonus", () => {
  assert.deepEqual(damageEffect({ damage: 18, sp: 4, hp: { value: 40 } }), { through: 14, stopped: false, ablates: true, hpAfter: 26 });
  assert.deepEqual(damageEffect({ damage: 3, sp: 4 }), { through: 0, stopped: true, ablates: false, hpAfter: null });
  assert.equal(damageEffect({ damage: 8, sp: 11, melee: true }).through, 2);
  assert.deepEqual(damageEffect({ damage: 3, sp: 4, crit: true, hp: { value: 10 } }), { through: 5, stopped: false, ablates: false, hpAfter: 5 });
});

test("attackFacts: fire mode, natural rolls, dodging", () => {
  assert.deepEqual(attackFacts({ mode: "single", natural: "critical", kind: "ranged", canDodge: false }), [
    "a single shot (one round, not a burst)",
    "a critical success: a natural 10 on the attack die",
    "the target can't dodge ranged attacks (REF under 8), so no dodging or sidestepping"
  ]);
  assert.deepEqual(attackFacts({ mode: "autofire", natural: null, kind: "ranged", canDodge: true }), ["autofire: a burst of rounds"]);
  assert.deepEqual(attackFacts({ mode: "melee", natural: "fumble", kind: "melee", canDodge: false }), ["a melee attack", "a fumble: a natural 1 on the attack die"]);
  // Resolutions saved before mode and canDodge existed.
  assert.deepEqual(attackFacts({ natural: null, kind: "ranged" }), []);
});

test("damageDetail names the armor and how much it stops", () => {
  const base = { location: "body", target: "NPC One" };
  assert.equal(damageDetail({ ...base, total: 6, armor: { name: "Armorjack Vest", sp: 11 }, through: 0, wounds: "unhurt" }), "6 damage to the body; the Armorjack Vest (SP 11) stops all of it; NPC One is now unhurt");
  assert.equal(damageDetail({ ...base, total: 19, armor: { name: "Leathers (Body)", sp: 4 }, through: 15, wounds: "lightly wounded" }), "19 damage to the body; most of it gets through the Leathers (SP 4): 15 damage; NPC One is now lightly wounded");
  assert.equal(damageDetail({ ...base, total: 14, armor: { name: "Kevlar", sp: 7 }, through: 7 }), "14 damage to the body; the Kevlar (SP 7) stops about half; 7 gets through");
  assert.equal(damageDetail({ ...base, total: 13, armor: { name: "Light Armorjack", sp: 11 }, through: 2 }), "13 damage to the body; the Light Armorjack (SP 11) stops most of it; only 2 gets through");
  assert.equal(damageDetail({ ...base, total: 8, armor: { name: "Armorjack Vest", sp: 11 }, melee: true, through: 2 }), "8 damage to the body; the Armorjack Vest (SP 11, halved by melee) stops most of it; only 2 gets through");
  assert.equal(damageDetail({ ...base, location: "head", total: 9, crit: true, armor: null, through: 14 }), "9 damage to the head; a Critical Injury (two 6s); no armor there, so all of it gets through");
});

test("resolutionLine", () => {
  assert.equal(resolutionLine({ attacker: "Player One", weapon: "Assault Rifle", total: 9, defence: { type: "dv", value: 16, distance: 6.6 }, result: "miss" }), "Player One's Assault Rifle: 9 vs DV 16 at 7 m");
  assert.equal(resolutionLine({ attacker: "Alloy", weapon: "Katana", total: 15, defence: { type: "evasion", value: 12, name: "Rook" }, result: "hit" }), "Alloy's Katana: 15 vs Rook's Evasion 12");
});
