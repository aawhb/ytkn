interface AiOutputFlags {
	generateAiSummary: boolean;
	tldrCalloutAtTop: boolean;
	includeMindmap: boolean;
	includeMemorableQuotes: boolean;
}

export interface AiExecutionFlags extends AiOutputFlags {
	useAi: boolean;
}

function hasAiOutputs(options: AiOutputFlags): boolean {
	return options.generateAiSummary
		|| options.tldrCalloutAtTop
		|| options.includeMindmap
		|| options.includeMemorableQuotes;
}

export function shouldUseAi(options: AiExecutionFlags): boolean {
	return options.useAi && hasAiOutputs(options);
}

export function shouldGenerateAiSummary(options: AiExecutionFlags): boolean {
	return shouldUseAi(options) && options.generateAiSummary;
}

export function resolveLegacyUseAi(
	options: { useAi?: boolean; generateAiSummary?: boolean },
	fallback: boolean,
): boolean {
	return options.useAi ?? options.generateAiSummary ?? fallback;
}
