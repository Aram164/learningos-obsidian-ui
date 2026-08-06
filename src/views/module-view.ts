import { ItemView } from 'obsidian';
import { badge, button, chip, disclosure, empty, pageHeader, section, unitCard, workspaceCard } from '../components';
import { STATUS_ORDER, VIEW_MODULE } from '../constants';

/**
 * Four tabs, because a module page was four pages wearing one coat: learning
 * work, resources, and administration each have their own reading mode. Units
 * is the default — the learner is here to study, not to check a credit count.
 */
export class ModuleView extends ItemView {
  [key: string]: any;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.screen = 'groups';
    this.groupId = null;
    this.query = '';
    this.moduleId = null;
    this.componentId = null;
    this.tab = null;
    this.selectedElementId = null;
  }
  getViewType() { return VIEW_MODULE; }
  getDisplayText() { return 'LearningOS · Modules'; }

  async setState(state: any = {}) {
    this.screen = state.screen || (state.moduleId ? 'detail' : 'groups');
    this.groupId = state.groupId || null;
    this.query = state.query || '';
    const nextModuleId = state.moduleId || null;
    if (nextModuleId !== this.moduleId) { this.componentId = null; this.tab = null; }
    this.moduleId = nextModuleId;
    if (Object.prototype.hasOwnProperty.call(state, 'componentId')) this.componentId = state.componentId || null;
    if (Object.prototype.hasOwnProperty.call(state, 'tab')) this.tab = state.tab || null;
    this.render();
  }
  getState() {
    return {
      screen: this.screen, groupId: this.groupId, query: this.query,
      moduleId: this.moduleId, componentId: this.componentId, tab: this.tab,
    };
  }
  async onOpen() { await this.setState(this.leaf.state || {}); }

  /** Units unless there is nothing to study yet. */
  defaultTab(module) {
    return this.plugin.store.unitsFor(module.id).length ? 'units' : 'overview';
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-module-view');
    if (this.screen === 'list') return this.renderGroupList(root);
    if (this.screen === 'detail') return this.renderModuleDetail(root);
    return this.renderGroups(root);
  }

  renderGroups(root) {
    pageHeader(root, 'Modules', 'Choose a thematic group',
      'Modules stay organized by explicit core-owned domains. Open a group to see its contents.');
    const groups = this.plugin.store.thematicGroups();
    if (!groups.length) {
      empty(root, 'No thematic groups', 'Rebuild the projection after defining thematic-group metadata.');
      return;
    }
    const grid = root.createDiv({ cls: 'los-group-grid' });
    for (const group of groups) {
      const modules = this.plugin.store.modulesForGroup(group.id);
      const card = grid.createEl('button', {
        cls: 'los-group-card is-clickable',
        attr: { type: 'button', 'aria-label': `Open ${group.title}` },
      });
      const head = card.createDiv({ cls: 'los-group-card-header' });
      head.createEl('h2', { text: group.title });
      head.createSpan({ cls: 'los-group-count', text: `${modules.length} module${modules.length === 1 ? '' : 's'}` });
      if (group.description) card.createEl('p', { text: group.description });
      card.createSpan({ cls: 'los-route-open', text: 'Open →' });
      card.addEventListener('click', () => {
        this.selectedElementId = group.id;
        this.plugin.openModuleGroup(group.id);
      });
    }
  }

  renderGroupList(root) {
    const group = this.plugin.store.get(this.groupId);
    const back = button(root, '‹ Modules', () => this.plugin.back(), 'quiet');
    back.addClass('los-route-back');
    if (!group) {
      empty(root, 'Thematic group unavailable', 'Return to Modules and choose another group.', 'Back', () => this.plugin.back());
      return;
    }
    pageHeader(root, 'Modules', group.title, group.description || 'Modules in this thematic group.');
    const search = root.createEl('input', {
      cls: 'los-search los-route-search',
      attr: { type: 'search', placeholder: `Search ${group.title} modules…`, 'aria-label': `Search ${group.title} modules` },
    });
    search.value = this.query;
    search.addEventListener('input', async () => {
      this.query = search.value;
      await this.plugin.router.remember({ name: 'module-list', groupId: this.groupId, query: this.query });
      this.render();
    });
    const all = this.plugin.store.modulesForGroup(group.id);
    const needle = this.query.trim().toLocaleLowerCase();
    const rows = all.filter((module) => !needle || [module.title, module.code, module.kind, module.semester]
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(needle));
    if (!all.length) {
      empty(root, 'No modules in this group', 'The group exists, but no modules currently reference it.');
      return;
    }
    if (!rows.length) {
      empty(root, 'No matching modules', `Nothing in ${group.title} matches “${this.query.trim()}”.`,
        'Clear search', async () => {
          this.query = '';
          await this.plugin.router.remember({ name: 'module-list', groupId: this.groupId, query: '' });
          this.render();
        });
      return;
    }
    const list = root.createDiv({ cls: 'los-route-list' });
    for (const module of rows) {
      const row = list.createEl('button', {
        cls: 'los-route-row is-clickable',
        attr: { type: 'button', 'aria-label': `Open module: ${module.title}`, 'data-record-id': module.id },
      });
      const copy = row.createDiv({ cls: 'los-route-row-copy' });
      copy.createEl('strong', { text: module.title });
      const meta = [module.code, module.kind, module.semester, module.status].filter(Boolean).join(' · ');
      if (meta) copy.createDiv({ cls: 'los-route-meta', text: meta });
      row.createSpan({ cls: 'los-route-open', text: 'Open →' });
      row.addEventListener('click', () => {
        this.selectedElementId = module.id;
        this.plugin.openModuleDetail(module.id);
      });
    }
  }

  renderModuleDetail(root) {
    const module = this.plugin.store.get(this.moduleId);
    const back = button(root, '‹ Back', () => this.plugin.back(), 'quiet');
    back.addClass('los-route-back');
    if (!module) { empty(root, 'Module unavailable', 'Return to Modules and choose another module.'); return; }
    const tab = this.tab || this.defaultTab(module);
    const header = pageHeader(root, module.kind, module.title);
    header.createDiv({ cls: 'los-module-facts', text: this.headline(module) });

    const tabs = root.createDiv({ cls: 'los-tabs', attr: { role: 'tablist' } });
    for (const [key, label] of [['overview', 'Overview'], ['units', 'Units'],
      ['resources', 'Resources'], ['logistics', 'Logistics']]) {
      const control = button(tabs, label, () => this.selectTab(key), key === tab ? 'cta' : 'quiet');
      control.setAttrs({ role: 'tab', 'aria-selected': String(key === tab) });
    }

    if (tab === 'overview') this.renderOverview(root, module);
    else if (tab === 'units') this.renderUnits(root, module);
    else if (tab === 'resources') this.renderSources(root, module);
    else this.renderLogistics(root, module);
  }

  /** One line instead of six labelled facts; the rest is in Logistics. */
  headline(module) {
    const nextDate = this.deadlinesFor(module)
      .filter((row) => (row.end_date || row.start_date) >= new Date().toISOString().slice(0, 10))
      .map((row) => row.start_date)[0];
    return [
      module.semester,
      module.credits != null ? `${module.credits} LP` : '',
      module.examination?.type ? `${module.examination.type}${nextDate ? ` ${nextDate}` : ''}` : '',
    ].filter(Boolean).join(' · ');
  }

  renderOverview(root, module) {
    const progress = this.plugin.store.progress(module.id);
    const wrap = root.createDiv({ cls: 'los-overview' });
    wrap.createDiv({
      cls: 'los-overview-progress',
      text: `${progress.stages_complete || 0} of ${progress.stages_total || 0} stages complete across ${progress.units_total || 0} unit${progress.units_total === 1 ? '' : 's'}`,
    });
    const workspaces = this.plugin.store.workspacesForModule(module.id);
    for (const workspace of workspaces) workspaceCard(wrap, this.plugin, workspace, module.id);
    if (!workspaces.length) {
      empty(wrap, 'No active coordination workspace', 'The module/unit tree still owns study state.');
    }
    const next = this.plugin.store.unitsFor(module.id).find((unit) => unit.status === 'active')
      || this.plugin.store.unitsFor(module.id)[0];
    if (next) button(wrap, `Continue ${next.title}`, () => this.plugin.openUnit(next.id), 'cta');
    const ahead = this.deadlinesFor(module)
      .filter((row) => (row.end_date || row.start_date) >= new Date().toISOString().slice(0, 10));
    if (ahead.length) this.renderDeadlineRows(wrap, module, ahead.slice(0, 1));
  }

  renderUnits(root, module) {
    if ((module.components || []).length) {
      const tabs = root.createDiv({ cls: 'los-subtabs', attr: { role: 'tablist' } });
      const allTab = button(tabs, 'All components', () => this.selectComponent(null),
        this.componentId ? 'quiet' : 'row');
      allTab.setAttrs({ role: 'tab', 'aria-selected': String(!this.componentId) });
      for (const component of module.components) {
        const tab = button(tabs, component.short_title || component.title,
          () => this.selectComponent(component.id), this.componentId === component.id ? 'row' : 'quiet');
        tab.setAttrs({ role: 'tab', 'aria-selected': String(this.componentId === component.id) });
      }
    }
    const units = this.plugin.store.unitsFor(module.id, this.componentId);
    if (!units.length) { empty(root, 'No units in this component', 'Return to all components.'); return; }
    for (const status of STATUS_ORDER) {
      const rows = units.filter((unit) => unit.status === status);
      if (!rows.length) continue;
      root.createDiv({ cls: 'los-group-title', text: status.replaceAll('-', ' ') });
      const grid = root.createDiv({ cls: 'los-card-grid' });
      for (const unit of rows) unitCard(grid, this.plugin, unit);
    }
  }

  renderLogistics(root, module) {
    const facts = root.createDiv({ cls: 'los-fact-list' });
    for (const [label, value] of [['Status', module.status], ['Institution', module.institution],
      ['Code', module.code], ['Semester', module.semester], ['Credits', module.credits],
      ['Examination', module.examination?.type]]) {
      if (value == null) continue;
      const row = facts.createDiv({ cls: 'los-fact-row' });
      row.createSpan({ cls: 'los-fact-label', text: label });
      row.createSpan({ cls: 'los-fact-value', text: String(value) });
    }
    if (module.examination?.notes) root.createEl('p', { cls: 'los-muted', text: module.examination.notes });
    this.renderAcademicDates(root, module);
  }

  deadlinesFor(module) {
    const rows = this.plugin.store.rows('academic_deadlines').filter((row) =>
      row.module_id === module.id || (row.modules || []).some((entry) => entry.module_id === module.id));
    return rows.sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
  }

  renderAcademicDates(root, module) {
    const rows = this.deadlinesFor(module);
    if (!rows.length) return;
    const wrap = section(root, 'Academic dates', 'Registration windows and exam sittings for this module.');
    const today = new Date().toISOString().slice(0, 10);
    const ahead = rows.filter((row) => (row.end_date || row.start_date) >= today);
    const past = rows.filter((row) => (row.end_date || row.start_date) < today);
    if (ahead.length) this.renderDeadlineRows(wrap, module, ahead);
    else empty(wrap, 'No upcoming date recorded', 'Past dates remain available below.');
    if (past.length) {
      const history = disclosure(wrap, `Past dates (${past.length})`, 'los-deadline-history');
      this.renderDeadlineRows(history, module, past);
    }
  }

  renderDeadlineRows(wrap, module, rows) {
    const list = wrap.createDiv({ cls: 'los-date-list' });
    for (const row of rows) {
      const card = list.createDiv({ cls: `los-date-row los-deadline-${row.kind}` });
      const date = row.end_date && row.end_date !== row.start_date
        ? `${row.start_date} → ${row.end_date}` : row.start_date;
      card.createDiv({ cls: 'los-date-when', text: date });
      const copy = card.createDiv({ cls: 'los-date-copy' });
      copy.createEl('strong', { text: row.label });
      if (row.kind === 'registration-window') {
        const entry = (row.modules || []).find((item) => item.module_id === module.id);
        if (entry?.action) copy.createEl('p', { cls: 'los-micro', text: entry.action });
      } else {
        copy.createDiv({ cls: 'los-micro', text: row.title || module.title });
        const facts = copy.createDiv({ cls: 'los-row' });
        badge(facts, row.registration_state || 'unregistered', row.registration_state || 'needs-map');
        if (row.time) facts.createSpan({ cls: 'los-micro', text: row.time });
      }
    }
  }

  async selectTab(tab) {
    this.tab = tab;
    await this.plugin.router.remember({
      name: 'module-detail', moduleId: this.moduleId,
      componentId: this.componentId, tab,
    });
    await this.leaf.setViewState({
      type: VIEW_MODULE, active: true,
      state: { screen: 'detail', moduleId: this.moduleId, componentId: this.componentId, tab },
    });
  }

  async selectComponent(componentId) {
    this.componentId = componentId;
    const tab = this.tab || 'units';
    await this.plugin.router.remember({
      name: 'module-detail', moduleId: this.moduleId, componentId, tab,
    });
    await this.leaf.setViewState({
      type: VIEW_MODULE, active: true,
      state: { screen: 'detail', moduleId: this.moduleId, componentId, tab },
    });
  }

  renderSources(root, module) {
    const sourceMap = this.plugin.store.sourceMap(module.id);
    if (!sourceMap?.sources?.length) {
      empty(root, 'No routed module sources yet', 'Sources remain globally registered.');
      return;
    }
    root.createEl('p', { cls: 'los-muted', text: 'Roles in this module — not global quality scores.' });
    const groups = new Map();
    for (const entry of sourceMap.sources) {
      if (!groups.has(entry.role)) groups.set(entry.role, []);
      groups.get(entry.role).push(entry);
    }
    for (const [role, entries] of groups) {
      const group = root.createDiv({ cls: 'los-source-role' });
      group.createDiv({ cls: 'los-group-title', text: role.replaceAll('-', ' ') });
      for (const entry of entries) {
        const row = group.createDiv({ cls: 'los-row' });
        chip(row, this.plugin.store.get(entry.source_id), (record) => this.plugin.openLibrary(record.id));
        row.createEl('p', { text: entry.why });
        if (entry.unit_routes?.length) row.createDiv({ cls: 'los-micro', text: `${entry.unit_routes.length} routed unit(s)` });
      }
    }
  }
}
