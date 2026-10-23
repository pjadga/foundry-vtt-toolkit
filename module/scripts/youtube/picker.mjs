import { searchVideos, videoDetails, oEmbed } from "./search.mjs";
import { searchQuery, fallbackQueries, videoIdFrom, formatSeconds } from "./youtube.mjs";
import { suggestSearches } from "./gemini.mjs";
import { SILENCE, youtubeOf } from "./player.mjs";

// Stop searching a row once this many videos are found, or after this many YouTube searches
// (each costs about 101 quota units).
const ENOUGH = 6;
const MAX_SEARCHES = { plain: 3, gemini: 5 };

const MODULE_ID = "foundry-vtt-toolkit";
const escape = s => foundry.utils.escapeHTML(String(s ?? ""));
const t = (key, data) => (data ? game.i18n.format(`FVTK.YouTube.${key}`, data) : game.i18n.localize(`FVTK.YouTube.${key}`));

/**
 * GM window for filling a playlist with YouTube tracks: one row per track line (from the NotebookLM
 * playlist entry), each searched with the YouTube Data API. With a Gemini key, Gemini first turns the
 * line into short searches and real track suggestions; without one, the search falls back to shorter
 * versions of the line (fallbackQueries). Only real, embeddable videos found on YouTube are shown.
 * Pick a result per row, edit the search, or paste a link; saving replaces the playlist's YouTube
 * tracks with the picks, in row order.
 */
