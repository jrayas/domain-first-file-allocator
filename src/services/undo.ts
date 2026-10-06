import type { UndoAction } from "../types";

/** Holds the single most recent undoable action in memory. */
export class UndoStack {
	private action: UndoAction | null = null;

	record(action: UndoAction): void {
		if (action.entries.length > 0) {
			this.action = action;
		}
	}

	peek(): UndoAction | null {
		return this.action;
	}

	take(): UndoAction | null {
		const action = this.action;
		this.action = null;
		return action;
	}
}
