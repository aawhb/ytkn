import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

describe('manifest.json', () => {
	it('does not include unsupported Obsidian manifest fields', () => {
		const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as Record<string, unknown>;

		expect(manifest).not.toHaveProperty('main');
	});
});
