import type {
  LibraryCollectionV1,
  LibraryFolderLayoutV1,
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
import type { FinderContext, FinderEntry } from './finder-tree';

/** What the folder browser is allowed to know and do. */
export interface LibraryFinderHost {
  readonly plugin: LibraryPlugin;
  /** The folder currently open, as a list of parent-relative segments. */
  readonly folderPath: readonly string[];
  /** The selected entry's segment inside the open folder, or null. */
  readonly folderSelection: string | null;
  readonly folderLayout: LibraryFolderLayoutV1;
  /** Filter text, scoped to the open folder. */
  readonly query: string;
  /**
   * The tree context for this render. The view builds it once and hands out the
   * same object, so one render is one pass over the projection.
   */
  finderContext(): FinderContext;
  /** Sources the projection holds, and how many the folders reach. */
  coverage(): { readonly total: number; readonly reached: number };
  openFolder(
    path: readonly string[],
    selected?: string | null,
  ): Promise<void>;
  /** Up one level, selecting the folder just left — as a file manager does. */
  openEnclosingFolder(): Promise<void>;
  selectFolderEntry(segment: string | null): Promise<void>;
  /**
   * True once, when the selection was just moved and focus should follow it.
   *
   * Moving the selection re-renders the folder, which destroys the focused row
   * — so without this the second arrow key press has nothing to act on. Reading
   * it clears it, because a render that merely restores a route must not steal
   * focus from wherever the learner actually is.
   */
  takeFolderFocus(): boolean;
  setFolderLayout(layout: LibraryFolderLayoutV1): Promise<void>;
  setFolderQuery(query: string): Promise<void>;
  /** Open a folder, or hand a leaf to whatever opens that kind of thing. */
  activateEntry(entry: FinderEntry): Promise<void>;
}

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
