/* LearningOS UI v0.4.0 — single-file plugin, no build step (boundary rule:
 * no Node build system near the core). Presentation and interaction ONLY.
 *
 * v0.4 — "navigability is really bad, everything is a dump of links".
 * The division of labour is now explicit: the CORE optimises for robustness
 * and correctness and need not be pleasant to browse; ALL usability lives
 * here. Three structural changes make that possible:
 *
 *   1. Reads come from `generated/manifest.json` + `generated/backlinks.json`
 *      (ADR-006 addendum 4: the manifest is the interface contract). No
 *      Markdown parsing, no regexes over canonical files, and — crucially —
 *      no Python needed to render. The CLI is used for MUTATIONS and the
 *      validation badge only, so a broken venv degrades a banner, not the app.
 *   2. A real app shell: a left Navigator, a master/detail Explorer with
 *      search + facets + history, and a fuzzy Finder over all 400 records.
 *      Every relationship in the OS is a click, not a 470 KB markdown file.
 *   3. A documented design system (see DESIGN.md) — tokens, five components,
 *      four patterns — instead of ad-hoc CSS.
 *
 * Writes are unchanged and remain the only ones: `los.py generate|validate`
 * and NEW files in work/inbox/. */
'use strict';

const {
  Plugin, PluginSettingTab, ItemView, Modal, SuggestModal, Notice, Setting,
  setIcon,
} = require('obsidian');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIEW_DASH = 'learningos-dashboard';
const VIEW_NAV = 'learningos-nav';
const VIEW_EXPLORER = 'learningos-explorer';
const VIEW_PATH = 'learningos-learning-path';
const VIEW_SHELVE = 'learningos-shelve-review';
const VIEW_JOB = 'learningos-job-boundary';

const MANIFEST = 'generated/manifest.json';
const BACKLINKS = 'generated/backlinks.json';
const READING_ROOM = 'generated/reading-room.md';
const CANVAS = 'generated/concept-canvas.canvas';
const INBOX = 'work/inbox';

const STATUS_REFRESH_MS = 15 * 60 * 1000;
const RERENDER_DEBOUNCE_MS = 900;
const DAY = 86400000;

const DEFAULTS = {
  openOnStartup: true,
  pinDashboard: true,
  collapseSidebars: true,
  showNavigator: true,
  appChrome: true,
  liveRefresh: true,
  webviewer: true, // open source URLs inside Obsidian when available
};

/* =====================================================================
 * helpers
 * ================================================================== */

function daysUntil(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / DAY);
}

function shortDay(n) {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  return n > 0 ? `in ${n}d` : `${-n}d ago`;
}

function relTime(ms) {
  const d = Math.round((Date.now() - ms) / DAY);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

function examShort(title) {
  const m = /\(([^)]{1,24})\)/.exec(title || '');
  return m ? m[1] : String(title || '').split(/[—–-]/)[0].trim().slice(0, 22);
}

