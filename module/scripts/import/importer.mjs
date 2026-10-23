import { parseBundle, resolveLinks, toMarkdown, normalizeName, findImage, findLinks, progressionKey, stripNumber, numberInOrder } from "./parser.mjs";
import { imagePrompt, imagesNeeded, DEFAULT_STYLE } from "../images/prompts.mjs";
import { PROVIDERS } from "../images/generate.mjs";
import { generateSceneImages } from "../images/review.mjs";
import { autoPickTracks, playlistsToFill } from "../youtube/tracks.mjs";
import { namesIn, tokenPositions, notePosition } from "./setup.mjs";
import { campaignCheck, fixPrompt } from "./check.mjs";

const MODULE_ID = "foundry-vtt-toolkit";
const ROOT_FOLDER = "NotebookLM";

// Entry types that become journal entries, and the subfolder each goes into.
const JOURNAL_TYPES = {
  journal: "Campaign",
  location: "Locations",
  thread: "Story Threads",
  scene: "Scenes"
};

// Journal types that also become a Foundry scene when they have an image, and the scene subfolder.
const SCENE_TYPES = {
  location: "Locations",
  scene: "Scenes"
};

/**
 * Importers for other entry types, registered by system code (see registerType).
 * @type {Record<string, {label: string, documentName: string, folder: string, import: Function}>}
 */
const HANDLERS = {};

/**
 * Register an importer for an entry type, e.g. Cyberpunk RED registers "item" and "npc".
 * Types are imported in ascending handler.order (journals first, at 0), so an NPC importer can
 * use items imported in the same run. handler.import(entry, ctx) creates or replaces one document
 * and returns it. ctx has:
 * id (use with keepId), existing (document to replace, or null), folder, flags (merge into the
 * document's flags), lookup (name -> uuid for [[links]]) and notes (builds linkable notes HTML,
 * see notesHTML; pass its result through ctx.track to enable relinking).
 * @param {string} type
 * @param {{label: string, documentName: "Actor"|"Item", folder: string, order?: number, import: Function}} handler
 */
export function registerType(type, handler) {
  HANDLERS[type] = handler;
}

const documentNameFor = type => (type in JOURNAL_TYPES ? "JournalEntry" : HANDLERS[type]?.documentName);
const destinationFor = type => JOURNAL_TYPES[type] ?? HANDLERS[type]?.label;
const isSupported = type => !!documentNameFor(type);

/**
 * name -> uuid across journals, actors, items and playlists, matched loosely (see normalizeName).
 * NotebookLM imports win over other documents with the same name.
 */
export function worldLookup() {
  const index = new Map();
  const docs = [...game.actors, ...game.items, ...game.journal, ...game.playlists];
  const isImport = d => d.flags[MODULE_ID]?.source === "notebooklm";
  for (const d of [...docs.filter(d => !isImport(d)), ...docs.filter(isImport)]) index.set(normalizeName(d.name), d.uuid);
  return name => index.get(normalizeName(name)) ?? null;
}

/** Find or create a folder of a document type, optionally under a parent. */
async function ensureFolder(name, type, parent = null) {
  const existing = game.folders.find(f => f.type === type && f.name === name && (f.folder?.id ?? null) === (parent?.id ?? null));
  return existing ?? Folder.create({ name, type, folder: parent?.id ?? null });
}

/**
 * Notes HTML for an imported document: a public part and a GM-only secret part, both Markdown with
 * [[links]]. The secret id is derived from the document id so the output is stable for relinking.
 * @param {{public: string, secret: string}} raw
 * @param {string} docId
 * @param {(name: string) => string|null} lookup
 */
export function notesHTML(raw, docId, lookup) {
  const converter = new showdown.Converter(CONST.SHOWDOWN_OPTIONS);
  const html = md => converter.makeHtml(resolveLinks(md, lookup));
  const parts = [];
  if (raw.public) parts.push(html(raw.public));
  if (raw.secret) parts.push(`<section class="secret" id="secret-${docId}">${html(raw.secret)}</section>`);
  return parts.join("\n");
}

/**
 * Import parsed entries. Journal types become journal entries; types with a registered handler
 * are passed to it; the rest are reported as skipped. Every entry's id is decided first, so
 * [[links]] resolve between entries of any type in the bundle and to existing documents. Earlier
 * imports are then re-linked to anything new (see relink). Locations and scenes with an image (see
 * sceneImages) also get a Foundry scene linked to their journal.
 * @param {object[]} entries From parseBundle.
 * @param {{overwrite?: boolean, images?: string[]}} options images: paths in the scene image folder.
 * @returns {Promise<{created: string[], updated: string[], skipped: string[], relinked: string[], scenes: {created: string[], updated: string[], skipped: string[]}}>}
 */
