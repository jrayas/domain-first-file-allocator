# Domain First File Allocator

An Obsidian plugin that files notes into folders according to a **domain** property in their frontmatter, and can also work the other way round.

A note's **domain** is the full, vault-relative path of a folder, for example `Areas/Finance` or `Areas/Finance/2026`. The domain and the folder are the same thing, so there is no separate name-to-folder mapping to keep in sync. Each subfolder is its own domain, and two folders with the same name in different places are different domains.

It works on desktop and mobile, and uses only the Obsidian API.

## What it does

| Command | What it does |
| --- | --- |
| **File note by domain** | Reads the note's domain property and moves the note into that folder. Links to the note are updated automatically. |
| **Set domain from folder** | Reads the folder the note sits in and writes that folder's path into the note's domain property. |
| **Undo last allocation** | Reverses the most recent move, property change or folder-rename update. |

The two filing commands are separate on purpose: when a note's folder and its property disagree, you decide which one is correct.

The plugin also watches for folder changes:

- When you **rename or move a domain folder**, the registry follows it, and you are offered a preview of the notes whose domain property should be rewritten to match.
- When you **move a note by hand** into a domain folder and its property differs, the plugin asks (or updates, or ignores, depending on your setting) whether to update the property.

### Concept

```
            frontmatter                          vault
        ┌───────────────────┐              ┌──────────────────┐
        │ domain:           │  File note   │ Areas/           │
        │  Areas/Finance    │ ───────────► │   Finance/       │
        │                   │  by domain   │     Note.md      │
        │                   │ ◄─────────── │                  │
        └───────────────────┘  Set domain  └──────────────────┘
                               from folder

   Registry (settings)  ──  which folders count as domains, and are they on?
   Fallback folder      ──  where notes go when no enabled domain matches
   Excluded folders     ──  never touched, including their subfolders
```

## Install

Manual install:

1. Build the plugin (see below), or download `main.js`, `manifest.json` and `styles.css` from a release.
2. In your vault, create the folder `.obsidian/plugins/domain-first-file-allocator/`.
3. Copy `main.js`, `manifest.json` and `styles.css` into it.
4. In Obsidian, open **Settings → Community plugins**, refresh the list and enable **Domain First File Allocator**.

No keyboard shortcuts are set by default. Assign them in **Settings → Hotkeys** by searching for "Domain First File Allocator".

## Build

You need Node.js 18 or later.

```
npm install
npm run build     # type-check, then produce main.js
npm test          # run the unit tests (vitest)
npm run lint      # ESLint
npm run dev       # rebuild on change
```

The pure logic lives in `src/core/` with no Obsidian imports, and is covered by the tests in `tests/`.

## Settings reference

**General**

| Setting | Default | Notes |
| --- | --- | --- |
| Property name | `domain` | The frontmatter property to read and write. Changing it affects future filing only; existing notes keep their old property name. |
| Use fallback folder | on | When off, notes with no matching domain stay where they are. |
| Fallback folder | `Inbox` | Any name or path. Created on demand. |
| Excluded folders | `Templates`, `.domain` | Notes inside these (and their subfolders) are never moved or modified. The data folder is always excluded as well. |

**Domains**

A list of registered folders. Each can be switched on or off or removed, and new ones are added with a searchable folder picker, never by typing. A folder path can appear only once. A **disabled** domain is treated as unknown, so its notes go to the fallback folder. A warning icon marks a domain whose folder no longer exists; it is kept in case the folder comes back.

**Behaviour**

| Setting | Default | Notes |
| --- | --- | --- |
| Folder-move prompt | Ask | *Ask*, *Always update* or *Never*, for notes you move by hand into a domain folder. |

**Data**

| Setting | Default | Notes |
| --- | --- | --- |
| Data folder name | `.domain` | The hidden folder in the vault root that holds `folder.json`. |
| Sync now | | Reconciles the settings with the data file. |
| Export | | Saves a dated copy of the settings next to the data file. |
| Import | | Loads a settings file after showing what will change. A backup is saved first. |

### Per-note opt-out

Add `skip-allocator: true` to a note's frontmatter and the plugin ignores that note entirely.

### How the domain value is read

- A single string is trimmed, backslashes become forward slashes, and leading and trailing slashes are removed. Matching ignores case, and the stored value uses the folder's real casing.
- Numbers and booleans are treated as text.
- A list with more than one value asks you which to use, then writes that value back as a single string.
- Objects and nested lists are reported and left alone.

## The `folder.json` file

The settings are mirrored to `<data folder name>/folder.json` in the vault root (by default `.domain/folder.json`), and created automatically if missing.

```json
{
  "version": 1,
  "updatedAt": "2026-10-07T12:00:00.000Z",
  "propertyName": "domain",
  "fallback": { "enabled": true, "folder": "Inbox" },
  "excludeFolders": ["Templates", ".domain"],
  "folderMovePrompt": "ask",
  "domains": [
    { "folder": "Areas/Finance", "enabled": true }
  ]
}
```

Sync rules:

- The settings and the file each carry `updatedAt`. **The most recently updated one wins**, and a notice says which side was used. If they differ but have the same timestamp, the settings win.
- Syncing happens when the plugin loads, when you change a setting, when the app window regains focus, and when you press **Sync now**.
- If the file is malformed or has an unknown `version`, the plugin **never overwrites it**. It shows a notice, keeps your current settings, and offers to export a fresh file under a different name.
- Duplicate domain entries in the file are merged, and reported when you press **Sync now**.

Obsidian Sync does not sync hidden folders such as `.domain` by default. If you use the file to share settings between devices, either choose a data folder name that is not hidden (for example `Domain settings`, which is excluded from filing automatically) or check your sync tool's settings.

## Safety

- Moves use Obsidian's own file manager, so links are updated.
- Frontmatter is edited with Obsidian's own YAML handling, never by string manipulation.
- Anything that touches more than one note shows a preview first and runs as one undoable action.
- **Replace** (in the name clash dialogue) needs a second confirmation. It sends the existing note to the trash following your Obsidian "Deleted files" setting. Undo cannot bring that note back; restore it from the trash yourself.
- Undo keeps one action in memory only. It is lost when Obsidian restarts.

## Troubleshooting

**Nothing happens when I run a command.** The commands appear only when a Markdown note is active. Click into the note first.

**"Left alone" notice.** The note is in an excluded folder (including the data folder), or has `skip-allocator: true`.

**The note went to the fallback folder.** Its domain is empty, not registered, or disabled. Register or enable the domain in settings, or use the unknown-domain dialogue's **Add this domain** button.

**"The data file is unusable" notice.** `folder.json` is not valid JSON, or its version is not 1. The plugin has left it alone. Fix it by hand, or press **Export a fresh file** in the notice and replace it.

**My settings changed by themselves.** The data file was newer than your settings, so it was applied. The notice said so when it happened. Use **Export** before editing the file by hand if you want a restore point.

**Edits to `.domain/folder.json` are not picked up.** Hidden files do not raise change events. Switch away from and back to Obsidian, or press **Sync now**.

**A domain has a warning icon.** Its folder no longer exists, perhaps because it was renamed while the plugin was disabled. Remove the domain and add the folder again.

**The folder-move prompt stopped appearing.** You chose "Don't ask again". Set **Folder-move prompt** back to Ask.

## Licence

MIT. See `LICENSE`.
