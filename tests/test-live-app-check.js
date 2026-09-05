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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DIAGNOSTICS_ATTRIBUTES,
  DIAGNOSTICS_VIEW_CLASS,
  HARD_ALLOWED_COMMANDS,
  LiveAppCheckError,
  REQUIRED_APP_VERSION,
  REQUIRED_PLUGIN_VERSION,
  assertAllowedCommand,
  assertExactlyOne,
  assertLiveIdentity,
  cliRefusal,
  countDomClass,
  declaredManifestContract,
  extractDiagnostics,
  newErrors,
  parseCommandList,
  parseObsidianVersion,
  redactDiagnostics,
  requireFullSha,
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

test('a write-shaped argument is refused', () => {
  assert.throws(() => assertAllowedCommand(['dev:dom', 'note:create']), LiveAppCheckError);
  assert.throws(() => assertAllowedCommand(['dev:dom', 'note:delete']), LiveAppCheckError);
  assert.throws(() => assertAllowedCommand(['dev:dom', 'sync:now']), LiveAppCheckError);
  assert.throws(() => assertAllowedCommand(['dev:dom', 'publish:site']), LiveAppCheckError);
});

test('an ordinary allowed command passes', () => {
  assert.doesNotThrow(() => assertAllowedCommand(['dev:dom']));
  assert.doesNotThrow(() => assertAllowedCommand(['version']));
});

test('the allowlist contains no reload or navigation command', () => {
  // Both change state: a reload can replay a prepared Gateway envelope into a
  // real canonical write, and navigating persists UI route state. A read-only
  // checker gets neither.
  assert.equal(HARD_ALLOWED_COMMANDS.has('plugin:reload'), false);
  assert.equal(HARD_ALLOWED_COMMANDS.has('command'), false);
  assert.throws(() => assertAllowedCommand(['plugin:reload', 'learningos-ui']), LiveAppCheckError);
  assert.throws(() => assertAllowedCommand(['command', 'open-diagnostics']), LiveAppCheckError);
});

// ---- command-list parsing ------------------------------------------------

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

test('newErrors counts a repeated identical error as new', () => {
  // Set membership hid this: an error that had already happened once and then
  // happened again was reported as nothing new.
  assert.deepEqual(newErrors(['a'], ['a', 'a']), ['a']);
  assert.deepEqual(newErrors(['a', 'a'], ['a', 'a', 'a']), ['a']);
  assert.deepEqual(newErrors([], ['a', 'a']), ['a', 'a']);
});

// ---- exact-SHA inputs ------------------------------------------------------

test('requireFullSha accepts exactly 40 lowercase hex characters', () => {
  assert.equal(requireFullSha('a'.repeat(40), 'core-sha'), 'a'.repeat(40));
});

test('requireFullSha refuses short, uppercase, empty and missing values', () => {
  assert.throws(() => requireFullSha('a'.repeat(12), 'core-sha'), LiveAppCheckError);
  assert.throws(() => requireFullSha('A'.repeat(40), 'core-sha'), LiveAppCheckError);
  assert.throws(() => requireFullSha('', 'core-sha'), LiveAppCheckError);
  assert.throws(() => requireFullSha(null, 'ui-sha'), LiveAppCheckError);
});

// ---- live Diagnostics extraction and comparison ----------------------------

const CORE_SHA = 'a'.repeat(40);
const UI_SHA = 'b'.repeat(40);

function diagnosticsDom(overrides = {}) {
  const values = {
    manifestContract: '8',
    runtimeFingerprintMatches: 'yes',
    coreRevision: CORE_SHA,
    uiRevision: UI_SHA,
    coreDirty: 'false',
    sourceDirty: 'false',
    gatewayRecoveryClear: 'yes',
    uiPluginVersion: '2.0.0',
    ...overrides,
  };
  const attributes = Object.entries(DIAGNOSTICS_ATTRIBUTES)
    .map(([field, name]) => `${name}="${values[field]}"`)
    .join(' ');
  return `<div class="los-root los-diagnostics-view" ${attributes}></div>`;
}

