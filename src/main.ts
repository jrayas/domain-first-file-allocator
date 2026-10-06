import { Plugin } from "obsidian";
import { sanitiseSettings } from "./core/defaults";
import { JsonSync } from "./services/jsonSync";
import { AllocatorSettingTab } from "./settings";
import type { AllocatorSettings, ConfigFile } from "./types";

/** Minimum gap between syncs triggered by the window regaining focus. */
const FOCUS_SYNC_INTERVAL_MS = 5000;

export default class DomainFirstFileAllocatorPlugin extends Plugin {
	settings!: AllocatorSettings;
	jsonSync!: JsonSync;
	private lastFocusSync = 0;

	async onload(): Promise<void> {
		this.settings = sanitiseSettings(await this.loadData());

		this.jsonSync = new JsonSync(this.app, {
			getSettings: () => this.settings,
			adoptFileConfig: (config) => this.adoptFileConfig(config),
		});

		this.addSettingTab(new AllocatorSettingTab(this.app, this));

		// Hidden-file changes raise no vault events, so sync on load and on focus.
		this.app.workspace.onLayoutReady(() => {
			void this.jsonSync.sync();
		});
		this.registerDomEvent(window, "focus", () => {
			const now = Date.now();
			if (now - this.lastFocusSync < FOCUS_SYNC_INTERVAL_MS) {
				return;
			}
			this.lastFocusSync = now;
			void this.jsonSync.sync();
		});
	}

	/** Saves settings after a user change, stamps them as newest and mirrors them to the data file. */
	async commitSettings(): Promise<void> {
		this.settings.updatedAt = new Date().toISOString();
		await this.saveData(this.settings);
		await this.jsonSync.pushSettings();
	}

	private async adoptFileConfig(config: ConfigFile): Promise<void> {
		this.settings = {
			updatedAt: config.updatedAt,
			propertyName: config.propertyName,
			fallback: config.fallback,
			excludeFolders: config.excludeFolders,
			folderMovePrompt: config.folderMovePrompt,
			domains: config.domains,
			dataFolderName: this.settings.dataFolderName,
		};
		await this.saveData(this.settings);
	}
}
