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
- [ ] With the undo depth above 1, repeated undo steps back through earlier actions, newest first.

## Automatic filing

On a fresh install automatic filing is **on**, and **Never move the open note** is **off**. Test that first, then turn it off for the "off" checks.

- [ ] On a fresh install (no saved settings), the ribbon icon is highlighted and the Automatic filing tab shows it on.
- [ ] With `domain: Areas/Finance` registered, typing that value into the open note moves it after about the delay, with the editor staying on the note and no command run.
- [ ] Typing a value that is not registered leaves the note, and one notice says it is not a registered domain. Changing the value again to another unknown one gives one more notice; repeating the same one does not.
- [ ] A value set to Manual only, or switched off, gives a matching one-time notice.
- [ ] Selecting the ribbon icon always shows a notice ("Automatic filing is on/off") unless the notice level is Errors only, and the icon highlight changes.

- [ ] A left-ribbon icon (lightning bolt) is present. On mobile it is in the ribbon menu.
- [ ] Its tooltip says automatic filing is off and offers to turn it on.
- [ ] With it off, changing a note's `domain` to `Areas/Health` does nothing.
- [ ] Select the icon: a notice says it is on, the icon is highlighted, and the settings toggle is on.
- [ ] Turn it off from the settings toggle: the ribbon icon updates to match.
- [ ] With it on, change a note's `domain` to `Areas/Health` and wait for the delay: the note moves, and a notice says so.
- [ ] Editing only the note's body does not move it.
- [ ] Typing a domain slowly (pausing less than the delay between edits) moves the note once, after the last change.
- [ ] A half-typed or unknown domain does nothing and shows no dialogue.
- [ ] A disabled domain does nothing.
- [ ] A list with several domains does nothing.
- [ ] **Drag a note into `Areas/Health` by hand with the wrong property: automatic filing does not move it back** (the folder-move prompt applies instead).
- [ ] A name clash leaves the note in place and shows a notice, and nothing is replaced.
- [ ] Notes in an excluded folder, or with `skip-allocator: true`, are never moved.
- [ ] **Undo last allocation** reverses an automatic move.
- [ ] Changing the delay to 10 seconds takes effect (sync from `folder.json` too).
- [ ] The delay slider's first stop reads **500 ms**; the next stops read 1 second, 2 seconds and so on up to 60 seconds. The label beside the slider always shows the real time.
- [ ] At 500 ms a note files about half a second after the domain property last changed.
- [ ] At 500 ms, typing a domain that starts with a shorter registered domain (for example `Areas` while typing `Areas/Finance`) can file the note early; a longer delay avoids it.
- [ ] Setting `"delaySeconds": 0.5` in `folder.json` and pressing **Sync now** shows 500 ms. `0.2` makes the file unusable, and it is left untouched.
- [ ] Turning automatic filing off while a note is waiting cancels the pending move.
- [ ] Create a new note with no domain, anywhere in the vault, with **Also file notes with no domain** on (the default): after the delay plus about a second, it goes to the fallback folder, and the editor stays on it.
- [ ] Turn **Also file notes with no domain** off and create another new note: nothing happens.
- [ ] Add `domain:` (empty) to an existing note outside the fallback, then open another note and open that one again: it falls to the fallback folder.
- [ ] Open an existing note that has **no** domain property at all: it is **not** moved.
- [ ] Open a note that is already in the fallback with an empty domain: nothing happens, and no repeated notices.
- [ ] Clear the domain from a note that had one: it falls to the fallback after the delay.
- [ ] Turn the fallback off and clear a note's domain: one notice says the fallback is off, and the note stays.
- [ ] Turn **Also file notes with no domain** off, clear a note's domain: one notice says that option is off.
- [ ] A note in an excluded folder, or with the opt-out property, with an empty domain is never moved.
- [ ] With **Only file notes in the fallback folder** on, an empty-domain note outside the fallback is not moved.
- [ ] Remove the `domain` property from a note with that option on: the note goes to the fallback.
- [ ] Restart Obsidian with it on: existing notes are not refiled at startup.
- [ ] Change the property name in settings: no notes move because of the change.
- [ ] Edit `folder.json` to add `"automatic": {"enabled": true, "delaySeconds": 5, "includeNoDomain": false}`, then **Sync now**: the settings and ribbon update. Remove the block entirely: the file still loads, with the defaults.
- [ ] An invalid block (`"delaySeconds": 0`) is rejected like other invalid JSON, with the file left untouched.

## Settings screen

