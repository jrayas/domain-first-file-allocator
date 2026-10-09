import { describe, expect, it } from "vitest";
import { createDefaultSettings, replaceSettingsInPlace } from "../src/core/defaults";
import { isExcluded, isSameOrInside, nameKey, pathKey, samePath } from "../src/core/paths";
import { deduplicateRegistry, findDomain, lookupDomain, subfoldersToAdd } from "../src/core/registry";

// "é" as one character, and as "e" followed by a combining accent, as macOS file systems often store it.
const composed = "Caf\u00e9";
const decomposed = "Cafe\u0301";

describe("Unicode-safe path comparison", () => {
	it("starts from two spellings that really differ as plain text", () => {
		expect(composed).not.toBe(decomposed);
		expect(composed.normalize("NFC")).toBe(decomposed.normalize("NFC"));
	});
	it("treats composed and decomposed accents as the same folder", () => {
		expect(pathKey(`Areas/${composed}`)).toBe(pathKey(`Areas/${decomposed}`));
		expect(samePath(`Areas/${composed}`, `areas/${decomposed}`)).toBe(true);
		expect(nameKey(composed)).toBe(nameKey(decomposed.toUpperCase()));
	});
	it("finds a registered domain whichever way the accent was typed", () => {
		const registry = [{ folder: `Areas/${decomposed}`, enabled: true }];
		expect(findDomain(registry, `Areas/${composed}`)?.folder).toBe(`Areas/${decomposed}`);
		expect(lookupDomain(registry, `AREAS/${composed}`).status).toBe("enabled");
	});
	it("matches excluded folders and nesting across spellings", () => {
		expect(isExcluded(`${composed}/Note.md`, [decomposed], ".domain")).toBe(true);
		expect(isSameOrInside(`${decomposed}/Sub`, composed)).toBe(true);
	});
	it("treats the two spellings as one duplicate", () => {
		const result = deduplicateRegistry([
			{ folder: composed, enabled: true },
			{ folder: decomposed, enabled: false },
		]);
		expect(result.registry).toHaveLength(1);
		expect(result.duplicates).toHaveLength(1);
	});
	it("does not offer an already registered folder again when adding subfolders", () => {
		const offered = subfoldersToAdd([{ folder: `Areas/${decomposed}`, enabled: true }], [`Areas/${composed}`, "Areas/Other"], {
			parent: "Areas",
			recursive: false,
			excludeFolders: [],
			dataFolderName: ".domain",
		});
		expect(offered).toEqual(["Areas/Other"]);
	});
	it("keeps working for plain non-English and mixed scripts", () => {
		expect(samePath("Проекты/Финансы", "проекты/финансы")).toBe(true);
		expect(samePath("日本語/メモ", "日本語/メモ")).toBe(true);
		expect(samePath("日本語/メモ", "日本語/ノート")).toBe(false);
	});
});

describe("replaceSettingsInPlace", () => {
	it("keeps the same object but gives it the new values", () => {
		const target = createDefaultSettings(new Date("2026-10-07T12:00:00.000Z"));
		const held = target;
		const source = createDefaultSettings(new Date("2026-10-08T12:00:00.000Z"));
		source.propertyName = "area";
		source.automatic.enabled = false;
		source.domains = [{ folder: "A", enabled: true }];
		replaceSettingsInPlace(target, source);
		expect(target).toBe(held);
		expect(held.propertyName).toBe("area");
		expect(held.automatic.enabled).toBe(false);
		expect(held.domains).toEqual([{ folder: "A", enabled: true }]);
		expect(held.updatedAt).toBe(source.updatedAt);
	});
	it("copies every key, so no setting is left stale", () => {
		const target = createDefaultSettings();
		const source = createDefaultSettings();
		source.notices = "errors";
		source.undoDepth = 10;
		source.addPropertyToNewNotes = true;
		source.prompts.nameClash = "skip";
		replaceSettingsInPlace(target, source);
		expect(target).toEqual(source);
	});
});
