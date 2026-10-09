import { Setting, TFolder, type App } from "obsidian";
import type DomainFirstFileAllocatorPlugin from "../main";

/** What every tab needs: the plugin, a way to save, and a way to redraw the tab. */
export interface TabContext {
	app: App;
	plugin: DomainFirstFileAllocatorPlugin;
	/** Saves the settings straight away and mirrors them to the data file. */
	commit(): void;
	/** Draws the current tab again, for changes that alter what else is shown. */
	redraw(): void;
}

export function addHeading(el: HTMLElement, name: string): Setting {
	return new Setting(el).setName(name).setHeading();
}

export function addNote(el: HTMLElement, text: string): HTMLElement {
	return el.createEl("p", { cls: "setting-item-description", text });
}

export function addToggle(
	el: HTMLElement,
	name: string,
	desc: string,
	value: boolean,
	onChange: (value: boolean) => void,
): Setting {
	return new Setting(el)
		.setName(name)
		.setDesc(desc)
		.addToggle((toggle) => toggle.setValue(value).onChange(onChange));
}

export type Choice<T extends string> = readonly [value: T, label: string];

export function addChoice<T extends string>(
	el: HTMLElement,
	name: string,
	desc: string,
	choices: readonly Choice<T>[],
	value: T,
	onChange: (value: T) => void,
): Setting {
	return new Setting(el)
		.setName(name)
		.setDesc(desc)
		.setClass("dffa-choice")
		.addDropdown((dropdown) => {
			for (const [optionValue, label] of choices) {
				dropdown.addOption(optionValue, label);
			}
			dropdown.setValue(value);
			dropdown.onChange((chosen) => onChange(chosen as T));
		});
}

export function addSlider(
	el: HTMLElement,
	name: string,
	desc: string,
	limits: { min: number; max: number },
	value: number,
	onChange: (value: number) => void,
): Setting {
	return new Setting(el)
		.setName(name)
		.setDesc(desc)
		.setClass("dffa-stacked")
		.addSlider((slider) =>
			slider.setLimits(limits.min, limits.max, 1).setValue(value).setDynamicTooltip().onChange(onChange),
		);
}

/** Every folder in the vault except the root, sorted by path. */
export function allFolders(app: App): TFolder[] {
	return app.vault
		.getAllLoadedFiles()
		.filter((file): file is TFolder => file instanceof TFolder && !file.isRoot())
		.sort((a, b) => a.path.localeCompare(b.path));
}
