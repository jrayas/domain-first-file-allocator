import { describe, expect, it } from "vitest";
import { nextFreeName, splitFileName, validateNoteName } from "../src/core/conflicts";

describe("splitFileName", () => {
	it("splits stem and extension", () => {
		expect(splitFileName("Note.md")).toEqual({ stem: "Note", extension: ".md" });
	});
	it("uses the last dot", () => {
		expect(splitFileName("Report v1.2.md")).toEqual({ stem: "Report v1.2", extension: ".md" });
	});
	it("handles names without an extension or with a leading dot", () => {
		expect(splitFileName("Readme")).toEqual({ stem: "Readme", extension: "" });
		expect(splitFileName(".hidden")).toEqual({ stem: ".hidden", extension: "" });
	});
});

describe("nextFreeName", () => {
	it("appends 1 when free", () => {
		expect(nextFreeName("Note.md", () => false)).toBe("Note 1.md");
	});
	it("skips names that are taken", () => {
		const taken = new Set(["Note 1.md", "Note 2.md"]);
		expect(nextFreeName("Note.md", (name) => taken.has(name))).toBe("Note 3.md");
	});
});

describe("validateNoteName", () => {
	const none = () => false;
	it("accepts a normal name", () => {
		expect(validateNoteName("Budget 2026", ".md", none)).toBeNull();
	});
	it("rejects empty and whitespace-only names", () => {
		expect(validateNoteName("", ".md", none)).not.toBeNull();
		expect(validateNoteName("   ", ".md", none)).not.toBeNull();
	});
	it("rejects illegal characters", () => {
		for (const bad of ["a/b", "a\\b", "a:b", "a*b", "a?b", 'a"b', "a<b", "a>b", "a|b", "a#b", "a^b", "a[b", "a]b"]) {
			expect(validateNoteName(bad, ".md", none), bad).not.toBeNull();
		}
	});
	it("rejects leading and trailing full stops", () => {
		expect(validateNoteName(".secret", ".md", none)).not.toBeNull();
		expect(validateNoteName("note.", ".md", none)).not.toBeNull();
	});
	it("rejects over-long names", () => {
		expect(validateNoteName("a".repeat(255), ".md", none)).not.toBeNull();
	});
	it("rejects names already taken, using the trimmed name", () => {
		expect(validateNoteName("  Taken ", ".md", (n) => n === "Taken.md")).not.toBeNull();
	});
});
