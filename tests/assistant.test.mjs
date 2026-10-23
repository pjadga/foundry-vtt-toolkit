import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ENTRY_RULES, contextText, systemPrompt, entriesIn } from "../module/scripts/assistant/context.mjs";

test("ENTRY_RULES match the prompt kit's Prompt 0 word for word", () => {
  const kit = fs.readFileSync(new URL("../docs/notebooklm/cyberpunk-red-prompts.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const start = kit.indexOf("## Prompt 0");
  const block = kit.slice(kit.indexOf("```\n", start) + 4, kit.indexOf("\n```", kit.indexOf("```\n", start) + 4));
  assert.ok(block.includes(ENTRY_RULES), "update ENTRY_RULES in module/scripts/assistant/context.mjs from Prompt 0");
  for (const section of ["FORMAT RULES", "FIELDS BY TYPE", "CONSISTENCY"]) assert.ok(ENTRY_RULES.includes(section));
});

test("contextText groups by kind and keeps within limits", () => {
  const docs = [
    { kind: "npc", name: "Rook", text: "Bodyguard." },
    { kind: "journal", name: "Overview", text: "The plot." },
    { kind: "location", name: "Tower", text: "x".repeat(50) }
  ];
  const all = contextText(docs);
  assert.equal(all.included, 3);
  assert.ok(all.text.indexOf("### journal: Overview") < all.text.indexOf("### location: Tower"));
  assert.ok(all.text.indexOf("### location: Tower") < all.text.indexOf("### npc: Rook"));
  const cut = contextText(docs, { perDocument: 10 });
  assert.equal(cut.truncated, 1);
  assert.ok(cut.text.includes("[...cut short]"));
  const capped = contextText(docs, { limit: 60 });
  assert.ok(capped.omitted > 0 && capped.text.length <= 60);
});

test("systemPrompt carries the rules and the campaign", () => {
  const prompt = systemPrompt({ system: "Cyberpunk RED", world: "Test", context: "### npc: Rook\nBodyguard." });
  assert.ok(prompt.includes("Cyberpunk RED"));
  assert.ok(prompt.includes(ENTRY_RULES));
  assert.ok(prompt.endsWith("### npc: Rook\nBodyguard."));
  assert.ok(systemPrompt({ context: "" }).includes("no imported documents"));
  assert.ok(systemPrompt({ context: "" }).includes("You don't have the rulebooks"));
  const withSources = systemPrompt({ context: "", sources: true });
  assert.ok(withSources.includes("SOURCE LIBRARY") && !withSources.includes("You don't have the rulebooks"));
});

test("entriesIn finds importable answers only", () => {
  assert.equal(entriesIn("Rook is Crane's bodyguard."), null);
  assert.equal(entriesIn("Use ##ENTRY blocks, like this."), null);
  const found = entriesIn("Here is the NPC.\n```\n##ENTRY\ntype: npc\nname: Vex\n##BODY\nA fixer.\n##END\n```");
  assert.equal(found.count, 1);
});
