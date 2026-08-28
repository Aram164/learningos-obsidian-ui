/* LearningOS curriculum-v2 app tests. Fixture-only: never reads the live repository. */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { makeApp, Notice, stub } = require('../harness');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(ROOT, 'fixture-vault');
const LearningOSUI = require(
  process.env.LEARNINGOS_TEST_BUNDLE || path.join(ROOT, 'plugin', 'main.js'),
);
const FIXTURE_GROUP_COUNT = JSON.parse(fs.readFileSync(
  path.join(FIXTURE, 'generated', 'manifest.json'), 'utf8')).thematic_groups.length;
const FIXTURE_SNAPSHOT = JSON.parse(fs.readFileSync(
  path.join(FIXTURE, 'generated', 'manifest.json'), 'utf8'))._generated.snapshot_id;
const GATEWAY_INPUT_ROOT = fs.mkdtempSync(
  path.join(os.tmpdir(), 'learningos-ui-dashboard-'),
);
const CAPTURE_FIXTURE_PATH = path.join(GATEWAY_INPUT_ROOT, 'handwriting.png');
const NOTE_ATTACHMENT_FIXTURE_PATH = path.join(GATEWAY_INPUT_ROOT, 'notes.png');
fs.writeFileSync(CAPTURE_FIXTURE_PATH, Buffer.from([0, 1, 2, 254, 255]));
fs.writeFileSync(NOTE_ATTACHMENT_FIXTURE_PATH, Buffer.from([255, 4, 3, 2, 1]));
process.on('exit', () => fs.rmSync(
  GATEWAY_INPUT_ROOT, { recursive: true, force: true },
));

function fileDigest(filename) {
  return `sha256:${crypto.createHash('sha256')
    .update(fs.readFileSync(filename)).digest('hex')}`;
}
const VIEW = {
  home: 'learningos-home', nav: 'learningos-nav', program: 'learningos-program',
  module: 'learningos-module', project: 'learningos-project', unit: 'learningos-unit', library: 'learningos-library',
  atlas: 'learningos-atlas', shelving: 'learningos-shelving', boundary: 'learningos-boundary',
  review: 'learningos-review', diagnostics: 'learningos-diagnostics',
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
const frame = () => new Promise((resolve) => setTimeout(resolve, 0));
async function waitFor(predicate, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) return true;
    await frame();
  }
  return predicate();
}

const HEALTH_REPORT_FIXTURE = {
  schema_version: 1,
  type: 'health-report',
  generated_at: '2099-04-01T12:00:00Z',
  status: 'healthy',
  checks: [
    {
      id: 'manifest-contract', status: 'ok', summary: 'Manifest contract is current',
      owner: 'Core', remedy: 'Rebuild the projection if this check changes.', details: {},
    },
    {
      id: 'legacy-archive', status: 'ok', summary: 'Legacy Archive lock is verified',
      owner: 'Operator', remedy: 'Review any unresolved archive disposition.', details: {},
    },
  ],
};

const LEGACY_ARCHIVE_FIXTURE = {
  schema_version: 1,
  type: 'legacy-archive-status',
  available: true,
  lock: {
    schema_version: 1,
    id: 'legacy-archive-lock',
    type: 'legacy-archive-lock',
    created_at: '2099-04-01T11:00:00Z',
    entries: [{
      relative_path: 'history/fixture.md', size: 12,
      sha256: `sha256:${'a'.repeat(64)}`,
      category: 'historical', disposition: 'historical-only', canonical_targets: [],
    }],
    excluded: { count: 1, status: 'sealed-not-inspected' },
    verification: { verified_at: '2099-04-01T12:00:00Z', status: 'verified' },
  },
};

