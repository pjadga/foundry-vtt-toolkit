/**
 * Combat narration prompts: a cinematic description of an attack, and in-character lines from the
 * NPCs involved, written by Gemini from the attack's chat card, the NPCs' public notes and the recent
 * chat log (so it follows the fight and doesn't repeat itself). No Foundry globals, so it can be
 * tested with `node --test`.
 */

// How much of the chat log, and of each message, goes into the prompt.
export const LOG_MESSAGES = 20;
const LOG_CHARS = 240;
const PROFILE_CHARS = 700;
const CARD_CHARS = 600;
export const MAX_LINES = 3;

// The answer's shape (Gemini's responseSchema).
export const SCHEMA = {
  type: "OBJECT",
  properties: {
    narration: { type: "STRING" },
    lines: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { speaker: { type: "STRING" }, line: { type: "STRING" } }, required: ["speaker", "line"] }
    }
  },
  required: ["narration", "lines"]
};

const squash = (text, max) => {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : s;
};

/**
 * How hurt a character is, from hit points, in Cyberpunk RED's terms (seriously wounded below half,
 * mortally wounded below 1). null without hit points.
 */
export function woundState(hp) {
  const value = Number(hp?.value);
  const max = Number(hp?.max);
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return null;
  if (value < 1) return "mortally wounded";
  if (value < max / 2) return "seriously wounded";
  if (value < max) return "lightly wounded";
  return "unhurt";
}

/**
 * The recent chat log as short lines, oldest first.
 * @param {{speaker: string, text: string}[]} messages
 */
export function chatLog(messages, max = LOG_MESSAGES) {
  return messages
    .filter(m => m.text?.trim())
    .slice(-max)
    .map(m => `${squash(m.speaker || "?", 40)}: ${squash(m.text, LOG_CHARS)}`)
    .join("\n");
}

const words = text => String(text ?? "").toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, " ").split(/\s+/).filter(Boolean);

/**
 * Whether a narration reuses a run of `n` words from earlier narration (the model sometimes copies
 * its last description despite being told not to).
 */
export function repeatsEarlier(text, earlier, n = 6) {
  const seen = new Set();
  for (const old of earlier) {
    const w = words(old);
    for (let i = 0; i + n <= w.length; i++) seen.add(w.slice(i, i + n).join(" "));
  }
  const w = words(text);
  for (let i = 0; i + n <= w.length; i++) if (seen.has(w.slice(i, i + n).join(" "))) return true;
  return false;
}

/** What a narrated NPC has said before, from earlier narration messages' lines. */
export function previousLines(narrations, name) {
  const key = String(name).toLowerCase();
  return narrations.flatMap(n => n.lines ?? []).filter(l => String(l.speaker).toLowerCase() === key && l.line).map(l => l.line);
}

/**
 * The ids of the narration messages for a miss on `attackId`, removed when the GM turns that miss
 * into a hit so players don't read both.
 * @param {{id: string, narration?: {result?: string, source?: string|null}}[]} messages
 */
export const missNarrations = (messages, attackId) => messages.filter(m => m.narration?.result === "miss" && m.narration.source === attackId).map(m => m.id);

function describe(person) {
  const parts = [`${person.name}${person.isPC ? " (player character)" : " (NPC)"}`];
  if (person.wounds) parts.push(`currently ${person.wounds}`);
  if (person.profile) parts.push(`notes: ${squash(person.profile, PROFILE_CHARS)}`);
  if (person.previousLines?.length) parts.push(`has already said (never repeat or closely paraphrase these): ${person.previousLines.map(l => `"${squash(l, 160)}"`).join(" ")}`);
  return `- ${parts.join("; ")}`;
}

/**
 * The prompt for one attack. `outcome.result` is "miss" (narrated when the attack is resolved),
 * "hit" (narrated when damage is rolled, with what the damage did in `outcome.detail`), or
 * "attempt" (the outcome isn't known, e.g. suppressive fire).
 * @param {{
 *   system?: string, scene?: string, round?: string,
 *   outcome?: {result: "hit"|"miss"|"attempt", detail?: string}, earlier?: string[], strict?: boolean,
 *   attacker: {name: string, isPC: boolean, profile?: string, wounds?: string|null, previousLines?: string[]},
 *   targets: {name: string, isPC: boolean, profile?: string, wounds?: string|null, previousLines?: string[]}[],
 *   card: string, log?: string
 * }} attack
 */
