# Troubleshooting

## Nothing happens

**Nothing happens when I run a command.** The commands appear only when a Markdown note is active. Click into the note first.

**A note was not filed automatically.** Automatic filing may be switched off (check the ribbon icon, which is highlighted when on, or the Automatic filing page). The domain may be unknown, off, or set to *Manual only*; a notice normally says which. The note may be open in the editor while **Never move the open note** is on (it is filed when you switch away); it may be outside the fallback folder while **Only file notes in the fallback folder** is on; or automatic filing may be snoozed.

**A note with an empty domain did not go to the fallback.** Check that automatic filing and **Also file notes with no domain** are on, that the fallback folder is turned on, and that the note is not in an excluded folder or opted out. An existing note is only checked when you open it, and only if the domain property is present but empty; a note with no property at all is only moved when it is created. You can always run **File note by domain**.

**New notes are not getting a domain property.** Check that **Add the domain property to new notes** is on, on the General page. It is on for new installs, but an install that saved its settings in an earlier version keeps its own choice. Notes that already have the property (for example from a template) are left alone on purpose, and notes in excluded folders are skipped.

**I updated the plugin and automatic filing is still off.** The new defaults apply to a fresh install. If you saved settings before, your earlier choice is kept: turn on **File notes automatically** and turn off **Never move the open note** on the Automatic filing page, or select the ribbon icon.

## Notices

**"Left alone" notice.** The note is in an excluded folder (including the data folder), or has `skip-allocator: true`.

**The note went to the fallback folder.** Its domain is empty, not registered, or disabled. Register or enable the domain in settings, or use the unknown-domain dialogue's **Add this domain** button.

**I do not see notices any more.** Check **Notice level** on the General page. Errors are always shown.

## Popups

**The folder-move prompt stopped appearing.** You chose "Don't ask again". Set **Note moved by hand into a domain folder** back to Ask on the Prompts and confirmations page.

**A popup I expect does not appear.** A preset or an individual choice on the Prompts and confirmations page may be set to automatic. Choose the **Cautious** preset to ask about everything again.

## Settings and the data file

**"The data file is unusable" notice.** `folder.json` is not valid JSON, or its version is not 1. The plugin has left it alone. Fix it by hand, or press **Export a fresh file** in the notice and replace it.

**My settings changed by themselves.** The data file was newer than your settings, so it was applied. The notice said so when it happened. Use **Export** before editing the file by hand if you want a restore point.

**Edits to `.domain/folder.json` are not picked up.** Hidden files do not raise change events. Switch away from and back to Obsidian, or press **Sync now**.

**A domain has a warning icon.** Its folder no longer exists, perhaps because it was renamed while the plugin was disabled. Remove the domain and add the folder again.

**Reset removed my domains.** Reset also clears the registry. A backup named `folder-backup-<date>.json` was saved beside the data file; use **Import** to bring it back.

## Still stuck?

Open an issue at https://github.com/jrayas/domain-first-file-allocator/issues. Say which Obsidian version and platform you use, and what you expected to happen. If Obsidian's developer console (Ctrl+Shift+I, or Cmd+Option+I on a Mac) shows an error from this plugin, include it.