function titleCase(s) {
  return String(s || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Strict pass: every whitespace-separated token must appear literally.
 *  Precise enough to be a filter; 0 = no match. */
function tokenScore(tokens, text) {
  const t = String(text || '').toLowerCase();
  let score = 0;
  for (const tok of tokens) {
    const at = t.indexOf(tok);
    if (at < 0) return 0;
    score += 100 - Math.min(at, 90) + (at === 0 || /[\s\-_/(]/.test(t[at - 1]) ? 25 : 0);
  }
  return score - t.length * 0.02;
}

/** Forgiving pass: subsequence match, only used when nothing matched strictly
 *  (so a typo still finds something instead of an empty screen). */
function fuzzyScore(query, text) {
  const q = query.toLowerCase().replace(/\s+/g, '');
  const t = String(text || '').toLowerCase();
  if (!q) return 1;
  let qi = 0;
  let score = 0;
  let streak = 0;
  for (let i = 0; i < t.length && qi < q.length; i += 1) {
    if (t[i] === q[qi]) {
      streak += 1;
      score += streak + (i === 0 || /[\s\-_/]/.test(t[i - 1]) ? 3 : 0);
      qi += 1;
    } else streak = 0;
  }
  return qi === q.length ? score : 0;
}

const TYPE_META = {
  note: { icon: 'file-text', label: 'Note', plural: 'Notes' },
  concept: { icon: 'git-fork', label: 'Concept', plural: 'Concepts' },
  source: { icon: 'library', label: 'Source', plural: 'Sources' },
  module: { icon: 'graduation-cap', label: 'Module', plural: 'Modules' },
  workspace: { icon: 'briefcase', label: 'Workspace', plural: 'Workspaces' },
  'learning-path': { icon: 'route', label: 'Learning path', plural: 'Learning paths' },
  collection: { icon: 'boxes', label: 'Collection', plural: 'Collections' },
  coordination: { icon: 'calendar-days', label: 'Coordination', plural: 'Coordination' },
};

const IDENTIFIER_LABEL = {
  isbn: 'ISBN', issn: 'ISSN', doi: 'DOI', arxiv: 'arXiv', oclc: 'OCLC',
  url: 'URL', asin: 'ASIN',
};

const SOURCE_TYPE_ICON = {
  book: 'book', course: 'presentation', video: 'play-circle', website: 'globe',
  documentation: 'file-code', paper: 'file-text', lecture: 'projector',
  software: 'terminal', other: 'file',
};

/* =====================================================================
 * Store — the OS projection, read straight from generated/
 * ================================================================== */

class Store {
  constructor(app) {
    this.app = app;
    this.ready = false;
    this.error = null;
    this.records = [];
    this.byId = new Map();
    this.byType = new Map();
    this.relations = [];
    this.examSpine = [];
    this.counts = {};
    this.backlinks = {};
    this.generatedAt = null;
    this.snapshotId = null;
    this.contractVersion = null;
  }

  async read(p) {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(p))) throw new Error(`${p} missing`);
    return JSON.parse(await adapter.read(p));
  }

  async load() {
    try {
      const m = await this.read(MANIFEST);
      const contract = (m._generated || {}).contract_version;
      if (contract !== 1) {
        throw new Error(`Unsupported manifest contract ${contract == null ? 'legacy' : contract}; rebuild views`);
      }
      this.records = m.records || [];
      this.relations = m.relations || [];
      this.examSpine = (m.exam_spine || []).map((e) => ({ ...e, days: daysUntil(e.date) }))
        .sort((a, b2) => a.days - b2.days);
      this.counts = m.counts || {};
      this.generatedAt = (m._generated || {}).generated_at || null;
      this.snapshotId = (m._generated || {}).snapshot_id || null;
      this.contractVersion = contract;
      this.backlinks = m.backlinks || {};
      this.byId = new Map(this.records.map((r) => [r.id, r]));
      this.byType = new Map();
      for (const r of this.records) {
        if (!this.byType.has(r.type)) this.byType.set(r.type, []);
        this.byType.get(r.type).push(r);
      }
      this.ready = true;
      this.error = null;
    } catch (e) {
      this.ready = false;
      this.error = e.message;
    }
    return this.ready;
  }

  of(type) { return this.byType.get(type) || []; }
  get(id) { return this.byId.get(id) || null; }

  count(type) {
    const c = this.counts;
    if (type === 'workspace') return (c.workspaces_active || 0) + (c.workspaces_archived || 0);
    return c[`${type}s`] != null ? c[`${type}s`] : this.of(type).length;
  }

  /** Everything pointing at, or pointed at by, a record — typed and titled. */
  related(rec) {
    if (!rec) return [];
    const out = [];
    const push = (label, ids) => {
      for (const id of ids || []) {
        const r = this.get(id);
        if (r) out.push({ label, rec: r });
      }
    };
    const bl = this.backlinks;
    if (rec.type === 'note') {
      push('Concept', rec.concepts);
      push('Source', rec.sources);
      push('Workspace', rec.contexts);
      push('Supersedes', rec.supersedes);
    } else if (rec.type === 'concept') {
      push('Note', (bl.concept_to_notes || {})[rec.id]);
      const cr = (bl.concept_relations || {})[rec.id] || {};
      for (const e of cr.outgoing || []) {
        const r = this.get(e.to);
        if (r) out.push({ label: titleCase(e.type), rec: r });
      }
      for (const e of cr.incoming || []) {
        const r = this.get(e.from);
        if (r) out.push({ label: `${titleCase(e.type)} ←`, rec: r });
      }
    } else if (rec.type === 'source') {
      push('Note', (bl.source_to_notes || {})[rec.id]);
      for (const col of this.of('collection')) {
        if ((col.sources || []).includes(rec.id)) out.push({ label: 'Collection', rec: col });
      }
    } else if (rec.type === 'module') {
      push('Workspace', (bl.module_to_workspaces || {})[rec.id]);
    } else if (rec.type === 'workspace') {
      push('Note', rec.notes);
      push('Concept', rec.concepts);
      push('Source', rec.sources);
    } else if (rec.type === 'collection') {
      push('Source', rec.sources);
    }
    return out;
  }

  /** Two-pass search: literal tokens first (precise — this is what makes the
   *  explorer a filter rather than a suggestion box), subsequence only if
   *  that found nothing, so a typo degrades to "close enough" not "empty". */
  search(query, types) {
    const pool = types && types.length
      ? types.flatMap((t) => this.of(t))
      : this.records;
    const q = String(query || '').trim().toLowerCase();
    if (!q) return pool.filter((r) => r.type !== 'coordination');
    const tokens = q.split(/\s+/).filter(Boolean);
    const strict = [];
    const loose = [];
    for (const r of pool) {
      if (r.type === 'coordination') continue;
      const hay = [r.title, r.id, ...(r.aliases || []), ...(r.authors || []),
        r.organization, r.domain].filter(Boolean).join(' ');
      const s = tokenScore(tokens, hay);
      if (s > 0) strict.push({ rec: r, score: s });
      else {
        const f = fuzzyScore(q, hay);
        if (f > 0) loose.push({ rec: r, score: f });
      }
    }
    const hits = strict.length ? strict : loose;
    hits.sort((a, b) => b.score - a.score
      || String(a.rec.title).localeCompare(String(b.rec.title)));
    return hits.map((h) => h.rec);
  }
}

/* =====================================================================
 * shared UI atoms (design system — see DESIGN.md)
 * ================================================================== */

function icon(parent, name, cls) {
  const el = parent.createSpan({ cls: cls || 'los-icon' });
  try { setIcon(el, name); } catch (e) { el.remove(); return null; }
  return el;
}

function badge(parent, text, variant) {
  return parent.createSpan({
    cls: `los-badge${variant ? ` los-badge--${variant}` : ''}`,
    text: String(text),
  });
}

function button(parent, label, iconName, opts = {}) {
  const b = parent.createEl('button', {
    cls: `los-btn${opts.cta ? ' los-btn--cta' : ''}${opts.quiet ? ' los-btn--quiet' : ''}`,
  });
  if (iconName) icon(b, iconName, 'los-btn-icon');
  if (label) b.createSpan({ text: label });
  if (opts.onClick) b.addEventListener('click', opts.onClick);
  if (opts.tooltip) b.setAttr('aria-label', opts.tooltip);
  return b;
}

function emptyState(parent, title, hint) {
  const e = parent.createDiv({ cls: 'los-empty' });
  e.createDiv({ cls: 'los-empty-title', text: title });
  if (hint) e.createDiv({ cls: 'los-empty-hint', text: hint });
  return e;
}

function section(parent, title, action) {
  const head = parent.createDiv({ cls: 'los-section' });
  head.createEl('h3', { cls: 'los-section-title', text: title });
  if (action) {
    const a = head.createSpan({ cls: 'los-section-action is-clickable', text: action.label });
    a.addEventListener('click', action.onClick);
  }
  return parent;
}

/** A typed, clickable reference to another record — the anti-link-dump atom. */
function entityChip(parent, rec, onOpen, label) {
  const c = parent.createDiv({ cls: `los-chip los-t-${rec.type} is-clickable` });
  icon(c, (TYPE_META[rec.type] || {}).icon || 'circle', 'los-chip-icon');
  c.createSpan({ cls: 'los-chip-text', text: rec.title || rec.id });
  if (label) c.createSpan({ cls: 'los-chip-label', text: label });
  c.addEventListener('click', (ev) => { ev.stopPropagation(); onOpen(rec); });
  return c;
}

/* =====================================================================
 * Explorer — master/detail over the manifest
 * ================================================================== */

const KINDS = {
  workspace: {
    facets: [{ key: 'status', label: 'Status' }],
    sub: (r) => r.next_action || r.objective || '',
  },
  note: {
    facets: [
      { key: 'domain', label: 'Domain' },
      { key: 'state', label: 'State' },
      { key: 'role', label: 'Role' },
    ],
    sub: (r) => r.summary || '',
  },
  concept: { facets: [], sub: (r) => (r.aliases || []).join(' · ') },
  source: {
    facets: [
      { key: 'source_type', label: 'Kind' },
      { key: 'roles', label: 'Good for', multi: true },
    ],
    sub: (r) => [(r.authors || []).join(', '), r.year].filter(Boolean).join(' · '),
  },
  module: { facets: [{ key: 'status', label: 'Status' }], sub: (r) => r.institution || '' },
  collection: { facets: [], sub: (r) => `${(r.sources || []).length} sources` },
};

class ExplorerView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.kind = 'source';
    this.query = '';
    this.facets = {};
    this.selected = null;
    this.history = [];
  }

  getViewType() { return VIEW_EXPLORER; }
  getIcon() { return 'compass'; }
  getDisplayText() {
    return `LearningOS · ${(TYPE_META[this.kind] || {}).plural || 'Browse'}`;
  }

  getState() {
    return { kind: this.kind, query: this.query, selected: this.selected };
  }
  async setState(state, result) {
    if (state && state.kind) this.kind = state.kind;
    if (state && state.query != null) this.query = state.query;
    if (state && state.selected !== undefined) this.selected = state.selected;
    await this.render();
    return super.setState ? super.setState(state, result) : undefined;
  }

  async onOpen() { await this.render(); }
  onClose() { return Promise.resolve(); }

  show(kind, opts = {}) {
    this.kind = kind;
    this.query = opts.query != null ? opts.query : '';
    this.facets = opts.facets || {};
    this.selected = opts.selected || null;
    this.history = [];
    this.render();
  }

  open(rec) {
    if (!rec) return;
    if (rec.type === 'note' || rec.type === 'workspace') {
      /* files are the editor's job — open them, don't reimplement an editor */
      this.plugin.openVaultPath(rec.path);
      return;
    }
    if (this.selected) this.history.push({ kind: this.kind, id: this.selected });
    this.kind = rec.type;
    this.selected = rec.id;
    this.render();
  }

  back() {
    const prev = this.history.pop();
    if (!prev) { this.selected = null; this.render(); return; }
    this.kind = prev.kind;
    this.selected = prev.id;
    this.render();
  }

  /* -------------------------------------------------------- filtering */

  facetValues(key) {
    const vals = new Map();
    for (const r of this.plugin.store.of(this.kind)) {
      const v = r[key];
      for (const one of Array.isArray(v) ? v : [v]) {
        if (one == null || one === '') continue;
        vals.set(String(one), (vals.get(String(one)) || 0) + 1);
      }
    }
    return [...vals.entries()].sort((a, b) => b[1] - a[1]);
  }

  results() {
    const store = this.plugin.store;
    let list = this.query
      ? store.search(this.query, [this.kind])
      : store.of(this.kind).slice();
    for (const [key, want] of Object.entries(this.facets)) {
      if (!want) continue;
      list = list.filter((r) => {
        const v = r[key];
        return Array.isArray(v) ? v.map(String).includes(want) : String(v) === want;
      });
    }
    if (!this.query) {
      list.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
    }
    return list;
  }

  /* ----------------------------------------------------------- render */

  async render() {
    const el = this.contentEl;
    el.empty();
    el.addClass('los-root', 'los-explorer');
    const store = this.plugin.store;

    if (!store.ready) {
      this.plugin.renderStoreError(el);
      return;
    }

    /* --- toolbar: kind tabs + search ------------------------------- */
    const bar = el.createDiv({ cls: 'los-toolbar' });
    const tabs = bar.createDiv({ cls: 'los-tabs' });
    for (const kind of Object.keys(KINDS)) {
      const meta = TYPE_META[kind] || {};
      const t = tabs.createDiv({
        cls: `los-tab is-clickable${kind === this.kind ? ' is-active' : ''}`,
      });
      icon(t, meta.icon, 'los-tab-icon');
      t.createSpan({ text: meta.plural || kind });
      t.createSpan({ cls: 'los-tab-count', text: String(store.of(kind).length) });
      t.addEventListener('click', () => {
        this.kind = kind;
        this.facets = {};
        this.selected = null;
        this.history = [];
        this.render();
      });
    }

    const searchWrap = bar.createDiv({ cls: 'los-search' });
    icon(searchWrap, 'search', 'los-search-icon');
    const input = searchWrap.createEl('input', {
      cls: 'los-search-input',
      attr: { type: 'text', placeholder: `Search ${(TYPE_META[this.kind] || {}).plural || ''}…` },
    });
    input.value = this.query;
    input.addEventListener('input', () => {
      this.query = input.value;
      this.renderResults();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { input.value = ''; this.query = ''; this.renderResults(); }
    });
    button(bar, 'Search note contents', 'scan-search', {
      quiet: true, onClick: () => this.plugin.openFullTextSearch(),
      tooltip: 'Open Omnisearch for full-text and OCR search',
    });

    /* --- facet row -------------------------------------------------- */
    const kindDef = KINDS[this.kind] || { facets: [] };
    if (kindDef.facets.length) {
      const facetBar = el.createDiv({ cls: 'los-facets' });
      for (const f of kindDef.facets) {
        const group = facetBar.createDiv({ cls: 'los-facet-group' });
        group.createSpan({ cls: 'los-facet-label', text: f.label });
        const all = group.createSpan({
          cls: `los-facet is-clickable${this.facets[f.key] ? '' : ' is-active'}`,
          text: 'All',
        });
        all.addEventListener('click', () => {
          delete this.facets[f.key];
          this.render();
        });
        for (const [value, n] of this.facetValues(f.key)) {
          const chipEl = group.createSpan({
            cls: `los-facet is-clickable${this.facets[f.key] === value ? ' is-active' : ''}`,
          });
          chipEl.createSpan({ text: titleCase(value) });
          chipEl.createSpan({ cls: 'los-facet-count', text: String(n) });
          chipEl.addEventListener('click', () => {
            if (this.facets[f.key] === value) delete this.facets[f.key];
            else this.facets[f.key] = value;
            this.render();
          });
        }
      }
    }

    /* --- split: results | detail ------------------------------------ */
    const split = el.createDiv({ cls: 'los-split' });
    this.listEl = split.createDiv({ cls: 'los-list' });
    this.detailEl = split.createDiv({ cls: 'los-detail' });
    this.renderResults();
  }

  renderResults() {
    if (!this.listEl) return;
    const list = this.listEl;
    list.empty();
    const rows = this.results();

    const head = list.createDiv({ cls: 'los-list-head' });
    head.createSpan({
      text: `${rows.length} ${rows.length === 1 ? 'result' : 'results'}`,
    });
    if (this.query || Object.keys(this.facets).length) {
      const clear = head.createSpan({ cls: 'los-list-clear is-clickable', text: 'Clear' });
      clear.addEventListener('click', () => {
        this.query = '';
        this.facets = {};
        this.render();
      });
    }

    if (!rows.length) {
      emptyState(list, 'Nothing matches',
        'Try a shorter query, or clear the filters above.');
      this.renderDetail();
      return;
    }

    const kindDef = KINDS[this.kind] || {};
    for (const rec of rows.slice(0, 400)) {
      const row = list.createDiv({
        cls: `los-item is-clickable${rec.id === this.selected ? ' is-selected' : ''}`,
      });
      const iconName = rec.type === 'source'
        ? (SOURCE_TYPE_ICON[rec.source_type] || 'library')
        : (TYPE_META[rec.type] || {}).icon;
      icon(row, iconName, `los-item-icon los-t-${rec.type}`);
      const body = row.createDiv({ cls: 'los-item-body' });
      body.createDiv({ cls: 'los-item-title', text: rec.title || rec.id });
      const sub = kindDef.sub ? kindDef.sub(rec) : '';
      if (sub) body.createDiv({ cls: 'los-item-sub', text: sub });
      const marks = row.createDiv({ cls: 'los-item-marks' });
      if (rec.type === 'source') {
        if (rec.url) icon(marks, 'globe', 'los-mark');
        if (rec.material_exists) icon(marks, 'hard-drive', 'los-mark');
      }
      if (rec.type === 'workspace' && rec.status) badge(marks, rec.status, rec.status);
      if (rec.type === 'note' && rec.state) badge(marks, rec.state);
      row.addEventListener('click', () => {
        this.selected = rec.id;
        this.renderResults();
        this.renderDetail();
      });
      row.addEventListener('dblclick', () => this.open(rec));
    }
    if (rows.length > 400) {
      list.createDiv({ cls: 'los-list-more', text: `+${rows.length - 400} more — narrow the search` });
    }
    this.renderDetail();
  }

  renderDetail() {
    const d = this.detailEl;
    if (!d) return;
    d.empty();
    const store = this.plugin.store;
    const rec = this.selected ? store.get(this.selected) : null;
    if (!rec) {
      emptyState(d, 'Nothing selected',
        'Pick something on the left. Double-click opens notes and workspaces in the editor.');
      return;
    }

    /* header */
    const head = d.createDiv({ cls: 'los-detail-head' });
    if (this.history.length) {
      button(head, 'Back', 'arrow-left', { quiet: true, onClick: () => this.back() });
    }
    const meta = TYPE_META[rec.type] || {};
    const kicker = head.createDiv({ cls: 'los-kicker' });
    icon(kicker, meta.icon, 'los-kicker-icon');
    kicker.createSpan({ text: meta.label || rec.type });
    if (rec.type === 'source' && rec.source_type) {
      kicker.createSpan({ cls: 'los-kicker-sep', text: '·' });
      kicker.createSpan({ text: titleCase(rec.source_type) });
    }
    head.createEl('h2', { cls: 'los-detail-title', text: rec.title || rec.id });
    head.createDiv({ cls: 'los-detail-id', text: rec.id });

    /* actions */
    const actions = d.createDiv({ cls: 'los-detail-actions' });
    if (rec.type === 'source') {
      if (rec.url) {
        button(actions, 'Open online', 'globe', {
          cta: true, onClick: () => this.plugin.openUrl(rec.url),
        });
      }
      if (rec.material_exists) {
        button(actions, 'Open local copy', 'hard-drive', {
          onClick: () => this.plugin.openMaterial(rec.material_path),
        });
      }
    }
    if (rec.path && (rec.type === 'note' || rec.type === 'workspace')) {
      button(actions, rec.type === 'workspace' ? 'Open workspace' : 'Open note', 'file-text', {
        cta: true, onClick: () => this.plugin.openVaultPath(rec.path),
      });
    }
    if (rec.type === 'concept') {
      button(actions, 'Show in canvas', 'network', {
        onClick: () => this.plugin.openVaultPath(CANVAS),
      });
    }
    if (rec.type === 'module') {
      button(actions, 'Coordination view', 'calendar-days', {
        onClick: () => this.plugin.openVaultPath('generated/coordination-view.md'),
      });
    }
    button(actions, 'Copy id', 'clipboard-copy', {
      quiet: true,
      onClick: () => {
        try { navigator.clipboard.writeText(rec.id); new Notice(`Copied ${rec.id}`); }
        catch (e) { new Notice(rec.id); }
      },
    });
    button(actions, 'Registry file', 'file-code', {
      quiet: true, onClick: () => this.plugin.openVaultPath(rec.path),
    });

    /* facts grid */
    const facts = [];
    const add = (k, v) => { if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) facts.push([k, v]); };
    if (rec.type === 'source') {
      add('Authors', (rec.authors || []).join(', '));
      add('Organization', rec.organization);
      add('Year', rec.year);
      add('Good for', (rec.roles || []).map(titleCase).join(', '));
      add('Local copy', rec.material_exists ? rec.material_path
        : (rec.material ? `${rec.material} (offline)` : null));
      for (const [k, v] of Object.entries(rec.identifiers || {})) {
        add(IDENTIFIER_LABEL[String(k).toLowerCase()] || titleCase(k), v);
      }
    } else if (rec.type === 'note') {
      add('Domain', titleCase(rec.domain));
      add('State', titleCase(rec.state));
      add('Role', titleCase(rec.role));
      add('Authorship', titleCase(rec.authorship));
      add('Reviewed', rec.reviewed || 'never');
      add('Evidence', (rec.evidence || []).length ? `${rec.evidence.length} item(s)` : 'none');
    } else if (rec.type === 'workspace') {
      add('Status', titleCase(rec.status));
      add('Standing', rec.standing ? 'yes' : null);
      add('Deadline', rec.deadline ? `${rec.deadline} · ${shortDay(daysUntil(rec.deadline))}` : null);
      add('Archived', rec.archived ? 'yes' : null);
    } else if (rec.type === 'module') {
      add('Institution', rec.institution);
      add('Code', rec.code);
      add('Semester', rec.semester);
      add('Status', titleCase(rec.status));
      add('Credits', rec.credits);
      add('Grade', rec.grade);
      add('Exam type', titleCase((rec.examination || {}).type));
      add('Components', (rec.components || []).join(' · '));
    } else if (rec.type === 'concept') {
      add('Aliases', (rec.aliases || []).join(', '));
      add('Deprecated', rec.deprecated ? 'yes' : null);
    }
    if (facts.length) {
      const grid = d.createDiv({ cls: 'los-facts' });
      for (const [k, v] of facts) {
        const cell = grid.createDiv({ cls: 'los-fact' });
        cell.createDiv({ cls: 'los-fact-key', text: k });
        cell.createDiv({ cls: 'los-fact-value', text: String(v) });
      }
    }

    /* prose */
    const prose = [];
    if (rec.objective) prose.push(['Objective', rec.objective]);
    if (rec.next_action) prose.push(['Next action', rec.next_action]);
    if (rec.summary) prose.push(['Summary', rec.summary]);
    if ((rec.examination || {}).notes) prose.push(['Examination', rec.examination.notes]);
    for (const [k, v] of prose) {
      const block = d.createDiv({ cls: 'los-prose' });
      block.createDiv({ cls: 'los-prose-key', text: k });
      block.createDiv({ cls: 'los-prose-text', text: v });
    }

    /* attempts (modules) */
    if (rec.type === 'module' && (rec.attempts || []).length) {
      section(d, 'Attempts');
      const wrap = d.createDiv({ cls: 'los-rows' });
      for (const a of rec.attempts) {
        const row = wrap.createDiv({ cls: 'los-row' });
        row.createSpan({ cls: 'los-row-title', text: `Termin ${a.termin} · ${a.date || 'no date'}` });
        const marks = row.createSpan({ cls: 'los-row-meta' });
        if (a.result) badge(marks, a.result, a.result === 'passed' ? 'active' : undefined);
        if (a.grade) badge(marks, `grade ${a.grade}`);
      }
    }

    /* evaluations (sources) — the reason the catalogue existed. Registry
     * entries that carry only a role are scaffolding, not judgement: skip
     * them rather than printing a wall of identical empty cards. */
    if (rec.type === 'source') {
      const evals = (rec.evaluations || []).filter(
        (ev) => (ev.strengths || []).length || (ev.weaknesses || []).length || ev.verdict);
      if (evals.length) {
        section(d, 'How to use it');
        for (const ev of evals) {
          const card = d.createDiv({ cls: 'los-eval' });
          const roles = card.createDiv({ cls: 'los-eval-roles' });
          for (const r of ev.roles || []) badge(roles, titleCase(r), 'role');
          if (ev.verdict) card.createDiv({ cls: 'los-eval-verdict', text: ev.verdict });
          for (const s of ev.strengths || []) {
            const li = card.createDiv({ cls: 'los-eval-line los-eval-plus' });
            icon(li, 'plus', 'los-eval-icon');
            li.createSpan({ text: s });
          }
          for (const w of ev.weaknesses || []) {
            const li = card.createDiv({ cls: 'los-eval-line los-eval-minus' });
            icon(li, 'minus', 'los-eval-icon');
            li.createSpan({ text: w });
          }
        }
      }

      /* the reading plan: which section of this source covers what */
      const sections = [];
      for (const ev of rec.evaluations || []) {
        for (const s of ev.useful_sections || []) {
          sections.push({ ...s, concepts: ev.concepts || [] });
        }
      }
      if (sections.length) {
        section(d, `Where to look (${sections.length})`);
        const wrap = d.createDiv({ cls: 'los-toc' });
        for (const s of sections) {
          const row = wrap.createDiv({ cls: 'los-toc-row' });
          row.createDiv({ cls: 'los-toc-section', text: s.section });
          if (s.note) row.createDiv({ cls: 'los-toc-note', text: s.note });
          const cs = (s.concepts || []).map((id) => store.get(id)).filter(Boolean);
          if (cs.length) {
            const chips = row.createDiv({ cls: 'los-chips' });
            for (const c of cs) entityChip(chips, c, (x) => this.open(x));
          }
        }
      }
    }

    /* relations */
    const rel = store.related(rec);
    if (rel.length) {
      const groups = new Map();
      for (const { label, rec: r } of rel) {
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(r);
      }
      section(d, 'Connected');
      for (const [label, recs] of groups) {
        const g = d.createDiv({ cls: 'los-chipgroup' });
        g.createDiv({ cls: 'los-chipgroup-label', text: `${label} (${recs.length})` });
        const chips = g.createDiv({ cls: 'los-chips' });
        for (const r of recs) entityChip(chips, r, (x) => this.open(x));
      }
    } else {
      emptyState(d, 'No connections recorded',
        'Nothing in the registries points here yet.');
    }
  }
}

