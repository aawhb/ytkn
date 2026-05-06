import { describe, expect, it } from 'vitest';
import {
	buildModelId,
	formatSequenceName,
	getErrorMessage,
	getOllamaBaseUrl,
	getReasoningDescription,
	isOllamaEndpoint,
	normalizeVaultFolderPath,
	resolveUniqueNotePath,
	sanitizeNoteFileName,
} from '../src/utils';
import type { ModelConfig } from '../src/types';

describe('getErrorMessage', () => {
	it('returns the message of an Error', () => {
		expect(getErrorMessage(new Error('boom'))).toBe('boom');
	});

	it('coerces non-Error values to strings', () => {
		expect(getErrorMessage('failed')).toBe('failed');
		expect(getErrorMessage(42)).toBe('42');
		expect(getErrorMessage(undefined)).toBe('undefined');
	});
});

describe('sanitizeNoteFileName', () => {
	it('strips invalid filesystem characters and trims whitespace', () => {
		expect(sanitizeNoteFileName('  My:/\\*?"<>| Video.  ')).toBe('My Video');
	});

	it('returns an empty string when nothing is left after sanitisation', () => {
		expect(sanitizeNoteFileName('   ')).toBe('');
		expect(sanitizeNoteFileName('///')).toBe('');
	});

	it('rewrites Windows reserved device names so the file can be created on NTFS', () => {
		expect(sanitizeNoteFileName('CON')).toBe('CON note');
		expect(sanitizeNoteFileName('aux')).toBe('aux note');
		expect(sanitizeNoteFileName('LPT3')).toBe('LPT3 note');
	});

	it('leaves names containing reserved words alone when they are not exact matches', () => {
		expect(sanitizeNoteFileName('Confidential')).toBe('Confidential');
		expect(sanitizeNoteFileName('NUL bug report')).toBe('NUL bug report');
	});

	it('strips ASCII control characters', () => {
		expect(sanitizeNoteFileName(`Hi${String.fromCharCode(0)}there`)).toBe('Hi there');
		expect(sanitizeNoteFileName(`Tab	here`)).toBe('Tab here');
	});
});

describe('resolveUniqueNotePath', () => {
	it('returns the desired path when nothing exists', () => {
		expect(resolveUniqueNotePath('Notes', 'Video', 'md', '', () => false)).toBe('Notes/Video.md');
	});

	it('returns the current path when the desired title already matches it', () => {
		expect(resolveUniqueNotePath('Notes', 'Video', 'md', 'Notes/Video.md', () => true)).toBe('Notes/Video.md');
	});

	it('adds a numeric suffix when the desired note name already exists', () => {
		const existing = new Set(['Notes/Video.md', 'Notes/Video 2.md']);
		expect(resolveUniqueNotePath('Notes', 'Video', 'md', 'Notes/Current.md', (path) => existing.has(path))).toBe('Notes/Video 3.md');
	});

	it('drops the directory prefix when no folder is given', () => {
		expect(resolveUniqueNotePath('', 'Video', 'md', '', () => false)).toBe('Video.md');
	});

	it('throws after exhausting the suffix cap rather than looping forever', () => {
		expect(() =>
			resolveUniqueNotePath('Notes', 'Video', 'md', '', () => true),
		).toThrow(/Could not find a unique note path/);
	});
});

describe('normalizeVaultFolderPath', () => {
	it('trims whitespace and surrounding slashes', () => {
		expect(normalizeVaultFolderPath('  /YouTube Notes/Nested/  ')).toBe('YouTube Notes/Nested');
	});

	it('returns an empty string when only slashes are present', () => {
		expect(normalizeVaultFolderPath('/')).toBe('');
		expect(normalizeVaultFolderPath('////')).toBe('');
	});
});

describe('formatSequenceName', () => {
	it('pads indices to at least two digits', () => {
		expect(formatSequenceName('Playlist Name', 2, 12)).toBe('Playlist Name 02');
	});

	it('uses the wider of total or index when computing pad width', () => {
		expect(formatSequenceName('Playlist Name', 5, 100)).toBe('Playlist Name 005');
		expect(formatSequenceName('Playlist Name', 250, 5)).toBe('Playlist Name 250');
	});
});

describe('reasoning helpers', () => {
	it('describes reasoning state for known models', () => {
		expect(getReasoningDescription('gpt-5', 'supported')).toContain('advertises reasoning support');
		expect(getReasoningDescription('gpt-5', 'unsupported')).toContain('forced off');
		expect(getReasoningDescription('gpt-5', 'unknown')).toContain('unknown reasoning support');
	});

	it('returns a neutral hint when no model is selected', () => {
		expect(getReasoningDescription(null, 'unknown')).toMatch(/Select an active model/);
	});
});

describe('buildModelId', () => {
	const sample = (providerName: string, modelName: string): ModelConfig => ({
		name: modelName,
		reasoningSupport: 'unknown',
		provider: { name: providerName, type: 'openai', apiKey: '' },
	});

	it('joins the provider and model with a colon, in that order', () => {
		expect(buildModelId(sample('OpenAI', 'gpt-4'))).toBe('OpenAI:gpt-4');
	});

	it('preserves embedded colons inside the model name (so it can round-trip uniquely)', () => {
		expect(buildModelId(sample('Ollama', 'qwen3:4b'))).toBe('Ollama:qwen3:4b');
	});

	it('produces stable ids regardless of optional displayName/contextWindow', () => {
		const a = buildModelId({ ...sample('OpenAI', 'gpt-4'), displayName: 'GPT-4' });
		const b = buildModelId({ ...sample('OpenAI', 'gpt-4'), contextWindow: 64000 });
		expect(a).toBe(b);
	});
});

describe('Ollama endpoint detection', () => {
	it('treats *://*/v1 and ollama-shaped URLs as Ollama endpoints', () => {
		expect(isOllamaEndpoint('http://localhost:11434/v1')).toBe(true);
		expect(isOllamaEndpoint('http://my-ollama-host/v1')).toBe(true);
		expect(isOllamaEndpoint('http://localhost:11434')).toBe(true);
		expect(isOllamaEndpoint('https://api.openai.com/v1')).toBe(true); // /v1 wins
	});

	it('does not match unrelated URLs', () => {
		expect(isOllamaEndpoint('https://example.com/openai')).toBe(false);
	});

	it('strips the trailing /v1 from an Ollama base URL', () => {
		expect(getOllamaBaseUrl('http://localhost:11434/v1')).toBe('http://localhost:11434');
		expect(getOllamaBaseUrl('http://localhost:11434/v1/')).toBe('http://localhost:11434/v1/');
	});
});
