import { generateImage, POLLINATIONS_GAP_MS } from "./generate.mjs";
import { imageFileName, pasteTarget, fitWithin, chatImageRequest, zoomAt } from "./prompts.mjs";

const MODULE_ID = "foundry-vtt-toolkit";
const escape = s => foundry.utils.escapeHTML(String(s ?? ""));
const t = (key, data) => (data ? game.i18n.format(`FVTK.Images.${key}`, data) : game.i18n.localize(`FVTK.Images.${key}`));
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Create a folder (and its parents) in the user data directory; existing ones are fine. */
export async function ensureDirectory(path) {
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
 * A pasted or dropped image, as WebP no larger than 2560 px on its longer side (a ChatGPT PNG is a
 * few MB). Returns the original if the browser can't convert it or the result isn't smaller.
 */
async function compactImage(blob) {
  try {
    const bitmap = await createImageBitmap(blob);
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const webp = await canvas.convertToBlob({ type: "image/webp", quality: 0.88 });
    return webp.type === "image/webp" && webp.size < blob.size ? webp : blob;
  } catch {
    return blob;
  }
}

/**
 * Make an image in `stage` zoomable: it starts fitted; the mouse wheel zooms around the pointer,
 * dragging pans, and a double-click fits it again. `stage` clips the image and takes the events.
 */
function zoomable(stage, img, helpText) {
  const doc = stage.ownerDocument;
  stage.style.position ||= "relative";
  stage.style.overflow = "hidden";
  stage.style.cursor = "grab";
  stage.style.background = "#111";
  img.draggable = false;
  img.style.cssText = "position:absolute;top:0;left:0;max-width:none;max-height:none;width:auto;height:auto;border:none;transform-origin:0 0;user-select:none";
  const help = doc.createElement("div");
  help.textContent = helpText;
  help.style.cssText = "position:absolute;bottom:8px;left:8px;padding:4px 8px;font:12px sans-serif;color:#ddd;background:rgba(0,0,0,0.6);border-radius:4px;pointer-events:none";
  stage.append(img, help);
  let scale = 1, x = 0, y = 0, drag = null;
  const draw = () => (img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`);
  const point = event => {
    const box = stage.getBoundingClientRect();
    return [event.clientX - box.left, event.clientY - box.top];
  };
  const fit = () => {
    if (!img.naturalWidth) return;
    const { clientWidth: w, clientHeight: h } = stage;
    scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    x = (w - img.naturalWidth * scale) / 2;
    y = (h - img.naturalHeight * scale) / 2;
    draw();
  };
  img.addEventListener("load", fit);
  new (doc.defaultView.ResizeObserver)(fit).observe(stage);
  stage.addEventListener("dblclick", fit);
  stage.addEventListener("wheel", event => {
    event.preventDefault();
    const [px, py] = point(event);
    ({ scale, x, y } = zoomAt({ scale, x, y }, px, py, event.deltaY < 0));
    draw();
  }, { passive: false });
  stage.addEventListener("pointerdown", event => {
    drag = { px: event.clientX, py: event.clientY, x, y };
    stage.setPointerCapture?.(event.pointerId);
    stage.style.cursor = "grabbing";
  });
  stage.addEventListener("pointermove", event => {
    if (!drag) return;
    x = drag.x + event.clientX - drag.px;
    y = drag.y + event.clientY - drag.py;
    draw();
  });
  const stop = () => {
    drag = null;
    stage.style.cursor = "grab";
  };
  stage.addEventListener("pointerup", stop);
  stage.addEventListener("pointercancel", stop);
  if (img.complete) fit();
}

/** Foundry window with a zoomable image, for when the browser blocks a separate window. */
class ImageViewer extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["fvtk", "fvtk-image-viewer"],
    window: { icon: "fa-solid fa-magnifying-glass-plus", resizable: true },
    position: { width: 1000, height: 620 }
  };

  constructor(url, title) {
    super({ window: { title } });
    this.url = url;
  }

  async _renderHTML() {
    return "";
  }

  _replaceHTML(result, content) {
    if (content.firstChild) return;
    const stage = document.createElement("div");
    stage.style.cssText = "width:100%;height:100%";
    const img = document.createElement("img");
    img.src = this.url;
    img.alt = this.options.window.title;
    content.style.padding = "0";
    content.append(stage);
    zoomable(stage, img, t("ViewerHelp"));
  }
}

/**
 * Show an image in a separate browser window, zoomable (see `zoomable`). If the browser blocks the
 * window, a Foundry window does the same.
 */
export function openImageViewer(url, title) {
  const win = window.open("", "", "width=1280,height=760,resizable=yes");
  if (!win) return new ImageViewer(url, title).render({ force: true });
  const doc = win.document;
  doc.title = title;
  doc.body.style.cssText = "margin:0;height:100vh";
  const img = doc.createElement("img");
  img.src = url;
  img.alt = title;
  zoomable(doc.body, img, t("ViewerHelp"));
  return win;
}

/** The first image file in a paste or drop, or null. */
function imageFile(transfer) {
  for (const item of transfer?.items ?? []) if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  return [...(transfer?.files ?? [])].find(f => f.type.startsWith("image/")) ?? null;
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
      pollinations: ImageReview.#onPollinations,
      viewImage: ImageReview.#onViewImage,
      finish: ImageReview.#onFinish,
      skipAll: ImageReview.#onSkipAll,
      copyPrompt: ImageReview.#onCopyPrompt,
      pasteImage: ImageReview.#onPasteImage
    }
  };

  #resolve;
  #running = false;
  #done = false;
  #hovered = -1;

  constructor(jobs, options, resolve) {
    super();
    this.settings = options;
    // "manual": the GM pastes every image (from ChatGPT or any other tool); nothing is generated.
    this.manual = options.provider === "manual";
    this.jobs = jobs.map(job => ({ ...job, include: true, status: this.manual ? "waiting" : "queued", blob: null, url: null, error: "", pasted: false, run: 0 }));
    this.#resolve = resolve;
  }

  async _renderHTML() {
    const cards = this.jobs
      .map((job, i) => {
        const picture = job.url
          ? `<img src="${job.url}" alt="" data-action="viewImage" data-job="${i}" data-tooltip="${escape(t("ViewHint"))}">`
          : `<div class="fvtk-img-placeholder">${escape(job.status === "error" ? t("Failed", { message: job.error }) : t(job.status === "generating" ? "Generating" : !job.include ? "LeftOut" : job.status === "waiting" ? "PasteHere" : "Queued"))}</div>`;
        const busy = job.status === "generating" ? "disabled" : "";
        const regenerate = this.manual ? "" : `<button type="button" data-action="regenerate" data-job="${i}" ${busy}><i class="fa-solid fa-rotate"></i> ${t("Regenerate")}</button>`;
        // Pollinations as a free stand-in for one card, unless it is already the generator.
        const pollinations = this.settings.provider === "pollinations" ? "" : `<button type="button" data-action="pollinations" data-job="${i}" ${busy} data-tooltip="${escape(t("PollinationsHint"))}"><i class="fa-solid fa-wand-magic-sparkles"></i> ${t("Pollinations")}</button>`;
        return `<li class="fvtk-img-card${job.include ? "" : " excluded"}" data-job="${i}" tabindex="0">
          <div class="fvtk-img-name"><label><input type="checkbox" name="include-${i}" ${job.include ? "checked" : ""}> ${escape(job.entry.name)}</label>
            <small>${escape(job.file)}</small></div>
          ${picture}
          ${job.fallback ? `<p class="fvtk-img-fallback">${escape(t("Fallback", { message: job.fallback }))}</p>` : ""}
          ${job.pasted ? `<p class="fvtk-img-fallback">${escape(t("Pasted"))}</p>` : ""}
          <textarea name="prompt-${i}" rows="3">${escape(job.prompt)}</textarea>
          <div class="fvtk-img-buttons">
            <button type="button" data-action="copyPrompt" data-job="${i}" data-tooltip="${escape(t("CopyPromptHint"))}"><i class="fa-solid fa-copy"></i> ${t("CopyPrompt")}</button>
            <button type="button" data-action="pasteImage" data-job="${i}" data-tooltip="${escape(t("PasteHint"))}"><i class="fa-solid fa-paste"></i> ${t("Paste")}</button>
            ${regenerate}
            ${pollinations}
          </div>
        </li>`;
      })
      .join("");
    const ready = this.jobs.filter(j => j.include && j.blob).length;
    // An unticked image that hasn't started isn't generated, so it isn't waited for either.
    const pending = this.jobs.filter(j => (j.status === "queued" && j.include) || j.status === "generating").length;
    const done = this.jobs.filter(j => j.status === "done").length;
    const failed = this.jobs.filter(j => j.status === "error").length;
    const waiting = this.jobs.filter(j => j.include && j.status === "waiting").length;
    let progress = pending || waiting ? t("Progress", { done, total: this.jobs.length }) : t(failed ? "Finished" : "AllDone", { failed });
    if (pending && failed) progress += ` ${t("FailedCount", { failed })}`;
    // Pollinations' free tier makes one image every 45 seconds, so say how long the wait is.
    const onPollinations = this.jobs.filter(j => ((j.status === "queued" && j.include) || j.status === "generating") && (j.provider ?? this.settings.provider) === "pollinations").length;
    const slow = onPollinations > 1 ? ` ${t("Slow", { minutes: Math.ceil((onPollinations * POLLINATIONS_GAP_MS) / 60_000) })}` : "";
    // Gemini bills every image, regenerations included.
    const cost = this.settings.provider === "gemini" ? ` ${t("GeminiCost")}` : this.settings.provider === "openai" ? ` ${t("OpenAICost")}` : "";
    const hint = this.manual ? t("HintManual") : `${t("Hint", { provider: this.settings.provider })} ${t("HintPaste")}`;
    return `<p class="hint">${hint}${slow}${cost}</p>
      <ul class="fvtk-img-grid">${cards}</ul>
      <footer class="fvtk-img-footer">
        <span>${progress}</span>
        <button type="button" data-action="skipAll">${t("SkipAll")}</button>
        <button type="button" data-action="finish" ${ready ? "" : "disabled"}><i class="fa-solid fa-upload"></i> ${t("Upload", { count: ready })}</button>
      </footer>`;
  }

  _replaceHTML(result, content) {
    const scroll = content.querySelector(".fvtk-img-grid")?.scrollTop ?? 0;
    // Re-rendering replaces the inputs, so put the cursor back where the GM was typing.
    const active = content.contains(document.activeElement) ? document.activeElement : null;
    const focus = active?.name ? { name: active.name, start: active.selectionStart, end: active.selectionEnd, top: active.scrollTop } : null;
    content.innerHTML = result;
    const grid = content.querySelector(".fvtk-img-grid");
    if (grid) grid.scrollTop = scroll;
    const again = focus && content.querySelector(`[name="${focus.name}"]`);
    if (again) {
      again.focus({ preventScroll: true });
      if (typeof focus.start === "number") again.setSelectionRange?.(focus.start, focus.end);
      again.scrollTop = focus.top;
    }
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // Unticking a card updates the upload count straight away.
    this.element.querySelectorAll('input[type="checkbox"][name^="include-"]').forEach(box =>
      box.addEventListener("change", async () => {
        await this.#refresh();
        this.#run(); // ticking one back on queues it again
      })
    );
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    const cardOf = target => target?.closest?.(".fvtk-img-card");
    const indexOf = card => (card ? Number(card.dataset.job) : -1);
    // The card under the pointer is where Ctrl+V goes, unless a card has focus.
    this.element.addEventListener("pointerover", event => (this.#hovered = indexOf(cardOf(event.target))));
    this.element.addEventListener("pointerleave", () => (this.#hovered = -1));
    this.element.addEventListener("paste", event => {
      const file = imageFile(event.clipboardData);
      if (!file) return; // text pasted into a prompt
      event.preventDefault();
      const focused = indexOf(cardOf(document.activeElement));
      this.#useImage(pasteTarget(this.jobs, focused >= 0 ? focused : this.#hovered), file);
    });
    this.element.addEventListener("dragover", event => {
      if (!cardOf(event.target)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    });
    this.element.addEventListener("drop", async event => {
      const index = indexOf(cardOf(event.target));
      if (index < 0) return;
      event.preventDefault();
      let file = imageFile(event.dataTransfer);
      // An image dragged from another tab arrives as a link; fetch it if its site allows that.
      const url = !file && (event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain"));
      if (url && /^https?:/.test(url)) {
        try {
          const blob = await (await fetch(url)).blob();
          if (blob.type.startsWith("image/")) file = blob;
        } catch {
          // Cross-site images usually can't be fetched.
        }
      }
      if (file) this.#useImage(index, file);
      else ui.notifications.warn(t("DropFailed"));
    });
    this.#run();
  }

  /** Put a pasted or dropped image on a card; it replaces anything generated or generating there. */
  async #useImage(index, file) {
    const job = this.jobs[index];
    if (!job) return ui.notifications.info(t("NoCard"));
    this.#readInputs();
    job.run++; // a generation still running for this card is discarded when it finishes
    const blob = await compactImage(file);
    if (job.url) URL.revokeObjectURL(job.url);
    Object.assign(job, { blob, url: URL.createObjectURL(blob), status: "done", include: true, error: "", fallback: "", pasted: true });
    await this.render();
  }

  static async #onCopyPrompt(event, target) {
    this.#readInputs();
    const job = this.jobs[Number(target.dataset.job)];
    const request = chatImageRequest(job.entry.name, job.prompt);
    try {
      await navigator.clipboard.writeText(request);
      ui.notifications.info(t("PromptCopied", { name: job.entry.name }));
    } catch {
      game.clipboard?.copyPlainText?.(request);
    }
  }

  static async #onPasteImage(event, target) {
    const index = Number(target.dataset.job);
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find(ty => ty.startsWith("image/"));
        if (type) return this.#useImage(index, await item.getType(type));
      }
      ui.notifications.warn(t("ClipboardEmpty"));
    } catch (err) {
      console.warn(`${MODULE_ID} | Clipboard read failed`, err);
      ui.notifications.warn(t("ClipboardBlocked"));
    }
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
      while (!this.#done && (job = this.jobs.find(j => j.status === "queued" && j.include))) {
        job.status = "generating";
        job.pasted = false;
        await this.#refresh();
        job.fallback = "";
        const run = ++job.run;
        try {
          const blob = await generateImage(job.prompt, { ...this.settings, provider: job.provider ?? this.settings.provider, onFallback: reason => (job.fallback = reason) });
          if (run !== job.run) continue; // an image was pasted meanwhile
          if (job.url) URL.revokeObjectURL(job.url);
          job.blob = blob;
          job.url = URL.createObjectURL(blob);
          job.status = "done";
        } catch (err) {
          if (run !== job.run) continue;
          console.warn(`${MODULE_ID} | Image generation failed for ${job.entry.name}`, err);
          job.status = "error";
          job.error = err.message;
        }
        await this.#refresh();
      }
    } finally {
      this.#running = false;
    }
    if (!this.#done && this.settings.autoApprove && this.jobs.every(j => j.status === "done" || j.status === "error" || !j.include)) this.#finish();
  }

  static #onRegenerate(event, target) {
    this.#readInputs();
    const job = this.jobs[Number(target.dataset.job)];
    job.status = "queued";
    job.error = "";
    job.provider = undefined;
    this.render();
    this.#run();
  }

  /** Open a card's image in its own browser window, where it can be zoomed and panned. */
  static #onViewImage(event, target) {
    const job = this.jobs[Number(target.dataset.job)];
    if (job?.url) openImageViewer(job.url, job.entry.name);
  }

  /** Draw one card with Pollinations instead of the chosen generator (or instead of pasting). */
  static #onPollinations(event, target) {
    this.#readInputs();
    const job = this.jobs[Number(target.dataset.job)];
    Object.assign(job, { status: "queued", error: "", include: true, provider: "pollinations" });
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
          // upload() reports a failure as a falsy result or one without a path, not by throwing.
          if (!result?.path) throw new Error(result?.message || "the server did not accept the file");
          paths.push(result.path);
        } catch (err) {
          console.error(`${MODULE_ID} | Upload failed for ${name}`, err);
          ui.notifications.error(t("UploadFailed", { name, message: err.message }));
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
 * @param {{provider: string, url?: string, token?: string, key?: string, model?: string, folder: string, autoApprove?: boolean}} options
 * @returns {Promise<{paths: string[], skipped: string[]}>} Uploaded image paths and entries left without one.
 */
export function generateSceneImages(jobs, options) {
  return new Promise(resolve => {
    const named = jobs.map(job => ({ ...job, file: imageFileName(job.entry.name) }));
    new ImageReview(named, options, resolve).render({ force: true });
  });
}
