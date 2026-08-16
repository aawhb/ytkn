import { describe, expect, it } from 'vitest';
import { renderVideoNote } from '../../src/rendering/videoNote';

const transcript = {
	url: 'https://youtube.com/watch?v=abc',
	videoId: 'abc',
	title: 'Test',
	author: 'Author',
	channelId: 'UC123',
	channelUrl: 'https://youtube.com/channel/x',
	description: 'Description',
	thumbnailUrl: 'https://img.youtube.com/vi/abc/hqdefault.jpg',
	uploadDate: '2024-03-05',
	videoCategory: 'Education',
	durationSeconds: 60,
	keywords: ['one', 'two'],
	lines: [],
};

const baseOptions = {
	includeFrontmatter: true,
	tldrCalloutAtTop: false,
};

describe('sacred-key allowlist', () => {
	it('undefined allowlist emits all default sacred keys', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'',
			transcript.url,
			null,
			{ ...baseOptions, frontmatterPropertyAllowlist: undefined },
		);

		expect(content).toContain('videoId:');
		expect(content).toContain('channel:');
		expect(content).toContain('channelId:');
		expect(content).toContain('thumbnailUrl:');
		expect(content).toContain('videoDescription:');
		expect(content).toContain('uploadDate:');
		expect(content).toContain('videoCategory:');
		expect(content).toContain('durationSeconds:');
		expect(content).toContain('keywords:');
		expect(content).toContain('generated:');
	});

	it('empty string allowlist suppresses all sacred keys', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'',
			transcript.url,
			null,
			{ ...baseOptions, frontmatterPropertyAllowlist: '' },
		);

		expect(content).not.toContain('videoId:');
		expect(content).not.toContain('channel:');
		expect(content).not.toContain('thumbnailUrl:');
		expect(content).not.toContain('uploadDate:');
		expect(content).not.toContain('videoCategory:');
		expect(content).not.toContain('durationSeconds:');
		expect(content).not.toContain('generated:');
	});

	it('pruned allowlist emits only listed keys', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'',
			transcript.url,
			null,
			{ ...baseOptions, frontmatterPropertyAllowlist: 'title channel' },
		);

		expect(content).toContain('channel:');
		expect(content).not.toContain('videoId:');
		expect(content).not.toContain('thumbnailUrl:');
		expect(content).not.toContain('generated:');
	});

	it('removing aliases from allowlist suppresses aliases', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'',
			transcript.url,
			null,
			{ ...baseOptions, frontmatterPropertyAllowlist: 'title channel videoId' },
		);

		expect(content).not.toContain('aliases:');
	});

	it('emits valid custom properties as blank YAML entries', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'',
			transcript.url,
			null,
			{ ...baseOptions, frontmatterPropertyAllowlist: 'videoId notakey channel' },
		);

		expect(content).toContain('videoId:');
		expect(content).toContain('channel:');
		expect(content).toContain('\nnotakey:\n');
	});

	it('ignores invalid and reserved custom properties', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'',
			transcript.url,
			null,
			{ ...baseOptions, frontmatterPropertyAllowlist: 'videoId bad:key tags' },
		);

		expect(content).toContain('videoId:');
		expect(content).not.toContain('bad:key:');
		expect(content).not.toContain('\ntags:\n');
	});

	it('emits built-in properties in allowlist order and keeps tags after identity fields', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'',
			transcript.url,
			null,
			{
				...baseOptions,
				frontmatterPropertyAllowlist: 'videoId channel title aliases source',
				frontmatterTags: 'youtube',
			},
		);

		const keys = ['videoId:', 'channel:', 'title:', 'aliases:', 'tags:', 'source:'];
		expect(keys.map((key) => content.indexOf(key))).toEqual(
			[...keys].map((key) => content.indexOf(key)).sort((a, b) => a - b),
		);
	});

	it('thumbnailUrl is emitted when explicitly allowlisted', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'',
			transcript.url,
			null,
			{ ...baseOptions, frontmatterPropertyAllowlist: 'thumbnailUrl' },
		);

		expect(content).toContain('thumbnailUrl: "https://img.youtube.com/vi/abc/hqdefault.jpg"');
	});

	it('fragment mode ignores allowlist entirely (no frontmatter)', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'',
			transcript.url,
			null,
			{ ...baseOptions, frontmatterPropertyAllowlist: 'title channel videoId generated' },
			null,
			'fragment',
		);

		expect(content).not.toContain('---');
		expect(content).not.toContain('videoId:');
	});
});
