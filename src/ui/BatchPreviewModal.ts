import type { App } from "obsidian";
import { DecisionModal } from "./DecisionModal";

export interface PreviewItem {
	/** The note, usually its path. */
	label: string;
	/** What will change, for example "old → new". */
	detail: string;
}

export type PreviewChoice = "confirm" | "cancel" | "never";

export interface BatchPreviewOptions {
	title: string;
	intro: string;
	items: PreviewItem[];
	confirmText: string;
	cancelText: string;
	/** Adds a "Don't ask again" button, which resolves with "never". */
	offerNever?: boolean;
}

/** Shows what a batch will change and asks for confirmation before anything happens. */
export class BatchPreviewModal extends DecisionModal<PreviewChoice> {
	constructor(
		app: App,
		private readonly options: BatchPreviewOptions,
	) {
		super(app, "cancel");
	}

	onOpen(): void {
		const { contentEl, options } = this;
		this.setTitle(options.title);
		contentEl.createEl("p", { text: options.intro });
		contentEl.createEl("p", {
			cls: "dffa-muted",
			text: options.items.length === 1 ? "1 note affected" : `${options.items.length} notes affected`,
		});

		const list = contentEl.createDiv({ cls: "dffa-preview-list" });
		for (const item of options.items) {
			const row = list.createDiv({ cls: "dffa-preview-item" });
			row.createDiv({ cls: "dffa-preview-label", text: item.label });
			row.createDiv({ cls: "dffa-muted", text: item.detail });
		}

		const row = this.buttonRow();
		row.createEl("button", { text: options.cancelText }).addEventListener("click", () =>
			this.finish("cancel"),
		);
		if (options.offerNever) {
			row.createEl("button", { text: "Don't ask again" }).addEventListener("click", () =>
				this.finish("never"),
			);
		}
		row.createEl("button", { text: options.confirmText, cls: "mod-cta" }).addEventListener("click", () =>
			this.finish("confirm"),
		);
	}
}
