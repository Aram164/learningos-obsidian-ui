import { CONTRACT_VERSION } from './constants';
import { assertManifest } from './contracts/manifest';
import type {
  Manifest,
  ModuleConceptEdge,
  ModuleProgress,
  ProjectRelationship,
  ProjectionRecord,
  RelationRecord,
  UnitMaterialSynthesisV1,
  UnitNoteSection,
} from './contracts/manifest';
import { asStrings } from './projection/readers';

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value);
}

/** A projected string field, or null for both absent and empty. */
function projectedText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

interface ManifestStoreHost {
  vault: {
    adapter: {
      exists(path: string): Promise<boolean>;
      read(path: string): Promise<string>;
    };
  };
}

interface SearchDocument {
  readonly record: ProjectionRecord;
  readonly strictText: string;
  readonly compactText: string;
}

/**
 * Every derived read structure for one validated manifest snapshot.
 *
 * `load()` builds this object without touching the live store, then publishes
 * it together with `data`, `records`, and `byId`. Accessors therefore share one
 * snapshot and never rebuild indexes while a view is rendering.
 */
interface StoreIndexes {
  readonly archivedModuleIds: ReadonlySet<string>;
  readonly rowsByGroup: ReadonlyMap<string, readonly ProjectionRecord[]>;
  readonly rowsByType: ReadonlyMap<string, readonly ProjectionRecord[]>;
  readonly sourceMapByModule: ReadonlyMap<string, ProjectionRecord>;
  readonly unitNoteSectionsByUnit: ReadonlyMap<string, readonly UnitNoteSection[]>;
  readonly materialSynthesisByUnit: ReadonlyMap<string, UnitMaterialSynthesisV1>;
  readonly searchDocuments: readonly SearchDocument[];
}

function emptyStoreIndexes(): StoreIndexes {
  return {
    archivedModuleIds: new Set(),
    rowsByGroup: new Map(),
    rowsByType: new Map(),
    sourceMapByModule: new Map(),
    unitNoteSectionsByUnit: new Map(),
    materialSynthesisByUnit: new Map(),
    searchDocuments: [],
  };
}

function isArchivedRecord(
  record: ProjectionRecord,
  archivedModuleIds: ReadonlySet<string>,
): boolean {
  if (record.type === 'module' && record.status === 'archived') {
    return true;
  }

  return typeof record.module_id === 'string'
    && archivedModuleIds.has(record.module_id);
}

function projectedRows(value: unknown): ProjectionRecord[] {
  return Array.isArray(value)
    ? value.filter(
      (row): row is ProjectionRecord => isRecord(row),
    )
    : [];
}

