export class Notice {
	static messages: string[] = [];

	constructor(msg?: string) {
		if (msg) Notice.messages.push(msg);
	}
}

export async function requestUrl(_request: { url: string; body?: string }): Promise<{ text: string; json: unknown }> {
	throw new Error('requestUrl mock not implemented for this test');
}

export function normalizePath(path: string): string {
	return path
		.replace(/\\/g, '/')
		.replace(/\/+/g, '/')
		.replace(/^\/+|\/+$/g, '');
}

class MockSecretStorage {
	private secrets = new Map<string, string>();

	setSecret(id: string, secret: string): void {
		this.secrets.set(id, secret);
	}

	getSecret(id: string): string | null {
		return this.secrets.get(id) ?? null;
	}
}

export class App {
	secretStorage = new MockSecretStorage();
}

export const Platform = {
	isPhone: false,
};

export class Modal {
	contentEl: HTMLElement;
	descEl: HTMLElement;

	constructor(public app: App) {
		this.contentEl = document.createElement('div');
		this.descEl = document.createElement('div');
	}

	open(): void {
		(this as any).onOpen?.();
	}

	close(): void {
		(this as any).onClose?.();
	}

	setTitle(title: string): this {
		this.contentEl.createEl('h2', { text: title });
		return this;
	}

	setContent(content: string): this {
		this.contentEl.createEl('p', { text: content });
		return this;
	}
}

export class ConfirmationModal extends Modal {
	buttonContainerEl: HTMLElement;

	constructor(app: App) {
		super(app);
		this.buttonContainerEl = this.contentEl.createDiv();
	}

	addClass(cls: string): this {
		this.contentEl.addClass(cls);
		return this;
	}

	addCheckbox(_label: string, _cb: (value: boolean) => unknown): this {
		return this;
	}

	addCancelButton(text = 'Cancel'): this {
		const button = document.createElement('button');
		button.textContent = text;
		button.addEventListener('click', () => this.close());
		this.buttonContainerEl.appendChild(button);
		return this;
	}

	addButton(cb: (button: any) => unknown): this {
		const element = document.createElement('button');
		this.buttonContainerEl.appendChild(element);
		const button = {
			setButtonText(text: string): any { element.textContent = text; return this; },
			setDestructive(): any { element.classList.add('mod-destructive'); return this; },
			setCta(): any { return this; },
			setInitialFocus(): any { return this; },
			setSecondary(): any { return this; },
			setCancel(): any { return this; },
			onClick: (handler: (event: MouseEvent) => unknown): any => {
				element.addEventListener('click', async (event) => {
					const keepOpen = await handler(event);
					if (!keepOpen) this.close();
				});
				return button;
			},
		};
		cb(button);
		return this;
	}
}

interface MockToggle {
	_value: boolean;
	_cb: ((v: boolean) => void) | null;
	getValue(): boolean;
	setValue(v: boolean): MockToggle;
	onChange(cb: (v: boolean) => void): MockToggle;
}

interface MockText {
	inputEl: HTMLInputElement;
	getValue(): string;
	setValue(v: string): MockText;
	setPlaceholder(p: string): MockText;
	setDisabled(disabled: boolean): MockText;
	onChange(cb: (v: string) => void): MockText;
}

interface MockTextArea {
	inputEl: HTMLTextAreaElement;
	getValue(): string;
	setValue(v: string): MockTextArea;
	setPlaceholder(p: string): MockTextArea;
	setDisabled(disabled: boolean): MockTextArea;
	onChange(cb: (v: string) => void): MockTextArea;
}

interface MockDropdown {
	selectEl: HTMLSelectElement;
	addOption(val: string, label: string): MockDropdown;
	addOptions(opts: Record<string, string>): MockDropdown;
	setValue(v: string): MockDropdown;
	getValue(): string;
	onChange(cb: (v: string) => void): MockDropdown;
	setDisabled(disabled: boolean): MockDropdown;
}

export abstract class SettingPage {
	rootEl: HTMLElement;
	titlebarEl: HTMLElement;
	containerEl: HTMLElement;
	title = '';

