import { Setting } from 'obsidian';
import type { ModelConfig } from '../../types';
import { buildModelId } from '../../modelId';

interface ModelChainRowsOptions {
	availableModels: ModelConfig[];
	modelIds: string[];
	onChange: (next: string[]) => void;
}

export function renderModelChainRows(containerEl: HTMLElement, options: ModelChainRowsOptions): void {
	const { availableModels, modelIds, onChange } = options;
	const modelsById = new Map(availableModels.map((model) => [buildModelId(model), model]));

	modelIds.forEach((modelId, index) => {
		const model = modelsById.get(modelId);
		if (!model) {
			return;
		}

		const row = new Setting(containerEl)
			.setName(model.displayName || model.name)
			.setDesc(model.provider.name);
		row.settingEl.addClass('ytkn-model-chain__row');

		row.addExtraButton((button) => button
			.setIcon('arrow-up')
			.setTooltip('Move up')
			.setDisabled(index === 0)
			.onClick(() => {
				if (index === 0) return;
				const next = [...modelIds];
				[next[index - 1], next[index]] = [next[index], next[index - 1]];
				onChange(next);
			}));
		row.addExtraButton((button) => button
			.setIcon('arrow-down')
			.setTooltip('Move down')
			.setDisabled(index === modelIds.length - 1)
			.onClick(() => {
				if (index === modelIds.length - 1) return;
				const next = [...modelIds];
				[next[index], next[index + 1]] = [next[index + 1], next[index]];
				onChange(next);
			}));
		row.addExtraButton((button) => button
			.setIcon('x')
			.setTooltip('Remove')
			.onClick(() => {
				onChange(modelIds.filter((id) => id !== modelId));
			}));
	});
}
