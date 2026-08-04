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
const VIEW_ATLAS = 'learningos-atlas';
const VIEW_SHELVING = 'learningos-shelving';
const VIEW_BOUNDARY = 'learningos-boundary';
const VIEW_REVIEW = 'learningos-review';
const VIEW_GARDEN = 'learningos-garden';
const VIEW_DIAGNOSTICS = 'learningos-diagnostics';

/**
 * The five permanent destinations. Areas became sub-areas of Learn and the
 * decision queues became Review, so the sidebar stops presenting the whole
 * system before the learner has done anything. Everything else lives in More.
 */
const LEARN_AREAS = [
  ['program-bachelors', 'Bachelor’s'],
  ['program-skills', 'Skills'],
  ['program-thesis-projects', 'Thesis & projects'],
];
const LEGACY_VIEW_TYPES = [
  'learningos-dashboard', 'learningos-explorer', 'learningos-learning-path',
  'learningos-shelve-review', 'learningos-job-boundary',
];

const DEFAULT_SETTINGS = {
  openHomeOnStartup: true,
  pinHome: true,
  collapseSidebars: true,
  showAiRecommendation: true,
  navMoreOpen: false,
  learnArea: 'program-bachelors',
  pythonPath: '',
  preferredAiProvider: 'manual-bundle',
};

/** Protocols an interface layer may hand to a viewer. Everything else — and
 *  above all `javascript:`, `data:` and `file:` — is refused before it can
 *  reach Electron. */
const SAFE_URL_PROTOCOLS = ['https:', 'http:'];

const STATUS_ORDER = [
  'active', 'ready', 'not-started', 'needs-map', 'paused',
  'ready-to-shelve', 'complete',
];

const ICONS = {
  program: 'graduation-cap', module: 'book-open', unit: 'layers-3',
  'study-map': 'route', stage: 'list-checks', note: 'file-text',
  concept: 'network', source: 'library', workspace: 'briefcase-business',
  boundary: 'shield', skills: 'wrench', projects: 'flask-conical',
  collection: 'library-big', atlas: 'map',
};

