/**
 * GM Assistant: a Gemini chat inside Foundry with the campaign as context. Ask in its window or with
 * "/gm <question>" in the chat box (answers are whispered to the GMs). Answers that contain ##ENTRY
 * blocks can go straight to Build campaign. Requests for a picture ("draw a portrait of Rook", or the
 * Image button) are drawn with the scene image provider, saved with FilePicker.upload, and can become
 * an actor's portrait and token or a scene's background.
 */
import { contextText, systemPrompt, entriesIn } from "./context.mjs";
import { askGemini, DEFAULT_ASSISTANT_MODEL } from "./gemini.mjs";
import { campaignDocuments } from "../import/adventure.mjs";
import { openImporter, worldLookup, imageSettings } from "../import/importer.mjs";
import { resolveLinks } from "../import/parser.mjs";
import { citations } from "./sources.mjs";
import { searchStore, currentStore, openSources } from "./sources-sync.mjs";
import { imageRequest, imagePlanRequest, parseImagePlan, imageTargets, aspectFor } from "./drawing.mjs";
import { generateImage, DEFAULT_GEMINI_IMAGE_MODEL } from "../images/generate.mjs";
import { ensureDirectory } from "../images/review.mjs";
import { imageFileName, DEFAULT_STYLE } from "../images/prompts.mjs";
import { stripNumber } from "../import/parser.mjs";

const MODULE_ID = "foundry-vtt-toolkit";
const escape = s => foundry.utils.escapeHTML(String(s ?? ""));
const t = (key, data) => (data ? game.i18n.format(`FVTK.Assistant.${key}`, data) : game.i18n.localize(`FVTK.Assistant.${key}`));
// Earlier turns sent back with each question, so follow-ups make sense. The campaign itself is sent
// fresh every time.
const HISTORY = 20;

/** One conversation for the window and the /gm command, kept until "New chat" or a reload. */
const conversation = [];
let busy = false;
// What the assistant is busy with: "Thinking" or "Drawing".
let busyLabel = "Thinking";
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Plain text from a document's HTML. */
function htmlText(html) {
  const div = document.createElement("div");
  div.innerHTML = String(html ?? "");
  return div.innerText.trim();
}

/** The notes the importer generated for an actor or item ({public, secret}), else its sheet notes. */
function notesText(doc, fallbackPath) {
  const raw = doc.flags[MODULE_ID]?.notes?.raw;
  if (raw) return [raw.public, raw.secret && `GM only:\n${raw.secret}`].filter(Boolean).join("\n\n");
  return htmlText(foundry.utils.getProperty(doc, fallbackPath));
}

/** The campaign as {kind, name, text} documents for contextText. */
export function campaignContext() {
  const docs = campaignDocuments();
  const out = [];
  for (const j of docs.journal) {
    const flags = j.flags[MODULE_ID];
    const text = flags?.raw ?? j.pages.contents.map(p => p.text?.markdown || htmlText(p.text?.content)).join("\n\n");
    out.push({ kind: flags?.type ?? "journal", name: j.name, text });
  }
  for (const a of docs.actors) {
    // Skills and roles are on every Cyberpunk RED actor; the gear is what tells NPCs apart.
    const gear = a.items.filter(i => !["skill", "role"].includes(i.type)).map(i => i.name);
    const text = [notesText(a, "system.information.notes") || htmlText(a.system?.details?.biography?.value), gear.length && `Carries: ${gear.join(", ")}`].filter(Boolean).join("\n");
    out.push({ kind: "npc", name: a.name, text });
  }
  for (const i of docs.items) out.push({ kind: "item", name: i.name, text: [`Type: ${i.type}`, notesText(i, "system.description.value")].filter(Boolean).join("\n") });
  for (const p of docs.playlists) {
    const flags = p.flags[MODULE_ID] ?? {};
    const picked = p.sounds.map(s => s.name);
    out.push({ kind: "playlist", name: p.name, text: [flags.mood && `Mood: ${flags.mood}`, flags.tracks?.length && `Track styles: ${flags.tracks.join("; ")}`, picked.length && `Tracks: ${picked.join("; ")}`].filter(Boolean).join("\n") });
  }
  const story = docs.scenes.filter(s => s.flags[MODULE_ID]?.type === "scene").sort((a, b) => a.sort - b.sort);
  if (story.length) out.push({ kind: "other", name: "Scene order", text: story.map(s => s.name).join("\n") });
  return out;
}

