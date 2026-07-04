import { Setting } from 'obsidian';
import type { ModelConfig } from '../../types';
import { buildModelId } from '../../modelId';
import { SETTING_COPY } from './settingCopy';

export interface ModelChainRowsOptions {
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
			.setName(`${index + 1}. ${model.provider.name} / ${model.displayName || model.name}`);
		row.settingEl.addClass('ytkn-model-chain__row');

		row.addButton((button) => button
			.setButtonText('↑')
			.setTooltip('Move up')
			.setDisabled(index === 0)
			.onClick(() => {
				if (index === 0) return;
				const next = [...modelIds];
				[next[index - 1], next[index]] = [next[index], next[index - 1]];
				onChange(next);
			}));
		row.addButton((button) => button
			.setButtonText('↓')
			.setTooltip('Move down')
			.setDisabled(index === modelIds.length - 1)
			.onClick(() => {
				if (index === modelIds.length - 1) return;
				const next = [...modelIds];
				[next[index], next[index + 1]] = [next[index + 1], next[index]];
				onChange(next);
			}));
		row.addButton((button) => button
			.setButtonText('✕')
			.setTooltip('Remove')
			.onClick(() => {
				onChange(modelIds.filter((id) => id !== modelId));
			}));
	});

	const remaining = availableModels.filter((model) => !modelIds.includes(buildModelId(model)));
	if (!remaining.length) {
		return;
	}

	const addRow = new Setting(containerEl).setName(SETTING_COPY.aiModels.addLabel);
	addRow.settingEl.addClass('ytkn-model-chain__add-row');
	let pendingId = buildModelId(remaining[0]);
	addRow.addDropdown((dropdown) => {
		for (const model of remaining) {
			dropdown.addOption(buildModelId(model), `${model.provider.name} / ${model.displayName || model.name}`);
		}
		dropdown.setValue(pendingId).onChange((value) => {
			pendingId = value;
		});
	});
	addRow.addButton((button) => button
		.setButtonText('Add')
		.setTooltip('Add to the model chain')
		.onClick(() => {
			if (!pendingId || modelIds.includes(pendingId)) return;
			onChange([...modelIds, pendingId]);
		}));
}
