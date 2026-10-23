import { test } from "node:test";
import assert from "node:assert/strict";
import { imageRequest, guessKind, aspectFor, imagePlanRequest, parseImagePlan, imageTargets } from "../module/scripts/assistant/drawing.mjs";

test("imageRequest spots requests for an image", () => {
  for (const text of [
    "draw a portrait of Rook",
    "Please draw the docks at dawn",
    "Can you paint [[The Afterlife]] at night?",
    "make a portrait of Vex",
    "Generate an image of the vault door",
    "create a new picture of the safehouse",
    "give me an NPC portrait for the fixer",
    "Portrait of Dr. Chen",
    "picture of the market",
    "image: neon rain over Watson"
  ]) assert.ok(imageRequest(text), text);
  for (const text of ["What does Rook know about the vault?", "Make a fixer NPC for the docks", "Give me the background on Rook", "show me the NPCs in Watson", "Draft a scene for session 3", ""]) {
    assert.equal(imageRequest(text), null, text);
  }
  assert.equal(imageRequest("image: neon rain over Watson").request, "neon rain over Watson");
  assert.equal(imageRequest("draw a portrait of Rook").kind, "portrait");
  assert.equal(imageRequest("draw the alley behind the club").kind, "scene");
  assert.equal(imageRequest("draw Rook").kind, null);
});

test("guessKind and aspectFor", () => {
  assert.equal(guessKind("a token for the guard"), "portrait");
  assert.equal(guessKind("the rooftop bar"), "scene");
  assert.equal(guessKind("Rook"), null);
  assert.equal(aspectFor("portrait"), "1:1");
  assert.equal(aspectFor("scene"), "16:9");
  assert.equal(aspectFor(null), "16:9");
});

test("imagePlanRequest asks for JSON with the request and style", () => {
  const text = imagePlanRequest("draw Rook", "gritty ink style");
  assert.match(text, /"draw Rook"/);
  assert.match(text, /JSON only/);
  assert.match(text, /gritty ink style/);
});

test("parseImagePlan reads JSON, fenced JSON, or plain text", () => {
  assert.deepEqual(parseImagePlan('{"prompt":"A tall bodyguard.","subject":"Rook","kind":"portrait"}'), { prompt: "A tall bodyguard.", subject: "Rook", kind: "portrait" });
  assert.deepEqual(parseImagePlan('```json\n{"prompt":"Docks at dawn","subject":"[[The Docks]]","kind":"scene"}\n```'), { prompt: "Docks at dawn", subject: "The Docks", kind: "scene" });
  assert.deepEqual(parseImagePlan('Here: {"prompt":"x","subject":"","kind":"weird"}', "portrait"), { prompt: "x", subject: "", kind: "portrait" });
  assert.deepEqual(parseImagePlan("A rainy street at night"), { prompt: "A rainy street at night", subject: "", kind: "scene" });
  assert.equal(parseImagePlan("x".repeat(2000)).prompt.length, 900);
  assert.throws(() => parseImagePlan('{"prompt":""}'), /didn't write/);
  assert.throws(() => parseImagePlan(""), /didn't write/);
});

test("imageTargets picks documents named by the plan, the request and the last answer", () => {
  const docs = [
    { name: "Rook", uuid: "Actor.a", use: "portrait" },
    { name: "Vex", uuid: "Actor.b", use: "portrait" },
    { name: "Dr. Chen", uuid: "Actor.c", use: "portrait" },
    { name: "The Afterlife", uuid: "Scene.a", use: "background" },
    { name: "Rook", uuid: "Scene.r", use: "background" }
  ];
  assert.deepEqual(imageTargets({ subject: "Vex", request: "draw Rook and Vex", kind: "portrait" }, docs).map(d => d.uuid), ["Actor.b", "Actor.a"]);
  assert.deepEqual(imageTargets({ subject: "", request: "draw her", previous: "[[Dr. Chen]] runs the clinic", kind: "portrait" }, docs).map(d => d.uuid), ["Actor.c"]);
  assert.deepEqual(imageTargets({ subject: "Afterlife", request: "paint the bar", kind: "scene" }, docs).map(d => d.uuid), ["Scene.a"]);
  assert.deepEqual(imageTargets({ subject: "Nobody", request: "draw a crowd", kind: "portrait" }, docs), []);
  // "Rook" isn't found inside "Rookie".
  assert.deepEqual(imageTargets({ request: "draw a rookie cop", kind: "portrait" }, docs), []);
});
