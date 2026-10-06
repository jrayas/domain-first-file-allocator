import { describe, expect, it } from "vitest";
import { createDefaultSettings, sanitiseSettings, settingsFromConfig } from "../src/core/defaults";
import { parseConfigJson, serialiseConfig } from "../src/core/jsonSchema";
import {
	createDefaultAutomatic,
	createDefaultGeneral,
	createDefaultPrompts,
	parseAutomatic,
	parseGeneral,
	parsePrompts,
	readPrompts,
} from "../src/core/preferences";

describe("parsePrompts", () => {
	it("defaults everything to ask", () => {
		const { value, errors } = parsePrompts(undefined);
		expect(errors).toEqual([]);
		expect(value).toEqual(createDefaultPrompts());
		expect(value.unknownDomain).toBe("ask");
		expect(value.nameClash).toBe("ask");
	});
	it("takes valid values and defaults the rest", () => {
		const { value, errors } = parsePrompts({ unknownDomain: "fallback", nameClash: "keep-both" });
		expect(errors).toEqual([]);
		expect(value.unknownDomain).toBe("fallback");
		expect(value.nameClash).toBe("keep-both");
		expect(value.createFolder).toBe("ask");
	});
	it("reports invalid values but still returns a usable result", () => {
		const { value, errors } = parsePrompts({ unknownDomain: "shrug", createFolder: 3, previewThreshold: 500 });
		expect(errors).toHaveLength(3);
		expect(value.unknownDomain).toBe("ask");
		expect(value.createFolder).toBe("ask");
		expect(value.previewThreshold).toBe(50);
	});
	it("rejects Replace as a clash policy, because it is never automatic", () => {
		expect(parsePrompts({ nameClash: "replace" }).errors).toHaveLength(1);
	});
	it("rejects a non-object", () => {
		expect(parsePrompts("ask").errors).toHaveLength(1);
		expect(readPrompts([1])).toEqual(createDefaultPrompts());
	});
});

describe("parseAutomatic", () => {
	it("defaults the safe options", () => {
		const { value } = parseAutomatic({});
		expect(value.onlyInFallback).toBe(false);
		expect(value.skipOpenNote).toBe(true);
		expect(value.quiet).toBe(false);
	});
	it("loads a block written before the newer fields existed", () => {
		const { value, errors } = parseAutomatic({ enabled: true, delaySeconds: 5, includeNoDomain: true });
		expect(errors).toEqual([]);
		expect(value).toEqual({ ...createDefaultAutomatic(), enabled: true, delaySeconds: 5, includeNoDomain: true });
	});
	it("names the block in its errors", () => {
		expect(parseAutomatic({ quiet: "no" }).errors[0]).toContain('"automatic"');
	});
});

describe("parseGeneral", () => {
	it("returns the defaults for an empty source", () => {
		const { value, errors } = parseGeneral({});
		expect(errors).toEqual([]);
		expect(value).toEqual(createDefaultGeneral());
		expect(value.optOutProperty).toBe("skip-allocator");
	});
	it("accepts each valid value", () => {
		const { value, errors } = parseGeneral({
			notices: "errors",
			optOutProperty: "  keep-out ",
			writeCanonicalCasing: false,
			conflictPolicy: "ask",
			undoDepth: 10,
		});
		expect(errors).toEqual([]);
		expect(value).toEqual({
			notices: "errors",
			optOutProperty: "keep-out",
			writeCanonicalCasing: false,
			conflictPolicy: "ask",
			undoDepth: 10,
		});
	});
	it.each([
		["notices", { notices: "loud" }],
		["optOutProperty", { optOutProperty: "  " }],
		["writeCanonicalCasing", { writeCanonicalCasing: "yes" }],
		["conflictPolicy", { conflictPolicy: "random" }],
		["undoDepth", { undoDepth: 3 }],
		["undoDepth type", { undoDepth: "5" }],
	])("reports an invalid %s", (_label, source) => {
		expect(parseGeneral(source).errors).toHaveLength(1);
	});
});

