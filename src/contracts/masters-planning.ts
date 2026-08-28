export type PlanningStateV1 = 'longlist' | 'shortlist' | 'selected' | 'rejected' | 'promoted';
export type FactStatusV1 = 'unverified' | 'verified-current' | 'stale' | 'conflicting';
export type RouteReviewStatusV1 = 'deep-reviewed' | 'screened' | 'unevaluated' | 'unavailable';
export type CandidateSourceRoleV1 = 'selected' | 'current' | 'prerequisite' | 'comparison';
export type ComparisonRelationV1 =
  | 'duplicates' | 'overlaps' | 'complements' | 'extends' | 'contrasts' | 'alternate-notation';

export interface FactStateV1 {
  readonly status: FactStatusV1;
  readonly as_of: string | null;
  readonly evidence: readonly string[];
}

export interface CandidateModuleV1 {
  readonly id: string;
  readonly title: string;
  readonly planning_state: PlanningStateV1;
  readonly privacy_class: 'academic-only';
  readonly provenance: readonly string[];
  readonly fact_state: FactStateV1;
  readonly source_ids: readonly string[];
  readonly unresolved_references: readonly string[];
  readonly promoted_module_id?: string;
}

export interface CandidateSourceV1 {
  readonly id: string;
  readonly title: string;
  readonly planning_state: PlanningStateV1;
  readonly privacy_class: 'academic-only';
  readonly provenance: readonly string[];
  readonly fact_state: FactStateV1;
  readonly canonical_source_id?: string;
}

export interface MasterPlanningCatalogV1 {
  readonly schema_version: 1;
  readonly id: 'master-planning-catalog';
  readonly type: 'master-planning-catalog';
  readonly revision: number;
  readonly updated_at: string;
  readonly candidate_modules: readonly CandidateModuleV1[];
  readonly candidate_sources: readonly CandidateSourceV1[];
  readonly comparison_ids: readonly string[];
}

export interface CandidateComparisonBasisV1 {
  readonly catalog_revision: number;
  readonly candidate_set_checksum: string;
  readonly policy: 'tiered-v1';
  readonly request_id: string;
  readonly delivery_id: string;
}

export interface CandidateComparisonEvidenceV1 {
  readonly locator: string;
  readonly checksum: string;
  readonly note?: string;
}

export interface CandidateSourcePairComparisonV1 {
  readonly left_candidate_source_id: string;
  readonly right_candidate_source_id: string;
  readonly relation: ComparisonRelationV1;
  readonly narrative: string;
  readonly concept_ids: readonly string[];
  readonly evidence: {
    readonly left: readonly CandidateComparisonEvidenceV1[];
    readonly right: readonly CandidateComparisonEvidenceV1[];
  };
}

export interface CandidateSourceComparisonV1 {
  readonly schema_version: 1;
  readonly id: string;
  readonly type: 'candidate-source-comparison';
  readonly candidate_module_id: string;
  readonly status: 'approved';
  readonly basis: CandidateComparisonBasisV1;
  readonly source_assessments: readonly CandidateSourceAssessmentV1[];
  readonly comparisons: readonly CandidateSourcePairComparisonV1[];
}

export interface CandidateSourceAssessmentV1 {
  readonly candidate_source_id: string;
  readonly role: CandidateSourceRoleV1;
  readonly review_status: RouteReviewStatusV1;
  readonly concept_ids: readonly string[];
  readonly contribution?: string;
  readonly assumptions?: string;
  readonly notation?: string;
  readonly exercise_value?: string;
  readonly best_for?: string;
  readonly limitations?: string;
  readonly reason?: string;
  readonly evidence?: readonly CandidateComparisonEvidenceV1[];
}

export interface MastersPlanningDashboardV1 {
  readonly schema_version: 1;
  readonly type: 'masters-planning-dashboard';
  readonly opened_at: string;
  readonly banner: 'Prospective—not current LearningOS';
  readonly catalog: MasterPlanningCatalogV1 | null;
  readonly comparisons: readonly CandidateSourceComparisonV1[];
  readonly isolation: {
    readonly normal_manifest: false;
    readonly search: false;
    readonly workload: false;
    readonly recommendations: false;
    readonly deadlines: false;
    readonly ordinary_ai_context: false;
  };
}

type Row = Record<string, unknown>;
const row = (value: unknown): Row | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Row : null;
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const date = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime())
    && parsed.getUTCFullYear() === Number(match[1])
    && parsed.getUTCMonth() + 1 === Number(match[2])
    && parsed.getUTCDate() === Number(match[3]);
};
const dateTime = (value: unknown): value is string =>
  typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));
