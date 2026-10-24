/**
 * Name:    Roy's Declarations
 * System:  any
 * Foundry: v12, v13
 * Type:    script
 *
 * Posts a chuunibyou line from Roy "Slayer" Belmont to chat, as his token (with a chat bubble),
 * his assigned character, or the user. Click for a menu; Shift-click for a battle cry, Ctrl-click
 * for an introduction, Alt-click for a victory pose or quirk. Lines follow the chat's roll mode:
 * Public Roll posts to everyone, Self Roll whispers to you only (handy for a preview).
 *
 * Lines come from the bank below, shuffled so none repeats until the rest have been used. With a
 * Gemini API key saved in this browser (the key button in the menu), "Fresh line from Gemini" asks
 * Gemini for a new one instead, fitted to "What's happening?" if you fill it in, and falls back to the
 * bank if that fails. The key is kept only in
 * this browser's localStorage for this Foundry site: never in the macro, the world or chat.
 *
 * Install in a game you don't host: docs/macros/roy-declarations.md.
 */

// Read modifier keys before the first await, while the hotbar click is still the current event.
const clickEvent = globalThis.event;
const held = (key, flag) => Boolean(clickEvent?.[flag]) || Boolean(game.keyboard?.isModifierActive?.(key));
const shortcut = held("Shift", "shiftKey") ? "combat"
  : held("Control", "ctrlKey") ? "greeting"
  : held("Alt", "altKey") ? "victory"
  : null;

// Party members named in some lines. Rename them here, or set a name to "" to drop their lines.
const PARTY = {
  keira: { name: "Keira", about: "his adopted little sister, whom he believes sweet and innocent" },
  urist: { name: "Urist", about: "Urist Ironbeard, a dwarf brawler who has sworn off weapons and fights bare-fisted" },
  maeve: { name: "Maeve", about: "a masked spellcaster in the rearguard who wears dyed cloth roses" },
  clusti: { name: "Clusti", about: "a fellow adventurer" }
};

const ROY = 'Roy "Slayer" Belmont';
const GEMINI_MODEL = "gemini-flash-lite-latest";
const STORE = "roy-declarations.";

const KINDS = {
  combat: {
    label: "Battle cry",
    icon: "fa-solid fa-khanda",
    brief: "combat declaration: a grandiose battle cry, warning, named attack, shield interception or spell incantation, before or during a fight",
    // Gemini gets one focus per request, so fresh lines don't all take the same shape.
    focus: [
      "a newly named mace attack, shouted in capitals",
      "a finishing blow on a defeated foe",
      "a critical hit as holy power surges through him",
      "a warning or ultimatum to the enemy before the fight",
      "taking a hit meant for an ally with [Cover I]",
      "shrugging off a blow with his shield and armor",
      "casting Cure Wounds on a wounded ally",
      "casting Field Protection over the party",
      "casting Banish on undead or daemons",
      "invoking [Change Fate] after a bad roll",
      "the Sacred Crusher, his right arm, straining with holy power",
      "a short exchange with his mace, the Star of Retribution",
      "quoting a volume and chapter of his grandfather Victor's Saga",
      "quoting one of Dreven's sayings word for word",
      "standing his ground while badly hurt",
      "shouting encouragement to a named party member"
    ]
  },
  greeting: {
    label: "Introduction",
    icon: "fa-solid fa-crown",
    brief: "introduction or greeting: Roy presenting himself or his party, with dramatic self-titles",
    focus: [
      "introducing himself with a string of self-titles",
      "entering a tavern or the Adventurers' Guild",
      "introducing a named party member",
      "presenting the Slayer's Fellowship as a whole",
      "greeting a frightened villager or child",
      "greeting a noble or guildmaster with farm-boy manners",
      "meeting a rival adventurer",
      "explaining why he shakes hands with his left",
      "introducing his mace, the Star of Retribution",
      "mentioning his grandfather Victor's letter of recommendation",
      "greeting the party at the start of a new day"
    ]
  },
  victory: {
    label: "Victory & quirks",
    icon: "fa-solid fa-trophy",
    brief: "victory pose or out-of-combat quirk: a post-fight pose, or one of his everyday chuunibyou habits",
    focus: [
      "a heroic victory pose with his feathered cap",
      "thanking Dreven after the battle",
      "checking that every companion is unhurt",
      "praising a named party member",
      "polishing or talking to his mace",
      "calming the Sacred Crusher after the fight",
      "writing tonight's chapter of his own saga",
      "ordering juice in a tavern",
      "his scar and what it taught him",
      "a letter home to his farming parents",
      "a campfire story from his grandfather's Saga",
      "haggling with a merchant or blacksmith",
      "sensing danger, or a trap, on the road",
      "counting the loot with great ceremony"
    ]
  }
};

