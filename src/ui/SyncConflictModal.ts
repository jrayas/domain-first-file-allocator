import type { App } from "obsidian";
import { DecisionModal } from "./DecisionModal";

export type ConflictSide = "settings" | "file" | null;

/** Asks which side to keep when the settings and the data file differ and the policy is "ask". */
export class SyncConflictModal extends DecisionModal<ConflictSide> {
	constructor(
		app: App,
		private readonly filePath: string,
		private readonly differences: readonly string[],
	) {
		super(app, null);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.setTitle("Settings and data file differ");
		contentEl.createEl("p", {
			text: `Your settings and ${this.filePath} do not match. Choose which one to keep. If you decide later, nothing changes.`,
		});
		contentEl.createEl("p", { cls: "dffa-muted", text: "Using the file would change:" });
		const list = contentEl.createEl("ul", { cls: "dffa-compare" });
		for (const line of this.differences.slice(0, 12)) {
			list.createEl("li", { text: line });
		}
		if (this.differences.length > 12) {
			list.createEl("li", { text: `…and ${this.differences.length - 12} more.` });
		}

		const row = this.buttonRow();
		row.createEl("button", { text: "Decide later" }).addEventListener("click", () => this.finish(null));
		row.createEl("button", { text: "Use the file" }).addEventListener("click", () => this.finish("file"));
		row.createEl("button", { text: "Use my settings", cls: "mod-cta" }).addEventListener("click", () =>
			this.finish("settings"),
		);
	}
}
