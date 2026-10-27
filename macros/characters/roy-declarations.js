/**
 * Name:    Roy's Declarations
 * System:  any
 * Foundry: v12, v13
 * Type:    script
 *
 * One window, just for you, that stays open: describe what's happening or click a common moment
 * (Melee hit, Heal ally, Low HP...), and Gemini writes a fresh line for Roy "Slayer" Belmont that
 * fits it, in his voice and mannerisms. The line shows in the same window, with buttons to copy it
 * (with or without the stage direction) and paste it into chat yourself, or ask for another.
 * Targeted tokens are named. Nothing is posted, and nothing shows in Foundry's notifications: no
 * other user sees anything. Every line is kept in this browser for the Roy's History macro.
 *
 * The Rolls page (Sword World 2.5 only) has a button for every dice roll on the character's sheet:
 * each rolls through the sheet as usual, to chat, then Gemini writes a line for how it came out.
 * Settings holds the Gemini key, Always name a move, and Put Roy's line on roll cards (the one
 * setting that shows a line to others: it goes on the roll's chat card).
 *
 * Needs a Gemini API key, entered in the window and kept only in this browser's localStorage for
 * this Foundry site: never in the macro, the world or chat.
 *
 * Install in a game you don't host: docs/macros/roy-declarations.md.
 */

// Party members Roy may name, with only what Roy knows of them so far: he met everyone but Keira
// recently. Keep their secrets and backstories out, or Gemini will have Roy say them. Rename someone
// here, or set a name to "" to leave them out.
const PARTY = {
  keira: { name: "Keira", about: "his beloved adopted younger sister, a petite Drake girl with short cherry-pink hair, pink eyes, large pointy horns and jet-black leathery wings. Three years ago she came out of an ancient magitech portal clutching a sword larger than herself, and his farming family took her in. She wholeheartedly supports his quest to become a hero, and he believes her sweet and innocent" },
  maeve: { name: "Maeve", about: "Maeve Raventhorne, a spellcaster with long, straight black hair and a slender, fragile frame, dressed in purples, blacks or deep scarlet with dyed cloth roses. Her magic is versatile" },
  urist: { name: "Urist", about: "Urist Ironbeard, a young-looking dwarf with exaggerated muscles and an iron-grey beard with red roots. He refuses weapons entirely and fights with his bare fists" },
  una: { name: "Ùna", about: "a young-looking Leprechaun with wolf-like ears, a sturdy frame and medium-length green hair with a single brown streak. A resourceful ruin scavenger, she joined the party through the Adventurer's Guild" }
};

const ROY = 'Roy "Slayer" Belmont';
// Roy's only weapon for now. Change it when he gets a new one, and every line follows.
const WEAPON = "a heavy mace he calls the Star of Retribution";
const GEMINI_MODEL = "gemini-flash-lite-latest";
const STORE = "roy-declarations.";

const PROFILE = `Roy "Slayer" Belmont, an 18-year-old human fighter and priest (Sword World 2.5, Alframe continent).
- Roy keeps his faith to himself: he never speaks of a god or gods, and never says things like "my god", "the power of god" or "may god strike you". He embodies his faith instead: in his own eyes he is practically godlike, and he channels it through his right arm, the Sacred Crusher. "Godly" as an adjective is fine (GODLY CRIMSON STRIKE!). He never mentions vampires or vampire hunters.
- His faith, which he doesn't talk about: the First Sword, who hunted the Eternal Night and mapped Shallow Abysses (spatial rifts). Holy symbol: a spear piercing a dark circle (a Shallow Abyss).
- Looks: pink hair under a feather-trimmed cap, bright blue eyes, polished splint armor with wing motifs, a round shield, ${WEAPON}, his grandfather's silver holy medallion. A pale scar below his left collarbone from shielding village children from a wild boar when he was twelve.
- He is an anime-style chuunibyou: he believes his right arm is possessed by a sealed power (a holy one, never demonic) that strains to break free, and he names it the Sacred Crusher, or his crushing arm, and only ever those (never "my righteous arm", "my glowing arm" or just "my arm"). He grips his right wrist with his left hand to hold it back.
- In combat and when casting spells he shouts a newly named move in capitals (GRAND SLAM OF DESTINY!, ABYSS-SHATTERING STRIKE!, CELESTIAL METEOR CRUSH!, SACRED INTERCEPTION!), sometimes declared like an anime hero ("Taste the…" or "Feel the…" of divine judgment, "through my crushing arm…"), but not always that way. The move's name always comes at the very end of what he says, as its own exclamation ("…every wound! DIVINE MIRACLE OF THE PURE FLAME HEALING!"), never joined to the sentence with "in the", "with the" or "as I unleash". Outside a fight or a spell he speaks without a named move.
- Chuunibyou habits: talks to his weapon like a partner; quotes his grandfather Victor Belmont's hero stories as scripture, by volume and chapter; titles himself the Shield of the Village, the Grandson of the Living Legend. Orders juice, not ale.
- His only weapon right now is ${WEAPON}. He has no blade, sword or other weapon, so never give him one.
- "Slayer" is the adventurer handle he gave himself: in the heat of combat, and when addressing NPCs he doesn't trust, he calls himself Slayer rather than Roy or Roy Belmont. With friends and trustworthy folk he uses his real name.
- His heroism is genuine: a loyal frontline protector who throws himself in front of allies. His greatest fear is failing to protect one. His farming parents think adventuring is nonsense.
- He fights like a retribution paladin: his power is holy, radiant and righteous. Spells: Cure Wounds, Field of Protection, Banish, Sanity, Awaken, Detect Faith, Abyss Ranger. Combat feats: [Cover I] (taking a hit for an ally), [Change Fate] (a reroll).
- His divine magic is celestial and holy, never a warm gold: silver and moonlight laced with crimson-ruby embers, surging across his splint armor, round shield and mace (divine magic needs no free hand). Describe its colours only when his magic is part of the moment, not in every line, and vary the words: scarlet, red, fiery, vermillion, ashen, pale, luminance, starlight, argent, silvery, twinkle, starry, sparkle, twilight, cinders, fire, spark, lustrous, steely, shining.
- Banish and smites: a phantom silver-red spectral spear shoots from his medallion or mace, impales the undead or daemon, then shatters into purifying shards. In a Shallow Abyss (Shallow Judgment, +5 damage) his mace and shield flare with jagged, lance-like edges.
- Cure Wounds and Field of Protection: no gentle shower of light; a swift veil of pale silver threads wraps the target and quickly hardens into a protective barrier.
- Abyss Ranger: his blue eyes flash crimson for a moment, and faint silver compass needles and gridlines etch themselves into the air and floor around his boots, showing hidden hazards, secret passages and safe footing in a rift.`;

