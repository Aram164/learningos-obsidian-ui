import { validateMastersPlanningDashboardV1 } from './generated/responses.validator.cjs';
import type { MastersPlanningDashboardV1, MasterPlanningCatalogSchema, CandidateSourceComparisonSchema } from './generated/responses.types';
export type { MastersPlanningDashboardV1 } from './generated/responses.types';
export type MasterPlanningCatalogV1 = MasterPlanningCatalogSchema;
export type CandidateModuleV1 = MasterPlanningCatalogV1['candidate_modules'][number];
export type CandidateSourceV1 = MasterPlanningCatalogV1['candidate_sources'][number];
export type PlanningStateV1 = CandidateModuleV1['planning_state'];
export type FactStateV1 = CandidateModuleV1['fact_state'];
export type FactStatusV1 = FactStateV1['status'];
export type CandidateSourceTypeV1 = NonNullable<CandidateSourceV1['type']>;
export type CandidateSourceComparisonV1 = CandidateSourceComparisonSchema;
export type CandidateSourceAssessmentV1 = CandidateSourceComparisonV1['source_assessments'][number];
export type CandidateComparisonBasisV1 = CandidateSourceComparisonV1['basis'];
export type CandidateSourcePairComparisonV1 = CandidateSourceComparisonV1['comparisons'][number];
export type CandidateComparisonEvidenceV1 = CandidateSourcePairComparisonV1['evidence']['left'][number];
export type RouteReviewStatusV1 = CandidateSourceAssessmentV1['review_status'];
export type CandidateSourceRoleV1 = CandidateSourceAssessmentV1['role'];
export type ComparisonRelationV1 = CandidateSourcePairComparisonV1['relation'];

/** Core owns shape; these checks bind references to this catalog and concept set. */
export function asMastersPlanningDashboard(value: unknown,
  knownConceptIds: ReadonlySet<string> = new Set()): MastersPlanningDashboardV1 | null {
  if (!validateMastersPlanningDashboardV1(value)) return null;
  const catalog = value.catalog;
  if (!catalog) return value.comparisons.length === 0 ? value : null;
  const sourceIds = new Set(catalog.candidate_sources.map((source) => source.id));
  for (const comparison of value.comparisons) {
    const module = catalog.candidate_modules.find((row) => row.id === comparison.candidate_module_id);
    if (!module || !comparison.source_assessments.some((row) => row.role === 'selected')) return null;
    const assessed = new Map<string, CandidateSourceAssessmentV1>();
    for (const row of comparison.source_assessments) {
      if (assessed.has(row.candidate_source_id) || !sourceIds.has(row.candidate_source_id)
        || row.concept_ids.some((id) => !knownConceptIds.has(id))
        || (row.role !== 'comparison' && row.review_status !== 'deep-reviewed')) return null;
      assessed.set(row.candidate_source_id, row);
    }
    const expected = new Set(module.source_ids);
    if (assessed.size !== expected.size || [...assessed.keys()].some((id) => !expected.has(id))) return null;
    const seenPairs = new Set<string>();
    for (const pair of comparison.comparisons) {
      if (pair.left_candidate_source_id === pair.right_candidate_source_id
        || pair.concept_ids.some((id) => !knownConceptIds.has(id))
        || assessed.get(pair.left_candidate_source_id)?.review_status !== 'deep-reviewed'
        || assessed.get(pair.right_candidate_source_id)?.review_status !== 'deep-reviewed') return null;
      const key = [...[pair.left_candidate_source_id, pair.right_candidate_source_id].sort(), pair.relation].join('\u0000');
      if (seenPairs.has(key)) return null;
      seenPairs.add(key);
    }
  }
  return value;
}
