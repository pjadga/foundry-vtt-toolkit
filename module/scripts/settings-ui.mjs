/**
 * The toolkit's tab in Configure Settings: a button per service (Gemini, YouTube, OpenAI) opening a
 * dialog with that service's settings, the other settings in headed groups, each setting's
 * description as a tooltip on its name, and API keys hidden as dots with a button to show them.
 * Layout in settings-layout.mjs.
 */
import { groupSettings, SECRET_SETTINGS, SERVICE_MENUS } from "./settings-layout.mjs";
import { MODEL_SETTINGS, geminiModels, openaiImageModels, modelOptions, modelLabel } from "./model-lists.mjs";

const MODULE_ID = "foundry-vtt-toolkit";
const escape = s => foundry.utils.escapeHTML(String(s ?? ""));
const loc = key => game.i18n.localize(key);

/** A setting's description as a tooltip on its label, with an info icon to hover. */
function tipOnLabel(label, text) {
  if (!label || !text) return;
  label.dataset.tooltip = text;
  label.dataset.tooltipDirection = "UP";
  label.classList.add("fvtk-has-tip");
  label.insertAdjacentHTML("beforeend", ' <i class="fa-solid fa-circle-info fvtk-tip-icon" inert></i>');
}

/** Show a key as dots, with an eye button that reveals it until clicked again. */
function hideSecret(input) {
  if (!input || input.dataset.fvtkSecret) return;
  input.dataset.fvtkSecret = "1";
  input.type = "password";
  input.autocomplete = "off";
  input.spellcheck = false;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fvtk-reveal icon fa-solid fa-eye";
  const label = show => {
    button.dataset.tooltip = loc(show ? "FVTK.SettingsGroup.Show" : "FVTK.SettingsGroup.Hide");
    button.setAttribute("aria-label", button.dataset.tooltip);
  };
  label(true);
  button.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.classList.toggle("fa-eye", !show);
    button.classList.toggle("fa-eye-slash", show);
    label(!show);
  });
  input.after(button);
}

// Model lists fetched this session, by kind ("gemini-text", "gemini-image", "openai-image").
const fetchedModels = new Map();

/** The provider's models for a kind, fetched with this key (cached for the session); [] on failure. */
async function fetchModels(kind, key) {
  if (!key) return [];
  const cacheKey = `${kind}:${key.slice(-6)}`;
  if (fetchedModels.has(cacheKey)) return fetchedModels.get(cacheKey);
  try {
    let list;
    if (kind.startsWith("gemini")) {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": key } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      list = geminiModels(await response.json(), kind);
    } else {
      const response = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      list = openaiImageModels(await response.json());
    }
    fetchedModels.set(cacheKey, list);
    return list;
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not list ${kind} models`, err);
    return [];
  }
}

/** A model dropdown's options, keeping the selected value. */
function modelOptionsHTML(kind, list, value) {
  return modelOptions(list, kind, value).map(id => `<option value="${escape(id)}" ${id === value ? "selected" : ""}>${escape(modelLabel(id))}</option>`).join("");
}

/** The form field for a setting, from its registration. */
function fieldHTML(key, setting, value) {
  const name = `${MODULE_ID}.${key}`;
  if (MODEL_SETTINGS[key]) return `<select name="${name}" data-models="${MODEL_SETTINGS[key]}">${modelOptionsHTML(MODEL_SETTINGS[key], [], value)}</select>`;
  if (setting.type === Boolean) return `<input type="checkbox" name="${name}" ${value ? "checked" : ""}>`;
  if (setting.choices) {
    const options = Object.entries(setting.choices).map(([v, l]) => `<option value="${escape(v)}" ${v === value ? "selected" : ""}>${escape(loc(l))}</option>`).join("");
    return `<select name="${name}">${options}</select>`;
  }
  const type = setting.type === Number ? "number" : "text";
  return `<input type="${type}" name="${name}" value="${escape(value)}">`;
}

/** A dialog with one service's settings (its key, models and options). */
class ServiceSettings extends foundry.applications.api.ApplicationV2 {
  static service = null;

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["fvtk", "fvtk-service-settings"],
    window: { resizable: true },
    position: { width: 560 },
    form: { handler: ServiceSettings.#save, closeOnSubmit: true }
  };

  get title() {
    return loc(SERVICE_MENUS[this.constructor.service].label);
  }

  async _renderHTML() {
    const { keys } = SERVICE_MENUS[this.constructor.service];
    const rows = keys.map(key => {
      const setting = game.settings.settings.get(`${MODULE_ID}.${key}`);
      if (!setting) return "";
      const value = game.settings.get(MODULE_ID, key);
      return `<div class="form-group" data-key="${key}">
        <label data-hint="${escape(loc(setting.hint ?? ""))}">${escape(loc(setting.name))}</label>
        <div class="form-fields">${fieldHTML(key, setting, value)}</div>
      </div>`;
    });
    return `<div class="fvtk-service-body">${rows.join("")}</div>
      <footer class="form-footer"><button type="submit"><i class="fa-solid fa-floppy-disk"></i> ${escape(loc("FVTK.Service.Save"))}</button></footer>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
    for (const label of content.querySelectorAll("label[data-hint]")) {
      tipOnLabel(label, label.dataset.hint);
      delete label.dataset.hint;
    }
    for (const key of SECRET_SETTINGS) hideSecret(content.querySelector(`input[name="${MODULE_ID}.${key}"]`));
    this.#loadModels(content);
  }

  /** Swap each model dropdown's built-in list for the provider's own, using the key in the dialog. */
  async #loadModels(content) {
    for (const select of content.querySelectorAll("select[data-models]")) {
      const kind = select.dataset.models;
      const keyName = kind.startsWith("gemini") ? "geminiApiKey" : "openaiApiKey";
      const key = (content.querySelector(`input[name="${MODULE_ID}.${keyName}"]`)?.value ?? game.settings.get(MODULE_ID, keyName)).trim();
      const list = await fetchModels(kind, key);
      if (!list.length || !select.isConnected) continue;
      const value = select.value;
      select.innerHTML = modelOptionsHTML(kind, list, value);
      select.value = value;
    }
  }

  static async #save(event, form, formData) {
    const { keys } = SERVICE_MENUS[this.constructor.service];
    for (const key of keys) {
      const setting = game.settings.settings.get(`${MODULE_ID}.${key}`);
      if (!setting) continue;
      const field = form.elements[`${MODULE_ID}.${key}`];
      let value = setting.type === Boolean ? field.checked : field.value;
      if (setting.type === Number) value = Number(value);
      if (typeof value === "string") value = value.trim();
      if (value !== game.settings.get(MODULE_ID, key)) await game.settings.set(MODULE_ID, key, value);
    }
    ui.notifications.info(game.i18n.format("FVTK.Service.Saved", { service: loc(SERVICE_MENUS[this.constructor.service].label) }));
  }
}

