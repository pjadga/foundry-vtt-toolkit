/**
 * Name:    Whisper Roll to GM
 * System:  any
 * Foundry: v13
 * Type:    script
 *
 * Prompts for a formula, rolls it, and whispers the result to the GM only.
 */
const formula = await foundry.applications.api.DialogV2.prompt({
  window: { title: "Whisper Roll to GM" },
  content: `<input type="text" name="formula" value="1d20" autofocus>`,
  ok: {
    label: "Roll",
    callback: (event, button) => button.form.elements.formula.value
  },
  rejectClose: false
});
if (!formula) return;

const roll = await new Roll(formula).evaluate();
await roll.toMessage(
  { speaker: ChatMessage.getSpeaker() },
  { rollMode: CONST.DICE_ROLL_MODES.PRIVATE }
);
