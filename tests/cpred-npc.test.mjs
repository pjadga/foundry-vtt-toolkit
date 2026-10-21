import test from "node:test";
import assert from "node:assert/strict";
import { parseStats, parseSkills, buildStats, buildSkills, derivedStats, matchGear, npcNotes, tierOf } from "../module/scripts/systems/cpred-npc.mjs";

const npc = (fields = {}, body = "") => ({ type: "npc", name: "Test", tags: [], fields, body, links: [] });

// Names as they appear in the Cyberpunk RED Core 0.93 compendiums.
const index = [
  ["Heavy Pistol", "weapon"], ["Very Heavy Pistol", "weapon"], ["Very Heavy Melee", "weapon"], ["Assault Rifle", "weapon"],
  ["Grenade Launcher", "weapon"], ["Kevlar® (Body)", "armor"], ["Kevlar® (Head)", "armor"], ["Light Armorjack (Body)", "armor"],
  ["Metalgear® (Body)", "armor"], ["Subdermal Armor", "armor"], ["Agent", "gear"], ["Popup Shield", "cyberware"],
  ["Targeting Scope", "cyberware"], ["Cyberarm", "cyberware"], ["Wolvers", "cyberware"], ["Armor", "program"], ["Speedheal", "drug"],
  ["Heavy SMG", "weapon"], ["Popup Grenade Launcher", "cyberware"], ["Medtech Bag", "gear"]
].map(([name, type]) => ({ name, type, uuid: `Compendium.x.${name}` }));
const match = name => matchGear(name, index)?.name ?? null;

test("tier defaults: combat tiers get +1 REF, DEX and BODY; unknown tier falls back to mook", () => {
  assert.equal(tierOf(npc({ tier: "Non-Combatant" })), "non-combatant");
  assert.equal(tierOf(npc({ tier: "mini-boss" })), "mook");
  const { stats } = buildStats(npc({ tier: "lieutenant" }));
  assert.equal(stats.int, 6);
  assert.equal(stats.ref, 7);
  assert.equal(buildStats(npc({ tier: "non-combatant" })).stats.ref, 4);
});

test("a stats line overrides the tier and is clamped", () => {
  assert.deepEqual(parseStats("INT 6, REF: 8, Body=7, Charm 3"), { stats: { int: 6, ref: 8, body: 7 }, unknown: ["Charm"] });
  const { stats, unknown } = buildStats(npc({ tier: "boss", stats: "REF 12, EMP 2, Charm 3" }));
  assert.equal(stats.ref, 10);
  assert.equal(stats.emp, 2);
  assert.equal(stats.cool, 7);
  assert.deepEqual(unknown, ["Charm"]);
});

test("skills line adds to and overrides tier skills", () => {
  assert.deepEqual(parseSkills("Handgun 6, Melee Weapon: 4; Stealth +3"), [["Handgun", 6], ["Melee Weapon", 4], ["Stealth", 3]]);
  const skills = buildSkills(npc({ tier: "boss", skills: "Handgun 10, Interrogation 6" }));
  assert.equal(skills.find(s => s.name === "Handgun").level, 10);
  assert.equal(skills.find(s => s.name === "Evasion").level, 8);
  assert.equal(skills.find(s => s.name === "Interrogation").level, 6);
});

test("derived stats use the rulebook formulas, including cyberware Humanity Loss", () => {
  assert.deepEqual(derivedStats({ body: 7, will: 6, emp: 5 }), { hp: 45, humanity: 50, humanityMax: 50, emp: 5 });
  assert.deepEqual(derivedStats({ body: 8, will: 7, emp: 7 }, 7), { hp: 50, humanity: 63, humanityMax: 70, emp: 6 });
  assert.equal(derivedStats({ body: 4, will: 4, emp: 1 }, 25).emp, -2);
});

test("gear matching: exact, armor aliases, multi-word partials only", () => {
  assert.equal(match("Subdermal Armor"), "Subdermal Armor");
  assert.equal(match("Kevlar Vest"), "Kevlar® (Body)");
  assert.equal(match("Armorjack Vest"), "Light Armorjack (Body)");
  assert.equal(match("Heavy Metal Chestplate"), "Metalgear® (Body)");
  assert.equal(match("Militech Heavy Pistol"), "Heavy Pistol");
  assert.equal(match("Custom Very Heavy Pistol"), "Very Heavy Pistol");
  assert.equal(match("Cyberarm with Popup Shield"), "Popup Shield");
  assert.equal(match("Very Heavy Melee Weapon"), "Very Heavy Melee");
  // Term aliases.
  assert.equal(match("Heavy Submachine Gun"), "Heavy SMG");
  assert.equal(match("Pop-up Grenade Launcher"), "Popup Grenade Launcher");
  assert.equal(match("Medtech Trauma Kit"), "Medtech Bag");
  assert.equal(match("Combat Medical Kit"), "Medtech Bag");
  assert.equal(matchGear("Pop-up Grenade Launcher", index).exact, false);
  // Single-word partials are not trusted.
  assert.equal(match("Agent with AR Glasses"), null);
  assert.equal(match("Multi-Tool Cyberarm"), null);
  assert.equal(match("Armor Plating"), null);
});

test("notes keep secrets out of the public part", () => {
  const entry = npc({ role: "Fixer", tier: "lieutenant", appearance: "Tall", what_they_want: "Money", gear: "[[Kevlar Vest]]" }, "Backstory.");
  const notes = npcNotes(entry, { matched: [{ wanted: "Kevlar Vest", name: "Kevlar® (Body)", exact: false }], missing: ["Pocket Camera"] }, ["Skill \"X\" missing."]);
  assert.match(notes.public, /\*\*Role:\*\* Fixer/);
  assert.match(notes.public, /Backstory\./);
  assert.doesNotMatch(notes.public, /Money|Kevlar/);
  assert.match(notes.secret, /\*\*What they want:\*\* Money/);
  assert.match(notes.secret, /Kevlar Vest \(sheet: Kevlar® \(Body\)\)/);
  assert.match(notes.secret, /\[\[Pocket Camera\]\]/);
  assert.match(notes.secret, /Skill "X" missing/);
});