/* =====================================================================
 * Navigator — the left rail
 * ================================================================== */

class NavView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_NAV; }
  getIcon() { return 'compass'; }
  getDisplayText() { return 'LearningOS'; }
  async onOpen() { await this.render(); }
  onClose() { return Promise.resolve(); }

  async render() {
    const el = this.contentEl;
    el.empty();
    el.addClass('los-root', 'los-nav');
    const plugin = this.plugin;
    const store = plugin.store;

    const home = el.createDiv({ cls: 'los-nav-home is-clickable' });
    icon(home, 'layout-dashboard', 'los-nav-icon');
    home.createSpan({ text: 'Home' });
    home.addEventListener('click', () => plugin.openDashboard());

    const find = el.createDiv({ cls: 'los-nav-find is-clickable' });
    icon(find, 'search', 'los-nav-icon');
    find.createSpan({ text: 'Find anything…' });
    find.addEventListener('click', () => plugin.openFinder());

    if (!store.ready) {
      plugin.renderStoreError(el, true);
      return;
    }

    const group = (label) => el.createDiv({ cls: 'los-nav-group', text: label });
    const entry = (label, iconName, count, onClick) => {
      const e = el.createDiv({ cls: 'los-nav-item is-clickable' });
      icon(e, iconName, 'los-nav-icon');
      e.createSpan({ cls: 'los-nav-label', text: label });
      if (count != null) e.createSpan({ cls: 'los-nav-count', text: String(count) });
      e.addEventListener('click', onClick);
      return e;
    };

    group('Browse');
    for (const kind of Object.keys(KINDS)) {
      const meta = TYPE_META[kind] || {};
      entry(meta.plural || kind, meta.icon, store.of(kind).length,
        () => plugin.openExplorer(kind));
    }

    group('Queues');
    entry('Inbox', 'inbox', plugin.folderCount(INBOX), () => plugin.openVaultPath(INBOX));
    entry('Garden', 'sprout', plugin.folderCount('knowledge/garden'),
      () => plugin.openVaultPath('bases/garden.base'));
    const c = store.counts;
    entry('Unreviewed', 'circle-dashed',
      (c.notes || 0) - (c.notes_reviewed || 0), () => plugin.openExplorer('note'));

    group('Views');
    entry('Coordination', 'calendar-days', null,
      () => plugin.openVaultPath('generated/coordination-view.md'));
    entry('Concept canvas', 'network', null, () => plugin.openVaultPath(CANVAS));
    entry('Domain atlas', 'map', null, () => plugin.openVaultPath('generated/domain-atlas.md'));
    entry('Health', 'activity', null, () => plugin.openVaultPath('generated/reports/health.md'));
    entry('Reading room', 'book-open', null, () => plugin.openVaultPath(READING_ROOM));
    entry('Note shelves', 'library', null, () => plugin.openVaultPath('bases/notes.base'));

    group('Do');
    entry('Capture to inbox', 'inbox', null, () => plugin.capture());
    entry('Rebuild views', 'refresh-cw', null, () => plugin.rebuild());
    entry('Validate', 'shield-check', null, () => plugin.validateRepo());

    const active = store.of('workspace').filter((w) => !w.archived && w.status === 'active');
    if (active.length) {
      group('Active work');
      for (const w of active) {
        entry(w.title || w.id, 'briefcase', null, () => plugin.openVaultPath(w.path));
      }
    }
  }
}

