/**
 * Name:    Roy's Declarations
 * System:  any
 * Foundry: v12, v13
 * Type:    script
 *
 * Asks what's happening, then has Gemini write a fresh line for Roy "Slayer" Belmont that fits the
 * moment, in his voice and mannerisms, and shows it to you only. Copy the words (or the words with
 * the stage direction) and paste them into chat if you want them; nothing is posted for you.
 * Gemini chooses what suits the moment: a battle cry, named attack or spell in a fight, an
 * introduction when meeting people, a victory pose or quirk afterwards. "Another line" asks again
 * for the same moment.
 *
 * Needs a Gemini API key, asked for the first time and kept only in this browser's localStorage for
 * this Foundry site: never in the macro, the world or chat. If Gemini can't answer, the reason is
 * shown.
 *
 * Install in a game you don't host: docs/macros/roy-declarations.md.
 */

// Party members Roy may name. Rename them here, or set a name to "" to leave someone out.
const PARTY = {
  keira: { name: "Keira", about: "his adopted little sister, whom he believes sweet and innocent" },
  urist: { name: "Urist", about: "Urist Ironbeard, a dwarf brawler who has sworn off weapons and fights bare-fisted" },
  maeve: { name: "Maeve", about: "a masked spellcaster in the rearguard who wears dyed cloth roses" },
  clusti: { name: "Clusti", about: "a fellow adventurer" }
};

const ROY = 'Roy "Slayer" Belmont';
const GEMINI_MODEL = "gemini-flash-lite-latest";
const STORE = "roy-declarations.";

const PROFILE = `Roy "Slayer" Belmont, an 18-year-old human fighter and priest of Dreven, the Magic Hunter King (Sword World 2.5, Alframe continent).
- Dreven: a minor god of the First Sword, once a vampire hunter, who hunted the Eternal Night and mapped Shallow Abysses (spatial rifts). Holy symbol: a spear piercing a dark circle.
- Looks: pink hair under a feather-trimmed cap, bright blue eyes, polished splint armor with wing motifs, a round shield, a heavy mace he calls the Star of Retribution, his grandfather's silver medallion of Dreven. A pale scar below his left collarbone from shielding village children from a wild boar when he was twelve.
- Chuunibyou habits: calls his right arm "the Sacred Crusher" and grips his wrist to hold back its power; names every move in capitals (GRAND SLAM OF DESTINY!, ABYSS-SHATTERING STRIKE!, CELESTIAL METEOR CRUSH!, SACRED INTERCEPTION!); talks to his mace like a partner; quotes his grandfather Victor Belmont's hero stories as scripture, by volume and chapter; titles himself the SlayArm, the Shield of the Village, the Grandson of the Living Legend. Orders juice, not ale.
- His heroism is genuine: a loyal frontline protector who throws himself in front of allies. His greatest fear is failing to protect one. His farming parents think adventuring is nonsense.
- He fights like a retribution paladin: his power is holy, radiant and righteous, and his divine magic blazes as silver-white celestial light and spears of holy light. Spells: Cure Wounds, Field Protection, Banish, Sanity, Abyss Ranger. Combat feats: [Cover I] (taking a hit for an ally), [Change Fate] (a reroll).`;

// Gemini's system instruction, which it weighs above the request itself.
const TONE = "You write lines for Roy, a holy warrior. The tone is holy and righteous, like a retribution paladin: celestial wrath, radiant judgment, holy vanquishing light, divine retribution. Roy's own power, body, blood and weapons are always holy and radiant, never unholy, dark, shadowy, abyssal, cursed, demonic or corrupted. Darkness, the Abyss, Shallows, undead and daemons are only ever what he fights.";

// Wording that makes Roy sound dark. A line containing it is sent back once; then you see an error.
const OFF_TONE = /\b(unholy|cursed|demonic|profane|blasphemous|eldritch)\b|\b(dark|shadow|shadowy|abyssal|void|corrupt|corrupted|forbidden|sinister|infernal)\s+(energy|power|magic|might|fury|wrath|force|aura|blood|hunger|thirst|flames?|fire|strength)\b/i;

