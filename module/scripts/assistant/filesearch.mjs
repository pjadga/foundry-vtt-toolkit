/**
 * Gemini File Search REST calls (no SDK), with the GM's key. A store keeps its documents until they
 * are deleted; each document carries the source's path and fingerprint in customMetadata, so the
 * store itself records what has been synced.
 */

const API = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD = "https://generativelanguage.googleapis.com/upload/v1beta";
// Indexing a large PDF can take a few minutes.
const INDEX_TIMEOUT_MS = 10 * 60_000;
const POLL_MS = 3_000;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function call(key, method, path, { body, query = "" } = {}) {
  const response = await fetch(`${API}/${path}${query}`, {
    method,
    headers: { "x-goog-api-key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message ?? `${response.status} ${response.statusText}`);
  return data;
}

/** The store with this display name, or a new one. */
export async function findOrCreateStore(key, displayName) {
  return (await findStore(key, displayName)) ?? call(key, "POST", "fileSearchStores", { body: { displayName } });
}

/** The store with this display name, or null. */
export async function findStore(key, displayName) {
  let pageToken = "";
  do {
    const data = await call(key, "GET", "fileSearchStores", { query: `?pageSize=20${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}` });
    const found = (data.fileSearchStores ?? []).find(s => s.displayName === displayName);
    if (found) return found;
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return null;
}

/** Every document in a store. */
export async function listDocuments(key, store) {
  const docs = [];
  let pageToken = "";
  do {
    const data = await call(key, "GET", `${store}/documents`, { query: `?pageSize=20${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}` });
    docs.push(...(data.documents ?? []));
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return docs;
}

/**
 * Upload a file into a store and wait until it is indexed.
 * @param {string} key
 * @param {string} store "fileSearchStores/..."
 * @param {{blob: Blob, mime: string, displayName: string, metadata: Record<string, string>}} file
 * @returns {Promise<string>} The new document's name.
 */
export async function uploadDocument(key, store, { blob, mime, displayName, metadata }) {
  const start = await fetch(`${UPLOAD}/${store}:uploadToFileSearchStore`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "Content-Type": "application/json",
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(blob.size),
      "X-Goog-Upload-Header-Content-Type": mime
    },
    body: JSON.stringify({ displayName, mimeType: mime, customMetadata: Object.entries(metadata).map(([k, v]) => ({ key: k, stringValue: String(v) })) })
  });
  const url = start.headers.get("x-goog-upload-url");
  if (!start.ok || !url) {
    const data = await start.json().catch(() => ({}));
    throw new Error(data.error?.message ?? `upload refused (${start.status})`);
  }
  const sent = await fetch(url, { method: "POST", headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" }, body: blob });
  const op = await sent.json().catch(() => ({}));
  if (!sent.ok) throw new Error(op.error?.message ?? `upload failed (${sent.status})`);
  if (op.error) throw new Error(op.error.message ?? "indexing failed");
  const name = op.response?.documentName;
  if (!name) throw new Error("Gemini didn't say which document it made");
  // The reply names the document straight away but doesn't say when indexing is done (polling its
  // ".../upload/operations/..." name never reports it), so watch the document's own state.
  const until = Date.now() + INDEX_TIMEOUT_MS;
  for (;;) {
    const doc = await call(key, "GET", name);
    if (doc.state === "STATE_ACTIVE") return name;
    if (doc.state === "STATE_FAILED") throw new Error("Gemini couldn't index this file");
    if (Date.now() > until) throw new Error("still indexing after 10 minutes; sync again later");
    await wait(POLL_MS);
  }
}

/** Delete one document (and its chunks). */
export function deleteDocument(key, name) {
  return call(key, "DELETE", name, { query: "?force=true" });
}

/** Delete a store and everything in it. */
export function deleteStore(key, store) {
  return call(key, "DELETE", store, { query: "?force=true" });
}