test('extractDiagnostics reads every declared attribute', () => {
  assert.deepEqual(extractDiagnostics(diagnosticsDom()), {
    manifestContract: '8',
    runtimeFingerprintMatches: 'yes',
    coreRevision: CORE_SHA,
    uiRevision: UI_SHA,
    coreDirty: 'false',
    sourceDirty: 'false',
    gatewayRecoveryClear: 'yes',
    uiPluginVersion: '2.0.0',
  });
});

test('extractDiagnostics refuses missing metadata', () => {
  assert.throws(
    () => extractDiagnostics('<div class="los-diagnostics-view"></div>'),
    LiveAppCheckError,
  );
});

test('extractDiagnostics refuses ambiguous duplicated metadata', () => {
  assert.throws(
    () => extractDiagnostics(diagnosticsDom() + diagnosticsDom()),
    LiveAppCheckError,
  );
});

test('a clean, matching live app passes identity verification', () => {
  assert.doesNotThrow(() => assertLiveIdentity(
    extractDiagnostics(diagnosticsDom()), { coreSha: CORE_SHA, uiSha: UI_SHA, manifestContract: '8' },
  ));
});

test('a wrong Core or UI SHA is refused rather than echoed back', () => {
  // The defect this replaces copied the caller's own --core-sha/--ui-sha into
  // an {ok:true} result, so any wrong pair could be attested as verified.
  const live = extractDiagnostics(diagnosticsDom());
  assert.throws(
    () => assertLiveIdentity(live, { coreSha: 'c'.repeat(40), uiSha: UI_SHA, manifestContract: '8' }),
    LiveAppCheckError,
  );
  assert.throws(
    () => assertLiveIdentity(live, { coreSha: CORE_SHA, uiSha: 'd'.repeat(40), manifestContract: '8' }),
    LiveAppCheckError,
  );
});

test('the expected manifest contract is derived from the built pair', () => {
  // Never a fourth hand-maintained copy of the contract version: it is read
  // from build-info.json, which is generated from Core's own declaration, so
  // it cannot keep demanding an old number after a contract bump.
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const declared = declaredManifestContract(root);
  const buildInfo = JSON.parse(
    fs.readFileSync(path.join(root, 'plugin', 'build-info.json'), 'utf8'),
  );
  assert.equal(declared, String(buildInfo.manifest_contract_version));
  assert.doesNotThrow(() => assertLiveIdentity(
    extractDiagnostics(diagnosticsDom({ manifestContract: declared })),
    { coreSha: CORE_SHA, uiSha: UI_SHA, manifestContract: declared },
  ));
});

test('declaredManifestContract refuses a missing or malformed build-info', () => {
  assert.throws(() => declaredManifestContract('/nonexistent-root'), LiveAppCheckError);
});

test('dirty, unknown, mismatched, stale and unresolved states all fail', () => {
  const refuse = (overrides) => assert.throws(
    () => assertLiveIdentity(
      extractDiagnostics(diagnosticsDom(overrides)),
      { coreSha: CORE_SHA, uiSha: UI_SHA, manifestContract: '8' },
    ),
    LiveAppCheckError,
  );
  refuse({ coreDirty: 'true' });
  refuse({ coreDirty: 'unknown' });
  refuse({ sourceDirty: 'true' });
  refuse({ sourceDirty: 'unknown' });
  refuse({ runtimeFingerprintMatches: 'no' });
  refuse({ manifestContract: '7' });
  refuse({ gatewayRecoveryClear: 'no' });
  // The installed Obsidian CLI reports plugin ids without versions, so the
  // running build is read from Diagnostics. A mismatch there must refuse.
  refuse({ uiPluginVersion: '1.9.0' });
  refuse({ uiPluginVersion: 'unknown' });
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
    uiPluginVersion: '2.0.0',
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
    uiPluginVersion: '2.0.0',
  });
  assert.ok(!('capturedText' in redacted));
  assert.ok(!('localFilePath' in redacted));
});

