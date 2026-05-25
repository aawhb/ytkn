import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { defineConfig, globalIgnores } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
import tseslint from 'typescript-eslint';

const rootDir = dirname(fileURLToPath(import.meta.url));
const obsidianRulesOff = Object.fromEntries(
	Object.keys(obsidianmd.rules).map((ruleName) => [`obsidianmd/${ruleName}`, 'off']),
);
const scopedObsidianRecommended = obsidianmd.configs.recommended.map((config) => {
	const hasObsidianRules = Object.keys(config.rules ?? {}).some((ruleName) =>
		ruleName.startsWith('obsidianmd/'),
	);
	if (!config.files && hasObsidianRules) {
		return {
			...config,
			files: ['**/*.ts', '**/*.tsx'],
		};
	}
	return config;
});

export default defineConfig([
	globalIgnores([
		'.git/**',
		'node_modules/**',
		'LICENSE',
		'coverage/**',
		'dist/**',
		'build/**',
		'main.js',
		'*.map',
		'package-lock.json',
	]),
	...scopedObsidianRecommended,
	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: './tsconfig.eslint.json',
				tsconfigRootDir: rootDir,
			},
		},
		rules: {
			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
			'obsidianmd/ui/sentence-case': ['error', {
				acronyms: ['AI', 'API', 'BRAT', 'HTTP', 'HTTPS', 'ID', 'IDs', 'TL;DR', 'URL', 'URLs', 'YAML'],
				brands: ['Anthropic', 'Dataview', 'Gemini', 'LM Studio', 'Ollama', 'OpenAI', 'YouTube', 'YT Knowledge Notes'],
			}],
			'no-undef': 'off',
			'no-prototype-builtins': 'off',
		},
	},
	{
		files: ['test/**/*.ts'],
		rules: {
			...obsidianRulesOff,
			'import/no-nodejs-modules': 'off',
			'@typescript-eslint/no-unnecessary-type-assertion': 'off',
			'@typescript-eslint/prefer-promise-reject-errors': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-misused-promises': 'off',
			'@typescript-eslint/no-floating-promises': 'off',
			'@typescript-eslint/unbound-method': 'off',
		},
	},
	{
		files: ['*.mjs', 'scripts/**/*.mjs', 'scripts/**/*.js', 'vitest.config.ts'],
		languageOptions: {
			parserOptions: {
				project: false,
				projectService: false,
				program: null,
			},
			globals: {
				console: 'readonly',
				process: 'readonly',
				require: 'readonly',
				Buffer: 'readonly',
				URL: 'readonly',
			},
		},
		rules: {
			...tseslint.configs.disableTypeChecked.rules,
			...obsidianRulesOff,
			'import/no-nodejs-modules': 'off',
			'@typescript-eslint/no-require-imports': 'off',
		},
	},
]);
