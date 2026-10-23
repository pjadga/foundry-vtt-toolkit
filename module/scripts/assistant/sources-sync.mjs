/**
 * The GM Assistant's source library: files in a Foundry folder (default worlds/<world>/sources, with
 * any subfolders), kept in step with a Gemini File Search store that the assistant searches when it
 * answers. The store is found by its display name, so any browser with the same Gemini key uses it.
 */
import { classify, relativePath, fingerprint, documentMeta, syncPlan } from "./sources.mjs";
import { findStore, findOrCreateStore, listDocuments, uploadDocument, deleteDocument, deleteStore } from "./filesearch.mjs";
import { ensureDirectory } from "../images/review.mjs";

const MODULE_ID = "foundry-vtt-toolkit";
const escape = s => foundry.utils.escapeHTML(String(s ?? ""));
const t = (key, data) => (data ? game.i18n.format(`FVTK.Sources.${key}`, data) : game.i18n.localize(`FVTK.Sources.${key}`));
const geminiKey = () => game.settings.get(MODULE_ID, "geminiApiKey").trim();

export const storeDisplayName = () => `Foundry VTT Toolkit sources: ${game.world.id}`;
export const sourcesFolder = () => game.settings.get(MODULE_ID, "sourcesFolder").trim() || `worlds/${game.world.id}/sources`;

// The world's store ({name, ...}), null once we know there is none, undefined until looked up.
let store;

