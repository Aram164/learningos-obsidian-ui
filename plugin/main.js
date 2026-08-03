/* LearningOS UI v0.3.0 — single-file plugin, no build step (boundary rule:
 * no Node build system near the core). Presentation and interaction ONLY:
 * reads come from `los.py status --json`, generated/ views, and vault
 * metadata (frontmatter, mtimes); the one write is capture into work/inbox/
 * (the architecture's designated judgment-free surface, ADR-006). No YAML
 * rewriting, no rule reimplementation, no canonical edits.
 *
 * v0.2: the Dashboard — a rendered home view instead of a markdown wall.
 * v0.3: "it should feel like an app". Three changes:
 *   1. The dashboard is the guaranteed home. v0.2 opened it only when no file
 *      was restored — Obsidian ALWAYS restores one, so it never fired and the
 *      vault looked like a plain folder of markdown. Now it opens, focuses,
 *      and pins itself on every launch (pinned = links from it open in new
 *      tabs, so home is never clobbered).
 *   2. App chrome: sidebars collapsed at launch, `body.los-app` styling hooks,
 *      a home-tab accent. Every behaviour is a setting, none is forced.
 *   3. A designed dashboard: hero countdown, stat strip, workspace grid,
 *      live re-render on vault changes. */
'use strict';

const {
  Plugin, PluginSettingTab, ItemView, Modal, Notice, Setting, setIcon,
} = require('obsidian');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIEW_TYPE = 'learningos-dashboard';
const READING_ROOM = 'generated/reading-room.md';
const CANVAS = 'generated/concept-canvas.canvas';
const INBOX = 'work/inbox';
const STATUS_REFRESH_MS = 15 * 60 * 1000;
const RERENDER_DEBOUNCE_MS = 1200;

const DEFAULTS = {
  openOnStartup: true,   // dashboard is the home view on every launch
  pinDashboard: true,    // home tab survives every click
  collapseSidebars: true, // app, not file browser
  appChrome: true,       // body.los-app styling hooks
  liveRefresh: true,     // re-render when vault files change
};

const DAY = 86400000;

function daysUntil(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / DAY);
}

function shortDay(n) {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n > 0) return `in ${n}d`;
  return `${-n}d ago`;
}

function relTime(ms) {
  const d = Math.round((Date.now() - ms) / DAY);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

/** Module short-name out of a spine title like "… (SaD + AN)". */
function examShort(title) {
  const m = /\(([^)]{1,24})\)/.exec(title || '');
  return m ? m[1] : String(title || '').split(/[—–-]/)[0].trim().slice(0, 22);
}

/* ------------------------------------------------------------- modals */

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
      text: '⌘/Ctrl + Enter to capture.',
      cls: 'setting-item-description',
    });
    window.setTimeout(() => ta.focus(), 20);
  }
  onClose() { this.contentEl.empty(); }
}

class StatusModal extends Modal {
  constructor(app, payload) { super(app); this.payload = payload; }
  onOpen() {
    const { contentEl } = this;
    const p = this.payload;
    contentEl.addClass('los-modal');
    contentEl.createEl('h3', { text: 'LearningOS status' });
    if (!p) {
      contentEl.createEl('p', { text: 'status --json failed — see notice.' });
      return;
    }
    const c = p.counts || {};
    const v = p.validation || {};
    const lines = [
      `notes ${c.notes} · concepts ${c.concepts} · relations ${c.concept_relations} · sources ${c.sources}`,
      `workspaces ${c.active_workspaces} active (${c.standing_workspaces} standing) · inbox ${c.inbox_items} · garden ${c.garden_notes}`,
      `reviewed ${(p.adoption || {}).notes_reviewed}/${c.notes} · evidence ${(p.adoption || {}).notes_with_evidence}/${c.notes}`,
      `validation: ${v.ok ? 'OK (0/0)' : `${v.errors} error(s), ${v.warnings} warning(s)`}`,
    ];
    for (const l of lines) contentEl.createEl('p', { text: l });
    if (Array.isArray(p.exam_spine) && p.exam_spine.length) {
      contentEl.createEl('h4', { text: 'Exam spine' });
      for (const e of p.exam_spine) {
        contentEl.createEl('p', {
          text: `${e.date} — ${e.title} (Termin ${e.termin})`,
        });
      }
    }
    contentEl.createEl('p', {
      text: 'Facts: records/modules.yaml · full dashboard: generated/coordination-view.md',
      cls: 'setting-item-description',
    });
  }
  onClose() { this.contentEl.empty(); }
}

