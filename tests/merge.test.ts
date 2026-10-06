import { describe, expect, it } from "vitest";
import { configsEqual, decideSync, summariseChanges } from "../src/core/merge";
import type { SyncedConfig } from "../src/types";

function config(overrides: Partial<SyncedConfig> = {}): SyncedConfig {
	return {
		updatedAt: "2026-10-07T12:00:00.000Z",
		propertyName: "domain",
		fallback: { enabled: true, folder: "Inbox" },
		excludeFolders: ["Templates"],
		folderMovePrompt: "ask",
		automatic: { enabled: false, delaySeconds: 2, includeNoDomain: false },
		domains: [{ folder: "Areas/Finance", enabled: true }],
		...overrides,
	};
}

describe("configsEqual", () => {
	it("ignores updatedAt", () => {
		expect(configsEqual(config(), config({ updatedAt: "2027-01-01T00:00:00.000Z" }))).toBe(true);
	});
	it("detects differences in every field", () => {
		expect(configsEqual(config(), config({ propertyName: "area" }))).toBe(false);
		expect(configsEqual(config(), config({ fallback: { enabled: false, folder: "Inbox" } }))).toBe(false);
		expect(configsEqual(config(), config({ fallback: { enabled: true, folder: "Other" } }))).toBe(false);
		expect(configsEqual(config(), config({ folderMovePrompt: "never" }))).toBe(false);
		expect(configsEqual(config(), config({ excludeFolders: [] }))).toBe(false);
		expect(configsEqual(config(), config({ excludeFolders: ["Other"] }))).toBe(false);
		expect(
			configsEqual(config(), config({ automatic: { enabled: true, delaySeconds: 2, includeNoDomain: false } })),
		).toBe(false);
		expect(
			configsEqual(config(), config({ automatic: { enabled: false, delaySeconds: 5, includeNoDomain: false } })),
		).toBe(false);
		expect(
			configsEqual(config(), config({ automatic: { enabled: false, delaySeconds: 2, includeNoDomain: true } })),
		).toBe(false);
		expect(configsEqual(config(), config({ domains: [] }))).toBe(false);
		expect(configsEqual(config(), config({ domains: [{ folder: "Areas/Finance", enabled: false }] }))).toBe(false);
	});
});

describe("decideSync", () => {
	it("creates the file when it is missing", () => {
		expect(decideSync(config(), null)).toBe("create-file");
	});
	it("reports in-sync when contents match, whatever the timestamps", () => {
		expect(decideSync(config(), config({ updatedAt: "2030-01-01T00:00:00.000Z" }))).toBe("in-sync");
	});
	it("uses the file when it is newer and different", () => {
		const file = config({ updatedAt: "2026-10-08T00:00:00.000Z", propertyName: "area" });
		expect(decideSync(config(), file)).toBe("use-file");
	});
	it("uses the settings when they are newer and different", () => {
		const file = config({ updatedAt: "2026-10-06T00:00:00.000Z", propertyName: "area" });
		expect(decideSync(config(), file)).toBe("use-settings");
	});
	it("lets the settings win a tie", () => {
		expect(decideSync(config(), config({ propertyName: "area" }))).toBe("use-settings");
	});
	it("treats unparsable timestamps as the oldest", () => {
		const file = config({ updatedAt: "garbage", propertyName: "area" });
		expect(decideSync(config(), file)).toBe("use-settings");
		const settings = config({ updatedAt: "garbage" });
		expect(decideSync(settings, config({ propertyName: "area" }))).toBe("use-file");
	});
});

describe("summariseChanges", () => {
	it("returns nothing when nothing differs", () => {
		expect(summariseChanges(config(), config())).toEqual([]);
	});
	it("describes scalar changes", () => {
		const lines = summariseChanges(
			config(),
			config({
				propertyName: "area",
				fallback: { enabled: false, folder: "Elsewhere" },
				folderMovePrompt: "always",
			}),
		);
		expect(lines).toHaveLength(4);
		expect(lines.join("\n")).toContain('"domain" becomes "area"');
		expect(lines.join("\n")).toContain("turned off");
	});
	it("describes folder and domain list changes", () => {
		const lines = summariseChanges(
			config({ domains: [{ folder: "A", enabled: true }, { folder: "B", enabled: true }] }),
			config({
				excludeFolders: ["Private"],
				domains: [{ folder: "b", enabled: false }, { folder: "C", enabled: true }],
			}),
		).join("\n");
		expect(lines).toContain("Excluded folders added: Private");
		expect(lines).toContain("Excluded folders removed: Templates");
		expect(lines).toContain("Domains added: C");
		expect(lines).toContain("Domains removed: A");
		expect(lines).toContain("Domains enabled or disabled: b");
	});

	it("describes automatic filing changes", () => {
		const lines = summariseChanges(
			config(),
			config({ automatic: { enabled: true, delaySeconds: 10, includeNoDomain: true } }),
		).join("\n");
		expect(lines).toContain("Automatic filing will be turned on");
		expect(lines).toContain("2 s becomes 10 s");
		expect(lines).toContain("notes with no domain will be turned on");
	});
});
