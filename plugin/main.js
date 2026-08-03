'use strict';

const { Plugin, PluginSettingTab, ItemView, Modal, Notice, Setting, setIcon } = require('obsidian');
const { execFile } = require('child_process');
const nodePath = require('path');

/* ---- src/constants.ts ---- */
const CONTRACT_VERSION = 2;
const VIEW_HOME = 'learningos-home';
const VIEW_NAV = 'learningos-nav';
const VIEW_PROGRAM = 'learningos-program';
const VIEW_MODULE = 'learningos-module';
const VIEW_UNIT = 'learningos-unit';
const VIEW_LIBRARY = 'learningos-library';
const VIEW_SHELVING = 'learningos-shelving';
const VIEW_BOUNDARY = 'learningos-boundary';
const LEGACY_VIEW_TYPES = [
  'learningos-dashboard', 'learningos-explorer', 'learningos-learning-path',
  'learningos-shelve-review', 'learningos-job-boundary',
];

const DEFAULT_SETTINGS = {
  openHomeOnStartup: true,
  pinHome: true,
  collapseSidebars: true,
  showAiRecommendation: true,
};

const STATUS_ORDER = [
  'active', 'ready', 'not-started', 'needs-map', 'paused',
  'ready-to-shelve', 'complete',
];

const ICONS = {
  program: 'graduation-cap', module: 'book-open', unit: 'layers-3',
  'study-map': 'route', stage: 'list-checks', note: 'file-text',
  concept: 'network', source: 'library', workspace: 'briefcase-business',
  boundary: 'shield', skills: 'wrench', projects: 'flask-conical',
};

/* ---- src/manifest-store.ts ---- */
class ManifestStore {
  constructor(app) {
    this.app = app;
    this.ready = false;
    this.error = '';
    this.data = null;
    this.byId = new Map();
  }

  async load() {
    try {
      if (!(await this.app.vault.adapter.exists('generated/manifest.json'))) {
        throw new Error('Projection unavailable — rebuild it to continue.');
      }
      const manifest = JSON.parse(await this.app.vault.adapter.read('generated/manifest.json'));
      const version = manifest?._generated?.contract_version;
      if (version !== CONTRACT_VERSION) {
        throw new Error(`Unsupported manifest contract ${version ?? 'unknown'}; LearningOS UI requires contract ${CONTRACT_VERSION}.`);
      }
      this.data = manifest;
      this.contractVersion = version;
      this.snapshotId = manifest._generated.snapshot_id;
      this.records = manifest.records || [];
      this.byId = new Map(this.records.filter((row) => row?.id).map((row) => [row.id, row]));
      for (const group of ['programs', 'modules', 'units', 'study_maps']) {
        for (const row of manifest[group] || []) if (row?.id) this.byId.set(row.id, row);
      }
      this.ready = true;
      this.error = '';
      return true;
    } catch (error) {
      this.ready = false;
      this.error = error?.message || String(error);
      return false;
    }
  }

  get(id) { return this.byId.get(id) || null; }
  of(type) { return this.records.filter((row) => row.type === type); }
  programs() { return this.data?.programs || []; }
  modules() { return this.data?.modules || []; }
  units() { return this.data?.units || []; }
  studyMaps() { return this.data?.study_maps || []; }
  modulesFor(programId) { return this.modules().filter((row) => row.area_id === programId); }
  unitsFor(moduleId, componentId = null) {
    const rows = this.units().filter((row) => row.module_id === moduleId);
    return componentId ? rows.filter((row) => row.component_id === componentId) : rows;
  }
  mapForUnit(unitId) {
    const mapId = this.data?.indexes?.unit_to_study_map?.[unitId];
    return mapId ? this.get(mapId) : null;
  }
  stage(mapId, stageId) {
    return (this.get(mapId)?.stages || []).find((row) => row.id === stageId) || null;
  }
  sourceMap(moduleId) {
    return (this.data?.module_source_maps || []).find((row) => row.module_id === moduleId) || null;
  }
  progress(moduleId) { return this.data?.progress?.[moduleId] || {}; }
  workspacesForModule(moduleId) {
    const ids = this.data?.backlinks?.module_to_workspaces?.[moduleId] || [];
    return ids.map((id) => this.get(id)).filter(Boolean);
  }
  useUnits(sourceId) {
    return (this.data?.indexes?.source_to_units?.[sourceId] || [])
      .map((id) => this.get(id)).filter(Boolean);
  }

  search(query, types = null) {
    const words = String(query || '').toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const allowed = types ? new Set(types) : null;
    const rows = this.records.filter((row) => !allowed || allowed.has(row.type));
    if (!words.length) return rows;
    const strict = rows.filter((row) => {
      const hay = [row.id, row.title, ...(row.aliases || []), ...(row.authors || []),
        row.organization, row.domain].filter(Boolean).join(' ').toLocaleLowerCase();
      return words.every((word) => hay.includes(word));
    });
    if (strict.length) return strict;
    const needle = words.join('');
    return rows.filter((row) => {
      const hay = [row.id, row.title, ...(row.aliases || [])].filter(Boolean)
        .join(' ').toLocaleLowerCase().replace(/\s+/g, '');
      let at = 0;
      for (const char of hay) if (char === needle[at]) at += 1;
      return at === needle.length;
    });
  }

