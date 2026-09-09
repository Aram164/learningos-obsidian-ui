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
export const MANIFEST_CONTRACT_VERSION = 9 as const;
import {
  validAcademicDeadline,
  validAiActions,
  validBacklinks,
  validCounts,
  validFlatStage,
  validGardenEntry,
  validIntegerMap,
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
  validStringMap,
  validStudyMap,
  validThematicGroup,
  validTopic,
  validTopicPack,
} from './manifest-records';

export const MANIFEST_SCHEMA_SHA256 = 'sha256:09f1b5d492a32d387cc942fe6c9ae5a17b48e5e3b02f325320c3070667642ddb' as const;

export type JsonRecord = Record<string, unknown>;

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

export interface ModuleProgress extends JsonRecord {
  stages_complete: number;
  stages_total: number;
  units_complete: number;
  units_total: number;
  units_needing_map: number;
}

export interface ManifestIndexes extends JsonRecord {
  unit_to_study_map: Record<string, string>;
  unit_to_material_synthesis: Record<string, string>;
  unit_to_concepts: Record<string, string[]>;
  concept_to_units: Record<string, string[]>;
  module_to_concepts: Record<string, string[]>;
  concept_to_modules: Record<string, string[]>;
  source_to_modules: Record<string, string[]>;
  source_to_units: Record<string, string[]>;
}

export interface ManifestBacklinks extends JsonRecord {
  module_to_workspaces: Record<string, string[]>;
}

export interface ResumePointer extends JsonRecord {
  type: 'resume-pointer';
  unit_id: string;
  study_map_id: string;
  stage_id: string;
  module_id: string;
  updated: string;
}

export interface UnitNoteAttachment { path: string; label: string; }
export interface UnitNoteSection extends JsonRecord {
  recorded_at: string | null;
  title: string;
  stage_ids: readonly string[];
  attachments: readonly UnitNoteAttachment[];
  text: string;
  summary: string;
}
export interface ThematicGroup extends JsonRecord {
  id: string;
  title: string;
  description: string;
  order: number;
}

/**
 * ADR-009 topic facet. `domain` is a display grouping only — it never
 * constrains which sources may carry the topic, so an interface may group by it
 * but must not filter membership with it.
 */
export interface Topic extends JsonRecord {
  id: string;
  title: string;
  domain: string;
}

export interface TopicPack extends JsonRecord {
  id: string;
  type: "topic-pack";
  title: string;
  purpose: string;
  thematic_group_ids: readonly string[];
  entries: readonly JsonRecord[];
}


export interface ProjectRelationship extends JsonRecord {
  id: string;
  type: "project-relationship";
  from_project_id: string;
  to_id: string;
  to_type: string;
  relation_type: string;
  reason: string;
  contribution: string;
  path: string;
}
export interface Project extends JsonRecord {
  schema_version: 1;
  id: string;
  type: "project";
  title: string;
  status: string;
  project_type: string;
  root_uri: string;
  objective: string;
  milestone_ids: readonly string[];
  structure?: JsonRecord;
  linked_module_ids: readonly string[];
  unit_ids: readonly string[];
  workspace_ids: readonly string[];
  thematic_group_ids: readonly string[];
  boundaries: JsonRecord;
  files?: readonly JsonRecord[];
  decisions?: readonly JsonRecord[];
  revision: number;
  path: string;
  relationship_ids: readonly string[];
}

export interface ModuleRecord extends ProjectionRecord {
  id: string;
  type: 'module';
  title: string;
  revision: number;
  path: string;
  kind: 'academic' | 'skill' | 'project' | 'foundation';
  area_id: string | null;
  thematic_group_ids: readonly string[];
  status: string;
  administrative_status: string | null;
  operational_state: 'none' | 'complete' | 'active' | 'paused';
  is_actionable: boolean;
  components: readonly JsonRecord[];
  attempts: readonly JsonRecord[];
  unit_order: readonly string[];
}

