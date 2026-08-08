import {
  ItemView,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  badge,
  button,
  chip,
  disclosure,
  empty,
  pageHeader,
  section,
} from '../components';
import { VIEW_LIBRARY } from '../constants';
import type {
  JsonRecord,
  ProjectionRecord,
} from '../contracts/manifest-v2';
import {
  asLibrarySourceFilters,
  type LibraryCollectionV1,
  type LibrarySourceFiltersV1,
} from '../contracts/route-v1';
import type { LearningOSUI } from '../main';

// ADR-009. The first four are availability facets — where a source physically
// is. They answer "can I open this now?", not "what is it about?", which is why
// the Library still felt like a sea of ML: you could filter 239 sources by
// whether they were downloaded, but not by subject, purpose or current use.
//
// The dimensions that answer the real question already existed in the Core
// (domain, topic, purpose = evaluation roles, form = source type, current use =
// module routes); they were simply never projected into the picker. These are
// facet MODES: choosing one reveals its values, and a source may appear under
// several of them at once. Overlapping counts are correct, not a bug.
export const SOURCE_FACETS = [
  ['all', 'All'],
  ['local', 'Local copy'],
  ['online', 'Online'],
  ['in-unit', 'Used in a unit'],
  ['topic', 'By topic'],
  ['purpose', 'By purpose'],
  ['form', 'By form'],
  ['use', 'By current use'],
] as const;

/** Facets whose value is chosen from a list rather than being a yes/no test. */
export const VALUED_FACETS = new Set([
  'topic',
  'purpose',
  'form',
  'use',
]);

const SOURCE_FILTER_DIMENSIONS = [
  ['domain', 'Domain'],
  ['topic', 'Topic'],
  ['purpose', 'Purpose'],
  ['form', 'Form'],
  ['use', 'Current use'],
] as const;

type SourceFilterDimension =
  (typeof SOURCE_FILTER_DIMENSIONS)[number][0];

const LIBRARY_COLLECTIONS = [
  ['sources', 'Learning Sources'],
  ['topic-packs', 'Topic Packs'],
] as const;

const RELATED_LABELS: Readonly<Record<string, string>> = {
  unit: 'Used in units',
  concept: 'Connected concepts',
  note: 'Referenced by notes',
  source: 'Related sources',
  collection: 'In catalogues',
  'topic-pack': 'In Topic Packs',
  module: 'Modules',
  workspace: 'Workspaces',
  program: 'Areas',
};

type SourceFacet =
  (typeof SOURCE_FACETS)[number][0];

type LibraryScreen =
  | 'home'
  | 'group'
  | 'source-detail'
  | 'topic-pack-detail'
  | 'catalogue-detail'
  | 'legacy-list';

interface LibraryViewState {
  readonly screen: LibraryScreen;
  readonly collection: LibraryCollectionV1;
  readonly groupId: string | null;
  readonly query: string;
  readonly facet: SourceFacet;
  readonly filters: LibrarySourceFiltersV1;
  readonly resourceId: string | null;
  readonly topicPackId: string | null;
  readonly catalogueId: string | null;
  readonly recordType: string;
  readonly domain: string;
}

interface ParsedLibraryViewState
  extends LibraryViewState {}

interface ThematicGroupView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

interface CollectionEntryView {
  readonly sourceId: string;
  readonly group: string | null;
  readonly why: string | null;
}

interface AttachmentView {
  readonly path: string;
  readonly label: string;
}

interface UsefulSectionView {
  readonly section: string;
  readonly note: string | null;
}

/**
 * One contextual evaluation, in the registry's own vocabulary.
 *
 * The previous shape read `verdict`, `scope` and `reading_plan`. None of the
 * three is in `sources.schema.json`, which is a closed schema — so `scope` and
 * `reading_plan` never existed, and `verdict` could only ever arrive null. The
 * card therefore rendered `useful_sections` and nothing else, while the roles,
 * strengths, weaknesses and level actually recorded against the source stayed
 * invisible.
 *
 * There is deliberately no summary line and no ordering here: the schema says
 * "no universal scalar ratings", so a source is described by what it is good
 * for, not ranked.
 */
interface EvaluationView {
  readonly roles: string[];
  readonly level: string | null;
  readonly audience: string[];
  readonly prerequisites: string[];
  readonly strengths: string[];
  readonly weaknesses: string[];
  readonly concepts: string[];
  readonly usefulSections: UsefulSectionView[];
}

interface LibraryRecordView {
  readonly record: ProjectionRecord;
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly summary: string;
  readonly purpose: string;
  readonly sourceType: string;
  readonly year: string;
  readonly organization: string;
  readonly materialExists: boolean;
  readonly materialPath: string | null;
  readonly url: string | null;
  readonly path: string | null;
  readonly role: string;
  readonly domain: string;
  readonly state: string;
  readonly aliases: string[];
  readonly authors: string[];
  readonly entries: CollectionEntryView[];
  readonly attachments: AttachmentView[];
  readonly evaluations: EvaluationView[];
}

interface ShelfMembership {
  readonly shelf: LibraryRecordView;
  readonly group: string | null;
  readonly why: string | null;
}

type LibraryPlugin = Pick<
  LearningOSUI,
  | 'back'
  | 'copyText'
  | 'generate'
  | 'openAuthoredPath'
  | 'openCatalogueDetail'
  | 'openFullTextSearch'
  | 'openLibraryGroup'
  | 'openLibraryHome'
  | 'openMaterialPath'
  | 'openRecord'
  | 'openResource'
  | 'openSourceDetail'
  | 'openTopicPackDetail'
  | 'openUnit'
  | 'router'
  | 'store'
>;

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function projectedString(
  value: unknown,
): string | null {
  return (
    typeof value === 'string'
    && value.length > 0
  )
    ? value
    : null;
}

function projectedText(
  value: unknown,
): string | null {
  if (
    typeof value !== 'string'
    && typeof value !== 'number'
  ) {
    return null;
  }

  const text = String(value);

  return text.length > 0
    ? text
    : null;
}

function projectedFlag(
  value: unknown,
): boolean {
  return (
    value === true
    || value === 1
    || value === 'true'
  );
}

