import { Notice, type SettingDefinition, type SettingDefinitionPage } from "obsidian";
import { isExcluded, normaliseFolderPath, pathKey } from "../core/paths";
import type { NoticeLevel } from "../types";
import { FolderSuggestModal } from "../ui/FolderSuggestModal";
import {
	allFolders,
	choiceSetting,
	customSetting,
	noteSetting,
	requireText,
	textSetting,
	toggleSetting,
	type Choice,
	type TabContext,
} from "./helpers";

const NOTICE_CHOICES: readonly Choice<NoticeLevel>[] = [
	["all", "All notices"],
	["important", "Important only"],
	["errors", "Errors only"],
];

export function generalPage(ctx: TabContext): SettingDefinitionPage {
	const settings = ctx.plugin.settings;
	const fallbackDesc = isExcluded(settings.fallback.folder, settings.excludeFolders, settings.dataFolderName)
		? "Any folder name or path. Created when first needed. It is excluded, so notes filed there are never moved again."
		: "Any folder name or path. Created when first needed.";

	return {
		type: "page",
		name: "General",
		desc: "Property names, the fallback folder, excluded folders and notices.",
		items: [
			{
				type: "group",
				heading: "Properties",
				items: [
					textSetting("Property name", "The frontmatter property that holds a note's domain.", "propertyName", {
						validate: requireText("a property name"),
					}),
					textSetting("Opt-out property", "A note with this set to true is ignored.", "optOutProperty", {
						validate: requireText("a property name"),
					}),
					toggleSetting(
						"Write the folder's casing",
						"Rewrite a note's domain to the folder's real capitalisation when filing.",
						"writeCanonicalCasing",
					),
					toggleSetting(
						"Add the domain property to new notes",
						"Adds an empty domain property to each new note. A property from a template is left as it is.",
						"addPropertyToNewNotes",
					),
				],
			},
			{
				type: "group",
				heading: "Fallback folder",
				items: [
					toggleSetting(
						"Use fallback folder",
						"When off, notes with no matching domain stay where they are.",
						"fallback.enabled",
					),
					textSetting("Fallback folder", fallbackDesc, "fallback.folder", {
						placeholder: "Inbox",
						validate: (value) =>
							normaliseFolderPath(value) === "" ? "Enter a folder path inside the vault." : undefined,
					}),
				],
			},
			{
				type: "list",
				heading: "Excluded folders",
				emptyState: "No folders are excluded.",
				items: settings.excludeFolders.map((folder) => excludedRow(ctx, folder)),
			},
			{ type: "group", items: [addExclusionRow(ctx)] },
			{
				type: "group",
				heading: "Notices",
				items: [
					choiceSetting(
						"Notice level",
						"Errors are always shown. Important notices cover skips and settings changes.",
						"notices",
						NOTICE_CHOICES,
					),
				],
			},
			{
				type: "group",
				heading: "Hotkeys",
				items: [noteSetting("Hotkeys", "The plugin sets no hotkeys. Add your own in Settings, then Hotkeys.")],
			},
		],
	};
}

function excludedRow(ctx: TabContext, folder: string): SettingDefinition {
	return {
		name: folder,
		render: (setting) => {
			setting.setClass("dffa-list-row");
			setting.addExtraButton((button) =>
				button
					.setIcon("trash")
					.setTooltip("Remove from exclusions")
					.onClick(() => {
						const settings = ctx.plugin.settings;
						settings.excludeFolders = settings.excludeFolders.filter((f) => f !== folder);
						ctx.commit();
						ctx.redraw();
					}),
			);
		},
	};
}

function addExclusionRow(ctx: TabContext): SettingDefinition {
	return customSetting(
		"Add an excluded folder",
		"Notes in excluded folders are never moved or changed, and the data folder is always excluded. Type a path, including hidden folders, or choose one.",
		(setting) => {
			let typed = "";
			const addExclusion = (value: string): void => {
				const settings = ctx.plugin.settings;
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
			setting
				.setClass("dffa-stacked")
				.addText((text) =>
					text.setPlaceholder("Templates").onChange((value) => {
						typed = value;
					}),
				)
				.addButton((button) => button.setButtonText("Add").onClick(() => addExclusion(typed)))
				.addButton((button) =>
					button.setButtonText("Choose").onClick(() => {
						new FolderSuggestModal(ctx.app, allFolders(ctx.app), (folder) =>
							addExclusion(folder.path),
						).open();
					}),
				);
		},
	);
}