  related(id) {
    const record = this.get(id);
    if (!record) return [];
    const ids = new Set();
    for (const key of ['concepts', 'sources', 'contexts', 'notes', 'program_ids',
      'module_ids', 'unit_ids', 'unit_order', 'related_module_ids']) {
      for (const value of record[key] || []) ids.add(value);
    }
    for (const table of Object.values(this.data?.backlinks || {})) {
      if (table && typeof table === 'object' && Array.isArray(table[id])) {
        for (const value of table[id]) ids.add(typeof value === 'string' ? value : value.from);
      }
    }
    return [...ids].map((value) => ({ rec: this.get(value) })).filter((row) => row.rec);
  }
}

/* ---- src/gateway-client.ts ---- */
class GatewayClient {
  constructor(plugin) { this.plugin = plugin; }

  call(args) {
    return new Promise((resolve, reject) => {
      this.plugin.runLos(args, (error, stdout, stderr) => {
        if (error) reject(new Error(stderr || error.message || String(error)));
        else {
          try { resolve(stdout ? JSON.parse(stdout) : { ok: true }); }
          catch (_) { resolve({ ok: true, stdout }); }
        }
      });
    });
  }

  guard() { return ['--expected-snapshot', this.plugin.store.snapshotId]; }
  saveNote(unitId, stageId, text) {
    return this.call(['stage-note', unitId, stageId, '--replace', '--text', text, ...this.guard()]);
  }
  progress(unitId, stageId, status) {
    return this.call(['stage-progress', unitId, stageId, status, ...this.guard()]);
  }
  feedback(unitId, stageId, sourceId, feedback) {
    return this.call(['source-feedback', unitId, stageId, sourceId, feedback, ...this.guard()]);
  }
  detour(unitId, stageId, title, classification = 'required-now') {
    return this.call(['detour-create', unitId, stageId, '--title', title,
      '--classification', classification, ...this.guard()]);
  }
  resolveDetour(unitId, detourId, resolution = '') {
    const args = ['detour-resolve', unitId, detourId];
    if (resolution) args.push('--resolution', resolution);
    return this.call([...args, ...this.guard()]);
  }
  attach(unitId, stageId, filePath, label = '') {
    const args = ['stage-attach', unitId, stageId, '--file', filePath];
    if (label) args.push('--label', label);
    return this.call([...args, ...this.guard()]);
  }
  prepareShelving(unitId) {
    return this.call(['shelving-prepare', unitId, ...this.guard()]);
  }
  applyShelving(unitId, selected) {
    return this.call(['shelving-apply', unitId, '--approve', '--selected', ...selected, ...this.guard()]);
  }
  endSession(commitMessage = null, push = false) {
    const args = ['session-end'];
    if (commitMessage) args.push('--commit-message', commitMessage);
    if (push) args.push('--push');
    return this.call(args);
  }
}

function explicitAiContext(plugin, context = {}) {
  const unit = context.unitId ? plugin.store.get(context.unitId) : null;
  const module = context.moduleId ? plugin.store.get(context.moduleId) :
    (unit ? plugin.store.get(unit.module_id) : null);
  const studyMap = unit ? plugin.store.mapForUnit(unit.id) : null;
  const stage = context.stageId && studyMap ? plugin.store.stage(studyMap.id, context.stageId) : null;
  const resources = stage?.resources || [];
  return {
    area_program_id: context.programId || module?.area_id || null,
    module_id: module?.id || context.moduleId || null,
    component_id: context.componentId || unit?.component_id || null,
    unit_id: unit?.id || context.unitId || null,
    stage_id: stage?.id || context.stageId || null,
    selected_source_ids: [...new Set(resources.map((row) => row.source_id).filter(Boolean))],
    selected_materials: resources.filter((row) => row.vault_path || row.url)
      .map((row) => row.vault_path || row.url),
    manifest_snapshot: plugin.store.snapshotId,
    active_file_supplement: plugin.app.workspace.getActiveFile()?.path || null,
  };
}

/* ---- src/components.ts ---- */
function icon(el, name) { setIcon(el, name || 'circle'); return el; }

function button(parent, label, onClick, variant = '') {
  const el = parent.createEl('button', {
    cls: `los-btn is-clickable ${variant ? `los-btn--${variant}` : ''}`,
    text: label,
    attr: { type: 'button' },
  });
  el.addEventListener('click', (event) => { event.preventDefault(); onClick?.(event); });
  return el;
}

function badge(parent, text, variant = '') {
  return parent.createSpan({ cls: `los-badge ${variant ? `los-badge--${variant}` : ''}`, text });
}

function chip(parent, record, onClick) {
  const el = parent.createEl('button', {
    cls: `los-chip los-t-${record?.type || 'record'} is-clickable`,
    attr: { type: 'button' },
  });
  icon(el.createSpan({ cls: 'los-chip-icon' }), ICONS[record?.type] || 'circle');
  el.createSpan({ text: record?.title || record?.id || 'Unknown' });
  if (onClick) el.addEventListener('click', () => onClick(record));
  return el;
}

function pageHeader(parent, kicker, title, description = '') {
  const header = parent.createDiv({ cls: 'los-page-header' });
  header.createDiv({ cls: 'los-kicker', text: kicker });
  header.createEl('h1', { text: title });
  if (description) header.createEl('p', { text: description });
  return header;
}

