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
    this.attrs = {};
    this.style = {};
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
    if (o.attr) Object.assign(e.attrs, o.attr);
    this.children.push(e);
    return e;
  }
  createEl(tag, o) { return this._spawn(tag, o); }
  createDiv(o) { return this._spawn('div', o); }
  createSpan(o) { return this._spawn('span', o); }
  empty() { this.children = []; this.text = ''; return this; }
  addClass(...c) { c.forEach((x) => this.classes.add(x)); return this; }
  removeClass(...c) { c.forEach((x) => this.classes.delete(x)); return this; }
  setText(t) { this.text = String(t); return this; }
  setAttr(k, v) { this.attrs[k] = v; return this; }
  remove() { return this; }
  addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  fire(ev) { (this.listeners[ev] || []).forEach((f) => f({ preventDefault() {} })); }
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
}

/* --------------------------------------------------------- obsidian stub */

class Notice {
  constructor(msg) { Notice.log.push(String(msg)); }
}
Notice.log = [];

class Modal {
  constructor(app) { this.app = app; this.contentEl = new El('div'); }
  open() { this.onOpen(); }
  close() { this.onClose && this.onClose(); }
  onOpen() {}
  onClose() {}
}

class Setting {
  constructor(el) { this.el = el.createDiv({ cls: 'setting-item' }); }
  setName(n) { this.name = n; return this; }
  setDesc(d) { this.desc = d; return this; }
  addText(cb) { cb({ onChange: () => {} }); return this; }
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
  Plugin, PluginSettingTab, ItemView, Modal, Notice, Setting, setIcon,
};

const origLoad = Module._load;
Module._load = function patched(request, ...rest) {
  if (request === 'obsidian') return stub;
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
    vault: {
      adapter: { getBasePath: () => vaultRoot },
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
      _leaves: leaves,
      activeFile: null,
      getActiveFile() { return this.activeFile; },
      getLeavesOfType(t) { return leaves.filter((l) => l.viewType === t); },
      getLeaf(newTab) {
        const leaf = {
          app,
          viewType: null,
          view: null,
          pinned: false,
          newTab: !!newTab,
          setPinned(v) { this.pinned = v; },
          async setViewState(st) {
            this.viewType = st.type;
            this.view = app._plugin.views[st.type](this);
            await this.view.onOpen();
          },
          async openFile(f) { app.workspace.opened.push(f.path); },
        };
        leaves.push(leaf);
        return leaf;
      },
      revealLeaf(l) { app.workspace.revealed = l; },
      setActiveLeaf(l) { app.workspace.active = l; },
      onLayoutReady(cb) { app.workspace._ready = cb; },
      leftSplit: { collapsed: false, collapse() { this.collapsed = true; } },
      rightSplit: { collapsed: false, collapse() { this.collapsed = true; } },
      detachLeavesOfType() {},
      opened: [],
    },
  };
  return app;
}

module.exports = { El, Notice, makeApp, stub };
