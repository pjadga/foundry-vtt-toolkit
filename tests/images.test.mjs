import test from "node:test";
import assert from "node:assert/strict";
import { plainText, imagePrompt, imageFileName, imagesNeeded, DEFAULT_STYLE } from "../module/scripts/images/prompts.mjs";

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
  assert.ok(long.length <= 700);
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
