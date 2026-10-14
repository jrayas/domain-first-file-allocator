import { setIcon, type SettingDefinition, type SettingDefinitionPage } from "obsidian";
import { MAX_PREVIEW_THRESHOLD, MIN_PREVIEW_THRESHOLD } from "../core/preferences";
import { NAMED_PRESETS, detectPreset } from "../core/presets";
import type {
	AskOrAuto,
	FolderMovePrompt,
	MultipleValuesAction,
	NameClashPolicy,
	PromptPreset,
	UnknownDomainAction,
} from "../types";
import { choiceSetting, customSetting, sliderSetting, type Choice, type TabContext } from "./helpers";

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
	custom: "Your own mix of the choices below.",
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

/** The choices that can never be switched off, shown so the user knows they are there. */
const LOCKED: readonly (readonly [name: string, desc: string])[] = [
	["Replace an existing note", "Needs a second confirmation. Undo cannot restore the replaced note."],
	["Import settings", "Shows the changes first and saves a backup."],
	["Overwrite a damaged data file", "Never done. A file that cannot be read is left untouched."],
];

export function promptsPage(ctx: TabContext): SettingDefinitionPage {
	const settings = ctx.plugin.settings;
	const current = detectPreset({ prompts: settings.prompts, folderMovePrompt: settings.folderMovePrompt });
	// "Custom" is offered only while the choices below are a mix that matches no preset.
	const presetChoices: Choice<PromptPreset>[] = NAMED_PRESETS.map((name): Choice<PromptPreset> => [
		name,
		PRESET_LABELS[name],
	]);
	if (current === "custom") {
		presetChoices.push(["custom", PRESET_LABELS.custom]);
	}

	return {
		type: "page",
		name: "Prompts and confirmations",
		desc: "Which popups ask, and which act on their own.",
		displayValue: () => PRESET_LABELS[currentPreset(ctx)].split(":")[0] ?? "",
		items: [
			{
				type: "group",
				heading: "Preset",
				items: [choiceSetting("Popup behaviour", PRESET_DESCRIPTIONS[current], "prompts.preset", presetChoices)],
			},
			{
				type: "group",
				heading: "File note by domain",
				items: [
					choiceSetting(
						"Unknown domain",
						"For a domain that is not registered. A switched-off domain always asks.",
						"prompts.unknownDomain",
						UNKNOWN_DOMAIN_CHOICES,
					),
					choiceSetting(
						"Several domains in one note",
						"A note whose domain is a list.",
						"prompts.multipleValues",
						MULTIPLE_VALUE_CHOICES,
					),
					choiceSetting(
						"Domain folder does not exist",
						"Adding an unknown domain whose folder is missing.",
						"prompts.createFolder",
						CREATE_CHOICES,
					),
					choiceSetting(
						"Name clash",
						"When the destination has a note with the same name. Replace is never automatic.",
						"prompts.nameClash",
						CLASH_CHOICES,
					),
				],
			},
			{
				type: "group",
				heading: "Set domain from folder",
				items: [
					choiceSetting(
						"Folder is not a domain yet",
						"When the note's folder is not registered.",
						"prompts.registerFolder",
						REGISTER_CHOICES,
					),
				],
			},
			{
				type: "group",
				heading: "When folders change",
				items: [
					choiceSetting(
						"After a domain folder is renamed or moved",
						"Rewrite notes that name the old path, after a preview or straight away.",
						"prompts.renamePreview",
						PREVIEW_CHOICES,
					),
					sliderSetting(
						"Skip the preview below this many notes",
						"Smaller renames skip the preview. Leave at 1 to always preview.",
						"prompts.previewThreshold",
						{ min: MIN_PREVIEW_THRESHOLD, max: MAX_PREVIEW_THRESHOLD },
					),
					choiceSetting(
						"Note moved by hand into a domain folder",
						"When its domain no longer matches the folder.",
						"folderMovePrompt",
						MOVE_CHOICES,
					),
				],
			},
			{
				type: "group",
				heading: "Always asks",
				items: LOCKED.map(([name, desc]) => lockedRow(name, desc)),
			},
		],
	};
}

function currentPreset(ctx: TabContext): PromptPreset {
	const { prompts, folderMovePrompt } = ctx.plugin.settings;
	return detectPreset({ prompts, folderMovePrompt });
}

function lockedRow(name: string, desc: string): SettingDefinition {
	return customSetting(name, desc, (setting) => {
		const icon = setting.nameEl.createSpan({ cls: "dffa-lock-icon" });
		setIcon(icon, "lock");
		setting.nameEl.prepend(icon);
	});
}