function section(parent, title, description = '') {
  const wrap = parent.createDiv({ cls: 'los-section' });
  wrap.createEl('h2', { text: title });
  if (description) wrap.createEl('p', { cls: 'los-muted', text: description });
  return wrap;
}

function empty(parent, title, detail, actionLabel, action) {
  const el = parent.createDiv({ cls: 'los-empty' });
  el.createEl('h3', { text: title });
  el.createEl('p', { text: detail });
  if (actionLabel) button(el, actionLabel, action, 'quiet');
  return el;
}

function unitCard(parent, plugin, unit) {
  const card = parent.createDiv({ cls: `los-card los-s-${unit.status} is-clickable` });
  const top = card.createDiv({ cls: 'los-card-top' });
  top.createEl('h3', { text: unit.title });
  badge(top, unit.status, unit.status);
  card.createEl('p', { text: unit.scope });
  const map = plugin.store.mapForUnit(unit.id);
  if (map) {
    const done = (map.stages || []).filter((row) => row.status === 'complete').length;
    card.createDiv({ cls: 'los-progress-copy', text: `${done} of ${(map.stages || []).length} stages complete` });
  } else {
    card.createDiv({ cls: 'los-progress-copy', text: 'No study map yet' });
  }
  card.addEventListener('click', () => plugin.openUnit(unit.id));
  return card;
}

function moduleCard(parent, plugin, module) {
  const card = parent.createDiv({ cls: `los-card los-module-card los-s-${module.status} is-clickable` });
  const top = card.createDiv({ cls: 'los-card-top' });
  top.createEl('h3', { text: module.title });
  badge(top, module.kind, 'role');
  const progress = plugin.store.progress(module.id);
  card.createEl('p', { text: `${progress.units_total || 0} units · ${progress.stages_complete || 0}/${progress.stages_total || 0} stages complete` });
  if (progress.units_needing_map) badge(card, `${progress.units_needing_map} need a map`, 'needs-map');
  card.addEventListener('click', () => plugin.openModule(module.id));
  return card;
}

function viewFooter(parent) {
  parent.createDiv({ cls: 'los-footer', text: 'Presentation only · facts live in the LearningOS core · buttons are conveniences, never duties.' });
}

/* ---- src/views/home-view.ts ---- */
class HomeView extends ItemView {
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

/* ---- src/views/program-view.ts ---- */
class ProgramView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.programId = null; }
  getViewType() { return VIEW_PROGRAM; }
  getDisplayText() { return 'LearningOS · Area'; }
  async setState(state) { this.programId = state?.programId || this.programId; this.render(); }
  getState() { return { programId: this.programId }; }
  async onOpen() { this.programId = this.leaf.state?.programId || this.programId; this.render(); }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-program-view');
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
    for (const unit of this.plugin.store.units().filter((row) => row.status === 'needs-map')) {
      unitCard(grid, this.plugin, unit);
    }
    viewFooter(root);
  }

  renderInbox(root) {
    pageHeader(root, 'Capture', 'Inbox', 'You capture; the operator files.');
    const count = this.plugin.store.data.counts?.inbox_items || 0;
    const wrap = section(root, `${count} item${count === 1 ? '' : 's'} awaiting routing`);
    empty(wrap, 'No filing decision is required here', 'Use the capture command or drop material into work/inbox/.');
    viewFooter(root);
  }
}

