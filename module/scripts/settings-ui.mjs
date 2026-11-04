/**
 * Tidies the toolkit's tab in Configure Settings: settings in headed groups, each setting's
 * description as a tooltip on its name instead of a paragraph, and API keys hidden as dots with a
 * button to show them. Layout in settings-layout.mjs.
 */
import { groupSettings, SECRET_SETTINGS } from "./settings-layout.mjs";

const MODULE_ID = "foundry-vtt-toolkit";

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

  for (const [key, group] of groupsByKey) {
    // The description becomes a tooltip on the setting's name, with an info icon to hover.
    const hint = group.querySelector(":scope > .hint, :scope > p.notes");
    const label = group.querySelector(":scope > label");
    if (hint && label) {
      label.dataset.tooltip = hint.textContent.trim();
      label.dataset.tooltipDirection = "UP";
      label.classList.add("fvtk-has-tip");
      label.insertAdjacentHTML("beforeend", ' <i class="fa-solid fa-circle-info fvtk-tip-icon" inert></i>');
      hint.remove();
    }
    if (SECRET_SETTINGS.includes(key)) hideSecret(group);
  }

  // Group headings, with the settings moved under them in group order.
  const anchor = section.querySelector(":scope > .form-group");
  if (!anchor) return;
  const marker = document.createElement("div");
  anchor.before(marker);
  for (const { label, keys } of groupSettings([...groupsByKey.keys()])) {
    const heading = document.createElement("h4");
    heading.className = "fvtk-settings-heading";
    heading.textContent = game.i18n.localize(label);
    marker.before(heading);
    for (const key of keys) marker.before(groupsByKey.get(key));
  }
  marker.remove();
}

/** Show a key as dots, with an eye button that reveals it until clicked again. */
function hideSecret(group) {
  const input = group.querySelector('input[type="text"], input[type="password"]');
  if (!input) return;
  input.type = "password";
  input.autocomplete = "off";
  input.spellcheck = false;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fvtk-reveal icon fa-solid fa-eye";
  button.dataset.tooltip = game.i18n.localize("FVTK.SettingsGroup.Show");
  button.setAttribute("aria-label", button.dataset.tooltip);
  button.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.classList.toggle("fa-eye", !show);
    button.classList.toggle("fa-eye-slash", show);
    button.dataset.tooltip = game.i18n.localize(show ? "FVTK.SettingsGroup.Hide" : "FVTK.SettingsGroup.Show");
    button.setAttribute("aria-label", button.dataset.tooltip);
  });
  input.after(button);
}

export function setupSettingsUI() {
  Hooks.on("renderSettingsConfig", (app, html) => tidy(html ?? app.element));
}