function buildStoreIndexes(
  manifest: Manifest,
  records: ProjectionRecord[],
): StoreIndexes {
  const archivedModuleIds = new Set(
    manifest.modules.flatMap((module) =>
      module.status === 'archived' && typeof module.id === 'string'
        ? [module.id]
        : []),
  );
  const rowsByGroup = new Map<string, readonly ProjectionRecord[]>();

  for (const [group, value] of Object.entries(manifest)) {
    if (!Array.isArray(value)) continue;
    rowsByGroup.set(
      group,
      projectedRows(value).filter(
        (row) => !isArchivedRecord(row, archivedModuleIds),
      ),
    );
  }

  const visibleRecords = records.filter(
    (row) => !isArchivedRecord(row, archivedModuleIds),
  );
  const rowsByType = new Map<string, ProjectionRecord[]>();

  for (const row of visibleRecords) {
    if (typeof row.type !== 'string') continue;
    const rows = rowsByType.get(row.type);
    if (rows) rows.push(row);
    else rowsByType.set(row.type, [row]);
  }

  const sourceMapByModule = new Map<string, ProjectionRecord>();
  for (const sourceMap of rowsByGroup.get('module_source_maps') ?? []) {
    if (
      typeof sourceMap.module_id === 'string'
      && !sourceMapByModule.has(sourceMap.module_id)
    ) {
      sourceMapByModule.set(sourceMap.module_id, sourceMap);
    }
  }

  // These two accessors historically read the complete validated collections,
  // not the active-curriculum rows. Preserve that boundary while avoiding a
  // new linear search for every unit render.
  const unitNoteSectionsByUnit = new Map<
    string,
    readonly UnitNoteSection[]
  >();
  for (const unit of manifest.units) {
    if (!unitNoteSectionsByUnit.has(unit.id)) {
      unitNoteSectionsByUnit.set(unit.id, unit.note_sections);
    }
  }

  const synthesisById = new Map<string, UnitMaterialSynthesisV1>();
  for (const synthesis of manifest.unit_material_syntheses) {
    if (!synthesisById.has(synthesis.id)) {
      synthesisById.set(synthesis.id, synthesis);
    }
  }
  const materialSynthesisByUnit = new Map<
    string,
    UnitMaterialSynthesisV1
  >();
  for (const [unitId, synthesisId] of Object.entries(
    manifest.indexes.unit_to_material_synthesis,
  )) {
    const synthesis = synthesisById.get(synthesisId);
    if (synthesis?.unit_id === unitId) {
      materialSynthesisByUnit.set(unitId, synthesis);
    }
  }

  const searchDocuments = visibleRecords.map((record): SearchDocument => ({
    record,
    strictText: [
      record.id,
      record.title,
      ...(record.aliases || []),
      ...(record.authors || []),
      record.organization,
      record.domain,
    ].filter(Boolean).join(' ').toLocaleLowerCase(),
    compactText: [
      record.id,
      record.title,
      ...(record.aliases || []),
    ].filter(Boolean).join(' ').toLocaleLowerCase().replace(/\s+/g, ''),
  }));

  return {
    archivedModuleIds,
    rowsByGroup,
    rowsByType,
    sourceMapByModule,
    unitNoteSectionsByUnit,
    materialSynthesisByUnit,
    searchDocuments,
  };
}

export class ManifestStore {
  private readonly app: ManifestStoreHost;
  private indexes: StoreIndexes;
  ready: boolean;
  error: string;
  data: Manifest | null;
  records: ProjectionRecord[];
  byId: Map<string, ProjectionRecord>;
  contractVersion: number | null = null;
  snapshotId: string | null = null;
  constructor(app: ManifestStoreHost) {
    this.app = app;
    this.ready = false;
    this.error = '';
    this.data = null;
    // Initialised here, not only inside load()'s success branch: a failed load
    // must still leave every accessor safe to call.
    this.records = [];
    this.byId = new Map();
    this.indexes = emptyStoreIndexes();
  }

  async load() {
    try {
      if (!(await this.app.vault.adapter.exists('generated/manifest.json'))) {
        throw new Error('Projection unavailable — rebuild it to continue.');
      }
      const parsed: unknown = JSON.parse(
        await this.app.vault.adapter.read(
          'generated/manifest.json',
        ),
      );
      const generated = isRecord(parsed)
        && isRecord(parsed._generated)
        ? parsed._generated
        : null;
      const version = generated?.contract_version;
      if (version !== CONTRACT_VERSION) {
        throw new Error(
          `Unsupported manifest contract ${String(version ?? 'unknown')}; LearningOS UI requires contract ${CONTRACT_VERSION}.`,
        );
      }
      assertManifest(parsed);
      const manifest: Manifest = parsed;
      const records = (manifest.records || []).filter(
        (row) => row && typeof row === 'object',
      );
      const byId = new Map(
        records.flatMap((row) => typeof row.id === 'string' ? [[row.id, row] as const] : []),
      );
      // `stages` is the core's flat by-id index (each stage carries its
      // study_map_id/unit_id/module_id). `study_maps[].stages` stays the
      // ordering authority for rails and progress counts — index plus ordered
      // list, never two traversals of the same access path (ADR-006, fifth).
      const indexedGroups = [
        'programs',
        'modules',
        'projects',
        'units',
        'study_maps',
        'stages',
        'thematic_groups',
        'topic_packs',
        'unit_material_syntheses',
      ] as const;
      for (const group of indexedGroups) {
        for (const row of manifest[group]) {
          if (typeof row?.id === 'string') {
            byId.set(row.id, row);
          }
        }
      }
      const indexes = buildStoreIndexes(manifest, records);
      // Publish one complete store snapshot only after every contract and
      // indexing step succeeds. A reader can therefore never observe half of
      // the new manifest mixed with half of the old one.
      this.data = manifest;
      this.contractVersion = version;
      this.snapshotId = manifest._generated.snapshot_id;
      this.records = records;
      this.byId = byId;
      this.indexes = indexes;
      this.ready = true;
      this.error = '';
      return true;
    } catch (error: unknown) {
      this.ready = false;
      this.error = error instanceof Error ? error.message : String(error);
      this.data = null;
      this.records = [];
      this.byId = new Map();
      this.indexes = emptyStoreIndexes();
      this.contractVersion = null;
      this.snapshotId = null;
      return false;
    }
  }

