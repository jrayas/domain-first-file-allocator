import { describe, expect, it } from "vitest";
import { shouldShowNotice } from "../src/core/notices";

describe("shouldShowNotice", () => {
	it("shows everything at level all", () => {
		expect(shouldShowNotice("all", "info")).toBe(true);
		expect(shouldShowNotice("all", "important")).toBe(true);
		expect(shouldShowNotice("all", "error")).toBe(true);
	});
	it("hides routine confirmations at level important", () => {
		expect(shouldShowNotice("important", "info")).toBe(false);
		expect(shouldShowNotice("important", "important")).toBe(true);
		expect(shouldShowNotice("important", "error")).toBe(true);
	});
	it("shows only errors at level errors", () => {
		expect(shouldShowNotice("errors", "info")).toBe(false);
		expect(shouldShowNotice("errors", "important")).toBe(false);
		expect(shouldShowNotice("errors", "error")).toBe(true);
	});
});
