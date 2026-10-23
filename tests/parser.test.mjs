import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseBundle, resolveLinks, toMarkdown, clean, normalizeName, findImage, progressionKey, stripNumber, numberInOrder, fieldLine } from "../module/scripts/import/parser.mjs";

const sample = fs.readFileSync(new URL("../docs/notebooklm/examples/campaign-overview.txt", import.meta.url), "utf8");

test("parses the NotebookLM campaign overview", () => {
  const { entries, warnings } = parseBundle(sample);
  assert.deepEqual(warnings, []);
  assert.equal(entries.length, 1);
  const [e] = entries;
  assert.equal(e.type, "journal");
  assert.equal(e.name, "Campaign Overview");
  assert.deepEqual(e.tags.slice(0, 3), ["cyberpunk-red", "campaign", "solo-play"]);
  assert.equal(e.fields.sessions, "12");
  assert.ok(e.fields.central_conflict.includes("[[The Overlook]]"));
  assert.ok(e.body.startsWith("### Campaign Overview"));
  assert.ok(e.body.trimEnd().endsWith("Street Legend."));
  assert.deepEqual([...e.links].sort(), ["Doctor Maya Chen", "Rook", "The Overlook", 'Vance "Hard-Line" Miller']);
});

test("tolerates code fences, citations, escapes and entities", () => {
  const messy = "```\n##ENTRY\ntype: npc\nname: Rook\ntags: fixer [1, 2]\nwants: cash\\_flow &amp; respect [3-4]\n##BODY\nA [[The Overlook]] regular [5].\n##END\n```";
  const { entries, warnings } = parseBundle(messy);
  assert.deepEqual(warnings, []);
  assert.equal(entries[0].fields.wants, "cash_flow & respect");
  assert.deepEqual(entries[0].tags, ["fixer"]);
  assert.equal(entries[0].body, "A [[The Overlook]] regular.");
});

test("reads a Markdown export with every character escaped and trailing spaces", () => {
  const exported = [
    "\\#\\#ENTRY  ",
    "type: npc  ",
    "name: Vance \"Hard-Line\" Miller  ",
    "what\\_theyre\\_hiding: A betrayal \\[2, 4\\].  ",
    "\\#\\#BODY  ",
    "1\\. Works for \\[\\[Petrochem\\]\\] \\(once\\)\\.  ",
    "\\---",
    "\\#\\#END  "
  ].join("\n");
  const { entries, warnings } = parseBundle(exported);
  assert.deepEqual(warnings, []);
  assert.equal(entries[0].name, 'Vance "Hard-Line" Miller');
  assert.equal(entries[0].fields.what_theyre_hiding, "A betrayal.");
  assert.equal(entries[0].body, "1. Works for [[Petrochem]] (once).\n---");
});

test("normalizeName ignores case, quotes, stray punctuation and a leading The", () => {
  assert.equal(normalizeName('Vance "Hard-Line" Miller"'), normalizeName('vance "hard-line" miller'));
  assert.equal(normalizeName("Dr. Chen's Free Clinic"), "dr chens free clinic");
  assert.equal(normalizeName("The Flooded Docks"), normalizeName("Flooded Docks"));
});

test("replaces is metadata, not a displayed field", () => {
  const { entries } = parseBundle("##ENTRY\ntype: npc\nname: Silas\nreplaces: Old Man Silas\nrole: civilian\n##BODY\n##END");
  assert.equal(entries[0].replaces, "Old Man Silas");
  assert.deepEqual(Object.keys(entries[0].fields), ["role"]);
  assert.equal(parseBundle("##ENTRY\ntype: npc\nname: Rook\n##BODY\n##END").entries[0].replaces, null);
});

test("findImage matches file names to entry names, or uses an explicit image", () => {
  const files = ["worlds/w/assets/the-overlook.jpg", "worlds/w/assets/dr-chens-free-clinic.webp", "worlds/w/assets/Red%20Cloud%20Night%20Market.png", "worlds/w/assets/notes.txt", "worlds/w/assets/vault.jpg"];
  const e = (name, image = null) => ({ name, image });
  assert.equal(findImage(e("The Overlook"), files), files[0]);
  assert.equal(findImage(e("Dr. Chen's Free Clinic"), files), files[1]);
  assert.equal(findImage(e("The Red Cloud Night Market"), files), files[2]);
  assert.equal(findImage(e("Showdown", "vault.jpg"), files), files[4]);
  assert.equal(findImage(e("Showdown", "maps/other.jpg"), files), "maps/other.jpg");
  assert.equal(findImage(e("Notes"), files), null);
  assert.equal(findImage(e("Nowhere"), files), null);
  assert.equal(parseBundle("##ENTRY\ntype: location\nname: X\nimage: x.jpg\n##BODY\n##END").entries[0].image, "x.jpg");
});

