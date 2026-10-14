# Settings reference

The settings screen has five pages: General, Domains, Prompts and confirmations, Automatic filing, and Data and sync. Every setting is found by Obsidian's settings search, so you can type, for example, "undo" or "fallback" in the search box at the top of Settings.

## General

| Setting | Default | Notes |
| --- | --- | --- |
| Property name | `domain` | The frontmatter property to read and write. Changing it affects future filing only; existing notes keep their old property name. |
| Opt-out property | `skip-allocator` | A note with this property set to `true` is ignored entirely. |
| Add the domain property to new notes | on | Adds an empty domain property to each new note, unless a template already supplied one. If you saved settings in an earlier version, your choice is kept. |
| Write the folder's casing | on | When filing, rewrite the note's domain to the folder's real capitalisation. Off leaves your own text alone when it names the same folder. |
| Use fallback folder | on | When off, notes with no matching domain stay where they are. |
| Fallback folder | `Inbox` | Any name or path. Created if it does not exist: when Obsidian starts, when you switch the fallback on, and when you close the settings after changing its name. Nothing is created while the fallback is off. |
| Excluded folders | `Templates` | Notes inside these (and their subfolders) are never moved or modified. The data folder is always excluded as well, so it needs no entry. |
| Notice level | All notices | *All notices*, *Important only* or *Errors only*. Errors are always shown. |

## Domains

A list of registered folders, with a search box, a sort order (path, enabled first, order added), and a note count for each. Every domain has a mode: **Manual and automatic**, **Manual only** (never filed by automatic mode) or **Off** (treated as unknown, so its notes go to the fallback). **Turn all on** and **Turn all off** act on every domain in the list, and ask you to confirm first. A warning icon marks a domain whose folder no longer exists; it is kept in case the folder comes back.

New domains are added with a searchable folder picker, never by typing. **Add subfolders** registers the subfolders of a folder in one go: you see the list first, can include nested folders, and excluded or already registered folders are skipped. A folder path can appear only once.

## Prompts and confirmations

A **preset** sets all the popup choices together: *Cautious* (ask about everything), *Balanced* (create and register folders automatically, ask the rest) and *Hands-off* (automate everything that is safe). Changing any single choice shows the preset as *Custom*. A new install also reads *Custom*, because a note you move by hand into a domain folder is updated without asking by default; choose *Cautious* to be asked about that too.

| Setting | Default | Choices |
| --- | --- | --- |
| Unknown domain | Ask | Ask, send to the fallback folder, add it as a domain. A domain you switched off is never turned back on without asking. |
| Several domains in one note | Ask | Ask which, or use the first. |
| Domain folder does not exist | Ask | Ask, or create it automatically (when adding an unknown domain). |
| Name clash | Ask | Ask, keep both notes, or skip the note. |
| Folder is not a domain yet | Ask | Ask, or register it automatically (Set domain from folder). |
| After a domain folder is renamed or moved | Show a preview | Show a preview, or update automatically. |
| Skip the preview below this many notes | 1 | 1 to 50. A rename that affects fewer notes is applied without a preview. |
| Note moved by hand into a domain folder | Always update | Ask, always update, or never. |

Some confirmations are **never** switched off: **Replace** (needs a second confirmation), **Import** (shows the changes and saves a backup first) and overwriting a damaged data file (never done).

## Automatic filing

| Setting | Default | Notes |
| --- | --- | --- |
| File notes automatically | on | Also toggled by the left-ribbon icon. |
| Delay | 2 seconds | 500 ms, or 1 to 60 seconds. How long after the domain property last changed a note is filed. |
| Never move the open note | off | When on, the note is filed once you switch away from it. |
| Only file notes in the fallback folder | off | Limits automatic filing to notes already in the fallback folder. |
| Also file notes with no domain | on | Sends new notes, notes whose domain was removed, and opened notes with an empty domain property to the fallback folder. |
| Quiet moves | off | No notice for a successful automatic move. |
| Pause automatic filing | | Snooze for 15 minutes or 1 hour, or resume. |

## Data and sync

| Setting | Default | Notes |
| --- | --- | --- |
| Data folder name | `.domain` | The hidden folder in the vault root that holds `folder.json`. |
| When the settings and the file differ | Most recently changed wins | Also: always use my settings, always use the data file, or ask me each time. |
| Sync now | | Reconciles the settings with the data file. |
| Actions Undo can reverse | The last action only | The last 1, 5 or 10 actions. |
| Export | | Saves a dated copy of the settings next to the data file. |
| Import | | Loads a settings file after showing what will change. A backup is saved first. |
| Reset to defaults | | Puts every setting back to its default, including the domain registry. A backup is saved first. Your notes are not touched. |

The settings are also stored in a file you can back up or share: see [The data file](data-file.md).