/**
 * Ask the assistant. The question and answer join the conversation.
 * @param {string} question
 * @returns {Promise<{text: string, entries: {text: string, count: number}|null, model: string}>}
 */
export async function ask(question) {
  const key = game.settings.get(MODULE_ID, "geminiApiKey").trim();
  if (!key) throw new Error(t("NoKey"));
  if (busy) throw new Error(t("Busy"));
  busy = true;
  conversation.push({ role: "user", text: question });
  refreshWindow();
  try {
    const context = contextText(campaignContext());
    const store = await searchStore();
    const system = systemPrompt({ system: game.system.title, world: game.world.title, context: context.text, sources: !!store });
    const model = game.settings.get(MODULE_ID, "assistantModel").trim() || DEFAULT_ASSISTANT_MODEL;
    const answer = await askGemini({ system, history: conversation.slice(-HISTORY), stores: store ? [store.name] : [] }, key, model);
    const cited = citations(answer.grounding);
    const message = { role: "model", text: answer.text, entries: entriesIn(answer.text), model: answer.model, citations: cited, html: (await renderAnswer(answer.text)) + citationsHTML(cited) };
    conversation.push(message);
    return message;
  } catch (err) {
    // Drop the unanswered question, so the next one isn't sent after a dangling turn.
    conversation.pop();
    throw err;
  } finally {
    busy = false;
    refreshWindow();
  }
}

/**
 * The image settings for the assistant: the scene image provider, or Gemini when scene images are
 * off (the GM asked for this one).
 */
function drawSettings() {
  const settings = imageSettings(importFolder());
  if (settings) return settings;
  return { provider: "gemini", folder: importFolder(), key: game.settings.get(MODULE_ID, "geminiApiKey").trim(), model: game.settings.get(MODULE_ID, "geminiImageModel").trim() || DEFAULT_GEMINI_IMAGE_MODEL };
}

/** The Build campaign image folder, where its scene images go. */
const importFolder = () => game.settings.get(MODULE_ID, "imageFolder") || `worlds/${game.world.id}/assets/notebooklm`;

/** Actors and scenes an image could be used for, with the name the campaign calls them by. */
function targetDocuments() {
  return [
    ...game.actors.map(a => ({ name: a.name, uuid: a.uuid, use: "portrait" })),
    ...game.scenes.map(s => ({ name: s.flags[MODULE_ID]?.baseName ?? stripNumber(s.name), uuid: s.uuid, use: "background" }))
  ];
}

/**
 * Draw an image for the GM: Gemini writes the prompt from the request and the campaign, then the
 * image provider draws it. The request and the image join the conversation.
 * @param {string} request
 * @returns {Promise<object>} The conversation message, with `image` ({url, blob, prompt, kind, path}) and `targets`.
 */
export async function draw(request) {
  const key = game.settings.get(MODULE_ID, "geminiApiKey").trim();
  if (!key) throw new Error(t("NoKey"));
  if (busy) throw new Error(t("Busy"));
  busy = true;
  busyLabel = "Drawing";
  const guess = imageRequest(request);
  const previous = conversation.findLast(m => m.role === "model" && !m.image)?.text ?? "";
  conversation.push({ role: "user", text: request });
  refreshWindow();
  try {
    const context = contextText(campaignContext());
    const system = systemPrompt({ system: game.system.title, world: game.world.title, context: context.text });
    const model = game.settings.get(MODULE_ID, "assistantModel").trim() || DEFAULT_ASSISTANT_MODEL;
    const style = game.settings.get(MODULE_ID, "imageStyle").trim() || DEFAULT_STYLE;
    const history = [...conversation.slice(-HISTORY, -1), { role: "user", text: imagePlanRequest(guess?.request ?? request, style) }];
    const answer = await askGemini({ system, history, json: true }, key, model);
    const plan = parseImagePlan(answer.text, guess?.kind);
    const settings = drawSettings();
    let blob;
    try {
      blob = await generateImage(plan.prompt, { ...settings, aspectRatio: aspectFor(plan.kind) });
    } catch (err) {
      throw new Error(t("DrawFailed", { provider: settings.provider, message: err.message }));
    }
    const image = { url: URL.createObjectURL(blob), blob, prompt: plan.prompt, kind: plan.kind, subject: plan.subject, provider: settings.provider, path: null };
    const targets = imageTargets({ subject: plan.subject, request, previous, kind: plan.kind }, targetDocuments());
    const message = { role: "model", text: `(Image of ${plan.subject || "the request"}: ${plan.prompt})`, image, targets, model: `${answer.model} + ${settings.provider === "gemini" ? settings.model : settings.provider}`, html: "" };
    conversation.push(message);
    return message;
  } catch (err) {
    conversation.pop();
    throw err;
  } finally {
    busy = false;
    busyLabel = "Thinking";
    refreshWindow();
  }
}

