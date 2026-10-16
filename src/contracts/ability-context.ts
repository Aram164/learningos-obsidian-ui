import { validateAbilityBriefWire, validateAbilityFocusWire, validateAbilityUnmappedWire } from './generated/responses.validator.cjs';
import type * as Wire from './generated/responses.types';
/**
 * Decoders for Core's snapshot-bound `ability.context` query
 * (`system/schema/ability-context.schema.json`, result `ability-context-v1`).
 *
 * The response has three shapes: the bounded horizon (no focus), one focused
 * ability, and an unmapped focus. Each decoder answers null for anything that
 * is not that shape, so a view can say "Core answered with something this
 * build cannot read" instead of rendering half of it. Unknown extra keys are
 * tolerated: the producer may add fields without a paired UI release, and
 * nothing here re-derives meaning from them.
 *
 * The interface never computes a state. Every `state`, `reasons`,
 * `reason_codes`, `supported` and `missing_or_uncertain` below is Core's
 * answer, rendered as given.
 */

export const ABILITY_CONTEXT_CONTRACT = 'ability-context-v1';

export type AbilityStateV1 = 'supported' | 'nearby' | 'uncertain' | 'unmapped';
export type AbilityResultV1 = 'correct' | 'incorrect' | 'partial' | 'abandoned';
export type AbilityBridgeKindV1 = 'equivalence' | 'extension' | 'connection';
export type BridgeFreshnessStatusV1 = 'current' | 'stale' | 'unavailable' | 'not-reviewed';

export interface AbilityRouteV1 {
  readonly reason: string;
  readonly source: string | null;
  readonly supported: readonly string[];
  readonly missing_or_uncertain: readonly string[];
  readonly remaining_work: readonly string[];
}

export interface AbilityTransferV1 {
  readonly from: string;
  readonly source: string;
  readonly carries: string;
  readonly changes: string;
}

/**
 * One piece of recorded learner work. A horizon read carries only the last two
 * rows' identity, result and work pointer; a focused read carries the whole
 * ledger, corrections included, with the origin line that holds each row.
 */
export interface AbilityEvidenceV1 {
  readonly id: string;
  readonly result: AbilityResultV1;
  readonly work_ref: string;
  readonly claim: string | null;
  readonly activity: string | null;
  readonly timestamp: string | null;
  readonly assistance: string | null;
  readonly conditions: readonly string[];
  readonly conditions_not_met: readonly string[];
  readonly evidence_tags: readonly string[];
  readonly confirmation_ref: string | null;
  readonly supersedes: string | null;
  readonly origin_path: string | null;
  readonly workspace_id: string | null;
}

export interface AbilityRowV1 {
  readonly id: string;
  readonly title: string;
  readonly lifecycle: 'active' | 'retired';
  readonly state: AbilityStateV1;
  readonly reasons: readonly string[];
  /**
   * Stable codes parallel to `reasons`, decided by Core from the same
   * structured facts the prose describes. Decisions read this list;
   * prose is display only. Absent from older Cores, which decode as [].
   */
  readonly reason_codes: readonly string[];
  readonly concept_ids: readonly string[];
  readonly module_ids: readonly string[];
  readonly preparation_routes: readonly AbilityRouteV1[];
  readonly transfer: readonly AbilityTransferV1[];
  readonly evidence: readonly AbilityEvidenceV1[];
}

export interface AbilityReviewV1 {
  readonly state: 'candidate' | 'reviewed';
  readonly reviewed_by: string | null;
  readonly reviewed_on: string | null;
}

/** The reviewed identity plus Core's current answer about it. */
export interface AbilityDefinitionV1 extends AbilityRowV1 {
  readonly claim: string;
  readonly source: string | null;
  readonly conditions: readonly string[];
  readonly evidence_spec: readonly string[];
  readonly review: AbilityReviewV1;
}

export interface AbilityBridgeV1 {
  readonly from: string;
  readonly to: string;
  readonly kind: AbilityBridgeKindV1;
  readonly carries: string;
  readonly changes: string;
  readonly conditions: readonly string[];
  readonly source: string;
  readonly source_sha256: string | null;
  readonly review: AbilityReviewV1;
  readonly freshness: BridgeFreshnessStatusV1;
}

