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
    if (args[0] === 'ui-capability' && stdin) {
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

  const completedApp = makeApp(FIXTURE);
  const originalRead = completedApp.vault.adapter.read.bind(completedApp.vault.adapter);
  completedApp.vault.adapter.read = async (file) => {
    const raw = await originalRead(file);
    if (file !== 'generated/manifest.json') return raw;
    const manifest = JSON.parse(raw);
    manifest.ai_actions = {
      ...manifest.ai_actions,
      requests: (manifest.ai_actions?.requests || []).map((req) => (
        req.delivery_id === 'ai-delivery-fixture'
          ? { ...req, status: 'completed', receipt_id: 'transaction-20261124-000001-001' }
          : req
      )),
    };
    return JSON.stringify(manifest);
  };
  const completedPlugin = new LearningOSUI(completedApp, { id: 'learningos-ui', version: 'test' });
  completedPlugin.runLos = (_args, callback) => callback(null, JSON.stringify({ ok: true }), '');
  completedApp._plugin = completedPlugin;
  await completedPlugin.onload();
  await completedPlugin.nav.openGarden();
  const completedRoot = completedApp.workspace.getLeavesOfType('learningos-garden')[0].view.contentEl;
  const completedText = completedRoot.allText();
  check('completed AI request renders completed status and hides Apply approved delivery',
    completedText.includes('AI request · completed')
    && completedText.includes('receipt transaction-20261124-000001-001')
    && completedRoot.findText('los-btn', 'Apply approved delivery') === null);
  completedPlugin.onunload();

  await prepareRecoveryChecks();
  await applyRedrawChecks();

  if (failures) process.exitCode = 1;
}

const REQUEST_ID = /^ai-request-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const flagValue = (args, flag) => args[args.indexOf(flag) + 1];
const prepared = (requestId) => JSON.stringify({
  ok: true,
  request: { id: requestId, status: 'prepared', bundle_path: `operations/ai-actions/requests/${requestId}` },
  bundle_path: `operations/ai-actions/requests/${requestId}`,
});
const exitError = (code) => Object.assign(new Error(`exit ${code}`), { code });

async function loadedPlugin(runLos, data) {
  const app = makeApp(FIXTURE);
  const plugin = new LearningOSUI(app, { id: 'learningos-ui', version: 'test' });
  if (data) plugin._data = data;
  plugin.runLos = runLos;
  app._plugin = plugin;
  await plugin.onload();
  return { app, plugin };
}

