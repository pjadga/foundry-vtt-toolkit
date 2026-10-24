/**
 * Combat narration and, in Cyberpunk RED, attack resolution.
 *
 * When a player character attacks a targeted NPC (or an NPC attacks), the toolkit resolves the attack
 * by the rules: range DV from the weapon's DV table and the distance between the tokens, or the
 * defender's Evasion for melee (rolled automatically for NPCs; player characters are asked to roll).
 * The defender wins ties. A public resolution card shows the result, with Hit/Miss buttons for the
 * GM. A miss is narrated straight away; a hit is narrated when damage is rolled, with what the damage
 * did (optionally applied through the system's own Apply Damage). Gemini writes the narration from
 * the outcome, the NPCs' public notes and the recent chat, so it follows the fight without repeating
 * lines. Everything runs in the active GM's browser, which has the Gemini key.
 */
import { narrationPrompt, parseNarration, chatLog, previousLines, woundState, repeatsEarlier, missNarrations, SCHEMA, LOG_MESSAGES } from "./prompt.mjs";
import { attackKind, rangeDV, shouldDodge, hits, natural, criticalInjury, damageEffect, attackFacts, damageDetail, resolutionLine } from "./rules.mjs";
import { askGemini, DEFAULT_ASSISTANT_MODEL } from "../assistant/gemini.mjs";

const MODULE_ID = "foundry-vtt-toolkit";
const escape = s => foundry.utils.escapeHTML(String(s ?? ""));
const t = (key, data) => (data ? game.i18n.format(`FVTK.Narration.${key}`, data) : game.i18n.localize(`FVTK.Narration.${key}`));
const setting = key => game.settings.get(MODULE_ID, key);

// Cyberpunk RED's attack roll classes (plain, aimed, autofire, suppressive fire). The system drops a
// roll's state when it goes to chat, but the class survives; the totals are read from the card.
const CPR_ATTACKS = new Set(["CPRAttackRoll", "CPRAimedAttackRoll", "CPRAutofireRoll", "CPRSuppressiveFireRoll"]);
const isCPR = () => game.system.id === "cyberpunk-red-core";
const rollClass = message => message.rolls?.[0]?.constructor?.name ?? "";
// Recent messages searched for the attack a damage roll or Evasion roll belongs to.
const LOOKBACK = 40;

/** Whether a chat message is an attack roll, in the systems the toolkit knows. */
export function isAttack(message) {
  if (!message.rolls?.length) return false;
  if (message.rolls.some(r => CPR_ATTACKS.has(r.constructor?.name))) return true;
  return message.flags?.dnd5e?.roll?.type === "attack";
}

/** Player characters: owned by a player, or the system's player-character type. */
export const isPC = actor => !!actor && (actor.hasPlayerOwner || actor.type === "character");

/** Plain text from HTML, leaving out GM-only secret sections. */
function publicText(html) {
  const div = document.createElement("div");
  div.innerHTML = String(html ?? "");
  div.querySelectorAll("section.secret, .secret").forEach(el => el.remove());
  return div.innerText.replace(/\s+/g, " ").trim();
}

/** What players may know about an actor: imported public notes, else its sheet notes without secrets. */
function profileOf(actor) {
  const raw = actor.flags[MODULE_ID]?.notes?.raw;
  if (raw?.public) return raw.public.replace(/\*\*/g, "").replace(/\[\[([^\]]+)\]\]/g, "$1");
  return publicText(foundry.utils.getProperty(actor, "system.information.notes") ?? foundry.utils.getProperty(actor, "system.details.biography.value"));
}

const hpOf = actor => foundry.utils.getProperty(actor, "system.derivedStats.hp") ?? foundry.utils.getProperty(actor, "system.attributes.hp");

