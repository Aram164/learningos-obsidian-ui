import { Modal, type App } from 'obsidian';
import { makeModalAccessible } from '../../accessibility/modal';
import { button } from '../../components';
import type { BoardRefreshPreview } from './board-controller';

export class BoardRefreshModal extends Modal {
  private cleanup: (() => void) | null = null;

  constructor(
    app: App,
    private readonly title: string,
    private readonly preview: BoardRefreshPreview,
    private readonly apply: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const heading = this.contentEl.createEl('h2', {
      text: `Refresh ${this.title}`,
      attr: { id: 'los-atlas-board-review' },
    });
    this.contentEl.createEl('p', {
      text: 'Working positions and authored objects carry through the merge. Only the listed managed objects change.',
    });
    if (this.preview.changes.length) {
      const list = this.contentEl.createEl('ul');
      for (const change of this.preview.changes) list.createEl('li', { text: change });
    } else {
      this.contentEl.createEl('p', { text: 'The generated content matches the working board.' });
    }
    const actions = this.contentEl.createDiv({ cls: 'los-actions' });
    const cancel = button(actions, 'Cancel', () => this.close(), 'quiet');
    button(actions, 'Confirm refresh', () => {
      this.close();
      this.apply();
    }, 'cta');
    this.cleanup = makeModalAccessible(this.contentEl, {
      close: () => this.close(), hostClass: 'los-atlas-board-preview',
      labelledBy: heading.getAttribute('id')!, initialFocus: () => cancel,
    });
  }

  onClose(): void {
    this.cleanup?.();
    this.cleanup = null;
    this.contentEl.empty();
  }
}
