/**
 * Closed decoders for the heterogeneous records emitted by Manifest v7.
 *
 * These key sets mirror Core's `system/contracts/manifest-v7.schema.json`.
 * Keeping the checks here makes the permissive `ProjectionRecord` convenience
 * type safe to use after `assertManifest`: extension fields are available to
 * feature code, but an undeclared producer field cannot cross the read boundary.
 */

type Row = Record<string, unknown>;
type SynthesisValidator = (value: unknown) => boolean;

const row = (value: unknown): Row | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Row
    : null;
const text = (value: unknown): value is string => typeof value === 'string';
const nonEmpty = (value: unknown): value is string => text(value) && value.trim().length > 0;
const natural = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1;
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const identifier = (value: unknown, prefix: string): value is string =>
  text(value) && new RegExp(`^${prefix}[a-z0-9]+(?:-[a-z0-9]+)*$`).test(value);
const date = (value: unknown): value is string => {
  if (!text(value)) return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime())
    && parsed.getUTCFullYear() === Number(match[1])
    && parsed.getUTCMonth() + 1 === Number(match[2])
    && parsed.getUTCDate() === Number(match[3]);
};
const dateTime = (value: unknown): value is string =>
  text(value)
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));
const uri = (value: unknown): value is string =>
  text(value) && /^[a-z][a-z0-9+.-]*:[^\s]+$/i.test(value);

function exact(value: Row, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
}

function values<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return text(value) && allowed.includes(value as T);
}

function list(value: unknown, predicate: (item: unknown) => boolean, unique = false): boolean {
  return Array.isArray(value)
    && value.every(predicate)
    && (!unique || new Set(value).size === value.length);
}

const strings = (value: unknown, unique = false): boolean => list(value, text, unique);
const ids = (value: unknown, prefix: string, unique = true): boolean =>
  list(value, (item) => identifier(item, prefix), unique);
const optional = (source: Row, key: string, predicate: (value: unknown) => boolean): boolean =>
  !(key in source) || predicate(source[key]);
const nullable = (value: unknown, predicate: (item: unknown) => boolean): boolean =>
  value === null || predicate(value);

export function validStringMap(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && Object.values(source).every(text));
}

export function validIntegerMap(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && Object.values(source).every(natural));
}

function validStringArrayMap(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && Object.values(source).every((items) => strings(items, true)));
}

function validJsonValue(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || text(value) || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => validJsonValue(item, seen))
    : Object.values(value).every((item) => validJsonValue(item, seen));
  seen.delete(value);
  return valid;
}

function validJsonObject(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && Object.values(source).every((item) => validJsonValue(item)));
}

function validDeadlineModule(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['module_id', 'title', 'action', 'termins'])
    && identifier(source.module_id, 'module-') && nonEmpty(source.title)
    && nullable(source.action, text)
    && list(source.termins, (termin) => positive(termin) && Number(termin) <= 3, true));
}

export function validAcademicDeadline(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['kind', 'label', 'start_date', 'end_date'], [
    'module_id', 'modules', 'notes', 'registration_state', 'termin', 'time', 'title',
  ]) && nonEmpty(source.kind) && nonEmpty(source.label)
    && date(source.start_date) && date(source.end_date)
    && optional(source, 'module_id', text)
    && optional(source, 'modules', (items) => list(items, validDeadlineModule))
    && optional(source, 'notes', (item) => nullable(item, text))
    && optional(source, 'registration_state', text)
    && optional(source, 'termin', positive)
    && optional(source, 'time', (item) => nullable(item, text))
    && optional(source, 'title', text));
}

export function validBacklinks(value: unknown): boolean {
  const source = row(value);
  if (!source || !exact(source, [], [
    'concept_relations', 'concept_to_notes', 'module_to_units',
    'module_to_workspaces', 'note_incoming', 'source_to_notes',
    'source_to_units', 'unit_to_workspaces', 'workspace_to_notes',
  ])) return false;
  return optional(source, 'concept_relations', validJsonObject)
    && [
      'concept_to_notes', 'module_to_units', 'module_to_workspaces',
      'note_incoming', 'source_to_notes', 'source_to_units',
      'unit_to_workspaces', 'workspace_to_notes',
    ].every((key) => optional(source, key, validStringArrayMap));
}

const COUNT_KEYS = [
  'ai_action_requests', 'collections', 'concepts', 'garden_entries',
  'inbox_items', 'learning_paths', 'learning_paths_active', 'modules', 'notes',
  'notes_reviewed', 'notes_with_evidence', 'programs', 'projects', 'relations',
  'source_feedback_records', 'sources', 'sources_with_topics', 'stages',
  'stages_complete', 'study_maps', 'thematic_groups', 'topic_packs', 'topics',
  'units', 'units_needing_map', 'workspaces_active', 'workspaces_archived',
] as const;

