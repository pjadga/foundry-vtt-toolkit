import test from "node:test";
import assert from "node:assert/strict";
import { videoIdFrom, trackLines, searchQuery, isoSeconds, formatSeconds, expectedPosition } from "../module/scripts/youtube/youtube.mjs";

test("videoIdFrom reads ids from the usual link shapes", () => {
  const id = "dQw4w9WgXcQ";
  for (const s of [id, `https://www.youtube.com/watch?v=${id}`, `youtube.com/watch?v=${id}&t=30s`, `https://youtu.be/${id}?si=x`, `https://m.youtube.com/watch?v=${id}`, `https://www.youtube.com/embed/${id}`, `https://youtube.com/shorts/${id}`, `https://music.youtube.com/watch?v=${id}&list=RD`]) {
    assert.equal(videoIdFrom(s), id, s);
  }
  assert.equal(videoIdFrom("https://vimeo.com/123"), null);
  assert.equal(videoIdFrom("not a link"), null);
  assert.equal(videoIdFrom("https://www.youtube.com/playlist?list=PL123"), null);
});

test("trackLines strips numbering and bullets", () => {
  assert.deepEqual(trackLines("\n1. Low-fi synthwave, 75 bpm\n2) Drone\n- Jazz\n\n"), ["Low-fi synthwave, 75 bpm", "Drone", "Jazz"]);
});

test("searchQuery drops the tempo and asks for instrumental", () => {
  assert.equal(searchQuery("Ambient industrial drone with distorted electric cello, dark, 68 bpm"), "Ambient industrial drone with distorted electric cello dark instrumental");
  assert.equal(searchQuery("Instrumental noir jazz (slow)"), "Instrumental noir jazz slow");
});

test("durations", () => {
  assert.equal(isoSeconds("PT3M25S"), 205);
  assert.equal(isoSeconds("PT1H2M3S"), 3723);
  assert.equal(isoSeconds("P1DT1S"), 86401);
  assert.equal(isoSeconds("bad"), 0);
  assert.equal(formatSeconds(125), "2:05");
  assert.equal(formatSeconds(3725), "1:02:05");
});

test("expectedPosition follows the shared clock, or the paused position", () => {
  assert.equal(expectedPosition({ startedAt: 10_000 }, 70_000), 60);
  assert.equal(expectedPosition({ startedAt: null, pausedAt: 42 }, 70_000), 42);
  assert.equal(expectedPosition({}, 70_000), 0);
});