function projectedRecords(
  value: unknown,
): ProjectionRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      candidate,
    ): candidate is ProjectionRecord =>
      isRecord(candidate),
  );
}

function projectedStrings(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      candidate,
    ): candidate is string =>
      typeof candidate === 'string'
      && candidate.length > 0,
  );
}

function isLibraryScreen(
  value: unknown,
): value is LibraryScreen {
  return (
    value === 'home'
    || value === 'group'
    || value === 'source-detail'
    || value === 'topic-pack-detail'
    || value === 'catalogue-detail'
    || value === 'legacy-list'
  );
}

function isLibraryCollection(
  value: unknown,
): value is LibraryCollectionV1 {
  return (
    value === 'sources'
    || value === 'topic-packs'
  );
}

function isSourceFacet(
  value: unknown,
): value is SourceFacet {
  return SOURCE_FACETS.some(
    ([facet]) => facet === value,
  );
}

function readLibraryViewState(
  value: unknown,
  currentCollection: LibraryCollectionV1,
  currentRecordType: string,
): ParsedLibraryViewState {
  if (!isRecord(value)) {
    return {
      screen: 'home',
      collection: currentCollection,
      groupId: null,
      query: '',
      facet: 'all',
      filters: asLibrarySourceFilters(null),
      resourceId: null,
      topicPackId: null,
      catalogueId: null,
      recordType: currentRecordType,
      domain: '',
    };
  }

  const recordId =
    projectedString(value.recordId);

  const screen = isLibraryScreen(
    value.screen,
  )
    ? value.screen
    : recordId
      ? 'legacy-list'
      : 'home';

  const collection = isLibraryCollection(
    value.collection,
  )
    ? value.collection
    : currentCollection;

  const groupId =
    projectedString(value.groupId)
    ?? projectedString(value.fromGroupId);

  let filters =
    asLibrarySourceFilters(value.filters);

  // `library-group` remains a compatibility/deep-link route for sources.
  // Its group identity becomes the Domain peer filter; the browser itself is
  // always the same global faceted surface.
  if (
    collection === 'sources'
    && screen === 'group'
    && groupId
    && !filters.domain
  ) {
    filters = {
      ...filters,
      domain: groupId,
    };
  }

  return {
    screen,
    collection,
    groupId,
    query:
      projectedString(value.query)
      ?? '',
    facet: isSourceFacet(value.facet)
      ? value.facet
      : 'all',
    filters,
    resourceId:
      projectedString(value.resourceId),
    topicPackId:
      projectedString(value.topicPackId),
    catalogueId:
      projectedString(value.catalogueId),
    recordType:
      projectedString(value.recordType)
      ?? currentRecordType,
    domain:
      projectedString(value.domain)
      ?? '',
  };
}

function readThematicGroup(
  value: unknown,
): ThematicGroupView | null {
  if (!isRecord(value)) {
    return null;
  }

  const id =
    projectedString(value.id);

  if (!id) {
    return null;
  }

  return {
    id,
    title:
      projectedString(value.title)
      ?? id,
    description:
      projectedText(value.description)
      ?? '',
  };
}

function readCollectionEntry(
  value: unknown,
): CollectionEntryView | null {
  if (!isRecord(value)) {
    return null;
  }

  const sourceId =
    projectedString(value.source);

  if (!sourceId) {
    return null;
  }

  return {
    sourceId,
    group:
      projectedText(value.group),
    why:
      projectedText(value.why),
  };
}

function readCollectionEntries(
  value: unknown,
): CollectionEntryView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(readCollectionEntry)
    .filter(
      (
        entry,
      ): entry is CollectionEntryView =>
        entry !== null,
    );
}

function readAttachment(
  value: unknown,
): AttachmentView | null {
  if (typeof value === 'string') {
    if (!value.length) {
      return null;
    }

    return {
      path: value,
      label:
        value.split('/').pop()
        || value,
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const path =
    projectedString(value.path)
    ?? projectedString(value.vault_path);

  if (!path) {
    return null;
  }

  return {
    path,
    label:
      projectedText(value.label)
      ?? path,
  };
}

function readAttachments(
  value: unknown,
): AttachmentView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(readAttachment)
    .filter(
      (
        attachment,
      ): attachment is AttachmentView =>
        attachment !== null,
    );
}

function readUsefulSection(
  value: unknown,
): UsefulSectionView | null {
  if (!isRecord(value)) {
    return null;
  }

  const section =
    projectedText(value.section);

  if (!section) {
    return null;
  }

  return {
    section,
    note:
      projectedText(value.note),
  };
}

function readEvaluation(
  value: unknown,
): EvaluationView | null {
  if (!isRecord(value)) {
    return null;
  }

  const roles = projectedStrings(value.roles);
  const level = projectedText(value.level);
  const audience = projectedStrings(value.audience);
  const prerequisites = projectedStrings(value.prerequisites);
  const strengths = projectedStrings(value.strengths);
  const weaknesses = projectedStrings(value.weaknesses);
  const concepts = projectedStrings(value.concepts);

  const usefulSections = Array.isArray(
    value.useful_sections,
  )
    ? value.useful_sections
      .map(readUsefulSection)
      .filter(
        (
          section,
        ): section is UsefulSectionView =>
          section !== null,
      )
    : [];

  if (
    !roles.length
    && !level
    && !audience.length
    && !prerequisites.length
    && !strengths.length
    && !weaknesses.length
    && !usefulSections.length
  ) {
    return null;
  }

  return {
    roles,
    level,
    audience,
    prerequisites,
    strengths,
    weaknesses,
    concepts,
    usefulSections,
  };
}

function readEvaluations(
  value: unknown,
): EvaluationView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(readEvaluation)
    .filter(
      (
        evaluation,
      ): evaluation is EvaluationView =>
        evaluation !== null,
    );
}

