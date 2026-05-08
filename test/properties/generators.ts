import fc from 'fast-check';

const SAFE_TEXT_CHARS = Array.from(
	"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?'()-_/",
);
const YOUTUBE_ID_CHARS = Array.from(
	'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_',
);

export const safeLineArbitrary = fc
	.array(fc.constantFrom(...SAFE_TEXT_CHARS), { minLength: 1, maxLength: 48 })
	.map((chars) => chars.join('').replace(/\s+/g, ' ').trim())
	.filter(Boolean);

export const safeParagraphArbitrary = fc
	.array(safeLineArbitrary, { minLength: 1, maxLength: 4 })
	.map((lines) => lines.join('\n'));

export const youtubeVideoIdArbitrary = fc
	.array(fc.constantFrom(...YOUTUBE_ID_CHARS), { minLength: 11, maxLength: 11 })
	.map((chars) => chars.join(''));

export const youtubePlaylistIdArbitrary = fc
	.array(fc.constantFrom(...YOUTUBE_ID_CHARS), { minLength: 3, maxLength: 24 })
	.map((chars) => chars.join(''));

export const transcriptTextArbitrary = fc
	.array(fc.constantFrom(...SAFE_TEXT_CHARS), { minLength: 1, maxLength: 40 })
	.map((chars) => chars.join('').replace(/\s+/g, ' ').trim())
	.filter(Boolean);
