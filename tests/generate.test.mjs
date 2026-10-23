import { test } from "node:test";
import assert from "node:assert/strict";
import { errorMessage, retryAfter } from "../module/scripts/images/generate.mjs";

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