- [ ] Five tabs are listed down the left: General, Domains, Prompts and confirmations, Automatic filing, Data and sync.
- [ ] Selecting a tab shows it, highlights it, and scrolls back to the top.
- [ ] Widen and narrow the window: below about 700 pixels the tab list becomes a dropdown above the content, and the dropdown switches tabs.
- [ ] On a phone the dropdown is shown and the tab list is hidden.
- [ ] Changing a setting that redraws the tab (for example removing an excluded folder) keeps the scroll position.
- [ ] Every control is comfortably large to tap.
- [ ] Settings changes are saved: close and reopen settings, and restart Obsidian, and they persist.
- [ ] Each change updates `folder.json`.

### General tab

- [ ] Changing the property name shows the "existing notes keep their old property name" notice once, after you stop typing.
- [ ] Changing the opt-out property to `keep-out`: a note with `keep-out: true` is left alone, and `skip-allocator: true` no longer protects a note.
- [ ] With **Write the folder's casing** off, filing a note with `domain: areas/finance` leaves the text as it is. With it on, the text becomes `Areas/Finance`.
- [ ] A list with several values is still rewritten to the single chosen value with the option off.
- [ ] **Use fallback folder** off: notes with no domain stay put.
- [ ] **Add the domain property to new notes** is off by default.
- [ ] With it on, create a new empty note: after about a second and a half it gains an empty domain property (`domain: ""`), with the editor still on the note.
- [ ] With it on, create a note from a template that already has `domain:` (empty or filled, or `Domain:`): the property is left exactly as the template wrote it, and the file is not rewritten.
- [ ] With it on, create a note from a template that does not have the property: the property is added alongside the template's own.
- [ ] With it on, a note created in an excluded folder, or a template with the opt-out property, gets nothing added.
- [ ] Restart Obsidian with it on: existing notes are not changed, and only notes created afterwards are.
- [ ] With it on together with automatic filing, a new note gets its empty property and falls to the fallback folder; typing a domain then moves it.
- [ ] Changing the property name to `area` adds `area` to new notes from then on.
- [ ] Setting the fallback to an excluded folder shows the note in its description.
- [ ] Excluded folders can be added by typing (including a hidden folder) or by picker, and removed.
- [ ] **Notice level**: *All notices* shows everything. *Important only* hides routine confirmations such as "Moved note". *Errors only* shows only errors.
- [ ] With *Errors only*, a name clash or a settings sync change shows no notice, but a failure (for example a malformed `folder.json`) still does.
- [ ] The Hotkeys note is present, and the commands can be given hotkeys in Settings, Hotkeys.

### Domains tab

- [ ] The list shows each domain with its note count.
- [ ] A domain whose folder was deleted shows a warning icon and an explanation.
- [ ] The search box filters as you type and keeps keyboard focus.
- [ ] Sort by path, enabled first and order added each reorder the list.
- [ ] Each domain's mode can be set to **Manual and automatic**, **Manual only** or **Off**.
- [ ] **Off**: filing by domain treats it as unknown.
- [ ] **Manual only**: File note by domain still works, but automatic filing never moves a note to it.
- [ ] **Turn all on** and **Turn all off** act only on the domains matching the search.
- [ ] **Add a domain** opens a searchable picker that does not offer registered or excluded folders.
- [ ] **Add subfolders**: pick a parent folder and see the list of subfolders to add.
- [ ] In the bulk-add dialogue, ticking the nested option adds deeper levels, and excluded or registered folders are never listed.
- [ ] With nothing to add the dialogue says so and the Add button is disabled.
- [ ] Adding reports how many domains were added.
- [ ] Removing a domain asks first, and leaves the folder and notes alone.

### Prompts and confirmations tab

- [ ] The default preset reads **Cautious**.
- [ ] Choosing **Balanced** sets folder creation and registration to automatic, and leaves the rest on ask.
- [ ] Choosing **Hands-off** sets unknown domain to the fallback, several domains to the first, rename preview to automatic, name clash to keep both, and note moved by hand to always update.
- [ ] Changing any single choice makes the preset read **Custom**; choosing a preset again restores it.
- [ ] **Unknown domain** *Send to the fallback folder*: a note with an unregistered domain goes to the fallback with no dialogue.
- [ ] **Unknown domain** *Add it as a domain*: the domain is registered and the note filed, with no dialogue (and no folder is created unless the next setting allows it).
- [ ] With *Add it as a domain*, a domain that is switched off still opens the dialogue and is not turned on silently.
- [ ] **Several domains in one note** *Use the first one*: the note is filed by the first value, with no dialogue, and the property becomes that single value.
- [ ] **Domain folder does not exist** *Create automatically*: adding an unknown domain with no folder creates it without asking.
- [ ] **Folder is not a domain yet** *Register automatically*: Set domain from folder registers the folder without asking.
- [ ] **Name clash** *Keep both notes* and *Skip the note* settle a clash with no dialogue; Replace is never chosen automatically.
- [ ] **After a domain folder is renamed or moved** *Update automatically*: notes are rewritten with no preview, and Undo reverses it.
- [ ] **Skip the preview below this many notes**: with 3, a rename affecting 2 notes applies without a preview, and one affecting 5 shows it.
- [ ] **Note moved by hand** options behave as in the manual-move section above.
- [ ] The **Always asks** list explains that Replace, Import and overwriting a damaged data file are never switched off.
- [ ] Whatever the settings, Replace still needs its second confirmation, and Import still shows the summary.

