import { renderRecordActions, renderAttachments, renderRelated, renderSourceDetail, renderTechnical } from '../features/library/detail';
import { renderRecordRow, renderSourcePage, renderTopicPackPage, renderCataloguePage, renderOrderedCollection, renderLegacyList } from '../features/library/collections';
import { renderHome, renderCollectionSwitch, renderGroup } from '../features/library/home';
import { renderFinder } from '../features/library/finder';
import {
  createFinderContext,
  reachableSourceIds,
  totalSourceCount,
  type FinderContext,
  type FinderEntry,
} from '../features/library/finder-tree';
import { sourceFilterValuesFor, sourceMatchesFilters, sourceFilterTally, sourceFilterLabel, renderSourceBrowser } from '../features/library/filters';
import {
  ItemView,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  empty,
  pageHeader,
} from '../components';
import { VIEW_LIBRARY } from '../constants';
import {
  asLibrarySourceFilters,
  type LibraryCollectionV1,
  type LibraryFolderLayoutV1,
  type LibrarySourceFiltersV1,
} from '../contracts/route-v1';
import {
  SourceFilterDimension,
  SourceFacet,
  LibraryScreen,
  LibraryViewState,
  LibraryRecordView,
  ShelfMembership,
  LibraryPlugin,
  readLibraryViewState,
  readLibraryRecords,
} from '../features/library/model';

/**
 * Library navigation is deliberately full-page: choose a collection, choose a
 * core-projected thematic group, then open one record. No default selection and
 * no permanent master/detail columns.
 */
export class LibraryView extends ItemView {
  readonly plugin: LibraryPlugin;

  screen: LibraryScreen = 'home';
  collection: LibraryCollectionV1 = 'sources';
  groupId: string | null = null;
  query = '';
  facet: SourceFacet = 'all';
  filters: LibrarySourceFiltersV1 =
    asLibrarySourceFilters(null);
  resourceId: string | null = null;
  topicPackId: string | null = null;
  catalogueId: string | null = null;
  recordType = 'note';
  domain = '';
  selectedElementId: string | null = null;

  folderPath: string[] = [];
  folderSelection: string | null = null;
  folderLayout: LibraryFolderLayoutV1 = 'list';

  /*
   * One tree context per render, and one coverage count per projection.
   *
   * `createFinderContext` makes a single pass over the registry; the columns
   * layout asks for one folder per level of depth, so handing out the same
   * context is what keeps a deep folder as cheap as a shallow one. Coverage is
   * cached harder — answering it walks every folder and touches the disk once
   * per source with local material, which must not happen per keystroke in the
   * filter box.
   */
  private _finderContext: FinderContext | null = null;

  private _coverage: { total: number; reached: number } | null = null;

  private _coverageSnapshot: string | null = null;

  /*
   * Two manifests can carry the same snapshot id, so the identity of the loaded
   * data is part of the cache key — the same lesson `shelfIndex` already
   * learned, and the same one its suite pins.
   */
  private _coverageData: object | null = null;

  private _focusSelection = false;

  private _shelfIndex:
    Map<string, ShelfMembership[]> | null = null;

  private _shelfSnapshot:
    string | null = null;

