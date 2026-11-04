/**
 * Build campaign handlers for NotebookLM "table" and "cards" entries, and the combat encounters a
 * scene's `encounter:` asks for. Encounter entries themselves import as journals (their tactics);
 * the Combat is made when the scene is set up, from the encounter's combatants and the scene's
 * tokens. Pure parsing is in kinds.mjs.
 */
import { tableResults, cardLines, combatantCounts, tokensToAdd } from "./kinds.mjs";
import { findLinks, normalizeName } from "./parser.mjs";
import { tokenPositions } from "./setup.mjs";

const MODULE_ID = "foundry-vtt-toolkit";

/** "table" entry -> RollTable. Replacing one rebuilds its results. */
export async function importTable(entry, ctx) {
  const { formula, results } = tableResults(entry.fields);
  const description = ctx.notes({ public: entry.body ?? "", secret: "" });
  const resultData = results.map(r => ({ type: CONST.TABLE_RESULT_TYPES.TEXT, name: r.text.slice(0, 80), description: r.text, range: r.range, weight: r.range[1] - r.range[0] + 1 }));
  if (ctx.existing) {
    await ctx.existing.update({ name: entry.name, formula, description, flags: ctx.flags });
    const old = ctx.existing.results.map(r => r.id);
    if (old.length) await ctx.existing.deleteEmbeddedDocuments("TableResult", old);
    if (resultData.length) await ctx.existing.createEmbeddedDocuments("TableResult", resultData);
    return ctx.existing;
  }
  return RollTable.create(
    { _id: ctx.id, name: entry.name, folder: ctx.folder.id, formula, description, replacement: true, displayRoll: true, results: resultData, flags: ctx.flags },
    { keepId: true, pack: ctx.pack }
  );
}

/** "cards" entry -> a deck, hand or pile of text cards. Replacing one rebuilds its cards. */
export async function importCards(entry, ctx) {
  const { type, cards } = cardLines(entry.fields);
  const description = ctx.notes({ public: entry.body ?? "", secret: "" });
  // A card shows its face's name and text (with no face it's "Unknown"), so each gets one face.
  const cardData = cards.map((c, i) => {
    const text = c.text ? `<p>${foundry.utils.escapeHTML(c.text)}</p>` : "";
    return { name: c.name, description: text, type: "base", value: i + 1, sort: (i + 1) * 100000, faces: [{ name: c.name, text }], face: 0, back: { name: entry.name } };
  });
  // A stack's type (deck, hand, pile) can't be changed in place: rebuild it with the same id.
  if (ctx.existing && ctx.existing.type !== type) await ctx.existing.delete();
  else if (ctx.existing) {
    await ctx.existing.update({ name: entry.name, description, flags: ctx.flags });
    const old = ctx.existing.cards.map(c => c.id);
    if (old.length) await ctx.existing.deleteEmbeddedDocuments("Card", old);
    if (cardData.length) await ctx.existing.createEmbeddedDocuments("Card", cardData);
    return ctx.existing;
  }
  return Cards.create(
    { _id: ctx.id, name: entry.name, type, folder: ctx.folder.id, description, cards: cardData, flags: ctx.flags },
    { keepId: true, pack: ctx.pack }
  );
}

/** The imported encounter journal of this name, or null. */
function encounterJournal(name) {
  return game.journal.find(j => j.flags[MODULE_ID]?.type === "encounter" && normalizeName(j.flags[MODULE_ID]?.baseName ?? j.name) === normalizeName(name)) ?? null;
}

/**
 * The combat encounter for a scene: hidden tokens for every combatant (as many as its count, added
 * next to the ones scene setup placed) and one Combat on the scene, flagged with the encounter's
 * name, holding those tokens. A later setup replaces the encounter's combatants. Not activated.
 * @param {Scene} scene
 * @param {object} entry The scene entry.
 * @param {(collection: any, name: string) => any} named Finds a document by name.
 * @returns {Promise<string[]>} Names that couldn't be found (encounters or actors).
 */
export async function setupEncounter(scene, entry, named) {
  const missing = [];
  const [name] = findLinks(entry.fields.encounter ?? "");
  if (!name) return missing;
  const journal = encounterJournal(name);
  if (!journal) return [name];
  const wanted = combatantCounts(journal.flags[MODULE_ID]?.combatants ?? "");
  const actors = new Map();
  for (const { name: who } of wanted) {
    const actor = named(game.actors, who);
    if (actor) actors.set(who, actor);
    else missing.push(who);
  }
  const counted = wanted.filter(w => actors.has(w.name));
  const tokensOf = who => scene.tokens.filter(t => t.actorId === actors.get(who).id);

  // More tokens where the encounter has more of an NPC than the scene shows.
  const flags = { [MODULE_ID]: { placed: true, encounter: name } };
  const add = tokensToAdd(counted, who => tokensOf(who).length);
  const total = add.reduce((n, a) => n + a.add, 0);
  if (total) {
    const { sceneX = 0, sceneY = 0 } = scene.dimensions ?? {};
    const spots = tokenPositions(total + scene.tokens.size, { width: scene.width, height: scene.height, size: scene.grid.size }).slice(scene.tokens.size);
    const tokens = [];
    let i = 0;
    for (const { name: who, add: n } of add) {
      for (let k = 0; k < n; k++, i++) {
        const token = await actors.get(who).getTokenDocument({ x: sceneX + spots[i].x, y: sceneY + spots[i].y, hidden: true, flags });
        tokens.push(token.toObject());
      }
    }
    await scene.createEmbeddedDocuments("Token", tokens);
  }

  const combatants = counted.flatMap(({ name: who, count }) => tokensOf(who).slice(0, count).map(t => ({ tokenId: t.id, sceneId: scene.id, actorId: t.actorId, hidden: true })));
  let combat = game.combats.find(c => c.flags[MODULE_ID]?.encounter && c.scene?.id === scene.id);
  const combatFlags = { [MODULE_ID]: { source: "notebooklm", type: "encounter", encounter: name, journal: journal.id } };
  if (combat) {
    await combat.update({ flags: combatFlags });
    const old = combat.combatants.map(c => c.id);
    if (old.length) await combat.deleteEmbeddedDocuments("Combatant", old);
  } else {
    [combat] = await Combat.createDocuments([{ scene: scene.id, active: false, flags: combatFlags }]);
  }
  if (combatants.length) await combat.createEmbeddedDocuments("Combatant", combatants);
  return missing;
}
