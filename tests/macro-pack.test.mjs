import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PACK, FOLDERS, stableId, macroHeader, macroDocuments, packHash } from "../scripts/macro-pack.mjs";

const macrosDir = new URL("../macros/", import.meta.url);
const files = () => fs.readdirSync(macrosDir, { recursive: true }).filter(file => file.endsWith(".js"))
  .map(file => ({ path: file.split(path.sep).join("/"), text: fs.readFileSync(new URL(file.split(path.sep).join("/"), macrosDir), "utf8") }));

test("the Custom-Macros pack is current with macros/", () => {
  const recorded = fs.readFileSync(new URL("../scripts/packs.sha256", import.meta.url), "utf8").split(/\s+/)[0];
  assert.equal(packHash(macroDocuments(files())), recorded, "run npm run build:packs and commit module/packs");
});

test("module.json declares the pack", () => {
  const pack = JSON.parse(fs.readFileSync(new URL("../module/module.json", import.meta.url), "utf8")).packs?.find(p => p.name === PACK);
  assert.deepEqual([pack?.label, pack?.type, pack?.path], ["Custom-Macros", "Macro", `packs/${PACK}`]);
});

test("every macro in macros/ is in the pack, by its header name, in its folder", () => {
  const all = files();
  const { folders, macros } = macroDocuments(all);
  assert.equal(macros.length, all.length);
  for (const file of all) {
    const macro = macros.find(m => m._id === stableId(`macro:${file.path}`));
    assert.equal(macro.name, macroHeader(file.text).Name);
    assert.equal(macro.command, file.text.replace(/\r\n/g, "\n").trim());
    assert.equal(folders.find(f => f._id === macro.folder)?.name, FOLDERS[file.path.split("/")[0]]);
  }
});

test("macroDocuments: stable ids, keys and refusals", () => {
  const text = "/**\n * Name:    Test\n * System:  any\n * Type:    script\n */\nreturn 1;\n";
  const first = macroDocuments([{ path: "core/a.js", text }]);
  assert.deepEqual(macroDocuments([{ path: "core/a.js", text }]), first);
  assert.equal(first.folders.length, 1);
  assert.equal(first.macros[0]._key, `!macros!${first.macros[0]._id}`);
  assert.match(first.macros[0]._id, /^[A-Za-z0-9]{16}$/);
  assert.equal(first.macros[0].command, text.trim());
  assert.throws(() => macroDocuments([{ path: "core/a.js", text }, { path: "core/b.js", text }]), /already named Test/);
  assert.throws(() => macroDocuments([{ path: "other/a.js", text }]), /no compendium folder/);
  assert.throws(() => macroDocuments([{ path: "core/a.js", text: "return 1;" }]), /no Name/);
});
