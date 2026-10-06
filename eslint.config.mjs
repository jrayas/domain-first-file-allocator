import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{ ignores: ["main.js", "node_modules/**", "esbuild.config.mjs", "eslint.config.mjs"] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["src/**/*.ts"],
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
			"no-restricted-imports": ["error", { paths: ["obsidian"] }],
		},
	},
);
