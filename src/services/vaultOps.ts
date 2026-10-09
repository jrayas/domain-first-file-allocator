import { TFile, TFolder, type App, type TAbstractFile } from "obsidian";
import { folderLevels, nameKey, normaliseFolderPath } from "../core/paths";
import type { MovingGuard } from "./movingGuard";

/** Vault helpers for folders and moves. Only the Obsidian API is used, so they work on mobile. */
export class VaultOps {
	constructor(
		private readonly app: App,
		private readonly guard: MovingGuard,
	) {}

	/** Finds a folder by path, ignoring case. Returns null when it does not exist. */
	findFolder(path: string): TFolder | null {
		let current: TFolder = this.app.vault.getRoot();
		for (const level of folderLevels(path)) {
			const name = level.slice(level.lastIndexOf("/") + 1);
			const next = this.childFolder(current, name);
			if (!next) {
				return null;
			}
			current = next;
		}
		return current;
	}

	private childFolder(parent: TFolder, name: string): TFolder | null {
		const folders = parent.children.filter((child): child is TFolder => child instanceof TFolder);
		return (
			folders.find((child) => child.name === name) ??
			folders.find((child) => nameKey(child.name) === nameKey(name)) ??
			null
		);
	}

	/** Finds a file or folder called `name` directly inside `folderPath`, ignoring case. */
	findChild(folderPath: string, name: string): TAbstractFile | null {
		const folder = folderPath === "" ? this.app.vault.getRoot() : this.findFolder(folderPath);
		if (!folder) {
			return null;
		}
		const wanted = nameKey(name);
		return folder.children.find((child) => nameKey(child.name) === wanted) ?? null;
	}

	/**
	 * Makes sure every level of `path` exists, creating the missing ones, and
	 * returns the real path (which keeps the casing of any folder already there).
	 */
	async ensureFolder(path: string): Promise<string> {
		const wanted = normaliseFolderPath(path);
		let currentPath = "";
		let current: TFolder = this.app.vault.getRoot();
		for (const level of folderLevels(wanted)) {
			const name = level.slice(level.lastIndexOf("/") + 1);
			const existing = this.childFolder(current, name);
			if (existing) {
				current = existing;
				currentPath = existing.path;
				continue;
			}
			const candidate = currentPath === "" ? name : `${currentPath}/${name}`;
			if (this.app.vault.getAbstractFileByPath(candidate) instanceof TFile) {
				throw new Error(`A file already exists at "${candidate}", so the folder cannot be created.`);
			}
			await this.app.vault.createFolder(candidate);
			const created = this.app.vault.getAbstractFileByPath(candidate);
			if (!(created instanceof TFolder)) {
				throw new Error(`The folder "${candidate}" could not be created.`);
			}
			current = created;
			currentPath = created.path;
		}
		return currentPath;
	}

	/** Moves or renames a file with `fileManager.renameFile`, so links are updated, ignoring our own events. */
	async moveFile(file: TFile, newPath: string): Promise<void> {
		const oldPath = file.path;
		await this.guard.run([oldPath, newPath], () => this.app.fileManager.renameFile(file, newPath));
	}
}
