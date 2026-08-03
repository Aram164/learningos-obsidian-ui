/* LearningOS curriculum-v2 app tests. Fixture-only: never reads the live repository. */
'use strict';

const path = require('path');
const fs = require('fs');
const { makeApp } = require('./harness');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'fixture-vault');
const LearningOSUI = require(path.join(ROOT, 'plugin', 'main.js'));
const VIEW = {
  home: 'learningos-home', nav: 'learningos-nav', program: 'learningos-program',
  module: 'learningos-module', unit: 'learningos-unit', library: 'learningos-library',
  shelving: 'learningos-shelving', boundary: 'learningos-boundary',
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
    const text = home.view.contentEl.allText();
    check('Home opens and stays pinned', app.workspace.active === home && home.pinned);
    check('navigator opens in its own leaf', app.workspace.getLeavesOfType(VIEW.nav).length === 1);
    check('resume points to one stage without becoming the curriculum',
      text.includes('Conditional probability and Bayes') && text.includes('Resume stage')
      && text.includes('Every path stays visible'));
    check('all Bachelor modules remain visible', text.includes('Fixture Statistics & Analysis')
      && text.includes('Fixture Advanced ML'));
    check('Skills and thesis stay independent', text.includes('Python') && text.includes('Bachelor thesis'));
    check('queues report map, shelving, and inbox state', text.includes('Needs a map')
      && text.includes('Ready to shelve') && text.includes('Inbox'));
    check('Home renders core-owned priorities and workspace next actions',
      text.includes('Semester priority') && text.includes('current super-priority')
      && text.includes('Work the Conditional probability and Bayes stage'));
    check('secondary coordination sections remain reachable without becoming a wall',
      text.includes('Coordination context') && text.includes('Commitments') && text.includes('Deferrals'));
    check('structured registration and unregistered exam dates are visible',
      text.includes('Fixture registration') && text.includes('2099-08-31 → 2099-09-10')
      && text.includes('unregistered'));
    check('Home command centre keeps all four manifest-backed areas in compact tables',
      home.view.contentEl.find('los-command-centre').length === 1
      && home.view.contentEl.find('los-data-table').length === 3
      && ['Academic dates', 'Bachelor modules', 'Skills', 'Thesis'].every((label) => text.includes(label)));
    const deadlineCards = home.view.contentEl.find('los-deadline-card');
    check('deadline rows have only date and flexible content columns',
      deadlineCards.length > 0 && deadlineCards.every((card) => card.children.length === 2
        && card.children[1].classes.has('los-deadline-copy')));
    const registration = deadlineCards.find((card) => card.classes.has('los-deadline-registration-window'));
    check('registration actions stay inside the flexible deadline content row',
      registration?.children[1].find('los-deadline-actions').length === 1
      && registration.children[1].allText().includes('Register the synthetic combined exam.'));
    check('registration actions use a compact disclosure without losing manifest text',
      registration?.children[1].find('los-deadline-action-details').length === 1
      && registration.children[1].allText().includes('1 registration action'));
    /* The core records history truthfully; the interface decides what is still
     * ahead. Past sittings stay reachable but never crowd the upcoming list. */
    check('past sittings are folded into a history disclosure',
      text.includes('Past dates (1)') && text.includes('2020-02-14'));
    const upcoming = home.view.contentEl.find('los-deadline-list')[0];
    check('the upcoming list carries only dates that are still ahead',
      !upcoming.allText().includes('2020-02-14')
      && upcoming.allText().includes('2099-10-09'));
    check('only boundary records reach Home', text.includes("Master's Planning") && text.includes('Job')
      && !text.includes('prospective module menu'));
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
    check('rail matches the product model', ['Bachelor’s', 'Skills', 'Thesis & projects', 'Shelving', 'Library', 'Garden', 'Domain atlas', 'Inbox', 'Master’s', 'Job']
      .every((label) => text.includes(label)));
    check('legacy global path and entity taxonomy are absent', !text.includes('Learning path') && !text.includes('Collections'));
    nav.findText('los-app-nav-item', 'Bachelor’s').fire('click'); await tick();
    check('program surface opens', app.workspace.getLeavesOfType(VIEW.program)[0].view.contentEl.allText().includes('Fixture Advanced ML'));
    await plugin.openBoundary('program-job-boundary');
    const job = app.workspace.getLeavesOfType(VIEW.boundary)[0].view.contentEl.allText();
    check('Job surface reveals policy only', job.includes('not indexed, searched, read, or mixed') && !job.includes('Job client'));
    await plugin.openBoundary('program-masters-planning');
    const masters = app.workspace.getLeavesOfType(VIEW.boundary)[0].view.contentEl.allText();
    check('Master surface exposes quarantine only', masters.includes('quarantined') && !masters.includes('prospective module menu'));
    nav.findText('los-app-nav-item', 'Garden').fire('click'); await tick();
    nav.findText('los-app-nav-item', 'Domain atlas').fire('click'); await tick();
    check('Garden and domain atlas navigation opens managed vault surfaces',
      app.workspace.opened.includes('bases/garden.base') && app.workspace.opened.includes('generated/domain-atlas.md'));
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
      args.join('|') === 'capture|--file|/tmp/handwriting.png'));
    plugin.onunload();
  }

  heading('module and component ownership');
  {
    const { app, plugin } = await boot();
    await plugin.openModule('module-fixture-m2');
    const view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    let text = view.contentEl.allText();
    check('academic facts stay on the academic module', text.includes('Fixture University')
      && text.includes('Examination: klausur') && text.includes('10'));
    check('structured component controls render', text.includes('SaD') && text.includes('Analysis'));
    check('Lecture 02 and Lecture 04 retain distinct state', text.includes('Lecture 02') && text.includes('Lecture 04')
      && text.includes('ready') && text.includes('active'));
    view.contentEl.findText('los-btn', 'Analysis').fire('click'); await tick();
    const filteredView = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    text = filteredView.contentEl.allText();
    const unitText = filteredView.contentEl.find('los-unit-card').map((card) => card.allText()).join(' ');
    check('component selection filters units without merging state', unitText.includes('Analysis exam prep') && !unitText.includes('Lecture 04'));
    check('needs-map is explicit', text.includes('needs map') || text.includes('needs-map'));
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

    const editor = element.find('los-note-editor')[0]; editor.value = 'Updated fixture scratch.';
    element.findText('los-btn', 'Save note').fire('click'); await tick();
    const noteCall = calls.find((args) => args[0] === 'stage-note');
    check('note save uses action-specific gateway', noteCall?.slice(0, 5).join('|')
      === 'stage-note|unit-fixture-sad-l04|stage-fixture-conditioning|--replace|--text');
    check('mutation carries optimistic snapshot token', noteCall?.includes('--expected-snapshot')
      && noteCall?.includes('sha256:fixture-v2-snapshot'));

    element = view.contentEl;
    element.find('los-file-input')[0].files = [{ name: 'notes.png', __path: '/tmp/notes.png' }];
    element.findText('los-btn', 'Attach selected file').fire('click'); await tick();
    check('stage attachment uses Electron webUtils instead of the removed File.path', calls.some((args) =>
      args.join('|').startsWith('stage-attach|unit-fixture-sad-l04|stage-fixture-conditioning|--file|/tmp/notes.png')));

    element = view.contentEl;
    element.findText('los-btn', 'Helpful').fire('click'); await tick();
    check('source feedback is unit/stage/source-specific', calls.some((args) => args.join('|').startsWith(
      'source-feedback|unit-fixture-sad-l04|stage-fixture-conditioning|source-fixture-islp|helpful')));
    element = view.contentEl;
    element.findText('los-btn', 'I found a gap').fire('click'); await tick();
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
    check('python gateway falls back when the repository venv is absent',
      /fs\.existsSync\(bundled\)\s*\?\s*bundled\s*:\s*'python3'/.test(source));
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
      /\.los-deadline-card\s*\{[\s\S]*?grid-template-columns:\s*minmax\(126px, 148px\)\s+minmax\(0, 1fr\)/.test(css)
      && !/\.los-deadline-card\s*\{[\s\S]*?grid-template-columns:[^;]*\sauto\s*;/.test(css));
    check('compact type and control scale is explicit',
      css.includes('font-size: 14px') && css.includes('clamp(24px, 2.2vw, 28px)')
      && css.includes('min-height: 28px'));
    check('reduced motion is respected', css.includes('prefers-reduced-motion'));
  }

  console.log(failures ? `\n${failures} FAILURE(S)` : '\nall tests passed');
  return failures ? 1 : 0;
}

main().then((code) => process.exit(code)).catch((error) => { console.error(error); process.exit(1); });
