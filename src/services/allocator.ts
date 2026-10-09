import { TFile, type App, type TAbstractFile } from "obsidian";
import { decideAutoFile, type AutoSkipReason } from "../core/autoDecision";
import { nextFreeName } from "../core/conflicts";
import { isTruthyFlag, needsDomainWrite, readDomainValue, type DomainRead } from "../core/domainValue";
import { isExcluded, joinPath, normaliseFolderPath, parentFolder, samePath } from "../core/paths";
import { addDomain, findDomain, lookupDomain } from "../core/registry";
import type { AllocatorSettings, UndoEntry } from "../types";
import { ChooseDomainModal } from "../ui/ChooseDomainModal";
import { ConfirmModal } from "../ui/ConfirmModal";
import { NameClashModal, type ClashDecision } from "../ui/NameClashModal";
import { UnknownDomainModal } from "../ui/UnknownDomainModal";
import { readFrontmatter, writeProperty, type FrontmatterRecord } from "./frontmatter";
import type { Notifier } from "./notify";
import type { UndoStack } from "./undo";
import type { VaultOps } from "./vaultOps";

export interface AllocatorHost {
	app: App;
	notifier: Notifier;
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

/** "open" means the note is open in the editor and should be tried again once it is closed. */
export type AutoFileResult = "done" | "busy" | "open";

/** The single-note flows: file by domain, set domain from folder, and automatic filing. */
export class Allocator {
	private busy = false;
	/** Reasons already explained to the user this session, so each is mentioned only once. */
	private readonly explained = new Set<string>();

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

	private get notify(): Notifier {
		return this.host.notifier;
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
			this.notify.important("Domain first file allocator is still working on another note.");
			return;
		}
		this.busy = true;
		try {
			await task();
		} catch (error) {
			console.error("Domain First File Allocator:", error);
			const detail = error instanceof Error ? ` ${error.message}` : "";
			this.notify.error(`Domain first file allocator: something went wrong.${detail}`);
		} finally {
			this.busy = false;
		}
	}

	// -------------------------------------------------------- automatic filing

	/**
	 * Files a note without asking anything, following the automatic-filing
	 * settings. Unclear cases (unknown, disabled, blocked, ambiguous) are left
	 * alone quietly, because the user may still be typing. A name clash skips
	 * the note and says so; nothing is ever replaced.
	 */
	async autoFile(file: TFile): Promise<AutoFileResult> {
		if (this.busy) {
			return "busy";
		}
		this.busy = true;
		try {
			return await this.runAutoFile(file);
		} catch (error) {
			console.error("Domain First File Allocator:", error);
			this.notify.error(`Domain first file allocator: automatic filing of "${file.basename}" failed.`);
			return "done";
		} finally {
			this.busy = false;
		}
	}

	private async runAutoFile(file: TFile): Promise<AutoFileResult> {
		if (this.skipReason(file) !== null) {
			return "done";
		}
		const settings = this.settings;
		const read = readDomainValue(this.frontmatterOf(file)?.[settings.propertyName]);
		const decision = decideAutoFile({
			read,
			domains: settings.domains,
			fallback: settings.fallback,
			automatic: settings.automatic,
			currentFolder: parentFolder(file.path),
			isOpenNote: this.app.workspace.getActiveFile() === file,
		});
		if (decision.action === "wait-for-close") {
			return "open";
		}
		if (decision.action === "skip") {
			this.explainAutoSkip(file, decision.reason, read);
			return "done";
		}

		const request: MoveRequest = { file, targetFolder: decision.targetFolder, domainValue: decision.domainValue };
		const outcome = await this.moveNote(request, () => Promise.resolve({ action: "skip", applyToAll: false }));
		if (outcome.status === "moved") {
			this.undo.record({
				label: `Automatically file "${file.basename}"`,
				entries: [outcome.entry],
				caveats: [],
			});
			if (!settings.automatic.quiet) {
				this.notify.info(`Automatically filed "${file.basename}" to "${outcome.destinationFolder}".`);
			}
		} else if (outcome.status === "skipped") {
			this.notify.important(
				`Automatic filing left "${file.basename}" in place because "${request.targetFolder}" already has a note with that name.`,
			);
		}
		return "done";
	}

