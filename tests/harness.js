/* Minimal Obsidian stub + DOM shim so the plugin can be exercised in Node.
 * Not a browser: just enough of Obsidian's DOM sugar and plugin base classes
 * to render the dashboard and assert on the output. Hard rule 1 (develop
 * against fixtures, never the live vault) applies — the fake vault below is
 * built from fixture-vault/, never from ../repository/. */
'use strict';

const Module = require('module');

/* ------------------------------------------------------------ DOM shim */

class El {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.classes = new Set();
    this.text = '';
    this._attrs = {};
    this.style = {};
    this.value = '';
    this.listeners = {};
    this.classList = {
      add: (...c) => c.forEach((x) => this.classes.add(x)),
      remove: (...c) => c.forEach((x) => this.classes.delete(x)),
      toggle: (c, on) => (on ? this.classes.add(c) : this.classes.delete(c)),
      contains: (c) => this.classes.has(c),
    };
  }
  _spawn(tag, o = {}) {
    const e = new El(tag);
    if (o.cls) String(o.cls).split(/\s+/).filter(Boolean).forEach((c) => e.classes.add(c));
    if (o.text != null) e.text = String(o.text);
    if (o.attr) Object.assign(e._attrs, o.attr);
    this.children.push(e);
    return e;
  }
  createEl(tag, o) { return this._spawn(tag, o); }
  createDiv(o) { return this._spawn('div', o); }
  createSpan(o) { return this._spawn('span', o); }
  empty() { this.children = []; this.text = ''; return this; }
  addClass(...c) { c.forEach((x) => this.classes.add(x)); return this; }
  removeClass(...c) { c.forEach((x) => this.classes.delete(x)); return this; }
  toggleClass(c, on) { this.classList.toggle(c, on); return this; }
  setText(t) { this.text = String(t); return this; }
  setAttr(k, v) { this._attrs[k] = v; return this; }
  setAttrs(attrs) { Object.assign(this._attrs, attrs); return this; }
  setAttribute(k, v) { return this.setAttr(k, v); }
  getAttribute(k) {
    return Object.prototype.hasOwnProperty.call(this._attrs, k)
      ? String(this._attrs[k])
      : null;
  }
  hasAttribute(k) {
    return Object.prototype.hasOwnProperty.call(this._attrs, k);
  }
  removeAttribute(k) {
    delete this._attrs[k];
    return this;
  }
  dispatchEvent(event) {
    const type = event && event.type ? event.type : String(event);
    this.fire(type, event);
    return true;
  }
  remove() { return this; }
  focus() { return this; }
  addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  fire(ev, extra) {
    const e = Object.assign({ preventDefault() {}, stopPropagation() {} }, extra);
    (this.listeners[ev] || []).forEach((f) => f(e));
    return this;
  }
  /* helpers for assertions */
  allText() {
    return [this.text, ...this.children.map((c) => c.allText())]
      .filter(Boolean).join(' ');
  }
  find(cls) {
    const hits = [];
    if (this.classes.has(cls)) hits.push(this);
    for (const c of this.children) hits.push(...c.find(cls));
    return hits;
  }
  /** First descendant carrying `cls` whose text contains `needle`. */
  findText(cls, needle) {
    return this.find(cls).find((e) => e.allText().includes(needle)) || null;
  }
}

/* --------------------------------------------------------- obsidian stub */

class Notice {
  constructor(msg) { Notice.log.push(String(msg)); }
}
Notice.log = [];

class Modal {
  constructor(app) { this.app = app; this.contentEl = new El('div'); }
  open() { Modal.last = this; this.onOpen(); }
  close() { this.onClose && this.onClose(); }
  onOpen() {}
  onClose() {}
}

