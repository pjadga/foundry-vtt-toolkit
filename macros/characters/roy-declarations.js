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

const PROFILE = `Roy "Slayer" Belmont, an 18-year-old human fighter and priest of Dreven, the Magic Hunter King (Sword World 2.5, Alframe continent).
- Dreven: a minor god of the First Sword, once a vampire hunter, who hunted the Eternal Night and mapped Shallow Abysses (spatial rifts). Holy symbol: a spear piercing a dark circle.
- Looks: pink hair under a feather-trimmed cap, bright blue eyes, polished splint armor with wing motifs, a round shield, ${WEAPON}, his grandfather's silver medallion of Dreven. A pale scar below his left collarbone from shielding village children from a wild boar when he was twelve.
- Chuunibyou habits: calls his right arm "the Sacred Crusher" or his "crushing arm" and grips his wrist to hold back its power; names every move in capitals (GRAND SLAM OF DESTINY!, ABYSS-SHATTERING STRIKE!, CELESTIAL METEOR CRUSH!, SACRED INTERCEPTION!); talks to his weapon like a partner; quotes his grandfather Victor Belmont's hero stories as scripture, by volume and chapter; titles himself the Shield of the Village, the Grandson of the Living Legend. Orders juice, not ale.
- His only weapon right now is ${WEAPON}. He has no blade, sword or other weapon, so never give him one.
- "Slayer" is the adventurer handle he gave himself: in the heat of combat, and when addressing NPCs he doesn't trust, he calls himself Slayer rather than Roy or Roy Belmont. With friends and trustworthy folk he uses his real name.
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
    const line = JSON.parse(text);
    const act = String(line.act ?? "").trim().slice(0, 200);
    const say = String(line.say ?? "").trim().replace(/^["“]|["”]$/g, "").slice(0, 500);
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

// Lines that quote Dreven or Victor's Saga. Gemini overuses them, so a quote is only offered now and
// then, and never when one of his last three lines quoted.
const QUOTES = /"|Volume|Saga|Dreven's scripture/;

// A named move: two or more words in capitals, like GRAND SLAM OF DESTINY.
const MOVE = /\b[A-Z][A-Z'-]+(?: [A-Z'-]+)+\b/g;

async function geminiLine(situation, key) {
  const party = Object.values(PARTY).filter(member => member.name)
    .map(member => `- ${member.name}: ${member.about}`).join("\n");
  const recent = store.json("recent", []);
  // A quote now and then, but not when one of his last few lines quoted.
  const quoting = Math.random() < 0.25 && !recent.slice(0, 3).some(line => QUOTES.test(line));
  // Move names from the profile and his recent lines, named in the prompt so they aren't reused.
  const usedMoves = [...new Set([PROFILE, ...recent].flatMap(text => text.match(MOVE) ?? []).filter(move => move.length >= 8))];
  const prompt = [
    "Write the one line this tabletop RPG character says or does right now, fitted to what is happening.",
    `What is happening in the game, as his player describes it: ${situation}`,
    `Choose what suits the moment:\n${MOMENTS}`,
    PROFILE,
    party && `His party. Roy has proclaimed to the Adventurer's Guild that it is called the Slayer's Fellowship; no one agreed, but no one bothered to correct him, so he uses the name with total confidence. Apart from Keira, Roy met them only recently: he treats them as he would any friendly companions, warmly and protectively, with no special history or opinions of them.\n${party}`,
    quoting
      ? `${DREVEN_SAYINGS}\nHe may quote one of Dreven's sayings or a volume and chapter of his grandfather Victor's Saga, if it suits. Dreven's sayings are Dreven's; the Saga is his grandfather's own hero stories, so never credit one to the other.`
      : "Don't quote Dreven, scripture or Victor's Saga in this line.",
    recent.length && `His recent lines (write something different, with a different opening and stage direction):\n${recent.map(line => `- ${line}`).join("\n")}`,
    `Use his mannerisms from the profile. If he names a move, invent a new name for it. These move names are already used, so never use them or a close variation: ${usedMoves.join(", ")}.`,
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
// the categories; a typed moment (Speak) is Unique.
const CATEGORIES = {
  Attacking: "#e74c3c", Defending: "#3498db", Healing: "#2ecc71", "Health & Mana": "#9b59b6",
  Roleplay: "#f1c40f", Unique: "#1abc9c"
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
  const { FRIENDLY, HOSTILE } = CONST.TOKEN_DISPOSITIONS;
  const what = token => ({ [FRIENDLY]: " (an ally)", [HOSTILE]: " (an enemy)" })[token.document?.disposition] ?? "";
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
    return { prompt, label: [typed, target.label].filter(Boolean).join(" · "), category: "Unique" };
  }
  return {
    prompt: `${quick.text}${target.prompt}${typed ? ` More detail from his player: ${typed}` : ""}`,
    label: [quick.label, target.label, typed].filter(Boolean).join(" · "),
    category: quick.category
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
  history.unshift({ at: Date.now(), label, category, act: line.act, say: line.say });
  let unstarred = 0;
  store.set("history", JSON.stringify(history.filter(entry => entry.starred || ++unstarred <= HISTORY_SIZE)));
  foundry.applications.instances?.get("roy-history")?.refresh?.();
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
      quick(event, button) { this.speak(QUICK_LIST[button.dataset.quick]); },
      again() { if (this.last) this.ask(this.last); },
      copySay() { this.copy(this.line?.say); },
      copyAct() { this.copy(this.line && (this.line.act ? `*${this.line.act}* ${this.line.say}` : this.line.say)); },
      key() { this.showKey(this.find(".roy-key").hidden); },
      saveKey() { this.saveKey(); },
      removeKey() {
        store.set("geminiKey", null);
        this.showKey(true);
        this.status("Gemini key removed from this browser.");
      }
    }
  };

  busy = false;
  last = null;
  line = null;

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
      </style>
      <div class="roy-body">
        <p>Describe the moment and click Speak, or pick a moment below. With a moment, anything typed
        here is added as detail. Targeted tokens are named; check the target line before you click.</p>
        <div class="roy-row">
          <input type="text" name="situation" maxlength="300" value="${esc(store.get("situation") ?? "")}"
            placeholder="e.g. holding a rope bridge against an ogre while Maeve casts">
          <button type="button" class="roy-ask" data-action="speak" style="--roy-cat: ${CATEGORIES.Unique};" title="A typed moment is Unique"><i class="fa-solid fa-bullhorn"></i> Speak</button>
        </div>
        <div class="roy-targets" role="status" aria-live="polite"></div>
        ${groups}
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
        <div class="roy-key" hidden>
          <p class="hint">A Gemini API key from Google AI Studio. It is kept only in this browser, for this
          Foundry site: not in the macro, the world or chat.</p>
          <div class="roy-row">
            <input type="password" name="key" autocomplete="off">
            <button type="button" data-action="saveKey"><i class="fa-solid fa-check"></i> Save</button>
            <button type="button" data-action="removeKey"><i class="fa-solid fa-trash"></i> Remove</button>
          </div>
        </div>
        <div class="roy-row" style="justify-content: flex-end;">
          <button type="button" data-action="key"><i class="fa-solid fa-key"></i> Key</button>
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
    // Keep the target line current while the window is open.
    this.showTargets();
    this.hooks ??= [
      ["targetToken", Hooks.on("targetToken", user => { if (user === game.user) this.showTargets(); })],
      ["canvasReady", Hooks.on("canvasReady", () => this.showTargets())]
    ];
    if (!store.get("geminiKey")) {
      this.showKey(true);
      this.status("Paste your Gemini API key below and click Save to start.");
    } else input?.focus();
  }

  _onClose(options) {
    super._onClose?.(options);
    for (const [hook, id] of this.hooks ?? []) Hooks.off(hook, id);
    this.hooks = null;
  }

  find(selector) {
    return this.element?.querySelector(selector) ?? null;
  }

  /** Who is targeted now, so you can check before clicking a moment, or a warning with no one. */
  showTargets() {
    const box = this.find(".roy-targets");
    if (!box) return;
    const targets = [...(game.user.targets ?? [])];
    const { FRIENDLY, HOSTILE } = CONST.TOKEN_DISPOSITIONS;
    const what = token => ({ [FRIENDLY]: " (ally)", [HOSTILE]: " (enemy)" })[token.document?.disposition] ?? "";
    box.dataset.kind = targets.length ? "" : "warn";
    box.innerHTML = targets.length
      ? `<i class="fa-solid fa-bullseye"></i> ${targets.length > 1 ? "Targets" : "Target"}: ${esc(list(targets.map(token => token.name + what(token))))}`
      : '<i class="fa-solid fa-triangle-exclamation"></i> No target selected. Target a token (T) so Roy names them.';
    this.fit();
  }

  /** Grow or shrink the window to its content. */
  fit() {
    if (this.rendered) this.setPosition({ height: "auto" });
  }

  /** A message in the window: "busy" with a spinner, "error" outlined, or plain. Empty hides it. */
  status(text, kind = "") {
    const box = this.find(".roy-status");
    if (!box) return;
    box.innerHTML = text ? `${kind === "busy" ? '<i class="fa-solid fa-spinner fa-spin"></i> ' : ""}${esc(text)}` : "";
    box.dataset.kind = kind;
    box.hidden = !text;
    this.fit();
  }

  setBusy(busy) {
    this.busy = busy;
    for (const button of this.element?.querySelectorAll(".roy-ask") ?? []) button.disabled = busy;
    this.find(".roy-result")?.classList.toggle("roy-stale", busy);
  }

  showKey(show) {
    const row = this.find(".roy-key");
    if (!row) return;
    row.hidden = !show;
    const input = this.find("[name=key]");
    input.value = "";
    input.placeholder = store.get("geminiKey") ? "(key saved; paste a new one to replace it)" : "Gemini API key";
    if (show) input.focus();
    this.fit();
  }

  saveKey() {
    const value = this.find("[name=key]")?.value.trim();
    if (!value) return this.status("Paste a key into the field first.", "error");
    store.set("geminiKey", value);
    this.showKey(false);
    this.status("Gemini key saved in this browser.");
  }

  speak(quick) {
    if (this.busy) return;
    const typed = this.find("[name=situation]")?.value.trim() ?? "";
    const situation = situationFor(typed, quick);
    if (!situation) return this.status("Describe what's happening, or pick a moment, so Roy's line fits it.", "error");
    store.set("situation", typed || null);
    const untargeted = quick?.target && !game.user.targets?.size;
    this.ask(situation, untargeted ? " No target selected, so he won't name anyone." : "");
  }

  async ask(situation, note = "") {
    if (this.busy) return;
    const key = store.get("geminiKey");
    if (!key) {
      this.showKey(true);
      return this.status("Roy needs a Gemini API key to speak. Paste one below and click Save.", "error");
    }
    this.last = situation;
    this.setBusy(true);
    this.status(`Roy is finding his words for: ${situation.label}.${note} Gemini usually takes 5 to 20 seconds.`, "busy");
    try {
      const line = await geminiLine(situation.prompt, key);
      remember(line, situation);
      this.showLine(line, situation);
      this.status("");
    } catch (error) {
      const reason = error.name === "AbortError" ? "no answer within 45 seconds" : error.message;
      this.status(`Roy has no line: Gemini couldn't answer (${reason}). Try again.`, "error");
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
    result.querySelector(".roy-say").textContent = line.say;
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
