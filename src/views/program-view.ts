export class ProgramView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.programId = null; }
  getViewType() { return VIEW_PROGRAM; }
  getDisplayText() { return 'LearningOS · Area'; }
  async setState(state) { this.programId = state?.programId || this.programId; this.render(); }
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
    pageHeader(root, 'Program / area', program.title, program.description || '');
    if (program.semester_bound) {
      const semesters = section(root, 'Semesters');
      for (const semester of program.semesters || []) {
        const row = semesters.createDiv({ cls: 'los-row' });
        row.createEl('strong', { text: semester.title }); badge(row, semester.status, semester.status);
      }
      empty(semesters, 'Past semesters remain visible', 'Archived semesters appear here after the turn-semester workflow.');
    }
    const modules = section(root, 'Modules');
    const grid = modules.createDiv({ cls: 'los-card-grid' });
    for (const module of this.plugin.store.modulesFor(program.id)) moduleCard(grid, this.plugin, module);
    viewFooter(root);
  }

  renderNeedsMap(root) {
    pageHeader(root, 'Queue', 'Units needing a study map');
    const grid = root.createDiv({ cls: 'los-card-grid' });
    for (const unit of this.plugin.store.units().filter((row) => !this.plugin.store.mapForUnit(row.id))) {
      unitCard(grid, this.plugin, unit);
    }
    viewFooter(root);
  }

  renderInbox(root) {
    pageHeader(root, 'Capture', 'Inbox', 'You capture; the operator files.');
    const count = this.plugin.store.data?.counts?.inbox_items || 0;
    const wrap = section(root, `${count} item${count === 1 ? '' : 's'} awaiting routing`);
    wrap.createEl('p', { cls: 'los-muted', text: 'No filing decision is required. Text and files land in work/inbox/ through the core capture gateway.' });
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
    viewFooter(root);
  }

  async capture(action, clear) {
    if (this.busy) { new Notice('A capture is already running.'); return; }
    this.busy = true;
    try {
      await action();
      await this.plugin.gateway.call(['generate'], { expectJson: false });
      // Only after the core confirmed the capture in JSON — clearing earlier
      // is what used to lose the thought when the CLI answered with garbage.
      clear?.();
      await this.plugin.reloadStore();
      new Notice('Captured to the LearningOS inbox.');
    } catch (error) { new Notice(error?.message || String(error)); }
    finally { this.busy = false; }
  }
}
