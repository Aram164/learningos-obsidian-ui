/* LearningOS UI v0.1.0 — single-file plugin, no build step (boundary rule:
 * no Node build system near the core). Presentation and interaction ONLY:
 * every read goes through generated/ views or `los.py status --json`; the one
 * write is capture into work/inbox/ (the architecture's designated
 * judgment-free surface, ADR-006). No YAML parsing, no rule reimplementation,
 * no canonical edits. */
'use strict';

const { Plugin, Modal, Notice, Setting } = require('obsidian');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const READING_ROOM = 'generated/reading-room.md';
const INBOX = 'work/inbox';
const STATUS_REFRESH_MS = 15 * 60 * 1000;

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
      `reviewed ${((p.adoption || {}).notes_reviewed)}/${c.notes} · evidence ${((p.adoption || {}).notes_with_evidence)}/${c.notes}`,
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
      text: 'Facts: records/modules.yaml · dashboard: generated/coordination-view.md',
      cls: 'setting-item-description',
    });
  }
  onClose() { this.contentEl.empty(); }
}

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

  async openReadingRoom() {
    let f = this.app.vault.getAbstractFileByPath(READING_ROOM);
    if (!f) {
      new Notice('reading-room.md missing — rebuilding views…');
      this.rebuild(() => {
        f = this.app.vault.getAbstractFileByPath(READING_ROOM);
        if (f) this.app.workspace.getLeaf(false).openFile(f);
      });
      return;
    }
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
      new StatusModal(this.app, payload).open();
    });
  }

  refreshStatus() {
    if (!this.statusEl) return;
    this.runLos(['status', '--json'], (err, stdout) => {
      if (err) { this.statusEl.setText('LOS: cli unavailable'); return; }
      try {
        const p = JSON.parse(stdout);
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
        this.statusEl.setAttribute('aria-label',
          'LearningOS: validation + next exam (click for status)');
      } catch (e) {
        this.statusEl.setText('LOS: bad status json');
      }
    });
  }

  onload() {
    this.addRibbonIcon('home', 'LearningOS: reading room', () => this.openReadingRoom());
    this.addRibbonIcon('inbox', 'LearningOS: capture to inbox', () => this.capture());
    this.addRibbonIcon('refresh-cw', 'LearningOS: rebuild views', () => this.rebuild());

    this.addCommand({ id: 'open-reading-room', name: 'Open reading room', callback: () => this.openReadingRoom() });
    this.addCommand({ id: 'capture', name: 'Capture to inbox', callback: () => this.capture() });
    this.addCommand({ id: 'rebuild-views', name: 'Rebuild generated views', callback: () => this.rebuild() });
    this.addCommand({ id: 'validate', name: 'Validate repository', callback: () => this.validateRepo() });
    this.addCommand({ id: 'status', name: 'Show status', callback: () => this.showStatus() });
    this.addCommand({ id: 'open-concept-canvas', name: 'Open concept canvas', callback: async () => {
      const f = this.app.vault.getAbstractFileByPath('generated/concept-canvas.canvas');
      if (!f) { new Notice('concept-canvas.canvas missing — run Rebuild views'); return; }
      await this.app.workspace.getLeaf(false).openFile(f);
    } });

    this.statusEl = this.addStatusBarItem();
    this.statusEl.setText('LOS …');
    this.statusEl.style.cursor = 'pointer';
    this.registerDomEvent(this.statusEl, 'click', () => this.showStatus());

    this.app.workspace.onLayoutReady(() => {
      this.refreshStatus();
      this.registerInterval(window.setInterval(() => this.refreshStatus(), STATUS_REFRESH_MS));
      if (!this.app.workspace.getActiveFile()) this.openReadingRoom();
    });
  }
};
