/* LearningOS curriculum-v2 app tests. Fixture-only: never reads the live repository. */
'use strict';

const path = require('path');
const fs = require('fs');
const { makeApp, Notice, stub } = require('../harness');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(ROOT, 'fixture-vault');
const LearningOSUI = require(path.join(ROOT, 'plugin', 'main.js'));
const FIXTURE_GROUP_COUNT = JSON.parse(fs.readFileSync(
  path.join(FIXTURE, 'generated', 'manifest.json'), 'utf8')).thematic_groups.length;
const VIEW = {
  home: 'learningos-home', nav: 'learningos-nav', program: 'learningos-program',
  module: 'learningos-module', project: 'learningos-project', unit: 'learningos-unit', library: 'learningos-library',
  atlas: 'learningos-atlas', shelving: 'learningos-shelving', boundary: 'learningos-boundary',
  review: 'learningos-review', diagnostics: 'learningos-diagnostics',
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
const frame = () => new Promise((resolve) => setTimeout(resolve, 0));

const JOB_DASHBOARD_FIXTURE = {
  ok: true,
  contract: 'job-dashboard-v2',
  access: {
    scope: 'job-dashboard', read_only: true, ephemeral: true,
    excluded_from_manifest: true, excluded_from_search: true, excluded_from_ai: true,
    writes_through_gateway: true,
    stratum: {
      mode: 'read-only', worktree_writes_allowed: false, git_metadata_writes_allowed: false,
    },
    allowed_roots: ['legacy-plans', 'notes', 'papers', 'plans', 'workspace-job-deem'],
    snapshot_id: 'sha256:job-fixture-snapshot',
  },
  dashboard: {
    id: 'job-fixture', title: 'BIFOLD / DEEM', subtitle: 'Fixture confidential workspace.',
    counts: { notes: 4, learning_notes: 1, skrub_notes: 2, system_notes: 1, learning_tracks: 1, learning_stages: 2, open_tasks: 1, completed_tasks: 0, papers: 1, canonical_sources: 1 },
    workspace: {
      id: 'workspace-job-deem', title: 'Fixture Stratum job', status: 'active', standing: true,
      objective: 'Build and understand the system.',
      current_scope: [
        { label: 'required-now', text: 'Current Stratum ticket.' },
        { label: 'helpful-now', text: 'Read one Python chapter.' },
      ],
      next_action: 'Read the Skrub graph note.', open_questions: ['Which idea should become transferable?'],
      path: 'workspace-job-deem/CONTEXT.md',
    },
    notes: {
      health: { current: 0, drifting: 1, stale: 0, unverified: 0 },
      learning: [
        { id: 'job-note-joins', title: 'Join ordering', kind: 'learning', family: '', summary: 'My working model of join order.', body: 'A join order chooses the next relation.', path: 'notes/learning/job-note-joins.md', component: '', layer: '', verified_against: '', declared_status: 'draft', freshness: 'draft', revision: 1 },
      ],
      skrub: [
        { id: 'job-skrub-dag', title: 'Skrub DataOp DAG', kind: 'skrub', family: '', summary: 'How the lazy graph is built.', path: 'notes/note-skrub-dag.md', component: '', layer: 'capture', verified_against: '', declared_status: 'evolving', freshness: 'evolving' },
        { id: 'job-skrub-eval', title: 'Skrub evaluation engine', kind: 'skrub', family: '', summary: 'How the graph becomes values.', path: 'notes/note-skrub-eval.md', component: '', layer: 'capture', verified_against: '', declared_status: 'evolving', freshness: 'evolving' },
      ],
      stratum: [
        { id: 'note-stratum-extract-dataframe-op', title: 'Stratum dispatch map', kind: 'stratum', family: '', summary: 'How calls become logical operators.', path: 'notes/stratum/note-dispatch.md', component: 'stratum/optimizer/ir/_dataframe_ops.py', layer: 'logical', verified_against: 'abc123 (2026-01-01)', declared_status: 'current', freshness: 'drifting' },
      ],
      layers: [
        { id: 'capture', title: 'Capture / frontend', summary: 'building the DAG from user code', note_ids: ['job-skrub-dag', 'job-skrub-eval'] },
        { id: 'logical', title: 'Logical IR', summary: 'the operator tree', note_ids: ['note-stratum-extract-dataframe-op'] },
        { id: 'rewrites', title: 'Rewrites', summary: 'logical and cost-based optimization', note_ids: [] },
        { id: 'physical', title: 'Physical', summary: 'lowering to executable ops', note_ids: [] },
        { id: 'runtime', title: 'Runtime', summary: 'execution', note_ids: [] },
        { id: 'cross-cutting', title: 'Cross-cutting', summary: '', note_ids: [] },
      ],
    },
    learning_tracks: [{
      id: 'polars', title: 'Polars — job-grounded through Stratum', status: 'ready', cadence: 'One session per week.', horizon: 'now',
      outcome: 'Implement a Polars backend from scratch.', path: 'workspace-job-deem/inputs/Polars-Learning-Plan.md',
      completed_sessions: [], last_session_at: '', source_kind: 'structured', revision: 2,
      stages: [
        {
          id: 'stage-polars-expressions',
          number: 1,
          title: 'Expressions',
          status: 'pending',
          objective: 'Translate Series operations into expression contexts while preserving behavior.',
          done_when: ['Paired solutions cover expressions and null behavior.'],
          estimate_minutes: 90,
          exam_critical: false,
          concepts: ['concept-python'],
          scope_triage: 'required-now',
          resources: [
            { kind: 'read', label: 'Polars definitive guide — expressions', vault_path: 'LearningOS/python-polars-the-definitive-guide.pdf', scope_triage: 'required-now' },
            { kind: 'practise', label: 'Rebuild an expression in both backends', scope_triage: 'required-now' },
            { kind: 'reference', label: 'Polars expressions reference', url: 'https://docs.pola.rs/user-guide/expressions/', scope_triage: 'reference-only' },
          ],
          attachments: [], source_feedback: [],
          job_context: {
            mental_models: [
              { label: 'Pandas baseline', text: 'Series operations.' },
              { label: 'Polars mirror', text: 'Expression contexts.' },
              { label: 'Backend lesson', text: 'Preserve behavior, not method names.' },
            ],
            read_only_anchor: 'Read-only: stratum/optimizer/ir/_column_expr.py. Compare both backends.',
          },
          done: false,
        },
        {
          id: 'stage-polars-lazy-optimization',
          number: 2,
          title: 'Lazy optimization',
          status: 'pending',
          objective: 'Inspect and explain a lazy query plan before execution.',
          done_when: ['One annotated explain output identifies the optimizer changes.'],
          estimate_minutes: 90,
          exam_critical: false,
          concepts: ['concept-python'],
          scope_triage: 'required-now',
          resources: [
            { kind: 'read', label: 'Polars lazy API', url: 'https://docs.pola.rs/user-guide/lazy/', scope_triage: 'required-now' },
            { kind: 'practise', label: 'Annotate one explain output', scope_triage: 'required-now' },
          ],
          attachments: [], source_feedback: [],
          job_context: {
            mental_models: [
              { label: 'Core model', text: 'Plans are ordinary objects.' },
              { label: 'Working practice', text: 'Inspect before execution.' },
              { label: 'Job relevance', text: 'The optimizer transforms plans.' },
              { label: 'Failure mode', text: 'Do not confuse a plan with its execution.' },
            ],
            read_only_anchor: 'Read-only: stratum/optimizer/physical/_lowering.py.',
          },
          done: false,
        },
      ],
    }],
    tasks: [{ id: 'job-task-trace-join', title: 'Trace the join planner', details: 'Write down one surprise.', horizon: 'now', status: 'open', track_id: 'polars', created_at: '2026-08-15T10:00:00+02:00', updated_at: '2026-08-15T10:00:00+02:00', revision: 1 }],
    papers: [{ id: 'paper', title: 'Fixture systems paper', authors: ['A. Author'], year: 2026, pages: 8, horizon: 'now', angle: 'The architecture behind the job.', path: 'papers/paper.pdf', available: true }],
    canonical_shelf: [{ source_id: 'source-fixture-islp', title: 'Reusable software book', authors: ['B. Author'], horizon: 'later', why: 'Keep it until a concrete design problem calls for it.' }],
  },
};

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
    if (args[0] === 'job-dashboard') {
      return callback(null, JSON.stringify(JOB_DASHBOARD_FIXTURE), '');
    }
    if (envelope?.capability === 'review.prepare') return callback(null, JSON.stringify({
      state: 'proposed', summary: 'Prepared fixture.', items: [{ id: 'proposal-prepared', title: 'Prepared note', destination: 'knowledge/notes/fixture.md', selected: true }],
    }), '');
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
  VIEW,
  tick,
  frame,
  JOB_DASHBOARD_FIXTURE,
  check,
  heading,
  build,
  boot,
  result,
};
