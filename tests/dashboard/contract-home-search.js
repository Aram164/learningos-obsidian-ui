'use strict';

const {
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
  VIEW,
  tick,
  frame,
  requestGuardFor,
  check,
  heading,
  build,
  boot,
} = require('./support');

/*
 * The active contract version, read from the single lock file rather than
 * written in. A literal here is only correct until the next bump, which is the
 * same reason the README and ECOSYSTEM checks in runtime-integrity.js derive
 * theirs — this file did hardcode 8, and went red the day the projection
 * reached v9.
 */
const CONTRACT = Number(
  fs.readdirSync(path.join(ROOT, 'contracts'))
    .find((name) => /^manifest-v\d+\.lock\.json$/.test(name))
    .match(/v(\d+)/)[1],
);

module.exports = async function run() {
  heading('versioned atomic contract');
  {
    const { plugin } = await build();
    check(`manifest contract v${CONTRACT} loads`,
      plugin.store.ready && plugin.store.contractVersion === CONTRACT, plugin.store.error);
    check('snapshot guard is loaded', plugin.store.snapshotId === FIXTURE_SNAPSHOT);
    check('program/module/unit/map collections load atomically', plugin.store.programs().length === 3
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
    const bundle = fs.readFileSync(
      process.env.LEARNINGOS_TEST_BUNDLE || path.join(ROOT, 'plugin', 'main.js'),
      'utf8',
    );
    const read = [...bundle.matchAll(/(?:store\.data|this\.data|manifest)\??\.([a-z_]+)/g)]
      .map((match) => match[1])
      /* `json` comes from the "generated/manifest.json" literal and `ts` from
       * the stable "contracts/manifest.ts" source path; the rest are
       * Array/Map members reached through a projected collection. */
      .filter((key) => !['json', 'ts', 'length', 'find', 'filter', 'map'].includes(key));
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
      return file === 'generated/manifest.json'
        ? text.replace(`"contract_version": ${CONTRACT}`, '"contract_version": 1')
        : text;
    };
    const plugin = new LearningOSUI(app, { id: 'learningos-ui' }); app._plugin = plugin;
    await plugin.onload();
    check('contract v1 fails closed with recovery text',
      !plugin.store.ready && plugin.store.error.includes(`requires contract ${CONTRACT}`));
    plugin.onunload();
  }

  heading(`manifest v${CONTRACT} interaction plumbing`);
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
          === FIXTURE_SNAPSHOT,
    );

    // Core names the seed file itself, so the write is guarded against this
    // request. An empty guard is a refusal there, and now here too.
    check(
      'Garden creation carries the request-scoped guard Core requires',
      JSON.stringify(seed?.expected_revisions)
        === JSON.stringify(requestGuardFor(seed)),
      `sent ${JSON.stringify(seed?.expected_revisions)}`,
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
    await first.plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
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
    await plugin.nav.openLibraryGroup('sources', 'thematic-group-mathematics', 'probability', 'local');
    const libraryBefore = app.workspace.getLeavesOfType(VIEW.library)[0];
    libraryBefore.view.contentEl.scrollTop = 144;
    libraryBefore.view.selectedElementId = 'source-fixture-book';
    await plugin.nav.openModule('module-fixture-m2');
    const beforeBack = plugin.router.snapshot();
    check('feature navigation persists a product route rather than an Obsidian view type',
      beforeBack.current.name === 'module-detail' && beforeBack.current.moduleId === 'module-fixture-m2'
      && !('type' in beforeBack.current));
    await plugin.nav.back();
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
    await plugin.nav.openLibraryHome('sources');
    const routeBeforeSearch = plugin.router.snapshot().current;
    const modal = plugin.nav.openGlobalSearch('Advanced ML');
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

    const projectSearch = plugin.nav.openGlobalSearch('Bachelor thesis');
    const projectResult = projectSearch.contentEl.find('los-search-result')
      .find((row) => row.allText().includes('Bachelor thesis'));
    check('global search returns first-class projects', Boolean(projectResult));
    projectResult.fire('click'); await tick(); await tick();
    check('a project search result opens the project route',
      plugin.router.snapshot().current.name === 'project-detail'
      && plugin.router.snapshot().current.projectId === 'project-fixture-thesis');

    const emptySearch = plugin.nav.openGlobalSearch('definitely-unfindable-fixture');
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
};