// Gemini's system instruction, which it weighs above the request itself.
const TONE = "You write lines for Roy, a holy warrior. The tone is holy and righteous, like a retribution paladin: celestial wrath, radiant judgment, holy vanquishing light, divine retribution. Roy's own power, body, blood and weapons are always holy and radiant, never unholy, dark, shadowy, abyssal, cursed, demonic or corrupted. Darkness, the Abyss, Shallows, undead and daemons are only ever what he fights.";

// Wording that makes Roy sound dark. A line containing it is sent back once; then you see an error.
const OFF_TONE = /\b(unholy|cursed|demonic|profane|blasphemous|eldritch)\b|\b(dark|shadow|shadowy|abyssal|void|corrupt|corrupted|forbidden|sinister|infernal)\s+(energy|power|magic|might|fury|wrath|force|aura|blood|hunger|thirst|flames?|fire|strength)\b/i;

// What he says goes in quotation marks wherever it's shown or copied, apart from what he does.
const quoted = say => `"${say}"`;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// localStorage can be blocked (private windows, site settings); the key is then asked for every time.
const store = {
  get(key) { try { return localStorage.getItem(STORE + key); } catch { return null; } },
  set(key, value) { try { value == null ? localStorage.removeItem(STORE + key) : localStorage.setItem(STORE + key, value); } catch {} },
  json(key, fallback) { try { return JSON.parse(this.get(key)) ?? fallback; } catch { return fallback; } }
};

/**
 * Roy calls his right arm only his crushing arm or the Sacred Crusher, so "my glowing arm", "my
 * restrained limb" or "my arm" in his words becomes "my crushing arm". His shield arm and left arm
 * are other arms.
 */
function crushingArm(say) {
  return say.replace(/\bmy (?:(?!crushing\b|shield\b|left\b)[a-z-]+ )?(?:arm|limb)\b/gi, match => match[0] === "M" ? "My crushing arm" : "my crushing arm");
}

/**
 * Roy keeps his faith to himself, so a god in his words (god, gods, my god, Dreven, the Magic Hunter
 * King) becomes the Sacred Crusher, the arm he channels it through: "may god strike you" reads "may
 * the Sacred Crusher strike you". "Godly" and "god-given" are left alone.
 */
function noGods(say) {
  return say.replace(/\b(?:DREVEN|(?:THE )?MAGIC HUNTER KING|GODS?)('S)?\b(?!-)/g, "THE SACRED CRUSHER$1")
    .replace(/\b(?:my |the |a )?(?:Dreven|(?:the )?Magic Hunter King|gods?)('s)?\b(?!-)/gi, "the Sacred Crusher$1")
    .replace(/(^|[.!?]\s+)the Sacred Crusher/g, "$1The Sacred Crusher");
}

/**
 * The move he shouts stands on its own at the end: "…mend every wound in the DIVINE MIRACLE!" reads
 * "…mend every wound! DIVINE MIRACLE!", and the same for "with the", "through the", "as I enact" and
 * the like.
 */
function moveApart(say) {
  return say.replace(/,?\s+(?:(?:in|with|through|by|of|from|into|via|using) (?:the |my |this )?|(?:as|while|and) I \w+ (?:the |my |this )?)([A-Z][A-Z0-9'’-]*(?: [A-Z0-9'’-]+)+)\s*!*\s*$/,
    (match, move) => `! ${move}!`);
}

async function askGemini(prompt, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: TONE }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: { act: { type: "STRING" }, say: { type: "STRING" } },
            required: ["act", "say"]
          }
        }
      })
    });
    if (!response.ok) {
      const { status } = response;
      throw new Error(status === 429 ? "its free limit is used up for now, HTTP 429"
        : [400, 401, 403].includes(status) ? `the key may be wrong, HTTP ${status}` : `HTTP ${status}`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("") ?? "";
    // A blocked or cut-off answer has no text, which JSON.parse would report as "unexpected end".
    if (!text) {
      const why = data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason;
      throw new Error(why ? `no line, ${why}` : "empty answer");
    }
    const line = JSON.parse(text);
    const act = String(line.act ?? "").trim().slice(0, 200);
    const say = moveApart(noGods(crushingArm(String(line.say ?? "").trim().replace(/^["“]|["”]$/g, "").slice(0, 500))));
    if (!say) throw new Error("empty answer");
    return { act, say };
  } finally {
    clearTimeout(timer);
  }
}

// How Roy may answer, by moment. Gemini picks the one that suits what's happening.
const MOMENTS = `- In a fight: a grandiose battle cry, warning or ultimatum, newly named attack shouted in capitals, shield interception with [Cover I], spell incantation, [Change Fate] after a bad roll, or standing firm while hurt.
- Meeting people: an introduction or greeting with dramatic self-titles, introducing a party member, farm-boy manners with nobles, kindness to frightened folk.
- After a fight or in quiet moments: a victory pose, checking on his companions, talking to his weapon, calming the Sacred Crusher, writing his own saga, ordering juice, or another everyday chuunibyou habit.`;

// Lines that quote Victor's Saga. Gemini overuses them, so a quote is only offered now and
// then, and never when one of his last three lines quoted.
const QUOTES = /"|Volume|Saga/;

// A named move: two or more words in capitals, like GRAND SLAM OF DESTINY.
const MOVE = /\b[A-Z][A-Z'-]+(?: [A-Z'-]+)+\b/g;

