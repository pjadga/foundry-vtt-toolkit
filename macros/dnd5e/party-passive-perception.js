/**
 * Name:    Party Passive Perception
 * System:  dnd5e
 * Foundry: v13
 * Type:    script
 *
 * Whispers the passive Perception of every player-owned character to the GM.
 */
if (game.system.id !== "dnd5e") return ui.notifications.warn("This macro needs the dnd5e system.");

const rows = game.actors
  .filter(a => a.type === "character" && a.hasPlayerOwner)
  .map(a => `<li>${a.name}: <strong>${a.system.skills.prc.passive}</strong></li>`);

await ChatMessage.create({
  whisper: ChatMessage.getWhisperRecipients("GM"),
  content: `<h3>Passive Perception</h3><ul>${rows.join("") || "<li>No player characters found.</li>"}</ul>`
});
