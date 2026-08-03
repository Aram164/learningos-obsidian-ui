export class ManifestStore {
  constructor(app) {
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
      const manifest = JSON.parse(await this.app.vault.adapter.read('generated/manifest.json'));
      const version = manifest?._generated?.contract_version;
      if (version !== CONTRACT_VERSION) {
        throw new Error(`Unsupported manifest contract ${version ?? 'unknown'}; LearningOS UI requires contract ${CONTRACT_VERSION}.`);
      }
      this.data = manifest;
      this.contractVersion = version;
      this.snapshotId = manifest._generated.snapshot_id;
      this.records = (manifest.records || []).filter((row) => row && typeof row === 'object');
      this.byId = new Map(this.records.filter((row) => row?.id).map((row) => [row.id, row]));
      // `stages` is the core's flat by-id index (each stage carries its
      // study_map_id/unit_id/module_id). `study_maps[].stages` stays the
      // ordering authority for rails and progress counts — index plus ordered
      // list, never two traversals of the same access path (ADR-006, fifth).
      for (const group of ['programs', 'modules', 'units', 'study_maps', 'stages']) {
        for (const row of manifest[group] || []) if (row?.id) this.byId.set(row.id, row);
      }
      this.ready = true;
      this.error = '';
      return true;
    } catch (error) {
      this.ready = false;
      this.error = error?.message || String(error);
      return false;
    }
  }

  get(id) { return this.byId.get(id) || null; }
  of(type) { return this.records.filter((row) => row?.type === type); }
  /**
   * One null row anywhere in a projected array used to take Home down on
   * startup. Every list accessor drops non-objects at the boundary, so no view
   * has to defend itself row by row.
   */
  rows(group) {
    const value = this.data?.[group];
    return Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') : [];
  }
  programs() { return this.rows('programs'); }
  modules() { return this.rows('modules'); }
  units() { return this.rows('units'); }
  studyMaps() { return this.rows('study_maps'); }
  modulesFor(programId) { return this.modules().filter((row) => row.area_id === programId); }
  unitsFor(moduleId, componentId = null) {
    const rows = this.units().filter((row) => row.module_id === moduleId);
    return componentId ? rows.filter((row) => row.component_id === componentId) : rows;
  }
  mapForUnit(unitId) {
    const mapId = this.data?.indexes?.unit_to_study_map?.[unitId];
    return mapId ? this.get(mapId) : null;
  }
  /** Resolve a stage from its ID alone through the core's flat index. */
  stage(stageId) {
    const stage = this.get(stageId);
    return stage?.study_map_id ? stage : null;
  }
  sourceMap(moduleId) {
    return this.rows('module_source_maps').find((row) => row.module_id === moduleId) || null;
  }
  progress(moduleId) { return this.data?.progress?.[moduleId] || {}; }
  workspacesForModule(moduleId) {
    const ids = this.data?.backlinks?.module_to_workspaces?.[moduleId] || [];
    return ids.map((id) => this.get(id)).filter(Boolean);
  }
  useUnits(sourceId) {
    return (this.data?.indexes?.source_to_units?.[sourceId] || [])
      .map((id) => this.get(id)).filter(Boolean);
  }

  search(query, types = null) {
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

  related(id) {
    const record = this.get(id);
    if (!record) return [];
    const ids = new Set();
    for (const key of ['concepts', 'sources', 'contexts', 'notes', 'program_ids',
      'module_ids', 'unit_ids', 'unit_order', 'related_module_ids']) {
      for (const value of record[key] || []) ids.add(value);
    }
    for (const table of Object.values(this.data?.backlinks || {})) {
      if (table && typeof table === 'object' && Array.isArray(table[id])) {
        for (const value of table[id]) ids.add(typeof value === 'string' ? value : value.from);
      }
    }
    return [...ids].map((value) => ({ rec: this.get(value) })).filter((row) => row.rec);
  }
}
