import type { ProjectionRecord } from '../../contracts/manifest';
import type { ManifestStore } from '../../manifest-store';
import { asLabel as projectedLabel } from '../../projection/readers';

/**
 * Published context for a selected concept, beside its relations.
 *
 * These rows license nothing. They are secondary ways into the exact notes and
 * reviewed source evaluations already present in the same manifest snapshot,
 * and no relation, prerequisite or module claim is ever derived from one.
 *
 * Concept relations used to be read here, out of
 * `backlinks.concept_relations`. They are not any more: that table publishes
 * `{from|to, type}` and drops `context` and `source`, which is exactly the
 * provenance the Atlas owes the reader (ADR-016). Relations come from
 * `graph.ts`, over the top-level `relations` collection.
 */

export interface ConceptContext {
  readonly notes: readonly ProjectionRecord[];
  readonly sources: readonly ProjectionRecord[];
}

export type ConceptContextStore = Pick<
  ManifestStore,
  'related' | 'sources'
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

  return { notes, sources };
}