/** The targeted tokens a message's roll recorded: stamped by the roller's client, or by dnd5e. */
function targetTokensOf(message) {
  const uuids = [...(message.flags[MODULE_ID]?.targets ?? []), ...(message.flags?.dnd5e?.targets ?? []).map(x => x.uuid)];
  const tokens = [];
  for (const uuid of uuids) {
    const doc = fromUuidSync(uuid);
    const token = doc?.documentName === "Token" ? doc : doc?.getActiveTokens?.()[0]?.document;
    if (token && !tokens.includes(token)) tokens.push(token);
  }
  return tokens;
}

// --- Cyberpunk RED card reading ---------------------------------------------------------------------

function cardDOM(message) {
  const div = document.createElement("div");
  div.innerHTML = message.content;
  return div;
}

/** A roll card's title (weapon or skill), subtitle (Attack, Aimed, Autofire...) and final total. */
function cardInfo(message) {
  const dom = cardDOM(message);
  const title = dom.querySelector(".chat-rollTitle-stat > div")?.textContent.trim() ?? "";
  const subtitle = dom.querySelector(".rollcard-subtitle-center")?.textContent.replace(/\s+/g, " ").trim() ?? "";
  const shown = Number(dom.querySelector(".d10-number-div")?.textContent.trim());
  const total = Number.isFinite(shown) ? shown : message.rolls?.[0]?.total;
  const firstDie = message.rolls?.[0]?.dice?.[0]?.results?.[0]?.result;
  return { title, subtitle, total, natural: natural(firstDie) };
}

/** A damage card's total, dice, location, crit, and the Apply Damage data for each target. */
function damageInfo(message) {
  const dom = cardDOM(message);
  const roll = message.rolls?.[0];
  const faces = roll?.dice?.flatMap(d => d.results.map(r => r.result)) ?? [];
  const buttons = [...dom.querySelectorAll('[data-action="applyDamage"]')].map(b => ({ ...b.dataset }));
  const flagged = roll?.dice?.some(d => d.options?.cprDamageIsCrit);
  return {
    title: dom.querySelector(".chat-rollTitle-stat > div")?.textContent.trim() ?? "",
    total: roll?.total ?? 0,
    crit: flagged || criticalInjury(faces),
    location: buttons[0]?.damageLocation ?? "body",
    buttons
  };
}

const weaponOf = (actor, title) => actor?.items.find(i => i.type === "weapon" && i.name === title) ?? actor?.items.find(i => i.type === "weapon" && title.includes(i.name));
const skillLevel = (actor, name) => actor.items.find(i => i.type === "skill" && i.name === name)?.system.level ?? 0;
const stat = (actor, name) => actor.system.stats?.[name]?.value ?? 0;

/**
 * The armor with the highest current SP (SP less ablation, as the system counts it) equipped at a
 * location (Cyberpunk RED doesn't stack armor), or null.
 */
function armorOf(actor, location) {
  const current = loc => Math.max(0, (Number(loc?.sp) || 0) - (Number(loc?.ablation) || 0));
  const armors = (actor.getEquippedArmors?.(location) ?? []).map(a => ({ name: a.name, sp: current(a.system?.[`${location}Location`]) }));
  return armors.sort((a, b) => b.sp - a.sp)[0] ?? null;
}

const dvTables = new Map();
/** A DV table's bands, from the system's DV compendium; null if there is no such table. */
async function dvBands(name) {
  if (!name) return null;
  if (!dvTables.has(name)) {
    const pack = game.packs.get(game.settings.get(game.system.id, "dvRollTableCompendium"));
    const docs = pack ? await pack.getDocuments() : [];
    for (const table of docs) dvTables.set(table.name, table.results.contents.filter(r => r.type === "text").map(r => ({ range: r.range, dv: r.description ?? r.text })));
    if (!dvTables.has(name)) dvTables.set(name, null);
  }
  return dvTables.get(name);
}

