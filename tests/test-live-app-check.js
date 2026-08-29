/*
 * Unit tests for the pure logic in scripts/check-live-app.mjs.
 *
 * These run headless, with no Obsidian process and no live CLI — exactly the
 * command-allowlist enforcement, command-id resolution, DOM-count assertion,
 * error-buffer diffing, and metadata redaction the plan requires proof of,
 * exercised against synthetic CLI output rather than the real binary. The
 * `spawnSync` glue in check-live-app.mjs itself is deliberately not covered
 * here — it can only be verified against the real CLI (Phase 15).
 */
import assert from 'node:assert/strict';
import {
  HARD_ALLOWED_COMMANDS,
  LiveAppCheckError,
  REQUIRED_APP_VERSION,
  REQUIRED_PLUGIN_VERSION,
  assertAllowedCommand,
  assertExactlyOne,
  countDomClass,
  newErrors,
  parseCommandList,
  redactDiagnostics,
  resolveCommandId,
  versionAtLeast,
  versionExactly,
} from '../scripts/check-live-app.mjs';

let failures = 0;
let checks = 0;
function test(name, body) {
  try {
    body();
    checks += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL ${name}`);
    console.error(error.stack || error);
  }
}

// ---- the hard allowlist -----------------------------------------------

test('every hard-allowed command is a plain, non-empty string', () => {
  assert.ok(HARD_ALLOWED_COMMANDS.size > 0);
  for (const command of HARD_ALLOWED_COMMANDS) {
    assert.equal(typeof command, 'string');
    assert.ok(command.trim());
  }
});

test('a command outside the allowlist is refused', () => {
  assert.throws(() => assertAllowedCommand(['eval', 'window.close()']), LiveAppCheckError);
  assert.throws(() => assertAllowedCommand(['some-unlisted-command']), LiveAppCheckError);
});

test('a write-shaped argument is refused even to an otherwise-allowed command', () => {
  // "command" itself is allowed; the id it is asked to invoke is not.
  assert.throws(() => assertAllowedCommand(['command', 'note:create']), LiveAppCheckError);
  assert.throws(() => assertAllowedCommand(['command', 'note:delete']), LiveAppCheckError);
  assert.throws(() => assertAllowedCommand(['command', 'sync:now']), LiveAppCheckError);
  assert.throws(() => assertAllowedCommand(['command', 'publish:site']), LiveAppCheckError);
});

test('an ordinary allowed command passes', () => {
  assert.doesNotThrow(() => assertAllowedCommand(['command', 'open-home']));
  assert.doesNotThrow(() => assertAllowedCommand(['dev:dom']));
  assert.doesNotThrow(() => assertAllowedCommand(['version']));
});

// ---- command-id resolution ----------------------------------------------

test('resolveCommandId finds an exact single match', () => {
  const commands = [{ id: 'open-home', name: 'Open Home' }, { id: 'open-review', name: 'Open Review' }];
  assert.equal(resolveCommandId(commands, 'open-home'), 'open-home');
});

test('resolveCommandId refuses a missing command id', () => {
  assert.throws(
    () => resolveCommandId([{ id: 'open-home', name: 'Open Home' }], 'open-diagnostics'),
    LiveAppCheckError,
  );
});

test('resolveCommandId refuses an ambiguous command id', () => {
  const commands = [
    { id: 'open-home', name: 'Open Home' },
    { id: 'open-home', name: 'Open Home (duplicate registration)' },
  ];
  assert.throws(() => resolveCommandId(commands, 'open-home'), LiveAppCheckError);
});

test('parseCommandList reads JSON array output', () => {
  const raw = JSON.stringify([{ id: 'open-home', name: 'Open Home' }]);
  assert.deepEqual(parseCommandList(raw), [{ id: 'open-home', name: 'Open Home' }]);
});

test('parseCommandList reads tab-separated line output', () => {
  const raw = 'open-home\tOpen Home\nopen-diagnostics\tOpen Diagnostics\n';
  assert.deepEqual(parseCommandList(raw), [
    { id: 'open-home', name: 'Open Home' },
    { id: 'open-diagnostics', name: 'Open Diagnostics' },
  ]);
});

test('parseCommandList never throws on empty or unreadable output', () => {
  assert.deepEqual(parseCommandList(''), []);
  assert.deepEqual(parseCommandList('   \n  '), []);
});

// ---- DOM-count assertion --------------------------------------------------

test('countDomClass matches a whole class token, not a substring', () => {
  assert.equal(countDomClass('<div class="los-home"></div>', 'los-home'), 1);
  assert.equal(countDomClass('<div class="los-home-extra"></div>', 'los-home'), 0);
  assert.equal(countDomClass('<div class="foo los-home bar"></div>', 'los-home'), 1);
});

test('assertExactlyOne passes for exactly one match', () => {
  assert.doesNotThrow(() => assertExactlyOne('<div class="los-home"></div>', 'los-home'));
});

test('assertExactlyOne fails when the class is missing', () => {
  assert.throws(() => assertExactlyOne('<div class="other"></div>', 'los-home'), LiveAppCheckError);
});

test('assertExactlyOne fails when the class appears more than once', () => {
  const html = '<div class="los-home"></div><div class="los-home"></div>';
  assert.throws(() => assertExactlyOne(html, 'los-home'), LiveAppCheckError);
});

// ---- version checks --------------------------------------------------------

test('versionAtLeast accepts the exact required version', () => {
  assert.equal(versionAtLeast(REQUIRED_APP_VERSION, REQUIRED_APP_VERSION), true);
});

test('versionAtLeast accepts a newer version and refuses an older one', () => {
  assert.equal(versionAtLeast('1.13.0', REQUIRED_APP_VERSION), true);
  assert.equal(versionAtLeast('1.12.6', REQUIRED_APP_VERSION), false);
});

test('versionAtLeast is false for unreadable version strings', () => {
  assert.equal(versionAtLeast('not-a-version', REQUIRED_APP_VERSION), false);
  assert.equal(versionAtLeast(undefined, REQUIRED_APP_VERSION), false);
});

test('versionExactly requires the plugin version to match precisely', () => {
  assert.equal(versionExactly(REQUIRED_PLUGIN_VERSION, REQUIRED_PLUGIN_VERSION), true);
  assert.equal(versionExactly('2.0.1', REQUIRED_PLUGIN_VERSION), false);
  assert.equal(versionExactly('2.0.0-beta', REQUIRED_PLUGIN_VERSION), false);
});

// ---- error-buffer diffing --------------------------------------------------

test('newErrors reports only entries absent before', () => {
  assert.deepEqual(newErrors(['a'], ['a', 'b']), ['b']);
});

test('newErrors reports nothing when the buffer only shrinks', () => {
  assert.deepEqual(newErrors(['a', 'b'], ['a']), []);
});

test('newErrors reports nothing for an unchanged buffer', () => {
  assert.deepEqual(newErrors(['a', 'b'], ['a', 'b']), []);
});

// ---- metadata redaction -----------------------------------------------

test('redactDiagnostics keeps only the declared safe fields', () => {
  const redacted = redactDiagnostics({
    manifestContract: 8,
    runtimeFingerprintMatches: true,
    coreRevision: 'a'.repeat(40),
    uiRevision: 'b'.repeat(40),
    coreDirty: false,
    sourceDirty: false,
    gatewayRecoveryClear: true,
    capturedText: 'this must never appear',
    localFilePath: '/Users/aram/secret/path.md',
  });
  assert.deepEqual(redacted, {
    manifestContract: 8,
    runtimeFingerprintMatches: true,
    coreRevision: 'a'.repeat(40),
    uiRevision: 'b'.repeat(40),
    coreDirty: false,
    sourceDirty: false,
    gatewayRecoveryClear: true,
  });
  assert.ok(!('capturedText' in redacted));
  assert.ok(!('localFilePath' in redacted));
});

test('redactDiagnostics tolerates a missing or empty input', () => {
  assert.deepEqual(redactDiagnostics(undefined), {});
  assert.deepEqual(redactDiagnostics({}), {});
});

if (failures) {
  console.error(`\n${failures} live-app-check test failure(s)`);
  process.exit(1);
}
console.log(`\n${checks} live-app-check tests passed`);
