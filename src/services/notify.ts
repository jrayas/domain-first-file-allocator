import { Notice } from "obsidian";
import { shouldShowNotice, type NoticeImportance } from "../core/notices";
import type { NoticeLevel } from "../types";

/** The one place plugin notices go through, so the user's notice level is honoured everywhere. */
export class Notifier {
	constructor(private readonly getLevel: () => NoticeLevel) {}

	private show(importance: NoticeImportance, message: string, durationMs?: number): Notice | null {
		if (!shouldShowNotice(this.getLevel(), importance)) {
			return null;
		}
		return new Notice(message, durationMs);
	}

	/** A routine confirmation. Hidden when the level is "important" or "errors". */
	info(message: string, durationMs?: number): Notice | null {
		return this.show("info", message, durationMs);
	}

	/** Something worth knowing. Hidden only when the level is "errors". */
	important(message: string, durationMs?: number): Notice | null {
		return this.show("important", message, durationMs);
	}

	/** A failure. Always shown. */
	error(message: string, durationMs?: number): Notice | null {
		return this.show("error", message, durationMs);
	}
}
