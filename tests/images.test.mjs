import test from "node:test";
import assert from "node:assert/strict";
import { plainText, imagePrompt, imageFileName, imagesNeeded, DEFAULT_STYLE, pasteTarget, fitWithin, chatImageRequest, zoomAt } from "../module/scripts/images/prompts.mjs";

const entry = (type, name, fields = {}, body = "") => ({ type, name, fields, body, tags: [], links: [] });

test("plainText strips links, headings and markup", () => {
  assert.equal(plainText("### Title\nThe **[[Overlook]]** looms.\n\n* rain"), "The Overlook looms. rain");
});

test("imagePrompt prefers the visual field", () => {
  const loc = entry("location", "The Overlook", { visual: "A brutalist tenement under a red sky, [[wind turbines]] on the roof." }, "Long body.");
  assert.equal(imagePrompt(loc, { style: "noir art." }), "A brutalist tenement under a red sky, wind turbines on the roof. noir art.");
  assert.ok(imagePrompt(loc).endsWith(`${DEFAULT_STYLE}.`));
});

test("imagePrompt falls back to the description and features", () => {
  const loc = entry("location", "The Rusty Anvil", { notable_features: "neon anvil sign, bank vault door" }, "Tucked into an alley, the bar glows orange. Inside it is loud. Third sentence.");
  assert.equal(imagePrompt(loc, { style: "S" }), "Tucked into an alley, the bar glows orange. Inside it is loud. Features: neon anvil sign, bank vault door. S.");
  const scene = entry("scene", "Siege", { location: "[[The Overlook]]" }, "### Overview\nMortars fall. Defenders hold.");
  assert.equal(imagePrompt(scene, { style: "S", location: entry("location", "The Overlook", { visual: "A tenement at night." }) }), "A tenement at night. Mortars fall. Defenders hold. S.");
  assert.equal(imagePrompt(entry("scene", "Bare", {}, ""), { style: "S" }), "Bare. S.");
});

test("imagePrompt is capped", () => {
  const long = imagePrompt(entry("location", "X", { visual: "word ".repeat(400) }));
  assert.ok(long.length <= 1200);
  assert.ok(long.endsWith("."));
});

test("imageFileName matches the scene importer's name matching", () => {
  assert.equal(imageFileName("Dr. Chen's Free Clinic"), "dr-chens-free-clinic.jpg");
  assert.equal(imageFileName("The Overlook", "png"), "overlook.png");
});

test("imagesNeeded: locations without images, and scenes whose location doesn't cover them", () => {
  const overlook = entry("location", "The Overlook");
  const anvil = entry("location", "The Rusty Anvil");
  const siege = entry("scene", "Siege", { location: "[[The Overlook]]" });
  const elsewhere = entry("scene", "Elsewhere", { location: "[[Somewhere Unknown]]" });
  const own = entry("scene", "Own", {});
  const described = entry("scene", "Rooftop Duel", { location: "[[The Overlook]]", visual: "Two figures on a rooftop at dawn." });
  const has = e => e === anvil || e === own;
  const jobs = imagesNeeded([overlook, anvil, siege, elsewhere, own, described], has);
  assert.deepEqual(jobs.map(j => j.entry.name), ["The Overlook", "Elsewhere", "Rooftop Duel"]);
  assert.equal(jobs[2].location, overlook);
});

test("pasteTarget prefers the card the GM is on, then the next one without an image", () => {
  const jobs = [
    { include: true, blob: "x", status: "done" },
    { include: true, blob: null, status: "generating" },
    { include: false, blob: null, status: "queued" },
    { include: true, blob: null, status: "waiting" }
  ];
  assert.equal(pasteTarget(jobs, 0), 0);
  assert.equal(pasteTarget(jobs), 3);
  assert.equal(pasteTarget(jobs.slice(0, 2)), 1);
  assert.equal(pasteTarget([{ include: true, blob: "x", status: "done" }]), -1);
  assert.equal(pasteTarget(jobs, 9), 3);
});

test("fitWithin keeps small images and scales big ones to the longer side", () => {
  assert.deepEqual(fitWithin(1536, 1024), { width: 1536, height: 1024 });
  assert.deepEqual(fitWithin(4096, 2304), { width: 2560, height: 1440 });
  assert.deepEqual(fitWithin(2000, 4000), { width: 1280, height: 2560 });
});

test("chatImageRequest asks a chat assistant for a wide picture of the scene", () => {
  const text = chatImageRequest("Probation Day", "A briefing floor at dusk. cinematic concept art.");
  assert.equal(text, 'Please create an image for the scene "Probation Day" in my tabletop role-playing campaign. Make it a wide landscape picture (16:9) that I can use as the scene\'s background.\n\nA briefing floor at dusk. cinematic concept art.');
  assert.match(chatImageRequest("", "X"), /^Please create an image for a scene in my tabletop/);
});

test("the default style no longer asks for no text or watermark", () => {
  assert.doesNotMatch(DEFAULT_STYLE, /no text|no letters|watermark/);
});

test("zoomAt keeps the point under the pointer still and limits the scale", () => {
  const view = zoomAt({ scale: 1, x: 0, y: 0 }, 100, 50, true);
  assert.equal(view.scale, 1.2);
  assert.ok(Math.abs((100 - view.x) / view.scale - 100) < 1e-9 && Math.abs((50 - view.y) / view.scale - 50) < 1e-9);
  assert.equal(zoomAt({ scale: 8, x: 0, y: 0 }, 0, 0, true).scale, 8);
  assert.equal(zoomAt({ scale: 0.1, x: 0, y: 0 }, 0, 0, false).scale, 0.1);
});
