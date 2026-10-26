/**
 * Name:    Roy's History
 * System:  any
 * Foundry: v12, v13
 * Type:    script
 *
 * Every line the Roy's Declarations macro has written in this browser, newest first, in a window
 * just for you. Search them, copy one (with or without the stage direction) to paste into chat
 * again, star the ones worth keeping, or delete them. Starred lines are never trimmed; the rest keep
 * the latest 300. Export saves them all as a text file. Nothing is posted, and nothing shows in
 * Foundry's notifications.
 *
 * The history lives in this browser's localStorage for this Foundry site, like the Gemini key, so
 * another browser or computer has its own.
 *
 * Install in a game you don't host: docs/macros/roy-declarations.md.
 */

const ROY = 'Roy "Slayer" Belmont';
// Shared with Roy's Declarations.
const STORE = "roy-declarations.";
const WINDOW_ID = "roy-history";
// Lines shown at once; search to find older ones.
const SHOWN = 100;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// localStorage can be blocked (private windows, site settings); there is then no history.
const store = {
  get(key) { try { return localStorage.getItem(STORE + key); } catch { return null; } },
  set(key, value) { try { value == null ? localStorage.removeItem(STORE + key) : localStorage.setItem(STORE + key, value); } catch {} },
  json(key, fallback) { try { return JSON.parse(this.get(key)) ?? fallback; } catch { return fallback; } }
};

const history = () => store.json("history", []);
const withAction = entry => entry.act ? `*${entry.act}* ${entry.say}` : entry.say;

/** Change the entry saved at `at` (a line's time is its id), or remove it when `change` returns null. */
function update(at, change) {
  const entries = history().flatMap(entry => entry.at !== at ? [entry] : [change(entry)].filter(Boolean));
  store.set("history", JSON.stringify(entries));
}

/** Every saved line as readable text, newest first, starred ones marked. */
function exportText(entries) {
  const starred = entries.filter(entry => entry.starred).length;
  const lines = [
    `${ROY}: declarations`,
    `Exported ${new Date().toLocaleString()} · ${entries.length} line${entries.length === 1 ? "" : "s"}${starred ? ` (${starred} starred)` : ""}`,
    ""
  ];
  for (const entry of entries) {
    lines.push(`${entry.starred ? "★ " : ""}${new Date(entry.at).toLocaleString()}${entry.label ? ` · ${entry.label}` : ""}`, withAction(entry), "");
  }
  return lines.join("\n");
}

/** Copy text to the clipboard: Foundry's helper where there is one, else the browser's. */
async function copyText(text) {
  if (game.clipboard?.copyPlainText) await game.clipboard.copyPlainText(text);
  else await navigator.clipboard.writeText(text);
}

/**
 * The history window. Every message shows inside it, not in Foundry's notifications. Roy's
 * Declarations calls refresh() when it writes a new line while this is open.
 */
