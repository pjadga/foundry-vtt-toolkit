/**
 * Import X / Export X buttons on the sidebar tabs: Foundry JSON files in and out. The pure parts
 * (reading files, folders, ids, the bundle) are in json-docs.mjs.
 */
import { addTabAction } from "../toolkit-menu.mjs";
import { TABS, readImport, parentsFirst, prepareDocument, exportBundle, exportFileName } from "./json-docs.mjs";

const MODULE_ID = "foundry-vtt-toolkit";
const t = (key, data) => (data ? game.i18n.format(`FVTK.Files.${key}`, data) : game.i18n.localize(`FVTK.Files.${key}`));
const escape = s => foundry.utils.escapeHTML(String(s ?? ""));

/** Ask for one or more .json files. Resolves to [] when the GM cancels. */
function pickFiles() {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.multiple = true;
    input.addEventListener("change", () => resolve([...input.files]));
    input.addEventListener("cancel", () => resolve([]));
    input.click();
  });
}

/** Parse the picked files; files that aren't JSON are reported, not thrown. */
async function readFiles(files, documentName) {
  const all = { documentName, documents: [], folders: [], problems: [] };
  for (const file of files) {
    let json;
    try {
      json = JSON.parse(await file.text());
    } catch {
      all.problems.push(t("NotJson", { file: file.name }));
      continue;
    }
    const part = readImport(json, documentName);
    all.documentName ??= part.documentName;
    if (documentName == null && part.documentName && all.documentName !== part.documentName) {
      all.problems.push(t("MixedKinds", { file: file.name }));
      continue;
    }
    all.documents.push(...part.documents);
    all.folders.push(...part.folders);
    for (const p of part.problems) all.problems.push(`${file.name}: ${p}`);
  }
  return all;
}

/**
 * Create documents from JSON files, in the world or in a compendium.
 * @param {string|null} documentName The tab's kind; null on the Compendium tab (taken from the files).
 * @param {{pack?: CompendiumCollection, files?: File[]}} [options] files: skip the file picker (for macros).
 */
export async function importFiles(documentName, { pack = null, files: given = null } = {}) {
  const files = given ?? (await pickFiles());
  if (!files.length) return null;
  const read = await readFiles(files, documentName ?? pack?.documentName ?? null);
  const kind = read.documentName;
  for (const p of read.problems) ui.notifications.warn(p);
  if (!read.documents.length) {
    ui.notifications.warn(t("NothingToImport"));
    return null;
  }
  const cls = CONFIG[kind].documentClass;
  const collection = pack ?? game.collections.get(kind);
  const taken = id => (pack ? pack.index.has(id) : collection.has(id));

  // Folders first, parents before children; each gets a new id.
  const folderIds = new Map();
  for (const folder of parentsFirst(read.folders)) {
    const data = { name: folder.name, type: kind, color: folder.color ?? null, sorting: folder.sorting ?? "a", sort: folder.sort ?? 0, folder: folderIds.get(folder.folder) ?? null };
    const [created] = await Folder.createDocuments([data], pack ? { pack: pack.collection } : {});
    if (created) folderIds.set(folder._id, created.id);
  }

  // Ids are kept where free, so links between documents (a combat's scene, a scene's actors) survive.
  const keep = [];
  const fresh = [];
  for (const data of read.documents) {
    const prepared = prepareDocument(data, { folderIds, taken });
    (prepared.keepId ? keep : fresh).push(prepared.data);
  }
  const options = pack ? { pack: pack.collection } : {};
  const created = [
    ...(keep.length ? await cls.createDocuments(keep, { ...options, keepId: true }) : []),
    ...(fresh.length ? await cls.createDocuments(fresh, options) : [])
  ];
  const label = game.i18n.localize(cls.metadata.labelPlural);
  ui.notifications.info(t("Imported", { count: created.length, label, where: pack?.title ?? game.world.title }));
  return created;
}

/**
 * Save every document of a kind (and its folders) as one JSON file, from the world or a compendium.
 * @param {string} documentName
 * @param {{pack?: CompendiumCollection}} [options]
 */
export async function exportFiles(documentName, { pack = null } = {}) {
  const documents = pack ? await pack.getDocuments() : game.collections.get(documentName).contents;
  if (!documents.length) {
    ui.notifications.warn(t("NothingToExport"));
    return null;
  }
  const folders = (pack ? pack.folders.contents : game.folders.filter(f => f.type === documentName)).map(f => f.toObject());
  const bundle = exportBundle(documentName, documents.map(d => d.toObject()), folders, { world: game.world.id, system: `${game.system.id} ${game.system.version}`, core: game.version });
  const label = pack ? pack.metadata.label : game.i18n.localize(CONFIG[documentName].documentClass.metadata.labelPlural);
  const name = exportFileName(label, game.world.id);
  foundry.utils.saveDataToFile(JSON.stringify(bundle, null, 2), "application/json", name);
  ui.notifications.info(t("Exported", { count: documents.length, file: name }));
  return name;
}

/** Choose a compendium for the Compendium tab's Import or Export. */
async function choosePack(action) {
  const packs = game.packs.filter(p => action === "export" || !p.locked).filter(p => p.documentName !== "Adventure" || action === "export");
  if (!packs.length) {
    ui.notifications.warn(t("NoPacks"));
    return null;
  }
  const options = packs
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(p => `<option value="${escape(p.collection)}">${escape(p.title)} (${escape(game.i18n.localize(CONFIG[p.documentName].documentClass.metadata.labelPlural))})</option>`)
    .join("");
  const id = await foundry.applications.api.DialogV2.prompt({
    window: { title: t(action === "export" ? "ExportPackTitle" : "ImportPackTitle") },
    content: `<div class="fvtk"><p>${escape(t(action === "export" ? "ExportPackHint" : "ImportPackHint"))}</p><select name="pack">${options}</select></div>`,
    ok: { label: t(action === "export" ? "Export" : "Import"), callback: (event, button) => button.form.elements.pack.value },
    rejectClose: false
  });
  return id ? game.packs.get(id) : null;
}

/** Put Import X / Export X in every tab's Toolkit menu, and the Compendium tab's pack versions. */
export function setupFileButtons() {
  for (const [documentName, { hook, key }] of Object.entries(TABS)) {
    addTabAction(hook, { label: `FVTK.Files.Import${key}`, icon: "fa-solid fa-file-import", onClick: () => importFiles(documentName) });
    addTabAction(hook, { label: `FVTK.Files.Export${key}`, icon: "fa-solid fa-file-export", onClick: () => exportFiles(documentName) });
  }
  addTabAction("renderCompendiumDirectory", { label: "FVTK.Files.ImportCompendium", icon: "fa-solid fa-file-import", onClick: async () => {
    const pack = await choosePack("import");
    if (pack) await importFiles(pack.documentName, { pack });
  } });
  addTabAction("renderCompendiumDirectory", { label: "FVTK.Files.ExportCompendium", icon: "fa-solid fa-file-export", onClick: async () => {
    const pack = await choosePack("export");
    if (pack) await exportFiles(pack.documentName, { pack });
  } });
}
