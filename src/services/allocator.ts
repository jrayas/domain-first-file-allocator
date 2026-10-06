import { Notice, TFile, type App, type TAbstractFile } from "obsidian";
import { nextFreeName } from "../core/conflicts";
import { isTruthyFlag, readDomainValue } from "../core/domainValue";
import { isExcluded, joinPath, normaliseFolderPath, parentFolder, samePath } from "../core/paths";
import { addDomain, findDomain, lookupDomain } from "../core/registry";
import { OPT_OUT_PROPERTY, type AllocatorSettings, type UndoEntry } from "../types";
import { ChooseDomainModal } from "../ui/ChooseDomainModal";
import { ConfirmModal } from "../ui/ConfirmModal";
import { NameClashModal, type ClashDecision } from "../ui/NameClashModal";
import { UnknownDomainModal } from "../ui/UnknownDomainModal";
import type { UndoStack } from "./undo";
import type { VaultOps } from "./vaultOps";

export interface AllocatorHost {
	app: App;
	getSettings(): AllocatorSettings;
	commitSettings(): Promise<void>;
}

export interface ClashContext {
	file: TFile;
	existing: TAbstractFile;
	destinationFolder: string;
}

export type ClashResolver = (context: ClashContext) => Promise<ClashDecision>;

export interface MoveRequest {
	file: TFile;
	targetFolder: string;
	/** The domain value to write to the note after moving; undefined leaves the property alone. */
	domainValue?: string;
}

export type MoveOutcome =
	| { status: "moved"; entry: UndoEntry; destinationFolder: string; caveat?: string }
	| { status: "unchanged" | "skipped" | "cancelled" };

type FrontmatterRecord = Record<string, unknown>;

/** The two single-note flows: file by domain, and set domain from folder. */
export class Allocator {
	private busy = false;

	constructor(
		private readonly host: AllocatorHost,
		private readonly ops: VaultOps,
		private readonly undo: UndoStack,
	) {}

	private get app(): App {
		return this.host.app;
	}

	private get settings(): AllocatorSettings {
		return this.host.getSettings();
	}

	// ---------------------------------------------------------------- commands

	async fileByDomain(file: TFile): Promise<void> {
		await this.exclusively(() => this.runFileByDomain(file));
	}

	async setDomainFromFolder(file: TFile): Promise<void> {
		await this.exclusively(() => this.runSetDomainFromFolder(file));
	}

	private async exclusively(task: () => Promise<void>): Promise<void> {
		if (this.busy) {
			new Notice("Domain first file allocator is still working on another note.");
			return;
		}
		this.busy = true;
		try {
			await task();
		} catch (error) {
			console.error("Domain First File Allocator:", error);
			const detail = error instanceof Error ? ` ${error.message}` : "";
			new Notice(`Domain first file allocator: something went wrong.${detail}`);
		} finally {
			this.busy = false;
		}
	}

	// -------------------------------------------------------- file by domain

	private async runFileByDomain(file: TFile): Promise<void> {
		if (!this.isEligible(file)) {
			return;
		}
		const settings = this.settings;
		const read = readDomainValue(this.frontmatterOf(file)?.[settings.propertyName]);

		if (read.kind === "invalid") {
			new Notice(`The "${settings.propertyName}" property on "${file.basename}" cannot be used. ${read.reason}`);
			return;
		}
		if (read.kind === "missing") {
			await this.fileToFallback(file, `"${file.basename}" has no ${settings.propertyName} value.`);
			return;
		}

		let value: string;
		if (read.kind === "multiple") {
			const chosen = await new ChooseDomainModal(this.app, file.basename, read.values, settings.domains).ask();
			if (chosen === null) {
				return;
			}
			value = chosen;
		} else {
			value = read.value;
		}

		const lookup = lookupDomain(settings.domains, value);
		if (lookup.status === "enabled") {
			await this.moveWithDialogues({
				file,
				targetFolder: lookup.entry.folder,
				domainValue: lookup.entry.folder,
			});
			return;
		}

		const choice = await new UnknownDomainModal(this.app, {
			domain: value,
			disabled: lookup.status === "disabled",
			fallbackEnabled: settings.fallback.enabled,
			fallbackFolder: settings.fallback.folder,
		}).ask();

		if (choice === "fallback") {
			await this.fileToFallback(file, `The domain "${value}" is not available.`);
		} else if (choice === "add") {
			const folder = await this.registerDomain(value);
			if (folder !== null) {
				await this.moveWithDialogues({ file, targetFolder: folder, domainValue: folder });
			}
		}
	}

