import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
	test: {
		environment: 'jsdom',
		include: ['test/**/*.test.ts'],
		exclude: ['node_modules/**'],
		setupFiles: ['./test/setupTests.ts'],
	},
	resolve: {
		alias: {
			obsidian: resolve(__dirname, 'test/mocks/obsidian.ts'),
		},
	},
});
