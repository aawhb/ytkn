import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestUrlMock = vi.hoisted(() => vi.fn());

vi.mock('obsidian', () => ({
	requestUrl: requestUrlMock,
}));

import {
	requestContinuation,
	requestOEmbedTitle,
	requestPlayer,
	requestPlaylistBrowse,
	requestSupplementalVideoMetadata,
} from '../../src/youtube/innertube';

describe('InnerTube request wrappers', () => {
	beforeEach(() => {
		requestUrlMock.mockReset();
	});

	it('requests player data and rejects unplayable videos', async () => {
		requestUrlMock.mockResolvedValueOnce({ text: JSON.stringify({ playabilityStatus: { status: 'OK' } }) });

		await expect(requestPlayer('abc123')).resolves.toEqual({ playabilityStatus: { status: 'OK' } });
		expect(requestUrlMock.mock.calls[0][0]).toMatchObject({
			method: 'POST',
			headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
		});
		expect(JSON.parse(requestUrlMock.mock.calls[0][0].body)).toMatchObject({ videoId: 'abc123' });

		requestUrlMock.mockResolvedValueOnce({ text: JSON.stringify({ playabilityStatus: { status: 'LOGIN_REQUIRED' } }) });
		await expect(requestPlayer('private')).rejects.toThrow('requires login');
	});

	it('returns supplemental metadata or an empty object on failure', async () => {
		requestUrlMock.mockResolvedValueOnce({
			text: JSON.stringify({
				microformat: { playerMicroformatRenderer: { uploadDate: '2025-01-02', category: 'Education' } },
			}),
		});
		await expect(requestSupplementalVideoMetadata('abc')).resolves.toEqual({
			uploadDate: '2025-01-02',
			videoCategory: 'Education',
		});

		requestUrlMock.mockRejectedValueOnce(new Error('network'));
		await expect(requestSupplementalVideoMetadata('abc')).resolves.toEqual({});
	});

	it('requests playlist browse and continuation payloads', async () => {
		requestUrlMock.mockResolvedValue({ text: '{"ok":true}' });

		await expect(requestPlaylistBrowse('PL123')).resolves.toEqual({ ok: true });
		expect(JSON.parse(requestUrlMock.mock.calls[0][0].body)).toMatchObject({ browseId: 'VLPL123' });

		await expect(requestContinuation('token')).resolves.toEqual({ ok: true });
		expect(JSON.parse(requestUrlMock.mock.calls[1][0].body)).toMatchObject({ continuation: 'token' });
	});

	it('reads oEmbed titles from requestUrl json', async () => {
		requestUrlMock.mockResolvedValueOnce({ json: { title: 'Video title' }, text: '' });

		await expect(requestOEmbedTitle('abc123')).resolves.toBe('Video title');
		expect(requestUrlMock.mock.calls[0][0].method).toBe('GET');
	});
});