/** The world's File Search store, looked up once per session; null if there is none. */
export async function currentStore() {
  const key = geminiKey();
  if (!key) return null;
  if (store === undefined) {
    try {
      store = await findStore(key, storeDisplayName());
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not look up the sources store`, err);
      return null;
    }
  }
  return store;
}

/** The store to search when answering, or null when sources are off or there is no store. */
export async function searchStore() {
  return game.settings.get(MODULE_ID, "assistantUseSources") ? currentStore() : null;
}

/**
 * The searchable files in the sources folder and its subfolders, with fingerprints from the file
 * server, and the files that can't be used and why.
 */
export async function sourceFiles(folder = sourcesFolder()) {
  const FP = foundry.applications.apps.FilePicker.implementation;
  const files = [];
  const skipped = [];
  let exists = true;
  const walk = async dir => {
    let result;
    try {
      result = await FP.browse("data", dir);
    } catch {
      if (dir === folder) exists = false;
      return;
    }
    for (const path of result.files) {
      const rel = relativePath(path, folder);
      try {
        const head = await fetch(foundry.utils.getRoute(path), { method: "HEAD" });
        const size = Number(head.headers.get("content-length"));
        const kind = classify(path, size);
        // path: where it is in the sources folder (what the store records); url: where Foundry serves it.
        if (kind.ok) files.push({ path: rel, url: path, mime: kind.mime, size, fingerprint: fingerprint(size, head.headers.get("last-modified")) });
        else skipped.push({ rel, reason: kind.reason });
      } catch (err) {
        skipped.push({ rel, reason: err.message });
      }
    }
    for (const sub of result.dirs) await walk(sub);
  };
  await walk(folder);
  return { files, skipped, exists };
}

/**
 * Bring the store in step with the folder: upload new files, replace changed ones (new copy first,
 * then the old one is deleted), remove documents whose file is gone. Shows a progress bar.
 * @returns {Promise<{uploaded: string[], replaced: string[], removed: string[], unchanged: number, skipped: {rel: string, reason: string}[], failed: {rel: string, message: string}[]}>}
 */
export async function syncSources(folder = sourcesFolder()) {
  const key = geminiKey();
  if (!key) throw new Error(t("NoKey"));
  const { files, skipped } = await sourceFiles(folder);
  const report = { uploaded: [], replaced: [], removed: [], unchanged: 0, skipped, failed: [] };
  const existing = await currentStore();
  if (!files.length && !existing) return report;
  store = existing ?? (await findOrCreateStore(key, storeDisplayName()));
  const remote = (await listDocuments(key, store.name)).map(documentMeta);
  const plan = syncPlan(files, remote);
  report.unchanged = plan.unchanged.length;
  const steps = plan.upload.length + plan.replace.length + plan.remove.length;
  if (!steps) return report;

  const progress = ui.notifications.info(t("Syncing", { count: steps }), { progress: true });
  let done = 0;
  const step = message => progress?.update?.({ pct: done / steps, message });
  const upload = async file => {
    const response = await fetch(foundry.utils.getRoute(file.url));
    if (!response.ok) throw new Error(`Foundry couldn't read the file (${response.status})`);
    const blob = await response.blob();
    const top = file.path.includes("/") ? file.path.split("/")[0] : "";
    return uploadDocument(key, store.name, { blob, mime: file.mime, displayName: file.path.split("/").pop(), metadata: { path: file.path, fingerprint: file.fingerprint, ...(top ? { group: top } : {}) } });
  };
  for (const file of plan.upload) {
    step(t("Uploading", { name: file.path }));
    try {
      await upload(file);
      report.uploaded.push(file.path);
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not upload ${file.path}`, err);
      report.failed.push({ rel: file.path, message: err.message });
    }
    done++;
  }
  for (const { file, doc } of plan.replace) {
    step(t("Uploading", { name: file.path }));
    try {
      await upload(file);
      await deleteDocument(key, doc.name);
      report.replaced.push(file.path);
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not replace ${file.path}`, err);
      report.failed.push({ rel: file.path, message: err.message });
    }
    done++;
  }
  for (const doc of plan.remove) {
    step(t("Removing", { name: doc.path }));
    try {
      await deleteDocument(key, doc.name);
      report.removed.push(doc.path);
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not remove ${doc.path}`, err);
      report.failed.push({ rel: doc.path, message: err.message });
    }
    done++;
  }
  progress?.update?.({ pct: 1 });
  return report;
}

/** Delete the world's store and everything in it from Gemini. */
export async function removeSources() {
  const existing = await currentStore();
  if (existing) await deleteStore(geminiKey(), existing.name);
  store = null;
}

const listHTML = (items, line) => (items.length ? `<ul>${items.map(i => `<li>${line(i)}</li>`).join("")}</ul>` : "");

/** Show what a sync did, when anything needs reading. */
async function showReport(report) {
  const f = (k, d) => escape(t(k, d));
  const summary = f("Report", { uploaded: report.uploaded.length, replaced: report.replaced.length, removed: report.removed.length, unchanged: report.unchanged });
  if (!report.failed.length && !report.skipped.length) return ui.notifications.info(summary);
  await foundry.applications.api.DialogV2.prompt({
    window: { title: t("Title") },
    position: { width: 560 },
    content: `<div class="fvtk fvtk-sources"><p>${summary}</p>
      ${report.failed.length ? `<p><strong>${f("FailedList")}</strong></p>${listHTML(report.failed, i => `${escape(i.rel)}: ${escape(i.message)}`)}` : ""}
      ${report.skipped.length ? `<p><strong>${f("SkippedList")}</strong></p>${listHTML(report.skipped, i => `${escape(i.rel)}: ${escape(i.reason)}`)}` : ""}</div>`,
    rejectClose: false
  });
}

/**
 * The Sources dialog: where the files go, what is synced, and Sync now / Add files / Remove from
 * Gemini. GM only.
 * @param {() => void} [onChange] Called after anything changed, e.g. to refresh the assistant window.
 */
export async function openSources(onChange = () => {}) {
  if (!game.user.isGM) return;
  const key = geminiKey();
  if (!key) return ui.notifications.warn(t("NoKey"));
  const folder = sourcesFolder();
  const [local, existing] = await Promise.all([sourceFiles(folder), currentStore()]);
  let remote = [];
  try {
    remote = existing ? (await listDocuments(key, existing.name)).map(documentMeta) : [];
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not list the sources store`, err);
  }
  const plan = syncPlan(local.files, remote);
  const changes = plan.upload.length + plan.replace.length + plan.remove.length;
  const mb = Math.round(local.files.reduce((n, f) => n + f.size, 0) / 1024 / 1024);
  const f = (k, d) => escape(t(k, d));

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: t("Title"), icon: "fa-solid fa-book" },
    position: { width: 600 },
    content: `<div class="fvtk fvtk-sources">
      <p>${f("Intro")}</p>
      <label>${f("Folder")} <file-picker name="folder" type="folder" value="${escape(folder)}"></file-picker></label>
      <ul>
        <li>${local.exists ? f("LocalFiles", { count: local.files.length, mb }) : f("NoFolder")}${local.skipped.length ? ` ${f("Unusable", { count: local.skipped.length })}` : ""}</li>
        <li>${existing ? f("Synced", { count: remote.length }) : f("NotSynced")}</li>
        <li>${changes ? f("Changes", { upload: plan.upload.length, replace: plan.replace.length, remove: plan.remove.length }) : f("UpToDate")}</li>
      </ul>
      <label><input type="checkbox" name="use" ${game.settings.get(MODULE_ID, "assistantUseSources") ? "checked" : ""}> ${f("Use")}</label>
      <p class="hint">${f("Hint")}</p>
    </div>`,
    buttons: [
      { action: "sync", label: changes ? t("SyncN", { count: changes }) : t("Sync"), icon: "fa-solid fa-rotate", default: true, callback: (event, button) => readForm(button.form, "sync") },
      { action: "add", label: t("Add"), icon: "fa-solid fa-upload", callback: (event, button) => readForm(button.form, "add") },
      ...(existing ? [{ action: "remove", label: t("Remove"), icon: "fa-solid fa-trash", callback: (event, button) => readForm(button.form, "remove") }] : []),
      { action: "close", label: t("Close"), callback: (event, button) => readForm(button.form, "close") }
    ],
    rejectClose: false
  });
  if (!choice) return;
  await game.settings.set(MODULE_ID, "sourcesFolder", choice.folder === `worlds/${game.world.id}/sources` ? "" : choice.folder);
  await game.settings.set(MODULE_ID, "assistantUseSources", choice.use);
  onChange();

  if (choice.action === "sync") {
    try {
      await showReport(await syncSources(choice.folder));
    } catch (err) {
      console.error(`${MODULE_ID} | Source sync failed`, err);
      ui.notifications.error(t("SyncFailed", { message: err.message }));
    }
    onChange();
  } else if (choice.action === "add") {
    await ensureDirectory(choice.folder);
    const FP = foundry.applications.apps.FilePicker.implementation;
    new FP({ type: "any", current: choice.folder }).render({ force: true });
  } else if (choice.action === "remove") {
    const confirmed = await foundry.applications.api.DialogV2.confirm({ window: { title: t("Remove") }, content: `<p>${f("RemoveConfirm", { count: remote.length })}</p>`, rejectClose: false });
    if (!confirmed) return;
    try {
      await removeSources();
      ui.notifications.info(t("Removed"));
    } catch (err) {
      ui.notifications.error(t("SyncFailed", { message: err.message }));
    }
    onChange();
  }
}

function readForm(form, action) {
  const folder = form.querySelector("file-picker[name=folder]")?.value?.trim().replace(/\/+$/, "") || `worlds/${game.world.id}/sources`;
  return { action, folder, use: form.elements.use.checked };
}