	/**
	 * Says why a note with a domain value was not filed, so a silent no-op does not
	 * look like a bug. Shown once per note and value, and only at the "important"
	 * notice level. Cases that are normal (already in place, no domain) stay quiet.
	 */
	private explainAutoSkip(file: TFile, reason: AutoSkipReason, read: DomainRead): void {
		const value = read.kind === "single" ? read.value : null;
		let message: string | null = null;
		if (reason === "not-registered" && value !== null) {
			message = `"${value}" is not a registered domain. Add it in settings, or run File note by domain.`;
		} else if (reason === "disabled" && value !== null) {
			message = `the domain "${value}" is switched off.`;
		} else if (reason === "blocked" && value !== null) {
			message = `the domain "${value}" is set to Manual only.`;
		} else if (reason === "ambiguous") {
			message = "it has several domains. Run File note by domain to choose one.";
		} else if (reason === "no-domain") {
			message = this.settings.fallback.enabled
				? 'it has no domain, and "Also file notes with no domain" is off.'
				: "it has no domain, and the fallback folder is turned off.";
		}
		if (message === null) {
			return;
		}
		const key = `${file.path}\u0000${reason}\u0000${value ?? ""}`;
		if (this.explained.has(key)) {
			return;
		}
		this.explained.add(key);
		this.notify.important(`Automatic filing left "${file.basename}" where it is: ${message}`);
	}

	// -------------------------------------------------------- file by domain

	private async runFileByDomain(file: TFile): Promise<void> {
		if (!this.isEligible(file)) {
			return;
		}
		const settings = this.settings;
		const read = readDomainValue(this.frontmatterOf(file)?.[settings.propertyName]);

		if (read.kind === "invalid") {
			this.notify.important(
				`The "${settings.propertyName}" property on "${file.basename}" cannot be used. ${read.reason}`,
			);
			return;
		}
		if (read.kind === "missing") {
			await this.fileToFallback(file, `"${file.basename}" has no ${settings.propertyName} value.`);
			return;
		}

		let value: string;
		if (read.kind === "multiple") {
			const [first] = read.values;
			if (settings.prompts.multipleValues === "first" && first !== undefined) {
				value = first;
			} else {
				const chosen = await new ChooseDomainModal(this.app, file.basename, read.values, settings.domains).ask();
				if (chosen === null) {
					return;
				}
				value = chosen;
			}
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

		// A domain the user switched off is never turned back on without asking.
		const policy = lookup.status === "disabled" && settings.prompts.unknownDomain === "add" ? "ask" : settings.prompts.unknownDomain;
		const choice =
			policy === "ask"
				? await new UnknownDomainModal(this.app, {
						domain: value,
						disabled: lookup.status === "disabled",
						fallbackEnabled: settings.fallback.enabled,
						fallbackFolder: settings.fallback.folder,
					}).ask()
				: policy;

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
			this.notify.important(`${reason} The fallback folder is turned off, so the note stays where it is.`);
			return;
		}
		await this.moveWithDialogues({ file, targetFolder: fallback.folder });
	}

