export class ModuleView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.moduleId = null; this.componentId = null; }
  getViewType() { return VIEW_MODULE; }
  getDisplayText() { return 'LearningOS · Module'; }
  async setState(state) { this.moduleId = state?.moduleId || this.moduleId; this.render(); }
  getState() { return { moduleId: this.moduleId }; }
  async onOpen() { this.moduleId = this.leaf.state?.moduleId || this.moduleId; this.render(); }

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

    if ((module.components || []).length) {
      const tabs = root.createDiv({ cls: 'los-tabs', attr: { role: 'tablist' } });
      button(tabs, 'All components', () => { this.componentId = null; this.render(); },
        this.componentId ? 'quiet' : 'cta');
      for (const component of module.components) {
        button(tabs, component.short_title || component.title, () => {
          this.componentId = component.id; this.render();
        }, this.componentId === component.id ? 'cta' : 'quiet');
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
    else for (const workspace of workspaces) chip(workspaceSection, workspace, (row) => this.plugin.openRecord(row));
    viewFooter(root);
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