/* =====================================================================
 * Dashboard — the home view
 * ================================================================== */

class DashboardView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_DASH; }
  getDisplayText() { return 'LearningOS'; }
  getIcon() { return 'layout-dashboard'; }
  async onOpen() { await this.render(); }
  onClose() { return Promise.resolve(); }

  recentNotes(n) {
    const store = this.plugin.store;
    return store.of('note')
      .map((r) => {
        const f = this.app.vault.getAbstractFileByPath(r.path);
        return { rec: r, file: f, mtime: f ? f.stat.mtime : 0 };
      })
      .filter((x) => x.file)
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 8);
  }

  async render() {
    const el = this.contentEl;
    el.empty();
    el.addClass('los-root', 'los-dash');
    const plugin = this.plugin;
    const store = plugin.store;

    /* header */
    const head = el.createDiv({ cls: 'los-head' });
    const title = head.createDiv();
    title.createEl('h1', { cls: 'los-h1', text: 'LearningOS' });
    title.createDiv({
      cls: 'los-muted',
      text: new Date().toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }),
    });
    const actions = head.createDiv({ cls: 'los-actions' });
    button(actions, 'Find', 'search', { onClick: () => plugin.openFinder() });
    button(actions, 'Capture', 'inbox', { cta: true, onClick: () => plugin.capture() });
    button(actions, 'Rebuild', 'refresh-cw', { onClick: () => plugin.rebuild() });
    button(actions, 'Validate', 'shield-check', { onClick: () => plugin.validateRepo() });

    if (!store.ready) {
      plugin.renderStoreError(el);
      return;
    }

    /* validation banner (the one thing that needs the CLI) */
    const v = plugin.lastStatus && plugin.lastStatus.validation;
    const banner = el.createDiv({ cls: 'los-banner' });
    if (v && v.ok) {
      banner.addClass('los-banner--ok');
      icon(banner, 'shield-check', 'los-banner-icon');
      banner.createSpan({ text: 'validation OK · 0 errors, 0 warnings' });
    } else if (v) {
      banner.addClass('los-banner--warn', 'is-clickable');
      icon(banner, 'shield-alert', 'los-banner-icon');
      banner.createSpan({ text: `validation: ${v.errors} error(s), ${v.warnings} warning(s) — open report` });
      banner.addEventListener('click',
        () => plugin.openVaultPath('generated/reports/validation-report.md'));
    } else {
      banner.addClass('los-banner--info');
      icon(banner, 'info', 'los-banner-icon');
      banner.createSpan({
        text: plugin.cliOk === false
          ? 'CLI offline — everything below is live from generated/. Rebuild and Validate need `make setup`.'
          : `Views generated ${store.generatedAt || '—'} · checking validation…`,
      });
    }

    /* hero */
    const spine = store.examSpine;
    if (spine.length) {
      const next = spine.find((e) => e.days >= 0) || spine[spine.length - 1];
      const hero = el.createDiv({ cls: 'los-hero is-clickable' });
      hero.addEventListener('click', () => plugin.openExplorer('module', { selected: next.module_id }));
      const left = hero.createDiv();
      left.createDiv({ cls: 'los-kicker', text: 'Next exam' });
      left.createDiv({ cls: 'los-hero-name', text: examShort(next.title) });
      left.createDiv({ cls: 'los-muted', text: `${next.date} · Termin ${next.termin} · ${next.title}` });
      const right = hero.createDiv({ cls: 'los-hero-count' });
      right.createDiv({
        cls: 'los-hero-days',
        text: String(Math.abs(next.days)),
      });
      right.createDiv({
        cls: 'los-hero-unit',
        text: next.days >= 0 ? (next.days === 1 ? 'day left' : 'days left') : 'days ago',
      });

      const rest = spine.filter((e) => e !== next);
      if (rest.length) {
        const tiles = el.createDiv({ cls: 'los-tiles' });
        for (const e of rest) {
          const t = tiles.createDiv({ cls: `los-tile is-clickable${e.days < 0 ? ' is-dim' : ''}` });
          t.createDiv({ cls: 'los-tile-days', text: shortDay(e.days) });
          t.createDiv({ cls: 'los-tile-name', text: examShort(e.title) });
          t.createDiv({ cls: 'los-muted', text: `${e.date} · Termin ${e.termin}` });
          t.addEventListener('click', () => plugin.openExplorer('module', { selected: e.module_id }));
        }
      }
    }

    /* stats — every one navigates somewhere */
    const c = store.counts;
    const stats = el.createDiv({ cls: 'los-stats' });
    const stat = (value, label, onClick) => {
      const s = stats.createDiv({ cls: 'los-stat is-clickable' });
      s.createDiv({ cls: 'los-stat-value', text: String(value) });
      s.createDiv({ cls: 'los-stat-label', text: label });
      s.addEventListener('click', onClick);
    };
    stat(c.notes || 0, 'notes', () => plugin.openExplorer('note'));
    stat(c.concepts || 0, 'concepts', () => plugin.openExplorer('concept'));
    stat(c.sources || 0, 'sources', () => plugin.openExplorer('source'));
    stat(c.relations || 0, 'relations', () => plugin.openVaultPath(CANVAS));
    stat(plugin.folderCount(INBOX), 'in inbox', () => plugin.openVaultPath(INBOX));
    stat((c.notes || 0) - (c.notes_reviewed || 0), 'unreviewed',
      () => plugin.openExplorer('note'));

    /* two columns */
    const cols = el.createDiv({ cls: 'los-cols' });
    const main = cols.createDiv({ cls: 'los-col-main' });
    const side = cols.createDiv({ cls: 'los-col-side' });

    section(main, 'Continue where I stopped', {
      label: 'All workspaces',
      onClick: () => plugin.openExplorer('workspace'),
    });
    const ws = store.of('workspace')
      .filter((w) => !w.archived)
      .sort((a, b) => {
        const rank = (x) => (x.status === 'active' ? 0 : x.status === 'blocked' ? 2 : 1)
          + (x.standing ? 0.5 : 0);
        return rank(a) - rank(b) || String(a.title).localeCompare(String(b.title));
      });
    if (!ws.length) emptyState(main, 'No active workspaces', 'work/active/ is empty.');
    const grid = main.createDiv({ cls: 'los-grid' });
    for (const w of ws) {
      const card = grid.createDiv({
        cls: `los-card is-clickable los-s-${w.status || 'none'}${w.status !== 'active' ? ' is-dim' : ''}`,
      });
      card.createDiv({ cls: 'los-card-title', text: w.title || w.id });
      const marks = card.createDiv({ cls: 'los-badges' });
      if (w.status) badge(marks, w.status, w.status);
      if (w.standing) badge(marks, 'standing');
      if (w.deadline) badge(marks, `due ${w.deadline} · ${shortDay(daysUntil(w.deadline))}`);
      if (w.next_action) card.createDiv({ cls: 'los-card-next', text: w.next_action });
      const foot = card.createDiv({ cls: 'los-card-foot' });
      const counts = [
        (w.notes || []).length && `${w.notes.length} notes`,
        (w.concepts || []).length && `${w.concepts.length} concepts`,
        (w.sources || []).length && `${w.sources.length} sources`,
      ].filter(Boolean);
      foot.createSpan({ text: counts.join(' · ') || 'no linked records' });
      const detail = foot.createSpan({ cls: 'los-card-more is-clickable', text: 'details' });
      detail.addEventListener('click', (e) => {
        e.stopPropagation();
        plugin.openExplorer('workspace', { selected: w.id });
      });
      card.addEventListener('click', () => plugin.openVaultPath(w.path));
    }

    section(main, 'Recently changed notes', {
      label: 'Browse notes',
      onClick: () => plugin.openExplorer('note'),
    });
    const rows = main.createDiv({ cls: 'los-rows' });
    for (const r of this.recentNotes(8)) {
      const row = rows.createDiv({ cls: 'los-row is-clickable' });
      row.createSpan({ cls: 'los-row-title', text: r.rec.title || r.rec.id });
      const meta = row.createSpan({ cls: 'los-row-meta' });
      if (r.rec.domain) badge(meta, r.rec.domain);
      if (r.rec.state) badge(meta, r.rec.state);
      meta.createSpan({ cls: 'los-muted', text: relTime(r.mtime) });
      row.addEventListener('click', () => plugin.openVaultPath(r.rec.path));
    }

    /* side rail: what to open next, and the queues */
    section(side, 'Queues');
    const q = side.createDiv({ cls: 'los-rows' });
    const qrow = (label, n, onClick) => {
      const row = q.createDiv({ cls: 'los-row is-clickable' });
      row.createSpan({ cls: 'los-row-title', text: label });
      row.createSpan({ cls: 'los-row-meta', text: String(n) });
      row.addEventListener('click', onClick);
    };
    qrow('Inbox — operator routes', plugin.folderCount(INBOX),
      () => plugin.openVaultPath(INBOX));
    qrow('Garden — gestating', plugin.folderCount('knowledge/garden'),
      () => plugin.openVaultPath('bases/garden.base'));
    qrow('Notes without evidence',
      (c.notes || 0) - (c.notes_with_evidence || 0), () => plugin.openExplorer('note'));

    section(side, 'Reference shelf');
    const shelf = side.createDiv({ cls: 'los-chips' });
    const bookish = store.of('source')
      .filter((s) => s.material_exists)
      .sort((a, b) => String(a.title).localeCompare(String(b.title)))
      .slice(0, 8);
    for (const s of bookish) {
      entityChip(shelf, s, (rec) => plugin.openExplorer('source', { selected: rec.id }));
    }
    const more = side.createDiv({ cls: 'los-section-action is-clickable', text: 'All sources →' });
    more.addEventListener('click', () => plugin.openExplorer('source'));

    el.createDiv({
      cls: 'los-foot',
      text: `Presentation only — facts live in records/ + work/, knowledge in knowledge/. `
        + `Reading ${MANIFEST} (generated ${store.generatedAt || '—'}); `
        + 'buttons here are conveniences, never duties (WORKFLOWS §25).',
    });
  }
}

