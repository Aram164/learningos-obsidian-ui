import { CONTRACT_VERSION } from './constants';
import { assertManifestV2 } from './contracts/manifest-v2';
import type {
  ManifestV2,
  ProjectionRecord,
  UnitNoteSectionV2,
} from './contracts/manifest-v2';

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value);
}

interface ManifestStoreHost {
  vault: {
    adapter: {
      exists(path: string): Promise<boolean>;
      read(path: string): Promise<string>;
    };
  };
}

export class ManifestStore {
  private readonly app: ManifestStoreHost;
  ready: boolean;
  error: string;
  data: ManifestV2 | null;
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
      assertManifestV2(parsed);
      const manifest: ManifestV2 = parsed;
      this.data = manifest;
      this.contractVersion = version;
      this.snapshotId = manifest._generated.snapshot_id;
      this.records = (manifest.records || []).filter((row) => row && typeof row === 'object');
      this.byId = new Map(this.records.filter((row) => row?.id).map((row) => [row.id, row]));
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
      ] as const;
      for (const group of indexedGroups) {
        for (const row of manifest[group]) {
          if (typeof row?.id === 'string') {
            this.byId.set(row.id, row);
          }
        }
      }
      this.ready = true;
      this.error = '';
      return true;
    } catch (error: unknown) {
      this.ready = false;
      this.error = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  get(id: string): ProjectionRecord | null {
    return this.byId.get(id) || null;
  }
  of(type: string): ProjectionRecord[] {
    return this.records.filter((row) => row?.type === type);
  }
  /**
   * One null row anywhere in a projected array used to take Home down on
   * startup. Every list accessor drops non-objects at the boundary, so no view
   * has to defend itself row by row.
   */
  rows(group: string): ProjectionRecord[] {
    const value = this.data?.[group];
    return Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') : [];
  }
  programs() { return this.rows('programs'); }
  modules() { return this.rows('modules'); }
  projects() { return this.rows('projects'); }
  projectRelationships(
    projectId: string | null = null,
  ): ProjectionRecord[] {
    const rows = this.rows('project_relationships');
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
  topicPacks() { return this.rows('topic_packs').length ? this.rows('topic_packs') : this.of('topic-pack'); }
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
  units() { return this.rows('units'); }
  unitNoteSections(unitId: string): UnitNoteSectionV2[] {
    const sections = this.get(unitId)?.note_sections;
    return Array.isArray(sections) ? sections : [];
  }
  studyMaps() { return this.rows('study_maps'); }
  gardenEntries() { return this.rows('garden_entries'); }
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
  /** Resolve a stage from its ID alone through the core's flat index. */
  stage(stageId: string): ProjectionRecord | null {
    const stage = this.get(stageId);
    return stage?.study_map_id ? stage : null;
  }
  sourceMap(moduleId: string): ProjectionRecord | null {
    return this.rows('module_source_maps').find((row) => row.module_id === moduleId) || null;
  }
  progress(moduleId: string): ProjectionRecord {
    return this.data?.progress?.[moduleId] || {};
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
    const rows = this.records.filter((row) => row && (!allowed || allowed.has(row.type)));
    if (!words.length) return rows;
    const strict = rows.filter((row) => {
      const hay = [row.id, row.title, ...(row.aliases || []), ...(row.authors || []),
        row.organization, row.domain].filter(Boolean).join(' ').toLocaleLowerCase();
      return words.every((word) => hay.includes(word));
    });
    if (strict.length) return strict;
    const needle = words.join('');
    return rows.filter((row) => {
      const hay = [row.id, row.title, ...(row.aliases || [])].filter(Boolean)
        .join(' ').toLocaleLowerCase().replace(/\s+/g, '');
      let at = 0;
      for (const char of hay) if (char === needle[at]) at += 1;
      return at === needle.length;
    });
  }

  related(id: string) {
    const record = this.get(id);
    if (!record) return [];
    const ids = new Set<string>();
    for (const key of ['concepts', 'sources', 'contexts', 'notes', 'program_ids',
      'module_ids', 'unit_ids', 'unit_order', 'related_module_ids']) {
      for (const value of record[key] || []) ids.add(value);
    }
    for (const table of Object.values(this.data?.backlinks || {})) {
      if (table && typeof table === 'object' && Array.isArray(table[id])) {
        for (const value of table[id]) ids.add(typeof value === 'string' ? value : value.from);
      }
    }
    for (const relationship of this.projectRelationships()) {
      if (relationship.from_project_id === id) ids.add(relationship.to_id);
      if (relationship.to_id === id) ids.add(relationship.from_project_id);
    }
    return [...ids].map((value) => ({ rec: this.get(value) })).filter((row) => row.rec);
  }
}