/* ---- src/views/module-view.ts ---- */
class ModuleView extends ItemView {
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

/* ---- src/views/unit-view.ts ---- */
class UnitView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf); this.plugin = plugin; this.unitId = null; this.stageId = null;
  }
  getViewType() { return VIEW_UNIT; }
  getDisplayText() { return 'LearningOS · Unit'; }
  async setState(state) {
    this.unitId = state?.unitId || this.unitId;
    this.stageId = state?.stageId || this.stageId;
    this.render();
  }
  getState() { return { unitId: this.unitId, stageId: this.stageId }; }
  async onOpen() {
    this.unitId = this.leaf.state?.unitId || this.unitId;
    this.stageId = this.leaf.state?.stageId || this.stageId;
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
    if (!this.stageId || !studyMap.stages.some((row) => row.id === this.stageId)) {
      this.stageId = studyMap.current_stage;
    }
    const stage = studyMap.stages.find((row) => row.id === this.stageId) || studyMap.stages[0];
    const layout = root.createDiv({ cls: 'los-unit-layout' });
    this.renderRail(layout, unit, studyMap, stage);
    this.renderStage(layout, unit, studyMap, stage);
    this.renderNotes(layout, unit, studyMap, stage);
    this.renderArtifacts(root, unit);
    viewFooter(root);
  }

  renderRail(layout, unit, studyMap, current) {
    const rail = layout.createDiv({ cls: 'los-stage-rail' });
    rail.createEl('h2', { text: 'Stages' });
    for (const [index, stage] of studyMap.stages.entries()) {
      const row = rail.createEl('button', {
        cls: `los-stage-row los-s-${stage.status} ${stage.id === current.id ? 'is-selected' : ''} is-clickable`,
        attr: { type: 'button' },
      });
      row.createSpan({ cls: 'los-stage-index', text: String(index + 1).padStart(2, '0') });
      const copy = row.createSpan({ cls: 'los-stage-copy' });
      copy.createSpan({ text: stage.title });
      copy.createSpan({ cls: 'los-micro', text: stage.status });
      row.addEventListener('click', () => { this.stageId = stage.id; this.render(); });
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
    if (!stage.resources?.length) empty(resources, 'No source action selected', 'Use the unit scope and ask AI for a proposal.');
    for (const resource of stage.resources || []) {
      const row = resources.createDiv({ cls: 'los-resource-row' });
      icon(row.createSpan(), resource.kind === 'watch' ? 'play' : resource.kind === 'practise' ? 'pencil-line' : 'book-open');
      const copy = row.createDiv({ cls: 'los-resource-copy' });
      copy.createEl('strong', { text: resource.label });
      if (resource.locator) copy.createDiv({ cls: 'los-micro', text: resource.locator });
      if (resource.source_id) {
        const source = this.plugin.store.get(resource.source_id);
        chip(copy, source, (record) => this.plugin.openLibrary(record.id));
      }
      const actions = row.createDiv({ cls: 'los-actions' });
      if (resource.url || resource.vault_path) button(actions, 'Open', () => this.plugin.openResource(resource), 'quiet');
      if (resource.source_id) {
        button(actions, 'Helpful', () => this.mutate(
          () => this.plugin.gateway.feedback(unit.id, stage.id, resource.source_id, 'helpful')), 'quiet');
        button(actions, 'Too advanced', () => this.mutate(
          () => this.plugin.gateway.feedback(unit.id, stage.id, resource.source_id, 'too-advanced')), 'quiet');
        button(actions, 'Useful for review', () => this.mutate(
          () => this.plugin.gateway.feedback(unit.id, stage.id, resource.source_id, 'useful-for-review')), 'quiet');
      }
    }

    const done = section(center, 'Done when');
    const list = done.createEl('ul');
    for (const criterion of stage.done_when || []) list.createEl('li', { text: criterion });
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
    editor.value = stage.notes_text || '';
    button(panel, 'Save note', () => this.mutate(
      () => this.plugin.gateway.saveNote(unit.id, stage.id, editor.value)), 'cta');
    const attachments = section(panel, 'Attachments');
    if (!stage.attachments?.length) attachments.createEl('p', { text: 'Attach handwriting or a PDF through the guarded stage-attach action.' });
    for (const attachment of stage.attachments || []) attachments.createDiv({ text: attachment.label });
    const picker = attachments.createEl('input', {
      cls: 'los-file-input', attr: { type: 'file', 'aria-label': 'Choose stage attachment' },
    });
    button(attachments, 'Attach selected file', () => {
      const file = picker.files?.[0];
      const localPath = file?.path;
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

  async mutate(action) {
    try { await action(); await this.plugin.reloadStore(); this.render(); }
    catch (error) { new Notice(error?.message || String(error)); }
  }
}

/* ---- src/views/library-view.ts ---- */
class LibraryView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf); this.plugin = plugin; this.query = ''; this.type = 'source'; this.selectedId = null;
  }
  getViewType() { return VIEW_LIBRARY; }
  getDisplayText() { return 'LearningOS · Library'; }
  async setState(state) {
    this.type = state?.recordType || this.type;
    this.selectedId = state?.recordId || this.selectedId;
    this.render();
  }
  getState() { return { recordType: this.type, recordId: this.selectedId }; }
  async onOpen() {
    this.type = this.leaf.state?.recordType || this.type;
    this.selectedId = this.leaf.state?.recordId || this.selectedId;
    this.render();
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-library-view');
    pageHeader(root, 'Reference', 'Library',
      'Search registered sources, notes, concepts, and workspaces without turning the catalogue into the curriculum.');
    const controls = root.createDiv({ cls: 'los-library-controls' });
    const input = controls.createEl('input', {
      cls: 'los-search', attr: { type: 'search', placeholder: 'Search titles, IDs, aliases, authors…', 'aria-label': 'Library search' },
    });
    input.value = this.query;
    input.addEventListener('input', (event) => { this.query = event.target?.value ?? input.value; this.render(); });
    button(controls, 'Full-text / OCR search', () => this.plugin.openFullTextSearch(), 'quiet');
    for (const [value, label] of [['source', 'Sources'], ['note', 'Notes'], ['concept', 'Concepts'], ['workspace', 'Workspaces']]) {
      button(controls, label, () => { this.type = value; this.selectedId = null; this.render(); },
        this.type === value ? 'cta' : 'quiet');
    }
    const layout = root.createDiv({ cls: 'los-library-layout' });
    const list = layout.createDiv({ cls: 'los-library-list' });
    const rows = this.plugin.store.search(this.query, [this.type]);
    if (!rows.length) empty(list, 'No matching records', 'Try a title, an ID, or a German/English alias.');
    for (const record of rows) {
      const row = list.createEl('button', {
        cls: `los-item ${record.id === this.selectedId ? 'is-selected' : ''}`,
        attr: { type: 'button' },
      });
      icon(row.createSpan(), ICONS[record.type] || 'circle');
      const copy = row.createSpan({ cls: 'los-item-copy' });
      copy.createSpan({ text: record.title || record.id });
      copy.createSpan({ cls: 'los-micro', text: record.id });
      row.addEventListener('click', () => { this.selectedId = record.id; this.render(); });
    }
    this.detailEl = layout.createDiv({ cls: 'los-library-detail' });
    this.renderDetail(this.plugin.store.get(this.selectedId) || rows[0]);
    viewFooter(root);
  }

  renderDetail(record) {
    const detail = this.detailEl;
    if (!record) { empty(detail, 'Choose a record', 'The detail pane shows evidence and curriculum usage.'); return; }
    detail.createDiv({ cls: 'los-kicker', text: record.type });
    detail.createEl('h2', { text: record.title || record.id });
    detail.createDiv({ cls: 'los-detail-id', text: record.id });
    if (record.summary) detail.createEl('p', { text: record.summary });
    const actions = detail.createDiv({ cls: 'los-actions' });
    if (record.url) button(actions, 'Open online', () => this.plugin.openResource({ url: record.url }), 'cta');
    if (record.material_path) button(actions, 'Open local copy', () => this.plugin.openResource({ vault_path: record.material_path }), 'quiet');
    if (record.path) button(actions, 'Open registry file', () => this.plugin.openVaultPath(record.path), 'quiet');
    button(actions, 'Copy ID', () => this.plugin.copyText(record.id), 'quiet');

    if (record.type === 'source') {
      const facts = section(detail, 'Source facts');
      for (const [label, value] of [['Authors', (record.authors || []).join(', ')],
        ['Organization', record.organization], ['Year', record.year]]) {
        if (value) facts.createDiv({ cls: 'los-row', text: `${label}: ${value}` });
      }
      const used = section(detail, 'Used in units', 'Use is module/unit-specific; it is not a global source score.');
      const units = this.plugin.store.useUnits(record.id);
      if (!units.length) empty(used, 'Not routed to a unit', 'The source remains globally registered.');
      for (const unit of units) chip(used, unit, (row) => this.plugin.openUnit(row.id));
      const evaluations = (record.evaluations || []).filter((row) => row.verdict || row.scope
        || row.reading_plan?.length || row.useful_sections?.length);
      if (evaluations.length) {
        const evidence = section(detail, 'Existing evaluation evidence');
        for (const evaluation of evaluations) {
          const card = evidence.createDiv({ cls: 'los-evidence-card' });
          if (evaluation.verdict) card.createEl('p', { text: evaluation.verdict });
          for (const selection of evaluation.reading_plan || []) {
            card.createDiv({ cls: 'los-row', text: selection });
          }
          for (const selection of evaluation.useful_sections || []) {
            card.createDiv({ cls: 'los-row', text: `${selection.section}${selection.note ? ` — ${selection.note}` : ''}` });
          }
        }
      }
    }
    const related = this.plugin.store.related(record.id);
    if (related.length) {
      const wrap = section(detail, 'Related');
      for (const row of related.slice(0, 24)) chip(wrap, row.rec, (rec) => this.plugin.openRecord(rec));
    }
  }
}