	constructor() {
		this.rootEl = document.createElement('div');
		this.titlebarEl = document.createElement('div');
		this.containerEl = document.createElement('div');
		this.rootEl.append(this.titlebarEl, this.containerEl);
	}

	abstract display(): void;

	hide(): void { }
}

export class SettingGroup {
	listEl: HTMLElement;
	private groupEl: HTMLElement;
	private headingEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		this.groupEl = document.createElement('div');
		this.headingEl = document.createElement('div');
		this.listEl = document.createElement('div');
		this.headingEl.className = 'setting-item-heading';
		this.listEl.className = 'setting-items';
		this.groupEl.append(this.headingEl, this.listEl);
		containerEl.appendChild(this.groupEl);
	}

	setHeading(text: string | DocumentFragment): this {
		this.headingEl.textContent = '';
		if (typeof text === 'string') this.headingEl.textContent = text;
		else this.headingEl.appendChild(text);
		return this;
	}

	addClass(...classes: string[]): this {
		this.groupEl.classList.add(...classes);
		return this;
	}

	addSetting(cb: (setting: Setting) => void): this {
		cb(new Setting(this.listEl));
		return this;
	}

	addSearch(_cb: (component: unknown) => unknown): this {
		return this;
	}

	addExtraButton(cb: (component: any) => unknown): this {
		const element = document.createElement('button');
		this.headingEl.appendChild(element);
		const component = {
			setIcon(icon: string): any { element.dataset.icon = icon; return this; },
			setTooltip(tooltip: string): any { element.title = tooltip; return this; },
			setDisabled(disabled: boolean): any { element.disabled = disabled; return this; },
			onClick(handler: () => unknown): any { element.addEventListener('click', handler); return this; },
		};
		cb(component);
		return this;
	}
}

export class Setting {
	settingEl: HTMLElement;
	infoEl: HTMLElement;
	controlEl: HTMLElement;
	descEl: HTMLElement;
	nameEl: HTMLElement;

	constructor(container: HTMLElement) {
		this.settingEl = (container as any).createEl?.('div', { cls: 'setting-item' })
			?? (() => { const el = document.createElement('div'); el.className = 'setting-item'; container.appendChild(el); return el; })();
		this.infoEl = (this.settingEl as any).createEl?.('div', { cls: 'setting-item-info' })
			?? (() => { const el = document.createElement('div'); el.className = 'setting-item-info'; this.settingEl.appendChild(el); return el; })();
		this.nameEl = (this.infoEl as any).createEl?.('div', { cls: 'setting-item-name' })
			?? (() => { const el = document.createElement('div'); el.className = 'setting-item-name'; this.infoEl.appendChild(el); return el; })();
		this.descEl = (this.infoEl as any).createEl?.('div', { cls: 'setting-item-description' })
			?? (() => { const el = document.createElement('div'); el.className = 'setting-item-description'; this.infoEl.appendChild(el); return el; })();
		this.controlEl = (this.settingEl as any).createEl?.('div', { cls: 'setting-item-control' })
			?? (() => { const el = document.createElement('div'); el.className = 'setting-item-control'; this.settingEl.appendChild(el); return el; })();
	}

	setName(name: string): this {
		this.nameEl.textContent = name;
		return this;
	}

	setDesc(desc: string): this {
		this.descEl.textContent = desc;
		return this;
	}

	setHeading(): this {
		this.settingEl.classList.add('setting-item-heading');
		return this;
	}

	addToggle(cb: (toggle: MockToggle) => void): this {
		const inputEl = document.createElement('input');
		inputEl.type = 'checkbox';
		this.controlEl.appendChild(inputEl);
		const toggle: MockToggle = {
			_value: false,
			_cb: null,
			getValue() { return this._value; },
			setValue(v: boolean): MockToggle { this._value = v; inputEl.checked = v; return this; },
			onChange(cb: (v: boolean) => void): MockToggle {
				this._cb = cb;
				inputEl.addEventListener('change', () => {
					this._value = inputEl.checked;
					cb(inputEl.checked);
				});
				return this;
			},
		};
		cb(toggle);
		return this;
	}

