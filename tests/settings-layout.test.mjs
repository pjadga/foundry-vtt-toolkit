import test from "node:test";
import assert from "node:assert/strict";
import { groupSettings, SETTING_GROUPS, SECRET_SETTINGS } from "../module/scripts/settings-layout.mjs";

test("groupSettings sorts settings into groups and puts unknown ones under Other", () => {
  const groups = groupSettings(["debug", "imageStyle", "geminiApiKey", "imageProvider", "combatNarration", "somethingNew"]);
  assert.deepEqual(groups, [
    { label: "FVTK.SettingsGroup.Keys", keys: ["geminiApiKey"] },
    { label: "FVTK.SettingsGroup.Images", keys: ["imageProvider", "imageStyle"] },
    { label: "FVTK.SettingsGroup.Combat", keys: ["combatNarration"] },
    { label: "FVTK.SettingsGroup.Other", keys: ["debug", "somethingNew"] }
  ]);
  assert.deepEqual(groupSettings([]), []);
});

test("every secret is in the keys group, and no setting is in two groups", () => {
  const keys = SETTING_GROUPS[0].keys;
  assert.ok(SECRET_SETTINGS.every(k => keys.includes(k)));
  const all = SETTING_GROUPS.flatMap(g => g.keys);
  assert.equal(new Set(all).size, all.length);
});