/* ---- src/views/shelving-view.ts ---- */
class ShelvingView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.unitId = null; this.proposal = null; this.selected = new Set(); }
  getViewType() { return VIEW_SHELVING; }
  getDisplayText() { return 'LearningOS · Shelving'; }
  async setState(state) {
    this.unitId = state?.unitId || this.unitId;
    await this.loadProposal(); this.render();
  }
  getState() { return { unitId: this.unitId }; }
  async onOpen() { this.unitId = this.leaf.state?.unitId || this.unitId; await this.loadProposal(); this.render(); }

  async loadProposal() {
    if (!this.unitId) return;
    const map = this.plugin.store.mapForUnit(this.unitId);
    if (map?.shelving?.state === 'proposed') this.proposal = map.shelving;
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-shelving-view');
    const unit = this.plugin.store.get(this.unitId);
    pageHeader(root, 'Approval gate', 'Shelving',
      unit ? `${unit.title}: review durable changes before the gateway applies them.` : 'Choose a unit that is ready to shelve.');
    if (!unit) { this.renderQueue(root); viewFooter(root); return; }
    const map = this.plugin.store.mapForUnit(unit.id);
    const proposal = this.proposal || (map?.shelving?.state === 'proposed' ? map.shelving : null);
    if (!proposal?.items?.length) {
      const wrap = section(root, 'No proposal yet');
      empty(wrap, 'Prepare a deterministic proposal',
        'The gateway derives candidates from this unit. AI may explain them, but cannot apply canonical changes.',
        'Prepare proposal', () => this.prepare());
      button(wrap, 'Ask AI to explain shelving criteria', () => this.plugin.askAiScoped(
        'Explain which stage notes might be durable. Do not write or apply canonical changes.',
        { moduleId: unit.module_id, unitId: unit.id }), 'quiet');
      viewFooter(root); return;
    }
    if (!this.selected.size) {
      for (const item of proposal.items) if (item.selected !== false) this.selected.add(item.id);
    }
    const summary = section(root, 'Proposed changes', proposal.summary || 'Select only changes you want to apply.');
    for (const item of proposal.items) {
      const row = summary.createDiv({ cls: 'los-proposal-row' });
      const toggle = row.createEl('input', { attr: { type: 'checkbox', 'aria-label': `Select ${item.title}` } });
      toggle.checked = this.selected.has(item.id);
      toggle.addEventListener('change', () => {
        if (toggle.checked) this.selected.add(item.id); else this.selected.delete(item.id);
      });
      const copy = row.createDiv();
      copy.createEl('h3', { text: item.title });
      if (item.destination) copy.createDiv({ cls: 'los-detail-id', text: item.destination });
      if (item.rationale) copy.createEl('p', { text: item.rationale });
      if (item.diff) copy.createEl('pre', { cls: 'los-proposal-diff', text: item.diff });
    }
    const guard = root.createDiv({ cls: 'los-validation-preview' });
    guard.createEl('strong', { text: 'Apply is explicit and selected-only.' });
    guard.createEl('p', { text: 'The core validates and regenerates atomically; broad AI writes are never accepted.' });
    const actions = root.createDiv({ cls: 'los-actions' });
    button(actions, 'Approve selected changes', () => this.apply(), 'cta');
    button(actions, 'Ask AI to review proposal', () => this.plugin.askAiScoped(
      `Review these shelving proposal IDs: ${[...this.selected].join(', ')}. Do not apply changes.`,
      { moduleId: unit.module_id, unitId: unit.id }), 'quiet');
    viewFooter(root);
  }

  renderQueue(root) {
    const wrap = section(root, 'Ready to shelve');
    const rows = this.plugin.store.units().filter((row) => row.status === 'ready-to-shelve');
    if (!rows.length) empty(wrap, 'No unit is waiting', 'Keep working from any active unit.');
    for (const unit of rows) unitCard(wrap, this.plugin, unit);
  }

  async prepare() {
    try {
      await this.plugin.gateway.prepareShelving(this.unitId);
      await this.plugin.reloadStore(); await this.loadProposal(); this.render();
    }
    catch (error) { new Notice(error?.message || String(error)); }
  }

  async apply() {
    if (!this.selected.size) { new Notice('Select at least one proposal.'); return; }
    try {
      await this.plugin.gateway.applyShelving(this.unitId, [...this.selected]);
      await this.plugin.reloadStore(); this.proposal = null; this.selected.clear(); this.render();
    } catch (error) { new Notice(error?.message || String(error)); }
  }
}

