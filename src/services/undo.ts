import { TFile, type App } from "obsidian";
import { describeValue, valuesEqual } from "../core/domainValue";
import { baseName, joinPath, parentFolder } from "../core/paths";
import { applyRenameToRegistry } from "../core/registry";
import { UndoStack } from "../core/undoStack";
import type { AllocatorSettings, UndoAction, UndoEntry } from "../types";
import { readFrontmatter, writeProperty } from "./frontmatter";
import type { Notifier } from "./notify";
import type { VaultOps } from "./vaultOps";

export { UndoStack };

export interface UndoHost {
	app: App;
	notifier: Notifier;
	getSettings(): AllocatorSettings;
	commitSettings(): Promise<void>;
}

/** Reverses the last recorded action: moves, property changes and registry renames. */
export class UndoService {
	private running = false;

	constructor(
		private readonly host: UndoHost,
		private readonly ops: VaultOps,
		private readonly stack: UndoStack,
	) {}

	async undoLast(): Promise<void> {
		const { notifier } = this.host;
		if (this.running) {
			notifier.important("An undo is already in progress.");
			return;
		}
		const action = this.stack.take();
		if (!action) {
			notifier.info("There is nothing to undo.");
			return;
		}
		this.running = true;
		try {
			await this.reverse(action);
		} catch (error) {
			console.error("Domain First File Allocator: undo failed", error);
			notifier.error("Domain first file allocator: the undo could not be completed. See the console for details.");
		} finally {
			this.running = false;
		}
	}

	private async reverse(action: UndoAction): Promise<void> {
		const problems: string[] = [];
		let reversed = 0;

		for (const entry of [...action.entries].reverse()) {
			try {
				if (await this.reverseEntry(entry, problems)) {
					reversed += 1;
				}
			} catch (error) {
				const detail = error instanceof Error ? error.message : "unknown error";
				problems.push(`"${entry.newPath}" could not be restored (${detail}).`);
			}
		}

		if (action.registryRename) {
			const settings = this.host.getSettings();
			const { from, to } = action.registryRename;
			settings.domains = applyRenameToRegistry(settings.domains, to, from);
			await this.host.commitSettings();
		}

		const lines = [`Undid: ${action.label}. ${reversed} of ${action.entries.length} notes restored.`];
		if (action.registryRename) {
			lines.push(`The domain registry now points at "${action.registryRename.from}" again.`);
		}
		lines.push(...problems, ...action.caveats);
		if (this.stack.size > 0) {
			lines.push(`${this.stack.size} earlier ${this.stack.size === 1 ? "action" : "actions"} can still be undone.`);
		}
		const needsAttention = problems.length > 0 || action.caveats.length > 0;
		if (needsAttention) {
			this.host.notifier.important(lines.join("\n"), 15000);
		} else {
			this.host.notifier.info(lines.join("\n"));
		}
	}

	/** Returns true when the note was fully restored; otherwise records why in `problems`. */
	private async reverseEntry(entry: UndoEntry, problems: string[]): Promise<boolean> {
		const { app } = this.host;
		const found = app.vault.getAbstractFileByPath(entry.newPath);
		if (!(found instanceof TFile)) {
			problems.push(`"${entry.newPath}" no longer exists, so it could not be restored.`);
			return false;
		}

		if (entry.newPath !== entry.oldPath) {
			const folder = await this.ops.ensureFolder(parentFolder(entry.oldPath));
			const name = baseName(entry.oldPath);
			if (this.ops.findChild(folder, name)) {
				problems.push(`"${entry.newPath}" was not moved back because "${entry.oldPath}" is already taken.`);
				return false;
			}
			await this.ops.moveFile(found, joinPath(folder, name));
		}

		const current = readFrontmatter(app, found)?.[entry.propertyName];
		if (valuesEqual(current, entry.oldValue)) {
			return true;
		}
		if (!valuesEqual(current, entry.newValue)) {
			problems.push(
				`The ${entry.propertyName} on "${found.path}" is now ${describeValue(current)}, so it was left as it is.`,
			);
			return false;
		}
		await writeProperty(app, found, entry.propertyName, entry.oldValue);
		return true;
	}
}
