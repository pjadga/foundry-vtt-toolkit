import test from "node:test";
import assert from "node:assert/strict";
import { itemType, parsePrice, parseDamage, parsePenalty, parseHumanityLoss, itemChanges, itemDescription } from "../module/scripts/systems/cpred-items.mjs";

const item = (name, fields = {}, tags = [], body = "") => ({ type: "item", name, tags, fields, body, links: [] });

test("item type from category, then tags, else gear", () => {
  assert.equal(itemType(item("X", { category: "Weapon" })), "weapon");
  assert.equal(itemType(item("X", { category: "armour" })), "armor");
  assert.equal(itemType(item("X", { category: "upgrade" })), "itemUpgrade");
  assert.equal(itemType(item("X", {}, ["cyberpunk-red", "cyberware"])), "cyberware");
  assert.equal(itemType(item("X", { category: "trinket" })), "gear");
});

test("value parsers", () => {
  assert.equal(parsePrice("1,000 eb"), 1000);
  assert.equal(parsePrice("priceless"), null);
  assert.equal(parseDamage("3D6"), "3d6");
  assert.equal(parseDamage("2d6 + 2"), "2d6+2");
  assert.equal(parseDamage("lots"), null);
  assert.equal(parsePenalty("-2 MOVE, -2 REF"), 2);
  assert.equal(parsePenalty("none"), 0);
  assert.deepEqual(parseHumanityLoss("7 (2d6)"), { static: 7, roll: "2d6" });
  assert.deepEqual(parseHumanityLoss("2d6"), { static: null, roll: "2d6" });
  assert.deepEqual(parseHumanityLoss("14"), { static: 14, roll: null });
});

test("weapon changes", () => {
  const { changes, problems } = itemChanges(item("Militech Heavy Pistol", { category: "weapon", price: "100 eb", damage: "3d6", rate_of_fire: "2", range_or_melee: "range" }), "weapon", true);
  assert.deepEqual(changes, { "price.market": 100, damage: "3d6", rof: 2, isRanged: true });
  assert.deepEqual(problems, []);
  // Without a template a melee weapon also gets the melee skill.
  assert.equal(itemChanges(item("Blade", { range_or_melee: "melee" }), "weapon", false).changes.weaponSkill, "Melee Weapon");
});

test("armor changes go to the body or head location", () => {
  const body = itemChanges(item("Heavy Metal Chestplate", { sp: "13", penalty: "-2 MOVE, -2 REF" }), "armor", true);
  assert.deepEqual(body.changes, { "bodyLocation.sp": 13, isBodyLocation: true, penalty: 2 });
  const head = itemChanges(item("Kevlar Helmet", { sp: "7" }), "armor", true);
  assert.deepEqual(head.changes, { "headLocation.sp": 7, isHeadLocation: true });
});

test("cyberware Humanity Loss, and unreadable values are reported", () => {
  const { changes } = itemChanges(item("Wolvers", { humanity_loss: "7 (2d6)" }), "cyberware", true);
  assert.deepEqual(changes, { "humanityLoss.static": 7, "humanityLoss.roll": "2d6" });
  const bad = itemChanges(item("Odd Gun", { damage: "huge", price: "ask" }), "weapon", false);
  assert.deepEqual(bad.changes, {});
  assert.equal(bad.problems.length, 2);
  assert.match(bad.problems[0], /price "ask"; kept the default value/);
});

test("description keeps GM fields secret and flags strong items", () => {
  const entry = item("Key", { category: "gear", price: "1000 eb", story_item: "yes", too_strong_flag: "yes", effect: "Opens the vault." }, ["story-item"], "Recovered from [[Relay Station]].");
  const { used } = itemChanges(entry, "gear", false);
  const d = itemDescription(entry, used, null, []);
  assert.match(d.public, /\*\*Effect:\*\* Opens the vault\./);
  assert.match(d.public, /\[\[Relay Station\]\]/);
  assert.doesNotMatch(d.public, /Story item|1000/);
  assert.match(d.secret, /\*\*Story item:\*\* yes/);
  assert.match(d.secret, /possibly too strong/);
  assert.match(d.secret, /No matching compendium item/);
  assert.doesNotMatch(d.secret, /Price|Category/);
  assert.match(itemDescription(entry, used, "Agent").secret, /Based on the compendium item Agent/);
});
