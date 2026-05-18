import path from 'path';

(globalThis as any).__TEST_MOCKS_DIR = path.resolve(__dirname, 'mocks');
(globalThis as any).activeWindow = window;
(globalThis as any).activeDocument = document;

// Polyfills for Obsidian's HTMLElement extensions (createEl, empty, etc.) so
// jsdom can run the plugin's DOM-emitting helpers.
const proto = HTMLElement.prototype as HTMLElement & {
	empty?: () => void;
	createEl?: <K extends keyof HTMLElementTagNameMap>(
		tag: K,
		options?: { text?: string; cls?: string; value?: string; attr?: Record<string, string> },
	) => HTMLElementTagNameMap[K];
	createDiv?: (options?: { cls?: string; text?: string }) => HTMLDivElement;
	createSpan?: (options?: { cls?: string; text?: string }) => HTMLSpanElement;
};

if (!proto.empty) {
	proto.empty = function empty(this: HTMLElement) {
		while (this.firstChild) {
			this.removeChild(this.firstChild);
		}
	};
}

if (!proto.createEl) {
	proto.createEl = function createEl(
		this: HTMLElement,
		tag: string,
		options: { text?: string; cls?: string; value?: string; attr?: Record<string, string> } = {},
	) {
		const el = document.createElement(tag) as HTMLElement;
		if (options.text !== undefined) {
			el.textContent = options.text;
		}
		if (options.cls) {
			el.className = options.cls;
		}
		if (options.value !== undefined) {
			(el as HTMLOptionElement | HTMLInputElement).value = options.value;
		}
		if (options.attr) {
			for (const [key, value] of Object.entries(options.attr)) {
				el.setAttribute(key, value);
			}
		}
		this.appendChild(el);
		return el;
	} as typeof proto.createEl;
}

if (!proto.createDiv) {
	proto.createDiv = function createDiv(this: HTMLElement, options = {}) {
		return this.createEl!('div', options) as HTMLDivElement;
	};
}

if (!proto.createSpan) {
	proto.createSpan = function createSpan(this: HTMLElement, options = {}) {
		return this.createEl!('span', options) as HTMLSpanElement;
	};
}

// Obsidian HTMLElement extensions not in jsdom
const htmlProto = HTMLElement.prototype as any;

if (!htmlProto.addClass) {
	htmlProto.addClass = function (...classes: string[]) {
		for (const cls of classes) {
			for (const c of cls.split(' ')) {
				if (c) this.classList.add(c);
			}
		}
	};
}

if (!htmlProto.removeClass) {
	htmlProto.removeClass = function (...classes: string[]) {
		for (const cls of classes) {
			for (const c of cls.split(' ')) {
				if (c) this.classList.remove(c);
			}
		}
	};
}

if (!htmlProto.toggleClass) {
	htmlProto.toggleClass = function (cls: string, force?: boolean) {
		if (force !== undefined) {
			this.classList.toggle(cls, force);
		} else {
			this.classList.toggle(cls);
		}
	};
}

if (!htmlProto.hasClass) {
	htmlProto.hasClass = function (cls: string) {
		return this.classList.contains(cls);
	};
}

if (!htmlProto.setText) {
	htmlProto.setText = function (text: string) {
		this.textContent = text;
	};
}

if (!htmlProto.hide) {
	htmlProto.hide = function () {
		this.style.display = 'none';
	};
}

if (!htmlProto.show) {
	htmlProto.show = function () {
		this.style.display = '';
	};
}

if (!htmlProto.toggle) {
	htmlProto.toggle = function (show: boolean) {
		if (show) {
			this.style.display = '';
		} else {
			this.style.display = 'none';
		}
	};
}

// IntersectionObserver polyfill (not in jsdom)
if (typeof globalThis.IntersectionObserver === 'undefined') {
	(globalThis as any).IntersectionObserver = class {
		constructor(_callback: any, _options?: any) { }
		observe(_target: Element): void { }
		unobserve(_target: Element): void { }
		disconnect(): void { }
	};
}