/** CL-03: the prepare identity is minted and recorded before Core runs. */
async function prepareRecoveryChecks() {
  // 1. A normal prepare carries a minted id and leaves the slot clear.
  let calls = [];
  let slotDuringCall;
  let { plugin } = await loadedPlugin((args, callback) => {
    calls.push(args);
    if (args[0] === 'ai-action-prepare') {
      slotDuringCall = structuredClone(plugin.settings.gatewayRecovery);
      return callback(null, prepared(flagValue(args, '--request-id')), '');
    }
    return callback(null, JSON.stringify({ ok: true }), '');
  });
  await plugin.aiActions.prepareGardenShelving('garden-note-fixture-soft-knn');
  let prepares = calls.filter((args) => args[0] === 'ai-action-prepare');
  const minted = flagValue(prepares[0], '--request-id');
  check('prepare sends a Core-compatible request id it minted', REQUEST_ID.test(minted || ''));
  check('the prepare intent is persisted before Core is spawned',
    slotDuringCall?.schema_version === 3 && slotDuringCall?.kind === 'ai-prepare'
    && slotDuringCall?.request_id === minted && slotDuringCall?.phase === 'prepared');
  check('a confirmed prepare retires its recovery record', plugin.settings.gatewayRecovery === null);
  plugin.onunload();

  // 2. A lost response is retried once under the same id, not a new one.
  calls = [];
  ({ plugin } = await loadedPlugin((args, callback) => {
    calls.push(args);
    if (args[0] === 'ai-action-prepare') {
      const attempt = calls.filter((row) => row[0] === 'ai-action-prepare').length;
      if (attempt === 1) return callback(new Error('the process was killed'), '', '');
      return callback(null, prepared(flagValue(args, '--request-id')), '');
    }
    return callback(null, JSON.stringify({ ok: true }), '');
  }));
  const result = await plugin.aiActions.prepareGardenShelving('garden-note-fixture-soft-knn');
  prepares = calls.filter((args) => args[0] === 'ai-action-prepare');
  check('an interrupted prepare is retried under its original id',
    prepares.length === 2 && flagValue(prepares[0], '--request-id') === flagValue(prepares[1], '--request-id'));
  check('the retried prepare returns the confirmed request and clears the slot',
    result?.request?.id === flagValue(prepares[0], '--request-id')
    && plugin.settings.gatewayRecovery === null);
  plugin.onunload();

  // 3. A record left by a crash is settled at startup with the same identity.
  const stored = {
    schema_version: 3, kind: 'ai-prepare', phase: 'recovering',
    request_id: 'ai-request-20261128-120000-abc123', action_id: 'garden.shelve',
    target_kind: 'garden-note', target_id: 'garden-note-fixture-soft-knn',
    provider: 'manual-bundle', expected_snapshot: FIXTURE_SNAPSHOT,
    created_at: '2026-11-28T12:00:00.000Z', last_error: null,
  };
  calls = [];
  ({ plugin } = await loadedPlugin((args, callback) => {
    calls.push(args);
    if (args[0] === 'ai-action-prepare') return callback(null, prepared(flagValue(args, '--request-id')), '');
    return callback(null, JSON.stringify({ ok: true }), '');
  }, { gatewayRecovery: structuredClone(stored) }));
  await waitFor(() => plugin.settings.gatewayRecovery === null, 'startup prepare settlement');
  prepares = calls.filter((args) => args[0] === 'ai-action-prepare');
  check('startup settles an interrupted prepare by its stored id',
    prepares.length === 1 && flagValue(prepares[0], '--request-id') === stored.request_id
    && flagValue(prepares[0], '--expected-snapshot') === stored.expected_snapshot);
  check('a settled startup prepare leaves no unresolved write', plugin.recovery.unresolved === false);
  plugin.onunload();

  // 4. A definitive refusal for an id Core never stored retires the record.
  calls = [];
  ({ plugin } = await loadedPlugin((args, callback) => {
    calls.push(args);
    if (args[0] === 'ai-action-prepare') return callback(exitError(3), '', 'los: stale snapshot\n');
    if (args[0] === 'ai-action-status') return callback(exitError(1), '', 'los: AI action request not found\n');
    return callback(null, JSON.stringify({ ok: true }), '');
  }));
  let refused = null;
  try { await plugin.aiActions.prepareGardenShelving('garden-note-fixture-soft-knn'); }
  catch (error) { refused = error; }
  check('a prepare Core refused before storing anything is reported and retired',
    refused !== null && plugin.settings.gatewayRecovery === null && plugin.recovery.unresolved === false);
  plugin.onunload();

  // 5. A refusal for an id that does exist stays blocked for Diagnostics.
  ({ plugin } = await loadedPlugin((args, callback) => {
    if (args[0] === 'ai-action-prepare') return callback(exitError(1), '', 'los: request already exists: x with a different target\n');
    if (args[0] === 'ai-action-status') return callback(null, JSON.stringify({ ok: true, id: flagValue(args, args[1]) }), '');
    return callback(null, JSON.stringify({ ok: true }), '');
  }));
  try { await plugin.aiActions.prepareGardenShelving('garden-note-fixture-soft-knn'); } catch (_) { /* expected */ }
  check('a conflicting stored request keeps the intent blocked',
    plugin.settings.gatewayRecovery?.phase === 'blocked' && plugin.recovery.unresolved === true);
  plugin.onunload();
}

/** CL-04: the apply lock belongs to the delivery, not to one render. */
async function applyRedrawChecks() {
  const envelopes = [];
  let release = null;
  const { app, plugin } = await loadedPlugin((args, callback, stdin) => {
    if (args[0] === 'ai-action-apply-preview') return callback(null, JSON.stringify({
      ok: true,
      delivery_id: args[1],
      request_id: 'ai-request-fixture',
      delivery_sha256: `sha256:${'b'.repeat(64)}`,
      artifact_sha256: { 'artifacts/note.md': `sha256:${'c'.repeat(64)}` },
      expected_snapshot: FIXTURE_SNAPSHOT,
      expected_revisions: { 'garden-note-fixture-soft-knn': 0 },
    }), '');
    if (args[0] === 'ui-capability' && stdin) {
      const env = JSON.parse(stdin);
      envelopes.push(env);
      release = () => callback(null, JSON.stringify({
        schema_version: 2, request_id: env.request_id, idempotency_key: env.idempotency_key,
        capability: env.capability, ok: true, replayed: false, transaction_id: 'tx-ai-fixture',
        receipt_path: 'operations/transactions/tx-ai-fixture.yaml', snapshot_after: FIXTURE_SNAPSHOT,
        result: { receipt: { id: 'ai-receipt-fixture' } }, error: null,
      }), '');
      return undefined;
    }
    return callback(null, JSON.stringify({ ok: true }), '');
  });
  await plugin.nav.openGarden();
  const view = app.workspace.getLeavesOfType('learningos-garden')[0].view;
  view.contentEl.findText('los-btn', 'Apply approved delivery').fire('click');
  await waitFor(() => release !== null, 'apply in flight');
  view.render();
  await tick();
  const redrawn = view.contentEl.findText('los-btn', 'Apply approved delivery');
  check('a redraw mid-apply renders the Apply button disabled', redrawn?.disabled === true);
  redrawn?.fire('click');
  await tick(); await tick();
  check('a redrawn Apply button cannot start a second application', envelopes.length === 1);
  release();
  await waitFor(() => !plugin.gateway.isBusy, 'apply settled');
  plugin.onunload();
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