/**
 * Upload an assistant image (once) to the Build campaign image folder; portraits go in its
 * "portraits" subfolder, so Build campaign doesn't take them for scene images.
 * @returns {Promise<string>} The saved path.
 */
async function saveImage(image) {
  if (image.path) return image.path;
  const folder = image.kind === "portrait" ? `${importFolder()}/portraits` : importFolder();
  const stem = imageFileName(image.subject || image.prompt.split(/\s+/).slice(0, 6).join(" "), "x").replace(/\.x$/, "");
  // A new name every time, so a browser that cached an earlier image under the same path shows this one.
  const name = `${stem}-${Date.now().toString(36)}.${EXTENSIONS[image.blob.type] ?? "png"}`;
  await ensureDirectory(folder);
  const FP = foundry.applications.apps.FilePicker.implementation;
  const result = await FP.upload("data", folder, new File([image.blob], name, { type: image.blob.type }), {}, { notify: false });
  // upload() reports a failure as a falsy result or one without a path, not by throwing.
  if (!result?.path) throw new Error(result?.message || t("UploadRefused"));
  image.path = result.path;
  return image.path;
}

/**
 * Use a saved image as an actor's portrait and token (its prototype and the tokens already placed)
 * or a scene's background, after the GM confirms.
 * @returns {Promise<boolean>} Whether it was applied.
 */
async function useImage(path, target) {
  const doc = await fromUuid(target.uuid);
  if (!doc) {
    ui.notifications.warn(t("TargetGone", { name: target.name }));
    return false;
  }
  const portrait = target.use === "portrait";
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: t(portrait ? "UsePortraitTitle" : "UseBackgroundTitle") },
    content: `<p>${escape(t(portrait ? "UsePortraitConfirm" : "UseBackgroundConfirm", { name: doc.name }))}</p>`,
    rejectClose: false
  });
  if (!ok) return false;
  if (portrait) {
    await doc.update({ img: path, "prototypeToken.texture.src": path });
    for (const scene of game.scenes) {
      const updates = scene.tokens.filter(tk => tk.actorId === doc.id).map(tk => ({ _id: tk.id, "texture.src": path }));
      if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
    }
  } else {
    await doc.update({ "background.src": path });
    try {
      const { thumb } = await doc.createThumbnail();
      await doc.update({ thumb });
    } catch (err) {
      console.warn(`${MODULE_ID} | No thumbnail for ${doc.name}`, err);
    }
  }
  ui.notifications.info(t(portrait ? "UsedPortrait" : "UsedBackground", { name: doc.name }));
  return true;
}

const targetLabel = target => t(target.use === "portrait" ? "UseAsPortrait" : "UseAsBackground", { name: target.name });

/** Whisper an image to the GMs (saving it first), with buttons that use it for its documents. */
async function postImage(message, question) {
  const path = await saveImage(message.image);
  const buttons = message.targets.map((tg, i) => `<button type="button" class="fvtk-assistant-use" data-target="${i}"><i class="fa-solid fa-${tg.use === "portrait" ? "user" : "map"}"></i> ${escape(targetLabel(tg))}</button>`).join("");
  return ChatMessage.create({
    speaker: { alias: t("Speaker") },
    whisper: gmIds(),
    content: `<div class="fvtk fvtk-assistant-chat">${question ? `<p class="fvtk-assistant-q">${escape(question)}</p>` : ""}<img class="fvtk-assistant-image" src="${escape(path)}" alt="${escape(message.image.prompt)}"><p><small>${escape(t("SavedAs", { path }))}</small></p>${buttons}</div>`,
    flags: { [MODULE_ID]: { assistant: { image: path, targets: message.targets } } }
  });
}

/**
 * An answer as HTML: Markdown, with [[names]] as links to the campaign's documents. Code blocks (the
 * ##ENTRY answers) are shown as written; their brackets are escaped so Foundry doesn't read them as
 * inline rolls.
 */
