import {
	OPT_OUT_PROPERTY,
	type AskOrAuto,
	type AutomaticSettings,
	type ConflictPolicy,
	type MultipleValuesAction,
	type NameClashPolicy,
	type NoticeLevel,
	type PromptSettings,
	type SyncedConfig,
	type UndoDepth,
	type UnknownDomainAction,
} from "../types";

export const MIN_AUTO_DELAY_SECONDS = 1;
export const MAX_AUTO_DELAY_SECONDS = 60;
export const MIN_PREVIEW_THRESHOLD = 1;
export const MAX_PREVIEW_THRESHOLD = 50;

export const NOTICE_LEVELS: readonly NoticeLevel[] = ["all", "important", "errors"];
export const UNKNOWN_DOMAIN_ACTIONS: readonly UnknownDomainAction[] = ["ask", "fallback", "add"];
export const MULTIPLE_VALUES_ACTIONS: readonly MultipleValuesAction[] = ["ask", "first"];
export const ASK_OR_AUTO: readonly AskOrAuto[] = ["ask", "auto"];
export const NAME_CLASH_POLICIES: readonly NameClashPolicy[] = ["ask", "keep-both", "skip"];
export const CONFLICT_POLICIES: readonly ConflictPolicy[] = ["newest", "settings", "file", "ask"];
export const UNDO_DEPTHS: readonly UndoDepth[] = [1, 5, 10];

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A parsed value plus a message for everything that was missing the mark. Lenient callers ignore the messages. */
export interface Parsed<T> {
	value: T;
	errors: string[];
}

type Source = Record<string, unknown>;

function pickEnum<T extends string>(
	source: Source,
	key: string,
	allowed: readonly T[],
	fallback: T,
	errors: string[],
): T {
	const raw = source[key];
	if (raw === undefined) {
		return fallback;
	}
	if (typeof raw === "string" && (allowed as readonly string[]).includes(raw)) {
		return raw as T;
	}
	errors.push(`"${key}" must be one of: ${allowed.join(", ")}.`);
	return fallback;
}

function pickBoolean(source: Source, key: string, fallback: boolean, errors: string[]): boolean {
	const raw = source[key];
	if (raw === undefined) {
		return fallback;
	}
	if (typeof raw === "boolean") {
		return raw;
	}
	errors.push(`"${key}" must be true or false.`);
	return fallback;
}

/** Whole numbers in range. An out-of-range number is reported but clamped, so lenient callers still get a usable value. */
function pickNumber(
	source: Source,
	key: string,
	min: number,
	max: number,
	fallback: number,
	errors: string[],
): number {
	const raw = source[key];
	if (raw === undefined) {
		return fallback;
	}
	if (typeof raw !== "number" || !Number.isFinite(raw)) {
		errors.push(`"${key}" must be a number from ${min} to ${max}.`);
		return fallback;
	}
	if (raw < min || raw > max) {
		errors.push(`"${key}" must be a number from ${min} to ${max}.`);
	}
	return Math.min(max, Math.max(min, Math.round(raw)));
}

// ------------------------------------------------------------------ automatic

export function createDefaultAutomatic(): AutomaticSettings {
	// On by default, and the open note is not held back, so typing a domain into a
	// note files it a couple of seconds later. Only registered, enabled domains
	// are ever acted on, so this is safe before any domain has been set up.
	return {
		enabled: true,
		delaySeconds: 2,
		includeNoDomain: false,
		onlyInFallback: false,
		skipOpenNote: false,
		quiet: false,
	};
}

/** Keeps the delay a whole number of seconds within the allowed range. */
export function clampDelay(value: number): number {
	if (!Number.isFinite(value)) {
		return createDefaultAutomatic().delaySeconds;
	}
	return Math.min(MAX_AUTO_DELAY_SECONDS, Math.max(MIN_AUTO_DELAY_SECONDS, Math.round(value)));
}

export function parseAutomatic(raw: unknown): Parsed<AutomaticSettings> {
	const defaults = createDefaultAutomatic();
	const errors: string[] = [];
	if (raw === undefined) {
		return { value: defaults, errors };
	}
	if (!isRecord(raw)) {
		return { value: defaults, errors: ['"automatic" must be an object.'] };
	}
	const scoped: string[] = [];
	const value: AutomaticSettings = {
		enabled: pickBoolean(raw, "enabled", defaults.enabled, scoped),
		delaySeconds: pickNumber(
			raw,
			"delaySeconds",
			MIN_AUTO_DELAY_SECONDS,
			MAX_AUTO_DELAY_SECONDS,
			defaults.delaySeconds,
			scoped,
		),
		includeNoDomain: pickBoolean(raw, "includeNoDomain", defaults.includeNoDomain, scoped),
		onlyInFallback: pickBoolean(raw, "onlyInFallback", defaults.onlyInFallback, scoped),
		skipOpenNote: pickBoolean(raw, "skipOpenNote", defaults.skipOpenNote, scoped),
		quiet: pickBoolean(raw, "quiet", defaults.quiet, scoped),
	};
	errors.push(...scoped.map((message) => `In "automatic": ${message}`));
	return { value, errors };
}

