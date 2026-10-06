import { describe, expect, it } from "vitest";
import { createDefaultPrompts } from "../src/core/preferences";
import { NAMED_PRESETS, applyPreset, detectPreset, type PromptState } from "../src/core/presets";

function state(): PromptState {
	return { prompts: createDefaultPrompts(), folderMovePrompt: "ask" };
}

describe("presets", () => {
	it("the defaults are the cautious preset", () => {
		expect(detectPreset(state())).toBe("cautious");
	});
	it("applying a preset is detected as that preset", () => {
		for (const name of NAMED_PRESETS) {
			expect(detectPreset(applyPreset(name, state()))).toBe(name);
		}
	});
	it("balanced creates folders and registers automatically but still asks about the rest", () => {
		const { prompts, folderMovePrompt } = applyPreset("balanced", state());
		expect(prompts.createFolder).toBe("auto");
		expect(prompts.registerFolder).toBe("auto");
		expect(prompts.unknownDomain).toBe("ask");
		expect(prompts.nameClash).toBe("ask");
		expect(folderMovePrompt).toBe("ask");
	});
	it("hands-off automates everything but never replaces or registers unknown domains", () => {
		const { prompts, folderMovePrompt } = applyPreset("hands-off", state());
		expect(prompts.unknownDomain).toBe("fallback");
		expect(prompts.multipleValues).toBe("first");
		expect(prompts.renamePreview).toBe("auto");
		expect(prompts.nameClash).toBe("keep-both");
		expect(folderMovePrompt).toBe("always");
	});
	it("keeps the preview threshold, which no preset owns", () => {
		const current = state();
		current.prompts.previewThreshold = 12;
		expect(applyPreset("hands-off", current).prompts.previewThreshold).toBe(12);
		expect(detectPreset(applyPreset("hands-off", current))).toBe("hands-off");
	});
	it("changing one choice makes it custom", () => {
		const changed = applyPreset("balanced", state());
		changed.prompts.nameClash = "skip";
		expect(detectPreset(changed)).toBe("custom");
		const moved = applyPreset("cautious", state());
		moved.folderMovePrompt = "never";
		expect(detectPreset(moved)).toBe("custom");
	});
	it("does not mutate its input", () => {
		const current = state();
		applyPreset("hands-off", current);
		expect(current.prompts.unknownDomain).toBe("ask");
	});
});
