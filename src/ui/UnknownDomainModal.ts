import type { App } from "obsidian";
import { DecisionModal } from "./DecisionModal";

export type UnknownDomainChoice = "fallback" | "add" | "cancel";

export interface UnknownDomainOptions {
	domain: string;
	/** The domain is registered but switched off. */
	disabled: boolean;
	fallbackEnabled: boolean;
	fallbackFolder: string;
}

export class UnknownDomainModal extends DecisionModal<UnknownDomainChoice> {
	constructor(
		app: App,
		private readonly options: UnknownDomainOptions,
	) {
		super(app, "cancel");
	}

	onOpen(): void {
		const { contentEl, options } = this;
		this.setTitle(options.disabled ? "Domain is disabled" : "Unknown domain");
		contentEl.createEl("p", {
			text: options.disabled
				? `The domain "${options.domain}" is in your registry but switched off.`
				: `The domain "${options.domain}" is not in your registry.`,
		});
		contentEl.createEl("p", {
			cls: "dffa-muted",
			text: options.fallbackEnabled
				? `The note can go to the fallback folder, "${options.fallbackFolder}", instead.`
				: "The fallback folder is turned off, so sending the note there will leave it where it is.",
		});

		const row = this.buttonRow();
		row.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.finish("cancel"));
		row.createEl("button", { text: "Send to fallback" }).addEventListener("click", () =>
			this.finish("fallback"),
		);
		row.createEl("button", {
			text: options.disabled ? "Enable this domain" : "Add this domain",
			cls: "mod-cta",
		}).addEventListener("click", () => this.finish("add"));
	}
}
