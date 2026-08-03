'use strict';

const { Plugin, PluginSettingTab, ItemView, Modal, Notice, Setting, setIcon } = require('obsidian');
const { execFile } = require('child_process');
const fs = require('fs');
const nodePath = require('path');
const { shell, webUtils } = require('electron');

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
      // `stages` is the core's flat by-id index (each stage carries its
      // study_map_id/unit_id/module_id). `study_maps[].stages` stays the
      // ordering authority for rails and progress counts — index plus ordered
      // list, never two traversals of the same access path (ADR-006, fifth).
      for (const group of ['programs', 'modules', 'units', 'study_maps', 'stages']) {
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
  /** Resolve a stage from its ID alone through the core's flat index. */
  stage(stageId) {
    const stage = this.get(stageId);
    return stage?.study_map_id ? stage : null;
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
  captureText(text, title = '') {
    const args = ['capture', '--text', text];
    if (title) args.push('--title', title);
    return this.call(args);
  }
  captureFile(filePath) {
    return this.call(['capture', '--file', filePath]);
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
  const stage = context.stageId ? plugin.store.stage(context.stageId) : null;
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
  if (kicker) header.createDiv({ cls: 'los-kicker', text: kicker });
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

function localFilePath(file) {
  if (!file) return '';
  try { return webUtils.getPathForFile(file) || ''; }
  catch (_) { return ''; }
}

function projectedExcerpt(value, limit = 900) {
  const first = String(value || '').split(/\n\s*\n/)[0]
    .replace(/\*\*/g, '').replace(/`/g, '')
    .replace(/(^|\n)\s*-\s*/g, '$1').replace(/\s+/g, ' ').trim();
  return first.length > limit ? `${first.slice(0, limit - 1)}…` : first;
}

function workspaceCard(parent, plugin, workspace, moduleContext = null) {
  const card = parent.createDiv({ cls: `los-card los-workspace-card los-s-${workspace.status}` });
  const top = card.createDiv({ cls: 'los-card-top' });
  top.createEl('h3', { text: workspace.title });
  badge(top, workspace.standing ? `${workspace.status} · standing` : workspace.status, workspace.status);
  if (workspace.objective) card.createEl('p', { cls: 'los-workspace-objective', text: workspace.objective });
  const next = card.createDiv({ cls: 'los-next-action' });
  next.createDiv({ cls: 'los-kicker', text: 'Next action' });
  next.createEl('p', { text: projectedExcerpt(workspace.next_action, 1600) || 'No next action recorded.' });
  if (workspace.deadline) badge(next, `Deadline ${workspace.deadline}`, 'needs-map');
  const actions = card.createDiv({ cls: 'los-actions' });
  const moduleIds = (workspace.module_ids || []).filter((id) => id !== moduleContext);
  for (const id of moduleIds.slice(0, 3)) {
    const module = plugin.store.get(id);
    if (module) button(actions, `Open ${module.title}`, () => plugin.openModule(id), 'quiet');
  }
  for (const id of (workspace.unit_ids || []).slice(0, 3)) {
    const unit = plugin.store.get(id);
    if (unit) button(actions, `Open ${unit.title}`, () => plugin.openUnit(id), 'quiet');
  }
  return card;
}

function unitCard(parent, plugin, unit) {
  const card = parent.createEl('button', {
    cls: `los-card los-unit-card los-s-${unit.status} is-clickable`,
    attr: { type: 'button', 'aria-label': `Open unit: ${unit.title}` },
  });
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
  const card = parent.createEl('button', {
    cls: `los-card los-module-card los-s-${module.status} is-clickable`,
    attr: { type: 'button', 'aria-label': `Open module: ${module.title}` },
  });
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
    const stages = map?.stages || [];
    progress.createSpan({ cls: 'los-progress-copy', text: `${stages.filter((row) => row.status === 'complete').length} of ${stages.length} stages complete` });
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
    for (const boundary of this.plugin.store.data.quarantine_boundaries || []) {
      const card = grid.createEl('button', {
        cls: 'los-boundary-card is-clickable',
        attr: { type: 'button', 'aria-label': `Open boundary: ${boundary.title}` },
      });
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
    for (const unit of this.plugin.store.units().filter((row) => !this.plugin.store.mapForUnit(row.id))) {
      unitCard(grid, this.plugin, unit);
    }
    viewFooter(root);
  }

  renderInbox(root) {
    pageHeader(root, 'Capture', 'Inbox', 'You capture; the operator files.');
    const count = this.plugin.store.data.counts?.inbox_items || 0;
    const wrap = section(root, `${count} item${count === 1 ? '' : 's'} awaiting routing`);
    wrap.createEl('p', { cls: 'los-muted', text: 'No filing decision is required. Text and files land in work/inbox/ through the core capture gateway.' });
    const form = wrap.createDiv({ cls: 'los-capture-grid' });
    const textPanel = form.createDiv({ cls: 'los-capture-panel' });
    textPanel.createEl('h3', { text: 'Quick text' });
    const title = textPanel.createEl('input', {
      cls: 'los-search los-capture-title',
      attr: { type: 'text', placeholder: 'Optional title', 'aria-label': 'Capture title' },
    });
    const editor = textPanel.createEl('textarea', {
      cls: 'los-note-editor los-capture-editor',
      attr: { placeholder: 'Paste a link, thought, question, or fragment…', 'aria-label': 'Capture text' },
    });
    const draft = this.plugin.getInboxDraft();
    title.value = draft.title || '';
    editor.value = draft.text || '';
    const status = textPanel.createDiv({ cls: 'los-draft-status', attr: { 'aria-live': 'polite' } });
    const captureButton = button(textPanel, 'Capture text', () => {
      const text = editor.value.trim();
      if (!text) { new Notice('Enter some text before capturing.'); editor.focus(); return; }
      this.capture(
        () => this.plugin.gateway.captureText(text, title.value.trim()),
        () => {
          this.plugin.clearInboxDraft();
          editor.value = '';
          title.value = '';
        });
    }, 'cta');
    const syncDraft = () => {
      const hasDraft = Boolean(title.value || editor.value);
      this.plugin.setInboxDraft(title.value, editor.value);
      captureButton.disabled = !editor.value.trim();
      status.setText(hasDraft ? 'Draft kept locally until capture.' : 'Nothing entered yet.');
      status.toggleClass('is-dirty', hasDraft);
    };
    title.addEventListener('input', syncDraft);
    editor.addEventListener('input', syncDraft);
    captureButton.disabled = !editor.value.trim();
    status.setText((title.value || editor.value) ? 'Draft kept locally until capture.' : 'Nothing entered yet.');
    status.toggleClass('is-dirty', Boolean(title.value || editor.value));

    const filePanel = form.createDiv({ cls: 'los-capture-panel' });
    filePanel.createEl('h3', { text: 'File or handwriting' });
    filePanel.createEl('p', { cls: 'los-muted', text: 'The original is copied into the inbox; it is not moved or renamed.' });
    const picker = filePanel.createEl('input', {
      cls: 'los-file-input los-capture-file',
      attr: { type: 'file', 'aria-label': 'Choose inbox capture file' },
    });
    button(filePanel, 'Capture selected file', () => {
      const localPath = localFilePath(picker.files?.[0]);
      if (!localPath) { new Notice('Choose a local file first.'); return; }
      this.capture(() => this.plugin.gateway.captureFile(localPath), () => { picker.value = ''; });
    }, 'quiet');
    viewFooter(root);
  }

  async capture(action, clear) {
    try {
      await action();
      await this.plugin.gateway.call(['generate']);
      clear?.();
      await this.plugin.reloadStore();
      new Notice('Captured to the LearningOS inbox.');
    } catch (error) { new Notice(error?.message || String(error)); }
  }
}

/* ---- src/views/module-view.ts ---- */
class ModuleView extends ItemView {
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

/* ---- src/views/unit-view.ts ---- */
class UnitView extends ItemView {
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
    if (!this.stageId || !studyMap.stages.some((row) => row.id === this.stageId)) {
      this.stageId = studyMap.current_stage;
      this.plugin.setSelectedStage(unit.id, this.stageId);
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
    if (!stage.attachments?.length) attachments.createEl('p', { text: 'Attach handwriting or a PDF through the guarded stage-attach action.' });
    for (const attachment of stage.attachments || []) {
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

  async mutate(action) {
    try { await action(); await this.plugin.reloadStore(); this.render(); }
    catch (error) { new Notice(error?.message || String(error)); }
  }

  async saveStageNote(unit, stage, text) {
    try {
      await this.plugin.gateway.saveNote(unit.id, stage.id, text);
      this.plugin.clearStageDraft(unit.id, stage.id);
      await this.plugin.reloadStore();
      new Notice('Stage note saved.');
    } catch (error) { new Notice(error?.message || String(error)); }
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

/* ---- src/views/library-view.ts ---- */
class LibraryView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf); this.plugin = plugin; this.query = ''; this.type = 'source'; this.selectedId = null;
  }
  getViewType() { return VIEW_LIBRARY; }
  getDisplayText() { return 'LearningOS · Library'; }
  async setState(state) {
    const hasType = Object.prototype.hasOwnProperty.call(state || {}, 'recordType');
    const hasRecord = Object.prototype.hasOwnProperty.call(state || {}, 'recordId');
    const hasQuery = Object.prototype.hasOwnProperty.call(state || {}, 'query');
    if (hasType && state.recordType) this.type = state.recordType;
    if (hasRecord) {
      this.selectedId = state.recordId || null;
      const record = this.plugin.store.get(this.selectedId);
      if (!hasType && record?.type) this.type = record.type;
      if (this.selectedId) this.query = '';
    }
    if (hasQuery) this.query = state.query || '';
    this.render();
  }
  getState() { return { recordType: this.type, recordId: this.selectedId, query: this.query }; }
  async onOpen() {
    const state = this.leaf.state || {};
    if (state.recordType) this.type = state.recordType;
    if (state.recordId) {
      this.selectedId = state.recordId;
      this.type = state.recordType || this.plugin.store.get(state.recordId)?.type || this.type;
      this.query = '';
    } else if (Object.prototype.hasOwnProperty.call(state, 'query')) this.query = state.query || '';
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
    input.addEventListener('input', (event) => {
      this.query = event.target?.value ?? input.value;
      this.selectedId = null;
      const position = input.selectionStart;
      this.render();
      const next = this.contentEl.querySelector('.los-search');
      next?.focus();
      if (position != null) next?.setSelectionRange(position, position);
    });
    button(controls, 'Full-text / OCR search', () => this.plugin.openFullTextSearch(this.query), 'quiet');
    for (const [value, label] of [['source', 'Sources'], ['note', 'Notes'], ['concept', 'Concepts'], ['workspace', 'Workspaces']]) {
      const tab = button(controls, label, () => { this.type = value; this.selectedId = null; this.render(); },
        this.type === value ? 'cta' : 'quiet');
      tab.setAttribute('aria-pressed', String(this.type === value));
    }
    const layout = root.createDiv({ cls: 'los-library-layout' });
    const list = layout.createDiv({ cls: 'los-library-list' });
    const rows = this.plugin.store.search(this.query, [this.type]);
    if (this.selectedId && !rows.some((row) => row.id === this.selectedId)) this.selectedId = null;
    if (!this.selectedId && rows.length) this.selectedId = rows[0].id;
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
    this.renderDetail(rows.find((row) => row.id === this.selectedId));
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
    if (record.material_path) button(actions, 'Open local copy', () => this.plugin.openMaterialPath(record.material_path), 'quiet');
    if (record.path) button(actions, record.type === 'note' ? 'Open note' : 'Open authored file',
      () => this.plugin.openAuthoredPath(record.path), 'quiet');
    button(actions, 'Copy ID', () => this.plugin.copyText(record.id), 'quiet');

    if (record.attachments?.length) {
      const attachments = section(detail, 'Attachments', 'Open the original handwriting, image, or PDF.');
      for (const attachment of record.attachments) {
        const path = typeof attachment === 'string' ? attachment : attachment.path || attachment.vault_path;
        const label = typeof attachment === 'string' ? attachment.split('/').pop() : attachment.label || path;
        if (path) button(attachments, `Open ${label}`, () => this.plugin.openAuthoredPath(path), 'quiet');
      }
    }

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
    this.nav(root, 'sprout', 'Garden', () => this.plugin.openVaultPath('bases/garden.base'));
    this.nav(root, 'map', 'Domain atlas', () => this.plugin.openVaultPath('generated/domain-atlas.md'));
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
    this.settings.uiDrafts ||= { stages: {}, selectedStages: {}, inbox: { title: '', text: '' } };
    this.settings.uiDrafts.stages ||= {};
    this.settings.uiDrafts.selectedStages ||= {};
    this.settings.uiDrafts.inbox ||= { title: '', text: '' };
    this.draftSaveTimer = null;
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
    if (this.draftSaveTimer) clearTimeout(this.draftSaveTimer);
    void this.saveData(this.settings);
    for (const type of [VIEW_HOME, VIEW_NAV, VIEW_PROGRAM, VIEW_MODULE, VIEW_UNIT,
      VIEW_LIBRARY, VIEW_SHELVING, VIEW_BOUNDARY]) this.app.workspace.detachLeavesOfType(type);
  }

  scheduleDraftSave() {
    if (this.draftSaveTimer) clearTimeout(this.draftSaveTimer);
    this.draftSaveTimer = setTimeout(() => {
      this.draftSaveTimer = null;
      void this.saveData(this.settings);
    }, 250);
  }

  stageDraftKey(unitId, stageId) { return `${unitId}::${stageId}`; }
  getStageDraft(unitId, stageId, savedText = '') {
    const key = this.stageDraftKey(unitId, stageId);
    const entry = this.settings.uiDrafts.stages[key];
    return { text: entry?.text ?? savedText, dirty: entry != null && entry.text !== savedText };
  }
  setStageDraft(unitId, stageId, text, savedText = '') {
    const key = this.stageDraftKey(unitId, stageId);
    if (text === savedText) delete this.settings.uiDrafts.stages[key];
    else this.settings.uiDrafts.stages[key] = { text };
    this.scheduleDraftSave();
  }
  clearStageDraft(unitId, stageId) {
    delete this.settings.uiDrafts.stages[this.stageDraftKey(unitId, stageId)];
    this.scheduleDraftSave();
  }
  getSelectedStage(unitId) { return this.settings.uiDrafts.selectedStages[unitId] || null; }
  setSelectedStage(unitId, stageId) {
    if (stageId) this.settings.uiDrafts.selectedStages[unitId] = stageId;
    else delete this.settings.uiDrafts.selectedStages[unitId];
    this.scheduleDraftSave();
  }
  getInboxDraft() { return { ...this.settings.uiDrafts.inbox }; }
  setInboxDraft(title, text) {
    this.settings.uiDrafts.inbox = { title, text };
    this.scheduleDraftSave();
  }
  clearInboxDraft() {
    this.settings.uiDrafts.inbox = { title: '', text: '' };
    this.scheduleDraftSave();
  }

  runLos(args, callback) {
    const base = this.app.vault.adapter.getBasePath();
    const bundled = nodePath.join(base, '.venv', 'bin', 'python');
    const python = fs.existsSync(bundled) ? bundled : 'python3';
    const script = nodePath.join(base, 'tools', 'los.py');
    execFile(python, [script, ...args], { cwd: base, timeout: 180000, maxBuffer: 8 * 1024 * 1024 }, callback);
  }

  async reloadStore() {
    const ok = await this.store.load();
    if (!ok) throw new Error(this.store.error);
    this.app.workspace.iterateAllLeaves((leaf) => leaf.view?.render?.());
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
  openUnit(unitId, stageId = null) {
    const selectedStage = stageId || this.getSelectedStage(unitId);
    if (selectedStage) this.setSelectedStage(unitId, selectedStage);
    return this.openView(VIEW_UNIT, { unitId, stageId: selectedStage });
  }
  openLibrary(recordId = undefined, recordType = undefined) {
    const state = {};
    if (recordId !== undefined) state.recordId = recordId;
    if (recordType !== undefined) state.recordType = recordType;
    return this.openView(VIEW_LIBRARY, state);
  }
  openShelving(unitId = null) { return this.openView(VIEW_SHELVING, { unitId }); }
  openBoundary(boundaryId) { return this.openView(VIEW_BOUNDARY, { boundaryId }); }
  openResume() {
    const pointer = this.store.data?.resume_pointer;
    return pointer ? this.openUnit(pointer.unit_id, pointer.stage_id) : this.openHome();
  }
  openFullTextSearch(query = '') {
    const ok = this.app.commands?.executeCommandById?.('omnisearch:show-modal');
    if (!ok) new Notice('Omnisearch is unavailable; structural Library search still works.');
    else if (query.trim()) {
      let attempts = 0;
      const transfer = () => {
        const input = [...document.querySelectorAll('.prompt-input')]
          .find((candidate) => candidate.offsetParent !== null);
        if (!input && attempts++ < 20) { setTimeout(transfer, 50); return; }
        if (!input || input.value) return;
        input.value = query;
        input.dispatchEvent(new InputEvent('input', {
          bubbles: true, inputType: 'insertText', data: query,
        }));
        input.focus();
      };
      setTimeout(transfer, 50);
    }
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
    let existing = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!existing && leaf.view?.file?.path === path) existing = leaf;
    });
    if (existing) {
      this.app.workspace.revealLeaf(existing);
      this.app.workspace.setActiveLeaf?.(existing, { focus: true });
      return existing;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
    return leaf;
  }
  async openExternalPath(path, successMessage = 'Opened in the default app.') {
    if (!path || !fs.existsSync(path)) { new Notice(`File unavailable: ${path || 'unknown path'}`); return false; }
    const error = await shell.openPath(path);
    if (error) { new Notice(`Could not open file: ${error}`); return false; }
    new Notice(successMessage);
    return true;
  }
  openMaterialPath(path) {
    const vault = this.app.vault.adapter.getBasePath();
    const learningRoot = nodePath.dirname(vault);
    const materialsRoot = nodePath.resolve(learningRoot, 'materials');
    const fullPath = nodePath.resolve(learningRoot, path || '');
    const relative = nodePath.relative(materialsRoot, fullPath);
    if (!path || relative.startsWith('..') || nodePath.isAbsolute(relative)) {
      new Notice(`Unsafe material path refused: ${path || 'unknown path'}`); return false;
    }
    return this.openExternalPath(fullPath, 'Opened the local material in its default app.');
  }
  openAuthoredPath(path) {
    const extension = nodePath.extname(path || '').toLocaleLowerCase();
    if (['.md', '.pdf', '.canvas', '.base'].includes(extension)) return this.openVaultPath(path);
    const base = this.app.vault.adapter.getBasePath();
    const fullPath = nodePath.resolve(base, path || '');
    const relative = nodePath.relative(base, fullPath);
    if (!path || relative.startsWith('..') || nodePath.isAbsolute(relative)) {
      new Notice(`Unsafe vault path refused: ${path || 'unknown path'}`); return false;
    }
    return this.openExternalPath(fullPath, 'Opened the authored file in its default app.');
  }
  openRecord(record) {
    if (!record) return;
    if (record.type === 'unit') return this.openUnit(record.id);
    if (record.type === 'module') return this.openModule(record.id);
    if (record.type === 'program') return this.openProgram(record.id);
    if (record.type === 'source') return this.openLibrary(record.id, 'source');
    if (record.type === 'note' || record.type === 'concept') return this.openLibrary(record.id, record.type);
    if (record.type === 'workspace') {
      const unit = (record.unit_ids || []).map((id) => this.store.get(id)).find(Boolean);
      if (unit) return this.openUnit(unit.id);
      const module = (record.module_ids || []).map((id) => this.store.get(id)).find(Boolean);
      return module ? this.openModule(module.id) : this.openHome();
    }
    if (record.path) return this.openAuthoredPath(record.path);
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
