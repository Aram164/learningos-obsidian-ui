/*
 * Regenerate-and-compare check for production contract artifacts (F1 resolution).
 *
 * Rebuilds the Core contract bundle into a temporary directory from Core's
 * authoritative manifest schema (manifest-v16.schema.json), emits fresh
 * validator, metadata, and lock into an isolated scratch directory, and
 * byte-compares every artifact against the authoritative production files:
 *   - src/contracts/generated/manifest.validator.cjs
 *   - src/contracts/generated/manifest.meta.ts
 *   - src/contracts/generated/manifest.prototype.lock.json
 *   - src/contracts/generated/manifest.types.ts
 *
 * Fails with exit 1 if any production artifact drifts from Core's schema closure,
 * or if Core is present but Python bundler dependencies cannot run.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateCoreBundle } from './core-contract-bundle.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const coreRoot = path.resolve(root, '../repository');

function fail(message) {
  console.error(`contract:check-production: ${message}`);
  process.exit(1);
}

const mustVerify = process.env.LEARNINGOS_ALLOW_MISSING_CORE !== '1'
  && Boolean(process.env.CI || process.env.LEARNINGOS_REQUIRE_CORE_MIRROR);

if (!fs.existsSync(coreRoot) || !fs.existsSync(path.join(coreRoot, 'system/contracts/manifest-v16.schema.json'))) {
  const msg = `Core repository not found beside obsidian-ui at ${coreRoot}; production validator regeneration check skipped.`;
  if (mustVerify) {
    fail(`${msg} Checked-out Core is required in CI or when LEARNINGOS_REQUIRE_CORE_MIRROR is set.`);
  }
  console.log(`contract: ${msg}`);
  process.exit(0);
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-prod-diff-'));

try {
  const bundleDir = path.join(scratch, 'bundle');
  const emitDir = path.join(scratch, 'emit');

  let bundleInfo;
  try {
    bundleInfo = generateCoreBundle(coreRoot, bundleDir);
  } catch (err) {
    fail(err.message);
  }

  const { bundlePath, metaPath } = bundleInfo;
  if (!metaPath) {
    fail(`Missing metadata file in bundle directory ${bundleDir}`);
  }

  const emitResult = spawnSync(process.execPath, [
    path.join(root, 'scripts', 'generate-contract.mjs'),
    '--bundle', bundlePath,
    '--meta', metaPath,
    '--out', emitDir,
  ], { encoding: 'utf8', cwd: root });

  if (emitResult.status !== 0) {
    fail(`generate-contract.mjs failed: ${(emitResult.stderr || emitResult.stdout || '').trim()}`);
  }

  const artifacts = [
    'manifest.validator.cjs',
    'manifest.meta.ts',
    'manifest.prototype.lock.json',
    'manifest.types.ts',
  ];

  const differences = [];
  const productionDir = path.join(root, 'src', 'contracts', 'generated');

  for (const artifact of artifacts) {
    const expectedPath = path.join(productionDir, artifact);
    const regeneratedPath = path.join(emitDir, artifact);

    if (!fs.existsSync(expectedPath)) {
      differences.push(`${artifact}: missing from production directory ${productionDir}`);
    } else if (!fs.existsSync(regeneratedPath)) {
      differences.push(`${artifact}: missing from regenerated output ${emitDir}`);
    } else {
      const expectedBytes = fs.readFileSync(expectedPath);
      const regeneratedBytes = fs.readFileSync(regeneratedPath);
      if (!expectedBytes.equals(regeneratedBytes)) {
        differences.push(
          `${artifact}: bytes differ (production: ${expectedBytes.length} bytes, regenerated: ${regeneratedBytes.length} bytes)`,
        );
      }
    }
  }

  if (differences.length > 0) {
    fail(`production contract artifacts drifted from Core schema closure:\n${
      differences.map((d) => `  ${d}`).join('\n')
    }\nRun \`npm run contract:generate\` to synchronize production artifacts.`);
  }

  console.log('contract: production validator, types, metadata, and lock match Core schema closure regeneration');
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
