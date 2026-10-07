import type { UndoAction } from "../types";

/** Holds the most recent undoable actions in memory, newest last, up to the user's chosen depth. */
export class UndoStack {
	private actions: UndoAction[] = [];

	constructor(private readonly getDepth: () => number = () => 1) {}

	/** Drops the oldest actions beyond the depth, which may have been lowered since they were recorded. */
	private trim(): void {
		const depth = Math.max(1, this.getDepth());
		if (this.actions.length > depth) {
			this.actions = this.actions.slice(this.actions.length - depth);
		}
	}

	record(action: UndoAction): void {
		if (action.entries.length > 0 || action.registryRename) {
			this.actions.push(action);
			this.trim();
		}
	}

	get size(): number {
		this.trim();
		return this.actions.length;
	}

	peek(): UndoAction | null {
		this.trim();
		return this.actions[this.actions.length - 1] ?? null;
	}

	take(): UndoAction | null {
		this.trim();
		return this.actions.pop() ?? null;
	}
}