export function validCounts(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, COUNT_KEYS)
    && COUNT_KEYS.every((key) => natural(source[key])));
}

export function validGardenEntry(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'id', 'last_ai_request_id', 'path', 'revision', 'state', 'tags', 'title',
    'transcription_path', 'type',
  ]) && text(source.id) && nullable(source.last_ai_request_id, text)
    && text(source.path) && text(source.revision) && text(source.state)
    && strings(source.tags) && text(source.title)
    && nullable(source.transcription_path, text) && source.type === 'garden-note');
}

export function validProgress(value: unknown): boolean {
  const source = row(value);
  const keys = [
    'stages_complete', 'stages_total', 'units_complete', 'units_needing_map',
    'units_total',
  ] as const;
  return Boolean(source && Object.values(source).every((item) => {
    const progress = row(item);
    return Boolean(progress && exact(progress, keys)
      && keys.every((key) => natural(progress[key])));
  }));
}

export function validRelation(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['from', 'type', 'to', 'context', 'source'])
    && ['from', 'type', 'to', 'context', 'source']
      .every((key) => nullable(source[key], text)));
}

export function validResumePointer(value: unknown): boolean {
  const source = row(value);
  if (!source) return false;
  if (exact(source, [])) return true;
  return exact(source, [
    'type', 'module_id', 'unit_id', 'study_map_id', 'stage_id', 'updated',
  ]) && source.type === 'resume-pointer'
    && ['module_id', 'unit_id', 'study_map_id', 'stage_id', 'updated']
      .every((key) => text(source[key]));
}

export function validReviewItem(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'category', 'context', 'id', 'reason', 'target', 'title',
  ]) && text(source.category) && text(source.context) && text(source.id)
    && text(source.reason) && validJsonObject(source.target) && text(source.title));
}

export function validSemester(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['id', 'order', 'program_id', 'status', 'title'])
    && text(source.id) && integer(source.order) && text(source.program_id)
    && text(source.status) && text(source.title));
}

export function validThematicGroup(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['id', 'title', 'description', 'order'])
    && text(source.id) && text(source.title) && text(source.description)
    && integer(source.order));
}

export function validTopic(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['id', 'title', 'domain'])
    && text(source.id) && text(source.title) && text(source.domain));
}

function validModuleComponent(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['id', 'title', 'order'], ['short_title'])
    && identifier(source.id, 'component-') && nonEmpty(source.title) && natural(source.order)
    && optional(source, 'short_title', text));
}

function validExaminationSitting(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['termin', 'date'], [
    'end_date', 'time', 'label', 'notes',
  ]) && positive(source.termin) && source.termin <= 3 && date(source.date)
    && optional(source, 'end_date', date) && optional(source, 'time', nonEmpty)
    && optional(source, 'label', nonEmpty) && optional(source, 'notes', text));
}

function validRegistrationWindow(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['opens', 'closes', 'label'], ['action', 'termins'])
    && date(source.opens) && date(source.closes) && nonEmpty(source.label)
    && optional(source, 'action', nonEmpty)
    && optional(source, 'termins', (termins) => list(
      termins,
      (termin) => positive(termin) && Number(termin) <= 3,
      true,
    )));
}

function validExamination(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [], ['type', 'notes', 'sittings', 'registration_windows'])
    && optional(source, 'type', (item) => values(item, [
      'klausur', 'muendlich', 'portfolio', 'project', 'hausarbeit', 'other',
    ] as const))
    && optional(source, 'notes', text)
    && optional(source, 'sittings', (items) => list(items, validExaminationSitting))
    && optional(source, 'registration_windows', (items) => list(items, validRegistrationWindow)));
}

function validAttempt(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['termin', 'result'], ['date', 'grade', 'notes'])
    && positive(source.termin) && source.termin <= 3
    && values(source.result, ['registered', 'withdrawn', 'passed', 'failed'] as const)
    && optional(source, 'date', date)
    && optional(source, 'grade', (grade) => finite(grade) && grade >= 1 && grade <= 5)
    && optional(source, 'notes', text));
}

