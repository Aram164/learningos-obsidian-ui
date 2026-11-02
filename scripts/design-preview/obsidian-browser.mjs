/*
 * Just enough of Obsidian, in a browser, to look at an interface design.
 *
 * Not a test double for behaviour: `tests/harness.js` is that. This exists so a
 * design can be compared with its Figma frame in seconds, against a manifest, with
 * no vault and no way to write. Host chrome and Obsidian's own stylesheet are not
 * here, so it never stands in for checking the real app.
 */
const GLYPHS = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z', folder: 'M3 6h6l2 2h10v11H3z',
  'graduation-cap': 'M2 9l10-5 10 5-10 5zM6 11.5V16c3 2.5 9 2.5 12 0v-4.5',
  library: 'M4 4v16M9 4v16M14 5l5 15', map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
  leaf: 'M5 20c0-9 6-15 15-15 0 9-6 15-15 15zM5 20l8-8', 'circle-check': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12l3 3 5-6',
  ellipsis: 'M5 12h.01M12 12h.01M19 12h.01', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
  'chevron-right': 'M9 5l7 7-7 7', 'chevron-down': 'M5 9l7 7 7-7', check: 'M5 12l5 5 9-10', plus: 'M12 5v14M5 12h14',
  shield: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z', activity: 'M3 12h4l3-8 4 16 3-8h4', 'refresh-cw': 'M20 8a8 8 0 0 0-15-2M4 16a8 8 0 0 0 15 2M20 3v5h-5M4 21v-5h5',
};
export function setIcon(el, name) {
  el.replaceChildren();
  const d = GLYPHS[name] ?? 'M5 5h14v14H5z';
  el.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

const proto = HTMLElement.prototype;
const classes = (value) => (Array.isArray(value) ? value : String(value ?? '').split(/\s+/)).filter(Boolean);
Object.assign(proto, {
  createEl(tag, options = {}) {
    const el = document.createElement(tag);
    if (options.cls) el.classList.add(...classes(options.cls));
    if (options.text !== undefined) el.textContent = options.text;
    for (const [key, value] of Object.entries(options.attr ?? {})) {
      if (value !== null && value !== undefined && value !== false) el.setAttribute(key, value === true ? '' : String(value));
    }
    for (const key of ['title', 'type', 'value', 'placeholder', 'href']) if (options[key] !== undefined) el.setAttribute(key, options[key]);
    this.append(el);
    return el;
  },
  createDiv(options = {}) { return this.createEl('div', typeof options === 'string' ? { cls: options } : options); },
  createSpan(options = {}) { return this.createEl('span', typeof options === 'string' ? { cls: options } : options); },
  empty() { this.replaceChildren(); },
  addClass(...names) { this.classList.add(...names.flatMap(classes)); },
  addClasses(names) { this.classList.add(...names); },
  removeClass(...names) { this.classList.remove(...names.flatMap(classes)); },
  toggleClass(name, on) { for (const one of classes(name)) this.classList.toggle(one, on); },
  hasClass(name) { return this.classList.contains(name); },
  setAttr(key, value) { if (value === null || value === undefined) this.removeAttribute(key); else this.setAttribute(key, String(value)); },
  setAttrs(attrs) { for (const [key, value] of Object.entries(attrs)) this.setAttr(key, value); },
  setText(text) { this.textContent = text; },
  getText() { return this.textContent; },
});
DocumentFragment.prototype.createEl = proto.createEl;

export class Notice { constructor(message) { console.info('[Notice]', message); globalThis.__notices?.push(message); } hide() {} }

export class Modal {
  constructor(app) {
    this.app = app;
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'modal-container';
    this.modalEl = this.containerEl.createDiv({ cls: 'modal' });
    this.titleEl = this.modalEl.createDiv({ cls: 'modal-title' });
    this.contentEl = this.modalEl.createDiv({ cls: 'modal-content' });
  }
  open() { document.body.append(this.containerEl); this.onOpen?.(); }
  close() { this.onClose?.(); this.containerEl.remove(); }
}

export class Component {
  register() {} registerEvent() {} registerDomEvent(target, name, fn) { target.addEventListener(name, fn); } addChild() {} load() {} unload() {}
}

export class ItemView extends Component {
  constructor(leaf) {
    super();
    this.leaf = leaf;
    this.app = leaf.app;
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'workspace-leaf-content';
    this.containerEl.createDiv({ cls: 'view-header' });
    this.contentEl = this.containerEl.createDiv({ cls: 'view-content' });
  }
  getState() { return {}; }
  async setState() {}
  getIcon() { return 'circle'; }
}

export class PluginSettingTab {
  constructor(app, plugin) { this.app = app; this.plugin = plugin; this.containerEl = document.createElement('div'); }
}

export class Setting {
  constructor(parent) { this.el = parent.createDiv({ cls: 'setting-item' }); }
  setName(text) { this.el.createDiv({ cls: 'setting-item-name', text }); return this; }
  setDesc(text) { this.el.createDiv({ cls: 'setting-item-description', text }); return this; }
  addToggle() { return this; } addText() { return this; } addButton() { return this; } addDropdown() { return this; }
}

class Leaf {
  constructor(app, element) { this.app = app; this.element = element; this.view = null; this.state = { type: 'empty', state: {} }; }
  getViewState() { return this.state; }
  async setViewState(next) {
    this.state = { type: next.type, state: next.state ?? {}, active: next.active };
    if (this.view?.getViewType?.() !== next.type) {
      await this.view?.onClose?.();
      const factory = this.app.workspace.factories.get(next.type);
      this.view = factory ? factory(this) : null;
      this.element.replaceChildren();
      if (!this.view) return;
      this.view.containerEl.setAttribute('data-type', next.type);
      this.element.append(this.view.containerEl);
      await this.view.onOpen?.();
    }
    await this.view?.setState?.(next.state ?? {}, {});
  }
  updateHeader() {}
  detach() { this.view?.onClose?.(); this.view = null; this.state = { type: 'empty', state: {} }; this.element.replaceChildren(); }
  getDisplayText() { return this.view?.getDisplayText?.() ?? ''; }
  setPinned() {}
  get pinned() { return false; }
}

export class Plugin extends Component {
  constructor(app, manifest) { super(); this.app = app; this.manifest = manifest; }
  registerView(type, factory) { this.app.workspace.factories.set(type, factory); }
  addRibbonIcon() { return document.createElement('div'); }
  addCommand(command) { this.app.commands.set(command.id, command); return command; }
  addSettingTab(tab) { this.app.settingTab = tab; }
  async loadData() { return this.app.savedSettings ?? null; }
  async saveData(data) { this.app.savedSettings = JSON.parse(JSON.stringify(data)); }
}

export function makeApp(navEl, mainEl, manifestText) {
  const app = {
    commands: new Map(),
    savedSettings: null,
    vault: {
      on: () => ({}),
      getName: () => 'preview',
      adapter: {
        exists: async () => true,
        read: async (path) => { if (path.endsWith('manifest.json')) return manifestText; throw new Error(`Preview has no ${path}`); },
        // Settings stay in this page's memory. Anything else is refused.
        write: async (path, text) => {
          if (!path.endsWith('/data.json')) throw new Error('The preview cannot write.');
          app.savedSettings = JSON.parse(text);
        },
        getBasePath: () => '/preview-has-no-vault',
      },
      getAbstractFileByPath: () => null,
    },
    metadataCache: { on: () => ({}) },
    workspace: {
      factories: new Map(),
      on: () => ({}),
      navLeaf: null,
      mainLeaf: null,
      getLeavesOfType(type) { return [this.navLeaf, this.mainLeaf].filter((leaf) => leaf?.state.type === type); },
      getLeaf() { return this.mainLeaf; },
      getLeftLeaf() { return this.navLeaf; },
      getRightLeaf() { return null; },
      async revealLeaf() {},
      setActiveLeaf() {},
      get activeLeaf() { return this.mainLeaf; },
      getActiveViewOfType() { return this.mainLeaf.view; },
      iterateAllLeaves(fn) { fn(this.navLeaf); fn(this.mainLeaf); },
      detachLeavesOfType(type) { for (const leaf of this.getLeavesOfType(type)) leaf.detach(); },
      onLayoutReady(fn) { queueMicrotask(fn); },
      leftSplit: { setSize() {}, collapsed: false, expand() {} },
      rightSplit: { collapse() {} },
      containerEl: document.body,
      layoutReady: true,
    },
  };
  app.workspace.navLeaf = new Leaf(app, navEl);
  app.workspace.mainLeaf = new Leaf(app, mainEl);
  return app;
}
