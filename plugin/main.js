'use strict';
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  LearningOSUI: () => LearningOSUI,
  default: () => main_default
});
module.exports = __toCommonJS(main_exports);
var import_obsidian22 = require("obsidian");

// src/contracts/manifest-records.ts
var row = (value) => typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
var text = (value) => typeof value === "string";
var nonEmpty = (value) => text(value) && value.trim().length > 0;
var natural = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0;
var integer = (value) => typeof value === "number" && Number.isInteger(value);
var positive = (value) => typeof value === "number" && Number.isInteger(value) && value >= 1;
var finite = (value) => typeof value === "number" && Number.isFinite(value);
var identifier = (value, prefix) => text(value) && new RegExp(`^${prefix}[a-z0-9]+(?:-[a-z0-9]+)*$`).test(value);
var date = (value) => {
  if (!text(value)) return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const parsed = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.getUTCFullYear() === Number(match[1]) && parsed.getUTCMonth() + 1 === Number(match[2]) && parsed.getUTCDate() === Number(match[3]);
};
var dateTime = (value) => text(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
var uri = (value) => text(value) && /^[a-z][a-z0-9+.-]*:[^\s]+$/i.test(value);
function exact(value, required, optional2 = []) {
  const allowed = /* @__PURE__ */ new Set([...required, ...optional2]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) && Object.keys(value).every((key) => allowed.has(key));
}
function values(value, allowed) {
  return text(value) && allowed.includes(value);
}
function list(value, predicate, unique = false) {
  return Array.isArray(value) && value.every(predicate) && (!unique || new Set(value).size === value.length);
}
var strings = (value, unique = false) => list(value, text, unique);
var ids = (value, prefix, unique = true) => list(value, (item) => identifier(item, prefix), unique);
var optional = (source, key, predicate) => !(key in source) || predicate(source[key]);
var nullable = (value, predicate) => value === null || predicate(value);
function validStringMap(value) {
  const source = row(value);
  return Boolean(source && Object.values(source).every(text));
}
function validIntegerMap(value) {
  const source = row(value);
  return Boolean(source && Object.values(source).every(natural));
}
function validStringArrayMap(value) {
  const source = row(value);
  return Boolean(source && Object.values(source).every((items) => strings(items, true)));
}
function validJsonValue(value, seen = /* @__PURE__ */ new Set()) {
  if (value === null || text(value) || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value) ? value.every((item) => validJsonValue(item, seen)) : Object.values(value).every((item) => validJsonValue(item, seen));
  seen.delete(value);
  return valid;
}
function validJsonObject(value) {
  const source = row(value);
  return Boolean(source && Object.values(source).every((item) => validJsonValue(item)));
}
function validDeadlineModule(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["module_id", "title", "action", "termins"]) && identifier(source.module_id, "module-") && nonEmpty(source.title) && nullable(source.action, text) && list(source.termins, (termin) => positive(termin) && Number(termin) <= 3, true));
}
function validAcademicDeadline(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["kind", "label", "start_date", "end_date"], [
    "module_id",
    "modules",
    "notes",
    "registration_state",
    "termin",
    "time",
    "title"
  ]) && nonEmpty(source.kind) && nonEmpty(source.label) && date(source.start_date) && date(source.end_date) && optional(source, "module_id", text) && optional(source, "modules", (items) => list(items, validDeadlineModule)) && optional(source, "notes", (item) => nullable(item, text)) && optional(source, "registration_state", text) && optional(source, "termin", positive) && optional(source, "time", (item) => nullable(item, text)) && optional(source, "title", text));
}
function validBacklinks(value) {
  const source = row(value);
  if (!source || !exact(source, [], [
    "concept_relations",
    "concept_to_notes",
    "module_to_units",
    "module_to_workspaces",
    "note_incoming",
    "source_to_notes",
    "source_to_units",
    "unit_to_workspaces",
    "workspace_to_notes"
  ])) return false;
  return optional(source, "concept_relations", validJsonObject) && [
    "concept_to_notes",
    "module_to_units",
    "module_to_workspaces",
    "note_incoming",
    "source_to_notes",
    "source_to_units",
    "unit_to_workspaces",
    "workspace_to_notes"
  ].every((key) => optional(source, key, validStringArrayMap));
}
var COUNT_KEYS = [
  "ai_action_requests",
  "collections",
  "concepts",
  "garden_entries",
  "inbox_items",
  "learning_paths",
  "learning_paths_active",
  "modules",
  "notes",
  "notes_reviewed",
  "notes_with_evidence",
  "programs",
  "projects",
  "relations",
  "source_feedback_records",
  "sources",
  "sources_with_topics",
  "stages",
  "stages_complete",
  "study_maps",
  "thematic_groups",
  "topic_packs",
  "topics",
  "units",
  "units_needing_map",
  "workspaces_active",
  "workspaces_archived"
];
function validCounts(value) {
  const source = row(value);
  return Boolean(source && exact(source, COUNT_KEYS) && COUNT_KEYS.every((key) => natural(source[key])));
}
function validGardenEntry(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "id",
    "last_ai_request_id",
    "path",
    "revision",
    "state",
    "tags",
    "title",
    "transcription_path",
    "type"
  ]) && text(source.id) && nullable(source.last_ai_request_id, text) && text(source.path) && text(source.revision) && text(source.state) && strings(source.tags) && text(source.title) && nullable(source.transcription_path, text) && source.type === "garden-note");
}
function validProgress(value) {
  const source = row(value);
  const keys = [
    "stages_complete",
    "stages_total",
    "units_complete",
    "units_needing_map",
    "units_total"
  ];
  return Boolean(source && Object.values(source).every((item) => {
    const progress = row(item);
    return Boolean(progress && exact(progress, keys) && keys.every((key) => natural(progress[key])));
  }));
}
function validRelation(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["from", "type", "to", "context", "source"]) && ["from", "type", "to", "context", "source"].every((key) => nullable(source[key], text)));
}
function validResumePointer(value) {
  const source = row(value);
  if (!source) return false;
  if (exact(source, [])) return true;
  return exact(source, [
    "type",
    "module_id",
    "unit_id",
    "study_map_id",
    "stage_id",
    "updated"
  ]) && source.type === "resume-pointer" && ["module_id", "unit_id", "study_map_id", "stage_id", "updated"].every((key) => text(source[key]));
}
function validReviewItem(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "category",
    "context",
    "id",
    "reason",
    "target",
    "title"
  ]) && text(source.category) && text(source.context) && text(source.id) && text(source.reason) && validJsonObject(source.target) && text(source.title));
}
function validSemester(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["id", "order", "program_id", "status", "title"]) && text(source.id) && integer(source.order) && text(source.program_id) && text(source.status) && text(source.title));
}
function validThematicGroup(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["id", "title", "description", "order"]) && text(source.id) && text(source.title) && text(source.description) && integer(source.order));
}
function validTopic(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["id", "title", "domain"]) && text(source.id) && text(source.title) && text(source.domain));
}
function validModuleComponent(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["id", "title", "order"], ["short_title"]) && identifier(source.id, "component-") && nonEmpty(source.title) && natural(source.order) && optional(source, "short_title", text));
}
function validExaminationSitting(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["termin", "date"], [
    "end_date",
    "time",
    "label",
    "notes"
  ]) && positive(source.termin) && source.termin <= 3 && date(source.date) && optional(source, "end_date", date) && optional(source, "time", nonEmpty) && optional(source, "label", nonEmpty) && optional(source, "notes", text));
}
function validRegistrationWindow(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["opens", "closes", "label"], ["action", "termins"]) && date(source.opens) && date(source.closes) && nonEmpty(source.label) && optional(source, "action", nonEmpty) && optional(source, "termins", (termins) => list(
    termins,
    (termin) => positive(termin) && Number(termin) <= 3,
    true
  )));
}
function validExamination(value) {
  const source = row(value);
  return Boolean(source && exact(source, [], ["type", "notes", "sittings", "registration_windows"]) && optional(source, "type", (item) => values(item, [
    "klausur",
    "muendlich",
    "portfolio",
    "project",
    "hausarbeit",
    "other"
  ])) && optional(source, "notes", text) && optional(source, "sittings", (items) => list(items, validExaminationSitting)) && optional(source, "registration_windows", (items) => list(items, validRegistrationWindow)));
}
function validAttempt(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["termin", "result"], ["date", "grade", "notes"]) && positive(source.termin) && source.termin <= 3 && values(source.result, ["registered", "withdrawn", "passed", "failed"]) && optional(source, "date", date) && optional(source, "grade", (grade) => finite(grade) && grade >= 1 && grade <= 5) && optional(source, "notes", text));
}
function validModuleRecord(value) {
  const source = row(value);
  if (!source || !exact(source, [
    "id",
    "type",
    "title",
    "revision",
    "path",
    "kind",
    "area_id",
    "thematic_group_ids",
    "status",
    "administrative_status",
    "operational_state",
    "is_actionable",
    "institution",
    "code",
    "credits",
    "semester",
    "components",
    "examination",
    "attempts",
    "grade",
    "unit_order",
    "source_map"
  ])) return false;
  return identifier(source.id, "module-") && source.type === "module" && nonEmpty(source.title) && natural(source.revision) && nonEmpty(source.path) && values(source.kind, ["academic", "skill", "project", "foundation"]) && nullable(source.area_id, (item) => identifier(item, "program-")) && ids(source.thematic_group_ids, "thematic-group-") && values(source.status, [
    "planned",
    "enrolled",
    "active",
    "paused",
    "awaiting-grade",
    "completed",
    "dropped",
    "archived"
  ]) && (source.administrative_status === null || values(source.administrative_status, [
    "planned",
    "enrolled",
    "awaiting-grade",
    "completed",
    "dropped",
    "archived"
  ])) && values(source.operational_state, ["none", "complete", "active", "paused"]) && typeof source.is_actionable === "boolean" && nullable(source.institution, text) && nullable(source.code, text) && nullable(source.credits, (item) => finite(item) && item >= 0) && nullable(source.semester, (item) => text(item) && /^(sose|wise)-\d{4}$/.test(item)) && list(source.components, validModuleComponent) && nullable(source.examination, validExamination) && list(source.attempts, validAttempt) && nullable(source.grade, (item) => finite(item) && item >= 1 && item <= 5) && ids(source.unit_order, "unit-") && (source.source_map === null || source.source_map === "source-map.yaml");
}
function validProgramSemester(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["id", "title", "status", "order"]) && identifier(source.id, "semester-") && nonEmpty(source.title) && values(source.status, ["current", "previous", "future", "archived"]) && natural(source.order));
}
function validProgramRecord(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "id",
    "type",
    "title",
    "kind",
    "status",
    "default",
    "semester_bound",
    "revision",
    "path"
  ], ["description", "boundary_action", "semesters"]) && identifier(source.id, "program-") && source.type === "program" && nonEmpty(source.title) && values(source.kind, ["academic", "skills", "projects"]) && values(source.status, ["active", "metadata-only", "archived"]) && typeof source.default === "boolean" && typeof source.semester_bound === "boolean" && natural(source.revision) && nonEmpty(source.path) && optional(source, "description", text) && optional(source, "boundary_action", text) && optional(source, "semesters", (items) => list(items, validProgramSemester)));
}
function validProjectBoundaries(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["confidentiality", "external_code_access"], ["notes"]) && values(source.confidentiality, ["public", "private", "confidential"]) && values(source.external_code_access, ["none", "read-only", "approved"]) && optional(source, "notes", text));
}
function validStructureNode(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["id", "title", "kind"], ["status", "summary", "children"]) && text(source.id) && /^(workstream|step-map|step|milestone)-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.id) && nonEmpty(source.title) && values(source.kind, ["workstream", "step-map", "step", "milestone"]) && optional(source, "status", (item) => values(item, [
    "planned",
    "active",
    "blocked",
    "complete",
    "completed",
    "deferred"
  ])) && optional(source, "summary", text) && optional(source, "children", (items) => list(items, validStructureNode)));
}
function validProjectStructure(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["kind", "nodes"]) && values(source.kind, ["none", "linear", "parallel", "nested"]) && list(source.nodes, validStructureNode));
}
function validProjectFile(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["label", "path"], ["kind"]) && nonEmpty(source.label) && nonEmpty(source.path) && optional(source, "kind", (item) => values(item, [
    "input",
    "output",
    "working",
    "external"
  ])));
}
function validProjectDecision(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["id", "title", "status", "summary"], ["decided_at"]) && identifier(source.id, "decision-") && nonEmpty(source.title) && values(source.status, ["open", "decided", "revisit"]) && nonEmpty(source.summary) && optional(source, "decided_at", date));
}
function validProjectRecord(value) {
  const source = row(value);
  if (!source || !exact(source, [
    "schema_version",
    "id",
    "type",
    "title",
    "project_type",
    "status",
    "root_uri",
    "objective",
    "milestone_ids",
    "linked_module_ids",
    "unit_ids",
    "workspace_ids",
    "thematic_group_ids",
    "boundaries",
    "revision",
    "path",
    "relationship_ids"
  ], [
    "structure",
    "files",
    "decisions",
    "migrated_from",
    "migrated_at",
    "migration",
    "source_sha256"
  ])) return false;
  return source.schema_version === 1 && identifier(source.id, "project-") && source.type === "project" && nonEmpty(source.title) && values(source.project_type, ["thesis", "research", "software", "writing", "other"]) && values(source.status, ["planned", "active", "paused", "completed", "archived"]) && text(source.root_uri) && /^(project|github):\/\/[^\s]+$/.test(source.root_uri) && nonEmpty(source.objective) && ids(source.milestone_ids, "milestone-") && ids(source.linked_module_ids, "module-") && ids(source.unit_ids, "unit-") && ids(source.workspace_ids, "workspace-") && ids(source.thematic_group_ids, "thematic-group-") && validProjectBoundaries(source.boundaries) && natural(source.revision) && nonEmpty(source.path) && ids(source.relationship_ids, "relationship-") && optional(source, "structure", validProjectStructure) && optional(source, "files", (items) => list(items, validProjectFile)) && optional(source, "decisions", (items) => list(items, validProjectDecision)) && optional(source, "migrated_from", text) && optional(source, "migrated_at", dateTime) && optional(source, "migration", text) && optional(source, "source_sha256", (item) => text(item) && /^[a-f0-9]{64}$/.test(item));
}
function validProjectRelationship(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "id",
    "type",
    "from_project_id",
    "to_id",
    "to_type",
    "relation_type",
    "reason",
    "contribution",
    "path"
  ]) && identifier(source.id, "relationship-") && source.type === "project-relationship" && identifier(source.from_project_id, "project-") && nonEmpty(source.to_id) && values(source.to_type, ["module", "source", "topic-pack", "note", "file"]) && values(source.relation_type, ["uses", "informs", "depends-on", "produces", "related"]) && nonEmpty(source.reason) && nonEmpty(source.contribution) && nonEmpty(source.path));
}
function validCompatibilityAlias(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["id", "type", "target_id", "target_type", "path"]) && nonEmpty(source.id) && source.type === "compatibility-alias" && identifier(source.target_id, "project-") && source.target_type === "project" && source.path === "projects/aliases.yaml");
}
function validNoteEvidence(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["type", "ref"]) && values(source.type, [
    "derivation",
    "explanation",
    "implementation",
    "exercise",
    "exam",
    "external"
  ]) && nonEmpty(source.ref));
}
function validNoteRecord(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "id",
    "type",
    "title",
    "path",
    "domain",
    "summary",
    "role",
    "state",
    "authorship",
    "concepts",
    "sources",
    "contexts",
    "attachments",
    "evidence",
    "supersedes",
    "reviewed",
    "transcription",
    "semantic_review"
  ]) && identifier(source.id, "note-") && source.type === "note" && nonEmpty(source.title) && nonEmpty(source.path) && text(source.domain) && text(source.summary) && values(source.role, [
    "synthesis",
    "reference",
    "derivation",
    "exercise-bank",
    "mock-exam",
    "implementation",
    "question",
    "crosswalk"
  ]) && nullable(source.state, (item) => values(item, [
    "rough",
    "evolving",
    "mature",
    "deprecated"
  ])) && nullable(source.authorship, (item) => values(item, [
    "user",
    "mixed",
    "external",
    "operator-drafted"
  ])) && ids(source.concepts, "concept-") && ids(source.sources, "source-") && ids(source.contexts, "workspace-") && strings(source.attachments) && list(source.evidence, validNoteEvidence) && ids(source.supersedes, "note-") && nullable(source.reviewed, date) && nullable(source.transcription, (item) => values(item, [
    "none",
    "manual",
    "ai-assisted"
  ])) && nullable(source.semantic_review, (item) => values(item, [
    "unreviewed",
    "user-reviewed"
  ])));
}
function validConceptRecord(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["id", "type", "title", "path", "aliases", "deprecated"]) && identifier(source.id, "concept-") && source.type === "concept" && nonEmpty(source.title) && nonEmpty(source.path) && strings(source.aliases, true) && typeof source.deprecated === "boolean");
}
function validUsefulSection(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["section", "note"]) && text(source.section) && text(source.note));
}
function validSourceEvaluation(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "roles",
    "level",
    "audience",
    "prerequisites",
    "strengths",
    "weaknesses",
    "reviewed",
    "concepts",
    "useful_sections"
  ]) && strings(source.roles) && nullable(source.level, (item) => values(item, [
    "introductory",
    "intermediate",
    "advanced",
    "reference"
  ])) && strings(source.audience) && strings(source.prerequisites) && strings(source.strengths) && strings(source.weaknesses) && nullable(source.reviewed, date) && ids(source.concepts, "concept-") && list(source.useful_sections, validUsefulSection));
}
function validSourceRecord(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "id",
    "type",
    "title",
    "revision",
    "path",
    "source_type",
    "thematic_group_ids",
    "topics",
    "url",
    "material",
    "material_path",
    "material_exists",
    "authors",
    "organization",
    "year",
    "identifiers",
    "roles",
    "evaluations"
  ]) && identifier(source.id, "source-") && source.type === "source" && nonEmpty(source.title) && natural(source.revision) && nonEmpty(source.path) && values(source.source_type, [
    "book",
    "paper",
    "lecture",
    "course",
    "video",
    "website",
    "documentation",
    "software",
    "conversation",
    "other"
  ]) && ids(source.thematic_group_ids, "thematic-group-") && ids(source.topics, "topic-") && nullable(source.url, uri) && nullable(source.material, (item) => text(item) && /^material:\/\/.+/.test(item)) && nullable(source.material_path, text) && typeof source.material_exists === "boolean" && strings(source.authors) && nullable(source.organization, text) && nullable(source.year, (item) => natural(item) && item >= 1800 && item <= 2100) && validStringMap(source.identifiers) && strings(source.roles, true) && list(source.evaluations, validSourceEvaluation));
}
function validCollectionEntry(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["source", "group", "why"]) && identifier(source.source, "source-") && nullable(source.group, text) && nullable(source.why, text));
}
function validCollectionRecord(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "id",
    "type",
    "revision",
    "collection_kind",
    "title",
    "path",
    "thematic_group_ids",
    "purpose",
    "sources",
    "summary",
    "domain",
    "entries"
  ]) && nonEmpty(source.id) && values(source.type, ["collection", "topic-pack"]) && natural(source.revision) && values(source.collection_kind, ["catalogue", "topic-pack"]) && nonEmpty(source.title) && text(source.path) && /^sources\/collections\/.+\.yaml$/.test(source.path) && ids(source.thematic_group_ids, "thematic-group-") && nullable(source.purpose, text) && ids(source.sources, "source-", false) && text(source.summary) && nonEmpty(source.domain) && list(source.entries, validCollectionEntry));
}
var validTopicPack = validCollectionRecord;
function validWorkspaceRecord(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "id",
    "type",
    "title",
    "revision",
    "path",
    "status",
    "standing",
    "archived",
    "deadline",
    "objective",
    "next_action",
    "concepts",
    "notes",
    "sources",
    "program_ids",
    "module_ids",
    "unit_ids",
    "project_id"
  ]) && identifier(source.id, "workspace-") && source.type === "workspace" && nonEmpty(source.title) && natural(source.revision) && nonEmpty(source.path) && values(source.status, ["active", "blocked", "complete"]) && typeof source.standing === "boolean" && typeof source.archived === "boolean" && nullable(source.deadline, date) && text(source.objective) && text(source.next_action) && ids(source.concepts, "concept-") && ids(source.notes, "note-") && ids(source.sources, "source-") && ids(source.program_ids, "program-") && ids(source.module_ids, "module-") && ids(source.unit_ids, "unit-") && nullable(source.project_id, (item) => identifier(item, "project-")));
}
function validStageAttachment(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["path", "label"]) && nonEmpty(source.path) && nonEmpty(source.label));
}
function validResource(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["kind", "label"], [
    "id",
    "route_id",
    "source_id",
    "locator",
    "angle",
    "angle_detail",
    "url",
    "vault_path",
    "scope_triage",
    "material_uri",
    "material_path",
    "material_exists"
  ]) && text(source.kind) && text(source.label) && optional(source, "id", text) && optional(source, "route_id", (item) => identifier(item, "route-")) && optional(source, "source_id", text) && optional(source, "locator", text) && optional(source, "angle", text) && optional(source, "angle_detail", text) && optional(source, "url", uri) && optional(source, "vault_path", text) && optional(source, "scope_triage", text) && optional(source, "material_uri", text) && optional(source, "material_path", text) && optional(source, "material_exists", (item) => typeof item === "boolean"));
}
function validSourceFeedback(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["source_id", "feedback", "recorded"], [
    "resource_id",
    "note"
  ]) && identifier(source.source_id, "source-") && optional(source, "resource_id", (item) => identifier(item, "resource-")) && values(source.feedback, [
    "helpful",
    "too-advanced",
    "wrong-perspective",
    "useful-for-derivation",
    "useful-for-review",
    "skipped"
  ]) && optional(source, "note", text) && date(source.recorded));
}
function validStudyMapStage(value, flat) {
  const source = row(value);
  const required = [
    "id",
    "title",
    "status",
    "objective",
    "done_when",
    "resources",
    "working_note",
    "attachments",
    "source_feedback",
    "scope_triage",
    "notes_text",
    "notes_updated",
    ...flat ? ["study_map_id", "unit_id", "module_id"] : []
  ];
  if (!source || !exact(source, required, [
    "number",
    "estimate_minutes",
    "exam_critical",
    "concepts",
    "detour_id",
    "completed",
    ...flat ? [] : ["study_map_id", "unit_id", "module_id"]
  ])) return false;
  return text(source.id) && text(source.title) && text(source.status) && text(source.objective) && strings(source.done_when) && list(source.resources, validResource) && text(source.working_note) && list(source.attachments, validStageAttachment) && list(source.source_feedback, validSourceFeedback) && text(source.scope_triage) && text(source.notes_text) && nullable(source.notes_updated, text) && optional(source, "number", positive) && optional(source, "estimate_minutes", positive) && optional(source, "exam_critical", (item) => typeof item === "boolean") && optional(source, "concepts", strings) && optional(source, "detour_id", text) && optional(source, "completed", text) && optional(source, "study_map_id", text) && optional(source, "unit_id", text) && optional(source, "module_id", text);
}
var validFlatStage = (value) => validStudyMapStage(value, true);
function validStudyMapSourcePlan(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["path", "provenance"]) && nonEmpty(source.path) && values(source.provenance, [
    "migrated-mini-plan",
    "learner",
    "ai-proposed",
    "operator",
    "durable-note"
  ]));
}
function validDetour(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "id",
    "title",
    "spawned_by_stage",
    "classification",
    "status",
    "return_to_stage"
  ], ["resolution"]) && identifier(source.id, "detour-") && nonEmpty(source.title) && identifier(source.spawned_by_stage, "stage-") && values(source.classification, [
    "required-now",
    "helpful-now",
    "deferred",
    "reference-only"
  ]) && values(source.status, ["open", "resolved", "deferred"]) && identifier(source.return_to_stage, "stage-") && optional(source, "resolution", text));
}
function validShelvingItem(value, archiveKind) {
  const source = row(value);
  const studyMap = archiveKind === "archive-map";
  return Boolean(source && exact(source, ["id", "kind", "title", "destination", "rationale"], [
    "diff",
    ...studyMap ? ["content", "metadata"] : [],
    "selected"
  ]) && identifier(source.id, "proposal-") && values(source.kind, [
    "durable-note",
    "garden",
    "concept-relation",
    archiveKind
  ]) && nonEmpty(source.title) && nonEmpty(source.destination) && nonEmpty(source.rationale) && optional(source, "diff", text) && (!studyMap || optional(source, "content", text)) && (!studyMap || optional(source, "metadata", (item) => row(item) !== null)) && optional(source, "selected", (item) => typeof item === "boolean"));
}
function validShelving(value, studyMap) {
  const source = row(value);
  return Boolean(source && exact(source, studyMap ? ["state"] : [], [
    "state",
    "proposal_path",
    "summary",
    "items"
  ]) && optional(source, "state", (item) => values(item, studyMap ? ["none", "draft", "proposed", "approved", "applied"] : ["none", "draft", "proposed", "approved"])) && optional(source, "proposal_path", (item) => text(item) && (studyMap || /^work\/active\/.+\.md$/.test(item))) && optional(source, "summary", text) && optional(source, "items", (items) => list(
    items,
    (item) => validShelvingItem(item, studyMap ? "archive-map" : "archive-path")
  )));
}
function validStudyMap(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "id",
    "type",
    "unit_id",
    "module_id",
    "status",
    "current_stage",
    "source_plan",
    "stages",
    "shelving",
    "revision",
    "path"
  ], ["plan_template_version", "detours"]) && text(source.id) && source.type === "study-map" && text(source.unit_id) && text(source.module_id) && text(source.status) && text(source.current_stage) && validStudyMapSourcePlan(source.source_plan) && list(source.stages, (stage) => validStudyMapStage(stage, false)) && validShelving(source.shelving, true) && natural(source.revision) && text(source.path) && optional(source, "plan_template_version", positive) && optional(source, "detours", (items) => list(items, validDetour)));
}
function validPathStage(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "id",
    "title",
    "status",
    "objective",
    "done_when",
    "resources",
    "notes_text",
    "notes_updated"
  ], [
    "number",
    "estimate_minutes",
    "exam_critical",
    "concepts",
    "notes_path",
    "attachments",
    "completed"
  ]) && identifier(source.id, "stage-") && nonEmpty(source.title) && values(source.status, ["pending", "active", "complete", "skipped"]) && nonEmpty(source.objective) && Array.isArray(source.done_when) && source.done_when.length > 0 && source.done_when.every(nonEmpty) && list(source.resources, validResource) && text(source.notes_text) && nullable(source.notes_updated, text) && optional(source, "number", positive) && optional(source, "estimate_minutes", positive) && optional(source, "exam_critical", (item) => typeof item === "boolean") && optional(source, "concepts", (items) => ids(items, "concept-")) && optional(source, "notes_path", text) && optional(source, "attachments", (items) => list(items, validStageAttachment)) && optional(source, "completed", date));
}
function validLearningPath(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "id",
    "type",
    "revision",
    "title",
    "path",
    "workspace_id",
    "area",
    "module_id",
    "status",
    "current_stage",
    "created",
    "updated",
    "objective",
    "source_plan",
    "stages",
    "shelving",
    "archived"
  ]) && identifier(source.id, "path-") && source.type === "learning-path" && natural(source.revision) && nonEmpty(source.title) && nonEmpty(source.path) && identifier(source.workspace_id, "workspace-") && values(source.area, ["university", "personal"]) && nullable(source.module_id, (item) => identifier(item, "module-")) && values(source.status, ["active", "paused", "ready-to-shelve", "complete"]) && identifier(source.current_stage, "stage-") && date(source.created) && nullable(source.updated, date) && text(source.objective) && nullable(source.source_plan, text) && Array.isArray(source.stages) && source.stages.length > 0 && source.stages.every(validPathStage) && validShelving(source.shelving, false) && typeof source.archived === "boolean");
}
function validKnowledgeNode(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["id", "title", "summary"], ["builds_on", "concept_ids"]) && identifier(source.id, "knowledge-") && nonEmpty(source.title) && nonEmpty(source.summary) && optional(source, "builds_on", (items) => strings(items, true)) && optional(source, "concept_ids", (items) => ids(items, "concept-")));
}
function validUnitArtifacts(value) {
  const source = row(value);
  return Boolean(source && exact(source, [], [
    "ultimate_reference",
    "exercise_bank",
    "mock_exam",
    "other"
  ]) && optional(source, "ultimate_reference", (item) => identifier(item, "note-")) && optional(source, "exercise_bank", (item) => identifier(item, "note-")) && optional(source, "mock_exam", (item) => identifier(item, "note-")) && optional(source, "other", (items) => ids(items, "note-")));
}
function validUnitNoteSection(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "recorded_at",
    "title",
    "stage_ids",
    "attachments",
    "text",
    "summary"
  ]) && nullable(source.recorded_at, text) && nonEmpty(source.title) && strings(source.stage_ids) && list(source.attachments, validStageAttachment) && text(source.text) && text(source.summary));
}
function validKnowledgeMap(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["summary", "nodes"]) && text(source.summary) && list(source.nodes, validKnowledgeNode));
}
function validScopeSource(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["source_id", "authority"], ["locator"]) && text(source.source_id) && text(source.authority) && optional(source, "locator", text));
}
function validSourceSelection(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["source_id", "locator", "purpose"], ["route_id", "stage_ids"]) && text(source.source_id) && text(source.locator) && text(source.purpose) && optional(source, "route_id", (item) => identifier(item, "route-")) && optional(source, "stage_ids", (items) => strings(items, true)));
}
function validProjectedUnit(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "id",
    "type",
    "module_id",
    "kind",
    "title",
    "order",
    "scope",
    "status",
    "artifacts",
    "workspace_ids",
    "source_selections",
    "scope_sources",
    "revision",
    "path",
    "project_ids",
    "needs_study_map",
    "notes_text",
    "note_sections",
    "notes_updated"
  ], [
    "component_id",
    "knowledge_map",
    "current_study_map",
    "working_note",
    "parent_unit_id",
    "child_unit_ids",
    "related_module_ids"
  ]) && identifier(source.id, "unit-") && source.type === "unit" && identifier(source.module_id, "module-") && optional(source, "component_id", text) && text(source.kind) && text(source.title) && natural(source.order) && text(source.scope) && text(source.status) && natural(source.revision) && text(source.path) && typeof source.needs_study_map === "boolean" && text(source.notes_text) && nullable(source.notes_updated, text) && strings(source.project_ids, true) && validUnitArtifacts(source.artifacts) && strings(source.workspace_ids) && list(source.source_selections, validSourceSelection) && list(source.scope_sources, validScopeSource) && list(source.note_sections, validUnitNoteSection) && optional(source, "knowledge_map", validKnowledgeMap) && optional(source, "current_study_map", text) && optional(source, "working_note", text) && optional(source, "parent_unit_id", text) && optional(source, "child_unit_ids", strings) && optional(source, "related_module_ids", strings));
}
function validProjectedRoute(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "id",
    "unit_id",
    "source_id",
    "title",
    "format",
    "angle",
    "covers",
    "depth",
    "scope"
  ], [
    "angle_detail",
    "locator",
    "url",
    "vault_path",
    "material_uri",
    "material_path",
    "material_exists"
  ]) && identifier(source.id, "route-") && identifier(source.unit_id, "unit-") && identifier(source.source_id, "source-") && nonEmpty(source.title) && nonEmpty(source.format) && nonEmpty(source.angle) && Array.isArray(source.covers) && source.covers.length > 0 && ids(source.covers, "knowledge-") && nonEmpty(source.depth) && nonEmpty(source.scope) && optional(source, "angle_detail", nonEmpty) && optional(source, "locator", text) && optional(source, "url", uri) && optional(source, "vault_path", text) && optional(source, "material_uri", text) && optional(source, "material_path", text) && optional(source, "material_exists", (item) => typeof item === "boolean"));
}
function validSourceMapEntry(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "source_id",
    "role",
    "why",
    "priority",
    "unit_routes"
  ], ["when"]) && identifier(source.source_id, "source-") && nonEmpty(source.role) && nonEmpty(source.why) && natural(source.priority) && optional(source, "when", text) && list(source.unit_routes, (item) => identifier(item, "unit-") || validProjectedRoute(item)));
}
function validModuleSourceMap(value) {
  const source = row(value);
  return Boolean(source && exact(source, ["id", "type", "module_id", "sources", "revision", "path"]) && identifier(source.id, "source-map-") && source.type === "module-source-map" && identifier(source.module_id, "module-") && list(source.sources, validSourceMapEntry) && natural(source.revision) && text(source.path));
}
function validCoordinationRecord(value) {
  const source = row(value);
  const sections = row(source?.sections);
  return Boolean(source && exact(source, ["id", "type", "path", "sections"]) && source.id === "coordination" && source.type === "coordination" && source.path === "work/COORDINATION.md" && sections && exact(sections, ["Commitments", "Priorities", "Dependencies", "Deferrals"]) && Object.values(sections).every(text));
}
function validAiAction(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "id",
    "title",
    "description",
    "target_kinds",
    "interaction_mode",
    "status",
    "supported_providers"
  ]) && text(source.id) && /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(source.id) && nonEmpty(source.title) && text(source.description) && list(source.target_kinds, nonEmpty, true) && nonEmpty(source.interaction_mode) && values(source.status, ["planned", "implemented"]) && list(source.supported_providers, nonEmpty, true));
}
function validAiProvider(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "id",
    "adapter",
    "available",
    "supported_modes",
    "supports_direct_delivery"
  ]) && nonEmpty(source.id) && nonEmpty(source.adapter) && typeof source.available === "boolean" && list(source.supported_modes, nonEmpty, true) && typeof source.supports_direct_delivery === "boolean");
}
function validAiRequest(value) {
  const source = row(value);
  const target = row(source?.target);
  return Boolean(source && exact(source, [
    "id",
    "action_id",
    "target",
    "provider",
    "status",
    "created_at",
    "delivery_id",
    "receipt_id",
    "bundle_path"
  ]) && identifier(source.id, "ai-request-") && text(source.action_id) && /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(source.action_id) && target && exact(target, ["kind", "id"]) && nonEmpty(target.kind) && nonEmpty(target.id) && nonEmpty(source.provider) && values(source.status, ["prepared", "delivery-ready", "completed"]) && dateTime(source.created_at) && nullable(source.delivery_id, text) && nullable(source.receipt_id, text) && text(source.bundle_path) && /^operations\/ai-actions\/requests\/[^/]+$/.test(source.bundle_path));
}
function validAiActions(value) {
  const source = row(value);
  return Boolean(source && exact(source, [
    "available",
    "contract_version",
    "provider_adapters",
    "requests"
  ]) && source.contract_version === 1 && list(source.available, validAiAction) && list(source.provider_adapters, validAiProvider) && list(source.requests, validAiRequest));
}
function validProjectedRecord(value, validSynthesis) {
  const source = row(value);
  switch (source?.type) {
    case "note":
      return validNoteRecord(source);
    case "concept":
      return validConceptRecord(source);
    case "source":
      return validSourceRecord(source);
    case "project":
      return validProjectRecord(source);
    case "project-relationship":
      return validProjectRelationship(source);
    case "compatibility-alias":
      return validCompatibilityAlias(source);
    case "module":
      return validModuleRecord(source);
    case "collection":
    case "topic-pack":
      return validCollectionRecord(source);
    case "workspace":
      return validWorkspaceRecord(source);
    case "learning-path":
      return validLearningPath(source);
    case "program":
      return validProgramRecord(source);
    case "unit":
      return validProjectedUnit(source);
    case "study-map":
      return validStudyMap(source);
    case "module-source-map":
      return validModuleSourceMap(source);
    case "unit-material-synthesis":
      return validSynthesis(source);
    case "coordination":
      return validCoordinationRecord(source);
    default:
      return false;
  }
}

// src/contracts/manifest.ts
var MANIFEST_CONTRACT_VERSION = 8;
var MANIFEST_SCHEMA_SHA256 = "sha256:f08b0e5b4f131cff0a95bfc87d95863ae691a698c7bbf1d5e96d4da0fee03b10";
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(value, required, optional2 = []) {
  const allowed = /* @__PURE__ */ new Set([...required, ...optional2]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) && Object.keys(value).every((key) => allowed.has(key));
}
var nonEmptyText = (value) => typeof value === "string" && value.trim().length > 0;
var sha256 = (value) => typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
var natural2 = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0;
var identifier2 = (value, prefix) => typeof value === "string" && new RegExp(`^${prefix}[a-z0-9]+(?:-[a-z0-9]+)*$`).test(value);
function uniqueStringArray(value, predicate) {
  return Array.isArray(value) && value.every(predicate) && new Set(value).size === value.length;
}
function validSynthesisEvidence(value) {
  if (!isRecord(value) || !exactKeys(value, ["locator", "checksum"], ["note"])) return false;
  return nonEmptyText(value.locator) && sha256(value.checksum) && (!("note" in value) || nonEmptyText(value.note));
}
function validSynthesisBasis(value) {
  if (!isRecord(value) || !exactKeys(value, [
    "unit_revision",
    "source_map_revision",
    "source_map_checksum",
    "route_set_checksum",
    "material_checksums",
    "policy",
    "ai_provenance"
  ])) return false;
  const checksums = value.material_checksums;
  const provenance = value.ai_provenance;
  return natural2(value.unit_revision) && natural2(value.source_map_revision) && sha256(value.source_map_checksum) && sha256(value.route_set_checksum) && isRecord(checksums) && Object.entries(checksums).every(([routeId, checksum]) => identifier2(routeId, "route-") && sha256(checksum)) && value.policy === "tiered-v1" && isRecord(provenance) && exactKeys(provenance, ["request_id", "delivery_id", "provider"]) && nonEmptyText(provenance.request_id) && nonEmptyText(provenance.delivery_id) && ["manual-bundle", "local"].includes(String(provenance.provider));
}
function validRouteAssessment(value) {
  if (!isRecord(value) || !exactKeys(value, [
    "route_id",
    "source_id",
    "locator",
    "review_status",
    "concept_ids"
  ], [
    "contribution",
    "assumptions",
    "notation",
    "exercise_value",
    "best_for",
    "limitations",
    "reason",
    "evidence"
  ]) || !identifier2(value.route_id, "route-") || !identifier2(value.source_id, "source-") || !nonEmptyText(value.locator) || !["deep-reviewed", "screened", "unevaluated", "unavailable"].includes(String(value.review_status)) || !uniqueStringArray(value.concept_ids, (item) => identifier2(item, "concept-"))) return false;
  const detailed = [
    "contribution",
    "assumptions",
    "notation",
    "exercise_value",
    "best_for",
    "limitations"
  ];
  if ("reason" in value && !nonEmptyText(value.reason)) return false;
  if ("evidence" in value && (!Array.isArray(value.evidence) || !value.evidence.every(validSynthesisEvidence))) return false;
  if (value.review_status === "deep-reviewed") {
    return detailed.every((key) => nonEmptyText(value[key])) && Array.isArray(value.evidence) && value.evidence.length > 0;
  }
  return nonEmptyText(value.reason) && detailed.every((key) => !(key in value));
}
function validRouteComparison(value) {
  if (!isRecord(value) || !exactKeys(value, [
    "left_route_id",
    "right_route_id",
    "relation",
    "narrative",
    "concept_ids",
    "evidence"
  ]) || !identifier2(value.left_route_id, "route-") || !identifier2(value.right_route_id, "route-") || !["duplicates", "overlaps", "complements", "extends", "contrasts", "alternate-notation"].includes(String(value.relation)) || !nonEmptyText(value.narrative) || !uniqueStringArray(value.concept_ids, (item) => identifier2(item, "concept-"))) return false;
  const evidence2 = value.evidence;
  return isRecord(evidence2) && exactKeys(evidence2, ["left", "right"]) && Array.isArray(evidence2.left) && evidence2.left.length > 0 && evidence2.left.every(validSynthesisEvidence) && Array.isArray(evidence2.right) && evidence2.right.length > 0 && evidence2.right.every(validSynthesisEvidence);
}
function validConceptGroup(value) {
  return isRecord(value) && exactKeys(value, [
    "concept_id",
    "local_node_ids",
    "related_unit_ids",
    "bridge_note_ids",
    "narrative"
  ]) && identifier2(value.concept_id, "concept-") && uniqueStringArray(value.local_node_ids, (item) => identifier2(item, "knowledge-")) && uniqueStringArray(value.related_unit_ids, (item) => identifier2(item, "unit-")) && uniqueStringArray(value.bridge_note_ids, (item) => identifier2(item, "note-")) && nonEmptyText(value.narrative);
}
var synthesisStaleReasons = [
  "unit_revision",
  "source_map_revision",
  "source_map_checksum",
  "route_set_checksum",
  "material_checksums",
  "policy",
  "current-basis-unavailable"
];
function validSynthesisFreshness(value) {
  return isRecord(value) && exactKeys(value, ["status", "reasons"]) && ["current", "stale"].includes(String(value.status)) && uniqueStringArray(value.reasons, (reason) => typeof reason === "string" && synthesisStaleReasons.includes(reason));
}
function validSynthesisCompleteness(value) {
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
    "duplicate_route_ids"
  ]) || typeof value.complete !== "boolean") return false;
  for (const key of [
    "current_route_count",
    "assessed_route_count",
    "deep_reviewed_count",
    "screened_count",
    "unevaluated_count",
    "unavailable_count"
  ]) {
    if (!natural2(value[key])) return false;
  }
  return ["missing_route_ids", "orphaned_route_ids", "duplicate_route_ids"].every((key) => uniqueStringArray(value[key], (routeId) => identifier2(routeId, "route-")));
}
function validMaterialSynthesis(value) {
  return isRecord(value) && exactKeys(value, [
    "schema_version",
    "id",
    "type",
    "unit_id",
    "status",
    "basis",
    "route_assessments",
    "comparisons",
    "concept_groups",
    "freshness",
    "completeness"
  ]) && value.schema_version === 1 && identifier2(value.id, "material-synthesis-") && value.type === "unit-material-synthesis" && identifier2(value.unit_id, "unit-") && value.status === "approved" && validSynthesisBasis(value.basis) && Array.isArray(value.route_assessments) && value.route_assessments.length > 0 && value.route_assessments.every(validRouteAssessment) && Array.isArray(value.comparisons) && value.comparisons.every(validRouteComparison) && Array.isArray(value.concept_groups) && value.concept_groups.every(validConceptGroup) && validSynthesisFreshness(value.freshness) && validSynthesisCompleteness(value.completeness);
}
function requireArray(record4, key) {
  if (!Array.isArray(record4[key])) {
    throw new TypeError(`Manifest field ${String(key)} must be an array.`);
  }
}
function assertManifest(value) {
  if (!isRecord(value) || !isRecord(value._generated)) {
    throw new TypeError("Manifest requires an _generated object.");
  }
  if (!exactKeys(value, [
    "_generated",
    "academic_deadlines",
    "ai_actions",
    "artifact_revisions",
    "backlinks",
    "counts",
    "garden_entries",
    "indexes",
    "module_concept_edges",
    "module_source_maps",
    "modules",
    "programs",
    "progress",
    "project_aliases",
    "project_relationships",
    "projects",
    "records",
    "relations",
    "resume_pointer",
    "review_items",
    "semesters",
    "stages",
    "study_maps",
    "thematic_groups",
    "topic_packs",
    "topics",
    "unit_material_syntheses",
    "units"
  ])) {
    throw new TypeError("Manifest top-level keys do not match contract v8.");
  }
  const generated = value._generated;
  if (!exactKeys(generated, [
    "contract_version",
    "generated_at",
    "generator",
    "schema_sha256",
    "snapshot_id",
    "source_dirty",
    "source_fingerprint",
    "source_revision",
    "warning"
  ])) {
    throw new TypeError("Manifest _generated keys do not match contract v8.");
  }
  if (generated.contract_version !== MANIFEST_CONTRACT_VERSION) {
    throw new TypeError(
      `Unsupported manifest contract ${String(generated.contract_version)}; expected ${MANIFEST_CONTRACT_VERSION}.`
    );
  }
  if (generated.schema_sha256 !== MANIFEST_SCHEMA_SHA256) {
    throw new TypeError(
      `Unsupported manifest schema ${String(generated.schema_sha256)}; expected ${MANIFEST_SCHEMA_SHA256}.`
    );
  }
  if (typeof generated.generated_at !== "string" || !nonEmptyText(generated.generator) || !sha256(generated.snapshot_id) || typeof generated.source_dirty !== "boolean" || typeof generated.source_fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(generated.source_fingerprint) || !(generated.source_revision === null || typeof generated.source_revision === "string") || typeof generated.warning !== "string") {
    throw new TypeError("Manifest _generated metadata does not match contract v8.");
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
    "units"
  ]) {
    requireArray(value, key);
  }
  if (!validAiActions(value.ai_actions)) {
    throw new TypeError("Manifest ai_actions must match the closed v8 projection.");
  }
  if (!value.academic_deadlines.every(validAcademicDeadline)) {
    throw new TypeError("Manifest academic deadlines must match the closed v8 projection.");
  }
  if (!value.garden_entries.every(validGardenEntry)) {
    throw new TypeError("Manifest Garden rows must match the closed v8 projection.");
  }
  if (!value.relations.every(validRelation)) {
    throw new TypeError("Manifest relations must match the closed v8 projection.");
  }
  if (!value.review_items.every(validReviewItem)) {
    throw new TypeError("Manifest review rows must match the closed v8 projection.");
  }
  if (!value.semesters.every(validSemester)) {
    throw new TypeError("Manifest semesters must match the closed v8 projection.");
  }
  if (!value.thematic_groups.every(validThematicGroup)) {
    throw new TypeError("Manifest thematic groups must match the closed v8 projection.");
  }
  if (!value.topic_packs.every(validTopicPack)) {
    throw new TypeError("Manifest topic packs must match the closed v8 projection.");
  }
  if (!value.topics.every(validTopic)) {
    throw new TypeError("Manifest topics must match the closed v8 projection.");
  }
  for (const module2 of value.modules) {
    if (!validModuleRecord(module2)) {
      throw new TypeError("Manifest module rows must match the closed v8 projection.");
    }
  }
  for (const program of value.programs) {
    if (!validProgramRecord(program)) {
      throw new TypeError("Manifest program rows must match the closed v8 projection.");
    }
  }
  for (const project of value.projects) {
    if (!validProjectRecord(project)) {
      throw new TypeError("Manifest project rows must match the closed v8 projection.");
    }
  }
  for (const relationship of value.project_relationships) {
    if (!validProjectRelationship(relationship)) {
      throw new TypeError("Manifest project relationships must match the closed v8 projection.");
    }
  }
  for (const sourceMap of value.module_source_maps) {
    if (!validModuleSourceMap(sourceMap)) {
      throw new TypeError("Manifest module source maps must match the closed v8 projection.");
    }
  }
  for (const unit of value.units) {
    if (!validProjectedUnit(unit)) {
      throw new TypeError("Manifest unit rows must match the closed v8 projection.");
    }
  }
  for (const studyMap of value.study_maps) {
    if (!validStudyMap(studyMap)) {
      throw new TypeError("Manifest study maps must match the closed v8 projection.");
    }
  }
  for (const stage of value.stages) {
    if (!validFlatStage(stage)) {
      throw new TypeError("Manifest flat stages must match the closed v8 projection.");
    }
  }
  for (const record4 of value.records) {
    if (!validProjectedRecord(record4, validMaterialSynthesis)) {
      throw new TypeError("Manifest records must match the closed v8 record union.");
    }
  }
  for (const key of ["ai_actions", "artifact_revisions", "backlinks", "counts", "indexes", "progress", "project_aliases", "resume_pointer"]) {
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
  for (const edge of edges) {
    if (!isRecord(edge) || !exactKeys(edge, ["module_id", "concept_id", "evidence"])) {
      throw new TypeError("Manifest module_concept_edges rows must be {module_id, concept_id, evidence}.");
    }
    if (!identifier2(edge.module_id, "module-") || !identifier2(edge.concept_id, "concept-")) {
      throw new TypeError("Manifest module_concept_edges rows must name a module and a concept.");
    }
    if (!Array.isArray(edge.evidence) || edge.evidence.length === 0) {
      throw new TypeError("Manifest module_concept_edges rows must carry at least one evidence item.");
    }
    for (const item of edge.evidence) {
      if (!isRecord(item) || !identifier2(item.unit_id, "unit-")) {
        throw new TypeError("Manifest module_concept_edges evidence must name a unit.");
      }
      if (item.kind === "stage-concept") {
        if (!exactKeys(item, ["kind", "unit_id", "study_map_id", "stage_id"]) || !identifier2(item.study_map_id, "study-map-") || !identifier2(item.stage_id, "stage-")) {
          throw new TypeError("Manifest stage-concept evidence must name its study map and stage.");
        }
      } else if (item.kind === "knowledge-node") {
        if (!exactKeys(item, ["kind", "unit_id", "node_id"]) || !identifier2(item.node_id, "knowledge-")) {
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
    "component_to_units",
    "concept_to_modules",
    "concept_to_units",
    "module_to_concepts",
    "module_to_units",
    "project_aliases",
    "project_to_relationships",
    "project_to_units",
    "project_to_workspaces",
    "source_to_modules",
    "source_to_units",
    "unit_to_concepts",
    "unit_to_material_synthesis",
    "unit_to_study_map",
    "workspace_to_modules",
    "workspace_to_units"
  ])) {
    throw new TypeError("Manifest index keys do not match contract v8.");
  }
  for (const key of [
    "concept_to_units",
    "source_to_modules",
    "source_to_units",
    "unit_to_concepts",
    "unit_to_material_synthesis",
    "unit_to_study_map"
  ]) {
    if (!isRecord(indexes[key])) {
      throw new TypeError(`Manifest index ${key} must be an object.`);
    }
  }
  for (const key of [
    "component_to_units",
    "concept_to_modules",
    "concept_to_units",
    "module_to_concepts",
    "module_to_units",
    "project_to_relationships",
    "project_to_units",
    "project_to_workspaces",
    "source_to_modules",
    "source_to_units",
    "unit_to_concepts",
    "workspace_to_modules",
    "workspace_to_units"
  ]) {
    const index = indexes[key];
    if (!isRecord(index) || !Object.values(index).every((ids2) => uniqueStringArray(ids2, (item) => typeof item === "string"))) {
      throw new TypeError(`Manifest index ${key} must map to unique string arrays.`);
    }
  }
  for (const key of ["project_aliases", "unit_to_study_map"]) {
    const index = indexes[key];
    if (!isRecord(index) || !Object.values(index).every((idValue) => typeof idValue === "string")) {
      throw new TypeError(`Manifest index ${key} must map to strings.`);
    }
  }
  const synthesisIndex = indexes.unit_to_material_synthesis;
  if (!isRecord(synthesisIndex) || !Object.values(synthesisIndex).every((idValue) => identifier2(idValue, "material-synthesis-"))) {
    throw new TypeError("Manifest index unit_to_material_synthesis must map to synthesis IDs.");
  }
  for (const synthesis of value.unit_material_syntheses) {
    if (!validMaterialSynthesis(synthesis)) {
      throw new TypeError("Manifest material syntheses must match UnitMaterialSynthesisV1.");
    }
  }
}

// src/constants.ts
var VIEW_HOME = "learningos-home";
var VIEW_NAV = "learningos-nav";
var VIEW_PROGRAM = "learningos-program";
var VIEW_MODULE = "learningos-module";
var VIEW_PROJECT = "learningos-project";
var VIEW_UNIT = "learningos-unit";
var VIEW_LIBRARY = "learningos-library";
var VIEW_ATLAS = "learningos-atlas";
var VIEW_SHELVING = "learningos-shelving";
var VIEW_BOUNDARY = "learningos-boundary";
var VIEW_REVIEW = "learningos-review";
var VIEW_GARDEN = "learningos-garden";
var VIEW_DIAGNOSTICS = "learningos-diagnostics";
var LEARN_AREAS = [
  ["program-bachelors", "Bachelor\u2019s"],
  ["program-skills", "Skills"],
  ["program-job", "Job"],
  ["program-thesis-projects", "Thesis & projects"]
];
var LEGACY_VIEW_TYPES = [
  "learningos-dashboard",
  "learningos-explorer",
  "learningos-learning-path",
  "learningos-shelve-review",
  "learningos-job-boundary"
];
var DEFAULT_SETTINGS = {
  openHomeOnStartup: true,
  pinHome: true,
  collapseSidebars: true,
  showAiRecommendation: true,
  navMoreOpen: false,
  learnArea: "program-bachelors",
  pythonPath: "",
  preferredAiProvider: "manual-bundle"
};
var SAFE_URL_PROTOCOLS = ["https:", "http:"];
var ICONS = {
  program: "graduation-cap",
  module: "book-open",
  project: "briefcase-business",
  unit: "layers-3",
  "study-map": "route",
  stage: "list-checks",
  note: "file-text",
  concept: "network",
  source: "library",
  workspace: "briefcase-business",
  boundary: "shield",
  skills: "wrench",
  projects: "flask-conical",
  collection: "library-big",
  "topic-pack": "notebook-tabs",
  atlas: "map"
};

// src/settings.ts
var import_obsidian2 = require("obsidian");

// src/components.ts
var import_obsidian = require("obsidian");
var import_electron = require("electron");

// src/projection/readers.ts
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asRecord(value) {
  return isRecord2(value) ? value : null;
}
function asRecordOrEmpty(value) {
  return asRecord(value) ?? {};
}
function asString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}
function asText(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text5 = String(value);
  return text5.length > 0 ? text5 : null;
}
function asBoolean(value) {
  return value === true || value === 1 || value === "true";
}
function asRecords(value) {
  return Array.isArray(value) ? value.filter(isRecord2) : [];
}
function asStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.length > 0) : [];
}
function asCount(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}
function asFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function asListLength(value) {
  return Array.isArray(value) ? value.length : 0;
}
function optionalString(value) {
  return typeof value === "string" ? value : void 0;
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function asLabel(record4, fallback = "Untitled") {
  if (!record4) return fallback;
  return asString(record4.title) ?? asString(record4.label) ?? asString(record4.name) ?? asString(record4.id) ?? fallback;
}

// src/accessibility/button-group.ts
function enableButtonGroupKeyboardNavigation(group, orientation = "horizontal") {
  group.addEventListener("keydown", (event) => {
    const horizontal = orientation === "horizontal" || orientation === "both";
    const vertical = orientation === "vertical" || orientation === "both";
    const backward = event.key === "Home" || horizontal && event.key === "ArrowLeft" || vertical && event.key === "ArrowUp";
    const forward = event.key === "End" || horizontal && event.key === "ArrowRight" || vertical && event.key === "ArrowDown";
    if (!backward && !forward) return;
    const controls = typeof group.querySelectorAll === "function" ? Array.from(group.querySelectorAll("button")).filter(
      (control) => !control.disabled && control.getAttribute("aria-hidden") !== "true"
    ) : [];
    if (!controls.length) return;
    const current = controls.indexOf(event.target);
    if (current < 0) return;
    event.preventDefault();
    let target = current;
    if (event.key === "Home") target = 0;
    else if (event.key === "End") target = controls.length - 1;
    else target = (current + (forward ? 1 : -1) + controls.length) % controls.length;
    controls[target]?.focus();
  });
}

// src/security/safe-url.ts
function safeWebUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return SAFE_URL_PROTOCOLS.includes(url.protocol) ? url : null;
  } catch (_) {
    return null;
  }
}

// src/components.ts
function icon(el, name) {
  el.setAttrs({
    "aria-hidden": "true",
    focusable: "false"
  });
  (0, import_obsidian.setIcon)(el, name || "circle");
  return el;
}
function button(parent, label, onClick, variant = "") {
  const el = parent.createEl("button", {
    cls: `los-btn is-clickable ${variant ? `los-btn--${variant}` : ""}`,
    text: label,
    attr: { type: "button" }
  });
  el.addEventListener("click", (event) => {
    event.preventDefault();
    onClick?.(event);
  });
  return el;
}
function badge(parent, text5, variant = "") {
  return parent.createSpan({ cls: `los-badge ${variant ? `los-badge--${variant}` : ""}`, text: text5 });
}
function chip(parent, record4, onClick) {
  const el = parent.createEl("button", {
    cls: `los-chip los-t-${record4?.type || "record"} is-clickable`,
    attr: { type: "button" }
  });
  const iconName = ICONS[String(record4?.type || "")] || "circle";
  icon(el.createSpan({ cls: "los-chip-icon" }), iconName);
  el.createSpan({ text: record4?.title || record4?.id || "Unknown" });
  if (onClick) el.addEventListener("click", () => onClick(record4));
  return el;
}
function pageHeader(parent, kicker, title, description = "", headingId = "") {
  const header = parent.createDiv({ cls: "los-page-header" });
  if (kicker) header.createDiv({ cls: "los-kicker", text: kicker });
  const heading = header.createEl("h1", { text: title });
  if (headingId) heading.setAttribute("id", headingId);
  if (description) header.createEl("p", { text: description });
  return header;
}
function section(parent, title, description = "") {
  const wrap = parent.createDiv({ cls: "los-section" });
  wrap.createEl("h2", { text: title });
  if (description) wrap.createEl("p", { cls: "los-muted", text: description });
  return wrap;
}
function factList(parent, facts) {
  const list2 = parent.createDiv({ cls: "los-fact-list" });
  for (const [label, value] of facts) {
    if (value === null || value === void 0 || value === "") continue;
    const row3 = list2.createDiv({ cls: "los-fact-row" });
    row3.createDiv({ cls: "los-fact-label", text: label });
    row3.createDiv({ cls: "los-fact-value", text: String(value) });
  }
  return list2;
}
function filterTabs(parent, ariaLabel, tabs, active, choose, countOf = null) {
  const row3 = parent.createDiv({ cls: "los-filter-tabs" });
  row3.setAttrs({ role: "group", "aria-label": ariaLabel });
  enableButtonGroupKeyboardNavigation(row3);
  for (const [value, label] of tabs) {
    const count = countOf ? countOf(value) : 0;
    const control = button(
      row3,
      count ? `${label} ${count}` : label,
      () => choose(value),
      "quiet"
    );
    control.addClass("los-filter-tab");
    control.toggleClass("is-active", value === active);
    control.setAttrs({ "aria-pressed": String(value === active) });
  }
  return row3;
}
function disclosure(parent, summaryText, cls = "") {
  const details = parent.createEl("details", { cls: `los-disclosure ${cls}`.trim() });
  details.createEl("summary", { text: summaryText });
  return details.createDiv({ cls: "los-disclosure-body" });
}
function overflowMenu(parent, items, label = "More actions") {
  const rows = items.filter(Boolean);
  if (!rows.length) return null;
  const details = parent.createEl("details", { cls: "los-overflow" });
  const summary = details.createEl("summary", { cls: "los-overflow-trigger", text: "\u2022\u2022\u2022" });
  summary.setAttrs({ "aria-label": label, role: "button" });
  const body = details.createDiv({ cls: "los-overflow-body" });
  for (const [itemLabel, action] of rows) {
    button(body, itemLabel, () => {
      details.removeAttribute?.("open");
      action();
    }, "menu");
  }
  return details;
}
function empty(parent, title, detail, actionLabel = "", action = null) {
  const el = parent.createDiv({ cls: "los-empty" });
  el.createEl("h3", { text: title });
  el.createEl("p", { text: detail });
  if (actionLabel) button(el, actionLabel, action, "quiet");
  return el;
}
function localFilePath(file) {
  if (!file) return "";
  try {
    return import_electron.webUtils.getPathForFile(file) || "";
  } catch (_) {
    return "";
  }
}
function projectedExcerpt(value, limit = 900) {
  const [paragraph = ""] = String(value || "").split(/\n\s*\n/);
  const first = paragraph.replace(/\*{1,2}/g, "").replace(/`/g, "").replace(/(^|\n)\s*-\s*/g, "$1").replace(/\s+/g, " ").trim();
  if (first.length <= limit) return first;
  return `${Array.from(first).slice(0, limit - 1).join("")}\u2026`;
}
function workspaceCard(parent, plugin, workspace, moduleContext = null) {
  const workspaceTitle = asLabel(workspace);
  const workspaceStatus = asString(workspace.status) || "active";
  const card = parent.createDiv({ cls: `los-card los-workspace-card los-s-${workspaceStatus}` });
  const top = card.createDiv({ cls: "los-card-top" });
  top.createEl("h3", { text: workspaceTitle });
  badge(top, workspace.standing ? `${workspaceStatus} \xB7 standing` : workspaceStatus, workspaceStatus);
  if (workspace.objective) card.createEl("p", { cls: "los-workspace-objective", text: workspace.objective });
  const next = card.createDiv({ cls: "los-next-action" });
  next.createDiv({ cls: "los-kicker", text: "Next action" });
  next.createEl("p", { text: projectedExcerpt(workspace.next_action, 1600) || "No next action recorded." });
  if (workspace.deadline) badge(next, `Deadline ${workspace.deadline}`, "needs-map");
  const actions = card.createDiv({ cls: "los-actions" });
  const moduleIds = (workspace.module_ids || []).filter(
    (id2) => id2 !== moduleContext
  );
  for (const id2 of moduleIds.slice(0, 3)) {
    const module2 = plugin.store.get(id2);
    if (module2) button(actions, `Open ${module2.title}`, () => plugin.nav.openModule(id2), "quiet");
  }
  for (const id2 of (workspace.unit_ids || []).slice(0, 3)) {
    const unit = plugin.store.get(id2);
    if (unit) button(actions, `Open ${unit.title}`, () => plugin.nav.openUnit(id2), "quiet");
  }
  return card;
}
function unitCard(parent, plugin, unit) {
  const unitId = asString(unit.id);
  const unitTitle = asLabel(unit);
  const unitStatus = asString(unit.status) || "ready";
  const card = parent.createEl("button", {
    cls: `los-card los-unit-card los-s-${unitStatus} is-clickable`,
    attr: { type: "button", "aria-label": `Open unit: ${unitTitle}` }
  });
  const top = card.createDiv({ cls: "los-card-top" });
  top.createEl("h3", { text: unitTitle });
  badge(top, unitStatus, unitStatus);
  card.createEl("p", { text: asString(unit.scope) || "No scope projected." });
  const map = unitId ? plugin.store.mapForUnit(unitId) : null;
  if (map) {
    const stages = asRecords(map.stages);
    const done = stages.filter(
      (row3) => row3.status === "complete"
    ).length;
    card.createDiv({ cls: "los-progress-copy", text: `${done} of ${stages.length} stages complete` });
  } else {
    card.createDiv({ cls: "los-progress-copy", text: "No study map yet" });
  }
  if (unitId) card.addEventListener("click", () => plugin.nav.openUnit(unitId));
  return card;
}
var OWNERSHIP_STATEMENT = "Presentation only \xB7 facts live in the LearningOS core \xB7 buttons are conveniences, never duties.";

// src/contracts/gateway-v1.ts
var EXIT_PROJECTION_CONFLICT = 3;
var GatewayError = class extends Error {
  exitCode;
  gatewayCode;
  retryable;
  constructor(message, exitCode = null, details = {}) {
    super(message);
    this.name = "GatewayError";
    this.exitCode = exitCode;
    this.gatewayCode = details.code || null;
    this.retryable = typeof details.retryable === "boolean" ? details.retryable : null;
  }
  get isProjectionConflict() {
    return this.exitCode === EXIT_PROJECTION_CONFLICT || this.gatewayCode === "STALE_SNAPSHOT" || this.gatewayCode === "REVISION_CONFLICT";
  }
};
function isProjectionConflict(error) {
  return error instanceof GatewayError && error.isProjectionConflict;
}
function exitCodeOf(error) {
  const code = error?.code;
  return typeof code === "number" ? code : null;
}
function structuredError(stdout) {
  const raw = String(stdout ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    const error = parsed?.error;
    if (typeof error === "string") return error.trim();
    const message = error?.message;
    return typeof message === "string" ? message.trim() : "";
  } catch (_) {
    return "";
  }
}
function asStringList(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}
function asSessionReview(result) {
  return {
    owned_changes: asStringList(result.owned_changes),
    unrelated_changes: asStringList(result.unrelated_changes),
    pushed: result.pushed === true
  };
}

// src/accessibility/modal.ts
var FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");
function makeModalAccessible(content, options) {
  const document2 = content.ownerDocument ?? globalThis.document;
  const previousFocus = document2?.activeElement;
  const host = typeof content.closest === "function" ? content.closest(".modal") : null;
  const dialog = host ?? content;
  const focusRoot = dialog;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", options.labelledBy);
  dialog.setAttribute("tabindex", "-1");
  host?.classList.add(options.hostClass);
  const workspaces = document2 && typeof document2.querySelectorAll === "function" ? Array.from(
    document2.querySelectorAll(".workspace")
  ) : [];
  const backgrounds = workspaces.filter(
    (element) => typeof element.contains !== "function" || !element.contains(dialog)
  ).map((element) => ({
    element,
    ariaHidden: element.getAttribute("aria-hidden"),
    inert: element.inert
  }));
  for (const background of backgrounds) {
    background.element.inert = true;
    background.element.setAttribute("aria-hidden", "true");
  }
  let cancelInitialFocus = null;
  if (options.initialFocus) {
    const view = document2?.defaultView ?? globalThis.window;
    const focus = () => options.initialFocus?.()?.focus?.();
    if (typeof view?.requestAnimationFrame === "function") {
      const frame = view.requestAnimationFrame(focus);
      cancelInitialFocus = () => view.cancelAnimationFrame?.(frame);
    } else {
      const timer = view.setTimeout(focus, 0);
      cancelInitialFocus = () => view.clearTimeout(timer);
    }
  }
  const focusable = () => {
    if (typeof focusRoot.querySelectorAll !== "function") {
      return [];
    }
    return Array.from(
      focusRoot.querySelectorAll(FOCUSABLE)
    ).filter(
      (element) => element.getAttribute("aria-hidden") !== "true" && !element.disabled
    );
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      options.close();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const controls = focusable();
    if (!controls.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = controls[0];
    const last = controls.at(-1);
    const active = document2?.activeElement;
    if (event.shiftKey && (active === first || !focusRoot.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !focusRoot.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };
  focusRoot.addEventListener("keydown", onKeyDown);
  let cleaned = false;
  return () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    cancelInitialFocus?.();
    cancelInitialFocus = null;
    focusRoot.removeEventListener?.("keydown", onKeyDown);
    host?.classList.remove(options.hostClass);
    for (const background of backgrounds) {
      background.element.inert = background.inert;
      if (background.ariaHidden === null) {
        background.element.removeAttribute("aria-hidden");
      } else {
        background.element.setAttribute(
          "aria-hidden",
          background.ariaHidden
        );
      }
    }
    previousFocus?.focus?.();
  };
}

// src/settings.ts
function errorMessage2(error) {
  return error instanceof Error ? error.message : String(error);
}
var LearningOSSettingsTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
  }
  display() {
    const root = this.containerEl;
    root.empty();
    root.createEl("h2", { text: "LearningOS UI" });
    const toggles = [
      ["openHomeOnStartup", "Open Home on startup", "Open the module-first Home view when the vault becomes ready."],
      ["pinHome", "Pin Home", "Keep the Home leaf available while opening units."],
      ["collapseSidebars", "Collapse the right sidebar", "Keep the learning workspace visually focused."],
      ["showAiRecommendation", "Show scoped AI action", "Display AI buttons that always include explicit curriculum context."]
    ];
    for (const [key, name, description] of toggles) {
      new import_obsidian2.Setting(root).setName(name).setDesc(description).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings[key]).onChange(
          async (value) => {
            this.plugin.settings[key] = value;
            await this.plugin.saveData(this.plugin.settings);
          }
        )
      );
    }
    new import_obsidian2.Setting(root).setName("Python interpreter").setDesc("Leave blank to auto-detect: the project virtual environment, then the system Python.").addText((text5) => text5.setValue(this.plugin.settings.pythonPath || "").onChange(async (value) => {
      this.plugin.settings.pythonPath = value.trim();
      await this.plugin.saveData(this.plugin.settings);
    }));
    new import_obsidian2.Setting(root).setName("Validate and rebuild").setDesc("Run the canonical core projection pipeline.").addButton(
      (control) => control.setButtonText("Rebuild").setCta().onClick(() => this.plugin.generate())
    );
    new import_obsidian2.Setting(root).setName("Diagnostics").setDesc("Contract versions, projection freshness, interpreter.").addButton(
      (control) => control.setButtonText("Open").onClick(() => this.plugin.nav.openDiagnostics())
    );
    root.createEl("h3", { text: "About LearningOS" });
    root.createEl("p", { cls: "los-muted", text: OWNERSHIP_STATEMENT });
  }
};
var SessionEndModal = class extends import_obsidian2.Modal {
  plugin;
  review;
  restoreAccessibility = null;
  constructor(app, plugin, review) {
    super(app);
    this.plugin = plugin;
    this.review = review;
  }
  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-session-modal");
    pageHeader(
      root,
      "Explicit Git closure",
      "End learning session",
      "Only files recorded by guarded learning actions can be staged. Unrelated changes remain untouched.",
      "los-session-end-heading"
    );
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: "los-modal--session-end",
      labelledBy: "los-session-end-heading"
    });
    const owned = section(root, "Session-owned changes");
    if (!(this.review.owned_changes || []).length) empty(owned, "No owned changes", "There is nothing to commit from this session.");
    for (const file of this.review.owned_changes || []) owned.createEl("code", { text: file });
    const unrelated = section(root, "Unrelated changes (excluded)");
    if (!(this.review.unrelated_changes || []).length) unrelated.createEl("p", { text: "None." });
    for (const file of this.review.unrelated_changes || []) unrelated.createEl("code", { text: file });
    const message = root.createEl("input", {
      cls: "los-search",
      attr: { type: "text", placeholder: "Commit message", "aria-label": "Learning session commit message" }
    });
    const pushRow = root.createDiv({ cls: "los-row" });
    const push = pushRow.createEl("input", { attr: { type: "checkbox", "aria-label": "Push after commit" } });
    pushRow.createSpan({ text: "Push after the scoped commit succeeds" });
    const actions = root.createDiv({ cls: "los-actions" });
    button(actions, "Commit session-owned files", async () => {
      if (!message.value.trim()) {
        new import_obsidian2.Notice("Enter a commit message first.");
        return;
      }
      try {
        const result = asSessionReview(
          await this.plugin.gateway.endSession(message.value.trim(), Boolean(push.checked))
        );
        new import_obsidian2.Notice(result.pushed ? "Learning session committed and pushed." : "Learning session committed.");
        this.close();
      } catch (error) {
        new import_obsidian2.Notice(errorMessage2(error));
      }
    }, "cta");
    button(actions, "Close without committing", () => this.close(), "quiet");
    message.focus();
  }
  onClose() {
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
};

// src/views/atlas-view.ts
var import_obsidian3 = require("obsidian");

// src/features/atlas/crossing.ts
function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function conceptIds(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function sourceNamesConcept(source, conceptId) {
  return Array.isArray(source.evaluations) && source.evaluations.some((evaluation) => {
    const record4 = objectValue(evaluation);
    return record4 ? conceptIds(record4.concepts).includes(conceptId) : false;
  });
}
function byLabel(left, right) {
  return asLabel(left).localeCompare(asLabel(right));
}
function buildConceptContext(store, conceptId) {
  const notes = store.related(conceptId).map((row3) => row3.rec).filter((record4) => record4?.type === "note").sort(byLabel);
  const sources = store.sources().filter((source) => sourceNamesConcept(source, conceptId)).sort(byLabel);
  const relationTable = objectValue(
    store.data?.backlinks?.concept_relations
  );
  const relationEntry = objectValue(relationTable?.[conceptId]);
  const relations2 = [];
  for (const direction of ["incoming", "outgoing"]) {
    const rows = relationEntry?.[direction];
    if (!Array.isArray(rows)) {
      continue;
    }
    for (const value of rows) {
      const row3 = objectValue(value);
      const relatedId = asString(
        direction === "incoming" ? row3?.from : row3?.to
      );
      const relationType = asString(row3?.type);
      const record4 = relatedId ? store.get(relatedId) : null;
      if (record4 && relationType) {
        relations2.push({ direction, relationType, record: record4 });
      }
    }
  }
  relations2.sort((left, right) => left.direction.localeCompare(right.direction) || left.relationType.localeCompare(right.relationType) || byLabel(left.record, right.record));
  return { notes, sources, relations: relations2 };
}
function shortModuleLabel(module2) {
  const code = asString(module2.code);
  if (code) {
    return code;
  }
  const title = asLabel(module2);
  const words2 = title.split(/\s+/).filter(Boolean);
  return words2.length > 2 ? words2.map((word) => word.charAt(0)).join("").toUpperCase() : title;
}
function orderColumns(modules, conceptsByModule) {
  return modules.filter((module2) => Boolean(asString(module2.id))).map((module2) => {
    const moduleId = asString(module2.id);
    return {
      moduleId,
      label: asLabel(module2),
      shortLabel: shortModuleLabel(module2),
      actionable: module2.is_actionable === true,
      conceptCount: conceptsByModule.get(moduleId) ?? 0
    };
  }).sort((left, right) => {
    if (left.actionable !== right.actionable) {
      return left.actionable ? -1 : 1;
    }
    return left.label.localeCompare(right.label);
  });
}
function buildCrossing(store) {
  const edges = store.moduleConceptEdges();
  const byConcept = /* @__PURE__ */ new Map();
  const conceptsByModule = /* @__PURE__ */ new Map();
  let totalEdges = 0;
  for (const edge of edges) {
    const { module_id: moduleId, concept_id: conceptId } = edge;
    if (!moduleId || !conceptId || !edge.evidence?.length) {
      continue;
    }
    totalEdges += 1;
    const cells = byConcept.get(conceptId) ?? /* @__PURE__ */ new Map();
    cells.set(moduleId, { moduleId, evidence: edge.evidence });
    byConcept.set(conceptId, cells);
    conceptsByModule.set(moduleId, (conceptsByModule.get(moduleId) ?? 0) + 1);
  }
  const columns = orderColumns(store.modules(), conceptsByModule);
  const visibleModules = new Set(
    columns.map((column) => column.moduleId)
  );
  const rows = [];
  for (const [conceptId, cells] of byConcept) {
    const visible = new Map(
      [...cells].filter(([moduleId]) => visibleModules.has(moduleId))
    );
    if (!visible.size) {
      continue;
    }
    const record4 = store.get(conceptId);
    rows.push({
      conceptId,
      label: record4 ? asLabel(record4) : conceptId,
      cells: visible,
      moduleCount: visible.size
    });
  }
  rows.sort(
    (left, right) => right.moduleCount - left.moduleCount || left.label.localeCompare(right.label)
  );
  return {
    columns,
    rows,
    sharedRows: rows.filter((row3) => row3.moduleCount > 1),
    totalConcepts: rows.length,
    totalEdges
  };
}

// src/views/atlas-view.ts
var AtlasView = class extends import_obsidian3.ItemView {
  plugin;
  scope = "shared";
  concept = null;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_ATLAS;
  }
  getDisplayText() {
    return "LearningOS \xB7 Atlas";
  }
  getIcon() {
    return "map";
  }
  async setState(state = {}) {
    if (typeof state.concept === "string" || state.concept === null) {
      this.concept = state.concept;
    }
    if (this.concept) {
      this.scope = "all";
    }
    this.render();
  }
  getState() {
    return {
      concept: this.concept
    };
  }
  async onOpen() {
    const concept = this.leaf.getViewState().state?.concept;
    this.concept = typeof concept === "string" ? concept : null;
    if (this.concept) {
      this.scope = "all";
    }
    this.render();
  }
  crossing() {
    return buildCrossing(this.plugin.store);
  }
  visibleRows(crossing) {
    return this.scope === "shared" ? crossing.sharedRows : crossing.rows;
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass(
      "los-root",
      "los-atlas-view"
    );
    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        "Reach",
        "Atlas unavailable"
      );
      empty(
        root,
        "The interface contract could not be loaded",
        this.plugin.store.error,
        "Rebuild views",
        () => this.plugin.generate()
      );
      return;
    }
    pageHeader(
      root,
      "Reach",
      "Module \xD7 Concept atlas",
      "Where one concept is taught in more than one module \u2014 and the exact stage in each that says so."
    );
    const crossing = this.crossing();
    if (!crossing.rows.length) {
      empty(
        root,
        "No concepts are mapped to modules yet",
        "A cell appears when a stage carries a concept tag, or a knowledge-map node carries a reviewed concept id. Nothing here is inferred, so an empty atlas means nothing is tagged \u2014 not that nothing overlaps."
      );
      this.fallbackAction(root);
      return;
    }
    filterTabs(
      root,
      "Which concepts to show",
      [
        ["shared", "Shared across modules"],
        ["all", "All concepts"]
      ],
      this.scope,
      (value) => {
        this.scope = value;
        this.render();
      },
      (value) => value === "shared" ? crossing.sharedRows.length : crossing.rows.length
    );
    const rows = this.visibleRows(crossing);
    if (!rows.length) {
      empty(
        root,
        "No concept is carried by more than one module",
        `${crossing.totalConcepts} concept(s) are mapped, each to a single module. Switch to All concepts to see them.`
      );
      this.fallbackAction(root);
      return;
    }
    this.renderGrid(root, crossing, rows);
    const selected = rows.find(
      (row3) => row3.conceptId === this.concept
    );
    if (selected) {
      this.renderConceptDetail(root, crossing, selected);
    }
    this.fallbackAction(root);
  }
  /**
   * Concepts are rows and modules are columns, because a learner reads down
   * the concept they are about to study and across to see who else wants it.
   * Below the responsive breakpoint the grid restacks into per-concept cards —
   * a horizontally scrolling table is unreadable on a narrow pane, and the
   * information is the same either way.
   */
  renderGrid(root, crossing, rows) {
    const wrap = root.createDiv({ cls: "los-crossing" });
    wrap.setAttrs({
      role: "group",
      "aria-label": "Concepts by module"
    });
    enableButtonGroupKeyboardNavigation(wrap, "both");
    wrap.style.setProperty(
      "--los-crossing-columns",
      String(crossing.columns.length)
    );
    const head = wrap.createDiv({ cls: "los-crossing-head" });
    head.createDiv({
      cls: "los-crossing-corner los-micro",
      text: "Concept"
    });
    for (const column of crossing.columns) {
      const cell = head.createDiv({ cls: "los-crossing-col" });
      cell.toggleClass("is-actionable", column.actionable);
      cell.createSpan({
        cls: "los-crossing-col-name",
        text: column.shortLabel
      });
      cell.createSpan({
        cls: "los-micro",
        text: `${column.conceptCount}`
      });
      cell.setAttrs({
        title: column.actionable ? `${column.label} \u2014 current` : column.label
      });
    }
    for (const row3 of rows) {
      const line = wrap.createDiv({ cls: "los-crossing-row" });
      line.toggleClass("is-selected", row3.conceptId === this.concept);
      const label = line.createEl("button", {
        cls: "los-crossing-concept is-clickable",
        attr: { type: "button" }
      });
      label.createSpan({
        cls: "los-crossing-concept-name",
        text: row3.label
      });
      label.createSpan({
        cls: "los-micro",
        text: row3.moduleCount > 1 ? `${row3.moduleCount} modules` : "1 module"
      });
      label.addEventListener("click", () => this.select(row3.conceptId));
      for (const column of crossing.columns) {
        const cell = row3.cells.get(column.moduleId);
        if (!cell) {
          const blank = line.createDiv({ cls: "los-crossing-cell is-empty" });
          blank.setAttrs({
            "aria-label": `${row3.label} is not mapped in ${column.label}`,
            "data-module-label": column.label
          });
          continue;
        }
        const filled = line.createEl("button", {
          cls: "los-crossing-cell is-filled is-clickable",
          attr: { type: "button" }
        });
        filled.createSpan({
          cls: "los-crossing-mark",
          text: String(cell.evidence.length)
        });
        filled.setAttrs({
          "aria-label": `${row3.label} in ${column.label}: ${cell.evidence.length} piece(s) of evidence`,
          title: `${column.label} \u2014 ${cell.evidence.length} piece(s) of evidence`,
          "data-module-label": column.label
        });
        filled.addEventListener("click", () => this.select(row3.conceptId));
      }
    }
  }
  /**
   * Secondary published context. These links explain where else the concept
   * can be opened; they never create or strengthen a Module x Concept edge.
   */
  renderPublishedContext(parent, conceptId, conceptLabel) {
    const context = buildConceptContext(this.plugin.store, conceptId);
    if (!context.notes.length && !context.sources.length && !context.relations.length) {
      return;
    }
    const wrap = parent.createDiv({ cls: "los-crossing-context" });
    if (context.notes.length) {
      const group = wrap.createDiv({ cls: "los-crossing-context-group" });
      group.createEl("h3", { text: "Linked notes" });
      for (const note of context.notes) {
        const item = group.createEl("button", {
          cls: "los-item is-clickable",
          attr: { type: "button" }
        });
        item.createDiv({ cls: "los-item-title", text: asLabel(note) });
        item.createDiv({ cls: "los-micro", text: "Explicit concept backlink" });
        item.addEventListener("click", () => this.plugin.nav.openRecord(note));
      }
    }
    if (context.sources.length) {
      const group = wrap.createDiv({ cls: "los-crossing-context-group" });
      group.createEl("h3", { text: "Source evaluations" });
      for (const source of context.sources) {
        const sourceId = asString(source.id);
        if (!sourceId) {
          continue;
        }
        const item = group.createEl("button", {
          cls: "los-item is-clickable",
          attr: { type: "button" }
        });
        item.createDiv({ cls: "los-item-title", text: asLabel(source) });
        item.createDiv({ cls: "los-micro", text: "Explicit evaluation concept" });
        item.addEventListener(
          "click",
          () => this.plugin.nav.openSourceDetail(sourceId)
        );
      }
    }
    if (context.relations.length) {
      const group = wrap.createDiv({ cls: "los-crossing-context-group" });
      group.createEl("h3", { text: "Concept relationships" });
      for (const relation of context.relations) {
        const relatedLabel = asLabel(relation.record);
        const relationLabel = relation.relationType.replaceAll("-", " ");
        const explanation = relation.direction === "outgoing" ? `${conceptLabel} ${relationLabel} ${relatedLabel}` : `${relatedLabel} ${relationLabel} ${conceptLabel}`;
        const item = group.createEl("button", {
          cls: "los-item is-clickable",
          attr: { type: "button" }
        });
        item.createDiv({ cls: "los-item-title", text: relatedLabel });
        item.createDiv({ cls: "los-micro", text: explanation });
        item.addEventListener(
          "click",
          () => this.plugin.nav.openRecord(relation.record)
        );
      }
    }
  }
  select(conceptId) {
    const selected = this.concept === conceptId ? null : conceptId;
    void this.plugin.nav.openAtlas(null, selected);
  }
  /**
   * The drill-down. Everything here is already published — stages, units, the
   * concept record itself — so this panel navigates rather than restating.
   */
  renderConceptDetail(root, crossing, row3) {
    const body = section(
      root,
      row3.label,
      row3.moduleCount > 1 ? `Taught in ${row3.moduleCount} modules. Each entry below is the authored tag that puts it there.` : "Taught in one module."
    );
    const record4 = this.plugin.store.get(row3.conceptId);
    if (record4) {
      const actions = body.createDiv({ cls: "los-actions" });
      button(
        actions,
        "Open concept",
        () => this.plugin.nav.openRecord(record4),
        "quiet"
      );
      this.renderAliases(body, record4);
    }
    for (const column of crossing.columns) {
      const cell = row3.cells.get(column.moduleId);
      if (!cell) {
        continue;
      }
      const group = body.createDiv({ cls: "los-crossing-evidence" });
      const header = group.createDiv({ cls: "los-crossing-evidence-head" });
      const moduleButton = header.createEl("button", {
        cls: "los-crossing-evidence-module is-clickable",
        attr: { type: "button" }
      });
      moduleButton.setText(column.label);
      moduleButton.addEventListener(
        "click",
        () => this.plugin.nav.openModule(column.moduleId)
      );
      if (column.actionable) {
        header.createSpan({ cls: "los-micro", text: "current" });
      }
      for (const evidence2 of cell.evidence) {
        this.renderEvidence(group, evidence2);
      }
    }
    this.renderPublishedContext(body, row3.conceptId, row3.label);
  }
  renderEvidence(parent, evidence2) {
    const unit = this.plugin.store.get(evidence2.unit_id);
    const unitLabel = unit ? asLabel(unit) : evidence2.unit_id;
    const openable = evidence2.kind === "stage-concept" ? () => this.plugin.nav.openUnit(evidence2.unit_id, evidence2.stage_id) : () => this.plugin.nav.openUnit(evidence2.unit_id);
    const item = parent.createEl("button", {
      cls: "los-item is-clickable",
      attr: { type: "button" }
    });
    item.addEventListener("click", openable);
    const copy = item.createDiv({ cls: "los-item-copy" });
    copy.createDiv({ cls: "los-item-title", text: unitLabel });
    if (evidence2.kind === "stage-concept") {
      const stage = this.plugin.store.get(evidence2.stage_id) ?? this.plugin.store.stage(evidence2.stage_id);
      copy.createDiv({
        cls: "los-micro",
        text: stage ? `Stage tag \xB7 ${asLabel(stage)}` : `Stage tag \xB7 ${evidence2.stage_id}`
      });
    } else {
      copy.createDiv({
        cls: "los-micro",
        text: `Reviewed knowledge-map node \xB7 ${evidence2.node_id}`
      });
    }
  }
  renderAliases(parent, record4) {
    const aliases = Array.isArray(record4.aliases) ? record4.aliases.map((value) => asString(value)).filter((value) => Boolean(value)) : [];
    if (!aliases.length) {
      return;
    }
    parent.createDiv({
      cls: "los-micro",
      text: `Also called: ${aliases.join(" \xB7 ")}`
    });
  }
  /**
   * The generated textual atlas stays reachable, and stays a fallback. It is
   * the human-operable copy (README, "without the operator"), not a second
   * primary surface — two atlases with no rule for which to open is the
   * confusion ADR-005 was written against.
   */
  fallbackAction(root) {
    const actions = root.createDiv({ cls: "los-actions" });
    button(
      actions,
      "Open generated domain map",
      () => this.plugin.openVaultPath("generated/domain-atlas.md"),
      "quiet"
    );
  }
};

// src/views/boundary-view.ts
var import_obsidian4 = require("obsidian");

// src/contracts/masters-planning.ts
var row2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
var text2 = (value) => typeof value === "string" && value.trim().length > 0;
var date2 = (value) => {
  if (typeof value !== "string") return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const parsed = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.getUTCFullYear() === Number(match[1]) && parsed.getUTCMonth() + 1 === Number(match[2]) && parsed.getUTCDate() === Number(match[3]);
};
var dateTime2 = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
var natural3 = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0;
var id = (value, prefix) => typeof value === "string" && new RegExp(`^${prefix}[a-z0-9]+(?:-[a-z0-9]+)*$`).test(value);
function exact2(value, required, optional2 = []) {
  const allowed = /* @__PURE__ */ new Set([...required, ...optional2]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) && Object.keys(value).every((key) => allowed.has(key));
}
function stringList(value, pattern = text2, unique = false) {
  return Array.isArray(value) && value.every(pattern) && (!unique || new Set(value).size === value.length);
}
var planningStates = [
  "longlist",
  "shortlist",
  "selected",
  "rejected",
  "promoted"
];
var factStatuses = [
  "unverified",
  "verified-current",
  "stale",
  "conflicting"
];
var reviewStatuses = [
  "deep-reviewed",
  "screened",
  "unevaluated",
  "unavailable"
];
var sourceRoles = [
  "selected",
  "current",
  "prerequisite",
  "comparison"
];
var relations = [
  "duplicates",
  "overlaps",
  "complements",
  "extends",
  "contrasts",
  "alternate-notation"
];
var sha2562 = (value) => typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
function evidence(value) {
  const source = row2(value);
  if (!source || !exact2(source, ["locator", "checksum"], ["note"]) || !text2(source.locator) || !sha2562(source.checksum) || "note" in source && !text2(source.note)) return null;
  return {
    locator: source.locator,
    checksum: source.checksum,
    ..."note" in source ? { note: source.note } : {}
  };
}
function factState(value) {
  const state = row2(value);
  if (!state || !exact2(state, ["status", "as_of", "evidence"]) || !factStatuses.includes(state.status) || !(state.as_of === null || date2(state.as_of)) || !stringList(state.evidence)) return null;
  return {
    status: state.status,
    as_of: state.as_of,
    evidence: state.evidence
  };
}
function catalog(value) {
  const source = row2(value);
  if (!source || !exact2(source, [
    "schema_version",
    "id",
    "type",
    "revision",
    "updated_at",
    "candidate_modules",
    "candidate_sources",
    "comparison_ids"
  ]) || source.schema_version !== 1 || source.id !== "master-planning-catalog" || source.type !== "master-planning-catalog" || !natural3(source.revision) || !dateTime2(source.updated_at) || !Array.isArray(source.candidate_modules) || !Array.isArray(source.candidate_sources) || !stringList(
    source.comparison_ids,
    (item) => id(item, "candidate-comparison-"),
    true
  )) return null;
  const modules = [];
  for (const valueModule of source.candidate_modules) {
    const module2 = row2(valueModule);
    const facts = factState(module2?.fact_state);
    if (!module2 || !exact2(module2, [
      "id",
      "title",
      "planning_state",
      "privacy_class",
      "provenance",
      "fact_state",
      "source_ids",
      "unresolved_references"
    ], ["promoted_module_id"]) || !id(module2.id, "candidate-module-") || !text2(module2.title) || !planningStates.includes(module2.planning_state) || module2.privacy_class !== "academic-only" || !stringList(module2.provenance) || module2.provenance.length === 0 || !facts || !stringList(
      module2.source_ids,
      (item) => id(item, "candidate-source-"),
      true
    ) || !stringList(module2.unresolved_references, text2, true) || "promoted_module_id" in module2 && !id(module2.promoted_module_id, "module-")) return null;
    modules.push({
      id: module2.id,
      title: module2.title,
      planning_state: module2.planning_state,
      privacy_class: "academic-only",
      provenance: module2.provenance,
      fact_state: facts,
      source_ids: module2.source_ids,
      unresolved_references: module2.unresolved_references,
      ..."promoted_module_id" in module2 ? { promoted_module_id: module2.promoted_module_id } : {}
    });
  }
  const sources = [];
  for (const valueCandidate of source.candidate_sources) {
    const candidate = row2(valueCandidate);
    const facts = factState(candidate?.fact_state);
    if (!candidate || !exact2(candidate, [
      "id",
      "title",
      "planning_state",
      "privacy_class",
      "provenance",
      "fact_state"
    ], ["canonical_source_id"]) || !id(candidate.id, "candidate-source-") || !text2(candidate.title) || !planningStates.includes(candidate.planning_state) || candidate.privacy_class !== "academic-only" || !stringList(candidate.provenance) || candidate.provenance.length === 0 || !facts || "canonical_source_id" in candidate && !id(candidate.canonical_source_id, "source-")) return null;
    sources.push({
      id: candidate.id,
      title: candidate.title,
      planning_state: candidate.planning_state,
      privacy_class: "academic-only",
      provenance: candidate.provenance,
      fact_state: facts,
      ..."canonical_source_id" in candidate ? { canonical_source_id: candidate.canonical_source_id } : {}
    });
  }
  return {
    schema_version: 1,
    id: "master-planning-catalog",
    type: "master-planning-catalog",
    revision: source.revision,
    updated_at: source.updated_at,
    candidate_modules: modules,
    candidate_sources: sources,
    comparison_ids: source.comparison_ids
  };
}
function assessment(value) {
  const source = row2(value);
  if (!source || !exact2(source, ["candidate_source_id", "role", "review_status", "concept_ids"], [
    "contribution",
    "assumptions",
    "notation",
    "exercise_value",
    "best_for",
    "limitations",
    "reason",
    "evidence"
  ]) || !id(source.candidate_source_id, "candidate-source-") || !sourceRoles.includes(source.role) || !reviewStatuses.includes(source.review_status) || !stringList(
    source.concept_ids,
    (item) => id(item, "concept-"),
    true
  )) return null;
  const deep = source.review_status === "deep-reviewed";
  const deepFields = ["contribution", "assumptions", "notation", "exercise_value", "best_for", "limitations"];
  if (deep !== deepFields.every((key) => text2(source[key]))) return null;
  if ("reason" in source && !text2(source.reason)) return null;
  if (!deep && !text2(source.reason)) return null;
  if (deepFields.some((key) => key in source) && !deep) return null;
  if (source.role !== "comparison" && !deep) return null;
  if ("evidence" in source && (!Array.isArray(source.evidence) || source.evidence.some((item) => evidence(item) === null))) return null;
  if (deep && (!Array.isArray(source.evidence) || source.evidence.length === 0)) return null;
  return source;
}
function comparison(value, parsedCatalog, knownConceptIds) {
  const source = row2(value);
  if (!source || !exact2(source, [
    "schema_version",
    "id",
    "type",
    "candidate_module_id",
    "status",
    "basis",
    "source_assessments",
    "comparisons"
  ]) || source.schema_version !== 1 || !id(source.id, "candidate-comparison-") || source.type !== "candidate-source-comparison" || !id(source.candidate_module_id, "candidate-module-") || source.status !== "approved" || !Array.isArray(source.source_assessments) || !Array.isArray(source.comparisons)) return null;
  const basis = row2(source.basis);
  if (!basis || !exact2(basis, [
    "catalog_revision",
    "candidate_set_checksum",
    "policy",
    "request_id",
    "delivery_id"
  ]) || !natural3(basis.catalog_revision) || !sha2562(basis.candidate_set_checksum) || basis.policy !== "tiered-v1" || !text2(basis.request_id) || !text2(basis.delivery_id)) return null;
  const assessments = source.source_assessments.map(assessment);
  if (assessments.some((item) => item === null) || assessments.length === 0) return null;
  if (!assessments.some((item) => item?.role === "selected")) return null;
  const module2 = parsedCatalog.candidate_modules.find(
    (item) => item.id === source.candidate_module_id
  );
  if (!module2) return null;
  const catalogSourceIds = new Set(parsedCatalog.candidate_sources.map((item) => item.id));
  const assessedById = /* @__PURE__ */ new Map();
  for (const item of assessments) {
    if (assessedById.has(item.candidate_source_id) || !catalogSourceIds.has(item.candidate_source_id) || item.concept_ids.some((conceptId) => !knownConceptIds.has(conceptId))) return null;
    assessedById.set(item.candidate_source_id, item);
  }
  const expectedSourceIds = new Set(module2.source_ids);
  if (assessedById.size !== expectedSourceIds.size || [...assessedById.keys()].some((sourceId) => !expectedSourceIds.has(sourceId))) return null;
  const comparisons = [];
  const seenComparisons = /* @__PURE__ */ new Set();
  for (const valuePair of source.comparisons) {
    const pair = row2(valuePair);
    if (!pair || !exact2(pair, [
      "left_candidate_source_id",
      "right_candidate_source_id",
      "relation",
      "narrative",
      "concept_ids",
      "evidence"
    ]) || !id(pair.left_candidate_source_id, "candidate-source-") || !id(pair.right_candidate_source_id, "candidate-source-") || pair.left_candidate_source_id === pair.right_candidate_source_id || !relations.includes(pair.relation) || !text2(pair.narrative) || !stringList(
      pair.concept_ids,
      (item) => id(item, "concept-"),
      true
    ) || pair.concept_ids.length === 0 || pair.concept_ids.some((conceptId) => !knownConceptIds.has(conceptId))) return null;
    const left = assessedById.get(pair.left_candidate_source_id);
    const right = assessedById.get(pair.right_candidate_source_id);
    if (left?.review_status !== "deep-reviewed" || right?.review_status !== "deep-reviewed") {
      return null;
    }
    const pairKey = [
      ...[pair.left_candidate_source_id, pair.right_candidate_source_id].sort(),
      pair.relation
    ].join("\0");
    if (seenComparisons.has(pairKey)) return null;
    seenComparisons.add(pairKey);
    const evidenceSides = row2(pair.evidence);
    if (!evidenceSides || !exact2(evidenceSides, ["left", "right"]) || !Array.isArray(evidenceSides.left) || evidenceSides.left.length === 0 || !Array.isArray(evidenceSides.right) || evidenceSides.right.length === 0) return null;
    const leftEvidence = evidenceSides.left.map(evidence);
    const rightEvidence = evidenceSides.right.map(evidence);
    if (leftEvidence.some((item) => item === null) || rightEvidence.some((item) => item === null)) return null;
    comparisons.push({
      left_candidate_source_id: pair.left_candidate_source_id,
      right_candidate_source_id: pair.right_candidate_source_id,
      relation: pair.relation,
      narrative: pair.narrative,
      concept_ids: pair.concept_ids,
      evidence: {
        left: leftEvidence,
        right: rightEvidence
      }
    });
  }
  return {
    schema_version: 1,
    id: source.id,
    type: "candidate-source-comparison",
    candidate_module_id: source.candidate_module_id,
    status: "approved",
    basis: {
      catalog_revision: basis.catalog_revision,
      candidate_set_checksum: basis.candidate_set_checksum,
      policy: "tiered-v1",
      request_id: basis.request_id,
      delivery_id: basis.delivery_id
    },
    source_assessments: assessments,
    comparisons
  };
}
function asMastersPlanningDashboard(value, knownConceptIds = /* @__PURE__ */ new Set()) {
  const dashboard = row2(value);
  if (!dashboard || !exact2(dashboard, [
    "schema_version",
    "type",
    "opened_at",
    "banner",
    "catalog",
    "comparisons",
    "isolation"
  ]) || dashboard.schema_version !== 1 || dashboard.type !== "masters-planning-dashboard" || !dateTime2(dashboard.opened_at) || dashboard.banner !== "Prospective\u2014not current LearningOS" || !Array.isArray(dashboard.comparisons)) return null;
  const parsedCatalog = dashboard.catalog === null ? null : catalog(dashboard.catalog);
  if (dashboard.catalog !== null && parsedCatalog === null) return null;
  if (!parsedCatalog && dashboard.comparisons.length > 0) return null;
  const comparisons = parsedCatalog ? dashboard.comparisons.map((item) => comparison(item, parsedCatalog, knownConceptIds)) : [];
  if (comparisons.some((item) => item === null)) return null;
  const isolation = row2(dashboard.isolation);
  const isolationKeys = [
    "normal_manifest",
    "search",
    "workload",
    "recommendations",
    "deadlines",
    "ordinary_ai_context"
  ];
  if (!isolation || !exact2(isolation, isolationKeys) || isolationKeys.some((key) => isolation[key] !== false)) return null;
  return {
    schema_version: 1,
    type: "masters-planning-dashboard",
    opened_at: dashboard.opened_at,
    banner: "Prospective\u2014not current LearningOS",
    catalog: parsedCatalog,
    comparisons,
    isolation: {
      normal_manifest: false,
      search: false,
      workload: false,
      recommendations: false,
      deadlines: false,
      ordinary_ai_context: false
    }
  };
}

// src/views/boundary-view.ts
var BoundaryView = class extends import_obsidian4.ItemView {
  plugin;
  boundaryId = null;
  mastersDashboard = null;
  mastersLoading = false;
  mastersError = "";
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_BOUNDARY;
  }
  getDisplayText() {
    return "LearningOS \xB7 Boundary";
  }
  async setState(state = {}) {
    if (typeof state.boundaryId === "string") {
      if (state.boundaryId !== this.boundaryId) {
        this.mastersDashboard = null;
        this.mastersError = "";
      }
      this.boundaryId = state.boundaryId;
    }
    this.render();
  }
  getState() {
    return { boundaryId: this.boundaryId };
  }
  async onOpen() {
    const state = this.leaf.getViewState().state;
    const boundaryId = state?.boundaryId;
    if (typeof boundaryId === "string") {
      this.boundaryId = boundaryId;
    }
    this.render();
  }
  async loadMastersPlanning() {
    if (this.mastersLoading || this.mastersDashboard || this.boundaryId !== "program-masters-planning") return;
    this.mastersLoading = true;
    this.mastersError = "";
    this.render();
    try {
      const result = await this.plugin.gateway.mastersPlanningDashboard();
      const knownConceptIds = new Set(
        this.plugin.store.of("concept").flatMap((concept) => typeof concept.id === "string" ? [concept.id] : [])
      );
      const dashboard = asMastersPlanningDashboard(result, knownConceptIds);
      if (!dashboard) {
        throw new Error("LearningOS refused an invalid Future Master's Planning response.");
      }
      this.mastersDashboard = dashboard;
    } catch (error) {
      this.mastersError = error instanceof Error ? error.message : String(error);
    } finally {
      this.mastersLoading = false;
      this.render();
    }
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-boundary-view");
    if (this.boundaryId === "program-masters-planning") {
      this.renderMastersPlanning(root);
      return;
    }
    empty(root, "Boundary unavailable", "This destination is not a declared explicit boundary surface.");
  }
  renderMastersPlanning(root) {
    root.addClass("los-masters-planning");
    pageHeader(
      root,
      "Future Master's Planning \xB7 isolated",
      "Future Master's Planning",
      "A deliberate academic planning workspace, separate from current LearningOS."
    );
    const banner = root.createDiv({
      cls: "los-prospective-banner",
      attr: { role: "status" }
    });
    banner.createEl("strong", { text: "Prospective\u2014not current LearningOS" });
    banner.createDiv({
      cls: "los-micro",
      text: "Candidates here do not enter the normal manifest, search, workload, recommendations, deadlines, or ordinary AI context."
    });
    if (this.mastersLoading) {
      empty(root, "Opening prospective planning", "Reading only the sanitized academic planning dashboard.");
      return;
    }
    if (this.mastersError) {
      empty(
        root,
        "Future Master's Planning unavailable",
        this.mastersError,
        "Try again",
        () => void this.loadMastersPlanning()
      );
      return;
    }
    if (!this.mastersDashboard) {
      empty(
        root,
        "Prospective catalog is sealed",
        "Open it only for a deliberate planning session. The response is read-only and schema-bounded.",
        "Open prospective planning",
        () => void this.loadMastersPlanning()
      );
      return;
    }
    const catalog2 = this.mastersDashboard.catalog;
    if (!catalog2) {
      empty(root, "No prospective catalog", "Core returned the isolated dashboard without a catalog.");
      return;
    }
    const summary = section(
      root,
      "Prospective catalog",
      `Revision ${catalog2.revision} \xB7 updated ${catalog2.updated_at}`
    );
    const counts = summary.createDiv({ cls: "los-masters-counts" });
    counts.createSpan({ text: `${catalog2.candidate_modules.length} candidate modules` });
    counts.createSpan({ text: `${catalog2.candidate_sources.length} candidate sources` });
    counts.createSpan({ text: `${this.mastersDashboard.comparisons.length} approved comparisons` });
    const modules = section(root, "Candidate modules");
    if (!catalog2.candidate_modules.length) {
      modules.createDiv({ cls: "los-micro", text: "No candidate modules in this revision." });
    }
    for (const module2 of catalog2.candidate_modules) {
      const row3 = modules.createDiv({ cls: "los-masters-row" });
      const heading = row3.createDiv({ cls: "los-masters-row-head" });
      heading.createEl("strong", { text: module2.title });
      badge(heading, module2.planning_state, "role");
      badge(
        heading,
        module2.fact_state.status.replaceAll("-", " "),
        module2.fact_state.status === "verified-current" ? "status" : "role"
      );
      if (module2.fact_state.as_of) {
        row3.createDiv({ cls: "los-micro", text: `Facts checked as of ${module2.fact_state.as_of}` });
      }
      if (module2.unresolved_references.length) {
        row3.createDiv({
          cls: "los-micro",
          text: `${module2.unresolved_references.length} unresolved reference${module2.unresolved_references.length === 1 ? "" : "s"}`
        });
      }
    }
    const sources = section(root, "Candidate sources");
    if (!catalog2.candidate_sources.length) {
      sources.createDiv({ cls: "los-micro", text: "No candidate sources in this revision." });
    }
    for (const source of catalog2.candidate_sources) {
      const row3 = sources.createDiv({ cls: "los-masters-row" });
      const heading = row3.createDiv({ cls: "los-masters-row-head" });
      heading.createEl("strong", { text: source.title });
      badge(heading, source.planning_state, "role");
      badge(
        heading,
        source.fact_state.status.replaceAll("-", " "),
        source.fact_state.status === "verified-current" ? "status" : "role"
      );
    }
    const assessments = this.mastersDashboard.comparisons.flatMap((comparison2) => comparison2.source_assessments);
    if (assessments.length) {
      const reviewed = section(root, "Approved source assessments");
      const sourceTitle = new Map(catalog2.candidate_sources.map((source) => [source.id, source.title]));
      for (const assessment2 of assessments) {
        const row3 = reviewed.createDiv({ cls: "los-masters-row" });
        const heading = row3.createDiv({ cls: "los-masters-row-head" });
        heading.createEl("strong", {
          text: sourceTitle.get(assessment2.candidate_source_id) || assessment2.candidate_source_id
        });
        badge(heading, assessment2.role, assessment2.role === "selected" ? "status" : "role");
        badge(
          heading,
          assessment2.review_status.replaceAll("-", " "),
          assessment2.review_status === "deep-reviewed" ? "status" : "role"
        );
        const summary2 = assessment2.contribution || assessment2.reason;
        if (summary2) row3.createEl("p", { text: summary2 });
        if (assessment2.concept_ids.length) {
          row3.createDiv({
            cls: "los-micro",
            text: `Concepts: ${assessment2.concept_ids.join(", ")}`
          });
        }
      }
    }
    const pairs = this.mastersDashboard.comparisons.flatMap((comparison2) => comparison2.comparisons);
    if (pairs.length) {
      const comparisons = section(root, "Approved source comparisons");
      const sourceTitle = new Map(catalog2.candidate_sources.map((source) => [source.id, source.title]));
      for (const pair of pairs) {
        const row3 = comparisons.createDiv({ cls: "los-masters-row" });
        const heading = row3.createDiv({ cls: "los-masters-row-head" });
        heading.createEl("strong", {
          text: `${sourceTitle.get(pair.left_candidate_source_id) || pair.left_candidate_source_id} \u2194 ${sourceTitle.get(pair.right_candidate_source_id) || pair.right_candidate_source_id}`
        });
        badge(heading, pair.relation.replaceAll("-", " "), "role");
        row3.createEl("p", { text: pair.narrative });
        row3.createDiv({
          cls: "los-micro",
          text: `Concepts: ${pair.concept_ids.join(", ")}`
        });
        const evidence2 = row3.createDiv({ cls: "los-masters-evidence" });
        const leftTitle = sourceTitle.get(pair.left_candidate_source_id) || pair.left_candidate_source_id;
        const rightTitle = sourceTitle.get(pair.right_candidate_source_id) || pair.right_candidate_source_id;
        for (const [side, title] of [
          [pair.evidence.left, leftTitle],
          [pair.evidence.right, rightTitle]
        ]) {
          const list2 = evidence2.createDiv({ cls: "los-masters-evidence-side" });
          list2.createEl("strong", { text: `${title} evidence` });
          for (const item of side) {
            list2.createDiv({
              cls: "los-micro",
              text: item.note ? `${item.locator} \u2014 ${item.note}` : item.locator
            });
          }
        }
      }
    }
  }
};

// src/views/garden-view.ts
var import_obsidian6 = require("obsidian");

// src/features/ai-actions/action-button.ts
var import_obsidian5 = require("obsidian");
function renderGardenShelveAction(parent, plugin, target, onChanged = null) {
  const wrap = parent.createDiv({ cls: "los-ai-action-row" });
  const providers = plugin.aiActions.providers();
  const available = providers.filter(
    (row3) => Boolean(row3.available)
  );
  let provider = available.some(
    (row3) => row3.id === plugin.settings.preferredAiProvider
  ) ? plugin.settings.preferredAiProvider : available[0]?.id || "manual-bundle";
  if (provider !== plugin.settings.preferredAiProvider) {
    plugin.settings.preferredAiProvider = provider;
    plugin.scheduleDraftSave();
  }
  const targetId = target.id;
  const launch = button(wrap, "Refine with AI", async () => {
    if (!targetId) {
      new import_obsidian5.Notice("This Garden item has no projected identity. Refresh LearningOS and try again.");
      return;
    }
    launch.setAttr("disabled", "disabled");
    launch.setText("Preparing\u2026");
    try {
      const result = await plugin.aiActions.prepareGardenShelving(
        targetId,
        provider
      );
      const bundlePath = result.bundle_path || result.request?.bundle_path;
      new import_obsidian5.Notice(bundlePath ? `AI request prepared: ${bundlePath}` : "AI request prepared.");
      onChanged?.(result);
    } catch (error) {
      new import_obsidian5.Notice(errorMessage(error));
      launch.removeAttribute?.("disabled");
      launch.setText("Refine with AI");
    }
  }, "warm");
  launch.addClass("los-ai-action-button");
  if (!available.length) launch.setAttr("disabled", "disabled");
  return wrap;
}

// src/views/garden-view.ts
var GARDEN_FILTERS = [
  ["all", "All"],
  ["seed", "Growing"],
  ["review-due", "Review due"],
  ["harvest-candidate", "Candidates"]
];
var GardenView = class extends import_obsidian6.ItemView {
  plugin;
  seedTitle = "";
  seedText = "";
  planting = false;
  filter = "all";
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_GARDEN;
  }
  getDisplayText() {
    return "LearningOS \xB7 Garden";
  }
  getIcon() {
    return "sprout";
  }
  async onOpen() {
    this.render();
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass(
      "los-root",
      "los-garden-view"
    );
    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        "Garden",
        "Garden unavailable"
      );
      empty(
        root,
        "The interface contract could not be loaded",
        this.plugin.store.error,
        "Rebuild views",
        () => this.plugin.generate()
      );
      return;
    }
    pageHeader(
      root,
      "Garden \xB7 Incubation",
      "Garden",
      "Ideas can stay messy here until you know what they want to become."
    );
    this.renderComposer(root);
    const entries = this.plugin.store.gardenEntries();
    filterTabs(
      root,
      "Garden filters",
      GARDEN_FILTERS,
      this.filter,
      (value) => {
        this.filter = value;
        this.render();
      },
      (value) => value === "all" ? entries.length : entries.filter(
        (entry) => String(entry.state || "seed") === value
      ).length
    );
    const listHeader = root.createDiv({
      cls: "los-garden-list-header"
    });
    listHeader.createEl("h2", {
      text: "Growing ideas"
    });
    listHeader.createSpan({
      cls: "los-micro",
      text: "Review eligibility is projected by Core"
    });
    const visible = this.filter === "all" ? entries : entries.filter(
      (entry) => String(entry.state || "seed") === this.filter
    );
    if (!visible.length) {
      empty(
        root,
        entries.length ? "Nothing in this view" : "No Garden seeds yet",
        entries.length ? "Choose another Garden filter." : "Plant one above. A seed needs no module, topic, destination, or AI."
      );
    } else {
      const list2 = root.createDiv({
        cls: "los-garden-list"
      });
      for (const target of visible) {
        this.card(list2, target);
      }
    }
    const tools = disclosure(
      root,
      "Garden tools",
      "los-utility-disclosure"
    );
    button(
      tools,
      "Open Garden base",
      () => this.plugin.openVaultPath(
        "bases/garden.base"
      ),
      "info"
    );
    button(
      tools,
      "Refresh projection",
      () => this.plugin.generate(),
      "quiet"
    );
  }
  renderComposer(root) {
    const composer = root.createDiv({
      cls: "los-garden-seed-composer"
    });
    composer.createEl("h2", {
      text: "Plant something\u2026"
    });
    composer.createEl("p", {
      cls: "los-muted",
      text: "A thought, question, fragment, or connection. No filing required. No AI required."
    });
    const editor = composer.createEl(
      "textarea",
      {
        cls: "los-garden-seed-editor",
        attr: {
          rows: "2",
          placeholder: "What keeps returning to your mind?",
          "aria-label": "Garden seed text"
        }
      }
    );
    editor.value = this.seedText;
    editor.addEventListener(
      "input",
      () => {
        this.seedText = editor.value;
        syncAddState();
      }
    );
    const actions = composer.createDiv({
      cls: "los-actions los-garden-composer-actions"
    });
    const title = actions.createEl(
      "input",
      {
        cls: "los-garden-seed-title",
        attr: {
          type: "text",
          placeholder: "Title optional",
          "aria-label": "Optional Garden seed title"
        }
      }
    );
    title.value = this.seedTitle;
    title.addEventListener(
      "input",
      () => {
        this.seedTitle = title.value;
        syncAddState();
      }
    );
    const add = button(
      actions,
      this.planting ? "Adding\u2026" : "Add seed",
      () => {
        void this.plantSeed();
      },
      "cta"
    );
    const syncAddState = () => {
      add.disabled = this.planting || !this.seedText.trim();
      add.setAttribute(
        "aria-disabled",
        String(add.disabled)
      );
    };
    syncAddState();
  }
  async plantSeed() {
    if (this.planting) {
      return;
    }
    const text5 = this.seedText;
    const title = this.seedTitle.trim();
    if (!text5.trim()) {
      new import_obsidian6.Notice(
        "Write something before adding the seed."
      );
      return;
    }
    this.planting = true;
    this.render();
    try {
      await this.plugin.mutate(
        () => this.plugin.gateway.createGardenSeed(
          text5,
          title
        )
      );
      this.seedTitle = "";
      this.seedText = "";
      new import_obsidian6.Notice("Garden seed added.");
    } catch (error) {
      new import_obsidian6.Notice(errorMessage(error));
    } finally {
      this.planting = false;
      this.render();
    }
  }
  card(parent, target) {
    const targetId = asString(target.id);
    const targetState = asString(target.state) || "seed";
    const targetPath = asString(target.path);
    const card = parent.createDiv({
      cls: `los-card los-garden-card los-garden-${targetState}`
    });
    const top = card.createDiv({
      cls: "los-card-top"
    });
    top.createEl("h2", {
      text: asLabel(target, "Garden seed")
    });
    badge(
      top,
      targetState,
      targetState
    );
    card.createDiv({
      cls: "los-micro",
      text: targetPath || "Path unavailable"
    });
    if (target.tags?.length) {
      const tags = card.createDiv({
        cls: "los-garden-tags"
      });
      for (const tag of target.tags) {
        badge(
          tags,
          `#${tag}`,
          "role"
        );
      }
    }
    const latest = targetId ? this.plugin.store.latestAiRequest(targetId) : null;
    if (latest) {
      const bundlePath = asString(latest.bundle_path);
      const status = card.createDiv({
        cls: "los-ai-request-status"
      });
      status.createEl("strong", {
        text: `AI request \xB7 ${latest.status}`
      });
      status.createDiv({
        cls: "los-micro",
        text: `${latest.provider || "manual-bundle"} \xB7 ${latest.id}`
      });
      if (bundlePath) {
        status.createDiv({
          cls: "los-micro",
          text: bundlePath
        });
      }
      const statusActions = status.createDiv({
        cls: "los-actions"
      });
      if (bundlePath) {
        button(
          statusActions,
          "Copy bundle path",
          () => this.plugin.copyText(
            bundlePath
          ),
          "quiet"
        );
      }
      if (latest.delivery_id && latest.status !== "applied") {
        const deliveryId = latest.delivery_id;
        button(
          statusActions,
          "Apply approved delivery",
          async () => {
            try {
              await this.plugin.aiActions.applyApprovedDelivery(
                deliveryId
              );
              new import_obsidian6.Notice(
                "Approved AI delivery applied and projection refreshed."
              );
              this.render();
            } catch (error) {
              new import_obsidian6.Notice(
                errorMessage(error)
              );
            }
          },
          "success"
        );
      }
      if (latest.receipt_id) {
        badge(
          status,
          `receipt ${latest.receipt_id}`,
          "complete"
        );
      }
    }
    const actions = card.createDiv({
      cls: "los-garden-actions"
    });
    if (targetPath) {
      button(actions, "Open original", () => this.plugin.openVaultPath(targetPath), "info");
    }
    if (target.transcription_path) {
      const transcriptionPath = target.transcription_path;
      button(
        actions,
        "Open AI transcription",
        () => this.plugin.openVaultPath(
          transcriptionPath
        ),
        "info"
      );
    }
    if (targetId) {
      renderGardenShelveAction(actions, this.plugin, target, () => this.render());
    }
    return card;
  }
};

// src/features/home/model.ts
function readResumePointer(value) {
  if (!isRecord2(value)) {
    return {};
  }
  return {
    unit_id: asString(value.unit_id) ?? void 0,
    study_map_id: asString(value.study_map_id) ?? void 0,
    stage_id: asString(value.stage_id) ?? void 0,
    module_id: asString(value.module_id) ?? void 0
  };
}
function firstProjectedModuleId(value) {
  for (const candidate of asRecords(value)) {
    const moduleId = asString(candidate.module_id);
    if (moduleId) {
      return moduleId;
    }
  }
  return null;
}

// src/features/home/elsewhere.ts
function renderElsewhere(view, root) {
  const sectionEl = section(
    root,
    "Continue elsewhere",
    "Other active modules and projects, kept secondary to the current session."
  );
  const pointer = readResumePointer(
    view.plugin.store.data?.resume_pointer
  );
  const rows = [];
  for (const record4 of view.plugin.store.currentSemesterModules()) {
    const recordId = asString(record4.id);
    if (!recordId || recordId === pointer.module_id) {
      continue;
    }
    if (record4.is_actionable !== true) {
      continue;
    }
    rows.push({
      record: record4,
      type: asString(record4.kind) === "skill" ? "Skill" : "Module",
      open: () => view.plugin.nav.openModule(
        recordId
      )
    });
  }
  for (const record4 of view.plugin.store.projects()) {
    const recordId = asString(record4.id);
    if (!recordId) {
      continue;
    }
    const status = asString(record4.status);
    if (status && ["completed", "archived"].includes(status)) {
      continue;
    }
    rows.push({
      record: record4,
      type: "Project",
      open: () => view.plugin.nav.openProject(
        recordId
      )
    });
  }
  const visibleRows = rows.slice(0, 5);
  if (!visibleRows.length) {
    empty(
      sectionEl,
      "No other active work",
      "New modules and projects will appear here when projected."
    );
    return;
  }
  const list2 = sectionEl.createDiv({
    cls: "los-home-list"
  });
  for (const row3 of visibleRows) {
    const nextAction = row3.type === "Project" ? "" : view.moduleNextAction(
      row3.record
    );
    view.renderHomeRow(
      list2,
      {
        title: asLabel(
          row3.record
        ),
        detail: `${row3.type}${nextAction ? ` \xB7 ${nextAction}` : ""}`,
        actionLabel: "Open",
        action: row3.open
      }
    );
  }
}
function renderHomeRow(parent, item) {
  const row3 = parent.createDiv({
    cls: "los-home-row"
  });
  const copy = row3.createDiv({
    cls: "los-home-row-copy"
  });
  copy.createEl("strong", {
    text: item.title
  });
  if (item.detail) {
    copy.createDiv({
      cls: "los-micro",
      text: item.detail
    });
  }
  if (item.actionLabel && item.action) {
    button(
      row3,
      item.actionLabel,
      item.action,
      "tertiary"
    );
  }
  return row3;
}
function nextWorkspaceDate(view, workspace) {
  const directDeadline = asString(workspace.deadline);
  if (directDeadline) {
    return directDeadline;
  }
  const moduleIds = new Set(
    asStrings(
      workspace.module_ids
    )
  );
  const dates = [];
  for (const row3 of view.plugin.store.rows(
    "academic_deadlines"
  )) {
    const kind = asString(row3.kind);
    const moduleId = asString(row3.module_id);
    const startDate = asString(row3.start_date);
    if (kind === "exam" && moduleId && startDate && moduleIds.has(moduleId)) {
      dates.push(startDate);
    }
    if (kind === "registration-window" && startDate && asRecords(
      row3.modules
    ).some(
      (module2) => {
        const nestedModuleId = asString(
          module2.module_id
        );
        return Boolean(nestedModuleId) && moduleIds.has(
          nestedModuleId
        );
      }
    )) {
      dates.push(startDate);
    }
  }
  return dates.sort()[0] ?? "9999";
}
function moduleNextAction(view, module2) {
  const moduleId = asString(module2.id);
  if (!moduleId) {
    return "";
  }
  const workspace = view.plugin.store.of("workspace").filter(
    (row3) => {
      const status = asString(row3.status);
      return row3.archived !== true && status !== "complete" && asStrings(
        row3.module_ids
      ).includes(moduleId);
    }
  ).sort(
    (left, right) => view.nextWorkspaceDate(left).localeCompare(
      view.nextWorkspaceDate(
        right
      )
    )
  )[0];
  if (workspace?.next_action) {
    return projectedExcerpt(
      workspace.next_action,
      100
    );
  }
  for (const unit of view.plugin.store.unitsFor(moduleId)) {
    const unitId = asString(unit.id);
    if (!unitId) {
      continue;
    }
    const map = view.plugin.store.mapForUnit(
      unitId
    );
    if (!map) {
      continue;
    }
    const stages = asRecords(map.stages);
    const currentStageId = asString(
      map.current_stage
    );
    const stage = (currentStageId ? stages.find(
      (row3) => asString(row3.id) === currentStageId
    ) : void 0) ?? stages.find(
      (row3) => asString(row3.status) === "active"
    ) ?? stages.find(
      (row3) => asString(row3.status) !== "complete"
    );
    const stageTitle = stage ? asString(stage.title) : null;
    if (stageTitle) {
      return stageTitle;
    }
  }
  return "";
}

// src/features/home/focus.ts
function renderContinue(view, root) {
  const pointer = readResumePointer(
    view.plugin.store.data?.resume_pointer
  );
  const unit = pointer.unit_id ? view.plugin.store.get(pointer.unit_id) : null;
  const map = pointer.study_map_id ? view.plugin.store.get(
    pointer.study_map_id
  ) : null;
  const stage = pointer.stage_id ? view.plugin.store.stage(
    pointer.stage_id
  ) : null;
  const wrap = root.createDiv({
    cls: "los-continue"
  });
  if (!unit || !stage || !pointer.unit_id || !pointer.stage_id) {
    empty(
      wrap,
      "Nothing to resume yet",
      "Open Learn and choose a module or project.",
      "Open Learn",
      () => view.plugin.nav.openLearn()
    );
    return;
  }
  wrap.createDiv({
    cls: "los-kicker",
    text: "Continue learning"
  });
  const body = wrap.createDiv({
    cls: "los-continue-body"
  });
  const copy = body.createDiv({
    cls: "los-continue-copy"
  });
  const unitModuleId = asString(unit.module_id);
  const module2 = unitModuleId ? view.plugin.store.get(unitModuleId) : null;
  copy.createDiv({
    cls: "los-continue-module",
    text: `${module2 ? asLabel(module2) : unitModuleId ?? "Unknown module"} \xB7 ${asLabel(unit)}`
  });
  copy.createEl("h2", {
    text: asLabel(stage)
  });
  const stages = asRecords(map?.stages);
  const position = stages.findIndex(
    (row3) => asString(row3.id) === pointer.stage_id
  );
  const meta = copy.createDiv({
    cls: "los-continue-meta"
  });
  if (stages.length) {
    meta.createSpan({
      text: `Stage ${position >= 0 ? position + 1 : 1} of ${stages.length}`
    });
  }
  const estimate = asText(
    stage.estimate_minutes
  );
  if (estimate) {
    meta.createSpan({
      text: `${estimate} min planned`
    });
  }
  copy.createDiv({
    cls: "los-continue-context",
    text: "Your selected stage, exact resources, and open working state are kept together."
  });
  const actions = body.createDiv({
    cls: "los-actions"
  });
  button(
    actions,
    "Continue session",
    () => view.plugin.nav.openUnit(
      pointer.unit_id,
      pointer.stage_id
    ),
    "cta"
  );
}
function renderToday(view, root) {
  const sectionEl = section(
    root,
    "Today",
    "Only items likely to affect the next decision."
  );
  const items = [];
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const upcoming = view.plugin.store.rows("academic_deadlines").filter(
    (row3) => {
      const boundary = asString(row3.end_date) ?? asString(
        row3.start_date
      ) ?? "";
      return boundary >= today;
    }
  ).sort(
    (left, right) => {
      const leftDate = asString(
        left.start_date
      ) ?? asString(
        left.end_date
      ) ?? "";
      const rightDate = asString(
        right.start_date
      ) ?? asString(
        right.end_date
      ) ?? "";
      return leftDate.localeCompare(
        rightDate
      );
    }
  );
  for (const deadline of upcoming.slice(0, 2)) {
    const moduleId = asString(deadline.module_id) ?? firstProjectedModuleId(
      deadline.modules
    );
    const kind = asString(deadline.kind);
    const label = asString(deadline.label);
    const title = kind === "registration-window" ? label ?? asLabel(deadline) : asString(deadline.title) ?? label ?? asLabel(deadline);
    const startDate = asString(deadline.start_date);
    const endDate = asString(deadline.end_date);
    const date3 = endDate && startDate && endDate !== startDate ? `${startDate} \u2192 ${endDate}` : startDate ?? endDate ?? "Date pending";
    const registrationState = asString(
      deadline.registration_state
    );
    const registrationDetail = registrationState && registrationState !== "registered" ? ` \xB7 ${registrationState}` : "";
    items.push({
      title,
      detail: `${date3}${registrationDetail}`,
      actionLabel: moduleId ? "Open module" : "",
      action: moduleId ? () => view.plugin.nav.openModule(
        moduleId
      ) : null
    });
  }
  const reviewItems = view.plugin.store.reviewItems();
  const reviewCount = reviewItems.length;
  if (reviewCount) {
    const categories = /* @__PURE__ */ new Map();
    for (const item of reviewItems) {
      const category = asString(item.category) ?? "other";
      categories.set(
        category,
        (categories.get(category) ?? 0) + 1
      );
    }
    const details = [...categories.entries()].map(
      ([category, count]) => `${count} ${category.replaceAll("-", " ")}`
    );
    items.push({
      title: `${reviewCount} decision${reviewCount === 1 ? "" : "s"} waiting`,
      detail: details.join(" \xB7 "),
      actionLabel: "Open review",
      action: () => view.plugin.nav.openReview()
    });
  }
  if (!items.length) {
    empty(
      sectionEl,
      "Nothing time-sensitive",
      "Continue the active learning session when you are ready."
    );
    return;
  }
  const list2 = sectionEl.createDiv({
    cls: "los-home-list"
  });
  for (const item of items.slice(0, 4)) {
    view.renderHomeRow(
      list2,
      item
    );
  }
}

// src/views/home-view.ts
var import_obsidian7 = require("obsidian");
var HomeView = class extends import_obsidian7.ItemView {
  plugin;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_HOME;
  }
  getDisplayText() {
    return "LearningOS \xB7 Home";
  }
  getIcon() {
    return "home";
  }
  async onOpen() {
    this.render();
  }
  greeting() {
    const hour = (/* @__PURE__ */ new Date()).getHours();
    if (hour < 12) {
      return "Good morning";
    }
    if (hour < 18) {
      return "Good afternoon";
    }
    return "Good evening";
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass(
      "los-root",
      "los-home"
    );
    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        "LearningOS",
        "Projection unavailable"
      );
      empty(
        root,
        "The interface contract could not be loaded",
        this.plugin.store.error,
        "Rebuild views",
        () => this.plugin.generate()
      );
      return;
    }
    const header = pageHeader(
      root,
      "Home",
      this.greeting(),
      "Resume what matters without rebuilding the context first."
    );
    header.addClass("los-home-header");
    const actions = header.createDiv({
      cls: "los-actions los-home-header-actions"
    });
    const search = button(
      actions,
      "Search modules, units, sources, notes\u2026",
      () => this.plugin.nav.openGlobalSearch(),
      "quiet"
    );
    search.addClass("los-home-search-launcher");
    search.empty();
    icon(search.createSpan(), "search");
    search.createSpan({
      cls: "los-home-search-label",
      text: "Search modules, units, sources, notes\u2026"
    });
    search.createEl("kbd", {
      text: "\u2318K"
    });
    search.setAttribute(
      "aria-label",
      "Search LearningOS"
    );
    button(
      actions,
      "Capture",
      () => this.plugin.nav.openCapture(),
      "warm"
    );
    this.renderContinue(root);
    this.renderToday(root);
    this.renderElsewhere(root);
  }
  /** The one filled action on Home. */
  renderContinue(root) {
    renderContinue(this, root);
  }
  renderToday(root) {
    renderToday(this, root);
  }
  renderElsewhere(root) {
    renderElsewhere(this, root);
  }
  renderHomeRow(parent, item) {
    return renderHomeRow(parent, item);
  }
  nextWorkspaceDate(workspace) {
    return nextWorkspaceDate(this, workspace);
  }
  moduleNextAction(module2) {
    return moduleNextAction(this, module2);
  }
};

// src/contracts/route-v1.ts
var LIBRARY_COLLECTIONS = [
  "sources",
  "topic-packs"
];
var PROJECT_DETAIL_TABS = [
  "overview",
  "structure",
  "linked-materials",
  "files",
  "decisions"
];
function isLibraryCollection(value) {
  return LIBRARY_COLLECTIONS.includes(value);
}
function isProjectDetailTab(value) {
  return PROJECT_DETAIL_TABS.includes(value);
}
function asLibrarySourceFilters(value) {
  const record4 = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
  const read = (key) => typeof record4[key] === "string" ? record4[key] : "";
  return {
    domain: read("domain"),
    topic: read("topic"),
    purpose: read("purpose"),
    form: read("form"),
    use: read("use")
  };
}
function asLibraryCollection(value) {
  return isLibraryCollection(value) ? value : "sources";
}
function asProjectDetailTab(value) {
  return isProjectDetailTab(value) ? value : "overview";
}

// src/features/library/model.ts
var SOURCE_FACETS = [
  ["all", "All"],
  ["local", "Local copy"],
  ["online", "Online"],
  ["in-unit", "Used in a unit"],
  ["topic", "By topic"],
  ["purpose", "By purpose"],
  ["form", "By form"],
  ["use", "By current use"]
];
var VALUED_FACETS = /* @__PURE__ */ new Set([
  "topic",
  "purpose",
  "form",
  "use"
]);
var SOURCE_FILTER_DIMENSIONS = [
  ["domain", "Domain"],
  ["topic", "Topic"],
  ["purpose", "Purpose"],
  ["form", "Form"],
  ["use", "Current use"]
];
var LIBRARY_COLLECTIONS2 = [
  ["sources", "Sources"],
  ["topic-packs", "Curated packs"]
];
var RELATED_LABELS = {
  unit: "Used in units",
  concept: "Connected concepts",
  note: "Referenced by notes",
  source: "Related sources",
  collection: "In catalogues",
  "topic-pack": "In Topic Packs",
  module: "Modules",
  workspace: "Workspaces",
  program: "Areas"
};
function isLibraryScreen(value) {
  return value === "home" || value === "group" || value === "source-detail" || value === "topic-pack-detail" || value === "catalogue-detail" || value === "legacy-list";
}
function isLibraryCollection2(value) {
  return value === "sources" || value === "topic-packs";
}
function isSourceFacet(value) {
  return SOURCE_FACETS.some(
    ([facet]) => facet === value
  );
}
function readLibraryViewState(value, currentCollection, currentRecordType) {
  if (!isRecord2(value)) {
    return {
      screen: "home",
      collection: currentCollection,
      groupId: null,
      query: "",
      facet: "all",
      filters: asLibrarySourceFilters(null),
      resourceId: null,
      topicPackId: null,
      catalogueId: null,
      recordType: currentRecordType,
      domain: ""
    };
  }
  const recordId = asString(value.recordId);
  const screen = isLibraryScreen(
    value.screen
  ) ? value.screen : recordId ? "legacy-list" : "home";
  const collection = isLibraryCollection2(
    value.collection
  ) ? value.collection : currentCollection;
  const groupId = asString(value.groupId) ?? asString(value.fromGroupId);
  let filters = asLibrarySourceFilters(value.filters);
  if (collection === "sources" && screen === "group" && groupId && !filters.domain) {
    filters = {
      ...filters,
      domain: groupId
    };
  }
  return {
    screen,
    collection,
    groupId,
    query: asString(value.query) ?? "",
    facet: isSourceFacet(value.facet) ? value.facet : "all",
    filters,
    resourceId: asString(value.resourceId),
    topicPackId: asString(value.topicPackId),
    catalogueId: asString(value.catalogueId),
    recordType: asString(value.recordType) ?? currentRecordType,
    domain: asString(value.domain) ?? ""
  };
}
function readThematicGroup(value) {
  if (!isRecord2(value)) {
    return null;
  }
  const id2 = asString(value.id);
  if (!id2) {
    return null;
  }
  return {
    id: id2,
    title: asString(value.title) ?? id2,
    description: asText(value.description) ?? ""
  };
}
function readCollectionEntry(value) {
  if (!isRecord2(value)) {
    return null;
  }
  const sourceId = asString(value.source);
  if (!sourceId) {
    return null;
  }
  return {
    sourceId,
    group: asText(value.group),
    why: asText(value.why)
  };
}
function readCollectionEntries(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(readCollectionEntry).filter(
    (entry) => entry !== null
  );
}
function readAttachment(value) {
  if (typeof value === "string") {
    if (!value.length) {
      return null;
    }
    return {
      path: value,
      label: value.split("/").pop() || value
    };
  }
  if (!isRecord2(value)) {
    return null;
  }
  const path = asString(value.path) ?? asString(value.vault_path);
  if (!path) {
    return null;
  }
  return {
    path,
    label: asText(value.label) ?? path
  };
}
function readAttachments(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(readAttachment).filter(
    (attachment) => attachment !== null
  );
}
function readUsefulSection(value) {
  if (!isRecord2(value)) {
    return null;
  }
  const section2 = asText(value.section);
  if (!section2) {
    return null;
  }
  return {
    section: section2,
    note: asText(value.note)
  };
}
function readEvaluation(value) {
  if (!isRecord2(value)) {
    return null;
  }
  const roles = asStrings(value.roles);
  const level = asText(value.level);
  const audience = asStrings(value.audience);
  const prerequisites = asStrings(value.prerequisites);
  const strengths = asStrings(value.strengths);
  const weaknesses = asStrings(value.weaknesses);
  const concepts = asStrings(value.concepts);
  const usefulSections = Array.isArray(
    value.useful_sections
  ) ? value.useful_sections.map(readUsefulSection).filter(
    (section2) => section2 !== null
  ) : [];
  if (!roles.length && !level && !audience.length && !prerequisites.length && !strengths.length && !weaknesses.length && !usefulSections.length) {
    return null;
  }
  return {
    roles,
    level,
    audience,
    prerequisites,
    strengths,
    weaknesses,
    concepts,
    usefulSections
  };
}
function readEvaluations(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(readEvaluation).filter(
    (evaluation) => evaluation !== null
  );
}
function readLibraryRecord(value) {
  if (!isRecord2(value)) {
    return null;
  }
  const id2 = asString(value.id);
  if (!id2) {
    return null;
  }
  return {
    record: value,
    id: id2,
    type: asString(value.type) ?? "record",
    title: asText(value.title) ?? id2,
    summary: asText(value.summary) ?? "",
    purpose: asText(value.purpose) ?? "",
    sourceType: asText(value.source_type) ?? "",
    year: asText(value.year) ?? "",
    organization: asText(value.organization) ?? "",
    materialExists: asBoolean(value.material_exists),
    materialPath: asString(value.material_path),
    url: asString(value.url),
    path: asString(value.path),
    role: asText(value.role) ?? "",
    domain: asText(value.domain) ?? "",
    state: asText(value.state) ?? "",
    aliases: asStrings(value.aliases),
    authors: asStrings(value.authors),
    entries: readCollectionEntries(value.entries),
    attachments: readAttachments(value.attachments),
    evaluations: readEvaluations(value.evaluations)
  };
}
function readLibraryRecords(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(readLibraryRecord).filter(
    (record4) => record4 !== null
  );
}
function readRelatedRecords(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const records = [];
  for (const candidate of value) {
    if (!isRecord2(candidate)) {
      continue;
    }
    const record4 = readLibraryRecord(candidate.rec);
    if (record4) {
      records.push(record4);
    }
  }
  return records;
}

// src/infrastructure/resource-target.ts
function isFileShapedPath(value) {
  if (typeof value !== "string") return false;
  const path = value.trim().split(/[?#]/, 1)[0] ?? "";
  const name = path.replace(/\\/g, "/").split("/").pop() ?? "";
  return /^[^./][^/]*\.[^./]+$/.test(name);
}
function isDirectMaterialFileTarget(record4) {
  return record4.material_exists === true && isFileShapedPath(record4.material_path);
}
function hasDirectResourceTarget(record4) {
  if (isDirectMaterialFileTarget(record4)) return true;
  const vaultPath = typeof record4.vault_path === "string" ? record4.vault_path.trim() : "";
  if (vaultPath && !vaultPath.toLowerCase().startsWith("material://") && isFileShapedPath(vaultPath)) return true;
  return safeWebUrl(record4.url) !== null;
}

// src/features/library/detail.ts
function renderRecordActions(view, detail, record4) {
  const actions = detail.createDiv({
    cls: "los-actions"
  });
  if (record4.url) {
    const url = record4.url;
    button(
      actions,
      "Open online",
      () => view.plugin.openResource({
        url
      }),
      "info"
    );
  }
  if (record4.materialPath && record4.materialExists === true) {
    button(
      actions,
      isFileShapedPath(record4.materialPath) ? "Open local copy" : "Browse local collection",
      () => view.plugin.openMaterialPath(
        record4.materialPath
      ),
      "info"
    );
  }
  if (record4.path) {
    button(
      actions,
      "Open authored file",
      () => view.plugin.openAuthoredPath(
        record4.path
      ),
      "info"
    );
  }
}
function renderAttachments(view, detail, record4) {
  if (!record4.attachments.length) {
    return;
  }
  const attachments = section(
    detail,
    "Attachments",
    "Open the original handwriting, image, or PDF."
  );
  for (const attachment of record4.attachments) {
    button(
      attachments,
      `Open ${attachment.label}`,
      () => view.plugin.openAuthoredPath(
        attachment.path
      ),
      "info"
    );
  }
}
function renderRelated(view, detail, record4) {
  const related = readRelatedRecords(
    view.plugin.store.related(
      record4.id
    )
  );
  const groups = /* @__PURE__ */ new Map();
  for (const relatedRecord of related) {
    const current = groups.get(relatedRecord.type);
    if (current) {
      current.push(relatedRecord);
    } else {
      groups.set(
        relatedRecord.type,
        [relatedRecord]
      );
    }
  }
  if (!groups.size) {
    return;
  }
  const wrap = section(
    detail,
    "Related"
  );
  const orderedGroups = [
    ...groups.entries()
  ].sort(
    (left, right) => right[1].length - left[1].length
  );
  for (const [
    type,
    rows
  ] of orderedGroups) {
    const group = wrap.createDiv({
      cls: "los-related-group"
    });
    group.createDiv({
      cls: "los-group-title",
      text: `${RELATED_LABELS[type] ?? type} \xB7 ${rows.length}`
    });
    const shown = group.createDiv({
      cls: "los-related-chips"
    });
    for (const relatedRecord of rows.slice(0, 5)) {
      chip(
        shown,
        relatedRecord.record,
        () => view.plugin.nav.openRecord(
          relatedRecord.record
        )
      );
    }
    if (rows.length > 5) {
      const rest = disclosure(
        group,
        `View all ${rows.length}`
      );
      const restChips = rest.createDiv({
        cls: "los-related-chips"
      });
      for (const relatedRecord of rows.slice(5)) {
        chip(
          restChips,
          relatedRecord.record,
          () => view.plugin.nav.openRecord(
            relatedRecord.record
          )
        );
      }
    }
  }
}
function renderSourceDetail(view, detail, record4) {
  const facts = section(
    detail,
    "Source facts"
  );
  const factRows = [
    [
      "Authors",
      record4.authors.join(", ")
    ],
    [
      "Organization",
      record4.organization
    ],
    [
      "Year",
      record4.year
    ],
    [
      "Type",
      record4.sourceType
    ]
  ];
  for (const [
    label,
    value
  ] of factRows) {
    if (!value) {
      continue;
    }
    const row3 = facts.createDiv({
      cls: "los-fact-row"
    });
    row3.createSpan({
      cls: "los-fact-label",
      text: label
    });
    row3.createSpan({
      cls: "los-fact-value",
      text: value
    });
  }
  const memberships = view.shelfIndex().get(
    record4.id
  ) ?? [];
  const placed = section(
    detail,
    "Collections",
    "Where this source sits and the explicit role it plays there."
  );
  if (!memberships.length) {
    empty(
      placed,
      "Not in a collection",
      "The source remains globally registered."
    );
  }
  for (const membership of memberships) {
    const line = placed.createDiv({
      cls: "los-shelf-entry"
    });
    const head = line.createEl(
      "button",
      {
        cls: "los-shelf-entry-title is-clickable",
        attr: {
          type: "button"
        },
        text: membership.shelf.title
      }
    );
    head.addEventListener(
      "click",
      () => {
        if (membership.shelf.type === "topic-pack") {
          view.plugin.nav.openTopicPackDetail(
            membership.shelf.id
          );
          return;
        }
        view.plugin.nav.openCatalogueDetail(
          membership.shelf.id
        );
      }
    );
    if (membership.group) {
      line.createDiv({
        cls: "los-micro",
        text: membership.group
      });
    }
    if (membership.why) {
      line.createDiv({
        cls: "los-shelf-why",
        text: membership.why
      });
    }
  }
  const used = section(
    detail,
    "Used in units",
    "Use is module/unit-specific; it is not a global source score."
  );
  const units = readLibraryRecords(
    view.plugin.store.useUnits(
      record4.id
    )
  );
  if (!units.length) {
    empty(
      used,
      "Not routed to a unit",
      "The source remains globally registered."
    );
  }
  for (const unit of units) {
    chip(
      used,
      unit.record,
      () => view.plugin.nav.openUnit(
        unit.id
      )
    );
  }
  if (record4.evaluations.length) {
    const evidence2 = section(
      detail,
      "What this source is good for"
    );
    for (const evaluation of record4.evaluations) {
      const card = evidence2.createDiv({
        cls: "los-evidence-card"
      });
      if (evaluation.roles.length || evaluation.level) {
        const purpose = card.createDiv({ cls: "los-chip-row" });
        for (const role of evaluation.roles) badge(purpose, role, "role");
        if (evaluation.level) badge(purpose, evaluation.level, "level");
      }
      for (const [label, values2] of [
        ["Strengths", evaluation.strengths],
        ["Weaknesses", evaluation.weaknesses],
        ["Assumes", evaluation.prerequisites],
        ["Written for", evaluation.audience]
      ]) {
        if (!values2.length) continue;
        const block = card.createDiv({ cls: "los-row" });
        block.createEl("strong", { text: `${label}: ` });
        block.createSpan({ text: values2.join(" \xB7 ") });
      }
      for (const selection of evaluation.usefulSections) {
        card.createDiv({
          cls: "los-row",
          text: selection.section + (selection.note ? ` \u2014 ${selection.note}` : "")
        });
      }
    }
  }
}
function renderTechnical(view, detail, record4) {
  const technical = disclosure(
    detail,
    "Technical details",
    "los-technical-details"
  );
  const idRow = technical.createDiv({
    cls: "los-fact-row"
  });
  idRow.createSpan({
    cls: "los-fact-label",
    text: "Record ID"
  });
  idRow.createSpan({
    cls: "los-fact-value los-detail-id",
    text: record4.id
  });
  button(
    technical,
    "Copy ID",
    () => view.plugin.copyText(
      record4.id
    ),
    "quiet"
  );
  if (record4.path) {
    const pathRow = technical.createDiv({
      cls: "los-fact-row"
    });
    pathRow.createSpan({
      cls: "los-fact-label",
      text: "Path"
    });
    pathRow.createSpan({
      cls: "los-fact-value",
      text: record4.path
    });
  }
}

// src/features/library/collections.ts
function renderRecordRow(view, list2, record4, isPack = false) {
  const row3 = list2.createEl(
    "button",
    {
      cls: "los-route-row is-clickable",
      attr: {
        type: "button",
        "aria-label": `Open ${record4.title}`,
        "data-record-id": record4.id
      }
    }
  );
  const copy = row3.createDiv({
    cls: "los-route-row-copy"
  });
  copy.createEl(
    "strong",
    {
      text: record4.title
    }
  );
  const meta = isPack ? [
    record4.purpose,
    `${record4.entries.length} items`
  ].filter(Boolean).join(" \xB7 ") : [
    record4.sourceType,
    record4.year,
    record4.organization,
    record4.materialExists || record4.materialPath ? "local" : null,
    record4.url ? "online" : null
  ].filter(Boolean).join(" \xB7 ");
  if (meta) {
    copy.createDiv({
      cls: "los-route-meta",
      text: meta
    });
  }
  row3.createSpan({
    cls: "los-route-open",
    text: "Open \u2192"
  });
  row3.addEventListener(
    "click",
    () => {
      view.selectedElementId = record4.id;
      if (isPack) {
        view.plugin.nav.openTopicPackDetail(
          record4.id,
          view.groupId,
          view.query
        );
        return;
      }
      view.plugin.nav.openSourceDetail(
        record4.id,
        view.groupId,
        view.query,
        view.facet,
        { ...view.filters }
      );
    }
  );
}
function renderSourcePage(view, root) {
  const record4 = readLibraryRecord(
    view.resourceId ? view.plugin.store.get(
      view.resourceId
    ) : null
  );
  const back = button(
    root,
    "\u2039 Learning Sources",
    () => view.plugin.nav.back(),
    "quiet"
  );
  back.addClass("los-route-back");
  if (!record4 || record4.type !== "source") {
    empty(
      root,
      "Learning source unavailable",
      "The projected source could not be found.",
      "Back",
      () => view.plugin.nav.back()
    );
    return;
  }
  const detail = root.createDiv({
    cls: "los-detail-page"
  });
  pageHeader(
    detail,
    "Learning Source",
    record4.title,
    record4.summary
  );
  view.renderRecordActions(
    detail,
    record4
  );
  view.renderAttachments(
    detail,
    record4
  );
  view.renderSourceDetail(
    detail,
    record4
  );
  view.renderRelated(
    detail,
    record4
  );
  view.renderTechnical(
    detail,
    record4
  );
}
function renderTopicPackPage(view, root) {
  const pack = readLibraryRecord(
    view.topicPackId ? view.plugin.store.get(
      view.topicPackId
    ) : null
  );
  const back = button(
    root,
    "\u2039 Topic Packs",
    () => view.plugin.nav.back(),
    "quiet"
  );
  back.addClass("los-route-back");
  if (!pack || pack.type !== "topic-pack") {
    empty(
      root,
      "Topic Pack unavailable",
      "The projected Topic Pack could not be found.",
      "Back",
      () => view.plugin.nav.back()
    );
    return;
  }
  const detail = root.createDiv({
    cls: "los-detail-page los-topic-pack-detail"
  });
  pageHeader(
    detail,
    "Topic Pack",
    pack.title,
    pack.summary
  );
  const purpose = section(
    detail,
    "Purpose"
  );
  purpose.createEl(
    "p",
    {
      cls: "los-pack-purpose",
      text: pack.purpose || "No purpose recorded."
    }
  );
  view.renderOrderedCollection(
    detail,
    pack,
    "Pack contents"
  );
  view.renderRelated(
    detail,
    pack
  );
  view.renderTechnical(
    detail,
    pack
  );
}
function renderCataloguePage(view, root) {
  const catalogue = readLibraryRecord(
    view.catalogueId ? view.plugin.store.get(
      view.catalogueId
    ) : null
  );
  const back = button(
    root,
    "\u2039 Library",
    () => view.plugin.nav.back(),
    "quiet"
  );
  back.addClass("los-route-back");
  if (!catalogue || catalogue.type !== "collection") {
    empty(
      root,
      "Source catalogue unavailable",
      "The projected catalogue could not be found.",
      "Back",
      () => view.plugin.nav.back()
    );
    return;
  }
  const detail = root.createDiv({
    cls: "los-detail-page los-catalogue-detail"
  });
  pageHeader(
    detail,
    "Source Catalogue",
    catalogue.title,
    catalogue.summary
  );
  view.renderOrderedCollection(
    detail,
    catalogue,
    "Catalogue entries"
  );
  view.renderRelated(
    detail,
    catalogue
  );
  view.renderTechnical(
    detail,
    catalogue
  );
}
function renderOrderedCollection(view, detail, collection, title) {
  const entries = collection.entries;
  const wrap = section(
    detail,
    `${title} (${entries.length})`,
    "The order and grouping shown here come directly from the canonical collection."
  );
  if (!entries.length) {
    empty(
      wrap,
      "Empty collection",
      "No entries are currently registered."
    );
    return;
  }
  let previousGroup = null;
  entries.forEach(
    (entry, index) => {
      if (entry.group && entry.group !== previousGroup) {
        wrap.createDiv({
          cls: "los-list-group",
          text: entry.group
        });
        previousGroup = entry.group;
      }
      const source = readLibraryRecord(
        view.plugin.store.get(
          entry.sourceId
        )
      );
      const row3 = wrap.createDiv({
        cls: "los-pack-entry"
      });
      row3.createSpan({
        cls: "los-pack-order",
        text: String(index + 1)
      });
      const copy = row3.createDiv({
        cls: "los-route-row-copy"
      });
      const open = copy.createEl(
        "button",
        {
          cls: "los-shelf-entry-title is-clickable",
          attr: {
            type: "button"
          },
          text: source?.title ?? entry.sourceId
        }
      );
      open.addEventListener(
        "click",
        () => {
          if (!source) {
            return;
          }
          view.plugin.nav.openSourceDetail(
            source.id,
            view.groupId
          );
        }
      );
      if (entry.why) {
        copy.createDiv({
          cls: "los-shelf-why",
          text: entry.why
        });
      }
      const facts = [
        source?.sourceType,
        source?.year,
        source?.materialExists || source?.materialPath ? "local" : null,
        source?.url ? "online" : null
      ].filter(Boolean).join(" \xB7 ");
      if (facts) {
        copy.createDiv({
          cls: "los-route-meta",
          text: facts
        });
      }
    }
  );
}
function renderLegacyList(view, root) {
  const back = button(
    root,
    "\u2039 Library",
    () => view.plugin.nav.back(),
    "quiet"
  );
  back.addClass("los-route-back");
  const title = `${view.recordType.charAt(0).toUpperCase()}${view.recordType.slice(1)} records`;
  pageHeader(
    root,
    "Compatibility view",
    title,
    view.domain ? `Domain: ${view.domain}` : "Legacy record families remain reachable until their migration gate closes."
  );
  const input = root.createEl(
    "input",
    {
      cls: "los-search los-route-search",
      attr: {
        type: "search",
        placeholder: `Search ${view.recordType} records\u2026`,
        "aria-label": `Search ${view.recordType}`
      }
    }
  );
  input.value = view.query;
  input.addEventListener(
    "input",
    async () => {
      view.query = input.value;
      await view.plugin.router.remember({
        name: "legacy-library-list",
        recordType: view.recordType,
        query: view.query,
        domain: view.domain
      });
      view.render();
    }
  );
  let rows = readLibraryRecords(
    view.plugin.store.search(
      view.query,
      [view.recordType]
    )
  );
  if (view.domain) {
    rows = rows.filter(
      (record4) => record4.domain === view.domain
    );
  }
  rows.sort(
    (left, right) => left.title.localeCompare(
      right.title
    )
  );
  if (!rows.length) {
    empty(
      root,
      view.query ? "No matching records" : "No records",
      view.query ? "Try a shorter title, alias or ID." : `No ${view.recordType} records are projected.`
    );
    return;
  }
  const list2 = root.createDiv({
    cls: "los-route-list"
  });
  for (const record4 of rows) {
    const row3 = list2.createEl(
      "button",
      {
        cls: "los-route-row is-clickable",
        attr: {
          type: "button",
          "data-record-id": record4.id
        }
      }
    );
    const copy = row3.createDiv({
      cls: "los-route-row-copy"
    });
    copy.createEl(
      "strong",
      {
        text: record4.title
      }
    );
    copy.createDiv({
      cls: "los-route-meta",
      text: [
        record4.role,
        record4.domain,
        record4.state
      ].filter(Boolean).join(" \xB7 ")
    });
    row3.createSpan({
      cls: "los-route-open",
      text: record4.path ? "Open file \u2192" : "Open \u2192"
    });
    row3.addEventListener(
      "click",
      () => {
        view.selectedElementId = record4.id;
        if (record4.path) {
          view.plugin.openAuthoredPath(
            record4.path
          );
          return;
        }
        view.plugin.nav.openRecord(
          record4.record
        );
      }
    );
  }
}

// src/features/library/home.ts
function renderHome(view, root) {
  if (view.collection === "sources") {
    view.renderSourceBrowser(root);
    return;
  }
  pageHeader(
    root,
    "Library",
    "Choose a thematic group",
    view.collection === "topic-packs" ? "Topic Packs are narrow, purpose-built and manually ordered collections." : "Open a domain to browse its learning sources."
  );
  view.renderCollectionSwitch(root);
  const groups = view.plugin.store.thematicGroups().map(readThematicGroup).filter(
    (group) => group !== null
  );
  if (!groups.length) {
    empty(
      root,
      "No thematic groups",
      "Rebuild the projection after defining thematic-group metadata."
    );
    return;
  }
  const grid = root.createDiv({
    cls: "los-group-grid los-library-group-grid"
  });
  for (const group of groups) {
    const count = view.collection === "topic-packs" ? view.plugin.store.topicPacksForGroup(group.id).length : view.plugin.store.sourcesForGroup(group.id).length;
    const card = grid.createEl(
      "button",
      {
        cls: "los-group-card is-clickable",
        attr: {
          type: "button",
          "aria-label": `Open ${group.title}`
        }
      }
    );
    const head = card.createDiv({
      cls: "los-group-card-header"
    });
    head.createEl(
      "h2",
      {
        text: group.title
      }
    );
    const countLabel = view.collection === "topic-packs" ? `pack${count === 1 ? "" : "s"}` : `source${count === 1 ? "" : "s"}`;
    head.createSpan({
      cls: "los-group-count",
      text: `${count} ${countLabel}`
    });
    if (group.description) {
      card.createEl(
        "p",
        {
          text: group.description
        }
      );
    }
    card.createSpan({
      cls: "los-route-open",
      text: "Open \u2192"
    });
    card.addEventListener(
      "click",
      () => {
        view.selectedElementId = group.id;
        view.plugin.nav.openLibraryGroup(
          view.collection,
          group.id
        );
      }
    );
  }
}
function renderCollectionSwitch(view, root) {
  const switcher = root.createDiv({
    cls: "los-collection-switch",
    attr: {
      role: "group",
      "aria-label": "Library collection"
    }
  });
  enableButtonGroupKeyboardNavigation(switcher);
  for (const [
    id2,
    label
  ] of LIBRARY_COLLECTIONS2) {
    const control = button(
      switcher,
      label,
      () => view.plugin.nav.openLibraryHome(id2),
      view.collection === id2 ? "cta" : "quiet"
    );
    control.setAttrs({
      "aria-pressed": String(
        view.collection === id2
      )
    });
  }
}
function renderGroup(view, root) {
  const group = readThematicGroup(
    view.groupId ? view.plugin.store.get(
      view.groupId
    ) : null
  );
  const back = button(
    root,
    "\u2039 Library",
    () => view.plugin.nav.back(),
    "quiet"
  );
  back.addClass("los-route-back");
  if (!group) {
    empty(
      root,
      "Thematic group unavailable",
      "Return to Library and choose another group.",
      "Back",
      () => view.plugin.nav.back()
    );
    return;
  }
  const isPacks = view.collection === "topic-packs";
  pageHeader(
    root,
    isPacks ? "Topic Packs" : "Learning Sources",
    group.title,
    isPacks ? "Purpose-built collections in this thematic group." : "Learning sources in this thematic group."
  );
  const toolbar = root.createDiv({
    cls: "los-library-toolbar"
  });
  const input = toolbar.createEl(
    "input",
    {
      cls: "los-search los-route-search",
      attr: {
        type: "search",
        placeholder: `Search ${group.title} ${isPacks ? "topic packs" : "sources"}\u2026`,
        "aria-label": `Search ${group.title} ${isPacks ? "topic packs" : "sources"}`
      }
    }
  );
  input.value = view.query;
  input.addEventListener(
    "input",
    async () => {
      view.query = input.value;
      await view.rememberGroup();
      view.render();
    }
  );
  if (!isPacks) {
    view.renderSourceFacets(toolbar);
    button(
      toolbar,
      "Full-text / OCR search",
      () => view.plugin.nav.openFullTextSearch(
        view.query
      ),
      "quiet"
    );
  }
  const rawRecords = isPacks ? view.plugin.store.topicPacksForGroup(group.id) : view.plugin.store.sourcesForGroup(group.id);
  const all = readLibraryRecords(rawRecords);
  if (!isPacks) {
    view.renderFacetValues(toolbar, all);
  }
  const needle = view.query.trim().toLocaleLowerCase();
  const words2 = needle.split(/\s+/).filter(Boolean);
  const rows = all.filter((record4) => {
    if (!isPacks && !view.matchesSourceFacet(
      record4.record
    )) {
      return false;
    }
    if (!words2.length) {
      return true;
    }
    const hay = [
      record4.id,
      record4.title,
      record4.purpose,
      record4.summary,
      ...record4.aliases,
      ...record4.authors,
      record4.organization
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return words2.every(
      (word) => hay.includes(word)
    );
  }).sort(
    (left, right) => left.title.localeCompare(
      right.title
    )
  );
  if (!all.length) {
    empty(
      root,
      isPacks ? "No Topic Packs in this group" : "No Learning Sources in this group",
      isPacks ? "The group exists, but no purpose-built pack currently references it." : "The group exists, but no learning source currently references it."
    );
    return;
  }
  if (!rows.length) {
    empty(
      root,
      "No matching results",
      `Nothing in ${group.title} matches the current search and filters.`,
      "Clear search and filters",
      async () => {
        view.query = "";
        view.facet = "all";
        await view.rememberGroup();
        view.render();
      }
    );
    return;
  }
  const list2 = root.createDiv({
    cls: "los-route-list los-library-route-list"
  });
  for (const record4 of rows) {
    view.renderRecordRow(
      list2,
      record4,
      isPacks
    );
  }
}

// src/features/library/filters.ts
function sourceFilterValuesFor(view, source, dimension) {
  if (dimension === "domain") {
    return asStrings(
      source.record.thematic_group_ids
    );
  }
  if (dimension === "topic") {
    return asStrings(
      source.record.topics
    );
  }
  if (dimension === "purpose") {
    const values2 = /* @__PURE__ */ new Set();
    for (const evaluation of source.evaluations) {
      for (const role of evaluation.roles) {
        values2.add(role);
      }
    }
    return [...values2];
  }
  if (dimension === "form") {
    return source.sourceType ? [source.sourceType] : [];
  }
  return view.plugin.store.useModules(source.id).map(
    (module2) => asString(module2.id)
  ).filter(
    (id2) => id2 !== null
  );
}
function sourceMatchesFilters(view, source, omit = null) {
  for (const [dimension] of SOURCE_FILTER_DIMENSIONS) {
    if (dimension === omit) {
      continue;
    }
    const selected = view.filters[dimension];
    if (selected && !view.sourceFilterValuesFor(
      source,
      dimension
    ).includes(selected)) {
      return false;
    }
  }
  return true;
}
function sourceFilterTally(view, sources, dimension) {
  const tally = /* @__PURE__ */ new Map();
  for (const source of sources) {
    if (!view.sourceMatchesFilters(source, dimension)) {
      continue;
    }
    for (const value of view.sourceFilterValuesFor(
      source,
      dimension
    )) {
      tally.set(
        value,
        (tally.get(value) ?? 0) + 1
      );
    }
  }
  return tally;
}
function sourceFilterLabel(view, dimension, value) {
  if (dimension === "domain") {
    const group = view.plugin.store.get(value);
    return group ? asString(group.title) ?? value : value;
  }
  if (dimension === "topic") {
    const topic = view.plugin.store.topics().find(
      (row3) => asString(row3.id) === value
    );
    return topic ? asString(topic.title) ?? value : value;
  }
  if (dimension === "use") {
    const module2 = view.plugin.store.get(value);
    return module2 ? asString(module2.title) ?? value : value;
  }
  return value.replace(/[-_]+/g, " ").replace(
    /\b\w/g,
    (letter) => letter.toLocaleUpperCase()
  );
}
function renderSourceBrowser(view, root) {
  pageHeader(
    root,
    "Library \xB7 Learning sources",
    "Library",
    "Everything you possess, searchable once and browsable through any useful facet."
  );
  view.renderCollectionSwitch(root);
  const all = readLibraryRecords(
    view.plugin.store.sources()
  );
  const browser = root.createDiv({
    cls: "los-library-browser"
  });
  const toolbar = browser.createDiv({
    cls: "los-library-browser-toolbar"
  });
  const input = toolbar.createEl(
    "input",
    {
      cls: "los-search los-route-search los-library-global-search",
      attr: {
        type: "search",
        placeholder: "Search all sources\u2026",
        "aria-label": "Search learning sources"
      }
    }
  );
  input.value = view.query;
  input.addEventListener(
    "input",
    async () => {
      view.query = input.value;
      view.screen = "home";
      view.groupId = null;
      await view.rememberSourceBrowser();
      view.render();
    }
  );
  const fullTextSearch = button(
    toolbar,
    "Full text / OCR",
    () => view.plugin.nav.openFullTextSearch(
      view.query
    ),
    "quiet"
  );
  fullTextSearch.addClass(
    "los-library-ocr-action"
  );
  fullTextSearch.setAttribute(
    "aria-label",
    "Search full text and OCR content"
  );
  browser.createEl("h2", {
    cls: "los-library-filter-heading",
    text: "Browse / filter"
  });
  const facets = browser.createDiv({
    cls: "los-library-peer-facets",
    attr: {
      "aria-label": "Learning Source facets"
    }
  });
  for (const [
    dimension,
    label
  ] of SOURCE_FILTER_DIMENSIONS) {
    const control = facets.createDiv({
      cls: "los-library-peer-facet"
    });
    control.createEl(
      "label",
      {
        cls: "los-library-facet-label",
        text: label
      }
    );
    const select = control.createEl(
      "select",
      {
        cls: "los-library-facet-select",
        attr: {
          "data-facet": dimension,
          "aria-label": `Filter by ${label}`
        }
      }
    );
    const tally = view.sourceFilterTally(
      all,
      dimension
    );
    select.createEl(
      "option",
      {
        text: `All ${label.toLocaleLowerCase()}`,
        attr: {
          value: ""
        }
      }
    );
    const ordered = [...tally.entries()].sort(
      (left, right) => {
        const leftLabel = view.sourceFilterLabel(
          dimension,
          left[0]
        );
        const rightLabel = view.sourceFilterLabel(
          dimension,
          right[0]
        );
        return leftLabel.localeCompare(
          rightLabel
        );
      }
    );
    for (const [
      value,
      count
    ] of ordered) {
      select.createEl(
        "option",
        {
          text: `${view.sourceFilterLabel(
            dimension,
            value
          )} (${count})`,
          attr: {
            value
          }
        }
      );
    }
    select.value = view.filters[dimension];
    select.addEventListener(
      "change",
      () => {
        void view.setSourceFilter(
          dimension,
          select.value
        );
      }
    );
  }
  const active = SOURCE_FILTER_DIMENSIONS.filter(
    ([dimension]) => Boolean(
      view.filters[dimension]
    )
  );
  if (active.length) {
    const activeWrap = browser.createDiv({
      cls: "los-library-active-filters",
      attr: {
        "aria-label": "Active Library filters"
      }
    });
    for (const [
      dimension,
      label
    ] of active) {
      const value = view.filters[dimension];
      const control = button(
        activeWrap,
        `${label}: ${view.sourceFilterLabel(
          dimension,
          value
        )} \xD7`,
        () => void view.setSourceFilter(
          dimension,
          ""
        ),
        "quiet"
      );
      control.addClass(
        "los-library-filter-chip"
      );
    }
    button(
      activeWrap,
      "Clear filters",
      () => void view.clearSourceFilters(),
      "quiet"
    );
  }
  const words2 = view.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const rows = all.filter(
    (source) => view.sourceMatchesFilters(source)
  ).filter(
    (source) => {
      if (!words2.length) {
        return true;
      }
      const hay = [
        source.id,
        source.title,
        source.summary,
        source.purpose,
        source.organization,
        source.sourceType,
        ...source.aliases,
        ...source.authors
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return words2.every(
        (word) => hay.includes(word)
      );
    }
  ).sort(
    (left, right) => left.title.localeCompare(
      right.title
    )
  );
  browser.createDiv({
    cls: "los-library-result-summary",
    text: `${rows.length} of ${all.length} source${all.length === 1 ? "" : "s"}`
  });
  if (!all.length) {
    empty(
      browser,
      "No Learning Sources",
      "The Core projection currently contains no source records."
    );
    return;
  }
  if (!rows.length) {
    const hasQuery = Boolean(
      view.query.trim()
    );
    const hasFilters = SOURCE_FILTER_DIMENSIONS.some(
      ([dimension]) => Boolean(view.filters[dimension])
    );
    const resetLabel = hasQuery ? hasFilters ? "Clear search and filters" : "Clear search" : "Clear filters";
    const reset = () => {
      if (hasQuery) {
        void view.clearSourceSearchAndFilters();
      } else {
        void view.clearSourceFilters();
      }
    };
    empty(
      browser,
      "No matching sources",
      "No source matches the current search and facet combination.",
      resetLabel,
      reset
    );
    return;
  }
  const list2 = browser.createDiv({
    cls: "los-route-list los-library-route-list"
  });
  for (const source of rows) {
    view.renderRecordRow(
      list2,
      source,
      false
    );
  }
}
function renderSourceFacets(view, parent) {
  const facets = parent.createDiv({
    cls: "los-library-facets-inline",
    attr: {
      "aria-label": "Source filters"
    }
  });
  for (const [
    id2,
    label
  ] of SOURCE_FACETS) {
    const control = button(
      facets,
      label,
      async () => {
        view.facet = id2;
        view.facetValue = null;
        await view.rememberGroup();
        view.render();
      },
      view.facet === id2 ? "row" : "quiet"
    );
    control.setAttribute(
      "aria-pressed",
      String(view.facet === id2)
    );
  }
}
function renderFacetValues(view, parent, sources) {
  if (!VALUED_FACETS.has(view.facet)) {
    return;
  }
  const tally = view.facetTally(sources);
  const wrap = parent.createDiv({
    cls: "los-library-facet-values"
  });
  if (!tally.size) {
    wrap.createDiv({
      cls: "los-muted",
      text: view.facet === "topic" ? "No source in this view carries a topic yet. Topics are added when a source is actually used, never in a bulk pass." : "Nothing to filter by here yet."
    });
    return;
  }
  const clear = button(
    wrap,
    `All (${sources.length})`,
    () => {
      view.facetValue = null;
      view.render();
    },
    view.facetValue ? "quiet" : "row"
  );
  clear.setAttribute(
    "aria-pressed",
    String(!view.facetValue)
  );
  const ordered = [...tally.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  for (const [value, count] of ordered) {
    const control = button(
      wrap,
      `${view.facetValueLabel(value)} (${count})`,
      () => {
        view.facetValue = view.facetValue === value ? null : value;
        view.render();
      },
      view.facetValue === value ? "row" : "quiet"
    );
    control.setAttribute(
      "aria-pressed",
      String(view.facetValue === value)
    );
  }
  if (view.facet === "topic") {
    const untopiced = sources.filter(
      (source) => !asStrings(
        source.record.topics
      ).length
    ).length;
    if (untopiced) {
      wrap.createDiv({
        cls: "los-micro",
        text: `${untopiced} of ${sources.length} not yet classified by topic \u2014 expected, not a backlog.`
      });
    }
  }
}

// src/views/library-view.ts
var import_obsidian8 = require("obsidian");
var LibraryView = class extends import_obsidian8.ItemView {
  plugin;
  screen = "home";
  collection = "sources";
  groupId = null;
  query = "";
  facet = "all";
  filters = asLibrarySourceFilters(null);
  /** Selected value within a valued facet (a topic id, a role, a type, a
   *  module id). Null means "show the values to pick from". */
  facetValue = null;
  resourceId = null;
  topicPackId = null;
  catalogueId = null;
  recordType = "note";
  domain = "";
  selectedElementId = null;
  _shelfIndex = null;
  _shelfSnapshot = null;
  _shelfData = null;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_LIBRARY;
  }
  getDisplayText() {
    return "LearningOS \xB7 Library";
  }
  applyState(state = {}) {
    const parsed = readLibraryViewState(
      state,
      this.collection,
      this.recordType
    );
    this.screen = parsed.screen;
    this.collection = parsed.collection;
    this.groupId = parsed.groupId;
    this.query = parsed.query;
    this.facet = parsed.facet;
    this.filters = parsed.filters;
    this.resourceId = parsed.resourceId;
    this.topicPackId = parsed.topicPackId;
    this.catalogueId = parsed.catalogueId;
    this.recordType = parsed.recordType;
    this.domain = parsed.domain;
  }
  async setState(state = {}) {
    this.applyState(state);
    this.render();
  }
  getState() {
    return {
      screen: this.screen,
      collection: this.collection,
      groupId: this.groupId,
      query: this.query,
      facet: this.facet,
      filters: { ...this.filters },
      resourceId: this.resourceId,
      topicPackId: this.topicPackId,
      catalogueId: this.catalogueId,
      recordType: this.recordType,
      domain: this.domain
    };
  }
  async onOpen() {
    this.applyState(
      this.leaf.getViewState().state
    );
    this.render();
  }
  shelfIndex() {
    if (this._shelfIndex && this._shelfSnapshot === this.plugin.store.snapshotId && this._shelfData === this.plugin.store.data) {
      return this._shelfIndex;
    }
    const index = /* @__PURE__ */ new Map();
    const shelves = readLibraryRecords([
      ...this.plugin.store.catalogues(),
      ...this.plugin.store.topicPacks()
    ]);
    for (const shelf of shelves) {
      for (const entry of shelf.entries) {
        const membership = {
          shelf,
          group: entry.group,
          why: entry.why
        };
        const current = index.get(entry.sourceId);
        if (current) {
          current.push(membership);
        } else {
          index.set(
            entry.sourceId,
            [membership]
          );
        }
      }
    }
    this._shelfIndex = index;
    this._shelfSnapshot = this.plugin.store.snapshotId;
    this._shelfData = this.plugin.store.data;
    return index;
  }
  matchesSourceFacet(record4) {
    const source = readLibraryRecord(record4);
    if (!source) {
      return false;
    }
    if (this.facet === "all") {
      return true;
    }
    if (this.facet === "local") {
      return Boolean(
        source.materialExists || source.materialPath
      );
    }
    if (this.facet === "online") {
      return Boolean(source.url);
    }
    if (this.facet === "in-unit") {
      return this.plugin.store.useUnits(source.id).length > 0;
    }
    if (VALUED_FACETS.has(this.facet)) {
      if (!this.facetValue) {
        return true;
      }
      return this.facetValuesFor(source).includes(this.facetValue);
    }
    return true;
  }
  /** Which values of the ACTIVE facet this source participates in.
   *
   *  Deliberately returns a list, not a value: a source belongs to several
   *  topics, serves several purposes and is used by several modules at once.
   *  Collapsing that to one would rebuild the single-placement tree ADR-009
   *  exists to remove. Every field here is read from the projection — the UI
   *  never parses generated/library.md, which is the human view of the same
   *  facts. */
  facetValuesFor(source) {
    if (this.facet === "topic") {
      return asStrings(
        source.record.topics
      );
    }
    if (this.facet === "form") {
      return source.sourceType ? [source.sourceType] : [];
    }
    if (this.facet === "purpose") {
      const roles = /* @__PURE__ */ new Set();
      for (const evaluation of source.evaluations) {
        for (const role of evaluation.roles) {
          roles.add(role);
        }
      }
      return [...roles];
    }
    if (this.facet === "use") {
      return this.plugin.store.useModules(source.id).map(
        (module2) => asString(module2.id)
      ).filter(
        (id2) => id2 !== null
      );
    }
    return [];
  }
  /** Value → source count for the active facet, with overlap preserved. */
  facetTally(sources) {
    const tally = /* @__PURE__ */ new Map();
    for (const source of sources) {
      for (const value of this.facetValuesFor(source)) {
        tally.set(
          value,
          (tally.get(value) ?? 0) + 1
        );
      }
    }
    return tally;
  }
  /** Human label for a facet value. Topics carry titles in the projection;
   *  everything else is already readable. */
  facetValueLabel(value) {
    if (this.facet === "topic") {
      const topic = this.plugin.store.topics().find(
        (row3) => asString(row3.id) === value
      );
      return topic ? asString(topic.title) ?? value : value;
    }
    if (this.facet === "use") {
      const module2 = this.plugin.store.get(value);
      return module2 ? asString(module2.title) ?? value : value;
    }
    return value;
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass(
      "los-root",
      "los-library-view"
    );
    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        "Library",
        "Projection unavailable"
      );
      empty(
        root,
        "The interface contract could not be loaded",
        this.plugin.store.error,
        "Rebuild views",
        () => this.plugin.generate()
      );
      return;
    }
    if (this.screen === "group") {
      if (this.collection === "sources") {
        this.renderSourceBrowser(root);
      } else {
        this.renderGroup(root);
      }
      return;
    }
    if (this.screen === "source-detail") {
      this.renderSourcePage(root);
      return;
    }
    if (this.screen === "topic-pack-detail") {
      this.renderTopicPackPage(root);
      return;
    }
    if (this.screen === "catalogue-detail") {
      this.renderCataloguePage(root);
      return;
    }
    if (this.screen === "legacy-list") {
      this.renderLegacyList(root);
      return;
    }
    this.renderHome(root);
  }
  sourceFilterValuesFor(source, dimension) {
    return sourceFilterValuesFor(this, source, dimension);
  }
  sourceMatchesFilters(source, omit = null) {
    return sourceMatchesFilters(this, source, omit);
  }
  sourceFilterTally(sources, dimension) {
    return sourceFilterTally(this, sources, dimension);
  }
  sourceFilterLabel(dimension, value) {
    return sourceFilterLabel(this, dimension, value);
  }
  async rememberSourceBrowser() {
    return this.plugin.router.remember({
      name: "library-home",
      collection: "sources",
      query: this.query,
      filters: { ...this.filters }
    });
  }
  async setSourceFilter(dimension, value) {
    this.filters = {
      ...this.filters,
      [dimension]: value
    };
    this.screen = "home";
    this.groupId = null;
    await this.rememberSourceBrowser();
    this.render();
  }
  async clearSourceFilters() {
    this.filters = asLibrarySourceFilters(null);
    this.screen = "home";
    this.groupId = null;
    await this.rememberSourceBrowser();
    this.render();
  }
  async clearSourceSearchAndFilters() {
    this.query = "";
    this.filters = asLibrarySourceFilters(null);
    this.screen = "home";
    this.groupId = null;
    await this.rememberSourceBrowser();
    this.render();
    const search = typeof this.contentEl.querySelector === "function" ? this.contentEl.querySelector(
      ".los-library-global-search"
    ) : null;
    search?.focus();
  }
  renderSourceBrowser(root) {
    renderSourceBrowser(this, root);
  }
  renderHome(root) {
    renderHome(this, root);
  }
  renderCollectionSwitch(root) {
    renderCollectionSwitch(this, root);
  }
  renderGroup(root) {
    renderGroup(this, root);
  }
  async rememberGroup() {
    if (!this.groupId) {
      return void 0;
    }
    return this.plugin.router.remember({
      name: "library-group",
      collection: this.collection,
      groupId: this.groupId,
      query: this.query,
      facet: this.facet
    });
  }
  renderSourceFacets(parent) {
    renderSourceFacets(this, parent);
  }
  /** The values of the active valued facet, with counts.
   *
   *  This is the part that answers "the Library is a sea of ML". A domain
   *  heading says 73; this says Deep Learning 22 · ML Compilation 4 · … and
   *  lets those add to more than 73, because a source really does belong to
   *  several at once. */
  renderFacetValues(parent, sources) {
    renderFacetValues(this, parent, sources);
  }
  renderRecordRow(list2, record4, isPack = false) {
    renderRecordRow(this, list2, record4, isPack);
  }
  renderSourcePage(root) {
    renderSourcePage(this, root);
  }
  renderTopicPackPage(root) {
    renderTopicPackPage(this, root);
  }
  renderCataloguePage(root) {
    renderCataloguePage(this, root);
  }
  renderOrderedCollection(detail, collection, title) {
    renderOrderedCollection(this, detail, collection, title);
  }
  renderLegacyList(root) {
    renderLegacyList(this, root);
  }
  renderRecordActions(detail, record4) {
    renderRecordActions(this, detail, record4);
  }
  renderAttachments(detail, record4) {
    renderAttachments(this, detail, record4);
  }
  renderRelated(detail, record4) {
    renderRelated(this, detail, record4);
  }
  renderSourceDetail(detail, record4) {
    renderSourceDetail(this, detail, record4);
  }
  renderTechnical(detail, record4) {
    renderTechnical(this, detail, record4);
  }
};

// src/features/module/model.ts
var MODULE_TABS = [
  ["overview", "Overview"],
  ["units", "Units"],
  ["resources", "Resources"],
  ["logistics", "Logistics"]
];
function nonNull(value) {
  return value !== null;
}
function isModuleScreen(value) {
  return value === "groups" || value === "list" || value === "detail";
}
function isModuleTab(value) {
  return MODULE_TABS.some(
    ([tab]) => tab === value
  );
}
function readModuleViewState(value) {
  if (!isRecord2(value)) {
    return {
      screen: "groups",
      groupId: null,
      query: "",
      moduleId: null,
      hasComponentId: false,
      hasTab: false
    };
  }
  const moduleId = asString(value.moduleId);
  const screen = isModuleScreen(
    value.screen
  ) ? value.screen : moduleId ? "detail" : "groups";
  const hasComponentId = Object.prototype.hasOwnProperty.call(
    value,
    "componentId"
  );
  const hasTab = Object.prototype.hasOwnProperty.call(
    value,
    "tab"
  );
  const componentId = !hasComponentId ? void 0 : value.componentId === null ? null : asString(
    value.componentId
  );
  const tab = !hasTab ? void 0 : value.tab === null ? null : isModuleTab(value.tab) ? value.tab : null;
  return {
    screen,
    groupId: asString(value.groupId),
    query: typeof value.query === "string" ? value.query : "",
    moduleId,
    componentId,
    tab,
    hasComponentId,
    hasTab
  };
}
function readThematicGroup2(record4) {
  if (!record4) {
    return null;
  }
  const id2 = asString(record4.id);
  if (!id2) {
    return null;
  }
  return {
    id: id2,
    title: asString(record4.title) ?? asString(record4.label) ?? id2,
    description: asText(record4.description) ?? ""
  };
}
function readComponents(value) {
  return asRecords(value).map((record4) => {
    const id2 = asString(record4.id);
    if (!id2) {
      return null;
    }
    return {
      id: id2,
      title: asString(record4.short_title) ?? asString(record4.title) ?? id2
    };
  }).filter(nonNull);
}
function readExamination(value) {
  const examination = isRecord2(value) ? value : {};
  return {
    type: asString(examination.type),
    notes: asText(examination.notes)
  };
}
function readModuleRecord(record4, fallbackId = null) {
  if (!record4) {
    return null;
  }
  const id2 = asString(record4.id) ?? fallbackId;
  if (!id2) {
    return null;
  }
  return {
    record: record4,
    id: id2,
    areaId: asString(record4.area_id) ?? "",
    title: asString(record4.title) ?? id2,
    kind: asString(record4.kind) ?? "Module",
    code: asText(record4.code) ?? "",
    semester: asText(record4.semester) ?? "",
    status: asString(record4.status) ?? "unspecified",
    institution: asText(record4.institution) ?? "",
    credits: asText(record4.credits),
    examination: readExamination(record4.examination),
    components: readComponents(record4.components),
    unitOrder: asStrings(record4.unit_order)
  };
}
function normalizeUnitRecord(record4) {
  const id2 = asString(record4.id);
  if (!id2) {
    return null;
  }
  const title = asString(record4.title) ?? id2;
  const status = asString(record4.status) ?? "unspecified";
  const order = asCount(record4.order);
  const normalized = {
    ...record4,
    id: id2,
    title,
    status,
    scope: asText(record4.scope) ?? ""
  };
  return {
    record: normalized,
    id: id2,
    title,
    status,
    order
  };
}
function orderModuleUnits(module2, units) {
  const authoredOrder = new Map(
    module2.unitOrder.map(
      (unitId, index) => [unitId, index]
    )
  );
  return [...units].sort(
    (left, right) => {
      const leftRank = authoredOrder.get(left.id);
      const rightRank = authoredOrder.get(right.id);
      if (leftRank !== void 0 || rightRank !== void 0) {
        return (leftRank ?? Number.MAX_SAFE_INTEGER) - (rightRank ?? Number.MAX_SAFE_INTEGER);
      }
      return left.order - right.order || left.title.localeCompare(right.title);
    }
  );
}
function normalizeWorkspaceRecord(record4) {
  return {
    ...record4,
    id: asString(record4.id) ?? "",
    title: asString(record4.title) ?? asString(record4.id) ?? "Workspace",
    status: asString(record4.status) ?? "unspecified",
    objective: asText(record4.objective) ?? "",
    next_action: asText(record4.next_action) ?? "",
    deadline: asText(record4.deadline) ?? "",
    standing: record4.standing === true,
    module_ids: asStrings(record4.module_ids),
    unit_ids: asStrings(record4.unit_ids)
  };
}
function readProgress(value) {
  const progress = isRecord2(value) ? value : {};
  return {
    stagesComplete: asCount(
      progress.stages_complete
    ),
    stagesTotal: asCount(
      progress.stages_total
    ),
    unitsTotal: asCount(
      progress.units_total
    )
  };
}
function readDeadlineModules(value) {
  return asRecords(value).map((record4) => {
    const moduleId = asString(record4.module_id);
    if (!moduleId) {
      return null;
    }
    return {
      moduleId,
      action: asText(record4.action)
    };
  }).filter(nonNull);
}
function readAcademicDeadline(record4) {
  const startDate = asString(record4.start_date) ?? "";
  const endDate = asString(record4.end_date) ?? "";
  return {
    record: record4,
    kind: asString(record4.kind) ?? "academic-date",
    label: asString(record4.label) ?? asString(record4.title) ?? "Academic date",
    title: asString(record4.title) ?? "",
    startDate,
    endDate,
    time: asText(record4.time),
    registrationState: asString(
      record4.registration_state
    ) ?? "unregistered",
    directModuleId: asString(record4.module_id),
    modules: readDeadlineModules(record4.modules)
  };
}
function readSourceEntries(value) {
  return asRecords(value).map((record4) => ({
    record: record4,
    role: asString(record4.role) ?? "unassigned",
    sourceId: asString(record4.source_id),
    why: asText(record4.why) ?? "",
    unitRouteCount: Array.isArray(record4.unit_routes) ? record4.unit_routes.length : 0
  }));
}

// src/features/module/actions.ts
async function selectTab(view, tab) {
  if (!view.moduleId) {
    return;
  }
  view.tab = tab;
  await view.plugin.router.remember({
    name: "module-detail",
    moduleId: view.moduleId,
    componentId: view.componentId,
    tab
  });
  await view.leaf.setViewState({
    type: VIEW_MODULE,
    active: true,
    state: {
      screen: "detail",
      moduleId: view.moduleId,
      componentId: view.componentId,
      tab
    }
  });
}
async function selectComponent(view, componentId) {
  if (!view.moduleId) {
    return;
  }
  view.componentId = componentId;
  const tab = view.tab ?? "units";
  await view.plugin.router.remember({
    name: "module-detail",
    moduleId: view.moduleId,
    componentId,
    tab
  });
  await view.leaf.setViewState({
    type: VIEW_MODULE,
    active: true,
    state: {
      screen: "detail",
      moduleId: view.moduleId,
      componentId,
      tab
    }
  });
}
function renderSources(view, root, module2) {
  const sourceMap = view.plugin.store.sourceMap(
    module2.id
  );
  const entries = readSourceEntries(
    sourceMap ? sourceMap.sources : null
  );
  if (!entries.length) {
    empty(
      root,
      "No routed module sources yet",
      "Sources remain globally registered."
    );
    return;
  }
  root.createEl("p", {
    cls: "los-muted",
    text: "Roles in this module \u2014 not global quality scores."
  });
  const groups = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const current = groups.get(entry.role);
    if (current) {
      current.push(entry);
    } else {
      groups.set(
        entry.role,
        [entry]
      );
    }
  }
  for (const [role, roleEntries] of groups) {
    const group = root.createDiv({
      cls: "los-source-role"
    });
    group.createDiv({
      cls: "los-group-title",
      text: role.replaceAll("-", " ")
    });
    for (const entry of roleEntries) {
      const row3 = group.createDiv({
        cls: "los-row"
      });
      const source = entry.sourceId ? view.plugin.store.get(
        entry.sourceId
      ) : null;
      if (source) {
        chip(
          row3,
          source,
          (record4) => {
            const id2 = asString(
              record4.id
            );
            if (!id2) {
              return;
            }
            return view.plugin.nav.openLibrary(id2);
          }
        );
      }
      row3.createEl("p", {
        text: entry.why
      });
      if (entry.unitRouteCount) {
        row3.createDiv({
          cls: "los-micro",
          text: `${entry.unitRouteCount} routed unit(s)`
        });
      }
    }
  }
}

// src/features/module/logistics.ts
var EXAMINATION_LABELS = {
  klausur: "Written exam",
  muendlich: "Oral exam",
  portfolio: "Portfolio",
  project: "Project assessment"
};
function words(value) {
  const normalized = value.replaceAll("_", " ").replaceAll("-", " ").trim();
  return normalized ? normalized[0].toLocaleUpperCase() + normalized.slice(1) : "";
}
function semesterLabel(value) {
  const summer = /^sose-(\d{4})$/i.exec(value);
  if (summer) {
    return `Summer semester ${summer[1]}`;
  }
  const winter = /^wise-(\d{4})(?:-(\d{2,4}))?$/i.exec(value);
  if (winter) {
    const end = winter[2] ? `/${winter[2].length === 4 ? winter[2].slice(2) : winter[2]}` : "";
    return `Winter semester ${winter[1]}${end}`;
  }
  return words(value);
}
function examinationLabel(value) {
  return EXAMINATION_LABELS[value.toLocaleLowerCase()] ?? words(value);
}
function statusLabel(value) {
  return words(value);
}
function renderLogistics(view, root, module2) {
  const factRows = [
    ["Status", statusLabel(module2.status)],
    ["Institution", module2.institution],
    ["Code", module2.code],
    ["Semester", semesterLabel(module2.semester)],
    ["Credits", module2.credits],
    [
      "Examination",
      module2.examination.type ? examinationLabel(
        module2.examination.type
      ) : null
    ]
  ];
  factList(root, factRows);
  if (module2.examination.notes) {
    root.createEl("p", {
      cls: "los-muted",
      text: module2.examination.notes
    });
  }
  view.renderAcademicDates(
    root,
    module2
  );
}
function deadlinesFor(view, module2) {
  return view.plugin.store.rows("academic_deadlines").map(
    (record4) => readAcademicDeadline(record4)
  ).filter(
    (row3) => row3.directModuleId === module2.id || row3.modules.some(
      (entry) => entry.moduleId === module2.id
    )
  ).sort(
    (a, b) => a.startDate.localeCompare(
      b.startDate
    )
  );
}
function renderAcademicDates(view, root, module2) {
  const rows = view.deadlinesFor(module2);
  if (!rows.length) {
    return;
  }
  const wrap = section(
    root,
    "Academic dates",
    "Registration windows and exam sittings for this module."
  );
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const ahead = rows.filter(
    (row3) => (row3.endDate || row3.startDate) >= today
  );
  const past = rows.filter(
    (row3) => (row3.endDate || row3.startDate) < today
  );
  if (ahead.length) {
    view.renderDeadlineRows(
      wrap,
      module2,
      ahead
    );
  } else {
    empty(
      wrap,
      "No upcoming date recorded",
      "Past dates remain available below."
    );
  }
  if (past.length) {
    const history = disclosure(
      wrap,
      `Past dates (${past.length})`,
      "los-deadline-history"
    );
    view.renderDeadlineRows(
      history,
      module2,
      past
    );
  }
}
function renderDeadlineRows(wrap, module2, rows) {
  const list2 = wrap.createDiv({
    cls: "los-date-list"
  });
  for (const row3 of rows) {
    const card = list2.createDiv({
      cls: `los-date-row los-deadline-${row3.kind}`
    });
    const date3 = row3.endDate && row3.endDate !== row3.startDate ? `${row3.startDate} \u2192 ${row3.endDate}` : row3.startDate;
    card.createDiv({
      cls: "los-date-when",
      text: date3
    });
    const copy = card.createDiv({
      cls: "los-date-copy"
    });
    copy.createEl("strong", {
      text: row3.label
    });
    if (row3.kind === "registration-window") {
      const entry = row3.modules.find(
        (item) => item.moduleId === module2.id
      );
      if (entry?.action) {
        copy.createEl("p", {
          cls: "los-micro",
          text: entry.action
        });
      }
    } else {
      copy.createDiv({
        cls: "los-micro",
        text: row3.title || module2.title
      });
      const facts = copy.createDiv({
        cls: "los-row"
      });
      badge(
        facts,
        row3.registrationState,
        row3.registrationState || "needs-map"
      );
      if (row3.time) {
        facts.createSpan({
          cls: "los-micro",
          text: row3.time
        });
      }
    }
  }
}

// src/features/module/detail.ts
function renderModuleDetail(view, root) {
  const moduleRecord = view.moduleId ? view.plugin.store.get(
    view.moduleId
  ) : null;
  const module2 = readModuleRecord(
    moduleRecord,
    view.moduleId
  );
  const back = button(
    root,
    "\u2039 Back",
    () => view.plugin.nav.back(),
    "quiet"
  );
  back.addClass("los-route-back");
  if (!module2) {
    empty(
      root,
      "Module unavailable",
      "Return to Modules and choose another module."
    );
    return;
  }
  const tab = view.tab ?? view.defaultTab(module2);
  const header = pageHeader(
    root,
    module2.kind,
    module2.title
  );
  if (module2.areaId === "program-job") {
    badge(header, "Job", "role");
  }
  header.createDiv({
    cls: "los-module-facts",
    text: view.headline(module2)
  });
  const tabs = root.createDiv({
    cls: "los-tabs",
    attr: {
      role: "group",
      "aria-label": "Module sections"
    }
  });
  enableButtonGroupKeyboardNavigation(tabs);
  for (const [key, label] of MODULE_TABS) {
    const control = button(
      tabs,
      label,
      () => view.selectTab(key),
      key === tab ? "cta" : "quiet"
    );
    control.setAttrs({
      "aria-pressed": String(key === tab)
    });
  }
  if (tab === "overview") {
    view.renderOverview(
      root,
      module2
    );
  } else if (tab === "units") {
    view.renderUnits(
      root,
      module2
    );
  } else if (tab === "resources") {
    view.renderSources(
      root,
      module2
    );
  } else {
    view.renderLogistics(
      root,
      module2
    );
  }
}
function headline(view, module2) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const nextDate = view.deadlinesFor(module2).filter(
    (row3) => (row3.endDate || row3.startDate) >= today
  ).map((row3) => row3.startDate)[0];
  return [
    semesterLabel(module2.semester),
    module2.credits ? `${module2.credits} LP` : "",
    module2.examination.type ? `${examinationLabel(
      module2.examination.type
    )}${nextDate ? ` ${nextDate}` : ""}` : ""
  ].filter(Boolean).join(" \xB7 ");
}
function renderOverview(view, root, module2) {
  const progress = readProgress(
    view.plugin.store.progress(
      module2.id
    )
  );
  const wrap = root.createDiv({
    cls: "los-overview"
  });
  wrap.createDiv({
    cls: "los-overview-progress",
    text: `${progress.stagesComplete} of ${progress.stagesTotal} stages complete across ${progress.unitsTotal} unit${progress.unitsTotal === 1 ? "" : "s"}`
  });
  const workspaces = view.plugin.store.workspacesForModule(module2.id).map(
    (record4) => normalizeWorkspaceRecord(record4)
  );
  for (const workspace of workspaces) {
    workspaceCard(
      wrap,
      view.plugin,
      workspace,
      module2.id
    );
  }
  if (!workspaces.length) {
    empty(
      wrap,
      "No active coordination workspace",
      "The module/unit tree still owns study state."
    );
  }
  const units = orderModuleUnits(
    module2,
    view.plugin.store.unitsFor(module2.id).map(
      (record4) => normalizeUnitRecord(record4)
    ).filter(nonNull)
  );
  const next = units.find(
    (unit) => unit.status === "active"
  ) ?? units[0];
  if (next) {
    button(
      wrap,
      `Continue ${next.title}`,
      () => view.plugin.nav.openUnit(next.id),
      "cta"
    );
  }
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const ahead = view.deadlinesFor(module2).filter(
    (row3) => (row3.endDate || row3.startDate) >= today
  );
  if (ahead.length) {
    view.renderDeadlineRows(
      wrap,
      module2,
      ahead.slice(0, 1)
    );
  }
}
function renderUnits(view, root, module2) {
  if (module2.components.length) {
    const tabs = root.createDiv({
      cls: "los-subtabs",
      attr: {
        role: "group",
        "aria-label": "Module components"
      }
    });
    enableButtonGroupKeyboardNavigation(tabs);
    const allTab = button(
      tabs,
      "All components",
      () => view.selectComponent(null),
      view.componentId ? "quiet" : "row"
    );
    allTab.setAttrs({
      "aria-pressed": String(!view.componentId)
    });
    for (const component of module2.components) {
      const control = button(
        tabs,
        component.title,
        () => view.selectComponent(
          component.id
        ),
        view.componentId === component.id ? "row" : "quiet"
      );
      control.setAttrs({
        "aria-pressed": String(
          view.componentId === component.id
        )
      });
    }
  }
  const units = view.plugin.store.unitsFor(
    module2.id,
    view.componentId
  ).map(
    (record4) => normalizeUnitRecord(record4)
  ).filter(nonNull);
  if (!units.length) {
    empty(
      root,
      "No units in this component",
      "Return to all components."
    );
    return;
  }
  const ordered = orderModuleUnits(
    module2,
    units
  );
  const heading = root.createDiv({
    cls: "los-section-heading los-module-units-heading"
  });
  heading.createEl("h2", {
    text: "Units"
  });
  heading.createSpan({
    text: `${ordered.length} unit${ordered.length === 1 ? "" : "s"} \xB7 ${ordered.filter(
      (unit) => unit.status === "active"
    ).length} in progress`
  });
  const list2 = root.createDiv({
    cls: "los-record-list los-module-unit-list"
  });
  for (const unit of ordered) {
    const map = view.plugin.store.mapForUnit(
      unit.id
    );
    const stages = map ? asRecords(map.stages) : [];
    const complete = stages.filter(
      (stage) => stage.status === "complete"
    ).length;
    const currentStageId = map ? asString(map.current_stage) : null;
    const currentStage = currentStageId ? stages.find(
      (stage) => stage.id === currentStageId
    ) : null;
    const row3 = list2.createEl("button", {
      cls: "los-record-row is-clickable",
      attr: {
        type: "button",
        "aria-label": `Open unit: ${unit.title}`
      }
    });
    const copy = row3.createDiv({
      cls: "los-record-copy"
    });
    copy.createEl("strong", {
      text: unit.title
    });
    const meta = [
      unit.status.replaceAll("-", " "),
      map ? `${complete} of ${stages.length} stages` : "No study map yet",
      currentStage ? `Current \xB7 ${asString(currentStage.title) ?? currentStageId}` : ""
    ].filter(Boolean).join(" \xB7 ");
    copy.createDiv({
      cls: "los-record-meta",
      text: meta
    });
    if (map) {
      row3.createSpan({
        cls: "los-record-action",
        text: "Open \u2192"
      });
    } else {
      badge(
        row3,
        "No map",
        "needs-map"
      );
    }
    row3.addEventListener(
      "click",
      () => {
        view.selectedElementId = unit.id;
        return view.plugin.nav.openUnit(unit.id);
      }
    );
  }
}

// src/features/module/navigation.ts
function renderGroups(view, root) {
  const semester = view.plugin.store.currentSemester();
  const modules = view.plugin.store.currentSemesterModules().map(
    (record4) => readModuleRecord(record4)
  ).filter(nonNull);
  pageHeader(
    root,
    typeof semester?.title === "string" ? `Modules \xB7 ${semester.title}` : "Modules",
    "Modules",
    "The modules you are taking this semester. Your complete source collection lives in Library."
  );
  if (!modules.length) {
    empty(
      root,
      "No current-semester modules",
      "The Core projection does not currently identify any enrolled academic modules for this semester."
    );
    return;
  }
  const summary = root.createDiv({
    cls: "los-semester-summary"
  });
  summary.createEl("strong", {
    text: typeof semester?.title === "string" ? semester.title : "Current semester"
  });
  summary.createSpan({
    text: `${modules.length} enrolled module${modules.length === 1 ? "" : "s"}`
  });
  const list2 = root.createDiv({
    cls: "los-route-list los-semester-module-list"
  });
  for (const module2 of modules) {
    const progress = readProgress(
      view.plugin.store.progress(module2.id)
    );
    const row3 = list2.createEl(
      "button",
      {
        cls: "los-route-row los-semester-module-row is-clickable",
        attr: {
          type: "button",
          "aria-label": `Open module: ${module2.title}`,
          "data-record-id": module2.id
        }
      }
    );
    const copy = row3.createDiv({
      cls: "los-route-row-copy"
    });
    copy.createEl("strong", {
      text: module2.title
    });
    const facts = [
      module2.code,
      progress.stagesTotal ? `${progress.stagesComplete} of ${progress.stagesTotal} stages` : `${progress.unitsTotal} unit${progress.unitsTotal === 1 ? "" : "s"}`
    ].filter(Boolean);
    copy.createDiv({
      cls: "los-route-meta",
      text: facts.join(" \xB7 ")
    });
    row3.createSpan({
      cls: "los-route-open",
      text: "Open \u2192"
    });
    row3.addEventListener(
      "click",
      () => {
        view.selectedElementId = module2.id;
        return view.plugin.nav.openModuleDetail(module2.id);
      }
    );
  }
}
function renderGroupList(view, root) {
  const groupRecord = view.groupId ? view.plugin.store.get(
    view.groupId
  ) : null;
  const group = readThematicGroup2(groupRecord);
  const back = button(
    root,
    "\u2039 Modules",
    () => view.plugin.nav.back(),
    "quiet"
  );
  back.addClass("los-route-back");
  if (!group) {
    empty(
      root,
      "Thematic group unavailable",
      "Return to Modules and choose another group.",
      "Back",
      () => view.plugin.nav.back()
    );
    return;
  }
  pageHeader(
    root,
    "Modules",
    group.title,
    group.description || "Modules in this thematic group."
  );
  const search = root.createEl(
    "input",
    {
      cls: "los-search los-route-search",
      attr: {
        type: "search",
        placeholder: `Search ${group.title} modules\u2026`,
        "aria-label": `Search ${group.title} modules`
      }
    }
  );
  search.value = view.query;
  search.addEventListener(
    "input",
    async () => {
      view.query = search.value;
      await view.plugin.router.remember({
        name: "module-list",
        groupId: group.id,
        query: view.query
      });
      view.render();
    }
  );
  const all = view.plugin.store.modulesForGroup(group.id).map(
    (record4) => readModuleRecord(record4)
  ).filter(nonNull);
  const needle = view.query.trim().toLocaleLowerCase();
  const rows = all.filter(
    (module2) => {
      if (!needle) {
        return true;
      }
      return [
        module2.title,
        module2.code,
        module2.kind,
        module2.semester
      ].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle);
    }
  );
  if (!all.length) {
    empty(
      root,
      "No modules in this group",
      "The group exists, but no modules currently reference it."
    );
    return;
  }
  if (!rows.length) {
    empty(
      root,
      "No matching modules",
      `Nothing in ${group.title} matches \u201C${view.query.trim()}\u201D.`,
      "Clear search",
      async () => {
        view.query = "";
        await view.plugin.router.remember({
          name: "module-list",
          groupId: group.id,
          query: ""
        });
        view.render();
      }
    );
    return;
  }
  const list2 = root.createDiv({
    cls: "los-route-list"
  });
  for (const module2 of rows) {
    const row3 = list2.createEl(
      "button",
      {
        cls: "los-route-row is-clickable",
        attr: {
          type: "button",
          "aria-label": `Open module: ${module2.title}`,
          "data-record-id": module2.id
        }
      }
    );
    const copy = row3.createDiv({
      cls: "los-route-row-copy"
    });
    copy.createEl("strong", {
      text: module2.title
    });
    const meta = [
      module2.code,
      module2.kind,
      module2.semester,
      module2.status
    ].filter(Boolean).join(" \xB7 ");
    if (meta) {
      copy.createDiv({
        cls: "los-route-meta",
        text: meta
      });
    }
    row3.createSpan({
      cls: "los-route-open",
      text: "Open \u2192"
    });
    row3.addEventListener(
      "click",
      () => {
        view.selectedElementId = module2.id;
        return view.plugin.nav.openModuleDetail(module2.id);
      }
    );
  }
}

// src/views/module-view.ts
var import_obsidian9 = require("obsidian");
var ModuleView = class extends import_obsidian9.ItemView {
  plugin;
  screen;
  groupId;
  query;
  moduleId;
  componentId;
  tab;
  selectedElementId;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.screen = "groups";
    this.groupId = null;
    this.query = "";
    this.moduleId = null;
    this.componentId = null;
    this.tab = null;
    this.selectedElementId = null;
  }
  getViewType() {
    return VIEW_MODULE;
  }
  getDisplayText() {
    return "LearningOS \xB7 Modules";
  }
  async setState(state = {}) {
    const parsed = readModuleViewState(state);
    const nextModuleId = parsed.moduleId;
    if (nextModuleId !== this.moduleId) {
      this.componentId = null;
      this.tab = null;
    }
    this.screen = parsed.screen;
    this.groupId = parsed.groupId;
    this.query = parsed.query;
    this.moduleId = nextModuleId;
    if (parsed.hasComponentId) {
      this.componentId = parsed.componentId ?? null;
    }
    if (parsed.hasTab) {
      this.tab = parsed.tab ?? null;
    }
    this.render();
  }
  getState() {
    return {
      screen: this.screen,
      groupId: this.groupId,
      query: this.query,
      moduleId: this.moduleId,
      componentId: this.componentId,
      tab: this.tab
    };
  }
  async onOpen() {
    await this.setState(
      this.leaf.getViewState().state
    );
  }
  /** Units unless there is nothing to study yet. */
  defaultTab(module2) {
    return this.plugin.store.unitsFor(module2.id).length ? "units" : "overview";
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass(
      "los-root",
      "los-module-view"
    );
    if (this.screen === "list") {
      this.renderGroupList(root);
      return;
    }
    if (this.screen === "detail") {
      this.renderModuleDetail(root);
      return;
    }
    this.renderGroups(root);
  }
  renderGroups(root) {
    renderGroups(this, root);
  }
  renderGroupList(root) {
    renderGroupList(this, root);
  }
  renderModuleDetail(root) {
    renderModuleDetail(this, root);
  }
  /** One line instead of six labelled facts; the rest is in Logistics. */
  headline(module2) {
    return headline(this, module2);
  }
  renderOverview(root, module2) {
    renderOverview(this, root, module2);
  }
  renderUnits(root, module2) {
    renderUnits(this, root, module2);
  }
  renderLogistics(root, module2) {
    renderLogistics(this, root, module2);
  }
  deadlinesFor(module2) {
    return deadlinesFor(this, module2);
  }
  renderAcademicDates(root, module2) {
    renderAcademicDates(this, root, module2);
  }
  renderDeadlineRows(wrap, module2, rows) {
    renderDeadlineRows(wrap, module2, rows);
  }
  async selectTab(tab) {
    await selectTab(this, tab);
  }
  async selectComponent(componentId) {
    await selectComponent(this, componentId);
  }
  renderSources(root, module2) {
    renderSources(this, root, module2);
  }
};

// src/views/nav-view.ts
var import_obsidian10 = require("obsidian");
var NavView = class extends import_obsidian10.ItemView {
  plugin;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_NAV;
  }
  getDisplayText() {
    return "LearningOS \xB7 Navigator";
  }
  getIcon() {
    return "route";
  }
  async onOpen() {
    this.render();
  }
  nav(parent, iconName, label, key, action) {
    const active = this.plugin.activeNav === key;
    const row3 = parent.createEl("button", {
      cls: `los-app-nav-item is-clickable${active ? " is-active" : ""}`,
      attr: { type: "button", "aria-current": active ? "page" : "false" }
    });
    icon(row3.createSpan(), iconName);
    row3.createSpan({ text: label });
    row3.addEventListener("click", action);
    return row3;
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-app-nav");
    const brand = root.createDiv({ cls: "los-nav-brand" });
    icon(brand.createSpan({ cls: "los-brand-mark" }), "route");
    brand.createEl("strong", { text: "LearningOS" });
    const search = brand.createEl("button", {
      cls: "los-nav-search is-clickable",
      attr: { type: "button", "aria-label": "Search LearningOS", title: "Search LearningOS" }
    });
    icon(search.createSpan(), "search");
    search.addEventListener("click", () => this.plugin.nav.openGlobalSearch());
    const primary = root.createDiv({ cls: "los-nav-primary" });
    enableButtonGroupKeyboardNavigation(primary, "vertical");
    this.nav(primary, "home", "Home", "home", () => this.plugin.nav.openHome());
    this.nav(primary, "layout-grid", "Modules", "modules", () => this.plugin.nav.openModules());
    this.nav(primary, "graduation-cap", "Learn", "learn", () => this.plugin.nav.openLearn());
    this.nav(primary, "briefcase-business", "Projects", "projects", () => this.plugin.nav.openProjects());
    this.nav(primary, "library", "Library", "library", () => this.plugin.nav.openLibrary());
    this.nav(primary, "sprout", "Garden", "garden", () => this.plugin.nav.openGarden());
    this.nav(primary, "check-check", "Review", "review", () => this.plugin.nav.openReview());
    const more = root.createEl("details", { cls: "los-nav-more" });
    if (this.plugin.settings.navMoreOpen) more.setAttr("open", "open");
    more.createEl("summary", { cls: "los-nav-more-trigger", text: "More" });
    more.addEventListener("toggle", () => {
      this.plugin.settings.navMoreOpen = more.hasAttribute("open");
      this.plugin.scheduleDraftSave();
    });
    const secondary = more.createDiv({ cls: "los-nav-secondary" });
    enableButtonGroupKeyboardNavigation(secondary, "vertical");
    this.nav(secondary, "plus", "Capture", "capture", () => this.plugin.nav.openCapture());
    this.nav(secondary, "map", "Concept atlas", "atlas", () => this.plugin.nav.openAtlas());
    this.nav(
      secondary,
      "shield",
      "Future Master\u2019s Planning",
      "masters",
      () => this.plugin.nav.openBoundary("program-masters-planning")
    );
    this.nav(secondary, "activity", "Diagnostics", "diagnostics", () => this.plugin.nav.openDiagnostics());
    this.nav(secondary, "refresh-cw", "Rebuild projection", "rebuild", () => this.plugin.generate());
  }
};

// src/views/program-view.ts
var import_obsidian11 = require("obsidian");
var COORDINATION_HEADINGS = [
  "Priorities",
  "Commitments",
  "Dependencies",
  "Deferrals"
];
function readProgramSemesters(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const semesters = [];
  for (const candidate of value) {
    if (!isRecord2(candidate) || typeof candidate.title !== "string" || typeof candidate.status !== "string") {
      continue;
    }
    semesters.push({
      title: candidate.title,
      status: candidate.status
    });
  }
  return semesters;
}
var ProgramView = class extends import_obsidian11.ItemView {
  plugin;
  programId = null;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_PROGRAM;
  }
  getDisplayText() {
    if (this.programId === "inbox") {
      return "LearningOS \xB7 Capture";
    }
    if (this.programId === "queue-needs-map") {
      return "LearningOS \xB7 Planning";
    }
    const program = this.programId ? this.plugin.store.get(this.programId) : null;
    const title = typeof program?.title === "string" ? program.title : "Learn";
    return `LearningOS \xB7 ${title}`;
  }
  async setState(state = {}) {
    if (typeof state.programId === "string") {
      this.programId = state.programId;
    }
    this.render();
    this.leaf.updateHeader?.();
  }
  getState() {
    return {
      programId: this.programId
    };
  }
  async onOpen() {
    const programId = this.leaf.getViewState().state?.programId;
    if (typeof programId === "string") {
      this.programId = programId;
    }
    this.render();
    this.leaf.updateHeader?.();
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-program-view");
    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        "LearningOS",
        "Projection unavailable"
      );
      empty(
        root,
        "The interface contract could not be loaded",
        this.plugin.store.error,
        "Rebuild views",
        () => this.plugin.generate()
      );
      return;
    }
    if (this.programId === "queue-needs-map") {
      this.renderNeedsMap(root);
      return;
    }
    if (this.programId === "inbox") {
      this.renderInbox(root);
      return;
    }
    const program = this.programId ? this.plugin.store.get(this.programId) : null;
    if (!program) {
      empty(
        root,
        "Area unavailable",
        "Return Home and choose another area."
      );
      return;
    }
    pageHeader(
      root,
      "Learn",
      "Learning horizon",
      "Current commitments, long-running skills, and the degree structure they belong to."
    );
    const tabs = root.createDiv({
      cls: "los-tabs los-program-tabs",
      attr: {
        role: "group",
        "aria-label": "Learning areas"
      }
    });
    enableButtonGroupKeyboardNavigation(tabs);
    for (const [areaId, title] of LEARN_AREAS) {
      const active = areaId === program.id;
      const tab = button(
        tabs,
        title,
        () => this.plugin.nav.openLearn(areaId),
        active ? "cta" : "quiet"
      );
      tab.setAttrs({
        "aria-pressed": String(active)
      });
    }
    if (typeof program.description === "string" && program.description) {
      root.createEl("p", {
        cls: "los-muted",
        text: program.description
      });
    }
    const semesters = readProgramSemesters(
      program.semesters
    );
    const currentSemester = semesters.find(
      (semester) => semester.status === "current"
    );
    const modules = program.id ? this.plugin.store.modulesFor(program.id) : [];
    const context = root.createDiv({
      cls: "los-learning-context"
    });
    context.createEl("h2", {
      text: currentSemester?.title ?? (program.id === "program-skills" ? "Long-running tracks" : projectedExcerpt(
        program.title,
        80
      ) || "Learning")
    });
    context.createSpan({
      text: `${modules.length} commitment${modules.length === 1 ? "" : "s"} \xB7 ${currentSemester?.status ?? projectedExcerpt(program.status, 40)}`
    });
    const list2 = root.createDiv({
      cls: "los-learning-list"
    });
    if (!modules.length) {
      if (program.id === "program-thesis-projects") {
        empty(
          root,
          "Projects have their own operating space",
          "The horizon keeps the commitment visible; project structure, decisions, and files stay together in Projects.",
          "Open Projects",
          () => this.plugin.nav.openProjects()
        );
      } else {
        empty(
          root,
          "No commitments in this area yet",
          "Nothing is hidden."
        );
      }
    }
    for (const module2 of modules) {
      const row3 = list2.createDiv({
        cls: "los-learning-row"
      });
      const copy = row3.createDiv({
        cls: "los-learning-copy"
      });
      const title = button(
        copy,
        projectedExcerpt(
          module2.title,
          180
        ) || projectedExcerpt(module2.id, 180),
        () => this.plugin.nav.openModule(
          projectedExcerpt(module2.id, 180)
        ),
        "row"
      );
      title.addClass("los-learning-title");
      if (program.id === "program-job") {
        badge(copy, "Job", "role");
      }
      const examination = isRecord2(
        module2.examination
      ) ? projectedExcerpt(
        module2.examination.type,
        80
      ) : "";
      const meta = [
        projectedExcerpt(module2.status, 60),
        module2.credits ? `${projectedExcerpt(module2.credits, 20)} LP` : "",
        examination
      ].filter(Boolean).join(" \xB7 ");
      row3.createDiv({
        cls: "los-learning-meta los-micro",
        text: meta
      });
    }
    if (Boolean(program.semester_bound)) {
      const semesters2 = disclosure(root, "Semesters");
      for (const semester of readProgramSemesters(program.semesters)) {
        const row3 = semesters2.createDiv({
          cls: "los-row"
        });
        row3.createEl("strong", {
          text: semester.title
        });
        badge(
          row3,
          semester.status,
          semester.status
        );
      }
    }
    this.renderCoordination(root);
  }
  /**
   * The full coordination record — commitments, dependencies, deferrals — moved
   * off Home to here. Home carries the one-line priority; this is where the
   * whole decision layer is read when the learner actually wants it.
   */
  renderCoordination(root) {
    const coordination = this.plugin.store.get("coordination");
    const sections = isRecord2(coordination?.sections) ? coordination.sections : {};
    const rows = COORDINATION_HEADINGS.map(
      (heading) => [
        heading,
        projectedExcerpt(
          sections[heading],
          1600
        )
      ]
    ).filter((row3) => Boolean(row3[1]));
    if (!rows.length) {
      return;
    }
    const panel = disclosure(
      root,
      "Semester coordination",
      "los-coordination-details"
    );
    for (const [heading, body] of rows) {
      const row3 = panel.createDiv({
        cls: "los-coordination-row"
      });
      row3.createEl("strong", {
        text: heading
      });
      row3.createEl("p", {
        text: body
      });
    }
  }
  renderNeedsMap(root) {
    pageHeader(
      root,
      "Review",
      "Units needing a study map"
    );
    const grid = root.createDiv({
      cls: "los-card-grid"
    });
    const units = this.plugin.store.units().filter(
      (row3) => row3.needs_study_map === true
    );
    for (const unit of units) {
      unitCard(grid, this.plugin, unit);
    }
  }
  renderInbox(root) {
    pageHeader(
      root,
      "",
      "Capture",
      "You capture; the operator files."
    );
    const count = this.plugin.store.data?.counts?.inbox_items || 0;
    const wrap = section(
      root,
      `${count} item${count === 1 ? "" : "s"} awaiting routing`
    );
    const form = wrap.createDiv({
      cls: "los-capture-grid"
    });
    const textPanel = form.createDiv({
      cls: "los-capture-panel"
    });
    textPanel.createEl("h3", {
      text: "Quick text"
    });
    const title = textPanel.createEl("input", {
      cls: "los-search los-capture-title",
      attr: {
        type: "text",
        placeholder: "Optional title",
        "aria-label": "Capture title"
      }
    });
    const editor = textPanel.createEl("textarea", {
      cls: "los-note-editor los-capture-editor",
      attr: {
        placeholder: "Paste a link, thought, question, or fragment\u2026",
        "aria-label": "Capture text"
      }
    });
    const draft = this.plugin.getInboxDraft();
    title.value = draft.title || "";
    editor.value = draft.text || "";
    const status = textPanel.createDiv({
      cls: "los-draft-status",
      attr: {
        "aria-live": "polite"
      }
    });
    const captureButton = button(
      textPanel,
      "Capture text",
      () => {
        const text5 = editor.value.trim();
        if (!text5) {
          new import_obsidian11.Notice(
            "Enter some text before capturing."
          );
          editor.focus();
          return;
        }
        this.capture(
          () => this.plugin.gateway.captureText(
            text5,
            title.value.trim()
          ),
          () => {
            this.plugin.clearInboxDraft();
            editor.value = "";
            title.value = "";
          }
        );
      },
      "cta"
    );
    const syncDraft = () => {
      const hasDraft = Boolean(
        title.value || editor.value
      );
      this.plugin.setInboxDraft(
        title.value,
        editor.value
      );
      captureButton.disabled = !editor.value.trim();
      status.setText(
        hasDraft ? "Draft kept locally until capture." : "Nothing entered yet."
      );
      status.toggleClass(
        "is-dirty",
        hasDraft
      );
    };
    title.addEventListener(
      "input",
      syncDraft
    );
    editor.addEventListener(
      "input",
      syncDraft
    );
    captureButton.disabled = !editor.value.trim();
    status.setText(
      title.value || editor.value ? "Draft kept locally until capture." : "Nothing entered yet."
    );
    status.toggleClass(
      "is-dirty",
      Boolean(title.value || editor.value)
    );
    const filePanel = form.createDiv({
      cls: "los-capture-panel"
    });
    filePanel.createEl("h3", {
      text: "File or handwriting"
    });
    filePanel.createEl("p", {
      cls: "los-muted",
      text: "The original is copied into the inbox; it is not moved or renamed."
    });
    const picker = filePanel.createEl("input", {
      cls: "los-file-input los-capture-file",
      attr: {
        type: "file",
        "aria-label": "Choose inbox capture file"
      }
    });
    const fileCaptureButton = button(
      filePanel,
      "Capture selected file",
      () => {
        const localPath = localFilePath(picker.files?.[0]);
        if (!localPath) {
          new import_obsidian11.Notice(
            "Choose a local file first."
          );
          return;
        }
        this.capture(
          () => this.plugin.gateway.captureFile(
            localPath
          ),
          () => {
            picker.value = "";
          }
        );
      },
      "quiet"
    );
    const syncFileCapture = () => {
      fileCaptureButton.disabled = !picker.files?.length;
      fileCaptureButton.setAttribute(
        "aria-disabled",
        String(fileCaptureButton.disabled)
      );
    };
    picker.addEventListener(
      "change",
      syncFileCapture
    );
    syncFileCapture();
  }
  async capture(action, clear = null) {
    if (this.plugin.gateway.isBusy) {
      new import_obsidian11.Notice(
        "Queued behind the running LearningOS write."
      );
    }
    try {
      await this.plugin.mutate(
        async () => {
          await action();
          await this.plugin.gateway.call(
            ["generate"],
            {
              expectJson: false
            }
          );
        }
      );
      clear?.();
      new import_obsidian11.Notice(
        "Captured to the LearningOS inbox."
      );
      this.render();
    } catch (error) {
      new import_obsidian11.Notice(errorMessage(error));
    }
  }
};

// src/features/project/files.ts
function renderFiles(view, root, project) {
  const wrap = section(
    root,
    "Files",
    "Project-owned references; canonical content remains in plain files."
  );
  const files = asRecords(project.files);
  if (!files.length) {
    empty(
      wrap,
      "No files linked",
      "Project files can be added through a declared core capability."
    );
    return;
  }
  for (const file of files) {
    const path = asString(file.path);
    const label = asString(file.label) ?? path ?? asString(file.id) ?? "Untitled file";
    const kind = asString(file.kind) ?? "file";
    const row3 = wrap.createDiv({
      cls: "los-record-row los-project-file"
    });
    const copy = row3.createDiv({
      cls: "los-record-copy los-project-link-copy"
    });
    copy.createEl("strong", {
      text: label
    });
    copy.createDiv({
      cls: "los-record-meta",
      text: path ? `${kind} \xB7 ${path}` : kind
    });
    if (path) {
      button(
        row3,
        "Open",
        () => view.plugin.openAuthoredPath(
          path
        ),
        "tertiary"
      );
    }
  }
}
function renderDecisions(root, project) {
  const wrap = section(
    root,
    "Decisions",
    "Open questions and durable decisions, without manufacturing a completion score."
  );
  const decisions = asRecords(project.decisions);
  if (!decisions.length) {
    empty(
      wrap,
      "No decisions recorded",
      "Decisions appear here when the project records them."
    );
    return;
  }
  for (const decision of decisions) {
    const status = asString(decision.status) ?? "open";
    const row3 = wrap.createDiv({
      cls: "los-record-row los-project-decision"
    });
    const copy = row3.createDiv({
      cls: "los-record-copy"
    });
    copy.createEl("strong", {
      text: asLabel(decision)
    });
    copy.createDiv({
      cls: "los-record-summary",
      text: asText(decision.summary) ?? ""
    });
    badge(
      row3,
      status,
      status
    );
  }
}

// src/features/project/model.ts
var PROJECT_TABS = [
  ["structure", "Structure"],
  ["decisions", "Decisions"],
  ["linked-materials", "Materials"],
  ["files", "Files"],
  ["overview", "Logistics"]
];
function isProjectTab(value) {
  return PROJECT_TABS.some(
    ([tab]) => tab === value
  );
}
function readProjectViewState(value) {
  if (!isRecord2(value)) {
    return {};
  }
  const screen = value.screen === "detail" ? "detail" : value.screen === "list" ? "list" : void 0;
  const projectId = value.projectId === null ? null : asString(value.projectId) ?? void 0;
  const tab = isProjectTab(value.tab) ? value.tab : void 0;
  const query = typeof value.query === "string" ? value.query : void 0;
  return {
    screen,
    projectId,
    tab,
    query
  };
}
function readProjectBoundaries(value) {
  const boundaries = isRecord2(value) ? value : {};
  return {
    confidentiality: asString(
      boundaries.confidentiality
    ) ?? "unspecified",
    externalCodeAccess: asString(
      boundaries.external_code_access
    ) ?? "unspecified",
    notes: asString(boundaries.notes)
  };
}
function readProjectStructure(value) {
  const structure = isRecord2(value) ? value : {};
  return {
    kind: asString(structure.kind) ?? "none",
    nodes: asRecords(structure.nodes)
  };
}
function readProjectRelationship(value) {
  const id2 = asString(value.id);
  const toId = asString(value.to_id);
  if (!id2 || !toId) {
    return null;
  }
  return {
    id: id2,
    toId,
    toType: asString(value.to_type) ?? "record",
    relationType: asString(value.relation_type) ?? "linked",
    reason: asString(value.reason) ?? "No rationale was projected.",
    contribution: asString(value.contribution) ?? "No contribution was projected.",
    path: asString(value.path)
  };
}

// src/features/project/structure.ts
function renderBoundaryBanner(root, project) {
  const boundaries = readProjectBoundaries(
    project.boundaries
  );
  const banner = root.createDiv({
    cls: "los-project-boundary"
  });
  banner.createDiv({
    cls: "los-kicker",
    text: "Boundary"
  });
  banner.createEl("p", {
    text: [
      `confidentiality: ${boundaries.confidentiality}`,
      `external code access: ${boundaries.externalCodeAccess}`,
      boundaries.notes
    ].filter(Boolean).join(" \xB7 ")
  });
}
function renderStructure(root, project) {
  const structure = readProjectStructure(
    project.structure
  );
  const wrap = section(
    root,
    "Structure",
    `Structure mode: ${structure.kind}.`
  );
  if (!structure.nodes.length) {
    empty(
      wrap,
      "No fixed structure",
      "This project currently has no linear or nested step map."
    );
    return;
  }
  const tree = wrap.createDiv({
    cls: "los-record-list los-project-structure"
  });
  const renderNode = (parent, row3, depth = 0) => {
    const item = parent.createDiv({
      cls: `los-record-row los-project-structure-row los-project-node-depth-${Math.min(depth, 4)}`
    });
    const copy = item.createDiv({
      cls: "los-record-copy"
    });
    copy.createEl("strong", {
      text: asLabel(row3)
    });
    const status = asString(row3.status);
    if (status) {
      copy.createDiv({
        cls: "los-record-meta",
        text: `${asString(row3.kind) ?? "step"} \xB7 ${status}`
      });
    }
    const summary = asString(row3.summary);
    if (summary) {
      copy.createDiv({
        cls: "los-record-summary",
        text: summary
      });
    }
    const children = asRecords(row3.children);
    if (children.length) {
      for (const child of children) {
        renderNode(
          parent,
          child,
          depth + 1
        );
      }
    }
  };
  for (const row3 of structure.nodes) {
    renderNode(
      tree,
      row3
    );
  }
}

// src/features/project/detail.ts
function renderDetail(view, root) {
  const project = view.projectId ? view.plugin.store.get(
    view.projectId
  ) : null;
  const projectId = project ? asString(project.id) : null;
  if (!project || asString(project.type) !== "project" || !projectId) {
    pageHeader(
      root,
      "Projects",
      "Project not found"
    );
    empty(
      root,
      "This project is unavailable",
      "The current projection does not contain this project.",
      "Back to projects",
      () => view.plugin.nav.openProjects()
    );
    return;
  }
  const title = asLabel(project);
  const status = asString(project.status) ?? "planned";
  const projectType = asString(project.project_type) ?? "project";
  const back = button(
    root,
    "\u2039 Back",
    () => view.plugin.nav.back(),
    "quiet"
  );
  back.addClass("los-route-back");
  pageHeader(
    root,
    `Projects \xB7 ${projectType} \xB7 ${status}`,
    title,
    projectedExcerpt(
      project.objective,
      190
    )
  );
  const tabs = root.createDiv({
    cls: "los-project-tabs",
    attr: {
      role: "group",
      "aria-label": "Project sections"
    }
  });
  enableButtonGroupKeyboardNavigation(tabs);
  for (const [tabId, label] of PROJECT_TABS) {
    const tab = button(
      tabs,
      label,
      () => view.plugin.nav.openProject(
        projectId,
        tabId
      ),
      "tertiary"
    );
    const active = view.tab === tabId;
    tab.toggleClass(
      "is-active",
      active
    );
    tab.setAttrs({
      "aria-pressed": String(active)
    });
  }
  const links = root.createDiv({
    cls: "los-project-chips"
  });
  const linkedIds = [
    ...asStrings(project.linked_module_ids),
    ...asStrings(project.unit_ids)
  ];
  for (const id2 of linkedIds) {
    const record4 = view.plugin.store.get(id2);
    if (!record4) continue;
    chip(
      links,
      record4,
      (target) => view.plugin.nav.openRecord(target)
    );
  }
  const body = root.createDiv({
    cls: "los-project-body"
  });
  switch (view.tab) {
    case "structure":
      view.renderStructure(
        body,
        project
      );
      view.renderDecisions(
        body,
        project
      );
      view.renderBoundaryBanner(
        body,
        project
      );
      break;
    case "linked-materials":
      view.renderLinked(
        body,
        project
      );
      break;
    case "files":
      view.renderFiles(
        body,
        project
      );
      break;
    case "decisions":
      view.renderDecisions(
        body,
        project
      );
      break;
    default:
      view.renderOverview(
        body,
        project
      );
  }
}
function renderOverview2(view, root, project) {
  const overview = section(
    root,
    "Overview"
  );
  const meta = overview.createDiv({
    cls: "los-project-meta-grid"
  });
  const boundaries = readProjectBoundaries(
    project.boundaries
  );
  const metadata = [
    [
      "Type",
      asString(
        project.project_type
      ) ?? "Project"
    ],
    [
      "Status",
      asString(project.status) ?? "planned"
    ],
    [
      "Confidentiality",
      boundaries.confidentiality
    ],
    [
      "External code access",
      boundaries.externalCodeAccess
    ]
  ];
  for (const [label, value] of metadata) {
    const row3 = meta.createDiv({
      cls: "los-project-meta"
    });
    row3.createDiv({
      cls: "los-kicker",
      text: label
    });
    row3.createEl("strong", {
      text: value
    });
  }
  if (boundaries.notes) {
    overview.createEl("p", {
      cls: "los-muted",
      text: boundaries.notes
    });
  }
  const units = section(
    root,
    "Project units",
    "Existing learning units remain reachable without turning the project into a module."
  );
  const unitRows = asStrings(project.unit_ids).map(
    (id2) => view.plugin.store.get(id2)
  ).filter(
    (row3) => row3 !== null
  );
  if (!unitRows.length) {
    empty(
      units,
      "No units linked",
      "This project can exist without a linear learning map."
    );
  }
  for (const unit of unitRows) {
    const unitId = asString(unit.id);
    if (!unitId) {
      continue;
    }
    button(
      units,
      asLabel(unit),
      () => view.plugin.nav.openUnit(unitId),
      "row"
    );
  }
}

// src/features/project/list.ts
function renderList(view, root) {
  pageHeader(
    root,
    "Projects",
    "Projects",
    "Long-running work with its own structure, materials, files, and decisions."
  );
  const input = root.createEl(
    "input",
    {
      cls: "los-search los-project-search",
      attr: {
        type: "search",
        placeholder: "Search projects",
        "aria-label": "Search projects"
      }
    }
  );
  input.value = view.query;
  const results = root.createDiv({
    cls: "los-project-list"
  });
  const draw = () => {
    results.empty();
    const words2 = input.value.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const rows = view.plugin.store.projects().filter(
      (project) => {
        const id2 = asString(project.id);
        if (!id2) {
          return false;
        }
        const hay = [
          id2,
          asString(project.title),
          asString(project.objective),
          asString(
            project.project_type
          )
        ].filter(
          (value) => Boolean(value)
        ).join(" ").toLocaleLowerCase();
        return words2.every(
          (word) => hay.includes(word)
        );
      }
    );
    if (!rows.length) {
      empty(
        results,
        "No projects found",
        "No first-class project matches this query.",
        "Clear search",
        () => {
          input.value = "";
          input.dispatchEvent(
            new Event("input")
          );
        }
      );
      return;
    }
    for (const project of rows) {
      const projectId = asString(project.id);
      if (!projectId) {
        continue;
      }
      const title = asLabel(project);
      const status = asString(project.status) ?? "planned";
      const projectType = asString(
        project.project_type
      ) ?? "project";
      const row3 = results.createEl("button", {
        cls: "los-record-row los-project-row is-clickable",
        attr: {
          type: "button",
          "aria-label": `Open project: ${title}`
        }
      });
      row3.setAttr(
        "data-record-id",
        projectId
      );
      const copy = row3.createDiv({
        cls: "los-record-copy"
      });
      copy.createEl("strong", {
        text: title
      });
      copy.createDiv({
        cls: "los-record-summary",
        text: projectedExcerpt(
          project.objective,
          170
        )
      });
      copy.createDiv({
        cls: "los-record-meta",
        text: `${projectType} \xB7 ${status} \xB7 ${asListLength(
          project.linked_module_ids
        )} linked modules`
      });
      row3.createSpan({
        cls: "los-record-action",
        text: "Open \u2192"
      });
      row3.addEventListener(
        "click",
        () => {
          view.selectedElementId = projectId;
          void view.plugin.nav.openProject(
            projectId,
            "structure"
          );
        }
      );
    }
  };
  input.addEventListener(
    "input",
    () => {
      view.query = input.value;
      view.plugin.router.remember({
        name: "project-list",
        query: view.query
      });
      draw();
    }
  );
  draw();
}

// src/views/project-view.ts
var import_obsidian12 = require("obsidian");
var ProjectLinkReasonModal = class extends import_obsidian12.Modal {
  plugin;
  relationship;
  restoreAccessibility = null;
  constructor(app, plugin, relationship) {
    super(app);
    this.plugin = plugin;
    this.relationship = relationship;
  }
  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass(
      "los-root",
      "los-linked-reason-modal"
    );
    this.plugin.router.openOverlay({
      kind: "linked-material-reason",
      relationshipId: this.relationship.id
    });
    pageHeader(
      root,
      "Linked material",
      "Why this is linked",
      "",
      "los-linked-reason-heading"
    );
    const target = this.plugin.store.get(
      this.relationship.toId
    );
    const relation = section(
      root,
      "Relationship"
    );
    relation.createEl("p", {
      text: `${this.relationship.toType} \xB7 ${this.relationship.relationType}`
    });
    const rationale = section(
      root,
      "Rationale"
    );
    rationale.createEl("p", {
      text: this.relationship.reason
    });
    const contribution = section(
      root,
      "Contribution"
    );
    contribution.createEl("p", {
      text: this.relationship.contribution
    });
    const actions = root.createDiv({
      cls: "los-actions"
    });
    if (target) {
      button(
        actions,
        "Open target",
        () => {
          this.close();
          return this.plugin.nav.openRecord(target);
        },
        "tertiary"
      );
    } else if (this.relationship.path) {
      const path = this.relationship.path;
      button(
        actions,
        "Open target",
        () => {
          this.close();
          return this.plugin.openAuthoredPath(
            path
          );
        },
        "tertiary"
      );
    }
    const close = button(
      actions,
      "Close",
      () => this.close(),
      "quiet"
    );
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: "los-modal--linked-reason",
      labelledBy: "los-linked-reason-heading"
    });
    close.focus();
  }
  onClose() {
    this.plugin.router.clearOverlay();
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
};
var ProjectView = class extends import_obsidian12.ItemView {
  plugin;
  screen = "list";
  projectId = null;
  tab = "structure";
  query = "";
  selectedElementId = null;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_PROJECT;
  }
  getDisplayText() {
    return "LearningOS \xB7 Projects";
  }
  async setState(state = {}) {
    const projectId = typeof state.projectId === "string" ? state.projectId : null;
    this.screen = state.screen ?? (projectId ? "detail" : "list");
    this.projectId = projectId;
    this.tab = state.tab ?? "structure";
    this.query = state.query ?? "";
    this.render();
  }
  getState() {
    return {
      screen: this.screen,
      projectId: this.projectId,
      tab: this.tab,
      query: this.query
    };
  }
  async onOpen() {
    await this.setState(
      readProjectViewState(
        this.leaf.getViewState().state
      )
    );
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass(
      "los-root",
      "los-project-view"
    );
    if (!this.plugin.store.ready) {
      empty(
        root,
        "Projects unavailable",
        this.plugin.store.error
      );
      return;
    }
    if (this.screen === "detail") {
      this.renderDetail(root);
      return;
    }
    this.renderList(root);
  }
  renderList(root) {
    renderList(this, root);
  }
  renderDetail(root) {
    renderDetail(this, root);
  }
  renderOverview(root, project) {
    renderOverview2(this, root, project);
  }
  renderBoundaryBanner(root, project) {
    renderBoundaryBanner(root, project);
  }
  renderStructure(root, project) {
    renderStructure(root, project);
  }
  renderLinked(root, project) {
    const wrap = section(
      root,
      "Linked Materials",
      "Links retain a core-authored reason rather than implying ownership."
    );
    const projectId = asString(project.id);
    const relationships = projectId ? this.plugin.store.projectRelationships(projectId).map(readProjectRelationship).filter(
      (relationship) => relationship !== null
    ) : [];
    if (!relationships.length) {
      empty(
        wrap,
        "No linked materials",
        "Links appear here when the project relationship projection contains them."
      );
      return;
    }
    for (const relationship of relationships) {
      const target = this.plugin.store.get(
        relationship.toId
      );
      const row3 = wrap.createDiv({
        cls: "los-record-row los-project-link"
      });
      const copy = row3.createDiv({
        cls: "los-record-copy los-project-link-copy"
      });
      copy.createEl("strong", {
        text: target ? asLabel(target) : relationship.toId
      });
      copy.createDiv({
        cls: "los-record-meta",
        text: `${relationship.toType} \xB7 ${relationship.relationType}`
      });
      const actions = row3.createDiv({
        cls: "los-actions"
      });
      if (target) {
        button(
          actions,
          "Open",
          () => this.plugin.nav.openRecord(target),
          "tertiary"
        );
      }
      button(
        actions,
        "Why linked",
        () => {
          const modal = new ProjectLinkReasonModal(
            this.app,
            this.plugin,
            relationship
          );
          modal.open();
        },
        "quiet"
      );
    }
  }
  renderFiles(root, project) {
    renderFiles(this, root, project);
  }
  renderDecisions(root, project) {
    renderDecisions(root, project);
  }
};

// src/views/review-view.ts
var import_obsidian13 = require("obsidian");
var fs = __toESM(require("node:fs"));
var nodePath = __toESM(require("node:path"));

// src/contracts/health-report.ts
function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}
function exactKeys2(value, required, optional2 = []) {
  const allowed = /* @__PURE__ */ new Set([...required, ...optional2]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) && Object.keys(value).every((key) => allowed.has(key));
}
function text3(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function dateTime3(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}
function asHealthReport(value) {
  const report = record(value);
  if (!report || !exactKeys2(
    report,
    ["schema_version", "type", "generated_at", "status", "checks"]
  ) || report.schema_version !== 1 || report.type !== "health-report" || !dateTime3(report.generated_at) || !["healthy", "attention-required"].includes(String(report.status)) || !Array.isArray(report.checks)) return null;
  const checks = [];
  for (const valueCheck of report.checks) {
    const check = record(valueCheck);
    if (!check || !exactKeys2(
      check,
      ["id", "status", "summary", "owner", "remedy"],
      ["details"]
    ) || !text3(check.id) || !["ok", "warning", "error", "unknown"].includes(String(check.status)) || !text3(check.summary) || !text3(check.owner) || !text3(check.remedy) || "details" in check && record(check.details) === null) return null;
    checks.push({
      id: check.id,
      status: check.status,
      summary: check.summary,
      owner: check.owner,
      remedy: check.remedy,
      ...check.details ? { details: check.details } : {}
    });
  }
  const aggregate = checks.every((check) => check.status === "ok") ? "healthy" : "attention-required";
  if (report.status !== aggregate) return null;
  return {
    schema_version: 1,
    type: "health-report",
    generated_at: report.generated_at,
    status: report.status,
    checks
  };
}

// src/contracts/legacy-archive.ts
function record2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}
function exact3(value, required, optional2 = []) {
  const allowed = /* @__PURE__ */ new Set([...required, ...optional2]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) && Object.keys(value).every((key) => allowed.has(key));
}
var sha2563 = (value) => typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
var text4 = (value) => typeof value === "string" && value.trim().length > 0;
var dateTime4 = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
var natural4 = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0;
var relativePath = (value) => text4(value) && !value.startsWith("/") && !value.split("/").includes("..");
function asLegacyArchiveLock(value) {
  const lock = record2(value);
  if (!lock || !exact3(lock, [
    "schema_version",
    "id",
    "type",
    "created_at",
    "entries",
    "excluded",
    "verification"
  ]) || lock.schema_version !== 1 || lock.id !== "legacy-archive-lock" || lock.type !== "legacy-archive-lock" || !dateTime4(lock.created_at) || !Array.isArray(lock.entries)) return null;
  const dispositions = [
    "canonicalized",
    "byte-preserved",
    "superseded-system",
    "historical-only",
    "unresolved"
  ];
  const entries = [];
  for (const valueEntry of lock.entries) {
    const entry = record2(valueEntry);
    if (!entry || !exact3(entry, [
      "relative_path",
      "size",
      "sha256",
      "category",
      "disposition",
      "canonical_targets"
    ]) || !relativePath(entry.relative_path) || !natural4(entry.size) || !sha2563(entry.sha256) || !text4(entry.category) || !dispositions.includes(entry.disposition) || !Array.isArray(entry.canonical_targets)) return null;
    const targets = [];
    for (const valueTarget of entry.canonical_targets) {
      const target = record2(valueTarget);
      if (!target || !exact3(
        target,
        ["path", "exists", "checksum_matches"],
        ["sha256"]
      ) || !relativePath(target.path) || typeof target.exists !== "boolean" || !(typeof target.checksum_matches === "boolean" || target.checksum_matches === null) || "sha256" in target && target.sha256 !== null && !sha2563(target.sha256)) return null;
      targets.push({
        path: target.path,
        exists: target.exists,
        checksum_matches: target.checksum_matches,
        ..."sha256" in target ? { sha256: target.sha256 } : {}
      });
    }
    entries.push({
      relative_path: entry.relative_path,
      size: entry.size,
      sha256: entry.sha256,
      category: entry.category,
      disposition: entry.disposition,
      canonical_targets: targets
    });
  }
  const excluded = record2(lock.excluded);
  const verification = record2(lock.verification);
  if (!excluded || !exact3(excluded, ["count", "status"]) || !natural4(excluded.count) || excluded.status !== "sealed-not-inspected" || !verification || !exact3(verification, ["verified_at", "status"], ["issues"]) || !dateTime4(verification.verified_at) || !["verified", "attention-required"].includes(String(verification.status)) || "issues" in verification && (!Array.isArray(verification.issues) || !verification.issues.every(text4))) return null;
  return {
    schema_version: 1,
    id: "legacy-archive-lock",
    type: "legacy-archive-lock",
    created_at: lock.created_at,
    entries,
    excluded: { count: excluded.count, status: "sealed-not-inspected" },
    verification: {
      verified_at: verification.verified_at,
      status: verification.status,
      ...Array.isArray(verification.issues) ? { issues: verification.issues } : {}
    }
  };
}
function asLegacyArchiveStatus(value) {
  const status = record2(value);
  if (!status || !exact3(status, ["schema_version", "type", "available", "lock"]) || status.schema_version !== 1 || status.type !== "legacy-archive-status" || typeof status.available !== "boolean") return null;
  const lock = status.lock === null ? null : asLegacyArchiveLock(status.lock);
  if (status.lock !== null && lock === null) return null;
  if (status.available !== (lock !== null)) return null;
  return {
    schema_version: 1,
    type: "legacy-archive-status",
    available: status.available,
    lock
  };
}

// src/views/review-view.ts
var REVIEW_FILTERS = [
  ["all", "All"],
  ["inbox", "Inbox"],
  ["shelving", "Shelving"],
  ["planning", "Planning"],
  ["garden", "Garden"]
];
var ReviewView = class extends import_obsidian13.ItemView {
  plugin;
  filter = "all";
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_REVIEW;
  }
  getDisplayText() {
    return "LearningOS \xB7 Review";
  }
  getIcon() {
    return "check-check";
  }
  async onOpen() {
    this.render();
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass(
      "los-root",
      "los-review-view"
    );
    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        "LearningOS",
        "Projection unavailable"
      );
      empty(
        root,
        "The interface contract could not be loaded",
        this.plugin.store.error,
        "Rebuild views",
        () => this.plugin.generate()
      );
      return;
    }
    const items = this.plugin.store.reviewItems();
    const header = pageHeader(
      root,
      "Review \xB7 Decisions",
      "Review",
      "Everything here is waiting on a decision from you."
    );
    badge(
      header,
      `${items.length} decision${items.length === 1 ? "" : "s"} waiting`,
      "role"
    ).addClass("los-review-count-badge");
    filterTabs(
      root,
      "Review categories",
      REVIEW_FILTERS,
      this.filter,
      (value) => {
        this.filter = value;
        this.render();
      },
      (value) => value === "all" ? items.length : items.filter(
        (item) => item.category === value
      ).length
    );
    root.createDiv({
      cls: "los-micro los-review-queue-note",
      text: "Only items that require a decision appear here. Garden stays quiet until Core marks a seed review-due."
    });
    const visible = this.filter === "all" ? items : items.filter(
      (item) => item.category === this.filter
    );
    const list2 = root.createDiv({
      cls: "los-review-list"
    });
    if (!visible.length) {
      empty(
        list2,
        items.length ? "Nothing in this category" : "Nothing waiting",
        items.length ? "Choose another Review filter." : "Core has not projected any current Review decisions."
      );
    } else {
      for (const item of visible) {
        this.decision(list2, item);
      }
    }
  }
  decision(parent, item) {
    const id2 = typeof item.id === "string" ? item.id : "review-item";
    const category = typeof item.category === "string" ? item.category : "review";
    const title = typeof item.title === "string" ? item.title : id2;
    const context = typeof item.context === "string" ? item.context : "";
    const reason = typeof item.reason === "string" ? item.reason : "";
    const row3 = parent.createDiv({
      cls: "los-review-decision-row",
      attr: {
        "data-review-id": id2
      }
    });
    const copy = row3.createDiv({
      cls: "los-review-decision-copy"
    });
    const top = copy.createDiv({
      cls: "los-review-decision-top"
    });
    badge(
      top,
      category.replace(/-/g, " "),
      "role"
    );
    top.createEl("h2", {
      text: title
    });
    if (context) {
      copy.createDiv({
        cls: "los-micro los-review-context",
        text: context
      });
    }
    if (reason) {
      copy.createEl("p", {
        cls: "los-review-reason",
        text: reason
      });
    }
    const action = this.actionFor(item);
    if (action) {
      button(
        row3,
        action[0],
        action[1],
        "quiet"
      );
    } else {
      row3.createSpan({
        cls: "los-micro los-review-clear",
        text: "No supported action"
      });
    }
    return row3;
  }
  actionFor(item) {
    const target = isRecord2(item.target) ? item.target : null;
    if (!target) {
      return null;
    }
    const kind = typeof target.kind === "string" ? target.kind : "";
    if (kind === "study-map" && typeof target.unit_id === "string") {
      return [
        "Review proposal",
        () => this.plugin.nav.openShelving(
          target.unit_id
        )
      ];
    }
    if (kind === "inbox-item" && typeof target.path === "string") {
      return [
        "Route",
        () => this.plugin.openVaultPath(
          target.path
        )
      ];
    }
    if (kind === "unit" && typeof target.id === "string") {
      return [
        "Open unit",
        () => this.plugin.nav.openUnit(
          target.id
        )
      ];
    }
    if (kind === "garden-note" || kind === "garden-seed") {
      return [
        "Review seed",
        () => this.plugin.nav.openGarden()
      ];
    }
    return null;
  }
};
var DiagnosticsView = class extends import_obsidian13.ItemView {
  plugin;
  report = "";
  screen = "health";
  health = null;
  healthLoading = false;
  healthError = "";
  legacy = null;
  legacyLoaded = false;
  legacyLoading = false;
  legacyError = "";
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_DIAGNOSTICS;
  }
  getDisplayText() {
    return "LearningOS \xB7 Diagnostics";
  }
  getIcon() {
    return "activity";
  }
  async onOpen() {
    this.render();
    void this.loadHealth();
  }
  async loadHealth() {
    if (this.healthLoading) return;
    this.healthLoading = true;
    this.healthError = "";
    this.render();
    try {
      const report = asHealthReport(await this.plugin.gateway.healthReport());
      if (!report) throw new Error("Core returned an invalid health-report response.");
      this.health = report;
    } catch (error) {
      this.health = null;
      this.healthError = errorMessage(error);
    } finally {
      this.healthLoading = false;
      this.render();
    }
  }
  async loadLegacy() {
    if (this.legacyLoading) return;
    this.legacyLoading = true;
    this.legacyError = "";
    this.render();
    try {
      const status = asLegacyArchiveStatus(
        await this.plugin.gateway.legacyArchiveStatus()
      );
      if (!status) throw new Error("Core returned an invalid Legacy Archive status response.");
      this.legacy = status.lock;
      this.legacyLoaded = true;
    } catch (error) {
      this.legacy = null;
      this.legacyLoaded = false;
      this.legacyError = errorMessage(error);
    } finally {
      this.legacyLoading = false;
      this.render();
    }
  }
  selectScreen(screen) {
    this.screen = screen;
    this.render();
    if (screen === "legacy" && !this.legacyLoaded) void this.loadLegacy();
  }
  buildInfo() {
    const fallback = {
      ui_version: this.plugin.uiVersion(),
      manifest_contract_version: MANIFEST_CONTRACT_VERSION,
      source_revision: "unavailable",
      source_dirty: null,
      source_committed_at: "unavailable",
      source_fingerprint: "unavailable",
      bundle_sha256: "unavailable",
      node_version: "unavailable"
    };
    try {
      const app = this.app;
      const base = app.vault.adapter.getBasePath();
      const pluginInfo = this.plugin.manifest;
      const directory = pluginInfo?.dir || nodePath.join(
        ".obsidian",
        "plugins",
        pluginInfo?.id || "learningos-ui"
      );
      const target = nodePath.join(
        base,
        directory,
        "build-info.json"
      );
      if (!fs.existsSync(target)) {
        return fallback;
      }
      const parsed = JSON.parse(
        fs.readFileSync(target, "utf8")
      );
      if (!isRecord2(parsed)) {
        return fallback;
      }
      return {
        ui_version: typeof parsed.ui_version === "string" ? parsed.ui_version : fallback.ui_version,
        manifest_contract_version: typeof parsed.manifest_contract_version === "number" ? parsed.manifest_contract_version : fallback.manifest_contract_version,
        source_revision: typeof parsed.source_revision === "string" ? parsed.source_revision : fallback.source_revision,
        // A missing flag stays null: an older build-info predates the field,
        // and reading that absence as "clean" is the exact false reassurance
        // this row exists to remove.
        source_dirty: typeof parsed.source_dirty === "boolean" ? parsed.source_dirty : fallback.source_dirty,
        source_committed_at: typeof parsed.source_committed_at === "string" ? parsed.source_committed_at : fallback.source_committed_at,
        source_fingerprint: typeof parsed.source_fingerprint === "string" ? parsed.source_fingerprint : fallback.source_fingerprint,
        bundle_sha256: typeof parsed.bundle_sha256 === "string" ? parsed.bundle_sha256 : fallback.bundle_sha256,
        node_version: typeof parsed.node_version === "string" ? parsed.node_version : fallback.node_version
      };
    } catch (_) {
      return fallback;
    }
  }
  state() {
    if (this.healthLoading) return ["\u2026", "Checking LearningOS health", "Waiting for the bounded Core health report."];
    if (this.health?.status === "healthy") {
      return ["\u2713", "Healthy", `Core verified ${this.health.checks.length} registered checks at ${this.health.generated_at}.`];
    }
    if (this.health?.status === "attention-required") {
      const count = this.health.checks.filter((check) => check.status !== "ok").length;
      return ["!", "Attention required", `${count} check${count === 1 ? "" : "s"} need an owner or remedy.`];
    }
    if (this.healthError) return ["?", "Health unavailable", this.healthError];
    return ["?", "Health not checked", "Run the bounded health report before trusting a green state."];
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-diagnostics-view");
    pageHeader(root, "More", "Diagnostics");
    const tabs = root.createDiv({ cls: "los-subtabs", attr: { "aria-label": "Diagnostics sections" } });
    for (const [key, label] of [["health", "Health"], ["legacy", "Legacy Archive"]]) {
      const tab = button(tabs, label, () => this.selectScreen(key), key === this.screen ? "info" : "quiet");
      tab.setAttr("aria-pressed", key === this.screen ? "true" : "false");
    }
    if (this.screen === "legacy") {
      this.renderLegacy(root);
      return;
    }
    const [glyph, title, detail] = this.state();
    const status = root.createDiv({ cls: "los-diagnostic-status" });
    status.createSpan({ cls: "los-diagnostic-glyph", text: glyph });
    const copy = status.createDiv();
    copy.createEl("strong", { text: title });
    copy.createDiv({ cls: "los-micro", text: detail });
    if (this.health) {
      const checks = section(root, "Health checks", `Generated ${this.health.generated_at}`);
      for (const check of this.health.checks) {
        const row3 = checks.createDiv({ cls: "los-health-check" });
        const heading = row3.createDiv({ cls: "los-health-check-head" });
        heading.createEl("strong", { text: check.summary });
        badge(heading, check.status, check.status === "ok" ? "status" : "role");
        factList(row3, [
          ["Check", check.id],
          ["Owner", check.owner],
          ["Remedy", check.remedy]
        ]);
      }
    }
    const generated = this.plugin.store.data?._generated ?? {};
    const build = this.buildInfo();
    const facts = section(root, "Contract and versions");
    const factRows = [
      ["Manifest contract", generated.contract_version ?? "unknown"],
      ["Manifest schema", generated.schema_sha256 ?? "unknown"],
      ["UI expects contract", MANIFEST_CONTRACT_VERSION],
      ["UI version", this.plugin.uiVersion()],
      ["UI source revision", build.source_revision],
      // The projection states its own staleness; before this the interface
      // stated nothing about its own, and a vault quietly ran a build 32
      // commits behind its source for a day.
      ["UI built from", build.source_dirty === null ? `${build.source_committed_at} (working tree unknown)` : build.source_dirty ? `${build.source_committed_at} + uncommitted sources` : build.source_committed_at],
      ["UI source fingerprint", build.source_fingerprint],
      ["UI bundle fingerprint", build.bundle_sha256],
      ["Build Node", build.node_version],
      ["Generator", generated.generator || "unknown"],
      ["Projection built", generated.generated_at || "unknown"],
      ["Snapshot", generated.snapshot_id || "unknown"],
      ["Source revision", generated.source_revision || "unknown"],
      ["Python interpreter", this.plugin.resolvePython().path],
      ["Interpreter source", this.plugin.resolvePython().origin]
    ];
    factList(facts, factRows);
    const actions = root.createDiv({ cls: "los-actions" });
    button(actions, "Refresh health", () => void this.loadHealth(), "info");
    button(actions, "Validate and rebuild", () => this.plugin.generate(), "success");
    button(actions, "Test the interpreter", () => this.testInterpreter(), "info");
    button(actions, "Copy build identity", () => this.plugin.copyText(JSON.stringify(build, null, 2)), "quiet");
    if (this.report) root.createEl("pre", { cls: "los-diagnostic-report", text: this.report });
    const policy = section(root, "About LearningOS");
    policy.createEl("p", { text: OWNERSHIP_STATEMENT });
  }
  renderLegacy(root) {
    const header = section(
      root,
      "Legacy Archive",
      "Read-only disposition and verification status. Archived records never become normal manifest content here."
    );
    if (this.legacyLoading) {
      empty(header, "Checking archive lock", "Waiting for Core\u2019s bounded archive-status response.");
      return;
    }
    if (this.legacyError) {
      empty(header, "Legacy Archive unavailable", this.legacyError, "Try again", () => void this.loadLegacy());
      return;
    }
    if (!this.legacyLoaded) {
      empty(header, "Archive status not loaded", "Load the reviewed archive lock without opening archived content.", "Load archive status", () => void this.loadLegacy());
      return;
    }
    if (!this.legacy) {
      empty(header, "No approved archive lock", "Core reports that no reviewed Legacy Archive disposition lock is available. Archived content remains sealed.");
      const actions2 = root.createDiv({ cls: "los-actions" });
      button(actions2, "Refresh archive status", () => void this.loadLegacy(), "info");
      return;
    }
    const lock = this.legacy;
    const status = root.createDiv({ cls: "los-diagnostic-status" });
    status.createSpan({
      cls: "los-diagnostic-glyph",
      text: lock.verification.status === "verified" ? "\u2713" : "!"
    });
    const copy = status.createDiv();
    copy.createEl("strong", {
      text: lock.verification.status === "verified" ? "Archive lock verified" : "Archive lock needs attention"
    });
    copy.createDiv({
      cls: "los-micro",
      text: `Verified ${lock.verification.verified_at}. ${lock.excluded.count} excluded item${lock.excluded.count === 1 ? "" : "s"} remain sealed and were not inspected.`
    });
    const dispositions = [
      "canonicalized",
      "byte-preserved",
      "superseded-system",
      "historical-only",
      "unresolved"
    ];
    const counts = Object.fromEntries(dispositions.map((disposition) => [
      disposition,
      lock.entries.filter((entry) => entry.disposition === disposition).length
    ]));
    const facts = section(root, "Disposition summary");
    factList(facts, [
      ["Reviewed entries", lock.entries.length],
      ["Canonicalized", counts.canonicalized],
      ["Byte preserved", counts["byte-preserved"]],
      ["Superseded system", counts["superseded-system"]],
      ["Historical only", counts["historical-only"]],
      ["Unresolved", counts.unresolved],
      ["Excluded", `${lock.excluded.count} \xB7 sealed, not inspected`]
    ]);
    if (lock.verification.issues?.length) {
      const issues = section(root, "Issues");
      for (const issue of lock.verification.issues) {
        issues.createDiv({ cls: "los-health-check", text: issue });
      }
    }
    const actions = root.createDiv({ cls: "los-actions" });
    button(actions, "Refresh archive status", () => void this.loadLegacy(), "info");
  }
  async testInterpreter() {
    const resolved = this.plugin.resolvePython();
    try {
      const result = await this.plugin.gateway.call(["status", "--json"]);
      this.report = `${resolved.path} (${resolved.origin})
Core answered: ${JSON.stringify(result).slice(0, 400)}`;
    } catch (error) {
      this.report = `${resolved.path} (${resolved.origin})
Failed: ${errorMessage(error)}
Tried: ${resolved.attempted.join(", ")}`;
    }
    this.render();
  }
};

// src/views/shelving-view.ts
var import_obsidian14 = require("obsidian");
function readShelvingProposal(value) {
  if (!isRecord2(value) || value.state !== "proposed" || !Array.isArray(value.items)) {
    return null;
  }
  const items = [];
  for (const candidate of value.items) {
    if (!isRecord2(candidate) || typeof candidate.id !== "string" || typeof candidate.title !== "string") {
      continue;
    }
    const item = {
      id: candidate.id,
      title: candidate.title,
      destination: optionalString(candidate.destination),
      rationale: optionalString(candidate.rationale),
      diff: optionalString(candidate.diff),
      selected: typeof candidate.selected === "boolean" ? candidate.selected : void 0
    };
    items.push(item);
  }
  return {
    state: "proposed",
    summary: optionalString(value.summary),
    items
  };
}
var ShelvingView = class extends import_obsidian14.ItemView {
  plugin;
  unitId = null;
  proposal = null;
  selected = /* @__PURE__ */ new Set();
  selectionScope = null;
  expectedRevisions = {};
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_SHELVING;
  }
  getDisplayText() {
    return "LearningOS \xB7 Shelving";
  }
  async setState(state = {}) {
    if (typeof state.unitId === "string") {
      this.unitId = state.unitId;
    }
    await this.loadProposal();
    this.render();
  }
  getState() {
    return { unitId: this.unitId };
  }
  async onOpen() {
    const unitId = this.leaf.getViewState().state?.unitId;
    if (typeof unitId === "string") {
      this.unitId = unitId;
    }
    await this.loadProposal();
    this.render();
  }
  async loadProposal() {
    if (!this.unitId) {
      this.proposal = null;
      return;
    }
    const map = this.plugin.store.mapForUnit(this.unitId);
    this.proposal = readShelvingProposal(map?.shelving);
  }
  selectionKey(unitId, map, proposal) {
    const mapId = typeof map?.id === "string" ? map.id : "";
    const revision = map?.revision == null ? "" : String(map.revision);
    const proposalIds = proposal?.items.map((item) => item.id).join("") ?? "";
    return JSON.stringify([
      unitId,
      mapId,
      revision,
      proposalIds
    ]);
  }
  syncSelection(unitId, map, proposal) {
    const scope = this.selectionKey(
      unitId,
      map,
      proposal
    );
    if (scope === this.selectionScope) {
      return;
    }
    this.selectionScope = scope;
    this.selected.clear();
    if (!proposal) {
      return;
    }
    for (const item of proposal.items) {
      if (item.selected !== false) {
        this.selected.add(item.id);
      }
    }
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-shelving-view");
    const unit = this.unitId ? this.plugin.store.get(this.unitId) : null;
    pageHeader(
      root,
      "Approval gate",
      "Shelving",
      unit ? `${unit.title}: review durable changes before the gateway applies them.` : "Choose a unit that is ready to shelve."
    );
    if (!unit) {
      this.renderQueue(root);
      return;
    }
    if (!unit.id) {
      empty(root, "Unit unavailable", "The projection returned a unit without an identity.");
      return;
    }
    const map = this.plugin.store.mapForUnit(unit.id);
    this.expectedRevisions = this.plugin.store.artifactGuard(
      unit.id,
      typeof map?.id === "string" ? map.id : null
    );
    const proposal = this.proposal ?? readShelvingProposal(map?.shelving);
    if (!proposal?.items?.length) {
      this.syncSelection(
        unit.id,
        map,
        null
      );
      const wrap = section(root, "No proposal yet");
      empty(
        wrap,
        "Prepare a deterministic proposal",
        "The gateway derives candidates from this unit. AI may explain them, but cannot apply canonical changes.",
        "Prepare proposal",
        () => this.prepare()
      );
      button(wrap, "Ask AI to explain shelving criteria", () => this.plugin.askAiScoped(
        "Explain which stage notes might be durable. Do not write or apply canonical changes.",
        { moduleId: unit.module_id, unitId: unit.id }
      ), "quiet");
      return;
    }
    this.syncSelection(
      unit.id,
      map,
      proposal
    );
    const summary = section(root, "Proposed changes", proposal.summary || "Select only changes you want to apply.");
    for (const item of proposal.items) {
      const row3 = summary.createDiv({ cls: "los-proposal-row" });
      const toggle = row3.createEl("input", { attr: { type: "checkbox", "aria-label": `Select ${item.title}` } });
      toggle.checked = this.selected.has(item.id);
      toggle.addEventListener("change", () => {
        if (toggle.checked) this.selected.add(item.id);
        else this.selected.delete(item.id);
      });
      const copy = row3.createDiv();
      copy.createEl("h3", { text: item.title });
      if (item.destination) copy.createDiv({ cls: "los-detail-id", text: item.destination });
      if (item.rationale) copy.createEl("p", { text: item.rationale });
      if (item.diff) copy.createEl("pre", { cls: "los-proposal-diff", text: item.diff });
    }
    const guard = root.createDiv({ cls: "los-validation-preview" });
    guard.createEl("strong", { text: "Apply is explicit and selected-only." });
    guard.createEl("p", { text: "The core validates and regenerates atomically; broad AI writes are never accepted." });
    const actions = root.createDiv({ cls: "los-actions" });
    button(actions, "Approve selected changes", () => this.apply(), "success");
    button(actions, "Ask AI to review proposal", () => this.plugin.askAiScoped(
      `Review these shelving proposal IDs: ${[...this.selected].join(", ")}. Do not apply changes.`,
      { moduleId: unit.module_id, unitId: unit.id }
    ), "warm");
  }
  renderQueue(root) {
    const wrap = section(root, "Ready to shelve");
    const rows = this.plugin.store.units().filter(
      (row3) => row3.status === "ready-to-shelve"
    );
    if (!rows.length) empty(wrap, "No unit is waiting", "Keep working from any active unit.");
    for (const unit of rows) unitCard(wrap, this.plugin, unit);
  }
  async prepare() {
    const unitId = this.unitId;
    if (!unitId) {
      new import_obsidian14.Notice("Choose a unit before preparing shelving.");
      return;
    }
    try {
      await this.plugin.mutate(
        () => this.plugin.gateway.prepareShelving(unitId, this.expectedRevisions)
      );
      await this.loadProposal();
      this.render();
    } catch (error) {
      new import_obsidian14.Notice(errorMessage(error));
    }
  }
  async apply() {
    const unitId = this.unitId;
    if (!unitId) {
      new import_obsidian14.Notice("Choose a unit before applying shelving.");
      return;
    }
    if (!this.selected.size) {
      new import_obsidian14.Notice("Select at least one proposal.");
      return;
    }
    try {
      await this.plugin.mutate(
        () => this.plugin.gateway.applyShelving(
          unitId,
          [...this.selected],
          this.expectedRevisions
        )
      );
      this.proposal = null;
      this.selected.clear();
      this.selectionScope = null;
      this.render();
    } catch (error) {
      new import_obsidian14.Notice(errorMessage(error));
    }
  }
};

// src/features/unit/model.ts
var ARTIFACT_LABELS = [
  [
    "ultimate_reference",
    "Ultimate Reference"
  ],
  [
    "exercise_bank",
    "Exercise Bank"
  ],
  [
    "mock_exam",
    "Mock Exam"
  ]
];
function errorMessage3(error) {
  return error instanceof Error ? error.message : String(error);
}
function readUnitViewState(value) {
  if (!isRecord2(value)) {
    return {
      hasStageId: false
    };
  }
  const hasStageId = Object.prototype.hasOwnProperty.call(
    value,
    "stageId"
  );
  const unitId = asString(value.unitId) ?? void 0;
  const stageId = !hasStageId ? void 0 : value.stageId === null ? null : asString(value.stageId);
  return {
    unitId,
    stageId,
    hasStageId
  };
}
function readUnitRecord(record4, fallbackId) {
  if (!record4) {
    return null;
  }
  const id2 = asString(record4.id) ?? fallbackId;
  const moduleId = asString(record4.module_id);
  if (!id2 || !moduleId) {
    return null;
  }
  const knowledgeMap = isRecord2(
    record4.knowledge_map
  ) ? record4.knowledge_map : null;
  const knowledgeNodes = asRecords(
    knowledgeMap?.nodes
  ).map((node) => {
    const nodeId = asString(node.id);
    const title = asString(node.title);
    const summary = asText(node.summary);
    if (!nodeId || !title || !summary) {
      return null;
    }
    return {
      id: nodeId,
      title,
      summary,
      buildsOn: asStrings(
        node.builds_on
      ),
      conceptIds: asStrings(
        node.concept_ids
      )
    };
  }).filter(
    (node) => node !== null
  );
  return {
    record: record4,
    id: id2,
    moduleId,
    componentId: asString(record4.component_id),
    kind: asString(record4.kind) ?? "unit",
    title: asString(record4.title) ?? id2,
    scope: asText(record4.scope) ?? "",
    knowledgeSummary: asText(
      knowledgeMap?.summary
    ) ?? "",
    knowledgeNodes,
    needsStudyMap: record4.needs_study_map === true
  };
}
function readMaterialOptions(value, unitId, selectionsValue) {
  const options = [];
  const selectionKeys = new Set(
    asRecords(selectionsValue).flatMap((selection) => {
      const routeId = asString(selection.route_id);
      const sourceId = asString(selection.source_id);
      const locator = asText(selection.locator);
      return routeId && sourceId && locator ? [`${routeId}\0${sourceId}\0${locator}`] : [];
    })
  );
  for (const entry of asRecords(value)) {
    for (const route of asRecords(entry.unit_routes)) {
      if (asString(route.unit_id) !== unitId) {
        continue;
      }
      const title = asString(route.title);
      const format = asString(route.format);
      const angle = asText(route.angle);
      const routeId = asString(route.id);
      if (!routeId || !title || !format || !angle) {
        continue;
      }
      const sourceId = asString(route.source_id) ?? asString(entry.source_id);
      const locator = asText(route.locator);
      options.push({
        record: route,
        title,
        format,
        angle,
        covers: asStrings(route.covers),
        depth: asString(route.depth) ?? "course-aligned",
        scope: asString(route.scope) ?? "complementary",
        locator,
        sourceId,
        routeId,
        canOpen: hasDirectResourceTarget(route),
        canChoose: Boolean(sourceId && locator),
        selected: Boolean(
          sourceId && locator && selectionKeys.has(
            `${routeId}\0${sourceId}\0${locator}`
          )
        )
      });
    }
  }
  return options;
}
function readResource(record4) {
  const label = asString(record4.label) ?? asString(record4.title) ?? asString(record4.source_id) ?? "Resource";
  return {
    record: record4,
    id: asString(record4.id),
    kind: asString(record4.kind) ?? "read",
    label,
    locator: asText(record4.locator),
    sourceId: asString(record4.source_id),
    scopeTriage: asString(record4.scope_triage),
    canOpen: hasDirectResourceTarget(record4)
  };
}
function readStageAttachment(value) {
  if (typeof value === "string") {
    if (!value.length) {
      return null;
    }
    return {
      path: value,
      label: value.split("/").pop() || value
    };
  }
  if (!isRecord2(value)) {
    return null;
  }
  const path = asString(value.path) ?? asString(value.vault_path);
  if (!path) {
    return null;
  }
  return {
    path,
    label: asString(value.label) ?? path
  };
}
function readStage(record4) {
  const id2 = asString(record4.id);
  if (!id2) {
    return null;
  }
  const attachments = Array.isArray(
    record4.attachments
  ) ? record4.attachments.map(readStageAttachment).filter(
    (attachment) => attachment !== null
  ) : [];
  return {
    record: record4,
    id: id2,
    title: asString(record4.title) ?? id2,
    status: asString(record4.status) ?? "active",
    scopeTriage: asText(record4.scope_triage) ?? "",
    objective: asText(record4.objective),
    estimateMinutes: asText(record4.estimate_minutes),
    examCritical: record4.exam_critical === true,
    concepts: asStrings(record4.concepts),
    resources: asRecords(
      record4.resources
    ).map(readResource),
    doneWhen: asStrings(
      record4.done_when
    ).filter(
      (criterion) => Boolean(criterion.trim())
    ),
    attachments,
    sourceFeedback: asRecords(
      record4.source_feedback
    )
  };
}
function readStudyMap(record4) {
  const stages = asRecords(
    record4.stages
  ).map(readStage).filter(
    (stage) => stage !== null
  );
  return {
    record: record4,
    currentStageId: asString(
      record4.current_stage
    ),
    stages,
    detours: asRecords(record4.detours),
    planTemplateVersion: asFiniteNumber(
      record4.plan_template_version
    )
  };
}
function readArtifacts(value) {
  if (!isRecord2(value)) {
    return {
      named: [],
      other: []
    };
  }
  const named = [];
  for (const [key] of ARTIFACT_LABELS) {
    const id2 = asString(value[key]);
    if (id2) {
      named.push([key, id2]);
    }
  }
  return {
    named,
    other: asStrings(value.other)
  };
}
function artifactLabel(key) {
  return ARTIFACT_LABELS.find(
    ([candidate]) => candidate === key
  )?.[1] ?? key;
}
function fallbackRecord(id2) {
  return {
    id: id2,
    type: "record",
    title: id2
  };
}

// src/features/unit/context.ts
function renderStageContext(view, center, unit, studyMap, stage) {
  const expectedRevisions = view.plugin.store.artifactGuard(
    unit.id,
    typeof studyMap.record.id === "string" ? studyMap.record.id : null
  );
  const detours = studyMap.detours.filter(
    (row3) => asString(
      row3.spawned_by_stage
    ) === stage.id && asString(
      row3.status
    ) !== "resolved" && asString(
      row3.id
    ) !== null
  );
  if (!stage.attachments.length && !detours.length && !stage.sourceFeedback.length) {
    return;
  }
  const detail = disclosure(
    center,
    "Stage context"
  );
  for (const attachment of stage.attachments) {
    button(
      detail,
      attachment.label,
      () => view.plugin.openAuthoredPath(
        attachment.path
      ),
      "quiet"
    );
  }
  for (const detour of detours) {
    const detourId = asString(detour.id);
    if (!detourId) {
      continue;
    }
    const title = asString(detour.title) ?? "Prerequisite detour";
    const classification = asString(
      detour.classification
    ) ?? "required-now";
    const row3 = detail.createDiv({
      cls: "los-detour-row"
    });
    row3.createEl("strong", {
      text: "Open prerequisite detour"
    });
    row3.createEl("p", {
      text: `${title} \xB7 ${classification} \xB7 returns here`
    });
    button(
      row3,
      "Resolve and return",
      () => view.mutate(
        () => view.plugin.gateway.resolveDetour(
          unit.id,
          detourId,
          "Resolved from the unit workspace.",
          expectedRevisions
        )
      ),
      "quiet"
    );
  }
  for (const feedback of stage.sourceFeedback) {
    const sourceId = asString(
      feedback.source_id
    ) ?? "Unknown source";
    const value = asText(
      feedback.feedback
    ) ?? "Feedback recorded";
    detail.createDiv({
      cls: "los-row",
      text: `${sourceId} \xB7 ${value}`
    });
  }
}
function renderArtifacts(view, root, unit) {
  const wrap = section(
    root,
    "Unit artifacts",
    "Durable notes remain globally canonical; this unit owns stable references."
  );
  const artifacts = readArtifacts(
    unit.record.artifacts
  );
  let count = 0;
  for (const [key, id2] of artifacts.named) {
    count += 1;
    const card = wrap.createDiv({
      cls: "los-artifact-card"
    });
    card.createEl("h3", {
      text: artifactLabel(key)
    });
    const record4 = view.plugin.store.get(id2) ?? fallbackRecord(id2);
    chip(
      card,
      record4,
      (selected) => view.plugin.nav.openRecord(
        selected
      )
    );
  }
  for (const id2 of artifacts.other) {
    count += 1;
    const record4 = view.plugin.store.get(id2) ?? fallbackRecord(id2);
    chip(
      wrap,
      record4,
      (selected) => view.plugin.nav.openRecord(
        selected
      )
    );
  }
  if (!count) {
    empty(
      wrap,
      "No durable artifact linked yet",
      "Working notes stay with the stage until shelving is approved."
    );
  }
}

// src/features/stage-resources.ts
var TRIAGE_ORDER = [
  "required-now",
  "helpful-now",
  "deferred",
  "reference-only"
];
var TRIAGE_HEADING = {
  "required-now": "Do this",
  "helpful-now": "If you get stuck",
  deferred: "Depth \u2014 not now",
  "reference-only": "Reference \u2014 preserved, not reading for this stage"
};
var MATERIAL_TYPE_ORDER = [
  "video",
  "article",
  "book",
  "exercise"
];
var MATERIAL_TYPE_HEADING = {
  video: "Videos",
  article: "Articles",
  book: "Books",
  exercise: "Exercises"
};
var MATERIAL_TYPE_ICON = {
  video: "play",
  article: "file-text",
  book: "book-open",
  exercise: "pencil-line"
};
var angleDetailSequence = 0;
function rankOf(value) {
  const index = value ? TRIAGE_ORDER.indexOf(value) : -1;
  return index < 0 ? 0 : index;
}
function materialTypeOf(resource, source) {
  if (resource.kind === "practise") return "exercise";
  if (resource.kind === "watch") return "video";
  const declared = (asText(resource.record.format) ?? asText(resource.record.material_type) ?? asText(source?.source_type) ?? asText(source?.format) ?? "").toLowerCase();
  if (declared === "exercise" || declared === "practice" || declared === "practise" || declared === "problem-set" || declared === "homework" || declared === "quiz") return "exercise";
  if (declared === "video") return "video";
  if (declared === "book" || declared === "textbook") return "book";
  return "article";
}
function renderStageResources(parent, resourcesValue, renderer) {
  const resources = section(parent, renderer.title ?? "Material catalogue");
  resources.addClass(
    "los-stage-resources"
  );
  resources.createSpan({
    cls: "los-micro los-stage-resource-count",
    text: `${resourcesValue.length} ${resourcesValue.length === 1 ? "material" : "materials"}`
  });
  resources.createEl("p", {
    cls: "los-stage-resource-summary",
    text: "Every material stays visible, grouped by type. Priority changes the order inside each group; each angle explains what the material covers."
  });
  if (!resourcesValue.length) {
    empty(
      resources,
      renderer.emptyTitle || "No source action selected",
      renderer.emptyDetail || "Add a focused source or practice action to this stage."
    );
    return resources;
  }
  const grouped = /* @__PURE__ */ new Map();
  for (const resource of resourcesValue) {
    const source = resource.sourceId && renderer.sourceRecord ? renderer.sourceRecord(resource.sourceId) : null;
    const materialType = materialTypeOf(resource, source);
    const entries = grouped.get(materialType);
    const entry = { resource, source };
    if (entries) entries.push(entry);
    else grouped.set(materialType, [entry]);
  }
  for (const materialType of MATERIAL_TYPE_ORDER) {
    const entries = grouped.get(materialType);
    if (!entries?.length) continue;
    entries.sort(
      (left, right) => rankOf(left.resource.scopeTriage) - rankOf(right.resource.scopeTriage)
    );
    const group = resources.createDiv({
      cls: `los-resource-type-group los-resource-type-${materialType}`
    });
    group.setAttr("aria-label", MATERIAL_TYPE_HEADING[materialType]);
    const groupHeading = group.createDiv({
      cls: "los-resource-type-heading"
    });
    const headingCopy = groupHeading.createDiv({
      cls: "los-resource-type-heading-copy"
    });
    icon(headingCopy.createSpan(), MATERIAL_TYPE_ICON[materialType]);
    headingCopy.createEl("h3", {
      text: MATERIAL_TYPE_HEADING[materialType]
    });
    groupHeading.createSpan({
      cls: "los-micro",
      text: `${entries.length} ${entries.length === 1 ? "material" : "materials"}`
    });
    for (const { resource, source } of entries) {
      const row3 = group.createDiv({
        cls: `los-resource-row los-triage-${resource.scopeTriage || "unranked"}`
      });
      icon(row3.createSpan(), MATERIAL_TYPE_ICON[materialType]);
      const copy = row3.createDiv({ cls: "los-resource-copy" });
      copy.createEl("strong", { text: resource.label });
      const metadata = copy.createDiv({
        cls: "los-resource-row-meta"
      });
      metadata.createSpan({
        cls: `los-resource-priority los-resource-priority-${resource.scopeTriage || "unranked"}`,
        text: resource.scopeTriage ? TRIAGE_HEADING[resource.scopeTriage] || resource.scopeTriage : "Primary \xB7 unranked"
      });
      if (resource.locator) {
        metadata.createSpan({
          cls: "los-micro los-resource-locator",
          text: resource.locator
        });
      }
      const angle = asText(
        resource.record.angle
      );
      if (angle) {
        copy.createDiv({
          cls: "los-resource-angle",
          text: angle
        });
      }
      const angleDetail = asText(
        resource.record.angle_detail
      );
      if (angleDetail) {
        const detailId = `los-resource-angle-detail-${++angleDetailSequence}`;
        const detail = copy.createDiv({
          cls: "los-resource-angle-detail",
          text: angleDetail,
          attr: {
            hidden: "",
            id: detailId
          }
        });
        const foot = copy.createDiv({ cls: "los-resource-foot" });
        if (source) chip(foot, source, renderer.openSource);
        let expanded = false;
        const toggle = button(
          foot,
          "\u25B8 Why this one",
          () => {
            expanded = !expanded;
            toggle.setText(`${expanded ? "\u25BE" : "\u25B8"} Why this one`);
            toggle.setAttr("aria-expanded", String(expanded));
            if (expanded) detail.removeAttribute("hidden");
            else detail.setAttr("hidden", "");
          },
          "quiet"
        );
        toggle.addClass("los-resource-angle-trigger");
        toggle.setAttrs({
          "aria-controls": detailId,
          "aria-expanded": "false"
        });
      } else if (source) {
        chip(copy, source, renderer.openSource);
      }
      const actions = row3.createDiv({ cls: "los-actions los-resource-actions" });
      if (resource.canOpen && renderer.openResource) {
        button(actions, "Open", () => renderer.openResource?.(resource), "quiet");
      } else if (source && hasDirectResourceTarget(source) && renderer.openSourceResource) {
        button(
          actions,
          "Open source",
          () => renderer.openSourceResource?.(source),
          "quiet"
        );
      }
      if (resource.sourceId && renderer.rateResource) {
        const sourceId = resource.sourceId;
        const resourceId = resource.id;
        const rate = (verdict) => renderer.rateResource?.(
          sourceId,
          resourceId,
          verdict
        );
        overflowMenu(actions, [
          ["Helpful", () => rate("helpful")],
          ["Too advanced", () => rate("too-advanced")],
          ["Useful for review", () => rate("useful-for-review")]
        ], resourceId ? `Rate ${resource.label}` : `Rate ${resource.label} (whole source)`);
      }
    }
  }
  return resources;
}

// src/features/unit/stage.ts
function renderStage(view, layout, unit, studyMap, stage) {
  const expectedRevisions = view.plugin.store.artifactGuard(
    unit.id,
    typeof studyMap.record.id === "string" ? studyMap.record.id : null
  );
  const center = layout.createDiv({
    cls: "los-stage-workspace"
  });
  const top = center.createDiv({
    cls: "los-stage-heading"
  });
  const stageIndex = studyMap.stages.findIndex(
    (candidate) => candidate.id === stage.id
  );
  const stagePosition = Math.max(stageIndex, 0) + 1;
  const stageState = stage.status === "complete" ? "Complete" : stage.status === "skipped" ? "Skipped" : stage.id === studyMap.currentStageId ? "Current" : "Selected";
  const headingRow = top.createDiv({
    cls: "los-stage-heading-row"
  });
  const headingCopy = headingRow.createDiv({
    cls: "los-stage-heading-copy"
  });
  const eyebrow = [
    `Stage ${stagePosition} of ${studyMap.stages.length}`,
    stage.examCritical ? "exam-critical" : "",
    stageState.toLowerCase(),
    stage.estimateMinutes ? `${stage.estimateMinutes} min` : ""
  ].filter(Boolean);
  headingCopy.createDiv({
    cls: "los-kicker",
    text: eyebrow.join(" \xB7 ")
  });
  headingCopy.createEl("h2", {
    text: stage.title
  });
  if (stage.objective) {
    headingCopy.createEl("p", {
      cls: "los-stage-objective",
      text: stage.objective
    });
  }
  const conceptRecords = stage.concepts.flatMap(
    (conceptId) => {
      const record4 = view.plugin.store.get(conceptId);
      return record4 ? [record4] : [];
    }
  );
  if (conceptRecords.length) {
    const concepts = center.createDiv({
      cls: "los-stage-concepts"
    });
    for (const record4 of conceptRecords) {
      chip(
        concepts,
        record4,
        (target) => view.plugin.nav.openRecord(target)
      );
    }
  }
  if (stage.doneWhen.length) {
    const marks = view.plugin.getDoneWhen(
      unit.id,
      stage.id
    );
    const checkedCount = stage.doneWhen.reduce(
      (count, _criterion, index) => count + (marks[index] ? 1 : 0),
      0
    );
    const done = center.createDiv({
      cls: "los-section los-stage-section"
    });
    const doneHeading = done.createDiv({
      cls: "los-stage-section-heading"
    });
    doneHeading.createEl("h2", {
      text: "Done when"
    });
    doneHeading.createSpan({
      cls: "los-micro",
      text: `${checkedCount} of ${stage.doneWhen.length}`
    });
    const list2 = done.createDiv({
      cls: "los-donewhen-list"
    });
    for (const [index, criterion] of stage.doneWhen.entries()) {
      const row3 = list2.createEl(
        "label",
        {
          cls: "los-donewhen-row"
        }
      );
      const box = row3.createEl(
        "input",
        {
          attr: {
            type: "checkbox",
            "aria-label": criterion
          }
        }
      );
      const checked = Boolean(marks[index]);
      if (checked) {
        box.setAttr(
          "checked",
          "checked"
        );
      }
      box.checked = checked;
      box.addEventListener(
        "change",
        () => {
          const nextChecked = Boolean(box.checked);
          view.plugin.setDoneWhen(
            unit.id,
            stage.id,
            index,
            nextChecked
          );
          row3.toggleClass(
            "is-checked",
            nextChecked
          );
        }
      );
      row3.toggleClass(
        "is-checked",
        checked
      );
      row3.createSpan({
        text: criterion
      });
    }
  }
  renderStageResources(center, stage.resources, {
    title: "Exact work",
    emptyDetail: "Use the unit scope and ask AI for a proposal.",
    sourceRecord: (sourceId) => view.plugin.store.get(sourceId),
    openSource: (source) => {
      const sourceId = asString(source.id);
      return sourceId ? view.plugin.nav.openLibrary(sourceId) : void 0;
    },
    openSourceResource: (source) => view.plugin.openResource(source),
    openResource: (resource) => view.plugin.openResource(resource.record),
    // ADR-009: when an id exists, feedback lands on the exact resource;
    // otherwise it deliberately describes the whole source.
    rateResource: (sourceId, resourceId, verdict) => view.mutate(
      () => view.plugin.gateway.feedback(
        unit.id,
        stage.id,
        sourceId,
        verdict,
        resourceId,
        expectedRevisions
      )
    )
  });
  view.renderStageContext(
    center,
    unit,
    studyMap,
    stage
  );
  view.renderActionBar(
    center,
    unit,
    stage,
    expectedRevisions
  );
}
function renderActionBar(view, root, unit, stage, expectedRevisions) {
  const bar = root.createDiv({
    cls: "los-unit-actionbar"
  });
  button(
    bar,
    "Complete stage",
    () => view.mutate(
      () => view.plugin.gateway.progress(
        unit.id,
        stage.id,
        "complete",
        expectedRevisions
      ),
      () => view.plugin.clearDoneWhen(
        unit.id,
        stage.id
      )
    ),
    "cta"
  );
  const menuItems = [
    stage.status !== "active" && [
      "Revisit stage",
      () => view.mutate(
        () => view.plugin.gateway.progress(
          unit.id,
          stage.id,
          "revisit",
          expectedRevisions
        )
      )
    ],
    [
      "Pause unit",
      () => view.mutate(
        () => view.plugin.gateway.progress(
          unit.id,
          stage.id,
          "paused",
          expectedRevisions
        )
      )
    ],
    [
      "Skip stage",
      () => view.mutate(
        () => view.plugin.gateway.progress(
          unit.id,
          stage.id,
          "skipped",
          expectedRevisions
        )
      )
    ],
    [
      "Report prerequisite gap",
      () => view.mutate(
        () => view.plugin.gateway.detour(
          unit.id,
          stage.id,
          "Prerequisite gap",
          "required-now",
          expectedRevisions
        )
      )
    ],
    [
      "Prepare shelving",
      () => view.plugin.nav.openShelving(
        unit.id
      )
    ],
    view.plugin.settings.showAiRecommendation && [
      "Ask AI with stage context",
      () => {
        const project = view.plugin.store.projectForUnit(
          unit.record
        );
        const projectId = asString(project?.id) ?? void 0;
        return view.plugin.askAiScoped(
          "Help with this stage. Treat the active file as supplementary context only.",
          {
            moduleId: unit.moduleId,
            projectId,
            unitId: unit.id,
            stageId: stage.id
          }
        );
      }
    ]
  ];
  overflowMenu(
    bar,
    menuItems,
    "More unit actions"
  );
}

// src/features/unit/materials.ts
var import_obsidian15 = require("obsidian");
var MATERIAL_TYPE_ORDER2 = [
  "video",
  "article",
  "book",
  "exercise"
];
var MATERIAL_TYPE_LABELS = {
  video: "Videos",
  article: "Articles",
  book: "Books",
  exercise: "Exercises"
};
function materialTypeOf2(format) {
  if (format === "video") return "video";
  if (format === "exercise" || format === "code" || format === "notebook" || format === "quiz" || format === "homework" || format === "problem-set") return "exercise";
  if (format === "book" || format === "textbook") return "book";
  return "article";
}
function optionIcon(materialType) {
  if (materialType === "video") return "play";
  if (materialType === "exercise") return "pencil-line";
  if (materialType === "article") return "file-text";
  return "book-open";
}
function renderMaterialOverview(view, root, unit, options, synthesis) {
  const studyMap = view.plugin.store.mapForUnit(unit.id);
  const expectedRevisions = view.plugin.store.artifactGuard(
    unit.id,
    typeof studyMap?.id === "string" ? studyMap.id : null
  );
  const titleById = new Map(
    unit.knowledgeNodes.map(
      (node) => [node.id, node.title]
    )
  );
  if (unit.knowledgeNodes.length) {
    const map = section(
      root,
      "Lecture knowledge map",
      unit.knowledgeSummary
    );
    const nodes = map.createDiv({ cls: "los-knowledge-grid" });
    for (const node of unit.knowledgeNodes) {
      const card = nodes.createDiv({ cls: "los-knowledge-node" });
      card.createEl("h3", { text: node.title });
      card.createEl("p", { text: node.summary });
      const dependencies = node.buildsOn.map((id2) => titleById.get(id2)).filter((title) => Boolean(title));
      if (dependencies.length) {
        card.createDiv({
          cls: "los-micro",
          text: `Builds on: ${dependencies.join(", ")}`
        });
      }
    }
  }
  if (synthesis) {
    renderMaterialSynthesis(view, root, synthesis, options);
  }
  if (!options.length) return;
  const materials = section(
    root,
    "Choose your learning material",
    "This is a complete menu, not a sequence. Pick the explanation angle and depth that fit your current need."
  );
  const grouped = /* @__PURE__ */ new Map();
  for (const option of options) {
    const materialType = materialTypeOf2(
      option.format
    );
    const group = grouped.get(materialType);
    if (group) group.push(option);
    else grouped.set(materialType, [option]);
  }
  for (const materialType of MATERIAL_TYPE_ORDER2) {
    if (!grouped.has(materialType)) continue;
    const group = materials.createDiv({
      cls: `los-material-group los-material-group-${materialType}`
    });
    const entries = grouped.get(materialType) ?? [];
    const heading = group.createDiv({
      cls: "los-material-group-heading"
    });
    heading.createEl("h3", {
      text: MATERIAL_TYPE_LABELS[materialType]
    });
    heading.createSpan({
      cls: "los-micro",
      text: `${entries.length} option${entries.length === 1 ? "" : "s"}`
    });
    for (const option of entries) {
      const row3 = group.createDiv({
        cls: "los-material-option"
      });
      icon(
        row3.createSpan({
          cls: "los-material-icon"
        }),
        optionIcon(materialType)
      );
      const copy = row3.createDiv({
        cls: "los-material-copy"
      });
      copy.createEl("h4", {
        text: option.title
      });
      copy.createEl("p", {
        text: option.angle
      });
      if (option.locator) {
        copy.createDiv({
          cls: "los-micro",
          text: option.locator
        });
      }
      const metadata = copy.createDiv({
        cls: "los-material-metadata"
      });
      badge(
        metadata,
        option.format.replaceAll("-", " "),
        "role"
      );
      badge(
        metadata,
        option.depth.replaceAll("-", " "),
        "role"
      );
      badge(
        metadata,
        option.scope.replaceAll("-", " "),
        option.scope === "current" ? "status" : "role"
      );
      for (const knowledgeId of option.covers) {
        const label = titleById.get(knowledgeId);
        if (label) {
          metadata.createSpan({
            cls: "los-knowledge-chip",
            text: label
          });
        }
      }
      if (option.sourceId) {
        const source = view.plugin.store.get(
          option.sourceId
        );
        if (source) {
          chip(
            copy,
            source,
            (record4) => {
              const id2 = asString(record4.id);
              return id2 ? view.plugin.nav.openLibrary(id2) : void 0;
            }
          );
        }
      }
      if (option.canOpen || option.canChoose) {
        const actions = row3.createDiv({
          cls: "los-actions los-material-actions"
        });
        if (option.canChoose && option.sourceId && option.locator) {
          const choice = button(
            actions,
            option.selected ? "Remove choice" : "Choose",
            () => {
              void view.plugin.mutate(
                () => view.plugin.gateway.sourceSelection(
                  unit.id,
                  option.routeId,
                  option.sourceId ?? "",
                  option.locator ?? "",
                  option.angle,
                  !option.selected,
                  expectedRevisions
                )
              ).then(
                () => new import_obsidian15.Notice(
                  option.selected ? "Material choice removed." : "Material chosen for this lecture."
                )
              ).catch(
                (error) => new import_obsidian15.Notice(
                  error instanceof Error ? error.message : String(error)
                )
              );
            },
            "choice"
          );
          choice.setAttr(
            "aria-pressed",
            option.selected ? "true" : "false"
          );
        }
        if (option.canOpen) {
          button(
            actions,
            "Open",
            () => view.plugin.openResource(
              option.record
            ),
            "info"
          );
        }
      }
    }
  }
}
function renderMaterialSynthesis(view, root, synthesis, options) {
  const block = section(
    root,
    "Approved material synthesis",
    "Evidence-backed comparison of the exact material routes approved for this unit."
  );
  block.addClass("los-material-synthesis");
  const routeTitles = new Map(options.map((option) => [option.routeId, option.title]));
  const head = block.createDiv({ cls: "los-material-synthesis-head" });
  badge(head, "approved", "status");
  const policy = asString(synthesis.basis.policy);
  if (policy) badge(head, policy.replaceAll("-", " "), "role");
  head.createSpan({
    cls: "los-micro",
    text: `${synthesis.route_assessments.length} assessed route${synthesis.route_assessments.length === 1 ? "" : "s"} \xB7 unit r${synthesis.basis.unit_revision} \xB7 source map r${synthesis.basis.source_map_revision}`
  });
  const projectionStatus = block.createDiv({
    cls: `los-synthesis-status${synthesis.freshness.status === "stale" ? " is-stale" : ""}`,
    attr: { role: "status" }
  });
  const statusHead = projectionStatus.createDiv({ cls: "los-material-synthesis-head" });
  badge(
    statusHead,
    synthesis.freshness.status === "current" ? "current basis" : "stale basis",
    synthesis.freshness.status === "current" ? "status" : "role"
  );
  badge(
    statusHead,
    synthesis.completeness.complete ? "complete route coverage" : "incomplete route coverage",
    synthesis.completeness.complete ? "status" : "role"
  );
  projectionStatus.createDiv({
    cls: "los-micro",
    text: `${synthesis.completeness.assessed_route_count}/${synthesis.completeness.current_route_count} current routes assessed \xB7 ${synthesis.completeness.deep_reviewed_count} deep reviewed \xB7 ${synthesis.completeness.screened_count} screened \xB7 ${synthesis.completeness.unevaluated_count} unevaluated \xB7 ${synthesis.completeness.unavailable_count} unavailable`
  });
  if (synthesis.freshness.status === "stale") {
    projectionStatus.createEl("p", {
      text: "This approved dossier is retained below for reference, but its current basis no longer matches: " + synthesis.freshness.reasons.map((reason) => reason.replaceAll("_", " ")).join(", ") + "."
    });
  }
  if (!synthesis.completeness.complete) {
    const routeIssues = [
      synthesis.completeness.missing_route_ids.length ? `Missing: ${synthesis.completeness.missing_route_ids.join(", ")}` : "",
      synthesis.completeness.orphaned_route_ids.length ? `Orphaned: ${synthesis.completeness.orphaned_route_ids.join(", ")}` : "",
      synthesis.completeness.duplicate_route_ids.length ? `Duplicated: ${synthesis.completeness.duplicate_route_ids.join(", ")}` : ""
    ].filter(Boolean);
    projectionStatus.createDiv({
      cls: "los-micro",
      text: routeIssues.length ? routeIssues.join(" \xB7 ") : "Route coverage is not complete."
    });
  }
  const assessments = block.createDiv({ cls: "los-synthesis-grid" });
  for (const assessment2 of synthesis.route_assessments) {
    const card = assessments.createDiv({ cls: "los-synthesis-card" });
    const heading = card.createDiv({ cls: "los-synthesis-card-head" });
    heading.createEl("h3", {
      text: routeTitles.get(assessment2.route_id) || assessment2.locator
    });
    badge(
      heading,
      assessment2.review_status.replaceAll("-", " "),
      assessment2.review_status === "deep-reviewed" ? "status" : "role"
    );
    card.createDiv({ cls: "los-micro", text: assessment2.locator });
    const source = view.plugin.store.get(assessment2.source_id);
    if (source) {
      chip(card, source, (record4) => {
        const sourceId = asString(record4.id);
        return sourceId ? view.plugin.nav.openLibrary(sourceId) : void 0;
      });
    }
    const details = [
      ["Contribution", assessment2.contribution],
      ["Best for", assessment2.best_for],
      ["Assumptions", assessment2.assumptions],
      ["Notation", assessment2.notation],
      ["Exercise value", assessment2.exercise_value],
      ["Limitations", assessment2.limitations],
      ["Review note", assessment2.reason]
    ];
    for (const [label, value] of details) {
      if (!value) continue;
      const row3 = card.createDiv({ cls: "los-synthesis-detail" });
      row3.createSpan({ cls: "los-micro", text: label });
      row3.createEl("p", { text: value });
    }
    if (assessment2.concept_ids.length) {
      const concepts = card.createDiv({ cls: "los-material-metadata" });
      for (const conceptId of assessment2.concept_ids) {
        const concept = view.plugin.store.get(conceptId);
        if (concept) chip(concepts, concept, (record4) => view.plugin.nav.openRecord(record4));
      }
    }
    const evidenceCount = assessment2.evidence?.length || 0;
    if (evidenceCount) {
      card.createDiv({
        cls: "los-micro",
        text: `${evidenceCount} pinned evidence locator${evidenceCount === 1 ? "" : "s"}`
      });
    }
  }
  if (synthesis.comparisons.length) {
    const comparisons = block.createDiv({ cls: "los-synthesis-comparisons" });
    comparisons.createEl("h3", { text: "Route comparisons" });
    for (const comparison2 of synthesis.comparisons) {
      const row3 = comparisons.createDiv({ cls: "los-synthesis-comparison" });
      const labels = [
        routeTitles.get(comparison2.left_route_id) || comparison2.left_route_id,
        routeTitles.get(comparison2.right_route_id) || comparison2.right_route_id
      ];
      const heading = row3.createDiv({ cls: "los-synthesis-comparison-head" });
      heading.createEl("strong", { text: labels.join(" \u2194 ") });
      badge(heading, comparison2.relation.replaceAll("-", " "), "role");
      row3.createEl("p", { text: comparison2.narrative });
    }
  }
  if (synthesis.concept_groups.length) {
    const bridges = block.createDiv({ cls: "los-synthesis-comparisons" });
    bridges.createEl("h3", { text: "Concept bridges" });
    for (const group of synthesis.concept_groups) {
      const row3 = bridges.createDiv({ cls: "los-synthesis-comparison" });
      const concept = view.plugin.store.get(group.concept_id);
      row3.createEl("strong", {
        text: asString(concept?.title) || group.concept_id
      });
      row3.createEl("p", { text: group.narrative });
      const related = row3.createDiv({ cls: "los-material-metadata" });
      for (const relatedId of [...group.related_unit_ids, ...group.bridge_note_ids]) {
        const record4 = view.plugin.store.get(relatedId);
        if (record4) chip(related, record4, (target) => view.plugin.nav.openRecord(target));
      }
    }
  }
}

// src/features/learning-route.ts
function renderLearningProgress(parent, completedValue, totalValue, ariaLabel, showCopy = true) {
  const total = Math.max(0, totalValue);
  const completed = Math.min(Math.max(0, completedValue), total);
  const percent = total ? Math.round(completed / total * 100) : 0;
  if (showCopy) {
    const copy = parent.createDiv({ cls: "los-stage-progress-copy" });
    copy.createSpan({ text: `${completed} of ${total} complete` });
    copy.createSpan({ cls: "los-micro", text: `${percent}%` });
  }
  const progress = parent.createDiv({
    cls: "los-stage-progress",
    attr: {
      role: "progressbar",
      "aria-label": ariaLabel,
      "aria-valuemin": "0",
      "aria-valuemax": "100",
      "aria-valuenow": String(percent)
    }
  });
  const value = progress.createDiv({ cls: "los-stage-progress-value" });
  value.style.width = `${percent}%`;
  return progress;
}
function renderLearningRouteRail(parent, options) {
  const rail = parent.createEl("nav", { cls: "los-stage-rail" });
  rail.setAttr("aria-label", options.ariaLabel);
  const summary = rail.createDiv({ cls: "los-stage-rail-summary" });
  summary.createEl("h2", { text: options.title });
  if (options.showProgress !== false) {
    renderLearningProgress(
      summary,
      options.completed,
      options.items.length,
      options.progressLabel
    );
  } else {
    summary.addClass("is-label-only");
    if (options.titleMeta) {
      summary.createSpan({ cls: "los-micro", text: options.titleMeta });
    }
  }
  const list2 = rail.createDiv({ cls: "los-stage-list", attr: { role: "list" } });
  const selectedIndex = options.items.findIndex((item) => item.id === options.selectedId);
  for (const [index, item] of options.items.entries()) {
    const selected = item.id === options.selectedId;
    const row3 = list2.createEl("button", {
      cls: `los-stage-row los-s-${item.state} ${selected ? "is-selected" : index > selectedIndex ? "is-upcoming" : "is-before"} is-clickable`,
      attr: {
        type: "button",
        role: "listitem",
        "aria-label": `Open stage ${item.number}: ${item.title}`,
        "aria-posinset": String(index + 1),
        "aria-setsize": String(options.items.length),
        "aria-current": selected ? "step" : "false",
        "aria-pressed": String(selected)
      }
    });
    row3.createSpan({ cls: "los-stage-marker", attr: { "aria-hidden": "true" } });
    const copy = row3.createSpan({ cls: "los-stage-copy" });
    copy.createSpan({ cls: "los-stage-title", text: `${item.number} \xB7 ${item.title}` });
    if (item.marker) copy.createSpan({ cls: "los-micro", text: item.marker });
    row3.addEventListener("click", () => options.select(item.id));
  }
  return rail;
}

// src/features/unit/map-import.ts
var import_obsidian16 = require("obsidian");
var UnitMapImportModal = class extends import_obsidian16.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
  }
  restoreAccessibility = null;
  onOpen() {
    const { replacing, unitTitle } = this.options;
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-map-import-modal");
    const heading = root.createEl("h2", {
      text: replacing ? "Replace study map" : "Import study map"
    });
    heading.id = "los-map-import-heading";
    root.createEl("p", {
      cls: "los-muted",
      text: replacing ? `${unitTitle} already has a current map. Importing archives the old one in Git and makes this the current map.` : `Apply a reviewed study map to ${unitTitle}. The coverage audit stays where the SOP puts it; this applies its result.`
    });
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: "los-modal--map-import",
      labelledBy: heading.id
    });
    const standard = root.createDiv({
      cls: "los-muted los-plan-standard",
      attr: { "aria-live": "polite" }
    });
    standard.setText("Reading the plan template from LearningOS\u2026");
    const field = root.createDiv({ cls: "los-map-import-field" });
    field.createEl("label", { text: "Reviewed map file" });
    const file = field.createEl("input", { attr: { type: "text" } });
    file.placeholder = "path to the audited study-map YAML";
    const status = root.createDiv({ cls: "los-draft-status", attr: { "aria-live": "polite" } });
    const actions = root.createDiv({ cls: "los-actions los-map-import-actions" });
    const submit = button(actions, replacing ? "Replace map" : "Import map", async () => {
      const path = file.value.trim();
      if (!path) {
        status.setText("Name the reviewed file first.");
        return;
      }
      submit.disabled = true;
      status.setText("Importing\u2026");
      try {
        await this.options.submit(path, replacing);
        this.close();
      } catch (error) {
        submit.disabled = false;
        status.setText(errorMessage(error));
      }
    }, "cta");
    button(actions, "Cancel", () => this.close(), "quiet");
    void this.describeStandard(standard);
    file.focus();
  }
  async describeStandard(standard) {
    if (!this.options.template) {
      standard.setText(
        "This host cannot read the plan template; LearningOS still enforces it on import."
      );
      return;
    }
    try {
      const template = await this.options.template();
      standard.setText(
        `The file must declare plan_template_version ${template.planTemplateVersion}, carry stages numbered from one, and satisfy ${template.schema}. LearningOS refuses the whole import otherwise.`
      );
    } catch (error) {
      standard.setText(
        `Could not read the plan template: ${errorMessage(error)}. LearningOS still enforces it on import.`
      );
    }
  }
  onClose() {
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
};

// src/contracts/plan-template.ts
var PLAN_TEMPLATE_CONTRACT = "plan-template-v1";

// src/features/plan-template.ts
function horizon(value) {
  return value === "now" || value === "next" ? value : "later";
}
function asPlanTemplate(result) {
  if (result.ok !== true || result.contract !== PLAN_TEMPLATE_CONTRACT) {
    throw new Error("LearningOS did not answer the plan-template contract.");
  }
  const profile = result.profile === "curriculum" ? result.profile : null;
  const version = asFiniteNumber(result.plan_template_version);
  const plan = asRecordOrEmpty(result.plan);
  if (!profile || version === null || version < 1) {
    throw new Error("The plan template answer named no profile or template version.");
  }
  return {
    profile,
    planTemplateVersion: version,
    schema: asTrimmedString(result.schema),
    title: asTrimmedString(plan.title),
    cadence: asTrimmedString(plan.cadence),
    outcome: asTrimmedString(plan.outcome),
    horizon: horizon(plan.horizon)
  };
}

// src/features/unit/shell.ts
function render(view) {
  const root = view.contentEl;
  root.empty();
  root.addClass(
    "los-root",
    "los-unit-view"
  );
  const routeUnitId = view.unitId;
  const projectedUnit = routeUnitId ? view.plugin.store.get(
    routeUnitId
  ) : null;
  const unit = readUnitRecord(
    projectedUnit,
    routeUnitId
  );
  if (!unit) {
    empty(
      root,
      "Unit unavailable",
      "Return to its module."
    );
    return;
  }
  const module2 = view.plugin.store.get(
    unit.moduleId
  );
  const project = view.plugin.store.projectForUnit(
    unit.record
  );
  const ownerLabel = asLabel(
    project,
    asLabel(
      module2,
      unit.moduleId
    )
  );
  const header = pageHeader(
    root,
    `${ownerLabel} \xB7 ${unit.kind}`,
    unit.title,
    unit.scope
  );
  const headerActions = header.createDiv({
    cls: "los-actions"
  });
  if (project) {
    button(
      headerActions,
      "Back to project",
      () => view.plugin.nav.back(),
      "quiet"
    );
  } else {
    button(
      headerActions,
      "Back to module",
      () => view.plugin.nav.openModule(
        unit.moduleId
      ),
      "quiet"
    );
  }
  button(
    headerActions,
    "End session",
    () => view.plugin.reviewSessionEnd(),
    "info"
  );
  const sourceMap = view.plugin.store.sourceMap(
    unit.moduleId
  );
  const materialOptions = readMaterialOptions(
    sourceMap?.sources,
    unit.id,
    unit.record.source_selections
  );
  const materialSynthesis = view.plugin.store.materialSynthesisForUnit(
    unit.id
  );
  const hasMaterialOverview = unit.knowledgeNodes.length > 0 || materialOptions.length > 0 || materialSynthesis !== null;
  const renderMaterials = () => {
    if (!hasMaterialOverview) return;
    renderMaterialOverview(
      view,
      root,
      unit,
      materialOptions,
      materialSynthesis
    );
  };
  const projectedStudyMap = view.plugin.store.mapForUnit(
    unit.id
  );
  if (!projectedStudyMap) {
    renderMaterials();
    const owed = unit.needsStudyMap;
    const missing = section(
      root,
      owed ? "Study map required" : "Personal study path (optional)"
    );
    const projectId = asString(project?.id) ?? void 0;
    const componentId = unit.componentId ?? void 0;
    empty(
      missing,
      owed ? "This unit has no ordered study map" : "No personal path selected",
      owed ? hasMaterialOverview ? "The material menu above says what may be used. A map says in what order and against what proof, and it is what makes progress trackable. AI may propose one; the core imports it only after review." : "AI may propose a scoped map; the core imports it only after review." : "This unit is complete, archived, or belongs to a module you are no longer studying. Create a path only if you want progress tracking anyway.",
      owed ? "Create map with AI" : "Build optional path with AI",
      () => view.plugin.askAiScoped(
        owed ? "Propose one study-map JSON document for this unit, ordered over the materials in its overview. Do not replace or summarize the overview, and do not write files; include exact source actions and done-when criteria." : "Propose an optional personal study-map JSON document using only materials I choose from this unit material overview. Do not replace or summarize the overview, and do not write files; include exact source actions and done-when criteria.",
        {
          moduleId: unit.moduleId,
          projectId,
          unitId: unit.id,
          componentId
        }
      )
    );
    openMapImport(
      view,
      missing,
      unit,
      false
    );
    view.renderArtifacts(
      root,
      unit
    );
    return;
  }
  const studyMap = readStudyMap(
    projectedStudyMap
  );
  const firstStage = studyMap.stages[0];
  if (!firstStage) {
    renderMaterials();
    const bare = section(
      root,
      "Study map needs stages"
    );
    empty(
      bare,
      "This study map has no stages yet",
      "Stage authoring belongs to the core \u2014 import a map or add stages there, then rebuild views."
    );
    view.renderArtifacts(
      root,
      unit
    );
    return;
  }
  const stageIds = new Set(
    studyMap.stages.map(
      (stage2) => stage2.id
    )
  );
  if (!view.stageId || !stageIds.has(view.stageId)) {
    view.stageId = studyMap.currentStageId && stageIds.has(
      studyMap.currentStageId
    ) ? studyMap.currentStageId : firstStage.id;
    view.plugin.setSelectedStage(
      unit.id,
      view.stageId
    );
  }
  const stage = studyMap.stages.find(
    (candidate) => candidate.id === view.stageId
  ) ?? firstStage;
  const layout = root.createDiv({
    cls: "los-unit-layout"
  });
  view.renderRail(
    layout,
    unit,
    studyMap,
    stage
  );
  view.renderStage(
    layout,
    unit,
    studyMap,
    stage
  );
  renderMaterials();
  const more = disclosure(
    root,
    "Unit artifacts and evidence",
    "los-unit-extras"
  );
  const provenance = more.createDiv({
    cls: "los-map-provenance"
  });
  provenance.createSpan({
    cls: "los-micro",
    text: studyMap.planTemplateVersion === null ? "This study map predates plan template v1. It stays readable; a replacement is imported from the current template." : `Study map on plan template v${studyMap.planTemplateVersion}.`
  });
  openMapImport(
    view,
    provenance,
    unit,
    true
  );
  view.renderArtifacts(
    more,
    unit
  );
}
function openMapImport(view, parent, unit, replacing) {
  const currentMap = view.plugin.store.mapForUnit(unit.id);
  const expectedRevisions = view.plugin.store.artifactGuard(
    unit.id,
    typeof currentMap?.id === "string" ? currentMap.id : null
  );
  const actions = parent.createDiv({
    cls: "los-actions"
  });
  button(
    actions,
    replacing ? "Replace with reviewed map" : "Import reviewed map",
    () => new UnitMapImportModal(
      view.app,
      {
        unitId: unit.id,
        unitTitle: unit.title,
        replacing,
        template: async () => asPlanTemplate(
          await view.plugin.gateway.planTemplate(
            "curriculum",
            unit.title,
            {
              unitId: unit.id,
              moduleId: unit.moduleId
            }
          )
        ),
        submit: (file, replace) => view.plugin.mutate(
          () => view.plugin.gateway.importUnitMap(
            unit.id,
            file,
            replace,
            expectedRevisions
          )
        )
      }
    ).open(),
    replacing ? "quiet" : "cta"
  );
}
function renderRail(view, layout, unit, studyMap, current) {
  const completedCount = studyMap.stages.filter(
    (stage) => stage.status === "complete"
  ).length;
  const currentIndex = studyMap.stages.findIndex(
    (stage) => stage.id === current.id
  );
  const rail = renderLearningRouteRail(layout, {
    title: "Stages",
    ariaLabel: "Ordered learning stages",
    progressLabel: "Overall learning route progress",
    showProgress: false,
    titleMeta: `${completedCount} of ${studyMap.stages.length} complete`,
    completed: completedCount,
    selectedId: current.id,
    items: studyMap.stages.map((stage, index) => ({
      id: stage.id,
      number: index + 1,
      title: stage.title,
      state: stage.status,
      marker: stage.status === "complete" ? "Complete" : stage.status === "skipped" ? "Skipped" : index === currentIndex ? `Done when \xB7 ${stage.doneWhen.length} criteria` : index > currentIndex ? "Not started" : ""
    })),
    select: (stageId) => {
      void view.selectStage(stageId);
    }
  });
  const stageRecords = studyMap.stages.map(
    (stage) => stage.record
  );
  const add = button(
    rail,
    "Add note",
    () => view.plugin.openUnitNote(
      unit.record,
      studyMap.record
    ),
    "quiet"
  );
  add.addClass(
    "los-add-unit-note"
  );
  const draft = view.plugin.getUnitNoteDraft(
    unit.id,
    stageRecords
  );
  if (typeof draft.text === "string" && draft.text.trim()) {
    rail.createDiv({
      cls: "los-micro los-unit-note-draft",
      text: "Unsaved unit-note draft kept locally."
    });
  }
}

// src/views/unit-view.ts
var import_obsidian17 = require("obsidian");
var UnitView = class extends import_obsidian17.ItemView {
  plugin;
  unitId;
  stageId;
  mutationPending = false;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.unitId = null;
    this.stageId = null;
  }
  getViewType() {
    return VIEW_UNIT;
  }
  getDisplayText() {
    return "LearningOS \xB7 Unit";
  }
  async setState(state = {}) {
    const parsed = readUnitViewState(state);
    const nextUnitId = parsed.unitId ?? this.unitId;
    if (nextUnitId !== this.unitId) {
      this.stageId = null;
    }
    this.unitId = nextUnitId;
    const requestedStageId = parsed.hasStageId ? parsed.stageId ?? null : null;
    const selectedStageId = this.unitId ? this.plugin.getSelectedStage(
      this.unitId
    ) : null;
    this.stageId = selectedStageId ?? requestedStageId ?? this.stageId;
    this.render();
  }
  getState() {
    return {
      unitId: this.unitId,
      stageId: this.stageId
    };
  }
  async onOpen() {
    const state = readUnitViewState(
      this.leaf.getViewState().state
    );
    this.unitId = state.unitId ?? this.unitId;
    const selectedStageId = this.unitId ? this.plugin.getSelectedStage(
      this.unitId
    ) : null;
    this.stageId = selectedStageId ?? (state.hasStageId ? state.stageId ?? null : null) ?? this.stageId;
    this.render();
  }
  render() {
    render(this);
  }
  renderRail(layout, unit, studyMap, current) {
    renderRail(this, layout, unit, studyMap, current);
  }
  renderStage(layout, unit, studyMap, stage) {
    renderStage(this, layout, unit, studyMap, stage);
  }
  /**
   * One primary action and one menu. The primary is filled; nothing else on
   * this screen may be.
   */
  renderActionBar(root, unit, stage, expectedRevisions) {
    renderActionBar(this, root, unit, stage, expectedRevisions);
  }
  renderStageContext(center, unit, studyMap, stage) {
    renderStageContext(this, center, unit, studyMap, stage);
  }
  renderArtifacts(root, unit) {
    renderArtifacts(this, root, unit);
  }
  /**
   * Every write goes through the plugin-wide queue, so two clicks in two views
   * can no longer race the same `--expected-snapshot`.
   */
  async mutate(action, onConfirmed = null) {
    if (this.mutationPending) {
      new import_obsidian17.Notice(
        "A LearningOS write is already running."
      );
      return;
    }
    if (this.plugin.gateway.isBusy) {
      new import_obsidian17.Notice(
        "Queued behind the running LearningOS write."
      );
    }
    this.mutationPending = true;
    try {
      await this.plugin.mutate(
        action
      );
      onConfirmed?.();
      this.render();
    } catch (error) {
      new import_obsidian17.Notice(
        errorMessage3(error)
      );
    } finally {
      this.mutationPending = false;
    }
  }
  async selectStage(stageId) {
    const unitId = this.unitId;
    if (!unitId) {
      new import_obsidian17.Notice(
        "This unit is no longer available."
      );
      return;
    }
    this.stageId = stageId;
    this.plugin.setSelectedStage(
      unitId,
      stageId
    );
    await this.leaf.setViewState({
      type: VIEW_UNIT,
      active: true,
      state: {
        unitId,
        stageId
      }
    });
  }
};

// src/app/registration.ts
var APPLICATION_VIEW_TYPES = [
  VIEW_HOME,
  VIEW_NAV,
  VIEW_PROGRAM,
  VIEW_MODULE,
  VIEW_PROJECT,
  VIEW_UNIT,
  VIEW_LIBRARY,
  VIEW_ATLAS,
  VIEW_SHELVING,
  VIEW_BOUNDARY,
  VIEW_REVIEW,
  VIEW_GARDEN,
  VIEW_DIAGNOSTICS
];
function detachLegacyViews(plugin) {
  for (const type of LEGACY_VIEW_TYPES) plugin.app.workspace.detachLeavesOfType(type);
}
function registerApplication(plugin) {
  detachLegacyViews(plugin);
  plugin.registerView(VIEW_HOME, (leaf) => new HomeView(leaf, plugin));
  plugin.registerView(VIEW_NAV, (leaf) => new NavView(leaf, plugin));
  plugin.registerView(VIEW_PROGRAM, (leaf) => new ProgramView(leaf, plugin));
  plugin.registerView(VIEW_MODULE, (leaf) => new ModuleView(leaf, plugin));
  plugin.registerView(VIEW_PROJECT, (leaf) => new ProjectView(leaf, plugin));
  plugin.registerView(VIEW_UNIT, (leaf) => new UnitView(leaf, plugin));
  plugin.registerView(VIEW_LIBRARY, (leaf) => new LibraryView(leaf, plugin));
  plugin.registerView(VIEW_ATLAS, (leaf) => new AtlasView(leaf, plugin));
  plugin.registerView(VIEW_SHELVING, (leaf) => new ShelvingView(leaf, plugin));
  plugin.registerView(VIEW_BOUNDARY, (leaf) => new BoundaryView(leaf, plugin));
  plugin.registerView(VIEW_REVIEW, (leaf) => new ReviewView(leaf, plugin));
  plugin.registerView(VIEW_GARDEN, (leaf) => new GardenView(leaf, plugin));
  plugin.registerView(VIEW_DIAGNOSTICS, (leaf) => new DiagnosticsView(leaf, plugin));
  plugin.addSettingTab(new LearningOSSettingsTab(plugin.app, plugin));
  plugin.addRibbonIcon("route", "Open LearningOS", () => plugin.nav.openHome());
  plugin.addCommand({ id: "open-home", name: "Open Home", callback: () => plugin.nav.openHome() });
  plugin.addCommand({ id: "open-current-stage", name: "Open current stage", callback: () => plugin.nav.openResume() });
  plugin.addCommand({ id: "open-modules", name: "Open Modules", callback: () => plugin.nav.openModules() });
  plugin.addCommand({ id: "open-projects", name: "Open Projects", callback: () => plugin.nav.openProjects() });
  plugin.addCommand({ id: "open-library", name: "Open Library", callback: () => plugin.nav.openLibrary() });
  plugin.addCommand({ id: "open-global-search", name: "Search LearningOS", callback: () => plugin.nav.openGlobalSearch() });
  plugin.addCommand({ id: "open-atlas", name: "Open Module \xD7 Concept atlas", callback: () => plugin.nav.openAtlas() });
  plugin.addCommand({ id: "open-garden", name: "Open Garden", callback: () => plugin.nav.openGarden() });
  plugin.addCommand({ id: "open-review", name: "Open Review", callback: () => plugin.nav.openReview() });
  plugin.addCommand({ id: "rebuild-projection", name: "Validate and rebuild projection", callback: () => plugin.generate() });
  plugin.addCommand({ id: "end-learning-session", name: "End learning session safely", callback: () => plugin.reviewSessionEnd() });
  plugin.app.workspace.onLayoutReady(async () => {
    detachLegacyViews(plugin);
    await plugin.router.openNavigator();
    plugin.app.workspace.leftSplit?.setSize?.(280);
    if (plugin.settings.collapseSidebars) plugin.app.workspace.rightSplit?.collapse();
    if (plugin.settings.openHomeOnStartup) await plugin.router.restore();
  });
}
function detachApplication(plugin) {
  for (const type of APPLICATION_VIEW_TYPES) plugin.app.workspace.detachLeavesOfType(type);
}

// src/app/navigator.ts
var import_obsidian19 = require("obsidian");

// src/app/global-search.ts
var import_obsidian18 = require("obsidian");
var GlobalSearchModal = class extends import_obsidian18.Modal {
  plugin;
  query;
  filter;
  input;
  tabButtons = [];
  results;
  restoreAccessibility = null;
  constructor(app, plugin, initialQuery = "") {
    super(app);
    this.plugin = plugin;
    this.query = String(initialQuery || "");
    this.filter = "all";
  }
  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-global-search");
    this.plugin.router.openOverlay({ kind: "global-search", query: this.query, filter: this.filter });
    const header = root.createDiv({ cls: "los-search-header" });
    const copy = header.createDiv();
    copy.createDiv({ cls: "los-kicker", text: "Search LearningOS" });
    copy.createEl("h2", {
      text: "Find a module, unit, source, or project",
      attr: { id: "los-global-search-heading" }
    });
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: "los-modal--global-search",
      initialFocus: () => this.input ?? null,
      labelledBy: "los-global-search-heading"
    });
    button(header, "Close", () => this.close(), "quiet").setAttribute("aria-label", "Close global search");
    this.input = root.createEl("input", {
      cls: "los-search los-global-search-input",
      attr: {
        type: "search",
        placeholder: "Search titles, aliases, authors, and IDs",
        "aria-label": "Search LearningOS",
        autocomplete: "off"
      }
    });
    this.input.value = this.query;
    this.input.addEventListener("input", () => {
      this.query = this.input.value;
      this.plugin.router.updateOverlay({ query: this.query });
      this.renderResults();
    });
    const tabs = root.createDiv({ cls: "los-search-tabs", attr: { role: "group", "aria-label": "Search result type" } });
    enableButtonGroupKeyboardNavigation(tabs);
    this.tabButtons = [];
    for (const [id2, label] of [
      ["all", "All"],
      ["learning", "Modules & units"],
      ["sources", "Learning sources"],
      ["projects", "Projects"]
    ]) {
      const tab = button(tabs, label, () => {
        this.filter = id2;
        this.plugin.router.updateOverlay({ filter: id2 });
        this.renderTabs();
        this.renderResults();
      }, "tertiary");
      tab.addClass("los-search-tab");
      tab.setAttrs({ "data-filter": id2, "aria-pressed": String(this.filter === id2) });
      this.tabButtons.push(tab);
    }
    this.results = root.createDiv({ cls: "los-search-results", attr: { "aria-live": "polite" } });
    this.renderTabs();
    this.renderResults();
  }
  onClose() {
    this.plugin.router.clearOverlay();
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
  renderTabs() {
    for (const tab of this.tabButtons || []) {
      const active = tab.getAttribute("data-filter") === this.filter;
      tab.toggleClass("is-active", active);
      tab.setAttribute("aria-pressed", String(active));
    }
  }
  candidates() {
    const rows = [];
    const add = (record4, kind, subtitle, open) => {
      if (!record4?.id || !record4?.title) return;
      rows.push({
        id: record4.id,
        title: record4.title,
        aliases: [...record4.aliases || []],
        authors: [...record4.authors || []],
        kind,
        subtitle,
        open
      });
    };
    for (const module2 of this.plugin.store.modules()) {
      if (!module2.id) continue;
      const area = module2.area_id ? this.plugin.store.get(module2.area_id)?.title || module2.code || "Module" : module2.code || "Module";
      add(module2, "learning", `Module \xB7 ${area}`, () => this.plugin.openModule(module2.id));
    }
    for (const project of this.plugin.store.projects()) {
      if (!project.id) continue;
      add(
        project,
        "projects",
        `Project \xB7 ${project.project_type || project.status || "active"}`,
        () => this.plugin.openProject(project.id)
      );
    }
    for (const unit of this.plugin.store.units()) {
      if (!unit.id || !unit.module_id) continue;
      const module2 = this.plugin.store.get(unit.module_id);
      add(unit, "learning", `Unit \xB7 ${module2?.title || unit.module_id}`, () => this.plugin.openUnit(unit.id));
    }
    for (const source of this.plugin.store.sources()) {
      if (!source.id) continue;
      const byline = (source.authors || []).join(", ") || source.organization || source.kind || "Learning source";
      add(source, "sources", `Learning source \xB7 ${byline}`, () => this.plugin.openLibrary(source.id, "source"));
    }
    for (const pack of this.plugin.store.topicPacks()) {
      if (!pack.id) continue;
      add(
        pack,
        "sources",
        `Topic Pack \xB7 ${(pack.entries || []).length} items`,
        () => this.plugin.openTopicPackDetail(pack.id)
      );
    }
    for (const workspace of this.plugin.store.of("workspace")) {
      const linkedProject = workspace.project_id ? this.plugin.store.get(workspace.project_id) : null;
      if (!linkedProject) continue;
      if (!linkedProject.id) continue;
      add(workspace, "projects", `Project workspace \xB7 ${linkedProject.title || linkedProject.id}`, () => this.plugin.openProject(linkedProject.id));
    }
    return rows;
  }
  matches(candidate) {
    const words2 = this.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words2.length) return true;
    const haystack = [
      candidate.id,
      candidate.title,
      candidate.subtitle,
      ...candidate.aliases,
      ...candidate.authors
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return words2.every(
      (word) => haystack.includes(word)
    );
  }
  rankedCandidates() {
    const needle = this.query.toLocaleLowerCase().trim();
    return this.candidates().filter((candidate) => this.filter === "all" || candidate.kind === this.filter).filter((candidate) => this.matches(candidate)).sort((left, right) => {
      const leftTitle = left.title.toLocaleLowerCase();
      const rightTitle = right.title.toLocaleLowerCase();
      const leftRank = !needle ? 2 : leftTitle === needle ? 0 : leftTitle.startsWith(needle) ? 1 : 2;
      const rightRank = !needle ? 2 : rightTitle === needle ? 0 : rightTitle.startsWith(needle) ? 1 : 2;
      return leftRank - rightRank || left.title.localeCompare(right.title);
    });
  }
  renderResults() {
    if (!this.results) return;
    this.results.empty();
    const rows = this.rankedCandidates();
    const summary = this.results.createDiv({ cls: "los-search-summary" });
    summary.createSpan({ text: this.query.trim() ? `${rows.length} result${rows.length === 1 ? "" : "s"}` : "Quick access" });
    summary.createSpan({ cls: "los-micro", text: "Manifest identities only" });
    if (!rows.length) {
      empty(
        this.results,
        "No structural results",
        `Nothing in the current LearningOS projection matches \u201C${this.query.trim()}\u201D.`,
        "Clear search",
        () => {
          this.query = "";
          this.input.value = "";
          this.plugin.router.updateOverlay({ query: "" });
          this.renderResults();
          this.input.focus();
        }
      );
      return;
    }
    const list2 = this.results.createDiv({ cls: "los-search-result-list" });
    for (const row3 of rows.slice(0, 24)) {
      const result = list2.createEl("button", {
        cls: "los-search-result is-clickable",
        attr: { type: "button", "aria-label": `Open ${row3.title}` }
      });
      const copy = result.createDiv({ cls: "los-search-result-copy" });
      copy.createEl("strong", { text: row3.title });
      copy.createDiv({ cls: "los-micro", text: row3.subtitle });
      result.createSpan({ cls: "los-search-open", text: "Open \u2192" });
      result.addEventListener("click", () => {
        this.close();
        row3.open();
      });
    }
    if (rows.length > 24) {
      this.results.createDiv({ cls: "los-micro", text: `${rows.length - 24} more results. Refine the query to narrow the list.` });
    }
  }
};

// src/app/navigator.ts
var AppNavigator = class {
  constructor(app, router, store, settings, drafts, resources) {
    this.app = app;
    this.router = router;
    this.store = store;
    this.settings = settings;
    this.drafts = drafts;
    this.resources = resources;
  }
  async openNavigator() {
    return this.router.openNavigator();
  }
  async openHome() {
    return this.router.navigate({ name: "home" });
  }
  /** Learn is one destination; the areas are sub-areas inside it. */
  openLearn(programId = null) {
    const area = programId || this.settings.learnArea || LEARN_AREAS[0][0];
    this.settings.learnArea = area;
    this.drafts.scheduleSave();
    return this.router.navigate({ name: "learn", programId: area });
  }
  openCapture() {
    return this.router.navigate({ name: "capture" });
  }
  openReview() {
    return this.router.navigate({ name: "review" });
  }
  openGarden() {
    return this.router.navigate({ name: "garden" });
  }
  openDiagnostics() {
    return this.router.navigate({ name: "diagnostics" });
  }
  openGlobalSearch(query = "") {
    const modal = new GlobalSearchModal(this.app, this, query);
    modal.open();
    return modal;
  }
  openProgram(programId) {
    return this.router.navigate({ name: "program", programId });
  }
  openModules() {
    return this.router.navigate({ name: "module-groups" });
  }
  openProjects(query = "") {
    return this.router.navigate({ name: "project-list", query });
  }
  openProject(projectId, tab = "structure") {
    const current = this.router.snapshot().current;
    const changingTab = current?.name === "project-detail" && current.projectId === projectId;
    return this.router.navigate(
      { name: "project-detail", projectId, tab: asProjectDetailTab(tab) },
      { pushHistory: !changingTab }
    );
  }
  openModuleDetail(moduleId, componentId = null, tab = null) {
    return this.router.navigate({ name: "module-detail", moduleId, componentId, tab });
  }
  /** Compatibility alias used by Learn, Home and existing deep links. */
  openModule(moduleId, componentId = null) {
    return this.openModuleDetail(moduleId, componentId);
  }
  openUnit(unitId, stageId = null) {
    const selectedStage = stageId || this.drafts.getSelectedStage(unitId);
    if (selectedStage) this.drafts.setSelectedStage(unitId, selectedStage);
    return this.router.navigate({ name: "unit", unitId, stageId: selectedStage });
  }
  openLibrary(recordId = void 0, recordType = void 0) {
    if (recordId === void 0 || recordId === null) {
      return this.openLibraryHome(recordType === "topic-pack" ? "topic-packs" : "sources");
    }
    const record4 = this.store.get(recordId);
    if (record4?.type === "source" || recordType === "source") return this.openSourceDetail(recordId);
    if (record4?.type === "topic-pack" || recordType === "topic-pack") return this.openTopicPackDetail(recordId);
    if (record4?.type === "collection" || recordType === "collection") return this.openCatalogueDetail(recordId);
    return this.router.navigate({ name: "legacy-library-list", recordType: recordType || record4?.type || "note", query: "" });
  }
  openLibraryHome(collection = "sources", query = "", filters) {
    return this.router.navigate({
      name: "library-home",
      collection: asLibraryCollection(collection),
      query,
      ...filters ? { filters } : {}
    });
  }
  openLibraryGroup(collection, groupId, query = "", facet = "all", filters) {
    return this.router.navigate({
      name: "library-group",
      collection: asLibraryCollection(collection),
      groupId,
      query,
      facet,
      ...filters ? { filters } : {}
    });
  }
  openSourceDetail(resourceId, fromGroupId = null, query = "", facet = "all", filters) {
    return this.router.navigate({
      name: "source-detail",
      resourceId,
      fromGroupId,
      query,
      facet,
      ...filters ? { filters } : {}
    });
  }
  openTopicPackDetail(topicPackId, fromGroupId = null, query = "") {
    return this.router.navigate({ name: "topic-pack-detail", topicPackId, fromGroupId, query });
  }
  openCatalogueDetail(catalogueId) {
    return this.router.navigate({ name: "catalogue-detail", catalogueId });
  }
  /** Hidden compatibility surface used by Atlas and pre-migration deep links. */
  openLibraryFiltered(recordType, domain = "") {
    return this.router.navigate({ name: "legacy-library-list", recordType, domain, query: "" });
  }
  openAtlas(domain = null, concept = null) {
    const current = this.router.snapshot().current;
    const changingAtlasState = current?.name === "atlas";
    return this.router.navigate(
      { name: "atlas", domain, concept },
      { pushHistory: !changingAtlasState }
    );
  }
  openShelving(unitId = null) {
    return this.router.navigate({ name: "shelving", unitId });
  }
  openBoundary(boundaryId) {
    return this.router.navigate({ name: "boundary", boundaryId });
  }
  back() {
    return this.router.back();
  }
  openResume() {
    const pointer = this.store.data?.resume_pointer;
    const unitId = asString(pointer?.unit_id);
    const stageId = asString(pointer?.stage_id);
    return unitId ? this.openUnit(unitId, stageId) : this.openHome();
  }
  openRecord(record4) {
    if (!record4) return;
    const recordId = asString(record4.id);
    if (record4.type === "unit" && recordId) return this.openUnit(recordId);
    if (record4.type === "module" && recordId) return this.openModule(recordId);
    if (record4.type === "project" && recordId) return this.openProject(recordId);
    if (record4.type === "program" && recordId) return this.openProgram(recordId);
    if (record4.type === "source" && recordId) return this.openSourceDetail(recordId);
    if (record4.type === "topic-pack" && recordId) return this.openTopicPackDetail(recordId);
    if (record4.type === "collection" && recordId) return this.openCatalogueDetail(recordId);
    if (record4.type === "note" || record4.type === "concept") {
      if (record4.path) return this.resources.openAuthoredPath(record4.path);
      return this.openLibraryFiltered(record4.type);
    }
    if (record4.type === "workspace") {
      if (record4.project_id) return this.openProject(record4.project_id);
      const unit = (record4.unit_ids || []).map((id2) => this.store.get(id2)).find(Boolean);
      if (unit?.id) return this.openUnit(unit.id);
      const module2 = (record4.module_ids || []).map((id2) => this.store.get(id2)).find(Boolean);
      return module2?.id ? this.openModule(module2.id) : this.openHome();
    }
    if (record4.path) return this.resources.openAuthoredPath(record4.path);
  }
  /**
   * Omnisearch's modal is another plugin's DOM, and this is the only place in
   * the UI that reaches into one. It fires the command, then polls for a
   * visible `.prompt-input` to seed. It will break silently on any Omnisearch
   * DOM change and no test can catch that; it is acceptable only because it
   * degrades to "modal opens, query not transferred".
   */
  openFullTextSearch(query = "") {
    const ok = this.app.commands?.executeCommandById?.("omnisearch:show-modal");
    if (!ok) new import_obsidian19.Notice("Omnisearch is unavailable; structural Library search still works.");
    else if (query.trim()) {
      let attempts = 0;
      const transfer = () => {
        const input = [...document.querySelectorAll(".prompt-input")].find((candidate) => candidate.offsetParent !== null);
        if (!input && attempts++ < 20) {
          setTimeout(transfer, 50);
          return;
        }
        if (!input || input.value) return;
        input.value = query;
        input.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: query
        }));
        input.focus();
      };
      setTimeout(transfer, 50);
    }
  }
};

// src/app/router.ts
function asLegacyState(value) {
  return value && typeof value === "object" ? value : {};
}
function asText2(value, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}
function asNullableText(value) {
  return typeof value === "string" && value ? value : null;
}
var ApplicationRouter = class {
  plugin;
  navigation;
  overlay;
  constructor(plugin) {
    this.plugin = plugin;
    const saved = plugin.settings.navigation;
    this.navigation = saved?.version === 1 && saved.current ? saved : { version: 1, current: this.fromLegacy(plugin.settings.lastView), history: [] };
    this.overlay = null;
  }
  fromLegacy(legacy) {
    const input = legacy && typeof legacy === "object" ? legacy : {};
    const type = asText2(input.type);
    const state = asLegacyState(input.state);
    if (type === VIEW_PROGRAM) {
      return state.programId === "inbox" ? { name: "capture" } : { name: "learn", programId: asText2(state.programId, LEARN_AREAS[0][0]) };
    }
    if (type === VIEW_MODULE) {
      if (state.screen === "groups") return { name: "module-groups" };
      if (state.screen === "list") return { name: "module-list", groupId: asText2(state.groupId), query: asText2(state.query) };
      return {
        name: "module-detail",
        moduleId: asText2(state.moduleId),
        componentId: asNullableText(state.componentId),
        tab: asNullableText(state.tab)
      };
    }
    if (type === VIEW_UNIT) return { name: "unit", unitId: asText2(state.unitId), stageId: asNullableText(state.stageId) };
    if (type === VIEW_PROJECT) return state.projectId ? { name: "project-detail", projectId: asText2(state.projectId), tab: asProjectDetailTab(state.tab) } : { name: "project-list", query: asText2(state.query) };
    if (type === VIEW_LIBRARY) return this.libraryRouteFromState(state);
    if (type === VIEW_ATLAS) return { name: "atlas", domain: asNullableText(state.domain), concept: asNullableText(state.concept) };
    if (type === VIEW_SHELVING) return { name: "shelving", unitId: asNullableText(state.unitId) };
    if (type === VIEW_BOUNDARY) return { name: "boundary", boundaryId: asText2(state.boundaryId) };
    if (type === VIEW_REVIEW) return { name: "review" };
    if (type === VIEW_GARDEN) return { name: "garden" };
    if (type === VIEW_DIAGNOSTICS) return { name: "diagnostics" };
    return { name: "home" };
  }
  libraryRouteFromState(state = {}) {
    if (state.screen === "group") return {
      name: "library-group",
      collection: asLibraryCollection(state.collection),
      groupId: asText2(state.groupId),
      query: asText2(state.query),
      facet: asText2(state.facet, "all"),
      filters: asLibrarySourceFilters(state.filters)
    };
    if (state.screen === "source-detail") return {
      name: "source-detail",
      resourceId: asText2(state.resourceId),
      fromGroupId: asNullableText(state.fromGroupId),
      query: asText2(state.query),
      facet: asText2(state.facet, "all"),
      filters: asLibrarySourceFilters(state.filters)
    };
    if (state.screen === "topic-pack-detail") return {
      name: "topic-pack-detail",
      topicPackId: asText2(state.topicPackId),
      fromGroupId: asNullableText(state.fromGroupId),
      query: asText2(state.query)
    };
    if (state.screen === "catalogue-detail") return { name: "catalogue-detail", catalogueId: asText2(state.catalogueId) };
    const recordType = asText2(state.recordType);
    if (state.screen === "legacy-list") return {
      name: "legacy-library-list",
      recordType: recordType || "note",
      query: asText2(state.query),
      domain: asText2(state.domain)
    };
    const recordId = asText2(state.recordId);
    if (recordId) {
      const record4 = this.plugin.store?.get?.(recordId);
      if (record4?.type === "source" || recordType === "source") {
        return { name: "source-detail", resourceId: recordId };
      }
      if (record4?.type === "topic-pack") return { name: "topic-pack-detail", topicPackId: recordId };
      if (record4?.type === "collection" || recordType === "collection") {
        return { name: "catalogue-detail", catalogueId: recordId };
      }
    }
    if (recordType && !["source", "topic-pack"].includes(recordType)) {
      return { name: "legacy-library-list", recordType, query: asText2(state.query), domain: asText2(state.domain) };
    }
    return {
      name: "library-home",
      collection: recordType === "topic-pack" ? "topic-packs" : "sources",
      query: asText2(state.query),
      filters: asLibrarySourceFilters(state.filters)
    };
  }
  descriptor(route) {
    switch (route?.name) {
      case "home":
        return { type: VIEW_HOME, state: {}, nav: "home", pin: true };
      case "learn":
        return { type: VIEW_PROGRAM, state: { programId: route.programId }, nav: "learn" };
      case "capture":
        return { type: VIEW_PROGRAM, state: { programId: "inbox" }, nav: "capture" };
      case "review":
        return { type: VIEW_REVIEW, state: {}, nav: "review" };
      case "garden":
        return { type: VIEW_GARDEN, state: {}, nav: "garden" };
      case "diagnostics":
        return { type: VIEW_DIAGNOSTICS, state: {}, nav: "diagnostics" };
      case "program":
        return {
          type: VIEW_PROGRAM,
          state: { programId: route.programId },
          nav: route.programId === "queue-needs-map" ? "review" : "learn"
        };
      case "module-groups":
        return { type: VIEW_MODULE, state: { screen: "groups" }, nav: "modules" };
      case "module-list":
        return {
          type: VIEW_MODULE,
          state: { screen: "list", groupId: route.groupId, query: route.query || "" },
          nav: "modules"
        };
      case "module-detail":
        return {
          type: VIEW_MODULE,
          state: {
            screen: "detail",
            moduleId: route.moduleId,
            componentId: route.componentId || null,
            tab: route.tab || null
          },
          nav: "modules"
        };
      case "project-list":
        return { type: VIEW_PROJECT, state: { screen: "list", query: route.query || "" }, nav: "projects" };
      case "project-detail":
        return {
          type: VIEW_PROJECT,
          state: { screen: "detail", projectId: route.projectId, tab: route.tab || "structure" },
          nav: "projects"
        };
      case "unit":
        return {
          type: VIEW_UNIT,
          state: { unitId: route.unitId, stageId: route.stageId || null },
          nav: "learn"
        };
      case "library-home":
        return {
          type: VIEW_LIBRARY,
          state: {
            screen: "home",
            collection: route.collection || "sources",
            query: route.query || "",
            filters: route.filters || asLibrarySourceFilters(null)
          },
          nav: "library"
        };
      case "library-group":
        return {
          type: VIEW_LIBRARY,
          state: {
            screen: "group",
            collection: route.collection || "sources",
            groupId: route.groupId,
            query: route.query || "",
            facet: route.facet || "all",
            filters: route.filters || asLibrarySourceFilters(null)
          },
          nav: "library"
        };
      case "source-detail":
        return {
          type: VIEW_LIBRARY,
          state: {
            screen: "source-detail",
            resourceId: route.resourceId,
            fromGroupId: route.fromGroupId || null,
            query: route.query || "",
            facet: route.facet || "all",
            filters: route.filters || asLibrarySourceFilters(null)
          },
          nav: "library"
        };
      case "topic-pack-detail":
        return {
          type: VIEW_LIBRARY,
          state: {
            screen: "topic-pack-detail",
            topicPackId: route.topicPackId,
            fromGroupId: route.fromGroupId || null,
            query: route.query || ""
          },
          nav: "library"
        };
      case "catalogue-detail":
        return {
          type: VIEW_LIBRARY,
          state: { screen: "catalogue-detail", catalogueId: route.catalogueId },
          nav: "library"
        };
      case "legacy-library-list":
        return {
          type: VIEW_LIBRARY,
          state: { screen: "legacy-list", recordType: route.recordType, query: route.query || "", domain: route.domain || "" },
          nav: "library"
        };
      case "library": {
        const compatible = this.libraryRouteFromState(route);
        return this.descriptor(compatible);
      }
      case "atlas":
        return { type: VIEW_ATLAS, state: { domain: route.domain || null, concept: route.concept || null }, nav: "atlas" };
      case "shelving":
        return { type: VIEW_SHELVING, state: { unitId: route.unitId || null }, nav: "review" };
      case "boundary":
        return {
          type: VIEW_BOUNDARY,
          state: { boundaryId: route.boundaryId },
          nav: "masters"
        };
      default:
        return { type: VIEW_HOME, state: {}, nav: "home", pin: true };
    }
  }
  sameRoute(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  async openLeaf(type, state = {}, side = "main") {
    let leaf = this.plugin.app.workspace.getLeavesOfType(type)[0];
    if (!leaf) {
      leaf = side === "left" ? this.plugin.app.workspace.getLeftLeaf?.(false) ?? this.plugin.app.workspace.getLeaf(true) : this.plugin.app.workspace.getLeaf(true);
    }
    await leaf.setViewState({ type, active: true, state });
    this.plugin.app.workspace.revealLeaf(leaf);
    this.plugin.app.workspace.setActiveLeaf?.(leaf, { focus: true });
    return leaf;
  }
  async openNavigator() {
    return this.openLeaf(VIEW_NAV, {}, "left");
  }
  async persist() {
    this.plugin.settings.navigation = this.navigation;
    delete this.plugin.settings.lastView;
    await this.plugin.saveData(this.plugin.settings);
  }
  openOverlay(overlay) {
    this.overlay = { ...overlay };
    return this.overlay;
  }
  updateOverlay(patch) {
    if (!this.overlay) return null;
    this.overlay = { ...this.overlay, ...patch };
    return this.overlay;
  }
  clearOverlay() {
    this.overlay = null;
  }
  /** Replace restorable route state without opening a leaf or adding history. */
  async remember(route) {
    this.navigation.current = route;
    await this.persist();
    return route;
  }
  async navigate(route, options = {}) {
    if (!options.preserveOverlay) this.clearOverlay();
    const descriptor = this.descriptor(route);
    const remember = options.remember !== false;
    const pushHistory = options.pushHistory !== false;
    const prior = this.navigation.current;
    if (remember && pushHistory && prior && !this.sameRoute(prior, route)) {
      const activeView = this.plugin.app.workspace.active?.view;
      const currentScroll = Number(options.scrollTop ?? activeView?.contentEl?.scrollTop ?? 0);
      const selectedElementId = options.selectedElementId || activeView?.selectedElementId || void 0;
      this.navigation.history.push({ route: prior, scrollTop: currentScroll, selectedElementId });
      this.navigation.history = this.navigation.history.slice(-50);
    }
    if (remember) {
      this.navigation.current = route;
      await this.persist();
    }
    this.plugin.setActiveNav(descriptor.nav);
    const leaf = await this.openLeaf(descriptor.type, descriptor.state);
    if (Number.isFinite(options.restoreScrollTop) && leaf?.view?.contentEl) {
      leaf.view.contentEl.scrollTop = Number(options.restoreScrollTop);
    }
    if (options.restoreSelectedElementId && leaf?.view) {
      leaf.view.selectedElementId = options.restoreSelectedElementId;
    }
    if (descriptor.pin && this.plugin.settings.pinHome) leaf.setPinned?.(true);
    return leaf;
  }
  async restore() {
    this.clearOverlay();
    const route = this.navigation.current || { name: "home" };
    if (route.name !== "home" && this.plugin.settings.pinHome) {
      const home = await this.navigate({ name: "home" }, { remember: false, pushHistory: false });
      home.setPinned?.(true);
    }
    return this.navigate(route, { remember: true, pushHistory: false });
  }
  async back() {
    const entry = this.navigation.history.pop();
    if (!entry) return this.navigate({ name: "home" }, { pushHistory: false });
    this.navigation.current = entry.route;
    await this.persist();
    return this.navigate(entry.route, {
      remember: false,
      pushHistory: false,
      restoreScrollTop: entry.scrollTop || 0,
      restoreSelectedElementId: entry.selectedElementId
    });
  }
  snapshot() {
    return JSON.parse(JSON.stringify({ ...this.navigation, overlay: this.overlay }));
  }
};

// src/app/unit-note-modal.ts
var import_obsidian20 = require("obsidian");
var UnitNoteModal = class extends import_obsidian20.Modal {
  plugin;
  unit;
  studyMap;
  files = [];
  recoveredStageIds = [];
  referencedStageIds = [];
  expectedRevisions = {};
  titleInput;
  editor;
  fileInput;
  fileSummary;
  restoreAccessibility = null;
  /* Suppresses a second Save on this modal. The gateway's own lock already
   * serialises writes across the app, so `gateway.isBusy` says "someone else
   * is writing" — which is a reason to wait, never a reason to drop authored
   * text on the floor. */
  saving = false;
  constructor(app, plugin, unit, studyMap) {
    super(app);
    this.plugin = plugin;
    this.unit = unit;
    this.studyMap = studyMap;
    this.files = [];
  }
  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-unit-note-modal");
    const unitId = this.unit.id;
    if (!unitId) {
      empty(root, "Unit unavailable", "The projection returned a unit without an identity.");
      return;
    }
    this.expectedRevisions = this.plugin.store.artifactGuard(
      unitId,
      typeof this.studyMap?.id === "string" ? this.studyMap.id : null
    );
    const stages = asRecords(this.studyMap?.stages);
    const draft = this.plugin.getUnitNoteDraft(unitId, stages);
    if (Object.keys(draft.expectedRevisions).length) {
      this.expectedRevisions = draft.expectedRevisions;
    }
    const recoveredStageIds = Array.isArray(
      draft.recoveredStageIds
    ) ? draft.recoveredStageIds.filter(
      (id2) => typeof id2 === "string"
    ) : [];
    this.recoveredStageIds = recoveredStageIds;
    this.referencedStageIds = [
      .../* @__PURE__ */ new Set([
        ...this.unrecordedCompletedStages(stages),
        ...recoveredStageIds
      ])
    ];
    pageHeader(
      root,
      "Learning session",
      "Add note",
      "Attach one note after the stages you worked through. It belongs to the unit, not to one selected stage.",
      "los-unit-note-heading"
    );
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: "los-modal--unit-note",
      initialFocus: () => this.editor ?? null,
      labelledBy: "los-unit-note-heading"
    });
    const context = root.createDiv({ cls: "los-unit-note-context" });
    context.createDiv({ cls: "los-kicker", text: "Stages covered" });
    if (this.referencedStageIds.length) {
      const names = this.referencedStageIds.map(
        (id2) => stages.find(
          (stage) => stage.id === id2
        )?.title || id2
      );
      context.createDiv({ text: names.join(" \xB7 ") });
    } else {
      context.createDiv({ cls: "los-micro", text: "No newly completed stage is required. You may still record a unit-level observation." });
    }
    this.titleInput = root.createEl("input", {
      cls: "los-search los-unit-note-title",
      attr: { type: "text", placeholder: "Optional note title", "aria-label": "Unit note title" }
    });
    this.titleInput.value = draft.title || "";
    this.editor = root.createEl("textarea", {
      cls: "los-note-editor los-unit-note-editor",
      attr: { placeholder: "What should remain after this learning session?", "aria-label": "Unit learning-session note" }
    });
    this.editor.value = draft.text || "";
    const attachments = root.createDiv({ cls: "los-unit-note-attachments" });
    attachments.createDiv({ cls: "los-kicker", text: "Attachments" });
    this.fileInput = attachments.createEl("input", {
      cls: "los-file-input",
      attr: { type: "file", multiple: "multiple", "aria-label": "Choose unit note attachments" }
    });
    this.fileSummary = attachments.createDiv({ cls: "los-micro", text: "Optional: handwriting, image, or PDF." });
    this.fileInput.addEventListener("change", () => {
      this.files = [...this.fileInput.files || []];
      this.fileSummary.setText(this.files.length ? `${this.files.length} attachment${this.files.length === 1 ? "" : "s"} selected for this save.` : "Optional: handwriting, image, or PDF.");
    });
    const status = root.createDiv({ cls: "los-draft-status", attr: { "aria-live": "polite" } });
    const actions = root.createDiv({ cls: "los-actions los-unit-note-actions" });
    button(actions, "Cancel", () => this.close(), "quiet");
    const saveButton = button(actions, "Save note", () => this.save(), "cta");
    const persist = () => {
      this.plugin.setUnitNoteDraft(
        unitId,
        this.titleInput.value,
        this.editor.value,
        this.expectedRevisions
      );
      const hasNote = Boolean(this.editor.value.trim());
      status.setText(hasNote ? "Draft kept locally until the core confirms the save." : "Write a note to enable saving.");
      status.toggleClass("is-dirty", hasNote);
      saveButton.disabled = !hasNote;
      saveButton.setAttribute("aria-disabled", String(!hasNote));
    };
    this.titleInput.addEventListener("input", persist);
    this.editor.addEventListener("input", persist);
    persist();
  }
  unrecordedCompletedStages(stages) {
    const already = new Set(
      asRecords(this.unit.note_sections).flatMap(
        (section2) => Array.isArray(section2.stage_ids) ? section2.stage_ids.filter(
          (id2) => typeof id2 === "string"
        ) : []
      )
    );
    return stages.filter(
      (stage) => ["complete", "skipped"].includes(String(stage.status)) && typeof stage.id === "string" && !already.has(stage.id)
    ).map((stage) => String(stage.id));
  }
  async save() {
    const text5 = String(this.editor?.value || "");
    if (!text5.trim()) {
      new import_obsidian20.Notice("Write a note before saving.");
      this.editor?.focus();
      return;
    }
    if (this.saving) {
      new import_obsidian20.Notice("This note is already being saved.");
      return;
    }
    if (this.plugin.gateway.isBusy) {
      new import_obsidian20.Notice("Queued behind the running LearningOS write.");
    }
    const unitId = this.unit.id;
    if (!unitId) {
      new import_obsidian20.Notice("The unit identity is unavailable. Reload LearningOS and try again.");
      return;
    }
    const filePaths = this.files.map((file) => localFilePath(file)).filter((value) => Boolean(value));
    if (filePaths.length !== this.files.length) {
      new import_obsidian20.Notice("One selected attachment has no readable local path. Remove it and choose the file again.");
      return;
    }
    this.saving = true;
    try {
      await this.plugin.mutate(() => this.plugin.gateway.saveUnitNote(unitId, {
        title: this.titleInput?.value || "",
        text: text5,
        stageIds: this.referencedStageIds,
        filePaths
      }, this.expectedRevisions));
      this.plugin.clearUnitNoteDraft(unitId, this.recoveredStageIds);
      new import_obsidian20.Notice("Learning-session note saved.");
      this.close();
    } catch (error) {
      new import_obsidian20.Notice(errorMessage(error));
    } finally {
      this.saving = false;
    }
  }
  onClose() {
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
};

// src/application/draft-store.ts
function emptyUiDrafts() {
  return {
    stages: {},
    unitNotes: {},
    selectedStages: {},
    inbox: { title: "", text: "" },
    doneWhen: {}
  };
}
function normalizeUiDrafts(value) {
  const empty2 = emptyUiDrafts();
  return {
    stages: value?.stages ?? empty2.stages,
    unitNotes: value?.unitNotes ?? empty2.unitNotes,
    selectedStages: value?.selectedStages ?? empty2.selectedStages,
    inbox: value?.inbox ?? empty2.inbox,
    doneWhen: value?.doneWhen ?? empty2.doneWhen
  };
}
var DraftStore = class {
  constructor(settings, persist) {
    this.settings = settings;
    this.persist = persist;
  }
  saveTimer = null;
  scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.persist();
    }, 250);
  }
  dispose() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }
  stageKey(unitId, stageId) {
    return `${unitId}::${stageId}`;
  }
  getStage(unitId, stageId, savedText = "") {
    const entry = this.settings.uiDrafts.stages[this.stageKey(unitId, stageId)];
    return { text: entry?.text ?? savedText, dirty: entry != null && entry.text !== savedText };
  }
  setStage(unitId, stageId, text5, savedText = "") {
    const key = this.stageKey(unitId, stageId);
    if (text5 === savedText) delete this.settings.uiDrafts.stages[key];
    else this.settings.uiDrafts.stages[key] = { text: text5 };
    this.scheduleSave();
  }
  clearStage(unitId, stageId) {
    delete this.settings.uiDrafts.stages[this.stageKey(unitId, stageId)];
    this.scheduleSave();
  }
  getUnitNote(unitId, stages = []) {
    const saved = this.settings.uiDrafts.unitNotes[unitId];
    const recovered = [];
    for (const stage of stages) {
      const stageId = asString(stage.id);
      if (!stageId) continue;
      const entry = this.settings.uiDrafts.stages[this.stageKey(unitId, stageId)];
      if (entry?.text?.trim()) recovered.push({ id: stageId, title: asLabel(stage, stageId), text: entry.text });
    }
    const recoveredText = recovered.map((row3) => `### ${row3.title}

${row3.text.trim()}`).join("\n\n");
    return {
      title: saved?.title || (recovered.length ? "Recovered stage drafts" : ""),
      text: [String(saved?.text || "").trim(), recoveredText].filter(Boolean).join("\n\n"),
      recoveredStageIds: recovered.map((row3) => row3.id),
      expectedRevisions: saved?.expectedRevisions ?? {}
    };
  }
  setUnitNote(unitId, title, text5, expectedRevisions = {}) {
    if (!title.trim() && !text5.trim()) delete this.settings.uiDrafts.unitNotes[unitId];
    else this.settings.uiDrafts.unitNotes[unitId] = {
      title,
      text: text5,
      expectedRevisions: { ...expectedRevisions }
    };
    this.scheduleSave();
  }
  clearUnitNote(unitId, recoveredStageIds = []) {
    delete this.settings.uiDrafts.unitNotes[unitId];
    for (const stageId of recoveredStageIds) {
      delete this.settings.uiDrafts.stages[this.stageKey(unitId, stageId)];
    }
    this.scheduleSave();
  }
  getSelectedStage(unitId) {
    return this.settings.uiDrafts.selectedStages[unitId] || null;
  }
  setSelectedStage(unitId, stageId) {
    if (stageId) this.settings.uiDrafts.selectedStages[unitId] = stageId;
    else delete this.settings.uiDrafts.selectedStages[unitId];
    this.scheduleSave();
  }
  getDoneWhen(unitId, stageId) {
    return this.settings.uiDrafts.doneWhen[this.stageKey(unitId, stageId)] || [];
  }
  setDoneWhen(unitId, stageId, index, checked) {
    const key = this.stageKey(unitId, stageId);
    const marks = [...this.settings.uiDrafts.doneWhen[key] || []];
    marks[index] = checked;
    if (marks.some(Boolean)) this.settings.uiDrafts.doneWhen[key] = marks;
    else delete this.settings.uiDrafts.doneWhen[key];
    this.scheduleSave();
  }
  clearDoneWhen(unitId, stageId) {
    delete this.settings.uiDrafts.doneWhen[this.stageKey(unitId, stageId)];
    this.scheduleSave();
  }
  getInbox() {
    return { ...this.settings.uiDrafts.inbox };
  }
  setInbox(title, text5) {
    this.settings.uiDrafts.inbox = { title, text: text5 };
    this.scheduleSave();
  }
  clearInbox() {
    this.settings.uiDrafts.inbox = { title: "", text: "" };
    this.scheduleSave();
  }
};

// src/contracts/gateway-v2.ts
var GATEWAY_SCHEMA_VERSION = 2;
function record3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}
function nonEmpty2(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function exactKeys3(value, keys) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}
function isSha256(value) {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}
var REQUEST_SCOPED_ARTIFACT_PREFIXES = {
  "capture.create": "capture-request",
  "garden.seed.create": "garden-request"
};
function isRequestScopedCapability(capability) {
  return Object.prototype.hasOwnProperty.call(
    REQUEST_SCOPED_ARTIFACT_PREFIXES,
    capability
  );
}
function requestArtifactId(capability, idempotencyKey) {
  const prefix = REQUEST_SCOPED_ARTIFACT_PREFIXES[capability];
  if (!prefix) {
    throw new GatewayError(
      `${capability} does not use request-scoped artifacts; nothing was written.`,
      null,
      { code: "INVALID_REQUEST", retryable: false }
    );
  }
  if (!nonEmpty2(idempotencyKey)) {
    throw new GatewayError(
      `${capability} needs an idempotency key to guard its request; nothing was written.`,
      null,
      { code: "INVALID_REQUEST", retryable: false }
    );
  }
  return `${prefix}:${idempotencyKey}`;
}
function gatewayApprovalSubject(capability, expectedSnapshot, expectedRevisions, payload) {
  return {
    schema_version: GATEWAY_SCHEMA_VERSION,
    capability,
    channel: "ui",
    expected_snapshot: expectedSnapshot,
    expected_revisions: expectedRevisions,
    payload
  };
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  const object = record3(value);
  if (!object) return value;
  return Object.fromEntries(
    Object.keys(object).sort(unicodeCodePointCompare).map((key) => [key, canonical(object[key])])
  );
}
function unicodeCodePointCompare(left, right) {
  const leftPoints = [...left].map((value) => value.codePointAt(0) ?? 0);
  const rightPoints = [...right].map((value) => value.codePointAt(0) ?? 0);
  const shared = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < shared; index += 1) {
    const leftPoint = leftPoints[index] ?? 0;
    const rightPoint = rightPoints[index] ?? 0;
    if (leftPoint !== rightPoint) {
      return leftPoint - rightPoint;
    }
  }
  return leftPoints.length - rightPoints.length;
}
async function gatewaySubjectSha256(subject) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(subject)));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
function asGatewaySuccessV2(value, expected) {
  const response = record3(value);
  const result = record3(response?.result);
  const responseKeys = [
    "schema_version",
    "request_id",
    "idempotency_key",
    "capability",
    "ok",
    "replayed",
    "transaction_id",
    "receipt_path",
    "snapshot_after",
    "result",
    "error"
  ];
  const identityMatches = response?.request_id === expected.requestId && response?.idempotency_key === expected.idempotencyKey && response?.capability === expected.capability;
  const confirmed = response !== null && exactKeys3(response, responseKeys) && response.schema_version === GATEWAY_SCHEMA_VERSION && identityMatches && response.ok === true && typeof response.replayed === "boolean" && nonEmpty2(response.transaction_id) && nonEmpty2(response.receipt_path) && isSha256(response.snapshot_after) && result !== null && response.error === null;
  if (!confirmed) {
    throw new GatewayError(
      "LearningOS did not return a complete Gateway V2 receipt, so the change is unconfirmed. Your draft was kept.",
      null,
      { code: "UNCONFIRMED", retryable: false }
    );
  }
  return response;
}
function isGatewaySuccessV2(value) {
  const response = record3(value);
  return response?.schema_version === GATEWAY_SCHEMA_VERSION && response?.ok === true && nonEmpty2(response?.receipt_path) && isSha256(response?.snapshot_after);
}
function assertGatewaySnapshotObserved(confirmation, observedSnapshot) {
  if (observedSnapshot !== confirmation.snapshot_after) {
    throw new GatewayError(
      "LearningOS wrote a receipt, but the reloaded manifest does not show its resulting snapshot. The change is unconfirmed in this view; your draft was kept.",
      null,
      { code: "UNCONFIRMED", retryable: true }
    );
  }
}

// src/gateway-client.ts
var import_node_crypto = require("node:crypto");
var import_promises = require("node:fs/promises");
var import_node_os = require("node:os");
var import_node_path = require("node:path");
var requestCounter = 0;
function nextRequestId(capability) {
  requestCounter += 1;
  return `req-${capability.replace(/\./g, "-")}-${Date.now()}-${requestCounter}`;
}
function nextIdempotencyKey(requestId) {
  return `idem-${requestId}`;
}
function expandedLocalPath(filePath) {
  if (filePath === "~") return (0, import_node_os.homedir)();
  if (filePath.startsWith(`~${import_node_path.sep}`)) return (0, import_node_path.join)((0, import_node_os.homedir)(), filePath.slice(2));
  return filePath;
}
async function fileSha256(filePath) {
  const bytes = await (0, import_promises.readFile)(expandedLocalPath(filePath));
  return `sha256:${(0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex")}`;
}
function gatewayErrorDetails(value) {
  const response = typeof value === "object" && value !== null ? value : {};
  const error = typeof response.error === "object" && response.error !== null ? response.error : null;
  if (error) {
    return {
      message: typeof error.message === "string" && error.message.trim() ? error.message.trim() : "LearningOS refused the change; your draft was kept.",
      ...typeof error.code === "string" ? { code: error.code } : {},
      ...typeof error.retryable === "boolean" ? { retryable: error.retryable } : {}
    };
  }
  return {
    message: typeof response.error === "string" && response.error.trim() ? response.error.trim() : "LearningOS refused the change; your draft was kept."
  };
}
var GatewayClient = class {
  plugin;
  chain;
  pending;
  constructor(plugin) {
    this.plugin = plugin;
    this.chain = Promise.resolve();
    this.pending = 0;
  }
  /**
   * Serialize every mutation, wherever it was clicked. Failures do not poison
   * the chain: the next task runs regardless of how the previous one settled,
   * but never alongside it.
   */
  enqueue(task) {
    this.pending += 1;
    const run = this.chain.then(task, task);
    this.chain = run.then(() => void 0, () => void 0).then(() => {
      this.pending -= 1;
    });
    return run;
  }
  get isBusy() {
    return this.pending > 0;
  }
  /**
   * Every mutating command answers in JSON. Unreadable or empty output means
   * the write was NOT confirmed, so this must reject: call sites clear
   * UI-owned drafts on resolve, and resolving on garbage would destroy the
   * learner's text behind a success notice. `expectJson: false` is only for
   * the text-reporting commands (`validate`, `generate`).
   */
  call(args, { expectJson = true, stdin } = {}) {
    return new Promise((resolve2, reject) => {
      this.plugin.runLos(
        args,
        (error, stdout, stderr) => {
          if (error) {
            let refusal = null;
            try {
              refusal = gatewayErrorDetails(JSON.parse(String(stdout || "")));
            } catch (_) {
            }
            const reason = structuredError(stdout) || stderr.trim() || error.message || String(error);
            reject(new GatewayError(reason, exitCodeOf(error), refusal || {}));
            return;
          }
          const raw = String(stdout ?? "").trim();
          if (!expectJson) {
            resolve2({ ok: true, stdout: raw });
            return;
          }
          if (!raw) {
            reject(new Error("LearningOS wrote nothing back, so the change is unconfirmed. Your draft was kept."));
            return;
          }
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (_) {
            reject(new Error(`LearningOS answered with unreadable output, so the change is unconfirmed and your draft was kept: ${raw.slice(0, 160)}`));
            return;
          }
          if (!parsed || typeof parsed !== "object" || parsed.ok === false) {
            const refusal = gatewayErrorDetails(parsed);
            reject(new GatewayError(
              refusal.message,
              exitCodeOf(error),
              refusal
            ));
            return;
          }
          resolve2(parsed);
        },
        stdin
      );
    });
  }
  /**
   * The one write shape.
   *
   * Every canonical mutation is a declared capability sent as an envelope, so
   * there is a single call shape, a single response shape and a single error
   * path — instead of one positional signature per command, each with its own
   * flag order to get wrong. The named methods below are porcelain over this.
   */
  capability(name, payload, options = {}) {
    const expectedSnapshot = options.expectedSnapshot || this.snapshotId();
    if (!isSha256(expectedSnapshot)) {
      throw new GatewayError(
        "LearningOS has no valid sha256 snapshot to guard this change against; nothing was written.",
        null,
        { code: "INVALID_REQUEST", retryable: false }
      );
    }
    const expectedRevisions = options.expectedRevisions || {};
    if (Object.entries(expectedRevisions).some(
      ([id2, revision]) => !id2 || !Number.isInteger(revision) || revision < 0
    )) {
      throw new GatewayError(
        "LearningOS has invalid artifact revision guards; nothing was written.",
        null,
        { code: "INVALID_REQUEST", retryable: false }
      );
    }
    if (isRequestScopedCapability(name) && Object.keys(expectedRevisions).length > 0) {
      throw new GatewayError(
        `LearningOS guards ${name} against its own request, so it cannot also be guarded against caller-supplied artifact revisions; nothing was written.`,
        null,
        { code: "INVALID_REQUEST", retryable: false }
      );
    }
    return this.sendCapability(
      name,
      payload,
      expectedSnapshot,
      expectedRevisions
    );
  }
  async sendCapability(name, payload, expectedSnapshot, expectedRevisions) {
    const requestId = nextRequestId(name);
    const idempotencyKey = nextIdempotencyKey(requestId);
    const effectiveRevisions = isRequestScopedCapability(name) ? { [requestArtifactId(name, idempotencyKey)]: 0 } : expectedRevisions;
    const subject = gatewayApprovalSubject(
      name,
      expectedSnapshot,
      effectiveRevisions,
      payload
    );
    const envelope = {
      schema_version: GATEWAY_SCHEMA_VERSION,
      request_id: requestId,
      idempotency_key: idempotencyKey,
      capability: name,
      channel: "ui",
      expected_snapshot: expectedSnapshot,
      expected_revisions: effectiveRevisions,
      approval: {
        kind: "direct-user-gesture",
        subject_sha256: await gatewaySubjectSha256(subject)
      },
      payload
    };
    const response = await this.call(
      ["capability", name, "--payload-file", "-"],
      { stdin: JSON.stringify(envelope) }
    );
    return asGatewaySuccessV2(response, { requestId, idempotencyKey, capability: name });
  }
  /**
   * The snapshot guard is what makes a write refusable, so a missing snapshot
   * id must stop the write rather than travel to the CLI as the string
   * "null" — which would be compared against a real snapshot and refused with
   * a misleading message, or worse, matched by accident.
   */
  snapshotId() {
    const snapshotId = this.plugin.store.snapshotId;
    if (!snapshotId) {
      throw new Error("LearningOS has no loaded snapshot to guard this change against; nothing was written.");
    }
    return snapshotId;
  }
  /** Positional-flag form, kept for the commands that are not capabilities. */
  guard() {
    return ["--expected-snapshot", this.snapshotId()];
  }
  // ---- porcelain: each is one declared capability, nothing more ----------
  saveNote(unitId, stageId, text5, expectedRevisions = {}) {
    return this.capability(
      "stage.note.write",
      { unit_id: unitId, stage_id: stageId, text: text5, replace: true },
      { expectedRevisions }
    );
  }
  async saveUnitNote(unitId, {
    title = "",
    text: text5,
    stageIds = [],
    filePaths = []
  }, expectedRevisions = {}) {
    const payload = { unit_id: unitId, text: text5 };
    if (String(title).trim()) payload.title = String(title).trim();
    if (stageIds.length) payload.stage_id = [...stageIds];
    if (filePaths.length) {
      payload.attachment = [...filePaths];
      payload.attachment_sha256 = await Promise.all(filePaths.map(fileSha256));
    }
    return this.capability("unit.note.append", payload, { expectedRevisions });
  }
  progress(unitId, stageId, status, expectedRevisions = {}) {
    return this.capability(
      "stage.progress.update",
      { unit_id: unitId, stage_id: stageId, status },
      { expectedRevisions }
    );
  }
  sourceSelection(unitId, routeId, sourceId, locator, purpose, selected, expectedRevisions = {}) {
    return this.capability(
      "unit.source-selection.set",
      {
        unit_id: unitId,
        route_id: routeId,
        source_id: sourceId,
        locator,
        action: selected ? "select" : "remove",
        ...selected ? { purpose } : {}
      },
      { expectedRevisions }
    );
  }
  feedback(unitId, stageId, sourceId, feedback, resourceId, expectedRevisions = {}) {
    return this.capability("source.feedback.record", {
      unit_id: unitId,
      stage_id: stageId,
      source_id: sourceId,
      feedback,
      ...resourceId ? { resource_id: resourceId } : {}
    }, { expectedRevisions });
  }
  detour(unitId, stageId, title, classification = "required-now", expectedRevisions = {}) {
    return this.capability(
      "detour.create",
      { unit_id: unitId, stage_id: stageId, title, classification },
      { expectedRevisions }
    );
  }
  resolveDetour(unitId, detourId, resolution = "", expectedRevisions = {}) {
    const payload = { unit_id: unitId, detour_id: detourId };
    if (resolution) payload.resolution = resolution;
    return this.capability("detour.resolve", payload, { expectedRevisions });
  }
  async attach(unitId, stageId, filePath, label = "", expectedRevisions = {}) {
    const payload = {
      unit_id: unitId,
      stage_id: stageId,
      file: filePath,
      file_sha256: await fileSha256(filePath)
    };
    if (label) payload.label = label;
    return this.capability("stage.attachment.add", payload, { expectedRevisions });
  }
  captureText(text5, title = "") {
    const payload = { text: text5 };
    if (title) payload.title = title;
    return this.capability("capture.create", payload);
  }
  async captureFile(filePath) {
    return this.capability("capture.create", {
      file: filePath,
      file_sha256: await fileSha256(filePath)
    });
  }
  createGardenSeed(text5, title = "") {
    const payload = { text: text5 };
    if (title.trim()) payload.title = title.trim();
    return this.capability(
      "garden.seed.create",
      payload
    );
  }
  prepareShelving(unitId, expectedRevisions = {}) {
    return this.capability("review.prepare", { unit_id: unitId }, { expectedRevisions });
  }
  applyShelving(unitId, selected, expectedRevisions = {}) {
    return this.capability(
      "review.apply",
      { unit_id: unitId, selected: [...selected] },
      { expectedRevisions }
    );
  }
  endSession(commitMessage = null, push = false) {
    const args = ["session-end"];
    if (commitMessage) args.push("--commit-message", commitMessage);
    if (push) args.push("--push");
    return this.call(args);
  }
  /**
   * Apply a study map that has already been through the SOP's coverage audit.
   * The interface carries the reviewed file's path and exact content digest.
   * Core reads it once, verifies those approved bytes, checks them against the
   * creation template and study-map schema, and refuses it as a whole. Gate 1
   * stays where the SOP put it — this applies a reviewed result; it does not
   * skip the review.
   */
  async importUnitMap(unitId, file, replace = false, expectedRevisions = {}) {
    return this.capability("unit.map.import", {
      unit_id: unitId,
      file,
      file_sha256: await fileSha256(file),
      ...replace ? { replace: true } : {}
    }, { expectedRevisions });
  }
  /**
   * The declared read-only `plan.template` query. Core generates and validates
   * the starting record; the interface never authors defaults of its own, so
   * "the standard" and "what the Create dialog offers" cannot drift apart.
   * No snapshot guard: this reads no repository file and writes nothing.
   */
  planTemplate(profile, title, ids2 = {}) {
    const args = ["plan-template", profile, "--title", title, "--json"];
    if (ids2.unitId) args.push("--unit-id", ids2.unitId);
    if (ids2.moduleId) args.push("--module-id", ids2.moduleId);
    return this.call(args);
  }
  /** Versioned read-only status surfaces. Their feature layers decode the
   *  exact producer schemas before rendering any field. */
  healthReport() {
    return this.call(["health-report", "--json"]);
  }
  legacyArchiveStatus() {
    return this.call(["legacy-archive-status", "--json"]);
  }
  mastersPlanningDashboard() {
    return this.call([
      "masters-planning-dashboard",
      "--confirm-masters-planning"
    ]);
  }
};
function explicitAiContext(plugin, context = {}) {
  const unit = context.unitId ? plugin.store.get(context.unitId) : null;
  const module2 = context.moduleId ? plugin.store.get(context.moduleId) : unit?.module_id ? plugin.store.get(unit.module_id) : null;
  const stage = context.stageId ? plugin.store.stage(context.stageId) : null;
  const stageResources = Array.isArray(stage?.resources) ? stage.resources : [];
  const unitSelections = Array.isArray(unit?.source_selections) ? unit.source_selections.filter(
    (row3) => typeof row3 === "object" && row3 !== null && !Array.isArray(row3)
  ) : [];
  const resources = stageResources.length ? stageResources : unitSelections;
  return {
    area_program_id: context.programId || module2?.area_id || null,
    module_id: module2?.id || context.moduleId || null,
    component_id: context.componentId || unit?.component_id || null,
    unit_id: unit?.id || context.unitId || null,
    stage_id: stage?.id || context.stageId || null,
    selected_source_ids: [...new Set(resources.map((row3) => row3.source_id).filter((value) => typeof value === "string" && value.length > 0))],
    selected_materials: resources.map((row3) => row3.material_uri || row3.vault_path || row3.url || row3.material_path || row3.locator).filter((value) => typeof value === "string" && value.length > 0),
    manifest_snapshot: plugin.store.snapshotId,
    active_file_supplement: plugin.app.workspace.getActiveFile?.()?.path || null
  };
}

// src/infrastructure/ai-action-client.ts
var AIActionClient = class {
  plugin;
  constructor(plugin) {
    this.plugin = plugin;
  }
  providers() {
    return this.plugin.store.aiProviders();
  }
  prepareGardenShelving(targetId, provider = "manual-bundle") {
    const args = [
      "ai-action-prepare",
      "--action-id",
      "garden.shelve",
      "--target-kind",
      "garden-note",
      "--target-id",
      targetId,
      "--provider",
      provider,
      ...this.plugin.gateway.guard()
    ];
    return this.plugin.mutate(
      () => this.plugin.gateway.call(args)
    );
  }
  status(requestId) {
    return this.plugin.gateway.call([
      "ai-action-status",
      requestId
    ]);
  }
  applyApprovedDelivery(deliveryId) {
    return this.plugin.mutate(
      () => this.plugin.gateway.call([
        "ai-action-apply-delivery",
        deliveryId
      ])
    );
  }
};

// src/infrastructure/los-runtime.ts
var import_node_child_process = require("node:child_process");
var fs2 = __toESM(require("node:fs"));
var nodePath2 = __toESM(require("node:path"));
var import_node_process = __toESM(require("node:process"));
var LosRuntime = class {
  constructor(app, configuredPython) {
    this.app = app;
    this.configuredPython = configuredPython;
  }
  resolvePython() {
    const base = this.app.vault.adapter.getBasePath();
    const configured = this.configuredPython().trim();
    const searchOrder = [
      [configured, "configured in settings"],
      [nodePath2.join(base, ".venv", "bin", "python"), "project virtual environment"],
      [nodePath2.join(base, ".venv", "Scripts", "python.exe"), "project virtual environment (Windows)"]
    ];
    const candidates = searchOrder.filter(([path]) => path);
    const attempted = candidates.map(([path]) => path);
    for (const [path, origin] of candidates) {
      if (fs2.existsSync(path)) return { path, origin, attempted };
    }
    const fallback = import_node_process.default.platform === "win32" ? "python" : "python3";
    return { path: fallback, origin: "PATH fallback", attempted: [...attempted, fallback] };
  }
  run(args, callback, stdin) {
    const base = this.app.vault.adapter.getBasePath();
    const script = nodePath2.join(base, "tools", "los.py");
    const child = (0, import_node_child_process.execFile)(
      this.resolvePython().path,
      [script, ...args],
      { cwd: base, timeout: 18e4, maxBuffer: 8 * 1024 * 1024 },
      callback
    );
    if (stdin !== void 0) child.stdin?.end(stdin);
  }
};

// src/infrastructure/resource-opener.ts
var import_electron2 = require("electron");
var fs3 = __toESM(require("node:fs"));
var nodePath3 = __toESM(require("node:path"));
var import_obsidian21 = require("obsidian");
var CODE_EXTENSIONS = /* @__PURE__ */ new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".h",
  ".hpp",
  ".ini",
  ".ipynb",
  ".java",
  ".js",
  ".jsx",
  ".json",
  ".jsonl",
  ".kt",
  ".less",
  ".lua",
  ".md",
  ".mjs",
  ".php",
  ".properties",
  ".py",
  ".r",
  ".rb",
  ".rs",
  ".sass",
  ".scss",
  ".sh",
  ".sql",
  ".swift",
  ".tex",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
  ".zsh"
]);
function visualStudioCodeUrl(path) {
  const url = new URL("vscode://file");
  const portable = String(path || "").replace(/\\/g, "/");
  url.pathname = portable.startsWith("/") ? portable : `/${portable}`;
  return url.href;
}
function normalizedVaultPath(value) {
  let path = String(value || "").trim();
  const wiki = path.match(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/);
  if (wiki?.[1]) path = wiki[1];
  const markdown = path.match(/^\[[^\]]*\]\((.+)\)$/);
  if (markdown?.[1]) path = markdown[1];
  path = path.replace(/\\/g, "/").replace(/^\.\//, "");
  const subpath = path.search(/[?#]/);
  if (subpath >= 0) path = path.slice(0, subpath);
  try {
    path = decodeURIComponent(path);
  } catch (_) {
  }
  return path;
}
function resolvedWithin(root, candidate) {
  try {
    const realRoot = fs3.realpathSync(root);
    const realCandidate = fs3.realpathSync(candidate);
    const relative2 = nodePath3.relative(realRoot, realCandidate);
    return relative2.startsWith("..") || nodePath3.isAbsolute(relative2) ? null : realCandidate;
  } catch (_) {
    return null;
  }
}
var ResourceOpener = class {
  constructor(app) {
    this.app = app;
  }
  async openVaultPath(path) {
    const target = normalizedVaultPath(path);
    if (!target || target.startsWith("/") || target.split("/").includes("..")) {
      new import_obsidian21.Notice(`Unsafe vault path refused: ${path || "unknown path"}`);
      return void 0;
    }
    const candidate = nodePath3.resolve(this.app.vault.adapter.getBasePath(), target);
    if (fs3.existsSync(candidate)) {
      try {
        fs3.realpathSync(candidate);
      } catch (_) {
        new import_obsidian21.Notice(`File unavailable: ${target}`);
        return void 0;
      }
      const realPath = resolvedWithin(
        this.app.vault.adapter.getBasePath(),
        candidate
      );
      if (!realPath) {
        new import_obsidian21.Notice(`Unsafe vault symlink refused: ${target}`);
        return void 0;
      }
    }
    const file = this.app.vault.getAbstractFileByPath(target);
    if (!file) {
      new import_obsidian21.Notice(`File unavailable: ${target}`);
      return void 0;
    }
    let existing = null;
    this.app.workspace.iterateAllLeaves((leaf2) => {
      if (!existing && leaf2.view?.file?.path === target) existing = leaf2;
    });
    if (existing) {
      this.app.workspace.revealLeaf(existing);
      this.app.workspace.setActiveLeaf?.(existing, { focus: true });
      return existing;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
    return leaf;
  }
  isCodePath(path) {
    if (!fs3.existsSync(path)) return false;
    const extension = nodePath3.extname(path).toLocaleLowerCase();
    return !extension || CODE_EXTENSIONS.has(extension);
  }
  async openSystemPath(path, successMessage) {
    const error = await import_electron2.shell.openPath(path);
    if (error) {
      new import_obsidian21.Notice(`Could not open file: ${error}`);
      return false;
    }
    new import_obsidian21.Notice(successMessage);
    return true;
  }
  async openCodePath(path) {
    try {
      await import_electron2.shell.openExternal(visualStudioCodeUrl(path));
      new import_obsidian21.Notice("Opened in Visual Studio Code.");
      return true;
    } catch (_) {
      new import_obsidian21.Notice("Visual Studio Code was unavailable; opening in the system app instead.");
      return this.openSystemPath(path, "Opened in the system app.");
    }
  }
  openPreferredLocalPath(path, systemMessage) {
    let realPath = "";
    try {
      realPath = fs3.realpathSync(path);
    } catch (_) {
      new import_obsidian21.Notice(`File unavailable: ${path || "unknown path"}`);
      return Promise.resolve(false);
    }
    return this.isCodePath(realPath) ? this.openCodePath(realPath) : this.openSystemPath(realPath, systemMessage);
  }
  async openExternalPath(path, successMessage = "Opened in the default app.") {
    if (!path || !fs3.existsSync(path)) {
      new import_obsidian21.Notice(`File unavailable: ${path || "unknown path"}`);
      return false;
    }
    let realPath = "";
    try {
      realPath = fs3.realpathSync(path);
    } catch (_) {
      new import_obsidian21.Notice(`File unavailable: ${path || "unknown path"}`);
      return false;
    }
    return this.openSystemPath(realPath, successMessage);
  }
  openMaterialPath(path) {
    const vault = this.app.vault.adapter.getBasePath();
    const learningRoot = nodePath3.dirname(vault);
    const materialsRoot = nodePath3.resolve(learningRoot, "materials");
    const fullPath = nodePath3.resolve(learningRoot, path || "");
    const relative2 = nodePath3.relative(materialsRoot, fullPath);
    if (!path || relative2.startsWith("..") || nodePath3.isAbsolute(relative2)) {
      new import_obsidian21.Notice(`Unsafe material path refused: ${path || "unknown path"}`);
      return false;
    }
    const realPath = resolvedWithin(materialsRoot, fullPath);
    if (!realPath) {
      new import_obsidian21.Notice(`Unsafe material symlink refused: ${path || "unknown path"}`);
      return false;
    }
    return this.openExternalPath(realPath, "Opened the local material in its default app.");
  }
  openAuthoredPath(path) {
    const extension = nodePath3.extname(path || "").toLocaleLowerCase();
    if ([".md", ".pdf", ".canvas", ".base"].includes(extension)) return this.openVaultPath(path);
    const base = this.app.vault.adapter.getBasePath();
    const fullPath = nodePath3.resolve(base, path || "");
    const relative2 = nodePath3.relative(base, fullPath);
    if (!path || relative2.startsWith("..") || nodePath3.isAbsolute(relative2)) {
      new import_obsidian21.Notice(`Unsafe vault path refused: ${path || "unknown path"}`);
      return false;
    }
    if (!fs3.existsSync(fullPath)) {
      new import_obsidian21.Notice(`File unavailable: ${path || "unknown path"}`);
      return false;
    }
    const realPath = resolvedWithin(base, fullPath);
    if (!realPath) {
      new import_obsidian21.Notice(`Unsafe vault symlink refused: ${path || "unknown path"}`);
      return false;
    }
    return this.openPreferredLocalPath(
      realPath,
      "Opened the authored file in its default app."
    );
  }
  openResource(resource, ports = this) {
    const materialPath = typeof resource.material_path === "string" ? resource.material_path : "";
    if (isDirectMaterialFileTarget(resource)) {
      return ports.openMaterialPath(materialPath);
    }
    const vaultPath = typeof resource.vault_path === "string" ? resource.vault_path : "";
    if (vaultPath.trim()) {
      if (vaultPath.trim().toLowerCase().startsWith("material://")) {
      } else if (isFileShapedPath(vaultPath)) {
        return ports.openVaultPath(vaultPath);
      }
    }
    if (resource.url) {
      const url = safeWebUrl(resource.url);
      if (!url) {
        new import_obsidian21.Notice(`Refused an unsupported link: ${String(resource.url).slice(0, 80)}`);
        return false;
      }
      return Promise.resolve(import_electron2.shell.openExternal(url.href)).catch(() => {
        new import_obsidian21.Notice("Could not open the link in your browser.");
        return false;
      });
    }
    if (materialPath.trim()) {
      new import_obsidian21.Notice(resource.material_exists === false ? `File unavailable: ${materialPath.trim()}` : "Choose an exact file from this material collection.");
    } else if (vaultPath.trim().toLowerCase().startsWith("material://")) {
      new import_obsidian21.Notice(`Refused an unresolved material link: ${vaultPath.trim().slice(0, 80)}`);
    } else if (vaultPath.trim()) {
      new import_obsidian21.Notice("Choose an exact file from this vault collection.");
    }
    return false;
  }
  copyText(value) {
    try {
      void navigator.clipboard.writeText(value);
      new import_obsidian21.Notice(`Copied ${value}`);
    } catch (_) {
      new import_obsidian21.Notice(value);
    }
  }
};

// src/manifest-store.ts
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var ManifestStore = class {
  app;
  ready;
  error;
  data;
  records;
  byId;
  contractVersion = null;
  snapshotId = null;
  constructor(app) {
    this.app = app;
    this.ready = false;
    this.error = "";
    this.data = null;
    this.records = [];
    this.byId = /* @__PURE__ */ new Map();
  }
  async load() {
    try {
      if (!await this.app.vault.adapter.exists("generated/manifest.json")) {
        throw new Error("Projection unavailable \u2014 rebuild it to continue.");
      }
      const parsed = JSON.parse(
        await this.app.vault.adapter.read(
          "generated/manifest.json"
        )
      );
      const generated = isRecord3(parsed) && isRecord3(parsed._generated) ? parsed._generated : null;
      const version = generated?.contract_version;
      if (version !== MANIFEST_CONTRACT_VERSION) {
        throw new Error(
          `Unsupported manifest contract ${String(version ?? "unknown")}; LearningOS UI requires contract ${MANIFEST_CONTRACT_VERSION}.`
        );
      }
      assertManifest(parsed);
      const manifest = parsed;
      const records = (manifest.records || []).filter(
        (row3) => row3 && typeof row3 === "object"
      );
      const byId = new Map(
        records.flatMap((row3) => typeof row3.id === "string" ? [[row3.id, row3]] : [])
      );
      const indexedGroups = [
        "programs",
        "modules",
        "projects",
        "units",
        "study_maps",
        "stages",
        "thematic_groups",
        "topic_packs",
        "unit_material_syntheses"
      ];
      for (const group of indexedGroups) {
        for (const row3 of manifest[group]) {
          if (typeof row3?.id === "string") {
            byId.set(row3.id, row3);
          }
        }
      }
      this.data = manifest;
      this.contractVersion = version;
      this.snapshotId = manifest._generated.snapshot_id;
      this.records = records;
      this.byId = byId;
      this.ready = true;
      this.error = "";
      return true;
    } catch (error) {
      this.ready = false;
      this.error = error instanceof Error ? error.message : String(error);
      this.data = null;
      this.records = [];
      this.byId = /* @__PURE__ */ new Map();
      this.contractVersion = null;
      this.snapshotId = null;
      return false;
    }
  }
  get(id2) {
    const record4 = this.byId.get(id2) || null;
    return record4 && !this.isArchivedCurriculumRecord(record4) ? record4 : null;
  }
  of(type) {
    return this.records.filter(
      (row3) => row3?.type === type && !this.isArchivedCurriculumRecord(row3)
    );
  }
  /**
   * One null row anywhere in a projected array used to take Home down on
   * startup. Every list accessor drops non-objects at the boundary, so no view
   * has to defend itself row by row.
   */
  rows(group) {
    const value = this.data?.[group];
    return Array.isArray(value) ? value.filter(
      (row3) => row3 && typeof row3 === "object" && !this.isArchivedCurriculumRecord(row3)
    ) : [];
  }
  isArchivedCurriculumRecord(record4) {
    if (record4.type === "module" && record4.status === "archived") {
      return true;
    }
    const moduleId = typeof record4.module_id === "string" ? record4.module_id : null;
    if (!moduleId) {
      return false;
    }
    const modules = this.data?.modules;
    return Array.isArray(modules) && modules.some(
      (module2) => module2?.id === moduleId && module2.status === "archived"
    );
  }
  programs() {
    return this.rows("programs");
  }
  modules() {
    return this.rows("modules");
  }
  currentSemester() {
    return this.rows("semesters").filter((row3) => row3.status === "current").sort((a, b) => Number(a.order || 0) - Number(b.order || 0))[0] || null;
  }
  /**
   * Modules is a semester surface, not a second subject catalogue.
   *
   * Semester records use ids such as `semester-sose-2026`, while authored
   * modules retain the shorter `sose-2026` value. Both spellings are accepted
   * at this read boundary; the UI does not infer membership from thematic
   * groups or from source usage.
   */
  currentSemesterModules() {
    const semester = this.currentSemester();
    const semesterIds = /* @__PURE__ */ new Set();
    if (typeof semester?.id === "string") {
      semesterIds.add(semester.id);
      semesterIds.add(semester.id.replace(/^semester-/, ""));
    }
    return this.modules().filter((row3) => {
      if (row3.kind !== "academic") return false;
      if (["completed", "archived", "dropped"].includes(String(row3.status || ""))) return false;
      if (!semesterIds.size) return row3.status === "enrolled";
      return semesterIds.has(String(row3.semester || ""));
    }).sort((a, b) => String(a.title || a.id || "").localeCompare(String(b.title || b.id || "")));
  }
  projects() {
    return this.rows("projects");
  }
  projectRelationships(projectId = null) {
    const rows = [...this.data?.project_relationships || []];
    return projectId ? rows.filter((row3) => row3.from_project_id === projectId) : rows;
  }
  resolveProjectAlias(id2) {
    return this.data?.project_aliases?.[id2] || id2;
  }
  projectForUnit(unit) {
    const ids2 = Array.isArray(unit?.project_ids) ? unit.project_ids : [];
    return ids2.map((id2) => this.get(id2)).find((row3) => row3?.type === "project") || null;
  }
  thematicGroups() {
    return this.rows("thematic_groups").slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || String(a.title || "").localeCompare(String(b.title || "")));
  }
  sources() {
    return this.of("source");
  }
  topicPacks() {
    return this.rows("topic_packs").length ? this.rows("topic_packs") : this.of("topic-pack");
  }
  catalogues() {
    return this.of("collection").filter((row3) => row3.collection_kind !== "topic-pack");
  }
  modulesForGroup(groupId) {
    return this.modules().filter((row3) => (row3.thematic_group_ids || []).includes(groupId));
  }
  sourcesForGroup(groupId) {
    return this.sources().filter((row3) => (row3.thematic_group_ids || []).includes(groupId));
  }
  topicPacksForGroup(groupId) {
    return this.topicPacks().filter((row3) => (row3.thematic_group_ids || []).includes(groupId));
  }
  /** ADR-015: the Module x Concept crossing, evidence included. */
  moduleConceptEdges() {
    return this.rows("module_concept_edges");
  }
  units() {
    return this.rows("units");
  }
  unitNoteSections(unitId) {
    return [...this.data?.units.find((unit) => unit.id === unitId)?.note_sections || []];
  }
  studyMaps() {
    return this.rows("study_maps");
  }
  gardenEntries() {
    return this.rows("garden_entries");
  }
  reviewItems() {
    return this.rows("review_items");
  }
  /** The ADR-009 topic vocabulary: {id, title, domain}. `domain` groups topics
   *  for display only — it never constrains which sources may carry one. */
  topics() {
    return this.rows("topics");
  }
  aiAction(actionId) {
    const available = this.data?.ai_actions?.available;
    return this.rows("ai_actions_available").find((row3) => row3.id === actionId) || (Array.isArray(available) ? available : []).find((row3) => row3?.id === actionId) || null;
  }
  aiProviders() {
    const rows = this.data?.ai_actions?.provider_adapters;
    return Array.isArray(rows) ? rows.filter((row3) => row3 && typeof row3 === "object") : [];
  }
  aiRequestsForTarget(targetId) {
    const rows = this.data?.ai_actions?.requests;
    return (Array.isArray(rows) ? rows : []).filter((row3) => row3?.target?.id === targetId);
  }
  latestAiRequest(targetId) {
    return this.aiRequestsForTarget(targetId).slice().sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0] || null;
  }
  modulesFor(programId) {
    return this.modules().filter((row3) => row3.area_id === programId);
  }
  unitsFor(moduleId, componentId = null) {
    const rows = this.units().filter((row3) => row3.module_id === moduleId);
    return componentId ? rows.filter((row3) => row3.component_id === componentId) : rows;
  }
  mapForUnit(unitId) {
    const mapId = this.data?.indexes?.unit_to_study_map?.[unitId];
    return mapId ? this.get(mapId) : null;
  }
  materialSynthesisForUnit(unitId) {
    const synthesisId = this.data?.indexes?.unit_to_material_synthesis?.[unitId];
    if (!synthesisId) return null;
    return this.data?.unit_material_syntheses.find(
      (synthesis) => synthesis.id === synthesisId && synthesis.unit_id === unitId
    ) || null;
  }
  artifactRevision(artifactId) {
    const projected = this.data?.artifact_revisions?.[artifactId];
    if (typeof projected === "number" && Number.isInteger(projected) && projected >= 0) {
      return projected;
    }
    const embedded = this.byId.get(artifactId)?.revision;
    return typeof embedded === "number" && Number.isInteger(embedded) && embedded >= 0 ? embedded : 0;
  }
  artifactGuard(...artifactIds) {
    return Object.fromEntries(
      [...new Set(artifactIds.filter((id2) => Boolean(id2)))].map((id2) => [id2, this.artifactRevision(id2)])
    );
  }
  /** Resolve a stage from its ID alone through the core's flat index. */
  stage(stageId) {
    const stage = this.get(stageId);
    return stage?.study_map_id ? stage : null;
  }
  sourceMap(moduleId) {
    return this.rows("module_source_maps").find((row3) => row3.module_id === moduleId) || null;
  }
  progress(moduleId) {
    return this.data?.progress?.[moduleId] || {
      stages_complete: 0,
      stages_total: 0,
      units_complete: 0,
      units_total: 0,
      units_needing_map: 0
    };
  }
  workspacesForModule(moduleId) {
    const rawIds = this.data?.backlinks?.module_to_workspaces?.[moduleId];
    const ids2 = Array.isArray(rawIds) ? rawIds.filter(
      (id2) => typeof id2 === "string"
    ) : [];
    return ids2.map((id2) => this.get(id2)).filter(
      (row3) => row3 !== null
    );
  }
  useModules(sourceId) {
    const rawIds = this.data?.indexes?.source_to_modules?.[sourceId];
    const ids2 = Array.isArray(rawIds) ? rawIds.filter(
      (id2) => typeof id2 === "string"
    ) : [];
    return ids2.map((id2) => this.get(id2)).filter(
      (row3) => row3 !== null && row3.type === "module"
    );
  }
  useUnits(sourceId) {
    const rawIds = this.data?.indexes?.source_to_units?.[sourceId];
    const ids2 = Array.isArray(rawIds) ? rawIds.filter(
      (id2) => typeof id2 === "string"
    ) : [];
    return ids2.map((id2) => this.get(id2)).filter(
      (row3) => row3 !== null
    );
  }
  search(query, types = null) {
    const words2 = String(query || "").toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const allowed = types ? new Set(types) : null;
    const rows = this.records.filter(
      (row3) => !this.isArchivedCurriculumRecord(row3) && (!allowed || typeof row3.type === "string" && allowed.has(row3.type))
    );
    if (!words2.length) return rows;
    const strict = rows.filter((row3) => {
      const hay = [
        row3.id,
        row3.title,
        ...row3.aliases || [],
        ...row3.authors || [],
        row3.organization,
        row3.domain
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return words2.every((word) => hay.includes(word));
    });
    if (strict.length) return strict;
    const needle = words2.join("");
    return rows.filter((row3) => {
      const hay = [row3.id, row3.title, ...row3.aliases || []].filter(Boolean).join(" ").toLocaleLowerCase().replace(/\s+/g, "");
      let at = 0;
      for (const char of hay) if (char === needle[at]) at += 1;
      return at === needle.length;
    });
  }
  related(id2) {
    const record4 = this.get(id2);
    if (!record4) return [];
    const ids2 = /* @__PURE__ */ new Set();
    for (const key of [
      "concepts",
      "sources",
      "contexts",
      "notes",
      "program_ids",
      "module_ids",
      "unit_ids",
      "unit_order",
      "related_module_ids"
    ]) {
      for (const value of asStrings(record4[key])) ids2.add(value);
    }
    for (const table of Object.values(this.data?.backlinks || {})) {
      if (isRecord3(table) && Array.isArray(table[id2])) {
        for (const value of table[id2]) {
          if (typeof value === "string") ids2.add(value);
          else if (isRecord3(value) && typeof value.from === "string") ids2.add(value.from);
        }
      }
    }
    for (const relationship of this.projectRelationships()) {
      if (relationship.from_project_id === id2) ids2.add(relationship.to_id);
      if (relationship.to_id === id2) ids2.add(relationship.from_project_id);
    }
    return [...ids2].map((value) => ({ rec: this.get(value) })).filter((row3) => row3.rec);
  }
};

// src/main.ts
function errorMessage4(error) {
  return error instanceof Error ? error.message : String(error);
}
var LearningOSUI = class extends import_obsidian22.Plugin {
  lastAiPrompt = "";
  async onload() {
    const loadedSettings = await this.loadData();
    const savedSettings = loadedSettings ?? {};
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...savedSettings,
      uiDrafts: normalizeUiDrafts(savedSettings.uiDrafts)
    };
    this.drafts = new DraftStore(this.settings, () => this.saveData(this.settings));
    this.store = new ManifestStore(this.app);
    this.runtime = new LosRuntime(this.app, () => this.settings.pythonPath);
    this.resources = new ResourceOpener(this.app);
    this.gateway = new GatewayClient(this);
    this.aiActions = new AIActionClient(this);
    this.router = new ApplicationRouter(this);
    this.nav = new AppNavigator(
      this.app,
      this.router,
      this.store,
      this.settings,
      this.drafts,
      this.resources
    );
    await this.store.load();
    registerApplication(this);
  }
  onunload() {
    this.drafts.dispose();
    void this.saveData(this.settings);
    detachApplication(this);
  }
  scheduleDraftSave() {
    this.drafts.scheduleSave();
  }
  /*
   * `stageDraftKey`, `getStageDraft`, `setStageDraft` and `clearStageDraft`
   * were four pass-throughs to DraftStore that nothing called — no view, no
   * feature module, no test, and no entry in any host `Pick<>`. Removed
   * 2026-08-21 (item 11).
   *
   * Worth knowing what their absence reveals rather than just deleting them:
   * they were the only callers of `DraftStore.getStage/setStage/clearStage`,
   * so nothing in the app writes a stage draft any more. `getUnitNote` still
   * reads `uiDrafts.stages` to recover unsaved stage text into a unit note,
   * which means that recovery path now reads a bag that is always empty. That
   * is either a feature that was retired without removing its reader, or a
   * regression from an earlier extraction. It is a behavioural question, not a
   * mechanical one, so it is left for Aram rather than guessed at here.
   */
  getUnitNoteDraft(unitId, stages = []) {
    return this.drafts.getUnitNote(unitId, stages);
  }
  setUnitNoteDraft(unitId, title, text5, expectedRevisions = {}) {
    this.drafts.setUnitNote(unitId, title, text5, expectedRevisions);
  }
  clearUnitNoteDraft(unitId, recoveredStageIds = []) {
    this.drafts.clearUnitNote(unitId, recoveredStageIds);
  }
  openUnitNote(unit, studyMap) {
    const modal = new UnitNoteModal(this.app, this, unit, studyMap);
    modal.open();
    return modal;
  }
  getSelectedStage(unitId) {
    return this.drafts.getSelectedStage(unitId);
  }
  setSelectedStage(unitId, stageId) {
    this.drafts.setSelectedStage(unitId, stageId);
  }
  /** Done-when ticks are UI-owned working state: they help the learner see how
   *  far through a stage's criteria they are, and are never a second record of
   *  completion. The core still learns only "complete" from `stage-progress`. */
  getDoneWhen(unitId, stageId) {
    return this.drafts.getDoneWhen(unitId, stageId);
  }
  setDoneWhen(unitId, stageId, index, checked) {
    this.drafts.setDoneWhen(unitId, stageId, index, checked);
  }
  clearDoneWhen(unitId, stageId) {
    this.drafts.clearDoneWhen(unitId, stageId);
  }
  getInboxDraft() {
    return this.drafts.getInbox();
  }
  setInboxDraft(title, text5) {
    this.drafts.setInbox(title, text5);
  }
  clearInboxDraft() {
    this.drafts.clearInbox();
  }
  /**
   * Interpreter resolution, in order: an explicitly configured path, the POSIX
   * venv, the Windows venv, then the PATH names. Reported rather than guessed —
   * when a write button dies, Diagnostics has to be able to say which binary
   * was tried and where it looked.
   */
  /** The plugin's own version, kept off the `manifest.` access path so the
   *  contract-key test cannot mistake it for a projection field. */
  uiVersion() {
    const info = this.manifest;
    return info?.version || "unknown";
  }
  resolvePython() {
    return this.runtime.resolvePython();
  }
  /**
   * Run the CLI. `stdin` carries a capability envelope when there is one.
   *
   * Envelopes go down stdin rather than a `--payload-file` temp file: a temp
   * file would put canonical intent on disk on every write, including the
   * ones that fail, leaving cleanup as a thing that can be forgotten.
   */
  runLos(args, callback, stdin) {
    this.runtime.run(args, callback, stdin);
  }
  async reloadStore() {
    const ok = await this.store.load();
    if (!ok) throw new Error(this.store.error);
    this.app.workspace.iterateAllLeaves(
      (leaf) => leaf.view?.render?.()
    );
  }
  /** The active destination is a display fact, so the Navigator is the only
   *  thing it redraws — never the working view the learner is reading. */
  setActiveNav(key) {
    this.activeNav = key;
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_NAV)) leaf.view?.render?.();
  }
  /**
   * Navigation moved to `AppNavigator` on 2026-08-21 (engineering review item
   * 11). What stood here was twenty-eight methods, most of them one line into
   * `this.router.navigate(...)`, and they were the reason every view held the
   * whole plugin: a view that wanted one destination had to declare a
   * dependency on the class that owned all of them. `this.nav` is that
   * collaborator; views now take it (or a `Pick<>` of it) instead.
   */
  /**
   * One transaction at a time, across every view. A per-view `busy` flag only
   * ever protected the view that owned it — a stage completion and an inbox
   * capture started from different leaves could still overlap, each carrying an
   * `--expected-snapshot` the other had already invalidated.
   */
  async mutate(action, { reload = true, healStaleProjection = true } = {}) {
    return this.gateway.enqueue(async () => {
      try {
        const result = await action();
        if (reload) {
          await this.reloadStore();
          if (isGatewaySuccessV2(result)) {
            assertGatewaySnapshotObserved(result, this.store.snapshotId);
          }
        }
        return result;
      } catch (error) {
        if (!healStaleProjection || !isProjectionConflict(error)) throw error;
        await this.refreshAfterConflict();
        throw error;
      }
    });
  }
  /**
   * The core refuses a write whose snapshot is behind the authored tree and
   * says "reload before writing" — but the app's reload re-reads
   * `generated/manifest.json`, which is exactly as stale as the snapshot that
   * was just refused. Only rebuilding the projection moves it forward.
   *
   * This is the normal case, not an edge one: planning happens in Claude, so
   * canonical files change between app sessions by design. Without this the
   * first write after any authoring session fails, and the advice on screen
   * does not fix it.
   *
   * Refresh only. Exit code 3 also represents an artifact-revision conflict;
   * automatically replaying the write after adopting fresh revisions would
   * defeat that guard and could overwrite concurrent work. The learner's
   * draft stays intact for one deliberate reconciliation and retry.
   */
  async refreshAfterConflict() {
    new import_obsidian22.Notice("Canonical files changed since this view loaded \u2014 refreshing them. Your draft was kept; review it before retrying.");
    await this.gateway.call(["generate"], { expectJson: false });
    await this.reloadStore();
  }
  async generate() {
    try {
      await this.mutate(async () => {
        await this.gateway.call(["validate"], { expectJson: false });
        await this.gateway.call(["generate"], { expectJson: false });
      });
      new import_obsidian22.Notice("LearningOS projection rebuilt.");
    } catch (error) {
      new import_obsidian22.Notice(errorMessage4(error));
    }
  }
  async reviewSessionEnd() {
    try {
      const review = asSessionReview(await this.gateway.endSession());
      new SessionEndModal(this.app, this, review).open();
      return review;
    } catch (error) {
      new import_obsidian22.Notice(errorMessage4(error));
      return null;
    }
  }
  async openVaultPath(path) {
    return this.resources.openVaultPath(path);
  }
  async openExternalPath(path, successMessage = "Opened in the default app.") {
    return this.resources.openExternalPath(path, successMessage);
  }
  openMaterialPath(path) {
    return this.resources.openMaterialPath(path);
  }
  openAuthoredPath(path) {
    return this.resources.openAuthoredPath(path);
  }
  openRecord(record4) {
    if (!record4) return;
    const recordId = asString(record4.id);
    if (record4.type === "unit" && recordId) return this.nav.openUnit(recordId);
    if (record4.type === "module" && recordId) return this.nav.openModule(recordId);
    if (record4.type === "project" && recordId) return this.nav.openProject(recordId);
    if (record4.type === "program" && recordId) return this.nav.openProgram(recordId);
    if (record4.type === "source" && recordId) return this.nav.openSourceDetail(recordId);
    if (record4.type === "topic-pack" && recordId) return this.nav.openTopicPackDetail(recordId);
    if (record4.type === "collection" && recordId) return this.nav.openCatalogueDetail(recordId);
    if (record4.type === "note" || record4.type === "concept") {
      if (record4.path) return this.openAuthoredPath(record4.path);
      return this.nav.openLibraryFiltered(record4.type);
    }
    if (record4.type === "workspace") {
      if (record4.project_id) return this.nav.openProject(record4.project_id);
      const unit = (record4.unit_ids || []).map((id2) => this.store.get(id2)).find(Boolean);
      if (unit?.id) return this.nav.openUnit(unit.id);
      const module2 = (record4.module_ids || []).map((id2) => this.store.get(id2)).find(Boolean);
      return module2?.id ? this.nav.openModule(module2.id) : this.nav.openHome();
    }
    if (record4.path) return this.openAuthoredPath(record4.path);
  }
  openResource(resource) {
    return this.resources.openResource(resource, this);
  }
  copyText(value) {
    this.resources.copyText(value);
  }
  async askAiScoped(request, context = {}) {
    const envelope = explicitAiContext(this, context);
    const prompt = `${request}

LearningOS explicit context (authoritative):
${JSON.stringify(envelope, null, 2)}

The active file is supplementary context only. Use only action-specific LearningOS capabilities for writes; never infer a global course or learning path.`;
    this.lastAiPrompt = prompt;
    const agent = this.app.plugins?.plugins?.["agentic-copilot"];
    if (agent?.sendToChat) await agent.sendToChat(prompt);
    else {
      this.copyText(prompt);
      new import_obsidian22.Notice("Scoped prompt copied. Open Agentic Copilot to continue.");
    }
    return prompt;
  }
};
var main_default = LearningOSUI;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LearningOSUI
});
module.exports = module.exports.default;
