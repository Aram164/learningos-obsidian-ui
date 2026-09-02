import type {
  ModuleConceptEvidence,
  ProjectionRecord,
} from '../../contracts/manifest';
import type { ManifestStore } from '../../manifest-store';
import {
  asLabel as projectedLabel,
  asString as projectedString,
} from '../../projection/readers';

/**
 * The Module x Concept crossing, as a read model (ADR-015).
 *
 * Core publishes edges; this decides the shape of the table. Nothing here
 * derives a relationship — every cell traces back to a `module_concept_edges`
 * row and the authored tag inside it. If this file ever needs to *guess*
 * whether a module touches a concept, the projection is the thing to fix.
 */

export interface CrossingCell {
  readonly moduleId: string;
  readonly evidence: readonly ModuleConceptEvidence[];
}

export interface CrossingRow {
  readonly conceptId: string;
  readonly label: string;
  /** Modules carrying this concept, keyed for O(1) cell lookup. */
  readonly cells: ReadonlyMap<string, CrossingCell>;
  readonly moduleCount: number;
}

export interface CrossingColumn {
  readonly moduleId: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly actionable: boolean;
  readonly conceptCount: number;
}

export interface Crossing {
  readonly columns: readonly CrossingColumn[];
  readonly rows: readonly CrossingRow[];
  /** Rows carried by more than one module — the default view. */
  readonly sharedRows: readonly CrossingRow[];
  readonly totalConcepts: number;
  readonly totalEdges: number;
}

export interface ConceptRelationLink {
  readonly direction: 'incoming' | 'outgoing';
  readonly relationType: string;
  readonly record: ProjectionRecord;
}

export interface ConceptContext {
  readonly notes: readonly ProjectionRecord[];
  readonly sources: readonly ProjectionRecord[];
  readonly relations: readonly ConceptRelationLink[];
}

export type CrossingStore = Pick<
  ManifestStore,
  'get' | 'modules' | 'moduleConceptEdges'
>;

export type ConceptContextStore = Pick<
  ManifestStore,
  'data' | 'get' | 'related' | 'sources'
>;

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function conceptIds(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item: unknown): item is string => typeof item === 'string')
    : [];
}

function sourceNamesConcept(
  source: ProjectionRecord,
  conceptId: string,
): boolean {
  return Array.isArray(source.evaluations)
    && source.evaluations.some((evaluation: unknown) => {
      const record = objectValue(evaluation);
      return record ? conceptIds(record.concepts).includes(conceptId) : false;
    });
}

function byLabel(
  left: ProjectionRecord,
  right: ProjectionRecord,
): number {
  return projectedLabel(left).localeCompare(projectedLabel(right));
}

/**
 * Published context for a selected concept. These rows never license an Atlas
 * cell: they are secondary ways into the exact notes, reviewed source
 * evaluations, and authored concept relations already present in the same
 * manifest snapshot.
 */
export function buildConceptContext(
  store: ConceptContextStore,
  conceptId: string,
): ConceptContext {
  const notes = store.related(conceptId)
    .map((row) => row.rec)
    .filter((record): record is ProjectionRecord => record?.type === 'note')
    .sort(byLabel);

  const sources = store.sources()
    .filter((source: ProjectionRecord) => sourceNamesConcept(source, conceptId))
    .sort(byLabel);

  const relationTable = objectValue(
    store.data?.backlinks?.concept_relations,
  );
  const relationEntry = objectValue(relationTable?.[conceptId]);
  const relations: ConceptRelationLink[] = [];

  for (const direction of ['incoming', 'outgoing'] as const) {
    const rows = relationEntry?.[direction];

    if (!Array.isArray(rows)) {
      continue;
    }

    for (const value of rows) {
      const row = objectValue(value);
      const relatedId = projectedString(
        direction === 'incoming' ? row?.from : row?.to,
      );
      const relationType = projectedString(row?.type);
      const record = relatedId ? store.get(relatedId) : null;

      if (record && relationType) {
        relations.push({ direction, relationType, record });
      }
    }
  }

  relations.sort((left, right) =>
    left.direction.localeCompare(right.direction)
    || left.relationType.localeCompare(right.relationType)
    || byLabel(left.record, right.record));

  return { notes, sources, relations };
}

