/**
 * Build campaign's compendium layout and the existing-campaign question: the parts that need no
 * Foundry globals, so they can be tested with `node --test`. The Foundry side is in campaign-packs.mjs.
 */

/** Compendium folder that holds the campaign compendiums. */
export const PACK_FOLDER = "NotebookLM";

/** One world compendium per document type: its name and its lang key. */
export const CAMPAIGN_PACKS = {
  JournalEntry: { name: "notebooklm-journal", label: "FVTK.Packs.Journal" },
  Actor: { name: "notebooklm-actors", label: "FVTK.Packs.Actors" },
  Item: { name: "notebooklm-items", label: "FVTK.Packs.Items" },
  Scene: { name: "notebooklm-scenes", label: "FVTK.Packs.Scenes" },
  Playlist: { name: "notebooklm-playlists", label: "FVTK.Packs.Playlists" },
  RollTable: { name: "notebooklm-tables", label: "FVTK.Packs.Tables" },
  Cards: { name: "notebooklm-cards", label: "FVTK.Packs.Cards" }
};

/**
 * Embedded collections a world copy keeps when the compendium copy is added again: the tokens,
 * pins and drawings on a scene, and the tracks picked for a playlist. Also the scene thumbnail,
 * which is made in the world.
 */
export const IN_PLACE_EMBEDDED = {
  Scene: ["tokens", "notes", "drawings", "lights", "sounds", "regions", "templates", "tiles", "walls", "thumb"],
  Playlist: ["sounds"]
};

const COUNT_FIELDS = ["journal", "scenes", "actors", "items", "playlists", "tables", "cards", "combats"];

/**
 * What an earlier import left: how many documents of each kind, in the world and in the campaign
 * compendiums. The GM is asked about it only when there is anything.
 * @param {Record<string, any[]>} docs campaignDocuments() of the world.
 * @param {number} packed Documents in the campaign compendiums.
 * @returns {{total: number, counts: Record<string, number>, packed: number, ask: boolean}}
 */
export function existingCampaign(docs, packed = 0) {
  const counts = Object.fromEntries(COUNT_FIELDS.map(k => [k, docs?.[k]?.length ?? 0]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { total, counts, packed, ask: total > 0 || packed > 0 };
}

/**
 * Name for the Adventure an old campaign is archived as before the world is cleaned: its overview
 * journal's title ("Section 9 Overview" -> "Section 9"), else the world's title, with the date.
 * @param {string[]} journalNames Names of the campaign's journals.
 * @param {string} worldTitle
 * @param {Date} date
 */
export function archiveName(journalNames, worldTitle, date = new Date()) {
  // "Campaign Overview" says nothing about which campaign, so it falls back to the world's title.
  const overview = journalNames.find(n => /\boverview\b/i.test(n));
  const title = overview?.replace(/\s*(campaign\s+)?overview\s*$/i, "").trim() || worldTitle;
  return `${title} (${date.toISOString().slice(0, 10)})`;
}