/* =====================================================================
 * Learning workflow app — focus first, library second
 * ================================================================== */

function currentStage(pathRec) {
  const stages = pathRec && pathRec.stages || [];
  return stages.find((s) => s.id === pathRec.current_stage)
    || stages.find((s) => s.status === 'active') || stages[0] || null;
}

function pathProgress(pathRec) {
  const stages = pathRec.stages || [];
  return { done: stages.filter((s) => s.status === 'complete').length, total: stages.length };
}

class LearningHomeView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_DASH; }
  getIcon() { return 'home'; }
  getDisplayText() { return 'LearningOS · Home'; }
  async onOpen() { await this.render(); }
  onClose() { return Promise.resolve(); }

  async render() {
    const el = this.contentEl;
    el.empty();
    el.addClass('los-root', 'los-home-v2');
    const store = this.plugin.store;
    if (!store.ready) { this.plugin.renderStoreError(el); return; }
    const top = el.createDiv({ cls: 'los-page-head' });
    const titles = top.createDiv();
    titles.createDiv({ cls: 'los-kicker', text: new Date().toLocaleDateString(undefined, {
      weekday: 'long', day: 'numeric', month: 'long',
    }) });
    titles.createEl('h1', { text: 'Continue learning' });
    button(top, 'New path with AI', 'sparkles', {
      onClick: () => this.plugin.askAi('[LearningOS approved operational write] Create a focused learning path for the subtopic in my active file or selection. If that context does not identify a subtopic, return one concise question and do not write yet. Otherwise write a workspace-owned path YAML that follows system/schema/learning-path.schema.json, validate, and regenerate.'),
    });

    const paths = store.of('learning-path').filter((p) => !p.archived
      && ['active', 'paused', 'ready-to-shelve'].includes(p.status));
    const pathRec = paths.find((p) => p.status === 'active') || paths[0];
    if (!pathRec) {
      const empty = el.createDiv({ cls: 'los-focus-card' });
      emptyState(empty, 'No active learning path',
        'Ask AI to turn a lecture, job topic, or question into an ordered set of stages.');
      button(empty, 'Create path with AI', 'sparkles', { cta: true,
        onClick: () => this.plugin.askAi('[LearningOS approved operational write] Create a learning path for the subtopic in my active file or selection. If no subtopic is identifiable, ask one concise question and do not write.') });
      return;
    }

    const progress = pathProgress(pathRec);
    const stage = currentStage(pathRec);
    const card = el.createDiv({ cls: 'los-focus-card' });
    const identity = card.createDiv({ cls: 'los-focus-main' });
    identity.createDiv({ cls: 'los-kicker', text: `${titleCase(pathRec.area)} · ${pathRec.workspace_id}` });
    identity.createEl('h2', { text: pathRec.title });
    if (pathRec.objective) identity.createEl('p', { cls: 'los-focus-objective', text: pathRec.objective });
    const meter = identity.createDiv({ cls: 'los-progress', attr: {
      role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(progress.total),
      'aria-valuenow': String(progress.done),
    } });
    const fill = meter.createDiv({ cls: 'los-progress-fill' });
    fill.style.width = `${progress.total ? (progress.done / progress.total) * 100 : 0}%`;
    identity.createDiv({ cls: 'los-muted', text: `${progress.done} of ${progress.total} stages complete` });
    const resume = card.createDiv({ cls: 'los-resume-card' });
    resume.createDiv({ cls: 'los-kicker', text: pathRec.status === 'ready-to-shelve' ? 'Ready to shelve' : 'Resume here' });
    resume.createEl('h3', { text: stage ? stage.title : pathRec.title });
    if (stage) resume.createEl('p', { text: stage.objective });
    button(resume, pathRec.status === 'ready-to-shelve' ? 'Review shelving' : 'Resume stage',
      pathRec.status === 'ready-to-shelve' ? 'archive-restore' : 'play', { cta: true,
        onClick: () => pathRec.status === 'ready-to-shelve'
          ? this.plugin.openShelve(pathRec.id) : this.plugin.openPath(pathRec.id) });

    const summary = el.createDiv({ cls: 'los-home-summary' });
    const notes = (pathRec.stages || []).filter((s) => (s.notes_text || '').trim()).length;
    const info = [
      ['Working notes', `${notes} stage note${notes === 1 ? '' : 's'}`, 'sticky-note',
        () => this.plugin.openPath(pathRec.id)],
      ['Ready to shelve', pathRec.status === 'ready-to-shelve' || (pathRec.shelving || {}).state === 'proposed'
        ? 'Proposal needs your review' : 'Nothing waiting', 'archive-restore',
        () => this.plugin.openShelve(pathRec.id)],
      ['Job area', 'Separate and hidden by default', 'shield', () => this.plugin.openJobBoundary()],
    ];
    for (const [label, value, iconName, action] of info) {
      const item = summary.createDiv({ cls: 'los-summary-card is-clickable' });
      icon(item, iconName);
      item.createEl('h3', { text: label });
      item.createEl('p', { text: value });
      item.addEventListener('click', action);
    }
  }
}

class LearningPathView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf); this.plugin = plugin; this.pathId = null; this.stageId = null;
  }
  getViewType() { return VIEW_PATH; }
  getIcon() { return 'route'; }
  getDisplayText() { return 'LearningOS · Learning path'; }
  async onOpen() { await this.render(); }
  onClose() { return Promise.resolve(); }
  show(pathId, stageId) { this.pathId = pathId; this.stageId = stageId || null; this.render(); }

  pathRecord() {
    const store = this.plugin.store;
    return store.get(this.pathId) || store.of('learning-path').find((p) => p.status === 'active')
      || store.of('learning-path')[0] || null;
  }

  async render() {
    const el = this.contentEl;
    el.empty(); el.addClass('los-root', 'los-path-view');
    if (!this.plugin.store.ready) { this.plugin.renderStoreError(el); return; }
    const pathRec = this.pathRecord();
    if (!pathRec) { emptyState(el, 'No learning path', 'Create one with AI from Home.'); return; }
    this.pathId = pathRec.id;
    const stages = pathRec.stages || [];
    let stage = stages.find((s) => s.id === this.stageId) || currentStage(pathRec);
    if (!stage) { emptyState(el, 'This path has no stages', 'Ask AI to repair the path.'); return; }
    this.stageId = stage.id;

    const head = el.createDiv({ cls: 'los-page-head' });
    const title = head.createDiv();
    title.createDiv({ cls: 'los-kicker', text: `${titleCase(pathRec.area)} · ${pathRec.workspace_id}` });
    title.createEl('h1', { text: pathRec.title });
    button(head, 'Ask AI about this stage', 'sparkles', {
      onClick: () => this.plugin.askAi(`Help me with ${pathRec.id}, stage ${stage.id}. Read the path through los inspect, keep the answer scoped to this stage, and preserve my working notes.`),
    });

    const layout = el.createDiv({ cls: 'los-path-layout' });
    const rail = layout.createDiv({ cls: 'los-stage-rail' });
    stages.forEach((s, index) => {
      const row = rail.createEl('button', { cls: `los-stage-row${s.id === stage.id ? ' is-active' : ''}` });
      row.createSpan({ cls: 'los-stage-mark', text: s.status === 'complete' ? '✓' : `${index + 1}` });
      row.createSpan({ text: s.title });
      row.addEventListener('click', () => { this.stageId = s.id; this.render(); });
    });

    const work = layout.createDiv({ cls: 'los-stage-work' });
    const meta = [
      `Stage ${stages.indexOf(stage) + 1}`,
      stage.estimate_minutes ? `about ${stage.estimate_minutes} min` : null,
      stage.exam_critical ? 'exam-critical' : null,
    ].filter(Boolean).join(' · ');
    work.createDiv({ cls: 'los-kicker', text: meta });
    work.createEl('h2', { text: stage.title });
    work.createEl('p', { cls: 'los-stage-objective', text: stage.objective });
    for (const resource of stage.resources || []) {
      const r = work.createDiv({ cls: 'los-resource-row is-clickable' });
      r.createSpan({ cls: 'los-resource-kind', text: titleCase(resource.kind) });
      const body = r.createDiv();
      body.createDiv({ cls: 'los-resource-title', text: resource.label });
      if (resource.locator) body.createDiv({ cls: 'los-muted', text: resource.locator });
      r.addEventListener('click', () => this.plugin.openPathResource(resource));
    }
    const done = work.createDiv({ cls: 'los-done-when' });
    done.createDiv({ cls: 'los-kicker', text: 'Done when' });
    for (const criterion of stage.done_when || []) done.createEl('p', { text: criterion });
    const actions = work.createDiv({ cls: 'los-actions' });
    if (stage.status === 'active') {
      button(actions, 'Complete stage', 'check', { cta: true,
        onClick: () => this.plugin.progressPath(pathRec.id, stage.id, 'complete') });
      button(actions, 'Skip for now', 'skip-forward', {
        onClick: () => this.plugin.progressPath(pathRec.id, stage.id, 'skipped') });
    } else {
      button(actions, stage.status === 'complete' ? 'Revisit stage' : 'Start stage',
        stage.status === 'complete' ? 'rotate-ccw' : 'play', { cta: true,
          onClick: () => this.plugin.progressPath(pathRec.id, stage.id, 'active') });
    }
    button(actions, 'I found a gap', 'circle-help', { onClick: () => this.plugin.askAi(
      `I found a gap while working on ${pathRec.id}, stage ${stage.id}. Ask me what is missing, then propose the smallest prerequisite detour without expanding the whole path.`) });

    const notes = layout.createDiv({ cls: 'los-stage-notes' });
    notes.createDiv({ cls: 'los-kicker', text: 'Working note · saved to this stage' });
    notes.createEl('h2', { text: 'My reasoning' });
    const textarea = notes.createEl('textarea', { cls: 'los-note-editor', attr: {
      placeholder: 'Write the explanation, attempt, uncertainty, or correction here…',
      'aria-label': `Working notes for ${stage.title}`,
    } });
    textarea.value = stage.notes_text || '';
    button(notes, 'Save note', 'save', { cta: true, onClick: () =>
      this.plugin.saveStageNote(pathRec.id, stage.id, textarea.value) });
    button(notes, 'Attach handwriting', 'paperclip', { onClick: () =>
      this.plugin.attachStageFile(pathRec.id, stage.id) });
    for (const attachment of stage.attachments || []) {
      const linked = notes.createEl('button', { cls: 'los-attachment-link' });
      icon(linked, 'file-scan'); linked.createSpan({ text: attachment.label });
      linked.addEventListener('click', () => this.plugin.openVaultPath(attachment.path));
    }
    notes.createEl('p', { cls: 'los-muted', text: 'No concept ID or destination needed yet. Shelving happens later.' });
  }
}

