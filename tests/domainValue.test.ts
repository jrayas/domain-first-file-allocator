import { describe, expect, it } from "vitest";
import { isTruthyFlag, readDomainValue } from "../src/core/domainValue";

describe("readDomainValue", () => {
	it("treats absent, null, blank and empty lists as missing", () => {
		for (const raw of [undefined, null, "", "   ", [], [""], [null, " "]]) {
			expect(readDomainValue(raw).kind).toBe("missing");
		}
	});
	it("normalises a single string", () => {
		expect(readDomainValue("  /Areas\\Finance/ ")).toEqual({ kind: "single", value: "Areas/Finance" });
	});
	it("coerces numbers and booleans to text", () => {
		expect(readDomainValue(2026)).toEqual({ kind: "single", value: "2026" });
		expect(readDomainValue(true)).toEqual({ kind: "single", value: "true" });
	});
	it("rejects values that point at the root or climb out of the vault", () => {
		expect(readDomainValue("/").kind).toBe("invalid");
		expect(readDomainValue("../Secrets").kind).toBe("invalid");
	});
	it("rejects objects and nested lists", () => {
		expect(readDomainValue({ a: 1 }).kind).toBe("invalid");
		expect(readDomainValue([["A"]]).kind).toBe("invalid");
		expect(readDomainValue(["A", { b: 1 }]).kind).toBe("invalid");
	});
	it("collapses a one-item list to a single value", () => {
		expect(readDomainValue(["Areas/Finance"])).toEqual({ kind: "single", value: "Areas/Finance" });
	});
	it("de-duplicates lists case-insensitively and keeps order", () => {
		expect(readDomainValue(["A/B", "a/b/", "C", ""])).toEqual({ kind: "multiple", values: ["A/B", "C"] });
	});
	it("collapses a list that is a single value once de-duplicated", () => {
		expect(readDomainValue(["A", "a"])).toEqual({ kind: "single", value: "A" });
	});
	it("flags an unusable item in a list", () => {
		expect(readDomainValue(["A", ".."]).kind).toBe("invalid");
	});
});

describe("isTruthyFlag", () => {
	it("accepts true and the text true", () => {
		expect(isTruthyFlag(true)).toBe(true);
		expect(isTruthyFlag(" TRUE ")).toBe(true);
	});
	it("rejects everything else", () => {
		for (const raw of [false, "false", "yes", 1, null, undefined, []]) {
			expect(isTruthyFlag(raw)).toBe(false);
		}
	});
});
