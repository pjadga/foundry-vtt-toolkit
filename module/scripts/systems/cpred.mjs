import { normalizeName, findLinks } from "../import/parser.mjs";
import { STAT_KEYS, TIERS, tierOf, buildStats, buildSkills, derivedStats, matchGear, npcNotes } from "./cpred-npc.mjs";

const SYSTEM_ID = "cyberpunk-red-core";
const NOTES_PATH = "system.information.notes"; // the only text field the mook sheet shows
const GEAR_TYPES = new Set(["weapon", "armor", "cyberware", "gear", "drug", "clothing", "itemUpgrade", "cyberdeck", "ammo", "program"]);
const EQUIP_TYPES = new Set(["weapon", "armor"]);

export function register(api) {
  api.importer.registerType("npc", { label: "NPCs (Cyberpunk RED mook actors)", documentName: "Actor", folder: "NPCs", import: importNpc });
  api.log("Cyberpunk RED support registered");
}

let gearIndexCache;
/** Gear-type items from the system's core compendiums: [{name, uuid, type}]. */
function gearIndex() {
  gearIndexCache ??= (async () => {
    const out = [];
    for (const pack of game.packs) {
      if (pack.metadata.packageName !== SYSTEM_ID || pack.documentName !== "Item" || !pack.collection.includes(".core_")) continue;
      for (const e of await pack.getIndex({ fields: ["type"] })) if (GEAR_TYPES.has(e.type)) out.push({ name: e.name, uuid: e.uuid, type: e.type });
    }
    return out;
  })();
  return gearIndexCache;
}

async function packIndex(name) {
  return game.packs.get(`${SYSTEM_ID}.${name}`)?.getIndex() ?? [];
}

/** Item data for an embedded copy of a compendium or world item. */
async function itemData(uuid) {
  const data = (await fromUuid(uuid)).toObject();
  delete data._id;
  delete data.folder;
  return data;
}

/**
 * NotebookLM "npc" entry -> Cyberpunk RED mook with the core skills and core cyberware a new mook
 * gets, plus role, gear, stats, HP, skill levels and notes. Replacing an existing NPC deletes and
 * recreates it with the same id.
 *
 * The whole actor is built here and created in one call. CPRActor.create only adds core items
 * when no `system` data is given, and on that path it drops the items passed in and resolves
 * before the actor is in game.actors.
 */
async function importNpc(entry, ctx) {
  const problems = [];
  const tier = TIERS[tierOf(entry)];
  const { stats, unknown } = buildStats(entry);
  if (unknown.length) problems.push(`Ignored unknown stats: ${unknown.join(", ")}.`);

  // Gear: an imported world item of the same name wins, then the compendium.
  const items = [];
  const gear = { matched: [], missing: [] };
  const wanted = findLinks(entry.fields.gear ?? "");
  if (!wanted.length && entry.fields.gear) wanted.push(...entry.fields.gear.split(",").map(s => s.trim()).filter(Boolean));
  const index = await gearIndex();
  for (const name of wanted) {
    const world = game.items.find(i => normalizeName(i.name) === normalizeName(name));
    const hit = world ? { name: world.name, uuid: world.uuid, type: world.type, exact: true } : matchGear(name, index);
    if (!hit) {
      gear.missing.push(name);
      continue;
    }
    const data = await itemData(hit.uuid);
    if (EQUIP_TYPES.has(data.type) && "equipped" in data.system) data.system.equipped = "equipped";
    items.push(data);
    gear.matched.push({ wanted: name, name: hit.name, exact: hit.exact });
  }

  let roleName = "";
  const role = entry.fields.role?.trim();
  if (role && normalizeName(role) !== "civilian") {
    const found = (await packIndex("core_roles")).find(r => normalizeName(r.name) === normalizeName(role));
    if (found) {
      const data = await itemData(found.uuid);
      data.system.rank = tier.rank;
      items.push(data);
      roleName = data.name;
    } else {
      problems.push(`No role "${role}" in the system's roles; none added.`);
    }
  }

  // Core skills and core cyberware, as CPRActor.create would add them, with skill levels applied.
  const coreSkills = (await game.packs.get(`${SYSTEM_ID}.internal_skills`).getDocuments()).map(d => d.toObject());
  for (const { name, level } of buildSkills(entry)) {
    const skill = coreSkills.find(s => normalizeName(s.name) === normalizeName(name));
    if (skill) skill.system.level = level;
    else problems.push(`Skill "${name}" is not a core skill; add it by hand.`);
  }
  const coreCyberware = (await game.packs.get(`${SYSTEM_ID}.internal_cyberware-core`)?.getDocuments() ?? []).map(d => d.toObject());
  const allItems = [...coreSkills, ...coreCyberware, ...items].map(({ _id, folder, ...data }) => ({ ...data, _id: foundry.utils.randomID() }));

  // Gear cyberware costs its static Humanity Loss (core foundational cyberware costs none).
  const humanityLoss = items.filter(i => i.type === "cyberware").reduce((sum, i) => sum + (Number(i.system.humanityLoss?.static) || 0), 0);
  const { hp, humanity, humanityMax, emp } = derivedStats(stats, humanityLoss);
  if (humanityLoss) problems.push(`Cyberware Humanity Loss applied: ${humanityLoss} (static values), so EMP ${stats.emp} → ${emp}.`);

  const raw = npcNotes(entry, gear, problems);
  const system = {
    stats: Object.fromEntries(STAT_KEYS.map(k => [k, { value: stats[k] }])),
    derivedStats: { hp: { max: hp, value: hp }, humanity: { max: humanityMax, value: humanity } },
    information: { notes: ctx.notes(raw) },
    roleInfo: { activeRole: roleName },
    // Installed, as the system does for a new actor's cyberware.
    installedItems: { list: allItems.filter(i => i.type === "cyberware").map(i => i._id) }
  };
  system.stats.luck.max = stats.luck;
  system.stats.emp.max = stats.emp;
  system.stats.emp.value = emp;

  if (ctx.existing) await ctx.existing.delete();
  const actor = await Actor.create(
    { _id: ctx.id, name: entry.name, type: "mook", folder: ctx.folder.id, flags: ctx.flags, system, items: allItems },
    { keepId: true }
  );
  await ctx.track(actor, NOTES_PATH, raw);
  return actor;
}
