# Manual test checklist

Run these in a **test vault**, not your real one. Tick each box as you go.

## Setup

Create this structure and enable the plugin:

```
Areas/Finance/
Areas/Finance/2026/
Areas/Health/
Projects/Finance/        (a second folder called "Finance", elsewhere)
Templates/
Inbox/                   (leave it out to test on-demand creation)
```

In settings, register `Areas/Finance`, `Areas/Finance/2026` and `Areas/Health`. Do not register `Projects/Finance`.

- [ ] Settings screen opens, with General, Domains, Behaviour and Data sections.
- [ ] `.domain/folder.json` exists in the vault root (check from the file system).

## Command: File note by domain

- [ ] Commands appear in the palette only while a Markdown note is open.
- [ ] No default hotkeys are assigned.
- [ ] `domain: Areas/Finance` in a note in the vault root: the note moves to `Areas/Finance`, and a notice names the destination.
- [ ] The editor stays open on the moved note.
- [ ] Links to the note from another note still work after the move.
- [ ] Same with `domain: areas/FINANCE/`: it files to `Areas/Finance`, and the property is rewritten to `Areas/Finance`.
- [ ] Same with `domain: Areas\Finance` (backslash).
- [ ] `domain: Projects/Finance` (unregistered): the unknown-domain dialogue appears (see below).
- [ ] No `domain` property: the note moves to `Inbox`, and `Inbox` is created.
- [ ] Empty `domain:`: same as missing.
- [ ] A note with no frontmatter at all: same as missing.
- [ ] Empty frontmatter (`---` / `---`): same as missing.
- [ ] `domain: 2026` (a number): treated as text, so the unknown-domain dialogue appears for `2026`.
- [ ] `domain: true`: same, for `true`.
- [ ] A nested object as `domain`: a notice says it cannot be used, and nothing moves.
- [ ] A note already in the target folder: a notice says so, and nothing changes.
- [ ] A note in `Templates`: a notice says it was left alone.
- [ ] A note with `skip-allocator: true`: a notice says it was left alone.
- [ ] Turn the fallback off, then file a note with no domain: a notice explains, and the note stays.

### Choose-domain dialogue

- [ ] `domain: [Areas/Finance, Areas/Health]` opens the dialogue listing both values.
- [ ] Choosing one files the note there and writes the property as a single string.
- [ ] Cancel (and Escape) changes nothing.
- [ ] `domain: [Areas/Finance, areas/finance]` does not ask, because the values are the same.
- [ ] A list with one registered and one unregistered value labels the unregistered one "(not registered)".

### Unknown-domain dialogue

- [ ] **Send to fallback** moves the note to `Inbox`.
- [ ] With the fallback off, **Send to fallback** explains and leaves the note.
- [ ] **Add this domain** for an existing, unregistered folder registers it and files the note.
- [ ] **Add this domain** for a folder that does not exist asks to create it. Confirm: the folder is created, registered, and the note filed. Decline: nothing changes.
- [ ] **Add this domain** for a path inside `Templates`: a notice says it is excluded.
- [ ] For a disabled domain the dialogue says so and the button reads **Enable this domain**.
- [ ] **Cancel** changes nothing.
- [ ] The new domain appears in settings, and `folder.json` is updated.

## Command: Set domain from folder

- [ ] A note in `Areas/Health` with no property: it gets `domain: Areas/Health`.
- [ ] A note in `Areas/Finance/2026`: it gets `Areas/Finance/2026`, not `Areas/Finance`.
- [ ] A note whose property already matches: a notice says so.
- [ ] A note in the vault root: a notice says the root cannot be a domain.
- [ ] A note in an unregistered folder: it offers to register. Confirm: registered and written. Cancel: nothing changes.
- [ ] A note in a disabled domain's folder: the property is written, and the notice mentions the domain is disabled.
- [ ] Notes in `Templates`, or with `skip-allocator: true`, are left alone.

## Name clash dialogue

Put `Report.md` in `Areas/Finance`, then file another `Report.md` there by domain.

- [ ] The dialogue shows both paths.
- [ ] **Keep both**: the incoming note becomes `Report 1.md`. Do it again to get `Report 2.md`.
- [ ] **Rename**: an empty name, a name with `/` or `:`, and an existing name each show an inline error and keep the dialogue open. A valid name moves the note under the new name.
- [ ] **Back** from Rename returns to the choices.
- [ ] **Replace** asks for a second confirmation, and that screen warns that undo cannot restore the old note.
- [ ] After confirming **Replace**, the old note is in the system trash (or `.trash`, or deleted, matching your Obsidian "Deleted files" setting) and the new one is in place.
- [ ] **Skip** and **Cancel everything** leave the note where it is.

## Folder rename cascade

Give three notes `domain: Areas/Finance`, one `domain: Areas/Finance/2026`, and one `domain: Areas/Health`.

- [ ] Rename `Areas/Finance` to `Areas/Money` in the file explorer.
- [ ] The registry now lists `Areas/Money` and `Areas/Money/2026`.
- [ ] A preview lists exactly the four notes that named the old paths, old value to new value.
- [ ] **Leave unchanged** leaves the notes alone, with a notice, and the registry stays updated.
- [ ] Repeat, and **Update** rewrites the four notes. The `Areas/Health` note is untouched.
- [ ] The notes were not moved a second time.
- [ ] Move `Areas` into another folder: the registry follows for every domain beneath it, and only one preview appears.
- [ ] Rename a folder that contains no registered domain: nothing happens.
- [ ] **Undo last allocation** restores the old property values and the old registry paths. It does not rename the folder back.
- [ ] A note with `skip-allocator: true` is not listed in the preview.

