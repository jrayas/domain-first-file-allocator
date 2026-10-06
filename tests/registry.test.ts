import { describe, expect, it } from "vitest";
import {
	addDomain,
	applyRenameToRegistry,
	canonicalDomain,
	deduplicateRegistry,
	findDomain,
	lookupDomain,
	registryAffectedByRename,
	removeDomain,
	rewriteDomainValue,
	rewriteRawDomainProperty,
} from "../src/core/registry";
import type { DomainEntry } from "../src/types";

const registry: DomainEntry[] = [
	{ folder: "Areas/Finance", enabled: true },
	{ folder: "Areas/Finance/2026", enabled: true },
	{ folder: "Areas/Health", enabled: false },
];

describe("lookup", () => {
	it("finds entries ignoring case, slashes and backslashes", () => {
		expect(findDomain(registry, " /areas\\FINANCE/ ")?.folder).toBe("Areas/Finance");
	});
	it("treats same-named folders in different places as different domains", () => {
		const entries = [{ folder: "A/Notes", enabled: true }];
		expect(findDomain(entries, "B/Notes")).toBeUndefined();
	});
	it("reports enabled, disabled and unknown", () => {
		expect(lookupDomain(registry, "Areas/Finance").status).toBe("enabled");
		expect(lookupDomain(registry, "areas/health").status).toBe("disabled");
		expect(lookupDomain(registry, "Areas/Nope").status).toBe("unknown");
		expect(lookupDomain(registry, "   ").status).toBe("unknown");
	});
});

describe("addDomain and removeDomain", () => {
	it("adds a normalised entry", () => {
		const result = addDomain(registry, "/Projects\\Alpha/");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.entry).toEqual({ folder: "Projects/Alpha", enabled: true });
			expect(result.registry).toHaveLength(4);
		}
	});
	it("rejects duplicates regardless of case", () => {
		const result = addDomain(registry, "AREAS/finance");
		expect(result.ok).toBe(false);
	});
	it("rejects the vault root", () => {
		expect(addDomain(registry, "/").ok).toBe(false);
	});
	it("allows overlapping nested domains", () => {
		expect(addDomain(registry, "Areas/Finance/2027").ok).toBe(true);
	});
	it("does not mutate the original", () => {
		addDomain(registry, "New");
		expect(registry).toHaveLength(3);
	});
	it("removes by folder", () => {
		expect(removeDomain(registry, "areas/health").map((e) => e.folder)).not.toContain("Areas/Health");
	});
});

describe("deduplicateRegistry", () => {
	it("keeps the first spelling and reports duplicates", () => {
		const result = deduplicateRegistry([
			{ folder: "Areas/Finance", enabled: true },
			{ folder: "areas/finance/", enabled: false },
			{ folder: "", enabled: true },
		]);
		expect(result.registry).toEqual([{ folder: "Areas/Finance", enabled: true }]);
		expect(result.duplicates).toEqual(["areas/finance"]);
	});
});

describe("rename cascade", () => {
	it("detects affected registries", () => {
		expect(registryAffectedByRename(registry, "Areas")).toBe(true);
		expect(registryAffectedByRename(registry, "Areas/Finance")).toBe(true);
		expect(registryAffectedByRename(registry, "Projects")).toBe(false);
	});
	it("updates the renamed folder and its nested domains", () => {
		const result = applyRenameToRegistry(registry, "Areas/Finance", "Money");
		expect(result.map((e) => e.folder)).toEqual(["Money", "Money/2026", "Areas/Health"]);
		expect(result[2]?.enabled).toBe(false);
	});
	it("handles a move of a parent folder", () => {
		const result = applyRenameToRegistry(registry, "Areas", "Archive/Areas");
		expect(result.map((e) => e.folder)).toEqual([
			"Archive/Areas/Finance",
			"Archive/Areas/Finance/2026",
			"Archive/Areas/Health",
		]);
	});
	it("rewrites note values only when they match", () => {
		expect(rewriteDomainValue("Areas/Finance", "Areas/Finance", "Money")).toBe("Money");
		expect(rewriteDomainValue("Areas/Finance/2026", "Areas/Finance", "Money")).toBe("Money/2026");
		expect(rewriteDomainValue("Areas/Health", "Areas/Finance", "Money")).toBeNull();
	});
});

describe("canonicalDomain", () => {
	it("returns the registered casing", () => {
		expect(canonicalDomain(registry, "areas/FINANCE")).toBe("Areas/Finance");
	});
	it("returns the normalised value when unregistered", () => {
		expect(canonicalDomain(registry, " /Other\\Place/ ")).toBe("Other/Place");
	});
});

describe("rewriteRawDomainProperty", () => {
	it("rewrites a matching string", () => {
		expect(rewriteRawDomainProperty("Areas/Finance/2026", "Areas/Finance", "Money")).toEqual({
			changed: true,
			value: "Money/2026",
		});
	});
	it("leaves a non-matching string alone", () => {
		expect(rewriteRawDomainProperty("Areas/Health", "Areas/Finance", "Money")).toEqual({
			changed: false,
			value: "Areas/Health",
		});
	});
	it("rewrites matching items in a list and keeps the rest", () => {
		expect(rewriteRawDomainProperty(["Areas/Finance", "Areas/Health", 3], "Areas/Finance", "Money")).toEqual({
			changed: true,
			value: ["Money", "Areas/Health", 3],
		});
	});
	it("reports no change for lists with no match and for other types", () => {
		expect(rewriteRawDomainProperty(["X"], "Areas", "Y").changed).toBe(false);
		expect(rewriteRawDomainProperty(42, "Areas", "Y").changed).toBe(false);
		expect(rewriteRawDomainProperty(undefined, "Areas", "Y").changed).toBe(false);
	});
});