async function geminiLine(situation, key, moves) {
  const party = Object.values(PARTY).filter(member => member.name)
    .map(member => `- ${member.name}: ${member.about}`).join("\n");
  const recent = store.json("recent", []);
  // A quote now and then, but not when one of his last few lines quoted.
  const quoting = Math.random() < 0.25 && !recent.slice(0, 3).some(line => QUOTES.test(line));
  // His "Taste the… through my…" declaration is his, but not in every line: after one, the next
  // shouts its move another way.
  const shoutAnotherWay = recent.slice(0, 2).some(line => /\b(taste|feel) the\b|\bthrough my\b/i.test(line))
    ? ' Shout it another way this time, not with the "Taste the…" or "Feel the…" … "through my…" build.' : "";
  // Gemini leans on whatever it has just found: a longer word in two of his last four lines rests for
  // this one. Names, and the words of his move declarations, are kept.
  const keep = new Set(["slayer", "fellowship", "retribution", "belmont", "victor", "judgment",
    ...Object.values(PARTY).map(member => member.name.toLowerCase()),
    "through", "before", "against", "beneath", "within", "toward", "towards", "around", "behind", "across", "forward", "himself"]);
  const lineWords = recent.slice(0, 4).map(line => new Set(line.toLowerCase().match(/[a-z]{6,}/g) ?? []));
  const tired = [...new Set(lineWords.flatMap(words => [...words]))].filter(word => !keep.has(word) && lineWords.filter(words => words.has(word)).length >= 2);
  // Move names from the profile and his recent lines, named in the prompt so they aren't reused.
  const usedMoves = [...new Set([PROFILE, ...recent].flatMap(text => text.match(MOVE) ?? []).filter(move => move.length >= 8))];
  const prompt = [
    "Write the one line this tabletop RPG character says or does right now, fitted to what is happening.",
    `What is happening in the game, as his player describes it: ${situation}`,
    `Choose what suits the moment:\n${MOMENTS}`,
    PROFILE,
    party && `His party. Roy has proclaimed to the Adventurer's Guild that it is called the Slayer's Fellowship; no one agreed, but no one bothered to correct him, so he uses the name with total confidence. Apart from Keira, Roy met them only recently: he treats them as he would any friendly companions, warmly and protectively, with no special history or opinions of them.\n${party}`,
    quoting
      ? "He may quote a volume and chapter of his grandfather Victor's Saga, his grandfather's own hero stories, if it suits."
      : "Don't quote Victor's Saga or any scripture in this line.",
    recent.length && `His recent lines (say something different, with a different stage direction and new move names, in his usual way of speaking):\n${recent.map(line => `- ${line}`).join("\n")}`,
    moves === "always" ? `In this line he shouts a newly named move in capitals, even if this isn't a fight: Always name a move is on, and his chuunibyou names everything he does, eating and resting included. The move's name is the very last thing he says, as its own exclamation ("…every wound! DIVINE MIRACLE OF THE PURE FLAME HEALING!"), never joined to the sentence with "in the", "with the" or "as I unleash".${shoutAnotherWay}`
      : moves === true ? `This is a combat or spell moment: he shouts a newly named move in capitals, as the very last thing he says, as its own exclamation ("…every wound! DIVINE MIRACLE OF THE PURE FLAME HEALING!"), never joined to the sentence with "in the", "with the" or "as I unleash".${shoutAnotherWay}`
      : moves === false ? "This isn't a combat or spell moment, so no named move or battle-cry declaration: he just speaks in character."
      : `Shout a named move only if he attacks, defends or casts a spell here, as the very last thing he says, as its own exclamation ("…every wound! DIVINE MIRACLE OF THE PURE FLAME HEALING!"), never joined to the sentence with "in the", "with the" or "as I unleash".${shoutAnotherWay}`,
    `Use his mannerisms from the profile. If he names a move, invent a new name for it. These move names are already used, so never use them or a close variation: ${usedMoves.join(", ")}.`,
    tired.length && `His recent lines overused these words, so don't use any of them in this line, and don't copy those lines' sentence pattern: ${tired.join(", ")}.`,
    'Return JSON: "act" is a short stage direction in present tense, third person, without his name, under 20 words; "say" is what he says aloud, 1 to 3 sentences, under 60 words, without surrounding quotation marks. Over the top but sincere. Use only facts given here or in the description of the moment; invent no new companions.'
  ].filter(Boolean).join("\n\n");

  // Ask twice at most: a line that makes Roy sound dark is sent back once.
  let offTone = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const retry = offTone ? `\n\nYour last line used "${offTone}". Rewrite it so everything about Roy is holy.` : "";
    const line = await askGemini(prompt + retry, key);
    const text = `${line.act} ${line.say}`;
    offTone = text.match(OFF_TONE)?.[0] ?? null;
    if (offTone) continue;
    store.set("recent", JSON.stringify([text, ...recent].slice(0, 8)));
    return line;
  }
  throw new Error(`its lines kept calling Roy's power "${offTone}"`);
}

// Each category's colour, on its buttons here and on its lines in Roy's History. The groups below are
// the categories; a typed moment (Speak) is Unique, and a line from the Rolls page is Rolls.
const CATEGORIES = {
  Attacking: "#e74c3c", Defending: "#3498db", Healing: "#2ecc71", "Health & Mana": "#9b59b6",
  Roleplay: "#f1c40f", Unique: "#1abc9c", Rolls: "#e67e22"
};

// Moments that come up often, one click each. `target` is the role of the tokens you target: the
// moment names them. Heal self, Preparing and the health and mana moments have none: they are only
// about Roy.
const QUICK = {
  Attacking: [
    { label: "Melee miss", text: `In melee, Roy swings ${WEAPON} at an enemy and misses.`, target: "enemy" },
    { label: "Melee hit", text: `In melee, Roy strikes an enemy with ${WEAPON} and hits.`, target: "enemy" }
  ],
  Defending: [
    { label: "Protect ally", text: "An enemy's attack is aimed at an ally, and Roy throws himself in front of it with [Cover I] to take the hit.", target: "ally" },
    { label: "Block attack", text: "An enemy attacks Roy, and he blocks it, taking no harm.", target: "attacker" },
    { label: "Light wound", text: "Roy takes a light wound, or a few, in the fight: hurt, but far from down.", target: "attacker" },
    { label: "Heavy wound", text: "Roy takes heavy wounds in the fight and is badly hurt, but stays on his feet.", target: "attacker" }
  ],
  Healing: [
    { label: "Heal ally", text: "In the middle of a fight, Roy casts Cure Wounds on a wounded ally.", target: "ally" },
    { label: "Heal self", text: "In the middle of a fight, Roy casts Cure Wounds on himself." },
    { label: "After combat", text: "The fight is over, and Roy casts Cure Wounds to heal the party.", target: "ally" },
    { label: "Before rest", text: "The party is about to rest, and Roy tends everyone's wounds with Cure Wounds first.", target: "ally" }
  ],
  "Health & Mana": [
    { label: "Half HP", text: "Roy is down to half his HP: wounded and battered, but still fighting." },
    { label: "Low HP", text: "Roy is down to less than a quarter of his HP: close to collapse, but refusing to fall." },
    { label: "Half MP", text: "Roy has spent half his MP, the divine power that fuels his spells, and feels it running down." },
    { label: "Low MP", text: "Roy has less than a quarter of his MP left, the divine power that fuels his spells: his holy light is flickering." }
  ],
  Roleplay: [
    { label: "Resting", text: "The party stops to rest, and Roy settles down at camp or at the inn.", target: "ally" },
    { label: "Eating", text: "Roy sits down to a meal, with juice rather than ale.", target: "ally" },
    { label: "Preparing", text: "Roy prepares for what's ahead: exercising, stretching and warming up the Sacred Crusher." },
    { label: "Celebrating", text: "Roy celebrates a victory or good news with all his heart.", target: "ally" }
  ]
};
const QUICK_LIST = Object.entries(QUICK).flatMap(([category, moments]) => moments.map(moment => Object.assign(moment, { category })));

