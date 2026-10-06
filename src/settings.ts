import { App, Notice, PluginSettingTab, Setting, TFolder, debounce, setIcon } from "obsidian";
import { parseConfigJson } from "./core/jsonSchema";
import { summariseChanges } from "./core/merge";
import { isExcluded, normaliseFolderPath, pathKey } from "./core/paths";
import { addDomain, removeDomain } from "./core/registry";
import type DomainFirstFileAllocatorPlugin from "./main";
import type { FolderMovePrompt } from "./types";
import { ConfirmModal } from "./ui/ConfirmModal";
import { FolderSuggestModal } from "./ui/FolderSuggestModal";

/** The settings screen: general, domains, behaviour and data. */
export class AllocatorSettingTab extends PluginSettingTab {
	private persistedPropertyName: string;

	constructor(
		app: App,
		private readonly plugin: DomainFirstFileAllocatorPlugin,
	) {
		super(app, plugin);
		this.persistedPropertyName = plugin.settings.propertyName;
	}

	/** Saves straight away; used for toggles, dropdowns and buttons. */
	private commit(): void {
		void this.plugin.commitSettings();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("dffa-settings");
		this.persistedPropertyName = this.plugin.settings.propertyName;

		this.renderGeneral(containerEl);
		this.renderDomains(containerEl);
		this.renderBehaviour(containerEl);
		this.renderData(containerEl);
	}

	// ---------------------------------------------------------------- general

