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
   `[TRUNCATED]`. Keep the answer in the page (`window.__answer = …`) and read it in slices:
   `window.__answer.slice(0, 1000)`, then `slice(1000, 2000)`, and so on until a slice comes back
   short. Slices don't overlap, so join them as they are. Write the joined text to
   `campaigns/<name>/notebooklm/answers/` and check the entry count matches what the page reported.
5. The text has citation numbers on lines of their own. The toolkit's parser strips them, but trim
   the page's button text (keep_pin, Save to note, copy…) yourself.
6. An answer stops after a complete `##END` when it's long. Send `continue` and read again, until the
   entries you asked for are all there.

## Other controls seen

**Create note**, **Save to note** and **Copy** under each answer; a web **Search** (Fast Research) for
new sources; and the **Studio** panel (Audio Overview, Slide Deck, Mind Map, Reports, Flashcards, Quiz,
Infographic, Data Table). The campaign doesn't need them.
