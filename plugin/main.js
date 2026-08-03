/* LearningOS UI v0.2.0 — single-file plugin, no build step (boundary rule:
 * no Node build system near the core). Presentation and interaction ONLY:
 * reads come from `los.py status --json`, generated/ views, and vault
 * metadata (frontmatter, mtimes); the one write is capture into work/inbox/
 * (the architecture's designated judgment-free surface, ADR-006). No YAML
 * rewriting, no rule reimplementation, no canonical edits.
 *
 * v0.2: the Dashboard — a real rendered home view (workspace cards, exam
 * countdown tiles, queues, recent notes, action buttons). The generated
 * reading-room.md stays the plain-text fallback for every other editor. */
'use strict';

const { Plugin, ItemView, Modal, Notice, Setting } = require('obsidian');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIEW_TYPE = 'learningos-dashboard';
const READING_ROOM = 'generated/reading-room.md';
const CANVAS = 'generated/concept-canvas.canvas';
const INBOX = 'work/inbox';
const STATUS_REFRESH_MS = 15 * 60 * 1000;

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
    new Setting(contentEl)
      .addButton((b) => b.setButtonText('Capture').setCta().onClick(() => {
        this.close();
        this.onSubmit(this.titleText, this.bodyText);
      }))
      .addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()));
    window.setTimeout(() => ta.focus(), 20);
  }
  onClose() { this.contentEl.empty(); }
}

