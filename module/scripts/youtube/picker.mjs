import { searchVideos, videoDetails, oEmbed } from "./search.mjs";
import { searchQuery, videoIdFrom, formatSeconds } from "./youtube.mjs";
import { SILENCE, youtubeOf } from "./player.mjs";

const MODULE_ID = "foundry-vtt-toolkit";
const escape = s => foundry.utils.escapeHTML(String(s ?? ""));
const t = (key, data) => (data ? game.i18n.format(`FVTK.YouTube.${key}`, data) : game.i18n.localize(`FVTK.YouTube.${key}`));

/**
 * GM window for filling a playlist with YouTube tracks: one row per track line (from the NotebookLM
 * playlist entry), each searched with the YouTube Data API. Pick a result per row, edit the search,
 * or paste a link; saving replaces the playlist's YouTube tracks with the picks, in row order.
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
      return { line, query: line ? searchQuery(line) : "", results: chosen ? [chosen] : [], chosen, status: "" };
    });
    this.rows = rows.length ? rows : [YouTubePicker.#blankRow()];
  }

  static #blankRow() {
    return { line: "", query: "", results: [], chosen: null, status: "" };
  }

  get apiKey() {
    return game.settings.get(MODULE_ID, "youtubeApiKey").trim();
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
              <small>${[escape(v.channel), v.duration ? formatSeconds(v.duration) : ""].filter(Boolean).join(" · ")}</small>
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
          <ul class="fvtk-yt-results">${results}</ul>
        </li>`;
      })
      .join("");
    const count = this.rows.filter(r => r.chosen).length;
    return `${keyHint}
      <div class="fvtk-yt-toolbar"><button type="button" data-action="searchAll"><i class="fa-solid fa-magnifying-glass"></i> ${t("SearchAll")}</button>
        <span class="hint">${t("QuotaHint")}</span></div>
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
    if (!row.query.trim()) return;
    row.status = t("Searching");
    await this.render();
    try {
      row.results = await searchVideos(row.query, this.apiKey);
      // Keep a manual pick visible even when it isn't in the new results.
      if (row.chosen && !row.results.some(v => v.id === row.chosen.id)) row.results.unshift(row.chosen);
      row.chosen ??= row.results[0] ?? null;
      row.status = row.results.length ? "" : t("NoResults");
    } catch (err) {
      console.error(`${MODULE_ID} | YouTube search failed`, err);
      row.status = t("SearchError", { message: err.message });
    }
    await this.render();
  }

  static async #onSearch(event, target) {
    this.#readInputs();
    await this.#search(Number(target.dataset.row));
  }

  static async #onSearchAll() {
    this.#readInputs();
    for (let i = 0; i < this.rows.length; i++) await this.#search(i);
  }

  static async #onChoose(event, target) {
    if (event.target.closest("a")) return; // the preview link
    this.#readInputs();
    const row = this.rows[Number(target.dataset.row)];
    row.chosen = row.results.find(v => v.id === target.dataset.video) ?? row.chosen;
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
