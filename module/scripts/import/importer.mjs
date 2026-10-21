import { parseBundle, resolveLinks, toMarkdown, normalizeName } from "./parser.mjs";

const MODULE_ID = "foundry-vtt-toolkit";
const ROOT_FOLDER = "NotebookLM";

// Entry types that become journal entries, and the subfolder each goes into.
const JOURNAL_TYPES = {
  journal: "Campaign",
  location: "Locations",
  thread: "Story Threads"
};

/** name -> uuid for every journal in the world, matched loosely (see normalizeName). */
function worldJournalLookup() {
  const index = new Map(game.journal.map(j => [normalizeName(j.name), j.uuid]));
  return name => index.get(normalizeName(name)) ?? null;
}

/** Find or create a JournalEntry folder, optionally under a parent. */
async function ensureFolder(name, parent = null) {
  const existing = game.folders.find(f => f.type === "JournalEntry" && f.name === name && (f.folder?.id ?? null) === (parent?.id ?? null));
  return existing ?? Folder.create({ name, type: "JournalEntry", folder: parent?.id ?? null });
}

/**
 * Import parsed entries as journal entries. Entries of other types are reported as skipped.
 * Links between entries in the bundle, and to existing journals with the same name, are resolved,
 * then earlier imports are re-linked to anything new (see relink).
 * @param {object[]} entries From parseBundle.
 * @param {{overwrite?: boolean}} options
 * @returns {Promise<{created: string[], updated: string[], skipped: string[], relinked: string[]}>}
 */
export async function importEntries(entries, { overwrite = false } = {}) {
  const report = { created: [], updated: [], skipped: [], relinked: [] };
  const journalEntries = entries.filter(e => e.type in JOURNAL_TYPES);
  for (const e of entries) if (!(e.type in JOURNAL_TYPES)) report.skipped.push(`${e.name} (${e.type || "no type"}: not supported yet)`);
  if (!journalEntries.length) return report;

  const root = await ensureFolder(ROOT_FOLDER);
  const folders = {};
  for (const type of new Set(journalEntries.map(e => e.type))) folders[type] = await ensureFolder(JOURNAL_TYPES[type], root);

  // Decide every entry's id up front so links can point at journals that don't exist yet.
  const plan = journalEntries.map(e => {
    const existing = game.journal.find(j => j.name === e.name && j.folder?.id === folders[e.type].id);
    return { entry: e, existing, id: existing?.id ?? foundry.utils.randomID() };
  });
  const byName = new Map(plan.map(p => [normalizeName(p.entry.name), `JournalEntry.${p.id}`]));
  const inWorld = worldJournalLookup();
  const lookup = name => byName.get(normalizeName(name)) ?? inWorld(name);

  const toCreate = [];
  const newPages = new Map();
  for (const { entry, existing, id } of plan) {
    const raw = toMarkdown(entry);
    const markdown = resolveLinks(raw, lookup);
    const page = pageData(entry.name, markdown);
    // raw keeps the [[links]] for relinking; generated lets relink tell whether the GM edited the page.
    const flags = { [MODULE_ID]: { source: "notebooklm", type: entry.type, tags: entry.tags, raw, generated: markdown } };

    if (!existing) {
      toCreate.push({ _id: id, name: entry.name, folder: folders[entry.type].id, flags });
      newPages.set(id, page);
      report.created.push(entry.name);
    } else if (overwrite) {
      await existing.update({ flags });
      await replacePage(existing, page);
      report.updated.push(entry.name);
    } else {
      report.skipped.push(`${entry.name} (already exists)`);
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
 * Re-resolve links in every NotebookLM journal, so a journal imported before its link targets
 * existed picks them up (and links to deleted journals fall back to bold text). Pages the GM has
 * edited since import are left alone.
 * @returns {Promise<string[]>} Names of journals whose page was rewritten.
 */
export async function relink() {
  const changed = [];
  const lookup = worldJournalLookup();
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
  return changed;
}

const escape = s => foundry.utils.escapeHTML(String(s));

function previewHTML({ entries, warnings }) {
  const rows = entries.map(e => {
    const status = e.type in JOURNAL_TYPES ? JOURNAL_TYPES[e.type] : "skipped (not supported yet)";
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
  const importable = parsed.entries.filter(e => e.type in JOURNAL_TYPES).length;
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
