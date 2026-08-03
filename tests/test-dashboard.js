/* UI tests — run before every install (CLAUDE.md hard rule 8).
 *
 *     node tests/test-dashboard.js
 *
 * Covers the v0.3 regression that made the vault "just markdown files": the
 * dashboard must open on startup EVEN WHEN Obsidian restores a file, plus the
 * render path and the ADR-006 boundary (no canonical writes from UI code). */
'use strict';

const path = require('path');
const fs = require('fs');
const { makeApp } = require('./harness');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'fixture-vault');
const LearningOSUI = require(path.join(ROOT, 'plugin', 'main.js'));

let failures = 0;
function check(name, cond, detail) {
  if (cond) { console.log(`  ok   ${name}`); return; }
  failures += 1;
  console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
}

const STATUS = {
  learning_os: 'test',
  counts: {
    notes: 42, concepts: 17, concept_relations: 30, sources: 9, modules: 4,
    modules_enrolled: 3, active_workspaces: 1, standing_workspaces: 0,
    archived_workspaces: 2, inbox_items: 0, garden_notes: 1,
  },
  adoption: { notes_reviewed: 21, notes_with_evidence: 12 },
  exam_spine: [
    { date: '2099-10-09', module_id: 'module-x', title: 'Kombimodul (SaD + AN)', termin: 2 },
    { date: '2099-12-01', module_id: 'module-y', title: 'Advanced ML (AML)', termin: 2 },
  ],
  validation: { errors: 0, warnings: 0, ok: true },
};

async function build(settings) {
  const app = makeApp(FIXTURE);
  const plugin = new LearningOSUI(app, { id: 'learningos-ui', version: 'test' });
  plugin._data = settings || {};
  /* never shell out in tests — the CLI gateway is stubbed */
  plugin.runLos = (args, cb) => cb(null, JSON.stringify(STATUS), '');
  app._plugin = plugin;
  await plugin.onload();
  return { app, plugin };
}

async function main() {
  console.log('LearningOS UI tests (fixture vault only)\n');

  /* --- 1. the regression: a restored file must NOT suppress the dashboard */
  console.log('startup');
  {
    const { app, plugin } = await build();
    app.workspace.activeFile = { path: 'system/ARCHITECTURE.md' };
    await app.workspace._ready();
    const leaves = app.workspace.getLeavesOfType('learningos-dashboard');
    check('dashboard opens even with a restored active file', leaves.length === 1,
      `leaves: ${leaves.length}`);
    check('dashboard becomes the active leaf', app.workspace.active === leaves[0]);
    check('dashboard is pinned (home tab survives clicks)', leaves[0].pinned === true);
    check('startup opens a NEW tab (restored file kept)', leaves[0].newTab === true);
    check('sidebars collapsed', app.workspace.leftSplit.collapsed
      && app.workspace.rightSplit.collapsed);
    check('app chrome class applied', global.document.body.classList.contains('los-app'));
    plugin.onunload();
  }

  /* --- 2. settings are honoured, not hardcoded */
  console.log('\nsettings');
  {
    const { app, plugin } = await build({
      openOnStartup: false, collapseSidebars: false, appChrome: false,
    });
    await app.workspace._ready();
    check('openOnStartup=false leaves the dashboard closed',
      app.workspace.getLeavesOfType('learningos-dashboard').length === 0);
    check('collapseSidebars=false leaves sidebars alone',
      app.workspace.leftSplit.collapsed === false);
    check('appChrome=false adds no body class',
      !global.document.body.classList.contains('los-app'));
    check('settings tab registered', plugin.settingTabs.length === 1);
    plugin.settingTabs[0].display();
    check('settings tab renders rows',
      plugin.settingTabs[0].containerEl.find('setting-item').length === 5);
    plugin.onunload();
  }

  /* --- 3. the render path */
  console.log('\nrender');
  {
    const { app, plugin } = await build();
    await app.workspace._ready();
    const view = app.workspace.getLeavesOfType('learningos-dashboard')[0].view;
    const text = view.contentEl.allText();
    check('title present', text.includes('LearningOS'));
    check('hero shows the nearest exam', text.includes('SaD + AN'), text.slice(0, 200));
    check('second exam becomes a tile', text.includes('AML'));
    check('stats strip rendered', view.contentEl.find('los-stat').length >= 5);
    check('counts come from the CLI payload', text.includes('42') && text.includes('17'));
    check('workspace card from the fixture vault', text.includes('Fixture workspace'));
    check('next action extracted', text.includes('Nothing — synthetic.'));
    check('recent note listed', text.includes('Fixture demo note'));
    check('validation banner ok', view.contentEl.find('los-ok').length === 1);
    check('rail links rendered', view.contentEl.find('los-link').length === 8);
    plugin.onunload();
  }

  /* --- 4. degraded mode: CLI unavailable must still render */
  console.log('\ndegraded (no CLI)');
  {
    const app = makeApp(FIXTURE);
    const plugin = new LearningOSUI(app, { id: 'learningos-ui', version: 'test' });
    plugin.runLos = (args, cb) => cb(new Error('boom'), '', 'jsonschema too old');
    app._plugin = plugin;
    await plugin.onload();
    await app.workspace._ready();
    const view = app.workspace.getLeavesOfType('learningos-dashboard')[0].view;
    const text = view.contentEl.allText();
    check('renders without the CLI', text.includes('Fixture workspace'));
    check('warns instead of crashing', text.includes('CLI unavailable'));
    check('no exam hero without data', view.contentEl.find('los-hero').length === 0);
    plugin.onunload();
  }

  /* --- 5. ADR-006 boundary, checked against the source */
  console.log('\nboundary (ADR-006)');
  {
    const src = fs.readFileSync(path.join(ROOT, 'plugin', 'main.js'), 'utf8');
    const forbidden = [
      ['vault.modify', /vault\.modify\s*\(/],
      ['vault.delete', /vault\.delete\s*\(/],
      ['vault.rename', /vault\.(rename|copy)\s*\(/],
      ['fileManager.processFrontMatter', /processFrontMatter/],
      ['writes outside the CLI', /fs\.(writeFile|writeFileSync|appendFile|unlink|rename)/],
      ['Job/ quarantine breach', /['"`]Job\//],
    ];
    for (const [name, re] of forbidden) {
      check(`no ${name}`, !re.test(src));
    }
    const creates = src.match(/vault\.create\(([^)]*)\)/g) || [];
    check('the only vault.create targets work/inbox/',
      creates.length === 1 && creates[0].includes('${INBOX}'),
      creates.join(' | '));
    check('mutations go through los.py only',
      /runLos\(\['generate'\]/.test(src) && /runLos\(\['validate'\]/.test(src));
  }

  console.log(failures ? `\n${failures} FAILURE(S)` : '\nall tests passed');
  return failures ? 1 : 0;
}

main().then((c) => process.exit(c)).catch((e) => {
  console.error(e);
  process.exit(1);
});