export async function importEntries(entries, { overwrite = false, images = [] } = {}) {
  const report = { created: [], updated: [], skipped: [], relinked: [], scenes: { created: [], updated: [], skipped: [] } };
  for (const e of entries) if (!isSupported(e.type)) report.skipped.push(`${e.name} (${e.type || "no type"}: not supported yet)`);
  const supported = entries.filter(e => isSupported(e.type));
  if (!supported.length) return report;

  const roots = {};
  const folders = {};
  for (const type of new Set(supported.map(e => e.type))) {
    const documentName = documentNameFor(type);
    roots[documentName] ??= await ensureFolder(ROOT_FOLDER, documentName);
    folders[type] = await ensureFolder(JOURNAL_TYPES[type] ?? HANDLERS[type].folder, documentName, roots[documentName]);
  }

  // Decide every entry's id up front so links can point at documents that don't exist yet.
  // An entry with `replaces:` supersedes that document (keeping its id, so links to it survive) even
  // without the overwrite option; otherwise an existing document of the same name is the target.
  const plan = supported.map(e => {
    const documentName = documentNameFor(e.type);
    const inFolder = name => game.collections.get(documentName).find(d => normalizeName(d.name) === normalizeName(name) && d.folder?.id === folders[e.type].id);
    const existing = (e.replaces && inFolder(e.replaces)) || inFolder(e.name) || null;
    return { entry: e, documentName, existing, replace: overwrite || !!e.replaces, id: existing?.id ?? foundry.utils.randomID() };
  });
  const orderOf = type => HANDLERS[type]?.order ?? 0;
  plan.sort((a, b) => orderOf(a.entry.type) - orderOf(b.entry.type));
  const byName = new Map(plan.map(p => [normalizeName(p.entry.name), `${p.documentName}.${p.id}`]));
  const inWorld = worldLookup();
  const lookup = name => byName.get(normalizeName(name)) ?? inWorld(name);

  const toCreate = [];
  const newPages = new Map();
  for (const { entry, documentName, existing, replace, id } of plan) {
    if (existing && !replace) {
      report.skipped.push(`${entry.name} (already exists)`);
      continue;
    }
    const outcome = existing ? report.updated : report.created;
    const baseFlags = { source: "notebooklm", type: entry.type, tags: entry.tags };
    if (entry.type === "scene") baseFlags.order = progressionKey(entry);

    if (documentName === "JournalEntry") {
      const raw = toMarkdown(entry);
      const markdown = resolveLinks(raw, lookup);
      const page = pageData(entry.name, markdown);
      // raw keeps the [[links]] for relinking; generated lets relink tell whether the GM edited the page.
      const flags = { [MODULE_ID]: { ...baseFlags, raw, generated: markdown } };
      if (existing) {
        await existing.update({ name: entry.name, flags });
        await replacePage(existing, page);
      } else {
        toCreate.push({ _id: id, name: entry.name, folder: folders[entry.type].id, flags });
        newPages.set(id, page);
      }
      outcome.push(entry.name);
      continue;
    }

    try {
      const ctx = {
        id,
        existing,
        folder: folders[entry.type],
        flags: { [MODULE_ID]: baseFlags },
        lookup,
        notes: raw => notesHTML(raw, id, lookup),
        track: (doc, notesPath, raw) => trackNotes(doc, notesPath, raw)
      };
      await HANDLERS[entry.type].import(entry, ctx);
      outcome.push(entry.name);
    } catch (err) {
      console.error(`${MODULE_ID} | Failed to import ${entry.type} "${entry.name}"`, err);
      report.skipped.push(`${entry.name} (error: ${err.message})`);
    }
  }
  if (toCreate.length) {
    const created = await JournalEntry.createDocuments(toCreate, { keepId: true });
    for (const journal of created) await journal.createEmbeddedDocuments("JournalEntryPage", [newPages.get(journal.id)]);
  }

  report.scenes = await importScenes(plan.filter(p => p.entry.type in SCENE_TYPES), images);
  await orderScenes();

  const touched = new Set([...report.created, ...report.updated]);
  report.relinked = (await relink()).filter(name => !touched.has(name));
  return report;
}

/**
 * The background for each location or scene entry: its own image (see findImage), else, for a
 * scene entry, the image of the first [[location]] it names, from this bundle or from an existing
 * scene of that name.
 * @param {object[]} entries
 * @param {string[]} images
 * @returns {Map<object, string>} entry -> image path, for entries that have one.
 */
