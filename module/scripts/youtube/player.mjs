import { expectedPosition } from "./youtube.mjs";

/**
 * Synced YouTube playback for playlist sounds.
 *
 * A YouTube track is an ordinary PlaylistSound whose path is a silent placeholder (so Foundry's own
 * play, pause, stop, volume and sync keep working) with the video in flags.<module>.youtube. Every
 * client watches those sounds and plays the video in YouTube's embedded player, in a small "Now
 * playing" window that stays visible and at least 200x200, as YouTube's embedding rules require.
 *
 * Timing is shared through the sound's flags: startedAt (server time the track would have started
 * at) while playing, pausedAt (seconds) while paused. The user who presses play or pause writes
 * them; each client seeks when it drifts. The active GM moves the playlist on when a video ends.
 */

const MODULE_ID = "foundry-vtt-toolkit";
export const SILENCE = `modules/${MODULE_ID}/assets/silence.wav`;
const FLAG = `flags.${MODULE_ID}.youtube`;
const DRIFT = 2; // seconds of drift before a client seeks
const VIDEO = { width: 356, height: 200 };
const VOLUME_SETTINGS = { music: "globalPlaylistVolume", environment: "globalAmbientVolume", interface: "globalInterfaceVolume" };

/** The YouTube data of a playlist sound, or null. */
export function youtubeOf(sound) {
  return sound?.flags?.[MODULE_ID]?.youtube ?? null;
}

/** @type {Map<string, {videoId: string, player: object|null, ready: boolean, slot: HTMLElement}>} keyed by sound uuid */
const players = new Map();
let apiReady;
let deck;
// Set when this user closes the Now playing window: their music stays off until the track changes.
let closedFor = new Set();

function ensureApi() {
  apiReady ??= new Promise(resolve => {
    if (window.YT?.Player) return resolve();
    const poll = setInterval(() => {
      if (window.YT?.Player) {
        clearInterval(poll);
        resolve();
      }
    }, 250);
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.append(script);
    }
  });
  return apiReady;
}

class YouTubeDeck extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fvtk-youtube-deck",
    classes: ["fvtk", "fvtk-youtube-deck"],
    window: { title: "FVTK.YouTube.NowPlaying", icon: "fa-brands fa-youtube", minimizable: false, resizable: false },
    position: { width: VIDEO.width + 24, height: "auto" }
  };

  // Rendered once; slots are then added and removed directly so playing iframes are never rebuilt.
  async _renderHTML() {
    return `<div class="fvtk-yt-deck"></div>`;
  }

  _replaceHTML(result, content) {
    if (!content.querySelector(".fvtk-yt-deck")) content.innerHTML = result;
  }

  get slots() {
    return this.element?.querySelector(".fvtk-yt-deck");
  }

  async _onClose(options) {
    await super._onClose(options);
    deck = null;
    if (options.fvtkAuto) return; // closed because nothing is playing
    for (const [key, entry] of players) {
      closedFor.add(`${key}:${entry.videoId}`);
      entry.player?.destroy?.();
    }
    players.clear();
    ui.notifications.info(game.i18n.localize("FVTK.YouTube.ClosedNotice"));
  }
}

async function openDeck() {
  if (deck?.rendered) return deck;
  deck = new YouTubeDeck({ position: { left: 15, top: Math.max(10, window.innerHeight - VIDEO.height - 150) } });
  await deck.render({ force: true });
  return deck;
}

function volumeFor(sound) {
  const channel = sound.channel || sound.parent?.channel || "music";
  const global = game.settings.get("core", VOLUME_SETTINGS[channel] ?? VOLUME_SETTINGS.music);
  return Math.round(Math.min(1, sound.volume * global) * 100);
}

function destroy(key) {
  const entry = players.get(key);
  if (!entry) return;
  entry.player?.destroy?.();
  entry.slot.remove();
  players.delete(key);
  if (!players.size && deck?.rendered) {
    const d = deck;
    deck = null;
    d.close({ animate: false, fvtkAuto: true }).catch(() => {});
  }
}

// Sounds whose player is being created, so overlapping reconciles don't create two.
const creating = new Set();

async function create(sound, yt) {
  const key = sound.uuid;
  await ensureApi();
  const app = await openDeck();
  const slot = document.createElement("div");
  slot.className = "fvtk-yt-slot";
  const target = document.createElement("div");
  slot.append(target);
  const caption = document.createElement("div");
  caption.className = "fvtk-yt-caption";
  caption.textContent = [yt.title, yt.channel].filter(Boolean).join(" · ");
  slot.append(caption);
  app.slots.append(slot);

  const entry = { videoId: yt.videoId, player: null, ready: false, slot };
  players.set(key, entry);
  entry.player = new window.YT.Player(target, {
    ...VIDEO,
    videoId: yt.videoId,
    playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, origin: window.location.origin, start: Math.floor(expectedPosition(yt, game.time.serverTime)) },
    events: {
      onReady: () => {
        entry.ready = true;
        reconcile(fromUuidSync(key));
      },
      onStateChange: event => {
        if (event.data === window.YT.PlayerState.ENDED) onEnded(key);
      },
      onError: event => {
        console.warn(`${MODULE_ID} | YouTube error ${event.data} for ${yt.videoId}`);
        // 101/150: the owner doesn't allow embedding; 100: removed or private.
        if (game.user.isGM) ui.notifications.warn(game.i18n.format("FVTK.YouTube.PlayError", { title: yt.title ?? yt.videoId, code: event.data }));
      }
    }
  });
  return entry;
}