function distanceBetween(a, b) {
  if (!a?.object || !b?.object || a.parent !== b.parent || canvas.scene?.id !== a.parent?.id) return null;
  return canvas.grid.measurePath([a.object.center, b.object.center]).distance;
}

let CPRChat;
/** Roll a defender's Evasion with the system's own roll and card, and return the total. */
async function rollEvasion(actor, token) {
  const skill = actor.items.find(i => i.type === "skill" && i.name === "Evasion");
  if (!skill?.createRoll) return null;
  CPRChat ??= (await import(`/systems/${game.system.id}/modules/chat/cpr-chat.js`)).default;
  const roll = skill.createRoll("skill", actor);
  roll.entityData = { actor: actor.id, token: token?.id ?? null };
  await roll.roll();
  await CPRChat.RenderRollCard(roll);
  return roll.resultTotal;
}

// --- Resolution cards --------------------------------------------------------------------------------

const resolutionOf = m => m.flags[MODULE_ID]?.resolution;

function resolutionHTML(r) {
  const verdict = { hit: t("Hit"), miss: t("Miss"), awaiting: t("Awaiting"), unresolved: t("Unresolved"), done: t("Hit") }[r.status];
  const next = { hit: t("RollDamage"), awaiting: t("RollEvasion", { name: r.targetName }), unresolved: t("SetResult") }[r.status] ?? "";
  const line = r.defence ? resolutionLine({ attacker: r.attackerName, weapon: r.weapon, total: r.total, defence: r.defence }) : `${r.attackerName}'s ${r.weapon}: ${r.total}`;
  const buttons = ["done"].includes(r.status)
    ? ""
    : `<div class="fvtk-resolution-buttons">
        <button type="button" data-fvtk-resolution="hit"><i class="fa-solid fa-crosshairs"></i> ${escape(t("MarkHit"))}</button>
        <button type="button" data-fvtk-resolution="miss"><i class="fa-solid fa-shield"></i> ${escape(t("MarkMiss"))}</button></div>`;
  return `<div class="fvtk fvtk-resolution ${escape(r.status)}">
    <p><strong>${escape(verdict)}</strong>${r.natural ? ` <em>(${escape(t(r.natural === "critical" ? "Critical" : "Fumble"))})</em>` : ""}: ${escape(line)}.</p>
    ${r.note ? `<p class="hint">${escape(r.note)}</p>` : ""}
    ${next ? `<p class="hint">${escape(next)}</p>` : ""}${buttons}</div>`;
}

async function updateResolution(message, changes) {
  const r = { ...resolutionOf(message), ...changes };
  await message.update({ content: resolutionHTML(r), [`flags.${MODULE_ID}.resolution`]: r });
  return r;
}

/**
 * Resolve a Cyberpunk RED attack against its target and post the resolution card. A miss is
 * narrated at once; a hit waits for the damage roll.
 */
