/**
 * Typed foothold for the versioned UI read contract.
 *
 * Legacy views still consume the manifest through ManifestStore. New router and
 * feature code must depend on this contract layer instead of raw JSON shapes.
 *
 * The contract is now DECLARED BY THE PRODUCER, in the core repository's
 * `system/contracts/manifest-contract.yaml`. The single versioned lock under
 * `contracts/` is a mirror of that declaration, not the original — core
 * enforces the shape on every build, so a projection change fails there instead
 * of arriving here as a red CI run. (That is what happened on 2026-08-08: core
 * published a top-level `topics` collection while still announcing v2.)
 *
 * The module and type names are deliberately stable. Contract version is data:
 * a bump changes this constant and the mirrored lock, not every import path.
 */
export const MANIFEST_CONTRACT_VERSION = 15 as const;
import {
  validAcademicDeadline,
  validAiActions,
  validBacklinks,
  validCounts,
  validFlatStage,
  validGardenEntry,
  validModuleRecord,
  validModuleSourceMap,
  validProgress,
  validProgramRecord,
  validProjectRecord,
  validProjectRelationship,
  validProjectedRecord,
  validProjectedUnit,
  validRelation,
  validResumePointer,
  validReviewItem,
  validSemester,
  validStudyMap,
  validThematicGroup,
  validTopic,
  validTopicPack,
} from './manifest-records';
import validateManifest from './generated/manifest.validator.cjs';

export const MANIFEST_SCHEMA_SHA256 = 'sha256:c487c6ed2e05c05425c6b41bd291e566b16a7e1ee3af667ae00763608d7e121f' as const;

interface AjvErrorLike {
  readonly instancePath?: string;
  readonly message?: string;
}

export function formatAjvErrors(errors: readonly AjvErrorLike[] | null | undefined): string {
  if (!Array.isArray(errors) || errors.length === 0) {
    return 'unknown validation error';
  }
  return errors
    .slice(0, 5)
    .map((err) => {
      const path = err.instancePath && err.instancePath.length > 0 ? err.instancePath : '/';
      const msg = err.message && err.message.length > 0 ? err.message : 'is invalid';
      return `${path} ${msg}`;
    })
    .join(', ');
}

export type JsonRecord = Record<string, unknown>;

export type {
  AiActionsProjection,
  GeneratedMetadata,
  Manifest,
  ManifestBacklinks,
  ManifestIndexes,
  MaterialConceptGroup,
  MaterialRouteAssessment,
  MaterialRouteComparison,
  MaterialRouteReviewStatus,
  MaterialSynthesisAnalysisAnchor,
  MaterialSynthesisAnalysisRef,
  MaterialSynthesisBasis,
  MaterialSynthesisCompleteness,
  MaterialSynthesisEvidence,
  MaterialSynthesisFreshness,
  MaterialSynthesisStaleReason,
  ModuleConceptEdge,
  ModuleConceptEvidence,
  ModuleProgress,
  ModuleRecord,
  ProgramRecord,
  Project,
  ProjectRelationship,
  RelationRecord,
  ResumePointer,
  ThematicGroup,
  Topic,
  TopicPack,
  Unit,
  UnitMaterialSynthesisV1,
  UnitNoteAttachment,
  UnitNoteSection,
} from './generated/manifest.types';
import type {
  Manifest,
  MaterialConceptGroup,
  MaterialRouteAssessment,
  MaterialRouteComparison,
  MaterialSynthesisAnalysisAnchor,
  MaterialSynthesisAnalysisRef,
  MaterialSynthesisBasis,
  MaterialSynthesisCompleteness,
  MaterialSynthesisEvidence,
  MaterialSynthesisFreshness,
  MaterialSynthesisStaleReason,
  UnitMaterialSynthesisV1,
} from './generated/manifest.types';

/**
 * Shared fields across projected records. Feature code decodes richer domain
 * shapes at its boundary; unknown extension fields remain available without
 * turning the entire projection into `any`.
 */