export function sceneImages(entries, images) {
  const out = new Map();
  const byLocation = new Map();
  for (const e of entries.filter(e => e.type in SCENE_TYPES)) {
    const src = findImage(e, images);
    if (!src) continue;
    out.set(e, src);
    if (e.type === "location") byLocation.set(normalizeName(e.name), src);
  }
  for (const e of entries.filter(e => e.type === "scene" && !out.has(e))) {
    for (const location of findLinks(e.fields.location ?? "")) {
      const src = byLocation.get(normalizeName(location)) ?? game.scenes.find(s => normalizeName(sceneBaseName(s)) === normalizeName(location))?.background.src;
      if (src) {
        out.set(e, src);
        break;
      }
    }
  }
  return out;
}

/**
 * Create or update a gridless Foundry scene, sized to its image, for each location or scene entry
 * with an image, with the scene's notes pointing at the entry's journal. An existing scene is
 * updated in place (keeping tokens, drawings and walls) when the entry is being replaced, and
 * skipped otherwise; a missing scene is created even if its journal already existed.
 */
async function importScenes(plan, images) {
  const result = { created: [], updated: [], skipped: [] };
  const srcFor = sceneImages(plan.map(p => p.entry), images);
  const findFolder = (name, parent) => game.folders.find(f => f.type === "Scene" && f.name === name && (f.folder?.id ?? null) === (parent?.id ?? null));
  for (const { entry, id, replace } of plan) {
    // Look for the entry's scene first: one that exists keeps its own background when no image is
    // given this time, and still gets set up.
    const sceneFolder = findFolder(SCENE_TYPES[entry.type], findFolder(ROOT_FOLDER, null));
    const sameName = name => sceneFolder && game.scenes.find(s => s.folder?.id === sceneFolder.id && normalizeName(sceneBaseName(s)) === normalizeName(name));
    const existing = (entry.replaces && sameName(entry.replaces)) || sameName(entry.name) || null;
    const src = srcFor.get(entry) ?? existing?.background.src;
    if (!src) {
      if (entry.type === "scene") result.skipped.push(`${entry.name} (no image)`);
      continue;
    }
    const folder = sceneFolder ?? (await ensureFolder(SCENE_TYPES[entry.type], "Scene", await ensureFolder(ROOT_FOLDER, "Scene")));
    if (existing && !replace) {
      // A scene from before scene setup existed still gets its tokens, pin and soundtrack, once.
      if (existing.flags[MODULE_ID]?.source === "notebooklm" && !existing.flags[MODULE_ID]?.setup) {
        const missing = await setupScene(existing, entry, game.journal.get(id)).catch(err => [`(setup error: ${err.message})`]);
        result.skipped.push(...missing.map(name => `${entry.name}: no actor or playlist named ${name}`));
      }
      result.skipped.push(`${entry.name} (scene already exists)`);
      continue;
    }
    let texture;
    try {
      texture = await foundry.canvas.loadTexture(src);
    } catch (err) {
      console.error(`${MODULE_ID} | Could not load ${src}`, err);
    }
    if (!texture) {
      result.skipped.push(`${entry.name} (could not load ${src})`);
      continue;
    }
    const data = {
      // Scene entries get their number from orderScenes; keep any number the scene already has.
      name: entry.type === "scene" && existing ? existing.name.replace(stripNumber(existing.name), entry.name) : entry.name,
      folder: folder.id,
      background: { src },
      width: texture.width,
      height: texture.height,
      padding: 0,
      grid: { type: CONST.GRID_TYPES.GRIDLESS },
      navigation: false,
      journal: game.journal.get(id) ? id : null,
      flags: { [MODULE_ID]: { source: "notebooklm", type: entry.type, baseName: entry.name, order: entry.type === "scene" ? progressionKey(entry) : null } }
    };
    const scene = existing ? (await existing.update(data), existing) : await Scene.create(data);
    try {
      const { thumb } = await scene.createThumbnail();
      await scene.update({ thumb });
    } catch (err) {
      console.warn(`${MODULE_ID} | No thumbnail for ${scene.name}`, err);
    }
    try {
      const missing = await setupScene(scene, entry, game.journal.get(id));
      result.skipped.push(...missing.map(name => `${entry.name}: no actor or playlist named ${name}`));
    } catch (err) {
      console.error(`${MODULE_ID} | Could not set up ${scene.name}`, err);
      result.skipped.push(`${entry.name} (setup error: ${err.message})`);
    }
    (existing ? result.updated : result.created).push(entry.name);
  }
  return result;
}

/** The document of that name in a collection, preferring NotebookLM imports. */
function named(collection, name) {
  const matches = collection.filter(d => normalizeName(d.name) === normalizeName(name));
  return matches.find(d => d.flags[MODULE_ID]?.source === "notebooklm") ?? matches[0] ?? null;
}

