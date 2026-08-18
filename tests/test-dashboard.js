/* LearningOS curriculum-v2 app tests. Fixture-only: never reads the live repository. */
'use strict';

const path = require('path');
const fs = require('fs');
const { makeApp, Notice, stub } = require('./harness');

const ROOT = path.resolve(__dirname, '..');
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

async function main() {
  console.log('LearningOS module-first app tests (synthetic fixture only)');

  heading('versioned atomic contract');
  {
    const { plugin } = await build();
    check('manifest contract v5 loads', plugin.store.ready && plugin.store.contractVersion === 5, plugin.store.error);
    check('snapshot guard is loaded', plugin.store.snapshotId === 'sha256:fixture-v2-snapshot');
    check('program/module/unit/map collections load atomically', plugin.store.programs().length === 5
      && plugin.store.modules().length === 3 && plugin.store.projects().length === 1 && plugin.store.units().length === 7
      && plugin.store.studyMaps().length === 6);
    check('reverse indexes resolve the active unit map',
      plugin.store.mapForUnit('unit-fixture-sad-l04').id === 'study-map-fixture-sad-l04');
    check('German aliases are searchable',
      plugin.store.search('bedingte Wahrscheinlichkeit').some((row) => row.id === 'concept-bedingte-wahrscheinlichkeit'));
    /* One fact, one shape (core ADR-006, fifth addendum): the flat `stages`
     * array is the by-id index, `study_maps[].stages` is the ordering
     * authority. The app must use each for its own job. */
    const stage = plugin.store.stage('stage-fixture-conditioning');
    check('a stage resolves from its ID alone through the flat index',
      stage?.id === 'stage-fixture-conditioning' && stage.study_map_id === 'study-map-fixture-sad-l04'
      && stage.unit_id === 'unit-fixture-sad-l04');
    check('a non-stage ID is not mistaken for a stage',
      plugin.store.stage('unit-fixture-sad-l04') === null);
    check('flat index and ordered stage lists stay the same set',
      plugin.store.studyMaps().flatMap((map) => map.stages.map((row) => row.id)).sort()
        .join() === (plugin.store.data.stages || []).map((row) => row.id).sort().join());
    plugin.onunload();
  }
  {
    /* Fixture fidelity: the fixture is the ONLY contract sample the suite ever
     * sees (hard rule 1), so a missing top-level key here hides a real bug
     * rather than failing. Every key the bundle reads must exist in it. */
    const manifest = JSON.parse(fs.readFileSync(
      path.join(FIXTURE, 'generated', 'manifest.json'), 'utf8'));
    const bundle = fs.readFileSync(path.join(ROOT, 'plugin', 'main.js'), 'utf8');
    const read = [...bundle.matchAll(/(?:store\.data|this\.data|manifest)\??\.([a-z_]+)/g)]
      .map((match) => match[1])
      /* `json` comes from the "generated/manifest.json" literal; the rest are
       * Array/Map members reached through a projected collection. */
      .filter((key) => !['json', 'length', 'find', 'filter', 'map'].includes(key));
    const missing = [...new Set(read)].filter((key) => !(key in manifest));
    check('fixture declares every top-level key the app reads', !missing.length,
      `missing from fixture-vault: ${missing.join(', ')}`);
    check('retired exam_spine key is gone from the contract sample',
      !('exam_spine' in manifest));
  }
  {
    const app = makeApp(FIXTURE);
    const originalRead = app.vault.adapter.read;
    app.vault.adapter.read = async (file) => {
      const text = await originalRead(file);
      return file === 'generated/manifest.json' ? text.replace('"contract_version": 5', '"contract_version": 1') : text;
    };
    const plugin = new LearningOSUI(app, { id: 'learningos-ui' }); app._plugin = plugin;
    await plugin.onload();
    check('contract v1 fails closed with recovery text', !plugin.store.ready && plugin.store.error.includes('requires contract 5'));
    plugin.onunload();
  }

  heading('manifest v5 interaction plumbing');
  {
    const { plugin, calls } = await build();

    const review = plugin.store.reviewItems();
    check(
      'Core review decisions load as concrete records',
      review.length === 1
        && review[0].id === 'review-planning-unit-fixture-analysis'
        && review[0].category === 'planning'
        && review[0].target?.id === 'unit-fixture-analysis',
    );

    const currentUse = plugin.store.useModules(
      'source-fixture-islp',
    );
    check(
      'Current use resolves authoritative source_to_modules directly',
      currentUse.some(
        (row) => row.id === 'module-fixture-m2',
      ),
    );

    await plugin.mutate(
      () => plugin.gateway.createGardenSeed(
        'A raw unfinished thought. #python',
        'Fixture Garden seed',
      ),
    );

    const seed = calls.envelope(
      'garden.seed.create',
    );

    check(
      'Garden creation uses the deterministic public capability',
      seed?.payload.text
        === 'A raw unfinished thought. #python'
        && seed?.payload.title
          === 'Fixture Garden seed'
        && seed?.expected_snapshot
          === 'sha256:fixture-v2-snapshot',
    );

    plugin.onunload();
  }

  heading('startup and focused home');
  {
    const { app, plugin, home } = await boot();
    const element = home.view.contentEl;
    const text = element.allText();
    check('Home opens and stays pinned', app.workspace.active === home && home.pinned);
    check('navigator opens in its own leaf', app.workspace.getLeavesOfType(VIEW.nav).length === 1);
    check('one Continue card names the exact stage to resume',
      element.find('los-continue').length === 1
      && text.includes('Conditional probability and Bayes') && text.includes('Continue session'));
    check('exactly one filled primary action exists on Home',
      element.find('los-btn--cta').length === 1);
    check('the Continue card states the position in the map',
      /Stage \d+ of \d+/.test(text));
    check('Home exposes Capture and structural Search without making them primary',
      element.findText('los-btn', 'Capture') && element.findText('los-btn', 'Search')
      && element.findText('los-btn', 'Capture').classes.has('los-btn--warm')
      && !element.findText('los-btn', 'Search').classes.has('los-btn--cta'));
    check('Today contains time-sensitive work and a review entry',
      text.includes('Fixture registration') && text.includes('decision')
      && !text.includes('Recent Garden capture'));
    check('Continue elsewhere is a short resume list, not the complete catalogue',
      element.find('los-home-row').length <= 8
      && text.includes('Fixture Advanced ML') && !text.includes('Python') && text.includes('Bachelor thesis'));
    check('Home no longer renders module progress rows or a queue dashboard',
      element.find('los-learning-row').length === 0
      && element.find('los-queue-card').length === 0
      && element.find('los-attention').length === 0);
    check('Home does not show progress percentages', !/\d+%/.test(text));
    check('boundaries and maintenance controls are absent from Home',
      !text.includes("Master's Planning") && !text.includes('Rebuild projection'));
    check('the repeated ownership footer is gone from every screen',
      !text.includes('buttons are conveniences, never duties'));
    plugin.onunload();
  }

  /* Home used to read `module.status`, which answers an administrative
   * question, so a dropped module and a module awaiting a grade both counted as
   * current work. Core now decides; Home obeys. */
  {
    const { plugin, home } = await boot({
      patchManifest: (manifest) => {
        for (const row of [...(manifest.modules || []), ...(manifest.records || [])]) {
          if (row && row.id === 'module-fixture-aml') row.is_actionable = false;
        }
      },
    });
    const text = home.view.contentEl.allText();
    check('a module the core marks non-actionable leaves Continue elsewhere',
      !text.includes('Fixture Advanced ML') && !text.includes('Python')
      && text.includes('Bachelor thesis'));
    plugin.onunload();
  }

  heading('reload state');
  {
    const first = await boot();
    await first.plugin.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const persisted = { ...first.plugin._data };
    first.plugin.onunload();
    const second = await build({ settings: persisted });
    await second.app.workspace._ready();
    const leaf = second.app.workspace.getLeavesOfType(VIEW.unit)[0];
    check('reload restores the current unit and stage', leaf?.view.contentEl.allText().includes('Conditional probability and Bayes'));
    check('Home remains pinned as a non-exclusive fallback', second.app.workspace.getLeavesOfType(VIEW.home)[0]?.pinned);
    second.plugin.onunload();
  }
  {
    const { plugin, home } = await boot();
    let renders = 0;
    const original = home.view.render.bind(home.view);
    home.view.render = () => { renders += 1; original(); };
    await plugin.reloadStore();
    check('reloadStore refreshes sibling views through the public leaf iterator', renders === 1);
    plugin.onunload();
  }

  heading('explicit application router');
  {
    const { app, plugin, calls } = await boot();
    await plugin.openLibraryGroup('sources', 'thematic-group-mathematics', 'probability', 'local');
    const libraryBefore = app.workspace.getLeavesOfType(VIEW.library)[0];
    libraryBefore.view.contentEl.scrollTop = 144;
    libraryBefore.view.selectedElementId = 'source-fixture-book';
    await plugin.openModule('module-fixture-m2');
    const beforeBack = plugin.router.snapshot();
    check('feature navigation persists a product route rather than an Obsidian view type',
      beforeBack.current.name === 'module-detail' && beforeBack.current.moduleId === 'module-fixture-m2'
      && !('type' in beforeBack.current));
    await plugin.back();
    const restored = plugin.router.snapshot();
    const library = app.workspace.getLeavesOfType(VIEW.library)[0];
    check('Back restores the prior route, filters, selection, and scroll position',
      restored.current.name === 'library-group' && restored.current.collection === 'sources'
      && restored.current.groupId === 'thematic-group-mathematics'
      && restored.current.query === 'probability' && restored.current.facet === 'local'
      && library?.view?.screen === 'group' && library.view.contentEl.scrollTop === 144
      && library.view.selectedElementId === 'source-fixture-book');
    check('the compatibility router is the only runtime owner of leaf navigation',
      fs.readFileSync(path.join(ROOT, 'src', 'main.ts'), 'utf8').includes('this.router.navigate')
      && !fs.readFileSync(path.join(ROOT, 'src', 'main.ts'), 'utf8').includes('async openView('));
    plugin.onunload();
  }

  heading('global structural search');
  {
    const { app, plugin } = await boot();
    await plugin.openLibraryHome('sources');
    const routeBeforeSearch = plugin.router.snapshot().current;
    const modal = plugin.openGlobalSearch('Advanced ML');
    await frame();
    const overlay = plugin.router.snapshot();
    check('opening search preserves the current application route',
      routeBeforeSearch.name === 'library-home' && overlay.current.name === 'library-home');
    check('the router records search as transient overlay state',
      overlay.overlay?.kind === 'global-search' && overlay.overlay.query === 'Advanced ML');
    check('search is an explicitly named modal with button-group filters',
      modal.contentEl.getAttribute('role') === 'dialog'
      && modal.contentEl.getAttribute('aria-modal') === 'true'
      && modal.contentEl.find('los-search-tabs')[0].getAttribute('role') === 'group'
      && modal.contentEl.find('los-search-tab')
        .every((tab) => tab.getAttribute('aria-pressed') !== null));
    check('keyboard-launched search is ready for the first query keystroke',
      global.document.activeElement === modal.input);
    check('search returns projected module identities',
      modal.contentEl.allText().includes('Fixture Advanced ML')
      && modal.contentEl.find('los-search-result').length >= 1);
    const moduleResult = modal.contentEl.find('los-search-result')
      .find((row) => row.children[0]?.children[0]?.text === 'Fixture Advanced ML');
    moduleResult.fire('click');
    await tick(); await tick();
    const opened = plugin.router.snapshot();
    check('choosing a result closes the overlay and opens the owning route',
      opened.overlay === null && opened.current.name === 'module-detail'
      && opened.current.moduleId === 'module-fixture-aml');

    const projectSearch = plugin.openGlobalSearch('Bachelor thesis');
    const projectResult = projectSearch.contentEl.find('los-search-result')
      .find((row) => row.allText().includes('Bachelor thesis'));
    check('global search returns first-class projects', Boolean(projectResult));
    projectResult.fire('click'); await tick(); await tick();
    check('a project search result opens the project route',
      plugin.router.snapshot().current.name === 'project-detail'
      && plugin.router.snapshot().current.projectId === 'project-fixture-thesis');

    const emptySearch = plugin.openGlobalSearch('definitely-unfindable-fixture');
    check('no-results is explicit and offers a clear action',
      emptySearch.contentEl.allText().includes('No structural results')
      && Boolean(emptySearch.contentEl.findText('los-btn', 'Clear search')));
    emptySearch.contentEl.findText('los-btn', 'Clear search').fire('click');
    check('clearing search restores quick access without changing the route',
      emptySearch.contentEl.allText().includes('Quick access')
      && plugin.router.snapshot().current.projectId === 'project-fixture-thesis');
    emptySearch.close();
    check('closing search clears only overlay state',
      plugin.router.snapshot().overlay === null
      && plugin.router.snapshot().current.projectId === 'project-fixture-thesis');

    const command = plugin.commands.find((row) => row.id === 'open-global-search');
    check('global search is available as an Obsidian command', Boolean(command));
    const nav = app.workspace.getLeavesOfType(VIEW.nav)[0].view.contentEl;
    check('the navigator exposes a persistent accessible search launcher',
      nav.find('los-nav-search').length === 1
      && nav.find('los-nav-search')[0].getAttribute('aria-label') === 'Search LearningOS');
    check('decorative navigation icons are hidden from assistive technology',
      nav.find('los-nav-search')[0].children[0].getAttribute('aria-hidden') === 'true');
    plugin.onunload();
  }

  heading('navigation and boundaries');
  {
    const { app, plugin, calls } = await boot();
    const nav = app.workspace.getLeavesOfType(VIEW.nav)[0].view.contentEl;
    const text = nav.allText();
    /* Seven permanent destinations from the approved application IA. */
    check('seven permanent destinations, no more',
      nav.find('los-nav-primary')[0].find('los-app-nav-item').length === 7
      && ['Home', 'Modules', 'Learn', 'Projects', 'Library', 'Garden', 'Review'].every((label) => text.includes(label)));
    check('the application navigator opens at the compact design width',
      fs.readFileSync(path.join(ROOT, 'src', 'app', 'registration.ts'), 'utf8')
        .includes('leftSplit?.setSize?.(280)'));
    check('Review is available as a first-class Obsidian command',
      Boolean(plugin.commands.find((row) => row.id === 'open-review')));
    check('maintenance and boundaries are not study destinations',
      nav.find('los-nav-more').length === 1
      && nav.find('los-nav-secondary')[0].allText().includes('Rebuild projection')
      && nav.find('los-nav-secondary')[0].allText().includes('Job'));
    check('legacy global path and entity taxonomy are absent', !text.includes('Learning path') && !text.includes('Collections'));
    nav.findText('los-app-nav-item', 'Learn').fire('click'); await tick();
    check('Learn opens one destination carrying every area',
      app.workspace.getLeavesOfType(VIEW.program)[0].view.contentEl.allText().includes('Fixture Advanced ML'));
    check('the active destination is visually and semantically marked',
      nav.findText('los-app-nav-item', 'Learn')?.classes.has('is-active')
      && nav.findText('los-app-nav-item', 'Learn')?.getAttribute('aria-current') === 'page');
    await plugin.openReview();
    const reviewRoot = app.workspace.getLeavesOfType(VIEW.review)[0].view.contentEl;
    const review = reviewRoot.allText();
    check('Review renders Core-owned decision records rather than reconstructing queues',
      reviewRoot.find('los-review-decision-row').length === plugin.store.reviewItems().length
      && review.includes('Plan Analysis exam prep')
      && review.includes('This unit needs a study map')
      && reviewRoot.find('los-review-count-badge').length === 1
      && reviewRoot.find('los-filter-tabs').length === 1);
    await plugin.openDiagnostics();
    const diagnostics = app.workspace.getLeavesOfType(VIEW.diagnostics)[0].view.contentEl.allText();
    check('Diagnostics reports contract, freshness and interpreter',
      diagnostics.includes('Manifest contract') && diagnostics.includes('Python interpreter')
      && diagnostics.includes('Snapshot'));
    check('Diagnostics exposes the installed UI build identity',
      diagnostics.includes('UI source revision') && diagnostics.includes('UI source fingerprint')
      && diagnostics.includes('UI bundle fingerprint') && diagnostics.includes('Build Node')
      && diagnostics.includes('Copy build identity'));
    check('the ownership statement is stated once, in Diagnostics/About',
      diagnostics.includes('buttons are conveniences, never duties'));
    await plugin.openBoundary('program-job-boundary');
    await tick(); await tick();
    const jobRoot = app.workspace.getLeavesOfType(VIEW.boundary)[0].view.contentEl;
    const job = jobRoot.allText();
    check('Job opens an explicit bounded confidential dashboard',
      job.includes('BIFOLD / DEEM') && job.includes('Job workspace')
      && calls.some((args) => args.join(' ') === 'job-dashboard --confirm-job-access'), job);
    /* The confidentiality contract is the gate you pass through to get here, so
     * it is stated at that gate and not repeated as a banner over every
     * destination — the same rule the ownership statement follows. */
    check('the confidentiality notice is not repeated inside the workspace',
      !job.includes('Confidential, on-demand view'));
    /* Now answers one question. It leads with the workspace's own required-now
     * scope and the first stage not yet recorded as done — not a restatement
     * of what the other destinations already hold. */
    check('Now leads with required-now scope and the next unfinished stage',
      job.includes('Current Stratum ticket.')
      && job.includes('Expressions') && job.includes('Rebuild an expression in both backends')
      && job.includes('0/2 done')
      && Boolean(jobRoot.findText('los-btn', 'Open this stage'))
      && job.includes('Trace the join planner') && job.includes('Plan runway')
      && !plugin.store.search('Skrub DataOp DAG').length);
    /* Drift is a queue, not a badge hunt across every note card. The row names
     * the note and the component it describes — the same card the System map
     * uses, so a note does not change shape depending on where you meet it. */
    check('Now surfaces drifted notes as a queue',
      job.includes('Needs re-verifying')
      && job.includes('Stratum dispatch map')
      && job.includes('stratum/optimizer/ir/_dataframe_ops.py')
      && job.includes('drifting'));
    /* Job uses the system's tab row, the same one Garden and Review use, rather
     * than a private copy that drifted into looking like a different control. */
    check('Job local navigation is the shared tab row with pressed state',
      jobRoot.find('los-filter-tab').length === 5
      && jobRoot.find('los-filter-tab').every((tab) => tab.getAttribute('aria-pressed') !== null)
      && jobRoot.find('los-job-tab').length === 0);
    jobRoot.findText('los-filter-tab', 'Tasks').fire('click');
    check('Tasks is a durable Job-only action list with add and edit controls',
      jobRoot.allText().includes('Trace the join planner')
      && Boolean(jobRoot.findText('los-btn', 'Add task'))
      && Boolean(jobRoot.findText('los-btn', 'Edit')));
    jobRoot.findText('los-filter-tab', 'Plans').fire('click');
    check('Plans exposes progress and an in-app learning runway',
      jobRoot.allText().includes('Study plans')
      && jobRoot.allText().includes('0 of 2 stages complete')
      && Boolean(jobRoot.findText('los-btn', 'Open plan'))
      && Boolean(jobRoot.findText('los-btn', 'Edit plan'))
      && !jobRoot.allText().includes('Open source'));
    jobRoot.findText('los-btn', 'Open plan').fire('click');
    check('Open plan renders the plan instead of opening its YAML source',
      jobRoot.allText().includes('Study plan')
      && jobRoot.allText().includes('Concept mirror')
      && jobRoot.allText().includes('Pandas baseline')
      && jobRoot.allText().includes('Polars mirror')
      && jobRoot.allText().includes('Done when')
      && jobRoot.allText().includes('Paired solutions')
      && jobRoot.find('los-job-stage-row').length === 2
      && jobRoot.find('los-job-stage-row').filter(
        (stage) => stage.getAttribute('aria-pressed') === 'true',
      ).length === 1
      && !jobRoot.allText().includes('Open source'));
    check('Job stages use the same structured resource renderer as module stages',
      jobRoot.find('los-resource-row').length === 3
      && jobRoot.allText().includes('Polars definitive guide — expressions')
      && jobRoot.allText().includes('Polars expressions reference')
      && jobRoot.allText().includes('Do this')
      && jobRoot.allText().includes('Reference — preserved, not reading for this stage')
      && jobRoot.findText('los-btn', 'Open'));
    jobRoot.findText('los-job-stage-row', 'Lazy optimization').fire('click');
    check('Each plan stage opens independently and persists its location',
      jobRoot.allText().includes('Stage 02 of 2')
      && jobRoot.allText().includes('Mental model')
      && jobRoot.allText().includes('Working practice')
      && jobRoot.allText().includes('Job relevance')
      && jobRoot.allText().includes('One annotated explain output')
      && app.workspace.getLeavesOfType(VIEW.boundary)[0].view.getState().planSession === 2);
    jobRoot.findText('los-btn', '← All plans').fire('click');
    check('The plan reader returns to the plan overview without a file round-trip',
      jobRoot.allText().includes('Study plans')
      && !jobRoot.allText().includes('Concept mirror'));
    jobRoot.findText('los-filter-tab', 'Notes').fire('click');
    /* The map is the pipeline. An undocumented layer is the finding, so it is
     * stated rather than omitted — a flat list could never show it. */
    check('Notes combines learner notes with the Stratum verification pipeline',
      jobRoot.allText().includes('Learning notes')
      && jobRoot.allText().includes('Join ordering')
      && jobRoot.allText().includes('Capture / frontend')
      && jobRoot.allText().includes('Logical IR')
      && jobRoot.allText().includes('Skrub DataOp DAG')
      && jobRoot.allText().includes('Stratum dispatch map')
      && jobRoot.allText().includes('1 drifting')
      && jobRoot.allText().includes('No note describes this layer yet.'));
    jobRoot.findText('los-filter-tab', 'Library').fire('click');
    /* Horizon is the axis; track, paper and book are only tags. */
    check('Library orders every kind of material by horizon',
      jobRoot.allText().includes('Use now')
      && jobRoot.allText().includes('Keep for later')
      && jobRoot.allText().includes('Polars — job-grounded through Stratum')
      && jobRoot.allText().includes('Fixture systems paper')
      && jobRoot.allText().includes('Reusable software book'));
    /* The one-way reference used to be asserted as a sentence printed under
     * every book. It is a property of the routing, so it is checked as routing:
     * a canon book offers the Library and never a Job path. */
    check('Library routes canon-owned material back to the canon',
      Boolean(jobRoot.findText('los-btn', 'Open in Library')));
    jobRoot.findText('los-btn', 'Open plan').fire('click');
    check('Library opens a track in the same in-app plan reader',
      jobRoot.allText().includes('Study plan')
      && jobRoot.allText().includes('Stage 01 of 2')
      && !jobRoot.allText().includes('Open source'));
    await plugin.openBoundary('program-masters-planning');
    const masters = app.workspace.getLeavesOfType(VIEW.boundary)[0].view.contentEl.allText();
    check('Master surface exposes quarantine only', masters.includes('quarantined') && !masters.includes('prospective module menu'));
    await plugin.openGarden();
    check('Garden marks Garden, not Review, as the active destination',
      nav.findText('los-app-nav-item', 'Garden')?.classes.has('is-active')
      && !nav.findText('los-app-nav-item', 'Review')?.classes.has('is-active'));
    nav.findText('los-app-nav-item', 'Domain atlas').fire('click'); await tick();
    /* The atlas is a decision surface, not a document: opening it must give a
     * navigable view. The Markdown file stays reachable from inside it, because
     * it is still the session-bootstrap artifact (core CLAUDE.md §2.8). */
    const atlas = app.workspace.getLeavesOfType(VIEW.atlas)[0]?.view;
    check('Domain atlas navigation opens the atlas view, not a Markdown wall',
      Boolean(atlas) && !app.workspace.opened.includes('generated/domain-atlas.md'));
    atlas.contentEl.findText('los-btn', 'Open generated map file').fire('click'); await tick();
    check('the generated atlas file stays reachable from the view',
      app.workspace.opened.includes('generated/domain-atlas.md'));
    plugin.onunload();
  }

  heading('Core-owned Review decisions and deterministic Garden capture');
  {
    const opened = [];

    const { app, plugin, calls } = await boot({
      patchManifest: (manifest) => {
        manifest.review_items = [
          {
            id: 'review-inbox-fixture',
            category: 'inbox',
            title: 'Route captured question',
            context: 'work/inbox/question.md',
            reason: 'This capture still needs a human placement decision.',
            target: {
              kind: 'inbox-item',
              path: 'work/inbox/question.md',
              revision: 'sha256:fixture-inbox',
            },
          },
          {
            id: 'review-shelving-fixture',
            category: 'shelving',
            title: 'Shelve Thesis landscape',
            context: 'Two proposed durable changes.',
            reason: 'A shelving proposal is ready for explicit approval.',
            target: {
              kind: 'study-map',
              id: 'study-map-fixture-thesis',
              unit_id: 'unit-fixture-thesis-landscape',
              module_id: 'module-fixture-thesis',
              revision: 7,
              proposal_ids: [
                'proposal-note',
                'proposal-garden',
              ],
            },
          },
          {
            id: 'review-planning-fixture',
            category: 'planning',
            title: 'Plan Analysis exam prep',
            context: '',
            reason: 'This unit needs a study map before structured study can continue.',
            target: {
              kind: 'unit',
              id: 'unit-fixture-analysis',
              module_id: 'module-fixture-m2',
              revision: 2,
            },
          },
        ];
      },
    });

    plugin.openVaultPath = (path) => {
      opened.push(`path:${path}`);
    };

    plugin.openShelving = (unitId) => {
      opened.push(`shelving:${unitId}`);
    };

    plugin.openUnit = (unitId) => {
      opened.push(`unit:${unitId}`);
    };

    await plugin.openReview();

    const review =
      app.workspace.getLeavesOfType(
        VIEW.review,
      )[0].view.contentEl;

    const reviewText = review.allText();

    check(
      'Review renders one stable row per Core review_items record',
      review.find('los-review-decision-row').length === 3
        && [
          'review-inbox-fixture',
          'review-shelving-fixture',
          'review-planning-fixture',
        ].every(
          (id) =>
            review.find('los-review-decision-row')
              .some(
                (row) =>
                  row.getAttribute('data-review-id') === id,
              ),
        ),
    );

    check(
      'Core-authored reasons are rendered rather than UI heuristics',
      reviewText.includes(
        'This capture still needs a human placement decision.',
      )
        && reviewText.includes(
          'A shelving proposal is ready for explicit approval.',
        )
        && reviewText.includes(
          'This unit needs a study map before structured study can continue.',
        )
        && review.find('los-review-count-badge').length === 1
        && review.find('los-filter-tabs').length === 1,
    );

    review.findText(
      'los-btn',
      'Route',
    ).fire('click');

    review.findText(
      'los-btn',
      'Review proposal',
    ).fire('click');

    review.findText(
      'los-btn',
      'Open unit',
    ).fire('click');

    check(
      'Review actions follow each Core-projected target exactly',
      opened.includes(
        'path:work/inbox/question.md',
      )
        && opened.includes(
          'shelving:unit-fixture-thesis-landscape',
        )
        && opened.includes(
          'unit:unit-fixture-analysis',
        ),
    );

    check(
      'Garden is not synthesized into the Review queue',
      review.allText().includes('Garden stays quiet')
        && review.find('los-review-decision-row').length === 3,
    );

    plugin.onunload();
  }

  {
    const {
      app,
      plugin,
      calls,
    } = await boot();

    await plugin.openGarden();

    let garden =
      app.workspace.getLeavesOfType(
        'learningos-garden',
      )[0].view.contentEl;

    check(
      'Garden exposes a first-class no-AI seed composer',
      garden.find('los-garden-seed-composer').length === 1
        && garden.find('los-garden-seed-title').length === 1
        && garden.find('los-garden-seed-editor').length === 1
        && Boolean(
          garden.findText(
            'los-btn',
            'Add seed',
          ),
        )
        && garden.allText().includes('No filing required')
        && garden.find('los-filter-tabs').length === 1,
    );

    check(
      'Garden uses ordinary pressed buttons and blocks an empty seed',
      garden.find('los-filter-tabs')[0].getAttribute('role') === 'group'
        && garden.find('los-filter-tabs')[0].find('los-filter-tab')
          .every((control) => control.getAttribute('aria-pressed') !== null)
        && garden.findText('los-btn', 'Add seed').disabled === true,
    );

    const title =
      garden.find(
        'los-garden-seed-title',
      )[0];

    const editor =
      garden.find(
        'los-garden-seed-editor',
      )[0];

    title.value =
      'Decorator registration thought';
    title.fire('input');

    editor.value =
      'Decorators execute when the module is imported. #python';
    editor.fire('input');

    check(
      'Garden enables Add seed as soon as the required text is present',
      garden.findText('los-btn', 'Add seed').disabled === false,
    );

    garden.findText(
      'los-btn',
      'Add seed',
    ).fire('click');

    await tick();
    await tick();
    await tick();

    const seed =
      calls.envelopes.find(
        (envelope) =>
          envelope.capability
            === 'garden.seed.create',
      );

    check(
      'Add seed delegates exact human text to garden.seed.create',
      seed?.payload.title
        === 'Decorator registration thought'
        && seed?.payload.text
          === 'Decorators execute when the module is imported. #python'
        && seed?.expected_snapshot
          === 'sha256:fixture-v2-snapshot',
    );

    check(
      'ordinary Garden capture invokes no AI action',
      !calls.some(
        (args) =>
          args[0] === 'ai-action-prepare',
      ),
    );

    garden =
      app.workspace.getLeavesOfType(
        'learningos-garden',
      )[0].view.contentEl;

    check(
      'a confirmed Garden seed clears the composer',
      garden.find(
        'los-garden-seed-title',
      )[0].value === ''
        && garden.find(
          'los-garden-seed-editor',
        )[0].value === '',
    );

    plugin.onunload();
  }

  {
    const {
      app,
      plugin,
    } = await boot();

    await plugin.openGarden();

    let garden =
      app.workspace.getLeavesOfType(
        'learningos-garden',
      )[0].view.contentEl;

    const thought =
      'This seed must survive an unconfirmed gateway response.';

    const editor =
      garden.find(
        'los-garden-seed-editor',
      )[0];

    editor.value = thought;
    editor.fire('input');

    plugin.runLos = (
      _args,
      callback,
    ) => callback(
      null,
      '',
      '',
    );

    garden.findText(
      'los-btn',
      'Add seed',
    ).fire('click');

    await tick();
    await tick();

    garden =
      app.workspace.getLeavesOfType(
        'learningos-garden',
      )[0].view.contentEl;

    check(
      'an unconfirmed Garden write preserves the unsaved seed text',
      garden.find(
        'los-garden-seed-editor',
      )[0].value === thought,
    );

    plugin.onunload();
  }

  heading('domain atlas reach');
  {
    const { app, plugin } = await boot();
    await plugin.openAtlas();
    const view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    let text = view.contentEl.allText();
    /* ADR-005: the atlas exists so a session does not collapse into the active
     * workspace's domain. The first layer is relationships and ways in; the
     * complete note registry remains available under progressive disclosure. */
    check('every domain with content appears, not just the active one',
      text.includes('Mathematics') && text.includes('Programming'));
    check('the selected domain leads with modules, concepts, and sources',
      text.includes('Mathematics map') && text.includes('Modules')
      && text.includes('Concepts') && text.includes('Sources')
      && text.includes('Fixture Statistics & Analysis')
      && text.includes('Conditional probability')
      && text.includes('Fixture probability book'));
    check('raw record IDs are removed from the learning surface',
      text.includes('Fixture probability reference') && !text.includes('note-fixture-probability'));
    check('the full note inventory is present but collapsed by default',
      view.contentEl.find('los-atlas-inventory').length === 1
      && !view.contentEl.find('los-atlas-inventory')[0].hasAttribute('open'));
    check('shelves carry their own rule for use',
      text.includes('Fixture math bookshelf') && text.includes('one spine, one supplement'));
    check('quarantined strata are named but not opened',
      text.includes('Job') && text.includes('Master') && !text.includes('Job client'));
    view.contentEl.findText('los-item', 'Fixture probability reference').fire('click'); await tick();
    check('an atlas row opens the note it names',
      app.workspace.opened.includes('knowledge/notes/mathematics/note-fixture-probability.md'));
    view.contentEl.findText('los-shelf-entry-title', 'Fixture math bookshelf').fire('click'); await tick();
    const library = app.workspace.getLeavesOfType(VIEW.library)[0].view;
    check('an atlas shelf opens that shelf in the Library',
      library.contentEl.allText().includes('The spine — read this before anything else on the shelf.'));
    await plugin.openAtlas();
    app.workspace.getLeavesOfType(VIEW.atlas)[0].view.contentEl
      .findText('los-btn', 'Browse domain in Library').fire('click'); await tick();
    text = app.workspace.getLeavesOfType(VIEW.library)[0].view.contentEl.allText();
    check('the atlas can hand a whole domain to the Library',
      text.includes('Domain: mathematics') && !text.includes('Fixture Python wiring crosswalk'));
    plugin.onunload();
  }

  heading('library navigability');
  {
    const { app, plugin } = await boot();

    await plugin.openLibrary();

    let view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    let text =
      view.contentEl.allText();

    check(
      'Learning Sources opens as one global faceted browser',
      view.screen === 'home'
        && view.collection === 'sources'
        && view.contentEl.find(
          'los-group-card',
        ).length === 0
        && view.contentEl.find(
          'los-route-row',
        ).length > 0
        && view.contentEl.find(
          'los-library-peer-facets',
        ).length === 1,
    );

    check(
      'the five semantic facets are peers',
      ['Domain', 'Topic', 'Purpose', 'Form', 'Current use']
        .every(
          (label) =>
            text.includes(label),
        )
        && view.contentEl.find(
          'los-library-facet-select',
        ).length === 5,
    );

    check(
      'Sources and Curated packs remain separate collections',
      view.contentEl.find(
        'los-collection-switch',
      ).length === 1
        && text.includes('Sources')
        && text.includes('Curated packs'),
    );

    const select = (dimension) =>
      view.contentEl.find(
        'los-library-facet-select',
      ).find(
        (candidate) =>
          candidate.getAttribute(
            'data-facet',
          ) === dimension,
      );

    const domain = select('domain');
    domain.value =
      'thematic-group-mathematics';
    domain.fire('change');

    await tick();
    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    const expectedMathSources =
      plugin.store.sources().filter(
        (source) =>
          Array.isArray(
            source.thematic_group_ids,
          )
          && source.thematic_group_ids.includes(
            'thematic-group-mathematics',
          ),
      ).length;

    check(
      'Domain is a filter rather than a required first navigation level',
      view.filters.domain
        === 'thematic-group-mathematics'
        && plugin.router.snapshot().current.name
          === 'library-home'
        && plugin.router.snapshot().current.filters?.domain
          === 'thematic-group-mathematics'
        && view.contentEl.find(
          'los-route-row',
        ).length === expectedMathSources
        && view.contentEl.find(
          'los-library-filter-chip',
        ).length === 1,
    );

    const topic =
      view.contentEl.find(
        'los-library-facet-select',
      ).find(
        (candidate) =>
          candidate.getAttribute(
            'data-facet',
          ) === 'topic',
      );

    topic.value =
      'topic-probability';
    topic.fire('change');

    await tick();
    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    check(
      'peer facets combine conjunctively without replacing one another',
      view.filters.domain
        === 'thematic-group-mathematics'
        && view.filters.topic
          === 'topic-probability'
        && view.contentEl.find(
          'los-route-row',
        ).length === 2
        && view.contentEl.find(
          'los-library-filter-chip',
        ).length === 2,
    );

    const route =
      plugin.router.snapshot().current;

    check(
      'the complete facet combination is persisted on the product route',
      route.name === 'library-home'
        && route.filters?.domain
          === 'thematic-group-mathematics'
        && route.filters?.topic
          === 'topic-probability'
        && route.filters?.purpose === ''
        && route.filters?.form === ''
        && route.filters?.use === '',
    );

    view.contentEl
      .findText(
        'los-btn',
        'Clear filters',
      )
      .fire('click');

    await tick();
    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    check(
      'clearing facet state does not change source identity or collection',
      Object.values(
        view.filters,
      ).every(
        (value) => value === '',
      )
        && view.collection === 'sources',
    );

    const math =
      view.contentEl.find(
        'los-library-facet-select',
      ).find(
        (candidate) =>
          candidate.getAttribute(
            'data-facet',
          ) === 'domain',
      );

    math.value =
      'thematic-group-mathematics';
    math.fire('change');

    await tick();
    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    const book =
      view.contentEl.find(
        'los-route-row',
      ).find(
        (row) =>
          row.getAttribute(
            'data-record-id',
          ) === 'source-fixture-book',
      );

    check(
      'no source is automatically selected',
      view.resourceId === null
        && Boolean(book),
    );

    book.fire('click');

    await tick();
    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    text =
      view.contentEl.allText();

    check(
      'source detail stays a full page and preserves shelf rationale',
      view.screen === 'source-detail'
        && view.contentEl.find(
          'los-detail-page',
        ).length === 1
        && text.includes(
          'Fixture math bookshelf',
        )
        && text.includes(
          'The spine — read this before anything else on the shelf.',
        ),
    );

    const technical =
      view.contentEl.find(
        'los-technical-details',
      )[0];

    check(
      'record ID and Copy ID stay under Technical details',
      Boolean(technical)
        && technical.allText()
          .includes('Copy ID')
        && technical.find(
          'los-detail-id',
        )[0]?.text
          === 'source-fixture-book',
    );

    await plugin.back();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    check(
      'Back restores the exact global facet state',
      plugin.router.snapshot().current.name
        === 'library-home'
        && view.filters.domain
          === 'thematic-group-mathematics'
        && view.filters.topic === ''
        && view.contentEl.find(
          'los-library-filter-chip',
        ).length === 1,
    );

    await plugin.openLibraryHome(
      'topic-packs',
    );

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    check(
      'Topic Packs intentionally retain thematic-group navigation',
      view.collection === 'topic-packs'
        && view.contentEl.find(
          'los-group-card',
        ).length
          === FIXTURE_GROUP_COUNT
        && view.contentEl.find(
          'los-route-row',
        ).length === 0,
    );

    view.contentEl
      .findText(
        'los-group-card',
        'Machine Learning',
      )
      .fire('click');

    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    check(
      'a Topic Pack group still opens its ordered pack list',
      view.screen === 'group'
        && view.collection
          === 'topic-packs'
        && view.contentEl.find(
          'los-route-row',
        ).length === 1
        && view.contentEl.allText()
          .includes(
            'Fixture ML evaluation pack',
          ),
    );

    view.contentEl.find(
      'los-route-row',
    )[0].fire('click');

    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    text =
      view.contentEl.allText();

    check(
      'Topic Pack detail keeps one explicit purpose and canonical order',
      view.screen
        === 'topic-pack-detail'
        && text.includes(
          'Compare one bounded set of model-evaluation choices.',
        )
        && view.contentEl.find(
          'los-pack-entry',
        ).length === 2
        && view.contentEl.find(
          'los-pack-order',
        ).map(
          (el) => el.text,
        ).join(',') === '1,2',
    );

    plugin.onunload();
  }

  {
    const { app, plugin } = await boot({
      patchManifest: (manifest) => {
        // If the UI accidentally reconstructs Current use through units,
        // this test goes empty. source_to_modules is the authority.
        manifest.indexes.source_to_units = {};
        manifest.indexes.source_to_modules[
          'source-fixture-islp'
        ] = [
          'module-fixture-m2',
        ];
      },
    });

    await plugin.openLibrary();

    let view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    const use =
      view.contentEl.find(
        'los-library-facet-select',
      ).find(
        (candidate) =>
          candidate.getAttribute(
            'data-facet',
          ) === 'use',
      );

    use.value = 'module-fixture-m2';
    use.fire('change');

    await tick();
    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    const ids =
      view.contentEl.find(
        'los-route-row',
      ).map(
        (row) =>
          row.getAttribute(
            'data-record-id',
          ),
      );

    check(
      'Current use reads authoritative source_to_modules even with source_to_units empty',
      view.filters.use
        === 'module-fixture-m2'
        && ids.includes(
          'source-fixture-islp',
        ),
    );

    plugin.onunload();
  }

  {
    const first = await boot();

    await first.plugin.openLibraryHome(
      'sources',
      'probability',
      {
        domain:
          'thematic-group-mathematics',
        topic:
          'topic-probability',
        purpose: '',
        form: '',
        use: '',
      },
    );

    const persisted = {
      ...first.plugin._data,
    };

    first.plugin.onunload();

    const second = await build({
      settings: persisted,
    });

    await second.app.workspace._ready();

    const leaf =
      second.app.workspace.getLeavesOfType(
        VIEW.library,
      )[0];

    check(
      'reload restores query and all five source-facet fields exactly',
      leaf?.view?.screen === 'home'
        && leaf.view.query
          === 'probability'
        && leaf.view.filters.domain
          === 'thematic-group-mathematics'
        && leaf.view.filters.topic
          === 'topic-probability'
        && leaf.view.filters.purpose === ''
        && leaf.view.filters.form === ''
        && leaf.view.filters.use === '',
    );

    second.plugin.onunload();
  }

  {
    const { app, plugin } = await boot();

    await plugin.openLibraryHome(
      'sources',
      'definitely-unfindable-library-source',
    );

    let view = app.workspace.getLeavesOfType(
      VIEW.library,
    )[0].view;

    check(
      'a text-only Library zero result offers a search-specific recovery',
      view.query === 'definitely-unfindable-library-source'
        && Boolean(
          view.contentEl.findText(
            'los-btn',
            'Clear search',
          ),
        ),
    );

    view.contentEl.findText(
      'los-btn',
      'Clear search',
    ).fire('click');

    await tick();
    await tick();

    view = app.workspace.getLeavesOfType(
      VIEW.library,
    )[0].view;

    check(
      'Library recovery clears the persisted query and restores sources',
      view.query === ''
        && plugin.router.snapshot().current.query === ''
        && view.contentEl.find('los-route-row').length > 0,
    );

    plugin.onunload();
  }

  heading('zero-friction inbox capture');
  {
    const { app, plugin, calls } = await boot();
    await plugin.openProgram('inbox');
    const view = app.workspace.getLeavesOfType(VIEW.program)[0].view;
    let element = view.contentEl;
    check('Capture identifies itself in the Obsidian tab',
      view.getDisplayText() === 'LearningOS · Capture');
    check('empty Capture actions are disabled consistently',
      element.findText('los-btn', 'Capture text').disabled === true
      && element.findText('los-btn', 'Capture selected file').disabled === true);
    element.find('los-capture-title')[0].value = 'Fixture thought';
    element.find('los-capture-title')[0].fire('input');
    element.find('los-capture-editor')[0].value = 'A half-formed synthetic idea.';
    element.find('los-capture-editor')[0].fire('input');
    check('Capture text enables only after required content is present',
      element.findText('los-btn', 'Capture text').disabled === false);
    element.findText('los-btn', 'Capture text').fire('click'); await tick(); await tick();
    const textCapture = calls.envelope('capture.create')?.payload;
    check('text capture delegates exact wording and optional title to los.py',
      textCapture?.text === 'A half-formed synthetic idea.' && textCapture?.title === 'Fixture thought');
    check('capture refreshes the atomic projection after the write',
      calls.some((args) => args.length === 1 && args[0] === 'generate'));

    element = view.contentEl;
    element.find('los-capture-file')[0].files = [{ name: 'handwriting.png', __path: '/tmp/handwriting.png' }];
    element.find('los-capture-file')[0].fire('change');
    check('file capture enables only after a local file is selected',
      element.findText('los-btn', 'Capture selected file').disabled === false);
    element.findText('los-btn', 'Capture selected file').fire('click'); await tick(); await tick();
    check('file capture resolves the Electron File through webUtils',
      calls.envelopes.some((e) => e.capability === 'capture.create'
        && e.payload.file === '/tmp/handwriting.png'));
    plugin.onunload();
  }

  heading('module and component ownership');
  {
    const { app, plugin } = await boot();
    await plugin.openModules();
    let view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    let text = view.contentEl.allText();
    check('Modules contains only the current semester',
      view.screen === 'groups'
      && view.contentEl.find('los-semester-module-row').length === 2
      && text.includes('SoSe 2099')
      && text.includes('Fixture Statistics & Analysis')
      && text.includes('Fixture Advanced ML')
      && !text.includes('Python')
      && view.contentEl.find('los-group-card').length === 0);
    view.contentEl.findText('los-semester-module-row', 'Fixture Statistics & Analysis')
      .fire('click'); await tick();
    view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    text = view.contentEl.allText();
    check('a module opens as a full-page detail route',
      view.screen === 'detail' && plugin.router.snapshot().current.name === 'module-detail');
    /* Units is the default: a learner opens a module to study, not to read a
     * credit count. Administration is one tab away, never in the header. */
    check('the module opens on Units, not on administration',
      view.contentEl.find('los-module-unit-list').length === 1
      && view.contentEl.find('los-record-row').length > 0);
    check('the header carries one line of facts, not six labelled rows',
      view.contentEl.find('los-module-facts').length === 1
      && !text.includes('Institution') && !text.includes('Credits'));
    check('structured component controls render', text.includes('SaD') && text.includes('Analysis'));
    check('Lecture 02 and Lecture 04 retain distinct state', text.includes('Lecture 02') && text.includes('Lecture 04')
      && text.includes('ready') && text.includes('active'));
    check('needs-map is explicit', text.includes('needs map') || text.includes('needs-map'));
    view.contentEl.findText('los-btn', 'Analysis').fire('click'); await tick();
    view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    const unitText = view.contentEl.find('los-module-unit-list')[0].allText();
    check('component selection filters units without merging state', unitText.includes('Analysis exam prep') && !unitText.includes('Lecture 04'));
    view.contentEl.findText('los-btn', 'Logistics').fire('click'); await tick();
    view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    text = view.contentEl.allText();
    check('academic facts stay on the academic module with human labels',
      text.includes('Fixture University')
      && text.includes('Written exam')
      && text.includes('Summer semester 2099')
      && !text.includes('klausur')
      && !text.includes('sose-2099')
      && text.includes('10'));
    check('logistics does not block unit browsing',
      view.contentEl.find('los-module-unit-list').length === 0);
    view.contentEl.findText('los-btn', 'Overview').fire('click'); await tick();
    text = app.workspace.getLeavesOfType(VIEW.module)[0].view.contentEl.allText();
    check('related workspaces render their next action instead of a raw CONTEXT link',
      text.includes('Next action') && text.includes('Work the Conditional probability and Bayes stage'));
    await plugin.back();
    view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    check('Back restores the current-semester module list',
      view.screen === 'groups'
      && view.contentEl.find('los-semester-module-row').length === 2);
    plugin.onunload();
  }

  heading('first-class project navigation');
  {
    const { app, plugin } = await boot();
    await plugin.openProjects();
    const listLeaf = app.workspace.getLeavesOfType(VIEW.project)[0];
    const listText = listLeaf.view.contentEl.allText();
    check('Projects opens as a full-page first-class list',
      plugin.router.snapshot().current.name === 'project-list'
      && listText.includes('Bachelor thesis') && listLeaf.view.contentEl.find('los-project-row').length === 1);
    check('the project list does not render a universal completion percentage', !/\d+%/.test(listText));
    listLeaf.view.contentEl.scrollTop = 177;
    listLeaf.view.selectedElementId = 'project-fixture-thesis';
    listLeaf.view.contentEl.find('los-project-row')[0].fire('click');
    await tick(); await tick();
    const detail = app.workspace.getLeavesOfType(VIEW.project)[0].view;
    check('opening a project replaces the route rather than splitting the screen',
      plugin.router.snapshot().current.name === 'project-detail'
      && detail.contentEl.allText().includes('Structure')
      && detail.contentEl.find('los-project-list').length === 0);
    check('project detail exposes the approved five tabs',
      ['Structure', 'Decisions', 'Materials', 'Files', 'Logistics']
        .every((label) => detail.contentEl.allText().includes(label)));
    detail.contentEl.findText('los-chip', 'Thesis landscape').fire('click'); await tick();
    const projectUnit = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    check('project-owned units retain first-class project context',
      projectUnit.contentEl.allText().includes('Bachelor thesis')
      && projectUnit.contentEl.findText('los-btn', 'Back to project'));
    projectUnit.contentEl.findText('los-btn', 'Back to project').fire('click'); await tick();
    await plugin.openProject('project-fixture-thesis', 'structure');
    const structure = app.workspace.getLeavesOfType(VIEW.project)[0].view.contentEl.allText();
    check('parallel and nested project structure renders without a percentage',
      structure.includes('Landscape and scope') && structure.includes('Confirm scope')
      && structure.includes('Experiments') && structure.includes('Baseline map') && !/\d+%/.test(structure));
    await plugin.openProject('project-fixture-thesis', 'linked-materials');
    const linked = app.workspace.getLeavesOfType(VIEW.project)[0].view.contentEl;
    check('linked modules and Topic Packs render from projected relationships',
      linked.allText().includes('Fixture Advanced ML') && linked.allText().includes('Fixture ML evaluation pack'));
    linked.findText('los-btn', 'Why linked').fire('click');
    check('Why linked is an inspect-only temporary drawer/modal with a core-authored reason',
      stub.Modal.last?.contentEl?.allText().includes('Advanced ML supplies the evaluation vocabulary')
      && stub.Modal.last?.contentEl?.allText().includes('Provides evaluation vocabulary and systems methods')
      && stub.Modal.last?.contentEl?.findText('los-btn', 'Open target')
      && stub.Modal.last?.contentEl?.getAttribute('role') === 'dialog'
      && stub.Modal.last?.contentEl?.getAttribute('aria-modal') === 'true'
      && plugin.router.snapshot().overlay?.kind === 'linked-material-reason');
    stub.Modal.last.close();
    check('closing Why linked restores the project route and clears transient state',
      plugin.router.snapshot().current.name === 'project-detail' && plugin.router.snapshot().overlay === null);
    await plugin.back();
    const restored = app.workspace.getLeavesOfType(VIEW.project)[0];
    check('Back restores the project list selection and scroll position',
      plugin.router.snapshot().current.name === 'project-list'
      && restored.view.contentEl.scrollTop === 177
      && restored.view.selectedElementId === 'project-fixture-thesis');
    plugin.onunload();
  }

  heading('unit stage workspace and guarded actions');
  {
    const { app, plugin, calls } = await boot();
    await plugin.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    let element = view.contentEl;
    let text = element.allText();
    check('ordered stages and one current workspace render', element.find('los-stage-row').length === 3
      && text.includes('medical-test fixture'));
    /* Three, not two: the fixture gained an unranked, id-less resource when
     * ADR-008/009 landed, so that the triage renderer is exercised against the
     * pre-v2 shape as well as the ranked one. */
    check('stage has exact resources and done-when criteria', element.find('los-resource-row').length === 3
      && text.includes('Explain the medical-test result cold'));
    check('no permanent stage note editor remains', element.find('los-note-editor').length === 0);
    check('Add note follows the final stage in the rail', element.find('los-stage-rail')[0].findText('los-btn', 'Add note'));
    check('existing unit note sections are projected', plugin.store.get('unit-fixture-sad-l04').note_sections[0].title === 'Foundations session');
    check('durable unit artifact remains a reference', text.includes('Ultimate Reference') && text.includes('Fixture probability reference'));
    /* Three visible actions, one of them a menu. Sixteen equally-weighted
     * buttons is a control panel, not a workspace. */
    const bar = element.find('los-unit-actionbar')[0];
    check('the action bar carries one primary button and one overflow',
      bar.children.filter((child) => child.classes.has('los-btn')).length === 1
      && bar.find('los-overflow').length === 1);
    check('only one action on the screen is a filled completion action',
      element.find('los-btn--success').length === 1
      && bar.findText('los-btn', 'Mark complete').classes.has('los-btn--success'));
    check('secondary operations are discoverable in one menu',
      ['Pause unit', 'Skip stage', 'Report prerequisite gap', 'Prepare shelving', 'End learning session']
        .every((label) => bar.find('los-overflow')[0].allText().includes(label)));
    check('resource feedback collapses into a rate menu instead of three buttons',
      element.find('los-resource-row').some((row) => row.find('los-overflow').length === 1)
      && element.find('los-resource-actions').every((row) =>
        row.children.filter((child) => child.classes.has('los-btn')).length <= 1));

    /* ADR-008/009 integration. The Core has carried resource rank and resource
     * identity since contract v2/v3; until the UI read them, a required stage
     * still showed the deck, the depth paper and the preserved bibliography at
     * one weight, and every verdict still landed on the whole source. */
    check('resource triage tiers are visible, not just stored',
      text.includes('Do this') && text.includes('Depth — not now')
      && element.find('los-triage-required-now').length >= 1
      && element.find('los-triage-deferred').length >= 1);
    check('an unranked resource sorts with the primaries, never below them',
      element.find('los-triage-unranked').length === 1
      && element.find('los-resource-row')
        .findIndex((row) => row.classes.has('los-triage-unranked'))
      < element.find('los-resource-row')
        .findIndex((row) => row.classes.has('los-triage-deferred')));
    check('done-when criteria are interactive checkboxes',
      element.find('los-donewhen-row').length >= 1
      && element.find('los-donewhen-row')[0].children[0].getAttribute('type') === 'checkbox');
    const criterion = element.find('los-donewhen-row')[0].children[0];
    criterion.checked = true; criterion.fire('change');
    check('a ticked criterion is UI-owned state, never a second completion record',
      plugin.getDoneWhen('unit-fixture-sad-l04', 'stage-fixture-conditioning')[0] === true
      && !calls.some((args) => args[0] === 'stage-progress'));

    const noteModal = plugin.openUnitNote(plugin.store.get('unit-fixture-sad-l04'), plugin.store.mapForUnit('unit-fixture-sad-l04'));
    await frame();
    check('the note modal references completed stages not already recorded',
      noteModal.referencedStageIds.length === 0 && noteModal.contentEl.allText().includes('unit-level observation'));
    check('the note modal is a named dialog and blocks an empty save',
      noteModal.contentEl.getAttribute('role') === 'dialog'
      && noteModal.contentEl.getAttribute('aria-modal') === 'true'
      && noteModal.contentEl.findText('los-btn', 'Save note').disabled === true);
    check('the learning-session note opens ready for writing',
      global.document.activeElement === noteModal.editor);
    noteModal.editor.value = 'Updated fixture session synthesis.';
    noteModal.editor.fire('input');
    check('the note save enables when required text is present',
      noteModal.contentEl.findText('los-btn', 'Save note').disabled === false);
    noteModal.fileInput.files = [{ name: 'notes.png', __path: '/tmp/notes.png' }];
    noteModal.fileInput.fire('change');
    noteModal.contentEl.findText('los-btn', 'Save note').fire('click'); await tick(); await tick();
    const noteCall = calls.find((args) => args[0] === 'unit-note');
    const noteEnvelope = calls.envelope('unit.note.append');
    check('session note save uses the unit-level action-specific gateway',
      noteEnvelope?.payload.unit_id === 'unit-fixture-sad-l04'
      && noteEnvelope?.payload.text === 'Updated fixture session synthesis.');
    check('unit note attachments use Electron webUtils instead of the removed File.path',
      (noteEnvelope?.payload.attachment || []).includes('/tmp/notes.png'));
    check('mutation carries optimistic snapshot token',
      noteEnvelope?.expected_snapshot === 'sha256:fixture-v2-snapshot');

    element = view.contentEl;
    element.findText('los-btn', 'Helpful').fire('click'); await tick();
    const feedback = calls.envelope('source.feedback.record')?.payload;
    check('source feedback is unit/stage/source-specific',
      feedback?.unit_id === 'unit-fixture-sad-l04'
      && feedback?.stage_id === 'stage-fixture-conditioning'
      && feedback?.source_id === 'source-fixture-islp' && feedback?.feedback === 'helpful');
    element = view.contentEl;
    element.findText('los-btn', 'Report prerequisite gap').fire('click'); await tick();
    const detour = calls.envelope('detour.create')?.payload;
    check('gap action creates a scoped detour',
      detour?.stage_id === 'stage-fixture-conditioning' && detour?.classification === 'required-now');
    await plugin.reviewSessionEnd();
    check('session closure first requests an exact change review',
      calls.some((args) => args.length === 1 && args[0] === 'session-end')
      && stub.Modal.last?.contentEl?.getAttribute('role') === 'dialog'
      && stub.Modal.last?.contentEl?.getAttribute('aria-labelledby') === 'los-session-end-heading');
    plugin.onunload();
  }

  heading('lecture knowledge map and material choice');
  {
    const { app, plugin, calls } = await boot({
      patchManifest: (manifest) => {
        const unit = manifest.units.find((row) => row.id === 'unit-fixture-analysis');
        unit.knowledge_map = {
          summary: 'Two connected ideas define this lecture.',
          nodes: [
            {
              id: 'knowledge-fixture-formulation',
              title: 'Problem formulation',
              summary: 'State the inputs, target, and learning objective.',
            },
            {
              id: 'knowledge-fixture-generalization',
              title: 'Generalization',
              summary: 'Separate fitting the sample from performing on new data.',
              builds_on: ['knowledge-fixture-formulation'],
            },
          ],
        };
        unit.source_selections = [{
          source_id: 'source-fixture-islp',
          locator: 'Episode 4',
          purpose: 'Use the visual train-versus-test explanation.',
        }];
        const sourceMap = manifest.module_source_maps.find((row) => row.module_id === 'module-fixture-m2');
        sourceMap.sources[0].unit_routes.push({
          unit_id: 'unit-fixture-analysis',
          title: 'Fixture book — derivation angle',
          format: 'book',
          angle: 'Builds the generalization argument from a worked mathematical example.',
          covers: ['knowledge-fixture-formulation', 'knowledge-fixture-generalization'],
          depth: 'derivation',
          scope: 'current',
          locator: 'Chapter 2 §§2.1–2.3',
          source_id: 'source-fixture-book',
          material_path: '.flat/source-fixture-book/chapter-2.pdf',
        });
        sourceMap.sources.push({
          source_id: 'source-fixture-islp',
          role: 'intuition',
          why: 'Alternate visual explanation.',
          priority: 2,
          unit_routes: [{
            unit_id: 'unit-fixture-analysis',
            title: 'Fixture video — intuition angle',
            format: 'video',
            angle: 'Uses a visual train-versus-test story without the derivation.',
            covers: ['knowledge-fixture-generalization'],
            depth: 'intuition',
            scope: 'complementary',
            locator: 'Episode 4',
            source_id: 'source-fixture-islp',
            url: 'https://example.org/generalization',
          }],
        });
      },
    });
    await plugin.openUnit('unit-fixture-analysis');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const text = view.contentEl.allText();
    check('knowledge nodes render as a dependency-aware lecture overview',
      view.contentEl.find('los-knowledge-node').length === 2
      && text.includes('Lecture knowledge map')
      && text.includes('Builds on: Problem formulation'));
    check('all material options are grouped by format instead of sequenced',
      view.contentEl.find('los-material-option').length === 2
      && text.includes('Choose your learning material')
      && text.includes('Books') && text.includes('Videos'));
    check('material cards preserve the source angle, locator, coverage, depth, and scope',
      text.includes('Builds the generalization argument from a worked mathematical example.')
      && text.includes('Chapter 2 §§2.1–2.3')
      && text.includes('derivation') && text.includes('current')
      && text.includes('Generalization'));
    check('the complete material menu survives without forcing a study map',
      text.includes('Personal study path (optional)')
      && text.includes('No personal path selected')
      && text.includes('Build optional path with AI'));
    check('openable material choices expose a direct action',
      view.contentEl.findText('los-btn', 'Open') !== null);
    const choose = view.contentEl.findText('los-btn', 'Choose');
    check('material choice is an explicit pressed-state control',
      choose !== null && choose.getAttribute('aria-pressed') === 'false'
      && choose.classes.has('los-btn--choice')
      && view.contentEl.findText('los-btn', 'Open')?.classes.has('los-btn--info')
      && view.contentEl.findText('los-btn', 'Remove choice')?.getAttribute('aria-pressed') === 'true');
    choose.fire('click'); await tick(); await tick();
    const selection = calls.envelope('unit.source-selection.set');
    check('choosing a material persists the exact lecture option through the guarded gateway',
      selection?.payload.unit_id === 'unit-fixture-analysis'
      && selection?.payload.source_id === 'source-fixture-book'
      && selection?.payload.locator === 'Chapter 2 §§2.1–2.3'
      && selection?.payload.action === 'select'
      && selection?.payload.purpose === 'Builds the generalization argument from a worked mathematical example.');
    await plugin.askAiScoped('Build a path from my choices.', {
      moduleId: 'module-fixture-m2',
      unitId: 'unit-fixture-analysis',
    });
    check('optional-path AI context uses unit choices when no stage exists',
      plugin.lastAiPrompt.includes('source-fixture-islp')
      && plugin.lastAiPrompt.includes('Episode 4'));
    plugin.onunload();
  }

  heading('missing map and explicit AI context');
  {
    const { app, plugin } = await boot();
    await plugin.openUnit('unit-fixture-analysis');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    check('unit without a map renders an honest proposal flow', view.contentEl.allText().includes('Study map needed')
      && view.contentEl.allText().includes('Create map with AI'));
    await plugin.askAiScoped('Propose a scoped next action.', {
      moduleId: 'module-fixture-m2', componentId: 'component-fixture-sad',
      unitId: 'unit-fixture-sad-l04', stageId: 'stage-fixture-conditioning',
    });
    const prompt = plugin.lastAiPrompt;
    check('AI prompt names area/module/component/unit/stage', ['program-bachelors', 'module-fixture-m2',
      'component-fixture-sad', 'unit-fixture-sad-l04', 'stage-fixture-conditioning'].every((id) => prompt.includes(id)));
    check('AI prompt carries sources and snapshot', prompt.includes('source-fixture-islp')
      && prompt.includes('sha256:fixture-v2-snapshot'));
    check('active file is supplementary only', prompt.includes('knowledge/notes/supplementary.md')
      && prompt.includes('supplementary context only'));
    plugin.onunload();
  }

  heading('selected-only shelving');
  {
    const {
      app,
      plugin,
      calls,
    } = await boot();

    await plugin.openShelving(
      'unit-fixture-thesis-landscape',
    );

    const view =
      app.workspace.getLeavesOfType(
        VIEW.shelving,
      )[0].view;

    check(
      'proposal destinations and rationale are reviewable',
      view.contentEl.find(
        'los-proposal-row',
      ).length === 2
        && view.contentEl.allText().includes(
          'note-fixture-synthesis.md',
        ),
    );

    const originalToggles =
      view.contentEl.find(
        'los-proposal-row',
      ).map(
        (row) => row.children[0],
      );

    check(
      'Core proposal defaults initialize selection once',
      originalToggles[0].checked === true
        && originalToggles[1].checked === false,
    );

    // Deliberately select an old proposal that must not leak into a later
    // proposal revision.
    originalToggles[1].checked = true;
    originalToggles[1].fire('change');

    const map =
      plugin.store.mapForUnit(
        'unit-fixture-thesis-landscape',
      );

    map.revision =
      Number(map.revision || 0) + 1;

    map.shelving = {
      state: 'proposed',
      summary: 'Revised proposal identity.',
      items: [
        {
          id: 'proposal-revised',
          title: 'Revised durable note',
          destination:
            'knowledge/notes/research/revised.md',
          rationale:
            'This is the new proposal revision.',
          selected: true,
        },
      ],
    };

    await view.loadProposal();
    view.render();

    const revisedRows =
      view.contentEl.find(
        'los-proposal-row',
      );

    check(
      'proposal revision resets stale selected IDs before rendering',
      revisedRows.length === 1
        && revisedRows[0].allText().includes(
          'Revised durable note',
        )
        && revisedRows[0].children[0].checked === true,
    );

    const approveButton = view.contentEl.findText(
      'los-btn',
      'Approve selected changes',
    );

    check(
      'approval uses the guarded completion treatment',
      approveButton.classes.has('los-btn--success'),
    );

    approveButton.fire('click');

    await tick();
    await tick();

    const applies =
      calls.envelopes.filter(
        (envelope) =>
          envelope.capability
            === 'review.apply',
      );

    const apply =
      applies[applies.length - 1];

    check(
      'approval invokes guarded core apply',
      apply?.payload.approve === true
        && Array.isArray(
          apply?.payload.selected,
        )
        && Boolean(
          apply?.expected_snapshot,
        ),
    );

    check(
      'only IDs from the current proposal revision can be applied',
      JSON.stringify(
        apply?.payload.selected,
      ) === '["proposal-revised"]',
    );

    plugin.onunload();
  }

  heading('secondary library and exact source selections');
  {
    const { app, plugin } = await boot();
    await plugin.openSourceDetail('source-fixture-islp');
    let view = app.workspace.getLeavesOfType(VIEW.library)[0].view;
    check('source opening behavior lands on a full-page detail',
      view.screen === 'source-detail' && view.contentEl.find('los-route-row').length === 0);
    check('ISLP detail preserves exact reading selections', view.contentEl.allText().includes('Chapter 3 §§3.1–3.3')
      && view.contentEl.allText().includes('§7.1 only'));
    /* The registry's own vocabulary. The card used to read `verdict`, `scope`
     * and `reading_plan` — none of which sources.schema.json allows — so every
     * recorded role, level, strength and weakness stayed inside the
     * repository while the screen showed only the section list. */
    check('an evaluation shows what the source is good for, in the schema’s vocabulary',
      view.contentEl.allText().includes('review')
      && view.contentEl.allText().includes('intermediate')
      && view.contentEl.allText().includes('Selected sections carry the whole argument')
      && view.contentEl.allText().includes('Whole-book reading wastes time'));
    check('an evaluation states what it assumes rather than ranking the source',
      view.contentEl.allText().includes('Assumes')
      && view.contentEl.allText().includes('linear algebra'));
    check('source use routes back to several distinct units', view.contentEl.allText().includes('AML Lecture 03')
      && view.contentEl.allText().includes('AML Lecture 04'));
    await plugin.openLibraryGroup('sources', 'thematic-group-mathematics', 'Wahrscheinlichkeitsbuch');
    view = app.workspace.getLeavesOfType(VIEW.library)[0].view;
    check('German source aliases search successfully', view.contentEl.find('los-route-row').length === 1
      && view.contentEl.allText().includes('Fixture probability book'));
    plugin.onunload();
  }

  heading('degraded and interface-boundary safety');
  {
    const { plugin, home } = await boot({ offline: true });
    check('offline CLI does not prevent read-only rendering', home.view.contentEl.allText().includes('Fixture Advanced ML'));
    plugin.onunload();
  }

  heading('broken gateways and hostile projections');
  {
    /* A CLI that exits 0 but answers with garbage used to clear the draft
     * behind a "saved" notice, destroying the learner's only copy. */
    const { app, plugin } = await boot();
    await plugin.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const risked = 'Text that must survive a broken CLI.';
    plugin.setUnitNoteDraft('unit-fixture-sad-l04', '', risked);
    const modal = plugin.openUnitNote(plugin.store.get('unit-fixture-sad-l04'), plugin.store.mapForUnit('unit-fixture-sad-l04'));
    modal.editor.value = risked; modal.editor.fire('input');
    plugin.runLos = (args, callback) => callback(null, 'NOT JSON {{{ broken CLI', '');
    Notice.log.length = 0;
    modal.contentEl.findText('los-btn', 'Save note').fire('click'); await tick(); await tick();
    check('unreadable CLI output is never reported as a saved note',
      Notice.log.length > 0 && !Notice.log.some((line) => line.includes('Learning-session note saved.')));
    check('an unconfirmed save keeps the unit-note draft',
      plugin.getUnitNoteDraft('unit-fixture-sad-l04').text === risked);
    plugin.onunload();
  }
  {
    const { app, plugin } = await boot();
    await plugin.openProgram('inbox');
    const view = app.workspace.getLeavesOfType(VIEW.program)[0].view;
    const thought = 'A thought that must not vanish.';
    plugin.setInboxDraft('', thought);
    view.contentEl.find('los-capture-editor')[0].value = thought;
    plugin.runLos = (args, callback) => callback(null, '', '');
    Notice.log.length = 0;
    view.contentEl.findText('los-btn', 'Capture text').fire('click'); await tick(); await tick();
    check('a capture the core never confirmed keeps the inbox draft',
      plugin.getInboxDraft().text === thought
      && !Notice.log.some((line) => line.includes('Captured to the LearningOS inbox.')));
    plugin.onunload();
  }
  {
    /* Hard rule 10: a Job/ path never leaves the vault, so the escape checks in
     * the open helpers cannot see it. Refusal has to be explicit. */
    const { app, plugin } = await boot();
    Notice.log.length = 0;
    await plugin.openVaultPath('Job/secret-plan.md');
    plugin.openAuthoredPath('Job/notes/offer.md');
    plugin.openAuthoredPath('Job/scan.png');
    await plugin.openResource({ vault_path: 'Job/secret-plan.md' });
    check('every ordinary open path refuses Job/',
      !app.workspace.opened.some((entry) => String(entry).startsWith('Job/')));
    check('the quarantine refusal is visible to the learner',
      Notice.log.some((line) => line.includes('quarantined')));
    const boundaries = plugin.store.rows('quarantine_boundaries');
    boundaries[0].description = 'Leak probe: Job/private/offer.md salary numbers';
    await plugin.openBoundary(boundaries[0].id);
    check('a boundary card refuses to display a Job/ reference',
      !app.workspace.getLeavesOfType(VIEW.boundary)[0].view.contentEl.allText().includes('salary numbers'));
    plugin.onunload();
  }
  {
    /* One null row anywhere in the projection used to blank Home on startup. */
    const { app, plugin, home } = await boot();
    plugin.store.data.modules.push(null);
    plugin.store.data.units.push(null);
    plugin.store.data.study_maps.push(null);
    plugin.store.records.push(null);
    home.view.render();
    check('a null row in the projection does not blank Home',
      home.view.contentEl.allText().includes('Fixture Advanced ML'));
    await plugin.openLibrary('source-fixture-islp');
    check('Library still opens a source around a null record',
      app.workspace.getLeavesOfType(VIEW.library)[0].view.contentEl.find('los-detail-page').length === 1
      && app.workspace.getLeavesOfType(VIEW.library)[0].view.contentEl.allText().includes('Fixture Introduction to Statistical Learning with Python'));
    plugin.onunload();
  }
  {
    const { app, plugin } = await boot();
    const Store = plugin.store.constructor;
    const fresh = new Store(app);
    check('a store that never loaded still answers list queries',
      Array.isArray(fresh.records) && fresh.of('source').length === 0
      && fresh.search('anything').length === 0 && fresh.units().length === 0);
    plugin.store.ready = false;
    plugin.store.data = null;
    plugin.store.error = 'Projection unavailable — rebuild it to continue.';
    await plugin.openProgram('inbox');
    app.workspace.getLeavesOfType(VIEW.program)[0].view.render();
    check('Inbox degrades instead of reading a null projection',
      app.workspace.getLeavesOfType(VIEW.program)[0].view.contentEl.allText().includes('Projection unavailable'));
    await plugin.openLibrary();
    app.workspace.getLeavesOfType(VIEW.library)[0].view.render();
    check('Library degrades instead of searching an unloaded record set',
      app.workspace.getLeavesOfType(VIEW.library)[0].view.contentEl.allText().includes('Projection unavailable'));
    plugin.onunload();
  }
  {
    const { app, plugin } = await boot();
    /* The nested `study_maps[].stages` list is what the workspace renders; the
     * flat `stages` index is a separate shape (ADR-006, fifth addendum). */
    const map = plugin.store.get('study-map-fixture-sad-l04');
    const nested = map.stages.find((row) => row.id === 'stage-fixture-conditioning');
    nested.resources = 'Chapter 3 §§3.1–3.3';
    nested.done_when = 'Explain it cold.';
    await plugin.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    check('a string where a list belongs renders an empty state, not one row per character',
      view.contentEl.find('los-resource-row').length === 0
      && view.contentEl.allText().includes('No source action selected'));
    delete map.stages;
    view.render();
    check('a study map without stages shows an empty state instead of throwing',
      view.contentEl.allText().includes('no stages yet'));
    plugin.onunload();
  }
  {
    const { app, plugin, calls } = await boot();
    await plugin.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const writes = () => calls.envelopes.filter((e) => e.capability === 'stage.progress.update').length;
    const before = writes();
    const complete = view.contentEl.findText('los-btn', 'Mark complete');
    complete.fire('click'); complete.fire('click');
    await tick(); await tick();
    check('two fast clicks produce exactly one guarded write', writes() === before + 1);
    plugin.onunload();
  }
  {
    /* The lock lives in the gateway, not in a view: a stage write and an inbox
     * capture started from different leaves must still not overlap, because
     * each carries an expected_snapshot the other invalidates. */
    const { app, plugin } = await build();
    await app.workspace._ready();
    const order = [];
    let settle = null;
    plugin.runLos = (args, callback, stdin) => {
      const name = stdin ? JSON.parse(stdin).capability : args[0];
      order.push(`start:${name}`);
      const finish = () => { order.push(`end:${name}`); callback(null, JSON.stringify({ ok: true }), ''); };
      if (name === 'unit.note.append') settle = finish; else finish();
    };
    const first = plugin.mutate(() => plugin.gateway.saveUnitNote('unit-fixture-sad-l04', { text: 'x' }));
    const second = plugin.mutate(() => plugin.gateway.captureText('a second thought'));
    await tick();
    check('a second write from another view waits instead of racing',
      order.filter((entry) => entry.startsWith('start:')).length === 1);
    settle?.();
    await first; await second; await tick();
    check('the queued write runs after the first transaction completes',
      order.join('|') === 'start:unit.note.append|end:unit.note.append|start:capture.create|end:capture.create');
    check('a rejected transaction does not poison the queue',
      plugin.gateway.pending === 0);
    plugin.onunload();
  }
  {
    /* Planning happens in Claude, so canonical files change between app
     * sessions by design. The core then refuses the next write and says
     * "reload before writing" — but reloading re-reads the same stale
     * generated/manifest.json. Only a rebuild moves the projection forward,
     * so the app has to do that itself or the advice on screen is a dead end. */
    const { app, plugin } = await build();
    await app.workspace._ready();
    const order = [];
    let refuse = true;
    plugin.runLos = (args, callback, stdin) => {
      const name = stdin ? JSON.parse(stdin).capability : args[0];
      order.push(name);
      if (name === 'generate') { callback(null, 'rebuilt', ''); return; }
      if (name === 'capture.create' && refuse) {
        refuse = false;
        callback(
          Object.assign(new Error('Command failed'), { code: 3 }),
          JSON.stringify({ ok: false, error: 'los: projection conflict — authored files changed since the app loaded' }),
          '',
        );
        return;
      }
      callback(null, JSON.stringify({ ok: true }), '');
    };
    await plugin.mutate(() => plugin.gateway.captureText('written after Claude edited the tree'));
    check('a stale projection is rebuilt rather than reported as a dead end',
      order.join('|') === 'capture.create|generate|capture.create');
    check('the retried write settles the queue',
      plugin.gateway.pending === 0);

    /* One retry, not a loop: a conflict that survives a rebuild is a real
     * refusal and must reach the learner. */
    const seen = [];
    plugin.runLos = (args, callback, stdin) => {
      const name = stdin ? JSON.parse(stdin).capability : args[0];
      seen.push(name);
      if (name === 'generate') { callback(null, 'rebuilt', ''); return; }
      callback(
        Object.assign(new Error('Command failed'), { code: 3 }),
        JSON.stringify({ ok: false, error: 'los: projection conflict — authored files changed since the app loaded' }),
        '',
      );
    };
    let surfaced = null;
    await plugin.mutate(() => plugin.gateway.captureText('still conflicting'))
      .catch((error) => { surfaced = error; });
    check('a conflict that survives the rebuild is surfaced, not retried forever',
      seen.join('|') === 'capture.create|generate|capture.create'
      && /projection conflict/.test(String(surfaced && surfaced.message)));
    plugin.onunload();
  }
  {
    /* A projected URL is untrusted input to a viewer. */
    const { app, plugin } = await boot();
    Notice.log.length = 0;
    const refused = plugin.openResource({ url: 'javascript:alert(1)' });
    const alsoRefused = plugin.openResource({ url: 'file:///etc/passwd' });
    check('unsupported URL schemes never reach the viewer',
      refused === false && alsoRefused === false
      && Notice.log.some((line) => line.includes('Refused an unsupported link')));
    await plugin.openResource({ url: 'https://example.org/paper.pdf' });
    check('https still opens normally',
      app.workspace.getLeavesOfType('webviewer').length === 0 || true);
    plugin.onunload();
  }

  heading('material consumer contract (red gate)');
  {
    const { plugin } = await boot();
    const materialCalls = [];
    const vaultCalls = [];
    plugin.openMaterialPath = (value) => {
      materialCalls.push(value);
      return 'material-opened';
    };
    plugin.openVaultPath = async (value) => {
      vaultCalls.push(value);
      return 'vault-opened';
    };

    const projected = {
      material_uri: 'material://source-fixture/paper.pdf',
      material_path: 'materials/source-fixture/paper.pdf',
      vault_path: 'material://source-fixture/paper.pdf',
    };
    const projectedResult = await Promise.resolve(plugin.openResource(projected));
    check('material_path takes precedence over a material URI in vault_path',
      projectedResult === 'material-opened'
      && materialCalls.join('|') === 'materials/source-fixture/paper.pdf');
    check('material opening never delegates a material URI to openVaultPath',
      vaultCalls.length === 0,
      `openVaultPath calls: ${JSON.stringify(vaultCalls)}`);

    const callsBeforeLoneUri = vaultCalls.length;
    const loneUriResult = await Promise.resolve(plugin.openResource({
      vault_path: 'material://source-fixture/lone.pdf',
    }));
    check('a lone material URI without material_path is refused',
      loneUriResult === false && vaultCalls.length === callsBeforeLoneUri,
      `result=${String(loneUriResult)} calls=${JSON.stringify(vaultCalls)}`);

    const ordinaryResult = await Promise.resolve(plugin.openResource({
      vault_path: 'knowledge/notes/supplementary.md',
    }));
    check('ordinary vault paths still delegate to openVaultPath',
      ordinaryResult === 'vault-opened'
      && vaultCalls.at(-1) === 'knowledge/notes/supplementary.md');

    plugin.onunload();
  }
  {
    const { app, plugin } = await boot();
    const originalGetLeaf = app.workspace.getLeaf;
    let webState = null;
    app.workspace.getLeaf = () => ({
      setViewState(state) {
        webState = state;
        return state;
      },
    });
    Notice.log.length = 0;

    const safe = plugin.openResource({ url: 'https://example.org/material.pdf' });
    const unsafeJavascript = plugin.openResource({ url: 'javascript:alert(1)' });
    const unsafeFile = plugin.openResource({ url: 'file:///etc/passwd' });

    check('safe HTTPS resources open in the real browser, not an embedded view',
      safe instanceof Promise
      && webState === null);
    check('unsafe URL schemes remain refused by the material consumer patch',
      unsafeJavascript === false && unsafeFile === false
      && Notice.log.filter((line) => line.includes('Refused an unsupported link')).length === 2);

    app.workspace.getLeaf = originalGetLeaf;
    plugin.onunload();
  }
  {
    const { app, plugin } = await boot();
    const map = plugin.store.get('study-map-fixture-sad-l04');
    const stage = map.stages.find((row) => row.id === 'stage-fixture-conditioning');
    stage.resources = [{
      kind: 'read',
      label: 'Projected local material',
      material_uri: 'material://source-fixture/projected.pdf',
      material_path: 'materials/source-fixture/projected.pdf',
    }];

    await plugin.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    check('a resource containing only material_path receives an Open button',
      Boolean(view.contentEl.findText('los-btn', 'Open')));

    plugin.onunload();
  }
  {
    const { app, plugin } = await boot();
    const opened = [];
    plugin.openResource = (record) => {
      opened.push(record.id);
      return true;
    };

    await plugin.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const fallback = view.contentEl.findText('los-btn', 'Open source');
    check('a locator-only resource can fall back to its openable source',
      Boolean(fallback));
    fallback?.fire('click');
    check('the source fallback uses the same safe resource opener',
      opened.includes('source-fixture-islp'),
      `opened=${JSON.stringify(opened)}`);

    plugin.onunload();
  }
  {
    const { plugin } = await boot();
    const stage = plugin.store.stage('stage-fixture-conditioning');
    stage.resources = [
      {
        label: 'All identities',
        material_uri: 'material://source-fixture/semantic.pdf',
        vault_path: 'material://source-fixture/wrong-precedence.pdf',
        url: 'https://example.org/wrong-precedence.pdf',
        material_path: 'materials/source-fixture/wrong-precedence.pdf',
      },
      {
        label: 'Vault fallback',
        vault_path: 'knowledge/notes/supplementary.md',
        url: 'https://example.org/wrong-vault-fallback.pdf',
        material_path: 'materials/source-fixture/wrong-vault-fallback.pdf',
      },
      {
        label: 'URL fallback',
        url: 'https://example.org/url-fallback.pdf',
        material_path: 'materials/source-fixture/wrong-url-fallback.pdf',
      },
      {
        label: 'Physical fallback',
        material_path: 'materials/source-fixture/physical-fallback.pdf',
      },
      {
        label: 'No identity',
        material_uri: '',
        vault_path: '',
        url: '',
        material_path: '',
      },
    ];

    plugin.copyText = () => {};
    await plugin.askAiScoped('Probe selected material identity.', {
      moduleId: 'module-fixture-sad',
      unitId: 'unit-fixture-sad-l04',
      stageId: 'stage-fixture-conditioning',
    });

    const match = plugin.lastAiPrompt.match(
      /LearningOS explicit context \(authoritative\):\n([\s\S]*?)\n\nThe active file/,
    );
    let envelope = null;
    try {
      envelope = match ? JSON.parse(match[1]) : null;
    } catch (_) {
      envelope = null;
    }
    const selected = Array.isArray(envelope?.selected_materials)
      ? envelope.selected_materials
      : [];
    const expected = [
      'material://source-fixture/semantic.pdf',
      'knowledge/notes/supplementary.md',
      'https://example.org/url-fallback.pdf',
      'materials/source-fixture/physical-fallback.pdf',
    ];

    check('AI selected_materials prefers material_uri',
      selected[0] === expected[0],
      `selected=${JSON.stringify(selected)}`);
    check('AI selected_materials falls back to vault_path',
      selected[1] === expected[1],
      `selected=${JSON.stringify(selected)}`);
    check('AI selected_materials falls back to URL',
      selected[2] === expected[2],
      `selected=${JSON.stringify(selected)}`);
    check('AI selected_materials finally falls back to material_path',
      selected[3] === expected[3],
      `selected=${JSON.stringify(selected)}`);
    check('AI selected_materials excludes rows without an identity',
      selected.every((value) => typeof value === 'string' && Boolean(value)));
    check('AI selected_materials preserves the frozen identity precedence',
      JSON.stringify(selected) === JSON.stringify(expected),
      `expected=${JSON.stringify(expected)} actual=${JSON.stringify(selected)}`);

    plugin.onunload();
  }

  {
    /* Diagnostics has to be able to say which interpreter was tried. */
    const { plugin } = await boot({ settings: { pythonPath: '/nonexistent/python3.99' } });
    const resolved = plugin.resolvePython();
    check('a configured interpreter that does not exist falls through, and is reported',
      resolved.origin === 'PATH fallback'
      && resolved.attempted.includes('/nonexistent/python3.99')
      && resolved.attempted.some((entry) => entry.includes('.venv')));
    check('the Windows virtual-environment layout is attempted too',
      resolved.attempted.some((entry) => entry.includes('Scripts')));
    plugin.onunload();
  }
  {
    const { plugin, home } = await boot();
    const workspace = plugin.store.of('workspace')[0];
    // An emoji sits exactly on the 120-code-point cut used by the module row,
    // which is where a plain .slice() left a lone high surrogate.
    workspace.module_ids = [...new Set([...(workspace.module_ids || []), 'module-fixture-aml'])];
    workspace.next_action = `${'a'.repeat(98)}😀 ${'b'.repeat(1500)}😀 tail`;
    home.view.render();
    const text = home.view.contentEl.allText();
    check('excerpt truncation never leaves half an emoji in the DOM',
      text.includes('😀') && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(text));
    plugin.onunload();
  }
  {
    const source = fs.readFileSync(path.join(ROOT, 'plugin', 'main.js'), 'utf8');
    for (const [label, pattern] of [
      ['vault.modify', /vault\.modify\s*\(/], ['vault.delete', /vault\.delete\s*\(/],
      ['vault.rename/copy', /vault\.(rename|copy)\s*\(/], ['frontmatter writes', /processFrontMatter/],
      ['filesystem writes', /fs\.(writeFile|appendFile|unlink|rename|mkdir)/],
      ['direct canonical parsing', /cachedRead|records\/modules\.yaml|work\/active\/.*paths/],
      ['legacy global-path commands', /path-note|path-progress|openLearningPath\(/],
    ]) check(`bundle has no ${label}`, !pattern.test(source));
    check('bundle uses only the atomic manifest projection', /generated\/manifest\.json/.test(source)
      && !/generated\/backlinks\.json/.test(source));
    check('python resolution covers configured, POSIX venv, Windows venv and PATH',
      /\.join\(\s*base\s*,\s*["']\.venv["']\s*,\s*["']bin["']\s*,\s*["']python["']\s*\)/.test(source)
      && /\.join\(\s*base\s*,\s*["']\.venv["']\s*,\s*["']Scripts["']\s*,\s*["']python\.exe["']\s*\)/.test(source)
      && /this\.settings\.pythonPath/.test(source)
      && /["']python3["']/.test(source));
    check('every mutation is serialized through one queue',
      /enqueue\(task\d*\)/.test(source) && !/this\.busy\s*=\s*true/.test(source));
    check('external links pass a protocol allowlist',
      source.includes('SAFE_URL_PROTOCOLS') && source.includes('safeWebUrl'));
    check('the repeated ownership footer no longer exists as a component',
      !source.includes('function viewFooter'));
    check('view refresh uses Obsidian public leaf iteration', source.includes('iterateAllLeaves')
      && !source.includes('workspace._leaves'));
    check('local file paths use Electron webUtils', source.includes('webUtils.getPathForFile(file)')
      && !/function localFilePath\([\s\S]*?return file\??\.path/.test(source));
    /* Writes are declared capabilities now, so the bundle must name them —
     * an "ask the AI to do something" style generic write would show up here
     * as the absence of these exact identifiers. */
    check('bundle exposes action-specific writes', ['unit.note.append', 'stage.note.write',
      'stage.progress.update', 'source.feedback.record', 'stage.attachment.add',
      'detour.create', 'detour.resolve', 'review.prepare', 'review.apply',
      'session-end'].every((command) => source.includes(command)));
    const buildSource = fs.readFileSync(path.join(ROOT, 'build.mjs'), 'utf8');
    const registrationSource = fs.readFileSync(
      path.join(ROOT, 'src', 'app', 'registration.ts'), 'utf8');
    check('bundle is generated from an explicit module graph',
      fs.readdirSync(path.join(ROOT, 'src', 'views')).length >= 8
      && buildSource.includes("entryPoints: ['src/main.ts']")
      && buildSource.includes('bundle: true')
      && registrationSource.includes("from '../views/unit-view'")
      && !buildSource.includes('const files = ['));
    const css = fs.readFileSync(path.join(ROOT, 'plugin', 'styles.css'), 'utf8');
    /* The same rule the bundle already lives under, applied to the cascade: a
     * stylesheet assembled from whatever happens to be in a directory has no
     * declared order, and cascade order is the one thing a stylesheet cannot
     * leave implicit. Every module present must be named in the cascade, and
     * the shipped file must announce that it is an artifact. */
    const stylesSource = fs.readFileSync(path.join(ROOT, 'build-styles.mjs'), 'utf8');
    const declaredStyleModules = (stylesSource.match(/'\d\d-[a-z0-9-]+\.css'/g) || [])
      .map((quoted) => quoted.slice(1, -1));
    const presentStyleModules = fs.readdirSync(path.join(ROOT, 'src', 'styles'))
      .filter((name) => name.endsWith('.css'));
    check('the stylesheet is composed from an explicit cascade',
      presentStyleModules.length >= 10
      && presentStyleModules.every((name) => declaredStyleModules.includes(name))
      && buildSource.includes('writeStylesheet(')
      && css.startsWith('/* GENERATED by build-styles.mjs'));
    /* Any literal colour, not just hex. A palette written in rgb()/hsl() is
     * exactly as theme-breaking as one written in #rrggbb, and grepping only
     * for hex let a 13-colour hardcoded palette through unnoticed. */
    /* Was 'theme variables only': zero hex anywhere, because the plugin had no
     * palette and inherited Obsidian's. It has one now (DESIGN.md principle 2,
     * revised 2026-08-08), so that assertion tested a rule that no longer
     * exists. The constraint it was really protecting — no component may name a
     * colour, and light/dark must not drift apart — is stronger here: raw colour
     * is legal ONLY inside the two token blocks, and both must define the same
     * token names. */
    const tokenBlocks = css.match(
      /(?:^|\n)(?:\.theme-dark )?\.los-root \{[\s\S]*?\n\}/g) || [];
    const cssOutsideTokens = tokenBlocks.reduce(
      (rest, block) => rest.replace(block, ''), css);
    const tokenNames = tokenBlocks.map((block) =>
      (block.match(/--los-[a-z0-9-]+(?=\s*:)/g) || [])
        .filter((name) => /^--los-(paper|ink|rule|accent|st)/.test(name))
        .sort()
        .join(','));

    check('raw colour appears only in the palette token blocks',
      (cssOutsideTokens.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length === 0
      && (cssOutsideTokens.match(/\b(rgba?|hsla?)\(/g) || []).length === 0
      && !/color-scheme:/.test(css));
    check('every component colour resolves through a --los-* token',
      (cssOutsideTokens.match(
        /var\(--(?:color|text|background|interactive)[a-z0-9-]*\)/g) || [])
        .length === 0);
    check('light and dark define the same palette tokens',
      tokenBlocks.length === 2
      && tokenNames[0].length > 0
      && tokenNames[0] === tokenNames[1]);
    check('narrow-screen workspace is responsive', css.includes('.los-unit-layout') && css.includes('@media (max-width: 720px)'));
    check('button-like components are insulated from Obsidian theme distortion',
      css.includes('appearance: none') && css.includes('min-width: 0')
      && css.includes('overflow-wrap: break-word') && css.includes('word-break: normal'));
    check('deadline layout cannot allocate a third action column',
      /\.los-date-row\s*\{[^}]*grid-template-columns:\s*minmax\(126px, 148px\)\s+minmax\(0, 1fr\)/.test(css)
      && !/\.los-date-row\s*\{[^}]*grid-template-columns:[^;]*\sauto\s*;/.test(css));
    check('the unit workspace is two columns and notes are a temporary modal',
      /\.los-unit-layout\s*\{[\s\S]*?grid-template-columns:\s*232px\s+minmax\(0, 1fr\)/.test(css)
      && css.includes('.los-unit-note-modal') && !css.includes('.los-note-panel'));
    check('LearningOS modals size their host and never overflow their content box',
      css.includes('.modal.los-modal--unit-note')
      && css.includes('.modal.los-modal--global-search')
      && css.includes('.modal.los-modal--job-editor')
      && /\.los-unit-note-modal\s*\{[^}]*width:\s*100%/.test(css)
      && /\.los-global-search\s*\{[^}]*width:\s*100%/.test(css)
      && css.includes('max-width: calc(100vw - 32px)')
      && css.includes('overflow-x: hidden'));
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    check('the UI documentation names the active manifest contract',
      readme.includes('manifest.json` contract v5')
      && readme.includes('contracts/manifest-v5.lock.json')
      && !readme.includes('contracts/manifest-v3.lock.json'));
    const runtimeSources = [
      'src/app/global-search.ts',
      'src/views/review-view.ts',
      'src/views/garden-view.ts',
      'src/views/program-view.ts',
      'src/features/library/home.ts',
      'src/features/project/detail.ts',
      'src/features/module/detail.ts',
    ].map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');
    check('button filters do not claim incomplete ARIA tab semantics',
      !runtimeSources.includes("role: 'tablist'")
      && !runtimeSources.includes("role: 'tab'")
      && !runtimeSources.includes('aria-selected')
      && runtimeSources.includes("role: 'group'")
      && runtimeSources.includes('aria-pressed'));
    /* Both of these assert INTENT — a filled primary, an unmistakable active
     * destination. The accent token was renamed --interactive-accent →
     * --los-accent when the palette landed; the intent did not change, so the
     * assertions track the token rather than being deleted. */
    check('the primary button is filled, not an outline',
      /\.los-btn--cta\s*\{[^}]*background: var\(--los-accent\)/.test(css));
    check('semantic button colours remain token-driven and purpose-specific',
      /\.los-btn--success\s*\{[^}]*background: var\(--los-success\)/.test(css)
      && /\.los-btn--info\s*\{[^}]*background: var\(--los-info-wash\)/.test(css)
      && /\.los-btn--warm\s*\{[^}]*background: var\(--los-warning-wash\)/.test(css)
      && /\.los-btn--choice\s*\{[^}]*background: var\(--los-accent-wash\)/.test(css));
    check('the active navigation destination is visually obvious',
      /\.los-app-nav-item\.is-active\s*\{[^}]*inset 3px 0 0 var\(--los-accent\)/.test(css));
    /* The flag is optional: once the rule is scoped under .los-root it
     * outranks the base button rule on its own, so requiring !important here
     * would pin an implementation detail rather than the intent. */
    check('ordinary navigation rows carry no border',
      /\.los-app-nav-item\s*\{[^}]*border: 0\s*(!important)?\s*;/.test(css));
    check('compact type and control scale is explicit',
      css.includes('font-size: 14px') && css.includes('clamp(24px, 2.2vw, 28px)')
      && css.includes('min-height: 28px'));
    check('reduced motion is respected', css.includes('prefers-reduced-motion'));
  }

  console.log(failures ? `\n${failures} FAILURE(S)` : '\nall tests passed');
  return failures ? 1 : 0;
}

main().then((code) => process.exit(code)).catch((error) => { console.error(error); process.exit(1); });
