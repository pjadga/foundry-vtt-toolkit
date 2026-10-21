/**
 * Name:    Import from NotebookLM
 * System:  any
 * Foundry: v13
 * Type:    script
 *
 * Opens the Foundry VTT Toolkit importer for NotebookLM ##ENTRY blocks. Needs the module enabled.
 * The same button is in the Journal sidebar for GMs.
 */
const api = game.modules.get("foundry-vtt-toolkit")?.api;
if (!api?.importer) return ui.notifications.warn("Enable the Foundry VTT Toolkit module first.");
await api.importer.open();