// Only offered to Gemini now and then, so his lines don't all quote Dreven.
const DREVEN_SAYINGS = `Dreven's sayings: "One's actions prove one's truth." "First move, then think. Before it's too late." "Ordinary measures do not work on Shallows. Be prepared. Be creative." "Do not be deceived by tranquility. Burn with determination and follow through!"`;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// localStorage can be blocked (private windows, site settings); the key is then asked for every time.
const store = {
  get(key) { try { return localStorage.getItem(STORE + key); } catch { return null; } },
  set(key, value) { try { value == null ? localStorage.removeItem(STORE + key) : localStorage.setItem(STORE + key, value); } catch {} },
  json(key, fallback) { try { return JSON.parse(this.get(key)) ?? fallback; } catch { return fallback; } }
};
// Left over from the version with built-in lines and a Gemini toggle.
store.set("bags", null);
store.set("useGemini", null);

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

// How Roy may answer, by moment. Gemini picks the one that suits what's happening.
const MOMENTS = `- In a fight: a grandiose battle cry, warning or ultimatum, newly named attack shouted in capitals, shield interception with [Cover I], spell incantation, [Change Fate] after a bad roll, or standing firm while hurt.
- Meeting people: an introduction or greeting with dramatic self-titles, introducing a party member, farm-boy manners with nobles, kindness to frightened folk.
- After a fight or in quiet moments: a victory pose, checking on his companions, talking to his mace, calming the Sacred Crusher, writing his own saga, ordering juice, or another everyday chuunibyou habit.`;

// Lines that quote Dreven or Victor's Saga. Gemini overuses them, so a quote is only offered now and
// then, and never when one of his last three lines quoted.
const QUOTES = /"|Volume|Saga|Dreven's scripture/;

async function geminiLine(situation, key) {
  const party = Object.values(PARTY).filter(member => member.name)
    .map(member => `- ${member.name}: ${member.about}`).join("\n");
  const recent = store.json("recent", []);
  // A quote now and then, but not when one of his last few lines quoted.
  const quoting = Math.random() < 0.25 && !recent.slice(0, 3).some(line => QUOTES.test(line));
  const prompt = [
    "Write the one line this tabletop RPG character says or does right now, fitted to what is happening.",
    `What is happening in the game, as his player describes it: ${situation}`,
    `Choose what suits the moment:\n${MOMENTS}`,
    PROFILE,
    party && `His party, the Slayer's Fellowship:\n${party}`,
    quoting
      ? `${DREVEN_SAYINGS}\nHe may quote one of Dreven's sayings or a volume and chapter of his grandfather Victor's Saga, if it suits. Dreven's sayings are Dreven's; the Saga is his grandfather's own hero stories, so never credit one to the other.`
      : "Don't quote Dreven, scripture or Victor's Saga in this line.",
    recent.length && `His recent lines (write something different, with a different opening and stage direction):\n${recent.map(line => `- ${line}`).join("\n")}`,
    "Use his mannerisms from the profile. If he names a move, invent a new name for it; don't reuse a move name from the profile or the recent lines.",
    'Return JSON: "act" is a short stage direction in present tense, third person, without his name, under 20 words; "say" is what he says aloud, 1 to 3 sentences, under 60 words, without surrounding quotation marks. Over the top but sincere. Use only facts given here or in the description of the moment; invent no new companions.'
  ].filter(Boolean).join("\n\n");

  // Ask twice at most: a line that makes Roy sound dark is sent back once.
  let offTone = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const retry = offTone ? `\n\nYour last line used "${offTone}". Rewrite it so everything about Roy is holy.` : "";
    const line = await askGemini(prompt + retry, key);
    offTone = `${line.act} ${line.say}`.match(OFF_TONE)?.[0] ?? null;
    if (offTone) continue;
    store.set("recent", JSON.stringify([`${line.act} ${line.say}`, ...recent].slice(0, 8)));
    return line;
  }
  throw new Error(`its lines kept calling Roy's power "${offTone}"`);
}

