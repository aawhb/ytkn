import type { ModelConfig } from './types';

export function formatModelId(providerName: string, modelName: string): string {
	return `${providerName}:${modelName}`;
}

export function parseModelId(modelId: string): { providerName: string; modelName: string } | null {
	/* The first colon separates providers from model names containing later colons. */
	const separatorIndex = modelId.indexOf(':');
	if (separatorIndex <= 0) {
		return null;
	}

	const providerName = modelId.slice(0, separatorIndex);
	const modelName = modelId.slice(separatorIndex + 1);
	return modelName ? { providerName, modelName } : null;
}

export function buildModelId(model: ModelConfig): string {
	return formatModelId(model.provider.name, model.name);
}
