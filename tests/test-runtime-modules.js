'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { createSourceModuleLoader } = require('./source-module-loader');

const ROOT = path.dirname(__dirname);
const FIXTURE_MANIFEST = path.join(ROOT, 'fixture-vault', 'generated', 'manifest.json');
const load = createSourceModuleLoader(ROOT);
const { ManifestStore } = load('src/manifest-store.ts');
const { GatewayClient } = load('src/gateway-client.ts');
const { gatewaySubjectSha256 } = load('src/contracts/gateway-v2.ts');
const { DraftStore, emptyUiDrafts } = load('src/application/draft-store.ts');
const { isProjectionConflict, GatewayError } = load('src/contracts/gateway-v1.ts');
const { asHealthReport } = load('src/contracts/health-report.ts');
const { asLegacyArchiveLock, asLegacyArchiveStatus } = load('src/contracts/legacy-archive.ts');
const { asMastersPlanningDashboard } = load('src/contracts/masters-planning.ts');
const { ApplicationRouter } = load('src/app/router.ts');
const { asPlanTemplate } = load('src/features/plan-template.ts');
const { enableButtonGroupKeyboardNavigation } = load('src/accessibility/button-group.ts');
const constants = load('src/constants.ts');

const SNAPSHOT = `sha256:${'1'.repeat(64)}`;
const gatewayFileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'learningos-ui-gateway-'));
const gatewayFile = path.join(gatewayFileRoot, 'approved-input.pdf');
const gatewayMap = path.join(gatewayFileRoot, 'reviewed-map.yaml');
fs.writeFileSync(gatewayFile, Buffer.from([0, 1, 2, 254, 255]));
fs.writeFileSync(gatewayMap, 'type: study-map\nid: study-map-test\n', 'utf8');
process.on('exit', () => fs.rmSync(gatewayFileRoot, { recursive: true, force: true }));

function fileDigest(filename) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex')}`;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function gatewayConfirmation(stdin, snapshotAfter = SNAPSHOT, overrides = {}) {
  const request = JSON.parse(stdin);
  return JSON.stringify({
    schema_version: 2,
    request_id: request.request_id,
    idempotency_key: request.idempotency_key,
    capability: request.capability,
    ok: true,
    replayed: false,
    transaction_id: 'tx-1',
    receipt_path: 'operations/transactions/tx-1/receipt.json',
    snapshot_after: snapshotAfter,
    result: {},
    error: null,
    ...overrides,
  });
}

const noticeLog = [];
const externalLog = [];

/*
 * Host mocks for the modules that import 'obsidian' / 'electron'.
 *
 * Deliberately minimal and faithful: each mock provides exactly what the real
 * host provides and nothing more. A mock that is more permissive than the host
 * is what produced RC-7 — see the note in tests/harness.js. These tests only
 * exercise query logic, so Modal needs a constructor and nothing else; if a
 * test ever needs contentEl it should build a real element, not have the mock
 * invent one.
 */
const hostMocks = {
  obsidian: {
    Modal: class Modal { constructor(app) { this.app = app; } },
    Notice: class Notice { constructor(message) { noticeLog.push(String(message)); } },
    setIcon: () => undefined,
  },
  electron: {
    shell: {
      openExternal: async (url) => { externalLog.push(String(url)); },
      openPath: async () => '',
    },
    webUtils: { getPathForFile: () => '' },
  },
};
const loadWithHost = createSourceModuleLoader(ROOT, hostMocks);
const { GlobalSearchModal } = loadWithHost('src/app/global-search.ts');
const { AppNavigator } = loadWithHost('src/app/navigator.ts');
const {
  ResourceOpener,
  visualStudioCodeUrl,
} = loadWithHost('src/infrastructure/resource-opener.ts');
const {
  hasDirectResourceTarget,
} = loadWithHost('src/infrastructure/resource-target.ts');
const {
  renderStageResources,
} = loadWithHost('src/features/stage-resources.ts');
const { renderModuleDetail } = loadWithHost('src/features/module/detail.ts');

