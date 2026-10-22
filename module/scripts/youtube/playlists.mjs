import { trackLines } from "./youtube.mjs";

const MODULE_ID = "foundry-vtt-toolkit";

/**
 * NotebookLM "playlist" entry -> Foundry playlist with the mood and description, and the track
 * lines kept in flags for the YouTube picker (see picker.mjs) to search. Replacing an existing
 * playlist updates it in place, so tracks already picked are kept.
 */
export async function importPlaylist(entry, ctx) {
  const tracks = trackLines(entry.fields.tracks);
  const mood = entry.fields.mood ?? "";
  const description = ctx.notes({ public: [mood && `**Mood:** ${mood}`, entry.body].filter(Boolean).join("\n\n"), secret: "" });
  const flags = foundry.utils.mergeObject(ctx.flags, { [MODULE_ID]: { tracks, mood } }, { inplace: false });
  if (ctx.existing) {
    await ctx.existing.update({ name: entry.name, description, flags });
    return ctx.existing;
  }
  return Playlist.create(
    { _id: ctx.id, name: entry.name, folder: ctx.folder.id, mode: CONST.PLAYLIST_MODES.SEQUENTIAL, description, flags },
    { keepId: true }
  );
}
