import type { Setting } from 'obsidian';
import type { ChannelContentType } from '../../types';

const CHANNEL_CONTENT_TYPES: readonly ChannelContentType[] = ['videos', 'shorts', 'streams'];

export interface CheckboxGroupChange<T extends string> {
	value: T;
	checked: boolean;
}

interface CheckboxGroupControl<T extends string> {
	setValue(value: readonly T[]): void;
}

interface CheckboxGroupControlOptions<T extends string> {
	value: readonly T[];
	order: readonly T[];
	labels: Record<T, string>;
	minSelected?: number;
	validationMessage?: string;
	saveErrorMessage?: string;
	onChange(value: T[], change: CheckboxGroupChange<T>): void | Promise<void>;
}

export function renderCheckboxGroupControl<T extends string>(
	setting: Setting,
	options: CheckboxGroupControlOptions<T>,
): CheckboxGroupControl<T> {
	setting.settingEl.addClass('ytkn-checkbox-group-setting');
	const inputs = new Map<T, HTMLInputElement>();
	const errorEl = setting.descEl.createDiv({ cls: 'ytkn-checkbox-group-error' });
	errorEl.setAttribute('role', 'alert');
	let selected = normalizeSelection(options.value, options.order);

	const syncInputs = () => {
		for (const [value, input] of inputs) input.checked = selected.includes(value);
	};

	for (const value of options.order) {
		const label = setting.controlEl.createEl('label', { cls: 'ytkn-checkbox-group-option' });
		const checkbox = label.createEl('input', { attr: { type: 'checkbox' } });
		inputs.set(value, checkbox);
		label.createSpan({ text: options.labels[value] });
		checkbox.addEventListener('change', () => {
			void (async () => {
				const previous = selected;
				const checked = checkbox.checked;
				const next = new Set(selected);
				if (checked) next.add(value);
				else next.delete(value);
				if (next.size < (options.minSelected ?? 0)) {
					errorEl.setText(options.validationMessage ?? 'Select at least one option.');
					syncInputs();
					return;
				}

				selected = normalizeSelection(next, options.order);
				errorEl.setText('');
				syncInputs();
				try {
					await options.onChange([...selected], { value, checked });
				} catch (error) {
					selected = previous;
					syncInputs();
					errorEl.setText(error instanceof Error
						? error.message
						: (options.saveErrorMessage ?? 'Could not save options.'));
				}
			})();
		});
	}

	syncInputs();
	return {
		setValue(value) {
			selected = normalizeSelection(value, options.order);
			errorEl.setText('');
			syncInputs();
		},
	};
}

export type ChannelContentControl = CheckboxGroupControl<ChannelContentType>;

interface ChannelContentControlOptions {
	value: readonly ChannelContentType[];
	labels: Record<ChannelContentType, string>;
	onChange(value: ChannelContentType[]): void | Promise<void>;
}

export function renderChannelContentControl(
	setting: Setting,
	options: ChannelContentControlOptions,
): ChannelContentControl {
	return renderCheckboxGroupControl(setting, {
		value: options.value,
		order: CHANNEL_CONTENT_TYPES,
		labels: options.labels,
		minSelected: 1,
		validationMessage: 'Select at least one channel content type.',
		saveErrorMessage: 'Could not save channel content types.',
		onChange: (value) => options.onChange(value),
	});
}

function normalizeSelection<T extends string>(value: Iterable<T>, order: readonly T[]): T[] {
	const selected = new Set(value);
	return order.filter((item) => selected.has(item));
}
