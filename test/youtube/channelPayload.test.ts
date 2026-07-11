import { describe, expect, it } from 'vitest';
import {
	channelIdFromResolvePayload,
	channelTitleFromBrowsePayload,
} from '../../src/youtube/channelPayload';

describe('channel payload parsing', () => {
	it('extracts a channel ID from resolve_url and a title from channel metadata', () => {
		expect(channelIdFromResolvePayload({
			endpoint: { browseEndpoint: { browseId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw' } },
		})).toBe('UC_x5XG1OV2P6uZZ5FSM9Ttw');

		expect(channelTitleFromBrowsePayload({
			metadata: { channelMetadataRenderer: { title: 'Google &amp; Developers' } },
		})).toBe('Google & Developers');
	});
});