export function readAutomatic(raw: unknown): AutomaticSettings {
	return parseAutomatic(raw).value;
}

// -------------------------------------------------------------------- prompts

export function createDefaultPrompts(): PromptSettings {
	return {
		unknownDomain: "ask",
		multipleValues: "ask",
		registerFolder: "ask",
		createFolder: "ask",
		renamePreview: "ask",
		nameClash: "ask",
		previewThreshold: 1,
	};
}

export function parsePrompts(raw: unknown): Parsed<PromptSettings> {
	const defaults = createDefaultPrompts();
	if (raw === undefined) {
		return { value: defaults, errors: [] };
	}
	if (!isRecord(raw)) {
		return { value: defaults, errors: ['"prompts" must be an object.'] };
	}
	const scoped: string[] = [];
	const value: PromptSettings = {
		unknownDomain: pickEnum(raw, "unknownDomain", UNKNOWN_DOMAIN_ACTIONS, defaults.unknownDomain, scoped),
		multipleValues: pickEnum(raw, "multipleValues", MULTIPLE_VALUES_ACTIONS, defaults.multipleValues, scoped),
		registerFolder: pickEnum(raw, "registerFolder", ASK_OR_AUTO, defaults.registerFolder, scoped),
		createFolder: pickEnum(raw, "createFolder", ASK_OR_AUTO, defaults.createFolder, scoped),
		renamePreview: pickEnum(raw, "renamePreview", ASK_OR_AUTO, defaults.renamePreview, scoped),
		nameClash: pickEnum(raw, "nameClash", NAME_CLASH_POLICIES, defaults.nameClash, scoped),
		previewThreshold: pickNumber(
			raw,
			"previewThreshold",
			MIN_PREVIEW_THRESHOLD,
			MAX_PREVIEW_THRESHOLD,
			defaults.previewThreshold,
			scoped,
		),
	};
	return { value, errors: scoped.map((message) => `In "prompts": ${message}`) };
}

export function readPrompts(raw: unknown): PromptSettings {
	return parsePrompts(raw).value;
}

// -------------------------------------------------------------------- general

/** The single-value preferences that sit directly in the top level of the settings. */
export type GeneralPreferences = Pick<
	SyncedConfig,
	"notices" | "optOutProperty" | "writeCanonicalCasing" | "conflictPolicy" | "undoDepth"
>;

export function createDefaultGeneral(): GeneralPreferences {
	return {
		notices: "all",
		optOutProperty: OPT_OUT_PROPERTY,
		writeCanonicalCasing: true,
		conflictPolicy: "newest",
		undoDepth: 1,
	};
}

export function parseGeneral(source: Source): Parsed<GeneralPreferences> {
	const defaults = createDefaultGeneral();
	const errors: string[] = [];

	let optOutProperty = defaults.optOutProperty;
	if (source.optOutProperty !== undefined) {
		if (typeof source.optOutProperty === "string" && source.optOutProperty.trim() !== "") {
			optOutProperty = source.optOutProperty.trim();
		} else {
			errors.push('"optOutProperty" must be a non-empty string.');
		}
	}

	let undoDepth = defaults.undoDepth;
	if (source.undoDepth !== undefined) {
		const candidate = UNDO_DEPTHS.find((depth) => depth === source.undoDepth);
		if (candidate === undefined) {
			errors.push(`"undoDepth" must be one of: ${UNDO_DEPTHS.join(", ")}.`);
		} else {
			undoDepth = candidate;
		}
	}

	return {
		value: {
			notices: pickEnum(source, "notices", NOTICE_LEVELS, defaults.notices, errors),
			optOutProperty,
			writeCanonicalCasing: pickBoolean(source, "writeCanonicalCasing", defaults.writeCanonicalCasing, errors),
			conflictPolicy: pickEnum(source, "conflictPolicy", CONFLICT_POLICIES, defaults.conflictPolicy, errors),
			undoDepth,
		},
		errors,
	};
}
