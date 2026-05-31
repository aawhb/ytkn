export interface ExtractedTldr {
    tldr: string | null;
    body: string;
}

export function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_match: string, code: string) => String.fromCharCode(Number.parseInt(code, 10)));
}

export function normalizeMermaidBlocks(summaryText: string): string {
    return summaryText.replace(/```mermaid\s*\n([\s\S]*?)```/gi, (block, mermaidBody: string) => {
        const normalizedBody = decodeHtmlEntities(mermaidBody);
        return block.replace(mermaidBody, normalizedBody);
    });
}

export function normalizeMemorableQuotesSection(body: string): string {
    return body.replace(
        /(##\s+Memorable quotes\s*\n)([\s\S]*?)(?=\n##\s|$)/i,
        (_match, heading: string, content: string) => {
            const quoteRegex = /(?:>?\s*)\[!quote\]\s*(.+?)\s*$/gm;
            const matches = Array.from(content.matchAll(quoteRegex));
            if (matches.length === 0) return `${heading}${content}`;
            const rebuilt = matches.map((m) => `> [!quote] ${m[1].trim()}`).join('\n\n');
            return `${heading}${rebuilt}`;
        },
    );
}

export function sanitizeModelOutput(summaryText?: string | null): string {
    return normalizeMemorableQuotesSection(
        normalizeMermaidBlocks(summaryText ?? '')
            .replace(/\n## Source\b[\s\S]*$/i, '')
            .replace(/\n##\s*(?:Full\s+)?Transcript\b[\s\S]*$/i, '')
            .replace(/\n?<details>\s*<summary>\s*Transcript\s*<\/summary>[\s\S]*?<\/details>/gi, '')
            .replace(/\n?<details>\s*<summary>\s*Playlist transcripts\s*<\/summary>[\s\S]*?<\/details>/gi, '')
            .trim(),
    );
}

export function extractTldr(summaryText: string): ExtractedTldr {
    const match = summaryText.match(/^[ \t]*##[ \t]+TL;DR[ \t]*\n([\s\S]*?)(?=\n##\s|$)/im);
    if (match) {
        const tldr = match[1].trim();
        if (tldr) {
            const before = summaryText.slice(0, match.index ?? 0).trimEnd();
            const after = summaryText.slice((match.index ?? 0) + match[0].length).trimStart();
            const body = [before, after].filter(Boolean).join('\n\n');
            return { tldr, body };
        }
    }

    const firstParagraphMatch = summaryText.match(/^(?!#).+?(?=\n\n|\n#|$)/sm);
    if (firstParagraphMatch && firstParagraphMatch[0].trim()) {
        const tldr = firstParagraphMatch[0].trim();
        const before = summaryText.slice(0, firstParagraphMatch.index ?? 0).trimEnd();
        const after = summaryText.slice((firstParagraphMatch.index ?? 0) + firstParagraphMatch[0].length).trimStart();
        const body = [before, after].filter(Boolean).join('\n\n');
        return { tldr, body };
    }

    return { tldr: null, body: summaryText };
}

export function buildTldrCallout(tldr: string): string {
    const lines = tldr.split('\n').map((line) => `> ${line}`.trimEnd());
    return ['> [!summary] TL;DR', ...lines].join('\n');
}

export function shiftMarkdownHeadings(text: string, levels: number): string {
    const extra = '#'.repeat(levels);
    let inCodeBlock = false;
    return text.split('\n').map((line) => {
        if (line.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
        }
        if (!inCodeBlock && /^#{1,6} /.test(line)) {
            return extra + line;
        }
        return line;
    }).join('\n');
}