const natural = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const id = (value: unknown, prefix: string): value is string =>
  typeof value === 'string' && new RegExp(`^${prefix}[a-z0-9]+(?:-[a-z0-9]+)*$`).test(value);
function exact(value: Row, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
}
function stringList(
  value: unknown,
  pattern: (item: unknown) => item is string = text,
  unique = false,
): value is string[] {
  return Array.isArray(value) && value.every(pattern)
    && (!unique || new Set(value).size === value.length);
}

const planningStates: readonly PlanningStateV1[] = [
  'longlist', 'shortlist', 'selected', 'rejected', 'promoted',
];
const factStatuses: readonly FactStatusV1[] = [
  'unverified', 'verified-current', 'stale', 'conflicting',
];
const reviewStatuses: readonly RouteReviewStatusV1[] = [
  'deep-reviewed', 'screened', 'unevaluated', 'unavailable',
];
const sourceRoles: readonly CandidateSourceRoleV1[] = [
  'selected', 'current', 'prerequisite', 'comparison',
];
const relations: readonly ComparisonRelationV1[] = [
  'duplicates', 'overlaps', 'complements', 'extends', 'contrasts', 'alternate-notation',
];
const sha256 = (value: unknown): value is string =>
  typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);

function evidence(value: unknown): CandidateComparisonEvidenceV1 | null {
  const source = row(value);
  if (!source || !exact(source, ['locator', 'checksum'], ['note'])
    || !text(source.locator) || !sha256(source.checksum)
    || ('note' in source && !text(source.note))) return null;
  return {
    locator: source.locator,
    checksum: source.checksum,
    ...('note' in source ? { note: source.note as string } : {}),
  };
}

function factState(value: unknown): FactStateV1 | null {
  const state = row(value);
  if (!state || !exact(state, ['status', 'as_of', 'evidence'])
    || !factStatuses.includes(state.status as FactStatusV1)
    || !(state.as_of === null || date(state.as_of))
    || !stringList(state.evidence)) return null;
  return {
    status: state.status as FactStatusV1,
    as_of: state.as_of as string | null,
    evidence: state.evidence,
  };
}

function catalog(value: unknown): MasterPlanningCatalogV1 | null {
  const source = row(value);
  if (!source || !exact(source, [
    'schema_version', 'id', 'type', 'revision', 'updated_at',
    'candidate_modules', 'candidate_sources', 'comparison_ids',
  ]) || source.schema_version !== 1 || source.id !== 'master-planning-catalog'
    || source.type !== 'master-planning-catalog' || !natural(source.revision)
    || !dateTime(source.updated_at) || !Array.isArray(source.candidate_modules)
    || !Array.isArray(source.candidate_sources)
    || !stringList(source.comparison_ids,
      (item): item is string => id(item, 'candidate-comparison-'), true)) return null;

  const modules: CandidateModuleV1[] = [];
  for (const valueModule of source.candidate_modules) {
    const module = row(valueModule);
    const facts = factState(module?.fact_state);
    if (!module || !exact(module, [
      'id', 'title', 'planning_state', 'privacy_class', 'provenance',
      'fact_state', 'source_ids', 'unresolved_references',
    ], ['promoted_module_id']) || !id(module.id, 'candidate-module-') || !text(module.title)
      || !planningStates.includes(module.planning_state as PlanningStateV1)
      || module.privacy_class !== 'academic-only' || !stringList(module.provenance)
      || module.provenance.length === 0
      || !facts || !stringList(module.source_ids,
        (item): item is string => id(item, 'candidate-source-'), true)
      || !stringList(module.unresolved_references, text, true)
      || ('promoted_module_id' in module && !id(module.promoted_module_id, 'module-'))) return null;
    modules.push({
      id: module.id,
      title: module.title,
      planning_state: module.planning_state as PlanningStateV1,
      privacy_class: 'academic-only',
      provenance: module.provenance,
      fact_state: facts,
      source_ids: module.source_ids,
      unresolved_references: module.unresolved_references,
      ...('promoted_module_id' in module
        ? { promoted_module_id: module.promoted_module_id as string }
        : {}),
    });
  }

  const sources: CandidateSourceV1[] = [];
  for (const valueCandidate of source.candidate_sources) {
    const candidate = row(valueCandidate);
    const facts = factState(candidate?.fact_state);
    if (!candidate || !exact(candidate, [
      'id', 'title', 'planning_state', 'privacy_class', 'provenance', 'fact_state',
    ], ['canonical_source_id']) || !id(candidate.id, 'candidate-source-')
      || !text(candidate.title)
      || !planningStates.includes(candidate.planning_state as PlanningStateV1)
      || candidate.privacy_class !== 'academic-only' || !stringList(candidate.provenance)
      || candidate.provenance.length === 0
      || !facts || ('canonical_source_id' in candidate
        && !id(candidate.canonical_source_id, 'source-'))) return null;
    sources.push({
      id: candidate.id,
      title: candidate.title,
      planning_state: candidate.planning_state as PlanningStateV1,
      privacy_class: 'academic-only',
      provenance: candidate.provenance,
      fact_state: facts,
      ...('canonical_source_id' in candidate
        ? { canonical_source_id: candidate.canonical_source_id as string }
        : {}),
    });
  }
  return {
    schema_version: 1,
    id: 'master-planning-catalog',
    type: 'master-planning-catalog',
    revision: source.revision,
    updated_at: source.updated_at,
    candidate_modules: modules,
    candidate_sources: sources,
    comparison_ids: source.comparison_ids,
  };
}

