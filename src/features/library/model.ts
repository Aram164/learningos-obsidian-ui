import type { ProjectionRecord } from '../../contracts/manifest';
import {
  asLibrarySourceFilters,
  type LibraryCollectionV1,
  type LibrarySourceFiltersV1,
} from '../../contracts/route-v1';
import type { AppSurface } from '../../app/surface';
import type { AppNavigator } from '../../app/navigator';
import {
  asBoolean as projectedFlag,
  asString as projectedString,
  asStrings as projectedStrings,
  asText as projectedText,
  isRecord,
} from '../../projection/readers';

// Kept only to decode persisted routes from the superseded single-facet source
// browser. The active browser uses the five simultaneous filters below.
const LEGACY_SOURCE_FACETS = [
  'all',
  'local',
  'online',
  'in-unit',
  'topic',
  'purpose',
  'form',
  'use',
] as const;

export const SOURCE_FILTER_DIMENSIONS = [
  ['domain', 'Domain'],
  ['topic', 'Topic'],
  ['purpose', 'Purpose'],
  ['form', 'Form'],
  ['use', 'Current use'],
] as const;

export type SourceFilterDimension =
  (typeof SOURCE_FILTER_DIMENSIONS)[number][0];

export const LIBRARY_COLLECTIONS = [
  ['sources', 'Sources'],
  ['topic-packs', 'Curated packs'],
] as const;

export const RELATED_LABELS: Readonly<Record<string, string>> = {
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

export type SourceFacet =
  (typeof LEGACY_SOURCE_FACETS)[number];

export type LibraryScreen =
  | 'home'
  | 'group'
  | 'source-detail'
  | 'topic-pack-detail'
  | 'catalogue-detail'
  | 'legacy-list';

export interface LibraryViewState {
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

export interface ParsedLibraryViewState
  extends LibraryViewState {}

export interface ThematicGroupView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

export interface CollectionEntryView {
  readonly sourceId: string;
  readonly group: string | null;
  readonly why: string | null;
}

export interface AttachmentView {
  readonly path: string;
  readonly label: string;
}

export interface UsefulSectionView {
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
export interface EvaluationView {
  readonly roles: string[];
  readonly level: string | null;
  readonly audience: string[];
  readonly prerequisites: string[];
  readonly strengths: string[];
  readonly weaknesses: string[];
  readonly concepts: string[];
  readonly usefulSections: UsefulSectionView[];
}

export interface LibraryRecordView {
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

export interface ShelfMembership {
  readonly shelf: LibraryRecordView;
  readonly group: string | null;
  readonly why: string | null;
}

export type LibraryPlugin = Pick<
  AppSurface,
  | 'copyText'
  | 'generate'
  | 'openAuthoredPath'
  | 'openMaterialPath'
  | 'openResource'
  | 'router'
  | 'store'
> & {
  readonly nav: Pick<
    AppNavigator,
    | 'back'
    | 'openCatalogueDetail'
    | 'openFullTextSearch'
    | 'openLibraryGroup'
    | 'openLibraryHome'
    | 'openRecord'
    | 'openSourceDetail'
    | 'openTopicPackDetail'
    | 'openUnit'
  >;
};

export function isLibraryScreen(
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

export function isLibraryCollection(
  value: unknown,
): value is LibraryCollectionV1 {
  return (
    value === 'sources'
    || value === 'topic-packs'
  );
}

export function isSourceFacet(
  value: unknown,
): value is SourceFacet {
  return LEGACY_SOURCE_FACETS.some(
    (facet) => facet === value,
  );
}

export function readLibraryViewState(
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

export function readThematicGroup(
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

export function readCollectionEntry(
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

export function readCollectionEntries(
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

export function readAttachment(
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

export function readAttachments(
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

export function readUsefulSection(
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

export function readEvaluation(
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

export function readEvaluations(
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

export function readLibraryRecord(
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

export function readLibraryRecords(
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

export function readRelatedRecords(
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
