import { describe, expect, it } from "vitest";
import { BINDING_KEYS, getBinding, isBindingKey, setBinding } from "../src/core/bindings";
import { createDefaultSettings } from "../src/core/defaults";

const NOW = new Date("2026-10-14T12:00:00.000Z");
const fresh = () => createDefaultSettings(NOW);

describe("bindings", () => {
	it("knows every key and gives each a value from the default settings", () => {
		const settings = fresh();
		expect(BINDING_KEYS.length).toBeGreaterThan(20);
		for (const key of BINDING_KEYS) {
			expect(isBindingKey(key)).toBe(true);
			expect(getBinding(settings, key), key).not.toBeUndefined();
		}
	});

	it("refuses an unknown key without changing anything", () => {
		const settings = fresh();
		const before = JSON.stringify(settings);
		expect(isBindingKey("nothing")).toBe(false);
		expect(getBinding(settings, "nothing")).toBeUndefined();
		expect(setBinding(settings, "nothing", true)).toBe(false);
		expect(JSON.stringify(settings)).toBe(before);
	});

	it("reads back whatever a valid write stored, for every kind of control", () => {
		const settings = fresh();
		const writes: [string, unknown][] = [
			["writeCanonicalCasing", false],
			["addPropertyToNewNotes", true],
			["fallback.enabled", false],
			["automatic.enabled", false],
			["automatic.includeNoDomain", false],
			["automatic.onlyInFallback", true],
			["automatic.skipOpenNote", true],
			["automatic.quiet", true],
			["notices", "errors"],
			["prompts.unknownDomain", "fallback"],
			["prompts.multipleValues", "first"],
			["prompts.registerFolder", "auto"],
			["prompts.createFolder", "auto"],
			["prompts.renamePreview", "auto"],
			["prompts.nameClash", "keep-both"],
			["folderMovePrompt", "never"],
			["conflictPolicy", "ask"],
			["propertyName", "area"],
			["optOutProperty", "ignore-me"],
			["fallback.folder", "Unsorted"],
			["dataFolderName", ".mydata"],
		];
		for (const [key, value] of writes) {
			expect(setBinding(settings, key, value), key).toBe(true);
			expect(getBinding(settings, key), key).toBe(value);
		}
		expect(settings.automatic.quiet).toBe(true);
		expect(settings.prompts.nameClash).toBe("keep-both");
	});

	describe("booleans", () => {
		it("accept only true or false", () => {
			const settings = fresh();
			expect(setBinding(settings, "automatic.quiet", "true")).toBe(false);
			expect(setBinding(settings, "automatic.quiet", 1)).toBe(false);
			expect(setBinding(settings, "automatic.quiet", undefined)).toBe(false);
			expect(settings.automatic.quiet).toBe(false);
		});
	});

	describe("text", () => {
		it("trims names and refuses an empty one", () => {
			const settings = fresh();
			expect(setBinding(settings, "propertyName", "  topic  ")).toBe(true);
			expect(settings.propertyName).toBe("topic");
			expect(setBinding(settings, "propertyName", "   ")).toBe(false);
			expect(setBinding(settings, "propertyName", "")).toBe(false);
			expect(setBinding(settings, "optOutProperty", "")).toBe(false);
			expect(settings.propertyName).toBe("topic");
			expect(settings.optOutProperty).toBe("skip-allocator");
		});

		it("refuses text that is not text", () => {
			const settings = fresh();
			expect(setBinding(settings, "propertyName", 5)).toBe(false);
			expect(setBinding(settings, "propertyName", null)).toBe(false);
		});

		it("cleans folder paths the way the rest of the plugin does", () => {
			const settings = fresh();
			expect(setBinding(settings, "fallback.folder", "\\Reading//Queue/")).toBe(true);
			expect(settings.fallback.folder).toBe("Reading/Queue");
			expect(setBinding(settings, "dataFolderName", " ./.data/ ")).toBe(true);
			expect(settings.dataFolderName).toBe(".data");
		});

		it("refuses a folder that is the vault root or leaves the vault", () => {
			const settings = fresh();
			const fallback = settings.fallback.folder;
			expect(setBinding(settings, "fallback.folder", "/")).toBe(false);
			expect(setBinding(settings, "fallback.folder", "../outside")).toBe(false);
			expect(setBinding(settings, "dataFolderName", "")).toBe(false);
			expect(settings.fallback.folder).toBe(fallback);
		});
	});

	describe("choices", () => {
		it("refuse a value that is not one of the options", () => {
			const settings = fresh();
			expect(setBinding(settings, "notices", "everything")).toBe(false);
			expect(setBinding(settings, "prompts.nameClash", "replace")).toBe(false);
			expect(setBinding(settings, "conflictPolicy", 5)).toBe(false);
			expect(settings.notices).toBe("all");
			expect(settings.prompts.nameClash).toBe("ask");
			expect(settings.conflictPolicy).toBe("newest");
		});

		it("never accept Replace as a name clash policy", () => {
			const settings = fresh();
			expect(setBinding(settings, "prompts.nameClash", "replace")).toBe(false);
			expect(setBinding(settings, "prompts.nameClash", "overwrite")).toBe(false);
		});
	});

	describe("the automatic filing delay", () => {
		it("shows the slider position, with 500 ms at the first stop", () => {
			const settings = fresh();
			expect(getBinding(settings, "automatic.delay")).toBe(2);
			settings.automatic.delaySeconds = 0.5;
			expect(getBinding(settings, "automatic.delay")).toBe(0);
			settings.automatic.delaySeconds = 60;
			expect(getBinding(settings, "automatic.delay")).toBe(60);
		});

		it("turns a slider position into a delay", () => {
			const settings = fresh();
			expect(setBinding(settings, "automatic.delay", 0)).toBe(true);
			expect(settings.automatic.delaySeconds).toBe(0.5);
			expect(setBinding(settings, "automatic.delay", 1)).toBe(true);
			expect(settings.automatic.delaySeconds).toBe(1);
			expect(setBinding(settings, "automatic.delay", 45)).toBe(true);
			expect(settings.automatic.delaySeconds).toBe(45);
		});

		it("refuses positions the slider cannot produce", () => {
			const settings = fresh();
			for (const bad of [-1, 61, Number.NaN, Number.POSITIVE_INFINITY, "5", null]) {
				expect(setBinding(settings, "automatic.delay", bad), String(bad)).toBe(false);
			}
			expect(settings.automatic.delaySeconds).toBe(2);
		});
	});

	describe("the rename preview threshold", () => {
		it("accepts whole numbers from 1 to 50", () => {
			const settings = fresh();
			expect(setBinding(settings, "prompts.previewThreshold", 1)).toBe(true);
			expect(setBinding(settings, "prompts.previewThreshold", 50)).toBe(true);
			expect(settings.prompts.previewThreshold).toBe(50);
			expect(setBinding(settings, "prompts.previewThreshold", 7.4)).toBe(true);
			expect(settings.prompts.previewThreshold).toBe(7);
		});

		it("refuses numbers out of range and values that are not numbers", () => {
			const settings = fresh();
			for (const bad of [0, 51, -3, Number.NaN, "10", undefined]) {
				expect(setBinding(settings, "prompts.previewThreshold", bad), String(bad)).toBe(false);
			}
			expect(settings.prompts.previewThreshold).toBe(1);
		});
	});

	describe("undo depth", () => {
		it("is shown as text because a dropdown holds text", () => {
			const settings = fresh();
			expect(getBinding(settings, "undoDepth")).toBe("1");
			settings.undoDepth = 10;
			expect(getBinding(settings, "undoDepth")).toBe("10");
		});

		it("is stored as the number", () => {
			const settings = fresh();
			expect(setBinding(settings, "undoDepth", "5")).toBe(true);
			expect(settings.undoDepth).toBe(5);
			expect(setBinding(settings, "undoDepth", "10")).toBe(true);
			expect(settings.undoDepth).toBe(10);
		});

		it("refuses depths that are not offered", () => {
			const settings = fresh();
			for (const bad of ["3", "0", "", 5, null]) {
				expect(setBinding(settings, "undoDepth", bad), String(bad)).toBe(false);
			}
			expect(settings.undoDepth).toBe(1);
		});
	});

	describe("the popup preset", () => {
		it("names the mix of choices that matches", () => {
			const settings = fresh();
			// A new install updates a hand-moved note without asking, which no preset does.
			expect(getBinding(settings, "prompts.preset")).toBe("custom");
			expect(setBinding(settings, "prompts.preset", "cautious")).toBe(true);
			expect(getBinding(settings, "prompts.preset")).toBe("cautious");
			setBinding(settings, "prompts.nameClash", "skip");
			expect(getBinding(settings, "prompts.preset")).toBe("custom");
		});

		it("sets the whole mix, and keeps the preview threshold", () => {
			const settings = fresh();
			setBinding(settings, "prompts.previewThreshold", 12);
			expect(setBinding(settings, "prompts.preset", "hands-off")).toBe(true);
			expect(settings.prompts.nameClash).toBe("keep-both");
			expect(settings.prompts.unknownDomain).toBe("fallback");
			expect(settings.folderMovePrompt).toBe("always");
			expect(settings.prompts.previewThreshold).toBe(12);
			expect(getBinding(settings, "prompts.preset")).toBe("hands-off");
		});

		it("cannot apply Custom, which only describes a mix", () => {
			const settings = fresh();
			setBinding(settings, "prompts.nameClash", "skip");
			expect(setBinding(settings, "prompts.preset", "custom")).toBe(false);
			expect(setBinding(settings, "prompts.preset", "reckless")).toBe(false);
			expect(settings.prompts.nameClash).toBe("skip");
		});
	});

	it("leaves the domain list and everything else alone when one control changes", () => {
		const settings = fresh();
		settings.domains = [{ folder: "Work/Projects", enabled: true }];
		const domains = settings.domains;
		setBinding(settings, "notices", "errors");
		expect(settings.domains).toBe(domains);
		expect(settings.domains).toEqual([{ folder: "Work/Projects", enabled: true }]);
	});
});