	private async fileToFallback(file: TFile, reason: string): Promise<void> {
		const { fallback } = this.settings;
		if (!fallback.enabled) {
			new Notice(`${reason} The fallback folder is turned off, so the note stays where it is.`);
			return;
		}
		await this.moveWithDialogues({ file, targetFolder: fallback.folder });
	}

	/**
	 * Registers (or re-enables) a domain, creating its folder after confirmation
	 * if needed. Returns the registered folder path, or null if nothing was done.
	 */
	private async registerDomain(value: string): Promise<string | null> {
		const settings = this.settings;
		const normalised = normaliseFolderPath(value);
		if (normalised === "") {
			new Notice("That value is not a usable folder path.");
			return null;
		}
		if (isExcluded(normalised, settings.excludeFolders, settings.dataFolderName)) {
			new Notice(`"${normalised}" is inside an excluded folder, so it cannot be a domain.`);
			return null;
		}

		const existingEntry = findDomain(settings.domains, normalised);
		if (existingEntry) {
			existingEntry.enabled = true;
			await this.host.commitSettings();
			return existingEntry.folder;
		}

		let folderPath = this.ops.findFolder(normalised)?.path ?? null;
		if (folderPath === null) {
			const create = await new ConfirmModal(this.app, {
				title: "Create folder?",
				lines: [`The folder "${normalised}" does not exist yet. Create it and add it as a domain?`],
				confirmText: "Create and add",
			}).ask();
			if (!create) {
				return null;
			}
			folderPath = await this.ops.ensureFolder(normalised);
		}

		const added = addDomain(settings.domains, folderPath);
		if (!added.ok) {
			new Notice(added.reason);
			return null;
		}
		settings.domains = added.registry;
		await this.host.commitSettings();
		return added.entry.folder;
	}

	// ----------------------------------------------- set domain from folder

	private async runSetDomainFromFolder(file: TFile): Promise<void> {
		if (!this.isEligible(file)) {
			return;
		}
		const settings = this.settings;
		const folderPath = parentFolder(file.path);
		if (folderPath === "") {
			new Notice(`"${file.basename}" is in the vault root, which cannot be a domain.`);
			return;
		}

		let entry = findDomain(settings.domains, folderPath);
		if (!entry) {
			const register = await new ConfirmModal(this.app, {
				title: "Register this folder?",
				lines: [`"${folderPath}" is not a registered domain. Register it so the note can use it?`],
				confirmText: "Register and continue",
			}).ask();
			if (!register) {
				return;
			}
			const added = addDomain(settings.domains, folderPath);
			if (!added.ok) {
				new Notice(added.reason);
				return;
			}
			settings.domains = added.registry;
			await this.host.commitSettings();
			entry = added.entry;
		}

		const oldValue = this.frontmatterOf(file)?.[settings.propertyName];
		if (oldValue === entry.folder) {
			new Notice(`"${file.basename}" already has ${settings.propertyName}: ${entry.folder}.`);
			return;
		}

		await this.writeProperty(file, settings.propertyName, entry.folder);
		this.undo.record({
			label: `Set ${settings.propertyName} on "${file.basename}"`,
			entries: [
				{
					oldPath: file.path,
					newPath: file.path,
					propertyName: settings.propertyName,
					oldValue,
					newValue: entry.folder,
				},
			],
			caveats: [],
		});
		const disabledNote = entry.enabled ? "" : " This domain is disabled, so filing by domain will use the fallback.";
		new Notice(`Set ${settings.propertyName} to "${entry.folder}".${disabledNote}`);
	}

	// ------------------------------------------------------------- moving

