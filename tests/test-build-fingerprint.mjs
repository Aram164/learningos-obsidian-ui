import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const validatorRelative = 'src/contracts/generated/manifest.validator.cjs';
const validatorPath = path.join(root, validatorRelative);
const bundlePath = path.join(root, 'plugin', 'main.js');
const infoPath = path.join(root, 'plugin', 'build-info.json');

function runBuild(env = {}) {
  const result = spawnSync(process.execPath, ['build.mjs'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'build.mjs failed');
  }
  return {
    bundle: fs.readFileSync(bundlePath),
    info: JSON.parse(fs.readFileSync(infoPath, 'utf8')),
  };
}

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
  // Always restore original bytes
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

console.log('build-fingerprint: all assertions passed (A-G verified)');
