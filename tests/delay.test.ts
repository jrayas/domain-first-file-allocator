import { describe, expect, it } from "vitest";
import { createDefaultSettings } from "../src/core/defaults";
import { parseConfigJson, serialiseConfig } from "../src/core/jsonSchema";
import {
	clampDelay,
	delayToSlider,
	formatDelay,
	parseAutomatic,
	readAutomatic,
	sliderToDelay,
} from "../src/core/preferences";

describe("the 500 ms delay", () => {
	it("is accepted as 0.5 seconds", () => {
		const { value, errors } = parseAutomatic({ delaySeconds: 0.5 });
		expect(errors).toEqual([]);
		expect(value.delaySeconds).toBe(0.5);
	});
	it("is the shortest delay: 200 ms is rejected by a strict read and raised to 500 ms by a lenient one", () => {
		expect(parseAutomatic({ delaySeconds: 0.2 }).errors).toHaveLength(1);
		expect(readAutomatic({ delaySeconds: 0.2 }).delaySeconds).toBe(0.5);
	});
	it("turns anything between 500 ms and a second into 500 ms, and rounds longer delays to whole seconds", () => {
		expect(clampDelay(0.7)).toBe(0.5);
		expect(clampDelay(1)).toBe(1);
		expect(clampDelay(1.4)).toBe(1);
		expect(clampDelay(2.6)).toBe(3);
		expect(clampDelay(500)).toBe(60);
		expect(clampDelay(Number.NaN)).toBe(2);
	});
	it("survives the settings file", () => {
		const settings = createDefaultSettings(new Date("2026-10-07T12:00:00.000Z"));
		settings.automatic.delaySeconds = 0.5;
		const parsed = parseConfigJson(serialiseConfig(settings));
		expect(parsed.ok && parsed.config.automatic.delaySeconds).toBe(0.5);
	});
	it("is still rejected above the maximum", () => {
		expect(parseAutomatic({ delaySeconds: 61 }).errors).toHaveLength(1);
	});
	it("keeps the default of two seconds", () => {
		expect(parseAutomatic({}).value.delaySeconds).toBe(2);
	});
});

describe("the delay slider", () => {
	it("has 500 ms as its first stop and whole seconds after it", () => {
		expect(sliderToDelay(0)).toBe(0.5);
		expect(sliderToDelay(1)).toBe(1);
		expect(sliderToDelay(2)).toBe(2);
		expect(sliderToDelay(60)).toBe(60);
	});
	it("maps a delay back to its stop", () => {
		expect(delayToSlider(0.5)).toBe(0);
		expect(delayToSlider(1)).toBe(1);
		expect(delayToSlider(10)).toBe(10);
	});
	it("round-trips every stop", () => {
		for (let position = 0; position <= 60; position++) {
			expect(delayToSlider(sliderToDelay(position))).toBe(position);
		}
	});
});

describe("formatDelay", () => {
	it("writes short delays in milliseconds and the rest in seconds", () => {
		expect(formatDelay(0.5)).toBe("500 ms");
		expect(formatDelay(1)).toBe("1 second");
		expect(formatDelay(2)).toBe("2 seconds");
		expect(formatDelay(60)).toBe("60 seconds");
	});
});
