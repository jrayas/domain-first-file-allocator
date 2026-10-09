import { describe, expect, it } from "vitest";
import { decideAutoFile, type AutoContext } from "../src/core/autoDecision";
import { readDomainValue } from "../src/core/domainValue";
import { createDefaultAutomatic } from "../src/core/preferences";

function context(overrides: Partial<AutoContext> = {}, raw: unknown = "Areas/Finance"): AutoContext {
	return {
		read: readDomainValue(raw),
		domains: [
			{ folder: "Areas/Finance", enabled: true },
			{ folder: "Areas/Health", enabled: false },
			{ folder: "Areas/Private", enabled: true, allowAuto: false },
		],
		fallback: { enabled: true, folder: "Inbox" },
		automatic: { ...createDefaultAutomatic(), enabled: true },
		currentFolder: "Inbox",
		isOpenNote: false,
		...overrides,
	};
}

describe("decideAutoFile", () => {
	it("files a note whose domain is registered and enabled", () => {
		expect(decideAutoFile(context())).toEqual({
			action: "file",
			targetFolder: "Areas/Finance",
			domainValue: "Areas/Finance",
		});
	});
	it("uses the registered casing", () => {
		expect(decideAutoFile(context({}, "areas/FINANCE/"))).toMatchObject({ targetFolder: "Areas/Finance" });
	});
	it("leaves unknown, disabled and ambiguous values alone", () => {
		expect(decideAutoFile(context({}, "Nowhere"))).toEqual({ action: "skip", reason: "not-registered" });
		expect(decideAutoFile(context({}, "Areas/Health"))).toEqual({ action: "skip", reason: "disabled" });
		expect(decideAutoFile(context({}, ["Areas/Finance", "Areas/Health"]))).toEqual({
			action: "skip",
			reason: "ambiguous",
		});
		expect(decideAutoFile(context({}, { a: 1 }))).toEqual({ action: "skip", reason: "ambiguous" });
	});
	it("respects a domain blocked from automatic filing", () => {
		expect(decideAutoFile(context({}, "Areas/Private"))).toEqual({ action: "skip", reason: "blocked" });
	});
	it("does nothing when the note is already in the target folder", () => {
		expect(decideAutoFile(context({ currentFolder: "areas/finance" }))).toEqual({
			action: "skip",
			reason: "already-there",
		});
	});

	describe("notes with no domain", () => {
		it("go to the fallback by default", () => {
			expect(decideAutoFile(context({ currentFolder: "Projects" }, null))).toEqual({
				action: "file",
				targetFolder: "Inbox",
			});
		});
		it("treat an empty property the same as a missing one", () => {
			for (const raw of ["", "   ", [], [""]]) {
				expect(decideAutoFile(context({ currentFolder: "Projects" }, raw))).toMatchObject({
					action: "file",
					targetFolder: "Inbox",
				});
			}
		});
		it("do not move when they are already in the fallback", () => {
			expect(decideAutoFile(context({}, null))).toEqual({ action: "skip", reason: "already-there" });
		});
		it("are left alone when the option is off", () => {
			const automatic = { ...createDefaultAutomatic(), enabled: true, includeNoDomain: false };
			expect(decideAutoFile(context({ automatic, currentFolder: "Projects" }, null))).toEqual({
				action: "skip",
				reason: "no-domain",
			});
		});
		it("stay put when the fallback is off", () => {
			const automatic = { ...createDefaultAutomatic(), enabled: true, includeNoDomain: true };
			const result = decideAutoFile(
				context({ automatic, fallback: { enabled: false, folder: "Inbox" }, currentFolder: "Projects" }, ""),
			);
			expect(result).toEqual({ action: "skip", reason: "no-domain" });
		});
	});

	describe("only in the fallback folder", () => {
		const automatic = { ...createDefaultAutomatic(), enabled: true, onlyInFallback: true };
		it("files notes that are in the fallback folder", () => {
			expect(decideAutoFile(context({ automatic, currentFolder: "inbox" }))).toMatchObject({ action: "file" });
		});
		it("leaves notes anywhere else", () => {
			expect(decideAutoFile(context({ automatic, currentFolder: "Projects" }))).toEqual({
				action: "skip",
				reason: "not-in-fallback",
			});
		});
	});

	describe("the open note", () => {
		it("files the open note by default, so typing a domain into a note files it", () => {
			expect(decideAutoFile(context({ isOpenNote: true }))).toMatchObject({ action: "file" });
		});
		it("waits for the note to be closed when asked to skip open notes", () => {
			const automatic = { ...createDefaultAutomatic(), enabled: true, skipOpenNote: true };
			expect(decideAutoFile(context({ automatic, isOpenNote: true }))).toEqual({ action: "wait-for-close" });
		});
		it("is filed when skipping open notes is off", () => {
			const automatic = { ...createDefaultAutomatic(), enabled: true, skipOpenNote: false };
			expect(decideAutoFile(context({ automatic, isOpenNote: true }))).toMatchObject({ action: "file" });
		});
		it("does not wait for a note it would not move anyway", () => {
			const automatic = { ...createDefaultAutomatic(), enabled: true, skipOpenNote: true };
			expect(decideAutoFile(context({ automatic, isOpenNote: true }, "Nowhere"))).toEqual({
				action: "skip",
				reason: "not-registered",
			});
		});
	});
});

describe("a note with no domain while it is open", () => {
	const noDomain = (overrides: Partial<AutoContext> = {}) =>
		context({ currentFolder: "Projects", isOpenNote: true, ...overrides }, null);

	it("waits until the note is left, even when open notes are normally filed", () => {
		expect(decideAutoFile(noDomain())).toEqual({ action: "wait-for-close" });
	});
	it("treats an empty property the same way", () => {
		for (const raw of ["", "  ", [], [""]]) {
			expect(decideAutoFile(context({ currentFolder: "Projects", isOpenNote: true }, raw))).toEqual({
				action: "wait-for-close",
			});
		}
	});
	it("falls to the fallback as soon as it is no longer open", () => {
		expect(decideAutoFile(noDomain({ isOpenNote: false }))).toEqual({ action: "file", targetFolder: "Inbox" });
	});
	it("still waits when the user also asked to skip open notes", () => {
		const automatic = { ...createDefaultAutomatic(), enabled: true, skipOpenNote: true };
		expect(decideAutoFile(noDomain({ automatic }))).toEqual({ action: "wait-for-close" });
	});
	it("does not wait for a note it would leave alone anyway", () => {
		const automatic = { ...createDefaultAutomatic(), enabled: true, includeNoDomain: false };
		expect(decideAutoFile(noDomain({ automatic }))).toEqual({ action: "skip", reason: "no-domain" });
		expect(decideAutoFile(noDomain({ currentFolder: "Inbox" }))).toEqual({ action: "skip", reason: "already-there" });
	});
	it("does not hold back a note whose domain has been typed", () => {
		expect(decideAutoFile(context({ isOpenNote: true }))).toMatchObject({ action: "file" });
	});
});
