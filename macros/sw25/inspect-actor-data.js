/**
 * Name:    Inspect Actor Data (Sword World 2.5)
 * System:  sw25
 * Foundry: v13
 * Type:    script
 *
 * Starting point for sw25 macros: logs the selected actor's system data so you
 * can find the field paths before writing real macros. Open the browser console (F12).
 */
if (game.system.id !== "sw25") return ui.notifications.warn("This macro needs the sw25 system.");

const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
if (!actor) return ui.notifications.warn("Select a token or assign a character.");

console.log(`${actor.name} system data`, actor.system);
ui.notifications.info(`Logged ${actor.name} to the console.`);
