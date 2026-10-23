import { searchVideos } from "./search.mjs";
import { searchQuery, fallbackQueries } from "./youtube.mjs";
import { suggestSearches } from "./gemini.mjs";
import { SILENCE, youtubeOf } from "./player.mjs";

const MODULE_ID = "foundry-vtt-toolkit";
const t = (key, data) => (data ? game.i18n.format(`FVTK.YouTube.${key}`, data) : game.i18n.localize(`FVTK.YouTube.${key}`));

// The picker stops searching a row once this many videos are found, or after this many YouTube
// searches (each costs about 101 quota units). Auto-pick only needs one good video per row, so it
// stops sooner and leaves quota for the rest of the campaign.
export const LIMITS = {
  picker: { enough: 6, plain: 3, gemini: 5 },
  auto: { enough: 2, plain: 2, gemini: 2 }
};

/** A row for a track line, before any search. */
export function trackRow(line = "") {
  return { line, query: line ? searchQuery(line) : "", results: [], chosen: null, manual: false, status: "", note: "" };
}

/**
 * Searches YouTube for a playlist's track rows, the same way for the picker window and for
 * auto-pick. With a Gemini key, Gemini first turns each line into short searches and real track
 * suggestions; without one, the search falls back to shorter versions of the line
 * (fallbackQueries). Only real, embeddable videos found on YouTube are kept.
 */
export class TrackSearch {
  /**
   * @param {Playlist} playlist
   * @param {object[]} rows See trackRow; searching fills in results, chosen, status and note.
   * @param {{enough: number, plain: number, gemini: number}} [limits]
   * @param {{titles: string[], ids: Set<string>}} [taken] Tracks other playlists already use, to avoid.
   */
  constructor(playlist, rows, limits = LIMITS.picker, taken = { titles: [], ids: new Set() }) {
    this.playlist = playlist;
    this.rows = rows;
    this.limits = limits;
    this.taken = taken;
  }

  get apiKey() {
    return game.settings.get(MODULE_ID, "youtubeApiKey").trim();
  }

  get geminiKey() {
    return game.settings.get(MODULE_ID, "geminiApiKey").trim();
  }

  // Set when Gemini is overloaded or times out, so the remaining rows don't wait on it too. The
  // picker clears it at the start of every search the GM starts.
  geminiBusy = false;

  // YouTube's error once the daily quota is used up; later searches then don't try.
  quotaError = null;

  get quotaExceeded() {
    return !!this.quotaError;
  }

  /**
   * The searches to try for a row, in order. A search the GM typed (changed from the default) goes
   * first; then Gemini's track suggestions and searches, if there is a Gemini key; then the short
   * genre searches cut from the line (YouTube matches title words, so these find music where the
   * full description finds sound effects); the full description last, and only without Gemini.
   * @returns {Promise<{query: string, max: number, gemini: false|"track"|"search"}[]>}
   */
  async plan(row) {
    const typed = row.query.trim();
    const edited = row.line && typed && typed !== searchQuery(row.line);
    const [full, ...shorter] = typed ? fallbackQueries(typed) : [];
    const plain = query => ({ query, max: 5, gemini: false });
    const plan = edited ? [plain(full)] : [];
    row.note = "";
    let gemini = false;
    if (this.geminiKey && !this.geminiBusy && (row.line || typed)) {
      try {
        const mood = this.playlist.flags[MODULE_ID]?.mood;
        const model = game.settings.get(MODULE_ID, "geminiModel").trim();
        // Tell Gemini what the playlist's other rows already have, so it suggests something else.
        const others = this.rows.filter(r => r !== row);
        // This playlist's own rows first: buildPrompt keeps only the first few.
        const avoid = [...others.flatMap(r => r.suggested ?? []), ...others.map(r => r.chosen?.title).filter(Boolean), ...this.taken.titles];
        const s = await suggestSearches(row.line || typed, { name: this.playlist.name, mood }, this.geminiKey, model, avoid);
        plan.push(...s.tracks.map(tr => ({ query: tr.query, max: 2, gemini: "track" })), ...s.queries.map(query => ({ query, max: 4, gemini: "search" })));
        row.suggested = s.tracks.map(tr => `${tr.artist} – ${tr.title}`);
        if (s.tracks.length) row.note = t("GeminiSuggested", { tracks: row.suggested.join("; ") });
        gemini = plan.length > (edited ? 1 : 0);
      } catch (err) {
        console.warn(`${MODULE_ID} | Gemini suggestions failed`, err);
        this.geminiBusy = !!err.busy;
        row.note = t(err.busy ? "GeminiBusy" : "GeminiError", { message: err.message });
      }
    } else if (this.geminiKey && this.geminiBusy) {
      row.note = t("GeminiSkipped");
    }
    plan.push(...shorter.map(plain));
    if (!edited && !gemini && full) plan.push(plain(full));
    return plan;
  }

