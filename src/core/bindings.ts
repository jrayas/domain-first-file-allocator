import {
	FOLDER_MOVE_PROMPTS,
	type AllocatorSettings,
	type AskOrAuto,
	type ConflictPolicy,
	type FolderMovePrompt,
	type MultipleValuesAction,
	type NameClashPolicy,
	type NoticeLevel,
	type UndoDepth,
	type UnknownDomainAction,
} from "../types";
import { normaliseFolderPath } from "./paths";
import { NAMED_PRESETS, applyPreset, detectPreset } from "./presets";
import {
	ASK_OR_AUTO,
	CONFLICT_POLICIES,
	MAX_AUTO_DELAY_SECONDS,
	MAX_PREVIEW_THRESHOLD,
	MIN_PREVIEW_THRESHOLD,
	MULTIPLE_VALUES_ACTIONS,
	NAME_CLASH_POLICIES,
	NOTICE_LEVELS,
	UNDO_DEPTHS,
	UNKNOWN_DOMAIN_ACTIONS,
	delayToSlider,
	sliderToDelay,
} from "./preferences";

/**
 * Connects the settings screen's controls to the settings. Each control has a key; a binding reads
 * the control's value from the settings and writes a changed value back. A write that is not valid
 * (an empty name, an unknown choice, a number out of range) is refused and changes nothing, so the
 * settings never hold a value the rest of the plugin cannot use.
 */
interface Binding {
	get(settings: AllocatorSettings): unknown;
	/** Returns true when the value was valid and has been applied. */
	set(settings: AllocatorSettings, value: unknown): boolean;
}

function booleanBinding(
	read: (settings: AllocatorSettings) => boolean,
	write: (settings: AllocatorSettings, value: boolean) => void,
): Binding {
	return {
		get: read,
		set: (settings, value) => {
			if (typeof value !== "boolean") {
				return false;
			}
			write(settings, value);
			return true;
		},
	};
}

function textBinding(
	read: (settings: AllocatorSettings) => string,
	write: (settings: AllocatorSettings, value: string) => void,
	normalise: (value: string) => string = (value) => value.trim(),
): Binding {
	return {
		get: read,
		set: (settings, value) => {
			if (typeof value !== "string") {
				return false;
			}
			const cleaned = normalise(value);
			if (cleaned === "") {
				return false;
			}
			write(settings, cleaned);
			return true;
		},
	};
}

function choiceBinding<T extends string>(
	allowed: readonly T[],
	read: (settings: AllocatorSettings) => T,
	write: (settings: AllocatorSettings, value: T) => void,
): Binding {
	return {
		get: read,
		set: (settings, value) => {
			const match = allowed.find((option) => option === value);
			if (match === undefined) {
				return false;
			}
			write(settings, match);
			return true;
		},
	};
}

function wholeNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

