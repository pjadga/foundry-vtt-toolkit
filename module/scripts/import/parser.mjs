/**
 * Parser for the NotebookLM bundle format. Pure functions, no Foundry globals, so it can be
 * tested with `node --test`. Format: see docs/notebooklm/format.md.
 */

const META_KEYS = new Set(["type", "name", "tags", "replaces"]);

/** Undo the damage copying out of NotebookLM tends to do. */
export function clean(raw) {
  return String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*`{3,}[a-z]*\s*$/gim, "") // code fence lines
    .replace(/[ \t]+$/gm, "") // trailing spaces (Markdown exports end lines with two)
    .replace(/\\([!-\/:-@\[-`{-~])/g, "$1") // backslash-escaped punctuation, e.g. \#\#ENTRY, \[\[Name\]\], 1\)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/ ?(?<!\[)\[[\d,\s–-]*\d[\d,\s–-]*\](?!\])/g, ""); // citations like [1, 2-4]; keeps [[links]]
}

/**
 * Key for matching names loosely, so [[Vance "Hard-Line" Miller"]] (a stray quote NotebookLM
 * produced) still finds Vance "Hard-Line" Miller. Case, quotes and punctuation are ignored.
 */
export function normalizeName(name) {
  return String(name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/^the /, "");
}

/** Extract unique [[link]] targets from a string. */
export function findLinks(text) {
  return [...new Set([...String(text).matchAll(/\[\[([^\]\n]+)\]\]/g)].map(m => m[1].trim()))];
}

/**
 * @param {string} raw Pasted text containing one or more ##ENTRY ... ##END blocks.
 * @returns {{entries: object[], warnings: string[]}}
 */
export function parseBundle(raw) {
  const warnings = [];
  const entries = [];
  const text = clean(raw);
  const blocks = text.split(/^##ENTRY[ \t]*$/m).slice(1);

  if (!blocks.length) {
    warnings.push(
      /##ENTRY\s+\S/.test(text)
        ? "Found ##ENTRY but the line breaks are missing. Copy the output again from the code block."
        : "No ##ENTRY blocks found."
    );
    return { entries, warnings };
  }

  blocks.forEach((block, i) => {
    const label = `Entry ${i + 1}`;
    const endAt = block.search(/^##END[ \t]*$/m);
    if (endAt === -1) warnings.push(`${label}: missing ##END (using everything up to the next entry).`);
    const content = endAt === -1 ? block : block.slice(0, endAt);

    const bodyAt = content.search(/^##BODY[ \t]*$/m);
    const head = bodyAt === -1 ? content : content.slice(0, bodyAt);
    const body = bodyAt === -1 ? "" : content.slice(bodyAt).replace(/^##BODY[ \t]*\n?/, "").trim();
    if (bodyAt === -1) warnings.push(`${label}: missing ##BODY.`);

    const fields = {};
    let last = null;
    for (const line of head.split("\n")) {
      if (!line.trim()) continue;
      const m = line.match(/^([A-Za-z][\w -]*?):[ \t]*(.*)$/);
      if (m) {
        last = m[1].trim().toLowerCase().replace(/[ -]+/g, "_");
        fields[last] = m[2].trim();
      } else if (last) {
        fields[last] += `\n${line.trim()}`; // continuation of a multi-line value
      }
    }

    const type = (fields.type ?? "").toLowerCase();
    const name = fields.name ?? "";
    if (!type) warnings.push(`${label}: missing "type".`);
    if (!name) {
      warnings.push(`${label}: missing "name", skipped.`);
      return;
    }

    const tags = (fields.tags ?? "").split(",").map(t => t.trim()).filter(Boolean);
    const extra = Object.fromEntries(Object.entries(fields).filter(([k]) => !META_KEYS.has(k)));
    const links = findLinks(`${Object.values(extra).join("\n")}\n${body}`);
    // replaces: the name of an earlier entry this one supersedes (from the consistency-check prompt).
    const replaces = fields.replaces?.trim() || null;
    entries.push({ type, name, tags, fields: extra, body, links, replaces });
  });

  // NotebookLM often repeats an entry when revising it; keep the last copy, in its position.
  const last = new Map();
  entries.forEach((e, i) => {
    const key = `${e.type}:${normalizeName(e.name)}`;
    if (last.has(key)) warnings.push(`Duplicate ${e.type} "${e.name}" in this bundle; using the later one.`);
    last.set(key, i);
  });
  const kept = new Set(last.values());
  return { entries: entries.filter((_, i) => kept.has(i)), warnings };
}

/** Replace [[Name]] with a link when the name resolves, otherwise bold text (never leave [[...]] for Foundry's roll enricher). */
export function resolveLinks(markdown, lookup) {
  return String(markdown).replace(/\[\[([^\]\n]+)\]\]/g, (_, raw) => {
    const name = raw.trim();
    const uuid = lookup(name);
    return uuid ? `@UUID[${uuid}]{${name}}` : `**${name}**`;
  });
}

/** "central_conflict" -> "Central conflict" */
export function humanize(key) {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Markdown for a journal page: field list, rule, then the body. */
export function toMarkdown(entry) {
  const lines = Object.entries(entry.fields).map(([k, v]) => `- **${humanize(k)}:** ${v.replace(/\n/g, " ")}`);
  const header = [];
  if (entry.tags.length) header.push(`*Tags: ${entry.tags.join(", ")}*`);
  if (lines.length) header.push(lines.join("\n"));
  return [header.join("\n\n"), entry.body].filter(Boolean).join("\n\n---\n\n");
}