/**
 * Fill in an imported scene from its entry: hidden tokens for the NPCs it names (a scene's
 * `npcs_present`, a location's `npcs`), a map pin that opens its journal, and its `soundtrack`
 * playlist, which Foundry plays when the scene is activated. Tokens and the pin placed by an earlier
 * import are kept or removed to match the entry; tokens the GM added are left alone, and an NPC who
 * already has a token on the scene doesn't get another.
 * @returns {Promise<string[]>} Names that matched no actor or playlist.
 */
async function setupScene(scene, entry, journal) {
  const flags = { [MODULE_ID]: { placed: true } };
  const placed = d => d.flags[MODULE_ID]?.placed;
  const missing = [];
  const { sceneX = 0, sceneY = 0 } = scene.dimensions ?? {};

  const names = namesIn(entry.type === "scene" ? entry.fields.npcs_present : entry.fields.npcs);
  const actors = [];
  for (const name of names) {
    const actor = named(game.actors, name);
    if (actor && !actors.includes(actor)) actors.push(actor);
    else if (!actor) missing.push(name);
  }
  const wanted = new Set(actors.map(a => a.id));
  const stale = scene.tokens.filter(t => placed(t) && !wanted.has(t.actorId)).map(t => t.id);
  if (stale.length) await scene.deleteEmbeddedDocuments("Token", stale);
  const toPlace = actors.filter(a => !scene.tokens.some(t => t.actorId === a.id));
  if (toPlace.length) {
    const spots = tokenPositions(toPlace.length, { width: scene.width, height: scene.height, size: scene.grid.size });
    const tokens = [];
    for (const [i, actor] of toPlace.entries()) {
      const token = await actor.getTokenDocument({ x: sceneX + spots[i].x, y: sceneY + spots[i].y, hidden: true, flags });
      tokens.push(token.toObject());
    }
    await scene.createEmbeddedDocuments("Token", tokens);
  }

  if (journal) {
    const pin = scene.notes.find(placed);
    if (pin) {
      if (pin.entryId !== journal.id || pin.text !== entry.name) await pin.update({ entryId: journal.id, text: entry.name });
    } else {
      const { x, y } = notePosition(scene);
      await scene.createEmbeddedDocuments("Note", [{ entryId: journal.id, x: sceneX + x, y: sceneY + y, text: entry.name, texture: { src: "icons/svg/book.svg" }, iconSize: 48, flags }]);
    }
  }

  const soundtrack = namesIn(entry.fields.soundtrack);
  const playlist = soundtrack.map(name => named(game.playlists, name)).find(Boolean);
  const update = { [`flags.${MODULE_ID}.setup`]: true };
  if (playlist && scene._source.playlist !== playlist.id) Object.assign(update, { playlist: playlist.id, playlistSound: null });
  else if (soundtrack.length && !playlist) missing.push(...soundtrack);
  await scene.update(update);
  return missing;
}

/** A scene's name without the progression number orderScenes gives it. */
function sceneBaseName(scene) {
  return scene.flags[MODULE_ID]?.baseName ?? stripNumber(scene.name);
}

/**
 * Number the NotebookLM story scenes in campaign order ("1. Salvage in the Old Combat Zone", ...)
 * and sort them, and their journals, in that order. The order comes from each scene entry's session
 * (see progressionKey), recorded at import; for anything imported before that, it is read from the
 * scene's journal. Run after every import, so a scene added later slots into place. Journals keep
 * their names, so [[links]] to them still resolve.
 * @returns {Promise<string[]>} Names of scenes that were renamed.
 */