// [stage direction, spoken line]. {keira}, {urist}, {maeve} and {clusti} become the party names above.
const BANK = {
  combat: [
    ["Grips his right wrist with his left hand, straining against an unseen force.", "Halt, creature of darkness! My right arm, the Sacred Crusher, surges with divine fury, and even I can barely hold it back! Flee while you still can!"],
    ["Levels the Star of Retribution at the foe and tips his feathered cap.", "As Volume 2, Chapter 9 of Victor Belmont's Saga foretold: \"Those who stand against the shield of righteousness shall be ground into dust!\" Do not make me write your final chapter!"],
    ["Plants his round shield in the dirt, a hand over the silver medallion of Dreven.", "By the tenets of Dreven the Hunter King, I offer you one chance to retreat. Refuse it, and the pale silver light of destiny shall pierce you through!"],
    ["Raises his mace high as silver-crimson embers flare along his armor.", "Steel yourself, fiend! What comes next is my ultimate technique! GRAND SLAM OF DESTINY!!"],
    ["Slaps his chestplate with a ringing clang and strikes a heroic stance.", "Look upon this pink hair and golden-winged armor and tremble! You face the SlayArm and his legendary Fellowship!"],
    ["Charges in without breaking stride.", "Dreven's scripture commands: \"First move, then think. Before it's too late!\" SACRED CRUSHER, CHARGE!!"],
    ["Swings the mace in a wide, whistling arc.", "By Dreven's spear, my crushing arm shall not be denied! ABYSS-SHATTERING STRIKE!"],
    ["Steps between {maeve} and the enemy, shield raised high.", "Foolish creature! Did you think the SlayArm would let you touch my allies? SACRED INTERCEPTION!"],
    ["Braces behind his shield as the blow lands, then grins.", "My granddad took a dragon's claw to the chest and laughed! Your strike is but a breeze!"],
    ["Shrugs off the hit with a rattle of splint armor.", "Ha! Your feeble claws bounce off the Titan-Forged Aegis of Righteousness! Is that all you've got?!"],
    ["Throws himself in front of {keira}, arms spread wide.", "Stay behind me, {keira}! Not one claw shall touch my little sister while Belmont blood still flows!"],
    ["Lays a glowing palm on a wounded ally as pale silver threads knit the wound shut.", "Surge forth, divine embers of vitality! Mend this mortal flesh and reignite this warrior's soul! HEAVENLY RESURRECTION TOUCH!"],
    ["Slams the butt of his mace down; a dome of silver starlight rises over the party.", "Aegis of the Hunter King! Raise a barrier of radiant starlight around my valiant Fellowship! DIVINE SHIELD OF DREVEN!"],
    ["Thrusts the medallion forward and a spectral silver-red spear lances out.", "Abyssal filth! By the spear that pierces the dark, return to the void whence you spawned! HOLY ABYSSAL EXORCISM!"],
    ["Snaps his fingers before a dazed ally's eyes in a flash of silver light.", "Shatter, illusions of darkness! The Belmont eye sees through your deceit! PURIFYING TRUTH PULSE!"],
    ["His eyes flash crimson as faint silver gridlines etch themselves across the floor.", "My hunter's instinct awakens! Shadows of this place, yield your secrets to my burning eyes! EYES OF THE HUNTER KING!"],
    ["Glares at the dice of fate and invokes [Change Fate].", "No! This timeline is rejected! Fate itself shall bend to my unyielding strike! RE-STRIKE OF DESTINY!"],
    ["Brings the mace down with impossible force.", "The Belmont blood boils over! Feast your eyes on true heroism: CELESTIAL METEOR CRUSH!!"],
    ["Leaps and brings the mace down in a two-handed slam.", "When cornered by the night, strike harder! So says Volume 4, Chapter 12 of my grandfather's Saga! SHATTERING COMET SLAM!"],
    ["Staggers, down to his last breath, and still stands.", "One hit point is all a Belmont needs! A hero does not fall while there is someone left to protect!"],
    ["Stands over the fallen foe and holds his feathered cap aloft.", "And so another dark legend falls before Roy \"Slayer\" Belmont. Rest now, monster."],
    ["Taps the Star of Retribution resting on his shoulder.", "Hush now, my iron companion. Your time to shatter the darkness has come."],
    ["Clenches his fist over his heart.", "Can you feel it, fiend? The ancient Slayer blood in my veins roars like a trapped tempest!"],
    ["Steps forward as the enemy twists into a second form.", "A second form? Splendid! Every true legend has a Phase Two, and every Phase Two ends the same way: beneath my mace!"],
    ["Shouts back to the rearguard over the clash of steel.", "Keep casting, {maeve}! Volume 3 of my granddad's Saga decrees: \"A master of the ancient arts in the rearguard makes the frontline invincible!\""],
    ["Nods to {urist} as they close in side by side.", "{urist}! Your fists, my mace! Together we are hammer and anvil! FORWARD!"],
    ["Peers into the dark rift, shield first.", "\"Shallows is a cancer that erodes the world!\" Today, the SlayArm performs the divine surgery!"],
    ["Points his mace up at the hulking monster.", "The bigger they are, the more glorious the chapter! Come, beast! Your size only makes my legend grander!"],
    ["Catches the incoming spell on his shield in a burst of silver sparks.", "Magic, steel or claw, it makes no difference! The Iron Bulwark of Fate takes them all!"],
    ["Waves {clusti} into his shadow with a sweep of his shield.", "{clusti}, strike from behind my shield! As long as I stand, no blade shall find you!"],
    ["Raises his voice so the whole battlefield can hear.", "Hear me, minions of the dark! \"Ordinary measures do not work on Shallows. Be prepared. Be creative!\" Behold my creativity: I am going to hit you very, very hard!"],
    ["Draws the enemy away from the wounded with a ringing shield bash.", "Over here, coward! Your quarrel is with the Shield of the Village, not with them!"],
    ["Fumbles the swing, spins in a full circle, then poses as if he meant it.", "A feint! A diversionary manoeuvre from Volume 5 of the Saga! You were... meant to see that."]
  ],
  greeting: [
    ["Sweeps off his feathered cap with a deep bow.", "Greetings! I am Roy \"Slayer\" Belmont, grandson of the Living Legend Victor Belmont and sworn hammer of Dreven the Hunter King!"],
    ["Kicks the tavern door open and strides in.", "Landlord! Bring your finest nectar! The Slayers have arrived to claim their next legend!"],
    ["Grips his right wrist and offers a handshake with his left.", "Forgive me, I shake with my left. My right arm is the Sacred Crusher, and I would hate to destroy you by accident."],
    ["Plants his fists on his hips in his most heroic pose.", "You may call me the SlayArm! Or Roy. Roy is also fine."],
    ["Taps the silver medallion at his neck.", "Dreven, Magic Hunter King, slayer of the Eternal Night! And before you stands his humble champion."],
    ["Gestures grandly at the party behind him.", "Behold! The Slayer's Fellowship! Sworn to hunt down every Shallow Abyss that dares to scar this land!"],
    ["Pats {keira} on the head with obvious pride.", "And this is my little sister, {keira}! Sweet, innocent and pure of heart. Harm her, and you answer to me."],
    ["Claps {urist} on the shoulder.", "This is {urist}, who fights with nothing but his bare fists! A warrior so pure he refuses even a single blade!"],
    ["Bows toward {maeve} with exaggerated respect.", "Our arcane strategist, {maeve}! Her spells strike true, and her roses are always perfectly arranged."],
    ["Presents {clusti} with a flourish.", "And {clusti}, a valued member of our Fellowship, whose deeds will fill many chapters to come!"],
    ["Strikes a pose in the guild hall doorway.", "Guildmaster! Mark this day in your records: Roy \"Slayer\" Belmont has entered your halls!"],
    ["Pats the satchel that holds the wax-sealed letter.", "I bear a letter from my grandfather, Victor Belmont himself! I'm certain it is a glowing recommendation. Certain!"],
    ["Raises the Star of Retribution in salute.", "Allow me to introduce my partner, the Star of Retribution! She has crushed many foes, and she is also very polite."],
    ["Lays a hand over his heart and bows to the worried townsfolk.", "Fear not, good citizens! The Shield of the Village has arrived! Whatever troubles you, consider it already crushed!"],
    ["Shakes a startled villager's hand vigorously.", "A pleasure! You may tell your grandchildren you once shook hands with a future legend."],
    ["Adjusts his cap so the feather catches the light.", "Some call me a farm boy. Others call me the Grandson of the Living Legend. Destiny calls me... Slayer."],
    ["Unrolls an imaginary scroll and clears his throat.", "Allow me to recite my titles! Roy \"Slayer\" Belmont, the SlayArm, the Shield of the Village, Consecrated Hammer of Dreven, and undefeated champion of the harvest festival pie toss!"],
    ["Meets the rival adventurer's eyes and smirks.", "So, you are the rival destiny has sent me. Very well! May the chapter of our meeting be worthy of the Saga!"],
    ["Greets the priest of another god with a respectful nod.", "Hail, servant of the gods! I walk the path of Dreven, who hunted the dark so that mortals could walk in the light."],
    ["Leans over the merchant's counter and lowers his voice.", "I seek gear worthy of a hero. Show me your finest... and your most reasonably priced."],
    ["Kneels to a frightened child's eye level.", "Do not be afraid, little one. I am Roy, and protecting folks like you is what I was born to do."],
    ["Bows stiffly before the noble.", "My lord! Roy Belmont of the Slayer's Fellowship, at your service. My manners were taught by farmers, but my courage was taught by legends."],
    ["Tips his cap to the party as the morning sun rises.", "Good morrow, Fellowship! A new chapter dawns! Let us write it boldly!"],
    ["Raises his mace in greeting as he spots an old foe.", "We meet again! I hope you have trained, for I have certainly grown stronger since our last chapter!"],
    ["Holds up his scratched shield for inspection.", "Every mark on this shield is a story. Ask me about any of them. Please. I beg you."],
    ["Waves {keira} over across the crowded square.", "{keira}! Over here! Your big brother has found us an inn worthy of legends!"]
  ],
  victory: [
    ["Rests the mace on his shoulder and adjusts his feathered cap, gazing into the distance.", "Another chapter, written in steel and starlight. Granddad would be proud."],
    ["Strikes a pose atop the largest fallen foe.", "Witness, world! The Slayer's Fellowship stands victorious, and the darkness grows smaller by one!"],
    ["Kneels and presses the medallion of Dreven to his forehead.", "Hunter King, this victory is yours. \"One's actions prove one's truth.\""],
    ["Checks on each companion in turn, counting under his breath.", "Everyone is still standing. Good. That is the only victory that truly matters."],
    ["Polishes the Star of Retribution with a cloth, murmuring to it.", "You fought well today, my iron companion. Rest. Tomorrow there is more darkness to shatter."],
    ["Grips his trembling right wrist.", "Calm yourself, Sacred Crusher. The battle is over. ...It still burns with holy retribution. Truly, the burden of the chosen."],
    ["Pulls out a small notebook and scribbles furiously.", "A note for the Saga: the beast fell to a GRAND SLAM OF DESTINY. Its size I shall record as roughly three times larger."],
    ["Orders at the tavern counter with great ceremony.", "Landlord! Your finest juice, chilled! A hero's thirst must be quenched with purity!"],
    ["Absently touches the pale scar beneath his collarbone.", "Armor can break. Shields can shatter. But a guardian's heart never yields."],
    ["Lies back by the campfire, hands behind his head.", "Did I ever tell you about Volume 6 of my granddad's Saga? The one with the giant and the haystack? ...No? Then settle in!"],
    ["Pauses at a fork in the road and sniffs the air.", "My dangersense tingles. The left path reeks of ancient malice... or possibly a pig farm. Hard to say."],
    ["Writes a letter home by lamplight.", "Dear Mother and Father. I have slain a monster. Yes, again. No, I am not coming home to harvest the turnips."],
    ["Pats {keira} on the head after the battle.", "Were you frightened, {keira}? Don't worry. Your big brother will always protect you from the dark!"],
    ["Flexes beside {urist} after the fight.", "{urist}, your fists are a marvel! Truly, a body forged into a weapon needs no other!"],
    ["Offers {maeve} a hand over the rubble.", "Your spellcraft was magnificent, {maeve}. And look, not a single rose out of place."],
    ["Raises his mace to the sky as the sun breaks through.", "The light returns! As it always will, so long as the Slayer's Fellowship stands!"],
    ["Insists on carrying everyone's packs.", "Give them here! A shield bears burdens. That is what shields are for!"],
    ["Practises victory poses in a puddle's reflection.", "No... the cap angled further... yes. That is the pose of a man who has slain a beast."],
    ["Clutches his heart after a narrow escape.", "Too close. Volume 7, Chapter 1 warns: \"A hero does not block with his armor alone; he blocks with the very soul of his bloodline!\""],
    ["Bows to the defeated foe's remains.", "You fought with honor, monster. Or at least with a great many teeth. Either way, I salute you."],
    ["Argues earnestly with a blacksmith over his dented shield.", "You say the dent cannot be hammered out? Nonsense. That dent is merely the shield remembering its glory!"],
    ["Counts the loot with great solemnity.", "Seventeen silver pieces and one slightly cursed spoon. The Fellowship prospers!"],
    ["Raises his cup of juice to the party as the evening winds down.", "Rest well, Fellowship. Tomorrow, another chapter. Tonight, we celebrate this one!"],
    ["Whirls on a rustling bush with his shield up, then relaxes as a rabbit hops out.", "Stand down! It is merely a rabbit. ...A rabbit that knows it was spared by the SlayArm."],
    ["Shares his rations with a stray dog by the road.", "Even the smallest creature deserves protection. Dreven hunted monsters, not puppies."],
    ["Addresses the rescued villagers from atop a cart.", "You are safe now! And should darkness return, shout the name Roy \"Slayer\" Belmont three times. I will probably hear it."],
    ["Holds up a hand to refuse the reward, then slowly takes it.", "Gold? I could never... well. For the Fellowship's provisions, then. Heroes must eat."],
    ["Points his mace at something glinting in the ruins.", "The ancients left a mark here. Or a trap. Possibly both. Fellowship, stay behind me!"],
    ["Rubs the medallion while staring up at the night sky.", "Somewhere out there, Granddad is already telling this story. I had better make it worth the telling."],
    ["Turns to {clusti} with a grin as the dust settles.", "{clusti}! That was a deed worthy of its own chapter! I shall tell the whole Guild of it!"],
    ["Steps out of the dungeon into the sunlight, squinting heroically.", "\"Do not be deceived by tranquility.\" But it is very nice tranquility. We may enjoy it for a moment."],
    ["Eyes an unopened chest with deep suspicion, mace raised.", "Is this chest a mimic? There is only one way to find out. Everyone, stand back!"]
  ]
};

