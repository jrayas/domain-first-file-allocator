import type { SyncedConfig } from "../types";
import { pathKey } from "./paths";
import { isAutoAllowed } from "./registry";

export type SyncDecision =
	/** The file is missing, so write the settings out to it. */
	| "create-file"
	/** Both sides hold the same configuration. */
	| "in-sync"
	/** Write the settings to the file. */
	| "use-settings"
	/** Apply the file to the settings. */
	| "use-file"
	/** The sides differ and the policy says to ask the user. */
	| "conflict";

function timestamp(value: string): number {
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
}

/** JSON with object keys sorted, so equal content always gives equal text. */
function stableStringify(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${(value as unknown[]).map(stableStringify).join(",")}]`;
	}
	if (typeof value === "object" && value !== null) {
		const record = value as Record<string, unknown>;
		const keys = Object.keys(record).sort();
		return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

/** The comparable content of a configuration: everything except `updatedAt`. */
function comparable(config: SyncedConfig): unknown {
	return {
		propertyName: config.propertyName,
		fallback: config.fallback,
		excludeFolders: config.excludeFolders,
		folderMovePrompt: config.folderMovePrompt,
		automatic: config.automatic,
		prompts: config.prompts,
		notices: config.notices,
		optOutProperty: config.optOutProperty,
		writeCanonicalCasing: config.writeCanonicalCasing,
		addPropertyToNewNotes: config.addPropertyToNewNotes,
		conflictPolicy: config.conflictPolicy,
		undoDepth: config.undoDepth,
		domains: config.domains.map((entry) => ({
			folder: entry.folder,
			enabled: entry.enabled,
			allowAuto: isAutoAllowed(entry),
		})),
	};
}

/** Compares the content of two configurations, ignoring `updatedAt`. */
export function configsEqual(a: SyncedConfig, b: SyncedConfig): boolean {
	return stableStringify(comparable(a)) === stableStringify(comparable(b));
}

/**
 * Decides how to reconcile the settings with the file. The policy is the
 * user's own (`settings.conflictPolicy`). With "newest", the most recently
 * updated side wins and the settings win a tie, because they are what the user
 * is looking at.
 */
export function decideSync(settings: SyncedConfig, file: SyncedConfig | null): SyncDecision {
	if (file === null) {
		return "create-file";
	}
	if (configsEqual(settings, file)) {
		return "in-sync";
	}
	switch (settings.conflictPolicy) {
		case "settings":
			return "use-settings";
		case "file":
			return "use-file";
		case "ask":
			return "conflict";
		case "newest":
			return timestamp(file.updatedAt) > timestamp(settings.updatedAt) ? "use-file" : "use-settings";
	}
}

function changed<T>(label: string, before: T, after: T, lines: string[]): void {
	if (before !== after) {
		lines.push(`${label}: ${String(before)} becomes ${String(after)}.`);
	}
}

function toggled(label: string, before: boolean, after: boolean, lines: string[]): void {
	if (before !== after) {
		lines.push(`${label} will be ${after ? "turned on" : "turned off"}.`);
	}
}

function folderListChanges(label: string, before: readonly string[], after: readonly string[], lines: string[]): void {
	const beforeKeys = new Set(before.map(pathKey));
	const afterKeys = new Set(after.map(pathKey));
	const added = after.filter((f) => !beforeKeys.has(pathKey(f)));
	const removed = before.filter((f) => !afterKeys.has(pathKey(f)));
	if (added.length > 0) {
		lines.push(`${label} added: ${added.join(", ")}.`);
	}
	if (removed.length > 0) {
		lines.push(`${label} removed: ${removed.join(", ")}.`);
	}
}

/** Plain-language lines describing what applying `incoming` would change. */
export function summariseChanges(current: SyncedConfig, incoming: SyncedConfig): string[] {
	const lines: string[] = [];
	changed("Property name", `"${current.propertyName}"`, `"${incoming.propertyName}"`, lines);
	toggled("Fallback folder", current.fallback.enabled, incoming.fallback.enabled, lines);
	changed("Fallback folder", `"${current.fallback.folder}"`, `"${incoming.fallback.folder}"`, lines);
	changed("Folder-move prompt", current.folderMovePrompt, incoming.folderMovePrompt, lines);
	changed("Notices", current.notices, incoming.notices, lines);
	changed("Opt-out property", `"${current.optOutProperty}"`, `"${incoming.optOutProperty}"`, lines);
	toggled("Writing the folder's casing to the property", current.writeCanonicalCasing, incoming.writeCanonicalCasing, lines);
	toggled("Adding the domain property to new notes", current.addPropertyToNewNotes, incoming.addPropertyToNewNotes, lines);
	changed("Sync conflict policy", current.conflictPolicy, incoming.conflictPolicy, lines);
	changed("Undo depth", current.undoDepth, incoming.undoDepth, lines);

	const a = current.automatic;
	const b = incoming.automatic;
	toggled("Automatic filing", a.enabled, b.enabled, lines);
	changed("Automatic filing delay (seconds)", a.delaySeconds, b.delaySeconds, lines);
	toggled("Automatic filing of notes with no domain", a.includeNoDomain, b.includeNoDomain, lines);
	toggled("Automatic filing only in the fallback folder", a.onlyInFallback, b.onlyInFallback, lines);
	toggled("Skipping the open note when filing automatically", a.skipOpenNote, b.skipOpenNote, lines);
	toggled("Quiet automatic filing", a.quiet, b.quiet, lines);

	for (const key of Object.keys(current.prompts) as (keyof typeof current.prompts)[]) {
		changed(`Prompt "${key}"`, current.prompts[key], incoming.prompts[key], lines);
	}

	folderListChanges("Excluded folders", current.excludeFolders, incoming.excludeFolders, lines);

	const currentDomains = new Map(current.domains.map((d) => [pathKey(d.folder), d]));
	const incomingDomains = new Map(incoming.domains.map((d) => [pathKey(d.folder), d]));
	const added = incoming.domains.filter((d) => !currentDomains.has(pathKey(d.folder)));
	const removed = current.domains.filter((d) => !incomingDomains.has(pathKey(d.folder)));
	const switched = incoming.domains.filter((d) => {
		const existing = currentDomains.get(pathKey(d.folder));
		return existing !== undefined && existing.enabled !== d.enabled;
	});
	const autoChanged = incoming.domains.filter((d) => {
		const existing = currentDomains.get(pathKey(d.folder));
		return existing !== undefined && isAutoAllowed(existing) !== isAutoAllowed(d);
	});
	if (added.length > 0) {
		lines.push(`Domains added: ${added.map((d) => d.folder).join(", ")}.`);
	}
	if (removed.length > 0) {
		lines.push(`Domains removed: ${removed.map((d) => d.folder).join(", ")}.`);
	}
	if (switched.length > 0) {
		lines.push(`Domains enabled or disabled: ${switched.map((d) => d.folder).join(", ")}.`);
	}
	if (autoChanged.length > 0) {
		lines.push(`Domains allowed or blocked in automatic filing: ${autoChanged.map((d) => d.folder).join(", ")}.`);
	}
	return lines;
}
