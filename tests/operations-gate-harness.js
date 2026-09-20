/*
 * Research track #2, Phase 4C: the 8-scenario gate through the real UI.
 *
 * The real GatewayClient drives eight writes (success, stale snapshot,
 * revision conflict, invalid payload, dead transport, lost response,
 * projection failure, replay) against a throwaway mini repository with
 * curriculum. Every scenario walks the full client path by hand —
 * prepare → dispatch → settle → reconcile — with one operation per
 * scenario, so the stream (not the porcelain) is what the gate inspects.
 * UI-side diagnostic
 * events land in the mini's own trace store — the same production wiring
 * as `main.ts` — beside Core's spans, so the `operations` command resolves
 * the merged stream exactly as Diagnostics renders it.
 *
 * Driven by LearningOS/repository/tests/test_operations_gate.py, which
 * asserts the 8/8 verdicts from `operations --request-id` alone.
 *
 *   node tests/operations-gate-harness.js \
 *     --core-root <repo> --repo <mini> --python <interpreter>
 */
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { createSourceModuleLoader } = require('./source-module-loader');

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) {
    throw new Error(`${name} is required`);
  }
  return process.argv[index + 1];
}

const coreRoot = path.resolve(argument('--core-root'));
const repo = path.resolve(argument('--repo'));
const python = argument('--python');
const storeDir = path.join(repo, 'operations', 'diagnostics');
const storeFile = path.join(storeDir, 'traces.jsonl');

const ROOT = path.dirname(__dirname);
const load = createSourceModuleLoader(ROOT);
const { GatewayClient } = load('src/gateway-client.ts');
const { MemoryGatewayRecoveryStore } = load('src/application/gateway-recovery.ts');
const { newOperationContext, storeEnvelope } = load('src/infrastructure/trace-context.ts');

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'learningos-ops-gate-'));
process.on('exit', () => fs.rmSync(workspace, { recursive: true, force: true }));

function spawnCore(args, stdin, traceParent) {
  const result = spawnSync(
    python,
    [path.join(coreRoot, 'tools', 'los.py'), '--root', repo, ...args],
    {
      cwd: repo,
      input: stdin ?? '',
      encoding: 'utf8',
      timeout: 180000,
      env: {
        ...process.env,
        ...(traceParent === undefined ? {} : { TRACEPARENT: traceParent }),
      },
    },
  );
  if (result.error) throw result.error;
  const error = result.status === 0
    ? null
    : Object.assign(new Error(`los exited ${result.status}`), { code: result.status });
  return { error, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function refreshSnapshot() {
  const generated = spawnCore(['generate'], '');
  if (generated.error) throw new Error(`generate failed: ${generated.stderr || generated.stdout}`);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(repo, 'generated', 'manifest.json'), 'utf8'),
  );
  return manifest._generated.snapshot_id;
}

