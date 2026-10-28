// The Custom-Macros compendium's documents, built from the files in macros/. Pure (Node's crypto only,
// no Foundry globals), so tests can check the pack is current; scripts/build-packs.mjs writes it.
import { createHash } from "node:crypto";

export const PACK = "custom-macros";

// Each macros/ subfolder becomes a compendium folder, in this order.
export const FOLDERS = {
  core: "Core",
  characters: "Characters",
  dnd5e: "D&D 5e",
  sw25: "Sword World 2.5",
  cpred: "Cyberpunk RED"
};

const ICON = "icons/svg/dice-target.svg";
// The Foundry version the documents are written for. Without _stats, Foundry migrates every macro
// when a world launches and rewrites the pack on the server.
export const CORE_VERSION = "13.351";
const STATS = { coreVersion: CORE_VERSION, systemId: null, systemVersion: null, createdTime: null, modifiedTime: null,
  lastModifiedBy: null, compendiumSource: null, duplicateSource: null, exportSource: null };

/** A stable 16-character Foundry id from a name, so a rebuild keeps every document's id. */
export function stableId(name) {
  const hash = createHash("sha256").update(name).digest();
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(hash.subarray(0, 16), byte => chars[byte % chars.length]).join("");
}

/** The header's fields ("Name", "System", "Type"…), from the macro's opening comment. */
export function macroHeader(text) {
  const header = text.match(/^\/\*\*([\s\S]*?)\*\//)?.[1] ?? "";
  return Object.fromEntries([...header.matchAll(/^\s*\*\s*([A-Za-z]+):\s*(.+?)\s*$/gm)].map(match => [match[1], match[2]]));
}

/**
 * The pack's folders and macros from `files`, each { path: "core/token-info.js", text }. Throws on a
 * file without a Name, in an unknown folder, or with a name already used.
 */
export function macroDocuments(files) {
  const folderIds = {};
  const folders = Object.entries(FOLDERS).map(([dir, name], index) => {
    folderIds[dir] = stableId(`folder:${dir}`);
    return { _id: folderIds[dir], _key: `!folders!${folderIds[dir]}`, name, type: "Macro", folder: null, sorting: "a",
      sort: (index + 1) * 100000, color: null, description: "", flags: {} };
  });
  const names = new Set();
  const macros = [...files].sort((a, b) => a.path.localeCompare(b.path)).map(({ path, text }) => {
    const dir = path.split("/")[0];
    if (!folderIds[dir]) throw new Error(`${path}: macros/${dir} has no compendium folder; add it to FOLDERS`);
    const { Name: name, Type: type = "script" } = macroHeader(text);
    if (!name) throw new Error(`${path}: the header has no Name`);
    if (names.has(name)) throw new Error(`${path}: another macro is already named ${name}`);
    names.add(name);
    const _id = stableId(`macro:${path}`);
    // Foundry trims a macro's command, so the pack holds it trimmed too.
    return { _id, _key: `!macros!${_id}`, name, type, img: ICON, scope: "global",
      command: text.replace(/\r\n/g, "\n").trim(), folder: folderIds[dir], sort: 0, ownership: { default: 0 }, flags: {}, _stats: { ...STATS } };
  });
  return { folders: folders.filter(folder => macros.some(macro => macro.folder === folder._id)), macros };
}

/** A fingerprint of the documents, recorded by the build so a test can tell the pack is stale. */
export function packHash({ folders, macros }) {
  return createHash("sha256").update(JSON.stringify([...folders, ...macros])).digest("hex");
}