async function resolveAttack(message, attacker, attackerToken, targetToken) {
  const target = targetToken.actor;
  const card = cardInfo(message);
  const weapon = weaponOf(attacker, card.title);
  const kind = weapon ? attackKind(weapon.system) : null;
  const autofire = /autofire/i.test(card.subtitle) || rollClass(message) === "CPRAutofireRoll";
  const mode = kind === "melee" || kind === "thrown" ? kind : !kind ? null : autofire ? "autofire" : rollClass(message) === "CPRAimedAttackRoll" ? "aimed" : "single";
  const r = { attack: message.id, attacker: attacker.uuid, attackerName: attacker.name, target: targetToken.uuid, targetName: targetToken.name, weapon: card.title, total: card.total, natural: card.natural, kind, mode, canDodge: stat(target, "ref") >= 8, defence: null, note: "", status: "unresolved" };

  if (r.kind === "melee") {
    if (isPC(target)) r.status = "awaiting";
    else {
      const value = await rollEvasion(target, targetToken);
      if (value != null) r.defence = { type: "evasion", value, name: targetToken.name };
    }
  } else if (r.kind) {
    const name = weapon.system.dvTable || (r.kind === "thrown" ? "DV Thrown Weapon" : "");
    const bands = (autofire && (await dvBands(`${name} (Autofire)`))) || (await dvBands(name));
    const distance = distanceBetween(attackerToken, targetToken);
    const dv = bands ? rangeDV(bands, distance) : null;
    if (dv != null) {
      r.defence = { type: "dv", value: dv, distance };
      // An NPC with REF 8 or more may dodge a ranged attack instead, when that's their better chance.
      const stats = { ref: stat(target, "ref"), dex: stat(target, "dex"), evasion: skillLevel(target, "Evasion") };
      if (!isPC(target) && shouldDodge(stats, dv)) {
        const value = await rollEvasion(target, targetToken);
        if (value != null) {
          r.defence = { type: "evasion", value, name: targetToken.name };
          r.note = t("Dodged", { name: targetToken.name, dv });
        }
      } else if (isPC(target) && stats.ref >= 8) r.note = t("CanDodge", { name: targetToken.name });
    } else r.note = distance == null ? t("NoDistance") : t("NoDV");
  }
  if (r.defence) r.status = hits(r.total, r.defence.value) ? "hit" : "miss";

  const posted = await ChatMessage.create({ speaker: { alias: t("Referee") }, content: resolutionHTML(r), flags: { [MODULE_ID]: { resolution: r } } });
  if (r.status === "miss") await narrateOutcome(r, "miss", missDetail(r));
  return posted;
}

function missDetail(r) {
  const line = `${resolutionLine({ attacker: r.attackerName, weapon: r.weapon, total: r.total, defence: r.defence ?? { type: "dv", value: "?" } })}, so it misses`;
  return [line, r.defence?.type === "evasion" ? `${r.defence.name} dodges` : "", ...attackFacts(r)].filter(Boolean).join("; ");
}

/** Delete the narration of a miss the GM has since turned into a hit, so players don't read both. */
async function retractMiss(attackId) {
  const ids = missNarrations(game.messages.contents.slice(-LOOKBACK).map(m => ({ id: m.id, narration: narrationOf(m) })), attackId);
  if (ids.length) await ChatMessage.deleteDocuments(ids);
}

/** The latest open resolution for an attacker (or for a defender awaiting Evasion), newest first. */
function openResolution({ attacker, target, statuses }) {
  const recent = game.messages.contents.slice(-LOOKBACK).reverse();
  return recent.find(m => {
    const r = resolutionOf(m);
    return r && statuses.includes(r.status) && (!attacker || r.attacker === attacker) && (!target || fromUuidSync(r.target)?.actor?.uuid === target);
  });
}

/** A player character's Evasion roll answers an attack awaiting it. */
async function onEvasion(message) {
  const actor = ChatMessage.getSpeakerActor(message.speaker);
  if (!actor || cardInfo(message).title !== "Evasion") return;
  const pending = openResolution({ target: actor.uuid, statuses: ["awaiting"] });
  if (!pending) return;
  const r = resolutionOf(pending);
  const defence = { type: "evasion", value: cardInfo(message).total, name: r.targetName };
  const status = hits(r.total, defence.value) ? "hit" : "miss";
  const updated = await updateResolution(pending, { defence, status });
  if (status === "miss") await narrateOutcome(updated, "miss", missDetail(updated));
}

/**
 * A damage roll confirms a hit: find the attack it belongs to (or use the card's targets), apply the
 * damage if the settings say so, and narrate the hit.
 */