  get(id: string): ProjectionRecord | null {
    const record = this.byId.get(id) || null;
    return record && !this.isArchivedCurriculumRecord(record)
      ? record
      : null;
  }
  of(type: string): ProjectionRecord[] {
    return [...(this.indexes.rowsByType.get(type) ?? [])];
  }
  /**
   * One null row anywhere in a projected array used to take Home down on
   * startup. Every list accessor drops non-objects at the boundary, so no view
   * has to defend itself row by row.
   */
  rows(group: string): ProjectionRecord[] {
    if (!this.data) return [];
    return [...(this.indexes.rowsByGroup.get(group) ?? [])];
  }

  private isArchivedCurriculumRecord(
    record: ProjectionRecord,
  ): boolean {
    return isArchivedRecord(
      record,
      this.indexes.archivedModuleIds,
    );
  }
  programs() { return this.rows('programs'); }
  modules() { return this.rows('modules'); }
  currentSemester(): ProjectionRecord | null {
    return this.rows('semesters')
      .filter((row) => row.status === 'current')
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))[0]
      || null;
  }
  /**
   * Modules is a semester surface, not a second subject catalogue.
   *
   * Semester records use ids such as `semester-sose-2026`, while authored
   * modules retain the shorter `sose-2026` value. Both spellings are accepted
   * at this read boundary; the UI does not infer membership from thematic
   * groups or from source usage.
   */
  currentSemesterModules(): ProjectionRecord[] {
    const semester = this.currentSemester();
    const semesterIds = new Set<string>();

    if (typeof semester?.id === 'string') {
      semesterIds.add(semester.id);
      semesterIds.add(semester.id.replace(/^semester-/, ''));
    }

    return this.modules()
      .filter((row) => {
        if (row.kind !== 'academic') return false;
        if (['completed', 'archived', 'dropped'].includes(String(row.status || ''))) return false;
        if (!semesterIds.size) return row.status === 'enrolled';
        return semesterIds.has(String(row.semester || ''));
      })
      .sort((a, b) => String(a.title || a.id || '')
        .localeCompare(String(b.title || b.id || '')));
  }
  projects() { return this.rows('projects'); }
  projectRelationships(
    projectId: string | null = null,
  ): ProjectRelationship[] {
    const rows = [...(this.data?.project_relationships || [])];
    return projectId ? rows.filter((row) => row.from_project_id === projectId) : rows;
  }
  resolveProjectAlias(id: string): string { return this.data?.project_aliases?.[id] || id; }
  projectForUnit(
    unit: ProjectionRecord | null | undefined,
  ): ProjectionRecord | null {
    const ids: string[] = Array.isArray(unit?.project_ids)
      ? unit.project_ids
      : [];
    return ids.map((id) => this.get(id)).find((row) => row?.type === 'project') || null;
  }
  thematicGroups() {
    return this.rows('thematic_groups').slice().sort((a, b) =>
      Number(a.order || 0) - Number(b.order || 0) || String(a.title || '').localeCompare(String(b.title || '')));
  }
  sources() { return this.of('source'); }
  topicPacks() {
    const rows = this.rows('topic_packs');
    return rows.length ? rows : this.of('topic-pack');
  }
  catalogues() { return this.of('collection').filter((row) => row.collection_kind !== 'topic-pack'); }
  modulesForGroup(groupId: string): ProjectionRecord[] {
    return this.modules().filter((row) => (row.thematic_group_ids || []).includes(groupId));
  }
  sourcesForGroup(groupId: string): ProjectionRecord[] {
    return this.sources().filter((row) => (row.thematic_group_ids || []).includes(groupId));
  }
  topicPacksForGroup(groupId: string): ProjectionRecord[] {
    return this.topicPacks().filter((row) => (row.thematic_group_ids || []).includes(groupId));
  }
  /** ADR-015: the Module x Concept crossing, evidence included. */
  moduleConceptEdges(): ModuleConceptEdge[] {
    return this.rows('module_concept_edges') as unknown as ModuleConceptEdge[];
  }

  /**
   * ADR-016: the authored concept relations, `context` and `source` included.
   *
   * `backlinks.concept_relations` carries `{from|to, type}` and nothing else,
   * so every reader of that table discards the two fields provenance is made
   * of. This collection is the one the Atlas reads.
   *
   * `validRelation` already enforces the closed five-field shape, so the
   * narrowing here is the store's usual boundary discipline rather than a
   * second opinion about the contract: a row missing an endpoint or a type
   * cannot be placed on a graph, and is dropped instead of rendered half-known.
   * `context` and `source` stay nullable, because null is their meaning.
   */
  relations(): RelationRecord[] {
    return this.rows('relations').flatMap((row) => {
      const from = projectedText(row.from);
      const type = projectedText(row.type);
      const to = projectedText(row.to);

      return from && type && to
        ? [{
          from,
          type,
          to,
          context: projectedText(row.context),
          source: projectedText(row.source),
        }]
        : [];
    });
  }

  units() { return this.rows('units'); }
  unitNoteSections(unitId: string): UnitNoteSection[] {
    if (!this.data) return [];
    return [...(this.indexes.unitNoteSectionsByUnit.get(unitId) ?? [])];
  }
  studyMaps() { return this.rows('study_maps'); }
  gardenEntries() { return this.rows('garden_entries'); }
  reviewItems() { return this.rows('review_items'); }
  /** The ADR-009 topic vocabulary: {id, title, domain}. `domain` groups topics
   *  for display only — it never constrains which sources may carry one. */
  topics() { return this.rows('topics'); }
  aiAction(actionId: string): ProjectionRecord | null {
    const available = this.data?.ai_actions?.available;
    return this.rows('ai_actions_available').find((row) => row.id === actionId)
      || (Array.isArray(available) ? available : []).find((row) => row?.id === actionId) || null;
  }
  aiProviders() {
    const rows = this.data?.ai_actions?.provider_adapters;
    return Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : [];
  }
  aiRequestsForTarget(targetId: string): ProjectionRecord[] {
    const rows = this.data?.ai_actions?.requests;
    return (Array.isArray(rows) ? rows : []).filter((row) => row?.target?.id === targetId);
  }
  latestAiRequest(targetId: string): ProjectionRecord | null {
    return this.aiRequestsForTarget(targetId)
      .slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null;
  }
  modulesFor(programId: string): ProjectionRecord[] { return this.modules().filter((row) => row.area_id === programId); }
  unitsFor(
    moduleId: string,
    componentId: string | null = null,
  ): ProjectionRecord[] {
    const rows = this.units().filter((row) => row.module_id === moduleId);
    return componentId ? rows.filter((row) => row.component_id === componentId) : rows;
  }
  mapForUnit(unitId: string): ProjectionRecord | null {
    const mapId = this.data?.indexes?.unit_to_study_map?.[unitId];
    return mapId ? this.get(mapId) : null;
  }
  materialSynthesisForUnit(unitId: string): UnitMaterialSynthesisV1 | null {
    if (!this.data) return null;
    return this.indexes.materialSynthesisByUnit.get(unitId) ?? null;
  }
  artifactRevision(artifactId: string): number {
    const projected = this.data?.artifact_revisions?.[artifactId];
    if (typeof projected === 'number' && Number.isInteger(projected) && projected >= 0) {
      return projected;
    }
    const embedded = this.byId.get(artifactId)?.revision;
    return typeof embedded === 'number' && Number.isInteger(embedded) && embedded >= 0
      ? embedded
      : 0;
  }
  artifactGuard(...artifactIds: Array<string | null | undefined>): Record<string, number> {
    return Object.fromEntries(
      [...new Set(artifactIds.filter((id): id is string => Boolean(id)))]
        .map((id) => [id, this.artifactRevision(id)]),
    );
  }
  /** Resolve a stage from its ID alone through the core's flat index. */
  stage(stageId: string): ProjectionRecord | null {
    const stage = this.get(stageId);
    return stage?.study_map_id ? stage : null;
  }
  sourceMap(moduleId: string): ProjectionRecord | null {
    if (!this.data) return null;
    return this.indexes.sourceMapByModule.get(moduleId) ?? null;
  }
  progress(moduleId: string): ModuleProgress {
    return this.data?.progress?.[moduleId] || {
      stages_complete: 0,
      stages_total: 0,
      units_complete: 0,
      units_total: 0,
      units_needing_map: 0,
    };
  }
  workspacesForModule(moduleId: string): ProjectionRecord[] {
    const rawIds =
      this.data?.backlinks?.module_to_workspaces?.[moduleId];
    const ids: string[] = Array.isArray(rawIds)
      ? rawIds.filter(
        (id: unknown): id is string => typeof id === 'string',
      )
      : [];
    return ids
      .map((id: string) => this.get(id))
      .filter(
        (row: ProjectionRecord | null): row is ProjectionRecord =>
          row !== null,
      );
  }
  useModules(sourceId: string): ProjectionRecord[] {
    const rawIds =
      this.data?.indexes?.source_to_modules?.[sourceId];
    const ids: string[] = Array.isArray(rawIds)
      ? rawIds.filter(
        (id: unknown): id is string =>
          typeof id === 'string',
      )
      : [];

    return ids
      .map((id: string) => this.get(id))
      .filter(
        (
          row: ProjectionRecord | null,
        ): row is ProjectionRecord =>
          row !== null
          && row.type === 'module',
      );
  }

  useUnits(sourceId: string): ProjectionRecord[] {
    const rawIds = this.data?.indexes?.source_to_units?.[sourceId];
    const ids: string[] = Array.isArray(rawIds)
      ? rawIds.filter(
        (id: unknown): id is string => typeof id === 'string',
      )
      : [];
    return ids
      .map((id: string) => this.get(id))
      .filter(
        (row: ProjectionRecord | null): row is ProjectionRecord =>
          row !== null,
      );
  }

  search(
    query: string,
    types: readonly string[] | null = null,
  ): ProjectionRecord[] {
    const words = String(query || '').toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const allowed = types ? new Set(types) : null;
    const documents = this.indexes.searchDocuments.filter(
      ({ record }) =>
        !allowed
        || (
          typeof record.type === 'string'
          && allowed.has(record.type)
        ),
    );
    if (!words.length) {
      return documents.map(({ record }) => record);
    }
    const strict = documents.filter(({ strictText }) =>
      words.every((word) => strictText.includes(word)));
    if (strict.length) return strict.map(({ record }) => record);
    const needle = words.join('');
    return documents.filter(({ compactText }) => {
      let at = 0;
      for (const char of compactText) {
        if (char === needle[at]) at += 1;
      }
      return at === needle.length;
    }).map(({ record }) => record);
  }

  related(id: string) {
    const record = this.get(id);
    if (!record) return [];
    const ids = new Set<string>();
    for (const key of ['concepts', 'sources', 'contexts', 'notes', 'program_ids',
      'module_ids', 'unit_ids', 'unit_order', 'related_module_ids']) {
      for (const value of asStrings(record[key])) ids.add(value);
    }
    for (const table of Object.values(this.data?.backlinks || {})) {
      if (isRecord(table) && Array.isArray(table[id])) {
        for (const value of table[id]) {
          if (typeof value === 'string') ids.add(value);
          else if (isRecord(value) && typeof value.from === 'string') ids.add(value.from);
        }
      }
    }
    for (const relationship of this.projectRelationships()) {
      if (relationship.from_project_id === id) ids.add(relationship.to_id);
      if (relationship.to_id === id) ids.add(relationship.from_project_id);
    }
    return [...ids].map((value) => ({ rec: this.get(value) })).filter((row) => row.rec);
  }
}
