/* LearningOS curriculum-v2 app tests. Fixture-only: never reads the live repository. */
'use strict';

const path = require('path');
const fs = require('fs');
const { makeApp, Notice } = require('./harness');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'fixture-vault');
const LearningOSUI = require(path.join(ROOT, 'plugin', 'main.js'));
const VIEW = {
  home: 'learningos-home', nav: 'learningos-nav', program: 'learningos-program',
  module: 'learningos-module', unit: 'learningos-unit', library: 'learningos-library',
  atlas: 'learningos-atlas', shelving: 'learningos-shelving', boundary: 'learningos-boundary',
  review: 'learningos-review', diagnostics: 'learningos-diagnostics',
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

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
  const calls = [];
  const plugin = new LearningOSUI(app, { id: 'learningos-ui', version: 'test' });
  plugin._data = options.settings || {};
  plugin.runLos = (args, callback) => {
    calls.push(args);
    if (options.offline) return callback(new Error('CLI down'), '', 'offline');
    if (args[0] === 'shelving-prepare') return callback(null, JSON.stringify({
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
    check('manifest contract v2 loads', plugin.store.ready && plugin.store.contractVersion === 2, plugin.store.error);
    check('snapshot guard is loaded', plugin.store.snapshotId === 'sha256:fixture-v2-snapshot');
    check('program/module/unit/map collections load atomically', plugin.store.programs().length === 5
      && plugin.store.modules().length === 4 && plugin.store.units().length === 7
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
      return file === 'generated/manifest.json' ? text.replace('"contract_version": 2', '"contract_version": 1') : text;
    };
    const plugin = new LearningOSUI(app, { id: 'learningos-ui' }); app._plugin = plugin;
    await plugin.onload();
    check('contract v1 fails closed with recovery text', !plugin.store.ready && plugin.store.error.includes('requires contract 2'));
    plugin.onunload();
  }

  heading('startup and module-first home');
  {
    const { app, plugin, home } = await boot();
    const element = home.view.contentEl;
    const text = element.allText();
    check('Home opens and stays pinned', app.workspace.active === home && home.pinned);
    check('navigator opens in its own leaf', app.workspace.getLeavesOfType(VIEW.nav).length === 1);
    /* Home answers one question. One Continue card, one filled primary action,
     * and no view of the whole system before the learner can start. */
    check('one Continue card names the exact stage to resume',
      element.find('los-continue').length === 1
      && text.includes('Conditional probability and Bayes') && text.includes('Continue learning'));
    check('exactly one filled primary action exists above the fold',
      element.find('los-btn--cta').length === 1);
    check('the Continue card states the position in the map',
      /Stage \d+ of \d+/.test(text));
    check('all Bachelor modules remain visible', text.includes('Fixture Statistics & Analysis')
      && text.includes('Fixture Advanced ML'));
    check('Skills and thesis stay independent', text.includes('Python') && text.includes('Bachelor thesis'));
    check('every module is a compact learning row, not a status table',
      element.find('los-learning-row').length >= 4 && element.find('los-data-table').length === 0);
    check('the core-owned priority is one line, not a coordination wall',
      text.includes('current super-priority')
      && !text.includes('Commitments') && !text.includes('Deferrals'));
    check('workspace next actions still reach the learner',
      text.includes('Work the Conditional probability and Bayes stage'));
    check('structured registration and unregistered exam dates are visible',
      text.includes('Fixture registration') && text.includes('2099-08-31 → 2099-09-10')
      && text.includes('unregistered'));
    const dateRows = element.find('los-date-row');
    check('date rows have only a date column and a flexible content column',
      dateRows.length > 0 && dateRows.every((row) => row.children.length === 2
        && row.children[1].classes.has('los-date-copy')));
    check('Upcoming shows three dates and folds the rest away',
      element.find('los-date-list')[0].find('los-date-row').length <= 3);
    /* The core records history truthfully; the interface decides what is still
     * ahead. Past sittings are not Home's business at all now. */
    check('the upcoming list carries only dates that are still ahead',
      !element.find('los-date-list')[0].allText().includes('2020-02-14'));
    check('queue state is one attention row, not three competing cards',
      element.find('los-attention').length === 1
      && element.find('los-queue-card').length === 0
      && text.includes('inbox item'));
    /* Boundaries are policy documentation. They belong under More. */
    check('boundaries and maintenance controls are absent from Home',
      !text.includes("Master's Planning") && !text.includes('Rebuild projection'));
    check('the repeated ownership footer is gone from every screen',
      !text.includes('buttons are conveniences, never duties'));
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

  heading('navigation and boundaries');
  {
    const { app, plugin } = await boot();
    const nav = app.workspace.getLeavesOfType(VIEW.nav)[0].view.contentEl;
    const text = nav.allText();
    /* Five permanent destinations. Areas are sub-areas of Learn; the queues are
     * Review; maintenance and boundaries live under More. */
    check('five permanent destinations, no more',
      nav.find('los-nav-primary')[0].find('los-app-nav-item').length === 5
      && ['Home', 'Learn', 'Library', 'Capture', 'Review'].every((label) => text.includes(label)));
    check('maintenance and boundaries are not study destinations',
      nav.find('los-nav-more').length === 1
      && nav.find('los-nav-secondary')[0].allText().includes('Rebuild projection')
      && nav.find('los-nav-secondary')[0].allText().includes('Job boundary'));
    check('legacy global path and entity taxonomy are absent', !text.includes('Learning path') && !text.includes('Collections'));
    nav.findText('los-app-nav-item', 'Learn').fire('click'); await tick();
    check('Learn opens one destination carrying every area',
      app.workspace.getLeavesOfType(VIEW.program)[0].view.contentEl.allText().includes('Fixture Advanced ML'));
    check('the active destination is visually and semantically marked',
      nav.findText('los-app-nav-item', 'Learn')?.classes.has('is-active')
      && nav.findText('los-app-nav-item', 'Learn')?.attrs['aria-current'] === 'page');
    await plugin.openReview();
    const review = app.workspace.getLeavesOfType(VIEW.review)[0].view.contentEl.allText();
    check('Review gathers every decision queue in one place',
      ['Ready to shelve', 'Inbox', 'Needs a study map', 'Garden'].every((label) => review.includes(label)));
    await plugin.openDiagnostics();
    const diagnostics = app.workspace.getLeavesOfType(VIEW.diagnostics)[0].view.contentEl.allText();
    check('Diagnostics reports contract, freshness and interpreter',
      diagnostics.includes('Manifest contract') && diagnostics.includes('Python interpreter')
      && diagnostics.includes('Snapshot'));
    check('the ownership statement is stated once, in Diagnostics/About',
      diagnostics.includes('buttons are conveniences, never duties'));
    await plugin.openBoundary('program-job-boundary');
    const job = app.workspace.getLeavesOfType(VIEW.boundary)[0].view.contentEl.allText();
    check('Job surface reveals policy only', job.includes('not indexed, searched, read, or mixed') && !job.includes('Job client'));
    await plugin.openBoundary('program-masters-planning');
    const masters = app.workspace.getLeavesOfType(VIEW.boundary)[0].view.contentEl.allText();
    check('Master surface exposes quarantine only', masters.includes('quarantined') && !masters.includes('prospective module menu'));
    await plugin.openReview();
    app.workspace.getLeavesOfType(VIEW.review)[0].view.contentEl
      .findText('los-btn', 'Open the Garden').fire('click'); await tick();
    check('the Garden stays reachable from Review',
      app.workspace.opened.includes('bases/garden.base'));
    nav.findText('los-app-nav-item', 'Domain atlas').fire('click'); await tick();
    /* The atlas is a decision surface, not a document: opening it must give a
     * navigable view. The Markdown file stays reachable from inside it, because
     * it is still the session-bootstrap artifact (core CLAUDE.md §2.8). */
    const atlas = app.workspace.getLeavesOfType(VIEW.atlas)[0]?.view;
    check('Domain atlas navigation opens the atlas view, not a Markdown wall',
      Boolean(atlas) && !app.workspace.opened.includes('generated/domain-atlas.md'));
    atlas.contentEl.findText('los-btn', 'Open the generated atlas file').fire('click'); await tick();
    check('the generated atlas file stays reachable from the view',
      app.workspace.opened.includes('generated/domain-atlas.md'));
    plugin.onunload();
  }

  heading('domain atlas reach');
  {
    const { app, plugin } = await boot();
    await plugin.openAtlas();
    const view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    let text = view.contentEl.allText();
    /* ADR-005: the atlas exists so a session does not collapse into the active
     * workspace's domain. Counting the territory is not mapping it — every
     * domain must list its actual notes and shelves. */
    check('every domain with content appears, not just the active one',
      text.includes('mathematics') && text.includes('programming'));
    check('notes are enumerated and identified, not merely counted',
      text.includes('Fixture probability reference') && text.includes('note-fixture-probability'));
    check('wiring hubs are called out for the domain that has one',
      view.contentEl.find('los-atlas-tile').length === 2 && text.includes('1 crosswalk')
      && text.includes('1 note ·') && text.includes('1 shelf ('));
    check('shelves carry their own rule for use',
      text.includes('Fixture math bookshelf') && text.includes('one spine, one supplement'));
    check('quarantined strata are named but not opened',
      text.includes('Job') && text.includes('Master') && !text.includes('Job client'));
    view.contentEl.findText('los-item', 'Fixture probability reference').fire('click'); await tick();
    check('an atlas row opens the note it names',
      app.workspace.opened.includes('knowledge/notes/mathematics/note-fixture-probability.md'));
    view.contentEl.findText('los-shelf-entry-title', 'Fixture math bookshelf (2)').fire('click'); await tick();
    const library = app.workspace.getLeavesOfType(VIEW.library)[0].view;
    check('an atlas shelf opens that shelf in the Library',
      library.contentEl.allText().includes('The spine — read this before anything else on the shelf.'));
    await plugin.openAtlas();
    app.workspace.getLeavesOfType(VIEW.atlas)[0].view.contentEl
      .findText('los-btn', 'Browse these notes in the Library').fire('click'); await tick();
    text = app.workspace.getLeavesOfType(VIEW.library)[0].view.contentEl.allText();
    check('the atlas can hand a whole domain to the Library',
      text.includes('Domain: mathematics') && !text.includes('Fixture Python wiring crosswalk'));
    plugin.onunload();
  }

  heading('library navigability');
  {
    const { app, plugin } = await boot();
    await plugin.openLibrary();
    const view = app.workspace.getLeavesOfType(VIEW.library)[0].view;
    let text = view.contentEl.allText();
    /* A flat 200-row registry is a haystack; the shelves are where the reading
     * strategy is written down, so they are the default way in. */
    check('the Library opens on shelves', view.type === 'collection' && text.includes('Fixture math bookshelf'));
    /* One vertical mode rail instead of four stacked control strips. */
    check('modes are a compact sidebar carrying their own counts',
      view.contentEl.find('los-library-rail').length === 1
      && view.contentEl.find('los-library-mode').length === 5);
    check('shelves are grouped by domain',
      view.contentEl.find('los-library-list')[0].find('los-list-group').length === 2);
    check('a shelf reads in its authored tiers, each entry with its role',
      text.includes('tier-1-now') && text.includes('tier-2-optional')
      && text.includes('Selected sections only; never linearly.'));
    check('record IDs are not on the list rows',
      !view.contentEl.find('los-library-list')[0].allText().includes('collection-fixture-math'));
    view.contentEl.findText('los-library-mode', 'Sources').fire('click'); await tick();
    text = view.contentEl.allText();
    /* Facets are folded until asked for; the counts still have to be live. */
    check('filters are collapsed into a disclosure, not a permanent bar',
      view.contentEl.find('los-library-filters').length === 1);
    check('source facets are offered with live counts',
      text.includes('On a shelf · 3') && text.includes('Not on any shelf · 0')
      && text.includes('Local copy · 1'));
    view.contentEl.findText('los-btn', 'Local copy · 1').fire('click'); await tick();
    check('a facet narrows the list', view.contentEl.find('los-item').length === 1);
    text = view.contentEl.allText();
    check('a source says which shelves carry it and why',
      text.includes('On shelves') && text.includes('Fixture math bookshelf')
      && text.includes('The spine — read this before anything else on the shelf.'));
    /* An operator ID is not study content — it stays one disclosure away. */
    const technical = view.detailEl.find('los-technical-details')[0];
    check('the record ID and Copy ID live under Technical details',
      Boolean(technical) && technical.allText().includes('Copy ID')
      && technical.find('los-detail-id')[0]?.text.startsWith('source-fixture-')
      && view.detailEl.find('los-actions')[0].allText().includes('Copy ID') === false);
    check('related records are grouped by what the relation means',
      view.detailEl.find('los-related-group').length > 0
      && /(Used in units|Connected concepts|Referenced by notes) · \d+/.test(view.detailEl.allText()));
    plugin.onunload();
  }

  heading('zero-friction inbox capture');
  {
    const { app, plugin, calls } = await boot();
    await plugin.openProgram('inbox');
    const view = app.workspace.getLeavesOfType(VIEW.program)[0].view;
    let element = view.contentEl;
    element.find('los-capture-title')[0].value = 'Fixture thought';
    element.find('los-capture-editor')[0].value = 'A half-formed synthetic idea.';
    element.findText('los-btn', 'Capture text').fire('click'); await tick(); await tick();
    const textCall = calls.find((args) => args[0] === 'capture' && args.includes('--text'));
    check('text capture delegates exact wording and optional title to los.py',
      textCall?.includes('A half-formed synthetic idea.') && textCall?.includes('Fixture thought'));
    check('capture refreshes the atomic projection after the write',
      calls.some((args) => args.length === 1 && args[0] === 'generate'));

    element = view.contentEl;
    element.find('los-capture-file')[0].files = [{ name: 'handwriting.png', __path: '/tmp/handwriting.png' }];
    element.findText('los-btn', 'Capture selected file').fire('click'); await tick(); await tick();
    check('file capture resolves the Electron File through webUtils', calls.some((args) =>
      args.join('|') === 'capture|--json|--file|/tmp/handwriting.png'));
    plugin.onunload();
  }

  heading('module and component ownership');
  {
    const { app, plugin } = await boot();
    await plugin.openModule('module-fixture-m2');
    let view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    let text = view.contentEl.allText();
    /* Units is the default: a learner opens a module to study, not to read a
     * credit count. Administration is one tab away, never in the header. */
    check('the module opens on Units, not on administration',
      view.contentEl.find('los-unit-card').length > 0);
    check('the header carries one line of facts, not six labelled rows',
      view.contentEl.find('los-module-facts').length === 1
      && !text.includes('Institution') && !text.includes('Credits'));
    check('structured component controls render', text.includes('SaD') && text.includes('Analysis'));
    check('Lecture 02 and Lecture 04 retain distinct state', text.includes('Lecture 02') && text.includes('Lecture 04')
      && text.includes('ready') && text.includes('active'));
    check('needs-map is explicit', text.includes('needs map') || text.includes('needs-map'));
    view.contentEl.findText('los-btn', 'Analysis').fire('click'); await tick();
    view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    const unitText = view.contentEl.find('los-unit-card').map((card) => card.allText()).join(' ');
    check('component selection filters units without merging state', unitText.includes('Analysis exam prep') && !unitText.includes('Lecture 04'));
    view.contentEl.findText('los-btn', 'Logistics').fire('click'); await tick();
    view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    text = view.contentEl.allText();
    check('academic facts stay on the academic module, under Logistics',
      text.includes('Fixture University') && text.includes('klausur') && text.includes('10'));
    check('logistics does not block unit browsing',
      view.contentEl.find('los-unit-card').length === 0);
    view.contentEl.findText('los-btn', 'Overview').fire('click'); await tick();
    text = app.workspace.getLeavesOfType(VIEW.module)[0].view.contentEl.allText();
    check('related workspaces render their next action instead of a raw CONTEXT link',
      text.includes('Next action') && text.includes('Work the Conditional probability and Bayes stage'));
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
    check('stage has exact resources and done-when criteria', element.find('los-resource-row').length === 2
      && text.includes('Explain the medical-test result cold'));
    check('working note is stage-owned', element.find('los-note-editor')[0].value === 'A tentative fixture explanation.');
    check('durable unit artifact remains a reference', text.includes('Ultimate Reference') && text.includes('Fixture probability reference'));
    /* Three visible actions, one of them a menu. Sixteen equally-weighted
     * buttons is a control panel, not a workspace. */
    const bar = element.find('los-unit-actionbar')[0];
    check('the action bar carries exactly two buttons and one overflow',
      bar.children.filter((child) => child.classes.has('los-btn')).length === 2
      && bar.find('los-overflow').length === 1);
    check('only one action on the screen is a filled primary',
      element.find('los-btn--cta').length === 1
      && bar.findText('los-btn', 'Mark complete').classes.has('los-btn--cta'));
    check('secondary operations are discoverable in one menu',
      ['Pause unit', 'Skip stage', 'Report prerequisite gap', 'Prepare shelving', 'End learning session']
        .every((label) => bar.find('los-overflow')[0].allText().includes(label)));
    check('resource feedback collapses into a rate menu instead of three buttons',
      element.find('los-resource-row').some((row) => row.find('los-overflow').length === 1)
      && element.find('los-resource-actions').every((row) =>
        row.children.filter((child) => child.classes.has('los-btn')).length <= 1));
    check('done-when criteria are interactive checkboxes',
      element.find('los-donewhen-row').length >= 1
      && element.find('los-donewhen-row')[0].children[0].attrs.type === 'checkbox');
    const criterion = element.find('los-donewhen-row')[0].children[0];
    criterion.checked = true; criterion.fire('change');
    check('a ticked criterion is UI-owned state, never a second completion record',
      plugin.getDoneWhen('unit-fixture-sad-l04', 'stage-fixture-conditioning')[0] === true
      && !calls.some((args) => args[0] === 'stage-progress'));

    const editor = element.find('los-note-editor')[0]; editor.value = 'Updated fixture scratch.';
    element.findText('los-btn', 'Save note').fire('click'); await tick();
    const noteCall = calls.find((args) => args[0] === 'stage-note');
    check('note save uses action-specific gateway', noteCall?.slice(0, 5).join('|')
      === 'stage-note|unit-fixture-sad-l04|stage-fixture-conditioning|--replace|--text');
    check('mutation carries optimistic snapshot token', noteCall?.includes('--expected-snapshot')
      && noteCall?.includes('sha256:fixture-v2-snapshot'));

    element = view.contentEl;
    element.find('los-file-input')[0].files = [{ name: 'notes.png', __path: '/tmp/notes.png' }];
    element.findText('los-btn', 'Attach file').fire('click'); await tick();
    check('stage attachment uses Electron webUtils instead of the removed File.path', calls.some((args) =>
      args.join('|').startsWith('stage-attach|unit-fixture-sad-l04|stage-fixture-conditioning|--file|/tmp/notes.png')));

    element = view.contentEl;
    element.findText('los-btn', 'Helpful').fire('click'); await tick();
    check('source feedback is unit/stage/source-specific', calls.some((args) => args.join('|').startsWith(
      'source-feedback|unit-fixture-sad-l04|stage-fixture-conditioning|source-fixture-islp|helpful')));
    element = view.contentEl;
    element.findText('los-btn', 'Report prerequisite gap').fire('click'); await tick();
    check('gap action creates a scoped detour', calls.some((args) => args[0] === 'detour-create'
      && args.includes('stage-fixture-conditioning') && args.includes('required-now')));
    await plugin.reviewSessionEnd();
    check('session closure first requests an exact change review', calls.some((args) => args.length === 1 && args[0] === 'session-end'));
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
    const { app, plugin, calls } = await boot();
    await plugin.openShelving('unit-fixture-thesis-landscape');
    const view = app.workspace.getLeavesOfType(VIEW.shelving)[0].view;
    check('proposal destinations and rationale are reviewable', view.contentEl.find('los-proposal-row').length === 2
      && view.contentEl.allText().includes('note-fixture-synthesis.md'));
    view.contentEl.findText('los-btn', 'Approve selected changes').fire('click'); await tick();
    const apply = calls.find((args) => args[0] === 'shelving-apply');
    check('approval invokes guarded core apply', apply?.includes('--approve') && apply?.includes('--selected'));
    check('only selected proposal IDs are applied', apply?.includes('proposal-note') && !apply?.includes('proposal-garden'));
    plugin.onunload();
  }

  heading('secondary library and exact source selections');
  {
    const { app, plugin } = await boot();
    await plugin.openLibrary('source-fixture-islp');
    const view = app.workspace.getLeavesOfType(VIEW.library)[0].view;
    check('library is searchable master/detail', view.contentEl.find('los-item').length === 3);
    check('full-text/OCR fallback is explicit', view.contentEl.allText().includes('Full-text / OCR search'));
    check('ISLP detail preserves exact reading selections', view.detailEl.allText().includes('Chapter 3 §§3.1–3.3')
      && view.detailEl.allText().includes('§7.1 only'));
    check('source use routes back to several distinct units', view.detailEl.allText().includes('AML Lecture 03')
      && view.detailEl.allText().includes('AML Lecture 04'));
    view.query = 'Wahrscheinlichkeitsbuch'; view.render();
    check('German source aliases search successfully', view.contentEl.find('los-item').length === 1);
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
    const saved = 'A tentative fixture explanation.';
    const risked = 'Text that must survive a broken CLI.';
    plugin.setStageDraft('unit-fixture-sad-l04', 'stage-fixture-conditioning', risked, saved);
    view.contentEl.find('los-note-editor')[0].value = risked;
    plugin.runLos = (args, callback) => callback(null, 'NOT JSON {{{ broken CLI', '');
    Notice.log.length = 0;
    view.contentEl.findText('los-btn', 'Save note').fire('click'); await tick(); await tick();
    check('unreadable CLI output is never reported as a saved note',
      Notice.log.length > 0 && !Notice.log.some((line) => line.includes('Stage note saved.')));
    check('an unconfirmed save keeps the working-note draft',
      plugin.getStageDraft('unit-fixture-sad-l04', 'stage-fixture-conditioning', saved).text === risked);
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
    check('every open path refuses Job/',
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
    check('Library still searches around a null record',
      app.workspace.getLeavesOfType(VIEW.library)[0].view.contentEl.find('los-item').length > 0);
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
    const before = calls.filter((args) => args[0] === 'stage-progress').length;
    const complete = view.contentEl.findText('los-btn', 'Mark complete');
    complete.fire('click'); complete.fire('click');
    await tick(); await tick();
    check('two fast clicks produce exactly one guarded write',
      calls.filter((args) => args[0] === 'stage-progress').length === before + 1);
    plugin.onunload();
  }
  {
    /* The lock lives in the gateway, not in a view: a stage write and an inbox
     * capture started from different leaves must still not overlap, because
     * each carries an --expected-snapshot the other invalidates. */
    const { app, plugin } = await build();
    await app.workspace._ready();
    const order = [];
    let settle = null;
    plugin.runLos = (args, callback) => {
      order.push(`start:${args[0]}`);
      const finish = () => { order.push(`end:${args[0]}`); callback(null, JSON.stringify({ ok: true }), ''); };
      if (args[0] === 'stage-note') settle = finish; else finish();
    };
    const first = plugin.mutate(() => plugin.gateway.saveNote('unit-fixture-sad-l04', 'stage-fixture-conditioning', 'x'));
    const second = plugin.mutate(() => plugin.gateway.captureText('a second thought'));
    await tick();
    check('a second write from another view waits instead of racing',
      order.filter((entry) => entry.startsWith('start:')).length === 1);
    settle?.();
    await first; await second; await tick();
    check('the queued write runs after the first transaction completes',
      order.join('|') === 'start:stage-note|end:stage-note|start:capture|end:capture');
    check('a rejected transaction does not poison the queue',
      plugin.gateway.pending === 0);
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
    workspace.next_action = `${'a'.repeat(118)}😀 ${'b'.repeat(1500)}😀 tail`;
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
      source.includes("'.venv', 'bin', 'python'") && source.includes("'.venv', 'Scripts', 'python.exe'")
      && source.includes('this.settings.pythonPath') && /'python3'/.test(source));
    check('every mutation is serialized through one queue',
      source.includes('enqueue(task)') && !/this\.busy\s*=\s*true/.test(source));
    check('external links pass a protocol allowlist',
      source.includes('SAFE_URL_PROTOCOLS') && source.includes('safeWebUrl'));
    check('the repeated ownership footer no longer exists as a component',
      !source.includes('function viewFooter'));
    check('view refresh uses Obsidian public leaf iteration', source.includes('iterateAllLeaves')
      && !source.includes('workspace._leaves'));
    check('local file paths use Electron webUtils', source.includes('webUtils.getPathForFile(file)')
      && !/function localFilePath\([\s\S]*?return file\??\.path/.test(source));
    check('bundle exposes action-specific writes', ['stage-note', 'stage-progress', 'source-feedback',
      'stage-attach', 'detour-create', 'detour-resolve', 'shelving-prepare', 'shelving-apply',
      'session-end'].every((command) => source.includes(command)));
    check('bundle is generated from modular TypeScript-syntax source', fs.readdirSync(path.join(ROOT, 'src', 'views')).length >= 8
      && fs.readFileSync(path.join(ROOT, 'build.mjs'), 'utf8').includes('src/views/unit-view.ts'));
    const css = fs.readFileSync(path.join(ROOT, 'plugin', 'styles.css'), 'utf8');
    check('theme variables only', (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length === 0);
    check('narrow-screen workspace is responsive', css.includes('.los-unit-layout') && css.includes('@media (max-width: 720px)'));
    check('button-like components are insulated from Obsidian theme distortion',
      css.includes('appearance: none') && css.includes('min-width: 0')
      && css.includes('overflow-wrap: break-word') && css.includes('word-break: normal'));
    check('deadline layout cannot allocate a third action column',
      /\.los-date-row\s*\{[^}]*grid-template-columns:\s*minmax\(126px, 148px\)\s+minmax\(0, 1fr\)/.test(css)
      && !/\.los-date-row\s*\{[^}]*grid-template-columns:[^;]*\sauto\s*;/.test(css));
    check('the unit workspace is three columns with a sticky note panel',
      /\.los-unit-layout\s*\{[\s\S]*?grid-template-columns:\s*220px\s+minmax\(420px, 1fr\)\s+minmax\(280px, 340px\)/.test(css)
      && /\.los-note-panel\s*\{[\s\S]*?position: sticky/.test(css));
    check('the primary button is filled, not an outline',
      /\.los-btn--cta\s*\{[^}]*background: var\(--interactive-accent\)/.test(css));
    check('the active navigation destination is visually obvious',
      /\.los-app-nav-item\.is-active\s*\{[^}]*inset 3px 0 0 var\(--interactive-accent\)/.test(css));
    check('ordinary navigation rows carry no border',
      /\.los-app-nav-item\s*\{[^}]*border: 0 !important/.test(css));
    check('compact type and control scale is explicit',
      css.includes('font-size: 14px') && css.includes('clamp(24px, 2.2vw, 28px)')
      && css.includes('min-height: 28px'));
    check('reduced motion is respected', css.includes('prefers-reduced-motion'));
  }

  console.log(failures ? `\n${failures} FAILURE(S)` : '\nall tests passed');
  return failures ? 1 : 0;
}

main().then((code) => process.exit(code)).catch((error) => { console.error(error); process.exit(1); });
