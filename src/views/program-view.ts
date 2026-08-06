import { ItemView, Notice } from 'obsidian';
import { badge, button, disclosure, empty, localFilePath, pageHeader, progressRow, projectedExcerpt, section, unitCard } from '../components';
import { LEARN_AREAS, VIEW_PROGRAM } from '../constants';
import type { ProjectionRecord } from '../contracts/manifest-v2';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class ProgramView extends ItemView {
  [key: string]: any;
  constructor(leaf: any, plugin: any) {
    super(leaf);
    this.plugin = plugin;
    this.programId = null;
  }
  getViewType() { return VIEW_PROGRAM; }
  getDisplayText() { return 'LearningOS · Area'; }
  async setState(
    state: Record<string, any> = {},
  ): Promise<void> {
    this.programId = state?.programId || this.programId;
    this.render();
  }
  getState() { return { programId: this.programId }; }
  async onOpen() { this.programId = this.leaf.state?.programId || this.programId; this.render(); }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-program-view');
    // The Navigator can reach this view whatever the projection's health, so it
    // has to degrade like Home rather than throw on a null manifest.
    if (!this.plugin.store.ready) {
      pageHeader(root, 'LearningOS', 'Projection unavailable');
      empty(root, 'The interface contract could not be loaded', this.plugin.store.error,
        'Rebuild views', () => this.plugin.generate());
      return;
    }
    if (this.programId === 'queue-needs-map') return this.renderNeedsMap(root);
    if (this.programId === 'inbox') return this.renderInbox(root);
    const program = this.plugin.store.get(this.programId);
    if (!program) { empty(root, 'Area unavailable', 'Return Home and choose another area.'); return; }
    pageHeader(root, '', 'Learn');
    // The areas are sub-areas of one destination now, so the switcher lives in
    // the page rather than eating three permanent sidebar slots.
    const tabs = root.createDiv({ cls: 'los-tabs', attr: { role: 'tablist' } });
    for (const [areaId, title] of LEARN_AREAS) {
      const active = areaId === program.id;
      const tab = button(tabs, title, () => this.plugin.openLearn(areaId), active ? 'cta' : 'quiet');
      tab.setAttrs({ role: 'tab', 'aria-selected': String(active) });
    }
    if (program.description) root.createEl('p', { cls: 'los-muted', text: program.description });

    const modules = this.plugin.store.modulesFor(program.id);
    const list = root.createDiv({ cls: 'los-learning-list' });
    if (!modules.length) empty(root, 'No modules in this area yet', 'Nothing is hidden.');
    for (const module of modules) progressRow(list, this.plugin, module);

    if (program.semester_bound) {
      const semesters = disclosure(root, 'Semesters');
      for (const semester of program.semesters || []) {
        const row = semesters.createDiv({ cls: 'los-row' });
        row.createEl('strong', { text: semester.title }); badge(row, semester.status, semester.status);
      }
    }
    this.renderCoordination(root);
  }

  /**
   * The full coordination record — commitments, dependencies, deferrals — moved
   * off Home to here. Home carries the one-line priority; this is where the
   * whole decision layer is read when the learner actually wants it.
   */
  renderCoordination(root: any): void {
    const coordination = this.plugin.store.get('coordination');
    const rows = ['Priorities', 'Commitments', 'Dependencies', 'Deferrals']
      .map((heading) => [heading, projectedExcerpt(coordination?.sections?.[heading], 1600)])
      .filter(([, body]) => body);
    if (!rows.length) return;
    const panel = disclosure(root, 'Semester coordination', 'los-coordination-details');
    for (const [heading, body] of rows) {
      const row = panel.createDiv({ cls: 'los-coordination-row' });
      row.createEl('strong', { text: heading });
      row.createEl('p', { text: body });
    }
  }

  renderNeedsMap(root: any): void {
    pageHeader(root, 'Review', 'Units needing a study map');
    const grid = root.createDiv({ cls: 'los-card-grid' });
    for (const unit of this.plugin.store.units().filter(
      (row: ProjectionRecord) =>
        !this.plugin.store.mapForUnit(row.id),
    )) {
      unitCard(grid, this.plugin, unit);
    }
  }

  renderInbox(root: any): void {
    pageHeader(root, '', 'Capture', 'You capture; the operator files.');
    const count = this.plugin.store.data?.counts?.inbox_items || 0;
    const wrap = section(root, `${count} item${count === 1 ? '' : 's'} awaiting routing`);
    const form = wrap.createDiv({ cls: 'los-capture-grid' });
    const textPanel = form.createDiv({ cls: 'los-capture-panel' });
    textPanel.createEl('h3', { text: 'Quick text' });
    const title = textPanel.createEl('input', {
      cls: 'los-search los-capture-title',
      attr: { type: 'text', placeholder: 'Optional title', 'aria-label': 'Capture title' },
    });
    const editor = textPanel.createEl('textarea', {
      cls: 'los-note-editor los-capture-editor',
      attr: { placeholder: 'Paste a link, thought, question, or fragment…', 'aria-label': 'Capture text' },
    });
    const draft = this.plugin.getInboxDraft();
    title.value = draft.title || '';
    editor.value = draft.text || '';
    const status = textPanel.createDiv({ cls: 'los-draft-status', attr: { 'aria-live': 'polite' } });
    const captureButton = button(textPanel, 'Capture text', () => {
      const text = editor.value.trim();
      if (!text) { new Notice('Enter some text before capturing.'); editor.focus(); return; }
      this.capture(
        () => this.plugin.gateway.captureText(text, title.value.trim()),
        () => {
          this.plugin.clearInboxDraft();
          editor.value = '';
          title.value = '';
        });
    }, 'cta');
    const syncDraft = () => {
      const hasDraft = Boolean(title.value || editor.value);
      this.plugin.setInboxDraft(title.value, editor.value);
      captureButton.disabled = !editor.value.trim();
      status.setText(hasDraft ? 'Draft kept locally until capture.' : 'Nothing entered yet.');
      status.toggleClass('is-dirty', hasDraft);
    };
    title.addEventListener('input', syncDraft);
    editor.addEventListener('input', syncDraft);
    captureButton.disabled = !editor.value.trim();
    status.setText((title.value || editor.value) ? 'Draft kept locally until capture.' : 'Nothing entered yet.');
    status.toggleClass('is-dirty', Boolean(title.value || editor.value));

    const filePanel = form.createDiv({ cls: 'los-capture-panel' });
    filePanel.createEl('h3', { text: 'File or handwriting' });
    filePanel.createEl('p', { cls: 'los-muted', text: 'The original is copied into the inbox; it is not moved or renamed.' });
    const picker = filePanel.createEl('input', {
      cls: 'los-file-input los-capture-file',
      attr: { type: 'file', 'aria-label': 'Choose inbox capture file' },
    });
    button(filePanel, 'Capture selected file', () => {
      const localPath = localFilePath(picker.files?.[0]);
      if (!localPath) { new Notice('Choose a local file first.'); return; }
      this.capture(() => this.plugin.gateway.captureFile(localPath), () => { picker.value = ''; });
    }, 'quiet');
  }

  async capture(
    action: () => Promise<unknown>,
    clear: (() => void) | null = null,
  ): Promise<void> {
    if (this.plugin.gateway.isBusy) new Notice('Queued behind the running LearningOS write.');
    try {
      await this.plugin.mutate(async () => {
        await action();
        await this.plugin.gateway.call(['generate'], { expectJson: false });
      });
      // Only after the core confirmed the capture in JSON — clearing earlier
      // is what used to lose the thought when the CLI answered with garbage.
      clear?.();
      new Notice('Captured to the LearningOS inbox.');
      this.render();
    } catch (error: unknown) {
      new Notice(errorMessage(error));
    }
  }
}
