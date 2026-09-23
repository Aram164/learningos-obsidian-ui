/**
 * Decoder for Core's `material.span` query (`material-span-v1`).
 *
 * One exact registered route: its source identity, locator, availability and,
 * only when the learner asked for it, a bounded local excerpt. Remote material
 * is never fetched implicitly, so `remote-unobserved` is an answer, not an
 * error, and the interface says so rather than pretending to have read it.
 */

export const MATERIAL_SPAN_CONTRACT = 'material-span-v1';

export type MaterialAvailabilityV1 =
  | 'local-observed'
  | 'local-unavailable'
  | 'remote-unobserved'
  | 'unavailable';

export interface MaterialSpanFileV1 {
  readonly material_uri: string;
  readonly format: string;
  readonly file_sha256: string;
  /** `not-requested` until an extraction is asked for. */
  readonly extraction: string;
  readonly excerpt: string | null;
  readonly excerpt_truncated: boolean;
  readonly pages: readonly number[];
  readonly page_total: number | null;
  readonly reason: string | null;
}

export interface MaterialSpanV1 {
  readonly snapshot_id: string;
  readonly unit_id: string;
  readonly module_id: string;
  readonly route_id: string;
  readonly source_id: string | null;
  readonly locator: string | null;
  readonly url: string | null;
  readonly availability: MaterialAvailabilityV1;
  readonly files: readonly MaterialSpanFileV1[];
  readonly analysis_notes_total: number;
}

const AVAILABILITY: ReadonlySet<string> = new Set([
  'local-observed', 'local-unavailable', 'remote-unobserved', 'unavailable',
]);

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function spanFile(value: unknown): MaterialSpanFileV1 | null {
  const item = record(value);
  if (!item) return null;
  const uri = text(item.material_uri);
  const digest = text(item.file_sha256);
  const extraction = text(item.extraction);
  if (!uri || !digest || !extraction) return null;
  const pages = Array.isArray(item.pages)
    ? item.pages.filter((page): page is number => Number.isInteger(page))
    : [];
  return {
    material_uri: uri,
    format: text(item.format) ?? 'unknown',
    file_sha256: digest,
    extraction,
    excerpt: typeof item.excerpt === 'string' ? item.excerpt : null,
    excerpt_truncated: item.excerpt_truncated === true,
    pages,
    page_total: Number.isInteger(item.page_total) ? item.page_total as number : null,
    reason: text(item.reason),
  };
}

/** The exact route description, or null when Core answered with anything else. */
export function asMaterialSpan(value: unknown): MaterialSpanV1 | null {
  const response = record(value);
  if (!response
    || response.contract !== MATERIAL_SPAN_CONTRACT
    || response.schema_version !== 1
    || typeof response.snapshot_id !== 'string'
    || !/^sha256:[a-f0-9]{64}$/.test(response.snapshot_id)
    || !AVAILABILITY.has(String(response.availability))
    || !Array.isArray(response.spans)) return null;
  const unitId = text(response.unit_id);
  const moduleId = text(response.module_id);
  const routeId = text(response.route_id);
  if (!unitId || !moduleId || !routeId) return null;
  const files: MaterialSpanFileV1[] = [];
  for (const entry of response.spans) {
    const decoded = spanFile(entry);
    if (!decoded) return null;
    files.push(decoded);
  }
  const analysis = record(response.analysis_refs);
  const notesTotal = analysis && Number.isInteger(analysis.analysis_notes_total)
    ? analysis.analysis_notes_total as number
    : 0;
  return {
    snapshot_id: response.snapshot_id,
    unit_id: unitId,
    module_id: moduleId,
    route_id: routeId,
    source_id: text(response.source_id),
    locator: text(response.locator),
    url: text(response.url),
    availability: response.availability as MaterialAvailabilityV1,
    files,
    analysis_notes_total: notesTotal,
  };
}
