/* AI-action launcher contract tests. Synthetic fixture only. */
'use strict';

const path = require('path');
const fs = require('fs');
const { makeApp, Notice } = require('./harness');
const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'fixture-vault');
const LearningOSUI = require(
  process.env.LEARNINGOS_TEST_BUNDLE || path.join(ROOT, 'plugin', 'main.js'),
);
const FIXTURE_SNAPSHOT = JSON.parse(fs.readFileSync(
  path.join(FIXTURE, 'generated', 'manifest.json'), 'utf8'))._generated.snapshot_id;
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function waitFor(predicate, label = 'condition') {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
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
  const envelopes = [];
  const plugin = new LearningOSUI(app, { id: 'learningos-ui', version: 'test' });
  plugin.runLos = (args, callback, stdin) => {
    calls.push(args);
    if (args[0] === 'ai-action-prepare') return callback(null, JSON.stringify({
      ok: true,
      request: { id: 'ai-request-new', status: 'prepared', bundle_path: 'operations/ai-actions/requests/ai-request-new' },
      bundle_path: 'operations/ai-actions/requests/ai-request-new',
    }), '');
    if (args[0] === 'ai-action-apply-preview') return callback(null, JSON.stringify({
      ok: true,
      delivery_id: args[1],
      request_id: 'ai-request-fixture',
      delivery_sha256: `sha256:${'b'.repeat(64)}`,
      artifact_sha256: { 'artifacts/note.md': `sha256:${'c'.repeat(64)}` },
      expected_snapshot: FIXTURE_SNAPSHOT,
      expected_revisions: { 'garden-note-fixture-soft-knn': 0 },
    }), '');
    if (args[0] === 'capability' && stdin) {
      const env = JSON.parse(stdin);
      envelopes.push(env);
      return callback(null, JSON.stringify({
        schema_version: 2,
        request_id: env.request_id,
        idempotency_key: env.idempotency_key,
        capability: env.capability,
        ok: true,
        replayed: false,
        transaction_id: 'tx-ai-fixture',
        receipt_path: 'operations/transactions/tx-ai-fixture.yaml',
        snapshot_after: FIXTURE_SNAPSHOT,
        result: { receipt: { id: 'ai-receipt-fixture' } },
        error: null,
      }), '');
    }
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
    && prepare?.includes(FIXTURE_SNAPSHOT));
  check('manual adapter is selected explicitly', prepare?.includes('--provider')
    && prepare?.includes('manual-bundle'));
  check('ordinary learning needs no Job export ceremony', !prepare?.includes('--confirm-job-export'));

  const applyBtn = root.findText('los-btn', 'Apply approved delivery');
  applyBtn.fire('click');
  check('apply button disables immediately while delivery application is in flight', applyBtn.disabled === true);
  applyBtn.fire('click');
  await waitFor(() => envelopes.length === 1 && !plugin.gateway.isBusy, 'delivery apply envelope');
  const previewCall = calls.find((args) => args[0] === 'ai-action-apply-preview');
  const applyEnvelope = envelopes.find((env) => env.capability === 'ai-action.delivery.apply');
  check('approved delivery application previews digests first', previewCall?.[1] === 'ai-delivery-fixture');
  check('approved delivery application sends Gateway V2 approved-delivery envelope once',
    envelopes.length === 1
    && applyEnvelope?.payload?.delivery_id === 'ai-delivery-fixture'
    && applyEnvelope?.approval?.kind === 'approved-delivery'
    && applyEnvelope?.expected_snapshot === FIXTURE_SNAPSHOT);
  check('successful preparation is reported without provider access',
    Notice.log.some((message) => message.includes('operations/ai-actions/requests/ai-request-new')));

  plugin.onunload();
  if (failures) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
