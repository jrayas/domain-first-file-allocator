import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

// Source files get Obsidian's own recommended rules, the ones plugin reviewers apply, with the
// project's two extra rules: no Node or Electron imports, and no Obsidian imports in src/core.
export default defineConfig([
	{ ignores: ["main.js", "node_modules/**", "esbuild.config.mjs", "eslint.config.mjs", "vitest.config.ts"] },
	{
		files: ["src/**/*.ts"],
		extends: [...obsidianmd.configs.recommended],
		languageOptions: {
			parserOptions: {
				projectService: { allowDefaultProject: ["eslint.config.*"] },
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			"@typescript-eslint/no-explicit-any": "error",
			"no-restricted-imports": [
				"error",
				{ paths: ["fs", "path", "os", "electron", "child_process", "node:fs", "node:path"] },
			],
		},
	},
	{
		files: ["src/core/**/*.ts"],
		rules: {
			"no-restricted-imports": [
				"error",
				{ paths: ["obsidian", "fs", "path", "os", "electron", "child_process", "node:fs", "node:path"] },
			],
		},
	},
	{
		files: ["tests/**/*.ts"],
		extends: [tseslint.configs.recommended],
	},
]);