/* ---- src/manifest-store.ts ---- */
class ManifestStore {
  constructor(app) {
    this.app = app;
    this.ready = false;
    this.error = '';
    this.data = null;
    // Initialised here, not only inside load()'s success branch: a failed load
    // must still leave every accessor safe to call.
    this.records = [];
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
      this.records = (manifest.records || []).filter((row) => row && typeof row === 'object');
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
  of(type) { return this.records.filter((row) => row?.type === type); }
  /**
   * One null row anywhere in a projected array used to take Home down on
   * startup. Every list accessor drops non-objects at the boundary, so no view
   * has to defend itself row by row.
   */
  rows(group) {
    const value = this.data?.[group];
    return Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') : [];
  }
  programs() { return this.rows('programs'); }
  modules() { return this.rows('modules'); }
  units() { return this.rows('units'); }
  studyMaps() { return this.rows('study_maps'); }
  gardenEntries() { return this.rows('garden_entries'); }
  aiAction(actionId) {
    return this.rows('ai_actions_available').find((row) => row.id === actionId)
      || (this.data?.ai_actions?.available || []).find((row) => row?.id === actionId) || null;
  }
  aiProviders() {
    const rows = this.data?.ai_actions?.provider_adapters;
    return Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : [];
  }
  aiRequestsForTarget(targetId) {
    const rows = this.data?.ai_actions?.requests;
    return (Array.isArray(rows) ? rows : []).filter((row) => row?.target?.id === targetId);
  }
  latestAiRequest(targetId) {
    return this.aiRequestsForTarget(targetId)
      .slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null;
  }
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
    return this.rows('module_source_maps').find((row) => row.module_id === moduleId) || null;
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
    const rows = this.records.filter((row) => row && (!allowed || allowed.has(row.type)));
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
  constructor(plugin) {
    this.plugin = plugin;
    // The write lock lives here, not in a view, because the thing being
    // protected is the single CLI process and the snapshot it was handed.
    this.chain = Promise.resolve();
    this.pending = 0;
  }

  /**
   * Serialize every mutation, wherever it was clicked. Failures do not poison
   * the chain: the next task runs regardless of how the previous one settled,
   * but never alongside it.
   */
  enqueue(task) {
    this.pending += 1;
    const run = this.chain.then(task, task);
    this.chain = run.then(() => undefined, () => undefined)
      .then(() => { this.pending -= 1; });
    return run;
  }

  get isBusy() { return this.pending > 0; }

  /**
   * Every mutating command answers in JSON. Unreadable or empty output means
   * the write was NOT confirmed, so this must reject: call sites clear
   * UI-owned drafts on resolve, and resolving on garbage would destroy the
   * learner's text behind a success notice. `expectJson: false` is only for
   * the text-reporting commands (`validate`, `generate`).
   */
  call(args, { expectJson = true } = {}) {
    return new Promise((resolve, reject) => {
      this.plugin.runLos(args, (error, stdout, stderr) => {
        if (error) { reject(new Error(stderr || error.message || String(error))); return; }
        const raw = String(stdout ?? '').trim();
        if (!expectJson) { resolve({ ok: true, stdout: raw }); return; }
        if (!raw) {
          reject(new Error('LearningOS wrote nothing back, so the change is unconfirmed. Your draft was kept.'));
          return;
        }
        let parsed = null;
        try { parsed = JSON.parse(raw); }
        catch (_) {
          reject(new Error(`LearningOS answered with unreadable output, so the change is unconfirmed and your draft was kept: ${raw.slice(0, 160)}`));
          return;
        }
        if (!parsed || typeof parsed !== 'object' || parsed.ok === false) {
          reject(new Error(parsed?.error || 'LearningOS refused the change; your draft was kept.'));
          return;
        }
        resolve(parsed);
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
    // `--json` so an inbox capture is confirmed structurally; the plain-text
    // form stays the human default in a terminal.
    const args = ['capture', '--json', '--text', text];
    if (title) args.push('--title', title);
    return this.call(args);
  }
  captureFile(filePath) {
    return this.call(['capture', '--json', '--file', filePath]);
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

/* ---- src/infrastructure/ai-action-client.ts ---- */
/**
 * Provider-independent client for the core AI-action gateway. The UI never
 * sends an open-ended prompt or grants a provider direct vault access: it asks
 * the core to persist an exact request bundle and later applies only a delivery
 * that the core has already validated against the locked contract.
 */
class AIActionClient {
  constructor(plugin) { this.plugin = plugin; }

  providers() { return this.plugin.store.aiProviders(); }

  prepareGardenShelving(targetId, provider = 'manual-bundle', jobExportConfirmed = false) {
    const args = ['ai-action-prepare', '--action-id', 'garden.shelve',
      '--target-kind', 'garden-note', '--target-id', targetId,
      '--provider', provider, ...this.plugin.gateway.guard()];
    if (jobExportConfirmed) args.push('--confirm-job-export');
    return this.plugin.mutate(() => this.plugin.gateway.call(args));
  }

  status(requestId) {
    return this.plugin.gateway.call(['ai-action-status', requestId]);
  }

  applyApprovedDelivery(deliveryId) {
    return this.plugin.mutate(() => this.plugin.gateway.call([
      'ai-action-apply-delivery', deliveryId,
    ]));
  }
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

/**
 * Progressive disclosure primitive. Native `<details>` so it is keyboard
 * reachable and readable with no script, which is also why the overflow menu
 * below is built on it rather than on Obsidian's `Menu`.
 */
function disclosure(parent, summaryText, cls = '') {
  const details = parent.createEl('details', { cls: `los-disclosure ${cls}`.trim() });
  details.createEl('summary', { text: summaryText });
  return details.createDiv({ cls: 'los-disclosure-body' });
}

/**
 * The `•••` overflow. Secondary operations stay reachable in one place instead
 * of competing with the two actions the learner actually came for.
 */
function overflowMenu(parent, items, label = 'More actions') {
  const rows = items.filter(Boolean);
  if (!rows.length) return null;
  const details = parent.createEl('details', { cls: 'los-overflow' });
  const summary = details.createEl('summary', { cls: 'los-overflow-trigger', text: '•••' });
  summary.setAttrs({ 'aria-label': label, role: 'button' });
  const body = details.createDiv({ cls: 'los-overflow-body' });
  for (const [itemLabel, action] of rows) {
    button(body, itemLabel, () => { details.removeAttribute?.('open'); action(); }, 'menu');
  }
  return details;
}

/**
 * One learning row: what it is, where you are, one way in. Replaces the
 * Module/Status/Next-up table — a status badge is only worth the space when the
 * state needs the learner to do something.
 */
function progressRow(parent, plugin, module, nextUp = '') {
  const row = parent.createDiv({ cls: 'los-learning-row' });
  const copy = row.createDiv({ cls: 'los-learning-copy' });
  const title = button(copy, module.title, () => plugin.openModule(module.id), 'row');
  title.addClass('los-learning-title');
  if (nextUp) copy.createDiv({ cls: 'los-learning-next', text: nextUp });
  const progress = plugin.store.progress(module.id);
  const meta = row.createDiv({ cls: 'los-learning-meta' });
  meta.createSpan({
    cls: 'los-micro',
    text: `${progress.stages_complete || 0} of ${progress.stages_total || 0} stages`,
  });
  if (progress.units_needing_map) badge(meta, `${progress.units_needing_map} need a map`, 'needs-map');
  return row;
}

/**
 * A projected URL is core data, but core data is not a licence to hand an
 * arbitrary scheme to Electron. Anything outside the allowlist is refused
 * before it can reach a viewer.
 */
function safeWebUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return SAFE_URL_PROTOCOLS.includes(url.protocol) ? url : null;
  } catch (_) { return null; }
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
  if (first.length <= limit) return first;
  // Slice by code point: a plain .slice() could cut an emoji in half and leak a
  // lone surrogate into the DOM.
  return `${Array.from(first).slice(0, limit - 1).join('')}…`;
}

/**
 * Boundary cards exist to prove nothing quarantined was loaded, so they show
 * short core-authored policy prose only: capped, single paragraph, and never a
 * `Job/` path. The field is core-owned, but this is the one view where trusting
 * the manifest has no upside.
 */
function boundaryPolicy(value) {
  const text = projectedExcerpt(value, 300);
  return /(^|[\s([<'"])Job\//.test(text) ? '' : text;
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

/**
 * The ownership statement is architecture policy, not study content. Repeating
 * it under every screen made the product read as internal tooling, so it is
 * stated once in Settings → About (DESIGN.md records the change).
 */
const OWNERSHIP_STATEMENT =
  'Presentation only · facts live in the LearningOS core · buttons are conveniences, never duties.';

/* ---- src/features/ai-actions/action-button.ts ---- */
/** Compact, action-specific launcher. There is deliberately no generic
 * "Ask AI" entry point: the action ID, target and provider are visible before
 * the core prepares any context. */
function renderGardenShelveAction(parent, plugin, target, onChanged = null) {
  const wrap = parent.createDiv({ cls: 'los-ai-action-row' });
  const providers = plugin.aiActions.providers();
  const available = providers.filter((row) => row.available);
  let provider = available.some((row) => row.id === plugin.settings.preferredAiProvider)
    ? plugin.settings.preferredAiProvider : (available[0]?.id || 'manual-bundle');
  let jobConfirmed = !target.job_derived;

  const select = wrap.createEl('select', {
    cls: 'los-ai-provider',
    attr: { 'aria-label': `AI provider for ${target.title}` },
  });
  for (const row of providers) {
    const option = select.createEl('option', {
      text: row.available ? row.id : `${row.id} (unavailable)`,
      attr: { value: row.id },
    });
    option.value = row.id;
    if (!row.available) option.setAttr('disabled', 'disabled');
  }
  select.value = provider;
  select.addEventListener('change', () => {
    provider = select.value;
    plugin.settings.preferredAiProvider = provider;
    plugin.scheduleDraftSave();
  });

  if (target.job_derived) {
    const consent = wrap.createEl('label', { cls: 'los-ai-consent' });
    const checkbox = consent.createEl('input', { attr: { type: 'checkbox' } });
    consent.createSpan({ text: 'Confirm this exported item may leave the Job boundary' });
    checkbox.addEventListener('change', () => { jobConfirmed = Boolean(checkbox.checked); });
  }

  const launch = button(wrap, 'Shelve with AI', async () => {
    if (target.job_derived && !jobConfirmed) {
      new Notice('Explicit export confirmation is required for job-derived material.');
      return;
    }
    launch.setAttr('disabled', 'disabled');
    launch.setText('Preparing…');
    try {
      const result = await plugin.aiActions.prepareGardenShelving(target.id, provider, jobConfirmed);
      const bundlePath = result.bundle_path || result.request?.bundle_path;
      new Notice(bundlePath ? `AI request prepared: ${bundlePath}` : 'AI request prepared.');
      onChanged?.(result);
    } catch (error) {
      new Notice(error?.message || String(error));
      launch.removeAttribute?.('disabled');
      launch.setText('Shelve with AI');
    }
  }, 'quiet');
  launch.addClass('los-ai-action-button');
  if (!available.length) launch.setAttr('disabled', 'disabled');
  return wrap;
}

/* ---- src/views/home-view.ts ---- */
/**
 * Home answers one question: what should I do now?
 *
 * Continue, Upcoming, My learning, Attention — in that order, and nothing else.
 * Boundaries, full coordination detail, diagnostics and maintenance moved to
 * where they belong; a learner opening the app should not have to read the
 * whole system before continuing.
 */
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
    // The Navigator can reach this view whatever the projection's health, so it
    // has to degrade like Home rather than throw on a null manifest.
    if (!this.plugin.store.ready) {
      pageHeader(root, 'LearningOS', 'Projection unavailable');
      empty(root, 'The interface contract could not be loaded', this.plugin.store.error,
        'Rebuild views', () => this.plugin.generate());
      return;
    }
    if (this.programId === 'queue-needs-map') return this.renderNeedsMap(root);
    if (this.programId === 'inbox') return this.renderInbox(root);
    const program = this.plugin.store.get(this.programId);
    if (!program) { empty(root, 'Area unavailable', 'Return Home and choose another area.'); return; }
    pageHeader(root, '', 'Learn');
    // The areas are sub-areas of one destination now, so the switcher lives in
    // the page rather than eating three permanent sidebar slots.
    const tabs = root.createDiv({ cls: 'los-tabs', attr: { role: 'tablist' } });
    for (const [areaId, title] of LEARN_AREAS) {
      const active = areaId === program.id;
      const tab = button(tabs, title, () => this.plugin.openLearn(areaId), active ? 'cta' : 'quiet');
      tab.setAttrs({ role: 'tab', 'aria-selected': String(active) });
    }
    if (program.description) root.createEl('p', { cls: 'los-muted', text: program.description });

    const modules = this.plugin.store.modulesFor(program.id);
    const list = root.createDiv({ cls: 'los-learning-list' });
    if (!modules.length) empty(root, 'No modules in this area yet', 'Nothing is hidden.');
    for (const module of modules) progressRow(list, this.plugin, module);

    if (program.semester_bound) {
      const semesters = disclosure(root, 'Semesters');
      for (const semester of program.semesters || []) {
        const row = semesters.createDiv({ cls: 'los-row' });
        row.createEl('strong', { text: semester.title }); badge(row, semester.status, semester.status);
      }
    }
    this.renderCoordination(root);
  }

  /**
   * The full coordination record — commitments, dependencies, deferrals — moved
   * off Home to here. Home carries the one-line priority; this is where the
   * whole decision layer is read when the learner actually wants it.
   */
  renderCoordination(root) {
    const coordination = this.plugin.store.get('coordination');
    const rows = ['Priorities', 'Commitments', 'Dependencies', 'Deferrals']
      .map((heading) => [heading, projectedExcerpt(coordination?.sections?.[heading], 1600)])
      .filter(([, body]) => body);
    if (!rows.length) return;
    const panel = disclosure(root, 'Semester coordination', 'los-coordination-details');
    for (const [heading, body] of rows) {
      const row = panel.createDiv({ cls: 'los-coordination-row' });
      row.createEl('strong', { text: heading });
      row.createEl('p', { text: body });
    }
  }

  renderNeedsMap(root) {
    pageHeader(root, 'Review', 'Units needing a study map');
    const grid = root.createDiv({ cls: 'los-card-grid' });
    for (const unit of this.plugin.store.units().filter((row) => !this.plugin.store.mapForUnit(row.id))) {
      unitCard(grid, this.plugin, unit);
    }
  }

  renderInbox(root) {
    pageHeader(root, '', 'Capture', 'You capture; the operator files.');
    const count = this.plugin.store.data?.counts?.inbox_items || 0;
    const wrap = section(root, `${count} item${count === 1 ? '' : 's'} awaiting routing`);
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
  }

  async capture(action, clear) {
    if (this.plugin.gateway.isBusy) new Notice('Queued behind the running LearningOS write.');
    try {
      await this.plugin.mutate(async () => {
        await action();
        await this.plugin.gateway.call(['generate'], { expectJson: false });
      });
      // Only after the core confirmed the capture in JSON — clearing earlier
      // is what used to lose the thought when the CLI answered with garbage.
      clear?.();
      new Notice('Captured to the LearningOS inbox.');
      this.render();
    } catch (error) { new Notice(error?.message || String(error)); }
  }
}

/* ---- src/views/module-view.ts ---- */
/**
 * Four tabs, because a module page was four pages wearing one coat: learning
 * work, resources, and administration each have their own reading mode. Units
 * is the default — the learner is here to study, not to check a credit count.
 */
class ModuleView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf); this.plugin = plugin; this.moduleId = null; this.componentId = null; this.tab = null;
  }
  getViewType() { return VIEW_MODULE; }
  getDisplayText() { return 'LearningOS · Module'; }
  async setState(state) {
    const nextModuleId = state?.moduleId || this.moduleId;
    if (nextModuleId !== this.moduleId) { this.componentId = null; this.tab = null; }
    this.moduleId = nextModuleId;
    if (Object.prototype.hasOwnProperty.call(state || {}, 'componentId')) this.componentId = state.componentId || null;
    if (Object.prototype.hasOwnProperty.call(state || {}, 'tab')) this.tab = state.tab || null;
    this.render();
  }
  getState() { return { moduleId: this.moduleId, componentId: this.componentId, tab: this.tab }; }
  async onOpen() {
    this.moduleId = this.leaf.state?.moduleId || this.moduleId;
    this.componentId = this.leaf.state?.componentId || null;
    this.tab = this.leaf.state?.tab || null;
    this.render();
  }

  /** Units unless there is nothing to study yet. */
  defaultTab(module) {
    return this.plugin.store.unitsFor(module.id).length ? 'units' : 'overview';
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-module-view');
    const module = this.plugin.store.get(this.moduleId);
    if (!module) { empty(root, 'Module unavailable', 'Return to Learn and choose another module.'); return; }
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
    await this.leaf.setViewState({
      type: VIEW_MODULE,
      active: true,
      state: { moduleId: this.moduleId, componentId: this.componentId, tab },
    });
  }

  async selectComponent(componentId) {
    this.componentId = componentId;
    await this.leaf.setViewState({
      type: VIEW_MODULE,
      active: true,
      state: { moduleId: this.moduleId, componentId: this.componentId, tab: this.tab || 'units' },
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

/* ---- src/views/unit-view.ts ---- */
/**
 * The Unit is where learning actually happens, so it gets the strictest
 * discipline: three columns (stages / current work / notes), and exactly three
 * visible actions. Everything else — pause, skip, gap, shelving, AI, session
 * end — is one overflow away. Sixteen equally-weighted buttons is not a
 * workspace, it is a control panel.
 */
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

    const studyMap = this.plugin.store.mapForUnit(unit.id);
    if (!studyMap) {
      const missing = section(root, 'Study map needed');
      empty(missing, 'This unit has no current study script',
        'AI may propose a scoped map; the core imports it only after review.',
        'Create map with AI', () => this.plugin.askAiScoped(
          'Propose one study-map JSON document for this unit. Do not write files; include exact source actions and done-when criteria.',
          { moduleId: unit.module_id, unitId: unit.id, componentId: unit.component_id }));
      this.renderArtifacts(root, unit);
      return;
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
      return;
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
    this.renderActionBar(root, unit, map, stage);
    const more = disclosure(root, 'Unit artifacts and evidence', 'los-unit-extras');
    this.renderArtifacts(more, unit);
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
      const marker = stage.status === 'complete' ? 'Complete' : hasDraft ? 'Unsaved draft' : '';
      if (marker) copy.createSpan({ cls: 'los-micro', text: marker });
      row.addEventListener('click', () => this.selectStage(stage.id));
    }
  }

  renderStage(layout, unit, studyMap, stage) {
    const center = layout.createDiv({ cls: 'los-stage-workspace' });
    const top = center.createDiv({ cls: 'los-stage-heading' });
    top.createDiv({ cls: 'los-kicker', text: stage.exam_critical ? 'Exam-critical stage' : stage.scope_triage });
    top.createEl('h2', { text: stage.title });
    if (stage.objective) {
      const goal = center.createDiv({ cls: 'los-stage-goal' });
      goal.createDiv({ cls: 'los-kicker', text: 'Goal' });
      goal.createEl('p', { text: stage.objective });
    }
    if (stage.estimate_minutes) badge(top, `${stage.estimate_minutes} min`, 'role');

    const resources = section(center, 'Resources');
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
      // Three feedback buttons per resource used to outweigh the resource
      // itself; the judgment is still one click away, it just no longer
      // competes with the thing the learner came to read.
      if (resource.source_id) {
        overflowMenu(actions, [
          ['Helpful', () => this.mutate(() => this.plugin.gateway.feedback(unit.id, stage.id, resource.source_id, 'helpful'))],
          ['Too advanced', () => this.mutate(() => this.plugin.gateway.feedback(unit.id, stage.id, resource.source_id, 'too-advanced'))],
          ['Useful for review', () => this.mutate(() => this.plugin.gateway.feedback(unit.id, stage.id, resource.source_id, 'useful-for-review'))],
        ], `Rate ${resource.label}`);
      }
    }

    const criteria = Array.isArray(stage.done_when)
      ? stage.done_when.filter((row) => typeof row === 'string' && row.trim()) : [];
    if (criteria.length) {
      const done = section(center, 'Done when');
      const marks = this.plugin.getDoneWhen(unit.id, stage.id);
      const list = done.createDiv({ cls: 'los-donewhen-list' });
      for (const [index, criterion] of criteria.entries()) {
        const row = list.createEl('label', { cls: 'los-donewhen-row' });
        const box = row.createEl('input', {
          attr: { type: 'checkbox', 'aria-label': criterion },
        });
        if (marks[index]) box.setAttr('checked', 'checked');
        box.checked = Boolean(marks[index]);
        box.addEventListener('change', () => {
          this.plugin.setDoneWhen(unit.id, stage.id, index, Boolean(box.checked));
          row.toggleClass('is-checked', Boolean(box.checked));
        });
        row.toggleClass('is-checked', Boolean(marks[index]));
        row.createSpan({ text: criterion });
      }
    }
  }

  /** Two actions and one menu. The primary is filled; nothing else on this
   *  screen may be. */
  renderActionBar(root, unit, studyMap, stage) {
    const bar = root.createDiv({ cls: 'los-unit-actionbar' });
    button(bar, 'Save note', () => this.saveStageNote(unit, stage, this.noteEditor?.value ?? ''));
    button(bar, 'Mark complete', () => this.mutate(
      () => this.plugin.gateway.progress(unit.id, stage.id, 'complete'),
      () => this.plugin.clearDoneWhen(unit.id, stage.id)), 'cta');
    overflowMenu(bar, [
      stage.status !== 'active' && ['Revisit stage', () => this.mutate(
        () => this.plugin.gateway.progress(unit.id, stage.id, 'revisit'))],
      ['Pause unit', () => this.mutate(() => this.plugin.gateway.progress(unit.id, stage.id, 'paused'))],
      ['Skip stage', () => this.mutate(() => this.plugin.gateway.progress(unit.id, stage.id, 'skipped'))],
      ['Report prerequisite gap', () => this.mutate(
        () => this.plugin.gateway.detour(unit.id, stage.id, 'Prerequisite gap', 'required-now'))],
      ['Prepare shelving', () => this.plugin.openShelving(unit.id)],
      this.plugin.settings.showAiRecommendation && ['Ask AI with stage context', () => this.plugin.askAiScoped(
        'Help with this stage. Treat the active file as supplementary context only.',
        { moduleId: unit.module_id, unitId: unit.id, stageId: stage.id })],
      ['End learning session', () => this.plugin.reviewSessionEnd()],
    ], 'More unit actions');
  }

  renderNotes(layout, unit, studyMap, stage) {
    const panel = layout.createDiv({ cls: 'los-note-panel' });
    panel.createEl('h2', { text: 'Working note' });
    const editor = panel.createEl('textarea', { cls: 'los-note-editor', attr: { 'aria-label': 'Stage working note' } });
    this.noteEditor = editor;
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

    const attachments = panel.createDiv({ cls: 'los-attachments' });
    const stageAttachments = Array.isArray(stage.attachments) ? stage.attachments.filter(Boolean) : [];
    for (const attachment of stageAttachments) {
      const path = typeof attachment === 'string' ? attachment : attachment.path || attachment.vault_path;
      const label = typeof attachment === 'string' ? attachment.split('/').pop() : attachment.label || path;
      if (path) button(attachments, label, () => this.plugin.openAuthoredPath(path), 'quiet');
      else attachments.createDiv({ text: label || 'Attachment' });
    }
    const picker = attachments.createEl('input', {
      cls: 'los-file-input', attr: { type: 'file', 'aria-label': 'Choose stage attachment' },
    });
    button(attachments, 'Attach file', () => {
      const file = picker.files?.[0];
      const localPath = localFilePath(file);
      if (!localPath) { new Notice('Choose a local handwriting, image, or PDF file first.'); return; }
      this.mutate(() => this.plugin.gateway.attach(unit.id, stage.id, localPath, file.name));
    }, 'quiet');

    for (const detour of studyMap.detours || []) {
      if (detour.spawned_by_stage !== stage.id || detour.status === 'resolved') continue;
      const row = panel.createDiv({ cls: 'los-detour-row' });
      row.createEl('strong', { text: 'Open prerequisite detour' });
      row.createEl('p', { text: `${detour.title} · ${detour.classification} · returns here` });
      button(row, 'Resolve and return', () => this.mutate(
        () => this.plugin.gateway.resolveDetour(unit.id, detour.id, 'Resolved from the unit workspace.')), 'quiet');
    }
    if (stage.source_feedback?.length) {
      const feedback = disclosure(panel, `Source-use evidence (${stage.source_feedback.length})`);
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
   * Every write goes through the plugin-wide queue, so two clicks in two views
   * can no longer race the same `--expected-snapshot`.
   */
  async mutate(action, onConfirmed = null) {
    // A second click on the same control is a slip, not a second intention, so
    // the view drops it. The queue below still serializes anything that does
    // get through from another view.
    if (this.plugin.gateway.isBusy) { new Notice('A LearningOS write is already running.'); return; }
    try {
      await this.plugin.mutate(action);
      onConfirmed?.();
      this.render();
    } catch (error) { new Notice(error?.message || String(error)); }
  }

  async saveStageNote(unit, stage, text) {
    try {
      await this.plugin.mutate(() => this.plugin.gateway.saveNote(unit.id, stage.id, text));
      // Reached only on a confirmed ok — the gateway rejects empty or
      // unreadable output — so the draft is safe to drop here and only here.
      this.plugin.clearStageDraft(unit.id, stage.id);
      new Notice('Stage note saved.');
      this.render();
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
/**
 * Library — the reference surface.
 *
 * Shelves come first. A registry of 228 sources in one flat list is a haystack;
 * the 16 curated collections are the only place the *reading strategy* is
 * written down (spine vs supplement, tier, when to reach for it), so they are
 * the default way in. Sources, notes, concepts and workspaces stay reachable as
 * modes, each with the facets that make a few hundred rows navigable.
 *
 * Presentation only: every judgment shown here is authored core-side — this view
 * groups and counts, and never invents an ordering the canon does not carry.
 */
const LIBRARY_MODES = [
  ['collection', 'Shelves'], ['source', 'Sources'], ['note', 'Notes'],
  ['concept', 'Concepts'], ['workspace', 'Workspaces'],
];

const SOURCE_FACETS = [
  ['all', 'All'], ['shelved', 'On a shelf'], ['unshelved', 'Not on any shelf'],
  ['local', 'Local copy'], ['online', 'Online'], ['in-unit', 'Used in a unit'],
];

class LibraryView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.query = '';
    this.type = 'collection';
    this.selectedId = null;
    this.facet = 'all';
    this.domain = '';
  }
  getViewType() { return VIEW_LIBRARY; }
  getDisplayText() { return 'LearningOS · Library'; }

  applyState(state) {
    const has = (key) => Object.prototype.hasOwnProperty.call(state || {}, key);
    if (has('recordType') && state.recordType) this.type = state.recordType;
    if (has('domain')) this.domain = state.domain || '';
    if (has('facet')) this.facet = state.facet || 'all';
    if (has('recordId')) {
      this.selectedId = state.recordId || null;
      const record = this.plugin.store.get(this.selectedId);
      if (!has('recordType') && record?.type) this.type = record.type;
      if (this.selectedId) this.query = '';
    }
    if (has('query')) this.query = state.query || '';
  }
  async setState(state) { this.applyState(state); this.render(); }
  getState() {
    return { recordType: this.type, recordId: this.selectedId, query: this.query,
      facet: this.facet, domain: this.domain };
  }
  async onOpen() { this.applyState(this.leaf.state || {}); this.render(); }

  // -------------------------------------------------------------- shelf index

  /** source id → the shelves that carry it, with this shelf's own reason. */
  shelfIndex() {
    if (this._shelfIndex && this._shelfSnapshot === this.plugin.store.snapshotId) return this._shelfIndex;
    const index = new Map();
    for (const shelf of this.plugin.store.of('collection')) {
      for (const entry of shelf.entries || []) {
        if (!entry?.source) continue;
        if (!index.has(entry.source)) index.set(entry.source, []);
        index.get(entry.source).push({ shelf, group: entry.group, why: entry.why });
      }
    }
    this._shelfIndex = index;
    this._shelfSnapshot = this.plugin.store.snapshotId;
    return index;
  }

  matchesFacet(record) {
    if (this.type !== 'source' || this.facet === 'all') return true;
    const shelves = this.shelfIndex().get(record.id) || [];
    if (this.facet === 'shelved') return shelves.length > 0;
    if (this.facet === 'unshelved') return shelves.length === 0;
    if (this.facet === 'local') return Boolean(record.material_exists);
    if (this.facet === 'online') return Boolean(record.url);
    if (this.facet === 'in-unit') return this.plugin.store.useUnits(record.id).length > 0;
    return true;
  }

  rows() {
    let rows = this.plugin.store.search(this.query, [this.type]).filter((row) => this.matchesFacet(row));
    if (this.domain) rows = rows.filter((row) => (row.domain || '') === this.domain);
    return rows.slice().sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
  }

  // ------------------------------------------------------------------ render

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-library-view');
    // Reachable from the Navigator regardless of projection health, so it must
    // degrade rather than search an unloaded record set.
    if (!this.plugin.store.ready) {
      pageHeader(root, 'Reference', 'Projection unavailable');
      empty(root, 'The interface contract could not be loaded', this.plugin.store.error,
        'Rebuild views', () => this.plugin.generate());
      return;
    }
    pageHeader(root, '', 'Library');

    // Three panes, and only the middle one is dense: modes and filters on the
    // left, the list in the middle, one record's detail on the right. The five
    // modes used to be horizontal pills above a facet bar above a filter chip
    // above the list — four stacked control strips before any content.
    const layout = root.createDiv({ cls: 'los-library-layout' });
    const rail = layout.createDiv({ cls: 'los-library-rail' });
    for (const [value, label] of LIBRARY_MODES) {
      const count = this.plugin.store.of(value).length;
      const tab = rail.createEl('button', {
        cls: `los-library-mode is-clickable${this.type === value ? ' is-active' : ''}`,
        attr: { type: 'button', 'aria-pressed': String(this.type === value) },
      });
      tab.createSpan({ text: label });
      tab.createSpan({ cls: 'los-micro', text: String(count) });
      tab.addEventListener('click', () => {
        this.type = value; this.selectedId = null; this.facet = 'all'; this.domain = ''; this.render();
      });
    }
    if (this.type === 'source' || this.domain) this.renderFilters(rail);

    const centre = layout.createDiv({ cls: 'los-library-centre' });
    const input = centre.createEl('input', {
      cls: 'los-search',
      attr: { type: 'search', placeholder: 'Search titles, IDs, aliases, authors…', 'aria-label': 'Library search' },
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
    const list = centre.createDiv({ cls: 'los-library-list' });
    const rows = this.rows();
    if (this.selectedId && !rows.some((row) => row.id === this.selectedId)) this.selectedId = null;
    if (!this.selectedId && rows.length) this.selectedId = rows[0].id;
    if (!rows.length) {
      empty(list, 'No matching records',
        this.facet === 'all' ? 'Try a title, an ID, or a German/English alias.'
          : 'No record matches this filter — clear it or widen the search.');
    }
    if (this.type === 'collection') this.renderShelfList(list, rows);
    else this.renderFlatList(list, rows);

    button(centre, 'Full-text / OCR search', () => this.plugin.openFullTextSearch(this.query), 'quiet');

    this.detailEl = layout.createDiv({ cls: 'los-library-detail' });
    this.renderDetail(rows.find((row) => row.id === this.selectedId));
  }

  /** Facets are a refinement, not a permanent fixture — they stay folded until
   *  the learner has decided the list is too big. */
  renderFilters(rail) {
    const label = this.facet === 'all' && !this.domain ? 'Filters' : 'Filters · active';
    const body = disclosure(rail, label, 'los-library-filters');
    if (this.domain) {
      const active = body.createDiv({ cls: 'los-library-filter' });
      active.createSpan({ text: `Domain: ${this.domain}` });
      button(active, 'Clear', () => { this.domain = ''; this.selectedId = null; this.render(); }, 'quiet');
    }
    if (this.type !== 'source') return;
    const all = this.plugin.store.of('source');
    for (const [value, facetLabel] of SOURCE_FACETS) {
      const previous = this.facet;
      this.facet = value;
      const count = all.filter((row) => this.matchesFacet(row)).length;
      this.facet = previous;
      const chipEl = button(body, `${facetLabel} · ${count}`, () => {
        this.facet = value; this.selectedId = null; this.render();
      }, this.facet === value ? 'row' : 'quiet');
      chipEl.setAttribute('aria-pressed', String(this.facet === value));
    }
  }

  /** Shelves grouped by the domain the core assigns them. */
  renderShelfList(list, rows) {
    const byDomain = new Map();
    for (const row of rows) {
      const domain = row.domain || 'cross-domain';
      if (!byDomain.has(domain)) byDomain.set(domain, []);
      byDomain.get(domain).push(row);
    }
    for (const domain of [...byDomain.keys()].sort()) {
      list.createDiv({ cls: 'los-list-group', text: domain });
      for (const record of byDomain.get(domain)) this.listRow(list, record, `${(record.entries || []).length} entries`);
    }
  }

  renderFlatList(list, rows) {
    for (const record of rows) {
      // Never the raw ID: a list line should say what the record *is*.
      let meta = [record.domain, record.role, record.status].filter(Boolean).join(' · ');
      if (record.type === 'source') {
        const shelves = this.shelfIndex().get(record.id) || [];
        meta = [record.source_type, record.year,
          shelves.length ? `${shelves.length} shelf${shelves.length > 1 ? 'ves' : ''}` : 'no shelf',
          record.material_exists ? 'local' : null].filter(Boolean).join(' · ');
      } else if (record.type === 'note') {
        meta = [record.role, record.domain, record.state].filter(Boolean).join(' · ');
      }
      this.listRow(list, record, meta);
    }
  }

  listRow(list, record, meta) {
    const row = list.createEl('button', {
      cls: `los-item ${record.id === this.selectedId ? 'is-selected' : ''}`,
      attr: { type: 'button' },
    });
    icon(row.createSpan(), ICONS[record.type] || 'circle');
    const copy = row.createSpan({ cls: 'los-item-copy' });
    copy.createSpan({ text: record.title || record.id });
    if (meta) copy.createSpan({ cls: 'los-micro', text: meta });
    row.addEventListener('click', () => { this.selectedId = record.id; this.render(); });
    return row;
  }

  // ------------------------------------------------------------------ detail

  renderDetail(record) {
    const detail = this.detailEl;
    if (!record) { empty(detail, 'Choose a record', 'The detail pane shows evidence and curriculum usage.'); return; }
    detail.createDiv({ cls: 'los-kicker', text: record.type === 'collection' ? 'shelf' : record.type });
    detail.createEl('h2', { text: record.title || record.id });
    if (record.summary) detail.createEl('p', { text: record.summary });

    const actions = detail.createDiv({ cls: 'los-actions' });
    if (record.url) button(actions, 'Open online', () => this.plugin.openResource({ url: record.url }), 'cta');
    if (record.material_path) button(actions, 'Open local copy', () => this.plugin.openMaterialPath(record.material_path), 'quiet');
    if (record.path) button(actions, record.type === 'note' ? 'Open note' : 'Open authored file',
      () => this.plugin.openAuthoredPath(record.path), 'quiet');

    if (record.attachments?.length) {
      const attachments = section(detail, 'Attachments', 'Open the original handwriting, image, or PDF.');
      for (const attachment of record.attachments) {
        const path = typeof attachment === 'string' ? attachment : attachment.path || attachment.vault_path;
        const label = typeof attachment === 'string' ? attachment.split('/').pop() : attachment.label || path;
        if (path) button(attachments, `Open ${label}`, () => this.plugin.openAuthoredPath(path), 'quiet');
      }
    }

    if (record.type === 'collection') this.renderShelfDetail(detail, record);
    if (record.type === 'source') this.renderSourceDetail(detail, record);

    this.renderRelated(detail, record);

    // An operator ID is not study content. It stays one disclosure away, with
    // the copy action beside it rather than in the main action row.
    const technical = disclosure(detail, 'Technical details', 'los-technical-details');
    const idRow = technical.createDiv({ cls: 'los-fact-row' });
    idRow.createSpan({ cls: 'los-fact-label', text: 'Record ID' });
    idRow.createSpan({ cls: 'los-fact-value los-detail-id', text: record.id });
    button(technical, 'Copy ID', () => this.plugin.copyText(record.id), 'quiet');
    if (record.path) {
      const pathRow = technical.createDiv({ cls: 'los-fact-row' });
      pathRow.createSpan({ cls: 'los-fact-label', text: 'Path' });
      pathRow.createSpan({ cls: 'los-fact-value', text: record.path });
    }
  }

  /** Related records grouped by what the relation *means*, five at a time.
   *  Twenty-four undifferentiated chips is a pile, not a map. */
  renderRelated(detail, record) {
    const labels = {
      unit: 'Used in units', concept: 'Connected concepts', note: 'Referenced by notes',
      source: 'Related sources', collection: 'On shelves', module: 'Modules',
      workspace: 'Workspaces', program: 'Areas',
    };
    const groups = new Map();
    for (const row of this.plugin.store.related(record.id)) {
      const key = row.rec?.type || 'record';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row.rec);
    }
    if (!groups.size) return;
    const wrap = section(detail, 'Related');
    for (const [type, rows] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const group = wrap.createDiv({ cls: 'los-related-group' });
      group.createDiv({ cls: 'los-group-title', text: `${labels[type] || type} · ${rows.length}` });
      const shown = group.createDiv({ cls: 'los-related-chips' });
      for (const rec of rows.slice(0, 5)) chip(shown, rec, (row) => this.plugin.openRecord(row));
      if (rows.length > 5) {
        const rest = disclosure(group, `View all ${rows.length}`);
        const restChips = rest.createDiv({ cls: 'los-related-chips' });
        for (const rec of rows.slice(5)) chip(restChips, rec, (row) => this.plugin.openRecord(row));
      }
    }
  }

  /** A shelf reads in its authored order, grouped by the author's own tiers. */
  renderShelfDetail(detail, shelf) {
    const entries = (shelf.entries || []).filter((entry) => entry?.source);
    const wrap = section(detail, `Reading list (${entries.length})`,
      'Order and grouping are the shelf’s own; each line says the entry’s role in this list.');
    if (!entries.length) { empty(wrap, 'Empty shelf', 'No entries are registered on this collection.'); return; }
    const groups = [];
    for (const entry of entries) {
      const name = entry.group || '';
      const last = groups[groups.length - 1];
      if (last && last.name === name) last.rows.push(entry);
      else groups.push({ name, rows: [entry] });
    }
    for (const group of groups) {
      if (group.name) wrap.createDiv({ cls: 'los-list-group', text: group.name });
      for (const entry of group.rows) {
        const source = this.plugin.store.get(entry.source);
        const row = wrap.createDiv({ cls: 'los-shelf-entry' });
        const head = row.createEl('button', { cls: 'los-shelf-entry-title is-clickable', attr: { type: 'button' } });
        icon(head.createSpan(), ICONS.source);
        head.createSpan({ text: source?.title || entry.source });
        head.addEventListener('click', () => {
          if (source) { this.type = 'source'; this.selectedId = source.id; this.facet = 'all'; this.query = ''; this.render(); }
        });
        const facts = [source?.source_type, source?.year,
          source?.material_exists ? 'local copy' : null, source?.url ? 'online' : 'no link'].filter(Boolean);
        if (facts.length) row.createDiv({ cls: 'los-micro', text: facts.join(' · ') });
        if (entry.why) row.createDiv({ cls: 'los-shelf-why', text: entry.why });
        const rowActions = row.createDiv({ cls: 'los-actions' });
        if (source?.url) button(rowActions, 'Open online', () => this.plugin.openResource({ url: source.url }), 'quiet');
        if (source?.material_path) button(rowActions, 'Open local copy', () => this.plugin.openMaterialPath(source.material_path), 'quiet');
      }
    }
  }

  renderSourceDetail(detail, record) {
    const facts = section(detail, 'Source facts');
    for (const [label, value] of [['Authors', (record.authors || []).join(', ')],
      ['Organization', record.organization], ['Year', record.year],
      ['Type', record.source_type]]) {
      if (value) facts.createDiv({ cls: 'los-row', text: `${label}: ${value}` });
    }

    const shelves = this.shelfIndex().get(record.id) || [];
    const onShelves = section(detail, 'On shelves',
      'Where this source sits in a curated list, and the role it plays there.');
    if (!shelves.length) {
      empty(onShelves, 'Not on any shelf',
        'Registered but uncurated — it surfaces only through concept links and note references.');
    }
    for (const row of shelves) {
      const line = onShelves.createDiv({ cls: 'los-shelf-entry' });
      const head = line.createEl('button', { cls: 'los-shelf-entry-title is-clickable', attr: { type: 'button' } });
      icon(head.createSpan(), 'library');
      head.createSpan({ text: row.shelf.title || row.shelf.id });
      head.addEventListener('click', () => {
        this.type = 'collection'; this.selectedId = row.shelf.id; this.query = ''; this.render();
      });
      if (row.group) line.createDiv({ cls: 'los-micro', text: row.group });
      if (row.why) line.createDiv({ cls: 'los-shelf-why', text: row.why });
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
}

/* ---- src/views/atlas-view.ts ---- */
/**
 * Domain atlas — the cross-domain map (ADR-005).
 *
 * Its whole purpose is to stop a session's field of view collapsing to the
 * active workspace's domain, which a link to a Markdown wall cannot do. Every
 * domain lists its actual notes, wiring hubs and shelves, and every row opens
 * the thing it names. Counts stay — but as a way in, not as the answer.
 *
 * Presentation only: domains, roles and shelf assignments are core-authored.
 */
const ATLAS_ROLE_ORDER = ['crosswalk', 'reference', 'synthesis', 'exercise-bank', 'mock-exam'];

class AtlasView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.domain = null; }
  getViewType() { return VIEW_ATLAS; }
  getDisplayText() { return 'LearningOS · Domain atlas'; }
  getIcon() { return 'map'; }
  async setState(state) {
    if (state?.domain) this.domain = state.domain;
    this.render();
  }
  getState() { return { domain: this.domain }; }
  async onOpen() { this.domain = this.leaf.state?.domain || null; this.render(); }

  atlas() {
    const domains = new Map();
    const bucket = (name) => {
      const key = name || 'cross-domain';
      if (!domains.has(key)) domains.set(key, { name: key, notes: [], shelves: [] });
      return domains.get(key);
    };
    for (const note of this.plugin.store.of('note')) bucket(note.domain).notes.push(note);
    for (const shelf of this.plugin.store.of('collection')) bucket(shelf.domain).shelves.push(shelf);
    return [...domains.values()].sort((a, b) => b.notes.length - a.notes.length
      || a.name.localeCompare(b.name));
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-atlas-view');
    if (!this.plugin.store.ready) {
      pageHeader(root, 'Reach', 'Domain atlas unavailable');
      empty(root, 'The interface contract could not be loaded', this.plugin.store.error,
        'Rebuild views', () => this.plugin.generate());
      return;
    }
    pageHeader(root, 'Reach', 'Domain atlas',
      'Every domain’s notes, wiring hubs and shelves — so a question standing in one module can be answered by another domain’s shelf.');

    const domains = this.atlas();
    if (!domains.length) {
      empty(root, 'Nothing mapped yet', 'No notes or shelves are registered.');
      return;
    }
    if (!this.domain || !domains.some((row) => row.name === this.domain)) this.domain = domains[0].name;

    const glance = root.createDiv({ cls: 'los-atlas-glance' });
    for (const domain of domains) {
      const entries = domain.shelves.reduce((total, shelf) => total + (shelf.entries || []).length, 0);
      const crosswalks = domain.notes.filter((note) => note.role === 'crosswalk').length;
      const tile = glance.createEl('button', {
        cls: `los-atlas-tile is-clickable ${domain.name === this.domain ? 'is-selected' : ''}`,
        attr: { type: 'button', 'aria-pressed': String(domain.name === this.domain) },
      });
      tile.createSpan({ cls: 'los-atlas-tile-name', text: domain.name });
      const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
      tile.createSpan({
        cls: 'los-micro',
        text: [plural(domain.notes.length, 'note'),
          crosswalks ? plural(crosswalks, 'crosswalk') : null,
          `${plural(domain.shelves.length, 'shelf').replace('shelfs', 'shelves')} (${entries})`,
        ].filter(Boolean).join(' · '),
      });
      tile.addEventListener('click', () => { this.domain = domain.name; this.render(); });
    }

    const current = domains.find((row) => row.name === this.domain);
    const body = root.createDiv({ cls: 'los-atlas-body' });
    this.renderDomain(body, current);
    this.renderBoundaries(root);
  }

  noteRow(parent, note) {
    const row = parent.createEl('button', { cls: 'los-item is-clickable', attr: { type: 'button' } });
    icon(row.createSpan(), ICONS.note);
    const copy = row.createSpan({ cls: 'los-item-copy' });
    copy.createSpan({ text: note.title || note.id });
    copy.createSpan({ cls: 'los-micro', text: [note.role, note.state, note.id].filter(Boolean).join(' · ') });
    row.addEventListener('click', () => this.plugin.openAuthoredPath(note.path));
    return row;
  }

  renderDomain(parent, domain) {
    if (!domain) return;
    const header = parent.createDiv({ cls: 'los-atlas-domain-head' });
    header.createEl('h2', { text: domain.name });
    const actions = header.createDiv({ cls: 'los-actions' });
    button(actions, 'Browse these notes in the Library',
      () => this.plugin.openLibraryFiltered('note', domain.name), 'quiet');

    const crosswalks = domain.notes.filter((note) => note.role === 'crosswalk');
    if (crosswalks.length) {
      const wrap = section(parent, `Wiring hubs (${crosswalks.length})`,
        'Crosswalks carry the narrative that joins this domain’s sources and concepts — read one before opening a shelf.');
      for (const note of crosswalks) this.noteRow(wrap, note);
    }

    const byRole = new Map();
    for (const note of domain.notes) {
      const role = note.role || 'synthesis';
      if (!byRole.has(role)) byRole.set(role, []);
      byRole.get(role).push(note);
    }
    const roles = [...byRole.keys()].sort((a, b) => {
      const rank = (role) => (ATLAS_ROLE_ORDER.indexOf(role) + 1 || 99);
      return rank(a) - rank(b) || a.localeCompare(b);
    });
    if (domain.notes.length) {
      const notesWrap = section(parent, `Notes (${domain.notes.length})`,
        'Grouped by role. Opening a row opens the note itself.');
      for (const role of roles) {
        const rows = byRole.get(role).slice()
          .sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
        const group = notesWrap.createEl('details', { cls: 'los-atlas-group' });
        if (role === 'crosswalk' ? false : rows.length <= 12) group.setAttr('open', 'open');
        group.createEl('summary', { text: `${role} (${rows.length})` });
        for (const note of rows) this.noteRow(group, note);
      }
    } else {
      empty(parent, 'No notes in this domain yet',
        'Sources here surface only through concept links and shelves.');
    }

    const shelvesWrap = section(parent, `Shelves (${domain.shelves.length})`,
      'Curated reading lists. The blurb is the shelf’s own rule for using it.');
    if (!domain.shelves.length) {
      empty(shelvesWrap, 'No shelves yet',
        'Nothing curated for this domain — the registry still holds its sources.');
    }
    for (const shelf of domain.shelves.slice()
      .sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)))) {
      const card = shelvesWrap.createDiv({ cls: 'los-shelf-entry' });
      const head = card.createEl('button', { cls: 'los-shelf-entry-title is-clickable', attr: { type: 'button' } });
      icon(head.createSpan(), 'library');
      head.createSpan({ text: `${shelf.title || shelf.id} (${(shelf.entries || []).length})` });
      head.addEventListener('click', () => this.plugin.openLibrary(shelf.id, 'collection'));
      if (shelf.summary) card.createDiv({ cls: 'los-shelf-why', text: projectedExcerpt(shelf.summary, 320) });
    }
  }

  renderBoundaries(root) {
    const boundaries = this.plugin.store.rows('quarantine_boundaries');
    const wrap = section(root, 'Outside this map by policy',
      'Named so their absence is visible; their content is never loaded, indexed, or searched.');
    if (!boundaries.length) {
      empty(wrap, 'No boundary records', 'Nothing is currently quarantined in the projection.');
    }
    for (const boundary of boundaries) {
      const card = wrap.createDiv({ cls: 'los-boundary-row' });
      card.createDiv({ cls: 'los-item-copy', text: boundary.title || boundary.id });
      const policy = boundaryPolicy(boundary.description || '');
      if (policy) card.createDiv({ cls: 'los-micro', text: policy });
    }
    button(wrap, 'Open the generated atlas file',
      () => this.plugin.openVaultPath('generated/domain-atlas.md'), 'quiet');
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
    if (!unit) { this.renderQueue(root); return; }
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
      return;
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
  }

  renderQueue(root) {
    const wrap = section(root, 'Ready to shelve');
    const rows = this.plugin.store.units().filter((row) => row.status === 'ready-to-shelve');
    if (!rows.length) empty(wrap, 'No unit is waiting', 'Keep working from any active unit.');
    for (const unit of rows) unitCard(wrap, this.plugin, unit);
  }

  async prepare() {
    try {
      await this.plugin.mutate(() => this.plugin.gateway.prepareShelving(this.unitId));
      await this.loadProposal(); this.render();
    }
    catch (error) { new Notice(error?.message || String(error)); }
  }

  async apply() {
    if (!this.selected.size) { new Notice('Select at least one proposal.'); return; }
    try {
      await this.plugin.mutate(() => this.plugin.gateway.applyShelving(this.unitId, [...this.selected]));
      this.proposal = null; this.selected.clear(); this.render();
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
    pageHeader(root, 'Deliberate boundary', boundary.title, boundaryPolicy(boundary.description));
    const guard = section(root, 'What this means');
    if (boundary.id === 'program-job-boundary') {
      guard.createEl('p', { text: 'Job content is not indexed, searched, read, or mixed into LearningOS. Access requires a separate, explicit request.' });
      button(guard, 'Request explicit Job access', () => new Notice('Job access remains outside LearningOS. Ask Codex explicitly when needed.'), 'quiet');
    } else {
      guard.createEl('p', { text: 'Master’s planning is quarantined from current Bachelor’s work and all default search. This surface exposes only the boundary record.' });
      button(guard, 'Open Master’s Planning boundary', () => new Notice('Open the quarantined folder manually only for a deliberate planning session.'), 'quiet');
    }
  }
}

/* ---- src/views/review-view.ts ---- */
/**
 * Review — the decision queues in one place. Shelving proposals, units without
 * a map, inbox items awaiting routing and the Garden's harvest pressure are all
 * the same question ("what needs a decision from me?"), so they stop occupying
 * four separate permanent destinations.
 */
class ReviewView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_REVIEW; }
  getDisplayText() { return 'LearningOS · Review'; }
  getIcon() { return 'check-check'; }
  async onOpen() { this.render(); }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-review-view');
    if (!this.plugin.store.ready) {
      pageHeader(root, 'LearningOS', 'Projection unavailable');
      empty(root, 'The interface contract could not be loaded', this.plugin.store.error,
        'Rebuild views', () => this.plugin.generate());
      return;
    }
    pageHeader(root, '', 'Review', 'Everything waiting on a decision from you.');
    const shelving = this.plugin.store.units().filter((row) => row.status === 'ready-to-shelve');
    const needsMap = this.plugin.store.units().filter((row) => !this.plugin.store.mapForUnit(row.id));
    const inbox = this.plugin.store.data.counts?.inbox_items || 0;
    const garden = this.plugin.store.gardenEntries();

    const list = root.createDiv({ cls: 'los-review-list' });
    this.queue(list, 'Ready to shelve', shelving.length,
      'Units whose working notes are ready to become durable knowledge.',
      shelving.length ? ['Review proposals', () => this.plugin.openShelving(shelving[0].id)] : null);
    this.queue(list, 'Inbox', inbox,
      'Captured items the operator has not routed yet.',
      ['Open capture', () => this.plugin.openCapture()]);
    this.queue(list, 'Needs a study map', needsMap.length,
      'Units with no current study script.',
      needsMap.length ? ['Open the queue', () => this.plugin.openProgram('queue-needs-map')] : null);
    this.queue(list, 'Garden', garden.length,
      'Half-formed ideas gestating outside the canon; approved AI actions may help prepare them for shelving.',
      ['Open the Garden', () => this.plugin.openGarden()]);

    if (needsMap.length) {
      const detail = disclosure(root, `Units needing a map (${needsMap.length})`);
      const grid = detail.createDiv({ cls: 'los-card-grid' });
      for (const unit of needsMap) unitCard(grid, this.plugin, unit);
    }
  }

  queue(parent, label, count, detail, action) {
    const row = parent.createDiv({ cls: 'los-review-row' });
    const copy = row.createDiv({ cls: 'los-review-copy' });
    const heading = copy.createDiv({ cls: 'los-review-heading' });
    heading.createEl('strong', { text: label });
    if (count != null) heading.createSpan({ cls: 'los-review-count', text: String(count) });
    copy.createDiv({ cls: 'los-micro', text: detail });
    if (action) button(row, action[0], action[1], count ? 'cta' : 'quiet');
    else row.createSpan({ cls: 'los-micro los-review-clear', text: 'Nothing waiting' });
    return row;
  }
}

/**
 * Diagnostics — everything the learner does not need while studying. Lives
 * under More, never on Home. A green/red badge is not enough for a layer that
 * can be stale, warning, erroring, or talking to no core at all.
 */
class DiagnosticsView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.report = ''; }
  getViewType() { return VIEW_DIAGNOSTICS; }
  getDisplayText() { return 'LearningOS · Diagnostics'; }
  getIcon() { return 'activity'; }
  async onOpen() { this.render(); }

  state() {
    if (!this.plugin.store.ready) return ['?', 'Core unavailable', this.plugin.store.error];
    if (this.plugin.store.data?._generated?.source_dirty) {
      return ['●', 'Canonical files changed; projection is stale', 'Rebuild to bring the interface back in step.'];
    }
    return ['✓', 'Valid and current', 'The projection matches the canonical tree as of its last rebuild.'];
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-diagnostics-view');
    pageHeader(root, 'More', 'Diagnostics');
    const [glyph, title, detail] = this.state();
    const status = root.createDiv({ cls: 'los-diagnostic-status' });
    status.createSpan({ cls: 'los-diagnostic-glyph', text: glyph });
    const copy = status.createDiv();
    copy.createEl('strong', { text: title });
    copy.createDiv({ cls: 'los-micro', text: detail });

    const generated = this.plugin.store.data?._generated || {};
    const facts = section(root, 'Contract and versions');
    const table = facts.createDiv({ cls: 'los-fact-list' });
    for (const [label, value] of [
      ['Manifest contract', generated.contract_version ?? 'unknown'],
      ['UI expects contract', CONTRACT_VERSION],
      ['UI version', this.plugin.uiVersion()],
      ['Generator', generated.generator || 'unknown'],
      ['Projection built', generated.generated_at || 'unknown'],
      ['Snapshot', generated.snapshot_id || 'unknown'],
      ['Source revision', generated.source_revision || 'unknown'],
      ['Python interpreter', this.plugin.resolvePython().path],
      ['Interpreter source', this.plugin.resolvePython().origin],
    ]) {
      const row = table.createDiv({ cls: 'los-fact-row' });
      row.createSpan({ cls: 'los-fact-label', text: label });
      row.createSpan({ cls: 'los-fact-value', text: String(value) });
    }

    const actions = root.createDiv({ cls: 'los-actions' });
    button(actions, 'Validate and rebuild', () => this.plugin.generate(), 'cta');
    button(actions, 'Test the interpreter', () => this.testInterpreter(), 'quiet');
    if (this.report) root.createEl('pre', { cls: 'los-diagnostic-report', text: this.report });

    const policy = section(root, 'About LearningOS');
    policy.createEl('p', { text: OWNERSHIP_STATEMENT });
  }

  async testInterpreter() {
    const resolved = this.plugin.resolvePython();
    try {
      const result = await this.plugin.gateway.call(['status', '--json']);
      this.report = `${resolved.path} (${resolved.origin})\nCore answered: ${JSON.stringify(result).slice(0, 400)}`;
    } catch (error) {
      this.report = `${resolved.path} (${resolved.origin})\nFailed: ${error?.message || String(error)}\nTried: ${resolved.attempted.join(', ')}`;
    }
    this.render();
  }
}

/* ---- src/views/garden-view.ts ---- */
/** Garden is a review surface for seeds, not a second canonical knowledge
 * browser. The original artifact is always opened as-is; AI-derived state and
 * transcriptions are displayed as separate projected facts. */
class GardenView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_GARDEN; }
  getDisplayText() { return 'LearningOS · Garden'; }
  getIcon() { return 'sprout'; }
  async onOpen() { this.render(); }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-garden-view');
    if (!this.plugin.store.ready) {
      pageHeader(root, 'Review', 'Garden unavailable');
      empty(root, 'The interface contract could not be loaded', this.plugin.store.error,
        'Rebuild views', () => this.plugin.generate());
      return;
    }
    pageHeader(root, 'Review', 'Garden',
      'Seeds remain human-owned. “Shelve with AI” prepares a bounded request bundle; nothing changes until an approved delivery is applied.');
    const toolbar = root.createDiv({ cls: 'los-actions' });
    button(toolbar, 'Open Garden base', () => this.plugin.openVaultPath('bases/garden.base'), 'quiet');
    button(toolbar, 'Refresh projection', () => this.plugin.generate(), 'quiet');

    const entries = this.plugin.store.gardenEntries();
    if (!entries.length) {
      empty(root, 'No Garden seeds', 'Create a Markdown seed under knowledge/garden/.');
      return;
    }
    const list = root.createDiv({ cls: 'los-garden-list' });
    for (const target of entries) this.card(list, target);
  }

