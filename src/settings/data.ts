import { Notice, type SettingDefinitionPage } from "obsidian";
import { parseConfigJson } from "../core/jsonSchema";
import { summariseChanges } from "../core/merge";
import { normaliseFolderPath } from "../core/paths";
import type { ConflictPolicy, UndoDepth } from "../types";
import { ConfirmModal } from "../ui/ConfirmModal";
import { choiceSetting, customSetting, noteSetting, textSetting, type Choice, type TabContext } from "./helpers";

const CONFLICT_CHOICES: readonly Choice<ConflictPolicy>[] = [
	["newest", "The most recently changed side wins"],
	["settings", "Always use my settings"],
	["file", "Always use the data file"],
	["ask", "Ask me each time"],
];

const UNDO_CHOICES: readonly Choice<`${UndoDepth}`>[] = [
	["1", "The last action only"],
	["5", "The last 5 actions"],
	["10", "The last 10 actions"],
];

export function dataPage(ctx: TabContext): SettingDefinitionPage {
	const { plugin } = ctx;

	return {
		type: "page",
		name: "Data and sync",
		desc: "The data file, undo, backup and reset.",
		items: [
			{
				type: "group",
				heading: "Data file",
				items: [
					textSetting(
						"Data folder name",
						`Holds folder.json, a copy of these settings. Now ${plugin.jsonSync.filePath}. Changing it leaves the old file behind.`,
						"dataFolderName",
						{
							placeholder: ".domain",
							validate: (value) =>
								normaliseFolderPath(value) === "" ? "Enter a folder name inside the vault." : undefined,
						},
					),
					choiceSetting(
						"When the settings and the file differ",
						"A damaged file is never overwritten, whatever you choose.",
						"conflictPolicy",
						CONFLICT_CHOICES,
					),
					customSetting(
						"Sync now",
						"Compare with the data file now. Use it after editing the file elsewhere.",
						(setting) =>
							setting.addButton((button) =>
								button.setButtonText("Sync now").onClick(async () => {
									await plugin.jsonSync.sync({ manual: true });
									ctx.redraw();
								}),
							),
					),
				],
			},
			{
				type: "group",
				heading: "Undo",
				items: [
					choiceSetting(
						"Actions Undo can reverse",
						"Undo steps back one action at a time. Kept in memory only.",
						"undoDepth",
						UNDO_CHOICES,
					),
				],
			},
			{
				type: "group",
				heading: "Backup and restore",
				items: [
					customSetting("Export", "Save a dated copy of these settings next to the data file.", (setting) =>
						setting.addButton((button) =>
							button.setButtonText("Export").onClick(() => {
								void plugin.jsonSync.exportFreshCopy();
							}),
						),
					),
					customSetting(
						"Import",
						"Replace these settings from a file. You see the changes first, and a backup is saved.",
						(setting) =>
							setting.addButton((button) =>
								button.setButtonText("Import").onClick(() => {
									void importFromFile(ctx);
								}),
							),
					),
				],
			},
			{
				type: "group",
				heading: "Reset",
				items: [
					noteSetting(
						"About reset",
						"Puts every setting back to its default, including the domains. Your notes are not touched.",
					),
					customSetting("Reset to defaults", "A backup is saved first.", (setting) =>
						setting.addButton((button) => {
							// mod-warning is the class the deprecated setWarning() added, and works on every version.
							button.buttonEl.addClass("mod-warning");
							button.setButtonText("Reset").onClick(() => {
								void resetToDefaults(ctx);
							});
						}),
					),
				],
			},
		],
	};
}

/** Asks the user for a JSON file using the platform's own file picker (works on mobile). */
function pickFileText(): Promise<string | null> {
	return new Promise((resolve) => {
		const input = createEl("input", { type: "file", attr: { accept: ".json,application/json" } });
		input.addEventListener("change", () => {
			const file = input.files?.[0];
			if (!file) {
				resolve(null);
				return;
			}
			file.text().then(resolve, () => resolve(null));
		});
		input.addEventListener("cancel", () => resolve(null));
		input.click();
	});
}

async function importFromFile(ctx: TabContext): Promise<void> {
	const { plugin } = ctx;
	const text = await pickFileText();
	if (text === null) {
		return;
	}
	const parsed = parseConfigJson(text);
	if (!parsed.ok) {
		new Notice(`That file cannot be imported. ${parsed.error} Nothing was changed.`, 10000);
		return;
	}

	const changes = summariseChanges(plugin.settings, parsed.config);
	if (changes.length === 0) {
		new Notice("That file matches your current settings, so nothing would change.");
		return;
	}
	const confirmed = await new ConfirmModal(ctx.app, {
		title: "Import settings?",
		lines: [...changes, ...parsed.warnings, "A backup of your current settings will be saved first."],
		confirmText: "Import",
		destructive: true,
	}).ask();
	if (!confirmed) {
		return;
	}

	const backup = await plugin.jsonSync.exportFreshCopy("folder-backup");
	if (backup === null) {
		new Notice("The backup could not be saved, so the import was cancelled.");
		return;
	}
	await plugin.importConfig(parsed.config);
	new Notice("Settings imported.");
	ctx.redraw();
}

async function resetToDefaults(ctx: TabContext): Promise<void> {
	const { plugin } = ctx;
	const count = plugin.settings.domains.length;
	const confirmed = await new ConfirmModal(ctx.app, {
		title: "Reset all settings?",
		lines: [
			`Every setting returns to its default, and ${count} registered ${count === 1 ? "domain is" : "domains are"} removed from the registry.`,
			"Your notes and folders are not changed. A backup of the current settings is saved first.",
		],
		confirmText: "Reset",
		destructive: true,
	}).ask();
	if (!confirmed) {
		return;
	}

	const backup = await plugin.jsonSync.exportFreshCopy("folder-backup");
	if (backup === null) {
		new Notice("The backup could not be saved, so nothing was reset.");
		return;
	}
	await plugin.resetToDefaults();
	new Notice("Settings reset to defaults.");
	ctx.redraw();
}