export async function orderScenes() {
  const folderOf = type => game.folders.find(f => f.type === type && f.name === (type === "Scene" ? SCENE_TYPES.scene : JOURNAL_TYPES.scene) && f.folder?.name === ROOT_FOLDER);
  const isStory = d => d.flags[MODULE_ID]?.source === "notebooklm" && d.flags[MODULE_ID]?.type === "scene";
  const journalKey = journal => {
    const flags = journal?.flags[MODULE_ID];
    if (!flags) return null;
    return flags.order ?? progressionKey({ fields: {}, tags: flags.tags, body: journal.pages.contents[0]?.text.markdown ?? "" });
  };
  const renamed = [];

  const journalFolder = folderOf("JournalEntry");
  if (journalFolder) {
    const journals = journalFolder.contents.filter(isStory);
    const order = [...numberInOrder(journals.map(j => ({ name: j.name, key: journalKey(j) }))).keys()];
    if (journalFolder.sorting !== "m") await journalFolder.update({ sorting: "m" });
    const updates = journals.map(j => ({ _id: j.id, sort: (order.indexOf(j.name) + 1) * 100 })).filter(u => game.journal.get(u._id).sort !== u.sort);
    if (updates.length) await JournalEntry.updateDocuments(updates);
  }

  const sceneFolder = folderOf("Scene");
  if (sceneFolder) {
    const scenes = sceneFolder.contents.filter(isStory);
    const items = scenes.map(s => ({ name: sceneBaseName(s), key: s.flags[MODULE_ID].order ?? journalKey(game.journal.get(s.journal?.id ?? s.journal)), scene: s }));
    const names = numberInOrder(items);
    const order = [...names.keys()];
    if (sceneFolder.sorting !== "m") await sceneFolder.update({ sorting: "m" });
    const updates = [];
    for (const { name, key, scene } of items) {
      const update = { _id: scene.id, name: names.get(name), sort: (order.indexOf(name) + 1) * 100, [`flags.${MODULE_ID}.baseName`]: name, [`flags.${MODULE_ID}.order`]: key };
      if (scene.name !== update.name || scene.sort !== update.sort || scene.flags[MODULE_ID].baseName !== name || scene.flags[MODULE_ID].order !== key) updates.push(update);
      if (scene.name !== update.name) renamed.push(update.name);
    }
    if (updates.length) await Scene.updateDocuments(updates);
  }
  return renamed;
}

/**
 * Record what was generated into a document's notes field, so relink can rebuild it later and
 * tell whether the GM has edited it. Reads the stored value back, since the server may normalize
 * the HTML.
 */
async function trackNotes(doc, notesPath, raw) {
  const generated = foundry.utils.getProperty(doc, notesPath);
  await doc.update({ [`flags.${MODULE_ID}.notes`]: { path: notesPath, raw, generated } });
}

function pageData(name, markdown) {
  return { name, type: "text", text: { format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.MARKDOWN, markdown } };
}

// Pages are always created as embedded documents: Markdown pages nested in JournalEntry.create,
// or changed with page.update, are stored without their rendered HTML and display blank.
async function replacePage(journal, page) {
  await journal.deleteEmbeddedDocuments("JournalEntryPage", journal.pages.map(p => p.id));
  await journal.createEmbeddedDocuments("JournalEntryPage", [page]);
}

/**
 * Re-resolve links in every NotebookLM journal and in the notes of imported actors and items, so a
 * document imported before its link targets existed picks them up (and links to deleted documents
 * fall back to bold text). Anything the GM has edited since import is left alone.
 * @returns {Promise<string[]>} Names of documents that were rewritten.
 */
export async function relink() {
  const changed = [];
  const lookup = worldLookup();
  for (const journal of game.journal) {
    const flags = journal.flags[MODULE_ID];
    const page = journal.pages.contents[0];
    if (flags?.source !== "notebooklm" || !flags.raw || !page || journal.pages.size !== 1) continue;
    if (page.text.markdown !== flags.generated) continue; // edited by hand
    const markdown = resolveLinks(flags.raw, lookup);
    if (markdown === flags.generated) continue;
    await journal.update({ [`flags.${MODULE_ID}.generated`]: markdown });
    await replacePage(journal, pageData(page.name, markdown));
    changed.push(journal.name);
  }
  for (const doc of [...game.actors, ...game.items]) {
    const notes = doc.flags[MODULE_ID]?.notes;
    if (!notes?.raw || foundry.utils.getProperty(doc, notes.path) !== notes.generated) continue;
    const html = notesHTML(notes.raw, doc.id, lookup);
    if (html === notes.generated) continue;
    await doc.update({ [notes.path]: html });
    await trackNotes(doc, notes.path, notes.raw);
    changed.push(doc.name);
  }
  return changed;
}

const escape = s => foundry.utils.escapeHTML(String(s));

/**
 * The campaign check for a bundle, against what the world already has: documents of a linked name
 * count as existing, and documents linked from earlier imports count as connected.
 */
function checkBundle(entries) {
  const inWorld = worldLookup();
  // Earlier copies of this bundle's own entries are being re-imported, so they don't count.
  const inBundle = new Set(entries.map(e => normalizeName(e.name)));
  const linked = new Map();
  for (const doc of [...game.journal, ...game.actors, ...game.items]) {
    const flags = doc.flags[MODULE_ID];
    if (inBundle.has(normalizeName(doc.name))) continue;
    const raw = flags?.raw ?? flags?.notes?.raw;
    const text = typeof raw === "string" ? raw : [raw?.public, raw?.secret].join("\n");
    const type = flags?.type ?? doc.documentName.toLowerCase();
    for (const name of findLinks(text ?? "")) {
      const key = normalizeName(name);
      if (key === normalizeName(doc.name)) continue;
      if (!linked.has(key)) linked.set(key, []);
      linked.get(key).push(type);
    }
  }
  return campaignCheck(entries, {
    known: name => !!inWorld(name),
    linkedElsewhere: name => linked.get(normalizeName(name)) ?? []
  });
}

