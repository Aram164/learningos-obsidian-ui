import { renderRecordActions, renderAttachments, renderRelated, renderSourceDetail, renderTechnical } from '../features/library/detail';
import { renderRecordRow, renderSourcePage, renderTopicPackPage, renderCataloguePage, renderOrderedCollection, renderLegacyList } from '../features/library/collections';
import { renderHome, renderCollectionSwitch, renderGroup } from '../features/library/home';
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
}