const PROFILE = `Roy "Slayer" Belmont, an 18-year-old human fighter and priest of Dreven, the Magic Hunter King (Sword World 2.5, Alframe continent).
- Dreven: a minor god of the First Sword, once a vampire hunter, who hunted the Eternal Night and mapped Shallow Abysses (spatial rifts). Holy symbol: a spear piercing a dark circle.
- Looks: pink hair under a feather-trimmed cap, bright blue eyes, polished splint armor with wing motifs, a round shield, a heavy mace he calls the Star of Retribution, his grandfather's silver medallion of Dreven. A pale scar below his left collarbone from shielding village children from a wild boar when he was twelve.
- Chuunibyou habits: calls his right arm "the Sacred Crusher" and grips his wrist to hold back its power; names every move in capitals (GRAND SLAM OF DESTINY!, ABYSS-SHATTERING STRIKE!, CELESTIAL METEOR CRUSH!, SACRED INTERCEPTION!); talks to his mace like a partner; quotes his grandfather Victor Belmont's hero stories as scripture, by volume and chapter; titles himself the SlayArm, the Shield of the Village, the Grandson of the Living Legend. Orders juice, not ale.
- His heroism is genuine: a loyal frontline protector who throws himself in front of allies. His greatest fear is failing to protect one. His farming parents think adventuring is nonsense.
- He fights like a retribution paladin: his power is holy, radiant and righteous, and his divine magic blazes as silver-white celestial light and spears of holy light. Spells: Cure Wounds, Field Protection, Banish, Sanity, Abyss Ranger. Combat feats: [Cover I] (taking a hit for an ally), [Change Fate] (a reroll).`;

