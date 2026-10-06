import { Plugin, TFile } from "obsidian";
import { sanitiseSettings } from "./core/defaults";
import { Allocator } from "./services/allocator";
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
		this.allocator = new Allocator(host, ops, this.undoStack);
		this.undoService = new UndoService(host, ops, this.undoStack);
		this.folderEvents = new FolderEvents(host, this.allocator, this.guard, this.undoStack, this.batchRunner);
		this.folderEvents.register(this);

		this.addSettingTab(new AllocatorSettingTab(this.app, this));
		this.registerCommands();

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
