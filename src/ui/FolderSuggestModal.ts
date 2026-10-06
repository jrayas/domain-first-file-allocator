import { FuzzySuggestModal, type App, type TFolder } from "obsidian";

/** A searchable folder picker. Calls `onPick` with the chosen folder. */
export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	constructor(
		app: App,
		private readonly folders: readonly TFolder[],
		private readonly onPick: (folder: TFolder) => void,
	) {
		super(app);
		this.setPlaceholder("Search for a folder");
	}

	getItems(): TFolder[] {
		return [...this.folders];
	}

	getItemText(folder: TFolder): string {
		return folder.path;
	}

	onChooseItem(folder: TFolder): void {
		this.onPick(folder);
	}
}