class Setting {
  constructor(el) { this.el = el.createDiv({ cls: 'setting-item' }); }
  setName(n) { this.name = n; return this; }
  setDesc(d) { this.desc = d; return this; }
  addText(cb) {
    const control = {
      setValue() { return this; },
      setPlaceholder() { return this; },
      onChange() { return this; },
    };
    cb(control);
    return this;
  }
  addToggle(cb) { cb({ setValue: () => ({ onChange: () => {} }) }); return this; }
  addButton(cb) {
    cb({
      setButtonText() { return this; },
      setCta() { return this; },
      onClick() { return this; },
    });
    return this;
  }
}

class SuggestModal {
  constructor(app) { this.app = app; this.query = ''; }
  setPlaceholder(p) { this.placeholder = p; }
  setInstructions(i) { this.instructions = i; }
  open() { SuggestModal.last = this; }
  close() {}
  /** test helper: run the real getSuggestions/renderSuggestion pipeline */
  probe(query) {
    const hits = this.getSuggestions(query);
    const rendered = hits.slice(0, 5).map((h) => {
      const el = new El('div');
      this.renderSuggestion(h, el);
      return el;
    });
    return { hits, rendered };
  }
}

class ItemView {
  constructor(leaf) {
    this.leaf = leaf;
    this.app = leaf.app;
    this.contentEl = new El('div');
  }
}

class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = new El('div');
  }
}

class Plugin {
  constructor(app) {
    this.app = app;
    this.views = {};
    this.commands = [];
    this.ribbons = [];
    this.events = [];
    this.intervals = [];
    this.settingTabs = [];
    this._data = {};
  }
  registerView(type, factory) { this.views[type] = factory; }
  addSettingTab(t) { this.settingTabs.push(t); }
  addRibbonIcon(icon, title, fn) { this.ribbons.push({ icon, title, fn }); return new El('div'); }
  addCommand(c) { this.commands.push(c); }
  addStatusBarItem() { return new El('div'); }
  registerDomEvent() {}
  registerEvent(e) { this.events.push(e); }
  registerInterval(i) { this.intervals.push(i); clearInterval(i); }
  async loadData() { return this._data; }
  async saveData(d) { this._data = d; }
}

function setIcon(el, name) { el.setAttr('data-icon', name); }

const stub = {
  Plugin, PluginSettingTab, ItemView, Modal, SuggestModal, Notice, Setting, setIcon,
};
const electronStub = {
  webUtils: { getPathForFile(file) { return file?.__path || ''; } },
};

const origLoad = Module._load;
Module._load = function patched(request, ...rest) {
  if (request === 'obsidian') return stub;
  if (request === 'electron') return electronStub;
  return origLoad.call(this, request, ...rest);
};

/* ------------------------------------------------------------- globals */

global.window = {
  setTimeout: (...a) => setTimeout(...a),
  clearTimeout: (...a) => clearTimeout(...a),
  setInterval: (...a) => setInterval(...a),
  clearInterval: (...a) => clearInterval(...a),
  moment: null,
};
global.document = { body: new El('body') };
/* Node 22 exposes a getter-only global `navigator`; add the clipboard the
 * plugin uses without replacing the object. */
try {
  if (!global.navigator) {
    Object.defineProperty(global, 'navigator', { value: {}, configurable: true });
  }
  if (!global.navigator.clipboard) {
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText() {} }, configurable: true,
    });
  }
} catch (e) { /* clipboard action is best-effort in tests */ }

/* --------------------------------------------------------- fake vault */

const fs = require('fs');
const path = require('path');

class TFile {
  constructor(vaultRoot, rel) {
    this.path = rel;
    this.name = path.basename(rel);
    this.basename = this.name.replace(/\.md$/, '');
    this.extension = path.extname(rel).slice(1);
    this.stat = { mtime: fs.statSync(path.join(vaultRoot, rel)).mtimeMs };
    const dir = path.dirname(rel);
    this.parent = { name: path.basename(dir), path: dir };
  }
}

function walk(root, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(root, r));
    else out.push(r);
  }
  return out;
}

