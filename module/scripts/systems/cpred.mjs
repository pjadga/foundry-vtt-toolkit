import { normalizeName, findLinks } from "../import/parser.mjs";
import { STAT_KEYS, TIERS, tierOf, buildStats, buildSkills, derivedStats, matchGear, npcNotes, wireCyberware } from "./cpred-npc.mjs";
import { itemType, itemChanges, itemDescription } from "./cpred-items.mjs";
import { DEFAULT_STAT, characterStats, characterSkills, roleRank, ledgers, lifepath, characterNotes } from "./cpred-character.mjs";
import { CAMPAIGN_PACKS } from "../import/campaign.mjs";

const MODULE_ID = "foundry-vtt-toolkit";
const SYSTEM_ID = "cyberpunk-red-core";
const NOTES_PATH = "system.information.notes"; // the only text field the mook sheet shows
const DESCRIPTION_PATH = "system.description.value";
const GEAR_TYPES = new Set(["weapon", "armor", "cyberware", "gear", "drug", "clothing", "itemUpgrade", "cyberdeck", "ammo", "program", "vehicle"]);
const EQUIP_TYPES = new Set(["weapon", "armor"]);

export function register(api) {
  // Items first, so NPCs in the same import pick up the custom items by name.
  api.importer.registerType("item", { label: "Items (Cyberpunk RED)", documentName: "Item", folder: "Items", order: 10, import: importItem });
  api.importer.registerType("npc", { label: "NPCs (Cyberpunk RED mook actors)", documentName: "Actor", folder: "NPCs", order: 20, import: importNpc });
  api.importer.registerType("character", { label: "Characters (Cyberpunk RED player characters)", documentName: "Actor", folder: "Characters", order: 20, import: importCharacter });
  Hooks.on("renderActorSheetV2", showSecretsToOwner);
  Hooks.on("renderItemSheetV2", showSecretsToOwner);
  api.log("Cyberpunk RED support registered");
}

/**
 * The system's sheets show notes and descriptions enriched without `secrets`, so secret sections are
 * hidden from everyone outside the editor. For a user who owns the document (the GM, or a player's
 * own character) re-enrich those fields with secrets shown, as core sheets do. Others are untouched.
 */
