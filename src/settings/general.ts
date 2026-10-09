import { Notice, Setting, debounce } from "obsidian";
import { isExcluded, normaliseFolderPath, pathKey } from "../core/paths";
import type { NoticeLevel } from "../types";
import { FolderSuggestModal } from "../ui/FolderSuggestModal";
import { addChoice, addHeading, addNote, addToggle, allFolders, type Choice, type TabContext } from "./helpers";

const NOTICE_CHOICES: readonly Choice<NoticeLevel>[] = [
	["all", "All notices"],
	["important", "Important only"],
	["errors", "Errors only"],
];

export function renderGeneral(el: HTMLElement, ctx: TabContext): void {
	const { plugin } = ctx;
	const settings = plugin.settings;
	let persistedProperty = settings.propertyName;

	addHeading(el, "Properties");
	const saveText = debounce(
		() => {
			if (settings.propertyName !== persistedProperty) {
				persistedProperty = settings.propertyName;
				new Notice("Existing notes keep their old property name; only future filing uses the new one.");
			}
			ctx.commit();
		},
		700,
		true,
	);

	new Setting(el)
		.setName("Property name")
		.setDesc("The frontmatter property that holds a note's domain, for example domain or area.")
		.addText((text) =>
			text
				.setPlaceholder("domain")
				.setValue(settings.propertyName)
				.onChange((value) => {
					if (value.trim() === "") {
						return;
					}
					settings.propertyName = value.trim();
					saveText();
				}),
		);

	new Setting(el)
		.setName("Opt-out property")
		.setDesc("A note with this property set to true is ignored entirely by the plugin.")
		.addText((text) =>
			text
				.setPlaceholder("skip-allocator")
				.setValue(settings.optOutProperty)
				.onChange((value) => {
					if (value.trim() === "") {
						return;
					}
					settings.optOutProperty = value.trim();
					saveText();
				}),
		);

	addToggle(
		el,
		"Write the folder's casing",
		"Rewrite a note's domain to the folder's real capitalisation when filing.",
		settings.writeCanonicalCasing,
		(value) => {
			settings.writeCanonicalCasing = value;
			ctx.commit();
		},
	);

	addToggle(
		el,
		"Add the domain property to new notes",
		"Adds an empty domain property to each new note. A property from a template is left as it is.",
		settings.addPropertyToNewNotes,
		(value) => {
			settings.addPropertyToNewNotes = value;
			ctx.commit();
		},
	);

	addHeading(el, "Fallback folder");
	addToggle(
		el,
		"Use fallback folder",
		"Send notes with no matching domain to the fallback folder. When off, they stay where they are.",
		settings.fallback.enabled,
		(value) => {
			settings.fallback.enabled = value;
			ctx.commit();
		},
	);

	const describeFallback = (): string => {
		const base = "Any folder name or path. It is created when first needed.";
		return isExcluded(settings.fallback.folder, settings.excludeFolders, settings.dataFolderName)
			? `${base} Note: this folder is excluded, so notes filed there will not be moved again.`
			: base;
	};
	const fallbackSetting = new Setting(el)
		.setName("Fallback folder")
		.setDesc(describeFallback())
		.addText((text) =>
			text
				.setPlaceholder("Inbox")
				.setValue(settings.fallback.folder)
				.onChange((value) => {
					const normalised = normaliseFolderPath(value);
					if (normalised === "") {
						return;
					}
					settings.fallback.folder = normalised;
					fallbackSetting.setDesc(describeFallback());
					saveText();
				}),
		);

	renderExclusions(el, ctx);

	addHeading(el, "Notices");
	addChoice(
		el,
		"Notice level",
		"Errors are always shown. Important notices cover skips and settings changes.",
		NOTICE_CHOICES,
		settings.notices,
		(value) => {
			settings.notices = value;
			ctx.commit();
		},
	);

	addHeading(el, "Hotkeys");
	addNote(
		el,
		"The plugin sets no hotkeys. Add your own in Settings, then Hotkeys.",
	);
}

function renderExclusions(el: HTMLElement, ctx: TabContext): void {
	const settings = ctx.plugin.settings;
	addHeading(el, "Excluded folders");
	addNote(
		el,
		"Notes in these folders, and their subfolders, are never moved or changed. The data folder is always excluded as well.",
	);

	for (const folder of settings.excludeFolders) {
		new Setting(el)
			.setName(folder)
			.setClass("dffa-list-row")
			.addExtraButton((button) =>
				button
					.setIcon("trash")
					.setTooltip("Remove from exclusions")
					.onClick(() => {
						settings.excludeFolders = settings.excludeFolders.filter((f) => f !== folder);
						ctx.commit();
						ctx.redraw();
					}),
			);
	}

	let typed = "";
	const addExclusion = (value: string): void => {
		const normalised = normaliseFolderPath(value);
		if (normalised === "") {
			new Notice("Enter a folder path to exclude.");
			return;
		}
		if (settings.excludeFolders.some((f) => pathKey(f) === pathKey(normalised))) {
			new Notice(`"${normalised}" is already excluded.`);
			return;
		}
		settings.excludeFolders = [...settings.excludeFolders, normalised];
		ctx.commit();
		ctx.redraw();
	};
	new Setting(el)
		.setName("Add an excluded folder")
		.setDesc("Type a path (hidden folders such as .private work here) or choose an existing folder.")
		.addText((text) =>
			text.setPlaceholder("Templates").onChange((value) => {
				typed = value;
			}),
		)
		.addButton((button) => button.setButtonText("Add").onClick(() => addExclusion(typed)))
		.addButton((button) =>
			button.setButtonText("Choose").onClick(() => {
				new FolderSuggestModal(ctx.app, allFolders(ctx.app), (folder) => addExclusion(folder.path)).open();
			}),
		);
}
