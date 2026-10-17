/*
 * Shared Core contract bundling and interpreter selection helper.
 *
 * Provides reproducible bundle generation from Core's authoritative
 * manifest schema (manifest-v15.schema.json) into isolated disposable storage.
 *
 * Used by:
 *   - scripts/check-contract-production.mjs (production artifact comparison)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function findCorePython(coreRoot) {
  const env = {
    ...process.env,
    PYTHONPATH: path.join(coreRoot, 'tools'),
  };

  // If PYTHON is explicitly specified in the environment, honor it directly
  if (process.env.PYTHON) {
    try {
      const probe = spawnSync(
        process.env.PYTHON,
        ['-c', 'import learning_os.store.contracts.bundle'],
        { encoding: 'utf8', cwd: coreRoot, env },
      );
      if (probe.status === 0) return { python: process.env.PYTHON, env };
    } catch (_) {
      // Fall through to null below
    }
    return null;
  }

  const candidates = [
    path.join(coreRoot, '.venv', 'bin', 'python'),
    path.resolve(process.env.HOME || '', 'Desktop/semestercontext/LearningOS/repository/.venv/bin/python'),
    'python3',
    'python',
  ];

  for (const candidate of candidates) {
    try {
      const probe = spawnSync(
        candidate,
        ['-c', 'import learning_os.store.contracts.bundle'],
        { encoding: 'utf8', cwd: coreRoot, env },
      );
      if (probe.status === 0) return { python: candidate, env };
    } catch (_) {
      // Continue searching
    }
  }

  return null;
}

export function generateCoreBundle(coreRoot, outDir) {
  const schemaPath = path.join(coreRoot, 'system/contracts/manifest-v15.schema.json');
  if (!fs.existsSync(coreRoot) || !fs.existsSync(schemaPath)) {
    throw new Error(`Core repository or manifest schema not found at ${schemaPath}`);
  }

  const pyInfo = findCorePython(coreRoot);
  if (!pyInfo) {
    throw new Error(
      `No Python environment with an importable learning_os package found at ${coreRoot} ` +
      '(checked process.env.PYTHON, .venv, Desktop repo .venv, python3, python). ' +
      'Set PYTHON or install Core dependencies.',
    );
  }

  const { python, env } = pyInfo;
  fs.mkdirSync(outDir, { recursive: true });

  const bundleResult = spawnSync(python, [
    'tools/contract_bundle.py', 'build',
    '--schema', 'system/contracts/manifest-v15.schema.json',
    '--out', outDir,
  ], { encoding: 'utf8', cwd: coreRoot, env });

  if (bundleResult.status !== 0) {
    const detail = (bundleResult.stderr || bundleResult.stdout || '').trim();
    throw new Error(`tools/contract_bundle.py build failed: ${detail}`);
  }

  const builtBundles = fs.readdirSync(outDir).filter((name) => name.endsWith('.bundle.json'));
  if (builtBundles.length !== 1) {
    throw new Error(`Expected exactly one bundle in ${outDir}, found: ${builtBundles.join(', ')}`);
  }

  const stem = builtBundles[0].replace(/\.bundle\.json$/, '');
  const bundlePath = path.join(outDir, builtBundles[0]);
  const metaPath = path.join(outDir, `${stem}.meta.json`);

  return {
    bundlePath,
    metaPath: fs.existsSync(metaPath) ? metaPath : null,
    stem,
  };
}

export function loadFreshCoreBundle(coreRoot) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'core-contract-bundle-diff-'));
  try {
    const { bundlePath, metaPath } = generateCoreBundle(coreRoot, scratch);
    const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    const meta = metaPath ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : null;
    return { bundle, meta };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
