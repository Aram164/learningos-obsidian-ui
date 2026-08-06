/**
 * Typed foothold for the versioned UI read contract.
 *
 * Legacy views still consume the manifest through ManifestStore. New router and
 * feature code must depend on this contract layer instead of raw JSON shapes.
 */
export const MANIFEST_CONTRACT_VERSION = 2 as const;

export type JsonRecord = Record<string, unknown>;

/** Dynamic UI projection until each manifest family has a dedicated interface. */
export type ProjectionRecord = Record<string, any>;

export interface UnitNoteAttachmentV2 { path: string; label: string; }
export interface UnitNoteSectionV2 {
  recorded_at: string | null;
  title: string;
  stage_ids: readonly string[];
  attachments: readonly UnitNoteAttachmentV2[];
  text: string;
  summary: string;
}
export interface ThematicGroupV2 extends JsonRecord {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface TopicPackV2 extends JsonRecord {
  id: string;
  type: "topic-pack";
  title: string;
  purpose: string;
  thematic_group_ids: readonly string[];
  entries: readonly JsonRecord[];
}


export interface ProjectRelationshipV2 extends JsonRecord {
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
export interface ProjectV2 extends JsonRecord {
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

export interface UnitV2 extends JsonRecord {
  id: string;
  type: "unit";
  project_ids?: readonly string[];
  module_id: string;
  title: string;
  notes_text: string;
  note_sections: readonly UnitNoteSectionV2[];
  notes_updated: string | null;
  working_note?: string;
}

export interface GeneratedMetadataV2 extends JsonRecord {
  contract_version: typeof MANIFEST_CONTRACT_VERSION;
  generated_at: string;
  generator: string;
  snapshot_id: string;
  source_dirty: boolean;
  source_fingerprint: string;
  source_revision: string;
  warning: string;
}

export interface ManifestV2 extends JsonRecord {
  _generated: GeneratedMetadataV2;
  academic_deadlines: readonly ProjectionRecord[];
  ai_actions: ProjectionRecord;
  backlinks: ProjectionRecord;
  counts: ProjectionRecord;
  garden_entries: readonly ProjectionRecord[];
  indexes: ProjectionRecord;
  module_source_maps: readonly ProjectionRecord[];
  modules: readonly ProjectionRecord[];
  programs: readonly ProjectionRecord[];
  progress: ProjectionRecord;
  artifact_revisions: ProjectionRecord;
  project_aliases: ProjectionRecord;
  project_relationships: readonly ProjectRelationshipV2[];
  projects: readonly ProjectV2[];
  quarantine_boundaries: readonly ProjectionRecord[];
  records: readonly ProjectionRecord[];
  relations: readonly ProjectionRecord[];
  resume_pointer: ProjectionRecord | null;
  semesters: readonly ProjectionRecord[];
  stages: readonly ProjectionRecord[];
  study_maps: readonly ProjectionRecord[];
  thematic_groups: readonly ThematicGroupV2[];
  topic_packs: readonly TopicPackV2[];
  units: readonly UnitV2[];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireArray(record: JsonRecord, key: keyof ManifestV2): void {
  if (!Array.isArray(record[key])) {
    throw new TypeError(`Manifest v2 field ${String(key)} must be an array.`);
  }
}

/** Fail closed before an untyped projection reaches feature code. */
export function assertManifestV2(value: unknown): asserts value is ManifestV2 {
  if (!isRecord(value) || !isRecord(value._generated)) {
    throw new TypeError("Manifest v2 requires an _generated object.");
  }
  if (value._generated.contract_version !== MANIFEST_CONTRACT_VERSION) {
    throw new TypeError(
      `Unsupported manifest contract ${String(value._generated.contract_version)}; expected ${MANIFEST_CONTRACT_VERSION}.`,
    );
  }

  for (const key of [
    "academic_deadlines",
    "garden_entries",
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
    "units",
  ] as const) {
    requireArray(value, key);
  }

  for (const unit of value.units as unknown[]) {
    if (!isRecord(unit) || typeof unit.id !== "string" || typeof unit.notes_text !== "string"
      || !Array.isArray(unit.note_sections)) {
      throw new TypeError("Manifest v2 unit rows require projected unit note fields.");
    }
  }

  for (const key of ["ai_actions", "artifact_revisions", "backlinks", "counts", "indexes", "progress", "project_aliases"] as const) {
    if (!isRecord(value[key])) {
      throw new TypeError(`Manifest v2 field ${key} must be an object.`);
    }
  }
}
