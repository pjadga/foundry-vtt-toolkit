import test from "node:test";
import assert from "node:assert/strict";
import { existingCampaign, archiveName, CAMPAIGN_PACKS, IN_PLACE_EMBEDDED } from "../module/scripts/import/campaign.mjs";

test("existingCampaign asks only when the world or the compendiums hold an earlier import", () => {
  const none = existingCampaign({ journal: [], scenes: [], actors: [], items: [], playlists: [], folders: [{}] }, 0);
  assert.equal(none.ask, false);
  assert.equal(none.total, 0);
  const some = existingCampaign({ journal: [1, 2], scenes: [1], actors: [], items: [1], playlists: [], folders: [] }, 0);
  assert.deepEqual([some.ask, some.total, some.counts.journal, some.counts.scenes], [true, 4, 2, 1]);
  // Cleaned out of the world but still in the compendiums.
  assert.equal(existingCampaign({}, 12).ask, true);
});

test("archiveName uses the overview's title, else the world's, with the date", () => {
  const date = new Date("2026-11-03T12:00:00Z");
  assert.equal(archiveName(["Section 9 Overview", "Kabuki"], "My World", date), "Section 9 (2026-11-03)");
  assert.equal(archiveName(["Campaign Overview"], "Cyberpunk RED Test", date), "Cyberpunk RED Test (2026-11-03)");
  assert.equal(archiveName(["Kabuki"], "Cyberpunk RED Test", date), "Cyberpunk RED Test (2026-11-03)");
});

test("one compendium per document type, and the world keeps tokens and picked tracks", () => {
  assert.deepEqual(Object.keys(CAMPAIGN_PACKS).sort(), ["Actor", "Cards", "Item", "JournalEntry", "Playlist", "RollTable", "Scene"]);
  assert.ok(Object.values(CAMPAIGN_PACKS).every(p => /^notebooklm-[a-z]+$/.test(p.name) && p.label.startsWith("FVTK.Packs.")));
  assert.ok(IN_PLACE_EMBEDDED.Scene.includes("tokens") && IN_PLACE_EMBEDDED.Scene.includes("notes"));
  assert.deepEqual(IN_PLACE_EMBEDDED.Playlist, ["sounds"]);
});