export function validModuleRecord(value: unknown): boolean {
  const source = row(value);
  if (!source || !exact(source, [
    'id', 'type', 'title', 'revision', 'path', 'kind', 'area_id',
    'thematic_group_ids', 'status', 'administrative_status', 'operational_state',
    'is_actionable', 'institution', 'code', 'credits', 'semester', 'components',
    'examination', 'attempts', 'grade', 'unit_order', 'source_map',
  ])) return false;
  return identifier(source.id, 'module-') && source.type === 'module'
    && nonEmpty(source.title) && natural(source.revision) && nonEmpty(source.path)
    && values(source.kind, ['academic', 'skill', 'project', 'foundation'] as const)
    && nullable(source.area_id, (item) => identifier(item, 'program-'))
    && ids(source.thematic_group_ids, 'thematic-group-')
    && values(source.status, [
      'planned', 'enrolled', 'active', 'paused', 'awaiting-grade',
      'completed', 'dropped', 'archived',
    ] as const)
    && (source.administrative_status === null || values(source.administrative_status, [
      'planned', 'enrolled', 'awaiting-grade', 'completed', 'dropped', 'archived',
    ] as const))
    && values(source.operational_state, ['none', 'complete', 'active', 'paused'] as const)
    && typeof source.is_actionable === 'boolean'
    && nullable(source.institution, text) && nullable(source.code, text)
    && nullable(source.credits, (item) => finite(item) && item >= 0)
    && nullable(source.semester, (item) => text(item) && /^(sose|wise)-\d{4}$/.test(item))
    && list(source.components, validModuleComponent)
    && nullable(source.examination, validExamination)
    && list(source.attempts, validAttempt)
    && nullable(source.grade, (item) => finite(item) && item >= 1 && item <= 5)
    && ids(source.unit_order, 'unit-')
    && (source.source_map === null || source.source_map === 'source-map.yaml');
}

function validProgramSemester(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['id', 'title', 'status', 'order'])
    && identifier(source.id, 'semester-') && nonEmpty(source.title)
    && values(source.status, ['current', 'previous', 'future', 'archived'] as const)
    && natural(source.order));
}

export function validProgramRecord(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'id', 'type', 'title', 'kind', 'status', 'default', 'semester_bound', 'revision', 'path',
  ], ['description', 'boundary_action', 'semesters'])
    && identifier(source.id, 'program-') && source.type === 'program' && nonEmpty(source.title)
    && values(source.kind, ['academic', 'skills', 'projects'] as const)
    && values(source.status, ['active', 'metadata-only', 'archived'] as const)
    && typeof source.default === 'boolean' && typeof source.semester_bound === 'boolean'
    && natural(source.revision) && nonEmpty(source.path)
    && optional(source, 'description', text) && optional(source, 'boundary_action', text)
    && optional(source, 'semesters', (items) => list(items, validProgramSemester)));
}

function validProjectBoundaries(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['confidentiality', 'external_code_access'], ['notes'])
    && values(source.confidentiality, ['public', 'private', 'confidential'] as const)
    && values(source.external_code_access, ['none', 'read-only', 'approved'] as const)
    && optional(source, 'notes', text));
}

function validStructureNode(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['id', 'title', 'kind'], ['status', 'summary', 'children'])
    && text(source.id)
    && /^(workstream|step-map|step|milestone)-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.id)
    && nonEmpty(source.title)
    && values(source.kind, ['workstream', 'step-map', 'step', 'milestone'] as const)
    && optional(source, 'status', (item) => values(item, [
      'planned', 'active', 'blocked', 'complete', 'completed', 'deferred',
    ] as const))
    && optional(source, 'summary', text)
    && optional(source, 'children', (items) => list(items, validStructureNode)));
}

function validProjectStructure(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['kind', 'nodes'])
    && values(source.kind, ['none', 'linear', 'parallel', 'nested'] as const)
    && list(source.nodes, validStructureNode));
}

function validProjectFile(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['label', 'path'], ['kind'])
    && nonEmpty(source.label) && nonEmpty(source.path)
    && optional(source, 'kind', (item) => values(item, [
      'input', 'output', 'working', 'external',
    ] as const)));
}

function validProjectDecision(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['id', 'title', 'status', 'summary'], ['decided_at'])
    && identifier(source.id, 'decision-') && nonEmpty(source.title)
    && values(source.status, ['open', 'decided', 'revisit'] as const)
    && nonEmpty(source.summary) && optional(source, 'decided_at', date));
}

export function validProjectRecord(value: unknown): boolean {
  const source = row(value);
  if (!source || !exact(source, [
    'schema_version', 'id', 'type', 'title', 'project_type', 'status', 'root_uri',
    'objective', 'milestone_ids', 'linked_module_ids', 'unit_ids', 'workspace_ids',
    'thematic_group_ids', 'boundaries', 'revision', 'path', 'relationship_ids',
  ], [
    'structure', 'files', 'decisions', 'migrated_from', 'migrated_at',
    'migration', 'source_sha256',
  ])) return false;
  return source.schema_version === 1 && identifier(source.id, 'project-')
    && source.type === 'project' && nonEmpty(source.title)
    && values(source.project_type, ['thesis', 'research', 'software', 'writing', 'other'] as const)
    && values(source.status, ['planned', 'active', 'paused', 'completed', 'archived'] as const)
    && text(source.root_uri) && /^(project|github):\/\/[^\s]+$/.test(source.root_uri)
    && nonEmpty(source.objective) && ids(source.milestone_ids, 'milestone-')
    && ids(source.linked_module_ids, 'module-') && ids(source.unit_ids, 'unit-')
    && ids(source.workspace_ids, 'workspace-') && ids(source.thematic_group_ids, 'thematic-group-')
    && validProjectBoundaries(source.boundaries) && natural(source.revision) && nonEmpty(source.path)
    && ids(source.relationship_ids, 'relationship-')
    && optional(source, 'structure', validProjectStructure)
    && optional(source, 'files', (items) => list(items, validProjectFile))
    && optional(source, 'decisions', (items) => list(items, validProjectDecision))
    && optional(source, 'migrated_from', text) && optional(source, 'migrated_at', dateTime)
    && optional(source, 'migration', text)
    && optional(source, 'source_sha256', (item) => text(item) && /^[a-f0-9]{64}$/.test(item));
}