### Automatic filing tab

- [ ] The toggle and the ribbon icon stay in step.
- [ ] The delay slider changes how long a note waits (try 1 and 10 seconds).
- [ ] **Never move the open note**: with it on, a note open in the editor is not moved until you switch to another note; then it is filed. With it off, it is filed straight away.
- [ ] **Only file notes in the fallback folder**: a note elsewhere is never moved automatically; a note in the fallback folder is.
- [ ] **Also file notes with no domain** works as in the automatic filing section.
- [ ] **Quiet moves**: no notice for a successful automatic move; a name-clash skip still shows one.
- [ ] **Snooze 15 minutes** and **1 hour**: the description shows the minutes left, the ribbon icon changes appearance, and property changes made while paused are not filed.
- [ ] **Resume now** ends the snooze at once.
- [ ] Turning automatic filing off clears any snooze.
- [ ] Right-click the ribbon icon: the menu offers on/off, snooze and resume as appropriate.
- [ ] A restart ends a snooze.

### Data and sync tab

- [ ] Changing the data folder name writes a new file there and leaves the old one.
- [ ] **Actions Undo can reverse**: at 5, file three notes in turn and press Undo three times; each reverses the latest remaining action, and the notice says how many earlier actions remain.
- [ ] Lowering the depth below the number of stored actions drops the oldest.
- [ ] **Reset to defaults** asks first, saves `folder-backup-<date>.json`, then resets everything, including the registry and excluded folders. **Import** of that backup restores them.
- [ ] Cancelling the reset changes nothing.
- [ ] **Sync now**, **Export** and **Import** behave as in the JSON sync section.

## JSON sync

- [ ] Change a setting: `folder.json` updates (check `updatedAt` and the content).
- [ ] Edit `folder.json` by hand to change `propertyName`, then focus Obsidian or press **Sync now**: the settings update, with a notice saying the file was newer.
- [ ] Make the file older than the settings (set `updatedAt` to 2020), then **Sync now**: the file is rewritten, with a notice saying the settings were newer.
- [ ] Delete the whole `.domain` folder while Obsidian is running, then change a setting: the folder and file are recreated.
- [ ] Break the JSON (delete a brace), then **Sync now**: a notice explains the problem, the file is **not** overwritten, and settings are unchanged.
- [ ] In that notice, **Export a fresh file** creates `folder-export-….json` and does not touch `folder.json`.
- [ ] Set `"version": 2`: same behaviour as broken JSON.
- [ ] Set `"notices": "loud"`, `"undoDepth": 2` or `"prompts": {"nameClash": "replace"}`: same behaviour as broken JSON, and the file is not overwritten.
- [ ] A file with none of the newer blocks (`prompts`, `notices`, and so on) loads with the defaults.
- [ ] With **When the settings and the file differ** set to *Always use my settings*, a newer file never overrides your settings; with *Always use the data file*, an older file still wins.
- [ ] With *Ask me each time*, editing the file and pressing **Sync now** opens a dialogue listing the differences. **Use my settings**, **Use the file** and **Decide later** each do what they say, and Decide later does not ask again on the next focus.
- [ ] The conflict policy stored in the file is ignored; only your own setting counts.
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
- [ ] The settings categories appear as a dropdown at the top, and choosing one switches the tab.
- [ ] The domain mode dropdowns, the search box and the sliders are usable with a finger.
- [ ] The bulk-add dialogue and its list scroll and fit the screen.
- [ ] The automatic filing icon is in the ribbon menu, toggles the mode, and shows its state.
- [ ] Snooze can be started and ended from the Automatic filing tab, since right-click may not exist.
- [ ] The sync conflict dialogue (policy *Ask me each time*) fits the screen and its buttons are easy to tap.
- [ ] **Sync now** works, and the app regaining focus (switching away and back) syncs.
- [ ] **Import** opens the device's file picker. If your platform does not offer one, note it.
- [ ] **Export** writes the dated file (check with the file manager if hidden folders are visible).
- [ ] A rename cascade over many notes keeps the interface responsive.
- [ ] Moving the app to the background during a batch does not corrupt notes (check a few).
- [ ] The data file, if in a hidden folder, is not synced by your sync tool. Confirm that matches the README.
