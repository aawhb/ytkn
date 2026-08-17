import type { App } from 'obsidian';
import { Modal, Setting, setIcon } from 'obsidian';
import type { ReleaseNote } from '../../releaseNotes';
import { DOCUMENTATION_LINK, SUPPORT_LINKS, getRecentReleaseNotes } from '../../releaseNotes';

const SECTION_LABELS: Array<{ key: keyof Pick<ReleaseNote, 'new' | 'improved' | 'fixed' | 'changed'>; label: string }> = [
	{ key: 'new', label: 'New' },
	{ key: 'improved', label: 'Improved' },
	{ key: 'fixed', label: 'Fixed' },
	{ key: 'changed', label: 'Changed' },
];

export class WhatsNewModal extends Modal {
	constructor(
		app: App,
		private notes: ReleaseNote[] = getRecentReleaseNotes(),
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ytkn-whats-new-modal');

		const header = contentEl.createDiv({ cls: 'ytkn-whats-new-modal__header' });
		header.createEl('h2', {
			cls: 'ytkn-whats-new-modal__title',
			text: "What's new in YT Knowledge Notes",
		});
		header.createEl('p', {
			cls: 'ytkn-whats-new-modal__subtitle',
			text: 'Recent updates and improvements.',
		});

		const body = contentEl.createDiv({ cls: 'ytkn-whats-new-modal__body' });
		if (this.notes.length === 0) {
			body.createEl('p', {
				cls: 'ytkn-whats-new-modal__empty',
				text: 'No release notes are available yet.',
			});
		} else {
			for (const note of this.notes) {
				this.renderReleaseNote(body, note);
			}
		}

		this.renderSupport(contentEl);

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText('Close')
					.onClick(() => this.close()),
			)
			.settingEl.addClass('ytkn-whats-new-modal__actions');
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderReleaseNote(container: HTMLElement, note: ReleaseNote): void {
		const section = container.createDiv({ cls: 'ytkn-whats-new-modal__release' });
		const versionRow = section.createDiv({ cls: 'ytkn-whats-new-modal__version-row' });
		versionRow.createEl('h3', {
			cls: 'ytkn-whats-new-modal__version',
			text: note.version,
		});
		versionRow.createSpan({
			cls: 'ytkn-whats-new-modal__date',
			text: note.date,
		});

		if (note.summary) {
			section.createEl('p', {
				cls: 'ytkn-whats-new-modal__summary',
				text: note.summary,
			});
		}

		for (const { key, label } of SECTION_LABELS) {
			const items = note[key];
			if (!items?.length) {
				continue;
			}
			const group = section.createDiv({ cls: 'ytkn-whats-new-modal__section' });
			group.createEl('h4', {
				cls: 'ytkn-whats-new-modal__section-title',
				text: label,
			});
			const list = group.createEl('ul', { cls: 'ytkn-whats-new-modal__list' });
			for (const item of items) {
				list.createEl('li', { text: item });
			}
		}
	}

	private renderSupport(container: HTMLElement): void {
		const support = container.createDiv();
		const actions = support.createDiv({ cls: 'ytkn-whats-new-modal__support-actions' });
		this.createSupportLink(actions, DOCUMENTATION_LINK, 'Help', 'circle-help');
		this.createSupportLink(actions, SUPPORT_LINKS.githubSponsors, 'Sponsor', 'heart-handshake');
		this.createSupportLink(actions, SUPPORT_LINKS.buyMeACoffee, 'Buy Me a Coffee', 'coffee');
	}

	private createSupportLink(container: HTMLElement, href: string, text: string, icon: string): void {
		const link = container.createEl('a', {
			cls: 'ytkn-whats-new-modal__support-button',
			attr: {
				href,
				target: '_blank',
				rel: 'noopener noreferrer',
			},
		});
		const iconEl = link.createSpan({ cls: 'ytkn-whats-new-modal__support-icon' });
		setIcon(iconEl, icon);
		link.createSpan({ text });
	}
}
