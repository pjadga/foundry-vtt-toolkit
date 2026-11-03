import test from "node:test";
import assert from "node:assert/strict";
import { parseAmount, characterStats, characterSkills, roleRank, ledgers, lifepath, characterNotes, DEFAULT_STAT, DEFAULT_RANK } from "../module/scripts/systems/cpred-character.mjs";
import { parseBundle } from "../module/scripts/import/parser.mjs";

const character = (fields = {}, body = "") => ({ type: "character", name: "Test", tags: [], fields, body, links: [] });
const noGear = { matched: [], missing: [] };

test("amounts: eddies with commas and units, negatives, and nothing", () => {
  assert.equal(parseAmount("2,500 eb"), 2500);
  assert.equal(parseAmount("12,000,000eb"), 12000000);
  assert.equal(parseAmount("-3"), -3);
  assert.equal(parseAmount("about 40 IP"), 40);
  assert.equal(parseAmount("none"), null);
  assert.equal(parseAmount(undefined), null);
});

test("stats: the entry's values, clamped, with the default for any left out", () => {
  const { stats, unknown, missing } = characterStats(character({ stats: "INT 7, REF 8, DEX 6, TECH 4, COOL 7, WILL 6, LUCK 5, MOVE 6, BODY 12, Charm 3" }));
  assert.equal(stats.ref, 8);
  assert.equal(stats.body, 10);
  assert.equal(stats.emp, DEFAULT_STAT);
  assert.deepEqual(unknown, ["Charm"]);
  assert.deepEqual(missing, ["emp"]);
});

test("skills: only the listed ones, clamped to 10, with no tier defaults", () => {
  assert.deepEqual(characterSkills(character({ skills: "Handgun 6, Evasion +5, Basic Tech 12" })), [
    { name: "Handgun", level: 6 }, { name: "Evasion", level: 5 }, { name: "Basic Tech", level: 10 }
  ]);
  assert.deepEqual(characterSkills(character()), []);
});

test("role rank: given, clamped, or a starting character's 4", () => {
  assert.equal(roleRank(character({ role_rank: "6" })), 6);
  assert.equal(roleRank(character({ role_rank: "Rank 12" })), 10);
  assert.equal(roleRank(character()), DEFAULT_RANK);
});

test("ledgers and lifepath map to the sheet's fields", () => {
  const entry = character({ eddies: "2,500 eb", improvement_points: "15", reputation: "2", cultural_origin: "North American", feelings_about_people: "Tools to be used", life_goals: "Get out of Night City" });
  assert.deepEqual(ledgers(entry), { wealth: 2500, improvementPoints: 15, reputation: 2 });
  assert.deepEqual(lifepath(entry), { culturalOrigin: "North American", aboutPeople: "Tools to be used", lifeGoals: "Get out of Night City" });
});

test("notes list only what has no place on the sheet, plus gear and problems", () => {
  const entry = character({ player: "SouL", role: "Solo", stats: "REF 8", eddies: "500", personality: "Loner", relationship_to_player: "is the player", secret_debt: "Owes Rook 5,000 eb" });
  entry.tags = ["pc"];
  const notes = characterNotes(entry, { matched: [{ wanted: "Militech Heavy Pistol", name: "Heavy Pistol", exact: false }, { wanted: "Kevlar", name: "Kevlar", exact: true }], missing: ["Lucky Coin"] }, ["Skill \"Hacking\" is not a core skill; add it by hand."]);
  assert.equal(notes.secret, "");
  assert.match(notes.public, /\*\*Relationship to player:\*\* is the player/);
  assert.match(notes.public, /\*\*Secret debt:\*\* Owes Rook 5,000 eb/);
  assert.match(notes.public, /Militech Heavy Pistol \(sheet: Heavy Pistol\)/);
  assert.doesNotMatch(notes.public, /sheet: Kevlar/);
  assert.match(notes.public, /\[\[Lucky Coin\]\]/);
  assert.match(notes.public, /\*\*Tags:\*\* pc/);
  assert.match(notes.public, /Hacking/);
  for (const handled of ["Player", "Role", "Stats", "Eddies", "Personality"]) assert.doesNotMatch(notes.public, new RegExp(`\\*\\*${handled}:`));
  assert.equal(characterNotes(character(), noGear).public, "");
});

test("a character entry from NotebookLM parses with its fields", () => {
  const { entries: [entry] } = parseBundle([
    "##ENTRY",
    "type: character",
    "name: Kija Choe",
    "tags: pc",
    "player: SouL",
    "role: Solo",
    "role_rank: 4",
    "stats: INT 6, REF 8, DEX 7, TECH 5, COOL 7, WILL 6, LUCK 5, MOVE 6, BODY 7, EMP 5",
    "skills: Handgun 6, Evasion 6, Perception 4",
    "gear: [[Heavy Pistol]], [[Kevlar]]",
    "eddies: 500 eb",
    "cultural_origin: Korean",
    "##BODY",
    "Grew up in Kabuki.",
    "##END"
  ].join("\n"));
  assert.equal(entry.type, "character");
  assert.equal(entry.fields.player, "SouL");
  assert.equal(roleRank(entry), 4);
  assert.equal(characterStats(entry).stats.ref, 8);
  assert.deepEqual(ledgers(entry), { wealth: 500 });
  assert.deepEqual(lifepath(entry), { culturalOrigin: "Korean" });
});
