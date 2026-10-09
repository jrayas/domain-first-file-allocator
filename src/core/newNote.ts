/** Helpers for deciding what to do with a note's frontmatter when it is first created. */

type Frontmatter = Record<string, unknown> | undefined;

/** True when the note has a property with exactly this name, even if its value is empty. */
export function hasProperty(frontmatter: Frontmatter, name: string): boolean {
	return frontmatter !== undefined && Object.prototype.hasOwnProperty.call(frontmatter, name);
}

/** True when the note has a property with this name in any capitalisation, so a template's own spelling is respected. */
export function hasPropertyIgnoringCase(frontmatter: Frontmatter, name: string): boolean {
	if (frontmatter === undefined) {
		return false;
	}
	const wanted = name.toLowerCase();
	return Object.keys(frontmatter).some((key) => key.toLowerCase() === wanted);
}

/**
 * Whether to add the domain property to a new note. Never when the note already
 * has it (for example from a template), whatever the value, so a template's own
 * field, and anything in it, is left exactly as it is.
 */
export function shouldAddProperty(frontmatter: Frontmatter, name: string): boolean {
	return !hasPropertyIgnoringCase(frontmatter, name);
}

/**
 * How long to wait after a note is created before judging it, in milliseconds.
 * Templates are often applied a moment after creation, so judging sooner could
 * miss a property the template is about to add.
 */
export const NEW_NOTE_SETTLE_MS = 1500;