export class YouTubePicker extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["fvtk", "fvtk-youtube-picker"],
    window: { icon: "fa-brands fa-youtube", resizable: true },
    position: { width: 760, height: 700 },
    actions: {
      search: YouTubePicker.#onSearch,
      searchAll: YouTubePicker.#onSearchAll,
      choose: YouTubePicker.#onChoose,
      useLink: YouTubePicker.#onUseLink,
      addRow: YouTubePicker.#onAddRow,
      save: YouTubePicker.#onSave
    }
  };

  /** @param {Playlist} playlist */
  constructor(playlist, options = {}) {
    super({ id: `fvtk-youtube-picker-${playlist.id}`, window: { title: t("PickerTitle", { name: playlist.name }) }, ...options });
    this.playlist = playlist;
    const picked = new Map(playlist.sounds.filter(youtubeOf).map(s => [youtubeOf(s).line ?? "", youtubeOf(s)]));
    const lines = playlist.flags[MODULE_ID]?.tracks ?? [];
    const rows = (lines.length ? lines : [...picked.keys()]).map(line => {
      const yt = picked.get(line);
      const chosen = yt ? { id: yt.videoId, title: yt.title, channel: yt.channel, duration: yt.duration, thumb: yt.thumb ?? "" } : null;
      // A track already saved counts as picked by hand, so a new search doesn't replace it.
      return { line, query: line ? searchQuery(line) : "", results: chosen ? [chosen] : [], chosen, manual: !!chosen, status: "", note: "" };
    });
    this.rows = rows.length ? rows : [YouTubePicker.#blankRow()];
  }

  static #blankRow() {
    return { line: "", query: "", results: [], chosen: null, status: "", note: "" };
  }

  get apiKey() {
    return game.settings.get(MODULE_ID, "youtubeApiKey").trim();
  }

  get geminiKey() {
    return game.settings.get(MODULE_ID, "geminiApiKey").trim();
  }

  // Set when Gemini is overloaded or times out during Search all, so the remaining rows don't wait
  // on it too. Cleared at the start of every search the GM starts.
  #geminiBusy = false;

  /**
   * The searches to try for a row, in order. A search the GM typed (changed from the default) goes
   * first; then Gemini's track suggestions and searches, if there is a Gemini key; then the short
   * genre searches cut from the line (YouTube matches title words, so these find music where the
   * full description finds sound effects); the full description last, and only without Gemini.
   * @returns {Promise<{query: string, max: number, gemini: false|"track"|"search"}[]>}
   */
  async #plan(row) {
    const typed = row.query.trim();
    const edited = row.line && typed && typed !== searchQuery(row.line);
    const [full, ...shorter] = typed ? fallbackQueries(typed) : [];
    const plain = query => ({ query, max: 5, gemini: false });
    const plan = edited ? [plain(full)] : [];
    row.note = "";
    let gemini = false;
    if (this.geminiKey && !this.#geminiBusy && (row.line || typed)) {
      try {
        const mood = this.playlist.flags[MODULE_ID]?.mood;
        const model = game.settings.get(MODULE_ID, "geminiModel").trim();
        // Tell Gemini what the playlist's other rows already have, so it suggests something else.
        const others = this.rows.filter(r => r !== row);
        const avoid = [...others.flatMap(r => r.suggested ?? []), ...others.map(r => r.chosen?.title).filter(Boolean)];
        const s = await suggestSearches(row.line || typed, { name: this.playlist.name, mood }, this.geminiKey, model, avoid);
        plan.push(...s.tracks.map(tr => ({ query: tr.query, max: 2, gemini: "track" })), ...s.queries.map(query => ({ query, max: 4, gemini: "search" })));
        row.suggested = s.tracks.map(tr => `${tr.artist} – ${tr.title}`);
        if (s.tracks.length) row.note = t("GeminiSuggested", { tracks: row.suggested.join("; ") });
        gemini = plan.length > (edited ? 1 : 0);
      } catch (err) {
        console.warn(`${MODULE_ID} | Gemini suggestions failed`, err);
        this.#geminiBusy = !!err.busy;
        row.note = t(err.busy ? "GeminiBusy" : "GeminiError", { message: err.message });
      }
    } else if (this.geminiKey && this.#geminiBusy) {
      row.note = t("GeminiSkipped");
    }
    plan.push(...shorter.map(plain));
    if (!edited && !gemini && full) plan.push(plain(full));
    return plan;
  }

  async _renderHTML() {
    const keyHint = this.apiKey ? "" : `<p class="notification warning">${t("NoKey")}</p>`;
    const rows = this.rows
      .map((row, i) => {
        const results = row.results
          .map(v => {
            const chosen = row.chosen?.id === v.id;
            return `<li class="fvtk-yt-result${chosen ? " chosen" : ""}" data-action="choose" data-row="${i}" data-video="${escape(v.id)}">
              ${v.thumb ? `<img src="${escape(v.thumb)}" alt="">` : ""}
              <span class="fvtk-yt-title">${chosen ? '<i class="fa-solid fa-check"></i> ' : ""}${escape(v.title)}</span>
              <small>${[escape(v.channel), v.duration ? formatSeconds(v.duration) : "", v.via ? `${t({ track: "ViaGeminiTrack", search: "ViaGeminiSearch" }[v.gemini] ?? "Via")} “${escape(v.via)}”` : ""].filter(Boolean).join(" · ")}</small>
              <a href="https://www.youtube.com/watch?v=${escape(v.id)}" target="_blank" rel="noopener" data-tooltip="${t("Preview")}"><i class="fa-solid fa-up-right-from-square"></i></a>
            </li>`;
          })
          .join("");
        return `<li class="fvtk-yt-row" data-row="${i}">
          <div class="fvtk-yt-line">${escape(row.line) || t("TrackN", { n: i + 1 })}</div>
          <div class="fvtk-yt-controls">
            <input type="text" name="query-${i}" value="${escape(row.query)}" placeholder="${t("SearchPlaceholder")}">
            <button type="button" data-action="search" data-row="${i}"><i class="fa-solid fa-magnifying-glass"></i> ${t("Search")}</button>
            <input type="text" name="link-${i}" placeholder="${t("LinkPlaceholder")}">
            <button type="button" data-action="useLink" data-row="${i}">${t("UseLink")}</button>
          </div>
          ${row.status ? `<div class="fvtk-yt-status">${escape(row.status)}</div>` : ""}
          ${row.note ? `<div class="fvtk-yt-status">${escape(row.note)}</div>` : ""}
          <ul class="fvtk-yt-results">${results}</ul>
        </li>`;
      })
      .join("");
    const count = this.rows.filter(r => r.chosen).length;
    return `${keyHint}
      <div class="fvtk-yt-toolbar"><button type="button" data-action="searchAll"><i class="fa-solid fa-magnifying-glass"></i> ${t("SearchAll")}</button>
        <span class="hint">${t(this.geminiKey ? "GeminiOn" : "GeminiOff")} ${t("QuotaHint", { searches: this.geminiKey ? MAX_SEARCHES.gemini : MAX_SEARCHES.plain })}</span></div>
      <ol class="fvtk-yt-rows">${rows}</ol>
      <footer class="fvtk-yt-footer">
        <button type="button" data-action="addRow"><i class="fa-solid fa-plus"></i> ${t("AddRow")}</button>
        <button type="button" data-action="save" ${count ? "" : "disabled"}><i class="fa-solid fa-floppy-disk"></i> ${t("Save", { count })}</button>
      </footer>`;
  }

  _replaceHTML(result, content) {
    const scroll = content.querySelector(".fvtk-yt-rows")?.scrollTop ?? 0;
    content.innerHTML = result;
    const list = content.querySelector(".fvtk-yt-rows");
    if (list) list.scrollTop = scroll;
  }

  /** Keep what was typed into the search boxes across re-renders. */
  #readInputs() {
    this.rows.forEach((row, i) => {
      const input = this.element?.querySelector(`input[name="query-${i}"]`);
      if (input) row.query = input.value;
    });
  }

  async #search(i) {
    const row = this.rows[i];
    if (!this.apiKey) return ui.notifications.warn(t("NoKey"));
    if (!row.query.trim() && !row.line) return;
    row.status = t(this.geminiKey ? "AskingGemini" : "Searching");
    await this.render();

    const plan = await this.#plan(row);
    const limit = this.geminiKey ? MAX_SEARCHES.gemini : MAX_SEARCHES.plain;
    const found = new Map();
    let searches = 0;
    let error = null;
    for (const step of plan) {
      if (found.size >= ENOUGH || searches >= limit) break;
      // Shorter fallbacks only while results are still thin.
      if (!step.gemini && searches && found.size >= ENOUGH / 2) break;
      row.status = t("SearchingFor", { query: step.query });
      await this.render();
      try {
        searches++;
        for (const v of await searchVideos(step.query, this.apiKey, step.max)) {
          if (!found.has(v.id)) found.set(v.id, { ...v, via: step.query, gemini: step.gemini });
        }
      } catch (err) {
        console.error(`${MODULE_ID} | YouTube search failed`, err);
        error = err;
        if (/quota/i.test(err.message)) break;
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
      const ids = new Set(others.map(v => v.id));
      const songs = new Set(others.filter(v => v.gemini === "track").map(v => v.via.toLowerCase()));
      const fresh = v => !ids.has(v.id) && !(v.gemini === "track" && songs.has(v.via.toLowerCase()));
      row.chosen = row.results.find(fresh) ?? row.results.find(v => !ids.has(v.id)) ?? row.results[0] ?? row.chosen;
    }
    if (found.size) row.status = t(searches === 1 ? "FoundOne" : "Found", { count: found.size, searches });
    else row.status = error ? t("SearchError", { message: error.message }) : t("NoResults");
    await this.render();
  }

  static async #onSearch(event, target) {
    this.#readInputs();
    this.#geminiBusy = false;
    await this.#search(Number(target.dataset.row));
  }

  static async #onSearchAll() {
    this.#readInputs();
    this.#geminiBusy = false;
    for (let i = 0; i < this.rows.length; i++) await this.#search(i);
  }

  static async #onChoose(event, target) {
    if (event.target.closest("a")) return; // the preview link
    this.#readInputs();
    const row = this.rows[Number(target.dataset.row)];
    row.chosen = row.results.find(v => v.id === target.dataset.video) ?? row.chosen;
    row.manual = true;
    await this.render();
  }

  static async #onUseLink(event, target) {
    this.#readInputs();
    const i = Number(target.dataset.row);
    const row = this.rows[i];
    const id = videoIdFrom(this.element.querySelector(`input[name="link-${i}"]`)?.value);
    if (!id) return ui.notifications.warn(t("BadLink"));
    let video = null;
    try {
      // The Data API gives the length too; oEmbed works without a key.
      if (this.apiKey) [video] = await videoDetails([id], this.apiKey);
      video ??= await oEmbed(id);
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not look up ${id}`, err);
    }
    video ??= { id, title: id, channel: "", duration: 0, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
    row.results = [video, ...row.results.filter(v => v.id !== id)];
    row.chosen = video;
    row.manual = true;
    row.status = "";
    await this.render();
  }

  static async #onAddRow() {
    this.#readInputs();
    this.rows.push(YouTubePicker.#blankRow());
    await this.render();
  }

  static async #onSave() {
    const playlist = this.playlist;
    const picks = this.rows.filter(r => r.chosen);
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
    ui.notifications.info(t("Saved", { count: picks.length, name: playlist.name }));
    await this.close();
  }
}

/** Ask which playlist to fill, then open the picker for it. */
export async function chooseAndPick() {
  if (!game.user.isGM) return;
  const playlists = [...game.playlists].sort((a, b) => !!b.flags[MODULE_ID]?.tracks - !!a.flags[MODULE_ID]?.tracks || a.name.localeCompare(b.name));
  if (!playlists.length) return ui.notifications.warn(t("NoPlaylists"));
  const id = await foundry.applications.api.DialogV2.prompt({
    window: { title: t("ChooseTitle") },
    content: `<div class="fvtk"><label>${t("ChooseLabel")}
      <select name="playlist">${playlists.map(p => `<option value="${p.id}">${escape(p.name)}</option>`).join("")}</select></label></div>`,
    ok: { label: t("Open"), callback: (event, button) => button.form.elements.playlist.value },
    rejectClose: false
  });
  const playlist = id && game.playlists.get(id);
  if (playlist) new YouTubePicker(playlist).render({ force: true });
}
