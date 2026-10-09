import { Notice, Setting, debounce } from "obsidian";
import { parseConfigJson } from "../core/jsonSchema";
import { summariseChanges } from "../core/merge";
import { normaliseFolderPath } from "../core/paths";
import type { ConflictPolicy, UndoDepth } from "../types";
import { ConfirmModal } from "../ui/ConfirmModal";
import { addChoice, addHeading, addNote, type Choice, type TabContext } from "./helpers";

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

export function renderData(el: HTMLElement, ctx: TabContext): void {
	const { plugin } = ctx;
	const settings = plugin.settings;

	addHeading(el, "Data file");
	const saveFolder = debounce(() => ctx.commit(), 700, true);
	new Setting(el)
		.setName("Data folder name")
		.setDesc(
			`Holds folder.json, a copy of these settings. Now ${plugin.jsonSync.filePath}. Changing it leaves the old file behind.`,
		)
		.setClass("dffa-stacked")
		.addText((text) =>
			text
				.setPlaceholder(".domain")
				.setValue(settings.dataFolderName)
				.onChange((value) => {
					const normalised = normaliseFolderPath(value);
					if (normalised === "") {
						return;
					}
					settings.dataFolderName = normalised;
					saveFolder();
				}),
		);

	addChoice(
		el,
		"When the settings and the file differ",
		"A damaged file is never overwritten, whatever you choose.",
		CONFLICT_CHOICES,
		settings.conflictPolicy,
		(value) => {
			settings.conflictPolicy = value;
			ctx.commit();
		},
	);

	new Setting(el)
		.setName("Sync now")
		.setDesc(
			"Compare with the data file now. Use it after editing the file elsewhere.",
		)
		.addButton((button) =>
			button.setButtonText("Sync now").onClick(async () => {
				await plugin.jsonSync.sync({ manual: true });
				ctx.redraw();
			}),
		);

	addHeading(el, "Undo");
	addChoice(
		el,
		"Actions Undo can reverse",
		"Undo steps back one action at a time. Kept in memory only.",
		UNDO_CHOICES,
		`${settings.undoDepth}` as `${UndoDepth}`,
		(value) => {
			settings.undoDepth = Number(value) as UndoDepth;
			ctx.commit();
		},
	);

	addHeading(el, "Backup and restore");
	new Setting(el)
		.setName("Export")
		.setDesc("Save a dated copy of these settings next to the data file.")
		.addButton((button) =>
			button.setButtonText("Export").onClick(() => {
				void plugin.jsonSync.exportFreshCopy();
			}),
		);
	new Setting(el)
		.setName("Import")
		.setDesc(
			"Replace these settings from a file. You see the changes first, and a backup is saved.",
		)
		.addButton((button) =>
			button.setButtonText("Import").onClick(() => {
				void importFromFile(ctx);
			}),
		);

	addHeading(el, "Reset");
	addNote(
		el,
		"Puts every setting back to its default, including the domains. Your notes are not touched.",
	);
	new Setting(el)
		.setName("Reset to defaults")
		.setDesc("A backup is saved first.")
		.addButton((button) =>
			button
				.setButtonText("Reset")
				.setWarning()
				.onClick(() => {
					void resetToDefaults(ctx);
				}),
		);
}

/** Asks the user for a JSON file using the platform's own file picker (works on mobile). */
function pickFileText(): Promise<string | null> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json,application/json";
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
