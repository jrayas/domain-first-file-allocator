import { Notice, Setting, setIcon, type App } from "obsidian";
import { isExcluded, parentFolder, pathKey } from "../core/paths";
import { addDomain, isAutoAllowed, removeDomain, subfoldersToAdd } from "../core/registry";
import type { DomainEntry } from "../types";
import { BulkAddModal } from "../ui/BulkAddModal";
import { ConfirmModal } from "../ui/ConfirmModal";
import { FolderSuggestModal } from "../ui/FolderSuggestModal";
import { addChoice, addHeading, addNote, allFolders, type Choice, type TabContext } from "./helpers";

export type DomainSort = "path" | "status" | "registry";

/** The list's search text and sort order, kept while the settings screen stays open. */
export interface DomainViewState {
	filter: string;
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

function visibleDomains(domains: readonly DomainEntry[], state: DomainViewState): DomainEntry[] {
	const needle = state.filter.trim().toLowerCase();
	const shown = domains.filter((entry) => needle === "" || entry.folder.toLowerCase().includes(needle));
	if (state.sort === "path") {
		return [...shown].sort((a, b) => a.folder.localeCompare(b.folder));
	}
	if (state.sort === "status") {
		return [...shown].sort(
			(a, b) => Number(b.enabled) - Number(a.enabled) || a.folder.localeCompare(b.folder),
		);
	}
	return shown;
}

export function renderDomains(el: HTMLElement, ctx: TabContext, state: DomainViewState): void {
	const settings = ctx.plugin.settings;
	addHeading(el, "Domains");
	addNote(
		el,
		"A domain is a folder's full path. Each can be on for manual and automatic filing, manual only, or off.",
	);

	if (settings.domains.length > 0) {
		renderListControls(el, ctx, state);
	}
	const listEl = el.createDiv({ cls: "dffa-domain-list" });
	const counts = countNotesByFolder(ctx.app);
	const renderList = (): void => drawList(listEl, ctx, state, counts, renderList);
	renderList();

	new Setting(el)
		.setName("Add a domain")
		.setDesc("Choose a folder that is not yet a domain.")
		.addButton((button) =>
			button
				.setButtonText("Choose folder")
				.setCta()
				.onClick(() => {
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
				}),
		);

	new Setting(el)
		.setName("Add subfolders")
		.setDesc("Register the subfolders of a folder at once.")
		.addButton((button) =>
			button.setButtonText("Choose parent folder").onClick(() => {
				new FolderSuggestModal(ctx.app, allFolders(ctx.app), (parent) => void addSubfolders(ctx, parent.path)).open();
			}),
		);
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

function renderListControls(el: HTMLElement, ctx: TabContext, state: DomainViewState): void {
	const settings = ctx.plugin.settings;
	const redrawList = (): void => ctx.redraw();

	new Setting(el)
		.setName("Search")
		.addSearch((search) => {
			search
				.setPlaceholder("Filter domains")
				.setValue(state.filter)
				.onChange((value) => {
					state.filter = value;
					// Redraw only the list, so the search box keeps focus.
					const list = el.querySelector<HTMLElement>(".dffa-domain-list");
					if (list) {
						drawList(list, ctx, state, countNotesByFolder(ctx.app), () => undefined);
					}
				});
		});

	addChoice(el, "Sort", "", SORT_CHOICES, state.sort, (value) => {
		state.sort = value;
		redrawList();
	});

	new Setting(el)
		.setName("Switch all shown")
		.setDesc("Applies to the domains matching the search.")
		.addButton((button) =>
			button.setButtonText("Turn all on").onClick(() => {
				for (const entry of visibleDomains(settings.domains, state)) {
					entry.enabled = true;
				}
				ctx.commit();
				ctx.redraw();
			}),
		)
		.addButton((button) =>
			button.setButtonText("Turn all off").onClick(() => {
				for (const entry of visibleDomains(settings.domains, state)) {
					entry.enabled = false;
				}
				ctx.commit();
				ctx.redraw();
			}),
		);
}

function drawList(
	listEl: HTMLElement,
	ctx: TabContext,
	state: DomainViewState,
	counts: Map<string, number>,
	rerender: () => void,
): void {
	const settings = ctx.plugin.settings;
	listEl.empty();
	if (settings.domains.length === 0) {
		listEl.createEl("p", { cls: "dffa-muted", text: "No domains yet. Add one below." });
		return;
	}
	const shown = visibleDomains(settings.domains, state);
	if (shown.length === 0) {
		listEl.createEl("p", { cls: "dffa-muted", text: `No domains match "${state.filter}".` });
		return;
	}

	for (const entry of shown) {
		const exists = ctx.plugin.ops.findFolder(entry.folder) !== null;
		const noteCount = counts.get(pathKey(entry.folder)) ?? 0;
		const details = [`${noteCount} ${noteCount === 1 ? "note" : "notes"}`];
		if (!exists) {
			details.push("Folder missing. Kept in case it returns.");
		}

		const row = new Setting(listEl)
			.setName(entry.folder)
			.setDesc(details.join(". "))
			.setClass("dffa-list-row")
			.setClass("dffa-choice");
		if (!exists) {
			const icon = row.nameEl.createSpan({ cls: "dffa-warning-icon" });
			setIcon(icon, "alert-triangle");
			row.nameEl.prepend(icon);
		}
		row.addDropdown((dropdown) => {
			for (const [value, label] of MODE_CHOICES) {
				dropdown.addOption(value, label);
			}
			dropdown.setValue(modeOf(entry));
			dropdown.onChange((value) => {
				applyMode(entry, value as DomainMode);
				ctx.commit();
				rerender();
			});
		}).addExtraButton((button) =>
			button
				.setIcon("trash")
				.setTooltip("Remove domain")
				.onClick(() => void confirmRemove(ctx, entry.folder)),
		);
	}
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
