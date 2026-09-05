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
  waitFor,
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
    /* ADR-016 moved the generated map behind the Diagnostics corpus lens: it is
     * a secondary view (decision 10), not the thing the screen opens on. It is
     * still one control away from the entry state, and still reachable. */
    atlas.contentEl.findText('los-atlas-record', 'Diagnostics').fire('click');
    await tick();
    app.workspace.getLeavesOfType(VIEW.atlas)[0].view.contentEl
      .findText('los-btn', 'Open generated domain map').fire('click');
    await tick();
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

    // The seed is persisted as a recovery record before it is sent, so the
    // envelope appears after an awaited save rather than on the next tick.
    await waitFor(
      () => calls.envelopes.some(
        (envelope) => envelope.capability === 'garden.seed.create',
      ) && !plugin.gateway.isBusy,
    );

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

  /* ADR-016 retired the Module x Concept crossing as the Atlas default; ADR-015
   * decision 5 went with it. What replaced it is a focused prerequisite graph,
   * so what is checked here is the focused graph's own behaviour rather than a
   * renamed version of the crossing's. The crossing itself survives as the
   * Cross-module bridges lens and is covered there. */
  heading('focused prerequisite atlas');
  {
    const { app, plugin } = await boot();
    await plugin.nav.openAtlas();
    let view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    let text = view.contentEl.allText();

    check('the Atlas opens on search and recent focuses, not on the corpus',
      text.includes('Search concepts')
      && text.includes('Recently visited')
      && !text.includes('Module \u00d7 Concept atlas'));
    check('the entry state sizes the corpus without spreading it on the screen',
      text.includes('5 concepts')
      && text.includes('5 authored relations')
      && text.includes('4 of them order learning'));

    /* A4. A manifest refresh is not a reason to interrupt a half-typed query:
     * the field is rebuilt by the redraw, so focus and caret have to be carried
     * across it deliberately. The caret sits mid-word, not at the end, because
     * restoring to the end would still lose the learner's place. */
    const search = view.contentEl.find('los-atlas-search-input')[0];
    search.focus();
    search.typeText('cond');
    search.setSelectionRange(2, 2);
    check('typing filters concepts without redrawing the field under the caret',
      view.contentEl.find('los-atlas-search-results')[0].allText()
        .includes('Conditional probability')
      && global.document.activeElement === search);

    await plugin.reloadStore();
    await tick();
    view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    const refreshed = view.contentEl.find('los-atlas-search-input')[0];
    check('an unrelated manifest refresh preserves the query, the focus and the caret',
      refreshed !== search
      && refreshed.value === 'cond'
      && global.document.activeElement === refreshed
      && refreshed.selectionStart === 2 && refreshed.selectionEnd === 2);

    /* A2. The same authored row read from the other end. "requires" is not
     * symmetric, so a headline built from the far endpoint alone would say
     * that Conditional probability requires Bayes theorem. */
    await plugin.nav.openAtlas({ concept: 'concept-bayes' });
    await tick();
    const fromDependent = app.workspace.getLeavesOfType(VIEW.atlas)[0].view
      .contentEl.find('los-atlas-outline-row')
      .find((row) => row.getAttribute('data-relation-id')
        === 'concept-bayes--requires--concept-bedingte-wahrscheinlichkeit');

    await plugin.nav.openAtlas({ concept: 'concept-bedingte-wahrscheinlichkeit' });
    await tick();
    view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    const fromPrerequisite = view.contentEl.find('los-atlas-outline-row')
      .find((row) => row.getAttribute('data-relation-id')
        === 'concept-bayes--requires--concept-bedingte-wahrscheinlichkeit');

    check('one relation reads the same from either endpoint',
      Boolean(fromDependent) && Boolean(fromPrerequisite)
      && fromDependent.allText().includes('Bayes theorem requires Conditional probability')
      && fromPrerequisite.allText().includes('Bayes theorem requires Conditional probability')
      && !fromPrerequisite.allText().includes('Conditional probability requires Bayes theorem'));

    /* A3. The outline is a complete alternative to the picture, not a summary
     * of the focus's own adjacency: an edge between two drawn neighbours is
     * still an edge the picture shows. */
    const drawn = view.contentEl.find('los-atlas-node')
      .map((node) => node.getAttribute('data-atlas-concept'));
    const stated = view.contentEl.find('los-atlas-outline-row')
      .map((row) => row.getAttribute('data-relation-id'));
    check('the outline carries edges between neighbours, not only the focus\u2019s own',
      stated.includes('concept-logistic-regression--builds-on--concept-bayes')
      && drawn.includes('concept-logistic-regression') && drawn.includes('concept-bayes'));
    check('every stated relation has both endpoints drawn, and none is stated twice',
      stated.length === new Set(stated).size
      && stated.every((id) => id && id.split('--').length === 3));

    /* The package's acceptance condition: one relation, three surfaces, one
     * sentence. A picture that says something the outline does not is a
     * picture the keyboard reader is denied. */
    fromPrerequisite.fire('click');
    await tick();
    view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    const sentence = 'Bayes theorem requires Conditional probability';
    const node = view.contentEl.find('los-atlas-node')
      .find((row) => row.getAttribute('data-atlas-concept') === 'concept-bayes');
    const inspector = view.contentEl.find('los-atlas-inspector')[0];
    check('graph, outline and inspector describe the selected relation identically',
      Boolean(node) && Boolean(inspector)
      && node.allText().includes(sentence)
      && fromPrerequisite.allText().includes(sentence)
      && inspector.allText().includes(sentence));
    check('inspecting a connection does not re-centre the view on the other concept',
      plugin.router.snapshot().current?.concept === 'concept-bedingte-wahrscheinlichkeit');

    /* Provenance keeps its three states apart: recorded, absent, unresolvable.
     * The semantic lens is where all three are on screen at once, because the
     * unresolved citation is the one carried by the semantic edge. */
    await plugin.nav.openAtlas({ concept: 'concept-bayes', lens: 'semantic' });
    await tick();
    view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    text = view.contentEl.allText();
    check('the three provenance states stay distinct and none is invented',
      text.includes('source Fixture probability book')
      && text.includes('No source recorded')
      && text.includes('source-fixture-missing does not resolve'));
    check('the semantic layer is stated without joining the prerequisite order',
      view.contentEl.find('los-atlas-outline-row')
        .some((row) => row.getAttribute('data-relation-id')
          === 'concept-bayes--contrasts-with--concept-frequentist-inference')
      && text.includes('excluded from path order'));

    /* Retained from the crossing-table coverage this block replaced: the
     * evidence trail still reaches the exact unit and stage, and Back still
     * returns to the concept rather than to the entry state. */
    await plugin.nav.openAtlas({ concept: 'concept-bayes' });
    await tick();
    view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    check('Atlas selection is persisted in the product route',
      plugin.router.snapshot().current?.name === 'atlas'
      && plugin.router.snapshot().current?.concept === 'concept-bayes');

    view.contentEl.find('los-filter-tab')
      .find((tab) => tab.allText().includes('Evidence')).fire('click');
    await tick();
    view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    check('module evidence is reachable and names what exists, not what was understood',
      view.contentEl.allText().includes('what exists, not what was understood')
      && view.contentEl.find('los-item').length === 2);

    view.contentEl.findText('los-item', 'Bayes decision rule').fire('click');
    await tick(); await tick();
    check('evidence drills into the exact published unit and stage',
      plugin.router.snapshot().current?.name === 'unit'
      && plugin.router.snapshot().current?.unitId === 'unit-fixture-aml-l04'
      && plugin.router.snapshot().current?.stageId === 'stage-fixture-aml-bayes');

    await plugin.nav.back();
    await tick();
    check('Back restores the selected Atlas concept rather than losing the drill-down',
      plugin.router.snapshot().current?.name === 'atlas'
      && plugin.router.snapshot().current?.concept === 'concept-bayes');

    plugin.onunload();
  }

  /* ADR-017. A question is the learner's, it lives on the note that carries it,
   * and it is not a claim about the graph. These checks are mostly about what
   * recording one must NOT do. */
  heading('atlas questions');
  {
    const { app, plugin, calls } = await boot();
    await plugin.nav.openAtlas();
    let view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;

    const rows = view.contentEl.find('los-atlas-question-row');
    const text = view.contentEl.allText();
    check('open questions appear by their explicit target, resolved ones do not',
      rows.length === 3
      && text.includes('My open questions')
      && text.includes('Why does Bayes need the conditional first?')
      && text.includes('On Bayes theorem and Conditional probability')
      && text.includes('Is this really a prerequisite or just how it was taught?')
      && text.includes('On the connection Bayes theorem requires Conditional probability')
      && !text.includes('Settled: probability before conditioning'));

    const orphan = rows.find((row) => row.classes.has('is-orphaned'));
    check('a question whose target is gone keeps that target and stops being a link',
      Boolean(orphan)
      && orphan.allText().includes('Bayes theorem derives Frequentist inference')
      && orphan.allText().includes('no longer authored')
      && orphan.tag !== 'button'
      && !rows.filter((row) => row.classes.has('is-clickable'))
        .some((row) => row.allText().includes('derivation link')));

    /* The load-bearing one: a recorded question is not an edge. */
    await plugin.nav.openAtlas({ concept: 'concept-bayes' });
    await tick();
    view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    const stated = view.contentEl.find('los-atlas-outline-row')
      .map((row) => row.getAttribute('data-relation-id'));
    check('four questions add no relation to the graph and no arrow to the picture',
      // Three prerequisite rows plus the one authored semantic relation this
      // lens does not draw — every row an authored relation, none a question.
      stated.length === 4
      && !stated.includes('concept-bayes--derives--concept-frequentist-inference')
      && plugin.store.relations().length === 5);

    /* F10 (2026-09-05 audit): the header said one semantic link was hidden by
     * the lens while the outline beneath it said none was authored. Three
     * different quantities — authored, drawn, absent — and the outline must
     * not collapse them. */
    const outlineText = view.contentEl.find('los-atlas-outline')[0].allText();
    check('a filtered semantic relation is reported as hidden, never as absent',
      outlineText.includes('Semantic · 1 authored, 0 drawn by this lens')
      && outlineText.includes('hidden by the selected lens')
      && !outlineText.includes('No authored semantic relations')
      && view.contentEl.find('los-atlas-outline-row--hidden-by-lens').length === 1);
    check('a hidden relation is still inspectable rather than merely mentioned',
      view.contentEl.find('los-atlas-outline-row--hidden-by-lens')[0]
        .getAttribute('data-relation-id')
        === 'concept-bayes--contrasts-with--concept-frequentist-inference'
      && view.contentEl.find('los-atlas-outline-row--hidden-by-lens')[0]
        .classes.has('is-clickable'));

    check('a concept carries the questions recorded against it, and only those',
      view.contentEl.find('los-atlas-questions')[0].allText()
        .includes('Why does Bayes need the conditional first?')
      && !view.contentEl.find('los-atlas-questions')[0].allText()
        .includes('just how it was taught'));

    view.contentEl.find('los-atlas-outline-row')
      .find((row) => row.getAttribute('data-relation-id')
        === 'concept-bayes--requires--concept-bedingte-wahrscheinlichkeit')
      .fire('click');
    await tick();
    view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    const band = view.contentEl.find('los-atlas-questions')[0];
    check('a selected connection carries the question recorded against the connection',
      Boolean(band)
      && band.allText().includes('Is this really a prerequisite or just how it was taught?')
      && band.allText().includes('1 open of 1'));

    /* Absence is absence of a recorded question, never evidence of mastery. */
    await plugin.nav.openAtlas({ concept: 'concept-logistic-regression' });
    await tick();
    view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    const absence = view.contentEl.find('los-atlas-questions')[0].allText();
    check('no recorded question is stated as absence, not as understanding',
      absence.includes('No question recorded against Logistic regression')
      && !/understood|understand|mastered|complete/i.test(absence));

    /* The write. ADR-017 lifted ADR-016 decision 9's read-only boundary, so the
     * Atlas can reach the gateway — through one named port, not a general
     * mutate. What it may carry is the point: an id and a state, never the
     * target and never the learner's words. */
    const settle = async () => {
      for (let i = 0; i < 8; i += 1) { await tick(); await frame(); }
    };
    await plugin.nav.openAtlas({ concept: 'concept-bayes' });
    await tick();
    view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    view.contentEl.find('los-atlas-question-action')[0].fire('click');
    await settle();
    const saved = calls.envelope('atlas.question.save');
    check('resolving a question sends one guarded capability envelope',
      Boolean(saved)
      && saved.expected_snapshot === FIXTURE_SNAPSHOT
      && JSON.stringify(saved.expected_revisions)
        === JSON.stringify({ 'note-fixture-question-concepts': 0 }));
    check('the write carries an id and a state, never the target or the wording',
      Boolean(saved)
      && JSON.stringify(saved.payload) === JSON.stringify({
        question: { id: 'note-fixture-question-concepts', state: 'resolved' },
      }));

    await plugin.nav.openAtlas({ concept: 'concept-wahrscheinlichkeit' });
    await tick();
    view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    const reopen = view.contentEl.find('los-atlas-question-action')[0];
    check('a resolved question offers to be asked again, not marked incomplete',
      Boolean(reopen) && reopen.allText() === 'Ask it again');
    reopen.fire('click');
    await settle();
    const reopened = calls.envelopes
      .filter((envelope) => envelope.capability === 'atlas.question.save').pop();
    check('reopening sends the same capability with the opposite state',
      Boolean(reopened)
      && JSON.stringify(reopened.payload) === JSON.stringify({
        question: { id: 'note-fixture-question-resolved', state: 'open' },
      }));

    await plugin.nav.openAtlas();
    await tick();
    view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    view.contentEl.find('los-atlas-question-row')
      .find((row) => row.allText().includes('Why does Bayes need the conditional first?'))
      .fire('click');
    await tick();
    check('opening a question focuses the concept it was recorded against',
      plugin.router.snapshot().current?.name === 'atlas'
      && plugin.router.snapshot().current?.concept === 'concept-bayes');

    plugin.onunload();
  }

  /* ADR-017 decision 1 and 3. Aram authors the graph; this is the editor that
   * makes that true rather than aspirational. What the checks defend is that
   * the sentence on screen is the assertion written, that an edit binds the
   * exact previous row, and that none of it needs an AI. */
  heading('authoring connections');
  {
    const { app, plugin, calls } = await boot();
    const settle = async () => {
      for (let i = 0; i < 8; i += 1) { await tick(); await frame(); }
    };
    const atlas = () => app.workspace.getLeavesOfType(VIEW.atlas)[0].view;

    await plugin.nav.openAtlas({ concept: 'concept-bayes' });
    await tick();
    atlas().contentEl.find('los-atlas-connect-action')[0].fire('click');
    await tick();
    let view = atlas();
    check('connecting starts from the focused concept with the other end to choose',
      view.contentEl.find('los-atlas-editor').length === 1
      && view.contentEl.find('los-atlas-editor-sentence')[0].allText()
        === 'Bayes theorem requires the concept you choose.'
      && view.contentEl.find('los-atlas-editor-result').length > 0);
    check('the far end never offers the concept already chosen',
      !view.contentEl.find('los-atlas-editor-result')
        .some((row) => row.allText() === 'Bayes theorem'));
    check('an incomplete claim cannot be saved, and says what is missing',
      view.contentEl.find('los-atlas-editor')[0].allText()
        .includes('Choose the concept at the other end')
      && view.contentEl.find('los-atlas-editor-save')[0].getAttribute('disabled') === 'true');

    view.contentEl.find('los-atlas-editor-result')
      .find((row) => row.allText() === 'Probability').fire('click');
    await tick();
    view = atlas();
    check('the preview is the assertion, and names the study order it implies',
      view.contentEl.find('los-atlas-editor-sentence')[0].allText()
        === 'Bayes theorem requires Probability.'
      && view.contentEl.find('los-atlas-editor-preview')[0].allText()
        .includes('Learn Probability before Bayes theorem'));

    view.contentEl.find('los-atlas-editor-save')[0].fire('click');
    await settle();
    const added = calls.envelope('concept.relations.change');
    check('saving sends exactly one authored add, guarded on the registry',
      Boolean(added)
      && added.expected_snapshot === FIXTURE_SNAPSHOT
      && JSON.stringify(added.expected_revisions)
        === JSON.stringify({ 'registry-concept-relations': 0 })
      && JSON.stringify(added.payload) === JSON.stringify({
        change: {
          operations: [{
            action: 'add',
            new: { from: 'concept-bayes', type: 'requires', to: 'concept-wahrscheinlichkeit' },
          }],
        },
      }));
    check('authoring a connection needs no AI provider',
      !calls.some((args) => args[0] === 'ai-action-prepare' || args[0] === 'ask'));

    /* An edit binds the previous row byte for byte, including the parts the
     * projection would have turned into nulls. */
    await plugin.nav.openAtlas({ concept: 'concept-bayes' });
    await tick();
    atlas().contentEl.find('los-atlas-outline-row')
      .find((row) => row.getAttribute('data-relation-id')
        === 'concept-bayes--requires--concept-bedingte-wahrscheinlichkeit')
      .fire('click');
    await tick();
    atlas().contentEl.find('los-atlas-edit-connection')[0].fire('click');
    await tick();
    view = atlas();
    check('changing a connection opens it as authored, wording and source intact',
      view.contentEl.find('los-atlas-editor-context')[0].value
        === 'Bayes rewrites a conditional, so the conditional comes first.'
      && view.contentEl.find('los-atlas-editor-source')[0].value === 'source-fixture-book'
      && view.contentEl.find('los-atlas-editor-preview')[0].allText()
        .includes('Was: Bayes theorem requires Conditional probability'));

    view.contentEl.find('los-atlas-editor-swap')[0].fire('click');
    await tick();
    view = atlas();
    check('swapping the ends changes the claim visibly rather than being tidied away',
      view.contentEl.find('los-atlas-editor-sentence')[0].allText()
        === 'Conditional probability requires Bayes theorem.');

    view.contentEl.find('los-atlas-editor-save')[0].fire('click');
    await settle();
    const replaced = calls.envelopes
      .filter((envelope) => envelope.capability === 'concept.relations.change').pop();
    check('an edit binds the exact previous row, not a reconstruction of it',
      JSON.stringify(replaced.payload.change.operations[0]) === JSON.stringify({
        action: 'replace',
        old: {
          from: 'concept-bayes',
          type: 'requires',
          to: 'concept-bedingte-wahrscheinlichkeit',
          context: 'Bayes rewrites a conditional, so the conditional comes first.',
          source: 'source-fixture-book',
        },
        new: {
          from: 'concept-bedingte-wahrscheinlichkeit',
          type: 'requires',
          to: 'concept-bayes',
          context: 'Bayes rewrites a conditional, so the conditional comes first.',
          source: 'source-fixture-book',
        },
      }));

    /* Removal names the exact assertion, and says what it does not touch. */
    await plugin.nav.openAtlas({ concept: 'concept-logistic-regression' });
    await tick();
    atlas().contentEl.find('los-atlas-outline-row')
      .find((row) => row.getAttribute('data-relation-id')
        === 'concept-logistic-regression--builds-on--concept-bayes')
      .fire('click');
    await tick();
    view = atlas();
    check('removal names the assertion and what stays untouched',
      view.contentEl.allText()
        .includes('Removing takes away the claim that Logistic regression builds on Bayes theorem')
      && view.contentEl.allText().includes('any question recorded about them stay exactly as they are'));

    view.contentEl.find('los-atlas-remove-connection')[0].fire('click');
    await settle();
    const removed = calls.envelopes
      .filter((envelope) => envelope.capability === 'concept.relations.change').pop();
    check('removing sends the exact stored row and nothing else',
      JSON.stringify(removed.payload.change.operations[0]) === JSON.stringify({
        action: 'remove',
        old: {
          from: 'concept-logistic-regression',
          type: 'builds-on',
          to: 'concept-bayes',
          source: 'source-fixture-islp',
        },
      }));

    /* Cancel is not a write. */
    const before = calls.envelopes.length;
    await plugin.nav.openAtlas({ concept: 'concept-bayes' });
    await tick();
    atlas().contentEl.find('los-atlas-connect-action')[0].fire('click');
    await tick();
    atlas().contentEl.find('los-atlas-editor-cancel')[0].fire('click');
    await settle();
    check('cancelling writes nothing and closes the editor',
      calls.envelopes.length === before
      && atlas().contentEl.find('los-atlas-editor').length === 0);

    plugin.onunload();
  }
};