class ShelveReviewView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.pathId = null; }
  getViewType() { return VIEW_SHELVE; }
  getIcon() { return 'archive-restore'; }
  getDisplayText() { return 'LearningOS · Shelve review'; }
  async onOpen() { await this.render(); }
  onClose() { return Promise.resolve(); }
  show(pathId) { this.pathId = pathId || null; this.render(); }
  async render() {
    const el = this.contentEl;
    el.empty(); el.addClass('los-root', 'los-shelve-view');
    if (!this.plugin.store.ready) { this.plugin.renderStoreError(el); return; }
    const pathRec = this.plugin.store.get(this.pathId)
      || this.plugin.store.of('learning-path').find((p) => p.status === 'ready-to-shelve')
      || this.plugin.store.of('learning-path')[0];
    if (!pathRec) { emptyState(el, 'Nothing to shelve', 'Finish a learning path first.'); return; }
    this.pathId = pathRec.id;
    const shelving = pathRec.shelving || {};
    const head = el.createDiv({ cls: 'los-page-head' });
    const titles = head.createDiv();
    titles.createDiv({ cls: 'los-kicker', text: 'AI proposal · original wording preserved' });
    titles.createEl('h1', { text: `Shelve ${pathRec.title}` });
    if (shelving.state !== 'proposed' || !(shelving.items || []).length) {
      const empty = el.createDiv({ cls: 'los-focus-card' });
      emptyState(empty, 'No shelving proposal yet',
        'AI will inspect every stage note and propose durable notes, Garden items, links, and the path archive. Nothing canonical changes at this step.');
      button(empty, 'Ask AI to prepare proposal', 'sparkles', { cta: true,
        onClick: () => this.plugin.askAi(`[LearningOS approved operational write] Prepare a shelving proposal for ${pathRec.id}. Follow system/OPERATOR.md: preserve my wording, write only the proposal into the path shelving block, validate, regenerate, and do not apply canonical changes.`) });
      return;
    }
    if (shelving.summary) el.createEl('p', { cls: 'los-shelve-summary', text: shelving.summary });
    const choices = [];
    for (const item of shelving.items) {
      const row = el.createEl('label', { cls: 'los-proposal-row' });
      const check = row.createEl('input', { attr: { type: 'checkbox' } });
      check.checked = item.selected !== false;
      const body = row.createDiv();
      body.createEl('strong', { text: item.title });
      body.createEl('p', { text: item.rationale });
      body.createDiv({ cls: 'los-muted', text: `${titleCase(item.kind)} · ${item.destination}` });
      if (item.diff) body.createEl('pre', { cls: 'los-proposal-diff', text: item.diff });
      choices.push([item.id, check]);
    }
    const validation = el.createDiv({ cls: 'los-validation-preview' });
    validation.createEl('strong', { text: 'Approval gate' });
    validation.createEl('p', { text: 'Selected changes will be sent back to AI for a reviewable apply → validate → regenerate transaction.' });
    const actions = el.createDiv({ cls: 'los-actions los-actions--end' });
    button(actions, 'Send corrections to AI', 'message-square', { onClick: () =>
      this.plugin.askAi(`Revise the shelving proposal for ${pathRec.id}. Ask me for corrections before changing the proposal.`) });
    button(actions, 'Approve selected changes', 'check-check', { cta: true, onClick: () => {
      const selected = choices.filter(([, c]) => c.checked).map(([id]) => id);
      this.plugin.askAi(`[LearningOS approved shelving apply] I explicitly approve these shelving proposal items for ${pathRec.id}: ${selected.join(', ')}. Apply only those items, show diffs, validate, regenerate, and archive the path only if all approved durable outputs exist.`);
    } });
  }
}

class JobBoundaryView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_JOB; }
  getIcon() { return 'shield'; }
  getDisplayText() { return 'LearningOS · Job area'; }
  async onOpen() { await this.render(); }
  onClose() { return Promise.resolve(); }
  async render() {
    const el = this.contentEl;
    el.empty(); el.addClass('los-root', 'los-job-boundary');
    el.createDiv({ cls: 'los-kicker', text: 'Separate area · quarantine preserved' });
    el.createEl('h1', { text: 'Job learning' });
    el.createEl('p', { text: 'Job material is deliberately not indexed, searched, or mixed into the university library. Open it only for an explicit job task.' });
    const row = el.createDiv({ cls: 'los-actions' });
    button(row, 'Open Job folder', 'folder-open', { cta: true, onClick: () => this.plugin.openJobFolder() });
    button(row, 'Ask AI for a Job path', 'sparkles', { onClick: () => this.plugin.askAi(
      '[LearningOS approved Job task] This is an explicit Job-area task. Use my active file or selection as the subtopic; if it is unclear, ask one question and do not write. Operate only inside the quarantined Job workspace for this task. Do not import it into LearningOS unless I explicitly approve promotion.') });
  }
}

class AppNavView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_NAV; }
  getIcon() { return 'panel-left'; }
  getDisplayText() { return 'LearningOS'; }
  async onOpen() { await this.render(); }
  onClose() { return Promise.resolve(); }
  async render() {
    const el = this.contentEl;
    el.empty(); el.addClass('los-root', 'los-app-nav');
    const brand = el.createDiv({ cls: 'los-nav-brand' });
    brand.createDiv({ cls: 'los-brand-mark', text: 'L' });
    brand.createEl('strong', { text: 'LearningOS' });
    const nav = (label, iconName, action) => {
      const item = el.createEl('button', { cls: 'los-app-nav-item' });
      icon(item, iconName); item.createSpan({ text: label }); item.addEventListener('click', action);
      return item;
    };
    nav('Home', 'home', () => this.plugin.openDashboard());
    nav('Learning path', 'route', () => this.plugin.openPath());
    nav('Shelve review', 'archive-restore', () => this.plugin.openShelve());
    nav('Library', 'library', () => this.plugin.openExplorer('note'));
    el.createDiv({ cls: 'los-nav-label', text: 'Areas' });
    nav('University', 'graduation-cap', () => this.plugin.openDashboard());
    nav('Job', 'shield', () => this.plugin.openJobBoundary());
    const foot = el.createDiv({ cls: 'los-nav-foot' });
    button(foot, 'Ask AI', 'sparkles', { cta: true, onClick: () => this.plugin.askAi(
      'Open with python tools/los.py bootstrap, then ask what I want to learn or organize.') });
  }
}

/* =====================================================================
 * Finder — fuzzy over everything
 * ================================================================== */

class FinderModal extends SuggestModal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.setPlaceholder('Find a note, concept, source, module or workspace…');
    if (this.setInstructions) {
      this.setInstructions([
        { command: '↵', purpose: 'open' },
        { command: 'esc', purpose: 'dismiss' },
      ]);
    }
  }
  getSuggestions(query) {
    return this.plugin.store.search(query).slice(0, 60);
  }
  renderSuggestion(rec, el) {
    el.addClass('los-suggest');
    const meta = TYPE_META[rec.type] || {};
    icon(el, rec.type === 'source'
      ? (SOURCE_TYPE_ICON[rec.source_type] || 'library') : meta.icon, `los-t-${rec.type}`);
    const body = el.createDiv({ cls: 'los-suggest-body' });
    body.createDiv({ cls: 'los-suggest-title', text: rec.title || rec.id });
    body.createDiv({ cls: 'los-suggest-sub', text: `${meta.label || rec.type} · ${rec.id}` });
  }
  onChooseSuggestion(rec) {
    if (rec.type === 'note' || rec.type === 'workspace') this.plugin.openVaultPath(rec.path);
    else if (rec.type === 'learning-path') this.plugin.openPath(rec.id);
    else this.plugin.openExplorer(rec.type, { selected: rec.id });
  }
}

/* =====================================================================
 * modals
 * ================================================================== */

class CaptureModal extends Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
    this.titleText = '';
    this.bodyText = '';
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('los-modal');
    contentEl.createEl('h3', { text: 'Capture to inbox' });
    contentEl.createEl('p', {
      text: 'Lands in work/inbox/ — no naming, no filing. The operator routes it.',
      cls: 'setting-item-description',
    });
    new Setting(contentEl).setName('Title (optional)').addText((t) =>
      t.onChange((v) => { this.titleText = v; }));
    const ta = contentEl.createEl('textarea');
    ta.rows = 8;
    ta.style.width = '100%';
    ta.placeholder = 'The thought, link, fragment…';
    ta.addEventListener('input', () => { this.bodyText = ta.value; });
    ta.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        this.close();
        this.onSubmit(this.titleText, this.bodyText);
      }
    });
    new Setting(contentEl)
      .addButton((b) => b.setButtonText('Capture').setCta().onClick(() => {
        this.close();
        this.onSubmit(this.titleText, this.bodyText);
      }))
      .addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()));
    contentEl.createEl('p', {
      text: '⌘/Ctrl + Enter to capture.', cls: 'setting-item-description',
    });
    window.setTimeout(() => ta.focus(), 20);
  }
  onClose() { this.contentEl.empty(); }
}