export interface ProgramRecord extends ProjectionRecord {
  id: string;
  type: 'program';
  title: string;
  kind: 'academic' | 'skills' | 'projects';
  status: 'active' | 'metadata-only' | 'archived';
  default: boolean;
  semester_bound: boolean;
  revision: number;
  path: string;
}

export interface AiActionsProjection extends JsonRecord {
  available: readonly JsonRecord[];
  contract_version: 1;
  provider_adapters: readonly JsonRecord[];
  requests: readonly JsonRecord[];
}

export interface Unit extends JsonRecord {
  id: string;
  type: "unit";
  project_ids?: readonly string[];
  module_id: string;
  title: string;
  notes_text: string;
  note_sections: readonly UnitNoteSection[];
  notes_updated: string | null;
  working_note?: string;
}

export type MaterialRouteReviewStatus =
  | 'deep-reviewed'
  | 'screened'
  | 'unevaluated'
  | 'unavailable';

export interface MaterialSynthesisEvidence extends JsonRecord {
  locator: string;
  checksum: string;
  note?: string;
}

export interface MaterialRouteAssessment extends JsonRecord {
  route_id: string;
  source_id: string;
  locator: string;
  review_status: MaterialRouteReviewStatus;
  concept_ids: readonly string[];
  contribution?: string;
  assumptions?: string;
  notation?: string;
  exercise_value?: string;
  best_for?: string;
  limitations?: string;
  reason?: string;
  evidence?: readonly MaterialSynthesisEvidence[];
}

export interface MaterialRouteComparison extends JsonRecord {
  left_route_id: string;
  right_route_id: string;
  relation: 'duplicates' | 'overlaps' | 'complements' | 'extends' | 'contrasts' | 'alternate-notation';
  narrative: string;
  concept_ids: readonly string[];
  evidence: {
    left: readonly MaterialSynthesisEvidence[];
    right: readonly MaterialSynthesisEvidence[];
  };
}

export interface MaterialConceptGroup extends JsonRecord {
  concept_id: string;
  local_node_ids: readonly string[];
  related_unit_ids: readonly string[];
  bridge_note_ids: readonly string[];
  narrative: string;
}

export interface MaterialSynthesisBasis extends JsonRecord {
  unit_revision: number;
  source_map_revision: number;
  source_map_checksum: string;
  route_set_checksum: string;
  material_checksums: Readonly<Record<string, string>>;
  policy: 'tiered-v1';
  ai_provenance: {
    request_id: string;
    delivery_id: string;
    provider: 'manual-bundle' | 'local';
  };
}

export interface UnitMaterialSynthesisV1 extends JsonRecord {
  schema_version: 1;
  id: string;
  type: 'unit-material-synthesis';
  unit_id: string;
  status: 'approved';
  basis: MaterialSynthesisBasis;
  route_assessments: readonly MaterialRouteAssessment[];
  comparisons: readonly MaterialRouteComparison[];
  concept_groups: readonly MaterialConceptGroup[];
  freshness: MaterialSynthesisFreshness;
  completeness: MaterialSynthesisCompleteness;
}

export type MaterialSynthesisStaleReason =
  | 'unit_revision'
  | 'source_map_revision'
  | 'source_map_checksum'
  | 'route_set_checksum'
  | 'material_checksums'
  | 'policy'
  | 'current-basis-unavailable';

export interface MaterialSynthesisFreshness extends JsonRecord {
  status: 'current' | 'stale';
  reasons: readonly MaterialSynthesisStaleReason[];
}

export interface MaterialSynthesisCompleteness extends JsonRecord {
  complete: boolean;
  current_route_count: number;
  assessed_route_count: number;
  deep_reviewed_count: number;
  screened_count: number;
  unevaluated_count: number;
  unavailable_count: number;
  missing_route_ids: readonly string[];
  orphaned_route_ids: readonly string[];
  duplicate_route_ids: readonly string[];
}

/**
 * One cell of the Module x Concept crossing, and why it is filled (ADR-015).
 *
 * The evidence is not diagnostics. Core refuses to publish an edge without it,
 * because an unexplained cell is a claim the learner has to take on faith —
 * and this projection makes claims about how to spend weeks of study.
 */
