import { describe, expect, it } from "vitest";
import {
	baseName,
	folderLevels,
	isExcluded,
	isSameOrInside,
	joinPath,
	normaliseFolderPath,
	parentFolder,
	pathKey,
	replacePrefix,
	samePath,
} from "../src/core/paths";

describe("normaliseFolderPath", () => {
	it("trims whitespace and strips leading and trailing slashes", () => {
		expect(normaliseFolderPath("  /Areas/Finance/  ")).toBe("Areas/Finance");
	});
	it("converts backslashes", () => {
		expect(normaliseFolderPath("Areas\\Finance\\2026")).toBe("Areas/Finance/2026");
	});
	it("collapses repeated slashes and trims segments", () => {
		expect(normaliseFolderPath("Areas// Finance /2026")).toBe("Areas/Finance/2026");
	});
	it("drops dot segments", () => {
		expect(normaliseFolderPath("./Areas/./Finance")).toBe("Areas/Finance");
	});
	it("returns an empty string for unsafe parent traversal", () => {
		expect(normaliseFolderPath("Areas/../Secrets")).toBe("");
	});
	it("returns an empty string for the root", () => {
		expect(normaliseFolderPath("/")).toBe("");
		expect(normaliseFolderPath("   ")).toBe("");
	});
});

describe("comparison", () => {
	it("compares case-insensitively", () => {
		expect(pathKey("Areas/FINANCE")).toBe("areas/finance");
		expect(samePath("areas\\finance", "Areas/Finance/")).toBe(true);
		expect(samePath("Areas/Finance", "Areas/Health")).toBe(false);
	});
});

describe("path pieces", () => {
	it("finds parents", () => {
		expect(parentFolder("Areas/Finance/Note.md")).toBe("Areas/Finance");
		expect(parentFolder("Areas")).toBe("");
		expect(parentFolder("Note.md")).toBe("");
	});
	it("joins and takes base names", () => {
		expect(joinPath("Areas", "Note.md")).toBe("Areas/Note.md");
		expect(joinPath("", "Note.md")).toBe("Note.md");
		expect(baseName("Areas/Finance/Note.md")).toBe("Note.md");
		expect(baseName("Note.md")).toBe("Note.md");
	});
	it("lists folder levels shallowest first", () => {
		expect(folderLevels("A/B/C")).toEqual(["A", "A/B", "A/B/C"]);
		expect(folderLevels("")).toEqual([]);
	});
});

describe("isSameOrInside", () => {
	it("matches the folder itself and descendants", () => {
		expect(isSameOrInside("Templates", "Templates")).toBe(true);
		expect(isSameOrInside("Templates/Daily/Note.md", "Templates")).toBe(true);
	});
	it("does not match siblings with a shared prefix", () => {
		expect(isSameOrInside("Templates2/Note.md", "Templates")).toBe(false);
	});
	it("ignores case", () => {
		expect(isSameOrInside("templates/Note.md", "Templates")).toBe(true);
	});
	it("never matches against an empty folder", () => {
		expect(isSameOrInside("Note.md", "")).toBe(false);
	});
});

describe("isExcluded", () => {
	it("excludes configured folders and the data folder implicitly", () => {
		expect(isExcluded("Templates/A.md", ["Templates"], ".domain")).toBe(true);
		expect(isExcluded(".domain/folder.json", [], ".domain")).toBe(true);
		expect(isExcluded("Areas/A.md", ["Templates"], ".domain")).toBe(false);
	});
	it("honours a renamed data folder", () => {
		expect(isExcluded(".alloc/folder.json", [], ".alloc")).toBe(true);
	});
});

describe("replacePrefix", () => {
	it("replaces the folder itself", () => {
		expect(replacePrefix("Areas/Finance", "Areas/Finance", "Money")).toBe("Money");
	});
	it("replaces descendants, keeping their remainder", () => {
		expect(replacePrefix("Areas/Finance/2026", "Areas/Finance", "Money/Fin")).toBe("Money/Fin/2026");
	});
	it("keeps the remainder's own casing", () => {
		expect(replacePrefix("areas/finance/Tax", "Areas/Finance", "Money")).toBe("Money/Tax");
	});
	it("returns null when unrelated or a shared-prefix sibling", () => {
		expect(replacePrefix("Areas/Health", "Areas/Finance", "Money")).toBeNull();
		expect(replacePrefix("Areas/Finance2", "Areas/Finance", "Money")).toBeNull();
	});
	it("returns null for an empty old prefix", () => {
		expect(replacePrefix("Areas", "", "X")).toBeNull();
	});
});