/* ---- src/views/boundary-view.ts ---- */
class BoundaryView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.boundaryId = null; }
  getViewType() { return VIEW_BOUNDARY; }
  getDisplayText() { return 'LearningOS · Boundary'; }
  async setState(state) { this.boundaryId = state?.boundaryId || this.boundaryId; this.render(); }
  getState() { return { boundaryId: this.boundaryId }; }
  async onOpen() { this.boundaryId = this.leaf.state?.boundaryId || this.boundaryId; this.render(); }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-boundary-view');
    const boundary = (this.plugin.store.data?.quarantine_boundaries || [])
      .find((row) => row.id === this.boundaryId);
    if (!boundary) { empty(root, 'Boundary unavailable', 'No quarantined content was loaded.'); return; }
    pageHeader(root, 'Deliberate boundary', boundary.title, boundary.description);
    const guard = section(root, 'What this means');
    if (boundary.id === 'program-job-boundary') {
      guard.createEl('p', { text: 'Job content is not indexed, searched, read, or mixed into LearningOS. Access requires a separate, explicit request.' });
      button(guard, 'Request explicit Job access', () => new Notice('Job access remains outside LearningOS. Ask Codex explicitly when needed.'), 'quiet');
    } else {
      guard.createEl('p', { text: 'Master’s planning is quarantined from current Bachelor’s work and all default search. This surface exposes only the boundary record.' });
      button(guard, 'Open Master’s Planning boundary', () => new Notice('Open the quarantined folder manually only for a deliberate planning session.'), 'quiet');
    }
    viewFooter(root);
  }
}

/* ---- src/views/nav-view.ts ---- */
class NavView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_NAV; }
  getDisplayText() { return 'LearningOS · Navigator'; }
  getIcon() { return 'route'; }
  async onOpen() { this.render(); }

  nav(parent, iconName, label, action) {
    const row = parent.createEl('button', { cls: 'los-app-nav-item is-clickable', attr: { type: 'button' } });
    icon(row.createSpan(), iconName); row.createSpan({ text: label }); row.addEventListener('click', action);
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-app-nav');
    const brand = root.createDiv({ cls: 'los-nav-brand' });
    icon(brand.createSpan({ cls: 'los-brand-mark' }), 'route'); brand.createEl('strong', { text: 'LearningOS' });
    this.nav(root, 'home', 'Home', () => this.plugin.openHome());
    root.createDiv({ cls: 'los-nav-label', text: 'Areas' });
    this.nav(root, 'graduation-cap', 'Bachelor’s', () => this.plugin.openProgram('program-bachelors'));
    this.nav(root, 'wrench', 'Skills', () => this.plugin.openProgram('program-skills'));
    this.nav(root, 'flask-conical', 'Thesis & projects', () => this.plugin.openProgram('program-thesis-projects'));
    root.createDiv({ cls: 'los-nav-label', text: 'Workflow' });
    this.nav(root, 'archive-restore', 'Shelving', () => this.plugin.openShelving());
    this.nav(root, 'library', 'Library', () => this.plugin.openLibrary());
    this.nav(root, 'inbox', 'Inbox', () => this.plugin.openProgram('inbox'));
    root.createDiv({ cls: 'los-nav-label', text: 'Boundaries' });
    this.nav(root, 'shield', 'Master’s', () => this.plugin.openBoundary('program-masters-planning'));
    this.nav(root, 'shield-alert', 'Job', () => this.plugin.openBoundary('program-job-boundary'));
    const foot = root.createDiv({ cls: 'los-nav-foot' });
    button(foot, 'Rebuild projection', () => this.plugin.generate(), 'quiet');
  }
}