export interface ProjectionRecord extends JsonRecord {
  id?: string;
  type?: string;
  title?: string;
  label?: string;
  name?: string;
  status?: string;
  kind?: string;
  role?: string;
  path?: string;
  domain?: string;
  summary?: string;
  description?: string;
  objective?: string;
  scope?: string;
  purpose?: string;
  url?: string;
  material_path?: string;
  vault_path?: string;
  module_id?: string;
  unit_id?: string;
  stage_id?: string;
  study_map_id?: string;
  project_id?: string;
  component_id?: string;
  area_id?: string | null;
  current_stage?: string;
  current_study_map?: string;
  organization?: string;
  semester?: string;
  code?: string;
  project_type?: string;
  state?: string;
  provider?: string;
  bundle_path?: string;
  delivery_id?: string;
  receipt_id?: string;
  transcription_path?: string;
  source_id?: string;
  route_id?: string;
  material_uri?: string;
  material_exists?: boolean;
  revision?: number;
  next_action?: string;
  deadline?: string;
  standing?: boolean;
  available?: boolean;
  aliases?: readonly string[];
  authors?: readonly string[];
  concepts?: readonly string[];
  concept_ids?: readonly string[];
  sources?: readonly string[];
  contexts?: readonly string[];
  notes?: readonly string[];
  tags?: readonly string[];
  program_ids?: readonly string[];
  module_ids?: readonly string[];
  unit_ids?: readonly string[];
  unit_order?: readonly string[];
  related_module_ids?: readonly string[];
  thematic_group_ids?: readonly string[];
  workspace_ids?: readonly string[];
  project_ids?: readonly string[];
  entries?: readonly ProjectionRecord[];
  stages?: readonly ProjectionRecord[];
  resources?: readonly ProjectionRecord[];
  note_sections?: readonly ProjectionRecord[];
  source_selections?: readonly ProjectionRecord[];
  request?: ProjectionRecord;
}































function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: JsonRecord,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
}

const nonEmptyText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const sha256 = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
const natural = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;
const identifier = (value: unknown, prefix: string): value is string =>
  typeof value === "string"
  && new RegExp(`^${prefix}[a-z0-9]+(?:-[a-z0-9]+)*$`).test(value);

function uniqueStringArray(
  value: unknown,
  predicate: (item: unknown) => item is string,
): value is string[] {
  return Array.isArray(value)
    && value.every(predicate)
    && new Set(value).size === value.length;
}

function validSynthesisEvidence(value: unknown): value is MaterialSynthesisEvidence {
  if (!isRecord(value) || !exactKeys(value, ["locator", "checksum"], ["note"])) return false;
  return nonEmptyText(value.locator)
    && sha256(value.checksum)
    && (!("note" in value) || nonEmptyText(value.note));
}

function validAnalysisAnchor(value: unknown): value is MaterialSynthesisAnalysisAnchor {
  if (!isRecord(value) || !exactKeys(value, ["topic", "purpose", "locator"])) return false;
  return nonEmptyText(value.topic)
    && nonEmptyText(value.purpose)
    && nonEmptyText(value.locator);
}

function validAnalysisRef(value: unknown): value is MaterialSynthesisAnalysisRef {
  if (!isRecord(value) || !exactKeys(value,
    ["note_id", "note_revision", "note_digest", "anchor", "material",
     "inspected_range"])) return false;
  const range = value.inspected_range;
  return identifier(value.note_id, "note-")
    && natural(value.note_revision)
    && sha256(value.note_digest)
    && validAnalysisAnchor(value.anchor)
    && nonEmptyText(value.material)
    && isRecord(range) && exactKeys(range, ["start", "end"])
    && natural(range.start) && (range.start as number) >= 1
    && natural(range.end) && (range.end as number) >= 1;
}

function validSynthesisBasis(value: unknown): value is MaterialSynthesisBasis {
  if (!isRecord(value) || !exactKeys(value, [
    "unit_revision",
    "source_map_revision",
    "source_map_checksum",
    "route_set_checksum",
    "material_checksums",
    "policy",
    "ai_provenance",
  ])) return false;
  const checksums = value.material_checksums;
  const provenance = value.ai_provenance;
  return natural(value.unit_revision)
    && natural(value.source_map_revision)
    && sha256(value.source_map_checksum)
    && sha256(value.route_set_checksum)
    && isRecord(checksums)
    && Object.entries(checksums).every(([routeId, checksum]) =>
      identifier(routeId, "route-") && sha256(checksum))
    && value.policy === "tiered-v2"
    && isRecord(provenance)
    && exactKeys(provenance, ["request_id", "delivery_id", "provider"])
    && nonEmptyText(provenance.request_id)
    && nonEmptyText(provenance.delivery_id)
    && ["manual-bundle", "local"].includes(String(provenance.provider));
}

