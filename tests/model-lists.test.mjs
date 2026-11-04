import test from "node:test";
import assert from "node:assert/strict";
import { geminiModels, openaiImageModels, modelOptions, MODEL_SETTINGS, FALLBACK_MODELS } from "../module/scripts/model-lists.mjs";

const gemini = {
  models: [
    { name: "models/gemini-flash-lite-latest", supportedGenerationMethods: ["generateContent", "countTokens"] },
    { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3-pro", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] },
    { name: "models/gemini-2.5-flash-preview-tts", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.1-flash-lite-image", supportedGenerationMethods: ["generateContent"] },
    { name: "models/imagen-4.0-generate-001", supportedGenerationMethods: ["predict"] },
    { name: "models/gemini-live-2.5-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/antigravity-preview-latest", supportedGenerationMethods: ["generateContent"] },
    { name: "models/deep-research-pro-preview-12-2025", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemma-3-27b-it", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-nano-banana-2.1", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.5-transcribe", supportedGenerationMethods: ["generateContent"] }
  ]
};

test("geminiModels splits chat models from image models", () => {
  assert.deepEqual(geminiModels(gemini, "gemini-text"), ["gemini-flash-lite-latest", "gemini-3-pro", "gemini-2.5-flash"]);
  assert.deepEqual(geminiModels(gemini, "gemini-image"), ["gemini-3.1-flash-lite-image", "gemini-nano-banana-2.1"]);
  assert.deepEqual(geminiModels({}, "gemini-text"), []);
});

test("openaiImageModels keeps GPT Image models only", () => {
  const answer = { data: [{ id: "gpt-5" }, { id: "gpt-image-1.5" }, { id: "gpt-image-2.5-flare" }, { id: "dall-e-3" }, { id: "gpt-image-2.5-sunburst" }] };
  assert.deepEqual(openaiImageModels(answer), ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "gpt-image-1.5"]);
});

test("modelOptions falls back and always keeps the current value", () => {
  assert.deepEqual(modelOptions([], "openai-image", "gpt-image-2.5-flare"), FALLBACK_MODELS["openai-image"]);
  assert.deepEqual(modelOptions(["a", "b"], "gemini-text", "custom-model"), ["custom-model", "a", "b"]);
  assert.deepEqual(modelOptions(["a", "b"], "gemini-text", ""), ["a", "b"]);
  assert.ok(Object.values(MODEL_SETTINGS).every(kind => FALLBACK_MODELS[kind]?.length));
});

test("modelStrength reads the strength from the name", async () => {
  const { modelStrength, modelLabel } = await import("../module/scripts/model-lists.mjs");
  const cases = {
    "gemini-flash-lite-latest": "Low",
    "gemini-3.1-flash-lite-image": "Low",
    "gemini-flash-latest": "Medium",
    "gemini-2.5-flash": "Medium",
    "gemini-3.1-flash-image": "Medium",
    "gemini-nano-banana-2.1": "Medium",
    "gemini-pro-latest": "High",
    "gemini-2.5-pro": "High",
    "gemini-3-pro-image": "High",
    "gemini-3.1-pro-preview": "High",
    "gemini-3.5-pro": "Extra",
    "gemini-3-ultra": "Max",
    "gemini-2.5-deep-think": "Max",
    "gpt-image-2.5-flare": "Medium",
    "gpt-image-2.5-sunburst": "High",
    "gpt-image-1.5": "Low",
    "gemini-4-argon": null,
    "something-else": null
  };
  for (const [id, strength] of Object.entries(cases)) assert.equal(modelStrength(id), strength, id);
  assert.equal(modelLabel("gemini-flash-latest"), "gemini-flash-latest (Medium)");
  assert.equal(modelLabel("gemini-4-argon"), "gemini-4-argon");
});
