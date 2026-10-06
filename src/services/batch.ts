import { Notice } from "obsidian";

/** Show a progress notice only for batches at least this long. */
const PROGRESS_THRESHOLD = 20;
/** Pause between files, so the interface stays responsive on mobile. */
const YIELD_MS = 15;

export interface BatchResult<T> {
	completed: number;
	failures: { item: T; error: unknown }[];
	cancelled: boolean;
}

/**
 * Runs work over a list one item at a time with a short yield in between.
 * `cancel()` stops it after the current item and clears the pending timer,
 * which the plugin calls on unload.
 */
export class BatchRunner {
	private cancelled = false;
	private timer: number | null = null;
	private wake: (() => void) | null = null;

	cancel(): void {
		this.cancelled = true;
		if (this.timer !== null) {
			window.clearTimeout(this.timer);
			this.timer = null;
		}
		this.wake?.();
		this.wake = null;
	}

	private pause(): Promise<void> {
		return new Promise((resolve) => {
			this.wake = resolve;
			this.timer = window.setTimeout(() => {
				this.timer = null;
				this.wake = null;
				resolve();
			}, YIELD_MS);
		});
	}

	async run<T>(
		label: string,
		items: readonly T[],
		work: (item: T) => Promise<void>,
	): Promise<BatchResult<T>> {
		const failures: { item: T; error: unknown }[] = [];
		const progress = items.length >= PROGRESS_THRESHOLD ? new Notice(`${label}…`, 0) : null;
		let completed = 0;
		try {
			for (const [index, item] of items.entries()) {
				if (this.cancelled) {
					break;
				}
				try {
					await work(item);
					completed += 1;
				} catch (error) {
					console.error("Domain First File Allocator: batch item failed", error);
					failures.push({ item, error });
				}
				progress?.setMessage(`${label}: ${index + 1} of ${items.length}`);
				await this.pause();
			}
		} finally {
			progress?.hide();
		}
		return { completed, failures, cancelled: this.cancelled };
	}
}
