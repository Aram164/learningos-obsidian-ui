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
  check,
  heading,
  build,
  boot,
} = require('./support');

module.exports = async function run() {
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
      && nav.find('los-nav-secondary')[0].allText().includes('Future Master’s Planning')
      && !nav.find('los-nav-secondary')[0].allText().includes('Job'));
    check('legacy global path and entity taxonomy are absent', !text.includes('Learning path') && !text.includes('Collections'));
    nav.findText('los-app-nav-item', 'Learn').fire('click'); await tick();
    check('Learn opens one destination carrying every area',
      app.workspace.getLeavesOfType(VIEW.program)[0].view.contentEl.allText().includes('Fixture Advanced ML'));
    check('the active destination is visually and semantically marked',
      nav.findText('los-app-nav-item', 'Learn')?.classes.has('is-active')
      && nav.findText('los-app-nav-item', 'Learn')?.getAttribute('aria-current') === 'page');
    await plugin.nav.openReview();
    const reviewRoot = app.workspace.getLeavesOfType(VIEW.review)[0].view.contentEl;
    const review = reviewRoot.allText();
    check('Review renders Core-owned decision records rather than reconstructing queues',
      reviewRoot.find('los-review-decision-row').length === plugin.store.reviewItems().length
      && review.includes('Plan Analysis exam prep')
      && review.includes('This unit needs a study map')
      && reviewRoot.find('los-review-count-badge').length === 1
      && reviewRoot.find('los-filter-tabs').length === 1);
    await plugin.nav.openDiagnostics();
    await tick(); await tick();
    const diagnosticsRoot = app.workspace.getLeavesOfType(VIEW.diagnostics)[0].view.contentEl;
    const diagnostics = diagnosticsRoot.allText();
    check('Diagnostics reports contract, freshness and interpreter',
      diagnostics.includes('Manifest contract') && diagnostics.includes('Python interpreter')
      && diagnostics.includes('Snapshot'));
    check('Diagnostics health is Core-owned and actionable',
      diagnostics.includes('Health checks')
      && diagnostics.includes('Manifest contract is current')
      && diagnostics.includes('Owner')
      && diagnostics.includes('Remedy')
      && calls.some((args) => args.join(' ') === 'health-report --json'));
    check('Diagnostics exposes the installed UI build identity',
      diagnostics.includes('UI source revision') && diagnostics.includes('UI source fingerprint')
      && diagnostics.includes('UI bundle fingerprint') && diagnostics.includes('Build Node')
      && diagnostics.includes('Copy build identity'));
    check('the ownership statement is stated once, in Diagnostics/About',
      diagnostics.includes('buttons are conveniences, never duties'));
    diagnosticsRoot.findText('los-btn', 'Legacy Archive').fire('click');
    await tick(); await tick();
    const archive = diagnosticsRoot.allText();
    check('Legacy Archive stays a bounded diagnostics surface',
      archive.includes('Archive lock verified')
      && archive.includes('sealed, not inspected')
      && archive.includes('Historical only')
      && calls.some((args) => args.join(' ') === 'legacy-archive-status --json'));
    await plugin.nav.openBoundary('program-masters-planning');
    const mastersRoot = app.workspace.getLeavesOfType(VIEW.boundary)[0].view.contentEl;
    check('Future Master’s Planning is visibly prospective before access',
      mastersRoot.allText().includes('Prospective—not current LearningOS')
      && mastersRoot.allText().includes('normal manifest, search, workload'));
    check('restoring the surface does not silently confirm prospective access',
      !calls.some((args) => args[0] === 'masters-planning-dashboard'));
    mastersRoot.findText('los-btn', 'Open prospective planning').fire('click');
    await tick(); await tick();
    const masters = mastersRoot.allText();
    check('a deliberate gesture opens only the sanitized prospective catalog',
      masters.includes('Fixture prospective module')
      && masters.includes('Fixture prospective source')
      && masters.includes('selected')
      && masters.includes('deep reviewed')
      && masters.includes('concept-bayes')
      && masters.includes('Fixture candidate section — Probability notation.')
      && masters.includes('Fixture companion section — Odds notation.')
      && calls.some((args) => args.join(' ') === 'masters-planning-dashboard --confirm-masters-planning'));
    await plugin.nav.openGarden();
    check('Garden marks Garden, not Review, as the active destination',
      nav.findText('los-app-nav-item', 'Garden')?.classes.has('is-active')
      && !nav.findText('los-app-nav-item', 'Review')?.classes.has('is-active'));
    nav.findText('los-app-nav-item', 'Concept atlas').fire('click'); await tick();
    /* The atlas is a decision surface, not a document: opening it must give a
     * navigable view. The Markdown file stays reachable from inside it, because
     * it is still the session-bootstrap artifact (core CLAUDE.md §2.8). */
    const atlas = app.workspace.getLeavesOfType(VIEW.atlas)[0]?.view;
    check('Concept atlas navigation opens the atlas view, not a Markdown wall',
      Boolean(atlas) && !app.workspace.opened.includes('generated/domain-atlas.md'));
    atlas.contentEl.findText('los-btn', 'Open generated domain map').fire('click'); await tick();
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

    plugin.nav.openShelving = (unitId) => {
      opened.push(`shelving:${unitId}`);
    };

    plugin.nav.openUnit = (unitId) => {
      opened.push(`unit:${unitId}`);
    };

    await plugin.nav.openReview();

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

    await plugin.nav.openGarden();

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
          === FIXTURE_SNAPSHOT,
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

    await plugin.nav.openGarden();

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

  heading('module by concept atlas');
  {
    const { app, plugin } = await boot();
    await plugin.nav.openAtlas();
    const view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    let text = view.contentEl.allText();
    check('the Atlas defaults to concepts shared across modules',
      text.includes('Module × Concept atlas')
      && text.includes('Bayes theorem')
      && !text.includes('Conditional probability'));
    check('every module stays visible, including a module with zero mapped concepts',
      text.includes('AMLF') && text.includes('M2F') && text.includes('Python')
      && view.contentEl.find('los-crossing-col').length === 3);
    check('the shared crossing has one row and two evidence-backed cells',
      view.contentEl.find('los-crossing-row').length === 1
      && view.contentEl.find('is-filled').length === 2);

    view.contentEl.findText('los-filter-tab', 'All concepts').fire('click');
    text = view.contentEl.allText();
    check('the explicit all-concepts toggle reveals single-module concepts',
      text.includes('Conditional probability')
      && view.contentEl.find('los-crossing-row').length === 2);

    view.contentEl.findText('los-crossing-concept', 'Bayes theorem').fire('click');
    await tick(); await tick();
    text = app.workspace.getLeavesOfType(VIEW.atlas)[0].view.contentEl.allText();
    check('a selected concept exposes the exact authored evidence',
      text.includes('Taught in 2 modules')
      && text.includes('Stage tag · Bayes decision rule')
      && text.includes('Stage tag · Conditional probability and Bayes'));
    check('the drill-down keeps published notes, sources, and concept relations reachable',
      text.includes('Linked notes')
      && text.includes('Fixture probability reference')
      && text.includes('Source evaluations')
      && text.includes('Fixture probability book')
      && text.includes('Concept relationships')
      && text.includes('Bayes theorem builds on Conditional probability'));
    check('Atlas selection is persisted in the product route',
      plugin.router.snapshot().current?.name === 'atlas'
      && plugin.router.snapshot().current?.concept === 'concept-bayes');

    app.workspace.getLeavesOfType(VIEW.atlas)[0].view.contentEl
      .findText('los-item', 'Bayes decision rule').fire('click');
    await tick(); await tick();
    check('evidence drills into the exact published unit and stage',
      plugin.router.snapshot().current?.name === 'unit'
      && plugin.router.snapshot().current?.unitId === 'unit-fixture-aml-l04'
      && plugin.router.snapshot().current?.stageId === 'stage-fixture-aml-bayes');

    await plugin.nav.back();
    text = app.workspace.getLeavesOfType(VIEW.atlas)[0].view.contentEl.allText();
    check('Back restores the selected Atlas concept rather than losing the drill-down',
      plugin.router.snapshot().current?.name === 'atlas'
      && plugin.router.snapshot().current?.concept === 'concept-bayes'
      && text.includes('Stage tag · Bayes decision rule'));

    app.workspace.getLeavesOfType(VIEW.atlas)[0].view.contentEl
      .findText('los-btn', 'Open generated domain map').fire('click');
    await tick();
    check('the generated textual atlas remains available only as a fallback',
      app.workspace.opened.includes('generated/domain-atlas.md'));
    plugin.onunload();
  }
};
