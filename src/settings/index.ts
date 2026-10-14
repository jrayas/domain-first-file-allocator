import { App, Notice, PluginSettingTab, debounce, type SettingDefinitionItem } from "obsidian";
import { getBinding, setBinding } from "../core/bindings";
import type DomainFirstFileAllocatorPlugin from "../main";
import { automaticPage } from "./automatic";
import { dataPage } from "./data";
import { domainsPage, type DomainViewState } from "./domains";
import { generalPage } from "./general";
import type { TabContext } from "./helpers";
import { promptsPage } from "./prompts";

/** Controls where each keystroke or drag would otherwise save: they save once the user pauses. */
const SAVED_AFTER_A_PAUSE = new Set([
	"propertyName",
	"optOutProperty",
	"fallback.folder",
	"dataFolderName",
	"automatic.delay",
	"prompts.previewThreshold",
]);

const SAVE_DELAY_MS = 700;

/**
 * The settings screen. Obsidian draws it from the definitions the five pages return, which is what
 * lets its settings search find these settings. A control's value is read from, and written to, the
 * settings through `core/bindings`, so nothing here holds a copy that could go stale.
 */
export class AllocatorSettingTab extends PluginSettingTab {
	private readonly domainView: DomainViewState = { sort: "path" };
	/** The property name before the first unsaved edit, so a change can be announced once it is saved. */
	private propertyAtLastSave: string | null = null;
	private savePending = false;
	/** The fallback folder's name was changed, so its folder is created when the screen closes. */
	private fallbackFolderEdited = false;
	private readonly saveAfterPause = debounce(() => this.save(), SAVE_DELAY_MS, true);

	constructor(
		app: App,
		private readonly plugin: DomainFirstFileAllocatorPlugin,
	) {
		super(app, plugin);
		this.icon = "zap";
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const ctx: TabContext = {
			app: this.app,
			plugin: this.plugin,
			commit: () => void this.plugin.commitSettings(),
			redraw: () => this.update(),
		};
		return [
			generalPage(ctx),
			domainsPage(ctx, this.domainView),
			promptsPage(ctx),
			automaticPage(ctx),
			dataPage(ctx),
		];
	}

	getControlValue(key: string): unknown {
		return getBinding(this.plugin.settings, key);
	}

	setControlValue(key: string, value: unknown): void {
		const settings = this.plugin.settings;
		if (key === "propertyName" && this.propertyAtLastSave === null) {
			this.propertyAtLastSave = settings.propertyName;
		}
		if (!setBinding(settings, key, value)) {
			return;
		}

		if (key === "automatic.enabled" && value === false) {
			this.plugin.resumeNow(false);
		}
		// Switching the fallback on creates its folder at once. A name is created when the screen is
		// closed instead, so a half-typed name does not leave a stray folder behind.
		if (key === "fallback.enabled" && value === true) {
			void this.plugin.ensureFallbackFolder();
		}
		if (key === "fallback.folder") {
			this.fallbackFolderEdited = true;
		}
		if (SAVED_AFTER_A_PAUSE.has(key)) {
			this.savePending = true;
			this.saveAfterPause();
		} else {
			void this.plugin.commitSettings();
		}

		// A change that alters what else is shown: the snooze row follows the on/off switch, and the
		// preset name and every popup choice follow one another.
		const changesOtherRows =
			key === "automatic.enabled" ||
			key === "prompts.preset" ||
			key === "folderMovePrompt" ||
			(key.startsWith("prompts.") && key !== "prompts.previewThreshold");
		if (changesOtherRows) {
			this.update();
		}
	}

	/** Redraws the screen after the settings changed underneath it, for example from the data file. */
	refreshIfOpen(): void {
		this.update();
	}

	hide(): void {
		// A change made just before closing the screen is saved now, not lost with the timer.
		if (this.savePending) {
			this.saveAfterPause.cancel();
			this.save();
		}
		if (this.fallbackFolderEdited) {
			this.fallbackFolderEdited = false;
			void this.plugin.ensureFallbackFolder();
		}
	}

	private save(): void {
		this.savePending = false;
		if (this.propertyAtLastSave !== null && this.plugin.settings.propertyName !== this.propertyAtLastSave) {
			new Notice("Existing notes keep their old property name; only future filing uses the new one.");
		}
		this.propertyAtLastSave = null;
		void this.plugin.commitSettings();
	}
}
