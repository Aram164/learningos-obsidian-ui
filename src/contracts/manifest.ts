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
export const MANIFEST_CONTRACT_VERSION = 5 as const;

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
  area_id?: string;
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
  material_uri?: string;
  next_action?: string;
  deadline?: string;
  standing?: boolean;
  available?: boolean;
  job_derived?: boolean;
  aliases?: readonly string[];
  authors?: readonly string[];
  concepts?: readonly string[];
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
  request?: ProjectionRecord;
}

export interface ModuleProgress extends JsonRecord {
  stages_complete: number;
  stages_total: number;
  units_total: number;
  units_needing_map: number;
}

export interface ManifestIndexes extends JsonRecord {
  unit_to_study_map: Record<string, string>;
  source_to_modules: Record<string, string[]>;
  source_to_units: Record<string, string[]>;
}

export interface ManifestBacklinks extends JsonRecord {
  module_to_workspaces: Record<string, string[]>;
}

export interface ResumePointer extends JsonRecord {
  unit_id: string;
  study_map_id: string;
  stage_id: string;
  module_id: string;
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
  domain: string | null;
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
  path?: string;
}
export interface Project extends JsonRecord {
  id: string;
  type: "project";
  title: string;
  status: string;
  project_type: string;
  objective: string;
  structure?: JsonRecord;
  linked_module_ids: readonly string[];
  unit_ids: readonly string[];
  workspace_ids: readonly string[];
  files?: readonly JsonRecord[];
  decisions?: readonly JsonRecord[];
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

export interface GeneratedMetadata extends JsonRecord {
  contract_version: typeof MANIFEST_CONTRACT_VERSION;
  generated_at: string;
  generator: string;
  snapshot_id: string;
  source_dirty: boolean;
  source_fingerprint: string;
  source_revision: string;
  warning: string;
}

export interface Manifest extends JsonRecord {
  _generated: GeneratedMetadata;
  academic_deadlines: readonly ProjectionRecord[];
  ai_actions: ProjectionRecord;
  backlinks: ManifestBacklinks;
  counts: ProjectionRecord;
  garden_entries: readonly ProjectionRecord[];
  review_items: readonly ProjectionRecord[];
  indexes: ManifestIndexes;
  module_source_maps: readonly ProjectionRecord[];
  modules: readonly ProjectionRecord[];
  programs: readonly ProjectionRecord[];
  progress: Record<string, ModuleProgress>;
  artifact_revisions: ProjectionRecord;
  project_aliases: Record<string, string>;
  project_relationships: readonly ProjectRelationship[];
  projects: readonly Project[];
  quarantine_boundaries: readonly ProjectionRecord[];
  records: readonly ProjectionRecord[];
  relations: readonly ProjectionRecord[];
  resume_pointer: ResumePointer | null;
  semesters: readonly ProjectionRecord[];
  stages: readonly ProjectionRecord[];
  study_maps: readonly ProjectionRecord[];
  thematic_groups: readonly ThematicGroup[];
  topic_packs: readonly TopicPack[];
  topics: readonly Topic[];
  units: readonly Unit[];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  if (value._generated.contract_version !== MANIFEST_CONTRACT_VERSION) {
    throw new TypeError(
      `Unsupported manifest contract ${String(value._generated.contract_version)}; expected ${MANIFEST_CONTRACT_VERSION}.`,
    );
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
    "quarantine_boundaries",
    "records",
    "relations",
    "semesters",
    "stages",
    "study_maps",
    "thematic_groups",
    "topic_packs",
    "topics",
    "units",
  ] as const) {
    requireArray(value, key);
  }

  for (const unit of value.units as unknown[]) {
    if (!isRecord(unit) || typeof unit.id !== "string" || typeof unit.notes_text !== "string"
      || !Array.isArray(unit.note_sections)) {
      throw new TypeError("Manifest unit rows require projected unit note fields.");
    }
  }

  for (const key of ["ai_actions", "artifact_revisions", "backlinks", "counts", "indexes", "progress", "project_aliases"] as const) {
    if (!isRecord(value[key])) {
      throw new TypeError(`Manifest field ${key} must be an object.`);
    }
  }
}