test('redactDiagnostics tolerates a missing or empty input', () => {
  assert.deepEqual(redactDiagnostics(undefined), {});
  assert.deepEqual(redactDiagnostics({}), {});
});



/* ---- the installed host's actual protocol -----------------------------
 *
 * These fixtures are the real output of the installed Obsidian 1.13.7 CLI,
 * captured on 2026-09-05. The suite passed 32 synthetic tests while the driver
 * could not complete a single real step, so what the host actually prints is
 * pinned here rather than what a bare semver would have been.
 */

const REAL_VERSION_LINE = '1.13.7 (installer 1.12.7)';
const REAL_PLUGINS_ENABLED_JSON = JSON.stringify([
  { id: 'bases' }, { id: 'canvas' }, { id: 'learningos-ui' }, { id: 'outline' },
]);
const REAL_DOM_PARAMETER_ERROR =
  'Error: Missing required parameter: selector=<css>\n'
  + 'Usage: dev:dom selector=<css> [total] [text] [inner] [all] [attr=<name>] [css=<prop>]';

test('the app and installer versions are read from the line the host prints', () => {
  const parsed = parseObsidianVersion(REAL_VERSION_LINE);
  assert.equal(parsed.app, '1.13.7');
  assert.equal(parsed.installer, '1.12.7');
  assert.equal(parseObsidianVersion('not a version'), null);
});

test('a newer app with an older installer meets the requirement', () => {
  // The exact refusal this repair removes: 1.13.7 was rejected as not meeting
  // 1.12.7 because the parser demanded a bare three-part version.
  assert.ok(versionAtLeast(REAL_VERSION_LINE, REQUIRED_APP_VERSION));
  assert.ok(!versionAtLeast('1.11.0 (installer 1.10.0)', REQUIRED_APP_VERSION));
});

test('plugins:enabled json is parsed for ids, which is all it reports', () => {
  const entries = parseCommandList(REAL_PLUGINS_ENABLED_JSON);
  assert.ok(entries.some((entry) => entry.id === 'learningos-ui'));
  // No version field exists in this output; the running build's version comes
  // from Diagnostics instead, and assertLiveIdentity checks it there.
  assert.equal(entries.find((entry) => entry.id === 'learningos-ui').name, '');
});

test('a parameter error printed on exit 0 is detected as a refusal', () => {
  assert.ok(cliRefusal(REAL_DOM_PARAMETER_ERROR));
  assert.ok(cliRefusal('', REAL_DOM_PARAMETER_ERROR));
  assert.equal(cliRefusal(diagnosticsDom()), null);
  assert.equal(cliRefusal(REAL_VERSION_LINE), null);
  assert.equal(cliRefusal(REAL_PLUGINS_ENABLED_JSON), null);
});

test('the dev:dom selector the driver sends names the Diagnostics view', () => {
  assert.equal(DIAGNOSTICS_VIEW_CLASS, 'los-diagnostics-view');
  assert.doesNotThrow(
    () => assertAllowedCommand(['dev:dom', `selector=.${DIAGNOSTICS_VIEW_CLASS}`]),
  );
  assert.doesNotThrow(
    () => assertAllowedCommand(['dev:screenshot', 'path=/tmp/evidence/diagnostics.png']),
  );
  assert.doesNotThrow(() => assertAllowedCommand(['plugins:enabled', 'json']));
  // The read-only allowlist is unchanged by the protocol repair.
  assert.throws(() => assertAllowedCommand(['plugin:reload']), LiveAppCheckError);
  assert.throws(() => assertAllowedCommand(['command', 'app:reload']), LiveAppCheckError);
});

if (failures) {
  console.error(`\n${failures} live-app-check test failure(s)`);
  process.exit(1);
}
console.log(`\n${checks} live-app-check tests passed`);
