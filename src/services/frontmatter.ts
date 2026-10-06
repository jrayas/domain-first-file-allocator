import type { App, TFile } from "obsidian";

export type FrontmatterRecord = Record<string, unknown>;

/** Reads a note's frontmatter from Obsidian's metadata cache. */
export function readFrontmatter(app: App, file: TFile): FrontmatterRecord | undefined {
	return app.metadataCache.getFileCache(file)?.frontmatter;
}

/** Sets a property (or removes it when `value` is undefined) using Obsidian's own YAML handling. */
export async function writeProperty(
	app: App,
	file: TFile,
	propertyName: string,
	value: unknown,
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (frontmatter: FrontmatterRecord) => {
		if (value === undefined) {
			delete frontmatter[propertyName];
		} else {
			frontmatter[propertyName] = value;
		}
	});
}