class StatusModal extends Modal {
  constructor(app, payload, store) { super(app); this.payload = payload; this.store = store; }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('los-modal');
    contentEl.createEl('h3', { text: 'LearningOS status' });
    const p = this.payload;
    const c = (p && p.counts) || (this.store && this.store.counts) || {};
    const v = (p && p.validation) || null;
    const lines = [
      `notes ${c.notes} · concepts ${c.concepts} · relations ${c.relations || c.concept_relations} · sources ${c.sources}`,
      `workspaces ${c.workspaces_active || c.active_workspaces} active · inbox ${c.inbox_items != null ? c.inbox_items : '—'} · garden ${c.garden_notes != null ? c.garden_notes : '—'}`,
      v ? `validation: ${v.ok ? 'OK (0/0)' : `${v.errors} error(s), ${v.warnings} warning(s)`}`
        : 'validation: CLI unavailable (counts read from generated/manifest.json)',
    ];
    for (const l of lines) contentEl.createEl('p', { text: l });
    const spine = (p && p.exam_spine) || (this.store && this.store.examSpine) || [];
    if (spine.length) {
      contentEl.createEl('h4', { text: 'Exam spine' });
      for (const e of spine) {
        contentEl.createEl('p', { text: `${e.date} — ${e.title} (Termin ${e.termin})` });
      }
    }
    contentEl.createEl('p', {
      text: 'Facts: records/modules.yaml · full dashboard: generated/coordination-view.md',
      cls: 'setting-item-description',
    });
  }
  onClose() { this.contentEl.empty(); }
}

/* =====================================================================
 * settings
 * ================================================================== */

class LearningOSSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h3', { text: 'LearningOS UI' });
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: 'Presentation only. Canonical data, validation and rules live in the '
        + 'LearningOS core (ADR-006); nothing here changes meaning.',
    });
    const toggle = (name, desc, key, after) => {
      new Setting(containerEl).setName(name).setDesc(desc).addToggle((t) =>
        t.setValue(this.plugin.settings[key]).onChange(async (v) => {
          this.plugin.settings[key] = v;
          await this.plugin.saveSettings();
          if (after) after(v);
        }));
    };
    toggle('Open dashboard on startup',
      'Make the dashboard the home view every time the vault opens.', 'openOnStartup');
    toggle('Pin the dashboard tab',
      'Home stays put — links open in new tabs instead of replacing it.',
      'pinDashboard', () => this.plugin.applyPin());
    toggle('Show the Navigator',
      'A LearningOS rail in the left sidebar instead of the raw file tree.',
      'showNavigator', (v) => (v ? this.plugin.openNav() : this.plugin.closeNav()));
    toggle('Collapse sidebars on startup',
      'Opens as an application rather than a file browser.', 'collapseSidebars');
    toggle('App chrome',
      'LearningOS styling for the window (home-tab accent, calmer chrome).',
      'appChrome', () => this.plugin.applyChrome());
    toggle('Open source links in Obsidian',
      'Uses the core Web Viewer when enabled; otherwise your browser.', 'webviewer');
    toggle('Live refresh',
      'Reload the projection and re-render when generated/ or work/ change.', 'liveRefresh');
  }
}

/* =====================================================================
 * plugin
 * ================================================================== */