async function main() {
  fs.mkdirSync(storeDir, { recursive: true });
  const uiEventNames = [];
  const poison = { dropResponses: 0, deadTransport: false };

  const runLos = (args, callback, stdin, traceParent) => {
    if (poison.deadTransport) {
      callback(Object.assign(new Error('spawn ENOENT (poisoned transport)'),
        { code: 'ENOENT' }), '', '');
      return;
    }
    const result = spawnCore(args, stdin, traceParent);
    if (poison.dropResponses > 0) {
      poison.dropResponses -= 1;
      callback(null, '', ''); // Core ran; the answer never arrives
      return;
    }
    callback(result.error, result.stdout, result.stderr);
  };
  const diagnostics = (event) => {
    uiEventNames.push(event.name);
    fs.appendFileSync(storeFile, `${JSON.stringify(storeEnvelope(event))}\n`, 'utf8');
  };
  const freshClient = () => {
    const store = { snapshotId: refreshSnapshot() };
    const gateway = new GatewayClient({
      runLos,
      store,
      recovery: new MemoryGatewayRecoveryStore(),
      notify: () => {},
      diagnostics,
    });
    return { gateway, store };
  };
  const reported = {};

  // The production tail main.ts runs after a confirmation: reload the
  // projection, then emit the settled event, so `observed` reports a
  // reconciliation that actually happened instead of the pre-write store.
  function reconcile({ gateway, store }, confirmation) {
    store.snapshotId = refreshSnapshot();
    gateway.noteSettlementObserved(confirmation);
  }

  // One full client path: prepare → dispatch → settle → reconcile.
  async function send({ capability, payload, expectedSnapshot, expectedRevisions }) {
    const client = freshClient();
    const { gateway } = client;
    const operation = newOperationContext();
    const envelopeJson = await gateway.prepareCapability(
      capability, payload, expectedSnapshot, expectedRevisions, operation,
    );
    const outcome = await gateway.dispatchPreparedEnvelope(envelopeJson, { trace: operation });
    let settled = null;
    let thrown = null;
    try {
      settled = await gateway.settle(outcome, operation);
    } catch (error) {
      thrown = error;
    }
    if (settled) reconcile(client, settled);
    return {
      requestId: JSON.parse(envelopeJson).request_id,
      outcome, settled, thrown,
    };
  }

  // G1: success.
  {
    const sent = await send({
      capability: 'garden.seed.create',
      payload: { text: 'gate seed one', title: 'Gate one' },
      expectedSnapshot: refreshSnapshot(), expectedRevisions: {},
    });
    assert.equal(sent.outcome.outcome, 'confirmed');
    assert.ok(sent.settled);
    reported.G1 = sent.requestId;
  }
  // G2: stale snapshot.
  {
    const sent = await send({
      capability: 'garden.seed.create',
      payload: { text: 'stale seed' },
      expectedSnapshot: `sha256:${'0'.repeat(64)}`, expectedRevisions: {},
    });
    assert.equal(sent.outcome.outcome, 'refused');
    assert.equal(sent.thrown.gatewayCode, 'STALE_SNAPSHOT');
    reported.G2 = sent.requestId;
  }
  // G3: revision conflict on a stage write. Revisions must cover every
  // transaction artifact exactly; the unit is untouched by earlier garden
  // scenarios, so its guard is the fresh-mini revision 0.
  {
    const sent = await send({
      capability: 'stage.progress.update',
      payload: { unit_id: 'unit-demo-l01', stage_id: 'stage-demo', status: 'complete' },
      expectedSnapshot: refreshSnapshot(),
      expectedRevisions: { 'unit-demo-l01': 0, 'study-map-demo-l01': 999 },
    });
    assert.equal(sent.outcome.outcome, 'refused');
    assert.equal(sent.thrown.gatewayCode, 'REVISION_CONFLICT');
    reported.G3 = sent.requestId;
  }
  // G4: invalid payload.
  {
    const sent = await send({
      capability: 'garden.seed.create',
      payload: { bogus: 'no-text-field-here' },
      expectedSnapshot: refreshSnapshot(), expectedRevisions: {},
    });
    assert.equal(sent.outcome.outcome, 'refused');
    assert.equal(sent.thrown.gatewayCode, 'INVALID_REQUEST');
    reported.G4 = sent.requestId;
  }
  // G5: dead transport on the only attempt.
  {
    poison.deadTransport = true;
    let sent;
    try {
      sent = await send({
        capability: 'garden.seed.create',
        payload: { text: 'never sent' },
        expectedSnapshot: refreshSnapshot(), expectedRevisions: {},
      });
    } finally {
      poison.deadTransport = false;
    }
    assert.equal(sent.outcome.outcome, 'ambiguous');
    assert.equal(sent.thrown.gatewayCode, 'RECOVERY_BLOCKED');
    reported.G5 = sent.requestId;
  }
  // G6: first response lost, explicit replay settles.
  {
    const client = freshClient();
    const { gateway } = client;
    const operation = newOperationContext();
    const envelopeJson = await gateway.prepareCapability(
      'garden.seed.create', { text: 'lost then found' },
      refreshSnapshot(), {}, operation,
    );
    reported.G6 = JSON.parse(envelopeJson).request_id;
    poison.dropResponses = 1;
    const first = await gateway.dispatchPreparedEnvelope(envelopeJson, { trace: operation });
    assert.equal(first.outcome, 'ambiguous');
    const second = await gateway.recoverPreparedEnvelope(operation);
    assert.equal(second.outcome, 'confirmed');
    assert.equal(second.confirmation.replayed, true);
    reconcile(client, await gateway.settle(second, operation));
  }
  // G7: commit-time projection failure.
  {
    const snapshot = refreshSnapshot();
    const gateway = new GatewayClient({
      runLos,
      store: { snapshotId: snapshot },
      recovery: new MemoryGatewayRecoveryStore(),
      notify: () => {},
      diagnostics,
    });
    const operation = newOperationContext();
    const envelopeJson = await gateway.prepareCapability(
      'garden.seed.create', { text: 'doomed seed', title: 'G7' },
      snapshot, {}, operation,
    );
    reported.G7 = JSON.parse(envelopeJson).request_id;
    // First-publish failure, like S7-direct: with no projection files the
    // rollback cannot restore anything identical, so Core reports the
    // incomplete rollback as INTERNAL_FAILURE. (With a full projection
    // present, the identical rollback completes silently and the same
    // causality is mislabelled INVALID_REQUEST — a Core classifier gap the
    // resolver faithfully reports but must not fix from here.)
    const generated = path.join(repo, 'generated');
    for (const entry of fs.readdirSync(generated)) {
      if (entry !== 'reports') fs.rmSync(path.join(generated, entry), { force: true });
    }
    fs.chmodSync(generated, 0o555);
    let outcome;
    try {
      outcome = await gateway.dispatchPreparedEnvelope(envelopeJson, { trace: operation });
    } finally {
      fs.chmodSync(generated, 0o755);
    }
    assert.equal(outcome.outcome, 'ambiguous');
    await assert.rejects(gateway.settle(outcome, operation),
      (error) => error.gatewayCode === 'RECOVERY_BLOCKED');
  }
  // G8: explicit replay of the same envelope bytes.
  {
    const client = freshClient();
    const { gateway } = client;
    const operation = newOperationContext();
    const envelopeJson = await gateway.prepareCapability(
      'garden.seed.create', { text: 'replayed seed' },
      refreshSnapshot(), {}, operation,
    );
    reported.G8 = JSON.parse(envelopeJson).request_id;
    const first = await gateway.dispatchPreparedEnvelope(envelopeJson, { trace: operation });
    assert.equal(first.outcome, 'confirmed');
    const second = await gateway.dispatchPreparedEnvelope(envelopeJson, { trace: operation });
    assert.equal(second.outcome, 'confirmed');
    assert.equal(second.confirmation.replayed, true);
    reconcile(client, await gateway.settle(second, operation));
  }

  console.log(`HARNESS_RESULT ${JSON.stringify({
    ok: true,
    scenarios: reported,
    ui_event_count: uiEventNames.length,
  })}`);
}

main().then(
  () => {},
  (error) => { console.error(error); process.exit(1); },
);