  /**
   * Search for one row and pick its best result.
   * @param {object} row
   * @param {() => any} [onStatus] Called whenever row.status changes, e.g. to re-render.
   */
  async search(row, onStatus = () => {}) {
    if (!this.apiKey || (!row.query.trim() && !row.line)) return;
    row.status = t(this.geminiKey ? "AskingGemini" : "Searching");
    await onStatus();

    const plan = await this.plan(row);
    const { enough } = this.limits;
    const limit = this.geminiKey ? this.limits.gemini : this.limits.plain;
    const found = new Map();
    let searches = 0;
    let error = this.quotaError;
    for (const step of plan) {
      if (this.quotaExceeded || found.size >= enough || searches >= limit) break;
      // Shorter fallbacks only while results are still thin.
      if (!step.gemini && searches && found.size >= enough / 2) break;
      row.status = t("SearchingFor", { query: step.query });
      await onStatus();
      try {
        searches++;
        for (const v of await searchVideos(step.query, this.apiKey, step.max)) {
          if (!found.has(v.id)) found.set(v.id, { ...v, via: step.query, gemini: step.gemini });
        }
      } catch (err) {
        console.error(`${MODULE_ID} | YouTube search failed`, err);
        error = err;
        if (/quota/i.test(err.message)) this.quotaError = err;
      }
    }

    row.results = [...found.values()];
    // A pick made by hand survives a new search (and stays visible); otherwise take the top result.
    if (row.manual && row.chosen) {
      if (!found.has(row.chosen.id)) row.results.unshift(row.chosen);
    } else {
      // Prefer a video no other row has picked, and not another upload of a song another row picked
      // through the same Gemini suggestion, so the playlist doesn't repeat itself.
      const others = this.rows.filter(r => r !== row && r.chosen).map(r => r.chosen);
      const ids = new Set([...this.taken.ids, ...others.map(v => v.id)]);
      const songs = new Set(others.filter(v => v.gemini === "track").map(v => v.via.toLowerCase()));
      const fresh = v => !ids.has(v.id) && !(v.gemini === "track" && songs.has(v.via.toLowerCase()));
      row.chosen = row.results.find(fresh) ?? row.results.find(v => !ids.has(v.id)) ?? row.results[0] ?? row.chosen;
    }
    if (found.size) row.status = t(searches === 1 ? "FoundOne" : "Found", { count: found.size, searches });
    else row.status = error ? t("SearchError", { message: error.message }) : t("NoResults");
    await onStatus();
  }
}

/**
 * Replace a playlist's YouTube tracks with the rows' picks, in row order.
 * @returns {Promise<number>} How many tracks were saved.
 */
export async function saveTracks(playlist, rows) {
  const picks = rows.filter(r => r.chosen);
  const old = playlist.sounds.filter(youtubeOf).map(s => s.id);
  if (old.length) await playlist.deleteEmbeddedDocuments("PlaylistSound", old);
  await playlist.createEmbeddedDocuments(
    "PlaylistSound",
    picks.map((row, i) => {
      const v = row.chosen;
      return {
        name: v.title,
        path: SILENCE,
        // The placeholder loops forever; the YouTube player decides when a track ends.
        repeat: true,
        volume: 0.5,
        sort: (i + 1) * 100,
        description: `${v.channel} · https://www.youtube.com/watch?v=${v.id}`,
        flags: { [MODULE_ID]: { youtube: { videoId: v.id, title: v.title, channel: v.channel, duration: v.duration, thumb: v.thumb, line: row.line } } }
      };
    })
  );
  const update = { sorting: "m" };
  if (playlist.mode === CONST.PLAYLIST_MODES.DISABLED) update.mode = CONST.PLAYLIST_MODES.SEQUENTIAL;
  await playlist.update(update);
  return picks.length;
}

/** NotebookLM playlists with track lines and no YouTube tracks yet. */
export function playlistsToFill() {
  return game.playlists.filter(p => p.flags[MODULE_ID]?.source === "notebooklm" && p.flags[MODULE_ID]?.tracks?.length && !p.sounds.some(youtubeOf));
}

/**
 * Pick a YouTube video for every track line of each playlist, without a window: the top result of
 * a short search per line (LIMITS.auto). Needs the GM's YouTube key; stops when the daily quota runs
 * out. Open the picker afterwards to change any pick.
 * @param {Playlist[]} [playlists] Defaults to playlistsToFill().
 * @returns {Promise<{filled: {name: string, count: number, of: number}[], quotaExceeded: boolean}>}
 */
export async function autoPickTracks(playlists = playlistsToFill()) {
  const result = { filled: [], quotaExceeded: false };
  if (!playlists.length || !game.settings.get(MODULE_ID, "youtubeApiKey").trim()) return result;
  const lines = playlists.reduce((n, p) => n + p.flags[MODULE_ID].tracks.length, 0);
  const progress = ui.notifications.info(t("AutoPicking", { count: lines }), { progress: true });
  let done = 0;
  // Shared across the playlists, so Street and Tension don't end up with the same songs.
  const taken = { titles: [], ids: new Set() };
  for (const playlist of playlists) {
    const rows = playlist.flags[MODULE_ID].tracks.map(trackRow);
    const search = new TrackSearch(playlist, rows, LIMITS.auto, taken);
    for (const row of rows) {
      await search.search(row);
      if (row.chosen) {
        taken.ids.add(row.chosen.id);
        taken.titles.push(row.chosen.title, ...(row.suggested ?? []));
      }
      progress?.update?.({ pct: ++done / lines, message: t("AutoPickingRow", { name: playlist.name, line: row.line }) });
      if (search.quotaExceeded) break;
    }
    const count = rows.some(r => r.chosen) ? await saveTracks(playlist, rows) : 0;
    result.filled.push({ name: playlist.name, count, of: rows.length });
    if (search.quotaExceeded) {
      result.quotaExceeded = true;
      break;
    }
  }
  progress?.update?.({ pct: 1 });
  return result;
}
