import {
	FOLDER_MOVE_PROMPTS,
	type AllocatorSettings,
	type DomainEntry,
	type FolderMovePrompt,
} from "../types";
import { normaliseFolderPath } from "./paths";
import { deduplicateRegistry } from "./registry";

export const DEFAULT_DATA_FOLDER = ".domain";

export function createDefaultSettings(now: Date = new Date()): AllocatorSettings {
	return {
		updatedAt: now.toISOString(),
		propertyName: "domain",
		fallback: { enabled: true, folder: "Inbox" },
		excludeFolders: ["Templates", DEFAULT_DATA_FOLDER],
		folderMovePrompt: "ask",
		domains: [],
		dataFolderName: DEFAULT_DATA_FOLDER,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
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
			entries.push({ folder: item.folder, enabled: item.enabled !== false });
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
		domains: readDomainEntries(raw.domains),
		dataFolderName,
	};
}
