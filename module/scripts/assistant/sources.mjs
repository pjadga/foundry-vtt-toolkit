/**
 * Source syncing rules for the GM Assistant: which files Gemini File Search takes, what to upload,
 * replace or remove, and how answers cite them. No Foundry globals, so it can be tested with
 * `node --test`.
 */

// File types File Search reads (audio, video and, with the default embedding model, images aren't).
export const SOURCE_TYPES = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  xml: "text/xml",
  yaml: "text/yaml",
  yml: "text/yaml",
  html: "text/html",
  htm: "text/html",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};
export const MAX_SOURCE_BYTES = 100 * 1024 * 1024;

/**
 * Whether a file can be a source, and its MIME type.
 * @returns {{ok: true, mime: string}|{ok: false, reason: string}}
 */
export function classify(path, size) {
  const ext = String(path).split(/[?#]/)[0].split(".").pop().toLowerCase();
  const mime = SOURCE_TYPES[ext];
  if (!mime) return { ok: false, reason: `.${ext} files can't be searched (use PDF, text or Markdown)` };
  if (size > MAX_SOURCE_BYTES) return { ok: false, reason: `larger than ${MAX_SOURCE_BYTES / 1024 / 1024} MB (split it)` };
  return { ok: true, mime };
}

/** "worlds/x/sources/Rules/core.pdf" relative to "worlds/x/sources" -> "Rules/core.pdf". */
export function relativePath(path, folder) {
  const clean = s => decodeURIComponent(String(s)).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const p = clean(path);
  const f = clean(folder);
  return f && p.startsWith(`${f}/`) ? p.slice(f.length + 1) : p;
}

/** Identifies a version of a file: its size and modification time, as the file server reports them. */
export function fingerprint(size, lastModified) {
  const time = Date.parse(lastModified);
  return `${size}:${Number.isFinite(time) ? time : lastModified ?? ""}`;
}

/** A store document's {path, fingerprint} from its customMetadata. */
export function documentMeta(doc) {
  const meta = Object.fromEntries((doc.customMetadata ?? []).map(m => [m.key, m.stringValue ?? m.numericValue]));
  return { name: doc.name, path: meta.path ?? doc.displayName ?? "", fingerprint: meta.fingerprint ?? "" };
}

/**
 * What a sync does: upload files the store doesn't have, replace those that changed, remove
 * documents whose file is gone (and duplicates of one path), keep the rest.
 * @param {{path: string, fingerprint: string}[]} local
 * @param {{name: string, path: string, fingerprint: string}[]} remote
 */
export function syncPlan(local, remote) {
  const plan = { upload: [], replace: [], remove: [], unchanged: [] };
  const byPath = new Map();
  for (const doc of remote) {
    if (byPath.has(doc.path)) plan.remove.push(doc);
    else byPath.set(doc.path, doc);
  }
  for (const file of local) {
    const doc = byPath.get(file.path);
    byPath.delete(file.path);
    if (!doc) plan.upload.push(file);
    else if (doc.fingerprint !== file.fingerprint) plan.replace.push({ file, doc });
    else plan.unchanged.push(file);
  }
  plan.remove.push(...byPath.values());
  return plan;
}

/**
 * The sources an answer drew on, from Gemini's groundingMetadata: one per document, with its pages
 * (when the file has them) and a short passage.
 * @returns {{title: string, path: string, pages: number[], snippet: string}[]}
 */
export function citations(grounding) {
  const out = new Map();
  for (const chunk of grounding?.groundingChunks ?? []) {
    const ctx = chunk.retrievedContext;
    if (!ctx) continue;
    const meta = Object.fromEntries((ctx.customMetadata ?? []).map(m => [m.key, m.stringValue ?? m.numericValue]));
    const path = meta.path ?? ctx.title ?? ctx.uri ?? "";
    const key = path || ctx.title;
    if (!key) continue;
    const entry = out.get(key) ?? { title: ctx.title ?? path, path, pages: [], snippet: "" };
    const page = Number(ctx.pageNumber ?? ctx.page_number ?? ctx.pageSpan?.firstPage);
    if (Number.isFinite(page) && !entry.pages.includes(page)) entry.pages.push(page);
    if (!entry.snippet && ctx.text) entry.snippet = String(ctx.text).replace(/\s+/g, " ").trim().slice(0, 280);
    out.set(key, entry);
  }
  return [...out.values()].map(e => ({ ...e, pages: e.pages.sort((a, b) => a - b) }));
}
