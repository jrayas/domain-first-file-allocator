import { Modal, type App } from "obsidian";

/**
 * A modal that resolves a promise with the user's decision. Closing it any
 * other way (Escape, tapping outside) resolves with `dismissed`.
 */
export abstract class DecisionModal<T> extends Modal {
	private resolver: ((value: T) => void) | null = null;
	private settled = false;

	constructor(
		app: App,
		private readonly dismissed: T,
	) {
		super(app);
	}

	ask(): Promise<T> {
		return new Promise<T>((resolve) => {
			this.resolver = resolve;
			this.open();
		});
	}

	protected finish(value: T): void {
		this.settle(value);
		this.close();
	}

	private settle(value: T): void {
		if (this.settled) {
			return;
		}
		this.settled = true;
		this.resolver?.(value);
	}

	onClose(): void {
		this.contentEl.empty();
		this.settle(this.dismissed);
	}

	/** Adds a touch-friendly row of buttons and returns it. */
	protected buttonRow(): HTMLDivElement {
		return this.contentEl.createDiv({ cls: "dffa-button-row" });
	}
}