export type ModuleConceptEvidence =
  | {
      readonly kind: 'stage-concept';
      readonly unit_id: string;
      readonly study_map_id: string;
      readonly stage_id: string;
    }
  | {
      readonly kind: 'knowledge-node';
      readonly unit_id: string;
      readonly node_id: string;
    };

/**
 * One authored concept relation (ADR-016).
 *
 * `context` and `source` are nullable by schema, and that is a meaning rather
 * than a gap: an undocumented relation is a valid relation. Nothing may
 * substitute a citation for a row that carries none, and nothing may drop the
 * row for lacking one. `backlinks.concept_relations` publishes the same edges
 * without these two fields, which is why the Atlas reads this collection.
 */
export interface RelationRecord extends JsonRecord {
  from: string;
  type: string;
  to: string;
  context: string | null;
  source: string | null;
}

export interface ModuleConceptEdge extends JsonRecord {
  module_id: string;
  concept_id: string;
  evidence: readonly ModuleConceptEvidence[];
}

export interface GeneratedMetadata extends JsonRecord {
  contract_version: typeof MANIFEST_CONTRACT_VERSION;
  schema_sha256: typeof MANIFEST_SCHEMA_SHA256;
  generated_at: string;
  generator: string;
  snapshot_id: string;
  source_dirty: boolean;
  source_fingerprint: string;
  source_revision: string | null;
  warning: string;
}

