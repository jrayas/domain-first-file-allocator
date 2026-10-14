# How it works

The short version is in the [README](../README.md). This page has the detail.

## The idea

A note's **domain** is the full, vault-relative path of a folder, for example `Areas/Finance` or `Areas/Finance/2026`. The domain and the folder are the same thing, so there is no separate name-to-folder mapping to keep in sync. Each subfolder is its own domain, and two folders with the same name in different places are different domains.

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

## Commands

| Command | What it does |
| --- | --- |
| **File note by domain** | Reads the note's domain property and moves the note into that folder. Links to the note are updated automatically. |
| **Set domain from folder** | Reads the folder the note sits in and writes that folder's path into the note's domain property. |
| **Undo last allocation** | Reverses the most recent move, property change or folder-rename update. |

The two filing commands are separate on purpose: when a note's folder and its property disagree, you decide which one is correct.

The plugin sets no default hotkeys, in line with Obsidian's guidelines, so nothing clashes with your own. To add one, open **Settings → Hotkeys**, search for "Domain First File Allocator", and assign a key.

## Automatic filing

On by default. Type a domain into a note and, a couple of seconds later, the note moves to that folder, with no command to run. It only ever acts on domains you have registered, so it does nothing until you set some up.

To switch it off, use the Automatic filing page, or select the **lightning-bolt icon in the left ribbon**, which toggles it on and off. The icon is highlighted while it is on, and dimmed while snoozed. On mobile it is in the ribbon menu. Right-click the icon (or long-press, where your device supports it) for **Snooze for 15 minutes**, **Snooze for 1 hour** and **Resume now**.

Step by step:

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

## New notes

**Add the domain property to new notes** (General page, on by default for new installs) adds an empty domain property to every note you create, so it is ready to fill in. It waits about a second and a half first, so that a template has time to run, and then:

- if the note already has the property, whatever its value and however it is capitalised, it is **left exactly as the template made it**;
- otherwise the property is added with an empty value (`domain: ""`).

Notes in excluded folders, and notes with the opt-out property, are skipped. Only notes created while Obsidian is running count, not notes that already exist or that arrive by sync.

Together with automatic filing, a new note gets its empty property and falls to the fallback folder; filling in a domain then moves it to that domain's folder.

## When folders change

- When you **rename or move a domain folder**, the registry follows it, and you are offered a preview of the notes whose domain property should be rewritten to match.
- When you **move a note by hand** into a domain folder and its property differs, the plugin asks (or updates, or ignores, depending on your setting) whether to update the property.

## How the domain value is read

- A single string is trimmed, backslashes become forward slashes, and leading and trailing slashes are removed. Matching ignores case and Unicode form, and the stored value uses the folder's real casing.
- Numbers and booleans are treated as text.
- A list with more than one value asks you which to use, then writes that value back as a single string.
- Objects and nested lists are reported and left alone.

## Opting a note out

Add `skip-allocator: true` to a note's frontmatter and the plugin ignores that note entirely. The property name can be changed on the General page.

## Safety

- Moves use Obsidian's own file manager, so links are updated.
- Frontmatter is edited with Obsidian's own YAML handling, never by string manipulation.
- Anything that touches more than one note shows a preview first and runs as one undoable action.
- **Replace** (in the name clash dialogue) needs a second confirmation. It sends the existing note to the trash following your Obsidian "Deleted files" setting. Undo cannot bring that note back; restore it from the trash yourself.
- Undo keeps the last 1, 5 or 10 actions (your choice) in memory only. They are lost when Obsidian restarts.

## On a phone or tablet

The plugin is not desktop-only. It uses only the Obsidian API (no Node or Electron code), so it loads on iOS and Android.

- The settings are drawn by Obsidian itself, so they follow its phone layout: you open a page, then go back.
- The lightning-bolt icon is in the ribbon menu. There is no right-click, so start and stop **Snooze** from the Automatic filing page.
- Hidden folders such as `.domain` may not sync between devices (Obsidian Sync skips them by default). Use a data folder name that is not hidden if you want the same settings everywhere, or set the plugin up on each device.
- Import uses the device's own file picker. Export writes a dated file beside the data file.

It has been built for mobile but checked only against the desktop app so far. To try the phone layout on a computer, open the developer console (Ctrl+Shift+I, or Cmd+Option+I on a Mac) and run `app.emulateMobile(true)`; run `app.emulateMobile(false)` to go back. Real-device results are welcome: the mobile checklist is in [TESTING.md](../TESTING.md).
