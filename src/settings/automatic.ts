import type { SettingDefinitionPage } from "obsidian";
import { MAX_AUTO_DELAY_SECONDS, formatDelay, sliderToDelay } from "../core/preferences";
import { customSetting, noteSetting, sliderSetting, toggleSetting, type TabContext } from "./helpers";

/**
 * Descriptions here are kept to a sentence. The full explanation lives in the
 * README, so the screen stays easy to scan, especially on a phone.
 */
export function automaticPage(ctx: TabContext): SettingDefinitionPage {
	const { plugin } = ctx;

	return {
		type: "page",
		name: "Automatic filing",
		desc: "File notes shortly after you change their domain.",
		displayValue: () => (plugin.settings.automatic.enabled ? "On" : "Off"),
		items: [
			{
				type: "group",
				heading: "Automatic filing",
				items: [
					noteSetting(
						"About automatic filing",
						"Files a note shortly after you change its domain. Only registered, enabled domains are used, and nothing is ever replaced.",
					),
					toggleSetting(
						"File notes automatically",
						"Moves can be undone with Undo last allocation. The ribbon icon switches this on and off.",
						"automatic.enabled",
					),
					// The first stop is 500 ms, then 1 to 60 whole seconds, so the label shows the real time.
					sliderSetting(
						"Delay",
						"How long to wait after the last change. Very short delays can file a note while you are still typing.",
						"automatic.delay",
						{ min: 0, max: MAX_AUTO_DELAY_SECONDS },
						(position) => formatDelay(sliderToDelay(position)),
					),
				],
			},
			{
				type: "group",
				heading: "What to file",
				items: [
					toggleSetting(
						"Also file notes with no domain",
						"Send them to the fallback folder once you switch away from the note.",
						"automatic.includeNoDomain",
					),
					toggleSetting(
						"Only file notes in the fallback folder",
						"Never move notes from anywhere else.",
						"automatic.onlyInFallback",
					),
					noteSetting(
						"Keeping one domain out",
						"To keep one domain out of automatic filing, set it to Manual only on the Domains page.",
					),
				],
			},
			{
				type: "group",
				heading: "While you work",
				items: [
					toggleSetting(
						"Never move the open note",
						"Hold every move until you switch away. Notes with no domain always wait.",
						"automatic.skipOpenNote",
					),
					toggleSetting(
						"Quiet moves",
						"No notice when a note is filed. Skips and errors still show.",
						"automatic.quiet",
					),
				],
			},
			{
				type: "group",
				heading: "Snooze",
				items: [snoozeRow(ctx)],
			},
		],
	};
}

function snoozeRow(ctx: TabContext) {
	const { plugin } = ctx;
	const automatic = plugin.settings.automatic;
	const minutesLeft = plugin.snoozeMinutesLeft();
	const desc = !automatic.enabled
		? "Automatic filing is off."
		: minutesLeft > 0
			? `Paused for about ${minutesLeft} more ${minutesLeft === 1 ? "minute" : "minutes"}.`
			: "Changes made while paused are not filed afterwards.";

	return customSetting("Pause automatic filing", desc, (setting) => {
		if (automatic.enabled && minutesLeft === 0) {
			setting
				.addButton((button) =>
					button.setButtonText("Snooze 15 minutes").onClick(() => {
						plugin.snoozeFor(15);
						ctx.redraw();
					}),
				)
				.addButton((button) =>
					button.setButtonText("Snooze 1 hour").onClick(() => {
						plugin.snoozeFor(60);
						ctx.redraw();
					}),
				);
		}
		if (automatic.enabled && minutesLeft > 0) {
			setting.addButton((button) =>
				button
					.setButtonText("Resume now")
					.setCta()
					.onClick(() => {
						plugin.resumeNow(true);
						ctx.redraw();
					}),
			);
		}
	});
}