const MASTERS_PLANNING_FIXTURE = {
  schema_version: 1,
  type: 'masters-planning-dashboard',
  opened_at: '2099-04-01T13:00:00Z',
  banner: 'Prospective—not current LearningOS',
  catalog: {
    schema_version: 1,
    id: 'master-planning-catalog',
    type: 'master-planning-catalog',
    revision: 1,
    updated_at: '2099-04-01T12:30:00Z',
    candidate_modules: [{
      id: 'candidate-module-fixture', title: 'Fixture prospective module',
      planning_state: 'shortlist', privacy_class: 'academic-only', provenance: ['fixture'],
      fact_state: { status: 'verified-current', as_of: '2099-04-01', evidence: [] },
      source_ids: ['candidate-source-fixture', 'candidate-source-fixture-companion'],
      unresolved_references: [],
    }],
    candidate_sources: [{
      id: 'candidate-source-fixture', title: 'Fixture prospective source',
      planning_state: 'longlist', privacy_class: 'academic-only', provenance: ['fixture'],
      fact_state: { status: 'unverified', as_of: null, evidence: [] },
    }, {
      id: 'candidate-source-fixture-companion', title: 'Fixture comparison source',
      planning_state: 'shortlist', privacy_class: 'academic-only', provenance: ['fixture'],
      fact_state: { status: 'verified-current', as_of: '2099-04-01', evidence: [] },
    }],
    comparison_ids: ['candidate-comparison-fixture'],
  },
  comparisons: [{
    schema_version: 1,
    id: 'candidate-comparison-fixture',
    type: 'candidate-source-comparison',
    candidate_module_id: 'candidate-module-fixture',
    status: 'approved',
    basis: {
      catalog_revision: 1,
      candidate_set_checksum: `sha256:${'b'.repeat(64)}`,
      policy: 'tiered-v1',
      request_id: 'fixture-masters-request',
      delivery_id: 'fixture-masters-delivery',
    },
    source_assessments: [{
      candidate_source_id: 'candidate-source-fixture',
      role: 'selected',
      review_status: 'deep-reviewed',
      concept_ids: ['concept-bayes'],
      contribution: 'Primary source for the prospective module.',
      assumptions: 'The catalog facts remain current.',
      notation: 'Uses the prospective module notation.',
      exercise_value: 'Includes a focused practice route.',
      best_for: 'The planned first learning pass.',
      limitations: 'Prospective and not part of current LearningOS.',
      evidence: [{
        locator: 'Fixture candidate section',
        checksum: `sha256:${'c'.repeat(64)}`,
      }],
    }, {
      candidate_source_id: 'candidate-source-fixture-companion',
      role: 'comparison',
      review_status: 'deep-reviewed',
      concept_ids: ['concept-bayes'],
      contribution: 'A contrasting explanation of the same concept.',
      assumptions: 'The catalog facts remain current.',
      notation: 'Uses odds notation.',
      exercise_value: 'Adds a worked comparison.',
      best_for: 'Checking the selected source from a second angle.',
      limitations: 'Prospective and not part of current LearningOS.',
      evidence: [{
        locator: 'Fixture companion section',
        checksum: `sha256:${'d'.repeat(64)}`,
      }],
    }],
    comparisons: [{
      left_candidate_source_id: 'candidate-source-fixture',
      right_candidate_source_id: 'candidate-source-fixture-companion',
      relation: 'contrasts',
      narrative: 'The selected source uses probability notation; the comparison uses odds.',
      concept_ids: ['concept-bayes'],
      evidence: {
        left: [{
          locator: 'Fixture candidate section',
          checksum: `sha256:${'c'.repeat(64)}`,
          note: 'Probability notation.',
        }],
        right: [{
          locator: 'Fixture companion section',
          checksum: `sha256:${'d'.repeat(64)}`,
          note: 'Odds notation.',
        }],
      },
    }],
  }],
  isolation: {
    normal_manifest: false, search: false, workload: false,
    recommendations: false, deadlines: false, ordinary_ai_context: false,
  },
};

function gatewayConfirmation(envelope, result = {}) {
  return {
    schema_version: 2,
    request_id: envelope.request_id,
    idempotency_key: envelope.idempotency_key,
    capability: envelope.capability,
    ok: true,
    replayed: false,
    transaction_id: 'tx-fixture',
    receipt_path: 'operations/transactions/tx-fixture/receipt.json',
    snapshot_after: FIXTURE_SNAPSHOT,
    result,
    error: null,
  };
}

