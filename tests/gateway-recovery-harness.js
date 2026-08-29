/*
 * The UI's real GatewayClient against the real Core CLI.
 *
 * Why this exists at all: the synthetic suite once agreed enthusiastically with
 * a UI that every real capture was refused by. A mock answers what its author
 * expected; only the actual process answers what Core does. Recovery is
 * exactly the area where that gap matters most, because its whole premise is
 * "Core already saw this request" — a claim no mock can make good on.
 *
 * So this harness loads `src/gateway-client.ts` through the ordinary source
 * loader (no bundle, no stubbed transport) and points its `runLos` at
 * `tools/los.py` running in a throwaway mini repository. Core is told nothing
 * about the interruptions; from its side these are ordinary requests, one of
 * which happens to arrive twice.
 *
 * Driven by LearningOS/repository/tests/test_ui_gateway_recovery.py, which
 * builds the mini repository, supplies the interpreter, and does the
 * filesystem assertions afterwards — one canonical file, one receipt, one
 * idempotency entry.
 *
 *   node tests/gateway-recovery-harness.js \
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

const ROOT = path.dirname(__dirname);
const load = createSourceModuleLoader(ROOT);
const { GatewayClient } = load('src/gateway-client.ts');
const { SettingsGatewayRecoveryStore } = load('src/application/gateway-recovery.ts');
const { emptyUiDrafts } = load('src/application/draft-store.ts');

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'learningos-ui-recovery-'));
process.on('exit', () => fs.rmSync(workspace, { recursive: true, force: true }));

/** The real CLI, in the mini repository, with the UI's exact stdin. */
function spawnCore(args, stdin) {
  const result = spawnSync(
    python,
    [path.join(coreRoot, 'tools', 'los.py'), '--root', repo, ...args],
    { cwd: repo, input: stdin ?? '', encoding: 'utf8', timeout: 180000 },
  );
  if (result.error) throw result.error;
  const error = result.status === 0
    ? null
    : Object.assign(new Error(`los exited ${result.status}`), { code: result.status });
  return { error, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

/**
 * The snapshot the UI guards a write with is the one its projection published,
 * so it is read the way the app reads it — from `generated/manifest.json` —
 * and refreshed by the same `generate` the app runs.
 */
function refreshSnapshot() {
  const generated = spawnCore(['generate'], '');
  if (generated.error) throw new Error(`generate failed: ${generated.stderr || generated.stdout}`);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(repo, 'generated', 'manifest.json'), 'utf8'),
  );
  return manifest._generated.snapshot_id;
}

/** One "Obsidian session": settings read from disk, a store, a client. */
async function session(settingsFile, runLos) {
  const raw = fs.existsSync(settingsFile)
    ? JSON.parse(fs.readFileSync(settingsFile, 'utf8'))
    : {};
  const settings = {
    gatewayRecovery: raw.gatewayRecovery ?? null,
    uiDrafts: raw.uiDrafts ?? emptyUiDrafts(),
  };
  const recovery = new SettingsGatewayRecoveryStore(settings, async () => {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
  });
  await recovery.load();
  const notices = [];
  const snapshot = refreshSnapshot();
  const gateway = new GatewayClient({
    runLos,
    store: { snapshotId: snapshot },
    recovery,
    notify: (message) => notices.push(message),
  });
  return { gateway, recovery, settings, notices, snapshot };
}

/** A transport that hands the first request to Core and then loses the answer. */
function interruptOnce(sent) {
  let interrupted = false;
  return (args, callback, stdin) => {
    if (stdin) sent.push(stdin);
    const result = spawnCore(args, stdin);
    if (!interrupted && stdin) {
      interrupted = true;
      // Core has committed by now. The UI simply never learns the outcome —
      // the pipe closed, the child died, the window was closed.
      callback(Object.assign(new Error('the response was interrupted'), { code: null }), '', '');
      return;
    }
    callback(result.error, result.stdout, result.stderr);
  };
}

const scenarios = {};

scenarios.textCaptureReplay = async () => {
  const sent = [];
  const settingsFile = path.join(workspace, 'text-capture.json');
  const { gateway, notices, settings } = await session(settingsFile, interruptOnce(sent));
  const confirmation = await gateway.captureText('a thought Core already committed', 'Interrupted');
  assert.equal(sent.length, 2, 'exactly one replay');
  assert.equal(sent[0], sent[1], 'the replay is the identical stdin, byte for byte');
  assert.equal(confirmation.replayed, true,
    'Core must recognise the retry as the write it already performed');
  assert.ok(notices.some((line) => /Replaying the same approved request/.test(line)));
  return {
    capability: 'capture.create',
    transaction_id: confirmation.transaction_id,
    receipt_path: confirmation.receipt_path,
    idempotency_key: JSON.parse(sent[0]).idempotency_key,
    replayed: confirmation.replayed,
    attempts: sent.length,
    identical: sent[0] === sent[1],
    result: confirmation.result,
    recovery_after: settings.gatewayRecovery,
  };
};

