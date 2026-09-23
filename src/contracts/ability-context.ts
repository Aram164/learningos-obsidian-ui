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
 * The interface never computes a state. Every `state`, `reasons`, `supported`
 * and `missing_or_uncertain` below is Core's answer, rendered as given.
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

type Loose = Record<string, unknown>;

const STATES: ReadonlySet<string> = new Set(['supported', 'nearby', 'uncertain', 'unmapped']);
const RESULTS: ReadonlySet<string> = new Set(['correct', 'incorrect', 'partial', 'abandoned']);
const KINDS: ReadonlySet<string> = new Set(['equivalence', 'extension', 'connection']);
const FRESHNESS: ReadonlySet<string> = new Set(['current', 'stale', 'unavailable', 'not-reviewed']);

function record(value: unknown): Loose | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Loose
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function strings(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((item) => typeof item === 'string')
    ? value as string[]
    : null;
}

function optionalStrings(value: unknown): string[] | null {
  return value === undefined ? [] : strings(value);
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function header(value: unknown): Loose | null {
  const response = record(value);
  if (!response
    || response.contract !== ABILITY_CONTEXT_CONTRACT
    || response.schema_version !== 1
    || typeof response.snapshot_id !== 'string'
    || !/^sha256:[a-f0-9]{64}$/.test(response.snapshot_id)) return null;
  return response;
}

function route(value: unknown): AbilityRouteV1 | null {
  const row = record(value);
  const reason = row ? text(row.reason) : null;
  const supported = row ? strings(row.supported) : null;
  const missing = row ? strings(row.missing_or_uncertain) : null;
  const remaining = row ? optionalStrings(row.remaining_work) : null;
  if (!row || !reason || !supported || !missing || !remaining) return null;
  return {
    reason,
    source: text(row.source),
    supported,
    missing_or_uncertain: missing,
    remaining_work: remaining,
  };
}

function transfer(value: unknown): AbilityTransferV1 | null {
  const row = record(value);
  if (!row) return null;
  const from = text(row.from);
  const source = text(row.source);
  const carries = text(row.carries);
  const changes = text(row.changes);
  return from && source && carries && changes ? { from, source, carries, changes } : null;
}

function evidence(value: unknown): AbilityEvidenceV1 | null {
  const row = record(value);
  if (!row) return null;
  const id = text(row.id);
  const workRef = text(row.work_ref);
  if (!id || !workRef || !RESULTS.has(String(row.result))) return null;
  const origin = record(row.origin);
  const conditions = optionalStrings(row.conditions);
  const notMet = optionalStrings(row.conditions_not_met);
  const tags = optionalStrings(row.evidence_tags);
  if (!conditions || !notMet || !tags) return null;
  return {
    id,
    result: row.result as AbilityResultV1,
    work_ref: workRef,
    claim: text(row.claim),
    activity: text(row.activity),
    timestamp: text(row.timestamp),
    assistance: typeof row.assistance === 'string' ? row.assistance : null,
    conditions,
    conditions_not_met: notMet,
    evidence_tags: tags,
    confirmation_ref: text(row.confirmation_ref),
    supersedes: text(row.supersedes),
    origin_path: origin ? text(origin.path) : null,
    workspace_id: origin ? text(origin.workspace_id) : null,
  };
}

function list<T>(value: unknown, decode: (item: unknown) => T | null): T[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const item of value) {
    const decoded = decode(item);
    if (decoded === null) return null;
    out.push(decoded);
  }
  return out;
}

function row(value: unknown): AbilityRowV1 | null {
  const item = record(value);
  if (!item) return null;
  const id = text(item.id);
  const title = text(item.title);
  const reasons = strings(item.reasons);
  const concepts = strings(item.concept_ids);
  const modules = optionalStrings(item.module_ids);
  const routes = list(item.preparation_routes, route);
  const transfers = list(item.transfer, transfer);
  const rows = list(item.evidence, evidence);
  const lifecycle = item.lifecycle === undefined ? 'active' : item.lifecycle;
  if (!id || !title || !STATES.has(String(item.state)) || !reasons || !concepts
    || !modules || !routes || !transfers || !rows
    || (lifecycle !== 'active' && lifecycle !== 'retired')) return null;
  return {
    id,
    title,
    lifecycle,
    state: item.state as AbilityStateV1,
    reasons,
    concept_ids: concepts,
    module_ids: modules,
    preparation_routes: routes,
    transfer: transfers,
    evidence: rows,
  };
}

function review(value: unknown): AbilityReviewV1 | null {
  const item = record(value);
  if (!item || (item.state !== 'candidate' && item.state !== 'reviewed')) return null;
  return {
    state: item.state,
    reviewed_by: text(item.reviewed_by),
    reviewed_on: text(item.reviewed_on),
  };
}

function bridge(value: unknown): AbilityBridgeV1 | null {
  const item = record(value);
  if (!item) return null;
  const from = text(item.from);
  const to = text(item.to);
  const carries = text(item.carries);
  const changes = text(item.changes);
  const source = text(item.source);
  const conditions = optionalStrings(item.conditions);
  const reviewed = review(item.review);
  const freshness = record(item.source_freshness);
  const status = freshness && FRESHNESS.has(String(freshness.status))
    ? freshness.status as BridgeFreshnessStatusV1
    : null;
  if (!from || !to || !carries || !changes || !source || !conditions || !reviewed
    || !KINDS.has(String(item.kind))) return null;
  return {
    from,
    to,
    kind: item.kind as AbilityBridgeKindV1,
    carries,
    changes,
    conditions,
    source,
    source_sha256: text(item.source_sha256),
    review: reviewed,
    // A bridge Core did not observe is not current. Absence reads as unknown,
    // which is the one state that can never carry evidence.
    freshness: status ?? (reviewed.state === 'reviewed' ? 'unavailable' : 'not-reviewed'),
  };
}

