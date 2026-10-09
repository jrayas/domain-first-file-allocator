import { Setting, debounce } from "obsidian";
import { MAX_AUTO_DELAY_SECONDS, delayToSlider, formatDelay, sliderToDelay } from "../core/preferences";
import { addHeading, addNote, addToggle, type TabContext } from "./helpers";

/**
 * Descriptions here are kept to a sentence. The full explanation lives in the
 * README, so the screen stays easy to scan, especially on a phone.
 */
export function renderAutomatic(el: HTMLElement, ctx: TabContext): void {
	const { plugin } = ctx;
	const automatic = plugin.settings.automatic;

	addHeading(el, "Automatic filing");
	addNote(el, "Files a note shortly after you change its domain. Only registered, enabled domains are used, and nothing is ever replaced.");

	addToggle(
		el,
		"File notes automatically",
		"Moves can be undone with Undo last allocation. The ribbon icon switches this on and off.",
		automatic.enabled,
		(value) => {
			automatic.enabled = value;
			if (!value) {
				plugin.resumeNow(false);
			}
			ctx.commit();
			ctx.redraw();
		},
	);

	// The first stop is 500 ms, then 1 to 60 whole seconds. The slider's own tooltip would show
	// the position, not the time, so the real value is written beside it. The setting is stacked,
	// with the slider on its own line below the text, so it has room and the text keeps its width.
	const saveDelay = debounce(() => ctx.commit(), 700, true);
	const delaySetting = new Setting(el)
		.setName("Delay")
		.setDesc("How long to wait after the last change. Very short delays can file a note while you are still typing.")
		.setClass("dffa-stacked")
		.addSlider((slider) =>
			slider
				.setLimits(0, MAX_AUTO_DELAY_SECONDS, 1)
				.setValue(delayToSlider(automatic.delaySeconds))
				.onChange((position) => {
					automatic.delaySeconds = sliderToDelay(position);
					delayLabel.setText(formatDelay(automatic.delaySeconds));
					saveDelay();
				}),
		);
	const delayLabel = delaySetting.controlEl.createSpan({
		cls: "dffa-slider-value",
		text: formatDelay(automatic.delaySeconds),
	});

	addHeading(el, "What to file");
	addToggle(
		el,
		"Also file notes with no domain",
		"Send them to the fallback folder once you switch away from the note.",
		automatic.includeNoDomain,
		(value) => {
			automatic.includeNoDomain = value;
			ctx.commit();
		},
	);
	addToggle(
		el,
		"Only file notes in the fallback folder",
		"Never move notes from anywhere else.",
		automatic.onlyInFallback,
		(value) => {
			automatic.onlyInFallback = value;
			ctx.commit();
		},
	);
	addNote(el, "To keep one domain out of automatic filing, set it to Manual only on the Domains tab.");

	addHeading(el, "While you work");
	addToggle(
		el,
		"Never move the open note",
		"Hold every move until you switch away. Notes with no domain always wait.",
		automatic.skipOpenNote,
		(value) => {
			automatic.skipOpenNote = value;
			ctx.commit();
		},
	);
	addToggle(el, "Quiet moves", "No notice when a note is filed. Skips and errors still show.", automatic.quiet, (value) => {
		automatic.quiet = value;
		ctx.commit();
	});

	addHeading(el, "Snooze");
	const minutesLeft = plugin.snoozeMinutesLeft();
	const snooze = new Setting(el)
		.setName("Pause automatic filing")
		.setDesc(
			!automatic.enabled
				? "Automatic filing is off."
				: minutesLeft > 0
					? `Paused for about ${minutesLeft} more ${minutesLeft === 1 ? "minute" : "minutes"}.`
					: "Changes made while paused are not filed afterwards.",
		);
	if (automatic.enabled && minutesLeft === 0) {
		snooze
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
		snooze.addButton((button) =>
			button.setButtonText("Resume now").setCta().onClick(() => {
				plugin.resumeNow(true);
				ctx.redraw();
			}),
		);
	}
}