describe("settings round trips", () => {
	const valid = {
		version: 1,
		updatedAt: "2026-10-07T12:00:00.000Z",
		propertyName: "domain",
		fallback: { enabled: true, folder: "Inbox" },
		excludeFolders: ["Templates"],
		folderMovePrompt: "ask",
		domains: [{ folder: "Areas/Finance", enabled: true }],
	};

	it("loads a file that has none of the newer blocks", () => {
		const result = parseConfigJson(JSON.stringify(valid));
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.config.prompts).toEqual(createDefaultPrompts());
			expect(result.config.notices).toBe("all");
			expect(result.config.undoDepth).toBe(1);
			expect(result.config.domains[0]?.allowAuto).toBeUndefined();
		}
	});
	it("rejects a file with a bad newer block, so it is never overwritten", () => {
		expect(parseConfigJson(JSON.stringify({ ...valid, prompts: { nameClash: "replace" } })).ok).toBe(false);
		expect(parseConfigJson(JSON.stringify({ ...valid, notices: "loud" })).ok).toBe(false);
		expect(parseConfigJson(JSON.stringify({ ...valid, undoDepth: 2 })).ok).toBe(false);
	});
	it("rejects a bad allowAuto", () => {
		const bad = { ...valid, domains: [{ folder: "A", enabled: true, allowAuto: "no" }] };
		expect(parseConfigJson(JSON.stringify(bad)).ok).toBe(false);
	});
	it("keeps allowAuto false and writes it only when false", () => {
		const settings = createDefaultSettings(new Date("2026-10-07T12:00:00.000Z"));
		settings.domains = [
			{ folder: "A", enabled: true, allowAuto: false },
			{ folder: "B", enabled: true },
		];
		const text = serialiseConfig(settings);
		expect(text.match(/allowAuto/g)).toHaveLength(1);
		const parsed = parseConfigJson(text);
		expect(parsed.ok && parsed.config.domains).toEqual(settings.domains);
	});
	it("round-trips every new setting", () => {
		const settings = createDefaultSettings(new Date("2026-10-07T12:00:00.000Z"));
		settings.prompts = { ...settings.prompts, unknownDomain: "add", nameClash: "skip", previewThreshold: 5 };
		settings.notices = "important";
		settings.optOutProperty = "no-file";
		settings.writeCanonicalCasing = false;
		settings.conflictPolicy = "file";
		settings.undoDepth = 5;
		settings.automatic = { ...settings.automatic, onlyInFallback: true, skipOpenNote: false, quiet: true };
		const parsed = parseConfigJson(serialiseConfig(settings));
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.config.prompts).toEqual(settings.prompts);
			expect(parsed.config.notices).toBe("important");
			expect(parsed.config.optOutProperty).toBe("no-file");
			expect(parsed.config.writeCanonicalCasing).toBe(false);
			expect(parsed.config.conflictPolicy).toBe("file");
			expect(parsed.config.undoDepth).toBe(5);
			expect(parsed.config.automatic).toEqual(settings.automatic);
		}
	});
	it("sanitiseSettings repairs bad stored values field by field", () => {
		const settings = sanitiseSettings({
			notices: "loud",
			undoDepth: 7,
			prompts: { nameClash: "replace" },
			conflictPolicy: "ask",
		});
		expect(settings.notices).toBe("all");
		expect(settings.undoDepth).toBe(1);
		expect(settings.prompts.nameClash).toBe("ask");
		expect(settings.conflictPolicy).toBe("ask");
	});
	it("settingsFromConfig copies deeply and keeps the local data folder", () => {
		const source = createDefaultSettings();
		source.domains = [{ folder: "A", enabled: true, allowAuto: false }];
		const copy = settingsFromConfig(source, ".alloc");
		expect(copy.dataFolderName).toBe(".alloc");
		expect(copy.domains).toEqual(source.domains);
		expect(copy.domains[0]).not.toBe(source.domains[0]);
		expect(copy.prompts).not.toBe(source.prompts);
	});
});
