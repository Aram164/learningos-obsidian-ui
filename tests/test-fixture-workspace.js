/* Exercise the production diagnostic sink across isolated test processes. */
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'fixture-vault');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'learningos-ui-fixture-test-'));
const tracePath = path.join('operations', 'diagnostics', 'traces.jsonl');

function fingerprint(root) {
  const digest = crypto.createHash('sha256');
  function visit(relative = '') {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const name = path.join(relative, entry.name);
      digest.update(name);
      if (entry.isDirectory()) visit(name);
      else digest.update(fs.readFileSync(path.join(root, name)));
    }
  }
  visit();
  return digest.digest('hex');
}

const probe = String.raw`
  const assert = require('assert/strict');
  const fs = require('fs');
  const path = require('path');
  const [root, source, code, signal] = process.argv.slice(1);
  const { makeApp } = require(path.join(root, 'tests', 'harness'));
  const LearningOSUI = require(process.env.LEARNINGOS_TEST_BUNDLE || path.join(root, 'plugin', 'main.js'));
  const first = makeApp(source);
  const base = first.vault.adapter.getBasePath();
  assert.notEqual(base, source);
  assert.equal(makeApp(source).vault.adapter.getBasePath(), base, 'restart shares the disposable vault');
  const trace = path.join(base, 'operations', 'diagnostics', 'traces.jsonl');
  assert.equal(fs.existsSync(trace), false, 'a fresh run never inherits old diagnostic output');
  const plugin = new LearningOSUI(first, { id: 'learningos-ui', version: 'test' });
  plugin.diagnostics({ v: 2, kind: 'event', name: 'fixture.isolation.probe', op: '1'.repeat(32), span: '2'.repeat(16), ts: 1, attributes: { exit_code: Number(code) } });
  const event = JSON.parse(fs.readFileSync(trace, 'utf8').trim());
  assert.equal(event.schema_version, 1);
  assert.equal(event.conventions_version, 2);
  assert.equal(event.name, 'fixture.isolation.probe');
  assert.equal(event.trace_id, '1'.repeat(32));
  first.vault.adapter.read('generated/manifest.json').then((text) => {
    assert.equal(text, fs.readFileSync(path.join(source, 'generated/manifest.json'), 'utf8'));
    console.log(JSON.stringify({ base }));
    if (signal) {
      setTimeout(() => { throw new Error('signal did not terminate the test process'); }, 5000);
      process.kill(process.pid, signal);
    } else {
      process.exit(Number(code));
    }
  }).catch((error) => { console.error(error); process.exit(1); });
`;

function run(source, code = 0, signal = '') {
  const result = spawnSync(process.execPath, ['-e', probe, ROOT, source, String(code), signal], {
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(result.status, code, result.stderr);
  const { base } = JSON.parse(result.stdout.trim());
  assert.equal(fs.existsSync(path.dirname(base)), false, 'process exit removes the temporary workspace');
  return { base, stderr: result.stderr };
}

try {
  const before = fingerprint(SOURCE);
  const first = run(SOURCE);
  const second = run(SOURCE);
  assert.notEqual(first.base, second.base, 'consecutive runs use distinct physical vaults');
  assert.equal(first.stderr + second.stderr, '', 'successful runs clean up quietly');
  assert.equal(fingerprint(SOURCE), before, 'two real diagnostic runs leave the persistent fixture unchanged');

  const oldOutput = path.join(temporary, 'fixture');
  fs.cpSync(SOURCE, oldOutput, { recursive: true });
  const oldTrace = path.join(oldOutput, tracePath);
  fs.mkdirSync(path.dirname(oldTrace), { recursive: true });
  fs.writeFileSync(oldTrace, 'old diagnostic output stays untouched\n');
  const failed = run(oldOutput, 17);
  assert.match(failed.stderr, /Synthetic fixture diagnostics/);
  assert.match(failed.stderr, /fixture\.isolation\.probe/);
  assert.doesNotMatch(failed.stderr, /old diagnostic output/);
  assert.equal(fs.readFileSync(oldTrace, 'utf8'), 'old diagnostic output stays untouched\n');
  for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
    const interrupted = run(oldOutput, code, signal);
    assert.match(interrupted.stderr, /fixture\.isolation\.probe/, `${signal} retains diagnostic evidence`);
    assert.equal(fs.readFileSync(oldTrace, 'utf8'), 'old diagnostic output stays untouched\n');
  }
  assert.equal(fingerprint(SOURCE), before, 'failure cleanup also leaves the source fixture unchanged');
  console.log('test-fixture-workspace: ok (repeat isolation, production sink, success/failure/signal cleanup)');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
