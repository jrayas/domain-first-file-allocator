import { TFile, type App, type Plugin } from "obsidian";
import { NEW_NOTE_SETTLE_MS, hasPropertyIgnoringCase, shouldAddProperty } from "../core/newNote";
import type { AllocatorSettings } from "../types";
import type { Allocator } from "./allocator";
import type { FrontmatterRecord } from "./frontmatter";
import type { Notifier } from "./notify";

export interface NewNotesHost {
	app: App;
	notifier: Notifier;
	getSettings(): AllocatorSettings;
}

/**
 * Adds an empty domain property to each note you create, when the setting is
 * on. It waits a moment first so that a template has time to fill the note in,
 * and leaves the note alone if the property is already there, whatever its value.
 */
export class NewNoteProperty {
	private readonly timers = new Map<TFile, number>();
	private ready = false;
	private disposed = false;

	constructor(
		private readonly host: NewNotesHost,
		private readonly allocator: Allocator,
	) {}

	private get app(): App {
		return this.host.app;
	}

	register(plugin: Plugin): void {
		// Files that already exist raise create events while the vault loads, so wait until it is ready.
		plugin.registerEvent(this.app.vault.on("create", (file) => this.onCreate(file)));
		this.app.workspace.onLayoutReady(() => {
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
	}

	private onCreate(file: unknown): void {
		if (!this.ready || !(file instanceof TFile) || file.extension !== "md") {
			return;
		}
		if (!this.host.getSettings().addPropertyToNewNotes) {
			return;
		}
		this.timers.set(
			file,
			window.setTimeout(() => {
				this.timers.delete(file);
				void this.addProperty(file);
			}, NEW_NOTE_SETTLE_MS),
		);
	}

	private async addProperty(file: TFile): Promise<void> {
		const settings = this.host.getSettings();
		if (this.disposed || !settings.addPropertyToNewNotes) {
			return;
		}
		if (this.app.vault.getAbstractFileByPath(file.path) !== file) {
			return; // deleted or moved away while waiting
		}
		if (this.allocator.skipReason(file) !== null) {
			return;
		}
		const name = settings.propertyName;
		// Cheap check first, so a note whose template already has the property is never rewritten.
		if (!shouldAddProperty(this.allocator.frontmatterOf(file), name)) {
			return;
		}
		try {
			await this.app.fileManager.processFrontMatter(file, (frontmatter: FrontmatterRecord) => {
				// Checked again against the file itself, in case the cache was not up to date yet.
				if (!hasPropertyIgnoringCase(frontmatter, name)) {
					frontmatter[name] = "";
				}
			});
		} catch (error) {
			console.error("Domain First File Allocator: could not add the domain property", error);
			this.host.notifier.error(`Domain first file allocator: could not add the ${name} property to "${file.basename}".`);
		}
	}
}
