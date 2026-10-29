// Builds the Custom-Macros compendium (macros-module/packs/custom-macros, LevelDB) from macros/. It ships in
// its own module, foundry-vtt-toolkit-macros, so it works on Foundry v12 and without the main toolkit.
// Usage: npm run build:packs, after adding or changing a macro; commit the pack and packs.sha256.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { PACK, macroDocuments, packHash } from "./macro-pack.mjs";

const root = path.resolve(import.meta.dirname, "..");
const macrosDir = path.join(root, "macros");
const files = fs.readdirSync(macrosDir, { recursive: true }).filter(file => file.endsWith(".js"))
  .map(file => ({ path: file.split(path.sep).join("/"), text: fs.readFileSync(path.join(macrosDir, file), "utf8") }));
const documents = macroDocuments(files);

// compilePack reads one JSON file per document.
const source = fs.mkdtempSync(path.join(os.tmpdir(), "fvtk-pack-"));
for (const doc of [...documents.folders, ...documents.macros]) {
  fs.writeFileSync(path.join(source, `${doc._key.split("!")[1]}-${doc._id}.json`), JSON.stringify(doc, null, 2));
}
const dest = path.join(root, "macros-module", "packs", PACK);
fs.rmSync(dest, { recursive: true, force: true });
await compilePack(source, dest);
fs.rmSync(source, { recursive: true, force: true });
// LevelDB's lock and logs are made at run time; Foundry makes its own.
for (const file of ["LOCK", "LOG", "LOG.old"]) fs.rmSync(path.join(dest, file), { force: true });

fs.writeFileSync(path.join(root, "scripts", "packs.sha256"), `${packHash(documents)}  ${PACK}\n`);
console.log(`${PACK}: ${documents.macros.length} macros in ${documents.folders.length} folders`);
