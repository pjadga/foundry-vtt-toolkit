import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { extractPrompt0, report, KITS, PROMPT_LIMIT } from "../scripts/campaign-tools.mjs";

test("every system's Prompt 0 can be extracted and fits NotebookLM's limit", () => {
  for (const [system, file] of Object.entries(KITS)) {
    const prompt = extractPrompt0(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
    assert.ok(prompt, system);
    assert.ok(prompt.length <= PROMPT_LIMIT, `${system}: ${prompt.length} characters`);
    assert.match(prompt, /^You are my campaign builder/);
    assert.match(prompt, /##END$/m);
  }
});

test("extractPrompt0 reads the first block after the heading, with CRLF too", () => {
  const kit = "# Kit\n\n## Prompt 0: config\n\nintro\n\n```\nLINE 1\nLINE 2\n```\n\n## Prompt 1\n\n```\nother\n```\n";
  assert.equal(extractPrompt0(kit), "LINE 1\nLINE 2");
  assert.equal(extractPrompt0(kit.replace(/\n/g, "\r\n")), "LINE 1\nLINE 2");
  assert.equal(extractPrompt0("no prompts here"), null);
});

test("report counts entries and finds the gaps Build campaign would", () => {
  const bible = [
    "##ENTRY\ntype: journal\nname: Campaign Overview\n##BODY\nStarts at [[The Dock]] with [[Rook]].\n##END",
    "##ENTRY\ntype: location\nname: The Dock\n##BODY\nWet.\n##END",
    "##ENTRY\ntype: scene\nname: Opening\nsession: 1\nlocation: [[The Dock]]\n##BODY\nA scene.\n##END"
  ].join("\n\n");
  const result = report(bible);
  assert.deepEqual(result.counts, { journal: 1, location: 1, scene: 1 });
  const problems = result.issues.map(issue => `${issue.entry}: ${issue.problem}`).join("\n");
  assert.match(problems, /links to \[\[Rook\]\]/);
  assert.match(problems, /The Dock: location has no visual/);
  assert.match(problems, /Opening: scene has no npcs_present, soundtrack, visual/);
  assert.match(result.fix, /Fix every one/);
});

test("report is clean for a bundle with no gaps", () => {
  const result = report("##ENTRY\ntype: journal\nname: Notes\n##BODY\nNothing to link.\n##END");
  assert.deepEqual([result.entries, result.warnings, result.issues], [1, [], []]);
});

test("report warns when there are no entries", () => {
  assert.equal(report("just prose").warnings.length, 1);
});
