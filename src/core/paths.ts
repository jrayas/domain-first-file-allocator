/**
 * Pure path helpers. All paths are vault-relative, use forward slashes and
 * have no leading or trailing slash. The vault root is the empty string.
 */

/**
 * Normalises a user-supplied or frontmatter-supplied folder path.
 * Trims whitespace, converts backslashes, collapses repeated slashes and
 * strips leading and trailing slashes. Returns an empty string when the
 * result would be the vault root or unsafe (contains `..`).
 */
export function normaliseFolderPath(value: string): string {
	const segments = value
		.replace(/\\/g, "/")
		.split("/")
		.map((segment) => segment.trim())
		.filter((segment) => segment !== "" && segment !== ".");
	if (segments.includes("..")) {
		return "";
	}
	return segments.join("/");
}

/** A case-insensitive comparison key for a folder path. */
export function pathKey(value: string): string {
	return normaliseFolderPath(value).toLowerCase();
}

export function samePath(a: string, b: string): boolean {
	return pathKey(a) === pathKey(b);
}

/** The parent folder of a file or folder path; empty for the vault root. */
export function parentFolder(path: string): string {
	const index = path.lastIndexOf("/");
	return index === -1 ? "" : path.slice(0, index);
}

export function joinPath(folder: string, name: string): string {
	return folder === "" ? name : `${folder}/${name}`;
}

export function baseName(path: string): string {
	const index = path.lastIndexOf("/");
	return index === -1 ? path : path.slice(index + 1);
}

/** True when `path` is `folder` itself or sits anywhere beneath it. */
export function isSameOrInside(path: string, folder: string): boolean {
	const pathLower = pathKey(path);
	const folderLower = pathKey(folder);
	if (folderLower === "") {
		return false;
	}
	return pathLower === folderLower || pathLower.startsWith(`${folderLower}/`);
}

/** True when `path` sits inside any of the excluded folders (or the data folder). */
export function isExcluded(
	path: string,
	excludeFolders: readonly string[],
	dataFolderName: string,
): boolean {
	const all = [...excludeFolders, dataFolderName];
	return all.some((folder) => isSameOrInside(path, folder));
}

/**
 * Replaces the `oldPrefix` folder at the start of `path` with `newPrefix`.
 * Returns null when `path` is not the old folder or inside it.
 */
export function replacePrefix(path: string, oldPrefix: string, newPrefix: string): string | null {
	const normalised = normaliseFolderPath(path);
	const oldNormalised = normaliseFolderPath(oldPrefix);
	if (oldNormalised === "" || !isSameOrInside(normalised, oldNormalised)) {
		return null;
	}
	const remainder = normalised.slice(oldNormalised.length);
	return normaliseFolderPath(newPrefix) + remainder;
}

/** Every ancestor of a folder path, shallowest first, including the path itself. */
export function folderLevels(path: string): string[] {
	const segments = normaliseFolderPath(path).split("/").filter((s) => s !== "");
	const levels: string[] = [];
	for (let i = 1; i <= segments.length; i++) {
		levels.push(segments.slice(0, i).join("/"));
	}
	return levels;
}