/** Make this client's player for one sound match the sound's state. */
async function reconcile(sound) {
  if (!sound) return;
  const key = sound.uuid;
  const yt = youtubeOf(sound);
  const entry = players.get(key);
  if (!yt || !sound.playing) {
    // Paused keeps the player (so resuming is instant); stopped removes it.
    if (entry && yt && sound.pausedTime != null && entry.ready) entry.player.pauseVideo();
    else if (entry) destroy(key);
    if (!sound.playing) closedFor = new Set([...closedFor].filter(k => !k.startsWith(`${key}:`)));
    return;
  }
  if (closedFor.has(`${key}:${yt.videoId}`)) return;
  if (game.audio.locked) return; // the browser blocks sound until the first click; retried on unlock

  let current = entry;
  if (current && current.videoId !== yt.videoId) {
    destroy(key);
    current = null;
  }
  if (!current) {
    if (creating.has(key)) return;
    creating.add(key);
    try {
      current = await create(sound, yt);
    } finally {
      creating.delete(key);
    }
  }
  if (!current.ready) return; // onReady reconciles again

  const player = current.player;
  player.setVolume(volumeFor(sound));
  const expected = expectedPosition(yt, game.time.serverTime);
  if (Math.abs(player.getCurrentTime() - expected) > DRIFT) player.seekTo(expected, true);
  const state = player.getPlayerState();
  if (state !== window.YT.PlayerState.PLAYING && state !== window.YT.PlayerState.BUFFERING) player.playVideo();
}

function reconcileAll() {
  for (const playlist of game.playlists) {
    for (const sound of playlist.sounds) if (youtubeOf(sound) && (sound.playing || players.has(sound.uuid))) reconcile(sound);
  }
}

/**
 * The user who pressed play, pause or stop records the shared timing. A change that sets
 * pausedTime is a pause; any other stop (including Playlist#stopAll, which leaves an old pausedTime
 * behind) is a stop, and clears pausedTime so every client drops its player.
 */
async function writeTiming(sound, change) {
  const yt = youtubeOf(sound);
  const now = game.time.serverTime;
  if (sound.playing) {
    return sound.update({ [`${FLAG}.startedAt`]: now - (yt.pausedAt ?? 0) * 1000, [`${FLAG}.pausedAt`]: null });
  }
  if (change.pausedTime != null) {
    const entry = players.get(sound.uuid);
    const at = entry?.ready ? entry.player.getCurrentTime() : expectedPosition(yt, now);
    return sound.update({ [`${FLAG}.pausedAt`]: at, [`${FLAG}.startedAt`]: null });
  }
  return sound.update({ pausedTime: null, [`${FLAG}.startedAt`]: null, [`${FLAG}.pausedAt`]: null });
}

/** When a video ends, the active GM moves on, as Foundry does when a normal track ends. */
async function onEnded(key) {
  if (!game.users.activeGM?.isSelf) return;
  const sound = fromUuidSync(key);
  const playlist = sound?.parent;
  if (!playlist || !sound.playing) return;
  const { SEQUENTIAL, SHUFFLE } = CONST.PLAYLIST_MODES;
  if ([SEQUENTIAL, SHUFFLE].includes(playlist.mode)) return playlist.playNext(sound.id);
  if (playlist.mode === CONST.PLAYLIST_MODES.SIMULTANEOUS) {
    // Simultaneous playlists are layers of ambience: loop.
    return sound.update({ [`${FLAG}.startedAt`]: game.time.serverTime, [`${FLAG}.pausedAt`]: null });
  }
  return sound.update({ playing: false, pausedTime: null });
}

export function setupYouTubePlayback() {
  Hooks.on("updatePlaylistSound", (sound, changes, options, userId) => {
    if (youtubeOf(sound) && userId === game.user.id && "playing" in changes) writeTiming(sound, changes);
    reconcile(sound);
  });
  // The playlist's own controls (play, next, stop all) update sounds through the playlist, which
  // fires updatePlaylist rather than updatePlaylistSound.
  Hooks.on("updatePlaylist", (playlist, changes, options, userId) => {
    for (const change of changes.sounds ?? []) {
      const sound = playlist.sounds.get(change._id);
      if (!youtubeOf(sound)) continue;
      if (userId === game.user.id && "playing" in change) writeTiming(sound, change);
      reconcile(sound);
    }
  });
  Hooks.on("createPlaylistSound", sound => reconcile(sound));
  Hooks.on("deletePlaylistSound", sound => destroy(sound.uuid));
  Hooks.on("deletePlaylist", playlist => playlist.sounds.forEach(s => destroy(s.uuid)));
  Hooks.on("clientSettingChanged", key => {
    if (Object.values(VOLUME_SETTINGS).some(s => key === `core.${s}`)) reconcileAll();
  });
  game.audio.unlock.then(() => reconcileAll());
  setInterval(reconcileAll, 5000);
  reconcileAll();
}
