import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseBundle, resolveLinks, toMarkdown, clean, normalizeName } from "../module/scripts/import/parser.mjs";

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
  assert.equal(normalizeName("Dr. Chen's Free Clinic"), "dr chen s free clinic");
  assert.equal(normalizeName("The Flooded Docks"), normalizeName("Flooded Docks"));
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