  private _shelfData:
    object | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: LibraryPlugin,
  ) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_LIBRARY;
  }

  getDisplayText(): string {
    return 'LearningOS · Library';
  }

  applyState(
    state: unknown = {},
  ): void {
    const parsed = readLibraryViewState(
      state,
      this.collection,
      this.recordType,
    );

    this.screen = parsed.screen;
    this.collection = parsed.collection;
    this.groupId = parsed.groupId;
    this.query = parsed.query;
    this.facet = parsed.facet;
    this.filters = parsed.filters;
    this.resourceId = parsed.resourceId;
    this.topicPackId = parsed.topicPackId;
    this.catalogueId = parsed.catalogueId;
    this.recordType = parsed.recordType;
    this.domain = parsed.domain;
    this.folderPath = parsed.folderPath;
    this.folderSelection = parsed.folderSelection;
    this.folderLayout = parsed.folderLayout;
  }

  async setState(
    state: unknown = {},
  ): Promise<void> {
    this.applyState(state);
    this.render();
  }

  getState(): LibraryViewState {
    return {
      screen: this.screen,
      collection: this.collection,
      groupId: this.groupId,
      query: this.query,
      facet: this.facet,
      filters: { ...this.filters },
      resourceId: this.resourceId,
      topicPackId: this.topicPackId,
      catalogueId: this.catalogueId,
      recordType: this.recordType,
      domain: this.domain,
      folderPath: [...this.folderPath],
      folderSelection: this.folderSelection,
      folderLayout: this.folderLayout,
    };
  }

  async onOpen(): Promise<void> {
    this.applyState(
      this.leaf.getViewState().state,
    );
    this.render();
  }

  shelfIndex(): Map<string, ShelfMembership[]> {
    if (
      this._shelfIndex
      && this._shelfSnapshot
        === this.plugin.store.snapshotId
      && this._shelfData
        === this.plugin.store.data
    ) {
      return this._shelfIndex;
    }

    const index =
      new Map<string, ShelfMembership[]>();

    const shelves = readLibraryRecords([
      ...this.plugin.store.catalogues(),
      ...this.plugin.store.topicPacks(),
    ]);

    for (const shelf of shelves) {
      for (const entry of shelf.entries) {
        const membership: ShelfMembership = {
          shelf,
          group: entry.group,
          why: entry.why,
        };

        const current =
          index.get(entry.sourceId);

        if (current) {
          current.push(membership);
        } else {
          index.set(
            entry.sourceId,
            [membership],
          );
        }
      }
    }

    this._shelfIndex = index;
    this._shelfSnapshot =
      this.plugin.store.snapshotId;
    this._shelfData =
      this.plugin.store.data;

    return index;
  }

  render(): void {
    const root = this.contentEl;

    // A render is one read of the projection. Dropping the cached context here
    // is what makes that true without any folder having to remember to.
    this._finderContext = null;

    root.empty();
    root.addClass(
      'los-root',
      'los-library-view',
    );

    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        'Library',
        'Projection unavailable',
      );

      empty(
        root,
        'The interface contract could not be loaded',
        this.plugin.store.error,
        'Rebuild views',
        () => this.plugin.generate(),
      );

      return;
    }

    if (this.screen === 'folder') {
      this.renderFinder(root);
      return;
    }

    if (this.screen === 'group') {
      if (this.collection === 'sources') {
        this.renderSourceBrowser(root);
      } else {
        this.renderGroup(root);
      }
      return;
    }

    if (this.screen === 'source-detail') {
      this.renderSourcePage(root);
      return;
    }

    if (this.screen === 'topic-pack-detail') {
      this.renderTopicPackPage(root);
      return;
    }

    if (this.screen === 'catalogue-detail') {
      this.renderCataloguePage(root);
      return;
    }

    if (this.screen === 'legacy-list') {
      this.renderLegacyList(root);
      return;
    }

    this.renderHome(root);
  }

    sourceFilterValuesFor(
    source: LibraryRecordView,
    dimension: SourceFilterDimension,
  ): string[] {
    return sourceFilterValuesFor(this, source, dimension);
  }

    sourceMatchesFilters(
    source: LibraryRecordView,
    omit: SourceFilterDimension | null = null,
  ): boolean {
    return sourceMatchesFilters(this, source, omit);
  }

    sourceFilterTally(
    sources: LibraryRecordView[],
    dimension: SourceFilterDimension,
  ): Map<string, number> {
    return sourceFilterTally(this, sources, dimension);
  }

    sourceFilterLabel(
    dimension: SourceFilterDimension,
    value: string,
  ): string {
    return sourceFilterLabel(this, dimension, value);
  }

  async rememberSourceBrowser(): Promise<unknown> {
    return this.plugin.router.remember({
      name: 'library-home',
      collection: 'sources',
      query: this.query,
      filters: { ...this.filters },
    });
  }

  async setSourceFilter(
    dimension: SourceFilterDimension,
    value: string,
  ): Promise<void> {
    this.filters = {
      ...this.filters,
      [dimension]: value,
    };

    // A source-group deep link is only an entry point. Once the learner
    // changes any facet, navigation becomes the canonical global browser.
    this.screen = 'home';
    this.groupId = null;

    await this.rememberSourceBrowser();
    this.render();
  }

  async clearSourceFilters(): Promise<void> {
    this.filters =
      asLibrarySourceFilters(null);

    this.screen = 'home';
    this.groupId = null;

    await this.rememberSourceBrowser();
    this.render();
  }

  async clearSourceSearchAndFilters(): Promise<void> {
    this.query = '';
    this.filters =
      asLibrarySourceFilters(null);

    this.screen = 'home';
    this.groupId = null;

    await this.rememberSourceBrowser();
    this.render();

    const search = typeof this.contentEl.querySelector === 'function'
      ? this.contentEl.querySelector<HTMLInputElement>(
        '.los-library-global-search',
      )
      : null;
    search?.focus();
  }

    renderSourceBrowser(
    root: HTMLElement,
  ): void {
    renderSourceBrowser(this, root);
  }

    renderHome(
    root: HTMLElement,
  ): void {
    renderHome(this, root);
  }

    renderCollectionSwitch(
    root: HTMLElement,
  ): void {
    renderCollectionSwitch(this, root);
  }

    renderGroup(
    root: HTMLElement,
  ): void {
    renderGroup(this, root);
  }

  async rememberGroup(): Promise<unknown> {
    if (!this.groupId) {
      return undefined;
    }

    return this.plugin.router.remember({
      name: 'library-group',
      collection: this.collection,
      groupId: this.groupId,
      query: this.query,
      facet: this.facet,
    });
  }

    renderRecordRow(
    list: HTMLElement,
    record: LibraryRecordView,
    isPack = false,
  ): void {
    renderRecordRow(this, list, record, isPack);
  }

    renderSourcePage(
    root: HTMLElement,
  ): void {
    renderSourcePage(this, root);
  }

    renderTopicPackPage(
    root: HTMLElement,
  ): void {
    renderTopicPackPage(this, root);
  }

    renderCataloguePage(
    root: HTMLElement,
  ): void {
    renderCataloguePage(this, root);
  }

    renderOrderedCollection(
    detail: HTMLElement,
    collection: LibraryRecordView,
    title: string,
  ): void {
    renderOrderedCollection(this, detail, collection, title);
  }

    renderLegacyList(
    root: HTMLElement,
  ): void {
    renderLegacyList(this, root);
  }

    renderRecordActions(
    detail: HTMLElement,
    record: LibraryRecordView,
  ): void {
    renderRecordActions(this, detail, record);
  }

    renderAttachments(
    detail: HTMLElement,
    record: LibraryRecordView,
  ): void {
    renderAttachments(this, detail, record);
  }

    renderRelated(
    detail: HTMLElement,
    record: LibraryRecordView,
  ): void {
    renderRelated(this, detail, record);
  }

    renderSourceDetail(
    detail: HTMLElement,
    record: LibraryRecordView,
  ): void {
    renderSourceDetail(this, detail, record);
  }

    renderTechnical(
    detail: HTMLElement,
    record: LibraryRecordView,
  ): void {
    renderTechnical(this, detail, record);
  }

  // ------------------------------------------------------- folder browser

  finderContext(): FinderContext {
    if (!this._finderContext) {
      this._finderContext = createFinderContext(
        this.plugin.store,
        {
          isDirectory: (path) =>
            this.plugin.isMaterialFolder(path),
          list: (path) =>
            this.plugin.listMaterialFolder(path),
          count: (path) =>
            this.plugin.materialFolderCount(path),
        },
      );
    }
    return this._finderContext;
  }

  coverage(): { total: number; reached: number } {
    const snapshot = this.plugin.store.snapshotId;
    const data = this.plugin.store.data;
    if (this._coverage
      && this._coverageSnapshot === snapshot
      && this._coverageData === data) {
      return this._coverage;
    }
    const context = this.finderContext();
    const coverage = {
      total: totalSourceCount(context),
      reached: reachableSourceIds(context).size,
    };
    this._coverage = coverage;
    this._coverageSnapshot = snapshot;
    this._coverageData = data;
    return coverage;
  }

  takeFolderFocus(): boolean {
    const focus = this._focusSelection;
    this._focusSelection = false;
    return focus;
  }

  async openFolder(
    path: readonly string[],
    selected: string | null = null,
  ): Promise<void> {
    this.folderPath = [...path];
    this.folderSelection = selected;
    // The filter is scoped to a folder, so it does not travel to the next one.
    this.query = '';
    await this.rememberFolder();
    this.render();
  }

  /**
   * Up one level, selecting the folder just left.
   *
   * Carrying the selection back up is what makes repeated "up" feel like a
   * file manager rather than a reset: you land on the thing you came out of,
   * with its siblings in view.
   */
  async openEnclosingFolder(): Promise<void> {
    if (!this.folderPath.length) return;
    const leaving = this.folderPath[this.folderPath.length - 1] ?? null;
    await this.openFolder(this.folderPath.slice(0, -1), leaving);
  }

  async selectFolderEntry(segment: string | null): Promise<void> {
    this.folderSelection = segment;
    // Rendering rebuilds the rows, so the row that had focus is gone. Focus
    // follows the selection it just moved, or arrow-key navigation stops
    // working after exactly one press.
    this._focusSelection = true;
    await this.rememberFolder();
    this.render();
  }

  async setFolderLayout(layout: LibraryFolderLayoutV1): Promise<void> {
    this.folderLayout = layout;
    await this.rememberFolder();
    this.render();
  }

  async setFolderQuery(query: string): Promise<void> {
    this.query = query;
    await this.rememberFolder();
    this.render();
  }

  /**
   * Open whatever this entry is.
   *
   * A folder navigates. A leaf is handed to the opener that knows its kind:
   * a projected source goes through `openResource`, which already decides
   * between a local file, a page destination and a web target; a plain file
   * under `materials/` goes straight to the system opener.
   */
  async activateEntry(entry: FinderEntry): Promise<void> {
    if (entry.isFolder) {
      await this.openFolder([...this.folderPath, entry.segment]);
      return;
    }
    if (entry.sourceId) {
      const source = this.plugin.store.get(entry.sourceId);
      if (source) {
        this.plugin.openResource(source);
        return;
      }
    }
    if (entry.materialPath) {
      this.plugin.openMaterialPath(entry.materialPath);
    }
  }

  async rememberFolder(): Promise<unknown> {
    return this.plugin.router.remember({
      name: 'library-folder',
      path: [...this.folderPath],
      selected: this.folderSelection,
      layout: this.folderLayout,
      query: this.query,
    });
  }

    renderFinder(
    root: HTMLElement,
  ): void {
    renderFinder(this, root);
  }
}
