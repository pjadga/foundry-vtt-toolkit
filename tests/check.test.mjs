import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBundle } from "../module/scripts/import/parser.mjs";
import { campaignCheck, fixPrompt } from "../module/scripts/import/check.mjs";

const bundle = `##ENTRY
type: location
name: The Overlook
visual: A tenement at night.
npcs: [[Mama Rosa]]
##BODY
Home base.
##END

##ENTRY
type: location
name: Empty Lot
##BODY
Nobody goes here.
##END

##ENTRY
type: npc
name: Mama Rosa
gear: [[Old Shotgun]]
##BODY
Runs the block.
##END

##ENTRY
type: npc
name: Loner
##BODY
Talks to no one.
##END

##ENTRY
type: item
name: Old Shotgun
##BODY
Loud.
##END

##ENTRY
type: item
name: Lost Chip
##BODY
Forgotten.
##END

##ENTRY
type: playlist
name: Street
tracks:
1. Darksynth groove
##BODY
Music.
##END

##ENTRY
type: scene
name: Siege
session: 3
location: [[The Overlook]]
npcs_present: [[Mama Rosa]], [[Ghost Gang]]
soundtrack: [[Street]]
visual: Mortars over the tenement.
##BODY
The defenders hold.
##END

##ENTRY
type: scene
name: Epilogue
location: [[Mama Rosa]]
##BODY
After.
##END`;

test("campaignCheck finds the gaps", () => {
  const issues = campaignCheck(parseBundle(bundle).entries);
  const text = issues.map(i => `${i.entry}: ${i.problem}`);
  assert.ok(text.some(t => t.startsWith("Siege: links to [[Ghost Gang]]")));
  assert.ok(text.includes("Loner: NPC is in no scene, location or thread"));
  assert.ok(text.some(t => t.startsWith("Lost Chip: item is never used")));
  assert.ok(!text.some(t => t.startsWith("Old Shotgun:")));
  assert.ok(text.includes("Empty Lot: location is never visited by a scene or thread"));
  assert.ok(text.includes("Empty Lot: location has no visual: line for its scene image"));
  assert.ok(!text.some(t => t.startsWith("The Overlook:")));
  // The epilogue needs no session, but does need the rest.
  assert.ok(text.includes("Epilogue: scene has no npcs_present, soundtrack, visual fields"));
  assert.ok(text.includes("Epilogue: location: [[Mama Rosa]] is the npc entry, not a location"));
  assert.ok(!text.some(t => t.startsWith("Siege: scene has no")));
});

test("campaignCheck uses what the world already has", () => {
  const entries = parseBundle(bundle).entries;
  const issues = campaignCheck(entries, { known: name => name === "Ghost Gang", linkedElsewhere: name => name === "Loner" });
  const text = issues.map(i => `${i.entry}: ${i.problem}`);
  assert.ok(!text.some(t => t.includes("Ghost Gang")));
  assert.ok(!text.some(t => t.startsWith("Loner:")));
});

test("campaignCheck skips connection checks without a story", () => {
  const { entries } = parseBundle(`##ENTRY
type: npc
name: Loner
##BODY
Alone.
##END`);
  assert.deepEqual(campaignCheck(entries), []);
});

test("fixPrompt lists the issues and asks for replaces:", () => {
  assert.equal(fixPrompt([]), "");
  const prompt = fixPrompt([{ entry: "Loner", problem: "NPC is in no scene, location or thread" }]);
  assert.ok(prompt.includes('- "Loner": NPC is in no scene, location or thread.'));
  assert.ok(prompt.includes("replaces: <its current name>"));
});
