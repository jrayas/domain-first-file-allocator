import type { App } from "obsidian";
import { DecisionModal } from "./DecisionModal";

/** Shows which subfolders of a folder would become domains, and lets the user choose how deep to go. */
export class BulkAddModal extends DecisionModal<string[] | null> {
	private recursive = false;

	constructor(
		app: App,
		private readonly parent: string,
		/** The folders that would be added at the chosen depth. */
		private readonly candidates: (recursive: boolean) => string[],
	) {
		super(app, null);
	}

	onOpen(): void {
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle("Add subfolders as domains");
		contentEl.createEl("p", { text: `Register the subfolders of "${this.parent}" as domains.` });

		const label = contentEl.createEl("label", { cls: "dffa-checkbox" });
		const box = label.createEl("input", { type: "checkbox" });
		box.checked = this.recursive;
		box.addEventListener("change", () => {
			this.recursive = box.checked;
			this.render();
		});
		label.createSpan({ text: "Include folders inside those folders as well" });

		const folders = this.candidates(this.recursive);
		contentEl.createEl("p", {
			cls: "dffa-muted",
			text:
				folders.length === 0
					? "Nothing to add. Every subfolder is already a domain or is excluded."
					: `${folders.length} ${folders.length === 1 ? "folder" : "folders"} will be added. Excluded and already registered folders are skipped.`,
		});

		if (folders.length > 0) {
			const list = contentEl.createDiv({ cls: "dffa-preview-list" });
			for (const folder of folders) {
				list.createDiv({ cls: "dffa-preview-item", text: folder });
			}
		}

		const row = this.buttonRow();
		row.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.finish(null));
		const add = row.createEl("button", {
			text: folders.length === 0 ? "Add" : `Add ${folders.length}`,
			cls: "mod-cta",
		});
		add.disabled = folders.length === 0;
		add.addEventListener("click", () => this.finish(folders));
	}
}