/** The earlier NotebookLM import an entry would replace (or be kept instead of), if any. */
function existingFor(e) {
  const documentName = documentNameFor(e.type);
  if (!documentName) return null;
  const match = name => game.collections.get(documentName).find(d => d.flags[MODULE_ID]?.source === "notebooklm" && d.flags[MODULE_ID]?.type === e.type && normalizeName(d.name) === normalizeName(name));
  return (e.replaces && match(e.replaces)) || match(e.name) || null;
}

const SHOWN_ISSUES = 12;

function checkHTML(issues) {
  if (!issues) return "";
  if (!issues.length) return `<p class="fvtk-check ok"><i class="fa-solid fa-circle-check"></i> ${escape(game.i18n.localize("FVTK.Import.CheckOk"))}</p>`;
  const shown = issues.slice(0, SHOWN_ISSUES).map(i => `<li>${i.entry ? `<strong>${escape(i.entry)}</strong>: ` : ""}${escape(i.problem)}</li>`);
  if (issues.length > SHOWN_ISSUES) shown.push(`<li>${escape(game.i18n.format("FVTK.Import.CheckMore", { count: issues.length - SHOWN_ISSUES }))}</li>`);
  const title = issues.length === 1 ? game.i18n.localize("FVTK.Import.CheckIssuesOne") : game.i18n.format("FVTK.Import.CheckIssues", { count: issues.length });
  return `<details class="fvtk-check"><summary>${escape(title)}</summary>
    <ul>${shown.join("")}</ul>
    <p>${escape(game.i18n.localize("FVTK.Import.CheckFix"))}</p>
    <textarea readonly rows="6" class="fvtk-fix-prompt">${escape(fixPrompt(issues))}</textarea>
    <button type="button" class="fvtk-copy-fix"><i class="fa-solid fa-copy"></i> ${escape(game.i18n.localize("FVTK.Import.CopyFix"))}</button>
  </details>`;
}

/** Wire the preview's copy button (DialogV2 render callback). */
function onPreviewRender(event, dialog) {
  const button = dialog.element.querySelector(".fvtk-copy-fix");
  button?.addEventListener("click", async () => {
    await game.clipboard.copyPlainText(dialog.element.querySelector(".fvtk-fix-prompt").value);
    ui.notifications.info(game.i18n.localize("FVTK.Import.Copied"));
  });
}

function previewHTML({ entries, warnings }, images = [], jobs = [], issues = null, overwrite = false) {
  const srcFor = sceneImages(entries, images);
  const counts = { added: 0, replaced: 0, kept: 0 };
  const generating = new Set(jobs.map(j => j.entry));
  const generatedLocations = new Set(jobs.filter(j => j.entry.type === "location").map(j => normalizeName(j.entry.name)));
  const rows = entries.map(e => {
    let status = destinationFor(e.type) ?? "skipped (not supported yet)";
    if (isSupported(e.type)) {
      const replacing = overwrite || !!e.replaces;
      const kind = !existingFor(e) ? "added" : replacing ? "replaced" : "kept";
      counts[kind]++;
      if (kind !== "added") status += ` (${game.i18n.localize(`FVTK.Import.Exists.${kind}`)})`;
    }
    if (e.type in SCENE_TYPES) {
      const src = srcFor.get(e);
      const fromLocation = e.type === "scene" && findLinks(e.fields.location ?? "").some(n => generatedLocations.has(normalizeName(n)));
      if (src) status += ` + scene (${src.split("/").pop()})`;
      else if (generating.has(e)) status += " + scene (image will be generated)";
      else if (fromLocation) status += " + scene (location's generated image)";
      else if (e.type === "scene") status += " (no image, so no scene)";
    }
    return `<li><strong>${escape(e.name)}</strong> <em>${escape(e.type)}</em> → ${escape(status)}${e.links.length ? `<br><small>links: ${e.links.map(escape).join(", ")}</small>` : ""}</li>`;
  });
  const warn = warnings.length ? `<p><strong>Warnings</strong></p><ul>${warnings.map(w => `<li>${escape(w)}</li>`).join("")}</ul>` : "";
  const generate = jobs.length ? `<p>${escape(game.i18n.format("FVTK.Images.WillGenerate", { count: jobs.length, provider: game.settings.get(MODULE_ID, "imageProvider") }))}</p>` : "";
  const found = `${entries.length} entr${entries.length === 1 ? "y" : "ies"} found.`;
  const summary = counts.replaced || counts.kept ? ` ${game.i18n.format("FVTK.Import.Counts", counts)}` : "";
  return `<div class="fvtk fvtk-import-preview"><p>${escape(found + summary)}</p>${checkHTML(issues)}${generate}<ul>${rows.join("")}</ul>${warn}</div>`;
}