/** A tentative, conversation- or app-derived connection. It grants nothing. */
export interface AbilityCandidateV1 {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: AbilityBridgeKindV1;
  readonly carries: string;
  readonly changes: string;
  readonly conditions: readonly string[];
  readonly source_ref: string;
  readonly created_at: string;
}

export interface AbilityEncounterMaterialV1 {
  readonly route_id: string | null;
  readonly source_id: string | null;
  readonly locator: string | null;
  readonly match_state: string;
}

/** A stage that lists this ability. Its status is progress, never evidence. */
export interface AbilityEncounterV1 {
  readonly module_id: string;
  readonly unit_id: string;
  readonly study_map_id: string | null;
  readonly stage_id: string;
  readonly title: string | null;
  readonly objective: string | null;
  readonly status: string | null;
  readonly materials: readonly AbilityEncounterMaterialV1[];
}

/** A stage that lists a prerequisite or bridged ability — often another module. */
export interface AbilityRelatedEncounterV1 {
  readonly module_id: string;
  readonly unit_id: string;
  readonly stage_id: string;
  readonly title: string | null;
  readonly objective: string | null;
  readonly ability_ids: readonly string[];
  readonly route_ids: readonly string[];
  readonly route_total: number;
  readonly routes_truncated: boolean;
}

export interface AbilityBriefV1 {
  readonly snapshot_id: string;
  readonly abilities: readonly AbilityRowV1[];
  readonly total: number;
  readonly truncated: boolean;
  /** Bridges whose two ends are both listed. Absent from older Cores. */
  readonly bridges: readonly AbilityBridgeV1[];
  readonly candidate_connections: readonly AbilityCandidateV1[];
  readonly candidate_connection_count: number;
}

export interface AbilityFocusV1 {
  readonly snapshot_id: string;
  readonly focus: string;
  readonly ability: AbilityDefinitionV1;
  readonly bridges: readonly AbilityBridgeV1[];
  readonly encounters: readonly AbilityEncounterV1[];
  readonly related_encounters: readonly AbilityRelatedEncounterV1[];
  readonly related_encounters_total: number;
  readonly candidate_connections: readonly AbilityCandidateV1[];
  readonly shared_concept_candidates: readonly string[];
}

export interface AbilityUnmappedV1 {
  readonly snapshot_id: string;
  readonly focus: string;
  readonly reason: string;
}

