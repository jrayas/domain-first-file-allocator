import { Setting, debounce } from "obsidian";
import { MAX_AUTO_DELAY_SECONDS, delayToSlider, formatDelay, sliderToDelay } from "../core/preferences";
import { addHeading, addNote, addToggle, type TabContext } from "./helpers";

export function renderAutomatic(el: HTMLElement, ctx: TabContext): void {
	const { plugin } = ctx;
	const automatic = plugin.settings.automatic;

	addHeading(el, "Automatic filing");
	addNote(
		el,
		"Files a note shortly after you change its domain property. Only registered, enabled domains that allow automatic filing are acted on, and nothing is ever replaced. A name clash leaves the note in place. The lightning-bolt icon in the left ribbon switches this on and off; right-click it to snooze.",
	);

	addToggle(
		el,
		"File notes automatically",
		"Off by default. Moves are recorded, so Undo last allocation can reverse them.",
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

	const saveDelay = debounce(() => ctx.commit(), 700, true);
	// The first stop is 500 ms, then 1 to 60 whole seconds. The slider's own tooltip would show
	// the position, not the time, so the real value is written beside it.
	const delaySetting = new Setting(el)
		.setName("Delay")
		.setDesc(
			"How long to wait after the domain property last changed, so a half-typed value is not acted on. The first stop is 500 ms. A very short delay can file a note while you are still typing a longer domain that starts with a shorter one.",
		)
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

	addHeading(el, "Safety");
	addToggle(
		el,
		"Never move the open note",
		"A note that is open in the editor is left alone, and filed once you switch to another note.",
		automatic.skipOpenNote,
		(value) => {
			automatic.skipOpenNote = value;
			ctx.commit();
		},
	);
	addToggle(
		el,
		"Only file notes in the fallback folder",
		"Automatic filing then acts only on notes that currently sit in the fallback folder, such as an inbox. Notes anywhere else are never moved automatically.",
		automatic.onlyInFallback,
		(value) => {
			automatic.onlyInFallback = value;
			ctx.commit();
		},
	);
	addToggle(
		el,
		"Also file notes with no domain",
		"Send a new note, a note whose domain was removed, and a note you open whose domain property is present but empty, to the fallback folder. A note with no domain property at all is only moved when it is newly created. Turn this off if you create notes in folders where they should stay. Has no effect together with the option above.",
		automatic.includeNoDomain,
		(value) => {
			automatic.includeNoDomain = value;
			ctx.commit();
		},
	);
	addToggle(
		el,
		"Quiet moves",
		"No notice when a note is filed automatically. Skips and errors are still shown.",
		automatic.quiet,
		(value) => {
			automatic.quiet = value;
			ctx.commit();
		},
	);
	addNote(
		el,
		"Each domain can also be kept out of automatic filing: set it to Manual only on the Domains tab.",
	);

	addHeading(el, "Snooze");
	const minutesLeft = plugin.snoozeMinutesLeft();
	const snooze = new Setting(el)
		.setName("Pause automatic filing")
		.setDesc(
			!automatic.enabled
				? "Automatic filing is off."
				: minutesLeft > 0
					? `Paused for about ${minutesLeft} more ${minutesLeft === 1 ? "minute" : "minutes"}. Changes made meanwhile are not filed afterwards.`
					: "Pause for a while, then carry on. Changes made while paused are not filed afterwards.",
		);
	if (automatic.enabled && minutesLeft === 0) {
		snooze
			.addButton((button) =>
				button.setButtonText("15 minutes").onClick(() => {
					plugin.snoozeFor(15);
					ctx.redraw();
				}),
			)
			.addButton((button) =>
				button.setButtonText("1 hour").onClick(() => {
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
