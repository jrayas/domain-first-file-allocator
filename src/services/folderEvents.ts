import { Notice, TFile, TFolder, type App, type Plugin, type TAbstractFile } from "obsidian";
import { describeValue, readDomainValue } from "../core/domainValue";
import { parentFolder, replacePrefix, samePath } from "../core/paths";
import {
	applyRenameToRegistry,
	findDomain,
	registryAffectedByRename,
	rewriteRawDomainProperty,
} from "../core/registry";
import type { AllocatorSettings, UndoEntry } from "../types";
import { BatchPreviewModal } from "../ui/BatchPreviewModal";
import type { Allocator } from "./allocator";
import type { BatchRunner } from "./batch";
import type { MovingGuard } from "./movingGuard";
import type { UndoStack } from "./undo";

/** Notes moved within this window of each other are offered as one batch. */
const COLLECT_WINDOW_MS = 500;
/** How long a folder rename is remembered, to recognise the file events it causes. */
const FOLDER_RENAME_MEMORY_MS = 10000;

export interface FolderEventsHost {
	app: App;
	getSettings(): AllocatorSettings;
	commitSettings(): Promise<void>;
}

interface PendingMove {
	file: TFile;
	oldPath: string;
}

interface FolderRename {
	from: string;
	to: string;
	at: number;
}

interface PropertyUpdate {
	file: TFile;
	oldValue: unknown;
	newValue: unknown;
}

/**
 * Reacts to vault renames: keeps the registry and notes in step when a domain
 * folder is renamed or moved, and offers to update a note's domain when it is
 * moved by hand into a registered domain folder.
 */
export class FolderEvents {
	private chain: Promise<void> = Promise.resolve();
	private readonly pendingMoves = new Map<TFile, PendingMove>();
	private readonly folderRenames: FolderRename[] = [];
	private collectTimer: number | null = null;
	private disposed = false;

	constructor(
		private readonly host: FolderEventsHost,
		private readonly allocator: Allocator,
		private readonly guard: MovingGuard,
		private readonly undo: UndoStack,
		private readonly runner: BatchRunner,
	) {}

	private get app(): App {
		return this.host.app;
	}

