export class UnitView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf); this.plugin = plugin; this.unitId = null; this.stageId = null;
  }
  getViewType() { return VIEW_UNIT; }
  getDisplayText() { return 'LearningOS · Unit'; }
  async setState(state) {
    const nextUnitId = state?.unitId || this.unitId;
    if (nextUnitId !== this.unitId) this.stageId = null;
    this.unitId = nextUnitId;
    const requested = Object.prototype.hasOwnProperty.call(state || {}, 'stageId') ? state.stageId : null;
    this.stageId = this.plugin.getSelectedStage(this.unitId) || requested || this.stageId;
    this.render();
  }
  getState() { return { unitId: this.unitId, stageId: this.stageId }; }
  async onOpen() {
    this.unitId = this.leaf.state?.unitId || this.unitId;
    this.stageId = this.plugin.getSelectedStage(this.unitId) || this.leaf.state?.stageId || this.stageId;
    this.render();
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-unit-view');
    const unit = this.plugin.store.get(this.unitId);
    if (!unit) { empty(root, 'Unit unavailable', 'Return to its module.'); return; }
    const module = this.plugin.store.get(unit.module_id);
    const header = pageHeader(root, `${module?.title || unit.module_id} · ${unit.kind}`, unit.title, unit.scope);
    const headerActions = header.createDiv({ cls: 'los-actions' });
    button(headerActions, 'Back to module', () => this.plugin.openModule(unit.module_id), 'quiet');
    button(headerActions, 'Ask AI with unit context', () => this.plugin.askAiScoped(
      'Help with this unit. Treat the active file as supplementary context only.',
      { moduleId: unit.module_id, unitId: unit.id, stageId: this.stageId }), 'quiet');

    const studyMap = this.plugin.store.mapForUnit(unit.id);
    if (!studyMap) {
      const missing = section(root, 'Study map needed');
      empty(missing, 'This unit has no current study script',
        'AI may propose a scoped map; the core imports it only after review.',
        'Create map with AI', () => this.plugin.askAiScoped(
          'Propose one study-map JSON document for this unit. Do not write files; include exact source actions and done-when criteria.',
          { moduleId: unit.module_id, unitId: unit.id, componentId: unit.component_id }));
      this.renderArtifacts(root, unit);
      viewFooter(root); return;
    }
    // A study map whose `stages` is missing or not an array used to throw here
    // and blank the whole workspace. Normalise once, then work from `map`.
    const stages = Array.isArray(studyMap.stages)
      ? studyMap.stages.filter((row) => row && typeof row === 'object') : [];
    if (!stages.length) {
      const bare = section(root, 'Study map needs stages');
      empty(bare, 'This study map has no stages yet',
        'Stage authoring belongs to the core — import a map or add stages there, then rebuild views.');
      this.renderArtifacts(root, unit);
      viewFooter(root); return;
    }
    const map = { ...studyMap, stages };
    if (!this.stageId || !stages.some((row) => row.id === this.stageId)) {
      this.stageId = map.current_stage;
      this.plugin.setSelectedStage(unit.id, this.stageId);
    }
    const stage = stages.find((row) => row.id === this.stageId) || stages[0];
    const layout = root.createDiv({ cls: 'los-unit-layout' });
    this.renderRail(layout, unit, map, stage);
    this.renderStage(layout, unit, map, stage);
    this.renderNotes(layout, unit, map, stage);
    this.renderArtifacts(root, unit);
    viewFooter(root);
  }

  renderRail(layout, unit, studyMap, current) {
    const rail = layout.createDiv({ cls: 'los-stage-rail' });
    rail.createEl('h2', { text: 'Stages' });
    for (const [index, stage] of studyMap.stages.entries()) {
      const row = rail.createEl('button', {
        cls: `los-stage-row los-s-${stage.status} ${stage.id === current.id ? 'is-selected' : ''} is-clickable`,
        attr: { type: 'button', 'aria-current': stage.id === current.id ? 'step' : 'false' },
      });
      row.createSpan({ cls: 'los-stage-index', text: String(index + 1).padStart(2, '0') });
      const copy = row.createSpan({ cls: 'los-stage-copy' });
      copy.createSpan({ text: stage.title });
      const hasDraft = this.plugin.getStageDraft(unit.id, stage.id, stage.notes_text || '').dirty;
      copy.createSpan({ cls: 'los-micro', text: `${stage.status}${hasDraft ? ' · unsaved draft' : ''}` });
      row.addEventListener('click', () => this.selectStage(stage.id));
    }
    const mapActions = rail.createDiv({ cls: 'los-stack-actions' });
    if (current.status !== 'active') button(mapActions, 'Revisit stage', () => this.mutate(
      () => this.plugin.gateway.progress(unit.id, current.id, 'revisit')));
    button(mapActions, 'Pause unit', () => this.mutate(
      () => this.plugin.gateway.progress(unit.id, current.id, 'paused')), 'quiet');
  }

  renderStage(layout, unit, studyMap, stage) {
    const center = layout.createDiv({ cls: 'los-stage-workspace' });
    const top = center.createDiv({ cls: 'los-stage-heading' });
    top.createDiv({ cls: 'los-kicker', text: stage.exam_critical ? 'Exam-critical stage' : stage.scope_triage });
    top.createEl('h2', { text: stage.title });
    top.createEl('p', { text: stage.objective });
    if (stage.estimate_minutes) badge(top, `${stage.estimate_minutes} min`, 'role');

    const resources = section(center, 'Exact resources', 'Only the actions for this stage.');
    // Array.isArray, not a truthy length check: a string here used to render
    // one blank row per character, because for...of walks a string by character.
    const stageResources = Array.isArray(stage.resources)
      ? stage.resources.filter((row) => row && typeof row === 'object') : [];
    if (!stageResources.length) empty(resources, 'No source action selected', 'Use the unit scope and ask AI for a proposal.');
    for (const resource of stageResources) {
      const row = resources.createDiv({ cls: 'los-resource-row' });
      icon(row.createSpan(), resource.kind === 'watch' ? 'play' : resource.kind === 'practise' ? 'pencil-line' : 'book-open');
      const copy = row.createDiv({ cls: 'los-resource-copy' });
      copy.createEl('strong', { text: resource.label });
      if (resource.locator) copy.createDiv({ cls: 'los-micro', text: resource.locator });
      if (resource.source_id) {
        const source = this.plugin.store.get(resource.source_id);
        chip(copy, source, (record) => this.plugin.openLibrary(record.id));
      }
      const actions = row.createDiv({ cls: 'los-actions los-resource-actions' });
      if (resource.url || resource.vault_path) button(actions, 'Open', () => this.plugin.openResource(resource), 'quiet');
      if (resource.source_id) {
        button(actions, 'Helpful', () => this.mutate(
          () => this.plugin.gateway.feedback(unit.id, stage.id, resource.source_id, 'helpful')), 'tertiary');
        button(actions, 'Too advanced', () => this.mutate(
          () => this.plugin.gateway.feedback(unit.id, stage.id, resource.source_id, 'too-advanced')), 'tertiary');
        button(actions, 'Useful for review', () => this.mutate(
          () => this.plugin.gateway.feedback(unit.id, stage.id, resource.source_id, 'useful-for-review')), 'tertiary');
      }
    }

    const done = section(center, 'Done when');
    const list = done.createEl('ul');
    const criteria = Array.isArray(stage.done_when)
      ? stage.done_when.filter((row) => typeof row === 'string' && row.trim()) : [];
    for (const criterion of criteria) list.createEl('li', { text: criterion });
    const actions = center.createDiv({ cls: 'los-actions los-stage-actions' });
    button(actions, 'Complete stage', () => this.mutate(
      () => this.plugin.gateway.progress(unit.id, stage.id, 'complete')), 'cta');
    button(actions, 'Skip stage', () => this.mutate(
      () => this.plugin.gateway.progress(unit.id, stage.id, 'skipped')), 'quiet');
    button(actions, 'I found a gap', () => this.mutate(
      () => this.plugin.gateway.detour(unit.id, stage.id, 'Prerequisite gap', 'required-now')), 'quiet');
    button(actions, 'Prepare shelving', () => this.plugin.openShelving(unit.id), 'quiet');
    button(actions, 'End learning session', () => this.plugin.reviewSessionEnd(), 'quiet');
  }

  renderNotes(layout, unit, studyMap, stage) {
    const panel = layout.createDiv({ cls: 'los-note-panel' });
    panel.createEl('h2', { text: 'Working note' });
    panel.createEl('p', { cls: 'los-muted', text: 'Stage-bound scratch. No concept ID or filing destination needed.' });
    const editor = panel.createEl('textarea', { cls: 'los-note-editor', attr: { 'aria-label': 'Stage working note' } });
    const savedText = stage.notes_text || '';
    const draft = this.plugin.getStageDraft(unit.id, stage.id, savedText);
    editor.value = draft.text;
    const status = panel.createDiv({ cls: 'los-draft-status', attr: { 'aria-live': 'polite' } });
    const updateStatus = () => {
      const dirty = editor.value !== savedText;
      status.setText(dirty ? 'Unsaved draft kept locally.' : 'All changes saved.');
      status.toggleClass('is-dirty', dirty);
    };
    editor.addEventListener('input', () => {
      this.plugin.setStageDraft(unit.id, stage.id, editor.value, savedText);
      updateStatus();
    });
    updateStatus();
    button(panel, 'Save note', () => this.saveStageNote(unit, stage, editor.value), 'cta');
    const attachments = section(panel, 'Attachments');
    const stageAttachments = Array.isArray(stage.attachments) ? stage.attachments.filter(Boolean) : [];
    if (!stageAttachments.length) attachments.createEl('p', { text: 'Attach handwriting or a PDF through the guarded stage-attach action.' });
    for (const attachment of stageAttachments) {
      const path = typeof attachment === 'string' ? attachment : attachment.path || attachment.vault_path;
      const label = typeof attachment === 'string' ? attachment.split('/').pop() : attachment.label || path;
      if (path) button(attachments, `Open ${label}`, () => this.plugin.openAuthoredPath(path), 'quiet');
      else attachments.createDiv({ text: label || 'Attachment' });
    }
    const picker = attachments.createEl('input', {
      cls: 'los-file-input', attr: { type: 'file', 'aria-label': 'Choose stage attachment' },
    });
    button(attachments, 'Attach selected file', () => {
      const file = picker.files?.[0];
      const localPath = localFilePath(file);
      if (!localPath) { new Notice('Choose a local handwriting, image, or PDF file first.'); return; }
      this.mutate(() => this.plugin.gateway.attach(unit.id, stage.id, localPath, file.name));
    }, 'quiet');
    for (const detour of studyMap.detours || []) {
      if (detour.spawned_by_stage !== stage.id || detour.status === 'resolved') continue;
      const row = section(panel, 'Open prerequisite detour');
      row.createEl('p', { text: `${detour.title} · ${detour.classification} · returns here` });
      button(row, 'Resolve and return', () => this.mutate(
        () => this.plugin.gateway.resolveDetour(unit.id, detour.id, 'Resolved from the unit workspace.')), 'quiet');
    }
    if (stage.source_feedback?.length) {
      const feedback = section(panel, 'Source-use evidence');
      for (const row of stage.source_feedback) feedback.createDiv({ cls: 'los-row', text: `${row.source_id} · ${row.feedback}` });
    }
  }

  renderArtifacts(root, unit) {
    const wrap = section(root, 'Unit artifacts', 'Durable notes remain globally canonical; this unit owns stable references.');
    const labels = { ultimate_reference: 'Ultimate Reference', exercise_bank: 'Exercise Bank', mock_exam: 'Mock Exam' };
    let count = 0;
    for (const [key, label] of Object.entries(labels)) {
      const id = unit.artifacts?.[key];
      if (!id) continue;
      count += 1;
      const card = wrap.createDiv({ cls: 'los-artifact-card' });
      card.createEl('h3', { text: label });
      chip(card, this.plugin.store.get(id), (record) => this.plugin.openRecord(record));
    }
    for (const id of unit.artifacts?.other || []) {
      count += 1; chip(wrap, this.plugin.store.get(id), (record) => this.plugin.openRecord(record));
    }
    if (!count) empty(wrap, 'No durable artifact linked yet', 'Working notes stay with the stage until shelving is approved.');
  }

  /**
   * One write at a time. Two fast clicks used to spawn two CLI subprocesses
   * carrying the same --expected-snapshot, so the second raced the projection
   * the first had already moved.
   */
  async mutate(action) {
    if (this.busy) { new Notice('A LearningOS write is already running.'); return; }
    this.busy = true;
    try { await action(); await this.plugin.reloadStore(); this.render(); }
    catch (error) { new Notice(error?.message || String(error)); }
    finally { this.busy = false; }
  }

  async saveStageNote(unit, stage, text) {
    if (this.busy) { new Notice('A LearningOS write is already running.'); return; }
    this.busy = true;
    try {
      await this.plugin.gateway.saveNote(unit.id, stage.id, text);
      // Reached only on a confirmed ok — the gateway rejects empty or
      // unreadable output — so the draft is safe to drop here and only here.
      this.plugin.clearStageDraft(unit.id, stage.id);
      await this.plugin.reloadStore();
      new Notice('Stage note saved.');
    } catch (error) { new Notice(error?.message || String(error)); }
    finally { this.busy = false; }
  }

  async selectStage(stageId) {
    this.stageId = stageId;
    this.plugin.setSelectedStage(this.unitId, stageId);
    await this.leaf.setViewState({
      type: VIEW_UNIT,
      active: true,
      state: { unitId: this.unitId, stageId: this.stageId },
    });
  }
}
