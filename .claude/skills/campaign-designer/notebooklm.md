# Driving NotebookLM (Gemini Notebook) in the browser

NotebookLM has no consumer API, so you drive its web page with the Claude in Chrome tools
(`mcp__claude-in-chrome__*`, loaded with ToolSearch; read the `chrome-browser` skill first). This guide
is from tests on 28 October 2026. The site is now called **Gemini Notebook**, at
`https://notebook.google.com`. Google can change it at any time: find controls by their labels, and
when one is missing, stop and tell the user.

## Setup and rules

- The user drives this from **Microsoft Edge** (the profile they're signed in to Google in), with the
  Claude in Chrome extension installed and signed in. Check with
  `list_connected_browsers`; if it's empty, or drops mid-run, say so and wait. Don't retry in a loop.
- **The user signs in to Google.** Never type a password. A sign-in page means stop and ask.
- Open your own tab (`tabs_context_mcp`, then `navigate`); close it when done.
- **Only touch a notebook you created** for the campaign, or one the user names. Never edit, delete or
  reconfigure another. Create notebooks named `<Campaign name>`; `QA Campaign Designer` is the user's
  test notebook, which they keep.
- Ask before uploading a file, and name it. Never download or delete anything without being told.
- `computer` `wait` is 10 seconds at most. Several actions in a row go in `browser_batch`.

## Create a notebook

On the home page, `find` "New notebook button" and click it. It opens `…/notebook/<id>` as "Untitled
notebook". Triple-click the title textbox (`find` "notebook title textbox"), type the name, press
Return. Keep the notebook's URL for later runs.

## Add a source

Click **Add sources** (`find` "Add sources button"). The dialog offers Upload files, Websites, Play Books,
Drive and **Copied text**.

- **Pasted text** (best for the bible and any text you wrote): click **Copied text**, then
  `form_input` the textbox named "Pasted text" (setting the value enables **Insert**), then click
  **Insert** (`find` it, or click its coordinates in a screenshot). The source appears in the Sources
  list, named from its first words. Keep one source under a few hundred KB.
- **Files (PDFs and others)**: the **Upload files** button opens a native file picker you can't use,
  and the page has no file input until it's clicked. Catch the input instead:
  1. In the page (`javascript_tool`), hook the click so the picker never opens:
     ```js
     window.__captured = [];
     HTMLInputElement.prototype.click = function () {
       if (this.type === "file") { window.__captured.push(this); return; }
       return HTMLElement.prototype.click.apply(this, arguments);
     };
     ```
  2. Click **Upload files** with a real click (`find` it, then `computer` `left_click` with the `ref`;
     a click from page JavaScript doesn't work).
  3. Label the captured input so `find` can see it:
     `const i = window.__captured.at(-1); i.setAttribute("aria-label", "Notebook upload input"); i.style.cssText = "position:fixed;top:0;left:0;width:20px;height:20px;opacity:0.01;z-index:99999;display:block"`.
  4. `find` "Notebook upload input", then `file_upload` with its `ref` and `paths`.
  5. Do these steps again for each upload (the input is new each time).
  - `file_upload` only reads project folders: put files in `campaigns/<name>/sources/`, not Downloads
    or the scratch folder. One call takes about 10 MB, so send big PDFs one at a time.
  - A page reload clears the hook; install it again after navigating.
  - Wait for the spinner next to each file to become a checkmark before querying. A 6 MB PDF took
    about 20 seconds. The "N sources" count by the query box shows how many are in.
- A synthetic drop event on the drop zone is ignored, so don't use it.

## Chat configuration (Prompt 0)

Click the **⋮** next to Share (`find` "Notebook configuration button"), choose **Configure Chat**, click
**Custom**, `form_input` the textbox "Custom prompt to control the chat response" with the contents of
`notebooklm/prompt-0.txt`, check the counter (it must read under 10000), then click **Save**
(`find` "Save settings"). Response length: **Longer** suits campaign entries.

## Run a query and read the answer

1. `form_input` the **Query box** with the query, then click **Submit** (`find` "Query box textbox and
   Submit button").
2. Poll until it's done: `wait` 10 s at a time, then `javascript_tool` on
   `document.body.innerText`. The page shows a status line that changes ("Thinking...", "Developing NPC
   Details...") and a `stop` button while it works; it's done when the text has "Reply ready." Short
   answers take about 15 seconds; four full entries took about 30.
3. Read the answer from the page text. The chat reads in order, your query and then its answer, so
   take the text after the last copy of your query and stop at the answer's buttons:
   ```js
   const t = document.body.innerText;
   const after = t.slice(t.lastIndexOf(queryStart) + queryStart.length); // queryStart: its first words
   after.slice(after.indexOf("##ENTRY"), after.indexOf("\nkeep_pin"))
   ```
   (An answer that isn't entries has no `##ENTRY`; take from "Reply ready." back instead.)
   `get_page_text` reads the wrong part of this page, and `find` / `read_page` split an answer into
   many elements, so use `innerText`.
4. **`javascript_tool` shows only about 1,000 characters of a result** and marks the rest
   `[TRUNCATED]`, and campaign answers run 7 to 18 KB. Use the answer receiver instead (next
   section). For a short answer, `window.__answer = …` and `slice(0, 1000)`, `slice(1000, 2000)`… works.
5. The text has citation numbers on lines of their own. The toolkit's parser strips them, but trim
   the page's button text (keep_pin, Save to note, copy…) yourself.
6. An answer stops after a complete `##END` when it's long. Send `continue` and read again, until the
   entries you asked for are all there.

## Other controls seen

**Create note**, **Save to note** and **Copy** under each answer; a web **Search** (Fast Research) for
new sources; and the **Studio** panel (Audio Overview, Slide Deck, Mind Map, Reports, Flashcards, Quiz,
Infographic, Data Table). The campaign doesn't need them.

## Long answers: the answer receiver

`node scripts/answer-sink.mjs campaigns/<name>/notebooklm/answers 8765` (start it in the background)
listens on 127.0.0.1 and saves whatever the page POSTs to it as a file. It accepts only
`notebook.google.com`, plain file names and 2 MB. **The first time, Edge asks the user to allow the
site to reach a local device; a post made before they click Allow just hangs** (the page's JavaScript
times out after 45 s). Ask them to look for the prompt, and probe with an 8-second timeout first.

Two helpers, defined once per page load with `javascript_tool` (they are lost when the page reloads):

```js
// Send a query: set the box's value the way the page expects, then press Submit.
window.__ask = async (text) => {
  const box = [...document.querySelectorAll("textarea")].find(x => x.placeholder?.includes("Ask a question"));
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
  box.focus(); set.call(box, text); box.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  [...document.querySelectorAll("button")].filter(b => b.getAttribute("aria-label") === "Submit").at(-1).click();
};
// Wait for the answer to finish, then POST everything from the first ##ENTRY to the answer's buttons.
window.__grab = async (queryStart, file, seconds = 40) => {
  let stable = 0, last = -1;
  for (let i = 0; i < seconds; i++) {
    const t = document.body.innerText, after = t.slice(t.lastIndexOf(queryStart) + queryStart.length);
    const s = after.indexOf("##ENTRY"), e = after.indexOf("keep_pin", s);
    const working = /\nstop\n/.test(after) || /Responding\.\.\./.test(after);
    if (s >= 0 && e > s && !working) { stable = after.length === last ? stable + 1 : 0; last = after.length; if (stable >= 2) {
      const text = after.slice(s, e).trimEnd();
      await fetch("http://127.0.0.1:8765/" + file, { method: "POST", body: text });
      return { entries: (text.match(/##ENTRY/g) ?? []).length, ends: (text.match(/##END/g) ?? []).length };
    } }
    await new Promise(r => setTimeout(r, 1000));
  }
  return { waiting: true };
};
```

Send with `await __ask("…")`, then `await __grab("first words of the query", "NN-name.txt", 40)`; if it
returns `waiting`, call `__grab` again (a `javascript_tool` call times out near 45 s, so ask for at
most about 40 seconds per call). Check `entries` equals `ends` and the count you asked for. An answer
can take 30 seconds to over a minute; one query for 17 NPCs was too long to finish in one answer, so
ask for 8 or 9 entries at a time. A reply with no entries (a plain "nothing to fix") has no `##ENTRY`,
so read it from the page text instead.

## Batching uploads

Once the Add sources dialog's positions are known (screenshot frame 1568 wide: **Add sources** at about
(110, 117), **Upload files** at about (618, 368)), one `browser_batch` does the whole cycle: click Add
sources, wait, click Upload files (a real click, which creates the input), wait, run the label script on
`window.__captured.at(-1)`, then `find` the input. Then `file_upload` and `wait` 10 s. Five small files
can go in one call; PDFs go one per call (about 7 to 8 MB each, split first). A cycle is three calls.