// Lines saved before categories existed get theirs from the moment's name, else Unique.
{
  const saved = store.json("history", []);
  if (saved.some(entry => !entry.category)) {
    const categoryOf = label => QUICK_LIST.find(quick => label === quick.label || label?.startsWith(`${quick.label} · `))?.category ?? "Unique";
    store.set("history", JSON.stringify(saved.map(entry => entry.category ? entry : { ...entry, category: categoryOf(entry.label) })));
  }
}

const PLURAL = { enemy: "enemies", ally: "allies", attacker: "attackers" };
const list = names => names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];

/** "ally" or "enemy" from a token's disposition, else "". */
function side(token) {
  const { FRIENDLY, HOSTILE } = CONST.TOKEN_DISPOSITIONS;
  return { [FRIENDLY]: "ally", [HOSTILE]: "enemy" }[token.document?.disposition] ?? "";
}

/**
 * The tokens this user has targeted, for Gemini and for the window. A quick moment gives them its
 * role ("The allies are Keira and Urist."); a typed moment says what each token is, from its
 * disposition. Nothing for a moment about Roy alone, or with nothing targeted.
 */
function targetText(quick) {
  const targets = [...(game.user.targets ?? [])];
  if (!targets.length || (quick && !quick.target)) return { prompt: "", label: "" };
  const names = targets.map(token => token.name);
  if (quick) {
    const role = names.length > 1 ? `The ${PLURAL[quick.target]} are` : `The ${quick.target} is`;
    return { prompt: ` ${role} ${list(names)}.`, label: list(names) };
  }
  const what = token => side(token) ? ` (an ${side(token)})` : "";
  return { prompt: ` His player has targeted ${list(targets.map(token => token.name + what(token)))}.`, label: list(names) };
}

/**
 * What the moment is: typed, or a quick moment with anything typed added as detail. Returns
 * { prompt } for Gemini, a short { label } for the window and its { category }, or null when there
 * is nothing to go on.
 */
function situationFor(typed, quick) {
  if (!quick && !typed) return null;
  const target = targetText(quick);
  if (!quick) {
    const prompt = target.prompt ? `${typed}${/[.!?]$/.test(typed) ? "" : "."}${target.prompt}` : typed;
    return { prompt, label: [typed, target.label].filter(Boolean).join(" · "), category: "Unique", moves: undefined };
  }
  return {
    prompt: `${quick.text}${target.prompt}${typed ? ` More detail from his player: ${typed}` : ""}`,
    label: [quick.label, target.label, typed].filter(Boolean).join(" · "),
    category: quick.category,
    // Fights and spells (all the healing moments cast Cure Wounds) get a named move; the rest don't.
    moves: ["Attacking", "Defending", "Healing"].includes(quick.category)
  };
}

/** Copy text to the clipboard: Foundry's helper where there is one, else the browser's. */
async function copyText(text) {
  if (game.clipboard?.copyPlainText) await game.clipboard.copyPlainText(text);
  else await navigator.clipboard.writeText(text);
}

// Every line Gemini writes, newest first, for the Roy's History macro. Starred lines are always kept.
const HISTORY_SIZE = 300;
function remember(line, { label, category }) {
  const history = store.json("history", []);
  // The time is the line's id, which a posted line's ★ Star link names.
  line.at = Date.now();
  history.unshift({ at: line.at, label, category, act: line.act, say: line.say });
  let unstarred = 0;
  store.set("history", JSON.stringify(history.filter(entry => entry.starred || ++unstarred <= HISTORY_SIZE)));
  foundry.applications.instances?.get("roy-history")?.refresh?.();
}

// A ★ Star link on a posted line is a Foundry inline roll, so anyone can click it with nothing
// installed: it posts a small self-only roll whose flavor names the line. Foundry still sends it to
// every browser (others see a "privately rolled" stub), so while Roy's Declarations or Roy's History
// is open, his player's browser reads it and stars the line. Keep this in step with the other macro.
const STAR_CARD = /^★ Roy's line starred \(#(\d+)\)$/;
const starFlavor = at => `★ Roy's line starred (#${at})`;
function starFrom(message) {
  const at = Number(STAR_CARD.exec(message.flavor ?? "")?.[1]);
  if (!at) return null;
  const history = store.json("history", []);
  const entry = history.find(line => line.at === at);
  if (!entry || entry.starred) return null;
  entry.starred = true;
  store.set("history", JSON.stringify(history));
  foundry.applications.instances?.get("roy-history")?.refresh?.();
  return { entry, by: (message.author ?? message.user)?.name ?? "Someone" };
}

// Whose sheet the Rolls page reads: your assigned character, or else the actor named ROY.
function rollActor() {
  return game.user.character ?? game.actors.getName(ROY) ?? null;
}

const ROLL_GROUPS = ["Combat", "Checks", "Spells & items", "Class checks"];
const ABILITY_MOD = /\+(Dexterity|Agility|Strength|Vitality|Intelligence|Spirit)Mod$/;

/** A sheet label as a button label: "Fighter+DexterityMod" reads "Fighter + Dexterity". */
function rollLabel(label) {
  return label.replace(/^(.*?)\s*\(Acc\.\)$/, "$1: Accuracy").replace(/^(.*?)\s*\(Power\s*\)$/, "$1: Damage")
    .replace(/^(.*?)\s*\(Check\)$/, "$1: Check").replace(/^Eva\.$/, "Evasion")
    .replace(ABILITY_MOD, (match, ability) => ` + ${ability}`);
}

/**
 * Whether an item's roll is a real one. Every item's details carry a check and a power roll; a
 * spell's check is its casting roll and counts, but anything else needs its dice set up.
 */
