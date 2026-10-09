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
	balanced: "Folders are created and registered automatically. The rest still ask.",
	"hands-off":
		"Automates every safe popup. Unknown domains go to the fallback and clashes keep both. Replace and imports still ask.",
	custom: "You changed individual choices below.",
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
		"For a domain that is not registered. A switched-off domain always asks.",
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
		"A note whose domain is a list.",
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
		"Adding an unknown domain whose folder is missing.",
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
		"When the destination has a note with the same name. Replace is never automatic.",
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
		"When the note's folder is not registered.",
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
		"Rewrite notes that name the old path, after a preview or straight away.",
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
		"Smaller renames skip the preview. Leave at 1 to always preview.",
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
		"When its domain no longer matches the folder.",
		MOVE_CHOICES,
		settings.folderMovePrompt,
		(value) => {
			settings.folderMovePrompt = value;
			changed();
		},
	);

	addHeading(el, "Always asks");
	addNote(el, "Never switched off, because a mistake could lose data.");
	for (const [name, desc] of [
		["Replace an existing note", "Needs a second confirmation. Undo cannot restore the replaced note."],
		["Import settings", "Shows the changes first and saves a backup."],
		["Overwrite a damaged data file", "Never done. A file that cannot be read is left untouched."],
	] as const) {
		const row = new Setting(el).setName(name).setDesc(desc);
		const icon = row.nameEl.createSpan({ cls: "dffa-lock-icon" });
		setIcon(icon, "lock");
		row.nameEl.prepend(icon);
	}
}