/* ---------------------------------------------------------- dashboard */

class DashboardView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'LearningOS'; }
  getIcon() { return 'layout-dashboard'; }

  async onOpen() { await this.render(); }
  onClose() { return Promise.resolve(); }

  openPath(p) {
    const f = this.app.vault.getAbstractFileByPath(p);
    if (f) this.app.workspace.getLeaf(false).openFile(f);
    else new Notice(`${p} missing — run Rebuild views`);
  }

  async workspaceCards() {
    const out = [];
    const files = this.app.vault.getMarkdownFiles()
      .filter((f) => f.path.startsWith('work/active/') && f.name === 'CONTEXT.md');
    for (const f of files) {
      const fm = (this.app.metadataCache.getFileCache(f) || {}).frontmatter || {};
      let next = '';
      try {
        const text = await this.app.vault.cachedRead(f);
        const m = /##\s*Next Action\s*\n+([\s\S]*?)(?=\n##\s|$)/i.exec(text);
        if (m) {
          const para = m[1].trim().split(/\n\s*\n/)[0] || '';
          next = para.replace(/\s+/g, ' ').trim();
        }
      } catch (e) { /* unreadable — show card without next action */ }
      out.push({
        file: f,
        id: fm.id || f.parent.name,
        title: fm.title || f.parent.name,
        status: String(fm.status || ''),
        standing: !!fm.standing,
        deadline: fm.deadline ? String(fm.deadline) : '',
        mtime: f.stat.mtime,
        next,
      });
    }
    const rank = (w) => (w.status === 'active' ? 0 : w.status === 'blocked' ? 2 : 1)
      + (w.standing ? 0.5 : 0);
    out.sort((a, b) => (rank(a) - rank(b)) || (b.mtime - a.mtime));
    return out;
  }

  recentNotes(n) {
    return this.app.vault.getMarkdownFiles()
      .filter((f) => f.path.startsWith('knowledge/notes/'))
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, n)
      .map((f) => {
        const fm = (this.app.metadataCache.getFileCache(f) || {}).frontmatter || {};
        return {
          file: f,
          title: fm.title || f.basename,
          state: fm.state || '',
          domain: (f.parent && f.parent.name) || '',
          mtime: f.stat.mtime,
        };
      });
  }

  folderCount(p) {
    const folder = this.app.vault.getAbstractFileByPath(p);
    if (!folder || !folder.children) return 0;
    return folder.children.filter((c) => !c.name.startsWith('.')).length;
  }

  /* -------------------------------------------------------- fragments */

  renderHeader(el) {
    const plugin = this.plugin;
    const head = el.createDiv({ cls: 'los-head' });
    const title = head.createDiv({ cls: 'los-title' });
    title.createEl('h1', { text: 'LearningOS' });
    title.createDiv({
      cls: 'los-subtitle',
      text: new Date().toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }),
    });
    const actions = head.createDiv({ cls: 'los-actions' });
    const btn = (label, icon, cta, fn) => {
      const b = actions.createEl('button', { cls: 'los-btn' });
      const ic = b.createSpan({ cls: 'los-btn-icon' });
      try { setIcon(ic, icon); } catch (e) { ic.remove(); }
      b.createSpan({ text: label });
      if (cta) b.addClass('mod-cta');
      b.addEventListener('click', fn);
    };
    btn('Capture', 'inbox', true, () => plugin.capture());
    btn('Rebuild', 'refresh-cw', false, () => plugin.rebuild(() => this.render()));
    btn('Validate', 'shield-check', false, () => plugin.validateRepo());
    btn('Refresh', 'rotate-cw', false, () => plugin.refreshStatus(true));
  }

  renderBanner(el, payload) {
    const v = payload && payload.validation;
    const banner = el.createDiv({ cls: 'los-banner' });
    if (!payload) {
      banner.addClass('los-warn');
      banner.setText('CLI unavailable — vault views still shown. Fix: `make setup` in the repository.');
      return;
    }
    if (v && v.ok) {
      banner.addClass('los-ok');
      banner.setText('validation OK · 0 errors, 0 warnings');
      return;
    }
    if (v) {
      banner.addClass('los-warn', 'is-clickable');
      banner.setText(`validation: ${v.errors} error(s), ${v.warnings} warning(s) — open report`);
      banner.addEventListener('click',
        () => this.openPath('generated/reports/validation-report.md'));
    }
  }

  renderHero(el, spine) {
    if (!spine.length) return;
    const upcoming = spine
      .map((e) => ({ ...e, days: daysUntil(e.date) }))
      .sort((a, b) => a.days - b.days);
    const next = upcoming.find((e) => e.days >= 0) || upcoming[upcoming.length - 1];

    const hero = el.createDiv({ cls: 'los-hero is-clickable' });
    hero.addEventListener('click', () => this.openPath('generated/coordination-view.md'));
    const left = hero.createDiv({ cls: 'los-hero-main' });
    left.createDiv({ cls: 'los-hero-label', text: 'Next exam' });
    left.createDiv({ cls: 'los-hero-name', text: examShort(next.title) });
    left.createDiv({
      cls: 'los-hero-sub',
      text: `${next.date} · Termin ${next.termin} · ${next.title}`,
    });
    const right = hero.createDiv({ cls: 'los-hero-count' });
    right.createDiv({
      cls: 'los-hero-days',
      text: next.days >= 0 ? String(next.days) : String(-next.days),
    });
    right.createDiv({
      cls: 'los-hero-unit',
      text: next.days >= 0 ? (next.days === 1 ? 'day left' : 'days left') : 'days ago',
    });

    const rest = upcoming.filter((e) => e !== next);
    if (!rest.length) return;
    const tiles = el.createDiv({ cls: 'los-tiles' });
    for (const e of rest) {
      const t = tiles.createDiv({ cls: 'los-tile is-clickable' });
      if (e.days < 0) t.addClass('los-dim');
      t.createDiv({ cls: 'los-tile-days', text: shortDay(e.days) });
      t.createDiv({ cls: 'los-tile-name', text: examShort(e.title) });
      t.createDiv({ cls: 'los-tile-sub', text: `${e.date} · Termin ${e.termin}` });
      t.addEventListener('click', () => this.openPath('generated/coordination-view.md'));
    }
  }

  renderStats(el, payload) {
    const c = (payload && payload.counts) || {};
    const a = (payload && payload.adoption) || {};
    const strip = el.createDiv({ cls: 'los-stats' });
    const stat = (value, label, onClick) => {
      const s = strip.createDiv({ cls: 'los-stat' });
      s.createDiv({ cls: 'los-stat-value', text: String(value) });
      s.createDiv({ cls: 'los-stat-label', text: label });
      if (onClick) {
        s.addClass('is-clickable');
        s.addEventListener('click', onClick);
      }
    };
    const inbox = this.folderCount(INBOX);
    const garden = this.folderCount('knowledge/garden');
    stat(c.notes != null ? c.notes : '—', 'notes',
      () => this.openPath('bases/notes.base'));
    stat(c.concepts != null ? c.concepts : '—', 'concepts',
      () => this.openPath('generated/concept-index.md'));
    stat(c.sources != null ? c.sources : '—', 'sources',
      () => this.openPath('generated/source-index.md'));
    stat(inbox, 'in inbox');
    stat(garden, 'gestating', () => this.openPath('bases/garden.base'));
    if (a.notes_reviewed != null && c.notes) {
      stat(`${Math.round((a.notes_reviewed / c.notes) * 100)}%`, 'reviewed');
    }
  }

  renderWorkspaces(col, cards) {
    col.createEl('h3', { text: 'Continue where I stopped' });
    if (!cards.length) {
      col.createDiv({ cls: 'los-empty', text: 'No active workspaces.' });
      return;
    }
    const grid = col.createDiv({ cls: 'los-grid' });
    for (const w of cards) {
      const c = grid.createDiv({ cls: `los-card is-clickable los-s-${w.status || 'none'}` });
      if (w.status !== 'active') c.addClass('los-dim');
      const top = c.createDiv({ cls: 'los-card-top' });
      top.createSpan({ cls: 'los-card-title', text: w.title });
      const badges = c.createDiv({ cls: 'los-badges' });
      if (w.status) badges.createSpan({ cls: `los-badge los-b-${w.status}`, text: w.status });
      if (w.standing) badges.createSpan({ cls: 'los-badge', text: 'standing' });
      if (w.deadline) {
        badges.createSpan({
          cls: 'los-badge',
          text: `due ${w.deadline} · ${shortDay(daysUntil(w.deadline))}`,
        });
      }
      if (w.next) c.createDiv({ cls: 'los-card-next', text: w.next });
      c.createDiv({ cls: 'los-card-foot', text: `touched ${relTime(w.mtime)}` });
      c.addEventListener('click', () => this.app.workspace.getLeaf(false).openFile(w.file));
    }
  }

  renderRail(col) {
    col.createEl('h3', { text: 'Open' });
    const links = col.createDiv({ cls: 'los-links' });
    const link = (label, icon, p) => {
      const li = links.createDiv({ cls: 'los-link is-clickable' });
      const ic = li.createSpan({ cls: 'los-link-icon' });
      try { setIcon(ic, icon); } catch (e) { ic.remove(); }
      li.createSpan({ text: label });
      li.addEventListener('click', () => this.openPath(p));
    };
    link('Note shelves', 'library', 'bases/notes.base');
    link('Workspaces', 'briefcase', 'bases/workspaces.base');
    link('Garden', 'sprout', 'bases/garden.base');
    link('Concept canvas', 'network', CANVAS);
    link('Coordination', 'calendar-days', 'generated/coordination-view.md');
    link('Domain atlas', 'map', 'generated/domain-atlas.md');
    link('Health report', 'activity', 'generated/reports/health.md');
    link('Reading room', 'book-open', READING_ROOM);
  }

  renderRecent(col) {
    col.createEl('h3', { text: 'Recently changed notes' });
    const recent = this.recentNotes(8);
    if (!recent.length) {
      col.createDiv({ cls: 'los-empty', text: 'No notes under knowledge/notes/ yet.' });
      return;
    }
    const list = col.createDiv({ cls: 'los-rows' });
    for (const r of recent) {
      const row = list.createDiv({ cls: 'los-row is-clickable' });
      row.createSpan({ cls: 'los-row-title', text: r.title });
      const meta = row.createSpan({ cls: 'los-row-meta' });
      if (r.domain) meta.createSpan({ cls: 'los-badge', text: r.domain });
      if (r.state) meta.createSpan({ cls: 'los-badge', text: String(r.state) });
      meta.createSpan({ cls: 'los-row-time', text: relTime(r.mtime) });
      row.addEventListener('click', () => this.app.workspace.getLeaf(false).openFile(r.file));
    }
  }

  /* ------------------------------------------------------------ render */

  async render() {
    const el = this.contentEl;
    el.empty();
    el.addClass('los-dash');
    const payload = this.plugin.lastStatus;

    this.renderHeader(el);
    this.renderBanner(el, payload);
    this.renderHero(el, (payload && payload.exam_spine) || []);
    this.renderStats(el, payload);

    const cols = el.createDiv({ cls: 'los-cols' });
    const main = cols.createDiv({ cls: 'los-col-main' });
    const side = cols.createDiv({ cls: 'los-col-side' });

    this.renderWorkspaces(main, await this.workspaceCards());
    this.renderRecent(main);
    this.renderRail(side);

    el.createDiv({
      cls: 'los-foot',
      text: 'Presentation only — facts live in records/ + work/, knowledge in knowledge/. '
        + 'Views rebuild on every commit; buttons here are conveniences, never duties (WORKFLOWS §25).',
    });
  }
}

