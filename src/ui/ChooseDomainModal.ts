import type { App } from "obsidian";
import { lookupDomain } from "../core/registry";
import type { DomainEntry } from "../types";
import { DecisionModal } from "./DecisionModal";

/** Asks which of several domain values to use. Resolves with the chosen value, or null if dismissed. */
export class ChooseDomainModal extends DecisionModal<string | null> {
	constructor(
		app: App,
		private readonly noteName: string,
		private readonly values: readonly string[],
		private readonly registry: readonly DomainEntry[],
	) {
		super(app, null);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.setTitle("Choose a domain");
		contentEl.createEl("p", {
			text: `"${this.noteName}" has more than one domain. Choose the one to use; it will be written back as the only value.`,
		});

		const list = contentEl.createDiv({ cls: "dffa-choice-list" });
		for (const value of this.values) {
			const status = lookupDomain(this.registry, value).status;
			const suffix =
				status === "unknown" ? " (not registered)" : status === "disabled" ? " (disabled)" : "";
			list.createEl("button", { text: `${value}${suffix}` }).addEventListener("click", () =>
				this.finish(value),
			);
		}

		this.buttonRow().createEl("button", { text: "Cancel" }).addEventListener("click", () =>
			this.finish(null),
		);
	}
}
