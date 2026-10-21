import { parseBundle, resolveLinks, toMarkdown, normalizeName } from "./parser.mjs";

const MODULE_ID = "foundry-vtt-toolkit";
const ROOT_FOLDER = "NotebookLM";

// Entry types that become journal entries, and the subfolder each goes into.
const JOURNAL_TYPES = {
  journal: "Campaign",
  location: "Locations",
  thread: "Story Threads"
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
 * name -> uuid across journals, actors and items, matched loosely (see normalizeName). NotebookLM imports
 * win over other documents with the same name.
 */
function worldLookup() {
  const index = new Map();
  const docs = [...game.actors, ...game.items, ...game.journal];
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
 * imports are then re-linked to anything new (see relink).
 * @param {object[]} entries From parseBundle.
 * @param {{overwrite?: boolean}} options
 * @returns {Promise<{created: string[], updated: string[], skipped: string[], relinked: string[]}>}
 */
export async function importEntries(entries, { overwrite = false } = {}) {
  const report = { created: [], updated: [], skipped: [], relinked: [] };
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
  const plan = supported.map(e => {
    const documentName = documentNameFor(e.type);
    const existing = game.collections.get(documentName).find(d => d.name === e.name && d.folder?.id === folders[e.type].id) ?? null;
    return { entry: e, documentName, existing, id: existing?.id ?? foundry.utils.randomID() };
  });
  const orderOf = type => HANDLERS[type]?.order ?? 0;
  plan.sort((a, b) => orderOf(a.entry.type) - orderOf(b.entry.type));
  const byName = new Map(plan.map(p => [normalizeName(p.entry.name), `${p.documentName}.${p.id}`]));
  const inWorld = worldLookup();
  const lookup = name => byName.get(normalizeName(name)) ?? inWorld(name);

  const toCreate = [];
  const newPages = new Map();
  for (const { entry, documentName, existing, id } of plan) {
    if (existing && !overwrite) {
      report.skipped.push(`${entry.name} (already exists)`);
      continue;
    }
    const outcome = existing ? report.updated : report.created;
    const baseFlags = { source: "notebooklm", type: entry.type, tags: entry.tags };

    if (documentName === "JournalEntry") {
      const raw = toMarkdown(entry);
      const markdown = resolveLinks(raw, lookup);
      const page = pageData(entry.name, markdown);
      // raw keeps the [[links]] for relinking; generated lets relink tell whether the GM edited the page.
      const flags = { [MODULE_ID]: { ...baseFlags, raw, generated: markdown } };
      if (existing) {
        await existing.update({ flags });
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

  const touched = new Set([...report.created, ...report.updated]);
  report.relinked = (await relink()).filter(name => !touched.has(name));
  return report;
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

function previewHTML({ entries, warnings }) {
  const rows = entries.map(e => {
    const status = destinationFor(e.type) ?? "skipped (not supported yet)";
    return `<li><strong>${escape(e.name)}</strong> <em>${escape(e.type)}</em> → ${escape(status)}${e.links.length ? `<br><small>links: ${e.links.map(escape).join(", ")}</small>` : ""}</li>`;
  });
  const warn = warnings.length ? `<p><strong>Warnings</strong></p><ul>${warnings.map(w => `<li>${escape(w)}</li>`).join("")}</ul>` : "";
  return `<div class="fvtk fvtk-import-preview"><p>${entries.length} entr${entries.length === 1 ? "y" : "ies"} found.</p><ul>${rows.join("")}</ul>${warn}</div>`;
}

/** Paste dialog → preview → import. GM only. */
export async function openImporter() {
  if (!game.user.isGM) return ui.notifications.warn(game.i18n.localize("FVTK.Import.GMOnly"));
  const { DialogV2 } = foundry.applications.api;

  const input = await DialogV2.prompt({
    window: { title: game.i18n.localize("FVTK.Import.Title") },
    position: { width: 640 },
    content: `<div class="fvtk">
      <p>${game.i18n.localize("FVTK.Import.Instructions")}</p>
      <textarea name="text" rows="18" placeholder="##ENTRY&#10;type: journal&#10;name: ..."></textarea>
      <label>${game.i18n.localize("FVTK.Import.File")} <input type="file" name="file" accept=".md,.txt,text/markdown,text/plain"></label>
      <label><input type="checkbox" name="overwrite"> ${game.i18n.localize("FVTK.Import.Overwrite")}</label>
    </div>`,
    ok: {
      label: game.i18n.localize("FVTK.Import.Preview"),
      callback: (event, button) => {
        const { text, file, overwrite } = button.form.elements;
        return { text: text.value, file: file.files[0] ?? null, overwrite: overwrite.checked };
      }
    },
    rejectClose: false
  });
  if (!input) return;
  // A chosen file wins over pasted text.
  const text = input.file ? await input.file.text() : input.text;
  if (!text.trim()) return;

  const parsed = parseBundle(text);
  const importable = parsed.entries.filter(e => isSupported(e.type)).length;
  if (!importable) {
    return DialogV2.prompt({ window: { title: game.i18n.localize("FVTK.Import.Title") }, content: previewHTML(parsed), rejectClose: false });
  }

  const confirmed = await DialogV2.confirm({
    window: { title: game.i18n.localize("FVTK.Import.Title") },
    position: { width: 560 },
    content: previewHTML(parsed),
    yes: { label: game.i18n.format("FVTK.Import.Confirm", { count: importable }) },
    rejectClose: false
  });
  if (!confirmed) return;

  const report = await importEntries(parsed.entries, { overwrite: input.overwrite });
  ui.notifications.info(game.i18n.format("FVTK.Import.Done", { created: report.created.length, updated: report.updated.length, skipped: report.skipped.length, relinked: report.relinked.length }));
  if (report.skipped.length) console.info(`${MODULE_ID} | Skipped:`, report.skipped);
  return report;
}

export { parseBundle };
