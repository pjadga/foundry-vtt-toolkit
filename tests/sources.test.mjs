import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, relativePath, fingerprint, documentMeta, syncPlan, citations, MAX_SOURCE_BYTES } from "../module/scripts/assistant/sources.mjs";

test("classify takes searchable files only", () => {
  assert.deepEqual(classify("Rules/Core.PDF", 1000), { ok: true, mime: "application/pdf" });
  assert.equal(classify("notes/slang.md", 10).mime, "text/markdown");
  assert.equal(classify("podcast.mp3", 10).ok, false);
  assert.match(classify("big.pdf", MAX_SOURCE_BYTES + 1).reason, /larger/);
});

test("relativePath and fingerprint", () => {
  assert.equal(relativePath("worlds/x/sources/Official%20Rules/core.pdf", "worlds/x/sources/"), "Official Rules/core.pdf");
  assert.equal(relativePath("other/file.txt", "worlds/x/sources"), "other/file.txt");
  assert.equal(fingerprint(355327, "Wed, 21 Oct 2026 18:45:43 GMT"), "355327:1792608343000");
});

test("documentMeta reads customMetadata", () => {
  const doc = { name: "fileSearchStores/s/documents/d", displayName: "core.pdf", customMetadata: [{ key: "path", stringValue: "Rules/core.pdf" }, { key: "fingerprint", stringValue: "1:2" }] };
  assert.deepEqual(documentMeta(doc), { name: doc.name, path: "Rules/core.pdf", fingerprint: "1:2" });
});

test("syncPlan uploads, replaces, removes and keeps", () => {
  const local = [
    { path: "a.pdf", fingerprint: "1" },
    { path: "b.md", fingerprint: "2" },
    { path: "c.txt", fingerprint: "3" }
  ];
  const remote = [
    { name: "d/a", path: "a.pdf", fingerprint: "1" },
    { name: "d/b", path: "b.md", fingerprint: "old" },
    { name: "d/gone", path: "gone.pdf", fingerprint: "9" },
    { name: "d/a2", path: "a.pdf", fingerprint: "1" }
  ];
  const plan = syncPlan(local, remote);
  assert.deepEqual(plan.upload.map(f => f.path), ["c.txt"]);
  assert.deepEqual(plan.replace.map(r => [r.file.path, r.doc.name]), [["b.md", "d/b"]]);
  assert.deepEqual(plan.remove.map(d => d.name).sort(), ["d/a2", "d/gone"]);
  assert.deepEqual(plan.unchanged.map(f => f.path), ["a.pdf"]);
});

test("citations groups chunks by document", () => {
  const grounding = {
    groundingChunks: [
      { retrievedContext: { title: "core.pdf", text: "Netrunners  jack in.", customMetadata: [{ key: "path", stringValue: "Rules/core.pdf" }], pageNumber: 12 } },
      { retrievedContext: { title: "core.pdf", text: "More.", customMetadata: [{ key: "path", stringValue: "Rules/core.pdf" }], pageNumber: 3 } },
      { retrievedContext: { title: "slang.md", text: "Choomba: friend." } },
      { web: { uri: "https://example.com" } }
    ]
  };
  assert.deepEqual(citations(grounding), [
    { title: "core.pdf", path: "Rules/core.pdf", pages: [3, 12], snippet: "Netrunners jack in." },
    { title: "slang.md", path: "slang.md", pages: [], snippet: "Choomba: friend." }
  ]);
  assert.deepEqual(citations(undefined), []);
});