export async function renderAnswer(markdown) {
  const lookup = worldLookup();
  const linked = String(markdown).split(/(```[\s\S]*?(?:```|$))/).map((part, i) => (i % 2 ? part : resolveLinks(part, lookup))).join("");
  const converter = new showdown.Converter(CONST.SHOWDOWN_OPTIONS);
  const html = converter.makeHtml(linked).replace(/<code[^>]*>[\s\S]*?<\/code>/g, code => code.replace(/\[/g, "&#91;").replace(/\]/g, "&#93;"));
  return foundry.applications.ux.TextEditor.implementation.enrichHTML(html);
}

/** The sources an answer used, as a folded list under it. */
function citationsHTML(cited) {
  if (!cited.length) return "";
  const names = cited.map(c => c.title).join(", ");
  const items = cited.map(c => `<li><strong>${escape(c.path || c.title)}</strong>${c.pages.length ? ` (${escape(t("Pages", { pages: c.pages.join(", ") }))})` : ""}${c.snippet ? `<br><small>“${escape(c.snippet)}…”</small>` : ""}</li>`).join("");
  return `<details class="fvtk-assistant-sources"><summary><i class="fa-solid fa-book"></i> ${escape(t("SourcesUsed", { names }))}</summary><ul>${items}</ul></details>`;
}

