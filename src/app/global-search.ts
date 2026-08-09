import { Modal, type App } from 'obsidian';
import { button, empty } from '../components';
import type { ProjectionRecord } from '../contracts/manifest-v4';
import type { ManifestStore } from '../manifest-store';
import type { ApplicationRouter } from './router';

interface SearchCandidate {
  id: string;
  title: string;
  aliases: string[];
  authors: string[];
  kind: string;
  subtitle: string;
  open: () => unknown;
}

type SearchFilter =
  | 'all'
  | 'learning'
  | 'sources'
  | 'projects';

type SearchStore = Pick<
  ManifestStore,
  | 'modules'
  | 'projects'
  | 'units'
  | 'sources'
  | 'topicPacks'
  | 'of'
  | 'get'
>;

type SearchRouter = Pick<
  ApplicationRouter,
  | 'openOverlay'
  | 'updateOverlay'
  | 'clearOverlay'
>;

interface GlobalSearchPlugin {
  readonly router: SearchRouter;
  readonly store: SearchStore;

  openModule(id: string): unknown;
  openProject(id: string): unknown;
  openUnit(id: string): unknown;
  openLibrary(id: string, recordType: string): unknown;
  openTopicPackDetail(id: string): unknown;
}

/**
 * Structural LearningOS search.
 *
 * This is intentionally manifest-only. It searches projected identities and
 * routes to the owning product screen; it does not index canonical files and
 * does not depend on Omnisearch. Full-text/OCR search remains an optional,
 * separate integration.
 */
export class GlobalSearchModal extends Modal {
  private readonly plugin: GlobalSearchPlugin;
  private query: string;
  private filter: SearchFilter;
  private input!: HTMLInputElement;
  private tabButtons: HTMLElement[] = [];
  private tabs!: HTMLDivElement;
  private results!: HTMLDivElement;

  constructor(
    app: App,
    plugin: GlobalSearchPlugin,
    initialQuery = '',
  ) {
    super(app);
    this.plugin = plugin;
    this.query = String(initialQuery || '');
    this.filter = 'all';
  }

  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass('los-root', 'los-global-search');
    this.plugin.router.openOverlay({ kind: 'global-search', query: this.query, filter: this.filter });

    const header = root.createDiv({ cls: 'los-search-header' });
    const copy = header.createDiv();
    copy.createDiv({ cls: 'los-kicker', text: 'Search LearningOS' });
    copy.createEl('h2', { text: 'Find a module, unit, source, or project' });
    button(header, 'Close', () => this.close(), 'quiet').setAttribute('aria-label', 'Close global search');

    this.input = root.createEl('input', {
      cls: 'los-search los-global-search-input',
      attr: {
        type: 'search',
        placeholder: 'Search titles, aliases, authors, and IDs',
        'aria-label': 'Search LearningOS',
        autocomplete: 'off',
      },
    });
    this.input.value = this.query;
    this.input.addEventListener('input', () => {
      this.query = this.input.value;
      this.plugin.router.updateOverlay({ query: this.query });
      this.renderResults();
    });

    const tabs = root.createDiv({ cls: 'los-search-tabs', attr: { role: 'tablist', 'aria-label': 'Search result type' } });
    this.tabButtons = [];
    for (const [id, label] of [
      ['all', 'All'],
      ['learning', 'Modules & units'],
      ['sources', 'Learning sources'],
      ['projects', 'Projects'],
    ] as const) {
      const tab = button(tabs, label, () => {
        this.filter = id;
        this.plugin.router.updateOverlay({ filter: id });
        this.renderTabs();
        this.renderResults();
      }, 'tertiary');
      tab.addClass('los-search-tab');
      tab.setAttrs({ role: 'tab', 'data-filter': id, 'aria-selected': String(this.filter === id) });
      this.tabButtons.push(tab);
    }