function validRouteAssessment(value: unknown): value is MaterialRouteAssessment {
  if (!isRecord(value) || !exactKeys(value, [
    "route_id", "source_id", "locator", "review_status", "concept_ids",
  ], [
    "contribution", "assumptions", "notation", "exercise_value", "best_for",
    "limitations", "scope_of_absence", "reason", "evidence", "analysis_refs",
  ]) || !identifier(value.route_id, "route-")
    || !identifier(value.source_id, "source-")
    || !nonEmptyText(value.locator)
    || !["deep-reviewed", "screened", "unevaluated", "unavailable"]
      .includes(String(value.review_status))
    || !uniqueStringArray(value.concept_ids, (item): item is string =>
      identifier(item, "concept-"))) return false;

  // `scope_of_absence` rides with the other deep-review fields: a deep review
  // must state the pages it had in front of it, and a screened row must not
  // pretend to. Every negative claim in the prose is bounded by it.
  const detailed = [
    "contribution", "assumptions", "notation", "exercise_value", "best_for", "limitations",
    "scope_of_absence",
  ] as const;
  if ("reason" in value && !nonEmptyText(value.reason)) return false;
  if ("evidence" in value && (!Array.isArray(value.evidence)
    || !value.evidence.every(validSynthesisEvidence))) return false;
  if ("analysis_refs" in value && (!Array.isArray(value.analysis_refs)
    || !value.analysis_refs.every(validAnalysisRef))) return false;
  if (value.review_status === "deep-reviewed") {
    return detailed.every((key) => nonEmptyText(value[key]))
      && Array.isArray(value.evidence)
      && value.evidence.length > 0;
  }
  return nonEmptyText(value.reason)
    && detailed.every((key) => !(key in value));
}

function validRouteComparison(value: unknown): value is MaterialRouteComparison {
  if (!isRecord(value) || !exactKeys(value, [
    "left_route_id", "right_route_id", "relation", "narrative", "concept_ids", "evidence",
  ]) || !identifier(value.left_route_id, "route-")
    || !identifier(value.right_route_id, "route-")
    || !["duplicates", "overlaps", "complements", "extends", "contrasts", "alternate-notation"]
      .includes(String(value.relation))
    || !nonEmptyText(value.narrative)
    || !uniqueStringArray(value.concept_ids, (item): item is string =>
      identifier(item, "concept-"))) return false;
  const evidence = value.evidence;
  return isRecord(evidence)
    && exactKeys(evidence, ["left", "right"])
    && Array.isArray(evidence.left)
    && evidence.left.length > 0
    && evidence.left.every(validSynthesisEvidence)
    && Array.isArray(evidence.right)
    && evidence.right.length > 0
    && evidence.right.every(validSynthesisEvidence);
}

function validConceptGroup(value: unknown): value is MaterialConceptGroup {
  return isRecord(value)
    && exactKeys(value, [
      "concept_id", "local_node_ids", "related_unit_ids", "bridge_note_ids", "narrative",
    ])
    && identifier(value.concept_id, "concept-")
    && uniqueStringArray(value.local_node_ids, (item): item is string =>
      identifier(item, "knowledge-"))
    && uniqueStringArray(value.related_unit_ids, (item): item is string =>
      identifier(item, "unit-"))
    && uniqueStringArray(value.bridge_note_ids, (item): item is string =>
      identifier(item, "note-"))
    && nonEmptyText(value.narrative);
}

const synthesisStaleReasons: readonly MaterialSynthesisStaleReason[] = [
  "source_map_revision",
  "source_map_checksum",
  "route_set_checksum",
  "material_checksums",
  "policy",
  "current-basis-unavailable",
  "analysis-refs-stale",
];

function validSynthesisFreshness(value: unknown): value is MaterialSynthesisFreshness {
  return isRecord(value)
    && exactKeys(value, ["status", "reasons"])
    && ["current", "stale"].includes(String(value.status))
    && uniqueStringArray(value.reasons, (reason): reason is MaterialSynthesisStaleReason =>
      typeof reason === "string"
      && synthesisStaleReasons.includes(reason as MaterialSynthesisStaleReason));
}

