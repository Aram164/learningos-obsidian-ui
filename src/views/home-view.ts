/**
 * Home answers one question: what should I do now?
 *
 * Continue, Upcoming, My learning, Attention — in that order, and nothing else.
 * Boundaries, full coordination detail, diagnostics and maintenance moved to
 * where they belong; a learner opening the app should not have to read the
 * whole system before continuing.
 */
export class HomeView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_HOME; }
  getDisplayText() { return 'LearningOS · Home'; }
  getIcon() { return 'home'; }
  async onOpen() { this.render(); }

  render() {
    const root = this.contentEl;
    root.empty(); root.addClass('los-root', 'los-home');
    if (!this.plugin.store.ready) {
      pageHeader(root, 'LearningOS', 'Projection unavailable');
      empty(root, 'The interface contract could not be loaded', this.plugin.store.error,
        'Rebuild views', () => this.plugin.generate());
      return;
    }
    const header = pageHeader(root, '', 'Today');
    const headerActions = header.createDiv({ cls: 'los-actions' });
    button(headerActions, 'Capture', () => this.plugin.openCapture(), 'quiet');
    this.renderContinue(root);
    const columns = root.createDiv({ cls: 'los-home-columns' });
    this.renderUpcoming(columns.createDiv({ cls: 'los-home-column' }));
    this.renderLearning(columns.createDiv({ cls: 'los-home-column' }));
    this.renderAttention(root);
  }

  /** The one primary action on the screen. */
  renderContinue(root) {
    const pointer = this.plugin.store.data.resume_pointer || {};
    const unit = this.plugin.store.get(pointer.unit_id);
    const map = this.plugin.store.get(pointer.study_map_id);
    const stage = this.plugin.store.stage(pointer.stage_id);
    const wrap = root.createDiv({ cls: 'los-continue' });
    if (!unit || !stage) {
      empty(wrap, 'Nothing to resume yet', 'Open Learn and choose any module.',
        'Open Learn', () => this.plugin.openLearn());
      return;
    }
    wrap.createDiv({ cls: 'los-kicker', text: 'Continue' });
    const body = wrap.createDiv({ cls: 'los-continue-body' });
    const copy = body.createDiv({ cls: 'los-continue-copy' });
    const module = this.plugin.store.get(unit.module_id);
    copy.createDiv({ cls: 'los-continue-module', text: `${module?.code || module?.title || unit.module_id} · ${unit.title}` });
    copy.createEl('h2', { text: stage.title });
    const stages = Array.isArray(map?.stages) ? map.stages.filter(Boolean) : [];
    const position = stages.findIndex((row) => row?.id === stage.id);
    const meta = copy.createDiv({ cls: 'los-continue-meta' });
    if (stages.length) {
      meta.createSpan({ text: `Stage ${position >= 0 ? position + 1 : 1} of ${stages.length}` });
    }
    if (stage.estimate_minutes) meta.createSpan({ text: `${stage.estimate_minutes} min planned` });
    const actions = body.createDiv({ cls: 'los-actions' });
    button(actions, 'Continue learning', () => this.plugin.openUnit(unit.id, stage.id), 'cta');
    const priority = projectedExcerpt(this.plugin.store.get('coordination')?.sections?.Priorities, 180);
    if (priority) {
      const bar = wrap.createDiv({ cls: 'los-priority-line' });
      icon(bar.createSpan({ cls: 'los-priority-icon' }), 'flag');
      bar.createSpan({ text: priority });
    }
  }

  /* The core records every sitting truthfully, history included; deciding what
   * is still ahead is a live display and therefore the interface's job (ADR-006
   * — the determinism rule binds generated files, not rendered views). */
  renderUpcoming(parent) {
    parent.createEl('h2', { text: 'Upcoming' });
    const deadlines = this.plugin.store.rows('academic_deadlines');
    const today = new Date().toISOString().slice(0, 10);
    const ahead = deadlines.filter((row) => (row.end_date || row.start_date) >= today);
    if (!ahead.length) {
      empty(parent, 'Nothing scheduled ahead', 'Every recorded sitting is in the past.');
      return;
    }
    this.renderDeadlineRows(parent, ahead.slice(0, 3));
    if (ahead.length > 3) {
      const rest = disclosure(parent, `${ahead.length - 3} more`);
      this.renderDeadlineRows(rest, ahead.slice(3));
    }
  }

  renderDeadlineRows(parent, rows) {
    const list = parent.createDiv({ cls: 'los-date-list' });
    for (const row of rows) {
      const item = list.createDiv({ cls: `los-date-row los-deadline-${row.kind}` });
      const date = row.end_date && row.end_date !== row.start_date
        ? `${row.start_date} → ${row.end_date}` : row.start_date;
      item.createDiv({ cls: 'los-date-when', text: date });
      const copy = item.createDiv({ cls: 'los-date-copy' });
      copy.createEl('strong', { text: row.label });
      if (row.kind === 'registration-window') {
        const modules = row.modules || [];
        const moduleTitle = (module) => module.title
          || this.plugin.store.get(module.module_id)?.title || module.module_id;
        copy.createDiv({ cls: 'los-micro', text: modules.map(moduleTitle).join(' · ') });
        const actions = copy.createDiv({ cls: 'los-actions' });
        for (const module of modules) {
          const record = this.plugin.store.get(module.module_id);
          const open = button(actions, record?.code || moduleTitle(module),
            () => this.plugin.openModule(module.module_id), 'row');
          open.setAttribute('aria-label', `Open ${moduleTitle(module)}`);
        }
      } else {
        copy.createDiv({ cls: 'los-micro', text: row.title || '' });
        if (row.registration_state && row.registration_state !== 'registered') {
          badge(copy, row.registration_state, 'needs-map');
        }
        const open = button(copy, this.plugin.store.get(row.module_id)?.code || 'Open module',
          () => this.plugin.openModule(row.module_id), 'row');
        open.setAttribute('aria-label', `Open ${this.plugin.store.get(row.module_id)?.title || 'module'}`);
      }
    }
  }

  /** Every area stays enumerated and reachable — compact, not hidden. */
  renderLearning(parent) {
    parent.createEl('h2', { text: 'My learning' });
    let rendered = 0;
    for (const [programId, title] of LEARN_AREAS) {
      const modules = this.plugin.store.modulesFor(programId);
      if (!modules.length) continue;
      rendered += modules.length;
      parent.createDiv({ cls: 'los-group-title', text: title });
      const list = parent.createDiv({ cls: 'los-learning-list' });
      for (const module of modules) progressRow(list, this.plugin, module, this.moduleNextAction(module));
    }
    if (!rendered) empty(parent, 'No modules yet', 'Nothing is hidden — areas appear here as modules are added.');
  }

  nextWorkspaceDate(workspace) {
    if (workspace.deadline) return String(workspace.deadline);
    const moduleIds = new Set(workspace.module_ids || []);
    const dates = [];
    for (const row of this.plugin.store.rows('academic_deadlines')) {
      if (row.kind === 'exam' && moduleIds.has(row.module_id)) dates.push(row.start_date);
      if (row.kind === 'registration-window' &&
          (row.modules || []).some((module) => moduleIds.has(module.module_id))) dates.push(row.start_date);
    }
    return dates.filter(Boolean).sort()[0] || '9999';
  }

  moduleNextAction(module) {
    const workspace = this.plugin.store.of('workspace')
      .filter((row) => !row.archived && row.status !== 'complete' && (row.module_ids || []).includes(module.id))
      .sort((a, b) => this.nextWorkspaceDate(a).localeCompare(this.nextWorkspaceDate(b)))[0];
    if (workspace?.next_action) return projectedExcerpt(workspace.next_action, 120);
    const pointer = this.plugin.store.data.resume_pointer || {};
    if (pointer.module_id === module.id) {
      const stage = this.plugin.store.stage(pointer.stage_id);
      if (stage?.title) return stage.title;
    }
    for (const unit of this.plugin.store.unitsFor(module.id)) {
      const map = this.plugin.store.mapForUnit(unit.id);
      if (!map) continue;
      const stage = (map.stages || []).find((row) => row.id === map.current_stage)
        || (map.stages || []).find((row) => row.status === 'active')
        || (map.stages || []).find((row) => row.status !== 'complete');
      if (stage?.title) return stage.title;
    }
    return '';
  }

  /** One compact row, not three queue cards competing with current work. */
  renderAttention(root) {
    const inbox = this.plugin.store.data.counts?.inbox_items || 0;
    const shelving = this.plugin.store.units().filter((row) => row.status === 'ready-to-shelve').length;
    const needsMap = this.plugin.store.units().filter((row) => !this.plugin.store.mapForUnit(row.id)).length;
    const parts = [
      inbox && `${inbox} inbox item${inbox === 1 ? '' : 's'}`,
      shelving && `${shelving} unit${shelving === 1 ? '' : 's'} ready to shelve`,
      needsMap && `${needsMap} unit${needsMap === 1 ? '' : 's'} without a map`,
    ].filter(Boolean);
    const row = root.createDiv({ cls: 'los-attention' });
    if (!parts.length) {
      row.createSpan({ cls: 'los-micro', text: 'Nothing waiting on a decision.' });
      return;
    }
    icon(row.createSpan({ cls: 'los-attention-icon' }), 'bell');
    row.createSpan({ text: `Attention: ${parts.join(' · ')}` });
    button(row, 'Review', () => this.plugin.openReview(), 'quiet');
  }
}