	private renderGeneral(containerEl: HTMLElement): void {
		const settings = this.plugin.settings;
		new Setting(containerEl).setName("General").setHeading();

		const saveText = debounce(
			() => {
				if (settings.propertyName !== this.persistedPropertyName) {
					this.persistedPropertyName = settings.propertyName;
					new Notice("Existing notes keep their old property name; only future filing uses the new one.");
				}
				this.commit();
			},
			700,
			true,
		);

		new Setting(containerEl)
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

		new Setting(containerEl)
			.setName("Use fallback folder")
			.setDesc("Send notes with no matching domain to the fallback folder. When off, they stay where they are.")
			.addToggle((toggle) =>
				toggle.setValue(settings.fallback.enabled).onChange((value) => {
					settings.fallback.enabled = value;
					this.commit();
				}),
			);

		const fallbackSetting = new Setting(containerEl)
			.setName("Fallback folder")
			.setDesc(this.fallbackDescription())
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
						fallbackSetting.setDesc(this.fallbackDescription());
						saveText();
					}),
			);

		this.renderExclusions(containerEl);
	}

	private fallbackDescription(): string {
		const { fallback, excludeFolders, dataFolderName } = this.plugin.settings;
		const base = "Any folder name or path. It is created when first needed.";
		return isExcluded(fallback.folder, excludeFolders, dataFolderName)
			? `${base} Note: this folder is excluded, so notes filed there will not be moved again.`
			: base;
	}

	private renderExclusions(containerEl: HTMLElement): void {
		const settings = this.plugin.settings;
		new Setting(containerEl)
			.setName("Excluded folders")
			.setDesc(
				"Notes in these folders, and their subfolders, are never moved or changed. The data folder is always excluded as well.",
			);

		for (const folder of settings.excludeFolders) {
			new Setting(containerEl)
				.setName(folder)
				.setClass("dffa-list-row")
				.addExtraButton((button) =>
					button
						.setIcon("trash")
						.setTooltip("Remove from exclusions")
						.onClick(() => {
							settings.excludeFolders = settings.excludeFolders.filter((f) => f !== folder);
							this.commit();
							this.display();
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
			this.commit();
			this.display();
		};
		new Setting(containerEl)
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
					new FolderSuggestModal(this.app, this.allFolders(), (folder) => addExclusion(folder.path)).open();
				}),
			);
	}

	// ---------------------------------------------------------------- domains

	private renderDomains(containerEl: HTMLElement): void {
		const settings = this.plugin.settings;
		new Setting(containerEl).setName("Domains").setHeading();
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "A domain is the full path of a folder. Only registered, enabled domains are used for filing.",
		});

		if (settings.domains.length === 0) {
			containerEl.createEl("p", { cls: "dffa-muted", text: "No domains yet. Add one below." });
		}

		for (const entry of settings.domains) {
			const exists = this.plugin.ops.findFolder(entry.folder) !== null;
			const row = new Setting(containerEl).setName(entry.folder).setClass("dffa-list-row");
			if (!exists) {
				row.setDesc("This folder no longer exists. The domain is kept in case the folder returns.");
				const icon = row.nameEl.createSpan({ cls: "dffa-warning-icon" });
				setIcon(icon, "alert-triangle");
				row.nameEl.prepend(icon);
			}
			row.addToggle((toggle) =>
				toggle
					.setValue(entry.enabled)
					.setTooltip(entry.enabled ? "Enabled" : "Disabled")
					.onChange((value) => {
						entry.enabled = value;
						this.commit();
					}),
			).addExtraButton((button) =>
				button
					.setIcon("trash")
					.setTooltip("Remove domain")
					.onClick(() => void this.confirmRemoveDomain(entry.folder)),
			);
		}

		new Setting(containerEl)
			.setName("Add a domain")
			.setDesc("Choose an existing folder. Folders already registered or excluded are not offered.")
			.addButton((button) =>
				button
					.setButtonText("Choose folder")
					.setCta()
					.onClick(() => {
						const registered = new Set(settings.domains.map((d) => pathKey(d.folder)));
						const choices = this.allFolders().filter(
							(folder) =>
								!registered.has(pathKey(folder.path)) &&
								!isExcluded(folder.path, settings.excludeFolders, settings.dataFolderName),
						);
						new FolderSuggestModal(this.app, choices, (folder) => this.addDomainFromPicker(folder)).open();
					}),
			);
	}

	private allFolders(): TFolder[] {
		return this.app.vault
			.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder && !file.isRoot())
			.sort((a, b) => a.path.localeCompare(b.path));
	}

	private addDomainFromPicker(folder: TFolder): void {
		const settings = this.plugin.settings;
		const result = addDomain(settings.domains, folder.path);
		if (!result.ok) {
			new Notice(result.reason);
			return;
		}
		settings.domains = result.registry;
		this.commit();
		this.display();
	}

	private async confirmRemoveDomain(folder: string): Promise<void> {
		const confirmed = await new ConfirmModal(this.app, {
			title: "Remove domain?",
			lines: [`"${folder}" will no longer be a domain. The folder and its notes are not changed.`],
			confirmText: "Remove",
			destructive: true,
		}).ask();
		if (!confirmed) {
			return;
		}
		this.plugin.settings.domains = removeDomain(this.plugin.settings.domains, folder);
		this.commit();
		this.display();
	}

	// -------------------------------------------------------------- behaviour

	private renderBehaviour(containerEl: HTMLElement): void {
		const settings = this.plugin.settings;
		new Setting(containerEl).setName("Behaviour").setHeading();

		new Setting(containerEl)
			.setName("Folder-move prompt")
			.setDesc(
				"What to do when you move a note by hand into a domain folder and its property no longer matches. Notes moved within half a second of each other are handled together.",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("ask", "Ask")
					.addOption("always", "Always update")
					.addOption("never", "Never")
					.setValue(settings.folderMovePrompt)
					.onChange((value) => {
						settings.folderMovePrompt = value as FolderMovePrompt;
						this.commit();
					}),
			);
	}

	// ------------------------------------------------------------------- data

	private renderData(containerEl: HTMLElement): void {
		const settings = this.plugin.settings;
		new Setting(containerEl).setName("Data").setHeading();

		const saveFolder = debounce(() => this.commit(), 700, true);
		new Setting(containerEl)
			.setName("Data folder name")
			.setDesc(
				`A hidden folder in the vault root that holds folder.json, a copy of these settings. Currently ${this.plugin.jsonSync.filePath}.`,
			)
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

		new Setting(containerEl)
			.setName("Sync now")
			.setDesc(
				"Compare these settings with the data file. The most recently updated side wins. Changes to hidden files are not announced, so use this after editing the file elsewhere.",
			)
			.addButton((button) =>
				button.setButtonText("Sync now").onClick(async () => {
					await this.plugin.jsonSync.sync({ manual: true });
					this.display();
				}),
			);

		new Setting(containerEl)
			.setName("Export")
			.setDesc("Save a dated copy of these settings next to the data file.")
			.addButton((button) =>
				button.setButtonText("Export").onClick(() => {
					void this.plugin.jsonSync.exportFreshCopy();
				}),
			);

		new Setting(containerEl)
			.setName("Import")
			.setDesc(
				"Replace these settings with a settings file. You will see what changes first, and a backup is saved before anything is replaced.",
			)
			.addButton((button) =>
				button.setButtonText("Import").onClick(() => {
					void this.importFromFile();
				}),
			);
	}

	/** Asks the user for a JSON file using the platform's own file picker (works on mobile). */
	private pickFileText(): Promise<string | null> {
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

	private async importFromFile(): Promise<void> {
		const text = await this.pickFileText();
		if (text === null) {
			return;
		}
		const parsed = parseConfigJson(text);
		if (!parsed.ok) {
			new Notice(`That file cannot be imported. ${parsed.error} Nothing was changed.`, 10000);
			return;
		}

		const changes = summariseChanges(this.plugin.settings, parsed.config);
		if (changes.length === 0) {
			new Notice("That file matches your current settings, so nothing would change.");
			return;
		}
		const confirmed = await new ConfirmModal(this.app, {
			title: "Import settings?",
			lines: [...changes, ...parsed.warnings, "A backup of your current settings will be saved first."],
			confirmText: "Import",
			destructive: true,
		}).ask();
		if (!confirmed) {
			return;
		}

		const backup = await this.plugin.jsonSync.exportFreshCopy("folder-backup");
		if (backup === null) {
			new Notice("The backup could not be saved, so the import was cancelled.");
			return;
		}
		await this.plugin.importConfig(parsed.config);
		new Notice("Settings imported.");
		this.display();
	}
}
