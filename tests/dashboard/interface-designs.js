'use strict';

const { path, fs, ROOT, VIEW, waitFor, check, heading, boot, makeApp, FIXTURE, LearningOSUI, tick } = require('./support');
const { createSourceModuleLoader } = require('../source-module-loader');

/** The body the plugin writes to in this harness, however a test reached it. */
const body = () => global.document.body;

module.exports = async function run() {
  heading('interface designs: the switch');
  {
    const { app, plugin } = await boot({ settings: { uiDesign: undefined } });
    const home = () => app.workspace.getLeavesOfType(VIEW.home)[0].view.contentEl;
    const nav = () => app.workspace.getLeavesOfType(VIEW.nav)[0].view.contentEl;
    check('a vault that never chose defaults to Study Desk',
      plugin.settings.uiDesign === 'study-desk' && body().getAttribute('data-los-ui') === 'study-desk');
    check('Study Desk draws its own screens', home().find('sd-hero').length === 1 && nav().find('sd-nav-search').length === 1);
    check('Study Desk offers the toggle under More', nav().find('los-design-switch').length === 2
      && nav().find('los-design-switch-option').length >= 4);

    await plugin.setDesignPalette('lamplight');
    check('Study Desk remembers its own scheme',
      body().getAttribute('data-los-palette') === 'lamplight'
      && plugin.settings.uiDesignPalettes['study-desk'] === 'lamplight');
    await plugin.setInterfaceDesign('focus');
    check('switching sets the Focus attribute and redraws in place with Daylight',
      body().getAttribute('data-los-ui') === 'focus'
      && body().getAttribute('data-los-palette') === 'daylight'
      && home().find('focus-resume').length === 1 && nav().find('focus-nav-search').length === 1);
    check('every design’s sidebar offers the way back',
      nav().find('los-design-switch').length >= 1
      && nav().findText('los-design-switch-option', 'Study Desk') !== null);

    /* Obsidian 1.15 paints a saved snapshot of the workspace while it starts,
     * and the snapshot keeps only the body's `class` and `style`. The design
     * and the scheme must therefore be classes, or every launch shows the base
     * palette and the wrong layout until the real views replace the picture. */
    const bodyClasses = () => [...body().classes].filter((name) => name.startsWith('los-')).sort();
    check('the design and its scheme ride in body classes the startup snapshot keeps',
      JSON.stringify(bodyClasses()) === JSON.stringify(['los-palette-daylight', 'los-ui-focus']),
      bodyClasses().join(' '));
    await plugin.setDesignPalette('nightfall');
    check('switching the scheme swaps its class rather than adding another',
      JSON.stringify(bodyClasses()) === JSON.stringify(['los-palette-nightfall', 'los-ui-focus']),
      bodyClasses().join(' '));
    check('Focus keeps its own scheme', body().getAttribute('data-los-palette') === 'nightfall'
      && plugin.settings.uiDesignPalettes.focus === 'nightfall'
      && plugin.settings.uiDesignPalettes['study-desk'] === 'lamplight');
    await plugin.setInterfaceDesign('study-desk');
    check('coming back restores Study Desk and its scheme exactly',
      body().getAttribute('data-los-ui') === 'study-desk'
      && body().getAttribute('data-los-palette') === 'lamplight'
      && home().find('sd-hero').length === 1);
    await plugin.setInterfaceDesign('focus');
    check('and going again restores Focus’s scheme', body().getAttribute('data-los-palette') === 'nightfall');
    await plugin.setDesignPalette('carbon');
    check('a scheme a design was not drawn for falls back to its default',
      body().getAttribute('data-los-palette') === 'daylight');
    await plugin.setInterfaceDesign('classic');
    check('retired classic degrades to Study Desk',
      plugin.settings.uiDesign === 'study-desk' && body().getAttribute('data-los-ui') === 'study-desk');
    await plugin.setInterfaceDesign('no-such-design');
    check('an unknown design degrades to Study Desk',
      plugin.settings.uiDesign === 'study-desk' && body().getAttribute('data-los-ui') === 'study-desk');
    check('the switch is reachable as commands',
      ['next-interface-design', 'use-interface-design-study-desk', 'use-interface-design-focus']
        .every((id) => plugin.commands.some((command) => command.id === id))
      && !plugin.commands.some((command) => command.id === 'use-interface-design-classic'));
    plugin.onunload();
    check('unloading leaves the body clean', !body().hasAttribute('data-los-ui')
      && !body().hasAttribute('data-los-palette')
      && ![...body().classes].some((name) => name.startsWith('los-ui-') || name.startsWith('los-palette-')));
  }

  heading('interface designs: a restart reuses the restored tab');
  {
    /* Obsidian restores every tab before the plugin asks for its last route.
     * `restore` used to open that route in a new tab anyway, so each launch
     * added one identical tab (15 → 16 → 17 in a real vault over three
     * restarts). It must bring the restored tab forward instead, while
     * preserving existing identical-route tabs: a learner may intentionally
     * keep two tabs with independent transient view state. */
    const app = makeApp(FIXTURE);
    const home = app.workspace.getLeaf(true);
    home.viewType = VIEW.home; home.state = {}; home.pinned = true;
    const restored = app.workspace.getLeaf(true);
    restored.viewType = VIEW.module; restored.state = { screen: 'groups' };
    const leftover = app.workspace.getLeaf(true);
    leftover.viewType = VIEW.module; leftover.state = { screen: 'groups' };
    const other = app.workspace.getLeaf(true);
    other.viewType = VIEW.module; other.state = { screen: 'list', groupId: 'fixture-group', query: '' };
    const plugin = new LearningOSUI(app, { id: 'learningos-ui', version: 'test' });
    app._plugin = plugin;
    plugin._data = {
      uiDesign: 'study-desk', pinHome: true, openHomeOnStartup: true,
      navigation: { version: 1, current: { name: 'module-groups' }, history: [] },
    };
    await plugin.onload(); await app.workspace._ready(); await tick(); await tick();
    const modules = app.workspace.getLeavesOfType(VIEW.module);
    check('the restored tab shows the last route and no new tab opens for it',
      !restored.detached && modules.includes(restored)
      && modules.filter((leaf) => leaf.getViewState().state.screen === 'groups').length === 2,
      modules.map((leaf) => JSON.stringify(leaf.getViewState().state)).join(' | '));
    check('an existing identical-route tab is preserved on startup', !leftover.detached);
    check('a tab showing a different route is the learner’s and stays', !other.detached && modules.includes(other));
    check('the pinned Home tab stays', !home.detached && app.workspace.getLeavesOfType(VIEW.home).length === 1);
    /* Quit and relaunch: Obsidian writes the tabs to workspace.json and
     * restores them before the plugin loads again. */
    const saved = [VIEW.home, VIEW.module].flatMap((type) => app.workspace.getLeavesOfType(type))
      .map((leaf) => ({ type: leaf.viewType, state: leaf.getViewState().state, pinned: leaf.pinned }));
    plugin.onunload();
    const relaunched = makeApp(FIXTURE);
    for (const tab of saved) {
      const leaf = relaunched.workspace.getLeaf(true);
      leaf.viewType = tab.type; leaf.state = tab.state; leaf.pinned = tab.pinned;
    }
    const again = new LearningOSUI(relaunched, { id: 'learningos-ui', version: 'test' });
    relaunched._plugin = again;
    again._data = plugin._data;
    await again.onload(); await relaunched.workspace._ready(); await tick(); await tick();
    check('a second launch adds no tab either',
      relaunched.workspace.getLeavesOfType(VIEW.module).length === saved.filter((tab) => tab.type === VIEW.module).length
      && relaunched.workspace.getLeavesOfType(VIEW.home).length === 1,
      `${relaunched.workspace.getLeavesOfType(VIEW.module).length} module tab(s) for ${saved.length - 1} saved`);
    again.onunload();
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

  heading('interface designs: the Atlas as the shared list');
  {
    const { app, plugin } = await boot();
    await plugin.setInterfaceDesign('study-desk');
    await plugin.nav.openAtlas({ concept: null, lens: 'prerequisites' });
    const view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    check('Study Desk Atlas is the shared list/inspector, restyled not redrawn',
      view.contentEl.find('los-atlas-search-input').length === 1
      && view.contentEl.allText().includes('Explore by domain')
      && view.contentEl.find('sd-map-canvas').length === 0
      && view.contentEl.find('los-atlas-filter-select').length === 3);
    await plugin.nav.openAtlas({ concept: 'concept-bayes', lens: 'prerequisites' });
    await waitFor(() => view.contentEl.find('los-atlas-inspector').length === 1);
    check('the same inspector renders under Study Desk',
      view.contentEl.find('los-atlas-inspector')[0].allText().includes('Prerequisites'));
    await plugin.nav.openAtlas({ concept: null, lens: 'domains' });
    await waitFor(() => view.contentEl.allText().includes('Notes & shelves'));
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
    await plugin.nav.openAtlas({ concept: null, module: 'module-fixture-m2', lens: 'prerequisites' });
    const view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    const root = () => view.contentEl;
    check('the shared browser is filtered by the route module field',
      view.state.module === 'module-fixture-m2' && view.state.concept === null
      && root().find('los-atlas-module-filter')[0].value === 'module-fixture-m2');

    await plugin.nav.openAtlas({ concept: 'concept-bayes', lens: 'prerequisites' });
    await waitFor(() => root().find('los-atlas-inspector').length === 1);
    check('each prerequisite says why it comes first, in its relation’s own words (D15)',
      root().find('los-atlas-inspector')[0].allText()
        .includes('Bayes rewrites a conditional, so the conditional comes first.'));
    await plugin.nav.openAtlas({ concept: 'concept-frequentist-inference', lens: 'prerequisites' });
    await waitFor(() => root().find('los-atlas-inspector').length === 1);
    check('a concept with no authored prerequisites shows that absence, never an invented reason',
      root().find('los-atlas-inspector')[0].allText().includes('No authored prerequisites'));
    check('reading lists and reasons writes nothing to Core', calls.envelopes.length === before);
    plugin.onunload();
  }

  heading('interface designs: the model and the stylesheet');
  {
    // The Study Desk atlas model was deleted with its screen (P4 step 29);
    // domain browsing parity is covered by the shared-renderer suites.
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
        selectors.length === 1 && /^body\.los-ui-[a-z-]+$/.test(selectors[0]), selectors.join(' | '));
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
      && modulesView.contentEl.allText().includes('No module or lecture matches “no such fixture module”.'));

    await plugin.nav.openUnit('unit-fixture-sad-l04');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const completed = view.contentEl.find('sd-stop-head')
      .find((node) => node.getAttribute?.('aria-label') === 'Open stage: Event spaces')
      ?? view.contentEl.findText('sd-stop-head', 'Event spaces');
    completed.fire('click');
    await waitFor(() => view.contentEl.find('sd-book-spread').length === 1);
    const next = view.contentEl.findText('los-btn--cta', 'Next: stage 2');
    check('a completed stage offers Next and shows the criteria without inventing checked proofs',
      view.contentEl.findText('los-btn', 'Complete stage') === null
      && next && view.contentEl.find('sd-proof').length === 0
      && view.contentEl.find('sd-proof-criteria')[0]?.children.length > 0
      && view.contentEl.findText('sd-proof-tally', 'Proof checks are session-only.'));
    check('the completed session keeps one filled action',
      view.contentEl.find('los-btn--cta').length === 1);
    check('stage tabs expose the full stage name and status on hover',
      view.contentEl.find('sd-strip-tab')[1].getAttribute('title').includes('Conditional probability and Bayes'));
    next?.fire('click');
    await waitFor(() => view.stageId === 'stage-fixture-conditioning');
    check('Next opens the following stage in the session', view.stageId === 'stage-fixture-conditioning'
      && view.contentEl.find('sd-book-spread').length === 1);
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
  }

  heading('Study Desk assessment: honest Home, legacy Learn and pane history');
  {
    const { app, plugin, calls } = await boot({
      settings: { uiDesign: 'study-desk', pinHome: false },
      patchManifest(manifest) { manifest.resume_pointer = {}; },
    });
    const pane = app.workspace.getLeavesOfType(VIEW.home)[0];
    const root = () => pane.view.contentEl;
    const control = (label) => root().find('sd-history-button').find((node) => node.getAttribute('aria-label') === label);
    check('Home without a resume pointer suggests nothing and lists modules neutrally',
      root().find('sd-home-suggestion').length === 0 && root().findText('los-btn--cta', 'Start stage') === null
      && root().findText('sd-heading', 'Modules') !== null && root().find('sd-module-row').length > 0
      && !root().findText('sd-hero-kicker', 'Continue where you stopped'));
    await plugin.nav.openLearn('program-skills');
    check('a legacy Learn route opens Modules with the corresponding area selected',
      root().findText('sd-title', 'Modules') && root().findText('los-filter-tab', 'Skills').getAttribute('aria-pressed') === 'true'
      && plugin.activeNav === 'modules');
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    root().findText('los-filter-tab', 'Materials').fire('click');
    const other = app.workspace.getLeaf(true);
    await other.setViewState({ type: VIEW.unit, state: { unitId: 'unit-fixture-sad-l04', stageId: 'stage-fixture-foundations' } });
    app.workspace.setActiveLeaf(other);
    check('another pane opens the same lecture with its own stage, mode, and empty history',
      other.view.stageId === 'stage-fixture-foundations' && other.view.contentEl.find('sd-route').length === 1
      && other.view.contentEl.find('sd-history-button').every((node) => node.disabled));
    control('Back').fire('click');
    await waitFor(() => root().findText('sd-title', 'Modules'));
    check('Back follows the pane that owns the toolbar and enables Forward',
      root().findText('sd-title', 'Modules') && !control('Forward').disabled);
    control('Forward').fire('click');
    await waitFor(() => root().find('sd-mat-sheet').length > 0);
    check('Forward restores the lecture and its Materials view without changing the other pane',
      root().find('sd-mat-sheet').length === 1 && pane.view.stageId === 'stage-fixture-conditioning'
      && other.view.stageId === 'stage-fixture-foundations' && control('Forward').disabled);
    root().findText('sd-crumb', 'Modules').fire('click');
    await waitFor(() => root().find('sd-modules-body').length > 0);
    check('the lecture’s Modules crumb opens the catalogue and browsing makes no Core writes',
      root().find('sd-modules-body').length === 1 && calls.envelopes.length === 0);
    plugin.onunload();
  }

  {
    const { app, plugin } = await boot({
      settings: { uiDesign: 'study-desk', pinHome: false },
      patchManifest(manifest) {
        manifest.resume_pointer = {};
        manifest.records.find((row) => row.id === 'workspace-fixture-m2').next_action
          = 'Revisit stage 1 Event spaces before continuing.';
      },
    });
    const root = () => app.workspace.getLeavesOfType(VIEW.home)[0].view.contentEl;
    check('no stage is suggested or promoted from the study map or the workspace',
      root().find('sd-home-suggestion').length === 0 && root().findText('los-btn--cta', 'Start stage') === null);
    check('the workspace instruction is shown verbatim as its own plan',
      root().allText().includes('Revisit stage 1 Event spaces before continuing.'));
    check('workspace facts cannot reorder or relabel the neutral rows',
      root().find('sd-module-row').every((row) => !(row.find('sd-row-next')[0]?.allText() ?? '').includes(' · ')));
    plugin.onunload();
  }

  {
    const { app, plugin } = await boot({
      settings: { uiDesign: 'study-desk', pinHome: false },
      patchManifest(manifest) {
        manifest.resume_pointer = {};
        for (const map of manifest.study_maps) {
          for (const stage of map.stages) {
            stage.status = 'complete';
            stage.is_open = false;
          }
        }
        for (const stage of manifest.stages) {
          stage.status = 'complete';
          stage.is_open = false;
        }
      },
    });
    const root = () => app.workspace.getLeavesOfType(VIEW.home)[0].view.contentEl;
    check('with no stage available there is no fallback hero and the plan still speaks for itself',
      root().findText('los-btn--cta', 'Open module') === null
      && root().find('sd-home-suggestion').length === 0
      && root().allText().includes('Work the Conditional probability and Bayes stage'));
    plugin.onunload();
  }

  heading('study desk: the Home list is the neutral candidate pool');
  {
    const { app, plugin } = await boot({ settings: { uiDesign: 'study-desk', pinHome: false }, patchManifest(manifest) {
      manifest.resume_pointer = {};
      manifest.units.find((row) => row.id === 'unit-fixture-aml-l04').status = 'active';
    } });
    const root = () => app.workspace.getLeavesOfType(VIEW.home)[0].view.contentEl;
    const ids = root().find('sd-module-row').map((row) => row.getAttribute('data-record-id'));
    check('the home list is the candidate pool ordered by module ID ascending, closed work excluded',
      JSON.stringify(ids) === JSON.stringify(['module-fixture-aml', 'module-fixture-m2', 'module-fixture-python']), JSON.stringify(ids));
    check('a second active unit promotes nothing: rows keep their aggregate factual state',
      root().find('sd-module-row').every((row) => {
        const next = row.find('sd-row-next')[0]?.allText() ?? '';
        return !row.find('sd-eyebrow').length && next !== '' && !next.includes(' · ') && !next.includes('Stage ');
      }));
    check('every pool row is a plain module target, not a stage shortcut',
      root().find('sd-module-row').every((row) => row.tag === 'button' && (row.getAttribute('aria-labelledby') ?? '').length > 0));
    plugin.onunload();
  }

  heading('study desk: Home consumes Core\u2019s published candidate fact');
  {
    const { app, plugin } = await boot({ settings: { uiDesign: 'study-desk', pinHome: false }, patchManifest(manifest) {
      manifest.resume_pointer = {};
      // Administrative status is metadata, never a filter: the paused module
      // keeps both of its candidate maps.
      manifest.modules.find((row) => row.id === 'module-fixture-m2').status = 'paused';
      // The flags alone decide. Even a map whose authored status and stage
      // would read open is out when Core published false.
      for (const id of ['study-map-fixture-aml-l03', 'study-map-fixture-aml-l04', 'study-map-fixture-python-oop']) {
        manifest.study_maps.find((row) => row.id === id).is_study_candidate = false;
      }
      // unit-fixture-analysis has no study map: no candidate row, no rescue.
    } });
    const root = () => app.workspace.getLeavesOfType(VIEW.home)[0].view.contentEl;
    const ids = root().find('sd-module-row').map((row) => row.getAttribute('data-record-id'));
    check('the flag filters the pool without re-reading map status, stage status, or module status',
      JSON.stringify(ids) === JSON.stringify(['module-fixture-m2']), JSON.stringify(ids));
    check('units that still owe a study map are a separate browsing category, not candidates',
      root().findText('sd-eyebrow', 'Needs a study map') !== null
      && root().allText().includes('Analysis exam prep')
      && !ids.includes('unit-fixture-analysis'));
    plugin.onunload();
  }

  {
    const { app, plugin } = await boot({ settings: { uiDesign: 'study-desk', pinHome: false }, patchManifest(manifest) {
      manifest.resume_pointer = {};
      for (const map of manifest.study_maps) map.is_study_candidate = false;
      // A published true wins even when every authored fact looks closed: the
      // consumer reads the fact, never a second rule.
      const map = manifest.study_maps.find((row) => row.id === 'study-map-fixture-python-oop');
      map.is_study_candidate = true;
      map.status = 'ready-to-shelve';
      const current = map.stages.find((stage) => stage.id === map.current_stage);
      current.status = 'complete';
      current.is_open = false;
      manifest.modules.find((row) => row.id === 'module-fixture-python').status = 'completed';
    } });
    const root = () => app.workspace.getLeavesOfType(VIEW.home)[0].view.contentEl;
    const ids = root().find('sd-module-row').map((row) => row.getAttribute('data-record-id'));
    check('a published candidate stays a candidate under contradictory authored display facts',
      JSON.stringify(ids) === JSON.stringify(['module-fixture-python']), JSON.stringify(ids));
    plugin.onunload();
  }

  heading('study desk: one validated study marker and browse-context navigation');
  {
    const { app, plugin } = await boot({ settings: { uiDesign: 'study-desk' }, patchManifest(manifest) {
      const note = manifest.records.find((row) => row.id === 'note-fixture-probability');
      manifest.records.push({ ...note, id: 'note-fixture-cross-domain', title: 'Systems cross note',
        path: 'knowledge/notes/systems/note-fixture-cross-domain.md', concepts: ['concept-bayes'],
        domain_bucket: 'systems' });
      manifest.counts.notes += 1;
    } });
    await plugin.nav.openAtlas({ lens: 'prerequisites' });
    const atlas = () => app.workspace.getLeavesOfType(VIEW.atlas)[0].view.contentEl;
    check('the shared browser carries both published domains, with no drawing marker',
      atlas().find('los-atlas-place').some((card) => card.getAttribute('data-domain') === 'mathematics')
      && atlas().find('los-atlas-place').some((card) => card.getAttribute('data-domain') === 'systems')
      && !atlas().allText().includes('You are here'));
    atlas().find('los-atlas-place').find((card) => card.getAttribute('data-domain') === 'systems').fire('click');
    await waitFor(() => atlas().find('los-atlas-concept-seed')
      .some((row) => row.getAttribute('data-concept-id') === 'concept-bayes'));
    atlas().find('los-atlas-concept-seed')
      .find((row) => row.getAttribute('data-concept-id') === 'concept-bayes').fire('click');
    await waitFor(() => app.workspace.getLeavesOfType(VIEW.atlas)[0].view.state.concept === 'concept-bayes');
    const crumbs = atlas().find('los-atlas-breadcrumb')[0]?.allText() ?? '';
    check('opened from Systems, the breadcrumb keeps the browsed domain',
      crumbs.includes('Systems'), crumbs);
    await plugin.nav.openModule('module-fixture-m2');
    await waitFor(() => app.workspace.getLeavesOfType(VIEW.module)[0]?.view.contentEl.find('sd-unit-sheet').length === 1);
    const sheet = app.workspace.getLeavesOfType(VIEW.module)[0].view.contentEl;
    check('the validated pointer marks exactly its own unit row in the module sheet',
      sheet.find('sd-unit-row').filter((row) => row.classes.has('is-here')).length === 1);
    plugin.onunload();
  }
  {
    const { app, plugin } = await boot({ settings: { uiDesign: 'study-desk' }, patchManifest(manifest) {
      const note = manifest.records.find((row) => row.id === 'note-fixture-probability');
      manifest.records.push({ ...note, id: 'note-fixture-cross-domain', title: 'Systems cross note',
        path: 'knowledge/notes/systems/note-fixture-cross-domain.md', concepts: ['concept-bayes'],
        domain_bucket: 'systems' });
      manifest.counts.notes += 1;
    } });
    await plugin.nav.openAtlas({ concept: 'concept-bayes', lens: 'prerequisites' });
    await waitFor(() => app.workspace.getLeavesOfType(VIEW.atlas)[0]?.view.contentEl.find('los-atlas-inspector').length > 0);
    const crumbs = app.workspace.getLeavesOfType(VIEW.atlas)[0].view.contentEl.find('los-atlas-breadcrumb')[0]?.allText() ?? '';
    check('a deep link without a browse context opens the concept with no invented domain',
      app.workspace.getLeavesOfType(VIEW.atlas)[0].view.state.concept === 'concept-bayes'
      && !crumbs.includes('Systems'), crumbs);
    plugin.onunload();
  }
  {
    const { app, plugin } = await boot({ settings: { uiDesign: 'study-desk' }, patchManifest(manifest) {
      manifest.resume_pointer = { ...manifest.resume_pointer, study_map_id: 'study-map-fixture-sad-l02' };
    } });
    await plugin.nav.openAtlas({ lens: 'prerequisites' });
    const atlas = () => app.workspace.getLeavesOfType(VIEW.atlas)[0].view.contentEl;
    check('an incoherent pointer draws no study marker on the atlas',
      !atlas().allText().includes('You are here'));
    await plugin.nav.openModule('module-fixture-m2');
    await waitFor(() => app.workspace.getLeavesOfType(VIEW.module)[0]?.view.contentEl.find('sd-unit-sheet').length === 1);
    const sheet = app.workspace.getLeavesOfType(VIEW.module)[0].view.contentEl;
    check('an incoherent pointer marks no unit row as here',
      sheet.find('sd-unit-row').every((row) => !row.classes.has('is-here')));
    plugin.onunload();
  }

  {
    const { app, plugin } = await boot({ settings: { uiDesign: 'study-desk', pinHome: true } });
    const home = app.workspace.getLeavesOfType(VIEW.home)[0];
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-foundations');
    const readingPane = app.workspace.getLeavesOfType(VIEW.unit)[0];
    readingPane.view.contentEl.scrollTop = 240;
    await plugin.nav.openModules();
    await plugin.nav.openHome();
    await plugin.nav.openUnit('unit-fixture-analysis');
    const secondReadingPane = app.workspace.getLeavesOfType(VIEW.unit)[0];
    check('pinned Home opens a separate reading pane with empty history',
      home.pinned && home.getViewState().type === VIEW.home
      && secondReadingPane !== readingPane
      && !plugin.router.paneHistoryAvailable(secondReadingPane, 'back'));
    await plugin.router.movePaneHistory(readingPane, 'back');
    check('Back on the earlier pane restores its lecture and scroll position',
      readingPane.view.unitId === 'unit-fixture-sad-l04'
      && readingPane.view.contentEl.scrollTop === 240
      && secondReadingPane.view.unitId === 'unit-fixture-analysis');
    plugin.onunload();
  }

  heading('interface designs: an incoherent resume pointer draws no resume action');
  for (const design of ['__base_views__', 'focus', 'study-desk']) {
    const { app, plugin } = await boot({
      settings: { uiDesign: design },
      patchManifest(manifest) {
        manifest.resume_pointer = { ...manifest.resume_pointer, study_map_id: 'study-map-fixture-sad-l02' };
      },
    });
    await plugin.nav.openHome();
    const home = app.workspace.getLeavesOfType(VIEW.home)[0].view.contentEl;
    check(`${design}: an unresolvable pointer offers no resume action`,
      !home.allText().includes('Continue where you stopped')
      && !home.allText().includes('Continue learning')
      && home.findText('los-btn', 'Continue session') === null
      && home.findText('los-btn', 'Resume session') === null
      && home.findText('los-btn--cta', 'Continue studying') === null);
    check(`${design}: the ordinary fallback still renders`,
      design === '__base_views__'
        ? home.allText().includes('Nothing to resume yet')
        : home.allText().length > 0);
    plugin.onunload();
  }
  {
    const { app, plugin } = await boot();
    await plugin.nav.openHome();
    const home = app.workspace.getLeavesOfType(VIEW.home)[0].view.contentEl;
    const resume = home.findText('los-btn', 'Continue session');
    check('the valid Stats pointer keeps its resume action', resume !== null);
    resume?.fire('click');
    await waitFor(() => app.workspace.getLeavesOfType(VIEW.unit).length > 0);
    const unit = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    check('the valid pointer opens its exact recorded destination',
      unit.unitId === 'unit-fixture-sad-l04' && unit.stageId === 'stage-fixture-conditioning',
      `${unit.unitId}/${unit.stageId}`);
    plugin.onunload();
  }
  {
    const { app, plugin } = await boot({ patchManifest(manifest) {
      manifest.stages.find((row) => row.id === 'stage-fixture-conditioning').title
        = 'Foreign stage title';
    } });
    await plugin.nav.openHome();
    const home = app.workspace.getLeavesOfType(VIEW.home)[0].view.contentEl;
    check('Classic reads the resume stage from the validated map, not the flat index',
      home.allText().includes('Conditional probability and Bayes')
      && !home.allText().includes('Foreign stage title'), home.allText());
    plugin.onunload();
  }

  heading('interface designs: stage actions follow the lifecycle');
  {
    const { app, plugin, calls } = await boot({ settings: { uiDesign: 'study-desk' } });
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    view.contentEl.findText('los-btn', 'Continue stage')?.fire('click');
    await waitFor(() => view.contentEl.find('sd-book-spread').length === 1);
    const before = calls.envelopes.length;
    const tab = view.contentEl.find('sd-strip-tab')
      .find((node) => node.getAttribute('title')?.includes('Practice and self-test'));
    tab?.fire('click');
    await waitFor(() => view.stageId === 'stage-fixture-self-test');
    check('opening a pending stage from the rail writes nothing',
      calls.envelopes.length === before);
    check('a pending stage offers Activate, not Complete',
      view.contentEl.findText('los-btn', 'Activate stage') !== null
      && view.contentEl.findText('los-btn', 'Complete stage') === null);
    view.contentEl.findText('los-btn', 'Activate stage')?.fire('click');
    await waitFor(() => calls.envelope('stage.progress.update') && !plugin.gateway.isBusy);
    const sent = calls.envelopes.slice(before);
    check('activation sends one guarded stage.progress.update for the exact stage',
      sent.length === 1 && sent[0].payload.unit_id === 'unit-fixture-sad-l04'
      && sent[0].payload.stage_id === 'stage-fixture-self-test'
      && sent[0].payload.status === 'active', JSON.stringify(sent));
    plugin.onunload();
  }
  {
    const { app, plugin, calls } = await boot({ patchManifest(manifest) {
      const map = manifest.study_maps.find((row) => row.id === 'study-map-fixture-sad-l04');
      map.stages.find((row) => row.id === 'stage-fixture-conditioning').status = 'paused';
      manifest.stages.find((row) => row.id === 'stage-fixture-conditioning').status = 'paused';
    } });
    await plugin.setInterfaceDesign('study-desk');
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    view.contentEl.findText('los-btn', 'Continue stage')?.fire('click');
    await waitFor(() => view.contentEl.find('sd-book-spread').length === 1);
    check('a paused stage offers Resume, not Complete',
      view.contentEl.findText('los-btn', 'Resume stage') !== null
      && view.contentEl.findText('los-btn', 'Complete stage') === null);
    const before = calls.envelopes.length;
    view.contentEl.findText('los-btn', 'Resume stage')?.fire('click');
    await waitFor(() => calls.envelope('stage.progress.update') && !plugin.gateway.isBusy);
    const sent = calls.envelopes.slice(before);
    check('resuming a paused stage sends the same activation transition',
      sent.length === 1 && sent[0].payload.status === 'active'
      && sent[0].payload.stage_id === 'stage-fixture-conditioning', JSON.stringify(sent));
    plugin.onunload();
  }
  {
    const { app, plugin, calls } = await boot();
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-self-test');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    check('Classic offers Activate for a pending stage and no Complete',
      view.contentEl.findText('los-btn', 'Activate stage') !== null
      && view.contentEl.findText('los-btn', 'Complete stage') === null);
    const before = calls.envelopes.length;
    view.contentEl.findText('los-btn', 'Activate stage')?.fire('click');
    await waitFor(() => calls.envelope('stage.progress.update') && !plugin.gateway.isBusy);
    check('Classic activation sends one activation envelope',
      calls.envelopes.length === before + 1
      && calls.envelope('stage.progress.update').payload.status === 'active');
    plugin.onunload();
  }

  heading('interface designs: Next finds open work and the sidebar drops finished maps');
  {
    const skipMiddle = (manifest) => {
      const map = manifest.study_maps.find((row) => row.id === 'study-map-fixture-sad-l04');
      const cond = map.stages.find((row) => row.id === 'stage-fixture-conditioning');
      cond.status = 'skipped';
      cond.is_open = false;
      map.stages.find((row) => row.id === 'stage-fixture-self-test').status = 'active';
      map.current_stage = 'stage-fixture-self-test';
      const flatCond = manifest.stages.find((row) => row.id === 'stage-fixture-conditioning');
      flatCond.status = 'skipped';
      flatCond.is_open = false;
      manifest.stages.find((row) => row.id === 'stage-fixture-self-test').status = 'active';
      manifest.resume_pointer = { ...manifest.resume_pointer, stage_id: 'stage-fixture-self-test' };
    };
    const { app, plugin } = await boot({ settings: { uiDesign: 'study-desk' }, patchManifest: skipMiddle });
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-foundations');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    view.contentEl.find('sd-stop-head')
      .find((node) => node.getAttribute?.('aria-label') === 'Open stage: Event spaces')?.fire('click');
    await waitFor(() => view.contentEl.find('sd-book-spread').length === 1);
    const next = view.contentEl.find('los-btn--cta')
      .find((node) => node.allText().startsWith('Next:'));
    check('Study Desk Next names the next open stage, skipping the skipped one',
      next?.allText().includes('Practice and self-test'), next?.allText());
    next?.fire('click');
    await waitFor(() => view.stageId === 'stage-fixture-self-test');
    check('Study Desk Next opens the self-test stage', view.stageId === 'stage-fixture-self-test');
    const rail = view.contentEl.find('sd-strip-tab')
      .find((node) => node.getAttribute('title')?.includes('Conditional probability and Bayes'));
    rail?.fire('click');
    await waitFor(() => view.stageId === 'stage-fixture-conditioning');
    check('the stage rail can still open the skipped stage explicitly',
      view.stageId === 'stage-fixture-conditioning');
    plugin.onunload();

    const focusRun = await boot({ settings: { uiDesign: 'focus' }, patchManifest: skipMiddle });
    await focusRun.plugin.nav.openUnit('unit-fixture-sad-l04');
    const focusView = focusRun.app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    focusView.contentEl.find('focus-row')
      .find((node) => node.allText().includes('Event spaces'))?.fire('click');
    await waitFor(() => focusView.stageId === 'stage-fixture-foundations');
    const focusNext = focusView.contentEl.findText('los-btn', 'Next stage');
    check('Focus offers Next stage from a completed stage', focusNext !== null);
    focusNext?.fire('click');
    await waitFor(() => focusView.stageId === 'stage-fixture-self-test');
    check('Focus Next opens the next open stage', focusView.stageId === 'stage-fixture-self-test');
    focusRun.plugin.onunload();
  }
  {
    const { app, plugin } = await boot({ patchManifest(manifest) {
      const map = manifest.study_maps.find((row) => row.id === 'study-map-fixture-sad-l04');
      map.status = 'ready-to-shelve';
      map.is_study_candidate = false;
      for (const id of ['stage-fixture-conditioning', 'stage-fixture-self-test']) {
        const mapStage = map.stages.find((row) => row.id === id);
        mapStage.status = 'skipped';
        mapStage.is_open = false;
        const flatStage = manifest.stages.find((row) => row.id === id);
        flatStage.status = 'skipped';
        flatStage.is_open = false;
      }
      manifest.units.find((row) => row.id === 'unit-fixture-sad-l04').status = 'ready-to-shelve';
    } });
    await plugin.setInterfaceDesign('study-desk');
    const nav = app.workspace.getLeavesOfType(VIEW.nav)[0].view.contentEl;
    check('a ready-to-shelve map with no open stage leaves the In progress sidebar',
      !nav.allText().includes('In progress') && !nav.allText().includes('1/3'));
    await plugin.nav.openModule('module-fixture-m2');
    const modules = app.workspace.getLeavesOfType(VIEW.module)[0].view.contentEl;
    check('the finished lecture stays reachable in Modules',
      modules.allText().includes('Probability & Bayes'));
    plugin.onunload();
  }

  heading('interface designs: paused sessions stay quiet and explicitly reachable');
  for (const design of ['__base_views__', 'study-desk', 'focus']) {
    const { app, plugin, calls } = await boot({
      settings: { uiDesign: design },
      patchManifest(manifest) {
        manifest.modules.find(row => row.id === 'module-fixture-m2').unit_order = [
          'unit-fixture-sad-l04', 'unit-fixture-analysis', 'unit-fixture-sad-l02',
        ];
        manifest.units.find(row => row.id === 'unit-fixture-sad-l04').status = 'paused';
        manifest.study_maps.find(row => row.unit_id === 'unit-fixture-sad-l04').status = 'paused';
      },
    });
    const before = calls.envelopes.length;
    await plugin.nav.openModuleDetail('module-fixture-m2', null, 'units');
    const root = app.workspace.getLeavesOfType(VIEW.module)[0].view.contentEl;
    const paused = root.find('los-paused-units')[0];
    const elements = node => [node, ...node.children.flatMap(elements)];
    const name = (node) => node.getAttribute('aria-label') ?? node.find('los-sr-only')[0]?.allText();
    const unitRows = elements(root).filter(node => node.tag === 'button' && name(node)?.startsWith('Open unit: '));
    const current = unitRows.filter(node => !paused?.contains(node));
    check(`${design}: current sessions retain authored order before the paused disclosure`,
      current.map(name).join('|')
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

  heading('Focus projects: unified Modules area filter and reliable return');
  for (const projectCount of [0, 2]) {
    const { app, plugin, calls } = await boot({ patchManifest(manifest) {
      for (const record of [...manifest.modules, ...manifest.records]) {
        if (record.id === 'module-fixture-thesis' && projectCount === 0) record.kind = 'skill';
        if (record.id === 'module-fixture-python' && projectCount === 2) record.kind = 'project';
      }
    } });
    await plugin.setInterfaceDesign('focus');
    const nav = app.workspace.getLeavesOfType(VIEW.nav)[0].view.contentEl;
    nav.findText('focus-nav-item', 'Modules').fire('click');
    await waitFor(() => app.workspace.getLeavesOfType(VIEW.module)[0]?.view.contentEl.getAttribute('data-focus-screen') === 'modules');
    const view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    view.contentEl.findText('los-filter-tab', 'Thesis & projects').fire('click');
    await waitFor(() => view.contentEl.getAttribute('data-focus-collection') === 'projects');
    check(`Thesis & projects tab opens all ${projectCount} projected projects`,
      view.contentEl.getAttribute('data-focus-screen') === 'modules'
      && view.contentEl.find('focus-row').length === projectCount);
    if (!projectCount) check('an empty project collection has an honest recovery',
      view.contentEl.allText().includes('No modules in this area')
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
        && view.contentEl.find('focus-module-row').length === 1
        && view.contentEl.find('focus-module-row')[0].classes.has('is-current')
        && view.contentEl.scrollTop === 173);
      const other = app.workspace.getLeaf(true);
      await other.setViewState({ type: VIEW.module, state: { screen: 'groups' } });
      check('a separate module leaf keeps independent collection attention',
        other.view.contentEl.getAttribute('data-focus-collection') === 'all'
        && view.contentEl.getAttribute('data-focus-collection') === 'projects');
    }
    await plugin.nav.openLearn('program-thesis-projects');
    const learn = app.workspace.getLeavesOfType(VIEW.program)[0].view;
    check('Learn project route renders Focus Modules with projects pre-selected and no Core write',
      learn.contentEl.getAttribute('data-focus-screen') === 'modules'
      && learn.contentEl.getAttribute('data-focus-collection') === 'projects'
      && calls.envelopes.length === 0);
    plugin.onunload();
  }
};

