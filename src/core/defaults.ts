import {
	FOLDER_MOVE_PROMPTS,
	type AllocatorSettings,
	type DomainEntry,
	type FolderMovePrompt,
	type SyncedConfig,
} from "../types";
import { normaliseFolderPath } from "./paths";
import {
	createDefaultAutomatic,
	createDefaultGeneral,
	createDefaultPrompts,
	isRecord,
	parseGeneral,
	readAutomatic,
	readPrompts,
} from "./preferences";
import { deduplicateRegistry } from "./registry";

export {
	MAX_AUTO_DELAY_SECONDS,
	MIN_AUTO_DELAY_SECONDS,
	clampDelay,
	createDefaultAutomatic,
	readAutomatic,
} from "./preferences";

export const DEFAULT_DATA_FOLDER = ".domain";

export function createDefaultSettings(now: Date = new Date()): AllocatorSettings {
	return {
		updatedAt: now.toISOString(),
		propertyName: "domain",
		fallback: { enabled: true, folder: "Inbox" },
		excludeFolders: ["Templates", DEFAULT_DATA_FOLDER],
		folderMovePrompt: "ask",
		automatic: createDefaultAutomatic(),
		prompts: createDefaultPrompts(),
		...createDefaultGeneral(),
		domains: [],
		dataFolderName: DEFAULT_DATA_FOLDER,
	};
}

export function isFolderMovePrompt(value: unknown): value is FolderMovePrompt {
	return typeof value === "string" && (FOLDER_MOVE_PROMPTS as readonly string[]).includes(value);
}

export function isIsoTimestamp(value: unknown): value is string {
	return typeof value === "string" && value !== "" && !Number.isNaN(Date.parse(value));
}

/** Reads a domain list leniently, dropping anything that is not a usable entry. */
export function readDomainEntries(value: unknown): DomainEntry[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const entries: DomainEntry[] = [];
	for (const item of value as unknown[]) {
		if (isRecord(item) && typeof item.folder === "string") {
			entries.push({
				folder: item.folder,
				enabled: item.enabled !== false,
				...(item.allowAuto === false ? { allowAuto: false } : {}),
			});
		}
	}
	return deduplicateRegistry(entries).registry;
}

export function readFolderList(value: unknown, fallback: string[]): string[] {
	if (!Array.isArray(value)) {
		return fallback;
	}
	const folders = (value as unknown[])
		.filter((item): item is string => typeof item === "string")
		.map(normaliseFolderPath)
		.filter((folder) => folder !== "");
	return [...new Set(folders)];
}

/** Turns a configuration (from the data file or an import) into settings, keeping the local data folder name. */
export function settingsFromConfig(config: SyncedConfig, dataFolderName: string): AllocatorSettings {
	return {
		updatedAt: config.updatedAt,
		propertyName: config.propertyName,
		fallback: { ...config.fallback },
		excludeFolders: [...config.excludeFolders],
		folderMovePrompt: config.folderMovePrompt,
		automatic: { ...config.automatic },
		prompts: { ...config.prompts },
		notices: config.notices,
		optOutProperty: config.optOutProperty,
		writeCanonicalCasing: config.writeCanonicalCasing,
		addPropertyToNewNotes: config.addPropertyToNewNotes,
		conflictPolicy: config.conflictPolicy,
		undoDepth: config.undoDepth,
		domains: config.domains.map((entry) => ({ ...entry })),
		dataFolderName,
	};
}

function assignSetting<K extends keyof AllocatorSettings>(
	target: AllocatorSettings,
	source: AllocatorSettings,
	key: K,
): void {
	target[key] = source[key];
}

/**
 * Overwrites every setting in `target` with the value from `source`, keeping `target` as the same
 * object. Anything that holds a reference to it (such as an open settings screen) then sees the
 * new values instead of editing a stale copy.
 */
export function replaceSettingsInPlace(target: AllocatorSettings, source: AllocatorSettings): void {
	for (const key of Object.keys(source) as (keyof AllocatorSettings)[]) {
		assignSetting(target, source, key);
	}
}

/**
 * Builds usable settings from whatever was found in data.json. Anything
 * missing or malformed falls back to its default.
 */
export function sanitiseSettings(raw: unknown, now: Date = new Date()): AllocatorSettings {
	const defaults = createDefaultSettings(now);
	if (!isRecord(raw)) {
		return defaults;
	}
	const fallback = isRecord(raw.fallback) ? raw.fallback : {};
	const propertyName =
		typeof raw.propertyName === "string" && raw.propertyName.trim() !== ""
			? raw.propertyName.trim()
			: defaults.propertyName;
	const dataFolderName =
		typeof raw.dataFolderName === "string" && normaliseFolderPath(raw.dataFolderName) !== ""
			? normaliseFolderPath(raw.dataFolderName)
			: defaults.dataFolderName;
	const fallbackFolder =
		typeof fallback.folder === "string" && normaliseFolderPath(fallback.folder) !== ""
			? normaliseFolderPath(fallback.folder)
			: defaults.fallback.folder;
	return {
		updatedAt: isIsoTimestamp(raw.updatedAt) ? raw.updatedAt : defaults.updatedAt,
		propertyName,
		fallback: {
			enabled: typeof fallback.enabled === "boolean" ? fallback.enabled : defaults.fallback.enabled,
			folder: fallbackFolder,
		},
		excludeFolders: readFolderList(raw.excludeFolders, defaults.excludeFolders),
		folderMovePrompt: isFolderMovePrompt(raw.folderMovePrompt)
			? raw.folderMovePrompt
			: defaults.folderMovePrompt,
		automatic: readAutomatic(raw.automatic),
		prompts: readPrompts(raw.prompts),
		...parseGeneral(raw).value,
		domains: readDomainEntries(raw.domains),
		dataFolderName,
	};
}
