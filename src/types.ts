export type FolderMovePrompt = "ask" | "always" | "never";

export const FOLDER_MOVE_PROMPTS: readonly FolderMovePrompt[] = ["ask", "always", "never"];

export interface DomainEntry {
	/** Full vault-relative folder path, which is also the domain value. */
	folder: string;
	enabled: boolean;
	/** False keeps this domain out of automatic filing. Absent means allowed. */
	allowAuto?: boolean;
}

export type NoticeLevel = "all" | "important" | "errors";
export type AskOrAuto = "ask" | "auto";
export type UnknownDomainAction = "ask" | "fallback" | "add";
export type MultipleValuesAction = "ask" | "first";
export type NameClashPolicy = "ask" | "keep-both" | "skip";
export type ConflictPolicy = "newest" | "settings" | "file" | "ask";
export type UndoDepth = 1 | 5 | 10;
export type PromptPreset = "cautious" | "balanced" | "hands-off" | "custom";

/** How each popup behaves. Destructive confirmations (Replace, Import) are not listed: they always ask. */
export interface PromptSettings {
	unknownDomain: UnknownDomainAction;
	multipleValues: MultipleValuesAction;
	/** Set domain from folder, when the folder is not yet a domain. */
	registerFolder: AskOrAuto;
	/** A missing domain folder that needs creating. */
	createFolder: AskOrAuto;
	/** The preview shown after a domain folder is renamed or moved. */
	renamePreview: AskOrAuto;
	nameClash: NameClashPolicy;
	/** The rename preview is skipped, and the rewrite applied, when fewer notes than this are affected. */
	previewThreshold: number;
}

export interface FallbackSettings {
	enabled: boolean;
	folder: string;
}

export interface AutomaticSettings {
	/** File notes by domain automatically when their domain property changes. */
	enabled: boolean;
	/** Seconds the note must sit unchanged before it is filed. */
	delaySeconds: number;
	/** Also send new or domainless notes to the fallback folder. */
	includeNoDomain: boolean;
	/** Only file notes that currently sit in the fallback folder. */
	onlyInFallback: boolean;
	/** Never move the note that is open in the editor. */
	skipOpenNote: boolean;
	/** No notice when a note is filed automatically; skips and errors still show. */
	quiet: boolean;
}

/** The part of the settings that is mirrored to the JSON file. */
export interface SyncedConfig {
	updatedAt: string;
	propertyName: string;
	fallback: FallbackSettings;
	excludeFolders: string[];
	folderMovePrompt: FolderMovePrompt;
	automatic: AutomaticSettings;
	prompts: PromptSettings;
	notices: NoticeLevel;
	/** The frontmatter flag that makes the plugin ignore a note. */
	optOutProperty: string;
	/** Rewrite a note's domain to the folder's real casing when filing. */
	writeCanonicalCasing: boolean;
	conflictPolicy: ConflictPolicy;
	undoDepth: UndoDepth;
	domains: DomainEntry[];
}

/** Everything stored in the plugin's data.json. */
export interface AllocatorSettings extends SyncedConfig {
	dataFolderName: string;
}

/** The on-disk shape of the JSON file. */
export interface ConfigFile extends SyncedConfig {
	version: 1;
}

/** One note's change within an undoable action. An `undefined` value means the property was absent. */
export interface UndoEntry {
	oldPath: string;
	newPath: string;
	propertyName: string;
	oldValue: unknown;
	newValue: unknown;
}

/** A single undoable action; a batch is one action with many entries. */
export interface UndoAction {
	label: string;
	entries: UndoEntry[];
	/** Things undo cannot restore, reported to the user (for example a note sent to the trash). */
	caveats: string[];
	/** Set when the action also rewrote registry paths after a folder rename; undo reverses it. */
	registryRename?: { from: string; to: string };
}

export const CONFIG_FILE_VERSION = 1;
export const CONFIG_FILE_NAME = "folder.json";
export const OPT_OUT_PROPERTY = "skip-allocator";
