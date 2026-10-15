import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Per execution-plan S31-04 and verification review F4:
// Run all build and mutation probes inside an isolated disposable copy.
// The invoking checkout and its published build artifacts must remain untouched.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'los-build-fingerprint-'));
function cleanup() {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}
}
process.on('exit', cleanup);

// Copy build inputs into disposable directory
const directFiles = [
  'build.mjs',
  'build-styles.mjs',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'plugin-assets.json',
];
for (const f of directFiles) {
  fs.copyFileSync(path.join(root, f), path.join(tempDir, f));
}
for (const d of ['src', 'scripts', 'contracts', 'plugin']) {
  fs.cpSync(path.join(root, d), path.join(tempDir, d), { recursive: true });
}
// Symlink node_modules
fs.symlinkSync(path.join(root, 'node_modules'), path.join(tempDir, 'node_modules'), 'junction');

// Determine source revision to preserve build determinism
let sourceRevision = process.env.LEARNINGOS_UI_SOURCE_REVISION || '';
if (!sourceRevision) {
  try {
    sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch (_) {
    sourceRevision = 'working-tree';
  }
}
const defaultEnv = { LEARNINGOS_UI_SOURCE_REVISION: sourceRevision };

const validatorRelative = 'src/contracts/generated/manifest.validator.cjs';
const validatorPath = path.join(tempDir, validatorRelative);
const bundlePath = path.join(tempDir, 'plugin', 'main.js');
const infoPath = path.join(tempDir, 'plugin', 'build-info.json');

function runBuild(env = {}) {
  const result = spawnSync(process.execPath, ['build.mjs'], {
    cwd: tempDir,
    encoding: 'utf8',
    env: { ...process.env, ...defaultEnv, ...env },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'build.mjs failed');
  }
  return {
    bundle: fs.readFileSync(bundlePath),
    info: JSON.parse(fs.readFileSync(infoPath, 'utf8')),
  };
}

try {
  // Ensure clean initial build
  const initial = runBuild();
  const initialFingerprint = initial.info.source_fingerprint;
  const initialBundleSha = initial.info.bundle_sha256;

  // A. Real generated validator appears in the production build dependency graph
  assert.ok(
    Array.isArray(initial.info.modules),
    'build-info.json modules must be an array',
  );
  assert.ok(
    initial.info.modules.includes(validatorRelative),
    `Production build module graph must include ${validatorRelative}`,
  );

  // B & E. Repeated builds from identical sources produce identical fingerprints
  const repeated = runBuild();
  assert.equal(
    repeated.info.source_fingerprint,
    initialFingerprint,
    'Repeated builds must produce identical source fingerprints',
  );
  assert.equal(
    repeated.info.bundle_sha256,
    initialBundleSha,
    'Repeated builds must produce identical bundle hashes',
  );

  // F. Changing only source revision metadata does not change the source fingerprint
  const revisionIsolated = runBuild({ LEARNINGOS_UI_SOURCE_REVISION: '8'.repeat(40) });
  assert.equal(
    revisionIsolated.info.source_revision,
    '8'.repeat(40),
    'LEARNINGOS_UI_SOURCE_REVISION must be recorded in build metadata',
  );
  assert.equal(
    revisionIsolated.info.source_fingerprint,
    initialFingerprint,
    'Changing source revision metadata must not alter the source fingerprint',
  );
  assert.equal(
    revisionIsolated.info.bundle_sha256,
    initialBundleSha,
    'Changing source revision metadata must not alter compiled bundle bytes',
  );

  // C & D. Mutation test: changing ONLY validator source bytes changes fingerprint; restoring restores it
  const originalValidatorContent = fs.readFileSync(validatorPath);
  try {
    fs.writeFileSync(
      validatorPath,
      Buffer.concat([originalValidatorContent, Buffer.from('\n// build-fingerprint-regression-probe\n')]),
    );

    const mutated = runBuild();
    assert.ok(
      mutated.info.modules.includes(validatorRelative),
      'Mutated validator must still appear in module graph',
    );
    assert.notEqual(
      mutated.info.source_fingerprint,
      initialFingerprint,
      'Changing validator source bytes MUST change the source fingerprint',
    );
    assert.notEqual(
      mutated.info.bundle_sha256,
      initialBundleSha,
      'Changing validator source bytes MUST change the bundle hash',
    );
  } finally {
    // Always restore original bytes in disposable workspace
    fs.writeFileSync(validatorPath, originalValidatorContent);
  }

  // D. Restoring original bytes restores the original source fingerprint
  const restored = runBuild();
  assert.equal(
    restored.info.source_fingerprint,
    initialFingerprint,
    'Restoring original validator bytes must restore the original source fingerprint',
  );
  assert.equal(
    restored.info.bundle_sha256,
    initialBundleSha,
    'Restoring original validator bytes must restore the original bundle hash',
  );

  // G. Compiled bundle and build metadata continue to satisfy existing identity checks
  const bundleText = fs.readFileSync(bundlePath, 'utf8');
  assert.ok(
    bundleText.includes(JSON.stringify(initialFingerprint)),
    'Compiled bundle must embed the exact source fingerprint recorded in build-info.json',
  );
  assert.ok(
    !bundleText.includes('pending-build-pass'),
    'Compiled bundle must not leak pass-one build identity placeholder',
  );

  console.log('build-fingerprint: all assertions passed (A-G verified in disposable workspace)');
} finally {
  cleanup();
}
