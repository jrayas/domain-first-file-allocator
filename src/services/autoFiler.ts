import { TFile, type App, type Plugin, type TAbstractFile } from "obsidian";
import type { AllocatorSettings } from "../types";
import type { Allocator } from "./allocator";
import { readFrontmatter } from "./frontmatter";

/** A busy allocator is retried this many times before giving up on a note. */
const MAX_BUSY_RETRIES = 3;

export interface AutoFilerHost {
	app: App;
	getSettings(): AllocatorSettings;
	/** True while the user has paused automatic filing from the ribbon or settings. */
	isSnoozed(): boolean;
}

/**
 * Files notes automatically once their domain property has stopped changing
 * for the configured delay. It reacts only to changes in the property (and,
 * if enabled, to new notes), so a note you move by hand is never moved back.
 */
export class AutoFiler {
	/** The last property value seen per note path, as a comparable string. */
	private readonly lastSeen = new Map<string, string>();
	private baselineProperty: string | null = null;
	private readonly timers = new Map<TFile, number>();
	/** Notes that were open in the editor when their turn came; filed once they are no longer the active note. */
	private readonly waitingForClose = new Set<TFile>();
	private ready = false;
	private disposed = false;

	constructor(
		private readonly host: AutoFilerHost,
		private readonly allocator: Allocator,
	) {}

	private get app(): App {
		return this.host.app;
	}

	register(plugin: Plugin): void {
		plugin.registerEvent(this.app.metadataCache.on("changed", (file) => this.onChanged(file)));
		plugin.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.onRename(file, oldPath)));
		plugin.registerEvent(this.app.vault.on("delete", (file) => this.lastSeen.delete(file.path)));
		plugin.registerEvent(this.app.vault.on("create", (file) => this.onCreate(file)));
		plugin.registerEvent(this.app.workspace.on("active-leaf-change", () => this.releaseClosedNotes()));
		this.app.workspace.onLayoutReady(() => {
			this.rebuildBaseline();
			this.ready = true;
		});
		plugin.register(() => this.dispose());
	}

	dispose(): void {
		this.disposed = true;
		for (const timer of this.timers.values()) {
			window.clearTimeout(timer);
		}
		this.timers.clear();
		this.waitingForClose.clear();
		this.lastSeen.clear();
	}

	/** Turning automatic filing off should also drop anything already waiting. */
	cancelPending(): void {
		for (const timer of this.timers.values()) {
			window.clearTimeout(timer);
		}
		this.timers.clear();
		this.waitingForClose.clear();
	}

	/** Files notes that were held back because they were open, now that they no longer are. */
	private releaseClosedNotes(): void {
		if (this.waitingForClose.size === 0) {
			return;
		}
		const active = this.app.workspace.getActiveFile();
		for (const file of [...this.waitingForClose]) {
			if (file !== active) {
				this.waitingForClose.delete(file);
				this.schedule(file);
			}
		}
	}

	private valueKey(file: TFile, propertyName: string): string {
		const raw = readFrontmatter(this.app, file)?.[propertyName];
		return raw === undefined ? "" : JSON.stringify(raw);
	}

	/** Remembers every note's current value so that only later changes count. */
	private rebuildBaseline(): void {
		const propertyName = this.host.getSettings().propertyName;
		this.lastSeen.clear();
		for (const file of this.app.vault.getMarkdownFiles()) {
			this.lastSeen.set(file.path, this.valueKey(file, propertyName));
		}
		this.baselineProperty = propertyName;
	}

	private onChanged(file: TFile): void {
		if (!this.ready || file.extension !== "md") {
			return;
		}
		const settings = this.host.getSettings();
		if (this.baselineProperty !== settings.propertyName) {
			this.rebuildBaseline();
			return;
		}
		// A note we have never seen is new, so it counts as having had no value.
		const previous = this.lastSeen.get(file.path) ?? "";
		const current = this.valueKey(file, settings.propertyName);
		this.lastSeen.set(file.path, current);

		if (settings.automatic.enabled && current !== previous) {
			this.schedule(file);
		}
	}

	private onCreate(file: TAbstractFile): void {
		if (!this.ready || !(file instanceof TFile) || file.extension !== "md") {
			return;
		}
		const { automatic } = this.host.getSettings();
		if (automatic.enabled && automatic.includeNoDomain) {
			this.schedule(file);
		}
	}

	private onRename(file: TAbstractFile, oldPath: string): void {
		const key = this.lastSeen.get(oldPath);
		if (key !== undefined) {
			this.lastSeen.delete(oldPath);
			this.lastSeen.set(file.path, key);
		}
	}

	private schedule(file: TFile, attempt = 0): void {
		if (this.disposed) {
			return;
		}
		const existing = this.timers.get(file);
		if (existing !== undefined) {
			window.clearTimeout(existing);
		}
		const delayMs = this.host.getSettings().automatic.delaySeconds * 1000;
		this.timers.set(
			file,
			window.setTimeout(() => {
				this.timers.delete(file);
				void this.fire(file, attempt);
			}, delayMs),
		);
	}

	private async fire(file: TFile, attempt: number): Promise<void> {
		const { automatic } = this.host.getSettings();
		if (this.disposed || !automatic.enabled || this.host.isSnoozed()) {
			return;
		}
		if (this.app.vault.getAbstractFileByPath(file.path) !== file) {
			return; // deleted or renamed away while waiting
		}
		const result = await this.allocator.autoFile(file);
		if (result === "busy" && attempt < MAX_BUSY_RETRIES) {
			this.schedule(file, attempt + 1);
		} else if (result === "open") {
			this.waitingForClose.add(file);
		}
	}
}