// Gemini's system instruction, which it weighs above the request itself.
const TONE = "You write lines for Roy, a holy warrior. The tone is holy and righteous, like a retribution paladin: celestial wrath, radiant judgment, holy vanquishing light, divine retribution. Roy's own power, body, blood and weapons are always holy and radiant, never unholy, dark, shadowy, abyssal, cursed, demonic or corrupted. Darkness, the Abyss, Shallows, undead and daemons are only ever what he fights.";

// Wording that makes Roy sound dark. A fresh line containing it is asked for again, then replaced from the bank.
const OFF_TONE = /\b(unholy|cursed|demonic|profane|blasphemous|eldritch)\b|\b(dark|shadow|shadowy|abyssal|void|corrupt|corrupted|forbidden|sinister|infernal)\s+(energy|power|magic|might|fury|wrath|force|aura|blood|hunger|thirst|flames?|fire|strength)\b/i;

// Only sent to Gemini when the focus is quoting Dreven, so other lines don't all quote him.
const DREVEN_SAYINGS = `Dreven's sayings: "One's actions prove one's truth." "First move, then think. Before it's too late." "Ordinary measures do not work on Shallows. Be prepared. Be creative." "Do not be deceived by tranquility. Burn with determination and follow through!"`;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// localStorage can be blocked (private windows, site settings); the macro still works without it.
const store = {
  get(key) { try { return localStorage.getItem(STORE + key); } catch { return null; } },
  set(key, value) { try { value == null ? localStorage.removeItem(STORE + key) : localStorage.setItem(STORE + key, value); } catch {} },
  json(key, fallback) { try { return JSON.parse(this.get(key)) ?? fallback; } catch { return fallback; } }
};

