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

**Hotkeys.** The plugin sets no default hotkeys, in line with Obsidian's guidelines, so nothing clashes with your own. To add one, open **Settings → Hotkeys**, search for "Domain First File Allocator", and assign a key to **File note by domain** (or either of the other commands).

### Automatic filing

**On by default.** Type a domain into a note and, a couple of seconds later, the note moves to that folder, with no command to run. It only ever acts on domains you have registered, so it does nothing until you set some up.

To switch it off, use the Automatic filing tab, or select the **lightning-bolt icon in the left ribbon**, which toggles it on and off. The icon is highlighted while it is on, and dimmed while snoozed. On mobile it is in the ribbon menu. Right-click the icon (or long-press, where your device supports it) for **Snooze for 15 minutes**, **Snooze for 1 hour** and **Resume now**.

How it works, step by step:

1. A note is checked when you change its domain property (typing it, pasting it, or using the Properties panel), when you create it, and when you open a note whose domain property is present but empty.
2. The plugin waits for the **delay** after your last change, so a half-typed value is ignored. The delay is 2 seconds by default; the slider's first stop is **500 ms**, then 1 to 60 seconds. A newly created note waits a little longer, so a template can fill it in first.
3. It checks the value. If it is a registered domain that is switched on and not set to *Manual only*, the note moves to that folder and the property is tidied to the folder's real spelling.
4. If the note has **no domain** (the property is missing or empty), it goes to the fallback folder, but only once you **switch away from it**, never while it is open, because the domain may simply not be typed yet.
5. If the value is not usable (not registered, switched off, Manual only, or a list of several), the note stays put and a notice says why, once per note and value. You can then register the domain, or run **File note by domain** for the full set of choices.
6. The move is recorded, so **Undo last allocation** reverses it.

It is deliberately cautious: it never opens dialogues, never replaces a note, skips excluded folders and opted-out notes, and leaves a note alone if the destination already has one with the same name.

- It reacts to **changes to the property, new notes, and opening a note whose domain property is empty**, never to where a note sits. A note you move by hand is not moved back.
- It acts only on a value that matches a registered, **enabled** domain that is not set to *Manual only*. Unknown, disabled, multi-value and invalid values are left alone, with one notice, and no dialogue opens.
- A **name clash** leaves the note in place and shows a notice. It never replaces or renames anything.
- Excluded folders and the opt-out property are respected.
- **Never move the open note** (off by default) holds back a note that is open in the editor even after you type a domain, and files it once you switch to another note. Leave it off if you want the note you are typing in to move as soon as the domain is typed. A note with **no domain** always waits until you leave it, whatever this setting says.
- **Only file notes in the fallback folder** limits automatic filing to an inbox-style folder.
- **Also file notes with no domain** (on by default) sends a new note, a note whose domain was removed, and a note you open whose domain property is present but empty, to the fallback folder. The move happens when you switch away from the note, never while you are in it. A note with no domain property at all is only moved when it is newly created, never just because you opened it. Turn this off if you create notes in folders where they should stay.
- **Quiet moves** hides the notice for a successful automatic move. Skips and errors are still shown.
- **Snooze** pauses automatic filing for a while. Changes made while paused are not filed afterwards, and a restart ends the snooze.
- Each automatic move can be reversed with **Undo last allocation**, up to the undo depth you choose.

### New notes

**Add the domain property to new notes** (General tab, off by default) adds an empty domain property to every note you create, so it is ready to fill in. It waits about a second and a half first, so that a template has time to run, and then:

- if the note already has the property, whatever its value and however it is capitalised, it is **left exactly as the template made it**;
- otherwise the property is added with an empty value (`domain: ""`).

Notes in excluded folders, and notes with the opt-out property, are skipped. Only notes created while Obsidian is running count, not notes that already exist or that arrive by sync.

Together with automatic filing, a new note gets its empty property and falls to the fallback folder; filling in a domain then moves it to that domain's folder.

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

The settings screen has five tabs, listed down the left (a dropdown at the top on a phone).

**General**

| Setting | Default | Notes |
| --- | --- | --- |
| Property name | `domain` | The frontmatter property to read and write. Changing it affects future filing only; existing notes keep their old property name. |
| Opt-out property | `skip-allocator` | A note with this property set to `true` is ignored entirely. |
| Add the domain property to new notes | off | Adds an empty domain property to each new note, unless a template already supplied one. |
| Write the folder's casing | on | When filing, rewrite the note's domain to the folder's real capitalisation. Off leaves your own text alone when it names the same folder. |
| Use fallback folder | on | When off, notes with no matching domain stay where they are. |
| Fallback folder | `Inbox` | Any name or path. Created on demand. |
| Excluded folders | `Templates`, `.domain` | Notes inside these (and their subfolders) are never moved or modified. The data folder is always excluded as well. |
| Notice level | All notices | *All notices*, *Important only* or *Errors only*. Errors are always shown. |