const BINDINGS = new Map<string, Binding>([
	// General
	["propertyName", textBinding((s) => s.propertyName, (s, v) => void (s.propertyName = v))],
	["optOutProperty", textBinding((s) => s.optOutProperty, (s, v) => void (s.optOutProperty = v))],
	["writeCanonicalCasing", booleanBinding((s) => s.writeCanonicalCasing, (s, v) => void (s.writeCanonicalCasing = v))],
	["addPropertyToNewNotes", booleanBinding((s) => s.addPropertyToNewNotes, (s, v) => void (s.addPropertyToNewNotes = v))],
	["fallback.enabled", booleanBinding((s) => s.fallback.enabled, (s, v) => void (s.fallback.enabled = v))],
	["fallback.folder", textBinding((s) => s.fallback.folder, (s, v) => void (s.fallback.folder = v), normaliseFolderPath)],
	["notices", choiceBinding<NoticeLevel>(NOTICE_LEVELS, (s) => s.notices, (s, v) => void (s.notices = v))],

	// Automatic filing
	["automatic.enabled", booleanBinding((s) => s.automatic.enabled, (s, v) => void (s.automatic.enabled = v))],
	["automatic.includeNoDomain", booleanBinding((s) => s.automatic.includeNoDomain, (s, v) => void (s.automatic.includeNoDomain = v))],
	["automatic.onlyInFallback", booleanBinding((s) => s.automatic.onlyInFallback, (s, v) => void (s.automatic.onlyInFallback = v))],
	["automatic.skipOpenNote", booleanBinding((s) => s.automatic.skipOpenNote, (s, v) => void (s.automatic.skipOpenNote = v))],
	["automatic.quiet", booleanBinding((s) => s.automatic.quiet, (s, v) => void (s.automatic.quiet = v))],
	[
		// The slider position: its first stop is 500 ms, the rest are whole seconds.
		"automatic.delay",
		{
			get: (s) => delayToSlider(s.automatic.delaySeconds),
			set: (s, value) => {
				const position = wholeNumber(value);
				if (position === null || position < 0 || position > MAX_AUTO_DELAY_SECONDS) {
					return false;
				}
				s.automatic.delaySeconds = sliderToDelay(position);
				return true;
			},
		},
	],

	// Prompts and confirmations
	[
		"prompts.unknownDomain",
		choiceBinding<UnknownDomainAction>(UNKNOWN_DOMAIN_ACTIONS, (s) => s.prompts.unknownDomain, (s, v) => void (s.prompts.unknownDomain = v)),
	],
	[
		"prompts.multipleValues",
		choiceBinding<MultipleValuesAction>(MULTIPLE_VALUES_ACTIONS, (s) => s.prompts.multipleValues, (s, v) => void (s.prompts.multipleValues = v)),
	],
	[
		"prompts.registerFolder",
		choiceBinding<AskOrAuto>(ASK_OR_AUTO, (s) => s.prompts.registerFolder, (s, v) => void (s.prompts.registerFolder = v)),
	],
	[
		"prompts.createFolder",
		choiceBinding<AskOrAuto>(ASK_OR_AUTO, (s) => s.prompts.createFolder, (s, v) => void (s.prompts.createFolder = v)),
	],
	[
		"prompts.renamePreview",
		choiceBinding<AskOrAuto>(ASK_OR_AUTO, (s) => s.prompts.renamePreview, (s, v) => void (s.prompts.renamePreview = v)),
	],
	[
		"prompts.nameClash",
		choiceBinding<NameClashPolicy>(NAME_CLASH_POLICIES, (s) => s.prompts.nameClash, (s, v) => void (s.prompts.nameClash = v)),
	],
	[
		"prompts.previewThreshold",
		{
			get: (s) => s.prompts.previewThreshold,
			set: (s, value) => {
				const count = wholeNumber(value);
				if (count === null || count < MIN_PREVIEW_THRESHOLD || count > MAX_PREVIEW_THRESHOLD) {
					return false;
				}
				s.prompts.previewThreshold = count;
				return true;
			},
		},
	],
	[
		"folderMovePrompt",
		choiceBinding<FolderMovePrompt>(FOLDER_MOVE_PROMPTS, (s) => s.folderMovePrompt, (s, v) => void (s.folderMovePrompt = v)),
	],
	[
		// A preset is not stored: it is the name of the mix of choices that matches, or "custom".
		// Writing one sets the whole mix. "Custom" only describes a mix, so it cannot be applied.
		"prompts.preset",
		{
			get: (s) => detectPreset({ prompts: s.prompts, folderMovePrompt: s.folderMovePrompt }),
			set: (s, value) => {
				const name = NAMED_PRESETS.find((preset) => preset === value);
				if (name === undefined) {
					return false;
				}
				const next = applyPreset(name, { prompts: s.prompts, folderMovePrompt: s.folderMovePrompt });
				s.prompts = next.prompts;
				s.folderMovePrompt = next.folderMovePrompt;
				return true;
			},
		},
	],

	// Data and sync
	["dataFolderName", textBinding((s) => s.dataFolderName, (s, v) => void (s.dataFolderName = v), normaliseFolderPath)],
	[
		"conflictPolicy",
		choiceBinding<ConflictPolicy>(CONFLICT_POLICIES, (s) => s.conflictPolicy, (s, v) => void (s.conflictPolicy = v)),
	],
	[
		// A dropdown holds text, so the depth is shown and accepted as "1", "5" or "10".
		"undoDepth",
		{
			get: (s) => String(s.undoDepth),
			set: (s, value) => {
				const depth = UNDO_DEPTHS.find((option) => String(option) === value);
				if (depth === undefined) {
					return false;
				}
				s.undoDepth = depth satisfies UndoDepth;
				return true;
			},
		},
	],
]);

/** Every key the settings screen can bind a control to. */
export const BINDING_KEYS: readonly string[] = [...BINDINGS.keys()];

export function isBindingKey(key: string): boolean {
	return BINDINGS.has(key);
}

/** The control value for a key, or undefined when the key is not known. */
export function getBinding(settings: AllocatorSettings, key: string): unknown {
	return BINDINGS.get(key)?.get(settings);
}

/** Applies a changed control value. Returns false, and changes nothing, when the key is unknown or the value is not valid. */
export function setBinding(settings: AllocatorSettings, key: string, value: unknown): boolean {
	return BINDINGS.get(key)?.set(settings, value) ?? false;
}
