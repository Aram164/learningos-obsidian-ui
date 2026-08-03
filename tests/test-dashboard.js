/* UI tests — run before every install (CLAUDE.md hard rule 8).
 *
 *     node tests/test-dashboard.js
 *
 * Everything runs against fixture-vault/ with a stubbed Obsidian; the CLI is
 * stubbed too, so no test ever shells out or touches the live vault.
 * Coverage: startup, settings, the store, dashboard, explorer, navigator,
 * finder, degraded modes, and the ADR-006 write boundary. */
'use strict';

const path = require('path');
const fs = require('fs');
const { makeApp, stub } = require('./harness');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'fixture-vault');
const LearningOSUI = require(path.join(ROOT, 'plugin', 'main.js'));

const DASH = 'learningos-dashboard';
const NAV = 'learningos-nav';
const EXP = 'learningos-explorer';

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
  exam_spine: [{ date: '2099-10-09', title: 'Fixture Kombimodul (FIX + TURE)', termin: 2 }],
};

async function build(settings, opts = {}) {
  const app = makeApp(FIXTURE);
  const plugin = new LearningOSUI(app, { id: 'learningos-ui', version: 'test' });
  plugin._data = settings || {};
  plugin.runLos = opts.cli === false
    ? (args, cb) => cb(new Error('cli down'), '', 'jsonschema too old')
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
  console.log('LearningOS UI tests (fixture vault only)');

  /* ------------------------------------------------------------ store */
  heading('store (generated/ projection)');
  {
    const { plugin } = await build();
    const ok = await plugin.store.load();
    const s = plugin.store;
    check('manifest loads', ok && s.ready, s.error);
    check('records indexed by type', s.of('source').length === 3 && s.of('note').length === 1);
    check('exam spine ordered with day deltas',
      s.examSpine.length === 1 && typeof s.examSpine[0].days === 'number');
    check('counts carry review adoption', s.counts.notes_reviewed === 0);
    check('lookup by id', (s.get('concept-demo') || {}).title === 'Demonstration concept');

    const rel = s.related(s.get('concept-demo')).map((r) => r.rec.id);
    check('concept relates to its notes and inbound edges',
      rel.includes('note-fixture-demo') && rel.includes('concept-downstream'), rel.join(','));
    const srel = s.related(s.get('source-fixture-local')).map((r) => r.rec.id);
    check('source relates to its collection', srel.includes('fixture-bookshelf'), srel.join(','));

    check('search finds by title', s.search('demo').some((r) => r.id === 'note-fixture-demo'));
    check('search finds by alias',
      s.search('example concept').some((r) => r.id === 'concept-demo'));
    check('search finds by author', s.search('B. Fixture').some((r) => r.id === 'source-fixture-local'));
    check('search is scoped when types given',
      s.search('fixture', ['source']).every((r) => r.type === 'source'));
    plugin.onunload();
  }

  /* ---------------------------------------------------------- startup */
  heading('startup');
  {
    const { app, plugin, dash } = await boot();
    check('dashboard opens despite a restored file', !!dash);
    check('dashboard is active and pinned',
      app.workspace.active === dash && dash.pinned === true);
    check('navigator opens in the left dock',
      app.workspace.getLeavesOfType(NAV).length === 1
      && app.workspace.getLeavesOfType(NAV)[0].side === 'left');
    check('sidebars collapsed',
      app.workspace.leftSplit.collapsed && app.workspace.rightSplit.collapsed);
    check('app chrome class applied', global.document.body.classList.contains('los-app'));
    check('store loaded during layout-ready', plugin.store.ready);
    plugin.onunload();
    check('unload detaches every view',
      app.workspace.getLeavesOfType(DASH).length === 0
      && app.workspace.getLeavesOfType(NAV).length === 0);
  }

  /* --------------------------------------------------------- settings */
  heading('settings');
  {
    const { app, plugin } = await boot({
      openOnStartup: false, collapseSidebars: false, appChrome: false, showNavigator: false,
    });
    check('openOnStartup=false leaves the dashboard closed',
      app.workspace.getLeavesOfType(DASH).length === 0);
    check('showNavigator=false leaves the rail closed',
      app.workspace.getLeavesOfType(NAV).length === 0);
    check('collapseSidebars=false leaves sidebars alone', !app.workspace.leftSplit.collapsed);
    check('appChrome=false adds no body class', !global.document.body.classList.contains('los-app'));
    plugin.settingTabs[0].display();
    check('every behaviour is a toggle',
      plugin.settingTabs[0].containerEl.find('setting-item').length === 7);
    plugin.onunload();
  }

  /* -------------------------------------------------------- dashboard */
  heading('dashboard');
  {
    const { plugin, dash } = await boot();
    const el = dash.view.contentEl;
    const text = el.allText();
    check('hero shows the nearest exam', text.includes('FIX + TURE'));
    check('countdown is rendered', el.find('los-hero-days').length === 1);
    check('stat strip navigates', el.find('los-stat').length === 6);
    check('counts come from the manifest, not the CLI', text.includes('3') && text.includes('2'));
    check('workspace card shows the manifest next_action',
      text.includes('Nothing — synthetic.'), text.slice(0, 300));
    check('archived workspaces are hidden', !text.includes('Archived fixture workspace'));
    check('validation banner reflects the CLI', el.find('los-banner--ok').length === 1);
    check('reference shelf shows local sources as chips',
      el.find('los-chip').some((c) => c.allText().includes('Fixture local book')));

    /* clicking a stat must navigate, not dump a link */
    const stat = el.findText('los-stat', 'sources');
    stat.fire('click');
    await tick();
    const exp = plugin.app.workspace.getLeavesOfType(EXP)[0];
    check('clicking a stat opens the explorer', !!exp && exp.view.kind === 'source');
    plugin.onunload();
  }

  /* --------------------------------------------------------- explorer */
  heading('explorer');
  {
    const { plugin } = await boot();
    await plugin.openExplorer('source');
    const view = plugin.app.workspace.getLeavesOfType(EXP)[0].view;
    const el = view.contentEl;
    check('kind tabs for every browsable type', el.find('los-tab').length === 6);
    check('facets are derived from the data',
      el.find('los-facet').some((f) => f.allText().includes('Book')));
    check('all sources listed', el.find('los-item').length === 3);

    view.facets = { source_type: 'book' };
    view.render();
    check('facet filters the list', view.contentEl.find('los-item').length === 1);

    view.facets = {};
    view.query = 'online';
    view.render();
    check('search filters the list', view.contentEl.find('los-item').length === 1);

    view.query = '';
    view.selected = 'source-fixture-local';
    view.render();
    let d = view.detailEl.allText();
    check('detail shows evaluations', d.includes('Complete tables'));
    check('detail shows facts', d.includes('Fixture Press') && d.includes('ISBN'), d.slice(0, 200));
    check('local source offers a local open', d.includes('Open local copy'));
    check('online-only action absent for a local source', !d.includes('Open online'));
    check('connected records are chips', view.detailEl.find('los-chip').length >= 1);
    check('reading plan lists useful sections',
      d.includes('Where to look') && d.includes('Ch. 2 — Fixtures') && d.includes('Appendix A'));
    check('reading-plan sections carry concept chips',
      view.detailEl.find('los-toc-row').some((r) => r.find('los-chip').length === 1));
    check('scaffolding-only evaluations are not rendered as empty cards',
      view.detailEl.find('los-eval').length === 1,
      `${view.detailEl.find('los-eval').length} eval cards`);

    view.selected = 'source-fixture-online';
    view.render();
    d = view.detailEl.allText();
    check('online source offers Open online', d.includes('Open online'));
    check('no local action when the file is offline', !d.includes('Open local copy'));

    /* chip navigation + history — collections stay in the explorer,
       notes and workspaces hand off to the editor (tested below) */
    const chip = view.detailEl.find('los-chip')
      .find((c) => c.allText().includes('bookshelf'));
    chip.fire('click');
    check('chip navigates to the related record', view.selected !== 'source-fixture-online');
    check('history records the jump', view.history.length === 1);
    view.back();
    check('back returns', view.selected === 'source-fixture-online');

    /* notes and workspaces open in the editor, not the explorer */
    plugin.app.workspace.opened.length = 0;
    view.open(plugin.store.get('note-fixture-demo'));
    check('notes open as files',
      plugin.app.workspace.opened.includes('knowledge/notes/mathematics/note-fixture-demo.md'));

    view.show('module', { selected: 'module-fixture' });
    d = view.detailEl.allText();
    check('module detail shows attempts', d.includes('Termin 1') && d.includes('withdrawn'));
    check('module detail shows examination prose', d.includes('Synthetic exam notes.'));
    plugin.onunload();
  }

  /* -------------------------------------------------------- navigator */
  heading('navigator');
  {
    const { app, plugin } = await boot();
    const nav = app.workspace.getLeavesOfType(NAV)[0].view;
    const text = nav.contentEl.allText();
    check('every record type is reachable',
      ['Sources', 'Notes', 'Concepts', 'Modules', 'Workspaces', 'Collections']
        .every((t) => text.includes(t)));
    check('counts shown in the rail', nav.contentEl.find('los-nav-count').length >= 6);
    check('queues present', text.includes('Inbox') && text.includes('Garden'));
    check('unreviewed queue computed from the manifest', text.includes('Unreviewed'));
    check('active workspace listed', text.includes('Fixture workspace'));
    check('archived workspace not listed', !text.includes('Archived fixture'));

    const entry = nav.contentEl.findText('los-nav-item', 'Concepts');
    entry.fire('click');
    await tick();
    check('rail opens the explorer at that type',
      app.workspace.getLeavesOfType(EXP)[0].view.kind === 'concept');
    plugin.onunload();
  }

  /* ----------------------------------------------------------- finder */
  heading('finder');
  {
    const { plugin } = await boot();
    plugin.openFinder();
    const modal = stub.SuggestModal.last;
    const { hits, rendered } = modal.probe('fixture');
    check('finder searches every type', hits.length >= 5);
    check('suggestions render a typed subtitle',
      rendered[0].allText().includes('·'), rendered[0].allText());
    plugin.app.workspace.opened.length = 0;
    modal.onChooseSuggestion(plugin.store.get('note-fixture-demo'));
    check('choosing a note opens the file', plugin.app.workspace.opened.length === 1);
    modal.onChooseSuggestion(plugin.store.get('source-fixture-local'));
    await tick();
    check('choosing a source opens the explorer',
      plugin.app.workspace.getLeavesOfType(EXP)[0].view.selected === 'source-fixture-local');
    plugin.onunload();
  }

  /* --------------------------------------------------------- degraded */
  heading('degraded modes');
  {
    /* CLI down — the app must still be fully browsable */
    const { plugin, dash } = await boot(null, { cli: false });
    const text = dash.view.contentEl.allText();
    check('dashboard renders with no CLI', text.includes('Fixture workspace'));
    check('counts survive without the CLI', text.includes('sources'));
    check('banner explains the CLI is offline', text.includes('CLI offline'));
    plugin.onunload();
  }
  {
    /* projection missing — actionable, not a blank screen */
    const app = makeApp(FIXTURE);
    const plugin = new LearningOSUI(app, { id: 'learningos-ui' });
    plugin.runLos = (args, cb) => cb(null, JSON.stringify(STATUS), '');
    app._plugin = plugin;
    app.vault.adapter.exists = async () => false;
    await plugin.onload();
    await app.workspace._ready();
    const el = app.workspace.getLeavesOfType(DASH)[0].view.contentEl;
    check('missing manifest is explained', el.allText().includes('Projection unavailable'));
    check('recovery actions offered', el.allText().includes('Rebuild views'));
    plugin.onunload();
  }

  /* ------------------------------------------------ open verbs safety */
  heading('open verbs');
  {
    const { app, plugin } = await boot();
    app.internalPlugins.enabled.add('webviewer');
    plugin.openUrl('https://example.invalid/x');
    const wv = app.workspace._leaves.find((l) => l.viewType === 'webviewer');
    check('URLs open in the Web Viewer when enabled',
      !!wv && wv.state && wv.state.url === 'https://example.invalid/x');
    app.internalPlugins.enabled.delete('webviewer');
    let opened = null;
    global.window.open = (u) => { opened = u; };
    plugin.openUrl('https://example.invalid/y');
    check('URLs fall back to the browser', opened === 'https://example.invalid/y');
    plugin.onunload();
  }

  /* --------------------------------------------- boundary (ADR-006) */
  heading('boundary (ADR-006)');
  {
    const src = fs.readFileSync(path.join(ROOT, 'plugin', 'main.js'), 'utf8');
    const forbidden = [
      ['vault.modify', /vault\.modify\s*\(/],
      ['vault.delete', /vault\.delete\s*\(/],
      ['vault.rename/copy', /vault\.(rename|copy)\s*\(/],
      ['frontmatter writes', /processFrontMatter/],
      ['filesystem writes', /fs\.(writeFile|writeFileSync|appendFile|unlink|rename|mkdir)/],
      ['Job/ quarantine breach', /['"`]Job\//],
      ['markdown parsing of canonical files', /cachedRead|##\\s\*Next Action/],
    ];
    for (const [name, re] of forbidden) check(`no ${name}`, !re.test(src));
    const creates = src.match(/vault\.create\(([^)]*)\)/g) || [];
    check('the only vault.create targets work/inbox/',
      creates.length === 1 && creates[0].includes('${INBOX}'), creates.join(' | '));
    check('mutations go through los.py only',
      /runLos\(\['generate'\]/.test(src) && /runLos\(\['validate'\]/.test(src));
    check('reads come from generated/',
      /generated\/manifest\.json/.test(src) && /generated\/backlinks\.json/.test(src));

    const css = fs.readFileSync(path.join(ROOT, 'plugin', 'styles.css'), 'utf8');
    const hex = (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []);
    check('no hardcoded colours in CSS (theme variables only)', hex.length === 0, hex.join(' '));
    check('spacing comes from tokens',
      (css.match(/--los-[1-7]:/g) || []).length === 7);
  }

  console.log(failures ? `\n${failures} FAILURE(S)` : '\nall tests passed');
  return failures ? 1 : 0;
}

main().then((c) => process.exit(c)).catch((e) => {
  console.error(e);
  process.exit(1);
});
