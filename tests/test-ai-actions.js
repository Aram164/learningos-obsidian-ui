/* AI-action launcher contract tests. Synthetic fixture only. */
'use strict';

const path = require('path');
const { makeApp, Notice } = require('./harness');
const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'fixture-vault');
const LearningOSUI = require(path.join(ROOT, 'plugin', 'main.js'));
const tick = () => new Promise((resolve) => setImmediate(resolve));
let failures = 0;
function check(name, condition, detail = '') {
  if (condition) { console.log(`  ok   ${name}`); return; }
  failures += 1;
  console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
}

async function main() {
  console.log('\nLearningOS AI-action tests (synthetic fixture only)');
  const app = makeApp(FIXTURE);
  const calls = [];
  const plugin = new LearningOSUI(app, { id: 'learningos-ui', version: 'test' });
  plugin.runLos = (args, callback) => {
    calls.push(args);
    if (args[0] === 'ai-action-prepare') return callback(null, JSON.stringify({
      ok: true,
      request: { id: 'ai-request-new', status: 'prepared', bundle_path: 'operations/ai-actions/requests/ai-request-new' },
      bundle_path: 'operations/ai-actions/requests/ai-request-new',
    }), '');
    if (args[0] === 'ai-action-apply-delivery') return callback(null, JSON.stringify({
      ok: true, receipt: { id: 'ai-receipt-fixture' },
    }), '');
    return callback(null, JSON.stringify({ ok: true }), '');
  };
  app._plugin = plugin;
  await plugin.onload();
  await plugin.nav.openGarden();
  const leaf = app.workspace.getLeavesOfType('learningos-garden')[0];
  const root = leaf.view.contentEl;
  const text = root.allText();

  check('Garden is a first-class review view', text.includes('Attention looks like soft k-NN'));
  check('launcher is action-specific rather than generic', text.includes('Refine with AI') && !text.includes('Ask AI'));
  check('provider configuration stays out of the incubation row', !text.includes('claude (unavailable)')
    && !text.includes('chatgpt (unavailable)'));
  check('the original and AI-derived state remain distinct', text.includes('Open original')
    && text.includes('AI request · delivery-ready'));

  root.findText('los-btn', 'Refine with AI').fire('click');
  await tick(); await tick();
  const prepare = calls.find((args) => args[0] === 'ai-action-prepare');
  check('launcher invokes the exact garden.shelve capability', prepare?.includes('garden.shelve')
    && prepare?.includes('garden-note') && prepare?.includes('garden-note-fixture-soft-knn'));
  check('request is snapshot guarded', prepare?.includes('--expected-snapshot')
    && prepare?.includes('sha256:fixture-v2-snapshot'));
  check('manual adapter is selected explicitly', prepare?.includes('--provider')
    && prepare?.includes('manual-bundle'));
  check('quarantined Job paths never enter the request command', !prepare?.some((value) => String(value).includes('Job/')));

  root.findText('los-btn', 'Apply approved delivery').fire('click');
  await tick(); await tick();
  const apply = calls.find((args) => args[0] === 'ai-action-apply-delivery');
  check('approved delivery application uses its exact delivery ID', apply?.[1] === 'ai-delivery-fixture');
  check('successful preparation is reported without provider access',
    Notice.log.some((message) => message.includes('operations/ai-actions/requests/ai-request-new')));

  plugin.onunload();
  if (failures) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
