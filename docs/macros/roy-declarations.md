# Roy's Declarations

Two macros for Roy "Slayer" Belmont, a player's own macros for a game they don't host:

- [`roy-declarations.js`](../../macros/characters/roy-declarations.js) asks what's happening in the
  game, then has Gemini write a fresh line for Roy that fits the moment, in his voice and with his
  chuunibyou mannerisms.
- [`roy-history.js`](../../macros/characters/roy-history.js) lists every line it has written, to copy
  again, star or delete.

Gemini picks what suits the moment:

- **In a fight:** battle cries, warnings, newly named attacks, shield interceptions ([Cover I]),
  spells, [Change Fate].
- **Meeting people:** Roy presenting himself and the party, with his self-titles.
- **After a fight or in quiet moments:** victory poses and everyday habits.

**Everything is private to you.** Each macro works in one window that only you see. Its messages
(waiting, errors, copied) show inside that window, not in Foundry's notifications, and nothing is
posted to chat. Copy a line and paste it into chat yourself if you want to use it, so the chat's
roll mode doesn't matter. The only thing sent anywhere is the request to Gemini.

They are single script macros with no module, and work on Foundry v12 and v13, in any game system.

## Installing them in a game you don't host

Do this once for each macro.

1. Open the macro file on GitHub and copy all of it (the **Copy raw file** button).
2. In Foundry, click an empty slot on the hotbar (or **Create Macro** in the Macro Directory).
3. Name it, set **Type** to **Script**, paste the code into **Command**, and click **Save Macro**.
4. If you made it in the Macro Directory, drag it onto the hotbar.

Players need the script macro permission to create and run script macros. In Foundry v12 and v13
the Player role has it by default (`CONST.USER_PERMISSIONS.MACRO_SCRIPT.defaultRole` is Player), so
it usually just works. If the Type list has no **Script** option, or Foundry says you don't have
permission, the GM may have turned it off. Ask them to tick it for players under **Configure
Permissions**: a button in the Game Settings sidebar in v12, and in **Configure Settings → Core** in
v13. It is called **Use Script Macros and Execute Script Region Behaviors** in v12 and **Modify
Script Macros and Execute Script Region Behaviors** in v13.

## Gemini key

Roy's Declarations needs a Gemini API key, free from Google AI Studio. The first time you open it, the
window opens on its **Settings** tab at the key field: paste the key and click **Save**. Come back to
**Settings** to replace the key, or **Remove** it. The key is saved only in your browser's `localStorage`
for that Foundry site. It is never written into the macro, the world or chat, so the GM and other
players can't see it, but it has to be entered again in another browser.

## Using it

1. Click the macro. Roy's window opens and stays open; clicking the macro again brings it to the
   front.
2. Either describe the moment, for example *goblins ambush us on a mountain pass at night; Keira is
   cornered*, and click **Speak** (or press Enter), or click one of the common moments:

   | Category | Colour | Moments |
   | --- | --- | --- |
   | **Attacking** | red | Melee miss, Melee hit |
   | **Defending** | blue | Protect ally ([Cover I]), Block attack, Light wound, Heavy wound |
   | **Healing** | green | Heal ally and Heal self (Cure Wounds mid-fight), After combat, Before rest |
   | **Health & Mana** | purple | Half HP and Low HP (under half, under a quarter), Half MP and Low MP |
   | **Roleplay** | gold | Resting, Eating, Preparing (exercising, stretching, warming up), Celebrating |
   | **Unique** | teal | Anything typed and sent with **Speak** |
   | **Rolls** | orange | A line from the **Rolls** page (below) |

   Each category's heading and buttons are edged in its colour, and the line Roy says, and its
   place in the history, carry the same category and colour.

   With a moment, whatever is in the field is added as detail, so you can keep the scene there
   (*goblins on a mountain pass*) and click a moment each turn. The field is kept for next time;
   clear it when the scene changes.

   **Targets:** target tokens (T, or double right-click) and Roy uses their names. The line under
   the field shows who is targeted right now, as ally or enemy from the token's disposition, so you
   can check before clicking; with no one targeted it warns you. A moment gives targets a role: the
   enemy for an attack, the ally you protect or heal (everyone you target for After combat, Before
   rest, Resting, Eating and Celebrating), or the attacker when Roy is hit. A typed moment says
   whether each target is an ally or an enemy. Heal self, Preparing and the health and mana moments
   leave targets out, since they are about Roy alone. A moment that uses a target still works with
   none: the window says Roy won't name anyone.