	/**
	 * Registers (or re-enables) a domain, creating its folder if needed (after
	 * confirmation, unless the user chose to create folders automatically).
	 * Returns the registered folder path, or null if nothing was done.
	 */
	private async registerDomain(value: string): Promise<string | null> {
		const settings = this.settings;
		const normalised = normaliseFolderPath(value);
		if (normalised === "") {
			this.notify.important("That value is not a usable folder path.");
			return null;
		}
		if (isExcluded(normalised, settings.excludeFolders, settings.dataFolderName)) {
			this.notify.important(`"${normalised}" is inside an excluded folder, so it cannot be a domain.`);
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
			const create =
				settings.prompts.createFolder === "auto" ||
				(await new ConfirmModal(this.app, {
					title: "Create folder?",
					lines: [`The folder "${normalised}" does not exist yet. Create it and add it as a domain?`],
					confirmText: "Create and add",
				}).ask());
			if (!create) {
				return null;
			}
			folderPath = await this.ops.ensureFolder(normalised);
		}

		const added = addDomain(settings.domains, folderPath);
		if (!added.ok) {
			this.notify.important(added.reason);
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
			this.notify.important(`"${file.basename}" is in the vault root, which cannot be a domain.`);
			return;
		}

		let entry = findDomain(settings.domains, folderPath);
		if (!entry) {
			const register =
				settings.prompts.registerFolder === "auto" ||
				(await new ConfirmModal(this.app, {
					title: "Register this folder?",
					lines: [`"${folderPath}" is not a registered domain. Register it so the note can use it?`],
					confirmText: "Register and continue",
				}).ask());
			if (!register) {
				return;
			}
			const added = addDomain(settings.domains, folderPath);
			if (!added.ok) {
				this.notify.important(added.reason);
				return;
			}
			settings.domains = added.registry;
			await this.host.commitSettings();
			entry = added.entry;
		}

		const oldValue = this.frontmatterOf(file)?.[settings.propertyName];
		if (oldValue === entry.folder) {
			this.notify.info(`"${file.basename}" already has ${settings.propertyName}: ${entry.folder}.`);
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
		this.notify.info(`Set ${settings.propertyName} to "${entry.folder}".${disabledNote}`);
	}

	// ------------------------------------------------------------- moving

	/** Moves one note, settling name clashes as the user prefers, then records undo and reports the result. */
	private async moveWithDialogues(request: MoveRequest): Promise<void> {
		const outcome = await this.moveNote(request, (context) => this.resolveClash(context));
		switch (outcome.status) {
			case "moved":
				this.undo.record({
					label: `Move "${request.file.basename}"`,
					entries: [outcome.entry],
					caveats: outcome.caveat ? [outcome.caveat] : [],
				});
				this.notify.info(`Moved "${request.file.basename}" to "${outcome.destinationFolder}".`);
				break;
			case "unchanged":
				this.notify.info(`"${request.file.basename}" is already in "${request.targetFolder}".`);
				break;
			case "skipped":
			case "cancelled":
				this.notify.info(`"${request.file.basename}" was left where it is.`);
				break;
		}
	}

	/** Applies the name-clash policy. Replace is never automatic: only the dialogue offers it. */
	private resolveClash(context: ClashContext): Promise<ClashDecision> {
		const policy = this.settings.prompts.nameClash;
		if (policy === "keep-both") {
			return Promise.resolve({ action: "keep-both", applyToAll: false });
		}
		if (policy === "skip") {
			return Promise.resolve({ action: "skip", applyToAll: false });
		}
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
		if (domainValue !== undefined && needsDomainWrite(oldValue, domainValue, this.settings.writeCanonicalCasing)) {
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

	/** Why a note must never be touched (excluded folder or opt-out), or null if it may be. */
	skipReason(file: TFile): string | null {
		const settings = this.settings;
		if (isExcluded(file.path, settings.excludeFolders, settings.dataFolderName)) {
			return `"${file.basename}" is in an excluded folder, so it was left alone.`;
		}
		if (isTruthyFlag(this.frontmatterOf(file)?.[settings.optOutProperty])) {
			return `"${file.basename}" has ${settings.optOutProperty}: true, so it was left alone.`;
		}
		return null;
	}

	private isEligible(file: TFile): boolean {
		const reason = this.skipReason(file);
		if (reason !== null) {
			this.notify.info(reason);
		}
		return reason === null;
	}

	frontmatterOf(file: TFile): FrontmatterRecord | undefined {
		return readFrontmatter(this.app, file);
	}

	writeProperty(file: TFile, propertyName: string, value: unknown): Promise<void> {
		return writeProperty(this.app, file, propertyName, value);
	}
}
