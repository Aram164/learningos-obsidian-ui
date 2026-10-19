/*
 * Research track #2, Phase 4A: the Operations view contract.
 *
 * - The `operations` response decoders accept exactly what Core emits and
 *   reject anything else (the view shows "unavailable", never guesses).
 * - The GatewayClient porcelain builds the documented CLI invocations.
 *
 *   node tests/test-operations.js
 */
'use strict';

const assert = require('assert/strict');
const path = require('path');
const { createSourceModuleLoader } = require('./source-module-loader');

const ROOT = path.dirname(__dirname);
const load = createSourceModuleLoader(ROOT);

const { asOperationsList, asOperationDetail } = load('src/contracts/operations.ts');
const { GatewayClient } = load('src/gateway-client.ts');
const { MemoryGatewayRecoveryStore } = load('src/application/gateway-recovery.ts');

const ROW = {
  trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
  request_id: 'request-ops-001',
  capability: 'garden.seed.create',
  started_at: 1789873707.284,
  duration_ms: 287.4,
  attempts: 1,
  replayed: false,
  first_failure_stage: null,
  canonical_outcome: 'COMMITTED',
  recovery_requirement: 'none',
  needs_attention: false,
};

const DETAIL = {
  request_id: 'request-ops-001',
  capability: 'garden.seed.create',
  diagnosis: {
    first_failure_stage: null,
    execution_outcome: 'committed',
    canonical_outcome: 'COMMITTED',
    projection_outcome: 'published',
    recovery_requirement: 'none',
    authoritative_evidence: ['receipt:operations/transactions/transaction-1.yaml'],
    attempts: [{ span: '00f067aa0ba902b7', status: 'ok', replay_of: null }],
    reasons: ['a committed receipt and its ledger entry agree'],
  },
  timeline: [
    { stage: 'Core admitted request', state: 'passed', detail: null },
    { stage: 'Transaction committed', state: 'passed', detail: null },
  ],
  observed_snapshot: 'sha256:abc',
  ui_outcome: 'SETTLED',
  facts: {
    transaction_id: 'transaction-1',
    receipt_path: 'operations/transactions/transaction-1.yaml',
    snapshot_before: 'sha256:000',
    snapshot_after: 'sha256:abc',
  },
};

function testDecoders() {
  assert.deepEqual(asOperationsList({ operations: [ROW] }), { operations: [ROW] });
  assert.deepEqual(asOperationDetail(DETAIL).request_id, 'request-ops-001');
  assert.equal(asOperationsList({ operations: 'nope' }), null);
  assert.equal(asOperationsList({ operations: [{ ...ROW, canonical_outcome: 'MAYBE' }] }), null);
  assert.equal(asOperationsList({ operations: [{ ...ROW, extra: 1 }] }), null);
  assert.equal(asOperationDetail({ ...DETAIL, ui_outcome: 'PENDING' }), null);
  assert.equal(asOperationDetail({ ...DETAIL, timeline: [{ stage: 'x', state: 'bogus', detail: null }] }), null);
  assert.equal(asOperationDetail({ ...DETAIL, facts: { ...DETAIL.facts, transaction_id: 7 } }), null);
  assert.equal(asOperationDetail(null), null);
}

async function testPorcelain() {
  const seen = [];
  const gateway = new GatewayClient({
    runLos: (args, callback) => {
      seen.push(args);
      callback(null, JSON.stringify({ operations: [] }), '');
    },
    store: { snapshotId: `sha256:${'1'.repeat(64)}` },
    recovery: new MemoryGatewayRecoveryStore(),
    notify: () => {},
  });
  await gateway.operationsList(30);
  await gateway.operationsDetail('request-ops-001');
  assert.deepEqual(seen, [
    ['operations', '--limit', '30'],
    ['operations', '--request-id', 'request-ops-001'],
  ]);
}

async function main() {
  testDecoders();
  await testPorcelain();
  console.log('test-operations: ok (2 groups)');
}

main().then(
  () => {},
  (error) => { console.error(error); process.exit(1); },
);
