import { Notice, Plugin, TFile, type Menu } from "obsidian";
import { sanitiseSettings } from "./core/defaults";
import { Allocator } from "./services/allocator";
import { AutoFiler } from "./services/autoFiler";
import { BatchRunner } from "./services/batch";
import { FolderEvents } from "./services/folderEvents";
import { JsonSync } from "./services/jsonSync";
import { MovingGuard } from "./services/movingGuard";
import { UndoService, UndoStack } from "./services/undo";
import { VaultOps } from "./services/vaultOps";
import { AllocatorSettingTab } from "./settings";
import { DecisionModal } from "./ui/DecisionModal";
import type { AllocatorSettings, ConfigFile } from "./types";

/** Minimum gap between syncs triggered by the window regaining focus. */
const FOCUS_SYNC_INTERVAL_MS = 5000;

export default class DomainFirstFileAllocatorPlugin extends Plugin {
	settings!: AllocatorSettings;
	jsonSync!: JsonSync;
	allocator!: Allocator;
	undoService!: UndoService;
	folderEvents!: FolderEvents;
	autoFiler!: AutoFiler;
	private ribbonEl: HTMLElement | null = null;
	ops!: VaultOps;
	readonly guard = new MovingGuard();
	readonly undoStack = new UndoStack();
	readonly batchRunner = new BatchRunner();
	private lastFocusSync = 0;

	async onload(): Promise<void> {
		this.settings = sanitiseSettings(await this.loadData());

		this.jsonSync = new JsonSync(this.app, {
			getSettings: () => this.settings,
			adoptFileConfig: (config) => this.adoptFileConfig(config),
		});
		const host = {
			app: this.app,
			getSettings: () => this.settings,
			commitSettings: () => this.commitSettings(),
		};
		const ops = new VaultOps(this.app, this.guard);
		this.ops = ops;
		this.allocator = new Allocator(host, ops, this.undoStack);
		this.undoService = new UndoService(host, ops, this.undoStack);
		this.folderEvents = new FolderEvents(host, this.allocator, this.guard, this.undoStack, this.batchRunner);
		this.folderEvents.register(this);
		this.autoFiler = new AutoFiler(host, this.allocator);
		this.autoFiler.register(this);

		this.addSettingTab(new AllocatorSettingTab(this.app, this));
		this.registerCommands();
		this.registerContextMenu();
		this.registerRibbon();

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

	/** Commands are given no default hotkeys; the user assigns them in Settings, Hotkeys. */
	private registerCommands(): void {
		this.addCommand({
			id: "file-by-domain",
			name: "File note by domain",
			checkCallback: (checking) => this.withActiveNote(checking, (file) => this.allocator.fileByDomain(file)),
		});
		this.addCommand({
			id: "set-domain-from-folder",
			name: "Set domain from folder",
			checkCallback: (checking) =>
				this.withActiveNote(checking, (file) => this.allocator.setDomainFromFolder(file)),
		});
		this.addCommand({
			id: "undo-last-allocation",
			name: "Undo last allocation",
			callback: () => {
				void this.undoService.undoLast();
			},
		});
	}

	/** A left-ribbon icon that switches automatic filing on and off. */
	private registerRibbon(): void {
		this.ribbonEl = this.addRibbonIcon("zap", "Toggle automatic filing", () => {
			const { automatic } = this.settings;
			automatic.enabled = !automatic.enabled;
			void this.commitSettings();
			new Notice(`Automatic filing is ${automatic.enabled ? "on" : "off"}.`);
		});
		this.refreshRibbon();
	}

	/** Shows the current automatic-filing state on the ribbon icon. */
	refreshRibbon(): void {
		const on = this.settings.automatic.enabled;
		this.ribbonEl?.toggleClass("dffa-auto-on", on);
		this.ribbonEl?.setAttribute(
			"aria-label",
			`Automatic filing is ${on ? "on" : "off"}. Select to turn it ${on ? "off" : "on"}.`,
		);
		if (!on) {
			this.autoFiler?.cancelPending();
		}
	}

	/** Adds the two filing commands to the file explorer's context menu. */
	private registerContextMenu(): void {
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file) => {
				if (!(file instanceof TFile) || file.extension !== "md") {
					return;
				}
				menu.addItem((item) =>
					item
						.setTitle("File note by domain")
						.setIcon("folder-input")
						.onClick(() => void this.allocator.fileByDomain(file)),
				);
				menu.addItem((item) =>
					item
						.setTitle("Set domain from folder")
						.setIcon("tag")
						.onClick(() => void this.allocator.setDomainFromFolder(file)),
				);
			}),
		);
	}

	onunload(): void {
		this.batchRunner.cancel();
		DecisionModal.closeAll();
	}

	private withActiveNote(checking: boolean, action: (file: TFile) => Promise<void>): boolean {
		const file = this.app.workspace.getActiveFile();
		if (!(file instanceof TFile) || file.extension !== "md") {
			return false;
		}
		if (!checking) {
			void action(file);
		}
		return true;
	}

	/** Saves settings after a user change, stamps them as newest and mirrors them to the data file. */
	async commitSettings(): Promise<void> {
		this.settings.updatedAt = new Date().toISOString();
		await this.saveData(this.settings);
		this.refreshRibbon();
		await this.jsonSync.pushSettings();
	}

	/** Replaces the synced settings with an imported configuration and stamps it as the newest. */
	async importConfig(config: ConfigFile): Promise<void> {
		await this.adoptFileConfig(config);
		await this.commitSettings();
	}

	private async adoptFileConfig(config: ConfigFile): Promise<void> {
		this.settings = {
			updatedAt: config.updatedAt,
			propertyName: config.propertyName,
			fallback: config.fallback,
			excludeFolders: config.excludeFolders,
			folderMovePrompt: config.folderMovePrompt,
			automatic: config.automatic,
			domains: config.domains,
			dataFolderName: this.settings.dataFolderName,
		};
		await this.saveData(this.settings);
		this.refreshRibbon();
	}
}