  card(parent, target) {
    const card = parent.createDiv({ cls: `los-card los-garden-card los-garden-${target.state || 'seed'}` });
    const top = card.createDiv({ cls: 'los-card-top' });
    top.createEl('h2', { text: target.title || target.id });
    badge(top, target.state || 'seed', target.state || 'seed');
    card.createDiv({ cls: 'los-micro', text: target.path });
    if (target.tags?.length) {
      const tags = card.createDiv({ cls: 'los-garden-tags' });
      for (const tag of target.tags) badge(tags, `#${tag}`, 'role');
    }

    const latest = this.plugin.store.latestAiRequest(target.id);
    if (latest) {
      const status = card.createDiv({ cls: 'los-ai-request-status' });
      status.createEl('strong', { text: `AI request · ${latest.status}` });
      status.createDiv({ cls: 'los-micro', text: `${latest.provider || 'manual-bundle'} · ${latest.id}` });
      if (latest.bundle_path) status.createDiv({ cls: 'los-micro', text: latest.bundle_path });
      const statusActions = status.createDiv({ cls: 'los-actions' });
      if (latest.bundle_path) button(statusActions, 'Copy bundle path', () => this.plugin.copyText(latest.bundle_path), 'quiet');
      if (latest.delivery_id && latest.status !== 'applied') {
        button(statusActions, 'Apply approved delivery', async () => {
          try {
            await this.plugin.aiActions.applyApprovedDelivery(latest.delivery_id);
            new Notice('Approved AI delivery applied and projection refreshed.');
            this.render();
          } catch (error) { new Notice(error?.message || String(error)); }
        }, 'cta');
      }
      if (latest.receipt_id) badge(status, `receipt ${latest.receipt_id}`, 'complete');
    }

    const actions = card.createDiv({ cls: 'los-garden-actions' });
    button(actions, 'Open original', () => this.plugin.openVaultPath(target.path), 'quiet');
    if (target.transcription_path) {
      button(actions, 'Open AI transcription', () => this.plugin.openVaultPath(target.transcription_path), 'quiet');
    }
    renderGardenShelveAction(actions, this.plugin, target, () => this.render());
    return card;
  }
}