function readLibraryRecord(
  value: unknown,
): LibraryRecordView | null {
  if (!isRecord(value)) {
    return null;
  }

  const id =
    projectedString(value.id);

  if (!id) {
    return null;
  }

  return {
    record: value,
    id,
    type:
      projectedString(value.type)
      ?? 'record',
    title:
      projectedText(value.title)
      ?? id,
    summary:
      projectedText(value.summary)
      ?? '',
    purpose:
      projectedText(value.purpose)
      ?? '',
    sourceType:
      projectedText(value.source_type)
      ?? '',
    year:
      projectedText(value.year)
      ?? '',
    organization:
      projectedText(value.organization)
      ?? '',
    materialExists:
      projectedFlag(value.material_exists),
    materialPath:
      projectedString(value.material_path),
    url:
      projectedString(value.url),
    path:
      projectedString(value.path),
    role:
      projectedText(value.role)
      ?? '',
    domain:
      projectedText(value.domain)
      ?? '',
    state:
      projectedText(value.state)
      ?? '',
    aliases:
      projectedStrings(value.aliases),
    authors:
      projectedStrings(value.authors),
    entries:
      readCollectionEntries(value.entries),
    attachments:
      readAttachments(value.attachments),
    evaluations:
      readEvaluations(value.evaluations),
  };
}

function readLibraryRecords(
  value: unknown,
): LibraryRecordView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(readLibraryRecord)
    .filter(
      (
        record,
      ): record is LibraryRecordView =>
        record !== null,
    );
}

