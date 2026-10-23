import test from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, parseSuggestions } from "../module/scripts/youtube/gemini.mjs";

test("buildPrompt includes the line and the playlist mood", () => {
  const p = buildPrompt("High-energy darksynth, 140 bpm", { name: "Finale", mood: "Aggressive" });
  assert.match(p, /Track wanted: High-energy darksynth, 140 bpm/);
  assert.match(p, /Playlist: Finale \(mood: Aggressive\)/);
  assert.doesNotMatch(buildPrompt("x"), /Playlist:/);
  assert.match(p, /energy, tempo and instrumentation/);
  assert.doesNotMatch(p, /already used/);
});

test("buildPrompt lists tracks to avoid, deduplicated and capped", () => {
  const avoid = ["Carpenter Brut – Turbo Killer", "Carpenter Brut – Turbo Killer", " ", ...Array.from({ length: 20 }, (_, i) => `Artist ${i} – Song`)];
  const p = buildPrompt("x", {}, avoid);
  assert.match(p, /already used for other tracks in this playlist; suggest different songs, and prefer different artists: Carpenter Brut – Turbo Killer; Artist 0 – Song/);
  assert.equal((p.match(/Turbo Killer/g) || []).length, 1);
  assert.match(p, /Artist 13 – Song\.$/);
  assert.doesNotMatch(p, /Artist 14/);
});

test("parseSuggestions cleans and limits Gemini's answer", () => {
  const text = JSON.stringify({
    queries: ["epic darksynth instrumental", "  epic  darksynth instrumental ", "a", "cyberpunk boss battle music extended mix one hour loop version", "dark synth", "extra one"],
    tracks: [{ artist: "Some Artist", title: "Some Track" }, { artist: "some artist", title: "some track" }, { artist: "", title: "No artist" }, { artist: "B", title: "Two" }, { artist: "C", title: "Three" }, { artist: "D", title: "Four" }]
  });
  const s = parseSuggestions(text);
  assert.deepEqual(s.queries, ["epic darksynth instrumental", "cyberpunk boss battle music extended mix one hour", "dark synth"]);
  assert.deepEqual(s.tracks.map(t => t.query), ["Some Artist Some Track", "B Two", "C Three"]);
});

test("parseSuggestions survives code fences and junk", () => {
  assert.deepEqual(parseSuggestions('```json\n{"queries":["x y"],"tracks":[]}\n```').queries, ["x y"]);
  assert.deepEqual(parseSuggestions("not json"), { queries: [], tracks: [] });
  assert.deepEqual(parseSuggestions('{"queries":"nope","tracks":{}}'), { queries: [], tracks: [] });
});