	register(plugin: Plugin): void {
		plugin.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.onRename(file, oldPath)));
		plugin.register(() => this.dispose());
	}

	dispose(): void {
		this.disposed = true;
		if (this.collectTimer !== null) {
			window.clearTimeout(this.collectTimer);
			this.collectTimer = null;
		}
		this.pendingMoves.clear();
		this.runner.cancel();
	}

	private enqueue(task: () => Promise<void>): void {
		this.chain = this.chain
			.then(() => (this.disposed ? undefined : task()))
			.catch((error: unknown) => {
				console.error("Domain First File Allocator:", error);
				new Notice("Domain first file allocator: could not handle a folder change. See the console for details.");
			});
	}

	private onRename(file: TAbstractFile, oldPath: string): void {
		if (this.guard.has(oldPath) || this.guard.has(file.path)) {
			return;
		}
		if (file instanceof TFolder) {
			this.rememberFolderRename(oldPath, file.path);
			this.enqueue(() => this.handleFolderRename(file, oldPath));
		} else if (file instanceof TFile && file.extension === "md") {
			this.collectMove(file, oldPath);
		}
	}

	// --------------------------------------------------------- folder rename

	private rememberFolderRename(from: string, to: string): void {
		const now = Date.now();
		while (this.folderRenames.length > 0 && now - (this.folderRenames[0]?.at ?? now) > FOLDER_RENAME_MEMORY_MS) {
			this.folderRenames.shift();
		}
		this.folderRenames.push({ from, to, at: now });
	}

	private async handleFolderRename(folder: TFolder, oldPath: string): Promise<void> {
		const settings = this.host.getSettings();
		if (!registryAffectedByRename(settings.domains, oldPath)) {
			return;
		}

		// The folder has already moved, so the registry must follow it straight away.
		settings.domains = applyRenameToRegistry(settings.domains, oldPath, folder.path);
		await this.host.commitSettings();

		const updates = this.findNotesToRewrite(settings.propertyName, oldPath, folder.path);
		let entries: UndoEntry[] = [];

		if (updates.length === 0) {
			new Notice(`Domain registry updated: "${oldPath}" is now "${folder.path}".`);
		} else {
			const choice = await new BatchPreviewModal(this.app, {
				title: "Update domain values?",
				intro: `The folder "${oldPath}" is now "${folder.path}". The registry has been updated. Rewrite the ${settings.propertyName} property in these notes to match? The notes themselves are not moved.`,
				items: this.previewItems(updates),
				confirmText: `Update ${updates.length} ${updates.length === 1 ? "note" : "notes"}`,
				cancelText: "Leave unchanged",
			}).ask();

			if (choice === "confirm") {
				entries = await this.applyUpdates(settings.propertyName, updates);
			} else {
				new Notice(
					`The ${settings.propertyName} property in ${updates.length} notes still names "${oldPath}". The registry now uses "${folder.path}".`,
				);
			}
		}

		this.undo.record({
			label: `Folder rename "${oldPath}" to "${folder.path}"`,
			entries,
			caveats: [],
			registryRename: { from: oldPath, to: folder.path },
		});
	}

	private findNotesToRewrite(propertyName: string, oldPath: string, newPath: string): PropertyUpdate[] {
		const updates: PropertyUpdate[] = [];
		for (const file of this.app.vault.getMarkdownFiles()) {
			if (this.allocator.skipReason(file) !== null) {
				continue;
			}
			const raw = this.allocator.frontmatterOf(file)?.[propertyName];
			if (raw === undefined) {
				continue;
			}
			const rewrite = rewriteRawDomainProperty(raw, oldPath, newPath);
			if (rewrite.changed) {
				updates.push({ file, oldValue: raw, newValue: rewrite.value });
			}
		}
		return updates;
	}

	// ------------------------------------------------------- manual moves

	private collectMove(file: TFile, oldPath: string): void {
		if (parentFolder(oldPath) === parentFolder(file.path)) {
			return; // a plain rename, not a move
		}
		if (this.host.getSettings().folderMovePrompt === "never") {
			return;
		}
		const existing = this.pendingMoves.get(file);
		this.pendingMoves.set(file, { file, oldPath: existing?.oldPath ?? oldPath });

		if (this.collectTimer !== null) {
			window.clearTimeout(this.collectTimer);
		}
		this.collectTimer = window.setTimeout(() => {
			this.collectTimer = null;
			this.enqueue(() => this.flushMoves());
		}, COLLECT_WINDOW_MS);
	}

	/** True when this file event is only the knock-on effect of a folder being renamed. */
	private isFolderRenameChild(move: PendingMove): boolean {
		return this.folderRenames.some(
			(rename) => replacePrefix(move.oldPath, rename.from, rename.to) === move.file.path,
		);
	}

	private async flushMoves(): Promise<void> {
		const moves = [...this.pendingMoves.values()];
		this.pendingMoves.clear();
		const settings = this.host.getSettings();
		if (settings.folderMovePrompt === "never") {
			return;
		}

		const updates: PropertyUpdate[] = [];
		for (const move of moves) {
			const { file } = move;
			if (this.app.vault.getAbstractFileByPath(file.path) !== file || this.isFolderRenameChild(move)) {
				continue;
			}
			if (this.allocator.skipReason(file) !== null) {
				continue;
			}
			const domain = findDomain(settings.domains, parentFolder(file.path));
			if (!domain || !domain.enabled) {
				continue;
			}
			const oldValue = this.allocator.frontmatterOf(file)?.[settings.propertyName];
			const read = readDomainValue(oldValue);
			if (read.kind === "single" && samePath(read.value, domain.folder)) {
				continue;
			}
			updates.push({ file, oldValue, newValue: domain.folder });
		}
		if (updates.length === 0) {
			return;
		}

		if (settings.folderMovePrompt === "ask") {
			const choice = await new BatchPreviewModal(this.app, {
				title: "Update domain?",
				intro: `You moved ${updates.length === 1 ? "a note" : "notes"} into a domain folder. Update the ${settings.propertyName} property to match?`,
				items: this.previewItems(updates),
				confirmText: "Update",
				cancelText: "Skip",
				offerNever: true,
			}).ask();

			if (choice === "never") {
				settings.folderMovePrompt = "never";
				await this.host.commitSettings();
				new Notice('Domain first file allocator will no longer ask. Change "Folder-move prompt" in its settings to turn this back on.');
				return;
			}
			if (choice !== "confirm") {
				return;
			}
		}

		const entries = await this.applyUpdates(settings.propertyName, updates);
		this.undo.record({
			label: updates.length === 1 ? `Update domain on "${updates[0]?.file.basename}"` : `Update domains on ${updates.length} notes`,
			entries,
			caveats: [],
		});
		new Notice(`Updated the ${settings.propertyName} property on ${entries.length} ${entries.length === 1 ? "note" : "notes"}.`);
	}

	// ------------------------------------------------------------- shared

	private previewItems(updates: readonly PropertyUpdate[]): { label: string; detail: string }[] {
		return updates.map((update) => ({
			label: update.file.path,
			detail: `${describeValue(update.oldValue)} → ${describeValue(update.newValue)}`,
		}));
	}

	/** Writes the new values one note at a time, returning undo entries for those that succeeded. */
	private async applyUpdates(propertyName: string, updates: readonly PropertyUpdate[]): Promise<UndoEntry[]> {
		const entries: UndoEntry[] = [];
		const result = await this.runner.run("Updating domain values", updates, async (update) => {
			await this.allocator.writeProperty(update.file, propertyName, update.newValue);
			entries.push({
				oldPath: update.file.path,
				newPath: update.file.path,
				propertyName,
				oldValue: update.oldValue,
				newValue: update.newValue,
			});
		});
		if (result.failures.length > 0 || result.cancelled) {
			new Notice(
				`${result.failures.length} ${result.failures.length === 1 ? "note" : "notes"} could not be updated${result.cancelled ? " and the run was stopped early" : ""}.`,
			);
		}
		return entries;
	}
}