function readRelatedRecords(
  value: unknown,
): LibraryRecordView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const records: LibraryRecordView[] = [];

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      continue;
    }

    const record =
      readLibraryRecord(candidate.rec);

    if (record) {
      records.push(record);
    }
  }

  return records;
}

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
    if (dimension === 'domain') {
      return projectedStrings(
        source.record.thematic_group_ids,
      );
    }

    if (dimension === 'topic') {
      return projectedStrings(
        source.record.topics,
      );
    }

    if (dimension === 'purpose') {
      const values = new Set<string>();

      for (const evaluation of source.evaluations) {
        for (const role of evaluation.roles) {
          values.add(role);
        }
      }

      return [...values];
    }

    if (dimension === 'form') {
      return source.sourceType
        ? [source.sourceType]
        : [];
    }

    return this.plugin.store
      .useModules(source.id)
      .map((module) =>
        projectedString(module.id),
      )
      .filter(
        (id): id is string =>
          id !== null,
      );
  }

  sourceMatchesFilters(
    source: LibraryRecordView,
    omit: SourceFilterDimension | null = null,
  ): boolean {
    for (const [dimension] of SOURCE_FILTER_DIMENSIONS) {
      if (dimension === omit) {
        continue;
      }

      const selected =
        this.filters[dimension];

      if (
        selected
        && !this.sourceFilterValuesFor(
          source,
          dimension,
        ).includes(selected)
      ) {
        return false;
      }
    }

    return true;
  }

  sourceFilterTally(
    sources: LibraryRecordView[],
    dimension: SourceFilterDimension,
  ): Map<string, number> {
    const tally = new Map<string, number>();

    for (const source of sources) {
      // Each facet's choices are tallied after every OTHER active filter.
      // This keeps simultaneous filtering intelligible without collapsing the
      // currently selected dimension onto itself.
      if (!this.sourceMatchesFilters(source, dimension)) {
        continue;
      }

      for (
        const value of this.sourceFilterValuesFor(
          source,
          dimension,
        )
      ) {
        tally.set(
          value,
          (tally.get(value) ?? 0) + 1,
        );
      }
    }

    return tally;
  }

  sourceFilterLabel(
    dimension: SourceFilterDimension,
    value: string,
  ): string {
    if (dimension === 'domain') {
      const group =
        this.plugin.store.get(value);

      return group
        ? projectedString(group.title) ?? value
        : value;
    }

    if (dimension === 'topic') {
      const topic =
        this.plugin.store.topics()
          .find(
            (row) =>
              projectedString(row.id)
              === value,
          );

      return topic
        ? projectedString(topic.title) ?? value
        : value;
    }

    if (dimension === 'use') {
      const module =
        this.plugin.store.get(value);

      return module
        ? projectedString(module.title) ?? value
        : value;
    }

    return value
      .replace(/[-_]+/g, ' ')
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toLocaleUpperCase(),
      );
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

  renderSourceBrowser(
    root: HTMLElement,
  ): void {
    pageHeader(
      root,
      'Library',
      'Learning Sources',
      'Browse one source library through five independent facets. '
        + 'A source can belong to several values at once; filtering never '
        + 'changes its identity.',
    );

    this.renderCollectionSwitch(root);

    const all = readLibraryRecords(
      this.plugin.store.sources(),
    );

    const browser = root.createDiv({
      cls: 'los-library-browser',
    });

    const toolbar = browser.createDiv({
      cls: 'los-library-browser-toolbar',
    });

    const input = toolbar.createEl(
      'input',
      {
        cls:
          'los-search '
          + 'los-route-search '
          + 'los-library-global-search',
        attr: {
          type: 'search',
          placeholder:
            'Search learning sources…',
          'aria-label':
            'Search learning sources',
        },
      },
    ) as HTMLInputElement;

    input.value = this.query;

    input.addEventListener(
      'input',
      async () => {
        this.query = input.value;

        this.screen = 'home';
        this.groupId = null;

        await this.rememberSourceBrowser();
        this.render();
      },
    );

    button(
      toolbar,
      'Full-text / OCR search',
      () =>
        this.plugin.openFullTextSearch(
          this.query,
        ),
      'quiet',
    );

    const facets = browser.createDiv({
      cls: 'los-library-peer-facets',
      attr: {
        'aria-label':
          'Learning Source facets',
      },
    });

    for (
      const [
        dimension,
        label,
      ] of SOURCE_FILTER_DIMENSIONS
    ) {
      const control = facets.createDiv({
        cls: 'los-library-peer-facet',
      });

      control.createEl(
        'label',
        {
          cls: 'los-library-facet-label',
          text: label,
        },
      );

      const select = control.createEl(
        'select',
        {
          cls: 'los-library-facet-select',
          attr: {
            'data-facet': dimension,
            'aria-label':
              `Filter by ${label}`,
          },
        },
      ) as HTMLSelectElement;

      const tally =
        this.sourceFilterTally(
          all,
          dimension,
        );

      select.createEl(
        'option',
        {
          text: `All ${label.toLocaleLowerCase()}`,
          attr: {
            value: '',
          },
        },
      );

      const ordered =
        [...tally.entries()]
          .sort(
            (left, right) => {
              const leftLabel =
                this.sourceFilterLabel(
                  dimension,
                  left[0],
                );

              const rightLabel =
                this.sourceFilterLabel(
                  dimension,
                  right[0],
                );

              return (
                leftLabel.localeCompare(
                  rightLabel,
                )
              );
            },
          );

      for (
        const [
          value,
          count,
        ] of ordered
      ) {
        select.createEl(
          'option',
          {
            text:
              `${this.sourceFilterLabel(
                dimension,
                value,
              )} (${count})`,
            attr: {
              value,
            },
          },
        );
      }

      select.value =
        this.filters[dimension];

      select.addEventListener(
        'change',
        () => {
          void this.setSourceFilter(
            dimension,
            select.value,
          );
        },
      );
    }

    const active =
      SOURCE_FILTER_DIMENSIONS
        .filter(
          ([dimension]) =>
            Boolean(
              this.filters[dimension],
            ),
        );

    if (active.length) {
      const activeWrap =
        browser.createDiv({
          cls: 'los-library-active-filters',
          attr: {
            'aria-label':
              'Active Library filters',
          },
        });

      for (
        const [
          dimension,
          label,
        ] of active
      ) {
        const value =
          this.filters[dimension];

        const control = button(
          activeWrap,
          `${label}: ${this.sourceFilterLabel(
            dimension,
            value,
          )} ×`,
          () =>
            void this.setSourceFilter(
              dimension,
              '',
            ),
          'quiet',
        );

        control.addClass(
          'los-library-filter-chip',
        );
      }

      button(
        activeWrap,
        'Clear filters',
        () =>
          void this.clearSourceFilters(),
        'quiet',
      );
    }

    const topicless = all.filter(
      (source) =>
        !this.sourceFilterValuesFor(
          source,
          'topic',
        ).length,
    ).length;

    if (topicless) {
      browser.createDiv({
        cls: 'los-micro los-library-classification-note',
        text:
          `${topicless} source${topicless === 1 ? '' : 's'} `
          + 'have no Topic classification yet. They remain visible unless '
          + 'a Topic filter is selected.',
      });
    }

    const words =
      this.query
        .trim()
        .toLocaleLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    const rows = all
      .filter(
        (source) =>
          this.sourceMatchesFilters(source),
      )
      .filter(
        (source) => {
          if (!words.length) {
            return true;
          }

          const hay = [
            source.id,
            source.title,
            source.summary,
            source.purpose,
            source.organization,
            source.sourceType,
            ...source.aliases,
            ...source.authors,
          ]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase();

          return words.every(
            (word) =>
              hay.includes(word),
          );
        },
      )
      .sort(
        (left, right) =>
          left.title.localeCompare(
            right.title,
          ),
      );

    browser.createDiv({
      cls: 'los-library-result-summary',
      text:
        `${rows.length} of ${all.length} `
        + `source${all.length === 1 ? '' : 's'}`,
    });

    if (!all.length) {
      empty(
        browser,
        'No Learning Sources',
        'The Core projection currently contains no source records.',
      );
      return;
    }

    if (!rows.length) {
      empty(
        browser,
        'No matching sources',
        'No source matches the current search and facet combination.',
        'Clear filters',
        () =>
          void this.clearSourceFilters(),
      );
      return;
    }

    const list = browser.createDiv({
      cls:
        'los-route-list '
        + 'los-library-route-list',
    });

    for (const source of rows) {
      this.renderRecordRow(
        list,
        source,
        false,
      );
    }
  }

  renderHome(
    root: HTMLElement,
  ): void {
    if (this.collection === 'sources') {
      this.renderSourceBrowser(root);
      return;
    }
    pageHeader(
      root,
      'Library',
      'Choose a thematic group',
      this.collection === 'topic-packs'
        ? 'Topic Packs are narrow, purpose-built and manually ordered collections.'
        : 'Open a domain to browse its learning sources.',
    );

    this.renderCollectionSwitch(root);

    const groups = this.plugin.store
      .thematicGroups()
      .map(readThematicGroup)
      .filter(
        (
          group,
        ): group is ThematicGroupView =>
          group !== null,
      );

    if (!groups.length) {
      empty(
        root,
        'No thematic groups',
        'Rebuild the projection after defining thematic-group metadata.',
      );
      return;
    }

    const grid = root.createDiv({
      cls:
        'los-group-grid '
        + 'los-library-group-grid',
    });

    for (const group of groups) {
      const count =
        this.collection === 'topic-packs'
          ? this.plugin.store
            .topicPacksForGroup(group.id)
            .length
          : this.plugin.store
            .sourcesForGroup(group.id)
            .length;

      const card = grid.createEl(
        'button',
        {
          cls:
            'los-group-card '
            + 'is-clickable',
          attr: {
            type: 'button',
            'aria-label':
              `Open ${group.title}`,
          },
        },
      );

      const head = card.createDiv({
        cls: 'los-group-card-header',
      });

      head.createEl(
        'h2',
        {
          text: group.title,
        },
      );

      const countLabel =
        this.collection === 'topic-packs'
          ? `pack${count === 1 ? '' : 's'}`
          : `source${count === 1 ? '' : 's'}`;

      head.createSpan({
        cls: 'los-group-count',
        text: `${count} ${countLabel}`,
      });

      if (group.description) {
        card.createEl(
          'p',
          {
            text: group.description,
          },
        );
      }

      card.createSpan({
        cls: 'los-route-open',
        text: 'Open →',
      });

      card.addEventListener(
        'click',
        () => {
          this.selectedElementId =
            group.id;

          this.plugin.openLibraryGroup(
            this.collection,
            group.id,
          );
        },
      );
    }
  }

  renderCollectionSwitch(
    root: HTMLElement,
  ): void {
    const switcher = root.createDiv({
      cls: 'los-collection-switch',
      attr: {
        role: 'tablist',
        'aria-label':
          'Library collection',
      },
    });

    for (
      const [
        id,
        label,
      ] of LIBRARY_COLLECTIONS
    ) {
      const control = button(
        switcher,
        label,
        () =>
          this.plugin.openLibraryHome(id),
        this.collection === id
          ? 'cta'
          : 'quiet',
      );

      control.setAttrs({
        role: 'tab',
        'aria-selected': String(
          this.collection === id,
        ),
      });
    }
  }

  renderGroup(
    root: HTMLElement,
  ): void {
    const group = readThematicGroup(
      this.groupId
        ? this.plugin.store.get(
          this.groupId,
        )
        : null,
    );

    const back = button(
      root,
      '‹ Library',
      () => this.plugin.back(),
      'quiet',
    );

    back.addClass('los-route-back');

    if (!group) {
      empty(
        root,
        'Thematic group unavailable',
        'Return to Library and choose another group.',
        'Back',
        () => this.plugin.back(),
      );
      return;
    }

    const isPacks =
      this.collection === 'topic-packs';

    pageHeader(
      root,
      isPacks
        ? 'Topic Packs'
        : 'Learning Sources',
      group.title,
      isPacks
        ? 'Purpose-built collections in this thematic group.'
        : 'Learning sources in this thematic group.',
    );

    const toolbar = root.createDiv({
      cls: 'los-library-toolbar',
    });

    const input = toolbar.createEl(
      'input',
      {
        cls:
          'los-search '
          + 'los-route-search',
        attr: {
          type: 'search',
          placeholder:
            `Search ${group.title} `
            + `${isPacks
              ? 'topic packs'
              : 'sources'}…`,
          'aria-label':
            `Search ${group.title} `
            + `${isPacks
              ? 'topic packs'
              : 'sources'}`,
        },
      },
    ) as HTMLInputElement;

    input.value = this.query;

    input.addEventListener(
      'input',
      async () => {
        this.query = input.value;
        await this.rememberGroup();
        this.render();
      },
    );

    if (!isPacks) {
      this.renderSourceFacets(toolbar);

      button(
        toolbar,
        'Full-text / OCR search',
        () =>
          this.plugin.openFullTextSearch(
            this.query,
          ),
        'quiet',
      );
    }

    const rawRecords = isPacks
      ? this.plugin.store
        .topicPacksForGroup(group.id)
      : this.plugin.store
        .sourcesForGroup(group.id);

    const all =
      readLibraryRecords(rawRecords);

    // Facet values are tallied over the whole group, before the value filter,
    // so the counts do not collapse to 1 as soon as you pick one.
    if (!isPacks) {
      this.renderFacetValues(toolbar, all);
    }

    const needle =
      this.query
        .trim()
        .toLocaleLowerCase();

    const words =
      needle
        .split(/\s+/)
        .filter(Boolean);

    const rows = all
      .filter((record) => {
        if (
          !isPacks
          && !this.matchesSourceFacet(
            record.record,
          )
        ) {
          return false;
        }

        if (!words.length) {
          return true;
        }

        const hay = [
          record.id,
          record.title,
          record.purpose,
          record.summary,
          ...record.aliases,
          ...record.authors,
          record.organization,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase();

        return words.every(
          (word) => hay.includes(word),
        );
      })
      .sort(
        (left, right) =>
          left.title.localeCompare(
            right.title,
          ),
      );

    if (!all.length) {
      empty(
        root,
        isPacks
          ? 'No Topic Packs in this group'
          : 'No Learning Sources in this group',
        isPacks
          ? 'The group exists, but no purpose-built pack currently references it.'
          : 'The group exists, but no learning source currently references it.',
      );
      return;
    }

    if (!rows.length) {
      empty(
        root,
        'No matching results',
        `Nothing in ${group.title} matches the current search and filters.`,
        'Clear search and filters',
        async () => {
          this.query = '';
          this.facet = 'all';

          await this.rememberGroup();
          this.render();
        },
      );
      return;
    }

    const list = root.createDiv({
      cls:
        'los-route-list '
        + 'los-library-route-list',
    });

    for (const record of rows) {
      this.renderRecordRow(
        list,
        record,
        isPacks,
      );
    }
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
    const facets = parent.createDiv({
      cls:
        'los-library-facets-inline',
      attr: {
        'aria-label': 'Source filters',
      },
    });

    for (
      const [
        id,
        label,
      ] of SOURCE_FACETS
    ) {
      const control = button(
        facets,
        label,
        async () => {
          this.facet = id;
          // Switching facet always clears the value: a topic selection is
          // meaningless once you are filtering by form.
          this.facetValue = null;
          await this.rememberGroup();
          this.render();
        },
        this.facet === id
          ? 'row'
          : 'quiet',
      );

      control.setAttribute(
        'aria-pressed',
        String(this.facet === id),
      );
    }
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
    if (!VALUED_FACETS.has(this.facet)) {
      return;
    }

    const tally = this.facetTally(sources);
    const wrap = parent.createDiv({
      cls: 'los-library-facet-values',
    });

    if (!tally.size) {
      wrap.createDiv({
        cls: 'los-muted',
        text:
          this.facet === 'topic'
            ? 'No source in this view carries a topic yet. '
              + 'Topics are added when a source is actually used, '
              + 'never in a bulk pass.'
            : 'Nothing to filter by here yet.',
      });
      return;
    }

    const clear = button(
      wrap,
      `All (${sources.length})`,
      () => {
        this.facetValue = null;
        this.render();
      },
      this.facetValue ? 'quiet' : 'row',
    );
    clear.setAttribute(
      'aria-pressed',
      String(!this.facetValue),
    );

    const ordered = [...tally.entries()]
      .sort(
        (a, b) =>
          b[1] - a[1]
          || a[0].localeCompare(b[0]),
      );

    for (const [value, count] of ordered) {
      const control = button(
        wrap,
        `${this.facetValueLabel(value)} (${count})`,
        () => {
          this.facetValue =
            this.facetValue === value
              ? null
              : value;
          this.render();
        },
        this.facetValue === value
          ? 'row'
          : 'quiet',
      );
      control.setAttribute(
        'aria-pressed',
        String(this.facetValue === value),
      );
    }

    if (this.facet === 'topic') {
      const untopiced = sources.filter(
        (source) =>
          !projectedStrings(
            source.record.topics,
          ).length,
      ).length;
      if (untopiced) {
        wrap.createDiv({
          cls: 'los-micro',
          text:
            `${untopiced} of ${sources.length} not yet `
            + 'classified by topic — expected, not a backlog.',
        });
      }
    }
  }

  renderRecordRow(
    list: HTMLElement,
    record: LibraryRecordView,
    isPack = false,
  ): void {
    const row = list.createEl(
      'button',
      {
        cls:
          'los-route-row '
          + 'is-clickable',
        attr: {
          type: 'button',
          'aria-label':
            `Open ${record.title}`,
          'data-record-id':
            record.id,
        },
      },
    );

    const copy = row.createDiv({
      cls: 'los-route-row-copy',
    });

    copy.createEl(
      'strong',
      {
        text: record.title,
      },
    );

    const meta = isPack
      ? [
        record.purpose,
        `${record.entries.length} items`,
      ]
        .filter(Boolean)
        .join(' · ')
      : [
        record.sourceType,
        record.year,
        record.organization,
        record.materialExists
          || record.materialPath
          ? 'local'
          : null,
        record.url
          ? 'online'
          : null,
      ]
        .filter(Boolean)
        .join(' · ');

    if (meta) {
      copy.createDiv({
        cls: 'los-route-meta',
        text: meta,
      });
    }

    row.createSpan({
      cls: 'los-route-open',
      text: 'Open →',
    });

    row.addEventListener(
      'click',
      () => {
        this.selectedElementId =
          record.id;

        if (isPack) {
          this.plugin.openTopicPackDetail(
            record.id,
            this.groupId,
            this.query,
          );
          return;
        }

        this.plugin.openSourceDetail(
          record.id,
          this.groupId,
          this.query,
          this.facet,
          { ...this.filters },
        );
      },
    );
  }

  renderSourcePage(
    root: HTMLElement,
  ): void {
    const record = readLibraryRecord(
      this.resourceId
        ? this.plugin.store.get(
          this.resourceId,
        )
        : null,
    );

    const back = button(
      root,
      '‹ Learning Sources',
      () => this.plugin.back(),
      'quiet',
    );

    back.addClass('los-route-back');

    if (
      !record
      || record.type !== 'source'
    ) {
      empty(
        root,
        'Learning source unavailable',
        'The projected source could not be found.',
        'Back',
        () => this.plugin.back(),
      );
      return;
    }

    const detail = root.createDiv({
      cls: 'los-detail-page',
    });

    pageHeader(
      detail,
      'Learning Source',
      record.title,
      record.summary,
    );

    this.renderRecordActions(
      detail,
      record,
    );

    this.renderAttachments(
      detail,
      record,
    );

    this.renderSourceDetail(
      detail,
      record,
    );

    this.renderRelated(
      detail,
      record,
    );

    this.renderTechnical(
      detail,
      record,
    );
  }

  renderTopicPackPage(
    root: HTMLElement,
  ): void {
    const pack = readLibraryRecord(
      this.topicPackId
        ? this.plugin.store.get(
          this.topicPackId,
        )
        : null,
    );

    const back = button(
      root,
      '‹ Topic Packs',
      () => this.plugin.back(),
      'quiet',
    );

    back.addClass('los-route-back');

    if (
      !pack
      || pack.type !== 'topic-pack'
    ) {
      empty(
        root,
        'Topic Pack unavailable',
        'The projected Topic Pack could not be found.',
        'Back',
        () => this.plugin.back(),
      );
      return;
    }

    const detail = root.createDiv({
      cls:
        'los-detail-page '
        + 'los-topic-pack-detail',
    });

    pageHeader(
      detail,
      'Topic Pack',
      pack.title,
      pack.summary,
    );

    const purpose = section(
      detail,
      'Purpose',
    );

    purpose.createEl(
      'p',
      {
        cls: 'los-pack-purpose',
        text:
          pack.purpose
          || 'No purpose recorded.',
      },
    );

    this.renderOrderedCollection(
      detail,
      pack,
      'Pack contents',
    );

    this.renderRelated(
      detail,
      pack,
    );

    this.renderTechnical(
      detail,
      pack,
    );
  }

  renderCataloguePage(
    root: HTMLElement,
  ): void {
    const catalogue = readLibraryRecord(
      this.catalogueId
        ? this.plugin.store.get(
          this.catalogueId,
        )
        : null,
    );

    const back = button(
      root,
      '‹ Library',
      () => this.plugin.back(),
      'quiet',
    );

    back.addClass('los-route-back');

    if (
      !catalogue
      || catalogue.type !== 'collection'
    ) {
      empty(
        root,
        'Source catalogue unavailable',
        'The projected catalogue could not be found.',
        'Back',
        () => this.plugin.back(),
      );
      return;
    }

    const detail = root.createDiv({
      cls:
        'los-detail-page '
        + 'los-catalogue-detail',
    });

    pageHeader(
      detail,
      'Source Catalogue',
      catalogue.title,
      catalogue.summary,
    );

    this.renderOrderedCollection(
      detail,
      catalogue,
      'Catalogue entries',
    );

    this.renderRelated(
      detail,
      catalogue,
    );

    this.renderTechnical(
      detail,
      catalogue,
    );
  }

  renderOrderedCollection(
    detail: HTMLElement,
    collection: LibraryRecordView,
    title: string,
  ): void {
    const entries =
      collection.entries;

    const wrap = section(
      detail,
      `${title} (${entries.length})`,
      'The order and grouping shown here come directly from the canonical collection.',
    );

    if (!entries.length) {
      empty(
        wrap,
        'Empty collection',
        'No entries are currently registered.',
      );
      return;
    }

    let previousGroup:
      string | null = null;

    entries.forEach(
      (
        entry,
        index,
      ) => {
        if (
          entry.group
          && entry.group !== previousGroup
        ) {
          wrap.createDiv({
            cls: 'los-list-group',
            text: entry.group,
          });

          previousGroup =
            entry.group;
        }

        const source =
          readLibraryRecord(
            this.plugin.store.get(
              entry.sourceId,
            ),
          );

        const row = wrap.createDiv({
          cls: 'los-pack-entry',
        });

        row.createSpan({
          cls: 'los-pack-order',
          text: String(index + 1),
        });

        const copy = row.createDiv({
          cls: 'los-route-row-copy',
        });

        const open = copy.createEl(
          'button',
          {
            cls:
              'los-shelf-entry-title '
              + 'is-clickable',
            attr: {
              type: 'button',
            },
            text:
              source?.title
              ?? entry.sourceId,
          },
        );

        open.addEventListener(
          'click',
          () => {
            if (!source) {
              return;
            }

            this.plugin.openSourceDetail(
              source.id,
              this.groupId,
            );
          },
        );

        if (entry.why) {
          copy.createDiv({
            cls: 'los-shelf-why',
            text: entry.why,
          });
        }

        const facts = [
          source?.sourceType,
          source?.year,
          source?.materialExists
            || source?.materialPath
            ? 'local'
            : null,
          source?.url
            ? 'online'
            : null,
        ]
          .filter(Boolean)
          .join(' · ');

        if (facts) {
          copy.createDiv({
            cls: 'los-route-meta',
            text: facts,
          });
        }
      },
    );
  }

  renderLegacyList(
    root: HTMLElement,
  ): void {
    const back = button(
      root,
      '‹ Library',
      () => this.plugin.back(),
      'quiet',
    );

    back.addClass('los-route-back');

    const title =
      `${this.recordType
        .charAt(0)
        .toUpperCase()}`
      + `${this.recordType.slice(1)} records`;

    pageHeader(
      root,
      'Compatibility view',
      title,
      this.domain
        ? `Domain: ${this.domain}`
        : 'Legacy record families remain reachable until their migration gate closes.',
    );

    const input = root.createEl(
      'input',
      {
        cls:
          'los-search '
          + 'los-route-search',
        attr: {
          type: 'search',
          placeholder:
            `Search ${this.recordType} records…`,
          'aria-label':
            `Search ${this.recordType}`,
        },
      },
    ) as HTMLInputElement;

    input.value = this.query;

    input.addEventListener(
      'input',
      async () => {
        this.query = input.value;

        await this.plugin.router.remember({
          name: 'legacy-library-list',
          recordType: this.recordType,
          query: this.query,
          domain: this.domain,
        });

        this.render();
      },
    );

    let rows = readLibraryRecords(
      this.plugin.store.search(
        this.query,
        [this.recordType],
      ),
    );

    if (this.domain) {
      rows = rows.filter(
        (record) =>
          record.domain === this.domain,
      );
    }

    rows.sort(
      (left, right) =>
        left.title.localeCompare(
          right.title,
        ),
    );

    if (!rows.length) {
      empty(
        root,
        this.query
          ? 'No matching records'
          : 'No records',
        this.query
          ? 'Try a shorter title, alias or ID.'
          : `No ${this.recordType} records are projected.`,
      );
      return;
    }

    const list = root.createDiv({
      cls: 'los-route-list',
    });

    for (const record of rows) {
      const row = list.createEl(
        'button',
        {
          cls:
            'los-route-row '
            + 'is-clickable',
          attr: {
            type: 'button',
            'data-record-id':
              record.id,
          },
        },
      );

      const copy = row.createDiv({
        cls: 'los-route-row-copy',
      });

      copy.createEl(
        'strong',
        {
          text: record.title,
        },
      );

      copy.createDiv({
        cls: 'los-route-meta',
        text: [
          record.role,
          record.domain,
          record.state,
        ]
          .filter(Boolean)
          .join(' · '),
      });

      row.createSpan({
        cls: 'los-route-open',
        text: record.path
          ? 'Open file →'
          : 'Open →',
      });

      row.addEventListener(
        'click',
        () => {
          this.selectedElementId =
            record.id;

          if (record.path) {
            this.plugin.openAuthoredPath(
              record.path,
            );
            return;
          }

          this.plugin.openRecord(
            record.record,
          );
        },
      );
    }
  }

  renderRecordActions(
    detail: HTMLElement,
    record: LibraryRecordView,
  ): void {
    const actions = detail.createDiv({
      cls: 'los-actions',
    });

    if (record.url) {
      button(
        actions,
        'Open online',
        () =>
          this.plugin.openResource({
            url: record.url,
          }),
        'cta',
      );
    }

    if (record.materialPath) {
      button(
        actions,
        'Open local copy',
        () =>
          this.plugin.openMaterialPath(
            record.materialPath as string,
          ),
        'quiet',
      );
    }

    if (record.path) {
      button(
        actions,
        'Open authored file',
        () =>
          this.plugin.openAuthoredPath(
            record.path as string,
          ),
        'quiet',
      );
    }
  }

  renderAttachments(
    detail: HTMLElement,
    record: LibraryRecordView,
  ): void {
    if (!record.attachments.length) {
      return;
    }

    const attachments = section(
      detail,
      'Attachments',
      'Open the original handwriting, image, or PDF.',
    );

    for (
      const attachment
      of record.attachments
    ) {
      button(
        attachments,
        `Open ${attachment.label}`,
        () =>
          this.plugin.openAuthoredPath(
            attachment.path,
          ),
        'quiet',
      );
    }
  }

  renderRelated(
    detail: HTMLElement,
    record: LibraryRecordView,
  ): void {
    const related = readRelatedRecords(
      this.plugin.store.related(
        record.id,
      ),
    );

    const groups =
      new Map<
        string,
        LibraryRecordView[]
      >();

    for (const relatedRecord of related) {
      const current =
        groups.get(relatedRecord.type);

      if (current) {
        current.push(relatedRecord);
      } else {
        groups.set(
          relatedRecord.type,
          [relatedRecord],
        );
      }
    }

    if (!groups.size) {
      return;
    }

    const wrap = section(
      detail,
      'Related',
    );

    const orderedGroups = [
      ...groups.entries(),
    ].sort(
      (left, right) =>
        right[1].length
        - left[1].length,
    );

    for (
      const [
        type,
        rows,
      ] of orderedGroups
    ) {
      const group = wrap.createDiv({
        cls: 'los-related-group',
      });

      group.createDiv({
        cls: 'los-group-title',
        text:
          `${RELATED_LABELS[type] ?? type}`
          + ` · ${rows.length}`,
      });

      const shown = group.createDiv({
        cls: 'los-related-chips',
      });

      for (
        const relatedRecord
        of rows.slice(0, 5)
      ) {
        chip(
          shown,
          relatedRecord.record,
          () =>
            this.plugin.openRecord(
              relatedRecord.record,
            ),
        );
      }

      if (rows.length > 5) {
        const rest = disclosure(
          group,
          `View all ${rows.length}`,
        );

        const restChips =
          rest.createDiv({
            cls: 'los-related-chips',
          });

        for (
          const relatedRecord
          of rows.slice(5)
        ) {
          chip(
            restChips,
            relatedRecord.record,
            () =>
              this.plugin.openRecord(
                relatedRecord.record,
              ),
          );
        }
      }
    }
  }

  renderSourceDetail(
    detail: HTMLElement,
    record: LibraryRecordView,
  ): void {
    const facts = section(
      detail,
      'Source facts',
    );

    const factRows:
      ReadonlyArray<
        readonly [
          string,
          string,
        ]
      > = [
        [
          'Authors',
          record.authors.join(', '),
        ],
        [
          'Organization',
          record.organization,
        ],
        [
          'Year',
          record.year,
        ],
        [
          'Type',
          record.sourceType,
        ],
      ];

    for (
      const [
        label,
        value,
      ] of factRows
    ) {
      if (!value) {
        continue;
      }

      const row = facts.createDiv({
        cls: 'los-fact-row',
      });

      row.createSpan({
        cls: 'los-fact-label',
        text: label,
      });

      row.createSpan({
        cls: 'los-fact-value',
        text: value,
      });
    }

    const memberships =
      this.shelfIndex().get(
        record.id,
      )
      ?? [];

    const placed = section(
      detail,
      'Collections',
      'Where this source sits and the explicit role it plays there.',
    );

    if (!memberships.length) {
      empty(
        placed,
        'Not in a collection',
        'The source remains globally registered.',
      );
    }

    for (
      const membership
      of memberships
    ) {
      const line = placed.createDiv({
        cls: 'los-shelf-entry',
      });

      const head = line.createEl(
        'button',
        {
          cls:
            'los-shelf-entry-title '
            + 'is-clickable',
          attr: {
            type: 'button',
          },
          text:
            membership.shelf.title,
        },
      );

      head.addEventListener(
        'click',
        () => {
          if (
            membership.shelf.type
            === 'topic-pack'
          ) {
            this.plugin.openTopicPackDetail(
              membership.shelf.id,
            );
            return;
          }

          this.plugin.openCatalogueDetail(
            membership.shelf.id,
          );
        },
      );

      if (membership.group) {
        line.createDiv({
          cls: 'los-micro',
          text: membership.group,
        });
      }

      if (membership.why) {
        line.createDiv({
          cls: 'los-shelf-why',
          text: membership.why,
        });
      }
    }

    const used = section(
      detail,
      'Used in units',
      'Use is module/unit-specific; it is not a global source score.',
    );

    const units = readLibraryRecords(
      this.plugin.store.useUnits(
        record.id,
      ),
    );

    if (!units.length) {
      empty(
        used,
        'Not routed to a unit',
        'The source remains globally registered.',
      );
    }

    for (const unit of units) {
      chip(
        used,
        unit.record,
        () =>
          this.plugin.openUnit(
            unit.id,
          ),
      );
    }

    if (record.evaluations.length) {
      const evidence = section(
        detail,
        'What this source is good for',
      );

      for (
        const evaluation
        of record.evaluations
      ) {
        const card =
          evidence.createDiv({
            cls: 'los-evidence-card',
          });

        /* Purpose first: the roles are the reason to open this source at all.
         * Level sits beside them because "good for first learning" means
         * something different at introductory and at advanced. */
        if (evaluation.roles.length || evaluation.level) {
          const purpose = card.createDiv({ cls: 'los-chip-row' });
          for (const role of evaluation.roles) badge(purpose, role, 'role');
          if (evaluation.level) badge(purpose, evaluation.level, 'level');
        }

        for (const [label, values] of [
          ['Strengths', evaluation.strengths],
          ['Weaknesses', evaluation.weaknesses],
          ['Assumes', evaluation.prerequisites],
          ['Written for', evaluation.audience],
        ] as const) {
          if (!values.length) continue;
          const block = card.createDiv({ cls: 'los-row' });
          block.createEl('strong', { text: `${label}: ` });
          block.createSpan({ text: values.join(' · ') });
        }

        for (
          const selection
          of evaluation.usefulSections
        ) {
          card.createDiv({
            cls: 'los-row',
            text:
              selection.section
              + (
                selection.note
                  ? ` — ${selection.note}`
                  : ''
              ),
          });
        }
      }
    }
  }

  renderTechnical(
    detail: HTMLElement,
    record: LibraryRecordView,
  ): void {
    const technical = disclosure(
      detail,
      'Technical details',
      'los-technical-details',
    );

    const idRow = technical.createDiv({
      cls: 'los-fact-row',
    });

    idRow.createSpan({
      cls: 'los-fact-label',
      text: 'Record ID',
    });

    idRow.createSpan({
      cls:
        'los-fact-value '
        + 'los-detail-id',
      text: record.id,
    });

    button(
      technical,
      'Copy ID',
      () =>
        this.plugin.copyText(
          record.id,
        ),
      'quiet',
    );

    if (record.path) {
      const pathRow =
        technical.createDiv({
          cls: 'los-fact-row',
        });

      pathRow.createSpan({
        cls: 'los-fact-label',
        text: 'Path',
      });

      pathRow.createSpan({
        cls: 'los-fact-value',
        text: record.path,
      });
    }
  }
}