function assessment(value: unknown): CandidateSourceAssessmentV1 | null {
  const source = row(value);
  if (!source || !exact(source, ['candidate_source_id', 'role', 'review_status', 'concept_ids'], [
    'contribution', 'assumptions', 'notation', 'exercise_value', 'best_for',
    'limitations', 'reason', 'evidence',
  ]) || !id(source.candidate_source_id, 'candidate-source-')
    || !sourceRoles.includes(source.role as CandidateSourceRoleV1)
    || !reviewStatuses.includes(source.review_status as RouteReviewStatusV1)
    || !stringList(source.concept_ids,
      (item): item is string => id(item, 'concept-'), true)) return null;
  const deep = source.review_status === 'deep-reviewed';
  const deepFields = ['contribution', 'assumptions', 'notation', 'exercise_value', 'best_for', 'limitations'];
  if (deep !== deepFields.every((key) => text(source[key]))) return null;
  if ('reason' in source && !text(source.reason)) return null;
  if (!deep && !text(source.reason)) return null;
  if (deepFields.some((key) => key in source) && !deep) return null;
  if (source.role !== 'comparison' && !deep) return null;
  if ('evidence' in source && (!Array.isArray(source.evidence)
    || source.evidence.some((item) => evidence(item) === null))) return null;
  if (deep && (!Array.isArray(source.evidence) || source.evidence.length === 0)) return null;
  return source as unknown as CandidateSourceAssessmentV1;
}

