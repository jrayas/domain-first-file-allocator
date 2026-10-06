import type { App } from "obsidian";
import { DecisionModal } from "./DecisionModal";

export interface ConfirmOptions {
	title: string;
	lines: string[];
	confirmText: string;
	cancelText?: string;
	/** Styles the confirm button as a warning, for destructive actions. */
	destructive?: boolean;
}

/** A plain confirm or cancel question. Resolves true only when confirmed. */
export class ConfirmModal extends DecisionModal<boolean> {
	constructor(
		app: App,
		private readonly options: ConfirmOptions,
	) {
		super(app, false);
	}

	onOpen(): void {
		const { contentEl, options } = this;
		this.setTitle(options.title);
		for (const line of options.lines) {
			contentEl.createEl("p", { text: line });
		}
		const row = this.buttonRow();
		row.createEl("button", { text: options.cancelText ?? "Cancel" }).addEventListener("click", () =>
			this.finish(false),
		);
		const confirm = row.createEl("button", {
			text: options.confirmText,
			cls: options.destructive ? "mod-warning" : "mod-cta",
		});
		confirm.addEventListener("click", () => this.finish(true));
	}
}