	addText(cb: (t: MockText) => void): this {
		const inputEl = document.createElement('input');
		this.controlEl.appendChild(inputEl);
		const text: MockText = {
			inputEl,
			getValue: () => inputEl.value,
			setValue(v: string): MockText { inputEl.value = v; return this; },
			setPlaceholder(p: string): MockText { inputEl.placeholder = p; return this; },
			setDisabled(disabled: boolean): MockText { inputEl.disabled = disabled; return this; },
			onChange(cb: (v: string) => void): MockText {
				inputEl.addEventListener('input', () => cb(inputEl.value));
				inputEl.addEventListener('change', () => cb(inputEl.value));
				return this;
			},
		};
		cb(text);
		return this;
	}

	addTextArea(cb: (t: MockTextArea) => void): this {
		const inputEl = document.createElement('textarea');
		this.controlEl.appendChild(inputEl);
		const text: MockTextArea = {
			inputEl,
			getValue: () => inputEl.value,
			setValue(v: string): MockTextArea { inputEl.value = v; return this; },
			setPlaceholder(p: string): MockTextArea { inputEl.placeholder = p; return this; },
			setDisabled(disabled: boolean): MockTextArea { inputEl.disabled = disabled; return this; },
			onChange(cb: (v: string) => void): MockTextArea {
				inputEl.addEventListener('input', () => cb(inputEl.value));
				inputEl.addEventListener('change', () => cb(inputEl.value));
				return this;
			},
		};
		cb(text);
		return this;
	}

	addDropdown(cb: (d: MockDropdown) => void): this {
		const selectEl = document.createElement('select');
		this.controlEl.appendChild(selectEl);
		const dropdown: MockDropdown = {
			selectEl,
			addOption(val: string, label: string): MockDropdown {
				const opt = document.createElement('option');
				opt.value = val;
				opt.textContent = label;
				selectEl.appendChild(opt);
				return this;
			},
			addOptions(opts: Record<string, string>): MockDropdown {
				for (const [val, label] of Object.entries(opts)) {
					this.addOption(val, label);
				}
				return this;
			},
			getValue(): string { return selectEl.value; },
			setValue(v: string): MockDropdown { selectEl.value = v; return this; },
			onChange(cb: (v: string) => void): MockDropdown {
				selectEl.addEventListener('change', () => cb(selectEl.value));
				return this;
			},
			setDisabled(disabled: boolean): MockDropdown { selectEl.disabled = disabled; return this; },
		};
		cb(dropdown);
		return this;
	}

	addButton(cb: (b: any) => void): this {
		const btnEl = document.createElement('button');
		this.controlEl.appendChild(btnEl);
		const b = {
			setButtonText(t: string): any { btnEl.textContent = t; return this; },
			onClick(fn: () => void): any { btnEl.addEventListener('click', fn); return this; },
			setIcon(_i: string): any { return this; },
			setTooltip(_t: string): any { return this; },
			setCta(): any { return this; },
			setWarning(): any { return this; },
			setDestructive(): any { btnEl.classList.add('mod-destructive'); return this; },
			setDisabled(v: boolean): any { btnEl.disabled = v; return this; },
		};
		cb(b);
		return this;
	}

	addExtraButton(cb: (b: any) => void): this {
		const element = document.createElement('button');
		this.controlEl.appendChild(element);
		const b = {
			setIcon(icon: string): any { element.dataset.icon = icon; return this; },
			setTooltip(tooltip: string): any { element.title = tooltip; return this; },
			setDisabled(disabled: boolean): any { element.disabled = disabled; return this; },
			onClick(fn: () => unknown): any { element.addEventListener('click', fn); return this; },
		};
		cb(b);
		return this;
	}

	addComponent<T>(cb: (el: HTMLElement) => T): this {
		cb(this.controlEl);
		return this;
	}
}

export function setIcon(_el: HTMLElement, _name: string): void { }

export class SecretComponent {
	inputEl: HTMLInputElement;

	constructor(_app: App, containerEl: HTMLElement) {
		this.inputEl = document.createElement('input');
		containerEl.appendChild(this.inputEl);
	}

	setValue(value: string): this {
		this.inputEl.value = value;
		return this;
	}

	onChange(cb: (value: string) => unknown): this {
		this.inputEl.addEventListener('change', () => {
			void cb(this.inputEl.value);
		});
		return this;
	}
}

export default { Notice };
