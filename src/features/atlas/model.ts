import type { ProjectionRecord } from '../../contracts/manifest';
import type { ManifestStore } from '../../manifest-store';
import {
  asLabel as projectedLabel,
  asRecords as projectedRecords,
  asString as projectedString,
  asStrings as projectedStrings,
} from '../../projection/readers';

export interface AtlasDomain {
  readonly name: string;
  readonly notes: ProjectionRecord[];
  readonly shelves: ProjectionRecord[];
  readonly modules: ProjectionRecord[];
  readonly concepts: ProjectionRecord[];
  readonly sources: ProjectionRecord[];
}

export type AtlasStore = Pick<
  ManifestStore,
  | 'get'
  | 'modules'
  | 'of'
  | 'sources'
  | 'thematicGroups'
  | 'topicPacks'
  | 'useModules'
>;

export const ATLAS_ROLE_ORDER: readonly string[] = [
  'crosswalk',
  'reference',
  'synthesis',
  'exercise-bank',
  'mock-exam',
];

export function humanLabel(
  value: unknown,
): string {
  const text = String(value || 'cross-domain')
    .replace(/^thematic-group-/, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  return text
    ? `${text.charAt(0).toUpperCase()}${text.slice(1)}`
    : 'Cross-domain';
}

function canonicalLabel(
  value: unknown,
): string {
  return String(value || '')
    .replace(/^thematic-group-/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

function uniqueRecords(
  records: readonly ProjectionRecord[],
): ProjectionRecord[] {
  const seen = new Set<string>();

  return records.filter(
    (record: ProjectionRecord) => {
      const key =
        projectedString(record.id)
        || `${record.type || 'record'}:${projectedLabel(record)}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    },
  );
}

export function recordIds(
  records: readonly ProjectionRecord[],
): Set<string> {
  return new Set(
    records
      .map(
        (record: ProjectionRecord) =>
          projectedString(record.id),
      )
      .filter(
        (id): id is string =>
          Boolean(id),
      ),
  );
}

export function intersectionSize(
  left: Set<string>,
  right: Set<string>,
): number {
  let count = 0;

  for (const value of left) {
    if (right.has(value)) {
      count += 1;
    }
  }

  return count;
}

export function roleLabel(
  role: string,
): string {
  return humanLabel(role);
}

/**
 * Build the Domain Atlas read model from the Core-authored projection.
 *
 * This function only interprets projected records. It owns no navigation,
 * Obsidian lifecycle, DOM state, or canonical knowledge.
 */
export function buildAtlasDomains(
  store: AtlasStore,
): AtlasDomain[] {
  const domains =
    new Map<string, AtlasDomain>();

  const bucket = (
    name: unknown,
  ): AtlasDomain => {
    const key = String(
      name || 'cross-domain',
    );

    const existing =
      domains.get(key);

    if (existing) {
      return existing;
    }

    const created: AtlasDomain = {
      name: key,
      notes: [],
      shelves: [],
      modules: [],
      concepts: [],
      sources: [],
    };

    domains.set(
      key,
      created,
    );

    return created;
  };

  for (
    const note of
    store.of('note')
  ) {
    bucket(note.domain).notes.push(note);
  }

  const shelves = uniqueRecords([
    ...store.of('collection'),
    ...store.topicPacks(),
  ]);

  for (const shelf of shelves) {
    bucket(shelf.domain).shelves.push(shelf);
  }

  for (const domain of domains.values()) {
    const sourceIds = new Set<string>();
    const conceptIds = new Set<string>();
    const groupIds = new Set<string>();

    for (const note of domain.notes) {
      projectedStrings(note.sources)
        .forEach(
          (id: string) =>
            sourceIds.add(id),
        );

      projectedStrings(note.concepts)
        .forEach(
          (id: string) =>
            conceptIds.add(id),
        );
    }

    for (const shelf of domain.shelves) {
      projectedStrings(shelf.sources)
        .forEach(
          (id: string) =>
            sourceIds.add(id),
        );

      projectedStrings(shelf.thematic_group_ids)
        .forEach(
          (id: string) =>
            groupIds.add(id),
        );

      for (
        const entry of
        projectedRecords(shelf.entries)
      ) {
        const sourceId =
          projectedString(entry.source);

        if (sourceId) {
          sourceIds.add(sourceId);
        }
      }
    }

    for (const group of store.thematicGroups()) {
      if (
        canonicalLabel(group.id)
          === canonicalLabel(domain.name)
        || canonicalLabel(group.title)
          === canonicalLabel(domain.name)
      ) {
        const groupId =
          projectedString(group.id);

        if (groupId) {
          groupIds.add(groupId);
        }
      }
    }

    for (const source of store.sources()) {
      const sourceId =
        projectedString(source.id);

      const sourceGroups =
        projectedStrings(
          source.thematic_group_ids,
        );

      if (
        sourceGroups.some(
          (id: string) =>
            groupIds.has(id),
        )
        && sourceId
      ) {
        sourceIds.add(sourceId);
      }
    }

    const resolvedSources =
      [...sourceIds]
        .map(
          (id: string) =>
            store.get(id),
        )
        .filter(
          (
            record,
          ): record is ProjectionRecord =>
            record?.type === 'source',
        );

    domain.sources.push(
      ...uniqueRecords(resolvedSources),
    );

    const resolvedConcepts =
      [...conceptIds]
        .map(
          (id: string) =>
            store.get(id),
        )
        .filter(
          (
            record,
          ): record is ProjectionRecord =>
            record?.type === 'concept',
        );

    domain.concepts.push(
      ...uniqueRecords(resolvedConcepts),
    );

    const relatedModules = [
      ...domain.sources.flatMap(
        (
          source: ProjectionRecord,
        ) => {
          const sourceId =
            projectedString(source.id);

          return sourceId
            ? store.useModules(sourceId)
            : [];
        },
      ),
      ...store.modules().filter(
        (
          module: ProjectionRecord,
        ) =>
          projectedStrings(
            module.thematic_group_ids,
          ).some(
            (id: string) =>
              groupIds.has(id),
          ),
      ),
    ];

    domain.modules.push(
      ...uniqueRecords(relatedModules),
    );
  }

  return [...domains.values()].sort(
    (left, right) =>
      right.notes.length
        - left.notes.length
      || left.name.localeCompare(
        right.name,
      ),
  );
}
