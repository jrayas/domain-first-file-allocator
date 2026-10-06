import { App, Notice, PluginSettingTab, Setting, debounce } from "obsidian";
import { normaliseFolderPath } from "./core/paths";
import type DomainFirstFileAllocatorPlugin from "./main";

/**
 * Minimal settings tab for phase 1. The full screen (domain list, folder
 * picker, import and export) arrives in phase 4.
 */
export class AllocatorSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: DomainFirstFileAllocatorPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const save = debounce(() => void this.plugin.commitSettings(), 600, true);

		new Setting(containerEl)
			.setName("Property name")
			.setDesc("The frontmatter property that holds a note's domain.")
			.addText((text) =>
				text
					.setPlaceholder("domain")
					.setValue(this.plugin.settings.propertyName)
					.onChange((value) => {
						const trimmed = value.trim();
						if (trimmed === "") {
							return;
						}
						this.plugin.settings.propertyName = trimmed;
						new Notice("Existing notes keep their old property name; only future filing uses the new one.");
						save();
					}),
			);

		new Setting(containerEl)
			.setName("Data folder name")
			.setDesc("The hidden folder in the vault root that holds the synced data file.")
			.addText((text) =>
				text
					.setPlaceholder(".domain")
					.setValue(this.plugin.settings.dataFolderName)
					.onChange((value) => {
						const normalised = normaliseFolderPath(value);
						if (normalised === "") {
							return;
						}
						this.plugin.settings.dataFolderName = normalised;
						save();
					}),
			);

		new Setting(containerEl)
			.setName("Sync now")
			.setDesc("Reconcile these settings with the data file. The most recently updated side wins.")
			.addButton((button) =>
				button.setButtonText("Sync now").onClick(async () => {
					await this.plugin.jsonSync.sync({ manual: true });
					this.display();
				}),
			);
	}
}