/** Open Build campaign with an answer's entries. */
function build(entries) {
  return openImporter({ text: entries.text.replace(/^\s*```[a-z]*\s*$/gim, "") });
}

const buildLabel = entries => (entries.count === 1 ? t("BuildOne") : t("Build", { count: entries.count }));

const gmIds = () => game.users.filter(u => u.isGM).map(u => u.id);

/** Whisper an answer to the GMs, with a Build campaign button when it has entries. */
async function postAnswer(message, question) {
  const button = message.entries ? `<button type="button" class="fvtk-assistant-build"><i class="fa-solid fa-file-import"></i> ${escape(buildLabel(message.entries))}</button>` : "";
  return ChatMessage.create({
    speaker: { alias: t("Speaker") },
    whisper: gmIds(),
    content: `<div class="fvtk fvtk-assistant-chat">${question ? `<p class="fvtk-assistant-q">${escape(question)}</p>` : ""}${message.html}${button}</div>`,
    flags: { [MODULE_ID]: { assistant: { entries: message.entries?.text ?? null } } }
  });
}

class GMAssistant extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fvtk-gm-assistant",
    classes: ["fvtk", "fvtk-gm-assistant"],
    window: { title: "FVTK.Assistant.Title", icon: "fa-solid fa-robot", resizable: true },
    position: { width: 640, height: 720 },
    actions: {
      send: GMAssistant.#onSend,
      newChat: GMAssistant.#onNewChat,
      build: GMAssistant.#onBuild,
      post: GMAssistant.#onPost,
      copy: GMAssistant.#onCopy,
      sources: GMAssistant.#onSources,
      draw: GMAssistant.#onDraw,
      save: GMAssistant.#onSave,
      use: GMAssistant.#onUse
    }
  };

  #draft = "";
  #status = "";

  async _renderHTML() {
    const key = game.settings.get(MODULE_ID, "geminiApiKey").trim();
    const context = contextText(campaignContext());
    const messages = conversation
      .map((m, i) => {
        if (m.role === "user") return `<li class="fvtk-assistant-msg user">${escape(m.text).replace(/\n/g, "<br>")}</li>`;
        if (m.image) return imageHTML(m, i);
        const buttons = [
          m.entries ? `<button type="button" data-action="build" data-index="${i}"><i class="fa-solid fa-file-import"></i> ${escape(buildLabel(m.entries))}</button>` : "",
          `<button type="button" data-action="post" data-index="${i}"><i class="fa-solid fa-comment"></i> ${escape(t("Post"))}</button>`,
          `<button type="button" data-action="copy" data-index="${i}"><i class="fa-solid fa-copy"></i> ${escape(t("Copy"))}</button>`
        ].join("");
        return `<li class="fvtk-assistant-msg model"><div class="fvtk-assistant-text">${m.html}</div><div class="fvtk-assistant-actions">${buttons}<small>${escape(m.model)}</small></div></li>`;
      })
      .join("");
    const empty = conversation.length ? "" : `<li class="fvtk-assistant-empty">${escape(t("Empty"))}</li>`;
    const store = await currentStore();
    const sourcesOn = store && game.settings.get(MODULE_ID, "assistantUseSources");
    const sourcesLine = escape(sourcesOn ? t("SourcesOn") : store ? t("SourcesOff") : t("SourcesNone"));
    const thinking = busy ? `<li class="fvtk-assistant-msg model thinking"><i class="fa-solid fa-spinner fa-spin"></i> ${escape(t(busyLabel))}</li>` : "";
    return `${key ? "" : `<p class="notification warning">${escape(t("NoKey"))}</p>`}
      <div class="fvtk-assistant-bar"><span>${escape(t("Context", { count: context.included, k: Math.round(context.text.length / 1000) }))}${context.omitted ? ` ${escape(t("Omitted", { count: context.omitted }))}` : ""}</span>
        <button type="button" data-action="newChat"><i class="fa-solid fa-broom"></i> ${escape(t("NewChat"))}</button></div>
      <div class="fvtk-assistant-bar"><span>${sourcesLine}</span>
        <button type="button" data-action="sources"><i class="fa-solid fa-book"></i> ${escape(t("Sources"))}</button></div>
      <ol class="fvtk-assistant-log">${empty}${messages}${thinking}</ol>
      ${this.#status ? `<p class="fvtk-assistant-status">${escape(this.#status)}</p>` : ""}
      <form class="fvtk-assistant-form">
        <textarea name="question" rows="3" placeholder="${escape(t("Placeholder"))}" ${busy ? "disabled" : ""}>${escape(this.#draft)}</textarea>
        <div class="fvtk-assistant-send">
          <button type="button" data-action="send" ${busy || !key ? "disabled" : ""}><i class="fa-solid fa-paper-plane"></i> ${escape(t("Send"))}</button>
          <button type="button" data-action="draw" ${busy || !key ? "disabled" : ""} data-tooltip="${escape(t("ImageHint"))}"><i class="fa-solid fa-image"></i> ${escape(t("Image"))}</button>
        </div>
      </form>`;
  }

  _replaceHTML(result, content) {
    const log = content.querySelector(".fvtk-assistant-log");
    const atBottom = !log || log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    const hadFocus = content.querySelector("textarea[name=question]") === document.activeElement;
    content.innerHTML = result;
    const next = content.querySelector(".fvtk-assistant-log");
    if (next && atBottom) next.scrollTop = next.scrollHeight;
    const box = content.querySelector("textarea[name=question]");
    if (box && hadFocus && !box.disabled) box.focus();
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const box = this.element.querySelector("textarea[name=question]");
    box?.addEventListener("input", () => (this.#draft = box.value));
    // Enter sends; Shift+Enter starts a new line.
    box?.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        GMAssistant.#onSend.call(this);
      }
    });
  }

  static async #onSend() {
    const question = this.#draft.trim();
    if (!question || busy) return;
    this.#draft = "";
    this.#status = "";
    try {
      await (imageRequest(question) ? draw(question) : ask(question));
    } catch (err) {
      console.warn(`${MODULE_ID} | GM Assistant`, err);
      this.#draft = question;
      this.#status = t("Failed", { message: err.message });
    }
    this.render();
  }

  /** The Image button: draw whatever the box describes, worded as a request or not. */
  static async #onDraw() {
    const request = this.#draft.trim();
    if (busy) return;
    if (!request) {
      this.#status = t("DescribeImage");
      return this.render();
    }
    this.#draft = "";
    this.#status = "";
    try {
      await draw(request);
    } catch (err) {
      console.warn(`${MODULE_ID} | GM Assistant`, err);
      this.#draft = request;
      this.#status = t("Failed", { message: err.message });
    }
    this.render();
  }

  static async #onSave(event, target) {
    const message = conversation[Number(target.dataset.index)];
    if (!message?.image) return;
    try {
      const path = await saveImage(message.image);
      ui.notifications.info(t("SavedAs", { path }));
    } catch (err) {
      console.error(`${MODULE_ID} | GM Assistant image upload`, err);
      ui.notifications.error(t("SaveFailed", { message: err.message }));
    }
    this.render();
  }

  static async #onUse(event, target) {
    const message = conversation[Number(target.dataset.index)];
    const doc = message?.targets?.[Number(target.dataset.target)];
    if (!doc) return;
    try {
      await useImage(await saveImage(message.image), doc);
    } catch (err) {
      console.error(`${MODULE_ID} | GM Assistant image`, err);
      ui.notifications.error(t("SaveFailed", { message: err.message }));
    }
    this.render();
  }

  static #onNewChat() {
    if (busy) return;
    for (const m of conversation) if (m.image) URL.revokeObjectURL(m.image.url);
    conversation.length = 0;
    this.#status = "";
    this.render();
  }

  static #onBuild(event, target) {
    const message = conversation[Number(target.dataset.index)];
    if (message?.entries) build(message.entries);
  }

  static async #onPost(event, target) {
    const index = Number(target.dataset.index);
    const message = conversation[index];
    try {
      await (message.image ? postImage(message, conversation[index - 1]?.text) : postAnswer(message, conversation[index - 1]?.text));
    } catch (err) {
      console.error(`${MODULE_ID} | GM Assistant post`, err);
      ui.notifications.error(t("SaveFailed", { message: err.message }));
    }
    this.render();
  }

  static #onSources() {
    return openSources(() => this.render());
  }

  static async #onCopy(event, target) {
    await game.clipboard.copyPlainText(conversation[Number(target.dataset.index)].text);
    ui.notifications.info(t("Copied"));
  }
}

/** An image in the window: the picture, its prompt, and Save / use / post buttons. */
function imageHTML(m, i) {
  const { image } = m;
  const buttons = [
    `<button type="button" data-action="save" data-index="${i}" ${image.path ? "disabled" : ""}><i class="fa-solid fa-floppy-disk"></i> ${escape(image.path ? t("Saved") : t("Save"))}</button>`,
    ...m.targets.map((tg, n) => `<button type="button" data-action="use" data-index="${i}" data-target="${n}"><i class="fa-solid fa-${tg.use === "portrait" ? "user" : "map"}"></i> ${escape(targetLabel(tg))}</button>`),
    `<button type="button" data-action="post" data-index="${i}"><i class="fa-solid fa-comment"></i> ${escape(t("Post"))}</button>`
  ].join("");
  const saved = image.path ? `<p><small>${escape(t("SavedAs", { path: image.path }))}</small></p>` : "";
  return `<li class="fvtk-assistant-msg model"><img class="fvtk-assistant-image" src="${image.url}" alt="">
    <details class="fvtk-assistant-prompt"><summary>${escape(t("Prompt"))}</summary><p>${escape(image.prompt)}</p></details>${saved}
    <div class="fvtk-assistant-actions">${buttons}<small>${escape(m.model)}</small></div></li>`;
}

let app = null;

function refreshWindow() {
  if (app?.rendered) app.render();
}

/** Open the GM Assistant window. GM only. */
export function openAssistant() {
  if (!game.user.isGM) return ui.notifications.warn(t("GMOnly"));
  app ??= new GMAssistant();
  return app.render({ force: true });
}

/**
 * "/gm <question>" in the chat box asks the assistant (GM only); the answer is whispered to the GMs,
 * and its Build campaign button opens the importer with the entries.
 */
export function setupAssistant() {
  Hooks.on("chatMessage", (chatLog, text) => {
    const match = String(text).match(/^\/gm\s+([\s\S]+)$/i);
    if (!match || !game.user.isGM) return;
    const question = match[1].trim();
    const drawing = !!imageRequest(question);
    (async () => {
      const pending = await ChatMessage.create({ speaker: { alias: t("Speaker") }, whisper: gmIds(), content: `<div class="fvtk fvtk-assistant-chat"><p class="fvtk-assistant-q">${escape(question)}</p><p><i class="fa-solid fa-spinner fa-spin"></i> ${escape(t(drawing ? "Drawing" : "Thinking"))}</p></div>` });
      try {
        // A picture has to be a file to show in chat, so /gm saves it straight away.
        const message = await (drawing ? draw(question) : ask(question));
        await (drawing ? postImage(message, question) : postAnswer(message, question));
        await pending.delete();
      } catch (err) {
        console.warn(`${MODULE_ID} | GM Assistant`, err);
        await pending.update({ content: `<div class="fvtk fvtk-assistant-chat"><p class="fvtk-assistant-q">${escape(question)}</p><p>${escape(t("Failed", { message: err.message }))}</p></div>` });
      }
    })();
    return false;
  });

  Hooks.on("renderChatMessageHTML", (message, html) => {
    const { image, targets = [] } = message.flags[MODULE_ID]?.assistant ?? {};
    if (image) {
      html.querySelectorAll(".fvtk-assistant-use").forEach(button =>
        button.addEventListener("click", () => {
          const target = targets[Number(button.dataset.target)];
          if (target && game.user.isGM) useImage(image, target).catch(err => ui.notifications.error(t("SaveFailed", { message: err.message })));
        })
      );
    }
    const entries = message.flags[MODULE_ID]?.assistant?.entries;
    const button = html.querySelector(".fvtk-assistant-build");
    if (!entries || !button) return;
    button.addEventListener("click", () => build({ text: entries }));
  });
}