3. While Gemini writes, the window says "Roy is finding his words…" and the buttons wait. A line
   usually takes 5 to 20 seconds.
4. Roy's line appears at the bottom of the window, edged in its category's colour: the category and
   what it was for, the stage direction in italics, then his words. On a short screen the window
   stops at the bottom edge and scrolls.
   - **Copy words** copies what he says aloud, in quotation marks.
   - **Copy with action** copies the stage direction too, as `*raises his mace* "By the Light…"`.

   What he says is in quotation marks everywhere (the window, copies, roll cards and the history), so
   it reads apart from what he does.
   - **Another line** asks Gemini again for the same moment, detail and targets.

   Pick the next moment whenever you're ready; close the window with its **×**.
5. Paste into chat (Ctrl+V) and send it however you like: in character, as an emote, or not at all.

If the copy buttons don't work in your browser, select the text in the window and copy it yourself.

Lines don't repeat themselves: the macro sends Gemini Roy's last eight lines and the move names
already used, and asks for something different in his usual way of speaking. Gemini is told Roy is
an anime-style chuunibyou whose right arm is possessed by a sealed holy power, which he only calls the
Sacred Crusher or his crushing arm.

**Named moves:** in fights and spells (the Attacking, Defending and Healing moments, and weapon and
spell rolls) he shouts a newly named move in capitals, sometimes as his anime declaration ("Taste
the…" or "Feel the…" of divine judgment, "through my crushing arm…", then the move), but after one
of those the next shouts its move another way. The move's name always comes last, as its own
exclamation ("…every wound! DIVINE MIRACLE OF THE PURE FLAME HEALING!"); a line that ends "…in the
MOVE NAME!" or "…as I enact MOVE NAME!" is split that way. Health & Mana and Roleplay moments have no named move;
for typed moments and checks Gemini decides. **Always name a move** in Settings gives every line one.

Roy keeps his faith to himself: he never speaks of a god or gods ("godly" as an adjective is fine,
as in GODLY CRIMSON STRIKE!), and never of vampires. He embodies his faith and channels it through
the Sacred Crusher, so any god that slips into his words becomes the Sacred Crusher: "may god strike
you" reads "may the Sacred Crusher strike you".

Any other longer word in two of his last four lines is asked to rest for a line. Only now and then does it let him quote his grandfather's Saga.

Roy's divine magic is celestial and holy: silver
and moonlight laced with crimson-ruby embers, spectral silver-red spears for Banish, a veil of silver
threads that hardens into a barrier for Cure Wounds and Field of Protection, and a crimson flash in
his eyes with silver compass lines for Abyss Ranger. Lines describe those colours only when his magic
is part of the moment, with other words for them too (scarlet, vermillion, ashen, pale, starlight,
argent, twilight, cinders, steely and more). It is described in Roy's profile near the top of the
macro.

If Gemini can't answer (no connection, a wrong key, its free limit used up, or no reply within 45
seconds), the window says why, with an **Ask again** button that asks for the same moment again. For
a roll, it reuses the result in chat rather than rolling again.

## Rolls page

The window has two tabs: **Moments** (everything above) and **Rolls**, for Sword World 2.5 games.
Rolls has a button for every dice roll on your character's sheet, grouped as on the sheet:

| Group | Rolls |
| --- | --- |
| **Combat** | Each equipped weapon's accuracy and damage, and Evasion |
| **Checks** | Fortitude, Willpower, Initiative, Monster Knowledge |
| **Spells & items** | Magic power, each spell's casting check (and its damage if the spell has a power), and any item or feat with its own dice set up |
| **Class checks** | Every class with every ability, such as Fighter + Dexterity or Priest (Dreven) + Intelligence |

Each button shows the roll's formula with your bonuses. Clicking it rolls exactly as the sheet does:
the usual chat card, the chat's roll mode, and the sheet's target prompt when tokens are targeted.
Then Gemini writes Roy's line for how it came out, in the Rolls category. A natural 12 or 2 is an
automatic success or failure, and his line reacts to it; otherwise the GM decides whether it worked,
so his line reacts to the attempt without claiming either. Anything in the text box and any targets
are added as for a moment.

