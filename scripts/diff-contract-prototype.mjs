/*
 * Regenerate-and-diff gate for the contract prototype (Point 3, Phase 4).
 *
 * Rebuilds the Core bundle into a temporary directory, re-emits every
 * prototype artifact from it into a second temporary directory, and
 * byte-compares the result against the checked-in contract-prototype/
 * tree. Exit 0 on match; exit 1 naming every differing file; exit 2 on a
 * harness failure. Run manually: `npm run contract:diff-prototype`.
 * Deliberately not wired into any enforced gate (prototype scope).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const coreRoot = path.resolve(root, '../repository');

function fail(message) {
  console.error(`contract:diff-prototype: ${message}`);
  process.exit(2);
}

function findPython() {
  const candidates = [
    path.join(coreRoot, '.venv', 'bin', 'python'),
    'python3',
    'python',
  ];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate,
      ['-c', 'import learning_os.contracts.bundle'],
      { encoding: 'utf8', cwd: coreRoot });
    if (probe.status === 0) return candidate;
  }
  fail('no python with an importable learning_os package '
    + '(tried .venv/bin/python, python3, python).');
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { encoding: 'utf8', cwd });
  if (result.status !== 0) {
    fail(`${command} ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result;
}

function listFiles(directory, anchor = directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(absolute, anchor);
    return entry.isFile() ? [path.relative(anchor, absolute)] : [];
  });
}

function compareTrees(expectedDir, actualDir) {
  const differences = [];
  const expected = new Set(listFiles(expectedDir));
  const actual = new Set(listFiles(actualDir));
  for (const file of [...expected].sort()) {
    if (!actual.has(file)) {
      differences.push(`${file}: missing from regeneration`);
    } else if (!fs.readFileSync(path.join(expectedDir, file))
      .equals(fs.readFileSync(path.join(actualDir, file)))) {
      differences.push(`${file}: bytes differ`);
    }
  }
  for (const file of [...actual].sort()) {
    if (!expected.has(file)) differences.push(`${file}: unexpected regenerated file`);
  }
  return differences;
}

const python = findPython();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-diff-'));
try {
  const bundleDir = path.join(scratch, 'bundle');
  const emitDir = path.join(scratch, 'emit');
  run(python, ['tools/contract_bundle.py', 'build',
    '--schema', 'system/contracts/manifest-v11.schema.json',
    '--out', bundleDir], coreRoot);
  const built = fs.readdirSync(bundleDir).filter((name) => name.endsWith('.bundle.json'));
  if (built.length !== 1) fail(`expected one bundle in ${bundleDir}.`);
  const stem = built[0].replace(/\.bundle\.json$/, '');
  run(process.execPath, [
    path.join(root, 'scripts', 'generate-contract.mjs'),
    '--bundle', path.join(bundleDir, `${stem}.bundle.json`),
    '--meta', path.join(bundleDir, `${stem}.meta.json`),
    '--out', emitDir,
  ], root);
  // The emitter writes into <outDir> directly; compare that tree.
  const differences = compareTrees(
    path.join(root, 'contract-prototype', 'generated'), emitDir);
  if (differences.length) {
    console.error(`prototype artifacts drifted:\n${differences.map((d) => `  ${d}`).join('\n')}`);
    process.exit(1);
  }
  console.log('contract:diff-prototype: checked-in prototype matches regeneration');
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