/** Ask what's happening, with a Key button to change the Gemini key. Returns the text, or null. */
async function askSituation() {
  while (true) {
    const last = store.get("situation") ?? "";
    let situation = null;
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: `${ROY}: what's happening?`, icon: "fa-solid fa-shield-halved" },
      position: { width: 520 },
      content: `<p>Describe the moment, and Roy will rise to it.</p>
        <input type="text" name="situation" maxlength="300" value="${esc(last)}" autofocus
          placeholder="e.g. holding a rope bridge against an ogre while Maeve casts">`,
      buttons: [
        {
          action: "speak", label: "Speak", icon: "fa-solid fa-bullhorn", default: true,
          callback: (event, button) => { situation = button.form.elements.situation.value.trim(); return "speak"; }
        },
        { action: "key", label: "Key", icon: "fa-solid fa-key" }
      ],
      rejectClose: false
    });
    if (choice === "key") { await editKey(); continue; }
    if (choice !== "speak") return null;
    if (!situation) { ui.notifications.warn("Describe what's happening, so Roy's line fits it."); continue; }
    store.set("situation", situation);
    return situation;
  }
}

/** Copy text to the clipboard: Foundry's helper where there is one, else the browser's. */
async function copy(text) {
  try {
    if (game.clipboard?.copyPlainText) await game.clipboard.copyPlainText(text);
    else await navigator.clipboard.writeText(text);
    ui.notifications.info("Copied. Paste it into chat when you're ready.");
  } catch (error) {
    ui.notifications.warn(`Couldn't copy (${error.message}). Select the text and copy it yourself.`);
  }
}

/**
 * Show Roy's line to this user only, with copy buttons. Returns "again" for another line for the
 * same moment, or null when closed.
 */
function showLine(line, situation) {
  const withAction = line.act ? `*${line.act}* ${line.say}` : line.say;
  return foundry.applications.api.DialogV2.wait({
    window: { title: `${ROY} says…`, icon: "fa-solid fa-comment" },
    position: { width: 560 },
    content: `<div class="roy-line">
        <p class="hint">For: ${esc(situation)}</p>
        ${line.act ? `<p><em>${esc(line.act)}</em></p>` : ""}
        <p style="font-size: 1.1em; user-select: text;">${esc(line.say)}</p>
        <p>
          <button type="button" data-copy="say"><i class="fa-solid fa-copy"></i> Copy words</button>
          <button type="button" data-copy="act"><i class="fa-solid fa-copy"></i> Copy with action</button>
        </p>
      </div>`,
    buttons: [
      { action: "again", label: "Another line", icon: "fa-solid fa-rotate", default: true },
      { action: "close", label: "Close", icon: "fa-solid fa-xmark" }
    ],
    // The copy buttons don't close the window. The newest window, as a closing one can still be in
    // the page.
    render: () => {
      const root = [...document.querySelectorAll(".roy-line")].at(-1);
      root?.querySelector("[data-copy=say]")?.addEventListener("click", () => copy(line.say));
      root?.querySelector("[data-copy=act]")?.addEventListener("click", () => copy(withAction));
    },
    rejectClose: false
  });
}

const situation = await askSituation();
if (!situation) return;
if (!store.get("geminiKey")) await editKey();
const key = store.get("geminiKey");
if (!key) return ui.notifications.warn("Roy needs a Gemini API key to speak. Click the macro and use the Key button.");

// Nothing goes to chat: the line is shown to you, to copy into chat if you want it.
while (true) {
  ui.notifications.info("Roy is finding his words…");
  let line;
  try {
    line = await geminiLine(situation, key);
  } catch (error) {
    const reason = error.name === "AbortError" ? "no answer within 20 seconds" : error.message;
    return ui.notifications.error(`Roy has no line: Gemini couldn't answer (${reason}). Try again.`);
  }
  if (await showLine(line, situation) !== "again") break;
}
