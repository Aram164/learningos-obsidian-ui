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
    pageHeader(root, 'Current work', 'Bachelor’s first. Every path stays visible.',
      'Resume quickly without hiding modules, skills, thesis work, or paused study maps.');
    this.renderResume(root);
    this.renderAcademic(root);
    this.renderArea(root, 'program-skills', 'Skills');
    this.renderArea(root, 'program-thesis-projects', 'Thesis & projects');
    this.renderQueues(root);
    this.renderBoundaries(root);
    viewFooter(root);
  }

  renderResume(root) {
    const pointer = this.plugin.store.data.resume_pointer || {};
    const unit = this.plugin.store.get(pointer.unit_id);
    const map = this.plugin.store.get(pointer.study_map_id);
    const stage = map?.stages?.find((row) => row.id === pointer.stage_id);
    const wrap = section(root, 'Resume', 'The pointer is a convenience; it never replaces the curriculum.');
    if (!unit || !stage) {
      empty(wrap, 'Nothing to resume yet', 'Choose any module and unit below.');
      return;
    }
    const card = wrap.createDiv({ cls: 'los-resume-card' });
    const copy = card.createDiv({ cls: 'los-resume-copy' });
    copy.createDiv({ cls: 'los-kicker', text: this.plugin.store.get(unit.module_id)?.title || unit.module_id });
    copy.createEl('h2', { text: unit.title });
    copy.createEl('p', { text: stage.title });
    copy.createDiv({ cls: 'los-progress-copy', text: `${(map.stages || []).filter((row) => row.status === 'complete').length} of ${(map.stages || []).length} stages complete` });
    const actions = card.createDiv({ cls: 'los-actions' });
    button(actions, 'Resume stage', () => this.plugin.openUnit(unit.id, stage.id), 'cta');
    if (this.plugin.settings.showAiRecommendation) {
      button(actions, 'Ask AI about this stage', () => this.plugin.askAiScoped(
        'Recommend the smallest useful next action. Do not hide alternative units.',
        { moduleId: unit.module_id, unitId: unit.id, stageId: stage.id }), 'quiet');
    }
  }

  renderAcademic(root) {
    const wrap = section(root, 'Bachelor’s · current semester');
    const current = (this.plugin.store.data.semesters || []).find((row) => row.status === 'current');
    if (current) badge(wrap, current.title, 'active');
    const grid = wrap.createDiv({ cls: 'los-card-grid' });
    for (const module of this.plugin.store.modulesFor('program-bachelors')) {
      moduleCard(grid, this.plugin, module);
    }
    const exams = this.plugin.store.data.exam_spine || [];
    if (exams.length) {
      const facts = wrap.createDiv({ cls: 'los-fact-strip' });
      for (const exam of exams) facts.createDiv({ text: `${exam.date} · ${exam.title} · Termin ${exam.termin}` });
    }
  }

  renderArea(root, programId, title) {
    const wrap = section(root, title);
    const modules = this.plugin.store.modulesFor(programId);
    if (!modules.length) { empty(wrap, `No ${title.toLocaleLowerCase()} modules yet`, 'Nothing is hidden.'); return; }
    const grid = wrap.createDiv({ cls: 'los-card-grid' });
    for (const module of modules) moduleCard(grid, this.plugin, module);
  }

  renderQueues(root) {
    const wrap = section(root, 'Concise queues');
    const queues = wrap.createDiv({ cls: 'los-queue-grid' });
    const needs = this.plugin.store.units().filter((row) => row.status === 'needs-map');
    const shelving = this.plugin.store.units().filter((row) => row.status === 'ready-to-shelve');
    const rows = [
      ['Needs a map', needs.length, () => this.plugin.openProgram('queue-needs-map')],
      ['Ready to shelve', shelving.length, () => shelving[0] && this.plugin.openShelving(shelving[0].id)],
      ['Inbox', this.plugin.store.data.counts?.inbox_items || 0, () => this.plugin.openProgram('inbox')],
    ];
    for (const [label, count, action] of rows) {
      const card = queues.createDiv({ cls: 'los-queue-card is-clickable' });
      card.createDiv({ cls: 'los-queue-count', text: String(count) });
      card.createDiv({ text: label });
      card.addEventListener('click', action);
    }
  }

  renderBoundaries(root) {
    const wrap = section(root, 'Boundaries');
    const grid = wrap.createDiv({ cls: 'los-card-grid' });
    for (const boundary of this.plugin.store.data.quarantine_boundaries || []) {
      const card = grid.createDiv({ cls: 'los-card los-boundary-card is-clickable' });
      icon(card.createSpan(), 'shield');
      card.createEl('h3', { text: boundary.title });
      card.createEl('p', { text: boundary.description });
      card.addEventListener('click', () => this.plugin.openBoundary(boundary.id));
    }
  }
}