/** The kind's lines with party names filled in, leaving out lines that name a blank member. */
function linesFor(kind) {
  const lines = [];
  for (const pair of BANK[kind]) {
    let missing = false;
    const [act, say] = pair.map(text => text.replace(/\{(\w+)\}/g, (match, id) => {
      const name = PARTY[id]?.name;
      if (!name) missing = true;
      return name ?? match;
    }));
    if (!missing) lines.push({ act, say });
  }
  return lines;
}

/** Shuffle-bag pick: every line once before any repeats, and never the same line twice in a row. */
function bankLine(kind) {
  const lines = linesFor(kind);
  const bags = store.json("bags", {});
  let bag = bags[kind];
  if (!bag || bag.size !== lines.length || !bag.order?.length) {
    const order = [...lines.keys()];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.length > 1 && order[0] === bag?.last) order.push(order.shift());
    bag = { size: lines.length, order, last: bag?.last };
  }
  const index = bag.order.shift();
  bags[kind] = { ...bag, last: index };
  store.set("bags", JSON.stringify(bags));
  return lines[index];
}

async function geminiLine(kind, key) {
  const party = Object.values(PARTY).filter(member => member.name)
    .map(member => `- ${member.name}: ${member.about}`).join("\n");
  const recent = store.json("recent", []);
  const situation = store.get("situation");
  const focus = KINDS[kind].focus[Math.floor(Math.random() * KINDS[kind].focus.length)];
  const quoting = /quoting|Saga/.test(focus);
  const examples = linesFor(kind).filter(line => quoting || !/"|Volume|Saga/.test(line.say))
    .sort(() => Math.random() - 0.5).slice(0, 4)
    .map(line => `- act: ${line.act} | say: ${line.say}`).join("\n");
  const prompt = [
    `Write one new ${KINDS[kind].brief} for this tabletop RPG character. This time, focus on ${focus}.`,
    PROFILE,
    focus.includes("Dreven's sayings") && DREVEN_SAYINGS,
    party && `His party, the Slayer's Fellowship:\n${party}`,
    situation && `What is happening in the game right now, as his player describes it: ${situation}\nFit the line to this moment. If the focus above doesn't suit it, drop the focus.`,
    quoting
      ? "Dreven's sayings are Dreven's; the Saga is his grandfather's own hero stories, so never credit one to the other."
      : "Don't quote Dreven, scripture or Victor's Saga in this line.",
    `Style examples (write something different):\n${examples}`,
    recent.length && `Do not repeat these recent lines:\n${recent.map(say => `- ${say}`).join("\n")}`,
    "If he names a move, invent a new name for it; don't reuse a move name from the profile, the examples or the recent lines. Vary the stage direction too, rather than having him raise his mace.",
    'Return JSON: "act" is a short stage direction in present tense, third person, without his name, under 20 words; "say" is what he says aloud, 1 to 3 sentences, under 60 words, without surrounding quotation marks. Over the top but sincere. Use only facts given here; invent no new companions.'
  ].filter(Boolean).join("\n\n");

  // Ask twice at most: a line that makes Roy sound dark is sent back once, then the bank is used.
  let offTone = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const retry = offTone ? `\n\nYour last line used "${offTone}". Rewrite it so everything about Roy is holy.` : "";
    const line = await askGemini(prompt + retry, key);
    offTone = `${line.act} ${line.say}`.match(OFF_TONE)?.[0] ?? null;
    if (offTone) continue;
    store.set("recent", JSON.stringify([`${line.act} ${line.say}`, ...recent].slice(0, 8)));
    return line;
  }
  throw new Error(`its lines kept saying "${offTone}"`);
}

