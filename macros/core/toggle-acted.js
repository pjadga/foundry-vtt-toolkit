/**
 * Name:    Toggle Acted
 * System:  any
 * Foundry: v12, v13
 * Type:    script
 *
 * Tints your selected tokens red to show they've acted this turn; click again to take the tint off.
 * With nothing selected, it uses your assigned character's token on this scene. The token's own tint
 * is kept in a flag and put back afterwards. Players can use it on tokens they own.
 */
const TINT = "#ff4040";

let tokens = canvas.tokens?.controlled ?? [];
if (!tokens.length) tokens = game.user.character?.getActiveTokens() ?? [];
tokens = tokens.filter(token => token.document.isOwner);
if (!tokens.length) return ui.notifications.warn("Select a token you own, or assign your character, to mark it as acted.");

// Mark them all unless every one is marked already, in which case clear them all.
const acted = token => token.document.getFlag("world", "acted") !== undefined;
const marking = !tokens.every(acted);

await canvas.scene.updateEmbeddedDocuments("Token", tokens.filter(token => acted(token) !== marking).map(token => marking
  ? { _id: token.id, "texture.tint": TINT, "flags.world.acted": token.document._source.texture.tint ?? null }
  : { _id: token.id, "texture.tint": token.document.getFlag("world", "acted") ?? "#ffffff", "flags.world.-=acted": null }));
