import type { DomainEntry } from "../types";
import { isSameOrInside, normaliseFolderPath, pathKey, replacePrefix } from "./paths";

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
		const key = folder.toLowerCase();
		if (key === "") {
			continue;
		}
		if (seen.has(key)) {
			duplicates.push(folder);
			continue;
		}
		seen.add(key);
		result.push({ folder, enabled: entry.enabled });
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