/* ------------------------------------------------------------ settings */

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
      'Make the dashboard the home view every time the vault opens.',
      'openOnStartup');
    toggle('Pin the dashboard tab',
      'Home stays put — links open in new tabs instead of replacing it.',
      'pinDashboard', () => this.plugin.applyPin());
    toggle('Collapse sidebars on startup',
      'Opens as an application rather than a file browser. Both sidebars stay one click away.',
      'collapseSidebars');
    toggle('App chrome',
      'Adds LearningOS styling to the window (home-tab accent, calmer chrome).',
      'appChrome', () => this.plugin.applyChrome());
    toggle('Live refresh',
      'Re-render the dashboard when vault files change.',
      'liveRefresh');
  }
}

/* -------------------------------------------------------------- plugin */

module.exports = class LearningOSUI extends Plugin {
  basePath() {
    const a = this.app.vault.adapter;
    return a && typeof a.getBasePath === 'function' ? a.getBasePath() : null;
  }

  python() {
    const base = this.basePath();
    if (base) {
      const venv = path.join(base, '.venv', 'bin', 'python');
      if (fs.existsSync(venv)) return venv;
    }
    return 'python3';
  }

  runLos(args, cb) {
    const base = this.basePath();
    if (!base) { new Notice('LearningOS: vault is not on a filesystem'); return; }
    execFile(this.python(), ['tools/los.py', ...args],
      { cwd: base, timeout: 180000 },
      (err, stdout, stderr) => cb(err, String(stdout || ''), String(stderr || '')));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
  }
  async saveSettings() { await this.saveData(this.settings); }

  /* ------------------------------------------------------ app chrome */

  applyChrome() {
    document.body.classList.toggle('los-app', !!this.settings.appChrome);
  }

  applyPin() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (typeof leaf.setPinned === 'function') leaf.setPinned(!!this.settings.pinDashboard);
    }
  }

  collapseSidebars() {
    const w = this.app.workspace;
    try {
      if (w.leftSplit && typeof w.leftSplit.collapse === 'function') w.leftSplit.collapse();
      if (w.rightSplit && typeof w.rightSplit.collapse === 'function') w.rightSplit.collapse();
    } catch (e) { /* layout not ready — harmless */ }
  }

  /** The home view. `startup` opens a NEW tab so a restored file is kept. */
  async openDashboard(opts) {
    const startup = !!(opts && opts.startup);
    const w = this.app.workspace;
    let leaf = w.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = w.getLeaf(startup ? true : false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    if (this.settings.pinDashboard && typeof leaf.setPinned === 'function') {
      leaf.setPinned(true);
    }
    w.revealLeaf(leaf);
    w.setActiveLeaf(leaf, { focus: true });
    return leaf;
  }

  rerenderDashboards() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof DashboardView) leaf.view.render();
    }
  }

  scheduleRerender() {
    if (!this.settings.liveRefresh) return;
    window.clearTimeout(this._rerenderTimer);
    this._rerenderTimer = window.setTimeout(() => this.rerenderDashboards(),
      RERENDER_DEBOUNCE_MS);
  }

  async openReadingRoom() {
    const f = this.app.vault.getAbstractFileByPath(READING_ROOM);
    if (!f) { new Notice('reading-room.md missing — run Rebuild views'); return; }
    await this.app.workspace.getLeaf(false).openFile(f);
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
        this.rerenderDashboards();
      } catch (e) {
        new Notice(`Capture failed: ${e.message}`);
      }
    }).open();
  }

  rebuild(done) {
    new Notice('LearningOS: rebuilding views…');
    this.runLos(['generate'], (err, stdout, stderr) => {
      if (err) {
        new Notice(`Rebuild FAILED:\n${(stderr || err.message).slice(0, 300)}`, 10000);
        return;
      }
      new Notice('Views rebuilt ✓');
      this.refreshStatus();
      if (typeof done === 'function') done();
    });
  }

  validateRepo() {
    new Notice('LearningOS: validating…');
    this.runLos(['validate'], (err, stdout, stderr) => {
      const tail = stdout.trim().split('\n').pop() || '';
      if (err) {
        new Notice(`Validation: ${tail || stderr.slice(0, 200)}`, 10000);
        this.refreshStatus();
        return;
      }
      new Notice(`Validation: ${tail}`);
      this.refreshStatus();
    });
  }

  showStatus() {
    this.runLos(['status', '--json'], (err, stdout, stderr) => {
      if (err) {
        new Notice(`status failed:\n${(stderr || err.message).slice(0, 300)}`, 10000);
        new StatusModal(this.app, null).open();
        return;
      }
      let payload = null;
      try { payload = JSON.parse(stdout); } catch (e) { /* ignore */ }
      this.lastStatus = payload || this.lastStatus;
      new StatusModal(this.app, payload).open();
    });
  }

  refreshStatus(rerender) {
    this.runLos(['status', '--json'], (err, stdout) => {
      if (err) {
        if (this.statusEl) this.statusEl.setText('LOS: cli unavailable');
        if (rerender) this.rerenderDashboards();
        return;
      }
      try {
        const p = JSON.parse(stdout);
        this.lastStatus = p;
        if (this.statusEl) {
          const ok = p.validation && p.validation.ok;
          let exam = '';
          if (Array.isArray(p.exam_spine) && p.exam_spine.length) {
            const up = p.exam_spine.map((e) => ({ ...e, days: daysUntil(e.date) }))
              .sort((a, b) => a.days - b.days);
            const e = up.find((x) => x.days >= 0) || up[up.length - 1];
            exam = ` · ${examShort(e.title)} ${shortDay(e.days)}`;
          }
          const val = ok ? '✓' : `✗ ${p.validation.errors}E/${p.validation.warnings}W`;
          this.statusEl.setText(`LOS ${val}${exam}`);
        }
        this.rerenderDashboards();
      } catch (e) {
        if (this.statusEl) this.statusEl.setText('LOS: bad status json');
      }
    });
  }

  /* -------------------------------------------------------- lifecycle */

  async onload() {
    this.lastStatus = null;
    await this.loadSettings();

    this.registerView(VIEW_TYPE, (leaf) => new DashboardView(leaf, this));
    this.addSettingTab(new LearningOSSettingTab(this.app, this));

    this.addRibbonIcon('layout-dashboard', 'LearningOS: dashboard', () => this.openDashboard());
    this.addRibbonIcon('inbox', 'LearningOS: capture to inbox', () => this.capture());
    this.addRibbonIcon('refresh-cw', 'LearningOS: rebuild views', () => this.rebuild());

    this.addCommand({ id: 'open-dashboard', name: 'Open dashboard', callback: () => this.openDashboard() });
    this.addCommand({ id: 'open-reading-room', name: 'Open reading room (plain-text home)', callback: () => this.openReadingRoom() });
    this.addCommand({ id: 'capture', name: 'Capture to inbox', callback: () => this.capture() });
    this.addCommand({ id: 'rebuild-views', name: 'Rebuild generated views', callback: () => this.rebuild() });
    this.addCommand({ id: 'validate', name: 'Validate repository', callback: () => this.validateRepo() });
    this.addCommand({ id: 'status', name: 'Show status', callback: () => this.showStatus() });
    this.addCommand({
      id: 'open-concept-canvas',
      name: 'Open concept canvas',
      callback: () => {
        const f = this.app.vault.getAbstractFileByPath(CANVAS);
        if (!f) { new Notice('concept-canvas.canvas missing — run Rebuild views'); return; }
        this.app.workspace.getLeaf(false).openFile(f);
      },
    });

    this.statusEl = this.addStatusBarItem();
    this.statusEl.setText('LOS …');
    this.statusEl.style.cursor = 'pointer';
    this.registerDomEvent(this.statusEl, 'click', () => this.showStatus());

    this.applyChrome();

    /* Live-ish dashboard: vault edits under work/ and knowledge/ re-render. */
    const touched = (f) => f && typeof f.path === 'string'
      && (f.path.startsWith('work/') || f.path.startsWith('knowledge/'));
    for (const ev of ['modify', 'create', 'delete', 'rename']) {
      this.registerEvent(this.app.vault.on(ev, (f) => {
        if (touched(f)) this.scheduleRerender();
      }));
    }

    this.app.workspace.onLayoutReady(async () => {
      this.refreshStatus();
      this.registerInterval(window.setInterval(() => this.refreshStatus(), STATUS_REFRESH_MS));
      /* v0.2 gated this on "no active file" — Obsidian always restores one, so
       * the dashboard never appeared and the vault looked like raw markdown. */
      if (this.settings.openOnStartup) await this.openDashboard({ startup: true });
      else this.applyPin();
      if (this.settings.collapseSidebars) this.collapseSidebars();
    });
  }

  onunload() {
    window.clearTimeout(this._rerenderTimer);
    document.body.classList.remove('los-app');
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }
};