function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim().replace(/^["']|["']$/g, '');
    if (v === 'true') v = true;
    else if (v === 'false') v = false;
    fm[kv[1]] = v;
  }
  return fm;
}

function makeApp(vaultRoot) {
  const rels = walk(vaultRoot);
  const files = rels.map((r) => new TFile(vaultRoot, r));
  const byPath = new Map(files.map((f) => [f.path, f]));
  const folders = new Map();
  for (const r of rels) {
    let dir = path.dirname(r);
    while (dir && dir !== '.') {
      if (!folders.has(dir)) folders.set(dir, { path: dir, children: [] });
      dir = path.dirname(dir);
    }
  }
  for (const [p, folder] of folders) {
    folder.children = [
      ...files.filter((f) => path.dirname(f.path) === p),
      ...[...folders.values()].filter((g) => path.dirname(g.path) === p),
    ].map((c) => ({ ...c, name: path.basename(c.path) }));
  }

  const leaves = [];
  const app = {
    internalPlugins: {
      enabled: new Set(),
      getPluginById(id) { return { enabled: app.internalPlugins.enabled.has(id) }; },
    },
    vault: {
      adapter: {
        getBasePath: () => vaultRoot,
        exists: async (p) => fs.existsSync(path.join(vaultRoot, p)),
        read: async (p) => fs.readFileSync(path.join(vaultRoot, p), 'utf8'),
      },
      getMarkdownFiles: () => files.filter((f) => f.extension === 'md'),
      getAbstractFileByPath: (p) => byPath.get(p) || folders.get(p) || null,
      cachedRead: async (f) => fs.readFileSync(path.join(vaultRoot, f.path), 'utf8'),
      create: async (p) => { throw new Error(`test vault is read-only: ${p}`); },
      on: () => ({ off() {} }),
    },
    metadataCache: {
      getFileCache: (f) => ({
        frontmatter: parseFrontmatter(
          fs.readFileSync(path.join(vaultRoot, f.path), 'utf8')),
      }),
    },
    workspace: {
      activeFile: null,
      getActiveFile() { return this.activeFile; },
      getLeavesOfType(t) { return leaves.filter((l) => l.viewType === t); },
      iterateAllLeaves(callback) { for (const leaf of [...leaves]) callback(leaf); },
      makeLeaf(newTab, side) {
        const leaf = {
          app,
          viewType: null,
          view: null,
          pinned: false,
          side: side || 'main',
          newTab: !!newTab,
          detached: false,
          setPinned(v) { this.pinned = v; },
          detach() {
            this.detached = true;
            const i = leaves.indexOf(this);
            if (i >= 0) leaves.splice(i, 1);
          },
          async setViewState(st) {
            this.viewType = st.type;
            this.state = st.state || null;
            const factory = app._plugin.views[st.type];
            if (!factory) return; // e.g. core 'webviewer'
            this.view = factory(this);
            if (this.view.setState) await this.view.setState(this.state || {}, {});
            await this.view.onOpen();
          },
          async openFile(f) { app.workspace.opened.push(f.path); },
        };
        leaves.push(leaf);
        return leaf;
      },
      getLeaf(newTab) { return app.workspace.makeLeaf(newTab, 'main'); },
      getLeftLeaf() { return app.workspace.makeLeaf(false, 'left'); },
      getRightLeaf() { return app.workspace.makeLeaf(false, 'right'); },
      revealLeaf(l) { app.workspace.revealed = l; },
      setActiveLeaf(l) { app.workspace.active = l; },
      onLayoutReady(cb) { app.workspace._ready = cb; },
      leftSplit: { collapsed: false, collapse() { this.collapsed = true; } },
      rightSplit: { collapsed: false, collapse() { this.collapsed = true; } },
      detachLeavesOfType(t) {
        for (const l of leaves.filter((x) => x.viewType === t)) l.detach();
      },
      opened: [],
    },
  };
  return app;
}

module.exports = { El, Notice, makeApp, stub };
