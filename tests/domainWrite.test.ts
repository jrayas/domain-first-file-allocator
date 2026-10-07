import { describe, expect, it } from "vitest";
import { needsDomainWrite } from "../src/core/domainValue";

describe("needsDomainWrite", () => {
	it("never rewrites a value that is already exact", () => {
		expect(needsDomainWrite("Areas/Finance", "Areas/Finance", true)).toBe(false);
		expect(needsDomainWrite("Areas/Finance", "Areas/Finance", false)).toBe(false);
	});
	it("fixes the casing when writing the real casing is on", () => {
		expect(needsDomainWrite("areas/finance", "Areas/Finance", true)).toBe(true);
		expect(needsDomainWrite("Areas\\Finance\\", "Areas/Finance", true)).toBe(true);
	});
	it("leaves the user's own text when it names the same folder and the casing option is off", () => {
		expect(needsDomainWrite("areas/finance", "Areas/Finance", false)).toBe(false);
		expect(needsDomainWrite(" /Areas/Finance/ ", "Areas/Finance", false)).toBe(false);
	});
	it("still writes when the value names a different folder", () => {
		expect(needsDomainWrite("Areas/Health", "Areas/Finance", false)).toBe(true);
	});
	it("always writes a list, a number or an absent value", () => {
		expect(needsDomainWrite(["Areas/Finance", "Areas/Health"], "Areas/Finance", false)).toBe(true);
		expect(needsDomainWrite(["Areas/Finance"], "Areas/Finance", false)).toBe(true);
		expect(needsDomainWrite(2026, "2026", false)).toBe(true);
		expect(needsDomainWrite(undefined, "Areas/Finance", false)).toBe(true);
	});
});
