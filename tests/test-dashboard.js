/* LearningOS app tests. Fixture-only: never reads the live repository. */
'use strict';

const path = require('path');
const fs = require('fs');
const { makeApp } = require('./harness');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'fixture-vault');
const LearningOSUI = require(path.join(ROOT, 'plugin', 'main.js'));

const DASH = 'learningos-dashboard';
const NAV = 'learningos-nav';
const EXP = 'learningos-explorer';
const PATH = 'learningos-learning-path';
const SHELVE = 'learningos-shelve-review';
const JOB = 'learningos-job-boundary';
const tick = () => new Promise((r) => setImmediate(r));

let failures = 0;
let group = '';
function check(name, cond, detail) {
  if (cond) { console.log(`  ok   ${name}`); return; }
  failures += 1;
  console.log(`  FAIL [${group}] ${name}${detail ? `\n       ${detail}` : ''}`);
}
function heading(t) { group = t; console.log(`\n${t}`); }

const STATUS = {
  counts: { notes: 1, concepts: 2, sources: 3, active_workspaces: 1 },
  validation: { errors: 0, warnings: 0, ok: true },
  exam_spine: [{ date: '2099-10-09', title: 'Fixture Kombimodul', termin: 2 }],
};

async function build(settings, opts = {}) {
  const app = makeApp(FIXTURE);
  const plugin = new LearningOSUI(app, { id: 'learningos-ui', version: 'test' });
  plugin._data = settings || {};
  plugin.runLos = opts.cli === false
    ? (args, cb) => cb(new Error('cli down'), '', 'offline')
    : (args, cb) => cb(null, JSON.stringify(STATUS), '');
  app._plugin = plugin;
  await plugin.onload();
  return { app, plugin };
}

async function boot(settings, opts) {
  const ctx = await build(settings, opts);
  ctx.app.workspace.activeFile = { path: 'system/ARCHITECTURE.md' };
  await ctx.app.workspace._ready();
  ctx.dash = ctx.app.workspace.getLeavesOfType(DASH)[0];
  return ctx;
}

