/*
 * Shared Core contract bundling and interpreter selection helper.
 *
 * Provides reproducible bundle generation from Core's authoritative
 * manifest schema (manifest-v20.schema.json) into isolated disposable storage.
 *
 * Used by:
 *   - scripts/check-contract-production.mjs (production artifact comparison)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const GIT_ENV_STRIP = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR'];

export function findCorePython(coreRoot) {
  const env = {
    ...process.env,
    PYTHONPATH: path.join(coreRoot, 'tools'),
  };
  for (const key of GIT_ENV_STRIP) delete env[key];

  // If PYTHON is explicitly specified in the environment, honor it directly
  if (process.env.PYTHON) {
    try {
      const probe = spawnSync(
        process.env.PYTHON,
        ['-c', 'import learning_os.store.contracts.bundle'],
        { encoding: 'utf8', cwd: coreRoot, env, timeout: 30_000 },
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
        { encoding: 'utf8', cwd: coreRoot, env, timeout: 30_000 },
      );
      if (probe.status === 0) return { python: candidate, env };
    } catch (_) {
      // Continue searching
    }
  }

  return null;
}

export function generateCoreBundle(coreRoot, outDir) {
  const schemaPath = path.join(coreRoot, 'system/contracts/manifest-v20.schema.json');
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
    '--schema', 'system/contracts/manifest-v20.schema.json',
    '--out', outDir,
  ], { encoding: 'utf8', cwd: coreRoot, env, timeout: 120_000 });

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

export function buildCapabilitySchemaMirror(coreRoot) {
  const capabilitiesDir = path.join(coreRoot, 'system/schema/capabilities');
  const requestsDir = path.join(coreRoot, 'system/schema/requests');
  if (!fs.existsSync(capabilitiesDir) || !fs.existsSync(requestsDir)) {
    throw new Error(`Core capability or request schemas missing under ${coreRoot}.`);
  }

  const capabilities = {};
  for (const file of fs.readdirSync(capabilitiesDir).filter((n) => n.endsWith('.schema.json')).sort()) {
    const capName = file.slice(0, -'.schema.json'.length);
    capabilities[capName] = JSON.parse(fs.readFileSync(path.join(capabilitiesDir, file), 'utf8'));
  }

  const cli_commands = {};
  for (const file of fs.readdirSync(requestsDir).filter((n) => n.endsWith('.schema.json')).sort()) {
    const doc = JSON.parse(fs.readFileSync(path.join(requestsDir, file), 'utf8'));
    const cmd = doc['x-los-cli-command'];
    if (!cmd || !cmd.name) continue;
    const properties = {};
    for (const [prop, subschema] of Object.entries(doc.properties || {})) {
      const cli = subschema?.['x-los-cli'];
      if (!cli) continue;
      properties[prop] = {
        flags: cli.flags || [],
        position: cli.position ?? null,
        action: cli.action || 'store',
        nargs: cli.nargs ?? null,
        required: Boolean(cli.required),
        choices: cli.choices ?? null,
        transport_only: Boolean(cli.transport_only),
        envelope_owned: Boolean(cli.envelope_owned),
      };
    }
    cli_commands[cmd.name] = {
      operation: file.slice(0, -'.schema.json'.length),
      handler: cmd.handler || null,
      operation_kind: cmd.operation_kind || null,
      required: doc.required || [],
      mutually_exclusive: cmd.mutually_exclusive || [],
      properties,
    };
  }

  const sortedCommands = Object.fromEntries(
    Object.keys(cli_commands).sort().map((key) => [key, cli_commands[key]]),
  );
  return {
    format: 'learningos-capability-mirror/1',
    capabilities,
    cli_commands: sortedCommands,
  };
}

export function writeCapabilitySchemaMirror(uiRoot, coreRoot) {
  const mirror = buildCapabilitySchemaMirror(coreRoot);
  const outPath = path.join(uiRoot, 'contracts/capability-schemas.generated.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(mirror, null, 2)}\n`);
  return { outPath, mirror };
}
