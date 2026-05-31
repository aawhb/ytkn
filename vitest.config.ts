import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
	test: {
		environment: 'jsdom',
		include: ['test/**/*.test.ts'],
		exclude: ['node_modules/**'],
		setupFiles: ['./test/setupTests.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			include: ['src/**/*.ts'],
			exclude: ['src/types.ts'],
		},
	},
	resolve: {
		alias: {
			obsidian: resolve(__dirname, 'test/mocks/obsidian.ts'),
		},
	},
});
