import type {
  LibraryCollectionV1,
  LibrarySourceFiltersV1,
} from '../../contracts/route-v1';
import type {
  LibraryPlugin,
  LibraryRecordView,
  LibraryScreen,
  ShelfMembership,
  SourceFacet,
  SourceFilterDimension,
} from './model';

/** Host surface for Library collection and record pages. */
export interface LibraryCollectionsHost {
  readonly plugin: LibraryPlugin;
  readonly groupId: string | null;
  query: string;
  readonly facet: SourceFacet;
  readonly filters: LibrarySourceFiltersV1;
  readonly resourceId: string | null;
  readonly topicPackId: string | null;
  readonly catalogueId: string | null;
  readonly recordType: string;
  readonly domain: string;
  selectedElementId: string | null;
  render(): void;
  renderAttachments(
    detail: HTMLElement,
    record: LibraryRecordView,
  ): void;
  renderOrderedCollection(
    detail: HTMLElement,
    collection: LibraryRecordView,
    title: string,
  ): void;
  renderRecordActions(
    detail: HTMLElement,
    record: LibraryRecordView,
  ): void;
  renderRelated(
    detail: HTMLElement,
    record: LibraryRecordView,
  ): void;
  renderSourceDetail(
    detail: HTMLElement,
    record: LibraryRecordView,
  ): void;
  renderTechnical(
    detail: HTMLElement,
    record: LibraryRecordView,
  ): void;
}

/** Host surface for record-detail actions and relationships. */
export interface LibraryDetailHost {
  readonly plugin: LibraryPlugin;
  shelfIndex(): Map<string, ShelfMembership[]>;
}

/** Host surface for the peer-filtered source browser. */
export interface LibraryFiltersHost {
  readonly plugin: LibraryPlugin;
  screen: LibraryScreen;
  groupId: string | null;
  query: string;
  readonly filters: LibrarySourceFiltersV1;
  clearSourceFilters(): Promise<void>;
  clearSourceSearchAndFilters(): Promise<void>;
  rememberSourceBrowser(): Promise<unknown>;
  render(): void;
  renderCollectionSwitch(
    root: HTMLElement,
  ): void;
  renderRecordRow(
    list: HTMLElement,
    record: LibraryRecordView,
    isPack?: boolean,
  ): void;
  setSourceFilter(
    dimension: SourceFilterDimension,
    value: string,
  ): Promise<void>;
  sourceFilterLabel(
    dimension: SourceFilterDimension,
    value: string,
  ): string;
  sourceFilterTally(
    sources: LibraryRecordView[],
    dimension: SourceFilterDimension,
  ): Map<string, number>;
  sourceFilterValuesFor(
    source: LibraryRecordView,
    dimension: SourceFilterDimension,
  ): string[];
  sourceMatchesFilters(
    source: LibraryRecordView,
    omit?: SourceFilterDimension | null,
  ): boolean;
}

/** Host surface for Library collection navigation. */
export interface LibraryHomeHost {
  readonly plugin: LibraryPlugin;
  readonly collection: LibraryCollectionV1;
  readonly groupId: string | null;
  query: string;
  selectedElementId: string | null;
  rememberGroup(): Promise<unknown>;
  render(): void;
  renderCollectionSwitch(
    root: HTMLElement,
  ): void;
  renderRecordRow(
    list: HTMLElement,
    record: LibraryRecordView,
    isPack?: boolean,
  ): void;
  renderSourceBrowser(
    root: HTMLElement,
  ): void;
}
