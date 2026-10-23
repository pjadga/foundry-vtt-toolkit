/**
 * The GM Assistant's prompt and context: what Gemini is told, and the campaign it is given. No
 * Foundry globals, so it can be tested with `node --test`.
 */
import { parseBundle } from "../import/parser.mjs";

/**
 * The entry format, field list and consistency rules, copied verbatim from the prompt kit's Prompt 0
 * (docs/notebooklm/cyberpunk-red-prompts.md; tests/assistant.test.mjs checks they still match), so
 * the assistant writes entries exactly as NotebookLM does.
 */
export const ENTRY_RULES = "##ENTRY\ntype: <journal | thread | location | npc | item | playlist | scene>\nname: <unique name>\ntags: <comma-separated>\n<other fields for that type, one per line, \"key: value\">\n##BODY\n<description in plain paragraphs; you may use Markdown headings and bullet lists>\n##END\n\nFORMAT RULES\n- Field lines are plain \"key: value\": no bold, bullets, numbering or blank lines between them. Field values go on one line; lists inside a field are comma-separated, except \"tracks\", which is one numbered line per track.\n- Use the field names below exactly, in lowercase. Leave out a field rather than writing \"none\" or \"N/A\", unless the field says otherwise.\n- Use [[double brackets]] only for names that have (or will get) their own entry in this campaign, plus core rulebook items in an NPC's \"gear\" field. Write gangs, corporations, districts and other names in plain text unless I ask for an entry for them.\n- Spell every bracketed name exactly as its own entry does, every time. Never put numbers in front of names. When you revise an entry, output it complete, keep its name, and add \"replaces: <its current name>\"; if the name must change, use the old name there.\n- If an answer would be too long, stop after a complete ##END and wait for me to say \"continue\". Never cut an entry in half, and don't repeat entries from earlier answers unless I ask you to change them.\n- Every entry is complete: all the fields for its type and a real body. No placeholders such as \"TBD\", \"...\" or \"[insert]\".\n- No citation markers or source notes inside the code block.\n\nFIELDS BY TYPE\n- journal: anything useful. The Campaign Overview has premise, tone, themes, central_conflict, antagonist ([[link]] and what they want), plot_twists (1) 2) 3) on one line), ending, sessions (a number).\n- thread: hook, midpoint_choice, success_outcome, failure_outcome, connection_to_main, linked_threads (other threads as [[links]]). Body: 5 to 6 beats in order, each saying which session it happens in.\n- location: district (a Night City district), controlled_by, danger_level (1 to 5), notable_features (three), secrets (two), npcs (NPCs found there as [[links]]), visual. Body: 2 to 3 atmospheric paragraphs a GM can read aloud.\n- npc: role (a Cyberpunk RED role, or \"civilian\"), tier (mook, lieutenant, boss or non-combatant), stats (one line: \"INT 6, REF 7, DEX 6, TECH 5, COOL 6, WILL 6, LUCK 5, MOVE 6, BODY 7, EMP 5\"; 2 to 8 for ordinary people), skills (6 to 10 core skill names with levels, e.g. \"Handgun 6, Evasion 5\"), appearance, voice_and_mannerisms, what_they_want, what_theyre_hiding, relationship_to_player, gear (2 to 4 [[item links]], using core rulebook item names where one fits, e.g. [[Heavy Pistol]], [[Kevlar]]). Body: a short backstory.\n- item: category (weapon, armor, cyberware, gear, drug or clothing), price (e.g. \"500 eb\"), story_item (yes or no). Weapons add damage (e.g. \"3d6\"), rate_of_fire (a number), range_or_melee (\"range\" or \"melee\"). Armor adds sp (a number) and penalty (a number, or \"none\"). Cyberware adds effect (one sentence) and humanity_loss (e.g. \"7 (2d6)\"). Put a core item's name in a variant's name (\"Militech Heavy Pistol\"). Mark anything that may be too strong with too_strong_flag: yes.\n- playlist: mood (one sentence), tracks (numbered lines, one track style each, in genre words people put in music video titles, e.g. \"1. Dark synthwave with rain field recordings, slow, 90 bpm\"). Never name copyrighted songs. Body: when to use it.\n- scene: session (the session number), location (one [[location]]), npcs_present ([[links]]), soundtrack (one [[playlist]]), objective, complications, best_outcome, worst_outcome, visual. Body: the scene for the GM. A scene with no session must have \"Epilogue\" or \"Prologue\" in its name or tags.\n- visual (locations and scenes): one sentence describing a wide establishing shot for an illustrator: setting, lighting, weather, colours, action. No text, signs with words, logos or named people.\n\nCONSISTENCY\n- Every NPC appears in at least one location, thread beat or scene. Every location is visited by a thread beat or scene. Every item is carried by an NPC or used in a thread beat or scene. Every scene's location, NPCs and soundtrack are entries that exist.\n- Keep names, timeline and who knows what consistent with everything we have already made.\n- Before answering, check your entries against these rules and fix any gap yourself; never leave one for later.";