function validProjectRelationship(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'id', 'type', 'from_project_id', 'to_id', 'to_type', 'relation_type',
    'reason', 'contribution', 'path',
  ]) && identifier(source.id, 'relationship-') && source.type === 'project-relationship'
    && identifier(source.from_project_id, 'project-') && nonEmpty(source.to_id)
    && values(source.to_type, ['module', 'source', 'topic-pack', 'note', 'file'] as const)
    && values(source.relation_type, ['uses', 'informs', 'depends-on', 'produces', 'related'] as const)
    && nonEmpty(source.reason) && nonEmpty(source.contribution) && nonEmpty(source.path));
}

function validCompatibilityAlias(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['id', 'type', 'target_id', 'target_type', 'path'])
    && nonEmpty(source.id) && source.type === 'compatibility-alias'
    && identifier(source.target_id, 'project-') && source.target_type === 'project'
    && source.path === 'projects/aliases.yaml');
}

function validNoteEvidence(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['type', 'ref'])
    && values(source.type, [
      'derivation', 'explanation', 'implementation', 'exercise', 'exam', 'external',
    ] as const) && nonEmpty(source.ref));
}

function validNoteRecord(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'id', 'type', 'title', 'path', 'domain', 'summary', 'role', 'state', 'authorship',
    'concepts', 'sources', 'contexts', 'attachments', 'evidence', 'supersedes',
    'reviewed', 'transcription', 'semantic_review',
  ]) && identifier(source.id, 'note-') && source.type === 'note'
    && nonEmpty(source.title) && nonEmpty(source.path) && text(source.domain) && text(source.summary)
    && values(source.role, [
      'synthesis', 'reference', 'derivation', 'exercise-bank', 'mock-exam',
      'implementation', 'question', 'crosswalk',
    ] as const)
    && nullable(source.state, (item) => values(item, [
      'rough', 'evolving', 'mature', 'deprecated',
    ] as const))
    && nullable(source.authorship, (item) => values(item, [
      'user', 'mixed', 'external', 'operator-drafted',
    ] as const))
    && ids(source.concepts, 'concept-') && ids(source.sources, 'source-')
    && ids(source.contexts, 'workspace-') && strings(source.attachments)
    && list(source.evidence, validNoteEvidence) && ids(source.supersedes, 'note-')
    && nullable(source.reviewed, date)
    && nullable(source.transcription, (item) => values(item, [
      'none', 'manual', 'ai-assisted',
    ] as const))
    && nullable(source.semantic_review, (item) => values(item, [
      'unreviewed', 'user-reviewed',
    ] as const)));
}

function validConceptRecord(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['id', 'type', 'title', 'path', 'aliases', 'deprecated'])
    && identifier(source.id, 'concept-') && source.type === 'concept'
    && nonEmpty(source.title) && nonEmpty(source.path) && strings(source.aliases, true)
    && typeof source.deprecated === 'boolean');
}

function validUsefulSection(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['section', 'note'])
    && text(source.section) && text(source.note));
}

function validSourceEvaluation(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'roles', 'level', 'audience', 'prerequisites', 'strengths', 'weaknesses',
    'reviewed', 'concepts', 'useful_sections',
  ]) && strings(source.roles)
    && nullable(source.level, (item) => values(item, [
      'introductory', 'intermediate', 'advanced', 'reference',
    ] as const))
    && strings(source.audience) && strings(source.prerequisites)
    && strings(source.strengths) && strings(source.weaknesses)
    && nullable(source.reviewed, date) && ids(source.concepts, 'concept-')
    && list(source.useful_sections, validUsefulSection));
}

