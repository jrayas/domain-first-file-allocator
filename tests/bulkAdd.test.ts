import { describe, expect, it } from "vitest";
import {
	applyRenameToRegistry,
	deduplicateRegistry,
	isAutoAllowed,
	subfoldersToAdd,
} from "../src/core/registry";

describe("allowAuto", () => {
	it("is allowed unless explicitly false", () => {
		expect(isAutoAllowed({ folder: "A", enabled: true })).toBe(true);
		expect(isAutoAllowed({ folder: "A", enabled: true, allowAuto: true })).toBe(true);
		expect(isAutoAllowed({ folder: "A", enabled: true, allowAuto: false })).toBe(false);
	});
	it("survives de-duplication and renames", () => {
		const entries = [{ folder: "Areas/A", enabled: true, allowAuto: false }];
		expect(deduplicateRegistry(entries).registry[0]?.allowAuto).toBe(false);
		expect(applyRenameToRegistry(entries, "Areas", "Zones")[0]).toEqual({
			folder: "Zones/A",
			enabled: true,
			allowAuto: false,
		});
	});
});

describe("subfoldersToAdd", () => {
	const folders = [
		"Areas",
		"Areas/Finance",
		"Areas/Finance/2026",
		"Areas/Health",
		"Areas/Templates",
		"Projects",
		"Areas Other",
	];
	const base = {
		parent: "Areas",
		recursive: false,
		excludeFolders: ["Areas/Templates"],
		dataFolderName: ".domain",
	};

	it("offers direct children only, sorted, without the parent or look-alikes", () => {
		expect(subfoldersToAdd([], folders, base)).toEqual(["Areas/Finance", "Areas/Health"]);
	});
	it("offers every level when recursive", () => {
		expect(subfoldersToAdd([], folders, { ...base, recursive: true })).toEqual([
			"Areas/Finance",
			"Areas/Finance/2026",
			"Areas/Health",
		]);
	});
	it("skips folders already registered, ignoring case", () => {
		const registered = [{ folder: "areas/finance", enabled: true }];
		expect(subfoldersToAdd(registered, folders, base)).toEqual(["Areas/Health"]);
	});
	it("skips excluded folders and the data folder", () => {
		const result = subfoldersToAdd([], [...folders, "Areas/.domain"], {
			...base,
			dataFolderName: "Areas/.domain",
		});
		expect(result).not.toContain("Areas/Templates");
		expect(result).not.toContain("Areas/.domain");
	});
	it("returns nothing for the vault root or a missing parent", () => {
		expect(subfoldersToAdd([], folders, { ...base, parent: "" })).toEqual([]);
		expect(subfoldersToAdd([], folders, { ...base, parent: "Nowhere" })).toEqual([]);
	});
	it("de-duplicates repeated paths", () => {
		expect(subfoldersToAdd([], ["A/B", "a/b", "A"], { ...base, parent: "A", excludeFolders: [] })).toEqual(["A/B"]);
	});
});