let failures = 0;
let group = '';
function check(name, condition, detail = '') {
  if (condition) { console.log(`  ok   ${name}`); return; }
  failures += 1;
  console.log(`  FAIL [${group}] ${name}${detail ? `\n       ${detail}` : ''}`);
}
function heading(title) { group = title; console.log(`\n${title}`); }

async function build(options = {}) {
  const app = makeApp(FIXTURE);
  /* Let a test vary one projected field without forking the whole fixture:
   * the fixture stays the single description of a healthy repository, and the
   * test states exactly the one thing it is varying. */
  if (options.patchManifest) {
    const originalRead = app.vault.adapter.read;
    app.vault.adapter.read = async (file) => {
      const text = await originalRead(file);
      if (file !== 'generated/manifest.json') return text;
      const parsed = JSON.parse(text);
      options.patchManifest(parsed);
      return JSON.stringify(parsed);
    };
  }
  const calls = [];
  /* Canonical writes are capability envelopes now: the args are always
   * `capability <name> --payload-file -` and the content is on stdin, so the
   * harness must read the envelope to assert anything about a write. */
  const envelopes = [];
  calls.envelope = (capability) => envelopes.find((e) => e.capability === capability);
  calls.envelopes = envelopes;
  const plugin = new LearningOSUI(app, { id: 'learningos-ui', version: 'test' });
  plugin._data = options.settings || {};
  plugin.runLos = (args, callback, stdin) => {
    calls.push(args);
    const envelope = stdin ? JSON.parse(stdin) : null;
    if (envelope) envelopes.push(envelope);
    if (options.offline) return callback(new Error('CLI down'), '', 'offline');
    if (args[0] === 'health-report') {
      return callback(null, JSON.stringify(HEALTH_REPORT_FIXTURE), '');
    }
    if (args[0] === 'legacy-archive-status') {
      return callback(null, JSON.stringify(LEGACY_ARCHIVE_FIXTURE), '');
    }
    if (args[0] === 'masters-planning-dashboard') {
      return callback(null, JSON.stringify(MASTERS_PLANNING_FIXTURE), '');
    }
    if (envelope?.capability === 'review.prepare') return callback(null, JSON.stringify(
      gatewayConfirmation(envelope, {
        state: 'proposed', summary: 'Prepared fixture.', items: [{ id: 'proposal-prepared', title: 'Prepared note', destination: 'knowledge/notes/fixture.md', selected: true }],
      }),
    ), '');
    if (envelope) {
      return callback(null, JSON.stringify(gatewayConfirmation(envelope)), '');
    }
    return callback(null, JSON.stringify({ ok: true }), '');
  };
  app._plugin = plugin;
  await plugin.onload();
  return { app, plugin, calls };
}

async function boot(options = {}) {
  const context = await build(options);
  context.app.workspace.activeFile = { path: 'knowledge/notes/supplementary.md' };
  await context.app.workspace._ready();
  context.home = context.app.workspace.getLeavesOfType(VIEW.home)[0];
  return context;
}

function result() {
  console.log(
    failures
      ? `\n${failures} FAILURE(S)`
      : '\nall tests passed',
  );

  return failures ? 1 : 0;
}

module.exports = {
  path,
  fs,
  makeApp,
  Notice,
  stub,
  ROOT,
  FIXTURE,
  LearningOSUI,
  FIXTURE_GROUP_COUNT,
  FIXTURE_SNAPSHOT,
  CAPTURE_FIXTURE_PATH,
  NOTE_ATTACHMENT_FIXTURE_PATH,
  fileDigest,
  VIEW,
  tick,
  frame,
  waitFor,
  HEALTH_REPORT_FIXTURE,
  LEGACY_ARCHIVE_FIXTURE,
  MASTERS_PLANNING_FIXTURE,
  gatewayConfirmation,
  check,
  heading,
  build,
  boot,
  result,
};
