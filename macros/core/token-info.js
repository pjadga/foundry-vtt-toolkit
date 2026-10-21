/**
 * Name:    Token Info
 * System:  any
 * Foundry: v13
 * Type:    script
 *
 * Whispers you a summary of each selected token's actor. Tested on Cyberpunk RED 0.93.0-dev.
 */
const tokens = canvas.tokens.controlled;
if (!tokens.length) return ui.notifications.warn("Select at least one token.");

const rows = tokens.map(t => `<li><strong>${t.name}</strong> (${t.actor?.type ?? "no actor"})</li>`);
await ChatMessage.create({
  content: `<ul>${rows.join("")}</ul>`,
  whisper: [game.user.id],
  speaker: ChatMessage.getSpeaker({ alias: "Token Info" })
});
