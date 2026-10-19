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
import type { Manifest } from './generated/manifest.types';

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

/**
 * The manifest boundary: the generated Ajv validator decides the shape, then
 * the two contextual guards the schema cannot express run (Phase 6, 6.C.2).
 * T-05 binds the document to this build's contract constant; T-06 binds it to
 * the exact schema bytes this build was generated from. ManifestStore.load
 * keeps its contract-version preflight before parsing. Every other former
 * handwritten check was a SHAPE check the schema subsumes (S31 inventory,
 * Section Q); see the batch's subsumption record.
 */
export function assertManifest(value: unknown): asserts value is Manifest {
  if (!validateManifest(value)) {
    throw new TypeError(
      `Manifest does not match its schema: ${formatAjvErrors(validateManifest.errors)}`,
    );
  }
  const generated = (value as Manifest)._generated;
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
}