async function onDamage(message) {
  const attacker = ChatMessage.getSpeakerActor(message.speaker);
  if (!attacker) return;
  const info = damageInfo(message);
  // Oldest open hit first (a ROF 2 weapon makes two attacks, then two damage rolls); a damage roll
  // after a "miss" or an unresolved attack counts as the GM saying it hit.
  const hitsOpen = game.messages.contents.slice(-LOOKBACK).filter(m => resolutionOf(m)?.attacker === attacker.uuid && resolutionOf(m).status === "hit");
  const pending = hitsOpen[0] ?? openResolution({ attacker: attacker.uuid, statuses: ["miss", "unresolved", "awaiting"] });
  let r = pending ? resolutionOf(pending) : null;
  const targetToken = r ? fromUuidSync(r.target) : targetTokensOf(message)[0];
  if (!targetToken?.actor) return;
  if (!r && !(isPC(attacker) ? !isPC(targetToken.actor) : true)) return;
  if (pending) {
    if (r.status === "miss") await retractMiss(r.attack);
    r = await updateResolution(pending, { status: "done" });
  }

  const target = targetToken.actor;
  const before = hpOf(target)?.value;
  // Read before applying, which ablates it.
  const armor = armorOf(target, info.location);
  const melee = r?.kind === "melee";
  const mode = setting("combatApplyDamage");
  let applied = false;
  if (isCPR() && (mode === "all" || (mode === "npcs" && !isPC(target))) && typeof target._applyDamage === "function") {
    const data = info.buttons.find(b => b.tokenId === targetToken.id) ?? info.buttons[0];
    if (data) {
      await target._applyDamage(Number(data.totalDamage), Number(data.bonusDamage), data.damageLocation, Number(data.ablation), data.ammoVariety, Number(data.ignoreArmorPercent), Number(data.ignoreBelowSp), data.damageLethal === "true", { damageReductionRole: true, damageReductionAE: true, useShield: true, brainDamageReduction: true });
      applied = true;
      await message.setFlag(MODULE_ID, "applied", targetToken.name);
    }
  }
  const after = hpOf(target);
  const effect = applied
    ? { through: Math.max(0, (before ?? 0) - (after?.value ?? 0)), hpAfter: after?.value }
    : damageEffect({ damage: info.total, sp: armor?.sp ?? 0, melee, crit: info.crit, hp: hpOf(target) });
  const wounds = woundState({ value: effect.hpAfter, max: after?.max });
  const detail = [
    ...(r ? attackFacts(r) : []),
    damageDetail({ total: info.total, location: info.location, crit: info.crit, armor, melee, through: effect.through, target: targetToken.name, wounds })
  ].join("; ");
  await narrateOutcome(r ?? { attacker: attacker.uuid, target: targetToken.uuid, weapon: info.title, attack: null }, "hit", detail, message);
}

// --- Narration ---------------------------------------------------------------------------------------

const isPublic = m => !m.whisper?.length && !m.blind;
const narrationOf = m => m.flags[MODULE_ID]?.narration;

/** One message as a line of the chat log. */
function logEntry(m) {
  const n = narrationOf(m);
  const speaker = m.speaker?.alias || ChatMessage.getSpeakerActor(m.speaker)?.name || m.author?.name || "";
  if (n) return { speaker, text: [n.text, ...(n.lines ?? []).map(l => `${l.speaker}: "${l.line}"`)].join(" ") };
  const total = m.rolls?.length && !isCPR() ? ` (total ${m.rolls.map(r => r.total).join(", ")})` : "";
  return { speaker, text: `${publicText(m.content) || publicText(m.flavor)}${total}` };
}

function combatLine() {
  const combat = game.combat;
  if (!combat?.started) return "";
  return `Round ${combat.round}${combat.combatant ? `, ${combat.combatant.name}'s turn` : ""}`;
}

/**
 * Ask Gemini for the narration of an attack and post it.
 * @param {{attacker: string, target?: string, attack?: string, weapon?: string}} r The resolution (uuids).
 * @param {"hit"|"miss"|"attempt"} result
 * @param {string} detail
 * @param {ChatMessage} [source] The message narrated (the attack, or the damage roll for a hit).
 */