    this.tabs = tabs;
    this.results = root.createDiv({ cls: 'los-search-results', attr: { 'aria-live': 'polite' } });
    this.renderTabs();
    this.renderResults();
    this.input.focus();
  }

  onClose() {
    this.plugin.router.clearOverlay();
    this.contentEl.empty();
  }

  renderTabs() {
    for (const tab of this.tabButtons || []) {
      const active = tab.getAttribute('data-filter') === this.filter;
      tab.toggleClass('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    }
  }

  candidates(): SearchCandidate[] {
    const rows: SearchCandidate[] = [];
    const add = (
      record: ProjectionRecord,
      kind: SearchCandidate['kind'],
      subtitle: string,
      open: () => unknown,
    ): void => {
      if (!record?.id || !record?.title) return;
      rows.push({
        id: record.id,
        title: record.title,
        aliases: [...(record.aliases || [])],
        authors: [...(record.authors || [])],
        kind,
        subtitle,
        open,
      });
    };

    for (const module of this.plugin.store.modules()) {
      if (!module.id) continue;
      const area = module.area_id
        ? this.plugin.store.get(module.area_id)?.title || module.code || 'Module'
        : module.code || 'Module';
      add(module, 'learning', `Module · ${area}`, () => this.plugin.openModule(module.id!));
    }
    for (const project of this.plugin.store.projects()) {
      if (!project.id) continue;
      add(project, 'projects', `Project · ${project.project_type || project.status || 'active'}`,
        () => this.plugin.openProject(project.id!));
    }
    for (const unit of this.plugin.store.units()) {
      if (!unit.id || !unit.module_id) continue;
      const module = this.plugin.store.get(unit.module_id);
      add(unit, 'learning', `Unit · ${module?.title || unit.module_id}`, () => this.plugin.openUnit(unit.id!));
    }
    for (const source of this.plugin.store.sources()) {
      if (!source.id) continue;
      const byline = (source.authors || []).join(', ') || source.organization || source.kind || 'Learning source';
      add(source, 'sources', `Learning source · ${byline}`, () => this.plugin.openLibrary(source.id!, 'source'));
    }
    for (const pack of this.plugin.store.topicPacks()) {
      if (!pack.id) continue;
      add(pack, 'sources', `Topic Pack · ${(pack.entries || []).length} items`,
        () => this.plugin.openTopicPackDetail(pack.id!));
    }
    for (const workspace of this.plugin.store.of('workspace')) {
      const linkedProject = workspace.project_id ? this.plugin.store.get(workspace.project_id) : null;
      if (!linkedProject) continue;
      if (!linkedProject.id) continue;
      add(workspace, 'projects', `Project workspace · ${linkedProject.title || linkedProject.id}`, () => this.plugin.openProject(linkedProject.id!));
    }
    return rows;
  }

  matches(candidate: SearchCandidate): boolean {
    const words = this.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const haystack = [candidate.id, candidate.title, candidate.subtitle,
      ...candidate.aliases, ...candidate.authors]
      .filter(Boolean).join(' ').toLocaleLowerCase();
    return words.every(
      (word: string) => haystack.includes(word),
    );
  }

  rankedCandidates(): SearchCandidate[] {
    const needle = this.query.toLocaleLowerCase().trim();
    return this.candidates()
      .filter((candidate) => this.filter === 'all' || candidate.kind === this.filter)
      .filter((candidate) => this.matches(candidate))
      .sort((left, right) => {
        const leftTitle = left.title.toLocaleLowerCase();
        const rightTitle = right.title.toLocaleLowerCase();
        const leftRank = !needle ? 2 : leftTitle === needle ? 0 : leftTitle.startsWith(needle) ? 1 : 2;
        const rightRank = !needle ? 2 : rightTitle === needle ? 0 : rightTitle.startsWith(needle) ? 1 : 2;
        return leftRank - rightRank || left.title.localeCompare(right.title);
      });
  }

  renderResults() {
    if (!this.results) return;
    this.results.empty();
    const rows = this.rankedCandidates();
    const summary = this.results.createDiv({ cls: 'los-search-summary' });
    summary.createSpan({ text: this.query.trim() ? `${rows.length} result${rows.length === 1 ? '' : 's'}` : 'Quick access' });
    summary.createSpan({ cls: 'los-micro', text: 'Manifest identities only' });

    if (!rows.length) {
      empty(this.results, 'No structural results',
        `Nothing in the current LearningOS projection matches “${this.query.trim()}”.`,
        'Clear search', () => {
          this.query = '';
          this.input.value = '';
          this.plugin.router.updateOverlay({ query: '' });
          this.renderResults();
          this.input.focus();
        });
      return;
    }

    const list = this.results.createDiv({ cls: 'los-search-result-list' });
    for (const row of rows.slice(0, 24)) {
      const result = list.createEl('button', {
        cls: 'los-search-result is-clickable',
        attr: { type: 'button', 'aria-label': `Open ${row.title}` },
      });
      const copy = result.createDiv({ cls: 'los-search-result-copy' });
      copy.createEl('strong', { text: row.title });
      copy.createDiv({ cls: 'los-micro', text: row.subtitle });
      result.createSpan({ cls: 'los-search-open', text: 'Open →' });
      result.addEventListener('click', () => {
        this.close();
        row.open();
      });
    }
    if (rows.length > 24) {
      this.results.createDiv({ cls: 'los-micro', text: `${rows.length - 24} more results. Refine the query to narrow the list.` });
    }
  }
}
