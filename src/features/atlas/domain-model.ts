/**
 * The published domain catalog and the readings built on it.
 *
 * Core publishes the catalog once (manifest v20 `domains`: ordered ids with
 * labels) and one `domain_bucket` per note. This module is the only place the
 * UI reads them: labels, order and the per-note bucket come from the
 * projection, and the note's path on disk is only a fallback for a record that
 * predates the published field. Browsing membership — the union of buckets
 * over a concept's linked notes — also lives here. Drawing placement (where
 * most of a concept's notes live) is a different membership and stays in
 * study-desk/atlas-model.ts.
 */
import type { ProjectionRecord } from '../../contracts/manifest';
import { asStrings, asText } from '../../projection/readers';
import { compareStrings } from '../../sorting';

export interface DomainCatalogEntry {
  readonly id: string;
  readonly label: string;
  readonly order: number;
}

export type DomainCatalog = readonly DomainCatalogEntry[];

/** A real published destination: notes recorded as spanning domains. */
export const CROSS_DOMAIN = 'cross-domain';

/** Derive a label from the id when the catalog does not carry one. */
function fallbackLabel(id: string): string {
  return id.split('-').map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : '').join(' ');
}

/** Read the published catalog rows, in the published order. */
export function readDomainCatalog(store: { rows(group: string): readonly ProjectionRecord[] }): DomainCatalog {
  return store.rows('domains').flatMap((row) => {
    const id = asText(row.id);
    if (!id) return [];
    const order = typeof row.order === 'number' ? row.order : Number.MAX_SAFE_INTEGER;
    return [{ id, label: asText(row.label) ?? fallbackLabel(id), order }];
  }).sort((a, b) => a.order - b.order || compareStrings(a.id, b.id));
}

/** The label for a domain id: the published label, else the derived title. */
export function domainLabel(catalog: DomainCatalog, id: string): string {
  return catalog.find((row) => row.id === id)?.label ?? fallbackLabel(id);
}

/** Catalog order as a rank for deterministic tie-breaks; unknown ids sort last. */
export function domainRank(catalog: DomainCatalog): (id: string) => number {
  const order = catalog.map((row) => row.id);
  return (id: string) => {
    const at = order.indexOf(id);
    return at < 0 ? order.length : at;
  };
}

/**
 * The bucket a note is published into. Core assigns domains; the UI displays
 * them — the note's path on disk is never consulted. Manifest v20 publishes
 * a bucket for every note, so cross-domain stands in only for a record that
 * predates the required field.
 */
export function noteDomain(record: ProjectionRecord): string {
  return asText(record.domain_bucket) ?? CROSS_DOMAIN;
}

/**
 * Browsing membership: every domain a concept's linked notes were published
 * into — the union, so a concept is reachable from each of them. A concept
 * with no linked note gets no entry; the "Not yet grouped" destination holds
 * those, and that destination is presentation-only, never a bucket.
 */
export function browsingDomains(
  notes: readonly ProjectionRecord[],
  hasConcept: (id: string) => boolean,
): ReadonlyMap<string, ReadonlySet<string>> {
  const membership = new Map<string, Set<string>>();
  for (const note of notes) {
    const bucket = noteDomain(note);
    for (const id of asStrings(note.concepts)) {
      if (!hasConcept(id)) continue;
      const domains = membership.get(id) ?? new Set<string>();
      domains.add(bucket);
      membership.set(id, domains);
    }
  }
  return membership;
}