async function main() {
  console.log('LearningOS workflow app tests (fixture vault only)');

  heading('versioned atomic store');
  {
    const { plugin } = await build();
    const ok = await plugin.store.load();
    const s = plugin.store;
    check('manifest v1 loads', ok && s.ready && s.contractVersion === 1, s.error);
    check('snapshot token loaded', s.snapshotId === 'sha256:fixture-snapshot');
    check('learning paths indexed', s.of('learning-path').length === 1);
    check('current path has ordered stages', s.of('learning-path')[0].stages.length === 3);
    check('backlinks come from the same manifest',
      s.related(s.get('concept-demo')).some((r) => r.rec.id === 'note-fixture-demo'));
    check('library search remains available', s.search('fixture book').some((r) => r.id === 'source-fixture-local'));
    plugin.onunload();
  }

  heading('startup and home');
  {
    const { app, plugin, dash } = await boot();
    const text = dash.view.contentEl.allText();
    check('home opens and is pinned', app.workspace.active === dash && dash.pinned);
    check('navigator opens', app.workspace.getLeavesOfType(NAV).length === 1);
    check('active path is the dominant content', text.includes('Fixture probability path'));
    check('home shows one resumable stage', text.includes('Conditional fixture') && text.includes('Resume stage'));
    check('progress is stage-based', text.includes('1 of 3 stages complete'));
    check('working notes and shelving are summaries', text.includes('Working notes') && text.includes('Ready to shelve'));
    check('Job is separate', text.includes('Separate and hidden by default'));
    check('legacy stat/link dashboard is gone', dash.view.contentEl.find('los-stat').length === 0);
    plugin.onunload();
  }

  heading('app navigation');
  {
    const { app, plugin } = await boot();
    const nav = app.workspace.getLeavesOfType(NAV)[0].view.contentEl;
    const text = nav.allText();
    check('workflow surfaces are primary', ['Home', 'Learning path', 'Shelve review', 'Library']
      .every((label) => text.includes(label)));
    check('areas are explicit', text.includes('University') && text.includes('Job'));
    check('raw entity taxonomy is not the main rail', !text.includes('Collections'));
    nav.findText('los-app-nav-item', 'Learning path').fire('click');
    await tick();
    check('learning-path view opens', app.workspace.getLeavesOfType(PATH).length === 1);
    plugin.onunload();
  }

  heading('focused learning path');
  {
    const { app, plugin } = await boot();
    await plugin.openPath('path-fixture-probability');
    const view = app.workspace.getLeavesOfType(PATH)[0].view;
    let el = view.contentEl;
    let text = el.allText();
    check('all ordered stages are visible', el.find('los-stage-row').length === 3);
    check('current stage carries objective', text.includes('Work the central fixture example'));
    check('resources are actions, not a link dump', el.find('los-resource-row').length === 2);
    check('completion criterion is beside the work', text.includes('Explain the fixture result cold'));
    check('working note is stage-bound', el.find('los-note-editor')[0].value
      === 'A tentative fixture explanation.');
    check('mixed capture is present', text.includes('Attach handwriting'));
    check('no filing metadata is demanded', text.includes('No concept ID or destination needed yet'));

    el.find('los-stage-row')[0].fire('click');
    text = view.contentEl.allText();
    check('stage switching updates one workspace', text.includes('Establish the fixture vocabulary'));

    let mutation = null;
    plugin.progressPath = (...args) => { mutation = args; };
    view.stageId = 'stage-conditioning'; view.render();
    view.contentEl.findText('los-btn', 'Complete stage').fire('click');
    check('complete action targets path and stage', mutation
      && mutation[0] === 'path-fixture-probability' && mutation[1] === 'stage-conditioning');
    plugin.onunload();
  }

  heading('shelving approval gate');
  {
    const { app, plugin } = await boot();
    let aiPrompt = '';
    plugin.askAi = (p) => { aiPrompt = p; };
    await plugin.openShelve('path-fixture-probability');
    const view = app.workspace.getLeavesOfType(SHELVE)[0].view;
    check('empty proposal is actionable', view.contentEl.allText().includes('Ask AI to prepare proposal'));
    view.contentEl.findText('los-btn', 'Ask AI to prepare proposal').fire('click');
    check('proposal request forbids canonical application', aiPrompt.includes('do not apply canonical changes'));

    const rec = plugin.store.get('path-fixture-probability');
    rec.status = 'ready-to-shelve';
    rec.shelving = { state: 'proposed', summary: 'Two fixture changes.', items: [
      { id: 'proposal-note', kind: 'durable-note', title: 'Fixture synthesis',
        destination: 'knowledge/notes/mathematics/note-fixture-synthesis.md',
        rationale: 'The reasoning now has an independent purpose.', diff: '+ Preserve my fixture wording.', selected: true },
      { id: 'proposal-garden', kind: 'garden', title: 'Open fixture question',
        destination: 'knowledge/garden/open-fixture.md',
        rationale: 'Still uncertain.', selected: false },
    ] };
    view.render();
    check('proposal destinations and rationale are reviewable',
      view.contentEl.find('los-proposal-row').length === 2
      && view.contentEl.allText().includes('note-fixture-synthesis.md'));
    aiPrompt = '';
    view.contentEl.findText('los-btn', 'Approve selected changes').fire('click');
    check('approval sends only selected proposal ids', aiPrompt.includes('proposal-note')
      && !aiPrompt.includes('proposal-garden'));
    check('approval requires apply, validate, regenerate', aiPrompt.includes('validate') && aiPrompt.includes('regenerate'));
    plugin.onunload();
  }

  heading('Job quarantine surface');
  {
    const { app, plugin } = await boot();
    await plugin.openJobBoundary();
    const text = app.workspace.getLeavesOfType(JOB)[0].view.contentEl.allText();
    check('surface contains boundary explanation, not indexed content',
      text.includes('not indexed, searched, or mixed'));
    check('access is an explicit action', text.includes('Open Job folder'));
    plugin.onunload();
  }

  heading('secondary library');
  {
    const { app, plugin } = await boot();
    await plugin.openExplorer('source');
    const view = app.workspace.getLeavesOfType(EXP)[0].view;
    check('library keeps searchable master/detail', view.contentEl.find('los-item').length === 3);
    view.query = 'online'; view.render();
    check('library search filters', view.contentEl.find('los-item').length === 1);
    view.selected = 'source-fixture-local'; view.query = ''; view.render();
    check('source detail keeps evaluated reading plan', view.detailEl.allText().includes('Ch. 2 — Fixtures'));
    plugin.onunload();
  }

  heading('degraded and safety modes');
  {
    const { plugin, dash } = await boot(null, { cli: false });
    check('home renders when CLI is offline', dash.view.contentEl.allText().includes('Fixture probability path'));
    plugin.onunload();
  }
  {
    const app = makeApp(FIXTURE);
    const plugin = new LearningOSUI(app, { id: 'learningos-ui' });
    plugin._data = {}; app._plugin = plugin;
    plugin.runLos = (args, cb) => cb(null, JSON.stringify(STATUS), '');
    app.vault.adapter.exists = async () => false;
    await plugin.onload(); await app.workspace._ready();
    const text = app.workspace.getLeavesOfType(DASH)[0].view.contentEl.allText();
    check('missing projection explains recovery', text.includes('Projection unavailable') && text.includes('Rebuild views'));
    plugin.onunload();
  }

  heading('ADR-006 boundary');
  {
    const src = fs.readFileSync(path.join(ROOT, 'plugin', 'main.js'), 'utf8');
    const forbidden = [
      ['vault.modify', /vault\.modify\s*\(/],
      ['vault.delete', /vault\.delete\s*\(/],
      ['vault.rename/copy', /vault\.(rename|copy)\s*\(/],
      ['frontmatter writes', /processFrontMatter/],
      ['filesystem writes', /fs\.(writeFile|writeFileSync|appendFile|unlink|rename|mkdir)/],
      ['direct canonical parsing', /cachedRead|##\\s\*Next Action/],
      ['second projection read', /this\.read\(BACKLINKS\)/],
    ];
    for (const [name, re] of forbidden) check(`no ${name}`, !re.test(src));
    check('single atomic manifest supplies backlinks', /this\.backlinks = m\.backlinks/.test(src));
    check('stage writes use optimistic snapshot tokens', /path-note/.test(src)
      && /path-progress/.test(src) && /expected-snapshot/.test(src));
    check('shelving approval is handed to AI, not directly applied',
      /Approve selected changes/.test(src) && /this\.plugin\.askAi/.test(src));

    const css = fs.readFileSync(path.join(ROOT, 'plugin', 'styles.css'), 'utf8');
    const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    check('theme variables only', hex.length === 0, hex.join(' '));
    check('responsive learning workspace exists', css.includes('.los-path-layout') && css.includes('@media'));
  }

  console.log(failures ? `\n${failures} FAILURE(S)` : '\nall tests passed');
  return failures ? 1 : 0;
}

main().then((c) => process.exit(c)).catch((e) => {
  console.error(e); process.exit(1);
});