// Most of the campaign fits in one request; these keep a huge world from going over the model's
// limits (a character is roughly a quarter of a token).
export const PER_DOCUMENT = 12_000;
export const CONTEXT_LIMIT = 400_000;

const KIND_ORDER = ["journal", "thread", "location", "scene", "npc", "item", "playlist", "other"];

/**
 * The campaign as one text for the model: a section per document, grouped by kind, each cut to
 * PER_DOCUMENT characters, the whole cut to CONTEXT_LIMIT.
 * @param {{kind: string, name: string, text: string}[]} docs
 * @returns {{text: string, included: number, truncated: number, omitted: number}}
 */
export function contextText(docs, { perDocument = PER_DOCUMENT, limit = CONTEXT_LIMIT } = {}) {
  const rank = kind => (KIND_ORDER.includes(kind) ? KIND_ORDER.indexOf(kind) : KIND_ORDER.length);
  const sorted = [...docs].sort((x, y) => rank(x.kind) - rank(y.kind) || x.name.localeCompare(y.name));
  const parts = [];
  let length = 0;
  let truncated = 0;
  let omitted = 0;
  for (const doc of sorted) {
    let body = String(doc.text ?? "").trim();
    if (body.length > perDocument) {
      body = `${body.slice(0, perDocument)}\n[...cut short]`;
      truncated++;
    }
    const section = `### ${doc.kind}: ${doc.name}\n${body}`;
    if (length + section.length > limit) {
      omitted++;
      continue;
    }
    parts.push(section);
    length += section.length + 2;
  }
  return { text: parts.join("\n\n"), included: parts.length, truncated, omitted };
}

/**
 * The system instruction: the assistant's job and rules, the entry format, then the campaign.
 * @param {{system?: string, world?: string, context: string, sources?: boolean}} options
 *   sources: the GM's source library can be searched (File Search).
 */
export function systemPrompt({ system = "", world = "", context, sources = false }) {
  return [
    `You are the game master's assistant for a tabletop campaign run in Foundry VTT${system ? ` with the ${system} system` : ""}${world ? `, in the world "${world}"` : ""}. Only the game master talks to you.`,
    "",
    "HOW TO ANSWER",
    "- Ground every answer in the CAMPAIGN below: its journals, threads, locations, scenes, NPCs, items and playlists. Use their exact names in [[double brackets]] when you mention them.",
    "- For questions, ideas, rulings and summaries, answer in short Markdown prose. Say plainly when the campaign doesn't cover something, and offer an idea that fits it.",
    sources
      ? "- You can search the GM's SOURCE LIBRARY: their rulebooks, notes and references. Search it for game rules, setting facts, slang and tone, and answer rules questions from it rather than from memory. For this campaign's own people, places and plot, the CAMPAIGN below wins over the sources."
      : "- You don't have the rulebooks. If an answer depends on a game rule, give the usual convention and name the rule to check, rather than inventing one.",
    "- When I ask you to create or change campaign content (an NPC, a location, a scene, an item, a fix), answer with entries in the format below, in one code block, and nothing outside it but one short sentence saying what the entries are.",
    "- To change an existing entry, output it complete, keep its exact name and add \"replaces: <its name>\". Never contradict what the campaign says unless I ask you to change it.",
    "",
    "ENTRY FORMAT",
    ENTRY_RULES,
    "",
    "CAMPAIGN",
    context || "(The campaign has no imported documents yet.)"
  ].join("\n");
}

/**
 * The importable part of an answer: the text of its ##ENTRY blocks, or null when it has none.
 * @param {string} answer
 * @returns {{text: string, count: number}|null}
 */
export function entriesIn(answer) {
  const text = String(answer ?? "");
  if (!/^\s*##ENTRY\s*$/m.test(text)) return null;
  const { entries } = parseBundle(text);
  return entries.length ? { text, count: entries.length } : null;
}