function validSynthesisCompleteness(value: unknown): value is MaterialSynthesisCompleteness {
  if (!isRecord(value) || !exactKeys(value, [
    "complete",
    "current_route_count",
    "assessed_route_count",
    "deep_reviewed_count",
    "screened_count",
    "unevaluated_count",
    "unavailable_count",
    "missing_route_ids",
    "orphaned_route_ids",
    "duplicate_route_ids",
  ]) || typeof value.complete !== "boolean") return false;
  for (const key of [
    "current_route_count",
    "assessed_route_count",
    "deep_reviewed_count",
    "screened_count",
    "unevaluated_count",
    "unavailable_count",
  ] as const) {
    if (!natural(value[key])) return false;
  }
  return ["missing_route_ids", "orphaned_route_ids", "duplicate_route_ids"]
    .every((key) => uniqueStringArray(value[key], (routeId): routeId is string =>
      identifier(routeId, "route-")));
}

function validMaterialSynthesis(value: unknown): value is UnitMaterialSynthesisV1 {
  return isRecord(value)
    && exactKeys(value, [
      "schema_version", "id", "type", "unit_id", "status", "basis",
      "route_assessments", "comparisons", "concept_groups", "freshness", "completeness",
    ])
    && value.schema_version === 1
    && identifier(value.id, "material-synthesis-")
    && value.type === "unit-material-synthesis"
    && identifier(value.unit_id, "unit-")
    && value.status === "approved"
    && validSynthesisBasis(value.basis)
    && Array.isArray(value.route_assessments)
    && value.route_assessments.length > 0
    && value.route_assessments.every(validRouteAssessment)
    && Array.isArray(value.comparisons)
    && value.comparisons.every(validRouteComparison)
    && Array.isArray(value.concept_groups)
    && value.concept_groups.every(validConceptGroup)
    && validSynthesisFreshness(value.freshness)
    && validSynthesisCompleteness(value.completeness);
}

function requireArray(record: JsonRecord, key: keyof Manifest): void {
  if (!Array.isArray(record[key])) {
    throw new TypeError(`Manifest field ${String(key)} must be an array.`);
  }
}