/* ---- src/settings.ts ---- */
class LearningOSSettingsTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const root = this.containerEl; root.empty();
    root.createEl('h2', { text: 'LearningOS UI' });
    for (const [key, name, description] of [
      ['openHomeOnStartup', 'Open Home on startup', 'Open the module-first Home view when the vault becomes ready.'],
      ['pinHome', 'Pin Home', 'Keep the Home leaf available while opening units.'],
      ['collapseSidebars', 'Collapse the right sidebar', 'Keep the learning workspace visually focused.'],
      ['showAiRecommendation', 'Show scoped AI action', 'Display AI buttons that always include explicit curriculum context.'],
    ]) {
      new Setting(root).setName(name).setDesc(description).addToggle((toggle) => toggle
        .setValue(this.plugin.settings[key]).onChange(async (value) => {
          this.plugin.settings[key] = value; await this.plugin.saveData(this.plugin.settings);
        }));
    }
    new Setting(root).setName('Validate and rebuild').setDesc('Run the canonical core projection pipeline.')
      .addButton((control) => control.setButtonText('Rebuild').setCta().onClick(() => this.plugin.generate()));
  }
}

class SessionEndModal extends Modal {
  constructor(app, plugin, review) { super(app); this.plugin = plugin; this.review = review; }
  onOpen() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-session-modal');
    pageHeader(root, 'Explicit Git closure', 'End learning session',
      'Only files recorded by guarded learning actions can be staged. Unrelated changes remain untouched.');
    const owned = section(root, 'Session-owned changes');
    if (!(this.review.owned_changes || []).length) empty(owned, 'No owned changes', 'There is nothing to commit from this session.');
    for (const file of this.review.owned_changes || []) owned.createEl('code', { text: file });
    const unrelated = section(root, 'Unrelated changes (excluded)');
    if (!(this.review.unrelated_changes || []).length) unrelated.createEl('p', { text: 'None.' });
    for (const file of this.review.unrelated_changes || []) unrelated.createEl('code', { text: file });
    const message = root.createEl('input', {
      cls: 'los-search', attr: { type: 'text', placeholder: 'Commit message', 'aria-label': 'Learning session commit message' },
    });
    const pushRow = root.createDiv({ cls: 'los-row' });
    const push = pushRow.createEl('input', { attr: { type: 'checkbox', 'aria-label': 'Push after commit' } });
    pushRow.createSpan({ text: 'Push after the scoped commit succeeds' });
    const actions = root.createDiv({ cls: 'los-actions' });
    button(actions, 'Commit session-owned files', async () => {
      if (!message.value.trim()) { new Notice('Enter a commit message first.'); return; }
      try {
        const result = await this.plugin.gateway.endSession(message.value.trim(), Boolean(push.checked));
        new Notice(result.pushed ? 'Learning session committed and pushed.' : 'Learning session committed.');
        this.close();
      } catch (error) { new Notice(error?.message || String(error)); }
    }, 'cta');
    button(actions, 'Close without committing', () => this.close(), 'quiet');
  }
  onClose() { this.contentEl.empty(); }
}

/* ---- src/main.ts ---- */
class LearningOSUI extends Plugin {
  async onload() {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
    for (const type of LEGACY_VIEW_TYPES) this.app.workspace.detachLeavesOfType(type);
    this.store = new ManifestStore(this.app);
    this.gateway = new GatewayClient(this);
    await this.store.load();
    this.registerView(VIEW_HOME, (leaf) => new HomeView(leaf, this));
    this.registerView(VIEW_NAV, (leaf) => new NavView(leaf, this));
    this.registerView(VIEW_PROGRAM, (leaf) => new ProgramView(leaf, this));
    this.registerView(VIEW_MODULE, (leaf) => new ModuleView(leaf, this));
    this.registerView(VIEW_UNIT, (leaf) => new UnitView(leaf, this));
    this.registerView(VIEW_LIBRARY, (leaf) => new LibraryView(leaf, this));
    this.registerView(VIEW_SHELVING, (leaf) => new ShelvingView(leaf, this));
    this.registerView(VIEW_BOUNDARY, (leaf) => new BoundaryView(leaf, this));
    this.addSettingTab(new LearningOSSettingsTab(this.app, this));
    this.addRibbonIcon('route', 'Open LearningOS', () => this.openHome());
    this.addCommand({ id: 'open-home', name: 'Open Home', callback: () => this.openHome() });
    this.addCommand({ id: 'open-current-stage', name: 'Open current stage', callback: () => this.openResume() });
    this.addCommand({ id: 'open-library', name: 'Open Library', callback: () => this.openLibrary() });
    this.addCommand({ id: 'rebuild-projection', name: 'Validate and rebuild projection', callback: () => this.generate() });
    this.addCommand({ id: 'end-learning-session', name: 'End learning session safely', callback: () => this.reviewSessionEnd() });
    this.app.workspace.onLayoutReady(async () => {
      for (const type of LEGACY_VIEW_TYPES) this.app.workspace.detachLeavesOfType(type);
      await this.openNav();
      if (this.settings.collapseSidebars) this.app.workspace.rightSplit?.collapse();
      if (this.settings.openHomeOnStartup) {
        const restore = this.settings.lastView;
        if (restore?.type && restore.type !== VIEW_HOME) {
          const home = await this.openView(VIEW_HOME, {}, 'main', false);
          if (this.settings.pinHome) home.setPinned?.(true);
          await this.openView(restore.type, restore.state || {}, 'main', false);
        } else await this.openHome();
      }
    });
  }

