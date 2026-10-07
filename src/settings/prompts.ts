import { Setting, debounce, setIcon } from "obsidian";
import { MAX_PREVIEW_THRESHOLD, MIN_PREVIEW_THRESHOLD } from "../core/preferences";
import { NAMED_PRESETS, applyPreset, detectPreset, type NamedPreset } from "../core/presets";
import type {
	AskOrAuto,
	FolderMovePrompt,
	MultipleValuesAction,
	NameClashPolicy,
	PromptPreset,
	UnknownDomainAction,
} from "../types";
import { addChoice, addHeading, addNote, addSlider, type Choice, type TabContext } from "./helpers";

const PRESET_LABELS: Record<PromptPreset, string> = {
	cautious: "Cautious: ask about everything",
	balanced: "Balanced: create and register folders automatically",
	"hands-off": "Hands-off: automate everything that is safe",
	custom: "Custom: your own mix",
};

const PRESET_DESCRIPTIONS: Record<PromptPreset, string> = {
	cautious: "Every popup asks first.",
	balanced: "Folders are created and registered without asking. Everything else still asks.",
	"hands-off":
		"Unknown domains go to the fallback, the first of several domains is used, folders are created and registered, rename previews are applied, name clashes keep both notes, and hand-moved notes are updated. Replace and imports still ask.",
	custom: "You have changed individual choices below, so they no longer match a preset.",
};

const UNKNOWN_DOMAIN_CHOICES: readonly Choice<UnknownDomainAction>[] = [
	["ask", "Ask me"],
	["fallback", "Send to the fallback folder"],
	["add", "Add it as a domain"],
];

const MULTIPLE_VALUE_CHOICES: readonly Choice<MultipleValuesAction>[] = [
	["ask", "Ask me which"],
	["first", "Use the first one"],
];

const REGISTER_CHOICES: readonly Choice<AskOrAuto>[] = [
	["ask", "Ask me"],
	["auto", "Register automatically"],
];

const CREATE_CHOICES: readonly Choice<AskOrAuto>[] = [
	["ask", "Ask me"],
	["auto", "Create automatically"],
];

const PREVIEW_CHOICES: readonly Choice<AskOrAuto>[] = [
	["ask", "Show a preview first"],
	["auto", "Update automatically"],
];

const CLASH_CHOICES: readonly Choice<NameClashPolicy>[] = [
	["ask", "Ask me"],
	["keep-both", "Keep both notes"],
	["skip", "Skip the note"],
];

const MOVE_CHOICES: readonly Choice<FolderMovePrompt>[] = [
	["ask", "Ask me"],
	["always", "Always update"],
	["never", "Never"],
];

export function renderPrompts(el: HTMLElement, ctx: TabContext): void {
	const settings = ctx.plugin.settings;
	const prompts = settings.prompts;

	/** Saves a changed choice, then redraws so the preset label can follow. */
	const changed = (): void => {
		ctx.commit();
		ctx.redraw();
	};

	addHeading(el, "Preset");
	const current = detectPreset({ prompts, folderMovePrompt: settings.folderMovePrompt });
	const presetChoices: Choice<PromptPreset>[] = NAMED_PRESETS.map((name): Choice<PromptPreset> => [name, PRESET_LABELS[name]]);
	if (current === "custom") {
		presetChoices.push(["custom", PRESET_LABELS.custom]);
	}
	addChoice(el, "Popup behaviour", PRESET_DESCRIPTIONS[current], presetChoices, current, (value) => {
		if (value === "custom") {
			return;
		}
		const next = applyPreset(value as NamedPreset, { prompts, folderMovePrompt: settings.folderMovePrompt });
		settings.prompts = next.prompts;
		settings.folderMovePrompt = next.folderMovePrompt;
		changed();
	});

	addHeading(el, "File note by domain");
	addChoice(
		el,
		"Unknown domain",
		"What to do when a note's domain is not registered. A domain you switched off is never turned back on without asking.",
		UNKNOWN_DOMAIN_CHOICES,
		prompts.unknownDomain,
		(value) => {
			prompts.unknownDomain = value;
			changed();
		},
	);
	addChoice(
		el,
		"Several domains in one note",
		"A note whose domain property is a list of more than one value.",
		MULTIPLE_VALUE_CHOICES,
		prompts.multipleValues,
		(value) => {
			prompts.multipleValues = value;
			changed();
		},
	);
	addChoice(
		el,
		"Domain folder does not exist",
		"When adding an unknown domain whose folder has to be created first.",
		CREATE_CHOICES,
		prompts.createFolder,
		(value) => {
			prompts.createFolder = value;
			changed();
		},
	);
	addChoice(
		el,
		"Name clash",
		"When the destination already holds a note with the same name. Replace is only ever offered in the dialogue, never done automatically.",
		CLASH_CHOICES,
		prompts.nameClash,
		(value) => {
			prompts.nameClash = value;
			changed();
		},
	);

	addHeading(el, "Set domain from folder");
	addChoice(
		el,
		"Folder is not a domain yet",
		"When a note's folder is not registered.",
		REGISTER_CHOICES,
		prompts.registerFolder,
		(value) => {
			prompts.registerFolder = value;
			changed();
		},
	);

	addHeading(el, "When folders change");
	addChoice(
		el,
		"After a domain folder is renamed or moved",
		"The registry always follows the folder. This decides whether notes naming the old path are rewritten after a preview or straight away. Undo can reverse either.",
		PREVIEW_CHOICES,
		prompts.renamePreview,
		(value) => {
			prompts.renamePreview = value;
			changed();
		},
	);

	const saveThreshold = debounce(() => ctx.commit(), 700, true);
	addSlider(
		el,
		"Skip the preview below this many notes",
		"A rename that affects fewer notes than this is applied without a preview, even when previews are on. Leave at 1 to always preview.",
		{ min: MIN_PREVIEW_THRESHOLD, max: MAX_PREVIEW_THRESHOLD },
		prompts.previewThreshold,
		(value) => {
			prompts.previewThreshold = value;
			saveThreshold();
		},
	);

	addChoice(
		el,
		"Note moved by hand into a domain folder",
		"When its domain property no longer matches the folder. Notes moved within half a second of each other are handled together.",
		MOVE_CHOICES,
		settings.folderMovePrompt,
		(value) => {
			settings.folderMovePrompt = value;
			changed();
		},
	);

	addHeading(el, "Always asks");
	addNote(el, "These are never switched off, because a mistake cannot be undone or could lose data.");
	for (const [name, desc] of [
		["Replace an existing note", "Needs a second confirmation. The replaced note goes to the trash and undo cannot restore it."],
		["Import settings", "Shows what will change first, and saves a backup before replacing anything."],
		["Overwrite a damaged data file", "Never done. A file that cannot be read is left untouched."],
	] as const) {
		const row = new Setting(el).setName(name).setDesc(desc);
		const icon = row.nameEl.createSpan({ cls: "dffa-lock-icon" });
		setIcon(icon, "lock");
		row.nameEl.prepend(icon);
	}
}
