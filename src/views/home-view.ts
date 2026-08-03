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
    pageHeader(root, '', 'Current work');
    root.createSpan({ cls: 'los-sr-only', text: 'Bachelor’s first. Every path stays visible.' });
    this.renderResume(root);
    this.renderDecisionLayer(root);
    this.renderCommandCentre(root);
    this.renderQueues(root);
    this.renderBoundaries(root);
    viewFooter(root);
  }

  renderDecisionLayer(root) {
    const wrap = root.createDiv({ cls: 'los-section los-priority-section' });
    wrap.createEl('h2', { text: 'Semester priority' });
    const bar = wrap.createDiv({ cls: 'los-priority-bar' });
    icon(bar.createSpan({ cls: 'los-priority-icon' }), 'flag');
    const coordination = this.plugin.store.get('coordination');
    const priority = projectedExcerpt(coordination?.sections?.Priorities);
    const copy = bar.createDiv({ cls: 'los-priority-copy' });
    copy.createEl('strong', { text: 'Priority decision' });
    copy.createSpan({ text: priority || 'No current priority decision.' });
    const contextRows = ['Commitments', 'Dependencies', 'Deferrals']
      .map((heading) => [heading, projectedExcerpt(coordination?.sections?.[heading])])
      .filter(([, body]) => body);
    if (priority || contextRows.length) {
      const details = bar.createEl('details', { cls: 'los-coordination-details' });
      details.createEl('summary', { text: 'View details' });
      const panel = details.createDiv({ cls: 'los-coordination-panel' });
      panel.createEl('h3', { text: 'Coordination context' });
      if (priority) {
        const row = panel.createDiv({ cls: 'los-coordination-row' });
        row.createEl('strong', { text: 'Priorities' });
        row.createEl('p', { text: priority });
      }
      for (const [heading, body] of contextRows) {
        const row = panel.createDiv({ cls: 'los-coordination-row' });
        row.createEl('strong', { text: heading });
        row.createEl('p', { text: body });
      }
    }
  }

  nextWorkspaceDate(workspace) {
    if (workspace.deadline) return String(workspace.deadline);
    const moduleIds = new Set(workspace.module_ids || []);
    const dates = [];
    for (const row of this.plugin.store.data.academic_deadlines || []) {
      if (row.kind === 'exam' && moduleIds.has(row.module_id)) dates.push(row.start_date);
      if (row.kind === 'registration-window' &&
          (row.modules || []).some((module) => moduleIds.has(module.module_id))) dates.push(row.start_date);
    }
    return dates.filter(Boolean).sort()[0] || '9999';
  }

  renderResume(root) {
    const pointer = this.plugin.store.data.resume_pointer || {};
    const unit = this.plugin.store.get(pointer.unit_id);
    const map = this.plugin.store.get(pointer.study_map_id);
    const stage = this.plugin.store.stage(pointer.stage_id);
    const wrap = root.createDiv({ cls: 'los-section los-resume-section' });
    if (!unit || !stage) {
      empty(wrap, 'Nothing to resume yet', 'Choose any module and unit below.');
      return;
    }
    const card = wrap.createDiv({ cls: 'los-resume-card' });
    const copy = card.createDiv({ cls: 'los-resume-copy' });
    copy.createDiv({ cls: 'los-kicker', text: this.plugin.store.get(unit.module_id)?.title || unit.module_id });
    copy.createEl('h2', { text: unit.title });
    const progress = copy.createDiv({ cls: 'los-resume-progress' });
    progress.createSpan({ text: stage.title });
    const stages = Array.isArray(map?.stages) ? map.stages.filter(Boolean) : [];
    progress.createSpan({ cls: 'los-progress-copy', text: `${stages.filter((row) => row?.status === 'complete').length} of ${stages.length} stages complete` });
    const actions = card.createDiv({ cls: 'los-actions' });
    button(actions, 'Resume stage', () => this.plugin.openUnit(unit.id, stage.id), 'cta');
    if (this.plugin.settings.showAiRecommendation) {
      button(actions, 'Ask AI about this stage', () => this.plugin.askAiScoped(
        'Recommend the smallest useful next action. Do not hide alternative units.',
        { moduleId: unit.module_id, unitId: unit.id, stageId: stage.id }), 'quiet');
    }
  }

  renderCommandCentre(root) {
    const layout = root.createDiv({ cls: 'los-section los-command-centre' });
    const primary = layout.createDiv({ cls: 'los-command-column' });
    const secondary = layout.createDiv({ cls: 'los-command-column' });
    const deadlines = this.plugin.store.data.academic_deadlines || [];
    this.renderAcademicDates(primary, deadlines);
    this.renderAcademic(primary);
    this.renderArea(secondary, 'program-skills', 'Skills');
    this.renderArea(secondary, 'program-thesis-projects', 'Thesis');
  }

  renderAcademic(parent) {
    const wrap = parent.createDiv({ cls: 'los-command-block' });
    const current = (this.plugin.store.data.semesters || []).find((row) => row.status === 'current');
    const heading = wrap.createDiv({ cls: 'los-command-heading' });
    heading.createEl('h2', { text: 'Bachelor modules' });
    if (current) badge(heading, current.title, 'active');
    this.renderModuleTable(wrap, this.plugin.store.modulesFor('program-bachelors'));
  }

  /* The core records every sitting truthfully, history included; deciding what
   * is still ahead is a live display and therefore the interface's job (ADR-006
   * — the determinism rule binds generated files, not rendered views). */
  renderAcademicDates(parent, deadlines) {
    const wrap = parent.createDiv({ cls: 'los-command-block los-academic-dates' });
    wrap.createEl('h2', { text: 'Academic dates' });
    const today = new Date().toISOString().slice(0, 10);
    const ahead = deadlines.filter((row) => (row.end_date || row.start_date) >= today);
    const past = deadlines.filter((row) => (row.end_date || row.start_date) < today);
    if (ahead.length) this.renderDeadlineList(wrap, ahead.slice(0, 3));
    else empty(wrap, 'Nothing scheduled ahead', 'Every recorded sitting is in the past.');
    if (ahead.length > 3) {
      const details = wrap.createEl('details', { cls: 'los-deadline-history los-deadline-more' });
      details.createEl('summary', { text: `More upcoming dates (${ahead.length - 3})` });
      this.renderDeadlineList(details, ahead.slice(3));
    }
    if (past.length) {
      const details = wrap.createEl('details', { cls: 'los-deadline-history' });
      details.createEl('summary', { text: `Past dates (${past.length})` });
      this.renderDeadlineList(details, past);
    }
  }

  renderDeadlineList(wrap, deadlines) {
    const list = wrap.createDiv({ cls: 'los-deadline-list' });
    for (const row of deadlines) {
      const card = list.createDiv({ cls: `los-deadline-card los-deadline-${row.kind}` });
      const date = row.end_date && row.end_date !== row.start_date
        ? `${row.start_date} → ${row.end_date}` : row.start_date;
      card.createDiv({ cls: 'los-deadline-date', text: date });
      const copy = card.createDiv({ cls: 'los-deadline-copy' });
      copy.createEl('strong', { text: row.label });
      if (row.kind === 'registration-window') {
        const modules = row.modules || [];
        const moduleTitle = (module) => module.title
          || this.plugin.store.get(module.module_id)?.title || module.module_id;
        copy.createDiv({ cls: 'los-micro', text: modules.map(moduleTitle).join(' · ') });
        const details = copy.createEl('details', { cls: 'los-deadline-action-details' });
        details.createEl('summary', { text: `${modules.length} registration action${modules.length === 1 ? '' : 's'}` });
        const actions = details.createDiv({ cls: 'los-deadline-actions' });
        for (const module of modules) {
          const title = moduleTitle(module);
          const rowAction = actions.createDiv({ cls: 'los-deadline-action-row' });
          const record = this.plugin.store.get(module.module_id);
          const open = button(rowAction, record?.code || title, () => this.plugin.openModule(module.module_id), 'row');
          open.setAttribute('aria-label', `Open ${title}`);
          if (module.action) rowAction.createSpan({ text: module.action });
        }
      } else {
        copy.createDiv({ text: row.title });
        const facts = copy.createDiv({ cls: 'los-row' });
        badge(facts, row.registration_state || 'unregistered', row.registration_state || 'needs-map');
        if (row.time) facts.createSpan({ cls: 'los-micro', text: row.time });
        if (row.notes) copy.createEl('p', { cls: 'los-micro', text: row.notes });
        const actions = copy.createDiv({ cls: 'los-actions los-deadline-actions' });
        const moduleTitle = this.plugin.store.get(row.module_id)?.title;
        button(actions, `Open ${moduleTitle || 'module'}`, () => this.plugin.openModule(row.module_id), 'quiet');
      }
    }
  }

  renderArea(parent, programId, title) {
    const wrap = parent.createDiv({ cls: 'los-command-block' });
    wrap.createEl('h2', { text: title });
    const modules = this.plugin.store.modulesFor(programId);
    if (!modules.length) { empty(wrap, `No ${title.toLocaleLowerCase()} modules yet`, 'Nothing is hidden.'); return; }
    this.renderModuleTable(wrap, modules);
  }

  renderModuleTable(wrap, modules) {
    const tableWrap = wrap.createDiv({ cls: 'los-table-wrap' });
    const table = tableWrap.createEl('table', { cls: 'los-data-table' });
    const head = table.createEl('thead').createEl('tr');
    for (const title of ['Module', 'Status', 'Next up']) head.createEl('th', { text: title, attr: { scope: 'col' } });
    const body = table.createEl('tbody');
    for (const module of modules) {
      const row = body.createEl('tr');
      const title = row.createEl('td', { attr: { 'data-label': 'Module' } });
      button(title, module.title, () => this.plugin.openModule(module.id), 'row');
      const progress = this.plugin.store.progress(module.id);
      const state = row.createEl('td', { attr: { 'data-label': 'Status' } });
      badge(state, module.status, module.status);
      state.createDiv({ cls: 'los-micro', text: `${progress.stages_complete || 0}/${progress.stages_total || 0} stages` });
      row.createEl('td', {
        cls: 'los-next-up',
        text: this.moduleNextAction(module),
        attr: { 'data-label': 'Next up' },
      });
    }
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
    return 'No next action recorded';
  }

  renderQueues(root) {
    const wrap = section(root, 'Queues');
    const queues = wrap.createDiv({ cls: 'los-queue-grid' });
    const needs = this.plugin.store.units().filter((row) => !this.plugin.store.mapForUnit(row.id));
    const shelving = this.plugin.store.units().filter((row) => row.status === 'ready-to-shelve');
    const rows = [
      ['Needs a map', needs.length, () => this.plugin.openProgram('queue-needs-map')],
      ['Ready to shelve', shelving.length, () => shelving[0] && this.plugin.openShelving(shelving[0].id)],
      ['Inbox', this.plugin.store.data.counts?.inbox_items || 0, () => this.plugin.openProgram('inbox')],
    ];
    for (const [label, count, action] of rows) {
      const card = queues.createEl('button', {
        cls: 'los-queue-card is-clickable',
        attr: { type: 'button', 'aria-label': `Open ${label} queue: ${count} items` },
      });
      card.createDiv({ text: label });
      card.createDiv({ cls: 'los-queue-count', text: String(count) });
      card.addEventListener('click', action);
      if (label === 'Ready to shelve' && count === 0) {
        card.disabled = true;
        card.setAttribute('aria-label', 'No units are ready to shelve');
      }
    }
  }

  renderBoundaries(root) {
    const wrap = section(root, 'Boundaries');
    const grid = wrap.createDiv({ cls: 'los-boundary-grid' });
    for (const boundary of this.plugin.store.rows('quarantine_boundaries')) {
      const card = grid.createEl('button', {
        cls: 'los-boundary-card is-clickable',
        attr: { type: 'button', 'aria-label': `Open boundary: ${boundary.title}` },
      });
      icon(card.createSpan(), 'shield');
      card.createEl('h3', { text: boundary.title });
      const policy = boundaryPolicy(boundary.description);
      if (policy) card.createEl('p', { text: policy });
      card.addEventListener('click', () => this.plugin.openBoundary(boundary.id));
    }
  }
}
