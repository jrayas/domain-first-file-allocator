import { TFolder, type App, type Setting, type SettingDefinition } from "obsidian";
import type DomainFirstFileAllocatorPlugin from "../main";

/** What every settings page needs: the plugin, a way to save, and a way to draw the page again. */
export interface TabContext {
	app: App;
	plugin: DomainFirstFileAllocatorPlugin;
	/** Saves the settings straight away and mirrors them to the data file. */
	commit(): void;
	/** Draws the settings screen again, for changes that alter what else is shown. */
	redraw(): void;
}

export type Choice<T extends string> = readonly [value: T, label: string];

/** Settings written without a description pass an empty string, which Obsidian should not render. */
function describe(desc: string): string | undefined {
	return desc === "" ? undefined : desc;
}

export function toggleSetting(name: string, desc: string, key: string): SettingDefinition {
	return { name, desc: describe(desc), control: { type: "toggle", key } };
}

export function choiceSetting<T extends string>(
	name: string,
	desc: string,
	key: string,
	choices: readonly Choice<T>[],
): SettingDefinition {
	const options: Record<string, string> = {};
	for (const [value, label] of choices) {
		options[value] = label;
	}
	return { name, desc: describe(desc), control: { type: "dropdown", key, options } };
}

export function textSetting(
	name: string,
	desc: string,
	key: string,
	options: { placeholder?: string; validate: (value: string) => string | undefined },
): SettingDefinition {
	return {
		name,
		desc: describe(desc),
		control: { type: "text", key, placeholder: options.placeholder, validate: options.validate },
	};
}

export function sliderSetting(
	name: string,
	desc: string,
	key: string,
	limits: { min: number; max: number },
	displayFormat?: (value: number) => string,
): SettingDefinition {
	return {
		name,
		desc: describe(desc),
		control: { type: "slider", key, min: limits.min, max: limits.max, step: 1, displayFormat },
	};
}

/** A row with text and no control: explanations, and rows that only show a state. */
export function noteSetting(name: string, desc: string): SettingDefinition {
	return { name, desc: describe(desc) };
}

/**
 * A row whose controls, usually buttons, are added by `build`. The name and description come from the
 * definition. `build` may return the chained `Setting` it was given: a `Setting` has a `then` method,
 * so a function that returns one looks like it returns a promise unless its return type is `unknown`.
 */
export function customSetting(name: string, desc: string, build: (setting: Setting) => unknown): SettingDefinition {
	return {
		name,
		desc: describe(desc),
		render: (setting) => {
			build(setting);
		},
	};
}

export const requireText = (what: string) => (value: string): string | undefined =>
	value.trim() === "" ? `Enter ${what}.` : undefined;

/** Every folder in the vault except the root, sorted by path. */
export function allFolders(app: App): TFolder[] {
	return app.vault
		.getAllLoadedFiles()
		.filter((file): file is TFolder => file instanceof TFolder && !file.isRoot())
		.sort((a, b) => a.path.localeCompare(b.path));
}
