import { Notice, normalizePath, type App } from "obsidian";
import { folderLevels } from "../core/paths";
import { parseConfigJson, serialiseConfig } from "../core/jsonSchema";
import { decideSync } from "../core/merge";
import { CONFIG_FILE_NAME, type AllocatorSettings, type ConfigFile } from "../types";

export type FileState =
	| { state: "missing" }
	| { state: "invalid"; error: string }
	| { state: "ok"; config: ConfigFile; warnings: string[] };

export type SyncOutcome = "created" | "in-sync" | "settings-used" | "file-used" | "invalid" | "error";

export interface SyncHost {
	getSettings(): AllocatorSettings;
	/** Replaces the settings with the (newer) file contents and persists them to data.json. */
	adoptFileConfig(config: ConfigFile): Promise<void>;
}

/**
 * Reads, writes and reconciles the hidden `<data folder>/folder.json` file.
 * Hidden folders are not part of the vault index, so everything goes through
 * `app.vault.adapter`. Operations are queued so they never overlap.
 */
export class JsonSync {
	private queue: Promise<unknown> = Promise.resolve();
	private lastReportedError: string | null = null;

	constructor(
		private readonly app: App,
		private readonly host: SyncHost,
	) {}

	get filePath(): string {
		return normalizePath(`${this.host.getSettings().dataFolderName}/${CONFIG_FILE_NAME}`);
	}

	/** Runs `task` after every previously queued task has finished. */
	private enqueue<T>(task: () => Promise<T>): Promise<T> {
		const run = this.queue.then(task, task);
		this.queue = run.catch(() => undefined);
		return run;
	}

	async readFile(path: string = this.filePath): Promise<FileState> {
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(path))) {
			return { state: "missing" };
		}
		const result = parseConfigJson(await adapter.read(path));
		return result.ok
			? { state: "ok", config: result.config, warnings: result.warnings }
			: { state: "invalid", error: result.error };
	}

	private async ensureFolder(path: string): Promise<void> {
		const adapter = this.app.vault.adapter;
		const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
		for (const level of folderLevels(folder)) {
			if (!(await adapter.exists(level))) {
				await adapter.mkdir(level);
			}
		}
	}

	private async writeSettings(settings: AllocatorSettings, path: string = this.filePath): Promise<void> {
		await this.ensureFolder(path);
		await this.app.vault.adapter.write(path, serialiseConfig(settings));
	}

	/**
	 * Reconciles settings and file: the most recently updated side wins.
	 * An invalid file is never overwritten. `manual` forces the problem notice
	 * to appear again even if it was already shown for the same error.
	 */
	sync(options: { manual?: boolean } = {}): Promise<SyncOutcome> {
		return this.enqueue(async () => {
			try {
				return await this.syncNow(options.manual === true);
			} catch (error) {
				console.error("Domain First File Allocator: sync failed", error);
				new Notice("Domain first file allocator: could not sync the data file. See the console for details.");
				return "error";
			}
		});
	}

	private async syncNow(manual: boolean): Promise<SyncOutcome> {
		const settings = this.host.getSettings();
		const file = await this.readFile();

		if (file.state === "invalid") {
			this.reportInvalid(file.error, manual);
			return "invalid";
		}
		this.lastReportedError = null;

		if (file.state === "missing") {
			await this.writeSettings(settings);
			return "created";
		}
		if (file.warnings.length > 0 && manual) {
			new Notice(`Data file: ${file.warnings.join(" ")}`);
		}

		switch (decideSync(settings, file.config)) {
			case "in-sync":
				return "in-sync";
			case "use-settings":
				await this.writeSettings(settings);
				new Notice("Domain first file allocator: your settings were newer, so the data file was updated.");
				return "settings-used";
			case "use-file":
				await this.host.adoptFileConfig(file.config);
				new Notice("Domain first file allocator: the data file was newer, so your settings were updated from it.");
				return "file-used";
			case "create-file":
				await this.writeSettings(settings);
				return "created";
		}
	}

	/** Writes the current settings to the file after a settings change. Never overwrites an invalid file. */
	pushSettings(): Promise<SyncOutcome> {
		return this.enqueue(async () => {
			try {
				const file = await this.readFile();
				if (file.state === "invalid") {
					this.reportInvalid(file.error, false);
					return "invalid";
				}
				await this.writeSettings(this.host.getSettings());
				return "settings-used";
			} catch (error) {
				console.error("Domain First File Allocator: could not write the data file", error);
				new Notice("Domain first file allocator: could not write the data file. See the console for details.");
				return "error";
			}
		});
	}

	/** Writes a fresh copy of the current settings under a timestamped name, beside the data file. */
	async exportFreshCopy(): Promise<string | null> {
		return this.enqueue(async () => {
			const settings = this.host.getSettings();
			const stamp = new Date().toISOString().replace(/[:.]/g, "-");
			const path = normalizePath(`${settings.dataFolderName}/folder-export-${stamp}.json`);
			try {
				await this.writeSettings(settings, path);
				new Notice(`Exported a fresh copy to ${path}.`);
				return path;
			} catch (error) {
				console.error("Domain First File Allocator: export failed", error);
				new Notice("Domain first file allocator: could not export the file. See the console for details.");
				return null;
			}
		});
	}

	private reportInvalid(error: string, manual: boolean): void {
		if (!manual && this.lastReportedError === error) {
			return;
		}
		this.lastReportedError = error;

		const fragment = document.createDocumentFragment();
		const message = document.createElement("div");
		message.textContent = `Domain first file allocator: the data file at ${this.filePath} is unusable and has been left untouched. ${error} Your current settings are still in use.`;
		const button = document.createElement("button");
		button.textContent = "Export a fresh file";
		button.addEventListener("click", () => {
			void this.exportFreshCopy();
		});
		fragment.append(message, button);
		new Notice(fragment, 15000);
	}
}