/**
 * Register a settings-page button for each service, and take that service's settings off the page.
 * Call during init, after the settings are registered.
 */
export function registerServiceMenus() {
  for (const [id, menu] of Object.entries(SERVICE_MENUS)) {
    for (const key of menu.keys) {
      const setting = game.settings.settings.get(`${MODULE_ID}.${key}`);
      if (setting) setting.config = false;
    }
    game.settings.registerMenu(MODULE_ID, `${id}Menu`, {
      name: menu.label,
      label: `FVTK.Service.Open`,
      hint: `FVTK.Service.${id}Hint`,
      icon: menu.icon,
      type: class extends ServiceSettings {
        static service = id;
      },
      restricted: true
    });
  }
}

function tidy(html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const section = root?.querySelector(`section[data-tab="${MODULE_ID}"]`) ?? root?.querySelector(`[name^="${MODULE_ID}."]`)?.closest("section");
  if (!section || section.dataset.fvtkTidy) return;
  section.dataset.fvtkTidy = "1";
  section.classList.add("fvtk-settings");

  const groupsByKey = new Map();
  for (const field of section.querySelectorAll(`[name^="${MODULE_ID}."]`)) {
    const group = field.closest(".form-group");
    if (group && group.parentElement === section) groupsByKey.set(field.name.slice(MODULE_ID.length + 1), group);
  }
  // The service buttons (registerMenu) are form groups too: hints become tooltips there as well.
  const menuGroups = [...section.querySelectorAll(":scope > .form-group")].filter(g => g.querySelector(`button[data-key^="${MODULE_ID}."]`) || g.classList.contains("submenu"));

  for (const group of [...menuGroups, ...groupsByKey.values()]) {
    const hint = group.querySelector(":scope > .hint, :scope > p.notes");
    const label = group.querySelector(":scope > label");
    if (hint && label) {
      tipOnLabel(label, hint.textContent.trim());
      hint.remove();
    }
  }
  for (const [key, group] of groupsByKey) if (SECRET_SETTINGS.includes(key)) hideSecret(group.querySelector("input"));

  // Headings: the service buttons first, then the other settings in their groups.
  const anchor = section.querySelector(":scope > .form-group");
  if (!anchor) return;
  const marker = document.createElement("div");
  anchor.before(marker);
  const heading = text => {
    const h = document.createElement("h4");
    h.className = "fvtk-settings-heading";
    h.textContent = loc(text);
    marker.before(h);
  };
  if (menuGroups.length) {
    heading("FVTK.SettingsGroup.Services");
    for (const group of menuGroups) marker.before(group);
  }
  for (const { label, keys } of groupSettings([...groupsByKey.keys()])) {
    heading(label);
    for (const key of keys) marker.before(groupsByKey.get(key));
  }
  marker.remove();
}

export function setupSettingsUI() {
  Hooks.on("renderSettingsConfig", (app, html) => tidy(html ?? app.element));
  // Every toolkit setting is for the GM. They're client settings, which Foundry shows to everyone
  // (only world settings and menus can be restricted), so take them off a player's settings page.
  Hooks.once("ready", () => {
    if (game.user.isGM) return;
    for (const setting of game.settings.settings.values()) if (setting.namespace === MODULE_ID) setting.config = false;
  });
}
