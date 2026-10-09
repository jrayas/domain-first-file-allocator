import { App, PluginSettingTab, setIcon } from "obsidian";
import type DomainFirstFileAllocatorPlugin from "../main";
import { renderAutomatic } from "./automatic";
import { renderData } from "./data";
import { renderDomains, type DomainViewState } from "./domains";
import { renderGeneral } from "./general";
import type { TabContext } from "./helpers";
import { renderPrompts } from "./prompts";

type TabId = "general" | "domains" | "prompts" | "automatic" | "data";

interface TabInfo {
	id: TabId;
	label: string;
	icon: string;
}

const TABS: readonly TabInfo[] = [
	{ id: "general", label: "General", icon: "settings" },
	{ id: "domains", label: "Domains", icon: "folder-tree" },
	{ id: "prompts", label: "Prompts and confirmations", icon: "message-square" },
	{ id: "automatic", label: "Automatic filing", icon: "zap" },
	{ id: "data", label: "Data and sync", icon: "database" },
];

/**
 * The settings screen. Categories are vertical tabs on a wide screen and a
 * dropdown on a narrow one (phones), so every control stays within reach.
 */
export class AllocatorSettingTab extends PluginSettingTab {
	private active: TabId = "general";
	private isOpen = false;
	private readonly domainView: DomainViewState = { filter: "", sort: "path" };
	private content: HTMLElement | null = null;
	private tabButtons = new Map<TabId, HTMLElement>();
	private tabSelect: HTMLSelectElement | null = null;

	constructor(
		app: App,
		private readonly plugin: DomainFirstFileAllocatorPlugin,
	) {
		super(app, plugin);
	}

	/** Redraws the visible tab after the settings changed underneath it, for example from the data file. */
	refreshIfOpen(): void {
		if (this.isOpen) {
			this.renderContent(true);
		}
	}

	hide(): void {
		this.isOpen = false;
	}

	display(): void {
		this.isOpen = true;
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("dffa-settings");
		this.tabButtons = new Map();

		const layout = containerEl.createDiv({ cls: "dffa-layout" });
		const nav = layout.createDiv({ cls: "dffa-nav" });

		const list = nav.createDiv({
			cls: "dffa-nav-list",
			attr: { role: "tablist", "aria-orientation": "vertical", "aria-label": "Settings categories" },
		});
		for (const tab of TABS) {
			const button = list.createEl("button", {
				cls: "dffa-nav-item",
				attr: { role: "tab", type: "button" },
			});
			setIcon(button.createSpan({ cls: "dffa-nav-icon" }), tab.icon);
			button.createSpan({ text: tab.label });
			button.addEventListener("click", () => this.selectTab(tab.id));
			this.tabButtons.set(tab.id, button);
		}

		const select = nav.createEl("select", {
			cls: "dropdown dffa-nav-select",
			attr: { "aria-label": "Settings category" },
		});
		for (const tab of TABS) {
			select.createEl("option", { value: tab.id, text: tab.label });
		}
		select.addEventListener("change", () => {
			const chosen = TABS.find((tab) => tab.id === select.value);
			if (chosen) {
				this.selectTab(chosen.id);
			}
		});
		this.tabSelect = select;

		this.content = layout.createDiv({ cls: "dffa-content", attr: { role: "tabpanel" } });
		this.markActive();
		this.renderContent(false);
	}

	private selectTab(id: TabId): void {
		this.active = id;
		this.markActive();
		this.renderContent(false);
		this.containerEl.scrollTop = 0;
	}

	private markActive(): void {
		for (const [id, button] of this.tabButtons) {
			button.toggleClass("is-active", id === this.active);
			button.setAttribute("aria-selected", id === this.active ? "true" : "false");
		}
		if (this.tabSelect) {
			this.tabSelect.value = this.active;
		}
	}

	/** Draws the active tab. A redraw keeps the scroll position, so a change does not throw you back to the top. */
	private renderContent(keepScroll: boolean): void {
		const content = this.content;
		if (!content) {
			return;
		}
		const scroll = this.containerEl.scrollTop;
		content.empty();

		const ctx: TabContext = {
			app: this.app,
			plugin: this.plugin,
			commit: () => void this.plugin.commitSettings(),
			redraw: () => this.renderContent(true),
		};
		switch (this.active) {
			case "general":
				renderGeneral(content, ctx);
				break;
			case "domains":
				renderDomains(content, ctx, this.domainView);
				break;
			case "prompts":
				renderPrompts(content, ctx);
				break;
			case "automatic":
				renderAutomatic(content, ctx);
				break;
			case "data":
				renderData(content, ctx);
				break;
		}
		if (keepScroll) {
			this.containerEl.scrollTop = scroll;
		}
	}
}
