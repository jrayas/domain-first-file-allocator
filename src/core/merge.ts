import type { SyncedConfig } from "../types";
import { pathKey } from "./paths";

export type SyncDecision =
	/** The file is missing, so write the settings out to it. */
	| "create-file"
	/** Both sides hold the same configuration. */
	| "in-sync"
	/** The settings are newer (or tied), so write them to the file. */
	| "use-settings"
	/** The file is newer, so apply it to the settings. */
	| "use-file";

function timestamp(value: string): number {
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
}

/** Compares the content of two configurations, ignoring `updatedAt`. */
export function configsEqual(a: SyncedConfig, b: SyncedConfig): boolean {
	return (
		a.propertyName === b.propertyName &&
		a.fallback.enabled === b.fallback.enabled &&
		a.fallback.folder === b.fallback.folder &&
		a.folderMovePrompt === b.folderMovePrompt &&
		a.automatic.enabled === b.automatic.enabled &&
		a.automatic.delaySeconds === b.automatic.delaySeconds &&
		a.automatic.includeNoDomain === b.automatic.includeNoDomain &&
		a.excludeFolders.length === b.excludeFolders.length &&
		a.excludeFolders.every((folder, i) => folder === b.excludeFolders[i]) &&
		a.domains.length === b.domains.length &&
		a.domains.every(
			(entry, i) => entry.folder === b.domains[i]?.folder && entry.enabled === b.domains[i]?.enabled,
		)
	);
}

/**
 * The most recently updated side wins. When both carry the same timestamp but
 * differ, the settings win, because they are what the user is looking at.
 */
export function decideSync(settings: SyncedConfig, file: SyncedConfig | null): SyncDecision {
	if (file === null) {
		return "create-file";
	}
	if (configsEqual(settings, file)) {
		return "in-sync";
	}
	return timestamp(file.updatedAt) > timestamp(settings.updatedAt) ? "use-file" : "use-settings";
}

/** Plain-language lines describing what applying `incoming` would change. */
export function summariseChanges(current: SyncedConfig, incoming: SyncedConfig): string[] {
	const lines: string[] = [];
	if (current.propertyName !== incoming.propertyName) {
		lines.push(`Property name: "${current.propertyName}" becomes "${incoming.propertyName}".`);
	}
	if (current.fallback.enabled !== incoming.fallback.enabled) {
		lines.push(`Fallback folder will be ${incoming.fallback.enabled ? "turned on" : "turned off"}.`);
	}
	if (current.fallback.folder !== incoming.fallback.folder) {
		lines.push(`Fallback folder: "${current.fallback.folder}" becomes "${incoming.fallback.folder}".`);
	}
	if (current.folderMovePrompt !== incoming.folderMovePrompt) {
		lines.push(`Folder-move prompt: ${current.folderMovePrompt} becomes ${incoming.folderMovePrompt}.`);
	}

	if (current.automatic.enabled !== incoming.automatic.enabled) {
		lines.push(`Automatic filing will be ${incoming.automatic.enabled ? "turned on" : "turned off"}.`);
	}
	if (current.automatic.delaySeconds !== incoming.automatic.delaySeconds) {
		lines.push(
			`Automatic filing delay: ${current.automatic.delaySeconds} s becomes ${incoming.automatic.delaySeconds} s.`,
		);
	}
	if (current.automatic.includeNoDomain !== incoming.automatic.includeNoDomain) {
		lines.push(
			`Automatic filing of notes with no domain will be ${incoming.automatic.includeNoDomain ? "turned on" : "turned off"}.`,
		);
	}

	const currentExcluded = new Set(current.excludeFolders.map(pathKey));
	const incomingExcluded = new Set(incoming.excludeFolders.map(pathKey));
	const excludedAdded = incoming.excludeFolders.filter((f) => !currentExcluded.has(pathKey(f)));
	const excludedRemoved = current.excludeFolders.filter((f) => !incomingExcluded.has(pathKey(f)));
	if (excludedAdded.length > 0) {
		lines.push(`Excluded folders added: ${excludedAdded.join(", ")}.`);
	}
	if (excludedRemoved.length > 0) {
		lines.push(`Excluded folders removed: ${excludedRemoved.join(", ")}.`);
	}

	const currentDomains = new Map(current.domains.map((d) => [pathKey(d.folder), d]));
	const incomingDomains = new Map(incoming.domains.map((d) => [pathKey(d.folder), d]));
	const added = incoming.domains.filter((d) => !currentDomains.has(pathKey(d.folder)));
	const removed = current.domains.filter((d) => !incomingDomains.has(pathKey(d.folder)));
	const toggled = incoming.domains.filter((d) => {
		const existing = currentDomains.get(pathKey(d.folder));
		return existing !== undefined && existing.enabled !== d.enabled;
	});
	if (added.length > 0) {
		lines.push(`Domains added: ${added.map((d) => d.folder).join(", ")}.`);
	}
	if (removed.length > 0) {
		lines.push(`Domains removed: ${removed.map((d) => d.folder).join(", ")}.`);
	}
	if (toggled.length > 0) {
		lines.push(`Domains enabled or disabled: ${toggled.map((d) => d.folder).join(", ")}.`);
	}
	return lines;
}
