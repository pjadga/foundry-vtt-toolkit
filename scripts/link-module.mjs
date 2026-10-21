// Symlinks module/ into your Foundry Data/modules folder as "foundry-vtt-toolkit".
// Usage: FOUNDRY_DATA="C:/Users/you/AppData/Local/FoundryVTT/Data" npm run link
import fs from "node:fs";
import path from "node:path";

const data = process.env.FOUNDRY_DATA;
if (!data) { console.error("Set FOUNDRY_DATA to your Foundry Data folder."); process.exit(1); }
const id = JSON.parse(fs.readFileSync("module/module.json", "utf8")).id;
const target = path.join(data, "modules", id);
if (fs.existsSync(target)) { console.log(`${target} already exists, nothing to do.`); process.exit(0); }
fs.symlinkSync(path.resolve("module"), target, "junction");
console.log(`linked ${target}`);