function validSourceRecord(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'id', 'type', 'title', 'revision', 'path', 'source_type', 'thematic_group_ids',
    'topics', 'url', 'material', 'material_path', 'material_exists', 'authors',
    'organization', 'year', 'identifiers', 'roles', 'evaluations',
  ]) && identifier(source.id, 'source-') && source.type === 'source'
    && nonEmpty(source.title) && natural(source.revision) && nonEmpty(source.path)
    && values(source.source_type, [
      'book', 'paper', 'lecture', 'course', 'video', 'website', 'documentation',
      'software', 'conversation', 'other',
    ] as const)
    && ids(source.thematic_group_ids, 'thematic-group-') && ids(source.topics, 'topic-')
    && nullable(source.url, uri)
    && nullable(source.material, (item) => text(item) && /^material:\/\/.+/.test(item))
    && nullable(source.material_path, text) && typeof source.material_exists === 'boolean'
    && strings(source.authors) && nullable(source.organization, text)
    && nullable(source.year, (item) => natural(item) && item >= 1800 && item <= 2100)
    && validStringMap(source.identifiers) && strings(source.roles, true)
    && list(source.evaluations, validSourceEvaluation));
}

function validCollectionEntry(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['source', 'group', 'why'])
    && identifier(source.source, 'source-') && nullable(source.group, text)
    && nullable(source.why, text));
}

function validCollectionRecord(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'id', 'type', 'revision', 'collection_kind', 'title', 'path',
    'thematic_group_ids', 'purpose', 'sources', 'summary', 'domain', 'entries',
  ]) && nonEmpty(source.id) && values(source.type, ['collection', 'topic-pack'] as const)
    && natural(source.revision) && values(source.collection_kind, ['catalogue', 'topic-pack'] as const)
    && nonEmpty(source.title) && text(source.path) && /^sources\/collections\/.+\.yaml$/.test(source.path)
    && ids(source.thematic_group_ids, 'thematic-group-') && nullable(source.purpose, text)
    && ids(source.sources, 'source-', false) && text(source.summary) && nonEmpty(source.domain)
    && list(source.entries, validCollectionEntry));
}

export const validTopicPack = validCollectionRecord;

function validWorkspaceRecord(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'id', 'type', 'title', 'revision', 'path', 'status', 'standing', 'archived',
    'deadline', 'objective', 'next_action', 'concepts', 'notes', 'sources',
    'program_ids', 'module_ids', 'unit_ids', 'project_id',
  ]) && identifier(source.id, 'workspace-') && source.type === 'workspace'
    && nonEmpty(source.title) && natural(source.revision) && nonEmpty(source.path)
    && values(source.status, ['active', 'blocked', 'complete'] as const)
    && typeof source.standing === 'boolean' && typeof source.archived === 'boolean'
    && nullable(source.deadline, date) && text(source.objective) && text(source.next_action)
    && ids(source.concepts, 'concept-') && ids(source.notes, 'note-')
    && ids(source.sources, 'source-') && ids(source.program_ids, 'program-')
    && ids(source.module_ids, 'module-') && ids(source.unit_ids, 'unit-')
    && nullable(source.project_id, (item) => identifier(item, 'project-')));
}

function validStageAttachment(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['path', 'label'])
    && nonEmpty(source.path) && nonEmpty(source.label));
}

function validResource(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['kind', 'label'], [
    'id', 'route_id', 'source_id', 'locator', 'angle', 'angle_detail', 'url',
    'vault_path', 'scope_triage', 'material_uri', 'material_path', 'material_exists',
  ]) && text(source.kind) && text(source.label) && optional(source, 'id', text)
    && optional(source, 'route_id', (item) => identifier(item, 'route-'))
    && optional(source, 'source_id', text) && optional(source, 'locator', text)
    && optional(source, 'angle', text) && optional(source, 'angle_detail', text)
    && optional(source, 'url', uri) && optional(source, 'vault_path', text)
    && optional(source, 'scope_triage', text) && optional(source, 'material_uri', text)
    && optional(source, 'material_path', text)
    && optional(source, 'material_exists', (item) => typeof item === 'boolean'));
}

function validSourceFeedback(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['source_id', 'feedback', 'recorded'], [
    'resource_id', 'note',
  ]) && identifier(source.source_id, 'source-')
    && optional(source, 'resource_id', (item) => identifier(item, 'resource-'))
    && values(source.feedback, [
      'helpful', 'too-advanced', 'wrong-perspective', 'useful-for-derivation',
      'useful-for-review', 'skipped',
    ] as const) && optional(source, 'note', text) && date(source.recorded));
}

function validStudyMapStage(value: unknown, flat: boolean): boolean {
  const source = row(value);
  const required = [
    'id', 'title', 'status', 'objective', 'done_when', 'resources', 'working_note',
    'attachments', 'source_feedback', 'scope_triage', 'notes_text', 'notes_updated',
    ...(flat ? ['study_map_id', 'unit_id', 'module_id'] : []),
  ];
  if (!source || !exact(source, required, [
    'number', 'estimate_minutes', 'exam_critical', 'concepts', 'detour_id', 'completed',
    ...(flat ? [] : ['study_map_id', 'unit_id', 'module_id']),
  ])) return false;
  return text(source.id) && text(source.title) && text(source.status) && text(source.objective)
    && strings(source.done_when) && list(source.resources, validResource)
    && text(source.working_note) && list(source.attachments, validStageAttachment)
    && list(source.source_feedback, validSourceFeedback) && text(source.scope_triage)
    && text(source.notes_text) && nullable(source.notes_updated, text)
    && optional(source, 'number', positive) && optional(source, 'estimate_minutes', positive)
    && optional(source, 'exam_critical', (item) => typeof item === 'boolean')
    && optional(source, 'concepts', strings) && optional(source, 'detour_id', text)
    && optional(source, 'completed', text) && optional(source, 'study_map_id', text)
    && optional(source, 'unit_id', text) && optional(source, 'module_id', text);
}

