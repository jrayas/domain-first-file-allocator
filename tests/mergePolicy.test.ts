import { describe, expect, it } from "vitest";
import { configsEqual, decideSync, summariseChanges } from "../src/core/merge";
import { createDefaultAutomatic, createDefaultGeneral, createDefaultPrompts } from "../src/core/preferences";
import type { SyncedConfig } from "../src/types";

function config(overrides: Partial<SyncedConfig> = {}): SyncedConfig {
	return {
		updatedAt: "2026-10-07T12:00:00.000Z",
		propertyName: "domain",
		fallback: { enabled: true, folder: "Inbox" },
		excludeFolders: ["Templates"],
		folderMovePrompt: "ask",
		automatic: createDefaultAutomatic(),
		prompts: createDefaultPrompts(),
		...createDefaultGeneral(),
		domains: [{ folder: "Areas/Finance", enabled: true }],
		...overrides,
	};
}

describe("decideSync with a conflict policy", () => {
	const newerFile = config({ updatedAt: "2026-10-08T00:00:00.000Z", propertyName: "area" });
	const withPolicy = (policy: SyncedConfig["conflictPolicy"]) => config({ conflictPolicy: policy });

	it("always prefers the settings when told to, even if the file is newer", () => {
		expect(decideSync(withPolicy("settings"), newerFile)).toBe("use-settings");
	});
	it("always prefers the file when told to, even if the settings are newer", () => {
		const olderFile = config({ updatedAt: "2020-01-01T00:00:00.000Z", propertyName: "area" });
		expect(decideSync(withPolicy("file"), olderFile)).toBe("use-file");
	});
	it("asks when the sides differ", () => {
		expect(decideSync(withPolicy("ask"), newerFile)).toBe("conflict");
	});
	it("never asks, or switches side, when the content is the same", () => {
		for (const policy of ["settings", "file", "ask", "newest"] as const) {
			expect(decideSync(withPolicy(policy), config({ conflictPolicy: policy }))).toBe("in-sync");
		}
	});
	it("still creates a missing file whatever the policy", () => {
		expect(decideSync(withPolicy("file"), null)).toBe("create-file");
	});
	it("uses the local policy, not the one stored in the file", () => {
		const file = config({ conflictPolicy: "file", propertyName: "area", updatedAt: "2020-01-01T00:00:00.000Z" });
		expect(decideSync(withPolicy("newest"), file)).toBe("use-settings");
	});
});

describe("configsEqual with the newer fields", () => {
	it("notices a changed prompt, notice level, undo depth or opt-out property", () => {
		expect(configsEqual(config(), config({ prompts: { ...createDefaultPrompts(), nameClash: "skip" } }))).toBe(false);
		expect(configsEqual(config(), config({ notices: "errors" }))).toBe(false);
		expect(configsEqual(config(), config({ undoDepth: 5 }))).toBe(false);
		expect(configsEqual(config(), config({ optOutProperty: "other" }))).toBe(false);
		expect(configsEqual(config(), config({ writeCanonicalCasing: false }))).toBe(false);
	});
	it("treats allowAuto absent and true as the same, and false as different", () => {
		const base = config({ domains: [{ folder: "A", enabled: true }] });
		expect(configsEqual(base, config({ domains: [{ folder: "A", enabled: true, allowAuto: true }] }))).toBe(true);
		expect(configsEqual(base, config({ domains: [{ folder: "A", enabled: true, allowAuto: false }] }))).toBe(false);
	});
	it("is not fooled by key order", () => {
		const reordered = config({ fallback: { folder: "Inbox", enabled: true } });
		expect(configsEqual(config(), reordered)).toBe(true);
	});
});

describe("summariseChanges for the newer fields", () => {
	it("describes prompts, notices and per-domain automatic changes", () => {
		const lines = summariseChanges(
			config({ domains: [{ folder: "A", enabled: true }] }),
			config({
				notices: "errors",
				undoDepth: 10,
				prompts: { ...createDefaultPrompts(), nameClash: "skip" },
				domains: [{ folder: "A", enabled: true, allowAuto: false }],
			}),
		).join("\n");
		expect(lines).toContain("Notices: all becomes errors");
		expect(lines).toContain("Undo depth: 1 becomes 10");
		expect(lines).toContain('Prompt "nameClash": ask becomes skip');
		expect(lines).toContain("allowed or blocked in automatic filing: A");
	});
});