test("progressionKey reads the session, then epilogue/prologue", () => {
  assert.equal(progressionKey({ fields: { session: "S07" }, body: "Session 2" }), 7);
  assert.equal(progressionKey({ fields: {}, body: "### Scene Overview: Early-Campaign Climax (Session 2)" }), 2);
  assert.equal(progressionKey({ fields: { objective: "Hold out until Sessions 11" }, body: "" }), 11);
  assert.equal(progressionKey({ fields: {}, tags: ["epilogue"], body: "### Scene Overview: Campaign Epilogue" }), 1000);
  assert.equal(progressionKey({ fields: {}, tags: [], body: "A prologue in the rain." }), 0);
  assert.equal(progressionKey({ fields: {}, tags: [], body: "No hints." }), null);
});

test("numberInOrder numbers by key, pads at ten, and stripNumber undoes it", () => {
  const names = numberInOrder([{ name: "Showdown", key: 12 }, { name: "Salvage", key: 1 }, { name: "Sanctuary", key: 1000 }, { name: "Odd", key: null }, { name: "Defense", key: 2 }]);
  assert.deepEqual([...names.values()], ["1. Salvage", "2. Defense", "3. Showdown", "4. Sanctuary", "5. Odd"]);
  const ten = numberInOrder(Array.from({ length: 10 }, (_, i) => ({ name: `S${i}`, key: i })));
  assert.equal(ten.get("S0"), "01. S0");
  assert.equal(stripNumber("07. Calm Before the Siege"), "Calm Before the Siege");
  assert.equal(stripNumber("Petrochem Relay Station 09"), "Petrochem Relay Station 09");
});

test("keeps only the last copy of a repeated entry", () => {
  const { entries, warnings } = parseBundle("##ENTRY\ntype: npc\nname: Silas\nv: 1\n##BODY\n##END\n##ENTRY\ntype: npc\nname: Rook\n##BODY\n##END\n##ENTRY\ntype: npc\nname: Silas\nv: 2\n##BODY\n##END");
  assert.deepEqual(entries.map(e => `${e.name}${e.fields.v ?? ""}`), ["Rook", "Silas2"]);
  assert.equal(warnings.length, 1);
});

test("keeps [[links]] when stripping citations", () => {
  assert.equal(clean("see [[1]] and [2]"), "see [[1]] and");
});

test("warns when line breaks were lost", () => {
  const { entries, warnings } = parseBundle("##ENTRY type: journal name: X tags: a ##BODY text ##END");
  assert.equal(entries.length, 0);
  assert.match(warnings[0], /line breaks/);
});

test("warns on missing name and missing ##END, handles multi-entry", () => {
  const { entries, warnings } = parseBundle("##ENTRY\ntype: item\n##BODY\nx\n##END\n##ENTRY\ntype: location\nname: A\nnotes: one\n  two\n##BODY\ny\n");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].fields.notes, "one\ntwo");
  assert.ok(warnings.some(w => /missing "name"/.test(w)));
  assert.ok(warnings.some(w => /missing ##END/.test(w)));
});

test("resolveLinks links known names and bolds unknown ones", () => {
  const out = resolveLinks("[[A]] meets [[B]]", n => (n === "A" ? "JournalEntry.abc" : null));
  assert.equal(out, "@UUID[JournalEntry.abc]{A} meets **B**");
});

test("toMarkdown lists fields then body", () => {
  const md = toMarkdown({ tags: ["t"], fields: { central_conflict: "x" }, body: "Body" });
  assert.equal(md, "*Tags: t*\n\n- **Central conflict:** x\n\n---\n\nBody");
});

test("fieldLine accepts bold and bulleted field lines", () => {
  assert.deepEqual(fieldLine("name: Rook"), ["name", "Rook"]);
  assert.deepEqual(fieldLine("**name:** Rook"), ["name", "Rook"]);
  assert.deepEqual(fieldLine("**Danger Level**: 3"), ["danger_level", "3"]);
  assert.deepEqual(fieldLine("- type: npc"), ["type", "npc"]);
  assert.deepEqual(fieldLine("* **npcs_present:** [[Rook]]"), ["npcs_present", "[[Rook]]"]);
  assert.deepEqual(fieldLine("role: **Solo**"), ["role", "Solo"]);
  // Bulleted lines that are content, not fields.
  assert.equal(fieldLine("- Darksynth: heavy bass, 120 bpm"), null);
  assert.equal(fieldLine("- mood: grim", "tracks"), null);
  assert.deepEqual(fieldLine("- name: Street", "tracks"), ["name", "Street"]);
  assert.equal(fieldLine("1. Dark synthwave: slow"), null);
});

test("parseBundle reads entries with formatted field lines", () => {
  const { entries } = parseBundle(`##ENTRY
**type:** npc
**name:** Rook
- role: Solo
- **gear:** [[Heavy Pistol]]
##BODY
Guard.
##END

##ENTRY
- type: playlist
- name: Street
- tracks:
- Darksynth: heavy bass
- Lo-fi chill beat
##BODY
Music.
##END`);
  assert.equal(entries.length, 2);
  assert.deepEqual([entries[0].type, entries[0].name, entries[0].fields.role, entries[0].fields.gear], ["npc", "Rook", "Solo", "[[Heavy Pistol]]"]);
  assert.equal(entries[1].name, "Street");
  assert.equal(entries[1].fields.tracks, "\n- Darksynth: heavy bass\n- Lo-fi chill beat");
});