export const validFlatStage = (value: unknown): boolean => validStudyMapStage(value, true);

function validStudyMapSourcePlan(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['path', 'provenance']) && nonEmpty(source.path)
    && values(source.provenance, [
      'migrated-mini-plan', 'learner', 'ai-proposed', 'operator', 'durable-note',
    ] as const));
}

function validDetour(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'id', 'title', 'spawned_by_stage', 'classification', 'status', 'return_to_stage',
  ], ['resolution']) && identifier(source.id, 'detour-') && nonEmpty(source.title)
    && identifier(source.spawned_by_stage, 'stage-')
    && values(source.classification, [
      'required-now', 'helpful-now', 'deferred', 'reference-only',
    ] as const) && values(source.status, ['open', 'resolved', 'deferred'] as const)
    && identifier(source.return_to_stage, 'stage-') && optional(source, 'resolution', text));
}

function validShelvingItem(value: unknown, archiveKind: 'archive-map' | 'archive-path'): boolean {
  const source = row(value);
  const studyMap = archiveKind === 'archive-map';
  return Boolean(source && exact(source, ['id', 'kind', 'title', 'destination', 'rationale'], [
    'diff', ...(studyMap ? ['content', 'metadata'] : []), 'selected',
  ]) && identifier(source.id, 'proposal-')
    && values(source.kind, [
      'durable-note', 'garden', 'concept-relation', archiveKind,
    ] as const) && nonEmpty(source.title) && nonEmpty(source.destination)
    && nonEmpty(source.rationale) && optional(source, 'diff', text)
    && (!studyMap || optional(source, 'content', text))
    && (!studyMap || optional(source, 'metadata', (item) => row(item) !== null))
    && optional(source, 'selected', (item) => typeof item === 'boolean'));
}

function validShelving(value: unknown, studyMap: boolean): boolean {
  const source = row(value);
  return Boolean(source && exact(source, studyMap ? ['state'] : [], [
    'state', 'proposal_path', 'summary', 'items',
  ]) && optional(source, 'state', (item) => values(item, studyMap
    ? ['none', 'draft', 'proposed', 'approved', 'applied'] as const
    : ['none', 'draft', 'proposed', 'approved'] as const))
    && optional(source, 'proposal_path', (item) => text(item)
      && (studyMap || /^work\/active\/.+\.md$/.test(item)))
    && optional(source, 'summary', text)
    && optional(source, 'items', (items) => list(
      items,
      (item) => validShelvingItem(item, studyMap ? 'archive-map' : 'archive-path'),
    )));
}

export function validStudyMap(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'id', 'type', 'unit_id', 'module_id', 'status', 'current_stage', 'source_plan',
    'stages', 'shelving', 'revision', 'path',
  ], ['plan_template_version', 'detours']) && text(source.id) && source.type === 'study-map'
    && text(source.unit_id) && text(source.module_id) && text(source.status)
    && text(source.current_stage) && validStudyMapSourcePlan(source.source_plan)
    && list(source.stages, (stage) => validStudyMapStage(stage, false))
    && validShelving(source.shelving, true) && natural(source.revision) && text(source.path)
    && optional(source, 'plan_template_version', positive)
    && optional(source, 'detours', (items) => list(items, validDetour)));
}

function validPathStage(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'id', 'title', 'status', 'objective', 'done_when', 'resources', 'notes_text', 'notes_updated',
  ], [
    'number', 'estimate_minutes', 'exam_critical', 'concepts', 'notes_path',
    'attachments', 'completed',
  ]) && identifier(source.id, 'stage-') && nonEmpty(source.title)
    && values(source.status, ['pending', 'active', 'complete', 'skipped'] as const)
    && nonEmpty(source.objective) && Array.isArray(source.done_when)
    && source.done_when.length > 0 && source.done_when.every(nonEmpty)
    && list(source.resources, validResource) && text(source.notes_text)
    && nullable(source.notes_updated, text) && optional(source, 'number', positive)
    && optional(source, 'estimate_minutes', positive)
    && optional(source, 'exam_critical', (item) => typeof item === 'boolean')
    && optional(source, 'concepts', (items) => ids(items, 'concept-'))
    && optional(source, 'notes_path', text)
    && optional(source, 'attachments', (items) => list(items, validStageAttachment))
    && optional(source, 'completed', date));
}

