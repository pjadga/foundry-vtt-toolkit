// A tiny local receiver for the campaign-designer skill: the NotebookLM page POSTs a long answer here
// (javascript_tool shows only about 1,000 characters of a result) and it's saved as a file.
//   node scripts/answer-sink.mjs <folder> [port]      then, from the page:
//   fetch("http://127.0.0.1:8765/01-concept.txt", { method: "POST", body: text })
// It listens on 127.0.0.1 only, accepts POSTs from notebook.google.com, writes only plain file names
// inside <folder>, and refuses bodies over 2 MB.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

export const ORIGIN = "https://notebook.google.com";
export const MAX_BYTES = 2_000_000;

/** A file name that stays inside the folder: letters, digits, dots, dashes and underscores. */
export function safeName(url) {
  const name = decodeURIComponent(String(url).split("?")[0].replace(/^\/+/, ""));
  return /^[\w][\w.-]{0,120}$/.test(name) && !name.includes("..") ? name : null;
}

export function createSink(folder) {
  fs.mkdirSync(folder, { recursive: true });
  return http.createServer((request, response) => {
    const headers = {
      "Access-Control-Allow-Origin": ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Private-Network": "true",
      Vary: "Origin"
    };
    const end = (status, text = "") => { response.writeHead(status, { ...headers, "Content-Type": "text/plain" }); response.end(text); };
    if (request.method === "OPTIONS") return end(204);
    if (request.method !== "POST") return end(405, "POST only");
    if (request.headers.origin && request.headers.origin !== ORIGIN) return end(403, "wrong origin");
    const name = safeName(request.url);
    if (!name) return end(400, "bad file name");
    const chunks = [];
    let size = 0;
    request.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BYTES) { end(413, "too big"); request.destroy(); } else chunks.push(chunk);
    });
    request.on("end", () => {
      if (response.writableEnded) return;
      fs.writeFileSync(path.join(folder, name), Buffer.concat(chunks));
      end(200, `saved ${name} (${size} bytes)`);
    });
  });
}

if (process.argv[1]?.endsWith("answer-sink.mjs")) {
  const [folder, port = "8765"] = process.argv.slice(2);
  if (!folder) { console.error("usage: node scripts/answer-sink.mjs <folder> [port]"); process.exit(2); }
  createSink(path.resolve(folder)).listen(Number(port), "127.0.0.1", () => console.log(`saving POSTs to ${path.resolve(folder)} on 127.0.0.1:${port}`));
}