module.exports = class LearningOSUI extends Plugin {
  /* ------------------------------------------------------------ paths */

  basePath() {
    const a = this.app.vault.adapter;
    return a && typeof a.getBasePath === 'function' ? a.getBasePath() : null;
  }

  python() {
    const base = this.basePath();
    if (base) {
      const venv = path.join(base, '.venv', 'bin', 'python');
      try { if (fs.existsSync(venv)) return venv; } catch (e) { /* sandboxed */ }
    }
    return 'python3';
  }

  runLos(args, cb) {
    const base = this.basePath();
    if (!base) { new Notice('LearningOS: vault is not on a filesystem'); return; }
    execFile(this.python(), ['tools/los.py', ...args], { cwd: base, timeout: 180000 },
      (err, stdout, stderr) => {
        this.cliOk = !err;
        cb(err, String(stdout || ''), String(stderr || ''));
      });
  }

  /* --------------------------------------------------------- settings */

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
  }
  async saveSettings() { await this.saveData(this.settings); }

  /* ------------------------------------------------------- open verbs */

  openVaultPath(p) {
    const f = this.app.vault.getAbstractFileByPath(p);
    if (!f) { new Notice(`${p} not found — try Rebuild views`); return; }
    if (f.children) {
      /* a folder: reveal it in the file explorer rather than failing */
      const first = f.children.find((c) => !c.children);
      if (first) this.app.workspace.getLeaf(false).openFile(first);
      else new Notice(`${p} is empty`);
      return;
    }
    this.app.workspace.getLeaf(false).openFile(f);
  }

  openUrl(url) {
    if (!url) return;
    const internal = this.app.internalPlugins;
    const wv = this.settings.webviewer && internal && internal.getPluginById
      ? internal.getPluginById('webviewer') : null;
    if (wv && wv.enabled) {
      const leaf = this.app.workspace.getLeaf(true);
      leaf.setViewState({ type: 'webviewer', state: { url, navigate: true }, active: true });
      this.app.workspace.revealLeaf(leaf);
      return;
    }
    try { window.open(url, '_blank'); } catch (e) { new Notice(url); }
  }

  openMaterial(relFromLearningOsRoot) {
    if (!relFromLearningOsRoot) return;
    const base = this.basePath();
    if (!base) { new Notice('Not on a filesystem'); return; }
    const abs = path.resolve(base, '..', relFromLearningOsRoot);
    try {
      /* eslint-disable-next-line global-require */
      const { shell } = require('electron');
      shell.openPath(abs);
    } catch (e) {
      new Notice(`Open it manually: ${abs}`);
    }
  }

  folderCount(p) {
    const folder = this.app.vault.getAbstractFileByPath(p);
    if (!folder || !folder.children) return 0;
    return folder.children.filter((c) => !c.name.startsWith('.')).length;
  }

  /* ------------------------------------------------------------ views */

  async openDashboard(opts) {
    const startup = !!(opts && opts.startup);
    const w = this.app.workspace;
    let leaf = w.getLeavesOfType(VIEW_DASH)[0];
    if (!leaf) {
      leaf = w.getLeaf(startup ? true : false);
      await leaf.setViewState({ type: VIEW_DASH, active: true });
    }
    if (this.settings.pinDashboard && typeof leaf.setPinned === 'function') leaf.setPinned(true);
    w.revealLeaf(leaf);
    w.setActiveLeaf(leaf, { focus: true });
    return leaf;
  }

  async openExplorer(kind, opts = {}) {
    const w = this.app.workspace;
    let leaf = w.getLeavesOfType(VIEW_EXPLORER)[0];
    if (!leaf) {
      leaf = w.getLeaf(true);
      await leaf.setViewState({ type: VIEW_EXPLORER, active: true });
    }
    w.revealLeaf(leaf);
    w.setActiveLeaf(leaf, { focus: true });
    if (leaf.view && leaf.view.show) leaf.view.show(kind || 'source', opts);
    return leaf;
  }

  async openPath(pathId, stageId) {
    const w = this.app.workspace;
    let leaf = w.getLeavesOfType(VIEW_PATH)[0];
    if (!leaf) {
      leaf = w.getLeaf(true);
      await leaf.setViewState({ type: VIEW_PATH, active: true });
    }
    w.revealLeaf(leaf); w.setActiveLeaf(leaf, { focus: true });
    if (leaf.view && leaf.view.show) leaf.view.show(pathId, stageId);
    return leaf;
  }

  async openShelve(pathId) {
    const w = this.app.workspace;
    let leaf = w.getLeavesOfType(VIEW_SHELVE)[0];
    if (!leaf) {
      leaf = w.getLeaf(true);
      await leaf.setViewState({ type: VIEW_SHELVE, active: true });
    }
    w.revealLeaf(leaf); w.setActiveLeaf(leaf, { focus: true });
    if (leaf.view && leaf.view.show) leaf.view.show(pathId);
    return leaf;
  }

  async openJobBoundary() {
    const w = this.app.workspace;
    let leaf = w.getLeavesOfType(VIEW_JOB)[0];
    if (!leaf) {
      leaf = w.getLeaf(true);
      await leaf.setViewState({ type: VIEW_JOB, active: true });
    }
    w.revealLeaf(leaf); w.setActiveLeaf(leaf, { focus: true });
    return leaf;
  }

  async openNav() {
    if (this.app.workspace.getLeavesOfType(VIEW_NAV).length) return;
    const leaf = this.app.workspace.getLeftLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_NAV, active: false });
  }

  closeNav() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_NAV)) leaf.detach();
  }

  openFinder() {
    if (!this.store.ready) { new Notice('Projection not loaded — run Rebuild views'); return; }
    new FinderModal(this.app, this).open();
  }

  openFullTextSearch() {
    const commands = this.app.commands;
    if (commands && commands.listCommands && commands.executeCommandById) {
      const target = commands.listCommands().find((c) => /omnisearch/i.test(`${c.id} ${c.name}`));
      if (target) { commands.executeCommandById(target.id); return; }
    }
    new Notice('Omnisearch is not active. Enable it in Settings → Community plugins.');
  }

  askAi(prompt) {
    const full = `LearningOS request\n\n${prompt}\n\nUse system/OPERATOR.md and the tools/los.py gateway. Do not scan Job unless this request explicitly says it is a Job-area task.`;
    try { navigator.clipboard.writeText(full); } catch (e) { /* best effort */ }
    const commands = this.app.commands;
    if (commands && commands.listCommands && commands.executeCommandById) {
      const available = commands.listCommands();
      const preferred = available.find((c) => /agentic.copilot/i.test(`${c.id} ${c.name}`))
        || available.find((c) => /copilot|ai chat|assistant/i.test(`${c.id} ${c.name}`));
      if (preferred) {
        commands.executeCommandById(preferred.id);
        new Notice('LearningOS prompt copied — paste it into the AI panel.');
        return;
      }
    }
    new Notice('AI prompt copied. Open Agentic Copilot and paste it; no files were changed.');
  }

  openPathResource(resource) {
    if (resource.url) { this.openUrl(resource.url); return; }
    if (resource.vault_path) { this.openVaultPath(resource.vault_path); return; }
    if (resource.source_id) {
      this.openExplorer('source', { selected: resource.source_id });
      return;
    }
    new Notice('This resource has no openable location yet.');
  }

  runLosPromise(args) {
    return new Promise((resolve, reject) => this.runLos(args, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || stdout || err.message).trim()));
      else resolve(stdout);
    }));
  }

  async saveStageNote(pathId, stageId, text) {
    try {
      await this.runLosPromise(['path-note', pathId, stageId, '--replace', '--text', text,
        '--expected-snapshot', this.store.snapshotId]);
      await this.reload();
      new Notice('Stage note saved ✓');
    } catch (e) {
      new Notice(`Save failed: ${e.message}`, 10000);
    }
  }

  async progressPath(pathId, stageId, status) {
    try {
      await this.runLosPromise(['path-progress', pathId, stageId, status,
        '--expected-snapshot', this.store.snapshotId]);
      await this.reload();
      new Notice(status === 'complete' ? 'Stage complete — next stage ready ✓' : 'Path updated ✓');
    } catch (e) {
      new Notice(`Progress update failed: ${e.message}`, 10000);
    }
  }

  attachStageFile(pathId, stageId) {
    if (!document.createElement) {
      new Notice('File picker unavailable in this environment.'); return;
    }
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'application/pdf,image/*';
    picker.addEventListener('change', async () => {
      const selected = picker.files && picker.files[0];
      if (!selected || !selected.path) { new Notice('Could not resolve the selected file.'); return; }
      try {
        await this.runLosPromise(['path-attach', pathId, stageId, '--file', selected.path,
          '--label', selected.name, '--expected-snapshot', this.store.snapshotId]);
        await this.reload();
        new Notice('Handwriting attached to this stage ✓');
      } catch (e) { new Notice(`Attachment failed: ${e.message}`, 10000); }
    });
    picker.click();
  }

  openJobFolder() {
    const base = this.basePath();
    if (!base) { new Notice('Job folder is available only in the desktop app.'); return; }
    const job = path.resolve(base, '..', '..', 'Job');
    try {
      const { shell } = require('electron');
      shell.openPath(job);
    } catch (e) { new Notice(`Open it manually: ${job}`); }
  }

  renderStoreError(el, compact) {
    const e = el.createDiv({ cls: 'los-empty los-empty--error' });
    e.createDiv({ cls: 'los-empty-title', text: 'Projection unavailable' });
    e.createDiv({
      cls: 'los-empty-hint',
      text: compact ? (this.store.error || '')
        : `${this.store.error || 'generated/manifest.json could not be read'}. `
          + 'The interface reads the OS through generated/ — rebuild it to continue.',
    });
    const row = e.createDiv({ cls: 'los-actions' });
    button(row, 'Rebuild views', 'refresh-cw', { cta: true, onClick: () => this.rebuild() });
    button(row, 'Retry', 'rotate-cw', { onClick: () => this.reload() });
  }

  rerenderAll() {
    for (const type of [VIEW_DASH, VIEW_NAV, VIEW_EXPLORER, VIEW_PATH, VIEW_SHELVE, VIEW_JOB]) {
      for (const leaf of this.app.workspace.getLeavesOfType(type)) {
        if (leaf.view && leaf.view.render) leaf.view.render();
      }
    }
  }

  async reload() {
    await this.store.load();
    this.rerenderAll();
    this.updateStatusBar();
  }

  scheduleReload() {
    if (!this.settings.liveRefresh) return;
    window.clearTimeout(this._reloadTimer);
    this._reloadTimer = window.setTimeout(() => this.reload(), RERENDER_DEBOUNCE_MS);
  }

  /* ---------------------------------------------------------- chrome */

  applyChrome() {
    document.body.classList.toggle('los-app', !!this.settings.appChrome);
  }

  applyPin() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_DASH)) {
      if (typeof leaf.setPinned === 'function') leaf.setPinned(!!this.settings.pinDashboard);
    }
  }

  collapseSidebars() {
    const w = this.app.workspace;
    try {
      if (w.leftSplit && w.leftSplit.collapse) w.leftSplit.collapse();
      if (w.rightSplit && w.rightSplit.collapse) w.rightSplit.collapse();
    } catch (e) { /* layout not ready */ }
  }

  /* --------------------------------------------------------- actions */

  capture() {
    new CaptureModal(this.app, async (title, body) => {
      const text = (body || '').trim();
      if (!text && !(title || '').trim()) { new Notice('Nothing to capture'); return; }
      const stamp = window.moment
        ? window.moment().format('YYYYMMDD-HHmmss')
        : new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
      const slug = ((title || text).toLowerCase().replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '').slice(0, 40)) || 'capture';
      const content = title ? `# ${title}\n\n${text}\n` : `${text}\n`;
      try {
        const file = await this.app.vault.create(`${INBOX}/${stamp}-${slug}.md`, content);
        new Notice(`Captured → ${file.path}\nRouting is the operator's job.`);
        this.rerenderAll();
      } catch (e) {
        new Notice(`Capture failed: ${e.message}`);
      }
    }).open();
  }

  rebuild(done) {
    new Notice('LearningOS: rebuilding views…');
    this.runLos(['generate'], async (err, stdout, stderr) => {
      if (err) {
        new Notice(`Rebuild FAILED:\n${(stderr || err.message).slice(0, 300)}`, 10000);
        this.rerenderAll();
        return;
      }
      new Notice('Views rebuilt ✓');
      await this.reload();
      this.refreshStatus();
      if (typeof done === 'function') done();
    });
  }

  validateRepo() {
    new Notice('LearningOS: validating…');
    this.runLos(['validate'], (err, stdout, stderr) => {
      const tail = stdout.trim().split('\n').pop() || '';
      new Notice(`Validation: ${tail || (stderr || err && err.message || '').slice(0, 200)}`,
        err ? 10000 : 4000);
      this.refreshStatus();
    });
  }

  showStatus() {
    this.runLos(['status', '--json'], (err, stdout, stderr) => {
      let payload = null;
      try { payload = JSON.parse(stdout); } catch (e) { /* ignore */ }
      if (payload) this.lastStatus = payload;
      new StatusModal(this.app, payload, this.store).open();
      if (err && !payload) {
        new Notice(`status failed:\n${(stderr || err.message).slice(0, 300)}`, 8000);
      }
    });
  }

  updateStatusBar() {
    if (!this.statusEl) return;
    const v = this.lastStatus && this.lastStatus.validation;
    const spine = this.store.examSpine;
    let exam = '';
    if (spine.length) {
      const e = spine.find((x) => x.days >= 0) || spine[spine.length - 1];
      exam = ` · ${examShort(e.title)} ${shortDay(e.days)}`;
    }
    const val = v ? (v.ok ? '✓' : `✗ ${v.errors}E/${v.warnings}W`)
      : (this.cliOk === false ? '· cli offline' : '…');
    this.statusEl.setText(`LOS ${val}${exam}`);
  }

  refreshStatus() {
    this.runLos(['status', '--json'], (err, stdout) => {
      this.cliOk = !err;
      if (!err) {
        try { this.lastStatus = JSON.parse(stdout); } catch (e) { /* ignore */ }
      }
      this.updateStatusBar();
      this.rerenderAll();
    });
  }

  /* ------------------------------------------------------- lifecycle */

  async onload() {
    this.lastStatus = null;
    this.cliOk = null;
    await this.loadSettings();
    this.store = new Store(this.app);

    this.registerView(VIEW_DASH, (leaf) => new LearningHomeView(leaf, this));
    this.registerView(VIEW_NAV, (leaf) => new AppNavView(leaf, this));
    this.registerView(VIEW_EXPLORER, (leaf) => new ExplorerView(leaf, this));
    this.registerView(VIEW_PATH, (leaf) => new LearningPathView(leaf, this));
    this.registerView(VIEW_SHELVE, (leaf) => new ShelveReviewView(leaf, this));
    this.registerView(VIEW_JOB, (leaf) => new JobBoundaryView(leaf, this));
    this.addSettingTab(new LearningOSSettingTab(this.app, this));

    this.addRibbonIcon('layout-dashboard', 'LearningOS: dashboard', () => this.openDashboard());
    this.addRibbonIcon('compass', 'LearningOS: browse', () => this.openExplorer('source'));
    this.addRibbonIcon('inbox', 'LearningOS: capture to inbox', () => this.capture());

    const cmd = (id, name, callback) => this.addCommand({ id, name, callback });
    cmd('open-dashboard', 'Open dashboard', () => this.openDashboard());
    cmd('open-learning-path', 'Open current learning path', () => this.openPath());
    cmd('open-shelve-review', 'Review shelving proposal', () => this.openShelve());
    cmd('find', 'Find anything', () => this.openFinder());
    cmd('browse-sources', 'Browse sources', () => this.openExplorer('source'));
    cmd('browse-notes', 'Browse notes', () => this.openExplorer('note'));
    cmd('browse-concepts', 'Browse concepts', () => this.openExplorer('concept'));
    cmd('browse-modules', 'Browse modules', () => this.openExplorer('module'));
    cmd('browse-workspaces', 'Browse workspaces', () => this.openExplorer('workspace'));
    cmd('open-navigator', 'Show the Navigator', () => this.openNav());
    cmd('capture', 'Capture to inbox', () => this.capture());
    cmd('rebuild-views', 'Rebuild generated views', () => this.rebuild());
    cmd('validate', 'Validate repository', () => this.validateRepo());
    cmd('status', 'Show status', () => this.showStatus());
    cmd('reload-projection', 'Reload projection (generated/)', () => this.reload());
    cmd('open-reading-room', 'Open reading room (plain-text home)',
      () => this.openVaultPath(READING_ROOM));
    cmd('open-concept-canvas', 'Open concept canvas', () => this.openVaultPath(CANVAS));

    this.statusEl = this.addStatusBarItem();
    this.statusEl.setText('LOS …');
    this.statusEl.style.cursor = 'pointer';
    this.registerDomEvent(this.statusEl, 'click', () => this.showStatus());

    this.applyChrome();

    const touched = (f) => f && typeof f.path === 'string'
      && (f.path.startsWith('generated/') || f.path.startsWith('work/')
        || f.path.startsWith('knowledge/') || f.path.startsWith('records/'));
    for (const ev of ['modify', 'create', 'delete', 'rename']) {
      this.registerEvent(this.app.vault.on(ev, (f) => {
        if (touched(f)) this.scheduleReload();
      }));
    }

    this.app.workspace.onLayoutReady(async () => {
      await this.store.load();
      this.updateStatusBar();
      this.refreshStatus();
      this.registerInterval(window.setInterval(() => this.refreshStatus(), STATUS_REFRESH_MS));
      if (this.settings.showNavigator) await this.openNav();
      if (this.settings.openOnStartup) await this.openDashboard({ startup: true });
      else this.applyPin();
      if (this.settings.collapseSidebars) this.collapseSidebars();
      this.rerenderAll();
    });
  }

  onunload() {
    window.clearTimeout(this._reloadTimer);
    document.body.classList.remove('los-app');
    for (const t of [VIEW_DASH, VIEW_NAV, VIEW_EXPLORER, VIEW_PATH, VIEW_SHELVE, VIEW_JOB]) {
      this.app.workspace.detachLeavesOfType(t);
    }
  }
};
