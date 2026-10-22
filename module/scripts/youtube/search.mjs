import { isoSeconds } from "./youtube.mjs";

const API = "https://www.googleapis.com/youtube/v3";

async function call(endpoint, params) {
  const response = await fetch(`${API}/${endpoint}?${new URLSearchParams(params)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message ?? `${response.status} ${response.statusText}`);
  return data;
}

/**
 * Details for video ids, keeping only those that can be played in an embedded player.
 * One quota unit per call.
 * @returns {Promise<{id: string, title: string, channel: string, thumb: string, duration: number}[]>}
 */
export async function videoDetails(ids, key) {
  if (!ids.length) return [];
  const data = await call("videos", { part: "snippet,contentDetails,status", id: ids.join(","), key });
  const byId = new Map(
    (data.items ?? [])
      .filter(v => v.status?.embeddable !== false)
      .map(v => [v.id, { id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle, thumb: v.snippet.thumbnails?.default?.url ?? "", duration: isoSeconds(v.contentDetails?.duration) }])
  );
  return ids.map(id => byId.get(id)).filter(Boolean);
}

/**
 * Title, channel and thumbnail for one video from YouTube's public oEmbed endpoint, which needs no
 * API key (so pasted links work without one). The length is unknown (0).
 */
export async function oEmbed(id) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  return { id, title: data.title ?? id, channel: data.author_name ?? "", thumb: data.thumbnail_url ?? "", duration: 0 };
}

/**
 * Search YouTube with the official Data API v3 for embeddable videos. Costs 101 quota units
 * (search plus details) of the free 10,000 a day.
 * @param {string} query
 * @param {string} key The GM's YouTube Data API key.
 * @param {number} [max=5]
 */
export async function searchVideos(query, key, max = 5) {
  const data = await call("search", { part: "id", type: "video", videoEmbeddable: "true", maxResults: String(max), q: query, key });
  const ids = (data.items ?? []).map(i => i.id?.videoId).filter(Boolean);
  return videoDetails(ids, key);
}