  onunload() {
    for (const type of [VIEW_HOME, VIEW_NAV, VIEW_PROGRAM, VIEW_MODULE, VIEW_UNIT,
      VIEW_LIBRARY, VIEW_SHELVING, VIEW_BOUNDARY]) this.app.workspace.detachLeavesOfType(type);
  }

  runLos(args, callback) {
    const base = this.app.vault.adapter.getBasePath();
    const bundled = nodePath.join(base, '.venv', 'bin', 'python');
    const python = bundled;
    const script = nodePath.join(base, 'tools', 'los.py');
    execFile(python, [script, ...args], { cwd: base, timeout: 180000, maxBuffer: 8 * 1024 * 1024 }, callback);
  }

  async reloadStore() {
    const ok = await this.store.load();
    if (!ok) throw new Error(this.store.error);
    for (const leaf of this.app.workspace._leaves || []) leaf.view?.render?.();
  }

  async openView(type, state = {}, side = 'main', remember = true) {
    let leaf = this.app.workspace.getLeavesOfType(type)[0];
    if (!leaf) leaf = side === 'left' ? this.app.workspace.getLeftLeaf(false) : this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type, active: true, state });
    this.app.workspace.revealLeaf(leaf); this.app.workspace.setActiveLeaf?.(leaf, { focus: true });
    if (remember && side === 'main') {
      this.settings.lastView = { type, state };
      await this.saveData(this.settings);
    }
    return leaf;
  }

  async openNav() { return this.openView(VIEW_NAV, {}, 'left'); }
  async openHome() {
    const leaf = await this.openView(VIEW_HOME);
    if (this.settings.pinHome) leaf.setPinned?.(true);
    return leaf;
  }
  openProgram(programId) { return this.openView(VIEW_PROGRAM, { programId }); }
  openModule(moduleId) { return this.openView(VIEW_MODULE, { moduleId }); }
  openUnit(unitId, stageId = null) { return this.openView(VIEW_UNIT, { unitId, stageId }); }
  openLibrary(recordId = null, recordType = 'source') { return this.openView(VIEW_LIBRARY, { recordId, recordType }); }
  openShelving(unitId = null) { return this.openView(VIEW_SHELVING, { unitId }); }
  openBoundary(boundaryId) { return this.openView(VIEW_BOUNDARY, { boundaryId }); }
  openResume() {
    const pointer = this.store.data?.resume_pointer;
    return pointer ? this.openUnit(pointer.unit_id, pointer.stage_id) : this.openHome();
  }
  openFullTextSearch() {
    const ok = this.app.commands?.executeCommandById?.('omnisearch:show-modal');
    if (!ok) new Notice('Omnisearch is unavailable; structural Library search still works.');
  }

  async generate() {
    try {
      await this.gateway.call(['validate']);
      await this.gateway.call(['generate']);
      await this.reloadStore(); new Notice('LearningOS projection rebuilt.');
    } catch (error) { new Notice(error?.message || String(error)); }
  }

  async reviewSessionEnd() {
    try {
      const review = await this.gateway.endSession();
      new SessionEndModal(this.app, this, review).open();
      return review;
    } catch (error) { new Notice(error?.message || String(error)); return null; }
  }

  async openVaultPath(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) { new Notice(`File unavailable: ${path}`); return; }
    await this.app.workspace.getLeaf(true).openFile(file);
  }
  openRecord(record) {
    if (!record) return;
    if (record.type === 'unit') return this.openUnit(record.id);
    if (record.type === 'module') return this.openModule(record.id);
    if (record.type === 'program') return this.openProgram(record.id);
    if (record.type === 'source') return this.openLibrary(record.id, 'source');
    if (record.path) return this.openVaultPath(record.path);
  }
  openResource(resource) {
    if (resource.vault_path) return this.openVaultPath(resource.vault_path);
    if (resource.url) {
      const leaf = this.app.workspace.getLeaf(true);
      return leaf.setViewState({ type: 'webviewer', active: true, state: { url: resource.url } });
    }
  }
  copyText(value) {
    try { navigator.clipboard.writeText(value); new Notice(`Copied ${value}`); }
    catch (_) { new Notice(value); }
  }

  async askAiScoped(request, context = {}) {
    const envelope = explicitAiContext(this, context);
    const prompt = `${request}\n\nLearningOS explicit context (authoritative):\n${JSON.stringify(envelope, null, 2)}\n\nThe active file is supplementary context only. Use only action-specific LearningOS capabilities for writes; never infer a global course or learning path.`;
    this.lastAiPrompt = prompt;
    const agent = this.app.plugins?.plugins?.['agentic-copilot'];
    if (agent?.sendToChat) await agent.sendToChat(prompt);
    else { this.copyText(prompt); new Notice('Scoped prompt copied. Open Agentic Copilot to continue.'); }
    return prompt;
  }
}

module.exports = LearningOSUI;
