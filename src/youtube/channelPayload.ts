import { normalizeHtmlText } from './metadata';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null;
}

function walkJson(value: unknown, visit: (node: JsonObject) => boolean | void): void {
	if (Array.isArray(value)) {
		for (const child of value) {
			walkJson(child, visit);
		}
		return;
	}

	if (!isObject(value) || visit(value) === false) {
		return;
	}

	for (const child of Object.values(value)) {
		walkJson(child, visit);
	}
}

export function channelIdFromResolvePayload(payload: unknown): string | null {
	let channelId: string | null = null;
	walkJson(payload, (node) => {
		if (channelId || !isObject(node.browseEndpoint)) {
			return !channelId;
		}

		const browseId = node.browseEndpoint.browseId;
		if (typeof browseId === 'string' && /^UC[a-zA-Z0-9_-]+$/.test(browseId)) {
			channelId = browseId;
			return false;
		}
		return true;
	});
	return channelId;
}

export function channelTitleFromBrowsePayload(payload: unknown): string | null {
	let title: string | null = null;
	walkJson(payload, (node) => {
		if (title) {
			return false;
		}

		if (isObject(node.channelMetadataRenderer) && typeof node.channelMetadataRenderer.title === 'string') {
			title = normalizeHtmlText(node.channelMetadataRenderer.title);
			return false;
		}

		if (isObject(node.pageHeaderRenderer) && typeof node.pageHeaderRenderer.pageTitle === 'string') {
			title = normalizeHtmlText(node.pageHeaderRenderer.pageTitle);
			return false;
		}
		return true;
	});
	return title;
}