function candidate(value: unknown): AbilityCandidateV1 | null {
  const item = record(value);
  if (!item) return null;
  const id = text(item.id);
  const from = text(item.from);
  const to = text(item.to);
  const carries = text(item.carries);
  const changes = text(item.changes);
  const sourceRef = text(item.source_ref);
  const created = text(item.created_at);
  const conditions = optionalStrings(item.conditions);
  if (!id || !from || !to || !carries || !changes || !sourceRef || !created || !conditions
    || !KINDS.has(String(item.kind))) return null;
  return {
    id, from, to, kind: item.kind as AbilityBridgeKindV1, carries, changes,
    conditions, source_ref: sourceRef, created_at: created,
  };
}

function encounterMaterial(value: unknown): AbilityEncounterMaterialV1 | null {
  const item = record(value);
  if (!item) return null;
  return {
    route_id: text(item.route_id),
    source_id: text(item.source_id),
    locator: text(item.locator),
    match_state: text(item.match_state) ?? 'unmapped',
  };
}

function encounter(value: unknown): AbilityEncounterV1 | null {
  const item = record(value);
  if (!item) return null;
  const moduleId = text(item.module_id);
  const unitId = text(item.unit_id);
  const stageId = text(item.stage_id);
  const materials = list(item.materials, encounterMaterial);
  if (!moduleId || !unitId || !stageId || !materials) return null;
  return {
    module_id: moduleId,
    unit_id: unitId,
    study_map_id: text(item.study_map_id),
    stage_id: stageId,
    title: text(item.title),
    objective: text(item.objective),
    status: text(item.status),
    materials,
  };
}

function relatedEncounter(value: unknown): AbilityRelatedEncounterV1 | null {
  const item = record(value);
  if (!item) return null;
  const moduleId = text(item.module_id);
  const unitId = text(item.unit_id);
  const stageId = text(item.stage_id);
  const abilities = strings(item.ability_ids);
  const routes = optionalStrings(item.route_ids);
  if (!moduleId || !unitId || !stageId || !abilities || !routes) return null;
  return {
    module_id: moduleId,
    unit_id: unitId,
    stage_id: stageId,
    title: text(item.title),
    objective: text(item.objective),
    ability_ids: abilities,
    route_ids: routes,
    route_total: count(item.route_total) ?? routes.length,
    routes_truncated: item.routes_truncated === true,
  };
}

/** The bounded horizon, or null when Core answered with anything else. */
export function asAbilityBrief(value: unknown): AbilityBriefV1 | null {
  const response = header(value);
  if (!response || response.focus !== undefined) return null;
  const abilities = list(response.abilities, row);
  const bridges = list(response.bridges, bridge);
  const candidates = list(response.candidate_connections, candidate);
  const total = count(response.total);
  if (!abilities || !bridges || !candidates || total === null) return null;
  return {
    snapshot_id: response.snapshot_id as string,
    abilities,
    total,
    truncated: response.truncated === true,
    bridges,
    candidate_connections: candidates,
    candidate_connection_count: count(response.candidate_connection_count) ?? candidates.length,
  };
}

function definition(value: unknown): AbilityDefinitionV1 | null {
  const base = row(value);
  const item = record(value);
  if (!base || !item) return null;
  const claim = text(item.claim);
  const conditions = strings(item.conditions);
  const spec = strings(item.evidence_spec);
  const reviewed = review(item.review);
  if (!claim || !conditions || !spec || !reviewed) return null;
  return {
    ...base,
    claim,
    source: text(item.source),
    conditions,
    evidence_spec: spec,
    review: reviewed,
  };
}

/** One expanded ability, or null. An unmapped focus is `asAbilityUnmapped`. */
export function asAbilityFocus(value: unknown): AbilityFocusV1 | null {
  const response = header(value);
  if (!response) return null;
  const focus = text(response.focus);
  const ability = definition(response.ability);
  const bridges = list(response.bridges, bridge);
  const encounters = list(response.encounters, encounter);
  const related = list(response.related_encounters, relatedEncounter);
  const candidates = list(response.candidate_connections, candidate);
  const shared = optionalStrings(response.shared_concept_candidates);
  if (!focus || !ability || ability.id !== focus || !bridges || !encounters || !related
    || !candidates || !shared) return null;
  return {
    snapshot_id: response.snapshot_id as string,
    focus,
    ability,
    bridges,
    encounters,
    related_encounters: related,
    related_encounters_total: count(response.related_encounters_total) ?? related.length,
    candidate_connections: candidates,
    shared_concept_candidates: shared,
  };
}

/** Core's answer for an identity no reviewed ability maps. Not a knowledge gap. */
export function asAbilityUnmapped(value: unknown): AbilityUnmappedV1 | null {
  const response = header(value);
  if (!response || response.state !== 'unmapped' || response.ability !== undefined) return null;
  const focus = text(response.focus);
  const reason = text(response.reason);
  return focus && reason
    ? { snapshot_id: response.snapshot_id as string, focus, reason }
    : null;
}