let failures = 0;
let checks = 0;
async function test(name, body) {
  try {
    await body();
    checks += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL ${name}`);
    console.error(error.stack || error);
  }
}

class RuntimeElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.classes = new Set();
    this.text = '';
    this.attrs = {};
    this.listeners = {};
  }

  spawn(tag, options = {}) {
    const child = new RuntimeElement(tag);
    if (options.cls) {
      String(options.cls).split(/\s+/).filter(Boolean).forEach(
        (name) => child.classes.add(name),
      );
    }
    if (options.text !== undefined) child.text = String(options.text);
    if (options.attr) Object.assign(child.attrs, options.attr);
    this.children.push(child);
    return child;
  }

  createEl(tag, options) { return this.spawn(tag, options); }
  createDiv(options) { return this.spawn('div', options); }
  createSpan(options) { return this.spawn('span', options); }
  addClass(...names) { names.forEach((name) => this.classes.add(name)); return this; }
  setAttr(name, value) { this.attrs[name] = value; return this; }
  setAttrs(values) { Object.assign(this.attrs, values); return this; }
  setText(value) { this.text = String(value); return this; }
  removeAttribute(name) { delete this.attrs[name]; return this; }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  fire(name) {
    for (const listener of this.listeners[name] || []) {
      listener({ preventDefault() {} });
    }
  }
  find(className) {
    const matches = this.classes.has(className) ? [this] : [];
    return matches.concat(...this.children.map((child) => child.find(className)));
  }
}

function manifestApp(transform = (value) => value) {
  return {
    vault: {
      adapter: {
        exists: async () => true,
        read: async () => transform(fs.readFileSync(FIXTURE_MANIFEST, 'utf8')),
      },
    },
  };
}

function routerPlugin(settings = {}) {
  return {
    settings,
    store: { get: () => null },
    app: { workspace: {} },
    saveData: async () => undefined,
    setActiveNav: () => undefined,
  };
}

(async () => {
  console.log('\nDirect TypeScript module tests');

  await test('contract list parser accepts PyYAML and indented YAML sequences', async () => {
    const tools = await import(
      pathToFileURL(path.join(ROOT, 'scripts', 'contract-locks.mjs')).href
    );
    assert.deepEqual(
      tools.yamlStringList('keys:\n- first\n- second\nnext: value\n', 'keys'),
      ['first', 'second'],
    );
    assert.deepEqual(
      tools.yamlStringList('keys:\n  - first\n  - second\nnext: value\n', 'keys'),
      ['first', 'second'],
    );
  });

  await test('program-job uses the ordinary module detail with a visual badge', async () => {
    const root = new RuntimeElement('main');
    const module = {
      id: 'module-job-rust-engineering',
      type: 'module',
      title: 'Rust Engineering',
      kind: 'skill',
      area_id: 'program-job',
      status: 'active',
      unit_order: [],
    };
    renderModuleDetail({
      moduleId: module.id,
      tab: 'overview',
      plugin: {
        store: { get: () => module },
        nav: { back: () => undefined },
      },
      defaultTab: () => 'overview',
      headline: () => 'Active learning module',
      selectTab: () => undefined,
      renderOverview: () => undefined,
      renderUnits: () => undefined,
      renderSources: () => undefined,
      renderLogistics: () => undefined,
    }, root);
    assert.equal(root.find('los-badge').some((item) => item.text === 'Job'), true);
    assert.equal(root.find('los-tabs').length, 1,
      'Job modules keep the same module tabs as every other module');
  });

  await test('ManifestStore loads a contract-valid v8 fixture', async () => {
    const store = new ManifestStore(manifestApp());
    assert.equal(await store.load(), true);
    assert.equal(store.ready, true);
    assert.equal(store.contractVersion, 8);
    assert.ok(store.records.length > 0);
  });

  await test('ManifestStore rejects an old contract before exposing data', async () => {
    const store = new ManifestStore(manifestApp((text) =>
      text.replace('"contract_version": 8', '"contract_version": 1')));
    assert.equal(await store.load(), false);
    assert.equal(store.ready, false);
    assert.equal(store.data, null);
    assert.match(store.error, /requires contract 8/);
  });

  await test('ManifestStore rejects a v8 manifest with a different schema byte hash', async () => {
    const store = new ManifestStore(manifestApp((text) => {
      const manifest = JSON.parse(text);
      manifest._generated.schema_sha256 = `sha256:${'0'.repeat(64)}`;
      return JSON.stringify(manifest);
    }));
    assert.equal(await store.load(), false);
    assert.equal(store.ready, false);
    assert.equal(store.data, null);
    assert.match(store.error, /Unsupported manifest schema/);
  });

  await test('ManifestStore rejects an Atlas edge without evidence', async () => {
    const store = new ManifestStore(manifestApp((text) => {
      const manifest = JSON.parse(text);
      manifest.module_concept_edges[0].evidence = [];
      return JSON.stringify(manifest);
    }));
    assert.equal(await store.load(), false);
    assert.equal(store.data, null);
    assert.match(store.error, /at least one evidence item/);
  });

  await test('ManifestStore rejects an undeclared Atlas evidence field', async () => {
    const store = new ManifestStore(manifestApp((text) => {
      const manifest = JSON.parse(text);
      manifest.module_concept_edges[0].evidence[0].confidence = 1;
      return JSON.stringify(manifest);
    }));
    assert.equal(await store.load(), false);
    assert.equal(store.data, null);
    assert.match(store.error, /stage-concept evidence/);
  });

  await test('ManifestStore clears the prior snapshot after a reload failure', async () => {
    let valid = true;
    const store = new ManifestStore(manifestApp((text) => valid
      ? text
      : text.replace('"contract_version": 8', '"contract_version": 1')));
    assert.equal(await store.load(), true);
    assert.ok(store.records.length > 0);
    valid = false;
    assert.equal(await store.load(), false);
    assert.equal(store.data, null);
    assert.equal(store.snapshotId, null);
    assert.deepEqual(store.records, []);
    assert.equal(store.get('unit-fixture-sad-l04'), null);
  });

  await test('ManifestStore exposes exact artifact revision guards', async () => {
    const store = new ManifestStore(manifestApp((text) => {
      const manifest = JSON.parse(text);
      manifest.artifact_revisions['unit-fixture-sad-l04'] = 7;
      manifest.artifact_revisions['study-map-fixture-sad-l04'] = 4;
      return JSON.stringify(manifest);
    }));
    assert.equal(await store.load(), true);
    assert.deepEqual(store.artifactGuard(
      'unit-fixture-sad-l04',
      'study-map-fixture-sad-l04',
    ), {
      'unit-fixture-sad-l04': 7,
      'study-map-fixture-sad-l04': 4,
    });
  });

  await test('ManifestStore resolves approved material synthesis only through the v8 index', async () => {
    const store = new ManifestStore(manifestApp());
    assert.equal(await store.load(), true);
    const synthesis = store.materialSynthesisForUnit('unit-fixture-sad-l04');
    assert.equal(synthesis?.id, 'material-synthesis-fixture-sad-l04');
    assert.equal(synthesis?.route_assessments[0]?.review_status, 'screened');
    assert.equal(synthesis?.freshness.status, 'current');
    assert.equal(synthesis?.completeness.complete, true);
    assert.equal(synthesis?.completeness.assessed_route_count, 1);
    assert.equal(store.materialSynthesisForUnit('unit-fixture-analysis'), null);
  });

  await test('ManifestStore refuses a synthesis without its source-map revision basis', async () => {
    const store = new ManifestStore(manifestApp((text) => {
      const manifest = JSON.parse(text);
      delete manifest.unit_material_syntheses[0].basis.source_map_revision;
      return JSON.stringify(manifest);
    }));
    assert.equal(await store.load(), false);
    assert.match(store.error, /UnitMaterialSynthesisV1/);
  });

  await test('ManifestStore refuses synthesis rows without derived projection status', async () => {
    const store = new ManifestStore(manifestApp((text) => {
      const manifest = JSON.parse(text);
      delete manifest.unit_material_syntheses[0].freshness;
      return JSON.stringify(manifest);
    }));
    assert.equal(await store.load(), false);
    assert.match(store.error, /UnitMaterialSynthesisV1/);
  });

  await test('ManifestStore rejects extension fields in closed v8 record rows', async () => {
    const store = new ManifestStore(manifestApp((text) => {
      const manifest = JSON.parse(text);
      manifest.records[0].invented_projection_field = true;
      return JSON.stringify(manifest);
    }));
    assert.equal(await store.load(), false);
    assert.match(store.error, /closed v8 record union/);
  });

  await test('ManifestStore rejects malformed secondary v8 surfaces before exposing data', async () => {
    const corruptions = [
      ['academic deadlines', (manifest) => manifest.academic_deadlines.push(42)],
      ['artifact revisions', (manifest) => { manifest.artifact_revisions.bad = 'oops'; }],
      ['backlinks', (manifest) => { manifest.backlinks.invented = []; }],
      ['counts', (manifest) => { manifest.counts.invented = 1; }],
      ['Garden rows', (manifest) => manifest.garden_entries.push(42)],
      ['progress', (manifest) => { manifest.progress.bad = { stages_complete: 'oops' }; }],
      ['project aliases', (manifest) => { manifest.project_aliases.bad = 42; }],
      ['relations', (manifest) => manifest.relations.push(42)],
      ['resume pointer', (manifest) => { manifest.resume_pointer = { unit_id: 42 }; }],
      ['review rows', (manifest) => manifest.review_items.push(42)],
      ['semesters', (manifest) => manifest.semesters.push(42)],
      ['thematic groups', (manifest) => manifest.thematic_groups.push(42)],
      ['topic packs', (manifest) => manifest.topic_packs.push(42)],
      ['topics', (manifest) => manifest.topics.push(42)],
    ];
    for (const [label, corrupt] of corruptions) {
      const store = new ManifestStore(manifestApp((text) => {
        const manifest = JSON.parse(text);
        corrupt(manifest);
        return JSON.stringify(manifest);
      }));
      assert.equal(await store.load(), false, `${label} drift must be refused`);
      assert.equal(store.data, null, `${label} drift must not leave partial state`);
    }
  });

  await test('an empty contract-valid resume pointer returns Home', async () => {
    const store = new ManifestStore(manifestApp((text) => {
      const manifest = JSON.parse(text);
      manifest.resume_pointer = {};
      return JSON.stringify(manifest);
    }));
    assert.equal(await store.load(), true);
    let destination = '';
    AppNavigator.prototype.openResume.call({
      store,
      openHome: () => { destination = 'home'; },
      openUnit: () => { destination = 'unit'; },
    });
    assert.equal(destination, 'home');
  });

  await test('ManifestStore excludes prospective and boundary rows from normal v8', async () => {
    const store = new ManifestStore(manifestApp((text) => {
      const manifest = JSON.parse(text);
      manifest.programs.push({
        id: 'program-prospective-boundary', type: 'program', title: 'Prospective boundary',
        kind: 'boundary', status: 'boundary-only', default: false, semester_bound: false,
        revision: 0, path: 'prospective/boundary.yaml',
      });
      return JSON.stringify(manifest);
    }));
    assert.equal(await store.load(), false);
    assert.match(store.error, /closed v8 projection/);
  });

  await test('bounded health, archive, and prospective-planning decoders fail closed', async () => {
    const health = {
      schema_version: 1,
      type: 'health-report',
      generated_at: '2099-04-01T12:00:00Z',
      status: 'attention-required',
      checks: [{
        id: 'projection-current', status: 'warning', summary: 'Projection is stale',
        owner: 'operator', remedy: 'Rebuild the projection', details: {},
      }],
    };
    assert.equal(asHealthReport(health)?.checks[0]?.owner, 'operator');
    assert.equal(asHealthReport({ ...health, invented: true }), null);
    assert.equal(asHealthReport({ ...health, generated_at: 'not-a-date' }), null);
    assert.equal(asHealthReport({ ...health, status: 'healthy' }), null,
      'a non-ok check must never cross the boundary as a green aggregate');

    const archive = {
      schema_version: 1,
      id: 'legacy-archive-lock',
      type: 'legacy-archive-lock',
      created_at: '2099-04-01T12:00:00Z',
      entries: [{
        relative_path: 'history/fixture.md', size: 12,
        sha256: `sha256:${'a'.repeat(64)}`,
        category: 'historical', disposition: 'historical-only', canonical_targets: [],
      }],
      excluded: { count: 2, status: 'sealed-not-inspected' },
      verification: { verified_at: '2099-04-01T12:30:00Z', status: 'verified' },
    };
    assert.equal(asLegacyArchiveLock(archive)?.excluded.count, 2);
    assert.equal(asLegacyArchiveStatus({
      schema_version: 1,
      type: 'legacy-archive-status',
      available: true,
      lock: archive,
    })?.lock?.excluded.count, 2);
    assert.equal(asLegacyArchiveStatus({
      schema_version: 1,
      type: 'legacy-archive-status',
      available: false,
      lock: null,
    })?.available, false);
    assert.equal(asLegacyArchiveStatus({
      schema_version: 1,
      type: 'legacy-archive-status',
      available: false,
      lock: archive,
    }), null);
    assert.equal(asLegacyArchiveLock({
      ...archive,
      excluded: { count: 2, status: 'inspected' },
    }), null);

    const masters = {
      schema_version: 1,
      type: 'masters-planning-dashboard',
      opened_at: '2099-04-01T13:00:00Z',
      banner: 'Prospective—not current LearningOS',
      catalog: {
        schema_version: 1,
        id: 'master-planning-catalog',
        type: 'master-planning-catalog',
        revision: 3,
        updated_at: '2099-04-01T12:00:00Z',
        candidate_modules: [{
          id: 'candidate-module-fixture', title: 'Fixture module', planning_state: 'shortlist',
          privacy_class: 'academic-only', provenance: ['fixture'],
          fact_state: { status: 'verified-current', as_of: '2099-04-01', evidence: [] },
          source_ids: ['candidate-source-fixture'], unresolved_references: [],
        }],
        candidate_sources: [{
          id: 'candidate-source-fixture', title: 'Fixture source', planning_state: 'longlist',
          privacy_class: 'academic-only', provenance: ['fixture'],
          fact_state: { status: 'unverified', as_of: null, evidence: [] },
        }],
        comparison_ids: [],
      },
      comparisons: [],
      isolation: {
        normal_manifest: false, search: false, workload: false,
        recommendations: false, deadlines: false, ordinary_ai_context: false,
      },
    };
    assert.equal(asMastersPlanningDashboard(masters)?.catalog?.revision, 3);
    const selectedComparison = {
      schema_version: 1,
      id: 'candidate-comparison-fixture',
      type: 'candidate-source-comparison',
      candidate_module_id: 'candidate-module-fixture',
      status: 'approved',
      basis: {
        catalog_revision: 3,
        candidate_set_checksum: `sha256:${'b'.repeat(64)}`,
        policy: 'tiered-v1',
        request_id: 'fixture-request',
        delivery_id: 'fixture-delivery',
      },
      source_assessments: [{
        candidate_source_id: 'candidate-source-fixture',
        role: 'selected',
        review_status: 'deep-reviewed',
        concept_ids: [],
        contribution: 'Primary source.',
        assumptions: 'Current catalog.',
        notation: 'Standard notation.',
        exercise_value: 'Focused exercises.',
        best_for: 'First learning.',
        limitations: 'Prospective only.',
        evidence: [{ locator: 'Fixture section', checksum: `sha256:${'c'.repeat(64)}` }],
      }],
      comparisons: [],
    };
    assert.equal(asMastersPlanningDashboard({
      ...masters,
      comparisons: [selectedComparison],
    })?.comparisons[0]?.source_assessments[0]?.role, 'selected');
    const companionSource = {
      id: 'candidate-source-companion', title: 'Fixture companion', planning_state: 'shortlist',
      privacy_class: 'academic-only', provenance: ['fixture'],
      fact_state: { status: 'verified-current', as_of: '2099-04-01', evidence: [] },
    };
    const companionAssessment = {
      ...selectedComparison.source_assessments[0],
      candidate_source_id: 'candidate-source-companion',
      role: 'comparison',
      concept_ids: ['concept-bayes'],
      contribution: 'Companion source.',
      evidence: [{ locator: 'Companion section', checksum: `sha256:${'d'.repeat(64)}` }],
    };
    const pairwiseComparison = {
      ...selectedComparison,
      source_assessments: [{
        ...selectedComparison.source_assessments[0],
        concept_ids: ['concept-bayes'],
      }, companionAssessment],
      comparisons: [{
        left_candidate_source_id: 'candidate-source-fixture',
        right_candidate_source_id: 'candidate-source-companion',
        relation: 'contrasts',
        narrative: 'The sources use different notation.',
        concept_ids: ['concept-bayes'],
        evidence: {
          left: [{
            locator: 'Fixture section', checksum: `sha256:${'c'.repeat(64)}`,
            note: 'Probability notation.',
          }],
          right: [{
            locator: 'Companion section', checksum: `sha256:${'d'.repeat(64)}`,
            note: 'Odds notation.',
          }],
        },
      }],
    };
    const mastersWithPair = {
      ...masters,
      catalog: {
        ...masters.catalog,
        candidate_modules: [{
          ...masters.catalog.candidate_modules[0],
          source_ids: ['candidate-source-fixture', 'candidate-source-companion'],
        }],
        candidate_sources: [...masters.catalog.candidate_sources, companionSource],
      },
      comparisons: [pairwiseComparison],
    };
    const knownConcepts = new Set(['concept-bayes']);
    assert.equal(
      asMastersPlanningDashboard(mastersWithPair, knownConcepts)
        ?.comparisons[0]?.comparisons[0]?.evidence.right[0]?.note,
      'Odds notation.',
    );
    assert.equal(asMastersPlanningDashboard({
      ...mastersWithPair,
      comparisons: [{
        ...pairwiseComparison,
        comparisons: [{ ...pairwiseComparison.comparisons[0], evidence: undefined }],
      }],
    }, knownConcepts), null);
    assert.equal(asMastersPlanningDashboard(mastersWithPair, new Set()), null);
    assert.equal(asMastersPlanningDashboard({
      ...mastersWithPair,
      comparisons: [{
        ...pairwiseComparison,
        source_assessments: [pairwiseComparison.source_assessments[0], {
          ...companionAssessment,
          review_status: 'screened',
          reason: 'Only screened.',
          contribution: undefined,
          assumptions: undefined,
          notation: undefined,
          exercise_value: undefined,
          best_for: undefined,
          limitations: undefined,
          evidence: undefined,
        }],
      }],
    }, knownConcepts), null);
    assert.equal(asMastersPlanningDashboard({
      ...masters,
      comparisons: [{
        ...selectedComparison,
        source_assessments: [{
          ...selectedComparison.source_assessments[0],
          role: 'comparison',
        }],
      }],
    }), null);
    const screenedSelected = {
      ...selectedComparison.source_assessments[0],
      role: 'selected',
      review_status: 'screened',
      reason: 'Only screened.',
    };
    for (const field of [
      'contribution', 'assumptions', 'notation', 'exercise_value', 'best_for', 'limitations',
    ]) delete screenedSelected[field];
    screenedSelected.evidence = [];
    assert.equal(asMastersPlanningDashboard({
      ...masters,
      comparisons: [{
        ...selectedComparison,
        source_assessments: [screenedSelected],
      }],
    }), null);
    assert.equal(asMastersPlanningDashboard({
      ...masters,
      isolation: { ...masters.isolation, search: true },
    }), null);
    assert.equal(asMastersPlanningDashboard({
      ...masters,
      catalog: {
        ...masters.catalog,
        candidate_modules: [{ ...masters.catalog.candidate_modules[0], provenance: [] }],
      },
    }), null);
  });

  await test('a persisted unit-note draft keeps the revisions it was composed against', async () => {
    const settings = { uiDrafts: emptyUiDrafts() };
    const drafts = new DraftStore(settings, async () => undefined);
    drafts.setUnitNote('unit-a', 'Title', 'Draft text', {
      'unit-a': 3,
      'study-map-a': 8,
    });
    assert.deepEqual(drafts.getUnitNote('unit-a').expectedRevisions, {
      'unit-a': 3,
      'study-map-a': 8,
    });
    drafts.dispose();
  });

  await test('ManifestStore assertion rejects a missing required array', async () => {
    const store = new ManifestStore(manifestApp((text) => {
      const manifest = JSON.parse(text);
      delete manifest.units;
      return JSON.stringify(manifest);
    }));
    assert.equal(await store.load(), false);
    assert.match(store.error, /top-level keys do not match contract v8/);
    assert.deepEqual(store.units(), []);
  });

  await test('material angle detail is record-backed, independent, and collapsed by default', async () => {
    const root = new RuntimeElement('div');
    const exactDetail = '  Verbatim detail from the projected resource.  ';
    const resources = [
      {
        record: {
          angle: 'Short comparison angle.',
          angle_detail: exactDetail,
        },
        id: 'resource-with-detail',
        kind: 'read',
        label: 'Resource with detail',
        locator: 'Chapter 9',
        sourceId: null,
        scopeTriage: 'required-now',
        canOpen: false,
      },
      {
        record: {
          angle: 'A second comparison angle.',
          angle_detail: 'Second projected detail.',
        },
        id: 'second-resource-with-detail',
        kind: 'read',
        label: 'Second resource with detail',
        locator: 'Chapter 10',
        sourceId: null,
        scopeTriage: 'helpful-now',
        canOpen: false,
      },
      {
        record: {
          angle: 'This short angle must never be promoted into a detail.',
          locator: 'This locator must never become a detail either.',
        },
        id: 'resource-without-detail',
        kind: 'read',
        label: 'Resource without detail',
        locator: 'Appendix A',
        sourceId: null,
        scopeTriage: 'reference-only',
        canOpen: false,
      },
    ];
    renderStageResources(root, resources, {});

    const details = root.find('los-resource-angle-detail');
    const toggles = root.find('los-resource-angle-trigger');
    assert.equal(details.length, 2, 'no disclosure is synthesized without angle_detail');
    assert.equal(details[0].text, exactDetail, 'the projected detail is not rewritten');
    assert.equal(details[0].attrs.hidden, '', 'each disclosure starts collapsed');
    assert.equal(details[1].attrs.hidden, '');
    assert.equal(toggles.length, 2);
    assert.equal(toggles[0].attrs['aria-expanded'], 'false');
    assert.equal(toggles[0].attrs['aria-controls'], details[0].attrs.id);

    toggles[0].fire('click');
    assert.equal(toggles[0].attrs['aria-expanded'], 'true');
    assert.equal('hidden' in details[0].attrs, false);
    assert.equal(toggles[0].text, '▾ Why this one');
    assert.equal(details[1].attrs.hidden, '', 'opening one row does not open another');

    toggles[1].fire('click');
    assert.equal('hidden' in details[0].attrs, false);
    assert.equal('hidden' in details[1].attrs, false, 'several rows can stay open for comparison');

    toggles[0].fire('click');
    assert.equal(toggles[0].attrs['aria-expanded'], 'false');
    assert.equal(details[0].attrs.hidden, '');
    assert.equal('hidden' in details[1].attrs, false, 'each row owns its disclosure state');

    const nextStageRoot = new RuntimeElement('div');
    renderStageResources(nextStageRoot, resources, {});
    assert.ok(
      nextStageRoot.find('los-resource-angle-detail').every(
        (detail) => detail.attrs.hidden === '',
      ),
      'a newly rendered stage starts at the same collapsed density',
    );
  });

  await test('ManifestStore list accessors remain safe before load', async () => {
    const store = new ManifestStore({ vault: { adapter: {} } });
    assert.deepEqual(store.modules(), []);
    assert.deepEqual(store.projects(), []);
    assert.equal(store.get('missing'), null);
  });

  await test('archived modules and their learning records stay out of every UI lookup', async () => {
    const store = new ManifestStore(manifestApp((text) => {
      const manifest = JSON.parse(text);
      const archivedModule = {
        ...manifest.modules[0],
        id: 'module-archived-fixture',
        title: 'Archived fixture module',
        status: 'archived',
        unit_order: ['unit-archived-fixture'],
      };
      const archivedUnit = {
        ...manifest.units[0],
        id: 'unit-archived-fixture',
        title: 'Archived fixture unit',
        module_id: archivedModule.id,
      };
      manifest.modules.push(archivedModule);
      manifest.units.push(archivedUnit);
      manifest.records.push(archivedModule, archivedUnit);
      return JSON.stringify(manifest);
    }));

    assert.equal(await store.load(), true);
    assert.equal(store.get('module-archived-fixture'), null);
    assert.equal(store.get('unit-archived-fixture'), null);
    assert.equal(
      store.modules().some((row) => row.id === 'module-archived-fixture'),
      false,
    );
    assert.equal(
      store.units().some((row) => row.id === 'unit-archived-fixture'),
      false,
    );
    assert.equal(
      store.search('archived fixture').some(
        (row) => row.id === 'module-archived-fixture'
          || row.id === 'unit-archived-fixture',
      ),
      false,
    );
  });

  await test('button groups gain arrow, Home, and End navigation without changing selection', async () => {
    let listener = null;
    const controls = [0, 1, 2].map((index) => ({
      disabled: index === 1,
      focused: false,
      getAttribute: () => null,
      focus() { this.focused = true; },
    }));
    const group = {
      addEventListener: (name, callback) => { if (name === 'keydown') listener = callback; },
      querySelectorAll: () => controls,
    };
    enableButtonGroupKeyboardNavigation(group, 'horizontal');
    let prevented = false;
    listener({
      key: 'ArrowRight', target: controls[0],
      preventDefault: () => { prevented = true; },
    });
    assert.equal(prevented, true);
    assert.equal(controls[2].focused, true, 'disabled controls are skipped');
    controls.forEach((control) => { control.focused = false; });
    listener({ key: 'End', target: controls[0], preventDefault() {} });
    assert.equal(controls[2].focused, true);
    assert.ok(controls.every((control) => !('pressed' in control)),
      'focus movement must not invent selection state');
  });

  await test('GatewayClient refuses empty and unreadable write confirmations', async () => {
    const outputs = ['', 'not-json'];
    const plugin = {
      runLos: (_args, callback) => callback(null, outputs.shift(), ''),
      store: { snapshotId: SNAPSHOT },
    };
    const gateway = new GatewayClient(plugin);
    await assert.rejects(gateway.call(['stage-note']), /unconfirmed/);
    await assert.rejects(gateway.call(['stage-note']), /unreadable output/);
  });

  await test('GatewayClient accepts one confirmed JSON result and carries the snapshot guard', async () => {
    let received = null;
    let sent = null;
    const plugin = {
      runLos: (args, callback, stdin) => {
        received = args; sent = stdin;
        callback(null, gatewayConfirmation(stdin), '');
      },
      store: { snapshotId: SNAPSHOT },
    };
    const gateway = new GatewayClient(plugin);
    const result = await gateway.saveNote(
      'unit-a', 'stage-a', 'text', { 'unit-a': 3, 'study-map-a': 8 },
    );
    assert.equal(result.transaction_id, 'tx-1');
    // One write shape: a declared capability, its payload on stdin.
    assert.deepEqual(received, ['capability', 'stage.note.write', '--payload-file', '-']);
    const envelope = JSON.parse(sent);
    assert.equal(envelope.capability, 'stage.note.write');
    assert.equal(envelope.schema_version, 2);
    assert.equal(envelope.channel, 'ui');
    assert.equal(envelope.expected_snapshot, SNAPSHOT,
      'the snapshot guard must travel with the write');
    assert.deepEqual(envelope.expected_revisions, {
      'unit-a': 3,
      'study-map-a': 8,
    });
    assert.deepEqual(envelope.payload,
      { unit_id: 'unit-a', stage_id: 'stage-a', text: 'text', replace: true });
    assert.ok(envelope.request_id, 'every write is identifiable');
    assert.ok(envelope.idempotency_key, 'every write is safe to replay deliberately');
    assert.equal(envelope.approval.kind, 'direct-user-gesture');
    const subject = {
      schema_version: 2,
      capability: envelope.capability,
      channel: 'ui',
      expected_snapshot: SNAPSHOT,
      expected_revisions: envelope.expected_revisions,
      payload: envelope.payload,
    };
    const expectedSubject = `sha256:${crypto.createHash('sha256')
      .update(JSON.stringify(canonical(subject)), 'utf8').digest('hex')}`;
    assert.equal(envelope.approval.subject_sha256, expectedSubject,
      'the approval binds the exact sorted compact UTF-8 subject');
  });

  await test('Gateway approval sorting matches Python Unicode code-point order', async () => {
    const subject = {
      schema_version: 2,
      capability: 'capture.create',
      channel: 'ui',
      expected_snapshot: SNAPSHOT,
      expected_revisions: {},
      payload: { '😀': 'astral', '\ue000': 'private-use' },
    };
    assert.equal(
      await gatewaySubjectSha256(subject),
      'sha256:35ede539db12bbb697f8246dbd57be36bc5d5663ff567137a835d937e1544ed3',
    );
  });

  await test('GatewayClient refuses a success response without the matching receipt identity', async () => {
    const gateway = new GatewayClient({
      runLos: (_args, callback, stdin) => callback(null, gatewayConfirmation(stdin, SNAPSHOT, {
        request_id: 'req-from-another-write',
      }), ''),
      store: { snapshotId: SNAPSHOT },
    });
    await assert.rejects(
      gateway.captureText('keep this draft'),
      (error) => error.gatewayCode === 'UNCONFIRMED' && /draft was kept/.test(error.message),
    );
  });

  await test('GatewayClient refuses extension fields in the closed V2 success envelope', async () => {
    const gateway = new GatewayClient({
      runLos: (_args, callback, stdin) => callback(null, gatewayConfirmation(stdin, SNAPSHOT, {
        invented_confirmation_field: true,
      }), ''),
      store: { snapshotId: SNAPSHOT },
    });
    await assert.rejects(
      gateway.captureText('keep this draft'),
      (error) => error.gatewayCode === 'UNCONFIRMED' && /draft was kept/.test(error.message),
    );
  });

  await test('ordinary vault and material openers refuse symlinks outside their roots', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'learningos-resource-boundary-'));
    try {
      const vault = path.join(root, 'LearningOS', 'repository');
      const materials = path.join(root, 'LearningOS', 'materials');
      const outside = path.join(root, 'outside.pdf');
      fs.mkdirSync(vault, { recursive: true });
      fs.mkdirSync(materials, { recursive: true });
      fs.writeFileSync(outside, 'outside');
      fs.symlinkSync(outside, path.join(vault, 'outside-link.pdf'));
      fs.symlinkSync(outside, path.join(materials, 'outside-link.pdf'));
      const opener = new ResourceOpener({
        vault: {
          adapter: { getBasePath: () => vault },
          getAbstractFileByPath: () => ({ path: 'outside-link.pdf' }),
        },
        workspace: {},
      });
      assert.equal(await opener.openVaultPath('outside-link.pdf'), undefined);
      assert.match(noticeLog.at(-1), /Unsafe vault symlink/);
      assert.equal(await opener.openMaterialPath('materials/outside-link.pdf'), false);
      assert.match(noticeLog.at(-1), /Unsafe material symlink/);
      assert.equal(externalLog.some((entry) => entry.includes('outside.pdf')), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  await test('VS Code file links preserve the exact local target', async () => {
    assert.equal(
      visualStudioCodeUrl('/Users/Aram A/notes/topic #1.md'),
      'vscode://file/Users/Aram%20A/notes/topic%20%231.md',
    );
  });

  await test('direct resource targets exclude folders and missing local files', async () => {
    assert.equal(hasDirectResourceTarget({
      material_path: 'materials/aml/lecture-slides',
      material_exists: true,
    }), false);
    assert.equal(hasDirectResourceTarget({
      material_path: 'materials/aml/lecture-slides/VL 11-transformers.pdf',
      material_exists: false,
    }), false);
    assert.equal(hasDirectResourceTarget({
      material_path: 'materials/aml/lecture-slides/VL 11-transformers.pdf',
    }), false);
    assert.equal(hasDirectResourceTarget({
      material_path: 'materials/aml/lecture-slides/VL 11-transformers.pdf',
      material_exists: true,
    }), true);
    assert.equal(hasDirectResourceTarget({ url: 'javascript:alert(1)' }), false);
    assert.equal(hasDirectResourceTarget({ url: 'https://example.org/lecture-11' }), true);
  });

  await test('resource opening skips a collection folder for its exact website', async () => {
    externalLog.length = 0;
    const opener = new ResourceOpener({});
    await opener.openResource({
      material_path: 'materials/aml/lecture-slides',
      material_exists: true,
      url: 'https://example.org/aml/lecture-11',
    });
    assert.equal(externalLog.at(-1), 'https://example.org/aml/lecture-11');
    assert.equal(await opener.openResource({
      material_path: 'materials/aml/lecture-slides',
      material_exists: true,
    }), false);
  });

  await test('resource opening skips a vault collection folder for its exact website', async () => {
    externalLog.length = 0;
    const openedVault = [];
    const opener = new ResourceOpener({});
    const record = {
      vault_path: 'knowledge/attachments/lecture-collection',
      url: 'https://example.org/exact-lecture',
    };
    assert.equal(hasDirectResourceTarget(record), true);
    await opener.openResource(record, {
      openMaterialPath: () => undefined,
      openVaultPath: (value) => openedVault.push(value),
    });
    assert.deepEqual(openedVault, []);
    assert.equal(externalLog.at(-1), 'https://example.org/exact-lecture');
  });

  await test('randomized resource precedence remains file-first and fail-closed', async () => {
    let seed = 0x5eed1234;
    const next = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed;
    };
    const opener = new ResourceOpener({});
    const opened = { material: [], vault: [] };
    const ports = {
      openMaterialPath: (value) => opened.material.push(value),
      openVaultPath: (value) => opened.vault.push(value),
    };

    for (let index = 0; index < 2_048; index += 1) {
      const token = `${next().toString(16)} lecture ${index}`;
      const file = `materials/fuzz/${token}.pdf`;
      const folder = `materials/fuzz/${token}`;
      const website = `https://example.org/lecture/${index}?seed=${next()}`;
      const category = next() % 8;
      let record;
      let expected;
      if (category === 0) {
        record = { material_path: file, material_exists: true, url: website };
        expected = 'material';
      } else if (category === 1) {
        record = { material_path: file, material_exists: false, url: website };
        expected = 'url';
      } else if (category === 2) {
        record = { material_path: folder, material_exists: true, url: website };
        expected = 'url';
      } else if (category === 3) {
        record = { material_path: folder, material_exists: true };
        expected = null;
      } else if (category === 4) {
        record = { vault_path: `notes/${token}.md` };
        expected = 'vault';
      } else if (category === 5) {
        record = { vault_path: `notes/${token}` };
        expected = null;
      } else if (category === 6) {
        record = { vault_path: `material://fuzz/${token}.pdf`, url: website };
        expected = 'url';
      } else {
        record = { material_path: folder, url: `javascript:alert(${index})` };
        expected = null;
      }

      assert.equal(hasDirectResourceTarget(record), expected !== null);
      if (expected === null) continue;
      const before = {
        material: opened.material.length,
        vault: opened.vault.length,
        url: externalLog.length,
      };
      await opener.openResource(record, ports);
      assert.equal(opened.material.length - before.material, expected === 'material' ? 1 : 0);
      assert.equal(opened.vault.length - before.vault, expected === 'vault' ? 1 : 0);
      assert.equal(externalLog.length - before.url, expected === 'url' ? 1 : 0);
    }
  });

  /*
   * The core answers a refusal on stdout and leaves stderr empty. Preferring
   * stderr meant the learner saw Node's "Command failed: python …" instead of
   * the sentence explaining what was refused and why.
   */
  await test('a refusal surfaces the reason the core gave, not the process failure', async () => {
    const refusal = JSON.stringify({
      ok: false,
      error: 'los: projection conflict — authored files changed since the app loaded',
    });
    const failure = Object.assign(new Error('Command failed: python tools/los.py capability'), { code: 3 });
    const plugin = {
      runLos: (_args, callback) => callback(failure, refusal, ''),
      store: { snapshotId: SNAPSHOT },
    };
    const gateway = new GatewayClient(plugin);
    await assert.rejects(
      gateway.progress('u', 's', 'complete'),
      (error) => {
        assert.match(error.message, /projection conflict/,
          'the core’s reason must reach the learner');
        assert.doesNotMatch(error.message, /Command failed/);
        assert.equal(error.exitCode, 3, 'the exit code decides whether this is recoverable');
        assert.equal(isProjectionConflict(error), true);
        return true;
      },
    );
  });

  await test('Gateway V2 typed refusal codes survive the process boundary', async () => {
    const failure = Object.assign(new Error('capability refused'), { code: 2 });
    const gateway = new GatewayClient({
      runLos: (_args, callback, stdin) => {
        const request = JSON.parse(stdin);
        callback(failure, JSON.stringify({
          schema_version: 2,
          request_id: request.request_id,
          idempotency_key: request.idempotency_key,
          capability: request.capability,
          ok: false,
          replayed: false,
          transaction_id: null,
          receipt_path: null,
          snapshot_after: null,
          result: {},
          error: {
            code: 'STALE_SNAPSHOT',
            message: 'Reload the current projection.',
            retryable: true,
            details: {},
          },
        }), '');
      },
      store: { snapshotId: SNAPSHOT },
    });
    await assert.rejects(gateway.captureText('bounded'), (error) => {
      assert.equal(error.gatewayCode, 'STALE_SNAPSHOT');
      assert.equal(error.retryable, true);
      assert.equal(isProjectionConflict(error), true);
      assert.equal(error.message, 'Reload the current projection.');
      return true;
    });
  });

  await test('an ordinary failure with a real stderr still reports it', async () => {
    const failure = Object.assign(new Error('spawn ENOENT'), { code: 2 });
    const plugin = {
      runLos: (_args, callback) => callback(failure, '', 'python: no such interpreter'),
      store: { snapshotId: SNAPSHOT },
    };
    const gateway = new GatewayClient(plugin);
    await assert.rejects(gateway.progress('u', 's', 'complete'), (error) => {
      assert.match(error.message, /no such interpreter/);
      assert.equal(isProjectionConflict(error), false,
        'only exit 3 may trigger an automatic rebuild');
      return true;
    });
  });

  await test('every porcelain method sends one declared capability envelope', async () => {
    const calls = [];
    const plugin = {
      runLos: (args, callback, stdin) => {
        calls.push({ args, envelope: JSON.parse(stdin) });
        callback(null, gatewayConfirmation(stdin), '');
      },
      store: { snapshotId: SNAPSHOT },
    };
    const gateway = new GatewayClient(plugin);
    await gateway.progress('u', 's', 'complete');
    await gateway.sourceSelection('u', 'route-u-chapter-2', 'src', 'Chapter 2', 'Worked derivation', true);
    await gateway.feedback('u', 's', 'src', 'helpful');
    await gateway.detour('u', 's', 'a gap');
    await gateway.resolveDetour('u', 'd', 'done');
    await gateway.attach('u', 's', gatewayFile);
    await gateway.captureText('note text', 'a title');
    await gateway.captureFile(gatewayFile);
    await gateway.prepareShelving('u');
    await gateway.applyShelving('u', ['p1']);
    await gateway.saveUnitNote('u', {
      text: 'body', stageIds: ['s'], filePaths: [gatewayFile],
    });

    assert.deepEqual(calls.map((c) => c.envelope.capability), [
      'stage.progress.update', 'unit.source-selection.set', 'source.feedback.record', 'detour.create',
      'detour.resolve', 'stage.attachment.add', 'capture.create',
      'capture.create', 'review.prepare', 'review.apply', 'unit.note.append',
    ]);
    for (const call of calls) {
      assert.equal(call.args[0], 'capability', 'one call shape for every write');
      assert.deepEqual(call.args.slice(2), ['--payload-file', '-']);
      assert.equal(call.envelope.schema_version, 2);
      assert.equal(call.envelope.expected_snapshot, SNAPSHOT);
      assert.deepEqual(call.envelope.expected_revisions, {});
      assert.match(call.envelope.approval.subject_sha256, /^sha256:[a-f0-9]{64}$/);
      assert.ok(!('expected_snapshot' in call.envelope.payload),
        'the payload must not restate what the envelope owns');
      assert.ok(!('approve' in call.envelope.payload),
        'Gateway V2 approval belongs only in the envelope');
    }
    const expectedFileDigest = fileDigest(gatewayFile);
    assert.equal(calls[5].envelope.payload.file_sha256, expectedFileDigest);
    assert.equal(calls[7].envelope.payload.file_sha256, expectedFileDigest);
    assert.deepEqual(calls[10].envelope.payload.attachment_sha256, [expectedFileDigest]);
  });

  await test('the plan template is read from Core, not authored in the interface', async () => {
    const calls = [];
    const answer = {
      ok: true,
      contract: 'plan-template-v1',
      profile: 'curriculum',
      plan_template_version: 1,
      schema: 'learning-plan.schema.json',
      plan: {
        type: 'learning-plan',
        plan_template_version: 1,
        title: 'Lecture 01',
        status: 'ready',
        horizon: 'now',
        cadence: 'One stage per week',
        outcome: 'Explain and apply the lecture independently.',
        stages: [{ id: 'stage-x', number: 1, title: 'Lecture 01' }],
      },
    };
    const gateway = new GatewayClient({
      runLos: (args, callback) => {
        calls.push(args);
        callback(null, JSON.stringify(answer), '');
      },
      store: { snapshotId: SNAPSHOT },
    });

    const template = asPlanTemplate(await gateway.planTemplate('curriculum', 'Lecture 01'));
    assert.deepEqual(calls, [[
      'plan-template', 'curriculum', '--title', 'Lecture 01', '--json',
    ]], 'the query is the declared read, with no snapshot write guard');
    assert.equal(template.planTemplateVersion, 1);
    assert.equal(template.schema, 'learning-plan.schema.json');
    assert.equal(template.cadence, 'One stage per week');
    assert.equal(template.horizon, 'now');

    await gateway.planTemplate('curriculum', 'Lecture 01', {
      unitId: 'unit-demo-l01', moduleId: 'module-demo',
    });
    assert.deepEqual(calls[1], [
      'plan-template', 'curriculum', '--title', 'Lecture 01', '--json',
      '--unit-id', 'unit-demo-l01', '--module-id', 'module-demo',
    ]);
  });

  await test('a reviewed study map is applied by path through one declared capability', async () => {
    const calls = [];
    const gateway = new GatewayClient({
      runLos: (args, callback, stdin) => {
        calls.push({ args, envelope: JSON.parse(stdin) });
        callback(null, gatewayConfirmation(stdin), '');
      },
      store: { snapshotId: SNAPSHOT },
    });

    await gateway.importUnitMap('unit-amls-l01', gatewayMap);
    await gateway.importUnitMap('unit-amls-l01', gatewayMap, true);

    assert.deepEqual(calls.map((c) => c.envelope.capability),
      ['unit.map.import', 'unit.map.import']);
    for (const call of calls) {
      assert.equal(call.args[0], 'capability', 'the same write shape as every other mutation');
      assert.equal(call.envelope.expected_snapshot, SNAPSHOT);
      // The interface hands over a path plus its exact digest: Core reads the
      // approved bytes once and refuses the map whole, so the audit gate cannot
      // be half-applied or redirected after the gesture.
      assert.deepEqual(Object.keys(call.envelope.payload).sort().filter((k) => k !== 'replace'),
        ['file', 'file_sha256', 'unit_id']);
      assert.equal(call.envelope.payload.file, gatewayMap);
      assert.equal(call.envelope.payload.file_sha256, fileDigest(gatewayMap));
    }
    assert.ok(!('replace' in calls[0].envelope.payload),
      'a first import must not silently claim permission to overwrite');
    assert.equal(calls[1].envelope.payload.replace, true);
  });

  await test('a half-read plan-template answer is refused rather than trusted', async () => {
    // Each of these would otherwise produce a "template" the dialog would
    // present as authoritative while carrying none of the standard.
    for (const broken of [
      { ok: false, error: 'refused' },
      { ok: true, contract: 'plan-template-v0', profile: 'curriculum', plan_template_version: 1 },
      { ok: true, contract: 'plan-template-v1', profile: 'unknown', plan_template_version: 1 },
      { ok: true, contract: 'plan-template-v1', profile: 'job' },
    ]) {
      assert.throws(() => asPlanTemplate(broken), /plan[- ]template/i);
    }
  });

  await test('GatewayClient serializes writes and recovers after rejection', async () => {
    const gateway = new GatewayClient({ store: { snapshotId: SNAPSHOT } });
    const order = [];
    let releaseFirst;
    const gate = new Promise((resolve) => { releaseFirst = resolve; });
    const first = gateway.enqueue(async () => { order.push('first:start'); await gate; order.push('first:end'); });
    const second = gateway.enqueue(async () => { order.push('second'); throw new Error('expected'); });
    const third = gateway.enqueue(async () => { order.push('third'); });
    await Promise.resolve();
    assert.deepEqual(order, ['first:start']);
    releaseFirst();
    await first;
    await assert.rejects(second, /expected/);
    await third;
    await gateway.chain;
    assert.deepEqual(order, ['first:start', 'first:end', 'second', 'third']);
    assert.equal(gateway.isBusy, false);
  });

  await test('ApplicationRouter converts legacy leaves to product routes', async () => {
    const router = new ApplicationRouter(routerPlugin({
      lastView: { type: constants.VIEW_MODULE, state: { screen: 'list', groupId: 'group-ml', query: 'regression' } },
    }));
    assert.deepEqual(router.navigation.current,
      { name: 'module-list', groupId: 'group-ml', query: 'regression' });
  });

  await test('ApplicationRouter descriptors centralize all leaf knowledge', async () => {
    const router = new ApplicationRouter(routerPlugin({}));
    assert.deepEqual(router.descriptor({ name: 'project-detail', projectId: 'project-a' }), {
      type: constants.VIEW_PROJECT,
      state: { screen: 'detail', projectId: 'project-a', tab: 'structure' },
      nav: 'projects',
    });
    assert.deepEqual(router.descriptor({ name: 'garden' }), {
      type: constants.VIEW_GARDEN,
      state: {},
      nav: 'garden',
    });
    assert.equal(router.descriptor({ name: 'unknown' }).type, constants.VIEW_HOME);
  });

  await test('ApplicationRouter overlay state is transient and snapshot-safe', async () => {
    const router = new ApplicationRouter(routerPlugin({}));
    router.openOverlay({ kind: 'global-search', query: 'ml', filter: 'all' });
    router.updateOverlay({ query: 'systems' });
    const snapshot = router.snapshot();
    assert.equal(snapshot.overlay.query, 'systems');
    router.clearOverlay();
    assert.equal(router.snapshot().overlay, null);
    assert.equal(snapshot.overlay.query, 'systems');
  });

  /* ----------------------------------------------------------------------
   * Global search ranking and matching.
   *
   * These exercise the pure query logic directly, with no DOM. The defect
   * that made "SaD Lecture 06" return nothing was a crash in renderTabs(),
   * not a matching failure — but nothing in the suite proved the pipeline
   * returned that unit for that query shape, so the data was suspected first.
   * These tests make that question answerable without opening Obsidian.
   * -------------------------------------------------------------------- */

  async function searchStore() {
    const store = new ManifestStore(manifestApp());
    await store.load();
    return store;
  }

  function searchModal(store, query, filter = 'all') {
    const modal = new GlobalSearchModal({}, { store, router: { clearOverlay() {} } }, query);
    modal.filter = filter;
    return modal;
  }

  await test('search matches every query word, not just the first', async () => {
    const modal = searchModal(await searchStore(), 'sad lecture 02');
    const candidate = {
      id: 'unit-fixture-sad-l02', title: 'SaD Lecture 02 — Descriptive statistics',
      subtitle: 'Unit', aliases: [], authors: [],
    };
    assert.equal(modal.matches(candidate), true);
    modal.query = 'sad lecture 99';
    assert.equal(modal.matches(candidate), false, 'one absent word must reject the candidate');
  });

  await test('search reads aliases and authors, not only the title', async () => {
    const modal = searchModal(await searchStore(), 'wahrscheinlichkeitsbuch');
    const byAlias = {
      id: 'source-fixture-book', title: 'A fixture book', subtitle: 'Learning source',
      aliases: ['Wahrscheinlichkeitsbuch'], authors: [],
    };
    assert.equal(modal.matches(byAlias), true, 'German alias must be reachable');
    modal.query = 'fixture';
    assert.equal(modal.matches({ ...byAlias, aliases: [], authors: ['B. Fixture'] }), true);
  });

  await test('an empty query matches everything rather than nothing', async () => {
    const modal = searchModal(await searchStore(), '   ');
    assert.equal(modal.matches({ id: 'x', title: 'y', subtitle: '', aliases: [], authors: [] }), true);
    assert.ok(modal.rankedCandidates().length > 0);
  });

  await test('regression: a lecture query returns its unit', async () => {
    // The exact query shape that appeared to fail in Obsidian. The fixture's
    // own SaD unit stands in for SaD Lecture 06 in the live vault; adding a
    // unit here would break the fixture's atomic collection counts.
    const rows = searchModal(await searchStore(), 'SaD Lecture 02').rankedCandidates();
    assert.ok(rows.length > 0, 'the query must return at least one row');
    assert.ok(
      rows.some((row) => row.id === 'unit-fixture-sad-l02'),
      `expected unit-fixture-sad-l02 in [${rows.map((r) => r.id).join(', ')}]`,
    );
  });

  await test('ranking prefers an exact title, then a prefix, then alphabetical', async () => {
    const modal = searchModal(await searchStore(), 'sad lecture');
    const titles = modal.rankedCandidates().map((row) => row.title);
    const sorted = [...titles].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(titles, sorted, 'equal-rank rows must be alphabetical');
  });

  await test('a kind filter narrows results without changing the query', async () => {
    const store = await searchStore();
    const all = searchModal(store, '', 'all').rankedCandidates();
    const sources = searchModal(store, '', 'sources').rankedCandidates();
    assert.ok(sources.length > 0 && sources.length < all.length);
    assert.ok(sources.every((row) => row.kind === 'sources'));
  });

  await test('a query matching nothing returns an empty list, not everything', async () => {
    assert.deepEqual(
      searchModal(await searchStore(), 'zzzz-no-such-record').rankedCandidates(),
      [],
    );
  });

  /* ----------------------------------------------------------------------
   * Snapshot guard. guard() refuses rather than sending the string "null"
   * when no manifest has loaded — a guarded write with no snapshot cannot be
   * refused by the core, which is the whole point of the guard.
   * -------------------------------------------------------------------- */

  await test('the snapshot guard refuses to build without a loaded snapshot', async () => {
    const unloaded = new GatewayClient({ runLos: () => {}, store: { snapshotId: null } });
    assert.throws(() => unloaded.guard(), /no loaded snapshot/);
    const loaded = new GatewayClient({ runLos: () => {}, store: { snapshotId: SNAPSHOT } });
    assert.deepEqual(loaded.guard(), ['--expected-snapshot', SNAPSHOT]);
  });

  await test('a guarded write never reaches the CLI without a snapshot', async () => {
    let invoked = false;
    const gateway = new GatewayClient({
      runLos: () => { invoked = true; },
      store: { snapshotId: null },
    });
    assert.throws(() => gateway.saveNote('unit-a', 'stage-a', 'text'), /no loaded snapshot/);
    assert.equal(invoked, false, 'the CLI must not be invoked at all');
  });

  if (failures) {
    console.error(`\n${failures} module test failure(s)`);
    process.exit(1);
  }
  console.log(`\n${checks} direct module tests passed`);
})();
