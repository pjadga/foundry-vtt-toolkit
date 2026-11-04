/**
 * Import and export of Foundry JSON files for the sidebar tabs: the parts that need no Foundry
 * globals, so they can be tested with `node --test`. The Foundry side is in json-files.mjs.
 *
 * A file can be Foundry's own export of one document (Export Data, `fvtt-Actor-….json`), an array
 * of documents, or the toolkit's bundle of a whole tab:
 *   { "fvtk": "documents", "version": 1, "documentName": "Actor", "folders": [...], "documents": [...] }
 */

export const BUNDLE_KIND = "documents";
export const BUNDLE_VERSION = 1;

/** The sidebar tabs with Import and Export buttons, by document name. */
export const TABS = {
  Actor: { hook: "renderActorDirectory", key: "Actors" },
  Item: { hook: "renderItemDirectory", key: "Items" },
  Scene: { hook: "renderSceneDirectory", key: "Scenes" },
  Playlist: { hook: "renderPlaylistDirectory", key: "Playlists" },
  Cards: { hook: "renderCardsDirectory", key: "Cards" },
  RollTable: { hook: "renderRollTableDirectory", key: "Tables" },
  JournalEntry: { hook: "renderJournalDirectory", key: "Journals" },
  Combat: { hook: "renderCombatTracker", key: "Combats" }
};

// What each kind of document has that the others don't, to catch a file dropped on the wrong tab.
const SIGNS = {
  Actor: d => "prototypeToken" in d || ("system" in d && "items" in d && "effects" in d && !("pages" in d)),
  Item: d => "system" in d && !("prototypeToken" in d) && !("items" in d) && !("pages" in d),
  Scene: d => "grid" in d || "tokens" in d || "walls" in d || ("background" in d && "navigation" in d),
  Playlist: d => "sounds" in d,
  Cards: d => "cards" in d,
  RollTable: d => "results" in d || "formula" in d,
  JournalEntry: d => "pages" in d,
  Combat: d => "combatants" in d
};

/** Whether a plain object looks like a document of this kind. */
export function looksLike(documentName, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const exported = data.flags?.exportSource;
  const sign = SIGNS[documentName];
  if (!sign) return true; // a kind we don't know: let Foundry validate it
  if (sign(data)) {
    // An Item has "system" too; make sure it isn't really an Actor.
    if (documentName === "Item" && SIGNS.Actor(data)) return false;
    return true;
  }
  return Boolean(exported && Object.keys(SIGNS).every(k => k === documentName || !SIGNS[k](data)) && "name" in data);
}

/** The kind a document seems to be, or null. Used for the Compendium tab, where any kind can come in. */
export function guessKind(data) {
  const order = ["Combat", "JournalEntry", "Playlist", "Cards", "RollTable", "Scene", "Actor", "Item"];
  return order.find(k => SIGNS[k](data) && looksLike(k, data)) ?? null;
}

/**
 * The documents and folders in a parsed JSON file.
 * @param {any} json
 * @param {string|null} documentName The tab's kind, or null to accept any (the Compendium tab).
 * @returns {{documentName: string|null, documents: object[], folders: object[], problems: string[]}}
 */
export function readImport(json, documentName = null) {
  const problems = [];
  let documents;
  let folders = [];
  let kind = documentName;
  if (json && typeof json === "object" && json.fvtk === BUNDLE_KIND) {
    if (documentName && json.documentName !== documentName) {
      return { documentName, documents: [], folders: [], problems: [`it holds ${json.documentName} documents, not ${documentName}`] };
    }
    kind = json.documentName ?? documentName;
    documents = Array.isArray(json.documents) ? json.documents : [];
    folders = Array.isArray(json.folders) ? json.folders.filter(f => f && typeof f === "object" && f.name) : [];
  } else if (Array.isArray(json)) {
    documents = json;
  } else if (json && typeof json === "object") {
    documents = [json];
  } else {
    return { documentName, documents: [], folders: [], problems: ["it isn't a Foundry document"] };
  }
  const kept = [];
  for (const [i, data] of documents.entries()) {
    const name = data?.name ? `"${data.name}"` : `#${i + 1}`;
    const ownKind = kind ?? guessKind(data);
    if (!ownKind) problems.push(`${name} isn't a kind of document the toolkit recognises`);
    else if (!looksLike(ownKind, data)) problems.push(`${name} isn't ${article(ownKind)} ${ownKind}`);
    else kept.push(data);
  }
  return { documentName: kind ?? (kept.length ? guessKind(kept[0]) : null), documents: kept, folders, problems };
}

const article = word => (/^[aeiou]/i.test(word) ? "an" : "a");

/**
 * Folders ordered so each comes after its parent; folders whose parent isn't in the list become
 * top-level. Returns copies.
 * @param {{_id: string, folder?: string|null}[]} folders
 */
export function parentsFirst(folders) {
  const ids = new Set(folders.map(f => f._id));
  const pending = folders.map(f => ({ ...f, folder: ids.has(f.folder) ? f.folder : null }));
  const out = [];
  const placed = new Set();
  while (pending.length) {
    const i = pending.findIndex(f => !f.folder || placed.has(f.folder));
    // A loop of folders: break it by making the first one top-level.
    const [next] = pending.splice(i === -1 ? 0 : i, 1);
    if (i === -1) next.folder = null;
    out.push(next);
    placed.add(next._id);
  }
  return out;
}

/**
 * A document's data, ready to create: no permissions or stats from the old world, the folder
 * swapped for its new id (or none), and the id kept only when it isn't already taken.
 * @param {object} data
 * @param {{folderIds?: Map<string, string>, taken?: (id: string) => boolean}} options
 * @returns {{data: object, keepId: boolean}}
 */
export function prepareDocument(data, { folderIds = new Map(), taken = () => false } = {}) {
  const { _stats, ownership, folder, ...rest } = structuredClone(data);
  const copy = { ...rest, folder: folderIds.get(folder) ?? null };
  if (!copy._id || taken(copy._id)) delete copy._id;
  return { data: copy, keepId: Boolean(copy._id) };
}

/** The toolkit's bundle of a tab's documents and folders. */
export function exportBundle(documentName, documents, folders, { world = "", system = "", core = "" } = {}) {
  return {
    fvtk: BUNDLE_KIND,
    version: BUNDLE_VERSION,
    documentName,
    exported: { world, system, core },
    folders,
    documents
  };
}

/** "fvtk-actors-cpr-test-2026-11-04.json" */
export function exportFileName(label, world, date = new Date()) {
  const slug = s => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `fvtk-${[slug(label), slug(world)].filter(Boolean).join("-")}-${date.toISOString().slice(0, 10)}.json`;
}
