import { Notice, setIcon, type App, type SettingDefinition, type SettingDefinitionPage } from "obsidian";
import { isExcluded, parentFolder, pathKey } from "../core/paths";
import { addDomain, isAutoAllowed, removeDomain, subfoldersToAdd } from "../core/registry";
import type { DomainEntry } from "../types";
import { BulkAddModal } from "../ui/BulkAddModal";
import { ConfirmModal } from "../ui/ConfirmModal";
import { FolderSuggestModal } from "../ui/FolderSuggestModal";
import { allFolders, customSetting, noteSetting, type Choice, type TabContext } from "./helpers";

export type DomainSort = "path" | "status" | "registry";

/** The list's sort order, kept while the settings screen stays open. */
export interface DomainViewState {
	sort: DomainSort;
}

type DomainMode = "off" | "manual" | "auto";

const MODE_CHOICES: readonly Choice<DomainMode>[] = [
	["auto", "Manual and automatic"],
	["manual", "Manual only"],
	["off", "Off"],
];

const SORT_CHOICES: readonly Choice<DomainSort>[] = [
	["path", "By folder path"],
	["status", "Enabled first"],
	["registry", "In the order added"],
];

function modeOf(entry: DomainEntry): DomainMode {
	if (!entry.enabled) {
		return "off";
	}
	return isAutoAllowed(entry) ? "auto" : "manual";
}

function applyMode(entry: DomainEntry, mode: DomainMode): void {
	entry.enabled = mode !== "off";
	if (mode === "manual") {
		entry.allowAuto = false;
	} else {
		delete entry.allowAuto;
	}
}

