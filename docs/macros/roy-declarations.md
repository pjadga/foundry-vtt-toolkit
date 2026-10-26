# Roy's Declarations

[`macros/characters/roy-declarations.js`](../../macros/characters/roy-declarations.js) asks what's
happening in the game, then has Gemini write a fresh line for Roy "Slayer" Belmont that fits the
moment, in his voice and with his chuunibyou mannerisms. Gemini picks what suits the moment:

- **In a fight:** battle cries, warnings, newly named attacks, shield interceptions ([Cover I]),
  spells, [Change Fate].
- **Meeting people:** Roy presenting himself and the party, with his self-titles.
- **After a fight or in quiet moments:** victory poses and everyday habits.

The line is shown only to you. Copy it and paste it into chat if you want to use it; the macro never
posts anything itself, so the chat's roll mode doesn't matter.

It is a single script macro with no module, so a player can use it in a game they don't host. It
works on Foundry v12 and v13, in any game system.

## Installing it in a game you don't host

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

The macro needs a Gemini API key, free from Google AI Studio. The first time you click **Speak**, it
asks for one; the **Key** button in the first window changes or removes it. The key is saved only in
your browser's `localStorage` for that Foundry site. It is never written into the macro, the world
or chat, so the GM and other players can't see it, but it has to be entered again in another
browser.

## Using it

1. Click the macro. A **What's happening?** window opens.
2. Describe the moment, for example *goblins ambush us on a mountain pass at night; Keira is
   cornered*, and click **Speak** (or press Enter). The text is kept for next time, so you can just
   edit it as the scene moves on.
3. Roy's line appears in a window only you can see: the stage direction in italics, then his words.
   - **Copy words** copies what he says aloud.
   - **Copy with action** copies the stage direction too, as `*raises his mace* By the Light…`.
   - **Another line** asks Gemini again for the same moment.
   - **Close** ends it.
4. Paste into chat (Ctrl+V) and send it however you like: in character, as an emote, or not at all.

If the copy buttons don't work in your browser, select the text in the window and copy it yourself.

Lines don't repeat themselves: the macro sends Gemini Roy's last eight lines and asks for something
different, and only now and then lets him quote Dreven or his grandfather's Saga.

If Gemini can't answer (no connection, a bad key, or no reply within 20 seconds), Foundry shows why
and nothing else happens. Click the macro to try again.

Lines keep Roy holy: if Gemini calls his power unholy, cursed or dark, the macro asks once more, then
shows an error rather than an off-tone line.

## Party names

Roy may mention his party. Edit the `PARTY` block near the top of the macro to rename someone, or set
a name to `""` to leave them out.
