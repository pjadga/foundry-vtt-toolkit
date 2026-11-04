import test from "node:test";
import assert from "node:assert/strict";
import { looksLike, guessKind, readImport, parentsFirst, prepareDocument, exportBundle, exportFileName, TABS } from "../module/scripts/import/json-docs.mjs";

const actor = { _id: "a1", name: "Rook", type: "character", system: {}, items: [], effects: [], prototypeToken: {}, folder: "f1", ownership: { default: 0, u1: 3 }, _stats: { coreVersion: "13" } };
const item = { _id: "i1", name: "Heavy Pistol", type: "weapon", system: {}, effects: [] };
const scene = { _id: "s1", name: "Annex", grid: {}, tokens: [], walls: [], background: {} };
const journal = { _id: "j1", name: "Overview", pages: [] };
const table = { _id: "t1", name: "Street Rumours", formula: "1d6", results: [] };
const cards = { _id: "c1", name: "Fate Deck", type: "deck", cards: [] };
const combat = { _id: "k1", name: "", scene: "s1", combatants: [] };
const playlist = { _id: "p1", name: "Tension", sounds: [] };

test("looksLike tells the kinds apart", () => {
  assert.ok(looksLike("Actor", actor));
  assert.ok(!looksLike("Item", actor));
  assert.ok(looksLike("Item", item));
  assert.ok(!looksLike("Actor", item));
  for (const [kind, data] of [["Scene", scene], ["JournalEntry", journal], ["RollTable", table], ["Cards", cards], ["Combat", combat], ["Playlist", playlist]]) {
    assert.ok(looksLike(kind, data), kind);
    assert.ok(!looksLike("Actor", data), `${kind} is not an Actor`);
  }
  assert.ok(!looksLike("Actor", null));
  assert.ok(!looksLike("Actor", [actor]));
});

test("guessKind names the kind for the Compendium tab", () => {
  assert.deepEqual([actor, item, scene, journal, table, cards, combat, playlist].map(guessKind), ["Actor", "Item", "Scene", "JournalEntry", "RollTable", "Cards", "Combat", "Playlist"]);
  assert.equal(guessKind({ name: "?" }), null);
});

test("readImport takes Foundry's single-document export, arrays and the toolkit's bundle", () => {
  assert.deepEqual(readImport(actor, "Actor").documents, [actor]);
  const mixed = readImport([actor, item], "Actor");
  assert.deepEqual(mixed.documents, [actor]);
  assert.deepEqual(mixed.problems, ['"Heavy Pistol" isn\'t an Actor']);
  const bundle = exportBundle("Actor", [actor], [{ _id: "f1", name: "Crew", folder: null }], { world: "w" });
  const read = readImport(bundle, "Actor");
  assert.equal(read.documents.length, 1);
  assert.equal(read.folders[0].name, "Crew");
  assert.match(readImport(bundle, "Item").problems[0], /holds Actor documents, not Item/);
  assert.equal(readImport(bundle, null).documentName, "Actor");
  assert.equal(readImport([table], null).documentName, "RollTable");
  assert.match(readImport(42, "Actor").problems[0], /isn't a Foundry document/);
});

test("parentsFirst orders folders and drops missing parents", () => {
  const out = parentsFirst([{ _id: "c", folder: "b" }, { _id: "b", folder: "a" }, { _id: "a", folder: null }, { _id: "x", folder: "gone" }]);
  assert.deepEqual(out.map(f => f._id), ["a", "b", "c", "x"]);
  assert.equal(out.find(f => f._id === "x").folder, null);
  const loop = parentsFirst([{ _id: "p", folder: "q" }, { _id: "q", folder: "p" }]);
  assert.equal(loop.length, 2);
  assert.equal(loop[0].folder, null);
});

test("prepareDocument drops old-world stats and permissions, maps folders and keeps free ids", () => {
  const { data, keepId } = prepareDocument(actor, { folderIds: new Map([["f1", "NEW"]]) });
  assert.equal(keepId, true);
  assert.equal(data._id, "a1");
  assert.equal(data.folder, "NEW");
  assert.ok(!("ownership" in data) && !("_stats" in data));
  const taken = prepareDocument(actor, { taken: id => id === "a1" });
  assert.equal(taken.keepId, false);
  assert.ok(!("_id" in taken.data));
  assert.equal(taken.data.folder, null);
  assert.equal(actor.folder, "f1", "the original is not changed");
});

test("exportFileName and the tabs list", () => {
  assert.equal(exportFileName("Rollable Tables", "cyberpunk-red-test", new Date("2026-11-04T12:00:00Z")), "fvtk-rollable-tables-cyberpunk-red-test-2026-11-04.json");
  assert.deepEqual(Object.keys(TABS), ["Actor", "Item", "Scene", "Playlist", "Cards", "RollTable", "JournalEntry", "Combat"]);
});
