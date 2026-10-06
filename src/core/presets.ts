import type { FolderMovePrompt, PromptPreset, PromptSettings } from "../types";

/** The presets that can be applied; "custom" only describes a mixture. */
export type NamedPreset = Exclude<PromptPreset, "custom">;

export const NAMED_PRESETS: readonly NamedPreset[] = ["cautious", "balanced", "hands-off"];

type PresetPrompts = Omit<PromptSettings, "previewThreshold">;

interface PresetValues {
	prompts: PresetPrompts;
	folderMovePrompt: FolderMovePrompt;
}

/**
 * Hands-off automates everything except the locked confirmations. It sends an
 * unknown domain to the fallback rather than registering it, because
 * registering would turn every typo into a new domain.
 */
const PRESETS: Record<NamedPreset, PresetValues> = {
	cautious: {
		prompts: {
			unknownDomain: "ask",
			multipleValues: "ask",
			registerFolder: "ask",
			createFolder: "ask",
			renamePreview: "ask",
			nameClash: "ask",
		},
		folderMovePrompt: "ask",
	},
	balanced: {
		prompts: {
			unknownDomain: "ask",
			multipleValues: "ask",
			registerFolder: "auto",
			createFolder: "auto",
			renamePreview: "ask",
			nameClash: "ask",
		},
		folderMovePrompt: "ask",
	},
	"hands-off": {
		prompts: {
			unknownDomain: "fallback",
			multipleValues: "first",
			registerFolder: "auto",
			createFolder: "auto",
			renamePreview: "auto",
			nameClash: "keep-both",
		},
		folderMovePrompt: "always",
	},
};

export interface PromptState {
	prompts: PromptSettings;
	folderMovePrompt: FolderMovePrompt;
}

/** Applies a preset, keeping the preview threshold, which no preset owns. */
export function applyPreset(preset: NamedPreset, current: PromptState): PromptState {
	const values = PRESETS[preset];
	return {
		prompts: { ...values.prompts, previewThreshold: current.prompts.previewThreshold },
		folderMovePrompt: values.folderMovePrompt,
	};
}

/** Names the preset that matches the current choices, or "custom" if none does. */
export function detectPreset(state: PromptState): PromptPreset {
	for (const name of NAMED_PRESETS) {
		const values = PRESETS[name];
		const { prompts } = state;
		const same =
			state.folderMovePrompt === values.folderMovePrompt &&
			prompts.unknownDomain === values.prompts.unknownDomain &&
			prompts.multipleValues === values.prompts.multipleValues &&
			prompts.registerFolder === values.prompts.registerFolder &&
			prompts.createFolder === values.prompts.createFolder &&
			prompts.renamePreview === values.prompts.renamePreview &&
			prompts.nameClash === values.prompts.nameClash;
		if (same) {
			return name;
		}
	}
	return "custom";
}