/** Fail closed before an untyped projection reaches feature code. */
export function assertManifest(value: unknown): asserts value is Manifest {
  if (!validateManifest(value)) {
    throw new TypeError(
      `Manifest does not match its schema: ${formatAjvErrors(validateManifest.errors)}`,
    );
  }
  if (!isRecord(value) || !isRecord(value._generated)) {
    throw new TypeError("Manifest requires an _generated object.");
  }
  if (!exactKeys(value, [
    "_generated", "academic_deadlines", "ai_actions", "artifact_revisions",
    "backlinks", "counts", "garden_entries", "indexes",
    "module_concept_edges", "module_source_maps",
    "modules", "programs", "progress", "project_aliases", "project_relationships",
    "projects", "records", "relations", "resume_pointer",
    "review_items", "semesters", "stages", "study_maps", "thematic_groups",
    "topic_packs", "topics", "unit_material_syntheses", "units",
  ])) {
    throw new TypeError(`Manifest top-level keys do not match contract v${MANIFEST_CONTRACT_VERSION}.`);
  }
  const generated = value._generated;
  if (!exactKeys(generated, [
    "contract_version", "generated_at", "generator", "schema_sha256",
    "snapshot_id", "source_dirty", "source_fingerprint", "source_revision", "warning",
  ])) {
    throw new TypeError(`Manifest _generated keys do not match contract v${MANIFEST_CONTRACT_VERSION}.`);
  }
  if (generated.contract_version !== MANIFEST_CONTRACT_VERSION) {
    throw new TypeError(
      `Unsupported manifest contract ${String(generated.contract_version)}; expected ${MANIFEST_CONTRACT_VERSION}.`,
    );
  }
  if (generated.schema_sha256 !== MANIFEST_SCHEMA_SHA256) {
    throw new TypeError(
      `Unsupported manifest schema ${String(generated.schema_sha256)}; expected ${MANIFEST_SCHEMA_SHA256}.`,
    );
  }
  if (typeof generated.generated_at !== "string"
    || !nonEmptyText(generated.generator)
    || !sha256(generated.snapshot_id)
    || typeof generated.source_dirty !== "boolean"
    || typeof generated.source_fingerprint !== "string"
    || !/^[a-f0-9]{64}$/.test(generated.source_fingerprint)
    || !(generated.source_revision === null || typeof generated.source_revision === "string")
    || typeof generated.warning !== "string") {
    throw new TypeError(`Manifest _generated metadata does not match contract v${MANIFEST_CONTRACT_VERSION}.`);
  }

  for (const key of [
    "academic_deadlines",
    "garden_entries",
    "review_items",
    "module_source_maps",
    "modules",
    "programs",
    "project_relationships",
    "projects",
    "records",
    "relations",
    "semesters",
    "stages",
    "study_maps",
    "thematic_groups",
    "topic_packs",
    "topics",
    "unit_material_syntheses",
    "units",
  ] as const) {
    requireArray(value, key);
  }

  if (!validAiActions(value.ai_actions)) {
    throw new TypeError(`Manifest ai_actions must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
  }
  if (!(value.academic_deadlines as unknown[]).every(validAcademicDeadline)) {
    throw new TypeError(`Manifest academic deadlines must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
  }
  if (!(value.garden_entries as unknown[]).every(validGardenEntry)) {
    throw new TypeError(`Manifest Garden rows must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
  }
  if (!(value.relations as unknown[]).every(validRelation)) {
    throw new TypeError(`Manifest relations must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
  }
  if (!(value.review_items as unknown[]).every(validReviewItem)) {
    throw new TypeError(`Manifest review rows must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
  }
  if (!(value.semesters as unknown[]).every(validSemester)) {
    throw new TypeError(`Manifest semesters must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
  }
  if (!(value.thematic_groups as unknown[]).every(validThematicGroup)) {
    throw new TypeError(`Manifest thematic groups must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
  }
  if (!(value.topic_packs as unknown[]).every(validTopicPack)) {
    throw new TypeError(`Manifest topic packs must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
  }
  if (!(value.topics as unknown[]).every(validTopic)) {
    throw new TypeError(`Manifest topics must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
  }
  for (const module of value.modules as unknown[]) {
    if (!validModuleRecord(module)) {
      throw new TypeError(`Manifest module rows must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
    }
  }
  for (const program of value.programs as unknown[]) {
    if (!validProgramRecord(program)) {
      throw new TypeError(`Manifest program rows must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
    }
  }
  for (const project of value.projects as unknown[]) {
    if (!validProjectRecord(project)) {
      throw new TypeError(`Manifest project rows must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
    }
  }
  for (const relationship of value.project_relationships as unknown[]) {
    if (!validProjectRelationship(relationship)) {
      throw new TypeError(`Manifest project relationships must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
    }
  }
  for (const sourceMap of value.module_source_maps as unknown[]) {
    if (!validModuleSourceMap(sourceMap)) {
      throw new TypeError(`Manifest module source maps must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
    }
  }
  for (const unit of value.units as unknown[]) {
    if (!validProjectedUnit(unit)) {
      throw new TypeError(`Manifest unit rows must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
    }
  }
  for (const studyMap of value.study_maps as unknown[]) {
    if (!validStudyMap(studyMap)) {
      throw new TypeError(`Manifest study maps must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
    }
  }
  for (const stage of value.stages as unknown[]) {
    if (!validFlatStage(stage)) {
      throw new TypeError(`Manifest flat stages must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
    }
  }
  for (const record of value.records as unknown[]) {
    if (!validProjectedRecord(record, validMaterialSynthesis)) {
      throw new TypeError(`Manifest records must match the closed v${MANIFEST_CONTRACT_VERSION} record union.`);
    }
  }

  for (const key of ["ai_actions", "artifact_revisions", "backlinks", "counts", "indexes", "progress", "project_aliases", "resume_pointer"] as const) {
    if (!isRecord(value[key])) {
      throw new TypeError(`Manifest field ${key} must be an object.`);
    }
  }

  if (!validBacklinks(value.backlinks)) {
    throw new TypeError(`Manifest backlinks must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
  }
  if (!validCounts(value.counts)) {
    throw new TypeError(`Manifest counts must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
  }
  if (!validProgress(value.progress)) {
    throw new TypeError(`Manifest progress must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
  }
  if (!validResumePointer(value.resume_pointer)) {
    throw new TypeError(`Manifest resume pointer must match the closed v${MANIFEST_CONTRACT_VERSION} projection.`);
  }

  const edges = value.module_concept_edges;
  if (!Array.isArray(edges)) {
    throw new TypeError("Manifest field module_concept_edges must be an array.");
  }
  for (const edge of edges as unknown[]) {
    if (!isRecord(edge) || !exactKeys(edge, ["module_id", "concept_id", "evidence"])) {
      throw new TypeError("Manifest module_concept_edges rows must be {module_id, concept_id, evidence}.");
    }
    if (!identifier(edge.module_id, "module-") || !identifier(edge.concept_id, "concept-")) {
      throw new TypeError("Manifest module_concept_edges rows must name a module and a concept.");
    }
    if (!Array.isArray(edge.evidence) || edge.evidence.length === 0) {
      // An edge with no evidence is an inferred edge. Core will not emit one;
      // failing closed here means the UI can never render an unexplained cell.
      throw new TypeError("Manifest module_concept_edges rows must carry at least one evidence item.");
    }
    for (const item of edge.evidence as unknown[]) {
      if (!isRecord(item) || !identifier(item.unit_id, "unit-")) {
        throw new TypeError("Manifest module_concept_edges evidence must name a unit.");
      }
      if (item.kind === "stage-concept") {
        if (!exactKeys(item, ["kind", "unit_id", "study_map_id", "stage_id"])
          || !identifier(item.study_map_id, "study-map-")
          || !identifier(item.stage_id, "stage-")) {
          throw new TypeError("Manifest stage-concept evidence must name its study map and stage.");
        }
      } else if (item.kind === "knowledge-node") {
        if (!exactKeys(item, ["kind", "unit_id", "node_id"])
          || !identifier(item.node_id, "knowledge-")) {
          throw new TypeError("Manifest knowledge-node evidence must name its node.");
        }
      } else {
        throw new TypeError(`Unknown module_concept_edges evidence kind ${String(item.kind)}.`);
      }
    }
  }

  const indexes = value.indexes as JsonRecord;

  if (!exactKeys(indexes, [
    "component_to_units", "concept_to_modules", "concept_to_units",
    "module_to_concepts", "module_to_units", "project_aliases",
    "project_to_relationships", "project_to_units", "project_to_workspaces",
    "source_to_modules", "source_to_units", "unit_to_concepts",
    "unit_to_material_synthesis", "unit_to_study_map", "workspace_to_modules",
    "workspace_to_units",
  ])) {
    throw new TypeError(`Manifest index keys do not match contract v${MANIFEST_CONTRACT_VERSION}.`);
  }

  for (const key of [
    "concept_to_units",
    "source_to_modules",
    "source_to_units",
    "unit_to_concepts",
    "unit_to_material_synthesis",
    "unit_to_study_map",
  ] as const) {
    if (!isRecord(indexes[key])) {
      throw new TypeError(`Manifest index ${key} must be an object.`);
    }
  }

  for (const key of [
    "component_to_units", "concept_to_modules", "concept_to_units",
    "module_to_concepts", "module_to_units",
    "project_to_relationships", "project_to_units", "project_to_workspaces",
    "source_to_modules", "source_to_units", "unit_to_concepts",
    "workspace_to_modules", "workspace_to_units",
  ] as const) {
    const index = indexes[key];
    if (!isRecord(index) || !Object.values(index).every((ids) =>
      uniqueStringArray(ids, (item): item is string => typeof item === "string"))) {
      throw new TypeError(`Manifest index ${key} must map to unique string arrays.`);
    }
  }
  for (const key of ["project_aliases", "unit_to_study_map"] as const) {
    const index = indexes[key];
    if (!isRecord(index) || !Object.values(index).every((idValue) =>
      typeof idValue === "string")) {
      throw new TypeError(`Manifest index ${key} must map to strings.`);
    }
  }
  const synthesisIndex = indexes.unit_to_material_synthesis;
  if (!isRecord(synthesisIndex) || !Object.values(synthesisIndex).every((idValue) =>
    identifier(idValue, "material-synthesis-"))) {
    throw new TypeError("Manifest index unit_to_material_synthesis must map to synthesis IDs.");
  }

  for (const synthesis of value.unit_material_syntheses as unknown[]) {
    if (!validMaterialSynthesis(synthesis)) {
      throw new TypeError("Manifest material syntheses must match UnitMaterialSynthesisV1.");
    }
  }
}