async function askGemini(prompt, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
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
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("") ?? "";
    const line = JSON.parse(text);
    const act = String(line.act ?? "").trim().slice(0, 200);
    const say = String(line.say ?? "").trim().replace(/^["“]|["”]$/g, "").slice(0, 500);
    if (!say) throw new Error("empty answer");
    return { act, say };
  } finally {
    clearTimeout(timer);
  }
}

async function editKey() {
  const saved = Boolean(store.get("geminiKey"));
  const value = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Gemini key for Roy's Declarations", icon: "fa-solid fa-key" },
    content: `<p>Paste a Gemini API key from Google AI Studio. It is kept only in this browser, for this
      Foundry site: not in the macro, the world or chat.${saved ? " A key is saved now." : ""}
      Leave the field empty to remove it.</p>
      <input type="password" name="key" autocomplete="off" placeholder="${saved ? "(key saved)" : "Gemini API key"}">`,
    ok: { label: "Save", callback: (event, button) => button.form.elements.key.value.trim() },
    rejectClose: false
  });
  if (value == null) return;
  store.set("geminiKey", value || null);
  ui.notifications.info(value ? "Gemini key saved in this browser." : "Gemini key removed from this browser.");
}

async function chooseKind() {
  while (true) {
    const useGemini = store.get("useGemini") === "1";
    const situation = store.get("situation") ?? "";
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: `${ROY}: declarations`, icon: "fa-solid fa-shield-halved" },
      position: { width: 560 },
      content: `<div class="roy-declarations">
          <p>What does Roy declare?</p>
          <label><input type="checkbox" name="gemini" ${useGemini ? "checked" : ""}> Fresh line from Gemini</label>
          <div class="roy-situation">
            <p><label>What's happening? (optional)
              <input type="text" name="situation" maxlength="300" value="${esc(situation)}"
                placeholder="e.g. holding a rope bridge against an ogre while Maeve casts"></label></p>
            <p class="hint">Kept until you clear it, so the hotbar shortcuts use it too.</p>
          </div>
          <p class="hint">Hotbar shortcuts: Shift-click for a battle cry, Ctrl-click for an introduction,
            Alt-click for a victory pose or quirk.</p>
        </div>`,
      buttons: [
        ...Object.entries(KINDS).map(([action, kind]) => ({ action, label: kind.label, icon: kind.icon })),
        { action: "random", label: "Random", icon: "fa-solid fa-dice", default: true },
        { action: "key", label: "Key", icon: "fa-solid fa-key" }
      ].map(button => ({
        ...button,
        callback: (event, element) => {
          const { gemini, situation } = element.form.elements;
          store.set("useGemini", gemini.checked ? "1" : "0");
          store.set("situation", situation.value.trim() || null);
          return button.action;
        }
      })),
      // Show the situation field only while the Gemini box is ticked. Dialogs drop <style> tags.
      render: () => {
        const root = document.querySelector(".roy-declarations");
        const box = root?.querySelector("[name=gemini]");
        const field = root?.querySelector(".roy-situation");
        if (!box || !field) return;
        const sync = () => { field.style.display = box.checked ? "" : "none"; };
        box.addEventListener("change", sync);
        sync();
      },
      rejectClose: false
    });
    if (choice !== "key") return choice;
    await editKey();
  }
}