/**
 * Paste dialog → preview → import. GM only.
 * @param {{text?: string}} [options] text: entries to start with, e.g. from the GM Assistant.
 */
export async function openImporter({ text: initial = "" } = {}) {
  if (!game.user.isGM) return ui.notifications.warn(game.i18n.localize("FVTK.Import.GMOnly"));
  const { DialogV2 } = foundry.applications.api;

  const input = await DialogV2.prompt({
    window: { title: game.i18n.localize("FVTK.Import.Title") },
    position: { width: 640 },
    content: `<div class="fvtk">
      <p>${game.i18n.localize("FVTK.Import.Instructions")}</p>
      <textarea name="text" rows="18" placeholder="##ENTRY&#10;type: journal&#10;name: ...">${escape(initial)}</textarea>
      <label>${game.i18n.localize("FVTK.Import.File")} <input type="file" name="file" accept=".md,.txt,text/markdown,text/plain"></label>
      <label>${game.i18n.localize("FVTK.Import.ImageFolder")}
        <file-picker name="imageFolder" type="folder" value="${escape(game.settings.get(MODULE_ID, "imageFolder"))}"></file-picker></label>
      <label><input type="checkbox" name="overwrite"> ${game.i18n.localize("FVTK.Import.Overwrite")}</label>
    </div>`,
    ok: {
      label: game.i18n.localize("FVTK.Import.Preview"),
      callback: (event, button) => {
        const { text, file, overwrite } = button.form.elements;
        const imageFolder = button.form.querySelector("file-picker[name=imageFolder]")?.value?.trim() ?? "";
        return { text: text.value, file: file.files[0] ?? null, overwrite: overwrite.checked, imageFolder };
      }
    },
    rejectClose: false
  });
  if (!input) return;
  // A chosen file wins over pasted text.
  const text = input.file ? await input.file.text() : input.text;
  if (!text.trim()) return ui.notifications.warn(game.i18n.localize("FVTK.Import.Empty"));
  // Generated images need somewhere to go, so default to a folder in the world.
  const folder = input.imageFolder || `worlds/${game.world.id}/assets/notebooklm`;
  await game.settings.set(MODULE_ID, "imageFolder", folder);
  // The default folder may not exist yet, which is fine.
  let images = await listImages(folder, { quiet: !input.imageFolder });

  const parsed = parseBundle(text);
  const importable = parsed.entries.filter(e => isSupported(e.type)).length;
  if (!importable) {
    return DialogV2.prompt({ window: { title: game.i18n.localize("FVTK.Import.Title") }, content: previewHTML(parsed, images), rejectClose: false });
  }
  const jobs = imageJobs(parsed.entries, images);
  const issues = checkBundle(parsed.entries);

  const confirmed = await DialogV2.confirm({
    window: { title: game.i18n.localize("FVTK.Import.Title") },
    position: { width: 620 },
    content: previewHTML(parsed, images, jobs, issues, input.overwrite),
    render: onPreviewRender,
    yes: { label: importable === 1 ? game.i18n.localize("FVTK.Import.ConfirmOne") : game.i18n.format("FVTK.Import.Confirm", { count: importable }) },
    rejectClose: false
  });
  if (!confirmed) return;

  if (jobs.length) {
    const generated = await generateSceneImages(jobs, imageSettings(folder));
    images = [...images, ...generated.paths];
  }

  const report = await importEntries(parsed.entries, { overwrite: input.overwrite, images });
  const skipped = [...report.skipped, ...report.scenes.skipped];
  if (skipped.length) console.info(`${MODULE_ID} | Skipped:`, skipped);
  report.tracks = await autoPick();
  report.issues = issues;
  await showSummary(report, parsed.entries);
  return report;
}