async function narrateOutcome(r, result, detail, source = null) {
  if (setting("combatNarration") === "off") return;
  const key = setting("geminiApiKey").trim();
  if (!key) return;
  const attacker = fromUuidSync(r.attacker);
  if (!attacker) return;
  const attack = r.attack ? game.messages.get(r.attack) : source;
  const targetTokens = r.target ? [fromUuidSync(r.target)].filter(Boolean) : attack ? targetTokensOf(attack) : [];
  const exclude = new Set([attack?.id, source?.id]);
  const visible = game.messages.contents.filter(m => !exclude.has(m.id) && isPublic(m));
  const narrations = visible.map(narrationOf).filter(Boolean);
  const person = (actor, name = actor.name) => ({ name, isPC: isPC(actor), profile: isPC(actor) ? "" : profileOf(actor), wounds: woundState(hpOf(actor)), previousLines: isPC(actor) ? [] : previousLines(narrations, name) });
  const attackerInfo = person(attacker);
  const targetInfo = targetTokens.filter(tok => tok.actor).map(tok => person(tok.actor, tok.name));
  const card = [attack ? logEntry(attack).text : `${attacker.name} attacks with ${r.weapon}`, source && source !== attack ? logEntry(source).text : ""].filter(Boolean).join(" | ");
  const earlier = narrations.slice(-6).map(n => n.text);
  const ask = strict => narrationPrompt({
    system: game.system.title,
    scene: (canvas.scene?.name ?? "").replace(/^\d+\.\s+/, ""),
    round: combatLine(),
    outcome: { result, detail },
    earlier,
    strict,
    attacker: attackerInfo,
    targets: targetInfo,
    card,
    log: chatLog(visible.slice(-LOG_MESSAGES).map(logEntry))
  });
  const model = setting("assistantModel").trim() || DEFAULT_ASSISTANT_MODEL;
  const speakers = (attackerInfo.isPC ? [] : [attackerInfo]).concat(targetInfo.filter(x => !x.isPC));
  const generate = async strict => parseNarration((await askGemini({ system: "You are a vivid, concise combat narrator.", history: [{ role: "user", text: ask(strict) }], schema: SCHEMA }, key, model)).text, speakers);
  let { narration, lines } = await generate(false);
  // Asked once more when it copies earlier narration; the second answer is used either way.
  if (narration && repeatsEarlier(narration, earlier)) ({ narration, lines } = await generate(true));
  if (narration) await post({ source: (source ?? attack)?.id ?? null, result, text: narration, lines }, setting("combatNarration") === "review");
}

function contentHTML({ text, lines }) {
  const said = lines.map(l => `<p class="fvtk-narration-line"><strong>${escape(l.speaker)}:</strong> “${escape(l.line)}”</p>`).join("");
  return `<div class="fvtk fvtk-narration"><p class="fvtk-narration-text">${escape(text)}</p>${said}</div>`;
}

/** Post narration for everyone, or whisper it to the GMs with Post / Discard. */
function post(narration, review) {
  const buttons = review
    ? `<div class="fvtk-narration-review">
        <button type="button" data-fvtk-narration="post"><i class="fa-solid fa-bullhorn"></i> ${escape(t("Post"))}</button>
        <button type="button" data-fvtk-narration="discard"><i class="fa-solid fa-xmark"></i> ${escape(t("Discard"))}</button></div>`
    : "";
  return ChatMessage.create({
    speaker: { alias: t("Narrator") },
    content: contentHTML(narration).replace(/<\/div>$/, `${buttons}</div>`),
    whisper: review ? game.users.filter(u => u.isGM).map(u => u.id) : [],
    flags: { [MODULE_ID]: { narration: { ...narration, review } } }
  });
}

// --- Hooks -------------------------------------------------------------------------------------------

