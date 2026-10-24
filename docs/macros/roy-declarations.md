# Roy's Declarations

[`macros/characters/roy-declarations.js`](../../macros/characters/roy-declarations.js) posts a
chuunibyou line from Roy "Slayer" Belmont to chat, in one of three kinds:

- **Battle cry:** warnings, named attacks, shield interceptions ([Cover I]), spells, [Change Fate].
- **Introduction:** Roy presenting himself and the party, with his self-titles.
- **Victory & quirks:** post-fight poses and everyday habits.

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

## Using it

- **Click:** a menu with the three kinds and **Random**.
- **Shift-click:** battle cry. **Ctrl-click:** introduction. **Alt-click:** victory pose or quirk.
  (On a Mac, Ctrl-click opens the hotbar's context menu instead.)

Roy speaks as his token when it's on the scene (with a speech bubble over it), otherwise as your
assigned character, otherwise as you under his name. The stage direction shows above the line and
the bubble shows only the words.

Lines follow the chat's roll mode: **Public Roll** posts to everyone, **Self Roll** whispers the line
to you only, which is handy for a preview. Bubbles only appear for public lines.

The built-in lines are shuffled: none repeats until all the others of that kind have been used.

## Party names

Some lines name the party. Edit the `PARTY` block near the top of the macro to rename someone, or set
a name to `""` to leave out every line that mentions them.

## Fresh lines from Gemini (optional)

Tick **Fresh line from Gemini** in the menu to have Gemini write a new line in Roy's voice each time.
The first time, the macro asks for a Gemini API key (from Google AI Studio); the **Key** button
changes or removes it. The key is saved only in your browser's `localStorage` for that Foundry
site. It is never written into the macro, the world or chat, so the GM and other players can't see
it, but it also has to be entered again in another browser. If there is no key, or Gemini fails
or takes more than 20 seconds, Roy uses a built-in line and Foundry shows a short warning.

The choice is remembered, so Shift-, Ctrl- and Alt-clicks also use Gemini while it is ticked.

## Known issue

In Foundry v13 with the dark interface theme, speech bubble text can come out light on the bubble's
light background. That is Foundry's own styling, not the macro, and v12 bubbles are fine.