	/** Moves one note, asking about name clashes, then records undo and reports the result. */
	private async moveWithDialogues(request: MoveRequest): Promise<void> {
		const outcome = await this.moveNote(request, (context) => this.askAboutClash(context));
		switch (outcome.status) {
			case "moved":
				this.undo.record({
					label: `Move "${request.file.basename}"`,
					entries: [outcome.entry],
					caveats: outcome.caveat ? [outcome.caveat] : [],
				});
				new Notice(`Moved "${request.file.basename}" to "${outcome.destinationFolder}".`);
				break;
			case "unchanged":
				new Notice(`"${request.file.basename}" is already in "${request.targetFolder}".`);
				break;
			case "skipped":
			case "cancelled":
				new Notice(`"${request.file.basename}" was left where it is.`);
				break;
		}
	}

	private askAboutClash(context: ClashContext): Promise<ClashDecision> {
		const { file, existing, destinationFolder } = context;
		return new NameClashModal(this.app, {
			incomingName: file.name,
			incomingPath: file.path,
			existingPath: existing.path,
			destinationFolder,
			nameExists: (name) => this.ops.findChild(destinationFolder, name) !== null,
		}).ask();
	}

	/**
	 * Moves a note into a folder (creating it if needed) and optionally writes
	 * its domain property. Name clashes are settled by `resolveClash`.
	 * Does not record undo or show notices, so batches can reuse it.
	 */
	async moveNote(request: MoveRequest, resolveClash: ClashResolver): Promise<MoveOutcome> {
		const { file, domainValue } = request;
		const propertyName = this.settings.propertyName;

		if (samePath(parentFolder(file.path), request.targetFolder)) {
			return { status: "unchanged" };
		}

		const oldPath = file.path;
		const oldValue = this.frontmatterOf(file)?.[propertyName];
		const destinationFolder = await this.ops.ensureFolder(request.targetFolder);

		let finalName = file.name;
		let caveat: string | undefined;
		const clash = this.ops.findChild(destinationFolder, file.name);
		if (clash) {
			const taken = (name: string): boolean => this.ops.findChild(destinationFolder, name) !== null;
			const decision =
				clash instanceof TFile
					? await resolveClash({ file, existing: clash, destinationFolder })
					: ({ action: "keep-both", applyToAll: false } as const);

			if (decision.action === "cancel") {
				return { status: "cancelled" };
			}
			if (decision.action === "skip") {
				return { status: "skipped" };
			}
			if (decision.action === "keep-both") {
				finalName = nextFreeName(file.name, taken);
			} else if (decision.action === "rename") {
				finalName = decision.newName;
			} else if (clash instanceof TFile) {
				await this.app.fileManager.trashFile(clash);
				caveat = `"${clash.path}" was sent to the trash and cannot be restored by undo.`;
			}
		}

		await this.ops.moveFile(file, joinPath(destinationFolder, finalName));

		let newValue = oldValue;
		if (domainValue !== undefined && oldValue !== domainValue) {
			await this.writeProperty(file, propertyName, domainValue);
			newValue = domainValue;
		}

		return {
			status: "moved",
			destinationFolder,
			caveat,
			entry: { oldPath, newPath: file.path, propertyName, oldValue, newValue },
		};
	}

	// ------------------------------------------------------------ helpers

	/** Notes in excluded folders, and notes that opt out, are never touched. */
	private isEligible(file: TFile): boolean {
		const settings = this.settings;
		if (isExcluded(file.path, settings.excludeFolders, settings.dataFolderName)) {
			new Notice(`"${file.basename}" is in an excluded folder, so it was left alone.`);
			return false;
		}
		if (isTruthyFlag(this.frontmatterOf(file)?.[OPT_OUT_PROPERTY])) {
			new Notice(`"${file.basename}" has ${OPT_OUT_PROPERTY}: true, so it was left alone.`);
			return false;
		}
		return true;
	}

	frontmatterOf(file: TFile): FrontmatterRecord | undefined {
		return this.app.metadataCache.getFileCache(file)?.frontmatter;
	}

	async writeProperty(file: TFile, propertyName: string, value: unknown): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter: FrontmatterRecord) => {
			if (value === undefined) {
				delete frontmatter[propertyName];
			} else {
				frontmatter[propertyName] = value;
			}
		});
	}
}

