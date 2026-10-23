import { test } from "node:test";
import assert from "node:assert/strict";
import { attackKind, rangeDV, shouldDodge, hits, natural, criticalInjury, damageEffect, resolutionLine } from "../module/scripts/narration/rules.mjs";

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

test("resolutionLine", () => {
  assert.equal(resolutionLine({ attacker: "Player One", weapon: "Assault Rifle", total: 9, defence: { type: "dv", value: 16, distance: 6.6 }, result: "miss" }), "Player One's Assault Rifle: 9 vs DV 16 at 7 m");
  assert.equal(resolutionLine({ attacker: "Alloy", weapon: "Katana", total: 15, defence: { type: "evasion", value: 12, name: "Rook" }, result: "hit" }), "Alloy's Katana: 15 vs Rook's Evasion 12");
});
