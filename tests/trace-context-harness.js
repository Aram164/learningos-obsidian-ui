/*
 * Research track #2, Phase 1: the UI's real GatewayClient against the real
 * Core CLI, proving the propagated trace context arrives intact.
 *
 * Same shape as gateway-recovery-harness.js: the real client, a transport
 * that forwards the fourth `runLos` argument as the child's TRACEPARENT
 * environment (plus Core's opt-in debug sink), one Garden seed in a throwaway
 * mini repository. Driven by
 * LearningOS/repository/tests/test_trace_context.py, which compares the
 * reported parent against Core's debug record.
 *
 *   node tests/trace-context-harness.js \
 *     --core-root <repo> --repo <mini> --python <interpreter> \
 *     --debug-file <sink>
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
const debugFile = path.resolve(argument('--debug-file'));

const ROOT = path.dirname(__dirname);
const load = createSourceModuleLoader(ROOT);
const { GatewayClient } = load('src/gateway-client.ts');
const { MemoryGatewayRecoveryStore } = load('src/application/gateway-recovery.ts');
const { parseTraceparent } = load('src/infrastructure/trace-context.ts');

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'learningos-ui-trace-'));
process.on('exit', () => fs.rmSync(workspace, { recursive: true, force: true }));

const sentParents = [];

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
        LOS_TRACE_DEBUG_FILE: debugFile,
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
  const runLos = (args, callback, stdin, traceParent) => {
    if (traceParent !== undefined) sentParents.push(traceParent);
    const result = spawnCore(args, stdin, traceParent);
    callback(result.error, result.stdout, result.stderr);
  };
  const uiEvents = [];
  const store = { snapshotId: refreshSnapshot() };
  const gateway = new GatewayClient({
    runLos,
    store,
    recovery: new MemoryGatewayRecoveryStore(),
    notify: () => {},
    diagnostics: (event) => {
      uiEvents.push(event);
      fs.appendFileSync(debugFile, `${JSON.stringify(event)}\n`, 'utf8');
    },
  });
  const confirmation = await gateway.createGardenSeed(
    'a seed planted while traced end to end', 'Trace probe',
  );
  assert.equal(confirmation.ok, true);
  // Production tail (main.ts): reload the projection, then settle the
  // stream — the settled event reports an observation, not the receipt.
  store.snapshotId = refreshSnapshot();
  gateway.noteSettlementObserved(confirmation);
  assert.equal(sentParents.length, 1, 'one dispatch earns exactly one parent');
  const context = parseTraceparent(sentParents[0]);
  assert.ok(context, 'the client must send a strictly-shaped traceparent');
  console.log(`HARNESS_RESULT ${JSON.stringify({
    ok: true,
    trace_id: context.traceId,
    span_id: context.spanId,
    transaction_id: confirmation.transaction_id,
    attempts: sentParents.length,
    ui_events: uiEvents.map((event) => event.name),
  })}`);
}

main().then(
  () => {},
  (error) => { console.error(error); process.exit(1); },
);
