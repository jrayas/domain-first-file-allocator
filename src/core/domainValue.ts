import { normaliseFolderPath, pathKey } from "./paths";

export type DomainRead =
	| { kind: "missing" }
	| { kind: "single"; value: string }
	| { kind: "multiple"; values: string[] }
	| { kind: "invalid"; reason: string };

type Scalar = string | number | boolean;

function isScalar(value: unknown): value is Scalar {
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

type Cleaned = { blank: true } | { blank: false; value: string } | { invalid: string };

function clean(raw: Scalar): Cleaned {
	const text = String(raw);
	if (text.trim() === "") {
		return { blank: true };
	}
	const normalised = normaliseFolderPath(text);
	if (normalised === "") {
		return { invalid: `"${text.trim()}" is not a usable folder path.` };
	}
	return { blank: false, value: normalised };
}

/**
 * Interprets whatever a note holds in its domain property.
 * Strings, numbers and booleans are treated as text; lists are cleaned and
 * de-duplicated; anything else (objects, nested lists) is invalid.
 */
export function readDomainValue(raw: unknown): DomainRead {
	if (raw === undefined || raw === null) {
		return { kind: "missing" };
	}
	if (isScalar(raw)) {
		const cleaned = clean(raw);
		if ("invalid" in cleaned) {
			return { kind: "invalid", reason: cleaned.invalid };
		}
		return cleaned.blank ? { kind: "missing" } : { kind: "single", value: cleaned.value };
	}
	if (Array.isArray(raw)) {
		const values: string[] = [];
		const seen = new Set<string>();
		for (const item of raw as unknown[]) {
			if (item === undefined || item === null) {
				continue;
			}
			if (!isScalar(item)) {
				return { kind: "invalid", reason: "The list contains something that is not text." };
			}
			const cleaned = clean(item);
			if ("invalid" in cleaned) {
				return { kind: "invalid", reason: cleaned.invalid };
			}
			if (!cleaned.blank && !seen.has(pathKey(cleaned.value))) {
				seen.add(pathKey(cleaned.value));
				values.push(cleaned.value);
			}
		}
		if (values.length === 0) {
			return { kind: "missing" };
		}
		const [only] = values;
		return values.length === 1 && only !== undefined
			? { kind: "single", value: only }
			: { kind: "multiple", values };
	}
	return { kind: "invalid", reason: "The value is not text or a list of text." };
}

/** True when a frontmatter flag counts as "yes" (a boolean true or the text "true"). */
export function isTruthyFlag(value: unknown): boolean {
	return value === true || (typeof value === "string" && value.trim().toLowerCase() === "true");
}
