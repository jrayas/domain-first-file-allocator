import { CONFIG_FILE_VERSION, type ConfigFile, type DomainEntry, type SyncedConfig } from "../types";
import { isFolderMovePrompt, isIsoTimestamp } from "./defaults";
import { normaliseFolderPath } from "./paths";
import { isRecord, parseAutomatic, parseGeneral, parsePrompts } from "./preferences";
import { deduplicateRegistry } from "./registry";

export type ParseResult =
	| { ok: true; config: ConfigFile; warnings: string[] }
	| { ok: false; error: string };

/**
 * Strictly validates the text of the JSON file. Malformed content and unknown
 * versions are errors; the caller must then leave the file untouched.
 * Harmless oddities (duplicate domains) are repaired and reported as warnings.
 * Every preference added after the first release is optional, so older files
 * still load and take the defaults.
 */
export function parseConfigJson(text: string): ParseResult {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch (error) {
		const detail = error instanceof Error ? error.message : "unknown error";
		return { ok: false, error: `The file is not valid JSON (${detail}).` };
	}
	if (!isRecord(raw)) {
		return { ok: false, error: "The file does not contain a JSON object." };
	}
	if (raw.version !== CONFIG_FILE_VERSION) {
		return {
			ok: false,
			error: `Unsupported version ${JSON.stringify(raw.version)}; this plugin understands version ${CONFIG_FILE_VERSION}.`,
		};
	}
	if (!isIsoTimestamp(raw.updatedAt)) {
		return { ok: false, error: '"updatedAt" must be an ISO 8601 timestamp.' };
	}
	if (typeof raw.propertyName !== "string" || raw.propertyName.trim() === "") {
		return { ok: false, error: '"propertyName" must be a non-empty string.' };
	}
	if (
		!isRecord(raw.fallback) ||
		typeof raw.fallback.enabled !== "boolean" ||
		typeof raw.fallback.folder !== "string"
	) {
		return { ok: false, error: '"fallback" must have a boolean "enabled" and a string "folder".' };
	}
	const fallbackFolder = normaliseFolderPath(raw.fallback.folder);
	if (fallbackFolder === "") {
		return { ok: false, error: 'The fallback "folder" cannot be empty.' };
	}
	if (!Array.isArray(raw.excludeFolders) || !raw.excludeFolders.every((f) => typeof f === "string")) {
		return { ok: false, error: '"excludeFolders" must be a list of strings.' };
	}
	if (!isFolderMovePrompt(raw.folderMovePrompt)) {
		return { ok: false, error: '"folderMovePrompt" must be "ask", "always" or "never".' };
	}
	if (!Array.isArray(raw.domains)) {
		return { ok: false, error: '"domains" must be a list.' };
	}

	const automatic = parseAutomatic(raw.automatic);
	const prompts = parsePrompts(raw.prompts);
	const general = parseGeneral(raw);
	const optionalErrors = [...automatic.errors, ...prompts.errors, ...general.errors];
	if (optionalErrors.length > 0) {
		return { ok: false, error: optionalErrors.join(" ") };
	}

	const domains: DomainEntry[] = [];
	for (const [index, item] of (raw.domains as unknown[]).entries()) {
		if (
			!isRecord(item) ||
			typeof item.folder !== "string" ||
			typeof item.enabled !== "boolean" ||
			(item.allowAuto !== undefined && typeof item.allowAuto !== "boolean")
		) {
			return {
				ok: false,
				error: `Domain number ${index + 1} must have a string "folder", a boolean "enabled" and, if present, a boolean "allowAuto".`,
			};
		}
		domains.push({
			folder: item.folder,
			enabled: item.enabled,
			...(item.allowAuto === false ? { allowAuto: false } : {}),
		});
	}

	const warnings: string[] = [];
	const deduplicated = deduplicateRegistry(domains);
	if (domains.length - deduplicated.registry.length > 0) {
		warnings.push(
			`Ignored duplicate or empty domain entries: ${deduplicated.duplicates.join(", ") || "empty paths"}.`,
		);
	}

	const excludeFolders = [
		...new Set(
			(raw.excludeFolders as string[]).map(normaliseFolderPath).filter((folder) => folder !== ""),
		),
	];

	return {
		ok: true,
		warnings,
		config: {
			version: CONFIG_FILE_VERSION,
			updatedAt: raw.updatedAt,
			propertyName: raw.propertyName.trim(),
			fallback: { enabled: raw.fallback.enabled, folder: fallbackFolder },
			excludeFolders,
			folderMovePrompt: raw.folderMovePrompt,
			automatic: automatic.value,
			prompts: prompts.value,
			...general.value,
			domains: deduplicated.registry,
		},
	};
}

/** Builds the file contents for the synced part of the settings. */
export function serialiseConfig(config: SyncedConfig): string {
	const file: ConfigFile = {
		version: CONFIG_FILE_VERSION,
		updatedAt: config.updatedAt,
		propertyName: config.propertyName,
		fallback: { enabled: config.fallback.enabled, folder: config.fallback.folder },
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
		domains: config.domains.map((entry) => ({
			folder: entry.folder,
			enabled: entry.enabled,
			...(entry.allowAuto === false ? { allowAuto: false } : {}),
		})),
	};
	return `${JSON.stringify(file, null, 2)}\n`;
}
