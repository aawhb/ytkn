import { setIcon } from 'obsidian';

export interface TabDefinition {
	id: string;
	label: string;
	icon?: string;
}

export const SETTINGS_TABS: TabDefinition[] = [
	{ id: 'general', label: 'General', icon: 'settings' },
	{ id: 'genai', label: 'GenAI', icon: 'bot' },
];

export const DEFAULT_SETTINGS_TAB_ID = 'general';

export class TabGroup {
	public containerEl: HTMLElement;
	public navEl: HTMLElement;
	public panelsContainerEl: HTMLElement;

	private tabs: Map<string, HTMLElement> = new Map();
	private panels: Map<string, HTMLElement> = new Map();
	private activeTabId: string | null = null;
	private onTabChange?: (tabId: string) => void;

	constructor(container: HTMLElement, tabDefs: TabDefinition[], defaultTabId?: string, onTabChange?: (tabId: string) => void) {
		this.containerEl = container.createDiv({ cls: 'ytkn-tabs-container' });
		this.onTabChange = onTabChange;

		this.navEl = this.containerEl.createDiv({ cls: 'ytkn-tabs' });
		this.navEl.setAttribute('role', 'tablist');

		this.panelsContainerEl = this.containerEl.createDiv({ cls: 'ytkn-tabs-panels' });

		tabDefs.forEach(def => {
			const tabEl = this.navEl.createEl('button', { cls: 'ytkn-tab' });
			tabEl.setAttribute('role', 'tab');
			tabEl.setAttribute('aria-controls', `ytkn-tab-panel-${def.id}`);
			tabEl.setAttribute('id', `ytkn-tab-${def.id}`);

			if (def.icon) {
				const iconEl = tabEl.createSpan({ cls: 'ytkn-tab-icon' });
				setIcon(iconEl, def.icon);
			}

			tabEl.createSpan({ cls: 'ytkn-tab-label', text: def.label });

			tabEl.addEventListener('click', () => {
				this.setActiveTab(def.id);
			});

			this.tabs.set(def.id, tabEl);

			const panelEl = this.panelsContainerEl.createDiv({ cls: 'ytkn-tab-panel' });
			panelEl.setAttribute('role', 'tabpanel');
			panelEl.setAttribute('id', `ytkn-tab-panel-${def.id}`);
			panelEl.setAttribute('aria-labelledby', `ytkn-tab-${def.id}`);

			this.panels.set(def.id, panelEl);
		});

		if (tabDefs.length > 0) {
			this.setActiveTab(defaultTabId || tabDefs[0].id);
		}
	}

	public getPanel(tabId: string): HTMLElement | undefined {
		return this.panels.get(tabId);
	}

	public setActiveTab(tabId: string) {
		if (this.activeTabId === tabId) return;

		this.tabs.forEach((tabEl, id) => {
			const isActive = id === tabId;
			tabEl.toggleClass('is-active', isActive);
			tabEl.setAttribute('aria-selected', isActive ? 'true' : 'false');
			tabEl.setAttribute('tabindex', isActive ? '0' : '-1');
		});

		this.panels.forEach((panelEl, id) => {
			panelEl.toggleClass('is-active', id === tabId);
		});

		this.activeTabId = tabId;
		if (this.onTabChange) {
			this.onTabChange(tabId);
		}
	}
}