scenarios.restartRecovery = async () => {
  const settingsFile = path.join(workspace, 'restart.json');
  const sent = [];

  // Session one: Core commits, and the app dies before it can read the answer.
  const crashed = await session(settingsFile, (args, callback, stdin) => {
    if (stdin) {
      sent.push(stdin);
      spawnCore(args, stdin);
      // No callback, ever: this process is gone.
      throw new Error('the Obsidian window was closed mid-write');
    }
    const result = spawnCore(args, stdin);
    callback(result.error, result.stdout, result.stderr);
  });
  await assert.rejects(crashed.gateway.captureText('a thought that outlived its session', 'Restarted'));
  const persisted = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  assert.equal(persisted.gatewayRecovery.phase, 'prepared',
    'the record has to survive with the envelope that was actually sent');

  // Session two: a fresh plugin, reading that file, resending that string.
  const replayed = [];
  const restarted = await session(settingsFile, (args, callback, stdin) => {
    if (stdin) replayed.push(stdin);
    const result = spawnCore(args, stdin);
    callback(result.error, result.stdout, result.stderr);
  });
  const outcome = await restarted.gateway.recoverPreparedEnvelope();
  const confirmation = await restarted.gateway.settle(outcome);
  assert.equal(replayed.length, 1);
  assert.equal(replayed[0], sent[0], 'the restarted app resends the persisted bytes');
  assert.equal(confirmation.replayed, true);
  return {
    capability: 'capture.create',
    transaction_id: confirmation.transaction_id,
    receipt_path: confirmation.receipt_path,
    idempotency_key: JSON.parse(sent[0]).idempotency_key,
    replayed: confirmation.replayed,
    attempts: sent.length + replayed.length,
    identical: sent[0] === replayed[0],
    result: confirmation.result,
  };
};

scenarios.gardenSeedReplay = async () => {
  const sent = [];
  const settingsFile = path.join(workspace, 'garden.json');
  const { gateway } = await session(settingsFile, interruptOnce(sent));
  const confirmation = await gateway.createGardenSeed(
    'a seed Core already planted', 'Interrupted seed',
  );
  const envelope = JSON.parse(sent[0]);
  assert.deepEqual(
    envelope.expected_revisions,
    { [`garden-request:${envelope.idempotency_key}`]: 0 },
    'the request-scoped guard must survive the replay unchanged',
  );
  assert.equal(sent[0], sent[1]);
  assert.equal(confirmation.replayed, true);
  return {
    capability: 'garden.seed.create',
    transaction_id: confirmation.transaction_id,
    receipt_path: confirmation.receipt_path,
    idempotency_key: envelope.idempotency_key,
    replayed: confirmation.replayed,
    attempts: sent.length,
    identical: sent[0] === sent[1],
    result: confirmation.result,
  };
};

scenarios.fileCaptureReplayAfterSourceChanged = async () => {
  const sent = [];
  const source = path.join(workspace, 'approved-input.pdf');
  fs.writeFileSync(source, Buffer.from([0, 1, 2, 254, 255]));
  const settingsFile = path.join(workspace, 'file-capture.json');
  let removed = false;
  const { gateway } = await session(settingsFile, (args, callback, stdin) => {
    if (stdin) sent.push(stdin);
    const result = spawnCore(args, stdin);
    if (sent.length === 1 && stdin) {
      // Core has copied the approved bytes into the inbox. Now the original
      // is deleted — the learner moved it, or it was a temp file. A retry that
      // rebuilt its envelope would have to re-hash a file that is gone.
      fs.rmSync(source, { force: true });
      removed = true;
      callback(Object.assign(new Error('the response was interrupted'), { code: null }), '', '');
      return;
    }
    callback(result.error, result.stdout, result.stderr);
  });
  const confirmation = await gateway.captureFile(source);
  assert.equal(removed, true, 'the external source really was gone before the replay');
  assert.equal(fs.existsSync(source), false);
  assert.equal(sent.length, 2);
  assert.equal(sent[0], sent[1], 'the replay cannot have re-read a file that no longer exists');
  assert.equal(confirmation.replayed, true);
  return {
    capability: 'capture.create',
    transaction_id: confirmation.transaction_id,
    receipt_path: confirmation.receipt_path,
    idempotency_key: JSON.parse(sent[0]).idempotency_key,
    replayed: confirmation.replayed,
    attempts: sent.length,
    identical: sent[0] === sent[1],
    result: confirmation.result,
  };
};

(async () => {
  const results = {};
  for (const [name, run] of Object.entries(scenarios)) {
    results[name] = await run();
  }
  process.stdout.write(`HARNESS_RESULT ${JSON.stringify(results)}\n`);
})().catch((error) => {
  process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
  process.exit(1);
});
