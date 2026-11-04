import test from "node:test";
import assert from "node:assert/strict";
import { groupSettings, SETTING_GROUPS, SECRET_SETTINGS, SERVICE_MENUS, inServiceMenu } from "../module/scripts/settings-layout.mjs";

test("groupSettings sorts settings into groups and puts unknown ones under Other", () => {
  const groups = groupSettings(["debug", "imageStyle", "imageProvider", "combatNarration", "somethingNew"]);
  assert.deepEqual(groups, [
    { label: "FVTK.SettingsGroup.Images", keys: ["imageProvider", "imageStyle"] },
    { label: "FVTK.SettingsGroup.Combat", keys: ["combatNarration"] },
    { label: "FVTK.SettingsGroup.Other", keys: ["debug", "somethingNew"] }
  ]);
  assert.deepEqual(groupSettings([]), []);
});

test("each service dialog holds its key, and no setting is in two places", () => {
  assert.deepEqual(Object.keys(SERVICE_MENUS), ["gemini", "youtube", "openai"]);
  assert.ok(SECRET_SETTINGS.every(inServiceMenu));
  assert.ok(SERVICE_MENUS.gemini.keys.includes("geminiApiKey") && SERVICE_MENUS.youtube.keys.includes("youtubeApiKey") && SERVICE_MENUS.openai.keys.includes("openaiApiKey"));
  const all = [...SETTING_GROUPS.flatMap(g => g.keys), ...Object.values(SERVICE_MENUS).flatMap(m => m.keys)];
  assert.equal(new Set(all).size, all.length);
  assert.ok(!all.some(k => /cloudflare/i.test(k)));
});