let kind = shortcut ?? await chooseKind();
if (!kind) return;
if (kind === "random") kind = Object.keys(KINDS)[Math.floor(Math.random() * 3)];

let line = null;
if (store.get("useGemini") === "1") {
  if (!store.get("geminiKey")) await editKey();
  const key = store.get("geminiKey");
  if (key) {
    try {
      line = await geminiLine(kind, key);
    } catch (error) {
      const reason = error.name === "AbortError" ? "timed out" : error.message;
      ui.notifications.warn(`No fresh line from Gemini (${reason}), so Roy used a line from the bank.`);
    }
  }
}
line ??= bankLine(kind);
if (!line) return ui.notifications.warn("Roy has no lines of that kind. Check the party names in the macro.");

// Speak as Roy's token if one is on the scene, else as his character, else as the user under his name.
const character = game.user.character;
const controlled = canvas.ready ? canvas.tokens.controlled : [];
const token = controlled.find(t => character && t.actor === character)
  ?? (character && canvas.ready ? character.getActiveTokens()[0] : null)
  ?? controlled[0];
const speaker = token ? ChatMessage.getSpeaker({ token: token.document })
  : character ? ChatMessage.getSpeaker({ actor: character })
  : ChatMessage.getSpeaker({ alias: ROY });

// Follow the chat's roll mode, so Self Roll previews a line privately. Bubbles only for public lines.
const message = ChatMessage.applyRollMode({
  speaker,
  style: CONST.CHAT_MESSAGE_STYLES.IC,
  flavor: line.act ? `<em>${esc(line.act)}</em>` : "",
  content: `<p>${esc(line.say)}</p>`
}, game.settings.get("core", "rollMode"));
try {
  await ChatMessage.create(message, { chatBubble: !message.whisper?.length });
} catch (error) {
  ui.notifications.error(`Roy's line couldn't be posted to chat: ${error.message}`);
}