function shortModuleLabel(module: ProjectionRecord): string {
  const code = projectedString(module.code);
  if (code) {
    return code;
  }

  const title = projectedLabel(module);
  const words = title.split(/\s+/).filter(Boolean);

  return words.length > 2
    ? words.map((word: string) => word.charAt(0)).join('').toUpperCase()
    : title;
}

/**
 * Actionable modules first, then by title.
 *
 * `is_actionable` is published by Core, so the ordering is the same judgment
 * the rest of the app uses rather than a second opinion invented here. A
 * learner opens this screen mid-semester; the module they sit an exam for
 * belongs on the left.
 */
function orderColumns(
  modules: readonly ProjectionRecord[],
  conceptsByModule: ReadonlyMap<string, number>,
): CrossingColumn[] {
  // Keep zero-edge modules visible. Their empty column is the explicit,
  // honest answer "not mapped yet"; filtering it out would turn bounded
  // projection reach into silent absence.
  return modules
    .filter((module: ProjectionRecord) => Boolean(projectedString(module.id)))
    .map((module: ProjectionRecord): CrossingColumn => {
      const moduleId = projectedString(module.id) as string;

      return {
        moduleId,
        label: projectedLabel(module),
        shortLabel: shortModuleLabel(module),
        actionable: module.is_actionable === true,
        conceptCount: conceptsByModule.get(moduleId) ?? 0,
      };
    })
    .sort((left: CrossingColumn, right: CrossingColumn) => {
      if (left.actionable !== right.actionable) {
        return left.actionable ? -1 : 1;
      }

      return left.label.localeCompare(right.label);
    });
}

export function buildCrossing(store: CrossingStore): Crossing {
  const edges = store.moduleConceptEdges();

  const byConcept = new Map<string, Map<string, CrossingCell>>();
  const conceptsByModule = new Map<string, number>();
  let totalEdges = 0;

  for (const edge of edges) {
    const { module_id: moduleId, concept_id: conceptId } = edge;

    if (!moduleId || !conceptId || !edge.evidence?.length) {
      // Core refuses to publish an unevidenced edge and the decoder refuses to
      // accept one. Skipping here as well means a cell can never appear
      // without a reason, whatever went wrong upstream.
      continue;
    }

    totalEdges += 1;

    const cells = byConcept.get(conceptId) ?? new Map<string, CrossingCell>();
    cells.set(moduleId, { moduleId, evidence: edge.evidence });
    byConcept.set(conceptId, cells);

    conceptsByModule.set(moduleId, (conceptsByModule.get(moduleId) ?? 0) + 1);
  }

  const columns = orderColumns(store.modules(), conceptsByModule);
  const visibleModules = new Set(
    columns.map((column: CrossingColumn) => column.moduleId),
  );

  const rows: CrossingRow[] = [];

  for (const [conceptId, cells] of byConcept) {
    const visible = new Map(
      [...cells].filter(([moduleId]) => visibleModules.has(moduleId)),
    );

    if (!visible.size) {
      continue;
    }

    const record = store.get(conceptId);

    rows.push({
      conceptId,
      label: record ? projectedLabel(record) : conceptId,
      cells: visible,
      moduleCount: visible.size,
    });
  }

  // Most-shared first, then alphabetically: the question the screen exists to
  // answer is "where does this overlap", so overlap sorts to the top.
  rows.sort(
    (left: CrossingRow, right: CrossingRow) =>
      right.moduleCount - left.moduleCount
      || left.label.localeCompare(right.label),
  );

  return {
    columns,
    rows,
    sharedRows: rows.filter((row: CrossingRow) => row.moduleCount > 1),
    totalConcepts: rows.length,
    totalEdges,
  };
}