/* ---- src/views/nav-view.ts ---- */
/**
 * Five permanent destinations, nothing else. Areas (Bachelor's / Skills /
 * Thesis) are sub-areas of Learn; the decision queues (Shelving / Garden /
 * Inbox) are Review; atlas, boundaries, diagnostics and maintenance live under
 * More. The sidebar's job is to make the next step obvious, not to prove the
 * system is large.
 */
class NavView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_NAV; }
  getDisplayText() { return 'LearningOS · Navigator'; }
  getIcon() { return 'route'; }
  async onOpen() { this.render(); }

  nav(parent, iconName, label, key, action) {
    const active = this.plugin.activeNav === key;
    const row = parent.createEl('button', {
      cls: `los-app-nav-item is-clickable${active ? ' is-active' : ''}`,
      attr: { type: 'button', 'aria-current': active ? 'page' : 'false' },
    });
    icon(row.createSpan(), iconName);
    row.createSpan({ text: label });
    row.addEventListener('click', action);
    return row;
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-app-nav');
    const brand = root.createDiv({ cls: 'los-nav-brand' });
    icon(brand.createSpan({ cls: 'los-brand-mark' }), 'route'); brand.createEl('strong', { text: 'LearningOS' });

    const primary = root.createDiv({ cls: 'los-nav-primary' });
    this.nav(primary, 'home', 'Home', 'home', () => this.plugin.openHome());
    this.nav(primary, 'graduation-cap', 'Learn', 'learn', () => this.plugin.openLearn());
    this.nav(primary, 'library', 'Library', 'library', () => this.plugin.openLibrary());
    this.nav(primary, 'plus', 'Capture', 'capture', () => this.plugin.openCapture());
    this.nav(primary, 'check-check', 'Review', 'review', () => this.plugin.openReview());

    const more = root.createEl('details', { cls: 'los-nav-more' });
    if (this.plugin.settings.navMoreOpen) more.setAttr('open', 'open');
    more.createEl('summary', { cls: 'los-nav-more-trigger', text: 'More' });
    more.addEventListener('toggle', () => {
      this.plugin.settings.navMoreOpen = Boolean(more.open ?? more.attrs?.open);
      this.plugin.scheduleDraftSave();
    });
    const secondary = more.createDiv({ cls: 'los-nav-secondary' });
    this.nav(secondary, 'map', 'Domain atlas', 'atlas', () => this.plugin.openAtlas());
    this.nav(secondary, 'shield', 'Master’s boundary', 'masters',
      () => this.plugin.openBoundary('program-masters-planning'));
    this.nav(secondary, 'shield-alert', 'Job boundary', 'job',
      () => this.plugin.openBoundary('program-job-boundary'));
    this.nav(secondary, 'activity', 'Diagnostics', 'diagnostics', () => this.plugin.openDiagnostics());
    this.nav(secondary, 'refresh-cw', 'Rebuild projection', 'rebuild', () => this.plugin.generate());
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
    new Setting(root).setName('Python interpreter')
      .setDesc('Leave blank to auto-detect: the project virtual environment, then the system Python.')
      .addText((text) => text
        .setValue(this.plugin.settings.pythonPath || '')
        .onChange(async (value) => {
          this.plugin.settings.pythonPath = value.trim();
          await this.plugin.saveData(this.plugin.settings);
        }));
    new Setting(root).setName('Validate and rebuild').setDesc('Run the canonical core projection pipeline.')
      .addButton((control) => control.setButtonText('Rebuild').setCta().onClick(() => this.plugin.generate()));
    new Setting(root).setName('Diagnostics').setDesc('Contract versions, projection freshness, interpreter.')
      .addButton((control) => control.setButtonText('Open').onClick(() => this.plugin.openDiagnostics()));

    // Stated once, here — not repeated under every screen (DESIGN.md).
    root.createEl('h3', { text: 'About LearningOS' });
    root.createEl('p', { cls: 'los-muted', text: OWNERSHIP_STATEMENT });
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
    this.settings.uiDrafts.doneWhen ||= {};
    this.draftSaveTimer = null;
    for (const type of LEGACY_VIEW_TYPES) this.app.workspace.detachLeavesOfType(type);
    this.store = new ManifestStore(this.app);
    this.gateway = new GatewayClient(this);
    this.aiActions = new AIActionClient(this);
    await this.store.load();
    this.registerView(VIEW_HOME, (leaf) => new HomeView(leaf, this));
    this.registerView(VIEW_NAV, (leaf) => new NavView(leaf, this));
    this.registerView(VIEW_PROGRAM, (leaf) => new ProgramView(leaf, this));
    this.registerView(VIEW_MODULE, (leaf) => new ModuleView(leaf, this));
    this.registerView(VIEW_UNIT, (leaf) => new UnitView(leaf, this));
    this.registerView(VIEW_LIBRARY, (leaf) => new LibraryView(leaf, this));
    this.registerView(VIEW_ATLAS, (leaf) => new AtlasView(leaf, this));
    this.registerView(VIEW_SHELVING, (leaf) => new ShelvingView(leaf, this));
    this.registerView(VIEW_BOUNDARY, (leaf) => new BoundaryView(leaf, this));
    this.registerView(VIEW_REVIEW, (leaf) => new ReviewView(leaf, this));
    this.registerView(VIEW_GARDEN, (leaf) => new GardenView(leaf, this));
    this.registerView(VIEW_DIAGNOSTICS, (leaf) => new DiagnosticsView(leaf, this));
    this.addSettingTab(new LearningOSSettingsTab(this.app, this));
    this.addRibbonIcon('route', 'Open LearningOS', () => this.openHome());
    this.addCommand({ id: 'open-home', name: 'Open Home', callback: () => this.openHome() });
    this.addCommand({ id: 'open-current-stage', name: 'Open current stage', callback: () => this.openResume() });
    this.addCommand({ id: 'open-library', name: 'Open Library', callback: () => this.openLibrary() });
    this.addCommand({ id: 'open-atlas', name: 'Open Domain atlas', callback: () => this.openAtlas() });
    this.addCommand({ id: 'open-garden', name: 'Open Garden', callback: () => this.openGarden() });
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
      VIEW_LIBRARY, VIEW_ATLAS, VIEW_SHELVING, VIEW_BOUNDARY, VIEW_REVIEW,
      VIEW_GARDEN, VIEW_DIAGNOSTICS]) this.app.workspace.detachLeavesOfType(type);
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
  /** Done-when ticks are UI-owned working state: they help the learner see how
   *  far through a stage's criteria they are, and are never a second record of
   *  completion. The core still learns only "complete" from `stage-progress`. */
  getDoneWhen(unitId, stageId) {
    return this.settings.uiDrafts.doneWhen[this.stageDraftKey(unitId, stageId)] || [];
  }
  setDoneWhen(unitId, stageId, index, checked) {
    const key = this.stageDraftKey(unitId, stageId);
    const marks = [...(this.settings.uiDrafts.doneWhen[key] || [])];
    marks[index] = checked;
    if (marks.some(Boolean)) this.settings.uiDrafts.doneWhen[key] = marks;
    else delete this.settings.uiDrafts.doneWhen[key];
    this.scheduleDraftSave();
  }
  clearDoneWhen(unitId, stageId) {
    delete this.settings.uiDrafts.doneWhen[this.stageDraftKey(unitId, stageId)];
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

  /**
   * Interpreter resolution, in order: an explicitly configured path, the POSIX
   * venv, the Windows venv, then the PATH names. Reported rather than guessed —
   * when a write button dies, Diagnostics has to be able to say which binary
   * was tried and where it looked.
   */
  /** The plugin's own version, kept off the `manifest.` access path so the
   *  contract-key test cannot mistake it for a projection field. */
  uiVersion() { const info = this.manifest; return info?.version || 'unknown'; }

  resolvePython() {
    const base = this.app.vault.adapter.getBasePath();
    const configured = String(this.settings.pythonPath || '').trim();
    const candidates = [
      [configured, 'configured in settings'],
      [nodePath.join(base, '.venv', 'bin', 'python'), 'project virtual environment'],
      [nodePath.join(base, '.venv', 'Scripts', 'python.exe'), 'project virtual environment (Windows)'],
    ].filter(([path]) => path);
    const attempted = candidates.map(([path]) => path);
    for (const [path, origin] of candidates) {
      if (fs.existsSync(path)) return { path, origin, attempted };
    }
    const fallback = process?.platform === 'win32' ? 'python' : 'python3';
    return { path: fallback, origin: 'PATH fallback', attempted: [...attempted, fallback] };
  }

  runLos(args, callback) {
    const base = this.app.vault.adapter.getBasePath();
    const python = this.resolvePython().path;
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

  /** The active destination is a display fact, so the Navigator is the only
   *  thing it redraws — never the working view the learner is reading. */
  setActiveNav(key) {
    this.activeNav = key;
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_NAV)) leaf.view?.render?.();
  }

  async openNav() { return this.openView(VIEW_NAV, {}, 'left'); }
  async openHome() {
    this.setActiveNav('home');
    const leaf = await this.openView(VIEW_HOME);
    if (this.settings.pinHome) leaf.setPinned?.(true);
    return leaf;
  }
  /** Learn is one destination; the areas are sub-areas inside it. */
  openLearn(programId = null) {
    const area = programId || this.settings.learnArea || LEARN_AREAS[0][0];
    this.settings.learnArea = area;
    this.scheduleDraftSave();
    this.setActiveNav('learn');
    return this.openView(VIEW_PROGRAM, { programId: area });
  }
  openCapture() { this.setActiveNav('capture'); return this.openView(VIEW_PROGRAM, { programId: 'inbox' }); }
  openReview() { this.setActiveNav('review'); return this.openView(VIEW_REVIEW, {}); }
  openGarden() { this.setActiveNav('review'); return this.openView(VIEW_GARDEN, {}); }
  openDiagnostics() { this.setActiveNav('diagnostics'); return this.openView(VIEW_DIAGNOSTICS, {}); }
  openProgram(programId) { return this.openView(VIEW_PROGRAM, { programId }); }
  openModule(moduleId) { this.setActiveNav('learn'); return this.openView(VIEW_MODULE, { moduleId }); }
  openUnit(unitId, stageId = null) {
    const selectedStage = stageId || this.getSelectedStage(unitId);
    if (selectedStage) this.setSelectedStage(unitId, selectedStage);
    this.setActiveNav('learn');
    return this.openView(VIEW_UNIT, { unitId, stageId: selectedStage });
  }
  openLibrary(recordId = undefined, recordType = undefined) {
    this.setActiveNav('library');
    const state = {};
    if (recordId !== undefined) state.recordId = recordId;
    if (recordType !== undefined) state.recordType = recordType;
    return this.openView(VIEW_LIBRARY, state);
  }
  /** Library opened on a whole slice — a type, optionally one domain — not a record. */
  openLibraryFiltered(recordType, domain = '') {
    return this.openView(VIEW_LIBRARY, { recordType, domain, recordId: null, query: '' });
  }
  openAtlas(domain = null) { this.setActiveNav('atlas'); return this.openView(VIEW_ATLAS, { domain }); }
  openShelving(unitId = null) { this.setActiveNav('review'); return this.openView(VIEW_SHELVING, { unitId }); }
  openBoundary(boundaryId) {
    this.setActiveNav(boundaryId === 'program-job-boundary' ? 'job' : 'masters');
    return this.openView(VIEW_BOUNDARY, { boundaryId });
  }
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

  /**
   * One transaction at a time, across every view. A per-view `busy` flag only
   * ever protected the view that owned it — a stage completion and an inbox
   * capture started from different leaves could still overlap, each carrying an
   * `--expected-snapshot` the other had already invalidated.
   */
  async mutate(action, { reload = true } = {}) {
    return this.gateway.enqueue(async () => {
      const result = await action();
      if (reload) await this.reloadStore();
      return result;
    });
  }

  async generate() {
    try {
      await this.mutate(async () => {
        await this.gateway.call(['validate'], { expectJson: false });
        await this.gateway.call(['generate'], { expectJson: false });
      });
      new Notice('LearningOS projection rebuilt.');
    } catch (error) { new Notice(error?.message || String(error)); }
  }

  async reviewSessionEnd() {
    try {
      const review = await this.gateway.endSession();
      new SessionEndModal(this.app, this, review).open();
      return review;
    } catch (error) { new Notice(error?.message || String(error)); return null; }
  }

  /**
   * Hard rule 10 (core CLAUDE.md §13): `Job/` is quarantined. This is its
   * mechanical enforcement. A `Job/…` path never leaves the vault, so the
   * escape checks in the open helpers below cannot catch it — and every open
   * funnels through one of them.
   */
  isQuarantinedPath(path) {
    const posix = String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
    return posix === 'Job' || posix.startsWith('Job/') || posix.includes('/Job/');
  }
  refuseQuarantined(path) {
    if (!this.isQuarantinedPath(path)) return false;
    new Notice('Job/ is quarantined — LearningOS never opens or displays it.');
    return true;
  }

  async openVaultPath(path) {
    if (this.refuseQuarantined(path)) return;
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
    if (this.refuseQuarantined(path)) return false;
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
    if (this.refuseQuarantined(path)) return false;
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
    if (record.type === 'collection') return this.openLibrary(record.id, 'collection');
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
      // A projected URL is still untrusted input to a viewer: `javascript:`,
      // `data:` and `file:` never reach Electron.
      const url = safeWebUrl(resource.url);
      if (!url) { new Notice(`Refused an unsupported link: ${String(resource.url).slice(0, 80)}`); return false; }
      const leaf = this.app.workspace.getLeaf(true);
      return leaf.setViewState({ type: 'webviewer', active: true, state: { url: url.href } });
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