async function showSecretsToOwner(app, element) {
  const doc = app.document;
  if (!doc?.isOwner) return;
  for (const field of element.querySelectorAll("prose-mirror[name]")) {
    const raw = foundry.utils.getProperty(doc, field.getAttribute("name"));
    const display = field.querySelector(".editor-content");
    if (!display || typeof raw !== "string" || !raw.includes('class="secret"')) continue;
    display.innerHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(raw, { secrets: true, relativeTo: doc, rollData: doc.getRollData?.() });
  }
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

/** Item data for a copy of a compendium or world item. */
async function itemData(uuid) {
  const data = (await fromUuid(uuid)).toObject();
  delete data._id;
  delete data.folder;
  // A copy must not be relinked as if it were the imported original.
  delete data.flags?.[MODULE_ID]?.notes;
  return data;
}

/**
 * NotebookLM "item" entry -> Cyberpunk RED item. The closest compendium item of the same type is the
 * template (so weapon type, skill, DV table and ammo stay valid); the entry's name, price, damage,
 * ROF, SP, penalty and Humanity Loss are applied on top. With no template the item starts from the
 * type's defaults. Replacing an existing item deletes and recreates it with the same id.
 */
async function importItem(entry, ctx) {
  const type = itemType(entry);
  const template = matchGear(entry.name, (await gearIndex()).filter(i => i.type === type));
  const base = template ? await itemData(template.uuid) : { type, system: {} };
  const { changes, used, problems } = itemChanges(entry, type, !!template);

  const raw = itemDescription(entry, used, template?.name ?? null, problems);
  const system = foundry.utils.mergeObject(base.system, foundry.utils.expandObject({ ...changes, "description.value": ctx.notes(raw) }), { inplace: false });
  if (EQUIP_TYPES.has(type) && "equipped" in system) system.equipped = "owned";
  // Not from a book: don't inherit the template's source and page.
  if ("sources" in system) system.sources = [];

  if (ctx.existing) await ctx.existing.delete();
  const [item] = await CONFIG.Item.documentClass.createDocuments(
    [{ ...base, _id: ctx.id, name: entry.name, type, folder: ctx.folder.id, flags: foundry.utils.mergeObject(base.flags ?? {}, ctx.flags, { inplace: false }), system }],
    { keepId: true, pack: ctx.pack }
  );
  await ctx.track(item, DESCRIPTION_PATH, raw);
  return item;
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

  const parts = await actorItems(entry, tier.rank, buildSkills(entry), problems);
  const { hp, humanity, humanityMax, emp } = derivedStats(stats, parts.humanityLoss);
  if (parts.humanityLoss) problems.push(`Cyberware Humanity Loss applied: ${parts.humanityLoss} (static values), so EMP ${stats.emp} → ${emp}.`);

  const raw = npcNotes(entry, parts.gear, problems);
  const system = actorSystem(stats, { hp, humanity, humanityMax, emp }, parts);
  system.information = { notes: ctx.notes(raw) };

  if (ctx.existing) await ctx.existing.delete();
  const actor = await Actor.create(
    { _id: ctx.id, name: entry.name, type: "mook", folder: ctx.folder.id, flags: ctx.flags, system, items: parts.allItems },
    { keepId: true, pack: ctx.pack }
  );
  await ctx.track(actor, NOTES_PATH, raw);
  return actor;
}

/**
 * NotebookLM "character" entry -> Cyberpunk RED player character: stats, skills, role and rank,
 * gear, HP and Humanity as for an NPC (without tier defaults), plus eddies, IP, reputation,
 * lifepath, alias, appearance and backstory. The `player` field names the Foundry user who owns it.
 * Replacing an existing character deletes and recreates it with the same id.
 */
async function importCharacter(entry, ctx) {
  const problems = [];
  const { stats, unknown, missing } = characterStats(entry);
  if (unknown.length) problems.push(`Ignored unknown stats: ${unknown.join(", ")}.`);
  if (missing.length) problems.push(`No value given for ${missing.map(k => k.toUpperCase()).join(", ")}; set to ${DEFAULT_STAT}.`);

  const parts = await actorItems(entry, roleRank(entry), characterSkills(entry), problems);
  const derived = derivedStats(stats, parts.humanityLoss);
  if (parts.humanityLoss) problems.push(`Cyberware Humanity Loss applied: ${parts.humanityLoss} (static values), so EMP ${stats.emp} → ${derived.emp}.`);

  let owner = null;
  const player = entry.fields.player?.trim();
  if (player) {
    owner = game.users.find(u => normalizeName(u.name) === normalizeName(player)) ?? null;
    if (!owner) problems.push(`No Foundry user named "${player}"; give the player ownership by hand.`);
  }

  const raw = characterNotes(entry, parts.gear, problems);
  const html = text => ctx.notes({ public: text, secret: "" });
  const system = actorSystem(stats, derived, parts);
  system.information = {
    alias: entry.fields.alias ?? "",
    description: entry.fields.appearance ? html(entry.fields.appearance) : "",
    history: entry.body ? html(entry.body) : "",
    notes: ctx.notes(raw)
  };
  system.lifepath = Object.fromEntries(Object.entries(lifepath(entry)).map(([k, v]) => [k, html(v)]));
  for (const [key, value] of Object.entries(ledgers(entry))) system[key] = { value, transactions: [] };

  const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };
  if (owner) ownership[owner.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  if (ctx.existing) await ctx.existing.delete();
  const actor = await Actor.create(
    {
      _id: ctx.id, name: entry.name, type: "character", folder: ctx.folder.id, flags: ctx.flags, ownership, system, items: parts.allItems,
      prototypeToken: { name: entry.name, actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY }
    },
    { keepId: true, pack: ctx.pack }
  );
  await ctx.track(actor, NOTES_PATH, raw);
  return actor;
}

/** Stats, HP, Humanity, active role and installed cyberware, as both actor types store them. */
function actorSystem(stats, { hp, humanity, humanityMax, emp }, parts) {
  const system = {
    stats: Object.fromEntries(STAT_KEYS.map(k => [k, { value: stats[k] }])),
    derivedStats: { hp: { max: hp, value: hp }, humanity: { max: humanityMax, value: humanity } },
    roleInfo: { activeRole: parts.roleName },
    // Installed, as the system does for a new actor's cyberware; options sit inside their
    // foundational piece instead (see wireCyberware).
    installedItems: { list: parts.installed }
  };
  system.stats.luck.max = stats.luck;
  system.stats.emp.max = stats.emp;
  system.stats.emp.value = emp;
  return system;
}

/**
 * An actor's items: core skills (with the given levels) and core cyberware, as CPRActor.create would
 * add them, plus the entry's gear and role at the given rank.
 * @returns {Promise<{allItems: object[], roleName: string, gear: object, humanityLoss: number}>}
 */
async function actorItems(entry, rank, skillLevels, problems) {
  // Gear: an imported world item of the same name wins, then the compendium.
  const items = [];
  const gear = { matched: [], missing: [] };
  const wanted = findLinks(entry.fields.gear ?? "");
  if (!wanted.length && entry.fields.gear) wanted.push(...entry.fields.gear.split(",").map(s => s.trim()).filter(Boolean));
  const index = await gearIndex();
  // Custom items from this build are in the NotebookLM Items compendium until the build is added
  // to the world, so look there too.
  const campaignItems = game.packs.get(`world.${CAMPAIGN_PACKS.Item.name}`)?.contents ?? [];
  for (const name of wanted) {
    const world = game.items.find(i => normalizeName(i.name) === normalizeName(name))
      ?? campaignItems.find(i => normalizeName(i.name) === normalizeName(name));
    const hit = world ? { name: world.name, uuid: world.uuid, type: world.type, exact: true } : matchGear(name, index);
    if (!hit) {
      gear.missing.push(name);
      continue;
    }
    const data = await itemData(hit.uuid);
    if (EQUIP_TYPES.has(data.type) && "equipped" in data.system) data.system.equipped = "equipped";
    items.push(data);
    gear.matched.push({ wanted: name, name: hit.name, exact: hit.exact });

    // Armor cyberware (Subdermal Armor, Skin Weave) is two items in this system: the cyberware for
    // Humanity Loss and an armor item of the same name for SP. Add the armor when it exists.
    if (data.type === "cyberware") {
      const armor = index.find(i => i.type === "armor" && normalizeName(i.name) === normalizeName(data.name));
      if (armor && !items.some(i => i.type === "armor" && normalizeName(i.name) === normalizeName(data.name))) {
        const armorData = await itemData(armor.uuid);
        armorData.system.equipped = "equipped";
        items.push(armorData);
      }
    }
  }

  let roleName = "";
  const role = entry.fields.role?.trim();
  if (role && normalizeName(role) !== "civilian") {
    const found = (await packIndex("core_roles")).find(r => normalizeName(r.name) === normalizeName(role));
    if (found) {
      const data = await itemData(found.uuid);
      data.system.rank = rank;
      items.push(data);
      roleName = data.name;
    } else {
      problems.push(`No role "${role}" in the system's roles; none added.`);
    }
  }

  // Core skills and core cyberware, as CPRActor.create would add them, with skill levels applied.
  const coreSkills = (await game.packs.get(`${SYSTEM_ID}.internal_skills`).getDocuments()).map(d => d.toObject());
  for (const { name, level } of skillLevels) {
    const skill = coreSkills.find(s => normalizeName(s.name) === normalizeName(name));
    if (skill) skill.system.level = level;
    else problems.push(`Skill "${name}" is not a core skill; add it by hand.`);
  }
  const coreCyberware = (await game.packs.get(`${SYSTEM_ID}.internal_cyberware-core`)?.getDocuments() ?? []).map(d => d.toObject());
  const { items: allItems, installed } = wireCyberware([...coreSkills, ...coreCyberware, ...items], () => foundry.utils.randomID());

  // Gear cyberware costs its static Humanity Loss (core foundational cyberware costs none).
  const humanityLoss = items.filter(i => i.type === "cyberware").reduce((sum, i) => sum + (Number(i.system.humanityLoss?.static) || 0), 0);
  return { allItems, installed, roleName, gear, humanityLoss };
}
