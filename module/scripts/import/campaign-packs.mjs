import { CAMPAIGN_PACKS, PACK_FOLDER, IN_PLACE_EMBEDDED } from "./campaign.mjs";

/**
 * The world compendiums Build campaign builds into, one per document type, in a "NotebookLM"
 * compendium folder; created on first use, unlocked and loaded.
 * @returns {Promise<Record<string, CompendiumCollection>>} By document name (JournalEntry, Actor...).
 */
export async function campaignPacks() {
  const { CompendiumCollection } = foundry.documents.collections;
  let folder = game.folders.find(f => f.type === "Compendium" && f.name === PACK_FOLDER && !f.folder);
  folder ??= await Folder.create({ name: PACK_FOLDER, type: "Compendium" });
  const packs = {};
  for (const [documentName, { name, label }] of Object.entries(CAMPAIGN_PACKS)) {
    let pack = game.packs.get(`world.${name}`);
    pack ??= await CompendiumCollection.createCompendium({ type: documentName, name, label: game.i18n.localize(label) });
    if (pack.locked) await pack.configure({ locked: false });
    if (pack.folder?.id !== folder.id) await pack.configure({ folder: folder.id });
    await pack.getDocuments();
    packs[documentName] = pack;
  }
  return packs;
}

/** The campaign compendiums that already exist (without creating any). */
export function existingCampaignPacks() {
  return Object.values(CAMPAIGN_PACKS).map(({ name }) => game.packs.get(`world.${name}`)).filter(Boolean);
}

/**
 * Find or create a folder, in the world or in a compendium.
 * @param {string} name
 * @param {string} type Document type the folder holds.
 * @param {Folder|null} parent
 * @param {CompendiumCollection|null} pack
 */
export async function ensureFolder(name, type, parent = null, pack = null) {
  const folders = pack ? pack.folders : game.folders;
  const existing = folders.find(f => f.type === type && f.name === name && (f.folder?.id ?? null) === (parent?.id ?? null));
  return existing ?? Folder.create({ name, type, folder: parent?.id ?? null }, pack ? { pack: pack.collection } : {});
}

/** The same folder path (by names) in the world, or in a compendium. */
async function mirrorFolder(folder, pack) {
  if (!folder) return null;
  const parent = folder.folder ? await mirrorFolder(folder.folder, pack) : null;
  return ensureFolder(folder.name, folder.type, parent, pack);
}

/**
 * Copy a document into the world (pack = null) or into a compendium, keeping its id and folder path,
 * so links, tokens and journal pins keep pointing at it. An existing copy is replaced, except that a
 * scene or playlist copied into the world is updated in place: it keeps the tokens, pins and tracks
 * the world added. A player character keeps the users it was assigned to.
 * @param {ClientDocument} doc
 * @param {CompendiumCollection|null} pack
 * @returns {Promise<ClientDocument>} The copy.
 */
export async function copyDocument(doc, pack = null) {
  const name = doc.documentName;
  const cls = CONFIG[name].documentClass;
  const collection = pack ?? game.collections.get(name);
  const data = doc.toObject();
  data.folder = (await mirrorFolder(doc.folder, pack))?.id ?? null;
  const target = collection.get(doc.id);
  const options = pack ? { keepId: true, pack: pack.collection } : { keepId: true };

  if (target && !pack && IN_PLACE_EMBEDDED[name]) {
    for (const key of IN_PLACE_EMBEDDED[name]) delete data[key];
    delete data._id;
    delete data._stats;
    await target.update(data);
    return target;
  }
  const assigned = !pack && name === "Actor" ? game.users.filter(u => u.character?.id === doc.id) : [];
  if (target) await target.delete();
  let copy;
  if (name === "JournalEntry") {
    // Pages go in as embedded documents: nested in the create, Markdown pages can lose their HTML.
    const pages = data.pages ?? [];
    data.pages = [];
    [copy] = await cls.createDocuments([data], options);
    if (pages.length) await copy.createEmbeddedDocuments("JournalEntryPage", pages, { keepId: true });
  } else [copy] = await cls.createDocuments([data], options);
  for (const user of assigned) await user.update({ character: copy.id });
  return copy;
}

/** Delete everything in the campaign compendiums, folders included. */
export async function clearCampaignPacks() {
  for (const pack of existingCampaignPacks()) {
    await pack.getDocuments();
    const ids = pack.contents.map(d => d.id);
    if (ids.length) await CONFIG[pack.documentName].documentClass.deleteDocuments(ids, { pack: pack.collection });
    const folders = [...pack.folders].sort((a, b) => b.ancestors.length - a.ancestors.length).map(f => f.id);
    if (folders.length) await Folder.deleteDocuments(folders, { pack: pack.collection });
  }
}

/** How many documents the campaign compendiums hold. */
export async function campaignPackCount() {
  let count = 0;
  for (const pack of existingCampaignPacks()) count += (await pack.getIndex()).size;
  return count;
}