// These are view projections: shape is checked once by Core's generated validator.
type Loose = Record<string, unknown>;
const FRESHNESS = new Set(['current', 'stale', 'unavailable', 'not-reviewed']);
function record(value: unknown): Loose | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Loose : null;
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}
function list<T, U>(value: readonly T[] | undefined, project: (item: T) => U): U[] {
  return (value ?? []).map(project);
}
function route(item: Wire.AbilityRouteWire): AbilityRouteV1 {
  return { reason: item.reason, source: text(item.source), supported: item.supported,
    missing_or_uncertain: item.missing_or_uncertain, remaining_work: item.remaining_work ?? [] };
}
function evidence(item: Wire.AbilityEvidenceWire): AbilityEvidenceV1 {
  const origin = record(item.origin);
  return { id: item.id, result: item.result, work_ref: item.work_ref,
    claim: text(item.claim), activity: text(item.activity), timestamp: text(item.timestamp),
    assistance: typeof item.assistance === 'string' ? item.assistance : null,
    conditions: item.conditions ?? [], conditions_not_met: item.conditions_not_met ?? [],
    evidence_tags: item.evidence_tags ?? [], confirmation_ref: text(item.confirmation_ref),
    supersedes: text(item.supersedes), origin_path: origin ? text(origin.path) : null,
    workspace_id: origin ? text(origin.workspace_id) : null };
}
function row(item: Wire.AbilityRowWire): AbilityRowV1 | null {
  // A schema validates each list; this relation binds their meaning together.
  if (item.reason_codes !== undefined && item.reason_codes.length !== item.reasons.length) return null;
  return { id: item.id, title: item.title, lifecycle: item.lifecycle ?? 'active', state: item.state,
    reasons: item.reasons, reason_codes: item.reason_codes ?? [], concept_ids: item.concept_ids,
    module_ids: item.module_ids ?? [], preparation_routes: list(item.preparation_routes, route),
    transfer: list(item.transfer, (entry) => ({ from: entry.from, source: entry.source,
      carries: entry.carries, changes: entry.changes })), evidence: list(item.evidence, evidence) };
}
function review(item: Wire.AbilityReviewWire): AbilityReviewV1 {
  return { state: item.state, reviewed_by: text(item.reviewed_by), reviewed_on: text(item.reviewed_on) };
}
function bridge(item: Wire.AbilityBridgeWire): AbilityBridgeV1 {
  const freshness = record(item.source_freshness);
  const status = freshness && FRESHNESS.has(String(freshness.status))
    ? freshness.status as BridgeFreshnessStatusV1 : null;
  return { from: item.from, to: item.to, kind: item.kind, carries: item.carries, changes: item.changes,
    conditions: item.conditions ?? [], source: item.source, source_sha256: text(item.source_sha256),
    review: review(item.review), freshness: status ?? (item.review.state === 'reviewed' ? 'unavailable' : 'not-reviewed') };
}
function candidate(item: Wire.AbilityCandidateWire): AbilityCandidateV1 {
  return { id: item.id, from: item.from, to: item.to, kind: item.kind, carries: item.carries,
    changes: item.changes, conditions: item.conditions ?? [], source_ref: item.source_ref, created_at: item.created_at };
}
function encounterMaterial(value: object): AbilityEncounterMaterialV1 {
  const item = value as Loose;
  return { route_id: text(item.route_id), source_id: text(item.source_id), locator: text(item.locator),
    match_state: text(item.match_state) ?? 'unmapped' };
}
function encounter(item: Wire.AbilityEncounterWire): AbilityEncounterV1 {
  return { module_id: item.module_id, unit_id: item.unit_id, study_map_id: text(item.study_map_id),
    stage_id: item.stage_id, title: text(item.title), objective: text(item.objective), status: text(item.status),
    materials: list(item.materials, encounterMaterial) };
}
function relatedEncounter(item: Wire.AbilityRelatedEncounterWire): AbilityRelatedEncounterV1 {
  const routes = item.route_ids ?? [];
  return { module_id: item.module_id, unit_id: item.unit_id, stage_id: item.stage_id,
    title: text(item.title), objective: text(item.objective), ability_ids: item.ability_ids,
    route_ids: routes, route_total: count(item.route_total) ?? routes.length,
    routes_truncated: item.routes_truncated === true };
}
function definition(item: Wire.AbilityDefinitionWire): AbilityDefinitionV1 | null {
  const base = row(item);
  return base ? { ...base, claim: item.claim, source: text(item.source), conditions: item.conditions,
    evidence_spec: item.evidence_spec, review: review(item.review) } : null;
}
export function asAbilityBrief(value: unknown): AbilityBriefV1 | null {
  if (!validateAbilityBriefWire(value)) return null;
  const abilities = list(value.abilities, row);
  if (abilities.some((item) => item === null)) return null;
  const candidates = list(value.candidate_connections, candidate);
  return { snapshot_id: value.snapshot_id, abilities: abilities as AbilityRowV1[], total: value.total,
    truncated: value.truncated === true, bridges: list(value.bridges, bridge), candidate_connections: candidates,
    candidate_connection_count: count(value.candidate_connection_count) ?? candidates.length };
}
export function asAbilityFocus(value: unknown): AbilityFocusV1 | null {
  if (!validateAbilityFocusWire(value)) return null;
  const ability = definition(value.ability);
  if (!ability || ability.id !== value.focus) return null;
  const related = list(value.related_encounters, relatedEncounter);
  return { snapshot_id: value.snapshot_id, focus: value.focus, ability, bridges: list(value.bridges, bridge),
    encounters: list(value.encounters, encounter), related_encounters: related,
    related_encounters_total: count(value.related_encounters_total) ?? related.length,
    candidate_connections: list(value.candidate_connections, candidate),
    shared_concept_candidates: value.shared_concept_candidates ?? [] };
}
export function asAbilityUnmapped(value: unknown): AbilityUnmappedV1 | null {
  return validateAbilityUnmappedWire(value)
    ? { snapshot_id: value.snapshot_id, focus: value.focus, reason: value.reason } : null;
}