**Domains**

A list of registered folders, with a search box, a sort order (path, enabled first, order added), and a note count for each. Every domain has a mode: **Manual and automatic**, **Manual only** (never filed by automatic mode) or **Off** (treated as unknown, so its notes go to the fallback). **Turn all on** and **Turn all off** act on the domains matching the search. A warning icon marks a domain whose folder no longer exists; it is kept in case the folder comes back.

New domains are added with a searchable folder picker, never by typing. **Add subfolders** registers the subfolders of a folder in one go: you see the list first, can include nested folders, and excluded or already registered folders are skipped. A folder path can appear only once.

**Prompts and confirmations**

A **preset** sets all the popup choices together: *Cautious* (ask about everything, the default), *Balanced* (create and register folders automatically, ask the rest) and *Hands-off* (automate everything that is safe). Changing any single choice shows the preset as *Custom*.

| Setting | Default | Choices |
| --- | --- | --- |
| Unknown domain | Ask | Ask, send to the fallback folder, add it as a domain. A domain you switched off is never turned back on without asking. |
| Several domains in one note | Ask | Ask which, or use the first. |
| Domain folder does not exist | Ask | Ask, or create it automatically (when adding an unknown domain). |
| Name clash | Ask | Ask, keep both notes, or skip the note. |
| Folder is not a domain yet | Ask | Ask, or register it automatically (Set domain from folder). |
| After a domain folder is renamed or moved | Show a preview | Show a preview, or update automatically. |
| Skip the preview below this many notes | 1 | 1 to 50. A rename that affects fewer notes is applied without a preview. |
| Note moved by hand into a domain folder | Ask | Ask, always update, or never. |

Some confirmations are **never** switched off: **Replace** (needs a second confirmation), **Import** (shows the changes and saves a backup first) and overwriting a damaged data file (never done).

**Automatic filing**

| Setting | Default | Notes |
| --- | --- | --- |
| File notes automatically | on | Also toggled by the left-ribbon icon. |
| Delay | 2 seconds | 500 ms, or 1 to 60 seconds. How long after the domain property last changed a note is filed. |
| Never move the open note | off | When on, the note is filed once you switch away from it. |
| Only file notes in the fallback folder | off | Limits automatic filing to notes already in the fallback folder. |
| Also file notes with no domain | on | Sends new notes, notes whose domain was removed, and opened notes with an empty domain property to the fallback folder. |
| Quiet moves | off | No notice for a successful automatic move. |
| Pause automatic filing | | Snooze for 15 minutes or 1 hour, or resume. |

**Data and sync**

| Setting | Default | Notes |
| --- | --- | --- |
| Data folder name | `.domain` | The hidden folder in the vault root that holds `folder.json`. |
| When the settings and the file differ | Most recently changed wins | Also: always use my settings, always use the data file, or ask me each time. |
| Sync now | | Reconciles the settings with the data file. |
| Actions Undo can reverse | The last action only | The last 1, 5 or 10 actions. |
| Export | | Saves a dated copy of the settings next to the data file. |
| Import | | Loads a settings file after showing what will change. A backup is saved first. |
| Reset to defaults | | Puts every setting back to its default, including the domain registry. A backup is saved first. Your notes are not touched. |

### Per-note opt-out

