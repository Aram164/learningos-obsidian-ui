'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { createSourceModuleLoader } = require('./source-module-loader');

const root = path.dirname(__dirname);
const load = createSourceModuleLoader(root, {
  './constants': { CONTRACT_VERSION: 8 },
  // Contract decoding has its own exhaustive suite. This unit isolates the
  // store's post-validation indexing and atomic publication behavior.
  './contracts/manifest': { assertManifest: () => undefined },
  './projection/readers': {
    asStrings: (value) => Array.isArray(value)
      ? value.filter((item) => typeof item === 'string')
      : [],
  },
});
const { ManifestStore } = load('src/manifest-store.ts');

function fixtureManifest() {
  const activeModule = {
    id: 'module-active',
    type: 'module',
    title: 'Active module',
    status: 'enrolled',
  };
  const archivedModule = {
    id: 'module-archived',
    type: 'module',
    title: 'Archived module',
    status: 'archived',
  };
  const activeUnit = {
    id: 'unit-active',
    type: 'unit',
    title: 'Active unit',
    module_id: activeModule.id,
    note_sections: [{
      recorded_at: null,
      title: 'Session note',
      stage_ids: [],
      attachments: [],
      text: 'Exact note',
      summary: '',
    }],
  };
  const archivedUnit = {
    id: 'unit-archived',
    type: 'unit',
    title: 'Archived unit',
    module_id: archivedModule.id,
    note_sections: [{
      recorded_at: null,
      title: 'Preserved note',
      stage_ids: [],
      attachments: [],
      text: 'Preserved history',
      summary: '',
    }],
  };
  const source = {
    id: 'source-linear-algebra',
    type: 'source',
    title: 'Linear Algebra',
    aliases: ['Matrix handbook'],
    authors: ['Ada Example'],
    organization: 'Learning Press',
    domain: 'mathematics',
  };
  const archivedSource = {
    id: 'source-archived',
    type: 'source',
    title: 'Archived source',
    module_id: archivedModule.id,
  };
  const activeSourceMap = {
    id: 'source-map-active',
    type: 'module-source-map',
    module_id: activeModule.id,
  };
  const archivedSourceMap = {
    id: 'source-map-archived',
    type: 'module-source-map',
    module_id: archivedModule.id,
  };
  const synthesis = {
    id: 'material-synthesis-active',
    type: 'unit-material-synthesis',
    unit_id: activeUnit.id,
  };

  return {
    _generated: { contract_version: 8, snapshot_id: 'snapshot-test' },
    records: [
      activeModule,
      archivedModule,
      activeUnit,
      archivedUnit,
      source,
      archivedSource,
    ],
    programs: [],
    modules: [activeModule, archivedModule],
    projects: [],
    units: [activeUnit, archivedUnit],
    study_maps: [],
    stages: [],
    thematic_groups: [],
    topic_packs: [],
    unit_material_syntheses: [synthesis],
    module_source_maps: [activeSourceMap, archivedSourceMap],
    relations: [
      {
        from: 'concept-logistic-regression',
        type: 'requires',
        to: 'concept-conditional-probability',
        context: 'the link function is a conditional probability',
        source: 'note-stats-l04',
      },
      // Documented and undocumented rows are both valid; the accessor must
      // keep null as null rather than inventing a citation.
      {
        from: 'concept-gradient-descent',
        type: 'builds-on',
        to: 'concept-derivative',
        context: null,
        source: null,
      },
      // Unplaceable on a graph: dropped at the boundary, never half-rendered.
      { from: 'concept-orphan', type: 'requires', to: '', context: null, source: null },
    ],
    indexes: {
      unit_to_material_synthesis: {
        [activeUnit.id]: synthesis.id,
        'unit-mismatch': synthesis.id,
      },
      unit_to_study_map: {},
      source_to_modules: {},
      source_to_units: {},
    },
    backlinks: {},
    project_relationships: [],
    progress: {},
    artifact_revisions: {},
    project_aliases: {},
  };
}

(async () => {
  let manifest = fixtureManifest();
  const app = {
    vault: {
      adapter: {
        exists: async () => true,
        read: async () => JSON.stringify(manifest),
      },
    },
  };
  const store = new ManifestStore(app);

  assert.equal(await store.load(), true);
  assert.deepEqual(store.modules().map((row) => row.id), ['module-active']);
  assert.deepEqual(store.of('source').map((row) => row.id), ['source-linear-algebra']);
  assert.equal(store.get('unit-archived'), null);
  assert.equal(store.sourceMap('module-active')?.id, 'source-map-active');
  assert.equal(store.sourceMap('module-archived'), null);
  assert.equal(store.unitNoteSections('unit-active')[0]?.text, 'Exact note');
  assert.equal(
    store.unitNoteSections('unit-archived')[0]?.text,
    'Preserved history',
    'note lookup preserves the complete validated collection boundary',
  );
  assert.equal(
    store.materialSynthesisForUnit('unit-active')?.id,
    'material-synthesis-active',
  );
  assert.equal(store.materialSynthesisForUnit('unit-mismatch'), null);
  assert.deepEqual(
    store.search('ada example', ['source']).map((row) => row.id),
    ['source-linear-algebra'],
  );
  assert.deepEqual(
    store.search('lnralg').map((row) => row.id),
    ['source-linear-algebra'],
    'compact subsequence fallback remains available',
  );

  assert.deepEqual(
    store.relations(),
    [
      {
        from: 'concept-logistic-regression',
        type: 'requires',
        to: 'concept-conditional-probability',
        context: 'the link function is a conditional probability',
        source: 'note-stats-l04',
      },
      {
        from: 'concept-gradient-descent',
        type: 'builds-on',
        to: 'concept-derivative',
        context: null,
        source: null,
      },
    ],
    'relations() preserves context and source, and drops only unplaceable rows',
  );

  const firstModules = store.modules();
  firstModules.length = 0;
  assert.deepEqual(
    store.modules().map((row) => row.id),
    ['module-active'],
    'callers receive a fresh result array, not the cached index array',
  );

  manifest = { ...fixtureManifest(), indexes: {} };
  assert.equal(await store.load(), false);
  assert.equal(store.data, null);
  assert.deepEqual(store.modules(), []);
  assert.deepEqual(store.search('linear'), []);
  assert.equal(store.sourceMap('module-active'), null);
  assert.equal(store.materialSynthesisForUnit('unit-active'), null);
  assert.deepEqual(store.unitNoteSections('unit-active'), []);
  assert.deepEqual(store.relations(), []);

  console.log('ManifestStore indexes OK: cached reads preserve filtering, search, and atomic failure semantics.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
