import { describe, expect, it } from 'vitest';
import { renderVideoNote } from '../../src/services/renderer';

const transcript = {
	url: 'https://youtube.com/watch?v=abc',
	videoId: 'abc',
	title: 'Test',
	author: 'Author',
	channelId: 'UC123',
	channelUrl: 'https://youtube.com/channel/x',
	description: 'Description',
	thumbnailUrl: 'https://img.youtube.com/vi/abc/hqdefault.jpg',
	durationSeconds: 60,
	keywords: ['one', 'two'],
	lines: [],
};

const baseOptions = {
	includeFrontmatter: true,
	linkbackStyle: 'frontmatter' as const,
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

	it('unknown key in allowlist input silently ignored (valid keys still emitted)', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'',
			transcript.url,
			null,
			{ ...baseOptions, frontmatterPropertyAllowlist: 'videoId notakey channel' },
		);

		expect(content).toContain('videoId:');
		expect(content).toContain('channel:');
		expect(content).not.toContain('notakey:');
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