function validLearningPath(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'id', 'type', 'revision', 'title', 'path', 'workspace_id', 'area', 'module_id',
    'status', 'current_stage', 'created', 'updated', 'objective', 'source_plan',
    'stages', 'shelving', 'archived',
  ]) && identifier(source.id, 'path-') && source.type === 'learning-path'
    && natural(source.revision) && nonEmpty(source.title) && nonEmpty(source.path)
    && identifier(source.workspace_id, 'workspace-')
    && values(source.area, ['university', 'personal'] as const)
    && nullable(source.module_id, (item) => identifier(item, 'module-'))
    && values(source.status, ['active', 'paused', 'ready-to-shelve', 'complete'] as const)
    && identifier(source.current_stage, 'stage-') && date(source.created)
    && nullable(source.updated, date) && text(source.objective)
    && nullable(source.source_plan, text) && Array.isArray(source.stages)
    && source.stages.length > 0 && source.stages.every(validPathStage)
    && validShelving(source.shelving, false) && typeof source.archived === 'boolean');
}

function validKnowledgeNode(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['id', 'title', 'summary'], ['builds_on', 'concept_ids'])
    && identifier(source.id, 'knowledge-') && nonEmpty(source.title) && nonEmpty(source.summary)
    && optional(source, 'builds_on', (items) => strings(items, true))
    && optional(source, 'concept_ids', (items) => ids(items, 'concept-')));
}

function validUnitArtifacts(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [], [
    'ultimate_reference', 'exercise_bank', 'mock_exam', 'other',
  ]) && optional(source, 'ultimate_reference', (item) => identifier(item, 'note-'))
    && optional(source, 'exercise_bank', (item) => identifier(item, 'note-'))
    && optional(source, 'mock_exam', (item) => identifier(item, 'note-'))
    && optional(source, 'other', (items) => ids(items, 'note-')));
}

function validUnitNoteSection(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'recorded_at', 'title', 'stage_ids', 'attachments', 'text', 'summary',
  ]) && nullable(source.recorded_at, text) && nonEmpty(source.title)
    && strings(source.stage_ids) && list(source.attachments, validStageAttachment)
    && text(source.text) && text(source.summary));
}

function validKnowledgeMap(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['summary', 'nodes']) && text(source.summary)
    && list(source.nodes, validKnowledgeNode));
}

function validScopeSource(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['source_id', 'authority'], ['locator'])
    && text(source.source_id) && text(source.authority) && optional(source, 'locator', text));
}

function validSourceSelection(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['source_id', 'locator', 'purpose'], ['route_id', 'stage_ids'])
    && text(source.source_id) && text(source.locator) && text(source.purpose)
    && optional(source, 'route_id', (item) => identifier(item, 'route-'))
    && optional(source, 'stage_ids', (items) => strings(items, true)));
}

export function validProjectedUnit(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'id', 'type', 'module_id', 'kind', 'title', 'order', 'scope', 'status',
    'artifacts', 'workspace_ids', 'source_selections', 'scope_sources', 'revision',
    'path', 'project_ids', 'needs_study_map', 'notes_text', 'note_sections', 'notes_updated',
  ], [
    'component_id', 'knowledge_map', 'current_study_map', 'working_note',
    'parent_unit_id', 'child_unit_ids', 'related_module_ids',
  ]) && identifier(source.id, 'unit-') && source.type === 'unit'
    && identifier(source.module_id, 'module-') && optional(source, 'component_id', text)
    && text(source.kind) && text(source.title) && natural(source.order) && text(source.scope)
    && text(source.status) && natural(source.revision) && text(source.path)
    && typeof source.needs_study_map === 'boolean' && text(source.notes_text)
    && nullable(source.notes_updated, text) && strings(source.project_ids, true)
    && validUnitArtifacts(source.artifacts) && strings(source.workspace_ids)
    && list(source.source_selections, validSourceSelection)
    && list(source.scope_sources, validScopeSource)
    && list(source.note_sections, validUnitNoteSection)
    && optional(source, 'knowledge_map', validKnowledgeMap)
    && optional(source, 'current_study_map', text) && optional(source, 'working_note', text)
    && optional(source, 'parent_unit_id', text)
    && optional(source, 'child_unit_ids', strings)
    && optional(source, 'related_module_ids', strings));
}

