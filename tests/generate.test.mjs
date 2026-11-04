import { test } from "node:test";
import assert from "node:assert/strict";
import { errorMessage, retryAfter, geminiImageError, geminiImagePart, sizeFor, SIZE, PROVIDERS, openaiImageSize, openaiImageError } from "../module/scripts/images/generate.mjs";

const FREE_LIMIT = '{"status":402,"success":false,"error":{"code":"FREE_LIMIT","message":"Free limit reached: 1 image every 45 seconds per IP"}}';

test("errorMessage reads JSON errors and strips HTML", () => {
  assert.equal(errorMessage(FREE_LIMIT), "Free limit reached: 1 image every 45 seconds per IP");
  assert.equal(errorMessage('{"message":"bad prompt"}'), "bad prompt");
  assert.equal(errorMessage("<html><body><h1>502 Bad Gateway</h1></body></html>"), "502 Bad Gateway");
});

test("retryAfter waits out Pollinations' free limit", () => {
  assert.deepEqual(retryAfter(402, FREE_LIMIT, null), { retry: true, limited: true, seconds: 47 });
  assert.deepEqual(retryAfter(429, "", "30"), { retry: true, limited: true, seconds: 32 });
  assert.equal(retryAfter(503, "", null).retry, true);
  assert.equal(retryAfter(402, '{"error":"payment required"}', null).retry, false);
  assert.equal(retryAfter(400, "bad", null).retry, false);
});

const FREE_TIER = {
  error: {
    code: 429,
    status: "RESOURCE_EXHAUSTED",
    message: "You exceeded your current quota, please check your plan and billing details.\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3.1-flash-lite-image",
    details: [
      { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] },
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "43736s" }
    ]
  }
};

test("geminiImageError says a free-tier key needs billing, and doesn't retry", () => {
  const e = geminiImageError(429, FREE_TIER, "gemini-3.1-flash-lite-image");
  assert.equal(e.billing, true);
  assert.equal(e.retry, false);
  assert.match(e.message, /need billing/);
});

test("geminiImageError waits out short rate limits and reports the rest readably", () => {
  const limited = { error: { message: "Resource exhausted.", details: [{ retryDelay: "12.5s" }] } };
  assert.deepEqual(geminiImageError(429, limited, "m"), { message: "Gemini's rate limit for m was reached, try again later (Resource exhausted.)", retry: true, seconds: 14, billing: false });
  assert.equal(geminiImageError(429, { error: { message: "x", details: [{ retryDelay: "3600s" }] } }, "m").retry, false);
  assert.equal(geminiImageError(503, { error: { message: "overloaded" } }, "m").retry, true);
  assert.match(geminiImageError(400, { error: { message: "API key not valid. Please pass a valid API key." } }, "m").message, /refused the API key/);
  assert.match(geminiImageError(404, {}, "nano-x").message, /no model "nano-x"/);
  assert.equal(geminiImageError(400, { error: { message: "Bad aspect ratio\nmore" } }, "m").message, "400: Bad aspect ratio");
});

test("geminiImagePart takes the final image and explains when there is none", () => {
  const data = {
    candidates: [{ content: { parts: [{ text: "Here you go" }, { inlineData: { mimeType: "image/png", data: "THOUGHT" }, thought: true }, { inlineData: { mimeType: "image/jpeg", data: "QUJD" } }] } }]
  };
  assert.deepEqual(geminiImagePart(data), { mimeType: "image/jpeg", data: "QUJD" });
  assert.deepEqual(geminiImagePart({ candidates: [{ content: { parts: [{ inline_data: { mime_type: "image/png", data: "eA==" } }] } }] }), { mimeType: "image/png", data: "eA==" });
  assert.throws(() => geminiImagePart({ promptFeedback: { blockReason: "PROHIBITED_CONTENT" } }), /declined to draw this \(PROHIBITED_CONTENT\)/);
  assert.throws(() => geminiImagePart({ candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [] } }] }), /declined/);
  assert.throws(() => geminiImagePart({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "I can only describe it." }] } }] }), /no image \(STOP\): I can only describe it\./);
});

test("sizeFor keeps scene images at SIZE and fits other shapes to the same area", () => {
  assert.deepEqual(sizeFor("16:9"), SIZE);
  assert.deepEqual(sizeFor("1:1"), { width: 1008, height: 1008 });
  assert.deepEqual(sizeFor("nonsense"), SIZE);
  assert.ok(PROVIDERS.includes("gemini"));
});

test("openaiImageSize uses free sizes on 2.5 models and the fixed three on older ones", () => {
  assert.equal(openaiImageSize("16:9"), "1536x864");
  assert.equal(openaiImageSize("1:1"), "1152x1152");
  assert.equal(openaiImageSize("16:9", "gpt-image-1.5"), "1536x1024");
  assert.equal(openaiImageSize("1:1", "gpt-image-1-mini"), "1024x1024");
  assert.equal(openaiImageSize("2:3", "gpt-image-1"), "1024x1536");
  for (const ratio of ["16:9", "1:1", "2:3", "4:3", "nonsense"]) {
    const [w, h] = openaiImageSize(ratio).split("x").map(Number);
    assert.ok(w % 16 === 0 && h % 16 === 0, ratio);
    assert.ok(w * h >= 655_360 && Math.max(w, h) <= 3840, ratio);
  }
});

test("openaiImageError explains keys, credit, verification and refusals, and retries only what can pass", () => {
  const err = (status, error) => openaiImageError(status, { error }, "gpt-image-2.5-flare");
  assert.match(err(401, { message: "Incorrect API key provided: sk-...", code: "invalid_api_key" }).message, /refused the API key/);
  const quota = err(429, { message: "You exceeded your current quota", code: "insufficient_quota" });
  assert.equal(quota.retry, false);
  assert.match(quota.message, /no credit/);
  assert.match(err(403, { message: "Your organization must be verified to use the model" }).message, /verified/);
  const limit = err(429, { message: "Rate limit reached", code: "rate_limit_exceeded" });
  assert.equal(limit.retry, true);
  assert.equal(err(500, { message: "oops" }).retry, true);
  assert.match(err(400, { message: "Your request was rejected", code: "moderation_blocked" }).message, /declined/);
  assert.match(err(404, { message: "nope", code: "model_not_found" }).message, /no image model "gpt-image-2.5-flare"/);
  assert.equal(err(400, { message: "Invalid size\nmore" }).message, "400: Invalid size");
  assert.ok(PROVIDERS.includes("openai"));
});