function comparison(
  value: unknown,
  parsedCatalog: MasterPlanningCatalogV1,
  knownConceptIds: ReadonlySet<string>,
): CandidateSourceComparisonV1 | null {
  const source = row(value);
  if (!source || !exact(source, [
    'schema_version', 'id', 'type', 'candidate_module_id', 'status',
    'basis', 'source_assessments', 'comparisons',
  ]) || source.schema_version !== 1 || !id(source.id, 'candidate-comparison-')
    || source.type !== 'candidate-source-comparison'
    || !id(source.candidate_module_id, 'candidate-module-') || source.status !== 'approved'
    || !Array.isArray(source.source_assessments) || !Array.isArray(source.comparisons)) return null;
  const basis = row(source.basis);
  if (!basis || !exact(basis, [
    'catalog_revision', 'candidate_set_checksum', 'policy', 'request_id', 'delivery_id',
  ]) || !natural(basis.catalog_revision) || !sha256(basis.candidate_set_checksum)
    || basis.policy !== 'tiered-v1' || !text(basis.request_id) || !text(basis.delivery_id)) return null;
  const assessments = source.source_assessments.map(assessment);
  if (assessments.some((item) => item === null) || assessments.length === 0) return null;
  if (!assessments.some((item) => item?.role === 'selected')) return null;
  const module = parsedCatalog.candidate_modules.find(
    (item) => item.id === source.candidate_module_id,
  );
  if (!module) return null;
  const catalogSourceIds = new Set(parsedCatalog.candidate_sources.map((item) => item.id));
  const assessedById = new Map<string, CandidateSourceAssessmentV1>();
  for (const item of assessments as CandidateSourceAssessmentV1[]) {
    if (assessedById.has(item.candidate_source_id)
      || !catalogSourceIds.has(item.candidate_source_id)
      || item.concept_ids.some((conceptId) => !knownConceptIds.has(conceptId))) return null;
    assessedById.set(item.candidate_source_id, item);
  }
  const expectedSourceIds = new Set(module.source_ids);
  if (assessedById.size !== expectedSourceIds.size
    || [...assessedById.keys()].some((sourceId) => !expectedSourceIds.has(sourceId))) return null;
  const comparisons: CandidateSourceComparisonV1['comparisons'][number][] = [];
  const seenComparisons = new Set<string>();
  for (const valuePair of source.comparisons) {
    const pair = row(valuePair);
    if (!pair || !exact(pair, [
      'left_candidate_source_id', 'right_candidate_source_id', 'relation', 'narrative',
      'concept_ids', 'evidence',
    ]) || !id(pair.left_candidate_source_id, 'candidate-source-')
      || !id(pair.right_candidate_source_id, 'candidate-source-')
      || pair.left_candidate_source_id === pair.right_candidate_source_id
      || !relations.includes(pair.relation as ComparisonRelationV1) || !text(pair.narrative)
      || !stringList(pair.concept_ids,
        (item): item is string => id(item, 'concept-'), true)
      || pair.concept_ids.length === 0
      || pair.concept_ids.some((conceptId) => !knownConceptIds.has(conceptId))) return null;
    const left = assessedById.get(pair.left_candidate_source_id);
    const right = assessedById.get(pair.right_candidate_source_id);
    if (left?.review_status !== 'deep-reviewed' || right?.review_status !== 'deep-reviewed') {
      return null;
    }
    const pairKey = [
      ...[pair.left_candidate_source_id, pair.right_candidate_source_id].sort(),
      pair.relation,
    ].join('\u0000');
    if (seenComparisons.has(pairKey)) return null;
    seenComparisons.add(pairKey);
    const evidenceSides = row(pair.evidence);
    if (!evidenceSides || !exact(evidenceSides, ['left', 'right'])
      || !Array.isArray(evidenceSides.left) || evidenceSides.left.length === 0
      || !Array.isArray(evidenceSides.right) || evidenceSides.right.length === 0) return null;
    const leftEvidence = evidenceSides.left.map(evidence);
    const rightEvidence = evidenceSides.right.map(evidence);
    if (leftEvidence.some((item) => item === null)
      || rightEvidence.some((item) => item === null)) return null;
    comparisons.push({
      left_candidate_source_id: pair.left_candidate_source_id,
      right_candidate_source_id: pair.right_candidate_source_id,
      relation: pair.relation as ComparisonRelationV1,
      narrative: pair.narrative,
      concept_ids: pair.concept_ids,
      evidence: {
        left: leftEvidence as CandidateComparisonEvidenceV1[],
        right: rightEvidence as CandidateComparisonEvidenceV1[],
      },
    });
  }
  return {
    schema_version: 1,
    id: source.id,
    type: 'candidate-source-comparison',
    candidate_module_id: source.candidate_module_id,
    status: 'approved',
    basis: {
      catalog_revision: basis.catalog_revision as number,
      candidate_set_checksum: basis.candidate_set_checksum as string,
      policy: 'tiered-v1',
      request_id: basis.request_id as string,
      delivery_id: basis.delivery_id as string,
    },
    source_assessments: assessments as CandidateSourceAssessmentV1[],
    comparisons,
  };
}

/** Strict decoder for system/schema/masters-planning-dashboard.schema.json. */
export function asMastersPlanningDashboard(
  value: unknown,
  knownConceptIds: ReadonlySet<string> = new Set(),
): MastersPlanningDashboardV1 | null {
  const dashboard = row(value);
  if (!dashboard || !exact(dashboard, [
    'schema_version', 'type', 'opened_at', 'banner', 'catalog', 'comparisons', 'isolation',
  ]) || dashboard.schema_version !== 1 || dashboard.type !== 'masters-planning-dashboard'
    || !dateTime(dashboard.opened_at) || dashboard.banner !== 'Prospective—not current LearningOS'
    || !Array.isArray(dashboard.comparisons)) return null;
  const parsedCatalog = dashboard.catalog === null ? null : catalog(dashboard.catalog);
  if (dashboard.catalog !== null && parsedCatalog === null) return null;
  if (!parsedCatalog && dashboard.comparisons.length > 0) return null;
  const comparisons = parsedCatalog
    ? dashboard.comparisons.map((item) => comparison(item, parsedCatalog, knownConceptIds))
    : [];
  if (comparisons.some((item) => item === null)) return null;
  const isolation = row(dashboard.isolation);
  const isolationKeys = [
    'normal_manifest', 'search', 'workload', 'recommendations', 'deadlines', 'ordinary_ai_context',
  ] as const;
  if (!isolation || !exact(isolation, isolationKeys)
    || isolationKeys.some((key) => isolation[key] !== false)) return null;
  return {
    schema_version: 1,
    type: 'masters-planning-dashboard',
    opened_at: dashboard.opened_at,
    banner: 'Prospective—not current LearningOS',
    catalog: parsedCatalog,
    comparisons: comparisons as CandidateSourceComparisonV1[],
    isolation: {
      normal_manifest: false,
      search: false,
      workload: false,
      recommendations: false,
      deadlines: false,
      ordinary_ai_context: false,
    },
  };
}
