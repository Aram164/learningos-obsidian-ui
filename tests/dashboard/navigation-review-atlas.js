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
};
