import { describe, expect, it } from "vitest";
import { createDefaultSettings } from "../src/core/defaults";
import { parseConfigJson, serialiseConfig } from "../src/core/jsonSchema";
import { configsEqual } from "../src/core/merge";
import {
	NEW_NOTE_SETTLE_MS,
	hasProperty,
	hasPropertyIgnoringCase,
	shouldAddProperty,
} from "../src/core/newNote";

describe("shouldAddProperty", () => {
	it("adds the property to a note with no frontmatter or an empty one", () => {
		expect(shouldAddProperty(undefined, "domain")).toBe(true);
		expect(shouldAddProperty({}, "domain")).toBe(true);
	});
	it("adds it when the note only has other properties", () => {
		expect(shouldAddProperty({ tags: ["a"], created: "2026-10-10" }, "domain")).toBe(true);
	});
	it("leaves a template's property alone, whatever its value", () => {
		for (const value of [null, "", "Areas/Finance", ["A", "B"], 0, false]) {
			expect(shouldAddProperty({ domain: value }, "domain")).toBe(false);
		}
	});
	it("respects a template that spells the property differently", () => {
		expect(shouldAddProperty({ Domain: "" }, "domain")).toBe(false);
		expect(shouldAddProperty({ DOMAIN: null }, "domain")).toBe(false);
	});
	it("uses the configured property name", () => {
		expect(shouldAddProperty({ domain: "X" }, "area")).toBe(true);
		expect(shouldAddProperty({ area: "" }, "area")).toBe(false);
	});
});

describe("hasProperty", () => {
	it("counts an empty or null value as present, because the key is there", () => {
		expect(hasProperty({ domain: null }, "domain")).toBe(true);
		expect(hasProperty({ domain: "" }, "domain")).toBe(true);
	});
	it("is exact about the name and about absence", () => {
		expect(hasProperty({ Domain: "" }, "domain")).toBe(false);
		expect(hasProperty({}, "domain")).toBe(false);
		expect(hasProperty(undefined, "domain")).toBe(false);
	});
	it("is not fooled by inherited object keys", () => {
		expect(hasProperty({}, "toString")).toBe(false);
	});
});

describe("hasPropertyIgnoringCase", () => {
	it("matches any capitalisation", () => {
		expect(hasPropertyIgnoringCase({ DoMaIn: "" }, "domain")).toBe(true);
		expect(hasPropertyIgnoringCase({ other: "" }, "domain")).toBe(false);
	});
});

describe("new note timing", () => {
	it("waits long enough for a template to run", () => {
		expect(NEW_NOTE_SETTLE_MS).toBeGreaterThanOrEqual(1000);
	});
});

describe("the add-property setting", () => {
	it("is off by default", () => {
		expect(createDefaultSettings().addPropertyToNewNotes).toBe(false);
	});
	it("round-trips through the settings file", () => {
		const settings = createDefaultSettings(new Date("2026-10-07T12:00:00.000Z"));
		settings.addPropertyToNewNotes = true;
		const parsed = parseConfigJson(serialiseConfig(settings));
		expect(parsed.ok && parsed.config.addPropertyToNewNotes).toBe(true);
	});
	it("loads from a file written before it existed, as off", () => {
		const file = {
			version: 1,
			updatedAt: "2026-10-07T12:00:00.000Z",
			propertyName: "domain",
			fallback: { enabled: true, folder: "Inbox" },
			excludeFolders: [],
			folderMovePrompt: "ask",
			domains: [],
		};
		const parsed = parseConfigJson(JSON.stringify(file));
		expect(parsed.ok && parsed.config.addPropertyToNewNotes).toBe(false);
	});
	it("rejects a value that is not true or false", () => {
		const file = {
			version: 1,
			updatedAt: "2026-10-07T12:00:00.000Z",
			propertyName: "domain",
			fallback: { enabled: true, folder: "Inbox" },
			excludeFolders: [],
			folderMovePrompt: "ask",
			addPropertyToNewNotes: "yes",
			domains: [],
		};
		expect(parseConfigJson(JSON.stringify(file)).ok).toBe(false);
	});
	it("counts as a difference when syncing", () => {
		const a = createDefaultSettings();
		const b = { ...a, addPropertyToNewNotes: true };
		expect(configsEqual(a, b)).toBe(false);
	});
});