function validProjectedRoute(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'id', 'unit_id', 'source_id', 'title', 'format', 'angle', 'covers', 'depth', 'scope',
  ], [
    'angle_detail', 'locator', 'url', 'vault_path', 'material_uri', 'material_path',
    'material_exists',
  ]) && identifier(source.id, 'route-') && identifier(source.unit_id, 'unit-')
    && identifier(source.source_id, 'source-') && nonEmpty(source.title)
    && nonEmpty(source.format) && nonEmpty(source.angle)
    && Array.isArray(source.covers) && source.covers.length > 0
    && ids(source.covers, 'knowledge-') && nonEmpty(source.depth) && nonEmpty(source.scope)
    && optional(source, 'angle_detail', nonEmpty) && optional(source, 'locator', text)
    && optional(source, 'url', uri) && optional(source, 'vault_path', text)
    && optional(source, 'material_uri', text) && optional(source, 'material_path', text)
    && optional(source, 'material_exists', (item) => typeof item === 'boolean'));
}

function validSourceMapEntry(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'source_id', 'role', 'why', 'priority', 'unit_routes',
  ], ['when']) && identifier(source.source_id, 'source-') && nonEmpty(source.role)
    && nonEmpty(source.why) && natural(source.priority) && optional(source, 'when', text)
    && list(source.unit_routes, (item) => identifier(item, 'unit-') || validProjectedRoute(item)));
}

export function validModuleSourceMap(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, ['id', 'type', 'module_id', 'sources', 'revision', 'path'])
    && identifier(source.id, 'source-map-') && source.type === 'module-source-map'
    && identifier(source.module_id, 'module-') && list(source.sources, validSourceMapEntry)
    && natural(source.revision) && text(source.path));
}

function validCoordinationRecord(value: unknown): boolean {
  const source = row(value);
  const sections = row(source?.sections);
  return Boolean(source && exact(source, ['id', 'type', 'path', 'sections'])
    && source.id === 'coordination' && source.type === 'coordination'
    && source.path === 'work/COORDINATION.md' && sections
    && exact(sections, ['Commitments', 'Priorities', 'Dependencies', 'Deferrals'])
    && Object.values(sections).every(text));
}

function validAiAction(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'id', 'title', 'description', 'target_kinds', 'interaction_mode', 'status',
    'supported_providers',
  ]) && text(source.id) && /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(source.id)
    && nonEmpty(source.title) && text(source.description)
    && list(source.target_kinds, nonEmpty, true) && nonEmpty(source.interaction_mode)
    && values(source.status, ['planned', 'implemented'] as const)
    && list(source.supported_providers, nonEmpty, true));
}

function validAiProvider(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'id', 'adapter', 'available', 'supported_modes', 'supports_direct_delivery',
  ]) && nonEmpty(source.id) && nonEmpty(source.adapter) && typeof source.available === 'boolean'
    && list(source.supported_modes, nonEmpty, true)
    && typeof source.supports_direct_delivery === 'boolean');
}

function validAiRequest(value: unknown): boolean {
  const source = row(value);
  const target = row(source?.target);
  return Boolean(source && exact(source, [
    'id', 'action_id', 'target', 'provider', 'status', 'created_at', 'delivery_id',
    'receipt_id', 'bundle_path',
  ]) && identifier(source.id, 'ai-request-') && text(source.action_id)
    && /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(source.action_id)
    && target && exact(target, ['kind', 'id']) && nonEmpty(target.kind) && nonEmpty(target.id)
    && nonEmpty(source.provider)
    && values(source.status, ['prepared', 'delivery-ready', 'completed'] as const)
    && dateTime(source.created_at) && nullable(source.delivery_id, text)
    && nullable(source.receipt_id, text) && text(source.bundle_path)
    && /^operations\/ai-actions\/requests\/[^/]+$/.test(source.bundle_path));
}

export function validAiActions(value: unknown): boolean {
  const source = row(value);
  return Boolean(source && exact(source, [
    'available', 'contract_version', 'provider_adapters', 'requests',
  ]) && source.contract_version === 1 && list(source.available, validAiAction)
    && list(source.provider_adapters, validAiProvider) && list(source.requests, validAiRequest));
}

export function validProjectedRecord(
  value: unknown,
  validSynthesis: SynthesisValidator,
): boolean {
  const source = row(value);
  switch (source?.type) {
    case 'note': return validNoteRecord(source);
    case 'concept': return validConceptRecord(source);
    case 'source': return validSourceRecord(source);
    case 'project': return validProjectRecord(source);
    case 'project-relationship': return validProjectRelationship(source);
    case 'compatibility-alias': return validCompatibilityAlias(source);
    case 'module': return validModuleRecord(source);
    case 'collection':
    case 'topic-pack': return validCollectionRecord(source);
    case 'workspace': return validWorkspaceRecord(source);
    case 'learning-path': return validLearningPath(source);
    case 'program': return validProgramRecord(source);
    case 'unit': return validProjectedUnit(source);
    case 'study-map': return validStudyMap(source);
    case 'module-source-map': return validModuleSourceMap(source);
    case 'unit-material-synthesis': return validSynthesis(source);
    case 'coordination': return validCoordinationRecord(source);
    default: return false;
  }
}

export { validProjectRelationship };