export interface Manifest extends JsonRecord {
  _generated: GeneratedMetadata;
  academic_deadlines: readonly ProjectionRecord[];
  ai_actions: AiActionsProjection;
  backlinks: ManifestBacklinks;
  counts: ProjectionRecord;
  garden_entries: readonly ProjectionRecord[];
  review_items: readonly ProjectionRecord[];
  indexes: ManifestIndexes;
  module_concept_edges: readonly ModuleConceptEdge[];
  module_source_maps: readonly ProjectionRecord[];
  modules: readonly ModuleRecord[];
  programs: readonly ProgramRecord[];
  progress: Record<string, ModuleProgress>;
  artifact_revisions: Record<string, number>;
  project_aliases: Record<string, string>;
  project_relationships: readonly ProjectRelationship[];
  projects: readonly Project[];
  records: readonly ProjectionRecord[];
  relations: readonly ProjectionRecord[];
  resume_pointer: ResumePointer | Record<string, never>;
  semesters: readonly ProjectionRecord[];
  stages: readonly ProjectionRecord[];
  study_maps: readonly ProjectionRecord[];
  thematic_groups: readonly ThematicGroup[];
  topic_packs: readonly TopicPack[];
  topics: readonly Topic[];
  unit_material_syntheses: readonly UnitMaterialSynthesisV1[];
  units: readonly Unit[];
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
    && value.policy === "tiered-v1"
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
    "limitations", "reason", "evidence",
  ]) || !identifier(value.route_id, "route-")
    || !identifier(value.source_id, "source-")
    || !nonEmptyText(value.locator)
    || !["deep-reviewed", "screened", "unevaluated", "unavailable"]
      .includes(String(value.review_status))
    || !uniqueStringArray(value.concept_ids, (item): item is string =>
      identifier(item, "concept-"))) return false;

  const detailed = [
    "contribution", "assumptions", "notation", "exercise_value", "best_for", "limitations",
  ] as const;
  if ("reason" in value && !nonEmptyText(value.reason)) return false;
  if ("evidence" in value && (!Array.isArray(value.evidence)
    || !value.evidence.every(validSynthesisEvidence))) return false;
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
  "unit_revision",
  "source_map_revision",
  "source_map_checksum",
  "route_set_checksum",
  "material_checksums",
  "policy",
  "current-basis-unavailable",
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
    throw new TypeError("Manifest ai_actions must match the closed v8 projection.");
  }
  if (!(value.academic_deadlines as unknown[]).every(validAcademicDeadline)) {
    throw new TypeError("Manifest academic deadlines must match the closed v8 projection.");
  }
  if (!(value.garden_entries as unknown[]).every(validGardenEntry)) {
    throw new TypeError("Manifest Garden rows must match the closed v8 projection.");
  }
  if (!(value.relations as unknown[]).every(validRelation)) {
    throw new TypeError("Manifest relations must match the closed v8 projection.");
  }
  if (!(value.review_items as unknown[]).every(validReviewItem)) {
    throw new TypeError("Manifest review rows must match the closed v8 projection.");
  }
  if (!(value.semesters as unknown[]).every(validSemester)) {
    throw new TypeError("Manifest semesters must match the closed v8 projection.");
  }
  if (!(value.thematic_groups as unknown[]).every(validThematicGroup)) {
    throw new TypeError("Manifest thematic groups must match the closed v8 projection.");
  }
  if (!(value.topic_packs as unknown[]).every(validTopicPack)) {
    throw new TypeError("Manifest topic packs must match the closed v8 projection.");
  }
  if (!(value.topics as unknown[]).every(validTopic)) {
    throw new TypeError("Manifest topics must match the closed v8 projection.");
  }
  for (const module of value.modules as unknown[]) {
    if (!validModuleRecord(module)) {
      throw new TypeError("Manifest module rows must match the closed v8 projection.");
    }
  }
  for (const program of value.programs as unknown[]) {
    if (!validProgramRecord(program)) {
      throw new TypeError("Manifest program rows must match the closed v8 projection.");
    }
  }
  for (const project of value.projects as unknown[]) {
    if (!validProjectRecord(project)) {
      throw new TypeError("Manifest project rows must match the closed v8 projection.");
    }
  }
  for (const relationship of value.project_relationships as unknown[]) {
    if (!validProjectRelationship(relationship)) {
      throw new TypeError("Manifest project relationships must match the closed v8 projection.");
    }
  }
  for (const sourceMap of value.module_source_maps as unknown[]) {
    if (!validModuleSourceMap(sourceMap)) {
      throw new TypeError("Manifest module source maps must match the closed v8 projection.");
    }
  }
  for (const unit of value.units as unknown[]) {
    if (!validProjectedUnit(unit)) {
      throw new TypeError("Manifest unit rows must match the closed v8 projection.");
    }
  }
  for (const studyMap of value.study_maps as unknown[]) {
    if (!validStudyMap(studyMap)) {
      throw new TypeError("Manifest study maps must match the closed v8 projection.");
    }
  }
  for (const stage of value.stages as unknown[]) {
    if (!validFlatStage(stage)) {
      throw new TypeError("Manifest flat stages must match the closed v8 projection.");
    }
  }
  for (const record of value.records as unknown[]) {
    if (!validProjectedRecord(record, validMaterialSynthesis)) {
      throw new TypeError("Manifest records must match the closed v8 record union.");
    }
  }

  for (const key of ["ai_actions", "artifact_revisions", "backlinks", "counts", "indexes", "progress", "project_aliases", "resume_pointer"] as const) {
    if (!isRecord(value[key])) {
      throw new TypeError(`Manifest field ${key} must be an object.`);
    }
  }

  if (!validIntegerMap(value.artifact_revisions)) {
    throw new TypeError("Manifest artifact revisions must map to non-negative integers.");
  }
  if (!validBacklinks(value.backlinks)) {
    throw new TypeError("Manifest backlinks must match the closed v8 projection.");
  }
  if (!validCounts(value.counts)) {
    throw new TypeError("Manifest counts must match the closed v8 projection.");
  }
  if (!validProgress(value.progress)) {
    throw new TypeError("Manifest progress must match the closed v8 projection.");
  }
  if (!validStringMap(value.project_aliases)) {
    throw new TypeError("Manifest project aliases must map to strings.");
  }
  if (!validResumePointer(value.resume_pointer)) {
    throw new TypeError("Manifest resume pointer must match the closed v8 projection.");
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

  const indexes = value.indexes;
  if (!isRecord(indexes)) {
    throw new TypeError("Manifest field indexes must be an object.");
  }

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
