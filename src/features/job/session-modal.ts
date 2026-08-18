import { Modal, type App } from 'obsidian';
import { button } from '../../components';
import { makeModalAccessible } from '../../accessibility/modal';

/**
 * What happened in one job session, in Aram's own words.
 *
 * The core refuses an empty entry — a session log with no content is not a
 * record of anything — so the view has to ask before it writes. Nothing is
 * saved anywhere until the guarded `job.session.log` transaction confirms;
 * this modal holds the text and hands it over exactly once.
 */
export class JobSessionModal extends Modal {
  private readonly trackTitle: string;
  private readonly sessionNumber: number;
  private readonly submit: (text: string) => Promise<unknown>;

  private editor!: HTMLTextAreaElement;
  private restoreAccessibility: (() => void) | null = null;

  constructor(
    app: App,
    options: {
      trackTitle: string;
      sessionNumber: number;
      submit: (text: string) => Promise<unknown>;
    },
  ) {
    super(app);
    this.trackTitle = options.trackTitle;
    this.sessionNumber = options.sessionNumber;
    this.submit = options.submit;
  }

  onOpen(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass('los-root', 'los-job-session-modal');

    const heading = root.createEl('h2', { text: 'Log a job session' });
    heading.id = 'los-job-session-heading';
    root.createDiv({
      cls: 'los-muted',
      text: this.sessionNumber > 0
        ? `${this.trackTitle} · session ${String(this.sessionNumber).padStart(2, '0')}`
        : this.trackTitle,
    });

    this.editor = root.createEl('textarea', { cls: 'los-job-session-editor' });
    this.editor.rows = 10;
    this.editor.placeholder = 'What did you actually do, and what did it teach you?';

    const status = root.createDiv({ cls: 'los-micro', attr: { 'aria-live': 'polite' } });
    const actions = root.createDiv({ cls: 'los-job-session-actions' });

    const save = button(actions, 'Save to Job scratch', async () => {
      const text = this.editor.value.trim();
      if (!text) {
        status.setText('An empty entry records nothing — write a line first.');
        this.editor.focus();
        return;
      }
      save.setAttribute('disabled', 'true');
      status.setText('Saving…');
      try {
        await this.submit(text);
        this.close();
      } catch (error: unknown) {
        save.removeAttribute('disabled');
        status.setText(error instanceof Error ? error.message : String(error));
      }
    }, 'cta');

    button(actions, 'Cancel', () => this.close(), 'quiet');

    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: 'los-modal--job-session',
      labelledBy: 'los-job-session-heading',
    });
    this.editor.focus();
  }

  onClose(): void {
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
}