function realItemRoll(item, power) {
  if (power) return Boolean(item.system.usepower || (item.type === "spell" && item.system.power));
  return item.type === "spell" || Boolean(item.system.usedice);
}

/**
 * The dice buttons on a Sword World 2.5 character sheet, one per roll, read from the sheet's HTML
 * without opening it. Each keeps its sheet element, so rolling it runs the sheet's own roll code:
 * the same chat card, roll mode and target prompt as clicking it on the sheet.
 */
async function sheetRolls(actor) {
  const sheet = actor.sheet;
  const html = $(await sheet._renderInner(await sheet.getData()));
  const checks = new Set(actor.items.filter(item => item.type === "check").map(item => item.name));
  const rollData = actor.getRollData();
  const itemOf = element => actor.items.get(element.dataset.itemid ?? element.dataset.itemId ?? element.closest("[data-item-id]")?.dataset.itemId)
    ?? actor.items.getName(element.dataset.label.replace(/\s*\((Check|Power\s*|Acc\.)\)$/, ""));
  const seen = new Set();
  const rolls = [];
  for (const element of html.find(".rollable[data-roll], .powerrollable")) {
    const { label } = element.dataset;
    if (!label) continue;
    const power = element.classList.contains("powerrollable");
    const group = element.matches(".attack-display, .deffence-display") ? "Combat"
      : checks.has(label) ? "Checks"
      : ABILITY_MOD.test(label) ? "Class checks"
      : "Spells & items";
    if (group === "Spells & items") {
      const item = itemOf(element);
      if (item && !realItemRoll(item, power)) continue;
    }
    let roll = element.dataset.roll ?? "";
    try { roll = Roll.replaceFormulaData(roll, rollData); } catch {}
    roll = power ? "damage" : roll.replace(/\s+/g, "");
    const key = `${power}|${label}|${roll}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rolls.push({ element, label: rollLabel(label), power, roll, group });
  }
  return rolls;
}

/** Roy's line as it shows on a roll's chat card, under the roll's name. */
const cardLine = line => `<p class="roy-card-line" style="margin: 2px 0 0;">${line.act ? `<em>${esc(line.act)}</em> ` : ""}${esc(quoted(line.say))}
  <a class="inline-roll roll roy-star" data-mode="selfroll" data-formula="0" data-flavor="${esc(starFlavor(line.at))}"
    title="Star this line in Roy's history" style="white-space: nowrap;"><i class="fa-solid fa-star"></i> Star</a></p>`;

/**
 * Roll one sheet roll through the sheet, and return the chat cards it made (none if cancelled).
 * With a `line`, the first card carries it, so it shows to whoever sees the roll.
 */
async function rollOnSheet(actor, roll, line = null) {
  const made = [];
  const hook = Hooks.on("createChatMessage", message => { if (message.isAuthor) made.push(message); });
  let attached = !line;
  const attach = Hooks.on("preCreateChatMessage", message => {
    if (attached) return;
    attached = true;
    message.updateSource({ flavor: `${message.flavor ?? ""}${cardLine(line)}` });
  });
  const event = { currentTarget: roll.element, target: roll.element, preventDefault() {}, stopPropagation() {} };
  try {
    await (roll.power ? actor.sheet._onPowerRoll(event) : actor.sheet._onRoll(event));
    await new Promise(resolve => setTimeout(resolve, 300));
  } finally {
    Hooks.off("createChatMessage", hook);
    Hooks.off("preCreateChatMessage", attach);
  }
  return made;
}

// Weapon and spell rolls get a named move; for checks Gemini decides.
const rollMoves = roll => ["Combat", "Spells & items"].includes(roll.group) || undefined;

/** For Put Roy's line on roll cards: the moment just before the roll, since the line comes first. */
function rollIntent(roll, typed) {
  const what = roll.power ? `a damage roll for ${roll.label}` : roll.label;
  const target = targetText(null);
  const prompt = [
    `Roy is about to make ${what} on his Sword World 2.5 sheet: write what he says and does as he makes it.`,
    "The dice haven't landed yet, so say nothing about how it turns out; never mention dice, rolls or numbers.",
    target.prompt.trim(),
    typed && `More detail from his player: ${typed}`
  ].filter(Boolean).join(" ");
  const label = [roll.label, target.label, typed].filter(Boolean).join(" · ");
  return { prompt, label, category: "Rolls", moves: rollMoves(roll) };
}

/**
 * What a roll came to, from its chat cards: the dice and the card's result ("Critical ▶ 16"), for
 * Gemini and the window. Returns { prompt, label, category: "Rolls" }.
 */
function rollSituation(roll, messages, typed) {
  const results = messages.map(message => {
    const card = document.createElement("div");
    card.innerHTML = message.content;
    const dice = message.rolls[0]?.dice?.[0]?.results.map(die => die.result) ?? [];
    const total = card.querySelector(".diceresult-total")?.textContent.replace(/\s+/g, " ").trim() || String(message.rolls[0]?.total ?? "");
    return { dice, total };
  });
  const first = results[0] ?? { dice: [], total: "" };
  const natural = first.dice.length === 2 ? first.dice[0] + first.dice[1] : null;
  const notes = [];
  if (/Critical/i.test(first.total)) notes.push(roll.power ? "It's a critical: the damage rolls again for more." : "It's a critical: a natural 12, an automatic success.");
  else if (natural === 2) notes.push(roll.power ? "Snake eyes: the blow does no damage at all." : "It's a fumble: a natural 2, an automatic failure.");
  else notes.push("Unless a roll is automatic, the GM decides whether it worked, so don't say it succeeded or failed: react to the attempt itself.");
  notes.push("Write it as what happens in the story; never mention dice, rolls or numbers.");
  const what = roll.power ? `a damage roll for ${roll.label}` : `${roll.label} (${roll.roll})`;
  const target = targetText(null);
  const prompt = [
    `Roy just rolled ${what} on his Sword World 2.5 sheet. The dice came up ${first.dice.join(" and ") || "unknown"}${first.total ? `, and the sheet shows ${first.total}` : ""}.`,
    ...notes,
    target.prompt.trim(),
    typed && `More detail from his player: ${typed}`
  ].filter(Boolean).join(" ");
  const label = [`${roll.label}: ${first.total || "rolled"}`, target.label, typed].filter(Boolean).join(" · ");
  return { prompt, label, category: "Rolls", moves: rollMoves(roll) };
}

const WINDOW_ID = "roy-declarations";

/**
 * The macro's one window. It stays open between lines, and every message (waiting, errors, copied,
 * key saved) shows inside it, not in Foundry's notifications, so it is all private to this user.
 */
class RoyWindow extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: WINDOW_ID,
    classes: ["roy-declarations"],
    window: { title: `${ROY}: what's happening?`, icon: "fa-solid fa-shield-halved", resizable: true },
    position: { width: 520, height: "auto" },
    // Called with the window as `this`.
    actions: {
      speak() { this.speak(null); },
      page(event, button) { this.showPage(button.dataset.page); },
      roll(event, button) { this.rollAndSpeak(this.rolls[button.dataset.roll]); },
      refreshRolls() { this.loadRolls(); },
      quick(event, button) { this.speak(QUICK_LIST[button.dataset.quick]); },
      again() { if (this.retryRoll) this.rollAndSpeak(this.retryRoll); else if (this.last) this.ask(this.last); },
      copySay() { this.copy(this.line && quoted(this.line.say)); },
      copyAct() { this.copy(this.line && (this.line.act ? `*${this.line.act}* ${quoted(this.line.say)}` : quoted(this.line.say))); },
      saveKey() { this.saveKey(); },
      removeKey() {
        store.set("geminiKey", null);
        this.refreshKey();
        this.status("Gemini key removed from this browser.");
      }
    }
  };

  busy = false;
  last = null;
  line = null;
  // The Rolls page's buttons, read from the sheet the first time the page opens.
  rolls = null;
  // A roll whose line (written first, for its card) failed: Ask again tries both again.
  retryRoll = null;

  async _renderHTML() {
    const groups = Object.entries(QUICK).map(([group, moments]) => `<fieldset style="--roy-cat: ${CATEGORIES[group]};"><legend>${esc(group)}</legend>
        <div class="roy-grid">${moments.map(moment => `<button type="button" class="roy-ask" data-action="quick"
          data-quick="${QUICK_LIST.indexOf(moment)}">${esc(moment.label)}</button>`).join("")}</div>
      </fieldset>`).join("");
    return `<style>
        /* On a short screen the window stops at its bottom edge and scrolls inside. */
        .roy-declarations { max-height: calc(100vh - 16px); }
        .roy-declarations .window-content { overflow-y: auto; }
        .roy-declarations .roy-body { display: flex; flex-direction: column; gap: 8px; }
        .roy-declarations .roy-row { display: flex; gap: 6px; align-items: center; }
        .roy-declarations .roy-row input { flex: 1; }
        .roy-declarations .roy-row button { flex: 0 0 auto; width: auto; }
        .roy-declarations .roy-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
        .roy-declarations fieldset legend { color: var(--roy-cat); font-weight: bold; }
        .roy-declarations button[data-action="quick"], .roy-declarations button[data-action="speak"] { border-left: 4px solid var(--roy-cat); }
        .roy-declarations .roy-result { border-left: 4px solid var(--roy-cat, transparent); padding-left: 8px; }
        .roy-declarations fieldset { margin: 0; }
        .roy-declarations .roy-status { padding: 6px 8px; border-radius: 4px; background: rgba(127, 127, 127, 0.15); }
        .roy-declarations .roy-status[data-kind="error"] { outline: 1px solid #c0392b; }
        .roy-declarations .roy-targets { padding: 4px 8px; border-radius: 4px; background: rgba(127, 127, 127, 0.15); }
        .roy-declarations .roy-targets[data-kind="warn"] { outline: 1px solid #d4a017; }
        .roy-declarations .roy-result.roy-stale { opacity: 0.5; }
        .roy-declarations .roy-say { font-size: 1.1em; user-select: text; }
        .roy-declarations .roy-act { user-select: text; }
        .roy-declarations .roy-copy button { flex: 1; }
        .roy-declarations [hidden] { display: none !important; }
        .roy-declarations .roy-tabs { display: flex; gap: 4px; }
        .roy-declarations .roy-tabs button { flex: 1; }
        .roy-declarations .roy-tabs button[aria-pressed="true"] { font-weight: bold; box-shadow: inset 0 -3px 0 var(--roy-cat, #888); }
        .roy-declarations button[data-action="roll"] { border-left: 4px solid ${CATEGORIES.Rolls}; display: flex; justify-content: space-between; gap: 6px; min-width: 0; }
        .roy-declarations button[data-action="roll"] .roy-roll-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .roy-declarations button[data-action="roll"] .hint { flex: 0 0 auto; }
        .roy-declarations .roy-check { display: flex; gap: 6px; align-items: center; font-weight: bold; }
        .roy-declarations fieldset .hint { margin: 2px 0 6px; }
      </style>
      <div class="roy-body">
        <nav class="roy-tabs">
          <button type="button" data-action="page" data-page="moments"><i class="fa-solid fa-comment"></i> Moments</button>
          <button type="button" data-action="page" data-page="rolls" style="--roy-cat: ${CATEGORIES.Rolls};"><i class="fa-solid fa-dice"></i> Rolls</button>
          <button type="button" data-action="page" data-page="settings"><i class="fa-solid fa-gear"></i> Settings</button>
        </nav>
        <p class="roy-page" data-page="moments">Describe the moment and click Speak, or pick a moment below. With a moment, anything typed
        here is added as detail. Targeted tokens are named; check the target line before you click.</p>
        <p class="roy-page" data-page="rolls" hidden>Each button rolls from the sheet, to chat as usual, then Roy reacts
        to how it came out. Anything typed here is added as detail, and targeted tokens are named.</p>
        <div class="roy-row roy-shared">
          <input type="text" name="situation" maxlength="300" value="${esc(store.get("situation") ?? "")}"
            placeholder="e.g. holding a rope bridge against an ogre while Maeve casts">
          <button type="button" class="roy-ask" data-action="speak" style="--roy-cat: ${CATEGORIES.Unique};" title="A typed moment is Unique"><i class="fa-solid fa-bullhorn"></i> Speak</button>
        </div>
        <div class="roy-targets roy-shared" role="status" aria-live="polite"></div>
        <div class="roy-page" data-page="moments">${groups}</div>
        <div class="roy-page roy-rolls" data-page="rolls" hidden></div>
        <div class="roy-page" data-page="settings" hidden>
          <fieldset><legend>Gemini key</legend>
            <p class="hint">A Gemini API key from Google AI Studio. It is kept only in this browser, for this
            Foundry site: not in the macro, the world or chat.</p>
            <div class="roy-row">
              <input type="password" name="key" autocomplete="off">
              <button type="button" data-action="saveKey"><i class="fa-solid fa-check"></i> Save</button>
              <button type="button" data-action="removeKey"><i class="fa-solid fa-trash"></i> Remove</button>
            </div>
          </fieldset>
          <fieldset><legend>Lines</legend>
            <label class="roy-check"><input type="checkbox" name="alwaysMoves"${store.get("alwaysMoves") === "true" ? " checked" : ""}> Always name a move</label>
            <p class="hint">Every line gets a shouted move in capitals, whatever the moment or roll. Off: fights,
            spells and weapon or spell rolls do, and other moments don't.</p>
            <label class="roy-check"><input type="checkbox" name="attachToRolls"${store.get("attachToRolls") === "true" ? " checked" : ""}> Put Roy's line on roll cards</label>
            <p class="hint">On the Rolls page, Roy's line is written first, then the roll is made with the line on
            its chat card, so everyone who sees the roll (as the chat's roll mode allows) sees the line.
            Written before the dice land, it can't react to the result. Off: the line stays private to you
            and reacts to the result.</p>
          </fieldset>
        </div>
        <div class="roy-status" role="status" aria-live="polite" hidden></div>
        <div class="roy-result" hidden>
          <p class="hint roy-for"></p>
          <p class="roy-act"><em></em></p>
          <p class="roy-say"></p>
          <div class="roy-row roy-copy">
            <button type="button" class="roy-ask" data-action="copySay"><i class="fa-solid fa-copy"></i> Copy words</button>
            <button type="button" class="roy-ask" data-action="copyAct"><i class="fa-solid fa-copy"></i> Copy with action</button>
            <button type="button" class="roy-ask" data-action="again"><i class="fa-solid fa-rotate"></i> Another line</button>
          </div>
        </div>
      </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  _onRender() {
    const input = this.find("[name=situation]");
    input?.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); this.speak(null); }
    });
    this.find("[name=key]")?.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); this.saveKey(); }
    });
    for (const name of ["alwaysMoves", "attachToRolls"]) {
      this.find(`[name=${name}]`)?.addEventListener("change", event => {
        store.set(name, event.target.checked ? "true" : null);
        this.status("Setting saved in this browser.");
      });
    }
    this.refreshKey();
    this.showPage(store.get("page") ?? "moments");
    // Keep the target line current while the window is open.
    this.showTargets();
    this.hooks ??= [
      ["targetToken", Hooks.on("targetToken", user => { if (user === game.user) this.showTargets(); })],
      ["canvasReady", Hooks.on("canvasReady", () => this.showTargets())],
      // A ★ Star click on one of his posted lines, by anyone.
      ["createChatMessage", Hooks.on("createChatMessage", message => this.announceStar(starFrom(message)))],
      // The Rolls page follows the sheet: a changed character or item redraws its buttons.
      ...["updateActor", "createItem", "updateItem", "deleteItem"].map(hook => [hook, Hooks.on(hook, document => {
        const actor = document.documentName === "Actor" ? document : document.parent;
        if (this.rolls && actor && actor === rollActor()) this.reloadRolls();
      })])
    ];
    if (!store.get("geminiKey")) {
      this.showPage("settings");
      this.find("[name=key]")?.focus();
      this.status("Paste your Gemini API key and click Save to start.");
    } else input?.focus();
  }

  _onClose(options) {
    super._onClose?.(options);
    for (const [hook, id] of this.hooks ?? []) Hooks.off(hook, id);
    this.hooks = null;
    clearTimeout(this.reloadTimer);
  }

  find(selector) {
    return this.element?.querySelector(selector) ?? null;
  }

  /** Show the Moments, Rolls or Settings page, and remember which. */
  showPage(page) {
    if (!["moments", "rolls", "settings"].includes(page)) page = "moments";
    store.set("page", page);
    for (const part of this.element?.querySelectorAll(".roy-page") ?? []) part.hidden = part.dataset.page !== page;
    for (const part of this.element?.querySelectorAll(".roy-shared") ?? []) part.hidden = page === "settings";
    for (const tab of this.element?.querySelectorAll('[data-action="page"]') ?? []) tab.setAttribute("aria-pressed", String(tab.dataset.page === page));
    if (page === "rolls" && !this.rolls) this.loadRolls();
    this.fit();
  }

  /** Read the character's sheet and draw a button per roll, grouped. */
  async loadRolls() {
    const box = this.find(".roy-rolls");
    if (!box) return;
    this.rolls = [];
    const actor = rollActor();
    const say = html => { box.innerHTML = html; this.fit(); };
    if (game.system.id !== "sw25") return say("<p>The Rolls page reads Sword World 2.5 character sheets, so it isn't available in this game's system.</p>");
    if (!actor) return say(`<p>No character found: assign yours under User Configuration, or name it ${esc(ROY)}.</p>`);
    say(`<p class="hint"><i class="fa-solid fa-spinner fa-spin"></i> Reading ${esc(actor.name)}'s sheet…</p>`);
    try {
      this.rolls = await sheetRolls(actor);
    } catch (error) {
      return say(`<p>Couldn't read ${esc(actor.name)}'s sheet (${esc(error.message)}).</p>`);
    }
    const groups = ROLL_GROUPS.map(group => {
      const buttons = this.rolls.map((roll, index) => roll.group !== group ? "" : `<button type="button" class="roy-ask" data-action="roll"
          data-roll="${index}" title="${esc(`${roll.label} (${roll.roll})`)}"><span class="roy-roll-label">${esc(roll.label)}</span><span class="hint">${esc(roll.roll)}</span></button>`).join("");
      // Weapon and spell names are long, so those get a whole row each.
      const wide = group === "Combat" || group === "Spells & items" ? ' style="grid-template-columns: 1fr;"' : "";
      return buttons && `<fieldset style="--roy-cat: ${CATEGORIES.Rolls};"><legend>${esc(group)}</legend><div class="roy-grid"${wide}>${buttons}</div></fieldset>`;
    }).join("");
    say(`<div class="roy-row"><p class="hint" style="flex: 1; margin: 0;">Rolls from ${esc(actor.name)}'s sheet.</p>
        <button type="button" data-action="refreshRolls" title="Read the sheet again after changing it"><i class="fa-solid fa-rotate"></i> Refresh</button></div>
      ${groups || "<p>The sheet has no rolls to show.</p>"}`);
    this.setBusy(this.busy);
  }

  /** Redraw the roll buttons soon, once a burst of sheet changes has settled. */
  reloadRolls() {
    clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => { if (this.rendered) this.loadRolls(); }, 500);
  }

  /**
   * Roll one sheet roll, then have Gemini write Roy's line for how it came out. With Put Roy's line
   * on roll cards, the line comes first and rides on the roll's chat card instead.
   */
  async rollAndSpeak(roll) {
    if (this.busy || !roll) return;
    if (!store.get("geminiKey")) return this.needKey();
    const actor = rollActor();
    const typed = this.find("[name=situation]")?.value.trim() ?? "";
    let line = null;
    this.retryRoll = null;
    if (store.get("attachToRolls") === "true") {
      this.retryRoll = roll;
      line = await this.ask(rollIntent(roll, typed));
      if (!line) return;
      this.retryRoll = null;
    }
    this.setBusy(true);
    this.status(`Rolling ${roll.label}…`, "busy");
    let messages;
    try {
      messages = await rollOnSheet(actor, roll, line);
    } catch (error) {
      return this.status(`The roll didn't work: ${error.message}`, "error");
    } finally {
      this.setBusy(false);
    }
    if (!messages.length) return this.status(line ? "No roll was made, so Roy's line wasn't posted." : "No roll was made.");
    if (line) return this.status("Rolled, with Roy's line on the chat card.");
    this.ask(rollSituation(roll, messages, typed));
  }

  /** Who is targeted now, so you can check before clicking a moment, or a warning with no one. */
  showTargets() {
    const box = this.find(".roy-targets");
    if (!box) return;
    const targets = [...(game.user.targets ?? [])];
    const what = token => side(token) ? ` (${side(token)})` : "";
    box.dataset.kind = targets.length ? "" : "warn";
    box.innerHTML = targets.length
      ? `<i class="fa-solid fa-bullseye"></i> ${targets.length > 1 ? "Targets" : "Target"}: ${esc(list(targets.map(token => token.name + what(token))))}`
      : '<i class="fa-solid fa-triangle-exclamation"></i> No target selected. Target a token (T) so Roy names them.';
    this.fit();
  }

  /** Say in the window who starred which of his lines. */
  announceStar(star) {
    if (star) this.status(`★ ${star.by} starred "${star.entry.say.split(/\s+/).slice(0, 6).join(" ")}…" in your history.`);
  }

  /** Grow or shrink the window to its content. */
  fit() {
    if (this.rendered) this.setPosition({ height: "auto" });
  }

  /**
   * A message in the window: "busy" with a spinner, "error" outlined, or plain. Empty hides it. With
   * `retry`, an Ask again button asks Gemini again for the same moment (a roll isn't rolled again).
   */
  status(text, kind = "", retry = false) {
    const box = this.find(".roy-status");
    if (!box) return;
    box.innerHTML = text ? `${kind === "busy" ? '<i class="fa-solid fa-spinner fa-spin"></i> ' : ""}${esc(text)}${retry
      ? ' <button type="button" class="roy-ask" data-action="again" style="width: auto; display: inline-flex; margin-left: 6px;"><i class="fa-solid fa-rotate"></i> Ask again</button>' : ""}` : "";
    box.dataset.kind = kind;
    box.hidden = !text;
    this.fit();
  }

  setBusy(busy) {
    this.busy = busy;
    for (const button of this.element?.querySelectorAll(".roy-ask") ?? []) button.disabled = busy;
    this.find(".roy-result")?.classList.toggle("roy-stale", busy);
  }

  /** Clear the key field, and say in it whether a key is saved. */
  refreshKey() {
    const input = this.find("[name=key]");
    if (!input) return;
    input.value = "";
    input.placeholder = store.get("geminiKey") ? "(key saved; paste a new one to replace it)" : "Gemini API key";
  }

  /** No key yet: open Settings at the key field and say so. */
  needKey() {
    this.showPage("settings");
    this.find("[name=key]")?.focus();
    this.status("Roy needs a Gemini API key to speak. Paste one here and click Save.", "error");
    return null;
  }

  saveKey() {
    const value = this.find("[name=key]")?.value.trim();
    if (!value) return this.status("Paste a key into the field first.", "error");
    store.set("geminiKey", value);
    this.refreshKey();
    this.status("Gemini key saved in this browser.");
  }

  speak(quick) {
    if (this.busy) return;
    this.retryRoll = null;
    const typed = this.find("[name=situation]")?.value.trim() ?? "";
    const situation = situationFor(typed, quick);
    if (!situation) return this.status("Describe what's happening, or pick a moment, so Roy's line fits it.", "error");
    store.set("situation", typed || null);
    const untargeted = quick?.target && !game.user.targets?.size;
    this.ask(situation, untargeted ? " No target selected, so he won't name anyone." : "");
  }

  /** Have Gemini write Roy's line for a moment and show it. Returns the line, or null. */
  async ask(situation, note = "") {
    if (this.busy) return null;
    const key = store.get("geminiKey");
    if (!key) return this.needKey();
    this.last = situation;
    this.setBusy(true);
    this.status(`Roy is finding his words for: ${situation.label}.${note} Gemini usually takes 5 to 20 seconds.`, "busy");
    try {
      const moves = store.get("alwaysMoves") === "true" ? "always" : situation.moves;
      const line = await geminiLine(situation.prompt, key, moves);
      remember(line, situation);
      this.showLine(line, situation);
      this.status("");
      return line;
    } catch (error) {
      const reason = error.name === "AbortError" ? "no answer within 45 seconds" : error.message;
      this.status(`Roy has no line: Gemini couldn't answer (${reason}).${this.retryRoll ? " Nothing was rolled." : ""}`, "error", true);
      return null;
    } finally {
      this.setBusy(false);
    }
  }

  showLine(line, { label, category }) {
    const result = this.find(".roy-result");
    if (!result) return;
    this.line = line;
    result.querySelector(".roy-for").textContent = `${category} · ${label}`;
    result.style.setProperty("--roy-cat", CATEGORIES[category]);
    result.querySelector(".roy-act").hidden = !line.act;
    result.querySelector(".roy-act em").textContent = line.act;
    result.querySelector(".roy-say").textContent = quoted(line.say);
    result.hidden = false;
    this.fit();
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
  new RoyWindow().render({ force: true });
}