/** An attack message: resolve it (Cyberpunk RED) or narrate the attempt (other systems). */
async function onAttack(message) {
  const attacker = ChatMessage.getSpeakerActor(message.speaker);
  if (!attacker) return;
  const targets = targetTokensOf(message).filter(tok => tok.actor);
  // A player character's attack counts when it targets an NPC; an NPC's attack always does.
  const target = isPC(attacker) ? targets.find(tok => !isPC(tok.actor)) : targets[0];
  if (isPC(attacker) && !target) return;
  const attackerToken = message.speaker.token ? canvas.scene?.tokens.get(message.speaker.token) ?? attacker.getActiveTokens()[0]?.document : attacker.getActiveTokens()[0]?.document;
  const suppressive = rollClass(message) === "CPRSuppressiveFireRoll";
  const r = { attack: message.id, attacker: attacker.uuid, target: target?.uuid ?? null, weapon: cardInfo(message).title };
  if (isCPR() && target && !suppressive && setting("combatResolution")) return resolveAttack(message, attacker, attackerToken, target);
  return narrateOutcome(r, "attempt", "", message);
}

// Messages already handled, and the queue that keeps everything in roll order.
const handled = new Set();
let queue = Promise.resolve();

function enqueue(task) {
  queue = queue.then(task).catch(err => {
    console.warn(`${MODULE_ID} | Combat narration failed`, err);
    ui.notifications.warn(t("Failed", { message: err.message }));
  });
  return queue;
}

export function setupNarration() {
  // Foundry doesn't record targets on chat messages, so the roller's own client stamps them.
  Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
    if (userId !== game.user.id || !message.rolls?.length) return;
    const targets = [...game.user.targets].map(token => token.document.uuid);
    if (targets.length) message.updateSource({ [`flags.${MODULE_ID}.targets`]: targets });
  });

  Hooks.on("createChatMessage", message => {
    if (!game.users.activeGM?.isSelf || handled.has(message.id) || !message.rolls?.length) return;
    const cls = rollClass(message);
    if (isAttack(message)) {
      if (setting("combatNarration") === "off" && !(isCPR() && setting("combatResolution"))) return;
      handled.add(message.id);
      enqueue(() => onAttack(message));
    } else if (isCPR() && cls === "CPRDamageRoll") {
      handled.add(message.id);
      enqueue(() => onDamage(message));
    } else if (isCPR() && cls === "CPRSkillRoll") {
      handled.add(message.id);
      enqueue(() => onEvasion(message));
    }
  });

  Hooks.on("renderChatMessageHTML", (message, html) => {
    const n = narrationOf(message);
    if (n?.review && game.user.isGM) {
      html.querySelectorAll("[data-fvtk-narration]").forEach(button =>
        button.addEventListener("click", async () => {
          if (button.dataset.fvtkNarration === "post") await post({ ...n, review: false }, false);
          await message.delete();
        })
      );
    }
    const r = resolutionOf(message);
    if (r) {
      const buttons = html.querySelectorAll("[data-fvtk-resolution]");
      if (!game.user.isGM) buttons.forEach(b => b.closest(".fvtk-resolution-buttons")?.remove());
      else
        buttons.forEach(button =>
          button.addEventListener("click", () =>
            enqueue(async () => {
              const status = button.dataset.fvtkResolution;
              const current = resolutionOf(game.messages.get(message.id));
              if (current.status === status) return;
              if (status === "hit" && current.status === "miss") await retractMiss(current.attack);
              const updated = await updateResolution(message, { status, note: t("SetByGM") });
              if (status === "miss") await narrateOutcome(updated, "miss", missDetail(updated));
            })
          )
        );
    }
    // A damage card the toolkit has already applied says so, so it isn't applied twice.
    const applied = message.flags[MODULE_ID]?.applied;
    if (applied) {
      const note = document.createElement("p");
      note.className = "fvtk fvtk-applied hint";
      note.textContent = t("Applied", { name: applied });
      html.querySelector(".message-content")?.append(note);
    }
  });
}
