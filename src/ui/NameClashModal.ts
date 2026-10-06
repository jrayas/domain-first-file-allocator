import type { App } from "obsidian";
import { nextFreeName, splitFileName, validateNoteName } from "../core/conflicts";
import { DecisionModal } from "./DecisionModal";

export type ClashDecision =
	| { action: "keep-both" | "replace" | "skip" | "cancel"; applyToAll: boolean }
	| { action: "rename"; newName: string; applyToAll: false };

export interface NameClashOptions {
	incomingName: string;
	incomingPath: string;
	existingPath: string;
	destinationFolder: string;
	/** True when the given complete file name is already taken in the destination folder. */
	nameExists: (fileName: string) => boolean;
	/** Set for batches, to show the "apply to all" checkbox. */
	remainingAfterThis?: number;
}

type View = "choose" | "rename" | "confirm-replace";

/** Asks what to do when the destination already holds a note with the same name. */
export class NameClashModal extends DecisionModal<ClashDecision> {
	private view: View = "choose";
	private applyToAll = false;
	private renameDraft: string;

	constructor(
		app: App,
		private readonly options: NameClashOptions,
	) {
		super(app, { action: "cancel", applyToAll: false });
		this.renameDraft = splitFileName(options.incomingName).stem;
	}

	onOpen(): void {
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		if (this.view === "rename") {
			this.renderRename();
		} else if (this.view === "confirm-replace") {
			this.renderConfirmReplace();
		} else {
			this.renderChoose();
		}
	}

	private describeBoth(): void {
		const { contentEl, options } = this;
		contentEl.createEl("p", {
			text: `"${options.destinationFolder}" already contains a note with the same name.`,
		});
		const list = contentEl.createEl("ul", { cls: "dffa-compare" });
		list.createEl("li", { text: `Incoming: ${options.incomingPath}` });
		list.createEl("li", { text: `Existing: ${options.existingPath}` });
	}

	private renderChoose(): void {
		const { contentEl, options } = this;
		this.setTitle("Name clash");
		this.describeBoth();

		if (options.remainingAfterThis !== undefined && options.remainingAfterThis > 0) {
			const label = contentEl.createEl("label", { cls: "dffa-checkbox" });
			const box = label.createEl("input", { type: "checkbox" });
			box.checked = this.applyToAll;
			box.addEventListener("change", () => {
				this.applyToAll = box.checked;
			});
			label.createSpan({
				text: `Apply to all remaining clashes (${options.remainingAfterThis} more notes)`,
			});
		}

		const keepBothName = nextFreeName(options.incomingName, options.nameExists);
		const choices = contentEl.createDiv({ cls: "dffa-choice-list" });
		choices
			.createEl("button", { text: `Keep both (incoming note becomes "${keepBothName}")` })
			.addEventListener("click", () => this.finish({ action: "keep-both", applyToAll: this.applyToAll }));
		choices.createEl("button", { text: "Rename the incoming note" }).addEventListener("click", () => {
			this.view = "rename";
			this.render();
		});
		choices
			.createEl("button", { text: "Replace the existing note", cls: "mod-warning" })
			.addEventListener("click", () => {
				this.view = "confirm-replace";
				this.render();
			});
		choices.createEl("button", { text: "Skip this note" }).addEventListener("click", () =>
			this.finish({ action: "skip", applyToAll: this.applyToAll }),
		);

		this.buttonRow()
			.createEl("button", { text: "Cancel everything" })
			.addEventListener("click", () => this.finish({ action: "cancel", applyToAll: false }));
	}

	private renderRename(): void {
		const { contentEl, options } = this;
		const { extension } = splitFileName(options.incomingName);
		this.setTitle("Rename the incoming note");
		contentEl.createEl("p", { text: `Choose a new name for "${options.incomingName}".` });

		const input = contentEl.createEl("input", { type: "text", cls: "dffa-text-input" });
		input.value = this.renameDraft;
		const error = contentEl.createEl("p", { cls: "dffa-error" });

		const submit = (): void => {
			this.renameDraft = input.value;
			const problem = validateNoteName(input.value, extension, options.nameExists);
			if (problem !== null) {
				error.setText(problem);
				return;
			}
			this.finish({ action: "rename", newName: `${input.value.trim()}${extension}`, applyToAll: false });
		};
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				submit();
			}
		});
		input.addEventListener("input", () => error.setText(""));

		const row = this.buttonRow();
		row.createEl("button", { text: "Back" }).addEventListener("click", () => {
			this.renameDraft = input.value;
			this.view = "choose";
			this.render();
		});
		row.createEl("button", { text: "Rename and move", cls: "mod-cta" }).addEventListener("click", submit);
		input.focus();
		input.select();
	}

	private renderConfirmReplace(): void {
		const { contentEl, options } = this;
		this.setTitle("Replace the existing note?");
		contentEl.createEl("p", {
			text: `"${options.existingPath}" will be moved to the trash, following your Obsidian "Deleted files" setting, and the incoming note will take its place.`,
		});
		contentEl.createEl("p", {
			cls: "dffa-error",
			text: "Undo cannot bring the replaced note back. You would need to restore it from the trash yourself.",
		});
		const row = this.buttonRow();
		row.createEl("button", { text: "Back" }).addEventListener("click", () => {
			this.view = "choose";
			this.render();
		});
		row.createEl("button", { text: "Yes, replace it", cls: "mod-warning" }).addEventListener("click", () =>
			this.finish({ action: "replace", applyToAll: this.applyToAll }),
		);
	}
}
