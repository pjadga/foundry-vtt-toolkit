const MODULE_ID = "foundry-vtt-toolkit";
const ROOT_FOLDER = "NotebookLM";
const PACK_NAME = "notebooklm-campaigns";
const escape = s => foundry.utils.escapeHTML(String(s ?? ""));
const t = (key, data) => (data ? game.i18n.format(`FVTK.Adventure.${key}`, data) : game.i18n.localize(`FVTK.Adventure.${key}`));

// Adventure fields, and the world collection each is packed from.
const CONTENTS = { scenes: "scenes", actors: "actors", items: "items", journal: "journal", playlists: "playlists" };

/** A NotebookLM folder: the root folder of a document type, or anything inside one. */
function inCampaignFolder(folder) {
  if (!folder) return false;
  return [folder, ...folder.ancestors].some(f => f.name === ROOT_FOLDER && !f.folder);
}

/**
 * Everything a NotebookLM build made, or that sits in its folders: scenes, actors, items, journals,
 * playlists and the folders themselves.
 */
export function campaignDocuments() {
  const ours = d => d.flags[MODULE_ID]?.source === "notebooklm" || inCampaignFolder(d.folder);
  const out = { folders: game.folders.filter(inCampaignFolder) };
  for (const [field, collection] of Object.entries(CONTENTS)) out[field] = game[collection].filter(ours);
  return out;
}

/** The world's Adventure compendium for packed campaigns, created on first use. */
async function campaignPack() {
  const existing = game.packs.get(`world.${PACK_NAME}`);
  if (existing) return existing;
  const { CompendiumCollection } = foundry.documents.collections;
  return CompendiumCollection.createCompendium({ type: "Adventure", name: PACK_NAME, label: t("PackLabel") });
}

/**
 * Pack the campaign into an Adventure in the world compendium "NotebookLM Campaigns", replacing an
 * adventure of the same name. Documents keep their ids, so links, scene tokens and journal pins still
 * work when the adventure is imported into another world. Images stay where they are (paths in the
 * user data folder), so that world must be on the same server, or the images copied with it.
 * @param {string} name
 * @param {ReturnType<typeof campaignDocuments>} [docs] What to pack; the whole campaign by default.
 * @returns {Promise<Adventure>}
 */
export async function packAdventure(name, docs = campaignDocuments()) {
  const pack = await campaignPack();
  const story = docs.scenes.filter(s => s.flags[MODULE_ID]?.type === "scene").sort((a, b) => a.sort - b.sort);
  const counts = Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, v.length]));
  const data = {
    name,
    img: (story[0] ?? docs.scenes[0])?.background.src ?? null,
    caption: t("Caption", { world: game.world.title }),
    // Story scene names are already numbered.
    description: `<p>${escape(t("Description", counts))}</p>${story.length ? `<ul>${story.map(s => `<li>${escape(s.name)}</li>`).join("")}</ul>` : ""}`,
    flags: { [MODULE_ID]: { source: "notebooklm", packed: Date.now() } }
  };
  for (const [field, list] of Object.entries(docs)) data[field] = list.map(d => d.toObject());

  await pack.getIndex();
  const old = pack.index.filter(i => i.name === name).map(i => i._id);
  if (old.length) await Adventure.deleteDocuments(old, { pack: pack.collection });
  return Adventure.create(data, { pack: pack.collection });
}

/** Whether an adventure holds every one of these documents. */
function holdsAll(adventure, docs) {
  // An adventure's contents are Sets of documents, not collections keyed by id.
  return Object.entries(docs).every(([field, list]) => {
    const ids = new Set([...(adventure[field] ?? [])].map(d => d.id));
    return list.every(d => ids.has(d.id));
  });
}

/**
 * Remove the campaign from the world, e.g. after packing it, to start a new one: its scenes,
 * actors, items, journals, playlists (stopped first) and NotebookLM folders. Image files stay.
 * @param {ReturnType<typeof campaignDocuments>} [docs]
 */
export async function clearCampaign(docs = campaignDocuments()) {
  for (const playlist of docs.playlists) if (playlist.playing) await playlist.stopAll();
  const classes = { scenes: Scene, actors: Actor, items: Item, journal: JournalEntry, playlists: Playlist };
  for (const [field, cls] of Object.entries(classes)) {
    const ids = docs[field].map(d => d.id).filter(id => game[CONTENTS[field]].has(id));
    if (ids.length) await cls.deleteDocuments(ids);
  }
  // Deepest first, so no folder is deleted before its subfolders.
  const folders = docs.folders.filter(f => game.folders.has(f.id)).sort((a, b) => b.ancestors.length - a.ancestors.length);
  if (folders.length) await Folder.deleteDocuments(folders.map(f => f.id));
}

/** Ask for a name, then pack the campaign, and optionally clear it from the world. GM only. */
export async function openPacker() {
  if (!game.user.isGM) return;
  const docs = campaignDocuments();
  const total = Object.entries(docs).filter(([k]) => k !== "folders").reduce((n, [, v]) => n + v.length, 0);
  if (!total) return ui.notifications.warn(t("Nothing"));
  const counts = Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, v.length]));
  const input = await foundry.applications.api.DialogV2.prompt({
    window: { title: t("Title") },
    position: { width: 480 },
    content: `<div class="fvtk"><p>${escape(t("Description", counts))}</p><p>${escape(t("Hint"))}</p>
      <label>${escape(t("Name"))} <input type="text" name="name" value="${escape(game.world.title)}" required></label>
      <label><input type="checkbox" name="clear"> ${escape(t("Clear"))}</label></div>`,
    ok: {
      label: t("Pack"),
      icon: "fa-solid fa-box-archive",
      callback: (event, button) => ({ name: button.form.elements.name.value.trim(), clear: button.form.elements.clear.checked })
    },
    rejectClose: false
  });
  if (!input?.name) return;
  let adventure;
  try {
    adventure = await packAdventure(input.name, docs);
    ui.notifications.info(t("Done", { name: adventure.name, pack: adventure.compendium?.metadata.label ?? PACK_NAME }));
  } catch (err) {
    console.error(`${MODULE_ID} | Packing the campaign failed`, err);
    return ui.notifications.error(t("Failed", { message: err.message }));
  }
  if (!input.clear) return adventure;
  // Only clear what the adventure demonstrably holds, and only after the GM confirms.
  if (!holdsAll(adventure, docs)) return ui.notifications.error(t("ClearIncomplete"));
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: t("ClearTitle") },
    content: `<div class="fvtk"><p>${escape(t("ClearConfirm", { ...counts, name: adventure.name }))}</p></div>`,
    rejectClose: false
  });
  if (!confirmed) return adventure;
  await clearCampaign(docs);
  ui.notifications.info(t("Cleared", { name: adventure.name }));
  return adventure;
}
