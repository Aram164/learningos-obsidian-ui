'use strict';

const { path, fs, ROOT, VIEW, waitFor, check, heading, boot } = require('./support');
const { createSourceModuleLoader } = require('../source-module-loader');

/** The body the plugin writes to in this harness, however a test reached it. */
const body = () => global.document.body;

module.exports = async function run() {
  heading('interface designs: the switch');
  {
    const { app, plugin } = await boot();
    const home = () => app.workspace.getLeavesOfType(VIEW.home)[0].view.contentEl;
    const nav = () => app.workspace.getLeavesOfType(VIEW.nav)[0].view.contentEl;
    check('a vault that never chose keeps Classic, with no attribute at all',
      plugin.settings.uiDesign === 'classic' && !body().hasAttribute('data-los-ui'));
    check('Classic draws its own screens', home().find('los-continue').length === 1 && home().find('sd-hero').length === 0);
    check('Classic offers the toggle under More', nav().find('los-design-switch').length === 1
      && nav().find('los-design-switch-option').length >= 2);

    plugin.settings.palette = 'carbon';
    await plugin.setInterfaceDesign('study-desk');
    check('switching sets the attribute and redraws in place',
      body().getAttribute('data-los-ui') === 'study-desk'
      && home().find('sd-hero').length === 1 && nav().find('sd-nav-search').length === 1);
    check('Study Desk does not inherit Classic’s scheme',
      !body().hasAttribute('data-los-palette') && plugin.settings.palette === 'carbon');
    check('every design’s sidebar offers the way back',
      nav().find('los-design-switch').length >= 1
      && nav().findText('los-design-switch-option', 'Classic') !== null);

    await plugin.setDesignPalette('lamplight');
    check('a design keeps its own scheme', body().getAttribute('data-los-palette') === 'lamplight'
      && plugin.settings.uiDesignPalettes['study-desk'] === 'lamplight' && plugin.settings.palette === 'carbon');
    await plugin.setInterfaceDesign('classic');
    check('coming back restores Classic and its scheme exactly',
      !body().hasAttribute('data-los-ui') && body().getAttribute('data-los-palette') === 'carbon'
      && home().find('los-continue').length === 1);
    await plugin.setInterfaceDesign('study-desk');
    check('and going again restores that design’s scheme', body().getAttribute('data-los-palette') === 'lamplight');
    await plugin.setDesignPalette('carbon');
    check('a scheme a design was not drawn for falls back to its default', !body().hasAttribute('data-los-palette'));
    await plugin.setInterfaceDesign('no-such-design');
    check('an unknown design degrades to Classic', plugin.settings.uiDesign === 'classic' && !body().hasAttribute('data-los-ui'));
    check('the switch is reachable as commands',
      ['next-interface-design', 'use-interface-design-classic', 'use-interface-design-study-desk']
        .every((id) => plugin.commands.some((command) => command.id === id)));
    plugin.onunload();
    check('unloading leaves the body clean', !body().hasAttribute('data-los-ui'));
  }

  heading('interface designs: Study Desk keeps every write path');
  {
    const { app, plugin, calls } = await boot();
    await plugin.setInterfaceDesign('study-desk');
    await plugin.nav.openUnit('unit-fixture-sad-l04');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    check('opening a unit shows its plan', view.contentEl.find('sd-route').length === 1);
    const filled = () => view.contentEl.find('los-btn--cta');
    check('the plan has one filled action', filled().length === 1);
    check('the plan keeps the import, sequence and adjust controls',
      view.contentEl.allText().includes('Sequence for this sitting')
      && view.contentEl.allText().includes('Adjust study plan'));
    check('every stage lists all its own materials, counted',
      view.contentEl.find('sd-stop-materials').length > 0);
    view.contentEl.findText('los-filter-tab', 'Materials').fire('click');
    check('the lecture’s materials open as one counted list, every placement once',
      view.contentEl.find('sd-mat-sheet').length === 1 && view.contentEl.find('sd-mrow').length === 4
      && view.contentEl.find('sd-material-grid').length === 0 && view.contentEl.findText('sd-mat-count', '4 of 4') !== null);
    view.contentEl.findText('los-filter-tab', 'Stages').fire('click');

    view.contentEl.findText('los-btn', 'Continue stage').fire('click');
    await waitFor(() => view.contentEl.find('sd-book-spread').length === 1);
    const spread = view.contentEl;
    check('choosing to work opens the open-book session',
      spread.find('sd-page-left').length === 1 && spread.find('sd-page-right').length === 1
      && spread.find('sd-strip-tab').length > 1);
    check('the session has one filled action', filled().length === 1);
    check('stage history and every secondary action stay reachable',
      ['Pause unit', 'Skip stage', 'Report prerequisite gap', 'Prepare shelving'].every((label) => spread.allText().includes(label))
      && spread.allText().includes('Stage notes and history'));

    const boxes = spread.find('sd-proof').map((row) => row.children.find((child) => child.tag === 'input'));
    const before = calls.envelopes.length;
    for (const box of boxes) { box.checked = true; box.fire('change'); }
    check('ticking a proof writes nothing to Core', calls.envelopes.length === before);
    const complete = spread.findText('los-btn', 'Complete stage');
    check('once every proof is true, Complete becomes the filled action',
      boxes.length > 0 && complete.classes.has('los-btn--cta') && filled().length === 1);
    complete.fire('click');
    await waitFor(() => Boolean(calls.envelope('stage.progress.update')) && !plugin.gateway.isBusy);
    check('completing sends the same stage progress write and no ability evidence',
      Boolean(calls.envelope('stage.progress.update'))
      && !calls.envelopes.some((envelope) => envelope.capability.startsWith('learner.')
        || envelope.capability.startsWith('ability.')));
    plugin.onunload();
  }

  heading('interface designs: the Atlas as a map');
  {
    const { app, plugin } = await boot();
    await plugin.setInterfaceDesign('study-desk');
    await plugin.nav.openAtlas({ concept: null, lens: 'prerequisites' });
    const view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    check('Atlas opens on the map, not on a global graph',
      view.contentEl.find('sd-map-canvas').length === 1 && view.contentEl.find('sd-region').length > 0);
    const region = view.contentEl.find('sd-region-head').find((node) => node.allText().includes('Mathematics'));
    region.fire('click');
    await waitFor(() => view.contentEl.find('sd-region-sheet').length === 1);
    check('a region opens in study order', view.contentEl.find('sd-region-sheet').length === 1);
    await plugin.nav.openAtlas({ concept: null, lens: 'domains' });
    await waitFor(() => view.contentEl.find('sd-map-canvas').length === 0);
    check('Notes & shelves keeps its complete classic screen',
      view.contentEl.allText().includes('Notes') && view.contentEl.find('sd-map-canvas').length === 0);
    plugin.onunload();
  }

  heading('interface designs: a module at a glance, and why a prerequisite comes first (F5, F1)');
  {
    const lectureMaps = (manifest) => {
      const unit = (id) => manifest.units.find((row) => row.id === id);
      const node = (id, title, ...builds) => ({ id, title, summary: `${title}: one sentence.`, ...(builds.length ? { builds_on: builds } : {}) });
      unit('unit-fixture-sad-l02').knowledge_map = { summary: 'Probability from first principles.', nodes: [
        node('knowledge-fx-l02-space', 'Sample spaces'), node('knowledge-fx-l02-axioms', 'Probability axioms', 'knowledge-fx-l02-space')] };
      unit('unit-fixture-sad-l04').knowledge_map = { summary: 'Bayes from conditioning.', nodes: [
        node('knowledge-fx-l04-cond', 'Conditioning'), node('knowledge-fx-l04-total', 'Total probability', 'knowledge-fx-l04-cond'),
        node('knowledge-fx-l04-bayes', 'Bayes theorem', 'knowledge-fx-l04-cond', 'knowledge-fx-l04-total'), node('knowledge-fx-l04-update', 'Updating beliefs', 'knowledge-fx-l04-bayes', 'knowledge-fx-l04-cond')] };
      unit('unit-fixture-analysis').kind = 'exam-block';
      unit('unit-fixture-analysis').knowledge_map = { summary: 'Exam practice.', nodes: [node('knowledge-fx-an-mock', 'Mixed mocks')] };
    };
    const { app, plugin, calls } = await boot({ patchManifest: lectureMaps });
    await plugin.setInterfaceDesign('study-desk');
    const before = calls.envelopes.length;
    await plugin.nav.openAtlas({ concept: null, lens: 'prerequisites' });
    const view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    const root = () => view.contentEl;
    const group = (title) => root().find('sd-side-group').find((node) => node.allText().startsWith(title));
    check('the Atlas offers each module that has lecture maps, to revise it',
      group('Revise a module')?.allText().includes('M2F module map') && group('Revise a module').allText().includes('2 lectures · 6 ideas'));
    group('Revise a module').find('sd-side-row')[0].fire('click');
    await waitFor(() => root().find('sd-mm-sheet').length === 1);
    const lectures = () => root().find('sd-mm-lecture');
    check('the module map has one row per lecture, in course order',
      lectures().length === 2 && lectures()[0].allText().includes('Sample spaces') && lectures()[1].allText().includes('Bayes theorem'));
    const columns = lectures()[1].find('sd-mm-column').map((column) => column.find('sd-mm-idea').map((node) => node.children[0].allText()).join('|'));
    check('a lecture’s ideas sit left to right by what they build on',
      columns.join(' / ') === 'Conditioning / Total probability / Bayes theorem / Updating beliefs', columns.join(' / '));
    const bayes = lectures()[1].find('sd-mm-idea').find((node) => node.children[0].allText() === 'Bayes theorem');
    check('each idea tells a screen reader what it builds on',
      bayes.find('los-sr-only')[0]?.allText() === ', builds on Conditioning and Total probability', bayes.allText());
    check('ideas are not links: the map is for study (D14)', root().find('sd-mm-idea').every((node) => node.tag === 'div'));
    check('an exam block is named under the map, not drawn as a lecture',
      root().allText().includes('is an exam block, not a lecture, so it has no row here.') && !root().allText().includes('Mixed mocks'));
    check('the map is drawn from the route’s existing module field', view.state.module === 'module-fixture-m2' && view.state.concept === null);
    root().find('sd-crumb').find((node) => node.allText() === 'Atlas').fire('click');
    await waitFor(() => root().find('sd-map-canvas').length === 1);
    check('the Atlas crumb leaves the module map', view.state.module === null && root().find('sd-mm-sheet').length === 0);

    await plugin.nav.openAtlas({ concept: 'concept-bayes', lens: 'prerequisites' });
    await waitFor(() => root().find('sd-need').length > 0);
    check('each prerequisite says why it comes first, in its relation’s own words (D15)',
      root().find('sd-need-why').map((node) => node.allText()).join() === 'Bayes rewrites a conditional, so the conditional comes first.');
    const signpost = group('See it in its module');
    check('the concept page leads to the map of each module that teaches it, at its lecture',
      signpost?.allText().includes('M2F module map') && signpost.allText().includes('Lecture 04 · all 6 ideas, one row per lecture'),
      signpost?.allText());
    signpost.find('sd-side-row')[0].fire('click');
    await waitFor(() => root().find('sd-mm-sheet').length === 1);
    check('the module map opens marked at that lecture',
      lectures().find((node) => node.classes.has('is-here'))?.allText().includes('Bayes theorem') === true);
    await plugin.nav.openAtlas({ concept: 'concept-bedingte-wahrscheinlichkeit', lens: 'prerequisites' });
    await waitFor(() => root().find('sd-need').length > 0);
    check('a prerequisite with no recorded reason shows none, never an invented one',
      root().find('sd-need').length === 1 && root().find('sd-need-why').length === 0);
    check('reading maps and reasons writes nothing to Core', calls.envelopes.length === before);
    plugin.onunload();
  }

  heading('interface designs: the model and the stylesheet');
  {
    const load = createSourceModuleLoader(ROOT);
    const { buildConceptMap, studyOrderLayout, moduleOverlap, overlapKey, UNGROUPED, layoutLectureMap } = load('src/designs/study-desk/atlas-model.ts');
    const concept = (id) => ({ id, label: id, sortKey: id, record: { id } });
    const edge = (from, to, layer = 'strict') => ({ id: `${from}--requires--${to}`, from, to, type: 'requires', layer, studyFrom: from, studyTo: to, prerequisiteId: from, dependentId: to, context: null, source: null });
    const concepts = ['a', 'b', 'c', 'd', 'lonely'].map(concept);
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'd')];
    const graph = {
      concepts, conceptById: new Map(concepts.map((row) => [row.id, row])), edges,
      modulesByConcept: new Map([['a', ['m1', 'm2']], ['b', ['m1']]]),
    };
    const note = (folder, ...ids) => ({ path: `knowledge/notes/${folder}/n.md`, concepts: ids });
    const map = buildConceptMap([note('mathematics', 'a', 'b'), note('systems', 'b'), note('mathematics', 'b'), note('systems', 'c', 'd')], graph);
    check('a concept is placed where most of its notes live', map.regionOf.get('b') === 'mathematics' && map.regionOf.get('c') === 'systems');
    check('a concept with no note stays Not yet grouped, never guessed', map.regionOf.get('lonely') === UNGROUPED);
    check('links between regions are counted from authored relations',
      map.links.length === 1 && map.links[0].count === 1);
    const order = studyOrderLayout(['a', 'b', 'lonely'], graph);
    const at = (id) => order.placed.find((row) => row.id === id);
    check('reading left to right never asks for something not yet introduced',
      at('a').column < at('b').column && at('b').column < at('c').column);
    check('what lies outside the region is marked and goes beyond it',
      at('c').visiting && order.beyond === at('c').column && !at('a').visiting);
    check('an unlinked member is listed, not floated', order.unlinked.includes('lonely') && !at('lonely'));
    const cycle = studyOrderLayout(['x', 'y'], {
      ...graph, edges: [edge('x', 'y'), edge('y', 'x')],
    });
    check('a cycle in the records cannot hang the layout', cycle.placed.length === 2);
    check('overlap counts concepts two modules share, in either order',
      moduleOverlap(graph).get(overlapKey('m2', 'm1')).join() === 'a');

    // F5: one lecture's ideas, shaped like AML L02's map.
    const idea = (id, ...buildsOn) => ({ id, title: id, buildsOn });
    const lecture = layoutLectureMap([idea('rep'), idea('alg', 'rep'), idea('dist', 'rep'), idea('dim', 'dist'), idea('bias', 'alg'), idea('val', 'bias')]);
    check('a lecture map reads left to right by what each idea builds on',
      JSON.stringify(lecture.columns) === JSON.stringify([['rep'], ['alg', 'dist'], ['bias', 'dim'], ['val']]), JSON.stringify(lecture.columns));
    check('inside a column an idea follows the row of what it builds on, not only the map order',
      lecture.columns[2][0] === 'bias' && lecture.links.length === 5);
    const loose = layoutLectureMap([idea('a', 'a', 'elsewhere'), idea('b', 'a', 'a')]);
    check('a link to itself or to an idea outside the lecture is not drawn',
      loose.links.length === 1 && JSON.stringify(loose.columns) === '[["a"],["b"]]');
    check('a cycle in a lecture map cannot hang the layout',
      layoutLectureMap([idea('x', 'y'), idea('y', 'x')]).columns.flat().length === 2);

    const stylesDir = path.join(ROOT, 'src', 'styles');
    const designSheets = fs.readdirSync(stylesDir).filter((name) => /^\d\d-design-(?!switch)/.test(name));
    check('there is a stylesheet per design', designSheets.length >= 1);
    for (const name of designSheets) {
      const css = fs.readFileSync(path.join(stylesDir, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      let depth = 0; let top = ''; const selectors = [];
      for (const char of css) {
        if (char === '{') { if (depth === 0) selectors.push(top.trim()); depth += 1; } else if (char === '}') { depth -= 1; top = ''; } else if (depth === 0) top += char;
      }
      check(`${name}: every rule sits inside its design's one block`,
        selectors.length === 1 && /^body\[data-los-ui="[a-z-]+"\]$/.test(selectors[0]), selectors.join(' | '));
    }
  }

  heading('interface designs: Study Desk catalogue, view-owned mode, completed stage');
  {
    const { app, plugin } = await boot();
    await plugin.setInterfaceDesign('study-desk');
    await plugin.nav.openModules();
    const modulesView = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    check('the Study Desk module catalogue is not empty',
      modulesView.contentEl.find('sd-module-list').length > 0
      && modulesView.contentEl.allText().includes('Fixture Statistics'));
    const moduleRow = modulesView.contentEl.find('sd-module-list')[0].children
      .find(row => row.allText().includes('Fixture Statistics'));
    moduleRow.fire('click');
    await waitFor(() => modulesView.contentEl.find('sd-module-head').length === 1);
    check('the whole Study Desk module row opens its detail',
      modulesView.contentEl.find('sd-module-head').length === 1
      && modulesView.contentEl.allText().includes('Fixture Statistics'));
    await plugin.nav.openModules();
    const search = modulesView.contentEl.find('sd-search-input')[0];
    search.value = 'no such fixture module'; search.fire('input');
    check('a genuinely unmatched Study Desk module query keeps its empty state',
      modulesView.contentEl.find('sd-module-list').length === 0
      && modulesView.contentEl.allText().includes('No module matches “no such fixture module”.'));

    await plugin.nav.openUnit('unit-fixture-sad-l04');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const completed = view.contentEl.find('sd-stop-head')
      .find((node) => node.getAttribute?.('aria-label') === 'Open stage: Event spaces')
      ?? view.contentEl.findText('sd-stop-head', 'Event spaces');
    completed.fire('click');
    await waitFor(() => view.contentEl.find('sd-book-spread').length === 1);
    check('a completed stage offers no Complete action',
      view.contentEl.findText('los-btn', 'Complete stage') === null
      && view.contentEl.findText('los-btn', 'Stage complete') !== null
      && view.contentEl.findText('los-btn', 'Stage complete').disabled === true);
    check('the completed session keeps one filled action',
      view.contentEl.find('los-btn--cta').length === 1);
    plugin.onunload();
  }
  {
    const load = createSourceModuleLoader(ROOT);
    const mode = load('src/designs/study-desk/unit-mode.ts');
    const hostA = {};
    const hostB = {};
    mode.setUnitMode(hostA, 'unit-x', 'session');
    check('unit mode belongs to its view, not the module',
      mode.unitMode(hostA, 'unit-x') === 'session' && mode.unitMode(hostB, 'unit-x') === 'plan');
    mode.clearUnitMode(hostA, 'unit-x');
    check('clearing a view mode leaves the default plan',
      mode.unitMode(hostA, 'unit-x') === 'plan');
    mode.requestSession('unit-y');
    check('a session request is consumed once by the next view',
      mode.unitMode(hostB, 'unit-y') === 'session' && mode.unitMode(hostA, 'unit-y') === 'plan');
    mode.setUnitMode(hostA, 'unit-z', 'plan');
    mode.requestSession('unit-z');
    check('a session request overrides a mode its view already recorded, without leaking',
      mode.unitMode(hostA, 'unit-z') === 'session' && mode.unitMode(hostB, 'unit-z') === 'plan');
  }

  heading('interface designs: paused sessions stay quiet and explicitly reachable');
  for (const design of ['classic', 'study-desk', 'focus']) {
    const { app, plugin, calls } = await boot({ patchManifest(manifest) {
      manifest.modules.find(row => row.id === 'module-fixture-m2').unit_order = [
        'unit-fixture-sad-l04', 'unit-fixture-analysis', 'unit-fixture-sad-l02',
      ];
      manifest.units.find(row => row.id === 'unit-fixture-sad-l04').status = 'paused';
      manifest.study_maps.find(row => row.unit_id === 'unit-fixture-sad-l04').status = 'paused';
    } });
    await plugin.setInterfaceDesign(design);
    const before = calls.envelopes.length;
    await plugin.nav.openModuleDetail('module-fixture-m2', null, 'units');
    const root = app.workspace.getLeavesOfType(VIEW.module)[0].view.contentEl;
    const paused = root.find('los-paused-units')[0];
    const elements = node => [node, ...node.children.flatMap(elements)];
    const unitRows = elements(root).filter(node => node.tag === 'button'
      && node.getAttribute('aria-label')?.startsWith('Open unit: '));
    const current = unitRows.filter(node => !paused?.contains(node));
    check(`${design}: current sessions retain authored order before the paused disclosure`,
      current.map(row => row.getAttribute('aria-label')).join('|')
        === 'Open unit: Analysis exam prep|Open unit: SaD Lecture 02 — Descriptive statistics'
      && unitRows.length === 3 && unitRows[2] === unitRows.find(row => paused?.contains(row)));
    check(`${design}: paused sessions use a closed native disclosure and remain labelled`,
      paused?.tag === 'details' && !paused.hasAttribute('open')
      && paused.children[0].allText() === 'Paused sessions · 1');
    if (paused) paused.open = true;
    unitRows.find(row => paused?.contains(row))?.fire('click');
    await waitFor(() => app.workspace.getLeavesOfType(VIEW.unit).length > 0);
    check(`${design}: opening paused work preserves its route and creates no learning write`,
      app.workspace.getLeavesOfType(VIEW.unit)[0]?.view.contentEl.allText().includes('Probability & Bayes')
      && calls.envelopes.length === before);
    plugin.onunload();
  }

  heading('interface designs: StructuralEditModal reference defaults');
  {
    const { app, plugin } = await boot();
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const root = app.workspace.getLeavesOfType(VIEW.unit)[0].view.contentEl;
    const { Modal } = require('../harness').stub;
    const { browserDom } = require('./browser-dom');
    plugin.gateway.checkStructuralEdit = async () => ({
      result: { canonical_files_written: 0, diff: { replacement: false, content_changes: [], map_changes: [] } },
    });
    plugin.gateway.importUnitMap = async () => {};
    root.findText('los-btn', 'Adjust study plan').fire('click');
    const modal = Modal.last;
    browserDom(modal.contentEl);
    const findLabel = (text) => modal.contentEl.children.find((e) => e.tag === 'label' && e.text.startsWith(text));
    const action = findLabel('Change').children[0];
    const kind = findLabel('Activity').children[0];
    const triage = findLabel('Priority').children[0];
    check('the Activity select offers Reference',
      kind.children.some((o) => (o.value ?? o._attrs?.value) === 'reference'));
    action.value = 'resource_append';
    action.fire('change');
    check('appending defaults to a reference placement',
      kind.value === 'reference' && triage.value === 'reference-only');
    plugin.onunload();
  }

  heading('Focus projects: one complete collection and a reliable return');
  for (const projectCount of [0, 2]) {
    const { app, plugin, calls } = await boot({ patchManifest(manifest) {
      for (const record of [...manifest.modules, ...manifest.records]) {
        if (record.id === 'module-fixture-thesis' && projectCount === 0) record.kind = 'skill';
        if (record.id === 'module-fixture-python' && projectCount === 2) record.kind = 'project';
      }
    } });
    await plugin.setInterfaceDesign('focus');
    const nav = app.workspace.getLeavesOfType(VIEW.nav)[0].view.contentEl;
    nav.findText('focus-nav-item', 'Thesis & projects').fire('click');
    await waitFor(() => app.workspace.getLeavesOfType(VIEW.module)[0]?.view.contentEl.getAttribute('data-focus-collection') === 'projects');
    const view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    check(`sidebar opens all ${projectCount} projected projects without choosing one`,
      view.contentEl.getAttribute('data-focus-screen') === 'modules'
      && view.contentEl.find('focus-row').length === projectCount
      && view.contentEl.allText().includes(`${projectCount} of ${projectCount} projects`));
    if (!projectCount) check('an empty project collection has an honest recovery',
      view.contentEl.allText().includes('No projects are recorded yet')
      && view.contentEl.findText('los-filter-tab', 'All') !== null);
    else {
      const input = view.contentEl.find('focus-search')[0];
      input.value = 'thesis'; input.fire('input');
      view.contentEl.scrollTop = 173;
      view.contentEl.find('focus-row')[0].fire('click');
      await waitFor(() => view.contentEl.getAttribute('data-focus-screen') === 'module');
      view.contentEl.findText('los-btn', 'Back to projects').fire('click');
      await waitFor(() => view.contentEl.getAttribute('data-focus-screen') === 'modules');
      check('project detail returns to the selected collection, query, row and position',
        view.contentEl.getAttribute('data-focus-collection') === 'projects'
        && view.contentEl.find('focus-search')[0].value === 'thesis'
        && view.contentEl.find('focus-row').length === 1
        && view.contentEl.find('focus-row')[0].classes.has('is-current')
        && view.contentEl.scrollTop === 173);
      const other = app.workspace.getLeaf(true);
      await other.setViewState({ type: VIEW.module, state: { screen: 'groups' } });
      check('a separate module leaf keeps independent collection attention',
        other.view.contentEl.getAttribute('data-focus-collection') === 'open'
        && view.contentEl.getAttribute('data-focus-collection') === 'projects');
    }
    await plugin.nav.openLearn('program-bachelors');
    const learn = app.workspace.getLeavesOfType(VIEW.program)[0].view;
    learn.contentEl.findText('los-btn', 'Thesis & projects').fire('click');
    await waitFor(() => view.contentEl.getAttribute('data-focus-collection') === 'projects');
    check('Learn uses the same project collection as the sidebar',
      view.contentEl.getAttribute('data-focus-screen') === 'modules'
      && view.contentEl.getAttribute('data-focus-collection') === 'projects'
      && calls.envelopes.length === 0);
    plugin.onunload();
  }
};

