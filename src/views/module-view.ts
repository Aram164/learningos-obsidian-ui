export class ModuleView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.moduleId = null; this.componentId = null; }
  getViewType() { return VIEW_MODULE; }
  getDisplayText() { return 'LearningOS · Module'; }
  async setState(state) {
    const nextModuleId = state?.moduleId || this.moduleId;
    if (nextModuleId !== this.moduleId) this.componentId = null;
    this.moduleId = nextModuleId;
    if (Object.prototype.hasOwnProperty.call(state || {}, 'componentId')) this.componentId = state.componentId || null;
    this.render();
  }
  getState() { return { moduleId: this.moduleId, componentId: this.componentId }; }
  async onOpen() {
    this.moduleId = this.leaf.state?.moduleId || this.moduleId;
    this.componentId = this.leaf.state?.componentId || null;
    this.render();
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-module-view');
    const module = this.plugin.store.get(this.moduleId);
    if (!module) { empty(root, 'Module unavailable', 'Return to the program view.'); return; }
    const header = pageHeader(root, module.kind, module.title);
    const facts = header.createDiv({ cls: 'los-facts' });
    for (const [label, value] of [['Status', module.status], ['Institution', module.institution],
      ['Code', module.code], ['Semester', module.semester], ['Credits', module.credits]]) {
      if (value != null) facts.createDiv({ text: `${label}: ${value}` });
    }
    if (module.examination?.type) facts.createDiv({ text: `Examination: ${module.examination.type}` });
    this.renderAcademicDates(root, module);

    if ((module.components || []).length) {
      const tabs = root.createDiv({ cls: 'los-tabs', attr: { role: 'tablist' } });
      const allTab = button(tabs, 'All components', () => this.selectComponent(null),
        this.componentId ? 'quiet' : 'cta');
      allTab.setAttrs({ role: 'tab', 'aria-selected': String(!this.componentId) });
      for (const component of module.components) {
        const tab = button(tabs, component.short_title || component.title,
          () => this.selectComponent(component.id), this.componentId === component.id ? 'cta' : 'quiet');
        tab.setAttrs({ role: 'tab', 'aria-selected': String(this.componentId === component.id) });
      }
    }

    const units = this.plugin.store.unitsFor(module.id, this.componentId);
    const unitSection = section(root, 'Units', 'Choose any lecture/topic without losing another unit’s state.');
    if (!units.length) empty(unitSection, 'No units in this component', 'Return to all components.');
    for (const status of STATUS_ORDER) {
      const rows = units.filter((unit) => unit.status === status);
      if (!rows.length) continue;
      unitSection.createEl('h3', { cls: 'los-group-title', text: status.replaceAll('-', ' ') });
      const grid = unitSection.createDiv({ cls: 'los-card-grid' });
      for (const unit of rows) unitCard(grid, this.plugin, unit);
    }

    this.renderSources(root, module);
    const workspaceSection = section(root, 'Related workspaces');
    const workspaces = this.plugin.store.workspacesForModule(module.id);
    if (!workspaces.length) empty(workspaceSection, 'No active coordination workspace', 'The module/unit tree still owns study state.');
    else {
      const grid = workspaceSection.createDiv({ cls: 'los-card-grid' });
      for (const workspace of workspaces) workspaceCard(grid, this.plugin, workspace, module.id);
    }
    viewFooter(root);
  }

  renderAcademicDates(root, module) {
    const rows = (this.plugin.store.data.academic_deadlines || []).filter((row) =>
      row.module_id === module.id || (row.modules || []).some((entry) => entry.module_id === module.id));
    if (!rows.length) return;
    rows.sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
    const wrap = section(root, 'Academic dates', 'Registration windows and exam sittings for this module.');
    const today = new Date().toISOString().slice(0, 10);
    const ahead = rows.filter((row) => (row.end_date || row.start_date) >= today);
    const past = rows.filter((row) => (row.end_date || row.start_date) < today);
    if (ahead.length) this.renderDeadlineRows(wrap, module, ahead);
    else empty(wrap, 'No upcoming date recorded', 'Past dates remain available below.');
    if (past.length) {
      const history = wrap.createEl('details', { cls: 'los-deadline-history' });
      history.createEl('summary', { text: `Past dates (${past.length})` });
      this.renderDeadlineRows(history, module, past);
    }
  }

  renderDeadlineRows(wrap, module, rows) {
    const list = wrap.createDiv({ cls: 'los-deadline-list' });
    for (const row of rows) {
      const card = list.createDiv({ cls: `los-deadline-card los-deadline-${row.kind}` });
      const date = row.end_date && row.end_date !== row.start_date
        ? `${row.start_date} → ${row.end_date}` : row.start_date;
      card.createDiv({ cls: 'los-deadline-date', text: date });
      const copy = card.createDiv({ cls: 'los-deadline-copy' });
      copy.createEl('strong', { text: row.label });
      if (row.kind === 'registration-window') {
        const entry = (row.modules || []).find((item) => item.module_id === module.id);
        copy.createDiv({ cls: 'los-micro', text: module.title });
        if (entry?.action) copy.createEl('p', { text: entry.action });
      } else {
        copy.createDiv({ text: row.title || module.title });
        const facts = copy.createDiv({ cls: 'los-row' });
        badge(facts, row.registration_state || 'unregistered', row.registration_state || 'needs-map');
        if (row.time) facts.createSpan({ cls: 'los-micro', text: row.time });
        if (row.notes) copy.createEl('p', { cls: 'los-micro', text: row.notes });
      }
    }
  }

  async selectComponent(componentId) {
    this.componentId = componentId;
    await this.leaf.setViewState({
      type: VIEW_MODULE,
      active: true,
      state: { moduleId: this.moduleId, componentId: this.componentId },
    });
  }

  renderSources(root, module) {
    const wrap = section(root, 'Module source map', 'Roles in this module—not global quality scores.');
    const sourceMap = this.plugin.store.sourceMap(module.id);
    if (!sourceMap?.sources?.length) { empty(wrap, 'No routed module sources yet', 'Sources remain globally registered.'); return; }
    const groups = new Map();
    for (const entry of sourceMap.sources) {
      if (!groups.has(entry.role)) groups.set(entry.role, []);
      groups.get(entry.role).push(entry);
    }
    for (const [role, entries] of groups) {
      const group = wrap.createDiv({ cls: 'los-source-role' });
      group.createEl('h3', { text: role.replaceAll('-', ' ') });
      for (const entry of entries) {
        const row = group.createDiv({ cls: 'los-row' });
        chip(row, this.plugin.store.get(entry.source_id), (record) => this.plugin.openLibrary(record.id));
        row.createEl('p', { text: entry.why });
        if (entry.unit_routes?.length) row.createDiv({ cls: 'los-micro', text: `${entry.unit_routes.length} routed unit(s)` });
      }
    }
  }
}
