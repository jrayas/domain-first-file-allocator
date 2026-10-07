import { Menu, Plugin, TFile } from "obsidian";
import { sanitiseSettings, settingsFromConfig } from "./core/defaults";
import { UndoStack } from "./core/undoStack";
import { Allocator } from "./services/allocator";
import { AutoFiler } from "./services/autoFiler";
import { BatchRunner } from "./services/batch";
import { FolderEvents } from "./services/folderEvents";
import { JsonSync } from "./services/jsonSync";
import { MovingGuard } from "./services/movingGuard";
import { Notifier } from "./services/notify";
import { UndoService } from "./services/undo";
import { VaultOps } from "./services/vaultOps";
import { AllocatorSettingTab } from "./settings";
import type { AllocatorSettings, ConfigFile } from "./types";
import { DecisionModal } from "./ui/DecisionModal";
import { SyncConflictModal } from "./ui/SyncConflictModal";

/** Minimum gap between syncs triggered by the window regaining focus. */
const FOCUS_SYNC_INTERVAL_MS = 5000;

export default class DomainFirstFileAllocatorPlugin extends Plugin {
	settings!: AllocatorSettings;
	jsonSync!: JsonSync;
	allocator!: Allocator;
	undoService!: UndoService;
	folderEvents!: FolderEvents;
	autoFiler!: AutoFiler;
	ops!: VaultOps;
	readonly guard = new MovingGuard();
	readonly notifier = new Notifier(() => this.settings.notices);
	readonly undoStack = new UndoStack(() => this.settings.undoDepth);
	readonly batchRunner = new BatchRunner();
	private ribbonEl: HTMLElement | null = null;
	private lastFocusSync = 0;
	/** Automatic filing is paused until this time. Not saved: a restart resumes it. */
	private snoozedUntil = 0;
	private snoozeTimer: number | null = null;

	async onload(): Promise<void> {
		this.settings = sanitiseSettings(await this.loadData());

		this.jsonSync = new JsonSync(this.app, {
			notifier: this.notifier,
			getSettings: () => this.settings,
			adoptFileConfig: (config) => this.adoptFileConfig(config),
			chooseConflictSide: (filePath, differences) =>
				new SyncConflictModal(this.app, filePath, differences).ask(),
		});
		const host = {
			app: this.app,
			notifier: this.notifier,
			getSettings: () => this.settings,
			commitSettings: () => this.commitSettings(),
		};
		this.ops = new VaultOps(this.app, this.guard);
		this.allocator = new Allocator(host, this.ops, this.undoStack);
		this.undoService = new UndoService(host, this.ops, this.undoStack);
		this.folderEvents = new FolderEvents(host, this.allocator, this.guard, this.undoStack, this.batchRunner);
		this.folderEvents.register(this);
		this.autoFiler = new AutoFiler({ ...host, isSnoozed: () => this.isSnoozed() }, this.allocator);
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

	// ------------------------------------------------------------------ ribbon

	/**
	 * A left-ribbon icon. Selecting it switches automatic filing on or off; its
	 * context menu (right-click, or long-press where supported) also offers snooze.
	 */
	private registerRibbon(): void {
		this.ribbonEl = this.addRibbonIcon("zap", "Toggle automatic filing", () => this.toggleAutomatic());
		this.registerDomEvent(this.ribbonEl, "contextmenu", (event: MouseEvent) => {
			event.preventDefault();
			this.openRibbonMenu(event);
		});
		this.refreshRibbon();
	}

	private toggleAutomatic(): void {
		const { automatic } = this.settings;
		automatic.enabled = !automatic.enabled;
		if (!automatic.enabled) {
			this.resumeNow(false);
		}
		void this.commitSettings();
		this.notifier.info(`Automatic filing is ${automatic.enabled ? "on" : "off"}.`);
	}

	private openRibbonMenu(event: MouseEvent): void {
		const menu = new Menu();
		const { automatic } = this.settings;
		menu.addItem((item) =>
			item
				.setTitle(automatic.enabled ? "Turn automatic filing off" : "Turn automatic filing on")
				.setIcon("zap")
				.onClick(() => this.toggleAutomatic()),
		);
		if (automatic.enabled) {
			if (this.isSnoozed()) {
				menu.addItem((item) =>
					item
						.setTitle("Resume now")
						.setIcon("play")
						.onClick(() => this.resumeNow(true)),
				);
			} else {
				menu.addItem((item) =>
					item
						.setTitle("Snooze for 15 minutes")
						.setIcon("pause")
						.onClick(() => this.snoozeFor(15)),
				);
				menu.addItem((item) =>
					item
						.setTitle("Snooze for 1 hour")
						.setIcon("pause")
						.onClick(() => this.snoozeFor(60)),
				);
			}
		}
		menu.showAtMouseEvent(event);
	}

	/** Shows the current automatic-filing state on the ribbon icon. */
	refreshRibbon(): void {
		const on = this.settings.automatic.enabled;
		const snoozed = on && this.isSnoozed();
		this.ribbonEl?.toggleClass("dffa-auto-on", on && !snoozed);
		this.ribbonEl?.toggleClass("dffa-auto-snoozed", snoozed);
		const state = !on ? "off" : snoozed ? "snoozed" : "on";
		this.ribbonEl?.setAttribute(
			"aria-label",
			`Automatic filing is ${state}. Select to turn it ${on ? "off" : "on"}. Right-click for snooze.`,
		);
		if (!on) {
			this.autoFiler?.cancelPending();
		}
	}

	// ------------------------------------------------------------------ snooze

	isSnoozed(): boolean {
		return Date.now() < this.snoozedUntil;
	}

	/** Minutes left on the snooze, rounded up, or 0 when not snoozed. */
	snoozeMinutesLeft(): number {
		return this.isSnoozed() ? Math.ceil((this.snoozedUntil - Date.now()) / 60000) : 0;
	}

	/** Pauses automatic filing. Changes made while paused are not filed afterwards. */
	snoozeFor(minutes: number): void {
		this.clearSnoozeTimer();
		this.snoozedUntil = Date.now() + minutes * 60000;
		this.snoozeTimer = window.setTimeout(() => {
			this.snoozeTimer = null;
			this.refreshRibbon();
			this.notifier.info("Automatic filing has resumed.");
		}, minutes * 60000);
		this.refreshRibbon();
		this.notifier.info(`Automatic filing is paused for ${minutes} minutes. Changes made meanwhile are not filed.`);
	}

	resumeNow(announce: boolean): void {
		const wasSnoozed = this.isSnoozed();
		this.clearSnoozeTimer();
		this.snoozedUntil = 0;
		this.refreshRibbon();
		if (announce && wasSnoozed) {
			this.notifier.info("Automatic filing has resumed.");
		}
	}

	private clearSnoozeTimer(): void {
		if (this.snoozeTimer !== null) {
			window.clearTimeout(this.snoozeTimer);
			this.snoozeTimer = null;
		}
	}

	// ----------------------------------------------------------- context menu

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
		this.clearSnoozeTimer();
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

	// ---------------------------------------------------------------- settings

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
		this.settings = settingsFromConfig(config, this.settings.dataFolderName);
		await this.saveData(this.settings);
		this.refreshRibbon();
	}
}