class RoyHistory extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: WINDOW_ID,
    classes: ["roy-history"],
    window: { title: `${ROY}: history`, icon: "fa-solid fa-scroll", resizable: true },
    position: { width: 560, height: 640 },
    // Called with the window as `this`.
    actions: {
      copySay(event, button) { this.copy(this.entry(button)?.say); },
      copyAct(event, button) { const entry = this.entry(button); this.copy(entry && withAction(entry)); },
      star(event, button) {
        update(Number(button.closest("[data-at]").dataset.at), entry => ({ ...entry, starred: !entry.starred }));
        this.refresh();
      },
      exportAll() { this.exportAll(); },
      remove(event, button) {
        update(Number(button.closest("[data-at]").dataset.at), () => null);
        this.status("Line deleted.");
        this.refresh();
      }
    }
  };

  async _renderHTML() {
    return `<style>
        .roy-history .window-content { display: flex; flex-direction: column; gap: 8px; }
        .roy-history .roy-row { display: flex; gap: 6px; align-items: center; }
        .roy-history .roy-row input[type=search] { flex: 1; }
        .roy-history .roy-row > button { flex: 0 0 auto; width: auto; }
        .roy-history .roy-row label { flex: 0 0 auto; display: flex; gap: 4px; align-items: center; white-space: nowrap; }
        .roy-history .roy-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
        .roy-history .roy-entry { padding: 6px 8px; border-radius: 4px; background: rgba(127, 127, 127, 0.12); }
        .roy-history .roy-entry p { margin: 2px 0; user-select: text; }
        .roy-history .roy-entry .roy-say { font-size: 1.05em; }
        .roy-history .roy-entry button { flex: 0 0 auto; width: auto; }
        .roy-history .roy-entry .roy-starred { color: #d4a017; }
        .roy-history .roy-status { padding: 6px 8px; border-radius: 4px; background: rgba(127, 127, 127, 0.15); }
        .roy-history .roy-status[data-kind="error"] { outline: 1px solid #c0392b; }
        .roy-history [hidden] { display: none !important; }
      </style>
      <div class="roy-row">
        <input type="search" name="search" placeholder="Search lines, moments and names">
        <label><input type="checkbox" name="starred"> Starred only</label>
        <button type="button" data-action="exportAll" title="Save every line as a text file"><i class="fa-solid fa-file-export"></i> Export</button>
      </div>
      <div class="roy-status" role="status" aria-live="polite" hidden></div>
      <p class="hint roy-count"></p>
      <div class="roy-list"></div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  _onRender() {
    this.find("[name=search]")?.addEventListener("input", () => this.refresh());
    this.find("[name=starred]")?.addEventListener("change", () => this.refresh());
    this.refresh();
    this.find("[name=search]")?.focus();
  }

  find(selector) {
    return this.element?.querySelector(selector) ?? null;
  }

  entry(button) {
    const at = Number(button.closest("[data-at]")?.dataset.at);
    return history().find(entry => entry.at === at);
  }

  /** Redraw the list from what is saved, keeping the search and filter. */
  refresh() {
    const list = this.find(".roy-list");
    if (!list) return;
    const words = (this.find("[name=search]")?.value ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const starredOnly = this.find("[name=starred]")?.checked;
    const entries = history();
    const matches = entries.filter(entry => (!starredOnly || entry.starred)
      && words.every(word => `${entry.label} ${entry.act} ${entry.say}`.toLowerCase().includes(word)));
    const shown = matches.slice(0, SHOWN);
    this.find(".roy-count").textContent = !entries.length
      ? "No lines yet. Lines from Roy's Declarations appear here."
      : `${matches.length} of ${entries.length} lines${matches.length > shown.length ? `, newest ${shown.length} shown: search to find older ones` : ""}.`;
    list.innerHTML = shown.map(entry => `<div class="roy-entry" data-at="${entry.at}">
        <p class="hint">${esc(new Date(entry.at).toLocaleString())}${entry.label ? ` · ${esc(entry.label)}` : ""}</p>
        ${entry.act ? `<p><em>${esc(entry.act)}</em></p>` : ""}
        <p class="roy-say">${esc(entry.say)}</p>
        <div class="roy-row">
          <button type="button" data-action="copySay"><i class="fa-solid fa-copy"></i> Copy words</button>
          <button type="button" data-action="copyAct"><i class="fa-solid fa-copy"></i> Copy with action</button>
          <button type="button" data-action="star" title="${entry.starred ? "Unstar" : "Star to keep"}"><i class="fa-${entry.starred ? "solid roy-starred" : "regular"} fa-star"></i></button>
          <button type="button" data-action="remove" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`).join("");
  }

  /** A message in the window, "error" outlined. */
  status(text, kind = "") {
    const box = this.find(".roy-status");
    if (!box) return;
    box.textContent = text;
    box.dataset.kind = kind;
    box.hidden = !text;
  }

  /** Save every line, whatever the search, to a text file in this browser's downloads. */
  exportAll() {
    const entries = history();
    if (!entries.length) return this.status("No lines to export yet.", "error");
    const name = `roy-declarations-${new Date().toISOString().slice(0, 10)}.txt`;
    const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
    try {
      save(exportText(entries), "text/plain", name);
      this.status(`Exported ${entries.length} line${entries.length === 1 ? "" : "s"} to ${name}.`);
    } catch (error) {
      this.status(`Couldn't export (${error.message}).`, "error");
    }
  }

  async copy(text) {
    if (!text) return;
    try {
      await copyText(text);
      this.status("Copied. Paste it into chat when you're ready.");
    } catch (error) {
      this.status(`Couldn't copy (${error.message}). Select the text and copy it yourself.`, "error");
    }
  }
}

// One window: clicking the macro again brings it back instead of opening another.
const open = foundry.applications.instances?.get(WINDOW_ID);
if (open?.rendered) {
  open.maximize?.();
  open.bringToFront?.();
} else {
  new RoyHistory().render({ force: true });
}
