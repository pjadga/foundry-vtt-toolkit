// Helpers for the campaign-designer skill (.claude/skills/campaign-designer). Pure functions plus a small CLI:
//   node scripts/campaign-tools.mjs prompt0 <system> <campaign-dir>   writes notebooklm/prompt-0.txt
//   node scripts/campaign-tools.mjs check <entries.txt> [more.txt…]   the campaign check, as Build campaign runs it
import fs from "node:fs";
import path from "node:path";
import { parseBundle } from "../module/scripts/import/parser.mjs";
import { campaignCheck, fixPrompt } from "../module/scripts/import/check.mjs";

// NotebookLM's chat configuration holds 10,000 characters.
export const PROMPT_LIMIT = 10000;

// Each system's prompt kit, where Prompt 0 lives.
export const KITS = { cpred: "docs/notebooklm/cyberpunk-red-prompts.md" };

/** The code block under "## Prompt 0" in a prompt kit, or null. */
export function extractPrompt0(kit) {
  const text = kit.replace(/\r\n/g, "\n");
  const start = text.indexOf("## Prompt 0");
  if (start === -1) return null;
  const open = text.indexOf("```\n", start);
  if (open === -1) return null;
  const close = text.indexOf("\n```", open + 4);
  return close === -1 ? null : text.slice(open + 4, close);
}

/** The parse warnings and campaign check for entries in the toolkit's ##ENTRY format. */
export function report(raw) {
  const { entries, warnings } = parseBundle(raw);
  const issues = campaignCheck(entries);
  const counts = {};
  for (const entry of entries) counts[entry.type] = (counts[entry.type] ?? 0) + 1;
  return { entries: entries.length, counts, warnings, issues, fix: fixPrompt(issues) };
}

function main(args) {
  const [command, ...rest] = args;
  if (command === "prompt0") {
    const [system, dir] = rest;
    if (!KITS[system] || !dir) throw new Error(`usage: prompt0 <${Object.keys(KITS).join("|")}> <campaign-dir>`);
    const prompt = extractPrompt0(fs.readFileSync(KITS[system], "utf8"));
    if (!prompt) throw new Error(`${KITS[system]} has no Prompt 0 code block`);
    if (prompt.length > PROMPT_LIMIT) throw new Error(`Prompt 0 is ${prompt.length} characters; NotebookLM takes ${PROMPT_LIMIT}`);
    const out = path.join(dir, "notebooklm", "prompt-0.txt");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, prompt);
    console.log(`${out}: ${prompt.length} of ${PROMPT_LIMIT} characters`);
  } else if (command === "check" && rest.length) {
    const result = report(rest.map(file => fs.readFileSync(file, "utf8")).join("\n\n"));
    console.log(`${result.entries} entries: ${Object.entries(result.counts).map(([type, n]) => `${n} ${type}`).join(", ") || "none"}`);
    for (const warning of result.warnings) console.log(`warning: ${warning}`);
    for (const issue of result.issues) console.log(`gap: ${issue.entry ? `${issue.entry}: ` : ""}${issue.problem}`);
    if (!result.warnings.length && !result.issues.length) console.log("No gaps.");
    process.exitCode = result.issues.length || result.warnings.length ? 1 : 0;
  } else {
    throw new Error("usage: prompt0 <system> <campaign-dir> | check <entries.txt…>");
  }
}

if (import.meta.url === new URL(process.argv[1], "file:///").href || process.argv[1]?.endsWith("campaign-tools.mjs")) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 2; }
}
