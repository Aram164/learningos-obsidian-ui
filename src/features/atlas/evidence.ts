import { isDirectMaterialFileTarget } from '../../infrastructure/resource-target';
import {
  buildAtlasGraph,
  type AtlasEdge,
  type AtlasGraphStore,
  type EvidenceBinding,
} from './graph';

/**
 * Evidence opening policy (P4 step 28, plan step 14).
 *
 * A link carries only a relation identity and a binding ordinal — never a
 * path. Resolution reads the accepted manifest snapshot: unknown relations,
 * out-of-range ordinals and unsupported digests refuse, and every outcome
 * names the source and physical page so a failed viewer still leaves the
 * reader with the citation.
 */

export interface EvidencePorts {
  readonly store: AtlasGraphStore & { get(id: string): unknown };
  openMaterialPath(path: string, destination: { page: number; label: string }): unknown;
  notify(message: string): void;
}

export type EvidenceParams =
  | { readonly relationId: string; readonly ordinal: number }
  | { readonly error: string };

const RELATION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*--[A-Za-z0-9._-]+--[A-Za-z0-9][A-Za-z0-9._-]*$/;
const DIGEST = /^[0-9a-f]{64}$/;

/** Only `relation` and `ordinal` may arrive; anything else refuses. */
export function parseEvidenceParams(
  params: Readonly<Record<string, string>>,
): EvidenceParams {
  const keys = Object.keys(params).filter((key) => params[key] !== '');
  if (keys.some((key) => key !== 'relation' && key !== 'ordinal')) {
    return { error: 'Evidence link refused: unexpected parameters.' };
  }
  const relationId = params.relation ?? '';
  const ordinalText = params.ordinal ?? '';
  if (!RELATION_ID.test(relationId)) {
    return { error: 'Evidence link refused: unknown relation.' };
  }
  if (!/^\d{1,2}$/.test(ordinalText)) {
    return { error: 'Evidence link refused: invalid binding ordinal.' };
  }
  return { relationId, ordinal: Number(ordinalText) };
}

export function resolveEvidenceBinding(
  graph: ReturnType<typeof buildAtlasGraph>,
  relationId: string,
  ordinal: number,
): { readonly edge: AtlasEdge; readonly binding: EvidenceBinding } | { readonly error: string } {
  const edge = graph.relationByIdentity.get(relationId);
  if (!edge) return { error: `Evidence link refused: unknown relation ${relationId}.` };
  const binding = edge.evidence[ordinal];
  if (!binding) {
    return { error: `No evidence binding ${ordinal} is recorded for ${relationId}.` };
  }
  if (!DIGEST.test(binding.file_sha256)) {
    return { error: 'Evidence binding has an unsupported digest; nothing was opened.' };
  }
  if (!Number.isInteger(binding.page) || binding.page < 1) {
    return { error: 'Evidence binding has no physical page; nothing was opened.' };
  }
  return { edge, binding };
}

/** Open one binding at its physical page. Returns false after a refusal. */
export function openEvidenceBinding(
  ports: EvidencePorts,
  relationId: string,
  ordinal: number,
): boolean {
  const graph = buildAtlasGraph(ports.store);
  const resolved = resolveEvidenceBinding(graph, relationId, ordinal);
  if ('error' in resolved) {
    ports.notify(resolved.error);
    return false;
  }
  const { binding } = resolved;
  const destination = { page: binding.page, label: `physical page ${binding.page}` };
  const source = ports.store.get(binding.source_id) as
    { material_path?: unknown } | null;
  if (source && isDirectMaterialFileTarget(source as never)) {
    void ports.openMaterialPath(String(source.material_path), destination);
    return true;
  }
  void ports.openMaterialPath(`materials/${binding.material_relpath}`, destination);
  return true;
}

/** The protocol action name, registered once in the composition root. */
export const EVIDENCE_PROTOCOL_ACTION = 'learningos-atlas-evidence';