The page reads the sheet of the character named in **Settings**, *Character for rolls*; left blank,
your assigned character's (User Configuration), or else Roy "Slayer" Belmont's. It follows the sheet: add a weapon or spell, or change a
score, and its buttons update while the window is open. **Refresh** reads the sheet again by hand.
In other game systems the page says it isn't available.

## Settings

The **Settings** tab holds:

- **Gemini key:** paste, replace or remove it (see *Gemini key* above).
- **Character for rolls:** whose sheet the Rolls page reads. Type the name of a character you own
  (the field suggests them) and click **Save** or press Enter. A name with no character, or one you
  don't own, isn't saved, and the window says why. Leave it blank for your assigned character, or
  else Roy "Slayer" Belmont. If the named character is later renamed or deleted, the Rolls page says
  so. Roy's lines stay Roy's, whoever's sheet the rolls come from.
- **Always name a move:** every line gets a shouted move in capitals, whatever the moment or roll,
  even eating or resting. Off by default.
- **Put Roy's line on roll cards:** on the Rolls page, Roy's line is written first, then the roll is
  made, and the line appears on the roll's chat card under its name. Everyone who sees the roll sees
  the line, as the chat's roll mode allows, so this is the one setting that shows a line to others.
  Because the line is written before the dice land, it can't react to the result. If Gemini can't
  answer, nothing is rolled, and **Ask again** writes the line and rolls. Off by default: the line
  stays private and reacts to the result.

  A line on a roll card has a **★ Star** link, so the GM or another player can star it in your
  history. It's a Foundry inline roll, which works for anyone with nothing installed: clicking it posts
  a self-only roll, "★ Roy's line starred (#…)" (the number is the line's id), and while Roy's
  Declarations or Roy's History is open in your browser, it stars the line and the window says who
  starred it. Stars clicked while neither is open aren't picked up. Only the clicker sees the star
  text; everyone else sees Foundry's usual "privately rolled some dice" stub. An inline roll can't be
  whispered to one player: clicking one only offers the standard roll modes.

Settings are saved in that browser, like the key.

Lines keep Roy holy: if Gemini calls his power unholy, cursed or dark, the macro asks once more, then
says so in the window rather than showing an off-tone line.

## History

Every line Roy's Declarations writes is saved in your browser, with when, what it was for and its
category. Click **Roy's History** to see them: starred lines at the top, then the rest, each newest
first, each edged in its category's colour. Lines saved before categories existed get theirs from
the moment's name the next time Roy's Declarations opens; typed ones count as Unique.

Each line shows only its first line, collapsed: when it was written, the moment and who was
targeted, with a ★ if starred. Click that line (or Tab to it and press Enter) to open the stage
direction, Roy's words and the buttons; click again to close it. Lines you open stay open while the
window is.

- **Category** shows one category's lines only (All categories shows every line).
- **Search** by words in the line, the moment, a name or a category (for example *heal*, *Keira* or
  *Unique*). Only the
  matches are listed, and every one opens so you can read it. Clear the search to go back to the
  collapsed list as you left it.
- **Copy words** and **Copy with action** work as in Roy's window, for a line worth using again.
- **★** stars a line to keep; **Starred only** shows just those.
- **🗑** deletes a line straight away, without asking.
- **Export** saves every line, whatever the search or **Starred only** shows, as a text file in your
  browser's downloads (`roy-declarations-<date>.txt`). Each line has its date, category and moment, a ★ if
  starred, and the stage direction in asterisks as **Copy with action** gives it.

Starred lines are always kept. The rest keep the latest 300, and the window shows the newest 100 that
match; search to find older ones. A line written while the history is open appears in it at once.
Like the key, the history lives in that browser for that Foundry site, so another browser has its
own.

## Roy's weapon

Roy currently fights with only his mace. The `WEAPON` line near the top of Roy's Declarations says
so (`a heavy mace he calls the Star of Retribution`), and Gemini is told it is his only weapon, so
lines don't hand him a sword or blade. When Roy gets a new weapon, change that line; his looks, his
habits and the melee moments all follow it.

## Party names

Roy may mention his party: Keira, Maeve, Urist and Ùna. The `PARTY` block near the top of Roy's
Declarations describes each of them with only what Roy knows so far, since he met everyone except
his sister Keira recently and treats them as any friendly companions. Keep secrets and backstories
out of it, or Gemini will have Roy say them. Edit a description there, rename someone, or set a
name to `""` to leave them out.