Add `skip-allocator: true` to a note's frontmatter and the plugin ignores that note entirely. The property name can be changed on the General tab.

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
  "automatic": {
    "enabled": true,
    "delaySeconds": 2,
    "includeNoDomain": true,
    "onlyInFallback": false,
    "skipOpenNote": false,
    "quiet": false
  },
  "prompts": {
    "unknownDomain": "ask",
    "multipleValues": "ask",
    "registerFolder": "ask",
    "createFolder": "ask",
    "renamePreview": "ask",
    "nameClash": "ask",
    "previewThreshold": 1
  },
  "notices": "all",
  "optOutProperty": "skip-allocator",
  "writeCanonicalCasing": true,
  "addPropertyToNewNotes": false,
  "conflictPolicy": "newest",
  "undoDepth": 1,
  "domains": [
    { "folder": "Areas/Finance", "enabled": true },
    { "folder": "Areas/Private", "enabled": true, "allowAuto": false }
  ]
}
```

Everything after `folderMovePrompt` is optional, so files written by earlier versions still load, with the defaults shown, and the version stays 1. A domain's `allowAuto` is written only when it is `false` (Manual only). Allowed values:

| Field | Values |
| --- | --- |
| `automatic.delaySeconds` | 0.5 (500 ms), or a whole number from 1 to 60 |
| `prompts.unknownDomain` | `ask`, `fallback`, `add` |
| `prompts.multipleValues` | `ask`, `first` |
| `prompts.registerFolder`, `createFolder`, `renamePreview` | `ask`, `auto` |
| `prompts.nameClash` | `ask`, `keep-both`, `skip` (Replace is deliberately not available) |
| `prompts.previewThreshold` | 1 to 50 |
| `notices` | `all`, `important`, `errors` |
| `conflictPolicy` | `newest`, `settings`, `file`, `ask` |
| `undoDepth` | 1, 5 or 10 |

A value outside these makes the file unusable, and it is then left untouched, never overwritten.

Sync rules:

- The settings and the file each carry `updatedAt`. By default **the most recently updated one wins**, and a notice says which side was used. If they differ but have the same timestamp, the settings win. You can instead choose to always use your settings, always use the file, or be asked each time (the policy is your own local choice, and the one stored in the file is not used to decide).
- When you are asked and choose **Decide later**, nothing changes and you are not asked again until one side changes.
- Syncing happens when the plugin loads, when you change a setting, when the app window regains focus, and when you press **Sync now**.
- If the file is malformed or has an unknown `version`, the plugin **never overwrites it**. It shows a notice, keeps your current settings, and offers to export a fresh file under a different name.
- Duplicate domain entries in the file are merged, and reported when you press **Sync now**.

Obsidian Sync does not sync hidden folders such as `.domain` by default. If you use the file to share settings between devices, either choose a data folder name that is not hidden (for example `Domain settings`, which is excluded from filing automatically) or check your sync tool's settings.

## Safety

- Moves use Obsidian's own file manager, so links are updated.
- Frontmatter is edited with Obsidian's own YAML handling, never by string manipulation.
- Anything that touches more than one note shows a preview first and runs as one undoable action.
- **Replace** (in the name clash dialogue) needs a second confirmation. It sends the existing note to the trash following your Obsidian "Deleted files" setting. Undo cannot bring that note back; restore it from the trash yourself.
- Undo keeps the last 1, 5 or 10 actions (your choice) in memory only. They are lost when Obsidian restarts.

## Troubleshooting

**Nothing happens when I run a command.** The commands appear only when a Markdown note is active. Click into the note first.

**"Left alone" notice.** The note is in an excluded folder (including the data folder), or has `skip-allocator: true`.

**The note went to the fallback folder.** Its domain is empty, not registered, or disabled. Register or enable the domain in settings, or use the unknown-domain dialogue's **Add this domain** button.

**"The data file is unusable" notice.** `folder.json` is not valid JSON, or its version is not 1. The plugin has left it alone. Fix it by hand, or press **Export a fresh file** in the notice and replace it.

**My settings changed by themselves.** The data file was newer than your settings, so it was applied. The notice said so when it happened. Use **Export** before editing the file by hand if you want a restore point.

**Edits to `.domain/folder.json` are not picked up.** Hidden files do not raise change events. Switch away from and back to Obsidian, or press **Sync now**.

**A domain has a warning icon.** Its folder no longer exists, perhaps because it was renamed while the plugin was disabled. Remove the domain and add the folder again.

**The folder-move prompt stopped appearing.** You chose "Don't ask again". Set **Note moved by hand into a domain folder** back to Ask on the Prompts and confirmations tab.

**A popup I expect does not appear.** A preset or an individual choice on the Prompts and confirmations tab may be set to automatic. Choose the **Cautious** preset to ask about everything again.

**A note with an empty domain did not go to the fallback.** Check that automatic filing and **Also file notes with no domain** are on, that the fallback folder is turned on, and that the note is not in an excluded folder or opted out. An existing note is only checked when you open it, and only if the domain property is present but empty; a note with no property at all is only moved when it is created. You can always run **File note by domain**.

**New notes are not getting a domain property.** Turn on **Add the domain property to new notes** on the General tab. Notes that already have the property (for example from a template) are left alone on purpose, and notes in excluded folders are skipped.

**I do not see notices any more.** Check **Notice level** on the General tab. Errors are always shown.

**A note was not filed automatically.** Automatic filing may be switched off (check the ribbon icon, which is highlighted when on, or the Automatic filing tab). The domain may be unknown, off, or set to *Manual only*; a notice normally says which. The note may be open in the editor while **Never move the open note** is on (it is filed when you switch away); it may be outside the fallback folder while **Only file notes in the fallback folder** is on; or automatic filing may be snoozed.

**I updated the plugin and automatic filing is still off.** The new defaults apply to a fresh install. If you saved settings before, your earlier choice is kept: turn on **File notes automatically** and turn off **Never move the open note** on the Automatic filing tab, or select the ribbon icon.

**Reset removed my domains.** Reset also clears the registry. A backup named `folder-backup-<date>.json` was saved beside the data file; use **Import** to bring it back.

## Licence

MIT. See `LICENSE`.
