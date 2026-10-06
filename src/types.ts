export type FolderMovePrompt = "ask" | "always" | "never";

export const FOLDER_MOVE_PROMPTS: readonly FolderMovePrompt[] = ["ask", "always", "never"];

export interface DomainEntry {
	/** Full vault-relative folder path, which is also the domain value. */
	folder: string;
	enabled: boolean;
}

export interface FallbackSettings {
	enabled: boolean;
	folder: string;
}

/** The part of the settings that is mirrored to the JSON file. */
export interface SyncedConfig {
	updatedAt: string;
	propertyName: string;
	fallback: FallbackSettings;
	excludeFolders: string[];
	folderMovePrompt: FolderMovePrompt;
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
}

export const CONFIG_FILE_VERSION = 1;
export const CONFIG_FILE_NAME = "folder.json";
export const OPT_OUT_PROPERTY = "skip-allocator";
