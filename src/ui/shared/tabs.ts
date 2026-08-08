import { setIcon } from 'obsidian';

interface TabDefinition {
	id: string;
	label: string;
	icon?: string;
}

export const SETTINGS_TABS: TabDefinition[] = [
	{ id: 'general', label: 'General', icon: 'settings' },
	{ id: 'ai', label: 'AI', icon: 'bot' },
];

export class TabGroup {
	private tabs: Map<string, HTMLElement> = new Map();
	private panels: Map<string, HTMLElement> = new Map();
	private activeTabId: string | null = null;
	private onTabChange?: (tabId: string) => void;

	constructor(container: HTMLElement, tabDefs: TabDefinition[], defaultTabId?: string, onTabChange?: (tabId: string) => void) {
		const containerEl = container.createDiv();
		this.onTabChange = onTabChange;

		const navEl = containerEl.createDiv({ cls: 'ytkn-tabs' });
		navEl.setAttribute('role', 'tablist');
		navEl.setAttribute('aria-orientation', 'horizontal');

		const panelsContainerEl = containerEl.createDiv();

		const tabIds = tabDefs.map((definition) => definition.id);
		tabDefs.forEach(def => {
			const tabEl = navEl.createEl('button', { cls: 'ytkn-tab' });
			tabEl.setAttribute('role', 'tab');
			tabEl.setAttribute('aria-controls', `ytkn-tab-panel-${def.id}`);
			tabEl.setAttribute('id', `ytkn-tab-${def.id}`);

			if (def.icon) {
				const iconEl = tabEl.createSpan({ cls: 'ytkn-tab-icon' });
				setIcon(iconEl, def.icon);
			}

			tabEl.createSpan({ text: def.label });

			tabEl.addEventListener('click', () => {
				this.setActiveTab(def.id);
			});
			tabEl.addEventListener('keydown', (event) => {
				const currentIndex = tabIds.indexOf(def.id);
				const nextIndex = event.key === 'Home'
					? 0
					: event.key === 'End'
						? tabIds.length - 1
						: event.key === 'ArrowRight'
							? (currentIndex + 1) % tabIds.length
							: event.key === 'ArrowLeft'
								? (currentIndex - 1 + tabIds.length) % tabIds.length
								: -1;
				if (nextIndex < 0) {
					return;
				}
				event.preventDefault();
				const nextTabId = tabIds[nextIndex];
				this.setActiveTab(nextTabId);
				this.tabs.get(nextTabId)?.focus();
			});

			this.tabs.set(def.id, tabEl);

			const panelEl = panelsContainerEl.createDiv({ cls: 'ytkn-tab-panel' });
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
			const isActive = id === tabId;
			panelEl.toggleClass('is-active', isActive);
			panelEl.hidden = !isActive;
		});

		this.activeTabId = tabId;
		if (this.onTabChange) {
			this.onTabChange(tabId);
		}
	}
}
