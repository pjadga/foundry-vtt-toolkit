/**
 * Name:    Toggle Selected Tokens Hidden
 * System:  any
 * Foundry: v13
 * Type:    script
 * Requires: GM
 *
 * Flips the hidden state of every selected token.
 */
if (!game.user.isGM) return ui.notifications.warn("GM only.");
const tokens = canvas.tokens.controlled;
if (!tokens.length) return ui.notifications.warn("Select at least one token.");

await canvas.scene.updateEmbeddedDocuments(
  "Token",
  tokens.map(t => ({ _id: t.id, hidden: !t.document.hidden }))
);
