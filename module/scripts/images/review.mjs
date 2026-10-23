import { generateImage } from "./generate.mjs";
import { imageFileName } from "./prompts.mjs";

const MODULE_ID = "foundry-vtt-toolkit";
const escape = s => foundry.utils.escapeHTML(String(s ?? ""));
const t = (key, data) => (data ? game.i18n.format(`FVTK.Images.${key}`, data) : game.i18n.localize(`FVTK.Images.${key}`));
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Create a folder (and its parents) in the user data directory; existing ones are fine. */
async function ensureDirectory(path) {
  const FP = foundry.applications.apps.FilePicker.implementation;
  const parts = path.split("/").filter(Boolean);
  for (let i = 1; i <= parts.length; i++) {
    try {
      await FP.createDirectory("data", parts.slice(0, i).join("/"), { notify: false });
    } catch {
      // Already exists (or a parent we can't create, which the upload will report).
    }
  }
}

/**
 * Window that generates an image for each job, shows them as they arrive, and uploads the ones the
 * GM keeps. Each can be regenerated (with an edited prompt) or left out. With auto-approve it uploads
 * everything that generated and continues on its own.
 */
class ImageReview extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fvtk-image-review",
    classes: ["fvtk", "fvtk-image-review"],
    window: { title: "FVTK.Images.Title", icon: "fa-solid fa-image", resizable: true },
    position: { width: 860, height: 720 },
    actions: {
      regenerate: ImageReview.#onRegenerate,
      finish: ImageReview.#onFinish,
      skipAll: ImageReview.#onSkipAll
    }
  };

  #resolve;
  #running = false;
  #done = false;

  constructor(jobs, options, resolve) {
    super();
    this.jobs = jobs.map(job => ({ ...job, include: true, status: "queued", blob: null, url: null, error: "" }));
    this.settings = options;
    this.#resolve = resolve;
  }

  async _renderHTML() {
    const cards = this.jobs
      .map((job, i) => {
        const picture = job.url
          ? `<img src="${job.url}" alt="">`
          : `<div class="fvtk-img-placeholder">${escape(job.status === "error" ? t("Failed", { message: job.error }) : t(job.status === "generating" ? "Generating" : "Queued"))}</div>`;
        return `<li class="fvtk-img-card${job.include ? "" : " excluded"}" data-job="${i}">
          <div class="fvtk-img-name"><label><input type="checkbox" name="include-${i}" ${job.include ? "checked" : ""}> ${escape(job.entry.name)}</label>
            <small>${escape(job.file)}</small></div>
          ${picture}
          <textarea name="prompt-${i}" rows="3">${escape(job.prompt)}</textarea>
          <button type="button" data-action="regenerate" data-job="${i}" ${job.status === "generating" ? "disabled" : ""}><i class="fa-solid fa-rotate"></i> ${t("Regenerate")}</button>
        </li>`;
      })
      .join("");
    const ready = this.jobs.filter(j => j.include && j.blob).length;
    const pending = this.jobs.filter(j => j.status === "queued" || j.status === "generating").length;
    return `<p class="hint">${t("Hint", { provider: this.settings.provider })}</p>
      <ul class="fvtk-img-grid">${cards}</ul>
      <footer class="fvtk-img-footer">
        <span>${pending ? t("Progress", { done: this.jobs.length - pending, total: this.jobs.length }) : t("AllDone")}</span>
        <button type="button" data-action="skipAll">${t("SkipAll")}</button>
        <button type="button" data-action="finish" ${ready ? "" : "disabled"}><i class="fa-solid fa-upload"></i> ${t("Upload", { count: ready })}</button>
      </footer>`;
  }

  _replaceHTML(result, content) {
    const scroll = content.querySelector(".fvtk-img-grid")?.scrollTop ?? 0;
    content.innerHTML = result;
    const grid = content.querySelector(".fvtk-img-grid");
    if (grid) grid.scrollTop = scroll;
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.#run();
  }

  /** Keep edits to prompts and checkboxes across re-renders. */
  #readInputs() {
    this.jobs.forEach((job, i) => {
      const prompt = this.element?.querySelector(`textarea[name="prompt-${i}"]`);
      const include = this.element?.querySelector(`input[name="include-${i}"]`);
      if (prompt) job.prompt = prompt.value;
      if (include) job.include = include.checked;
    });
  }

  async #refresh() {
    if (!this.rendered) return;
    this.#readInputs();
    await this.render();
  }

  /** Generate queued images one at a time. */
  async #run() {
    if (this.#running) return;
    this.#running = true;
    try {
      let job;
      while (!this.#done && (job = this.jobs.find(j => j.status === "queued"))) {
        job.status = "generating";
        await this.#refresh();
        try {
          const blob = await generateImage(job.prompt, this.settings);
          if (job.url) URL.revokeObjectURL(job.url);
          job.blob = blob;
          job.url = URL.createObjectURL(blob);
          job.status = "done";
        } catch (err) {
          console.warn(`${MODULE_ID} | Image generation failed for ${job.entry.name}`, err);
          job.status = "error";
          job.error = err.message;
        }
        await this.#refresh();
      }
    } finally {
      this.#running = false;
    }
    if (!this.#done && this.settings.autoApprove && this.jobs.every(j => j.status === "done" || j.status === "error")) this.#finish();
  }

  static #onRegenerate(event, target) {
    this.#readInputs();
    const job = this.jobs[Number(target.dataset.job)];
    job.status = "queued";
    job.error = "";
    this.render();
    this.#run();
  }

  static #onFinish() {
    this.#readInputs();
    this.#finish();
  }

  static #onSkipAll() {
    this.#complete({ paths: [], skipped: this.jobs.map(j => j.entry.name) });
  }

  async #finish() {
    if (this.#done) return;
    this.#done = true;
    const keep = this.jobs.filter(j => j.include && j.blob);
    const paths = [];
    const skipped = this.jobs.filter(j => !keep.includes(j)).map(j => j.entry.name);
    if (keep.length) {
      await ensureDirectory(this.settings.folder);
      const FP = foundry.applications.apps.FilePicker.implementation;
      for (const job of keep) {
        const name = job.file.replace(/\.\w+$/, `.${EXTENSIONS[job.blob.type] ?? "jpg"}`);
        try {
          const result = await FP.upload("data", this.settings.folder, new File([job.blob], name, { type: job.blob.type }), {}, { notify: false });
          paths.push(result?.path ?? `${this.settings.folder}/${name}`);
        } catch (err) {
          console.error(`${MODULE_ID} | Upload failed for ${name}`, err);
          skipped.push(job.entry.name);
        }
      }
    }
    this.#complete({ paths, skipped });
  }

  #complete(result) {
    this.#done = true;
    const resolve = this.#resolve;
    this.#resolve = null;
    resolve?.(result);
    this.close();
  }

  async _onClose(options) {
    await super._onClose(options);
    this.#done = true;
    for (const job of this.jobs) if (job.url) URL.revokeObjectURL(job.url);
    this.#resolve?.({ paths: [], skipped: this.jobs.map(j => j.entry.name) });
    this.#resolve = null;
  }
}

/**
 * Generate, review and upload scene images.
 * @param {{entry: object, prompt: string}[]} jobs
 * @param {{provider: string, url?: string, token?: string, folder: string, autoApprove?: boolean}} options
 * @returns {Promise<{paths: string[], skipped: string[]}>} Uploaded image paths and entries left without one.
 */
export function generateSceneImages(jobs, options) {
  return new Promise(resolve => {
    const named = jobs.map(job => ({ ...job, file: imageFileName(job.entry.name) }));
    new ImageReview(named, options, resolve).render({ force: true });
  });
}
