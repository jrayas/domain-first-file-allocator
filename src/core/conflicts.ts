/** Pure helpers for name clashes when moving a note into a folder. */

const ILLEGAL_CHARACTERS = /[\\/:*?"<>|#^[\]]/;
const MAX_NAME_LENGTH = 255;

export interface SplitName {
	stem: string;
	extension: string;
}

/** Splits `Note.md` into `Note` and `.md`. Names with no extension keep an empty one. */
export function splitFileName(fileName: string): SplitName {
	const index = fileName.lastIndexOf(".");
	if (index <= 0) {
		return { stem: fileName, extension: "" };
	}
	return { stem: fileName.slice(0, index), extension: fileName.slice(index) };
}

/**
 * Finds the first free "Keep both" name: `Note 1.md`, `Note 2.md` and so on.
 * `exists` is asked about complete file names within the destination folder.
 */
export function nextFreeName(fileName: string, exists: (candidate: string) => boolean): string {
	const { stem, extension } = splitFileName(fileName);
	let counter = 1;
	let candidate = `${stem} ${counter}${extension}`;
	while (exists(candidate)) {
		counter += 1;
		candidate = `${stem} ${counter}${extension}`;
	}
	return candidate;
}

/**
 * Validates a new note name typed by the user (without extension).
 * Returns an error message, or null when the name is acceptable.
 */
export function validateNoteName(
	stem: string,
	extension: string,
	exists: (candidate: string) => boolean,
): string | null {
	const trimmed = stem.trim();
	if (trimmed === "") {
		return "Enter a name for the note.";
	}
	if (ILLEGAL_CHARACTERS.test(trimmed)) {
		return "The name cannot contain any of these characters: \\ / : * ? \" < > | # ^ [ ]";
	}
	if (trimmed.startsWith(".")) {
		return "The name cannot start with a full stop.";
	}
	if (trimmed.endsWith(".")) {
		return "The name cannot end with a full stop.";
	}
	if (trimmed.length + extension.length > MAX_NAME_LENGTH) {
		return "The name is too long.";
	}
	if (exists(`${trimmed}${extension}`)) {
		return "A note with that name already exists in the destination folder.";
	}
	return null;
}
