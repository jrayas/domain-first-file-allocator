import type { DomainEntry } from "../types";
import { isExcluded, isSameOrInside, normaliseFolderPath, pathKey, replacePrefix } from "./paths";

export type DomainLookup =
	| { status: "enabled"; entry: DomainEntry }
	| { status: "disabled"; entry: DomainEntry }
	| { status: "unknown" };

/** Finds a registry entry for a domain value, ignoring case and path style. */
export function findDomain(registry: readonly DomainEntry[], value: string): DomainEntry | undefined {
	const key = pathKey(value);
	if (key === "") {
		return undefined;
	}
	return registry.find((entry) => pathKey(entry.folder) === key);
}

export function lookupDomain(registry: readonly DomainEntry[], value: string): DomainLookup {
	const entry = findDomain(registry, value);
	if (!entry) {
		return { status: "unknown" };
	}
	return { status: entry.enabled ? "enabled" : "disabled", entry };
}

export type AddResult =
	| { ok: true; registry: DomainEntry[]; entry: DomainEntry }
	| { ok: false; reason: string };

/** Adds a domain, rejecting empty paths and duplicates (case-insensitive). */
export function addDomain(registry: readonly DomainEntry[], folder: string): AddResult {
	const normalised = normaliseFolderPath(folder);
	if (normalised === "") {
		return { ok: false, reason: "The vault root cannot be a domain." };
	}
	if (findDomain(registry, normalised)) {
		return { ok: false, reason: `"${normalised}" is already in the domain registry.` };
	}
	const entry: DomainEntry = { folder: normalised, enabled: true };
	return { ok: true, registry: [...registry, entry], entry };
}

export function removeDomain(registry: readonly DomainEntry[], folder: string): DomainEntry[] {
	const key = pathKey(folder);
	return registry.filter((entry) => pathKey(entry.folder) !== key);
}

export interface RegistryDeduplication {
	registry: DomainEntry[];
	duplicates: string[];
}

/** Normalises every entry and merges exact duplicates, keeping the first spelling. */
export function deduplicateRegistry(registry: readonly DomainEntry[]): RegistryDeduplication {
	const seen = new Set<string>();
	const result: DomainEntry[] = [];
	const duplicates: string[] = [];
	for (const entry of registry) {
		const folder = normaliseFolderPath(entry.folder);
		const key = pathKey(folder);
		if (key === "") {
			continue;
		}
		if (seen.has(key)) {
			duplicates.push(folder);
			continue;
		}
		seen.add(key);
		result.push({
			folder,
			enabled: entry.enabled,
			...(entry.allowAuto === false ? { allowAuto: false } : {}),
		});
	}
	return { registry: result, duplicates };
}

/** True when the renamed folder is a domain, or contains one. */
export function registryAffectedByRename(registry: readonly DomainEntry[], oldPath: string): boolean {
	return registry.some((entry) => isSameOrInside(entry.folder, oldPath));
}

/** Applies a folder rename to every affected registry path. */
export function applyRenameToRegistry(
	registry: readonly DomainEntry[],
	oldPath: string,
	newPath: string,
): DomainEntry[] {
	return registry.map((entry) => {
		const replaced = replacePrefix(entry.folder, oldPath, newPath);
		return replaced === null ? { ...entry } : { ...entry, folder: replaced };
	});
}

/**
 * Rewrites a note's domain value after a folder rename. Returns null when the
 * value is neither the old folder nor inside it.
 */
export function rewriteDomainValue(value: string, oldPath: string, newPath: string): string | null {
	return replacePrefix(value, oldPath, newPath);
}

/** Corrects a domain value to the real casing of its registered folder, if any. */
export function canonicalDomain(registry: readonly DomainEntry[], value: string): string {
	return findDomain(registry, value)?.folder ?? normaliseFolderPath(value);
}

export interface RawRewrite {
	changed: boolean;
	value: unknown;
}

/**
 * Applies a folder rename to a note's raw domain property, which may be a
 * string or a list. Items that are not strings are left alone.
 */
export function rewriteRawDomainProperty(raw: unknown, oldPath: string, newPath: string): RawRewrite {
	if (typeof raw === "string") {
		const replaced = rewriteDomainValue(raw, oldPath, newPath);
		return replaced === null ? { changed: false, value: raw } : { changed: true, value: replaced };
	}
	if (Array.isArray(raw)) {
		let changed = false;
		const value = (raw as unknown[]).map((item) => {
			if (typeof item !== "string") {
				return item;
			}
			const replaced = rewriteDomainValue(item, oldPath, newPath);
			if (replaced === null) {
				return item;
			}
			changed = true;
			return replaced;
		});
		return { changed, value };
	}
	return { changed: false, value: raw };
}

/** True unless the domain has been kept out of automatic filing. */
export function isAutoAllowed(entry: DomainEntry): boolean {
	return entry.allowAuto !== false;
}

export interface BulkAddOptions {
	/** The folder whose subfolders are offered. */
	parent: string;
	/** Include every level below the parent, not only its direct children. */
	recursive: boolean;
	excludeFolders: readonly string[];
	dataFolderName: string;
}

/**
 * Picks the subfolders of `parent` that could be registered: not the parent
 * itself, not already registered, not excluded. Results are sorted and keep the
 * casing of `allFolders`.
 */
export function subfoldersToAdd(
	registry: readonly DomainEntry[],
	allFolders: readonly string[],
	options: BulkAddOptions,
): string[] {
	const parentKey = pathKey(options.parent);
	const registered = new Set(registry.map((entry) => pathKey(entry.folder)));
	const chosen: string[] = [];
	for (const raw of allFolders) {
		const folder = normaliseFolderPath(raw);
		const key = pathKey(folder);
		if (key === "" || !isSameOrInside(folder, options.parent) || key === parentKey) {
			continue;
		}
		const depthBelowParent = key.slice(parentKey.length + 1).split("/").length;
		if (!options.recursive && depthBelowParent > 1) {
			continue;
		}
		if (registered.has(key) || isExcluded(folder, options.excludeFolders, options.dataFolderName)) {
			continue;
		}
		registered.add(key);
		chosen.push(folder);
	}
	return chosen.sort((a, b) => a.localeCompare(b));
}