## Manual note moves

- [ ] Set the prompt to **Ask**. Drag a note with `domain: Inbox` into `Areas/Health`: a small dialogue offers **Update**, **Skip** and **Don't ask again**.
- [ ] **Update** rewrites the property.
- [ ] **Skip** does nothing.
- [ ] **Don't ask again** sets the prompt to Never.
- [ ] Select five notes and drag them together: one batch prompt lists all five.
- [ ] A note that already has the right property does not prompt.
- [ ] Moving a note into an unregistered or excluded folder does nothing.
- [ ] Moving a note into a disabled domain's folder does nothing.
- [ ] Renaming a note without moving it does nothing.
- [ ] Set the prompt to **Always update**: moving updates silently with a notice.
- [ ] Set the prompt to **Never**: moving does nothing.
- [ ] Renaming a domain folder does **not** also trigger manual-move prompts for the notes inside it.
- [ ] Moves the plugin makes itself never trigger a prompt.

## Undo

- [ ] After **File note by domain**, **Undo last allocation** moves the note back and restores the property (including removing it if it was absent).
- [ ] After **Set domain from folder**, undo restores the old property.
- [ ] After a batch update, one undo reverses every note.
- [ ] Undo twice: the second says there is nothing to undo.
- [ ] Delete the note, then undo: it reports that the note no longer exists.
- [ ] Change the property by hand after allocating, then undo: it reports the property was changed, and leaves it.
- [ ] Create a note at the old path, then undo: it reports the path is taken.
- [ ] After **Replace**, undo restores the incoming note's place and warns about the trashed note.
- [ ] Restart Obsidian: undo has nothing (it is in memory only).

## Settings

- [ ] Changing the property name shows the "existing notes keep their old property name" notice, once.
- [ ] Adding a domain uses a searchable picker. Registered and excluded folders are not offered.
- [ ] Removing a domain asks first.
- [ ] Disabling a domain makes notes for it go to the fallback.
- [ ] A domain whose folder was deleted shows a warning icon.
- [ ] Excluded folders can be added by typing (including a hidden folder) or by picker, and removed.
- [ ] Setting the fallback to an excluded folder shows the note in its description.
- [ ] The tap targets are comfortably large.

## JSON sync

- [ ] Change a setting: `folder.json` updates (check `updatedAt` and the content).
- [ ] Edit `folder.json` by hand to change `propertyName`, then focus Obsidian or press **Sync now**: the settings update, with a notice saying the file was newer.
- [ ] Make the file older than the settings (set `updatedAt` to 2020), then **Sync now**: the file is rewritten, with a notice saying the settings were newer.
- [ ] Delete the whole `.domain` folder while Obsidian is running, then change a setting: the folder and file are recreated.
- [ ] Break the JSON (delete a brace), then **Sync now**: a notice explains the problem, the file is **not** overwritten, and settings are unchanged.
- [ ] In that notice, **Export a fresh file** creates `folder-export-….json` and does not touch `folder.json`.
- [ ] Set `"version": 2`: same behaviour as broken JSON.
- [ ] Add two entries for the same folder (different case): they merge, with a notice.
- [ ] Rename the data folder in settings: the file is written at the new location, and the old one is left behind.
- [ ] **Export** creates a dated file.
- [ ] **Import** with a valid file shows a summary, and **Cancel** changes nothing.
- [ ] **Import** with a valid file then confirming saves `folder-backup-….json` first, then applies the file.
- [ ] **Import** with an identical file says nothing would change.
- [ ] **Import** with an invalid file is rejected with the reason.

## Edge cases

- [ ] A fallback folder equal to a domain folder works.
- [ ] Overlapping domains (`Areas/Finance` and `Areas/Finance/2026`) file notes to the right folder.
- [ ] Edit a note while filing it by command: the editor stays on the moved file.
- [ ] A batch of several hundred notes (rename a folder with hundreds of notes naming it): the app stays responsive and a progress notice appears.
- [ ] Disable the plugin while a dialogue is open: the dialogue closes and nothing further happens.
- [ ] Disable the plugin during a large batch: the batch stops, and no errors appear in the console.
- [ ] Disable and re-enable the plugin: no duplicate prompts or commands.

## Mobile (iOS or Android)

Copy the plugin folder into the vault on the device, or sync it, and enable it.

- [ ] The plugin loads with no errors (check that the settings screen opens).
- [ ] The commands appear in the command palette.
- [ ] **File note by domain** and **Set domain from folder** work from the palette.
- [ ] The commands are in the file explorer's long-press menu.
- [ ] Every dialogue fits the screen, buttons are easy to tap, and long paths wrap.
- [ ] The rename-cascade preview scrolls with a finger.
- [ ] Typing in the Rename field works with the on-screen keyboard, and Enter submits.
- [ ] The folder picker opens, searches and selects.
- [ ] Settings toggles, dropdown and trash buttons are easy to tap.
- [ ] **Sync now** works, and the app regaining focus (switching away and back) syncs.
- [ ] **Import** opens the device's file picker. If your platform does not offer one, note it.
- [ ] **Export** writes the dated file (check with the file manager if hidden folders are visible).
- [ ] A rename cascade over many notes keeps the interface responsive.
- [ ] Moving the app to the background during a batch does not corrupt notes (check a few).
- [ ] The data file, if in a hidden folder, is not synced by your sync tool. Confirm that matches the README.