class StatusModal extends Modal {
  constructor(app, payload) { super(app); this.payload = payload; }
  onOpen() {
    const { contentEl } = this;
    const p = this.payload;
    contentEl.createEl('h3', { text: 'LearningOS status' });
    if (!p) { contentEl.createEl('p', { text: 'status --json failed — see notice.' }); return; }
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

  daysUntil(iso) {
    return Math.ceil((new Date(iso) - new Date()) / 86400000);
  }

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
        next,
      });
    }
    out.sort((a, b) => (a.standing - b.standing) || a.id.localeCompare(b.id));
    return out;
  }

  recentNotes(n) {
    return this.app.vault.getMarkdownFiles()
      .filter((f) => f.path.startsWith('knowledge/notes/'))
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, n)
      .map((f) => {
        const fm = (this.app.metadataCache.getFileCache(f) || {}).frontmatter || {};
        return { file: f, title: fm.title || f.basename, state: fm.state || '', mtime: f.stat.mtime };
      });
  }

  folderCount(p) {
    const folder = this.app.vault.getAbstractFileByPath(p);
    if (!folder || !folder.children) return 0;
    return folder.children.filter((c) => !c.name.startsWith('.')).length;
  }

  async render() {
    const el = this.contentEl;
    el.empty();
    el.addClass('los-dash');
    const plugin = this.plugin;
    const payload = plugin.lastStatus;

    /* header + actions */
    const head = el.createDiv({ cls: 'los-head' });
    head.createEl('h2', { text: 'LearningOS' });
    const actions = head.createDiv({ cls: 'los-actions' });
    const btn = (label, cta, fn) => {
      const b = actions.createEl('button', { text: label });
      if (cta) b.addClass('mod-cta');
      b.addEventListener('click', fn);
    };
    btn('Capture', true, () => plugin.capture());
    btn('Rebuild views', false, () => plugin.rebuild(() => this.render()));
    btn('Validate', false, () => plugin.validateRepo());
    btn('Refresh', false, () => plugin.refreshStatus(true));

    /* validation banner */
    const v = payload && payload.validation;
    const banner = el.createDiv({ cls: 'los-banner' });
    if (!payload) {
      banner.setText('CLI status unavailable — vault views still shown. Fix: make setup in the repository.');
      banner.addClass('los-warn');
    } else if (v && v.ok) {
      banner.setText('validation OK · 0 errors, 0 warnings');
      banner.addClass('los-ok');
    } else if (v) {
      banner.setText(`validation: ${v.errors} error(s), ${v.warnings} warning(s) — see generated/reports/validation-report.md`);
      banner.addClass('los-warn');
      banner.style.cursor = 'pointer';
      banner.addEventListener('click', () => this.openPath('generated/reports/validation-report.md'));
    }

    /* exam tiles */
    const spine = (payload && payload.exam_spine) || [];
    if (spine.length) {
      const tiles = el.createDiv({ cls: 'los-tiles' });
      for (const e of spine) {
        const t = tiles.createDiv({ cls: 'los-tile' });
        const d = this.daysUntil(e.date);
        t.createDiv({ cls: 'los-tile-days', text: d >= 0 ? `${d}d` : `${-d}d ago` });
        const m = /\(([A-Za-z0-9+ ]+)\)/.exec(e.title || '');
        t.createDiv({ cls: 'los-tile-name', text: m ? m[1] : e.title });
        t.createDiv({ cls: 'los-tile-sub', text: `${e.date} · Termin ${e.termin}` });
        t.addEventListener('click', () => this.openPath('generated/coordination-view.md'));
      }
    }

    /* two columns: workspaces | right rail */
    const cols = el.createDiv({ cls: 'los-cols' });
    const left = cols.createDiv({ cls: 'los-col-main' });
    const right = cols.createDiv({ cls: 'los-col-side' });

    left.createEl('h3', { text: 'Continue where I stopped' });
    const cards = await this.workspaceCards();
    if (!cards.length) left.createEl('p', { text: '(no active workspaces)' });
    for (const w of cards) {
      const c = left.createDiv({ cls: 'los-card' + (w.status !== 'active' ? ' los-dim' : '') });
      const top = c.createDiv({ cls: 'los-card-top' });
      top.createSpan({ cls: 'los-card-title', text: w.title });
      const badges = top.createSpan({ cls: 'los-badges' });
      badges.createSpan({ cls: 'los-badge', text: w.status });
      if (w.standing) badges.createSpan({ cls: 'los-badge', text: 'standing' });
      if (w.deadline) badges.createSpan({ cls: 'los-badge', text: `due ${w.deadline}` });
      if (w.next) c.createDiv({ cls: 'los-card-next', text: `→ ${w.next}` });
      c.addEventListener('click', () => this.app.workspace.getLeaf(false).openFile(w.file));
    }

    right.createEl('h3', { text: 'Queues' });
    const q = right.createEl('ul', { cls: 'los-list' });
    const inbox = this.folderCount(INBOX);
    const garden = this.folderCount('knowledge/garden');
    q.createEl('li', { text: `inbox: ${inbox} — operator routes` });
    const gLi = q.createEl('li', { text: `garden: ${garden} gestating` });
    gLi.style.cursor = 'pointer';
    gLi.addEventListener('click', () => this.openPath('bases/garden.base'));
    if (payload) {
      const a = payload.adoption || {};
      const n = (payload.counts || {}).notes;
      q.createEl('li', { text: `reviewed ${a.notes_reviewed}/${n} · evidence ${a.notes_with_evidence}/${n}` });
    }

    right.createEl('h3', { text: 'Open' });
    const links = right.createEl('ul', { cls: 'los-list' });
    const link = (label, p) => {
      const li = links.createEl('li', { text: label });
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => this.openPath(p));
    };
    link('Note shelves', 'bases/notes.base');
    link('Workspace shelf', 'bases/workspaces.base');
    link('Concept canvas', CANVAS);
    link('Coordination view', 'generated/coordination-view.md');
    link('Domain atlas', 'generated/domain-atlas.md');
    link('Health report', 'generated/reports/health.md');
    link('Reading room (plain-text home)', READING_ROOM);

    left.createEl('h3', { text: 'Recently changed notes' });
    const rec = left.createEl('ul', { cls: 'los-list' });
    for (const r of this.recentNotes(8)) {
      const when = window.moment ? window.moment(r.mtime).format('YYYY-MM-DD') :
        new Date(r.mtime).toISOString().slice(0, 10);
      const li = rec.createEl('li', { text: `${when} · ${r.title}${r.state ? ` · ${r.state}` : ''}` });
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => this.app.workspace.getLeaf(false).openFile(r.file));
    }

    el.createDiv({
      cls: 'los-foot',
      text: 'Presentation only — facts live in records/ + work/, knowledge in knowledge/. ' +
        'Views rebuild on every commit; buttons here are conveniences, never duties (WORKFLOWS §25).',
    });
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

  async openDashboard() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length) { this.app.workspace.revealLeaf(existing[0]); return; }
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
  }

  rerenderDashboards() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof DashboardView) leaf.view.render();
    }
  }

  async openReadingRoom() {
    const f = this.app.vault.getAbstractFileByPath(READING_ROOM);
    if (!f) { new Notice('reading-room.md missing — run Rebuild views'); return; }
    await this.app.workspace.getLeaf(false).openFile(f);
  }

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
      if (err) { new Notice(`Rebuild FAILED:\n${(stderr || err.message).slice(0, 300)}`, 10000); return; }
      new Notice('Views rebuilt ✓');
      this.refreshStatus();
      if (typeof done === 'function') done();
    });
  }

  validateRepo() {
    new Notice('LearningOS: validating…');
    this.runLos(['validate'], (err, stdout, stderr) => {
      const tail = stdout.trim().split('\n').pop() || '';
      if (err) { new Notice(`Validation: ${tail || stderr.slice(0, 200)}`, 10000); return; }
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
            const e = p.exam_spine[0];
            const days = Math.ceil((new Date(e.date) - new Date()) / 86400000);
            const m = /\(([A-Za-z0-9+]+)\)/.exec(e.title || '');
            const short = m ? m[1] : String(e.title || '').slice(0, 10);
            exam = ` · ${short} ${days >= 0 ? `in ${days}d` : `${-days}d ago`}`;
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

  onload() {
    this.lastStatus = null;
    this.registerView(VIEW_TYPE, (leaf) => new DashboardView(leaf, this));

    this.addRibbonIcon('layout-dashboard', 'LearningOS: dashboard', () => this.openDashboard());
    this.addRibbonIcon('inbox', 'LearningOS: capture to inbox', () => this.capture());
    this.addRibbonIcon('refresh-cw', 'LearningOS: rebuild views', () => this.rebuild());

    this.addCommand({ id: 'open-dashboard', name: 'Open dashboard', callback: () => this.openDashboard() });
    this.addCommand({ id: 'open-reading-room', name: 'Open reading room (plain-text home)', callback: () => this.openReadingRoom() });
    this.addCommand({ id: 'capture', name: 'Capture to inbox', callback: () => this.capture() });
    this.addCommand({ id: 'rebuild-views', name: 'Rebuild generated views', callback: () => this.rebuild() });
    this.addCommand({ id: 'validate', name: 'Validate repository', callback: () => this.validateRepo() });
    this.addCommand({ id: 'status', name: 'Show status', callback: () => this.showStatus() });
    this.addCommand({ id: 'open-concept-canvas', name: 'Open concept canvas', callback: () => {
      const f = this.app.vault.getAbstractFileByPath(CANVAS);
      if (!f) { new Notice('concept-canvas.canvas missing — run Rebuild views'); return; }
      this.app.workspace.getLeaf(false).openFile(f);
    } });

    this.statusEl = this.addStatusBarItem();
    this.statusEl.setText('LOS …');
    this.statusEl.style.cursor = 'pointer';
    this.registerDomEvent(this.statusEl, 'click', () => this.showStatus());

    this.app.workspace.onLayoutReady(() => {
      this.refreshStatus();
      this.registerInterval(window.setInterval(() => this.refreshStatus(), STATUS_REFRESH_MS));
      if (!this.app.workspace.getActiveFile()) this.openDashboard();
    });
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }
};
