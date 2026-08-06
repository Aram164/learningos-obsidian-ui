/**
 * Home is the quiet starting point for a real working day.
 *
 * It deliberately avoids a catalogue, progress dashboard, or coordination
 * report. One resumable session is primary; a few time-sensitive items and a
 * few other places to continue remain reachable underneath it.
 */
export class HomeView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_HOME; }
  getDisplayText() { return 'LearningOS · Home'; }
  getIcon() { return 'home'; }
  async onOpen() { this.render(); }

  greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass('los-root', 'los-home');
    if (!this.plugin.store.ready) {
      pageHeader(root, 'LearningOS', 'Projection unavailable');
      empty(root, 'The interface contract could not be loaded', this.plugin.store.error,
        'Rebuild views', () => this.plugin.generate());
      return;
    }

    const header = pageHeader(root, 'Home', this.greeting(),
      'Resume what matters without rebuilding the context first.');
    header.addClass('los-home-header');
    const actions = header.createDiv({ cls: 'los-actions los-home-header-actions' });
    button(actions, 'Capture', () => this.plugin.openCapture(), 'quiet');
    const search = button(actions, 'Search', () => this.plugin.openGlobalSearch(), 'quiet');
    search.setAttribute('aria-label', 'Search LearningOS');

    this.renderContinue(root);
    this.renderToday(root);
    this.renderElsewhere(root);
  }

  /** The one filled action on Home. */
  renderContinue(root) {
    const pointer = this.plugin.store.data.resume_pointer || {};
    const unit = this.plugin.store.get(pointer.unit_id);
    const map = this.plugin.store.get(pointer.study_map_id);
    const stage = this.plugin.store.stage(pointer.stage_id);
    const wrap = root.createDiv({ cls: 'los-continue' });
    if (!unit || !stage) {
      empty(wrap, 'Nothing to resume yet', 'Open Learn and choose a module or project.',
        'Open Learn', () => this.plugin.openLearn());
      return;
    }

    wrap.createDiv({ cls: 'los-kicker', text: 'Continue learning' });
    const body = wrap.createDiv({ cls: 'los-continue-body' });
    const copy = body.createDiv({ cls: 'los-continue-copy' });
    const module = this.plugin.store.get(unit.module_id);
    copy.createDiv({
      cls: 'los-continue-module',
      text: `${module?.title || unit.module_id} · ${unit.title}`,
    });
    copy.createEl('h2', { text: stage.title });
    const stages = Array.isArray(map?.stages) ? map.stages.filter(Boolean) : [];
    const position = stages.findIndex((row) => row?.id === stage.id);
    const meta = copy.createDiv({ cls: 'los-continue-meta' });
    if (stages.length) meta.createSpan({ text: `Stage ${position >= 0 ? position + 1 : 1} of ${stages.length}` });
    if (stage.estimate_minutes) meta.createSpan({ text: `${stage.estimate_minutes} min planned` });
    copy.createDiv({
      cls: 'los-continue-context',
      text: 'Your selected stage, exact resources, and open working state are kept together.',
    });
    const actions = body.createDiv({ cls: 'los-actions' });
    button(actions, 'Continue session', () => this.plugin.openUnit(unit.id, stage.id), 'cta');
  }

  renderToday(root) {
    const sectionEl = section(root, 'Today', 'Only items likely to affect the next decision.');
    const items = [];
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = this.plugin.store.rows('academic_deadlines')
      .filter((row) => (row.end_date || row.start_date || '') >= today)
      .sort((left, right) => String(left.start_date || left.end_date)
        .localeCompare(String(right.start_date || right.end_date)));

    for (const deadline of upcoming.slice(0, 2)) {
      const moduleId = deadline.module_id || deadline.modules?.[0]?.module_id;
      const title = deadline.kind === 'registration-window'
        ? deadline.label
        : deadline.title || deadline.label;
      const date = deadline.end_date && deadline.end_date !== deadline.start_date
        ? `${deadline.start_date} → ${deadline.end_date}`
        : deadline.start_date || deadline.end_date || 'Date pending';
      items.push({
        title,
        detail: `${date}${deadline.registration_state && deadline.registration_state !== 'registered'
          ? ` · ${deadline.registration_state}` : ''}`,
        actionLabel: moduleId ? 'Open module' : '',
        action: moduleId ? () => this.plugin.openModule(moduleId) : null,
      });
    }

    const inbox = this.plugin.store.data.counts?.inbox_items || 0;
    const shelving = this.plugin.store.units().filter((row) => row.status === 'ready-to-shelve').length;
    const needsMap = this.plugin.store.units().filter((row) => !this.plugin.store.mapForUnit(row.id)).length;
    const reviewCount = inbox + shelving + needsMap;
    if (reviewCount) {
      items.push({
        title: `${reviewCount} decision${reviewCount === 1 ? '' : 's'} waiting`,
        detail: [inbox && `${inbox} inbox`, shelving && `${shelving} ready to shelve`,
          needsMap && `${needsMap} without a map`].filter(Boolean).join(' · '),
        actionLabel: 'Open review',
        action: () => this.plugin.openReview(),
      });
    }

    const garden = this.plugin.store.gardenEntries()[0];
    if (garden) {
      items.push({
        title: garden.title,
        detail: 'Recent Garden capture',
        actionLabel: 'Open Garden',
        action: () => this.plugin.openGarden(),
      });
    }

    if (!items.length) {
      empty(sectionEl, 'Nothing time-sensitive', 'Continue the active learning session when you are ready.');
      return;
    }

    const list = sectionEl.createDiv({ cls: 'los-home-list' });
    for (const item of items.slice(0, 4)) this.renderHomeRow(list, item);
  }

  renderElsewhere(root) {
    const sectionEl = section(root, 'Continue elsewhere',
      'Other active modules and projects, kept secondary to the current session.');
    const pointer = this.plugin.store.data.resume_pointer || {};
    const rows = [
      ...this.plugin.store.modules()
        .filter((module) => module.id !== pointer.module_id)
        .filter((module) => !['complete', 'archived'].includes(module.status))
        .map((record) => ({ record, type: record.kind === 'skill' ? 'Skill' : 'Module', open: () => this.plugin.openModule(record.id) })),
      ...this.plugin.store.projects()
        .filter((project) => !['completed', 'archived'].includes(project.status))
        .map((record) => ({ record, type: 'Project', open: () => this.plugin.openProject(record.id) })),
    ].slice(0, 5);

    if (!rows.length) {
      empty(sectionEl, 'No other active work', 'New modules and projects will appear here when projected.');
      return;
    }
    const list = sectionEl.createDiv({ cls: 'los-home-list' });
    for (const row of rows) {
      this.renderHomeRow(list, {
        title: row.record.title,
        detail: `${row.type}${row.type === 'Project' ? '' : this.moduleNextAction(row.record) ? ` · ${this.moduleNextAction(row.record)}` : ''}`,
        actionLabel: 'Open', action: row.open,
      });
    }
  }

  renderHomeRow(parent, item) {
    const row = parent.createDiv({ cls: 'los-home-row' });
    const copy = row.createDiv({ cls: 'los-home-row-copy' });
    copy.createEl('strong', { text: item.title });
    if (item.detail) copy.createDiv({ cls: 'los-micro', text: item.detail });
    if (item.actionLabel && item.action) button(row, item.actionLabel, item.action, 'tertiary');
    return row;
  }

  nextWorkspaceDate(workspace) {
    if (workspace.deadline) return String(workspace.deadline);
    const moduleIds = new Set(workspace.module_ids || []);
    const dates = [];
    for (const row of this.plugin.store.rows('academic_deadlines')) {
      if (row.kind === 'exam' && moduleIds.has(row.module_id)) dates.push(row.start_date);
      if (row.kind === 'registration-window'
          && (row.modules || []).some((module) => moduleIds.has(module.module_id))) dates.push(row.start_date);
    }
    return dates.filter(Boolean).sort()[0] || '9999';
  }

  moduleNextAction(module) {
    const workspace = this.plugin.store.of('workspace')
      .filter((row) => !row.archived && row.status !== 'complete' && (row.module_ids || []).includes(module.id))
      .sort((a, b) => this.nextWorkspaceDate(a).localeCompare(this.nextWorkspaceDate(b)))[0];
    if (workspace?.next_action) return projectedExcerpt(workspace.next_action, 100);
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
}
