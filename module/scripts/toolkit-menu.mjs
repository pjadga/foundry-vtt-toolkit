/**
 * One GM-only "Toolkit" button per sidebar tab, opening a small menu of that tab's toolkit actions
 * (Import X, Export X, Build campaign…), instead of a row of buttons on every tab.
 */
const MODULE_ID = "foundry-vtt-toolkit";
const escape = s => foundry.utils.escapeHTML(String(s ?? ""));

/** Actions by render hook: {label, icon, onClick}; label is a lang key or text. */
const actions = new Map();

/**
 * Add an action to a tab's Toolkit menu. Call before the tab first renders (at init or setup).
 * @param {string} hook The tab's render hook, e.g. "renderActorDirectory".
 * @param {{label: string, icon: string, onClick: () => any}} action
 */
export function addTabAction(hook, action) {
  if (!actions.has(hook)) {
    actions.set(hook, []);
    Hooks.on(hook, (app, html) => addToolkitButton(html, actions.get(hook)));
  }
  actions.get(hook).push(action);
}

function addToolkitButton(html, list) {
  if (!game.user.isGM || html.querySelector(".fvtk-toolkit-button")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fvtk-toolkit-button";
  button.innerHTML = `<i class="fa-solid fa-toolbox"></i> ${escape(game.i18n.localize("FVTK.Menu.Button"))}`;
  button.addEventListener("click", event => {
    event.stopPropagation();
    openMenu(button, list);
  });
  const actionsRow = html.querySelector(".header-actions");
  if (actionsRow) return actionsRow.append(button);
  // The combat tracker has no header-actions: put it under Create Encounter.
  const header = html.querySelector(".combat-tracker-header");
  if (!header) return;
  const row = document.createElement("div");
  row.className = "fvtk fvtk-toolkit-row";
  row.append(button);
  const nav = header.querySelector("nav.encounters");
  if (nav) nav.after(row);
  else header.prepend(row);
}

let open = null;

function closeMenu() {
  open?.remove();
  open = null;
  document.removeEventListener("pointerdown", onOutside, true);
  document.removeEventListener("keydown", onKey, true);
}
const onOutside = event => {
  if (open && !open.contains(event.target)) closeMenu();
};
const onKey = event => {
  if (event.key === "Escape") closeMenu();
};

function openMenu(button, list) {
  const wasOpenHere = open?.dataset.for === button.closest("section, .tab")?.id;
  closeMenu();
  if (wasOpenHere) return; // a second click closes it
  const menu = document.createElement("nav");
  menu.className = "fvtk fvtk-toolkit-menu";
  menu.dataset.for = button.closest("section, .tab")?.id ?? "";
  for (const action of list) {
    const item = document.createElement("button");
    item.type = "button";
    item.innerHTML = `<i class="${action.icon}"></i> ${escape(game.i18n.localize(action.label))}`;
    item.addEventListener("click", async () => {
      closeMenu();
      try {
        await action.onClick();
      } catch (err) {
        console.error(`${MODULE_ID} | ${action.label} failed`, err);
        ui.notifications.error(game.i18n.format("FVTK.Menu.Failed", { message: err.message }));
      }
    });
    menu.append(item);
  }
  document.body.append(menu);
  const box = button.getBoundingClientRect();
  const width = Math.max(box.width, 220);
  menu.style.width = `${width}px`;
  menu.style.left = `${Math.min(box.left, window.innerWidth - width - 8)}px`;
  menu.style.top = `${box.bottom + 4}px`;
  open = menu;
  document.addEventListener("pointerdown", onOutside, true);
  document.addEventListener("keydown", onKey, true);
}
