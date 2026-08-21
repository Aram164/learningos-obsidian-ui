import { renderRecordActions, renderAttachments, renderRelated, renderSourceDetail, renderTechnical } from '../features/library/detail';
import { renderRecordRow, renderSourcePage, renderTopicPackPage, renderCataloguePage, renderOrderedCollection, renderLegacyList } from '../features/library/collections';
import { renderHome, renderCollectionSwitch, renderGroup } from '../features/library/home';
import { sourceFilterValuesFor, sourceMatchesFilters, sourceFilterTally, sourceFilterLabel, renderSourceBrowser, renderSourceFacets, renderFacetValues } from '../features/library/filters';
import {
  ItemView,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  empty,
  pageHeader,
} from '../components';
import { VIEW_LIBRARY } from '../constants';
import type {
  ProjectionRecord,
} from '../contracts/manifest';
import {
  asLibrarySourceFilters,
  type LibraryCollectionV1,
  type LibrarySourceFiltersV1,
} from '../contracts/route-v1';
import {
  asString as projectedString,
  asStrings as projectedStrings,
} from '../projection/readers';

import {
  VALUED_FACETS,
  SourceFilterDimension,
  SourceFacet,
  LibraryScreen,
  LibraryViewState,
  LibraryRecordView,
  ShelfMembership,
  LibraryPlugin,
  readLibraryViewState,
  readLibraryRecord,
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
  /** Selected value within a valued facet (a topic id, a role, a type, a
   *  module id). Null means "show the values to pick from". */
  facetValue: string | null = null;
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
      this.leaf.state,
    );
    this.render();
  }

  shelfIndex(): Map<string, ShelfMembership[]> {
    if (
      this._shelfIndex
      && this._shelfSnapshot
        === this.plugin.store.snapshotId
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

    return index;
  }

  matchesSourceFacet(
    record: ProjectionRecord,
  ): boolean {
    const source =
      readLibraryRecord(record);

    if (!source) {
      return false;
    }

    if (this.facet === 'all') {
      return true;
    }

    if (this.facet === 'local') {
      return Boolean(
        source.materialExists
        || source.materialPath,
      );
    }

    if (this.facet === 'online') {
      return Boolean(source.url);
    }

    if (this.facet === 'in-unit') {
      return (
        this.plugin.store
          .useUnits(source.id)
          .length > 0
      );
    }

    // Valued facets. With no value chosen the picker is showing its options, so
    // everything passes and the counts stay honest.
    if (VALUED_FACETS.has(this.facet)) {
      if (!this.facetValue) {
        return true;
      }
      return this.facetValuesFor(source)
        .includes(this.facetValue);
    }

    return true;
  }

  /** Which values of the ACTIVE facet this source participates in.
   *
   *  Deliberately returns a list, not a value: a source belongs to several
   *  topics, serves several purposes and is used by several modules at once.
   *  Collapsing that to one would rebuild the single-placement tree ADR-009
   *  exists to remove. Every field here is read from the projection — the UI
   *  never parses generated/library.md, which is the human view of the same
   *  facts. */
  facetValuesFor(
    source: LibraryRecordView,
  ): string[] {
    if (this.facet === 'topic') {
      return projectedStrings(
        source.record.topics,
      );
    }
    if (this.facet === 'form') {
      return source.sourceType
        ? [source.sourceType]
        : [];
    }
    if (this.facet === 'purpose') {
      const roles = new Set<string>();
      for (
        const evaluation of source.evaluations
      ) {
        for (
          const role of evaluation.roles
        ) {
          roles.add(role);
        }
      }
      return [...roles];
    }
    if (this.facet === 'use') {
      // Compatibility for old persisted single-facet routes. Current use is a
      // Core-owned source→module relation; never reconstruct it through units.
      return this.plugin.store
        .useModules(source.id)
        .map(
          (module) =>
            projectedString(module.id),
        )
        .filter(
          (id): id is string =>
            id !== null,
        );
    }
    return [];
  }

  /** Value → source count for the active facet, with overlap preserved. */
  facetTally(
    sources: LibraryRecordView[],
  ): Map<string, number> {
    const tally = new Map<string, number>();
    for (const source of sources) {
      for (
        const value of this.facetValuesFor(source)
      ) {
        tally.set(
          value,
          (tally.get(value) ?? 0) + 1,
        );
      }
    }
    return tally;
  }

  /** Human label for a facet value. Topics carry titles in the projection;
   *  everything else is already readable. */
  facetValueLabel(
    value: string,
  ): string {
    if (this.facet === 'topic') {
      const topic = this.plugin.store
        .topics()
        .find(
          (row) =>
            projectedString(row.id) === value,
        );
      return topic
        ? projectedString(topic.title) ?? value
        : value;
    }
    if (this.facet === 'use') {
      const module =
        this.plugin.store.get(value);
      return module
        ? projectedString(module.title) ?? value
        : value;
    }
    return value;
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

    renderSourceFacets(
    parent: HTMLElement,
  ): void {
    renderSourceFacets(this, parent);
  }

  /** The values of the active valued facet, with counts.
   *
   *  This is the part that answers "the Library is a sea of ML". A domain
   *  heading says 73; this says Deep Learning 22 · ML Compilation 4 · … and
   *  lets those add to more than 73, because a source really does belong to
   *  several at once. */
    renderFacetValues(
    parent: HTMLElement,
    sources: LibraryRecordView[],
  ): void {
    renderFacetValues(this, parent, sources);
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
