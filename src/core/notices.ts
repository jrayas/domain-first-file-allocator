import type { NoticeLevel } from "../types";

/**
 * How much a notice matters.
 * - info: routine confirmations, such as "Moved note to Inbox".
 * - important: something the user should know about, such as a skip or a settings change.
 * - error: something went wrong. Errors are always shown.
 */
export type NoticeImportance = "info" | "important" | "error";

/** Decides whether a notice is shown under the user's chosen level. */
export function shouldShowNotice(level: NoticeLevel, importance: NoticeImportance): boolean {
	switch (importance) {
		case "error":
			return true;
		case "important":
			return level !== "errors";
		case "info":
			return level === "all";
	}
}
