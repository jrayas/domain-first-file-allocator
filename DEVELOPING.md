# Developing

Notes for anyone who wants to build, change or release the plugin. If you only want to use it, the [README](README.md) is enough.

## Build and test

You need Node.js 18 or later.

```
npm install
npm run build     # type-check, then produce main.js
npm test          # run the unit tests (vitest)
npm run lint      # ESLint, with Obsidian's own review rules
npm run dev       # rebuild on change
```

To try a build in Obsidian, copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/domain-first-file-allocator/`, then reload Obsidian and enable the plugin. Use a test vault, not your real one.

The project needs Obsidian 1.13.1 or later at run time, because the settings use Obsidian's declarative settings API.

Two quirks of the toolchain:

- `.npmrc` sets `legacy-peer-deps=true`, because the Obsidian lint plugin pins older peer dependencies. `vite` is listed explicitly for the same reason: vitest needs it.
- `main.js` is a build product. It is git-ignored and is attached to each release.

## How the code is laid out

```
src/
  main.ts          the plugin: commands, ribbon icon, snooze, saving settings
  types.ts         the settings types and constants
  core/            pure logic, no Obsidian imports (covered by the tests)
  services/        everything that touches the vault or the editor
  ui/              the popup dialogues
  settings/        the settings screen, one file per page
tests/             unit tests for core/
```

- **`core/`** decides things and imports nothing from `obsidian`, which ESLint enforces. It holds path handling (`paths`), the domain registry (`registry`), reading a domain value (`domainValue`), the choice of what automatic filing should do (`autoDecision`), settings defaults and parsing (`defaults`, `preferences`), the data file format and merging (`jsonSchema`, `merge`, `conflicts`), the popup presets (`presets`), the undo stack (`undoStack`), and `bindings`, which links settings controls to settings values with validation.
- **`services/`** acts on the vault. `allocator` files notes and sets domains, `autoFiler` reacts to edits, `folderEvents` handles folder renames and hand-moved notes, `jsonSync` mirrors the settings to `folder.json`, `undo` reverses actions, and `vaultOps` wraps folder lookups and moves. Moves use `fileManager.renameFile` and frontmatter changes use `fileManager.processFrontMatter`.
- **`ui/`** holds the dialogues. Each one is a promise-returning modal built on `DecisionModal`.
- **`settings/`** returns Obsidian's declarative setting definitions, one page per file. A control reads and writes its value through `core/bindings`, so the screen never holds a copy that could go stale.

Rules the code follows:

- Obsidian API only, with no Node or Electron imports, so it works on mobile.
- TypeScript `strict`, no `any`.
- UI text in British English and sentence case.
- Anything that can delete or overwrite data needs a confirmation and an undo path.
- Never overwrite a data file that cannot be read.

## Testing

- `npm test` runs the unit tests for `core/`.
- [TESTING.md](TESTING.md) is the manual checklist to run in Obsidian before a release: settings pages, each feature, lifecycle (enable and disable), themes, mobile emulation and developer-console checks.

## Releasing

1. Make the version in `manifest.json`, `package.json` and `package-lock.json` the same, and add a line to `versions.json` that maps the new version to its minimum Obsidian version. Set `minAppVersion` from what the `obsidianmd/no-unsupported-api` lint rule reports, not by guess.
2. Run `npm run lint`, `npm test` and `npm run build`, and the checklist in `TESTING.md`.
3. Commit and push to `main`.
4. Create and push a tag that equals the manifest version, with no `v` prefix, for example `git tag 1.1.0 && git push origin 1.1.0`.

Pushing the tag starts `.github/workflows/release.yml`, which checks the tag against the manifest, runs the tests and the build, attests `main.js`, `manifest.json` and `styles.css`, and publishes a GitHub release with those three files. Check it afterwards with `gh release view <version>` and `gh attestation verify main.js --repo jrayas/domain-first-file-allocator`.

Never move or reuse a tag. If a released version is wrong, release a new one.

## Community directory

The plugin is listed in the Obsidian community directory, which reads `manifest.json` from the default branch and installs from the GitHub release whose tag matches the manifest version. The directory runs an automated review on each release, and its notes appear on the plugin's page there.
