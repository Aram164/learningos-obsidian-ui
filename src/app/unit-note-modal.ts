/**
 * One note after a learning session, attached to the unit rather than to every
 * selected stage. Text drafts are kept locally until the guarded core command
 * confirms a write. Attachments are selected for the current save only.
 */
export class UnitNoteModal extends Modal {
  constructor(app, plugin, unit, studyMap) {
    super(app);
    this.plugin = plugin;
    this.unit = unit;
    this.studyMap = studyMap;
    this.files = [];
  }

  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass('los-root', 'los-unit-note-modal');
    const stages = Array.isArray(this.studyMap?.stages) ? this.studyMap.stages : [];
    const draft = this.plugin.getUnitNoteDraft(this.unit.id, stages);
    this.recoveredStageIds = draft.recoveredStageIds || [];
    this.referencedStageIds = [...new Set([
      ...this.unrecordedCompletedStages(stages), ...this.recoveredStageIds,
    ])];

    pageHeader(root, 'Learning session', 'Add note',
      'Attach one note after the stages you worked through. It belongs to the unit, not to one selected stage.');

    const context = root.createDiv({ cls: 'los-unit-note-context' });
    context.createDiv({ cls: 'los-kicker', text: 'Stages covered' });
    if (this.referencedStageIds.length) {
      const names = this.referencedStageIds.map((id) => stages.find((stage) => stage.id === id)?.title || id);
      context.createDiv({ text: names.join(' · ') });
    } else {
      context.createDiv({ cls: 'los-micro', text: 'No newly completed stage is required. You may still record a unit-level observation.' });
    }

    this.titleInput = root.createEl('input', {
      cls: 'los-search los-unit-note-title',
      attr: { type: 'text', placeholder: 'Optional note title', 'aria-label': 'Unit note title' },
    });
    this.titleInput.value = draft.title || '';

    this.editor = root.createEl('textarea', {
      cls: 'los-note-editor los-unit-note-editor',
      attr: { placeholder: 'What should remain after this learning session?', 'aria-label': 'Unit learning-session note' },
    });
    this.editor.value = draft.text || '';

    const attachments = root.createDiv({ cls: 'los-unit-note-attachments' });
    attachments.createDiv({ cls: 'los-kicker', text: 'Attachments' });
    this.fileInput = attachments.createEl('input', {
      cls: 'los-file-input',
      attr: { type: 'file', multiple: 'multiple', 'aria-label': 'Choose unit note attachments' },
    });
    this.fileSummary = attachments.createDiv({ cls: 'los-micro', text: 'Optional: handwriting, image, or PDF.' });
    this.fileInput.addEventListener('change', () => {
      this.files = [...(this.fileInput.files || [])];
      this.fileSummary.setText(this.files.length
        ? `${this.files.length} attachment${this.files.length === 1 ? '' : 's'} selected for this save.`
        : 'Optional: handwriting, image, or PDF.');
    });

    const status = root.createDiv({ cls: 'los-draft-status', attr: { 'aria-live': 'polite' } });
    const persist = () => {
      this.plugin.setUnitNoteDraft(this.unit.id, this.titleInput.value, this.editor.value);
      status.setText(this.editor.value.trim() ? 'Draft kept locally until the core confirms the save.' : 'Write a note to enable saving.');
      status.toggleClass('is-dirty', Boolean(this.editor.value.trim()));
    };
    this.titleInput.addEventListener('input', persist);
    this.editor.addEventListener('input', persist);
    persist();

    const actions = root.createDiv({ cls: 'los-actions los-unit-note-actions' });
    button(actions, 'Cancel', () => this.close(), 'quiet');
    button(actions, 'Save note', () => this.save(), 'cta');
    this.editor.focus();
  }

  unrecordedCompletedStages(stages) {
    const already = new Set((this.unit.note_sections || [])
      .flatMap((section) => Array.isArray(section.stage_ids) ? section.stage_ids : []));
    return stages
      .filter((stage) => ['complete', 'skipped'].includes(stage.status) && !already.has(stage.id))
      .map((stage) => stage.id);
  }

  async save() {
    const text = String(this.editor?.value || '');
    if (!text.trim()) { new Notice('Write a note before saving.'); this.editor?.focus(); return; }
    if (this.plugin.gateway.isBusy) { new Notice('A LearningOS write is already running.'); return; }
    const filePaths = this.files.map((file) => localFilePath(file)).filter(Boolean);
    if (filePaths.length !== this.files.length) {
      new Notice('One selected attachment has no readable local path. Remove it and choose the file again.');
      return;
    }
    try {
      await this.plugin.mutate(() => this.plugin.gateway.saveUnitNote(this.unit.id, {
        title: this.titleInput?.value || '', text, stageIds: this.referencedStageIds, filePaths,
      }));
      this.plugin.clearUnitNoteDraft(this.unit.id, this.recoveredStageIds);
      new Notice('Learning-session note saved.');
      this.close();
    } catch (error) {
      new Notice(error?.message || String(error));
    }
  }

  onClose() { this.contentEl.empty(); }
}
