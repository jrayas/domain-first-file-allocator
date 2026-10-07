import type { AutomaticSettings, DomainEntry, FallbackSettings } from "../types";
import type { DomainRead } from "./domainValue";
import { samePath } from "./paths";
import { isAutoAllowed, lookupDomain } from "./registry";

export type AutoSkipReason =
	| "no-domain"
	| "not-registered"
	| "disabled"
	| "blocked"
	| "ambiguous"
	| "not-in-fallback"
	| "already-there";

export type AutoDecision =
	| { action: "skip"; reason: AutoSkipReason }
	/** The note is open in the editor and the user asked for open notes to be left alone. */
	| { action: "wait-for-close" }
	| { action: "file"; targetFolder: string; domainValue?: string };

export interface AutoContext {
	/** What the note holds in its domain property. */
	read: DomainRead;
	domains: readonly DomainEntry[];
	fallback: FallbackSettings;
	automatic: AutomaticSettings;
	/** The folder the note is in now. */
	currentFolder: string;
	isOpenNote: boolean;
}

/**
 * Decides what automatic filing should do with one note. Only an enabled,
 * registered domain that allows automatic filing is acted on, or an empty
 * domain when notes with no domain are included. Anything unclear is left alone.
 */
export function decideAutoFile(context: AutoContext): AutoDecision {
	const { read, domains, fallback, automatic, currentFolder } = context;

	if (automatic.onlyInFallback && !samePath(currentFolder, fallback.folder)) {
		return { action: "skip", reason: "not-in-fallback" };
	}

	let targetFolder: string;
	let domainValue: string | undefined;
	if (read.kind === "missing") {
		if (!automatic.includeNoDomain || !fallback.enabled) {
			return { action: "skip", reason: "no-domain" };
		}
		targetFolder = fallback.folder;
	} else if (read.kind === "single") {
		const lookup = lookupDomain(domains, read.value);
		if (lookup.status === "unknown") {
			return { action: "skip", reason: "not-registered" };
		}
		if (lookup.status === "disabled") {
			return { action: "skip", reason: "disabled" };
		}
		if (!isAutoAllowed(lookup.entry)) {
			return { action: "skip", reason: "blocked" };
		}
		targetFolder = lookup.entry.folder;
		domainValue = lookup.entry.folder;
	} else {
		return { action: "skip", reason: "ambiguous" };
	}

	if (samePath(currentFolder, targetFolder)) {
		return { action: "skip", reason: "already-there" };
	}
	if (automatic.skipOpenNote && context.isOpenNote) {
		return { action: "wait-for-close" };
	}
	return domainValue === undefined ? { action: "file", targetFolder } : { action: "file", targetFolder, domainValue };
}