/** What the import built, what it skipped and why, and a button to start its first story scene. */
async function showSummary(report, entries) {
  const { scenes, tracks } = report;
  const f = (key, data) => escape(game.i18n.format(`FVTK.Import.Summary.${key}`, data));
  // Entries kept because they were imported before are only counted; the rest are listed.
  const isKept = s => / \((scene )?already exists\)$/.test(s);
  const all = [...report.skipped, ...scenes.skipped];
  const kept = report.skipped.filter(isKept).length;
  const skipped = all.filter(s => !isKept(s));
  const sceneCount = scenes.created.length + scenes.updated.length;
  const lines = [
    f("Documents", { created: report.created.length, updated: report.updated.length, relinked: report.relinked.length }),
    sceneCount ? f("Scenes", { count: sceneCount }) : null,
    kept ? f("Kept", { count: kept }) : null,
    tracks?.filled.length ? f("Tracks", { summary: tracks.filled.map(t => `${t.name} ${t.count}/${t.of}`).join(", ") }) : null,
    report.issues.length ? f("Issues", { count: report.issues.length }) : null
  ].filter(Boolean);
  const skippedHTML = skipped.length ? `<details><summary>${f("Skipped", { count: skipped.length })}</summary><ul>${skipped.map(s => `<li>${escape(s)}</li>`).join("")}</ul></details>` : "";
  // Offer this build's first story scene; the world may hold other campaigns' scenes too.
  const isStory = s => s.flags[MODULE_ID]?.source === "notebooklm" && s.flags[MODULE_ID]?.type === "scene";
  const built = new Set(entries.filter(e => e.type === "scene").map(e => normalizeName(e.name)));
  const ours = game.scenes.filter(s => isStory(s) && built.has(normalizeName(sceneBaseName(s))));
  const first = (ours.length ? ours : game.scenes.filter(isStory)).sort((a, b) => a.sort - b.sort)[0];
  const buttons = [{ action: "close", label: game.i18n.localize("FVTK.Import.Summary.Close"), default: !first }];
  if (first) buttons.unshift({ action: "activate", label: game.i18n.format("FVTK.Import.Summary.Activate", { name: first.name }), icon: "fa-solid fa-play", default: true });
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("FVTK.Import.Summary.Title") },
    position: { width: 520 },
    content: `<div class="fvtk fvtk-summary"><ul>${lines.map(l => `<li>${l}</li>`).join("")}</ul>${skippedHTML}</div>`,
    buttons,
    rejectClose: false
  });
  if (choice === "activate") await first.activate();
}

/** Fill imported playlists that have no YouTube tracks yet, if the GM has a key and auto-pick is on. */
async function autoPick() {
  const playlists = playlistsToFill();
  if (!playlists.length || !game.settings.get(MODULE_ID, "youtubeAutoPick")) return null;
  if (!game.settings.get(MODULE_ID, "youtubeApiKey").trim()) {
    ui.notifications.info(game.i18n.format("FVTK.YouTube.AutoPickNoKey", { count: playlists.length }));
    return null;
  }
  const result = await autoPickTracks(playlists);
  const summary = result.filled.map(f => `${f.name} ${f.count}/${f.of}`).join(", ");
  // The import summary lists what was picked; only running out of quota needs saying now.
  if (result.quotaExceeded) ui.notifications.warn(game.i18n.format("FVTK.YouTube.AutoPickQuota", { summary }));
  return result;
}

/** The image generation settings, or null when generation is off. */
function imageSettings(folder) {
  const provider = game.settings.get(MODULE_ID, "imageProvider");
  if (!PROVIDERS.includes(provider)) return null;
  return {
    provider,
    folder,
    url: game.settings.get(MODULE_ID, "cloudflareWorkerUrl").trim(),
    token: game.settings.get(MODULE_ID, "cloudflareWorkerToken").trim(),
    autoApprove: game.settings.get(MODULE_ID, "imageAutoApprove")
  };
}

/**
 * Images to generate for an import: locations and scenes with no image in the folder, no existing
 * scene, and (for scenes) no location image to reuse. Empty when generation is off.
 */
export function imageJobs(entries, images) {
  if (!imageSettings("")) return [];
  const style = game.settings.get(MODULE_ID, "imageStyle").trim() || DEFAULT_STYLE;
  const srcFor = sceneImages(entries, images);
  const sceneExists = e => game.scenes.some(s => s.flags[MODULE_ID]?.source === "notebooklm" && normalizeName(sceneBaseName(s)) === normalizeName(e.replaces ?? e.name));
  const candidates = entries.filter(e => e.type in SCENE_TYPES);
  return imagesNeeded(candidates, e => srcFor.has(e) || sceneExists(e)).map(({ entry, location }) => ({ entry, prompt: imagePrompt(entry, { style, location }) }));
}

/** Image paths in a folder of the user data directory (a FilePicker "data" path); [] if none or unreadable. */
async function listImages(folder, { quiet = false } = {}) {
  if (!folder) return [];
  try {
    const { files } = await foundry.applications.apps.FilePicker.implementation.browse("data", folder);
    return files;
  } catch (err) {
    if (quiet) return [];
    ui.notifications.warn(game.i18n.format("FVTK.Import.ImageFolderError", { folder }));
    console.warn(`${MODULE_ID} | Could not browse ${folder}`, err);
    return [];
  }
}

export { parseBundle };