/** How many notes sit directly in each folder, keyed by lower-case path. */
function countNotesByFolder(app: App): Map<string, number> {
	const counts = new Map<string, number>();
	for (const file of app.vault.getMarkdownFiles()) {
		const key = pathKey(parentFolder(file.path));
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

function sortedDomains(domains: readonly DomainEntry[], sort: DomainSort): DomainEntry[] {
	if (sort === "path") {
		return [...domains].sort((a, b) => a.folder.localeCompare(b.folder));
	}
	if (sort === "status") {
		return [...domains].sort(
			(a, b) => Number(b.enabled) - Number(a.enabled) || a.folder.localeCompare(b.folder),
		);
	}
	return [...domains];
}

export function domainsPage(ctx: TabContext, view: DomainViewState): SettingDefinitionPage {
	const domains = ctx.plugin.settings.domains;
	// Counting the notes in every folder reads the whole vault, so it waits until a row is drawn
	// and happens once for the page, not once per row.
	let counts: Map<string, number> | null = null;
	const noteCounts = (): Map<string, number> => (counts ??= countNotesByFolder(ctx.app));

	return {
		type: "page",
		name: "Domains",
		desc: "The folders that notes can be filed into.",
		displayValue: () => `${ctx.plugin.settings.domains.length}`,
		items: [
			{
				type: "group",
				heading: "Add domains",
				items: [
					noteSetting(
						"About domains",
						"A domain is a folder's full path. Each can be on for manual and automatic filing, manual only, or off.",
					),
					customSetting("Add a domain", "Choose a folder that is not yet a domain.", (setting) =>
						setting.addButton((button) =>
							button
								.setButtonText("Choose folder")
								.setCta()
								.onClick(() => chooseDomain(ctx)),
						),
					),
					customSetting("Add subfolders", "Register the subfolders of a folder at once.", (setting) =>
						setting.addButton((button) =>
							button.setButtonText("Choose parent folder").onClick(() => {
								new FolderSuggestModal(
									ctx.app,
									allFolders(ctx.app),
									(parent) => void addSubfolders(ctx, parent.path),
								).open();
							}),
						),
					),
				],
			},
			{
				type: "group",
				heading: "Order and bulk changes",
				visible: () => ctx.plugin.settings.domains.length > 0,
				items: [
					customSetting("Sort", "", (setting) =>
						setting.addDropdown((dropdown) => {
							for (const [value, label] of SORT_CHOICES) {
								dropdown.addOption(value, label);
							}
							dropdown.setValue(view.sort);
							dropdown.onChange((value) => {
								view.sort = value as DomainSort;
								ctx.redraw();
							});
						}),
					),
					customSetting("Switch all domains", "Applies to every domain in the list.", (setting) =>
						setting
							.addButton((button) =>
								button.setButtonText("Turn all on").onClick(() => void switchAll(ctx, true)),
							)
							.addButton((button) =>
								button.setButtonText("Turn all off").onClick(() => void switchAll(ctx, false)),
							),
					),
				],
			},
			{
				type: "list",
				heading: "Registered domains",
				emptyState: "No domains yet. Add one above.",
				search: {
					placeholder: "Filter domains",
					match: (definition, query) => definition.name.toLowerCase().includes(query.trim().toLowerCase()),
				},
				items: sortedDomains(domains, view.sort).map((entry) => domainRow(ctx, view, entry, noteCounts)),
			},
		],
	};
}

function domainRow(
	ctx: TabContext,
	view: DomainViewState,
	entry: DomainEntry,
	noteCounts: () => Map<string, number>,
): SettingDefinition {
	return {
		name: entry.folder,
		render: (setting) => {
			const exists = ctx.plugin.ops.findFolder(entry.folder) !== null;
			const noteCount = noteCounts().get(pathKey(entry.folder)) ?? 0;
			const details = [`${noteCount} ${noteCount === 1 ? "note" : "notes"}`];
			if (!exists) {
				details.push("Folder missing. Kept in case it returns.");
			}
			setting.setDesc(details.join(". ")).setClass("dffa-list-row").setClass("dffa-choice");
			if (!exists) {
				const icon = setting.nameEl.createSpan({ cls: "dffa-warning-icon" });
				setIcon(icon, "alert-triangle");
				setting.nameEl.prepend(icon);
			}
			setting
				.addDropdown((dropdown) => {
					for (const [value, label] of MODE_CHOICES) {
						dropdown.addOption(value, label);
					}
					dropdown.setValue(modeOf(entry));
					dropdown.onChange((value) => {
						applyMode(entry, value as DomainMode);
						ctx.commit();
						// Only the "enabled first" order changes with a domain's mode.
						if (view.sort === "status") {
							ctx.redraw();
						}
					});
				})
				.addExtraButton((button) =>
					button
						.setIcon("trash")
						.setTooltip("Remove domain")
						.onClick(() => void confirmRemove(ctx, entry.folder)),
				);
		},
	};
}

function chooseDomain(ctx: TabContext): void {
	const settings = ctx.plugin.settings;
	const registered = new Set(settings.domains.map((d) => pathKey(d.folder)));
	const choices = allFolders(ctx.app).filter(
		(folder) =>
			!registered.has(pathKey(folder.path)) &&
			!isExcluded(folder.path, settings.excludeFolders, settings.dataFolderName),
	);
	new FolderSuggestModal(ctx.app, choices, (folder) => {
		const result = addDomain(settings.domains, folder.path);
		if (!result.ok) {
			new Notice(result.reason);
			return;
		}
		settings.domains = result.registry;
		ctx.commit();
		ctx.redraw();
	}).open();
}

async function addSubfolders(ctx: TabContext, parent: string): Promise<void> {
	const settings = ctx.plugin.settings;
	const paths = allFolders(ctx.app).map((folder) => folder.path);
	const chosen = await new BulkAddModal(ctx.app, parent, (recursive) =>
		subfoldersToAdd(settings.domains, paths, {
			parent,
			recursive,
			excludeFolders: settings.excludeFolders,
			dataFolderName: settings.dataFolderName,
		}),
	).ask();
	if (chosen === null || chosen.length === 0) {
		return;
	}
	let registry = settings.domains;
	for (const folder of chosen) {
		const result = addDomain(registry, folder);
		if (result.ok) {
			registry = result.registry;
		}
	}
	const added = registry.length - settings.domains.length;
	settings.domains = registry;
	ctx.commit();
	ctx.redraw();
	new Notice(`Added ${added} ${added === 1 ? "domain" : "domains"}.`);
}

/** Switches every domain on or off, after asking, because it changes the whole list at once. */
async function switchAll(ctx: TabContext, enabled: boolean): Promise<void> {
	const domains = ctx.plugin.settings.domains;
	const affected = domains.filter((entry) => entry.enabled !== enabled).length;
	if (affected === 0) {
		new Notice(enabled ? "Every domain is already on." : "Every domain is already off.");
		return;
	}
	const confirmed = await new ConfirmModal(ctx.app, {
		title: enabled ? "Turn all domains on?" : "Turn all domains off?",
		lines: [
			`${affected} ${affected === 1 ? "domain" : "domains"} will be switched ${enabled ? "on" : "off"}.`,
			"Folders and notes are not changed.",
		],
		confirmText: enabled ? "Turn all on" : "Turn all off",
		destructive: false,
	}).ask();
	if (!confirmed) {
		return;
	}
	for (const entry of ctx.plugin.settings.domains) {
		entry.enabled = enabled;
	}
	ctx.commit();
	ctx.redraw();
}

async function confirmRemove(ctx: TabContext, folder: string): Promise<void> {
	const confirmed = await new ConfirmModal(ctx.app, {
		title: "Remove domain?",
		lines: [`"${folder}" will no longer be a domain. The folder and its notes are not changed.`],
		confirmText: "Remove",
		destructive: true,
	}).ask();
	if (!confirmed) {
		return;
	}
	ctx.plugin.settings.domains = removeDomain(ctx.plugin.settings.domains, folder);
	ctx.commit();
	ctx.redraw();
}