export function narrationPrompt({ system = "", scene = "", round = "", outcome = { result: "attempt" }, earlier = [], strict = false, attacker, targets, card, log = "" }) {
  const npcTargets = targets.filter(t => !t.isPC);
  const speakers = attacker.isPC ? npcTargets.map(t => t.name) : [attacker.name, ...npcTargets.map(t => t.name)];
  const who = attacker.isPC ? "A player character is attacking an NPC." : "An NPC is attacking.";
  const reaction = attacker.isPC
    ? "Give the NPC being attacked a short in-character reaction, if they would say anything."
    : "Give the attacking NPC a short in-character line (a taunt, threat or battle cry), and the NPC being attacked a reaction if there is one, if they would say anything.";
  const result = {
    miss: `The attack MISSES (${outcome.detail || "it fails to beat the defence"}). Narrate the attack and exactly how it misses: the shot goes wide, cover takes it, or, only if the detail says they dodge, the target dodges. ${reaction}`,
    hit: `The attack HITS (${outcome.detail || "damage rolled"}). Narrate the attack landing and what the damage does, matching the detail: how much the named armor stops, a wound, a Critical Injury, a body part for a head shot. Only describe death or collapse if the detail says mortally wounded. ${reaction} A wounded NPC reacts to the pain.`,
    attempt: `Narrate the attack cinematically without deciding the result: never say whether it hits or misses or how much damage it does, and leave the outcome hanging on the moment. ${reaction}`
  }[outcome.result] ?? "";
  const task = `${who} ${result}`;
  return [
    `You narrate combat in a tabletop roleplaying game${system ? ` (${system})` : ""}, played in Foundry VTT. The players read what you write in the chat.`,
    task,
    "",
    "RULES",
    "- narration: 2 or 3 vivid sentences, present tense, third person, naming the characters. Describe the weapon or action from the ATTACK card and how the target reacts, in the setting's tone.",
    "- Narrate exactly the outcome above. Don't add game numbers (damage totals, DVs) to the prose, and don't invent extra effects.",
    "- Follow the outcome's details exactly: the fire mode (a single shot is one round, never a burst or spray), a critical success (make it spectacular) or fumble (make it clumsy), the armor by its name and how much it stops, and whether the target can dodge.",
    "- Never write dialogue, thoughts or decisions for a player character.",
    "- Follow the RECENT CHAT so the narration fits how the fight has gone.",
    `- Write it fresh: use none of the wording, openings or images of the EARLIER NARRATION below${strict ? ". Your last answer copied it, so start differently and describe a different detail of the fight" : ""}.`,
    `- lines: up to ${MAX_LINES}, only from ${speakers.length ? speakers.join(", ") : "no one (return an empty list)"}. Each line is at most 20 words, in the character's own voice from their notes, and must be new: never repeat or closely paraphrase anything they've said before. Return an empty list if no one would speak.`,
    "- Use only what is given here; don't invent game rules or secrets.",
    "",
    ...(scene ? [`SCENE: ${scene}`] : []),
    ...(round ? [`COMBAT: ${round}`] : []),
    ...(scene || round ? [""] : []),
    "ATTACKER",
    describe(attacker),
    "TARGETS",
    targets.length ? targets.map(describe).join("\n") : "- (none targeted)",
    "",
    "ATTACK (the chat card)",
    squash(card, CARD_CHARS),
    "",
    "EARLIER NARRATION (don't reuse its wording)",
    earlier.length ? earlier.map(e => `- ${squash(e, 400)}`).join("\n") : "- (none)",
    "",
    "RECENT CHAT (oldest first)",
    log || "(nothing yet)"
  ].join("\n");
}

/**
 * Gemini's JSON answer -> {narration, lines}, keeping only lines from the allowed speakers and
 * dropping a line that repeats one of their earlier lines.
 * @param {string} text
 * @param {{name: string, previousLines?: string[]}[]} speakers
 */
export function parseNarration(text, speakers) {
  let data;
  try {
    data = JSON.parse(String(text ?? "").replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return { narration: squash(text, 600), lines: [] };
  }
  const norm = s => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const allowed = new Map(speakers.map(s => [norm(s.name), s]));
  const lines = [];
  for (const l of Array.isArray(data.lines) ? data.lines : []) {
    const who = allowed.get(norm(l?.speaker));
    const line = squash(String(l?.line ?? "").replace(/^["“]|["”]$/g, ""), 200);
    if (!who || !line) continue;
    if ((who.previousLines ?? []).some(p => norm(p) === norm(line))) continue;
    if (lines.some(x => x.speaker === who.name)) continue;
    lines.push({ speaker: who.name, line });
  }
  return { narration: squash(data.narration, 700), lines: lines.slice(0, MAX_LINES) };
}
