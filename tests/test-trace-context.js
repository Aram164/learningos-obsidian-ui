/*
 * Research track #2, Phase 1: trace context on the UI side.
 *
 * - `trace-context.ts` mints strictly-shaped W3C traceparents: one operation
 *   id across a send and its replay, one fresh span per physical dispatch.
 * - `LosRuntime.run` carries the parent as child environment and leaves the
 *   environment untouched when no context is given (stub interpreter proof).
 * - `GatewayClient`'s write path sends the same trace id on the initial
 *   dispatch and the in-session replay, with distinct span ids (fake
 *   transport capturing the fourth `runLos` argument).
 *
 *   node tests/test-trace-context.js
 */
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSourceModuleLoader } = require('./source-module-loader');

const ROOT = path.dirname(__dirname);
const load = createSourceModuleLoader(ROOT);

const {
  newOperationContext,
  childAttemptContext,
  formatTraceparent,
  parseTraceparent,
} = load('src/infrastructure/trace-context.ts');
const { LosRuntime } = load('src/infrastructure/los-runtime.ts');
const { GatewayClient } = load('src/gateway-client.ts');
const { MemoryGatewayRecoveryStore } = load('src/application/gateway-recovery.ts');

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';
const SPAN_ID = '00f067aa0ba902b7';

function testContextShapes() {
  const formatted = formatTraceparent({ traceId: TRACE_ID, spanId: SPAN_ID, sampled: true });
  assert.equal(formatted, `00-${TRACE_ID}-${SPAN_ID}-01`);
  assert.deepEqual(parseTraceparent(formatted), { traceId: TRACE_ID, spanId: SPAN_ID, sampled: true });
  assert.equal(parseTraceparent(`00-${TRACE_ID}-${SPAN_ID}-00`).sampled, false);
  for (const bad of [null, undefined, '', 'garbage', `01-${TRACE_ID}-${SPAN_ID}-01`,
    `00-${TRACE_ID}-${SPAN_ID}`, `00-${'0'.repeat(32)}-${SPAN_ID}-01`,
    `00-${TRACE_ID}-${'0'.repeat(16)}-01`, `00-${TRACE_ID.toUpperCase()}-${SPAN_ID}-01`]) {
    assert.equal(parseTraceparent(bad), null, String(bad));
  }
  const operation = newOperationContext();
  assert.match(operation.traceId, /^[0-9a-f]{32}$/);
  assert.match(operation.spanId, /^[0-9a-f]{16}$/);
  const attempt = childAttemptContext(operation);
  assert.equal(attempt.traceId, operation.traceId);
  assert.notEqual(attempt.spanId, operation.spanId);
  assert.notEqual(newOperationContext().traceId, operation.traceId);
}

function testRuntimeCarriesParentAsEnv() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'learningos-trace-rt-'));
  const stub = path.join(dir, 'stub-python.sh');
  fs.writeFileSync(stub, '#!/bin/sh\necho "TP:${TRACEPARENT:-unset}"\n');
  fs.chmodSync(stub, 0o755);
  const runtime = new LosRuntime(
    { vault: { adapter: { getBasePath: () => dir } } },
    () => stub,
  );
  const run = (traceParent) => new Promise((resolve, reject) => {
    runtime.run(['ignored'], (error, stdout) => {
      if (error) reject(error);
      else resolve(String(stdout).trim());
    }, undefined, traceParent);
  });
  return (async () => {
    const parent = `00-${TRACE_ID}-${SPAN_ID}-01`;
    assert.equal(await run(parent), `TP:${parent}`);
    assert.equal(await run(undefined), 'TP:unset');
  })().finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

async function testClientKeepsOneOperationAcrossReplay() {
  const seen = [];
  const success = (envelope) => JSON.stringify({
    schema_version: 2,
    request_id: envelope.request_id,
    idempotency_key: envelope.idempotency_key,
    capability: envelope.capability,
    ok: true,
    replayed: true,
    transaction_id: 'transaction-probe-001',
    receipt_path: 'operations/transactions/transaction-probe-001.yaml',
    snapshot_after: `sha256:${'2'.repeat(64)}`,
    result: {},
    error: null,
  });
  let calls = 0;
  const gateway = new GatewayClient({
    runLos: (args, callback, stdin, traceParent) => {
      calls += 1;
      seen.push(traceParent);
      if (calls === 1) {
        callback(null, '', ''); // unreadable: forces the in-session replay
        return;
      }
      callback(null, success(JSON.parse(stdin)), '');
    },
    store: { snapshotId: `sha256:${'1'.repeat(64)}` },
    recovery: new MemoryGatewayRecoveryStore(),
    notify: () => {},
  });
  const envelopeJson = await gateway.prepareCapability(
    'garden.seed.create', { title: 't', text: 'x' },
    `sha256:${'1'.repeat(64)}`, {},
  );
  const operation = newOperationContext();
  let result = await gateway.dispatchPreparedEnvelope(envelopeJson, { trace: operation });
  assert.equal(result.outcome, 'ambiguous');
  result = await gateway.recoverPreparedEnvelope(operation);
  assert.equal(result.outcome, 'confirmed');
  assert.equal(seen.length, 2);
  const [first, second] = seen.map(parseTraceparent);
  assert.ok(first && second, 'both dispatches must carry a strict traceparent');
  assert.equal(first.traceId, operation.traceId);
  assert.equal(second.traceId, operation.traceId);
  assert.notEqual(first.spanId, second.spanId);
}

async function testClientEmitsOneDiagnosticStream() {
  const events = [];
  const gateway = new GatewayClient({
    runLos: (args, callback, stdin) => {
      const envelope = JSON.parse(stdin);
      callback(null, JSON.stringify({
        schema_version: 2,
        request_id: envelope.request_id,
        idempotency_key: envelope.idempotency_key,
        capability: envelope.capability,
        ok: true,
        replayed: false,
        transaction_id: 'transaction-probe-002',
        receipt_path: 'operations/transactions/transaction-probe-002.yaml',
        snapshot_after: `sha256:${'2'.repeat(64)}`,
        result: {},
        error: null,
      }), '');
    },
    store: { snapshotId: `sha256:${'1'.repeat(64)}` },
    recovery: new MemoryGatewayRecoveryStore(),
    notify: () => {},
    diagnostics: (event) => events.push(event),
  });
  const operation = newOperationContext();
  const envelopeJson = await gateway.prepareCapability(
    'garden.seed.create', { title: 't', text: 'x' },
    `sha256:${'1'.repeat(64)}`, {}, operation,
  );
  const result = await gateway.dispatchPreparedEnvelope(envelopeJson, { trace: operation });
  assert.equal(result.outcome, 'confirmed');
  await gateway.settle(result, operation);
  assert.deepEqual(events.map((event) => event.name), [
    'gateway.envelope.prepared',
    'gateway.envelope.dispatched',
    'ui.response.received',
    'recovery.settled',
  ]);
  assert.ok(events.every((event) => event.op === operation.traceId));
  assert.equal(events[0].span, operation.spanId);
  assert.equal(events[1].span, events[2].span);
  assert.notEqual(events[1].span, operation.spanId);
  assert.equal(events[2].attributes.outcome, 'confirmed');
  assert.equal(events[3].attributes.observed, false);
}

async function main() {
  testContextShapes();
  await testRuntimeCarriesParentAsEnv();
  await testClientKeepsOneOperationAcrossReplay();
  await testClientEmitsOneDiagnosticStream();
  console.log('test-trace-context: ok (4 groups)');
}

main().then(
  () => {},
  (error) => { console.error(error); process.exit(1); },
);
