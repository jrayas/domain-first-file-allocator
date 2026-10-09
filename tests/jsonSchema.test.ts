import { describe, expect, it } from "vitest";
import { createDefaultSettings, sanitiseSettings } from "../src/core/defaults";
import { clampDelay, createDefaultAutomatic, readAutomatic } from "../src/core/preferences";
import { parseConfigJson, serialiseConfig } from "../src/core/jsonSchema";

const valid = {
	version: 1,
	updatedAt: "2026-10-07T12:00:00.000Z",
	propertyName: "domain",
	fallback: { enabled: true, folder: "Inbox" },
	excludeFolders: ["Templates", ".domain"],
	folderMovePrompt: "ask",
	domains: [{ folder: "Areas/Finance", enabled: true }],
};

function parse(value: unknown) {
	return parseConfigJson(JSON.stringify(value));
}

describe("parseConfigJson", () => {
	it("accepts the documented example", () => {
		const result = parse(valid);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.config.domains).toEqual([{ folder: "Areas/Finance", enabled: true }]);
			expect(result.warnings).toEqual([]);
		}
	});
	it("rejects malformed JSON", () => {
		const result = parseConfigJson("{ nope");
		expect(result.ok).toBe(false);
	});
	it("rejects non-objects", () => {
		expect(parse([1, 2]).ok).toBe(false);
		expect(parse("text").ok).toBe(false);
		expect(parse(null).ok).toBe(false);
	});
	it("rejects unknown versions", () => {
		const result = parse({ ...valid, version: 2 });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("version");
		}
		expect(parse({ ...valid, version: undefined }).ok).toBe(false);
	});
	it.each([
		["updatedAt", { updatedAt: "yesterday" }],
		["propertyName", { propertyName: "" }],
		["fallback shape", { fallback: { enabled: "yes", folder: "Inbox" } }],
		["fallback folder", { fallback: { enabled: true, folder: "/" } }],
		["excludeFolders", { excludeFolders: "Templates" }],
		["excludeFolders items", { excludeFolders: [1] }],
		["folderMovePrompt", { folderMovePrompt: "sometimes" }],
		["automatic type", { automatic: "on" }],
		["automatic enabled", { automatic: { ...createDefaultAutomatic(), enabled: 1, delaySeconds: 2, includeNoDomain: false } }],
		["automatic delay too small", { automatic: { ...createDefaultAutomatic(), enabled: true, delaySeconds: 0.2, includeNoDomain: false } }],
		["automatic delay too large", { automatic: { ...createDefaultAutomatic(), enabled: true, delaySeconds: 61, includeNoDomain: false } }],
		["automatic includeNoDomain", { automatic: { enabled: true, includeNoDomain: "yes" } }],
		["domains", { domains: {} }],
		["domain entry", { domains: [{ folder: "A" }] }],
		["domain entry type", { domains: ["A"] }],
	])("rejects an invalid %s", (_label, patch) => {
		expect(parse({ ...valid, ...patch }).ok).toBe(false);
	});
	it("defaults the optional automatic block when it is absent", () => {
		const result = parse(valid);
		expect(result.ok && result.config.automatic).toEqual(createDefaultAutomatic());
	});
	it("reads a valid automatic block and rounds the delay", () => {
		const result = parse({ ...valid, automatic: { enabled: true, delaySeconds: 3.6, includeNoDomain: true } });
		expect(result.ok && result.config.automatic).toEqual({ ...createDefaultAutomatic(), enabled: true, delaySeconds: 4, includeNoDomain: true });
	});
	it("repairs duplicate domains with a warning", () => {
		const result = parse({
			...valid,
			domains: [
				{ folder: "Areas/Finance", enabled: true },
				{ folder: "areas/finance/", enabled: false },
			],
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.config.domains).toHaveLength(1);
			expect(result.warnings).toHaveLength(1);
		}
	});
	it("normalises excluded folders", () => {
		const result = parse({ ...valid, excludeFolders: ["/Templates/", "Templates", ""] });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.config.excludeFolders).toEqual(["Templates"]);
		}
	});
});

describe("serialiseConfig", () => {
	it("round-trips through the parser", () => {
		const settings = createDefaultSettings(new Date("2026-10-07T12:00:00.000Z"));
		settings.domains = [{ folder: "Areas/Finance", enabled: false }];
		settings.automatic = { ...createDefaultAutomatic(), enabled: true, delaySeconds: 7, includeNoDomain: true };
		const result = parseConfigJson(serialiseConfig(settings));
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.config.version).toBe(1);
			expect(result.config.domains).toEqual(settings.domains);
			expect(result.config.automatic).toEqual(settings.automatic);
			expect(result.config.updatedAt).toBe(settings.updatedAt);
		}
	});
	it("does not write settings-only fields", () => {
		const text = serialiseConfig(createDefaultSettings());
		expect(text).not.toContain("dataFolderName");
		expect(text.endsWith("\n")).toBe(true);
	});
});

describe("sanitiseSettings", () => {
	const now = new Date("2026-10-07T12:00:00.000Z");
	it("returns defaults for missing or invalid data", () => {
		for (const raw of [null, undefined, "x", 5, []]) {
			const settings = sanitiseSettings(raw, now);
			expect(settings.propertyName).toBe("domain");
			expect(settings.fallback).toEqual({ enabled: true, folder: "Inbox" });
			expect(settings.excludeFolders).toEqual(["Templates", ".domain"]);
			expect(settings.dataFolderName).toBe(".domain");
		}
	});
	it("keeps valid values and repairs bad ones individually", () => {
		const settings = sanitiseSettings(
			{
				propertyName: " area ",
				fallback: { enabled: false, folder: 12 },
				excludeFolders: ["/Private/", 3],
				folderMovePrompt: "bogus",
				domains: [{ folder: "A" }, { folder: "A", enabled: false }, 7],
				dataFolderName: "\\.alloc\\",
				updatedAt: "not a date",
			},
			now,
		);
		expect(settings.propertyName).toBe("area");
		expect(settings.fallback).toEqual({ enabled: false, folder: "Inbox" });
		expect(settings.excludeFolders).toEqual(["Private"]);
		expect(settings.folderMovePrompt).toBe("ask");
		expect(settings.domains).toEqual([{ folder: "A", enabled: true }]);
		expect(settings.dataFolderName).toBe(".alloc");
		expect(settings.updatedAt).toBe(now.toISOString());
	});
});

describe("automatic settings helpers", () => {
	it("clamps and rounds the delay", () => {
		expect(clampDelay(0)).toBe(0.5);
		expect(clampDelay(500)).toBe(60);
		expect(clampDelay(2.4)).toBe(2);
		expect(clampDelay(Number.NaN)).toBe(2);
	});
	it("reads automatic settings field by field", () => {
		expect(readAutomatic(undefined)).toEqual(createDefaultAutomatic());
		expect(readAutomatic({ enabled: true, delaySeconds: "x", includeNoDomain: 1 })).toEqual({
			...createDefaultAutomatic(),
			enabled: true,
		});
		expect(readAutomatic({ delaySeconds: 99 }).delaySeconds).toBe(60);
	});
});
