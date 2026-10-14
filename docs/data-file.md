# The data file (`folder.json`)

The settings are mirrored to `<data folder name>/folder.json` in the vault root (by default `.domain/folder.json`), and created automatically if missing. You can use it to back up your settings or share them between vaults.

```json
{
  "version": 1,
  "updatedAt": "2026-10-07T12:00:00.000Z",
  "propertyName": "domain",
  "fallback": { "enabled": true, "folder": "Inbox" },
  "excludeFolders": ["Templates"],
  "folderMovePrompt": "always",
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
  "addPropertyToNewNotes": true,
  "conflictPolicy": "newest",
  "undoDepth": 1,
  "domains": [
    { "folder": "Areas/Finance", "enabled": true },
    { "folder": "Areas/Private", "enabled": true, "allowAuto": false }
  ]
}
```

Everything after `folderMovePrompt` is optional, so files written by earlier versions still load, with the defaults shown (except `addPropertyToNewNotes`, which counts as `false` when the key is missing, because such a file was written before the setting existed), and the version stays 1. A domain's `allowAuto` is written only when it is `false` (Manual only).

## Allowed values

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

## Sync rules

- The settings and the file each carry `updatedAt`. By default **the most recently updated one wins**, and a notice says which side was used. If they differ but have the same timestamp, the settings win. You can instead choose to always use your settings, always use the file, or be asked each time (the policy is your own local choice, and the one stored in the file is not used to decide).
- When you are asked and choose **Decide later**, nothing changes and you are not asked again until one side changes.
- Syncing happens when the plugin loads, when you change a setting, when the app window regains focus, and when you press **Sync now**.
- If the file is malformed or has an unknown `version`, the plugin **never overwrites it**. It shows a notice, keeps your current settings, and offers to export a fresh file under a different name.
- Duplicate domain entries in the file are merged, and reported when you press **Sync now**.

Obsidian Sync does not sync hidden folders such as `.domain` by default. If you use the file to share settings between devices, either choose a data folder name that is not hidden (for example `Domain settings`, which is excluded from filing automatically) or check your sync tool's settings.
