import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSink, safeName, ORIGIN } from "../scripts/answer-sink.mjs";

test("safeName allows plain file names only", () => {
  assert.equal(safeName("/01-concept.txt"), "01-concept.txt");
  assert.equal(safeName("/a_b.c-d?x=1"), "a_b.c-d");
  for (const bad of ["/", "/../x.txt", "/a/b.txt", "/%2e%2e%2fx", "/.hidden", "/x\\y"]) assert.equal(safeName(bad), null, bad);
});

test("the sink saves a POST from NotebookLM and refuses the rest", async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "sink-"));
  const server = createSink(folder);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const ok = await fetch(`${base}/a.txt`, { method: "POST", body: "hello", headers: { Origin: ORIGIN } });
    assert.equal(ok.status, 200);
    assert.equal(fs.readFileSync(path.join(folder, "a.txt"), "utf8"), "hello");
    assert.equal(ok.headers.get("access-control-allow-origin"), ORIGIN);
    assert.equal((await fetch(`${base}/a.txt`, { method: "POST", body: "x", headers: { Origin: "https://evil.example" } })).status, 403);
    assert.equal((await fetch(`${base}/%2e%2e%2fb.txt`, { method: "POST", body: "x" })).status, 400);
    assert.equal((await fetch(`${base}/a.txt`)).status, 405);
    const preflight = await fetch(`${base}/a.txt`, { method: "OPTIONS", headers: { Origin: ORIGIN } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-private-network"), "true");
    assert.equal((await fetch(`${base}/big.txt`, { method: "POST", body: "x".repeat(2_000_001) }).catch(() => ({ status: 413 }))).status, 413);
  } finally {
    server.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
