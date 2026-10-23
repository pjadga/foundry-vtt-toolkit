/**
 * GM Assistant: a Gemini chat inside Foundry with the campaign as context. Ask in its window or with
 * "/gm <question>" in the chat box (answers are whispered to the GMs). Answers that contain ##ENTRY
 * blocks can go straight to Build campaign.
 */
import { contextText, systemPrompt, entriesIn } from "./context.mjs";
import { askGemini, DEFAULT_ASSISTANT_MODEL } from "./gemini.mjs";
import { campaignDocuments } from "../import/adventure.mjs";
import { openImporter, worldLookup } from "../import/importer.mjs";
import { resolveLinks } from "../import/parser.mjs";
import { citations } from "./sources.mjs";
import { searchStore, currentStore, openSources } from "./sources-sync.mjs";

const MODULE_ID = "foundry-vtt-toolkit";
const escape = s => foundry.utils.escapeHTML(String(s ?? ""));
const t = (key, data) => (data ? game.i18n.format(`FVTK.Assistant.${key}`, data) : game.i18n.localize(`FVTK.Assistant.${key}`));
// Earlier turns sent back with each question, so follow-ups make sense. The campaign itself is sent
// fresh every time.
const HISTORY = 20;

/** One conversation for the window and the /gm command, kept until "New chat" or a reload. */
const conversation = [];
let busy = false;

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
      sources: GMAssistant.#onSources
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
    const thinking = busy ? `<li class="fvtk-assistant-msg model thinking"><i class="fa-solid fa-spinner fa-spin"></i> ${escape(t("Thinking"))}</li>` : "";
    return `${key ? "" : `<p class="notification warning">${escape(t("NoKey"))}</p>`}
      <div class="fvtk-assistant-bar"><span>${escape(t("Context", { count: context.included, k: Math.round(context.text.length / 1000) }))}${context.omitted ? ` ${escape(t("Omitted", { count: context.omitted }))}` : ""}</span>
        <button type="button" data-action="newChat"><i class="fa-solid fa-broom"></i> ${escape(t("NewChat"))}</button></div>
      <div class="fvtk-assistant-bar"><span>${sourcesLine}</span>
        <button type="button" data-action="sources"><i class="fa-solid fa-book"></i> ${escape(t("Sources"))}</button></div>
      <ol class="fvtk-assistant-log">${empty}${messages}${thinking}</ol>
      ${this.#status ? `<p class="fvtk-assistant-status">${escape(this.#status)}</p>` : ""}
      <form class="fvtk-assistant-form">
        <textarea name="question" rows="3" placeholder="${escape(t("Placeholder"))}" ${busy ? "disabled" : ""}>${escape(this.#draft)}</textarea>
        <button type="button" data-action="send" ${busy || !key ? "disabled" : ""}><i class="fa-solid fa-paper-plane"></i> ${escape(t("Send"))}</button>
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
      await ask(question);
    } catch (err) {
      console.warn(`${MODULE_ID} | GM Assistant`, err);
      this.#draft = question;
      this.#status = t("Failed", { message: err.message });
    }
    this.render();
  }

  static #onNewChat() {
    if (busy) return;
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
    await postAnswer(conversation[index], conversation[index - 1]?.text);
  }

  static #onSources() {
    return openSources(() => this.render());
  }

  static async #onCopy(event, target) {
    await game.clipboard.copyPlainText(conversation[Number(target.dataset.index)].text);
    ui.notifications.info(t("Copied"));
  }
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
    (async () => {
      const pending = await ChatMessage.create({ speaker: { alias: t("Speaker") }, whisper: gmIds(), content: `<div class="fvtk fvtk-assistant-chat"><p class="fvtk-assistant-q">${escape(question)}</p><p><i class="fa-solid fa-spinner fa-spin"></i> ${escape(t("Thinking"))}</p></div>` });
      try {
        const message = await ask(question);
        await pending.delete();
        await postAnswer(message, question);
      } catch (err) {
        console.warn(`${MODULE_ID} | GM Assistant`, err);
        await pending.update({ content: `<div class="fvtk fvtk-assistant-chat"><p class="fvtk-assistant-q">${escape(question)}</p><p>${escape(t("Failed", { message: err.message }))}</p></div>` });
      }
    })();
    return false;
  });

  Hooks.on("renderChatMessageHTML", (message, html) => {
    const entries = message.flags[MODULE_ID]?.assistant?.entries;
    const button = html.querySelector(".fvtk-assistant-build");
    if (!entries || !button) return;
    button.addEventListener("click", () => build({ text: entries }));
  });
}
