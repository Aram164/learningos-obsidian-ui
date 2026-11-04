/*
 * Unit tests for the provenance verdict in scripts/check-install-current.mjs.
 *
 * Matching installed assets do not prove the build belongs to the current
 * pair (UI #5): the recorded Core/UI revisions must match the sibling
 * checkouts' HEADs, an unavailable Git state must read as unknown (never
 * silently clean), and recorded dirtiness is a printed fact, never a
 * failure by itself. The git seam is injected, so these run headless with
 * no real `git` call and no real vault.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  currentGitHead,
  provenanceFacts,
  provenanceProblems,
  provenanceTargets,
} from '../scripts/check-install-current.mjs';

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

const CORE = 'a'.repeat(40);
const UI = 'b'.repeat(40);
const OTHER_CORE = 'c'.repeat(40);
const OTHER_UI = 'd'.repeat(40);

test('currentGitHead returns a full 40-hex HEAD and nothing else', () => {
  assert.equal(currentGitHead('/repo', {
    git: () => ({ status: 0, stdout: `${CORE}\n` }),
  }), CORE);
  assert.equal(currentGitHead('/repo', {
    git: () => ({ status: 0, stdout: 'shortsha\n' }),
  }), null, 'a malformed answer is unknown, never trusted');
});

test('currentGitHead reads an unavailable Git state as unknown (null)', () => {
  assert.equal(currentGitHead('/not-a-repo', {
    git: () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' }),
  }), null);
  assert.equal(currentGitHead('/no-git', { git: () => ({ status: null, stdout: '' }) }), null);
});

test('provenanceTargets resolves the sibling checkouts by install.py convention', () => {
  const targets = provenanceTargets('/pair/obsidian-ui');
  assert.equal(targets.coreRepository, '/pair/repository');
  assert.equal(targets.uiCheckout, '/pair/obsidian-ui');
});

test('a current clean record passes with no problems', () => {
  assert.deepEqual(provenanceProblems({
    builtInfo: { core_revision: CORE, source_revision: UI, core_dirty: false, source_dirty: false },
    coreHead: CORE,
    uiHead: UI,
  }), []);
});

test('a recorded revision another commit behind the sibling HEAD is a mismatch', () => {
  // UI #5's reproduction: a green checkmark beside a stale Core record.
  const problems = provenanceProblems({
    builtInfo: { core_revision: OTHER_CORE, source_revision: UI },
    coreHead: CORE,
    uiHead: UI,
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Core/);
  assert.ok(problems[0].includes(OTHER_CORE.slice(0, 12)));
  assert.ok(problems[0].includes(CORE.slice(0, 12)));
  const uiProblems = provenanceProblems({
    builtInfo: { core_revision: CORE, source_revision: OTHER_UI },
    coreHead: CORE,
    uiHead: UI,
  });
  assert.equal(uiProblems.length, 1);
  assert.match(uiProblems[0], /UI source/);
});

test('an unavailable Git state or a bare record is unknown and fails', () => {
  const unknownHead = provenanceProblems({
    builtInfo: { core_revision: CORE, source_revision: UI },
    coreHead: null,
    uiHead: null,
  });
  assert.equal(unknownHead.length, 2);
  assert.match(unknownHead[0], /unknown/);
  assert.match(unknownHead[1], /unknown/);
  const bareRecord = provenanceProblems({
    builtInfo: {},
    coreHead: CORE,
    uiHead: UI,
  });
  assert.equal(bareRecord.length, 2);
  assert.match(bareRecord[0], /records no Core revision/);
  assert.match(bareRecord[1], /records no UI source revision/);
});

test('recorded dirtiness is a printed fact, never a mismatch by itself', () => {
  assert.deepEqual(provenanceProblems({
    builtInfo: { core_revision: CORE, source_revision: UI, core_dirty: true, source_dirty: true },
    coreHead: CORE,
    uiHead: UI,
  }), []);
  const facts = provenanceFacts({
    builtInfo: { core_dirty: true, source_dirty: 'unknown' },
  });
  assert.equal(facts.length, 2);
  assert.match(facts[0], /Core dirty=true/);
  assert.match(facts[1], /UI dirty="unknown"/);
  assert.deepEqual(
    provenanceFacts({ builtInfo: { core_dirty: false, source_dirty: false } }),
    [],
    'clean records print no dirty fact',
  );
});

// Exercise main(), not just the pure verdict: the original explicit-vault bug
// selected one directory for assets and another for Core's Git identity.
function withInstallPair(body) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'los-install-current-')));
  const ui = path.join(directory, 'isolated-ui');
  const vault = path.join(directory, 'selected-core');
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const git = (checkout, ...args) => {
    const result = spawnSync('git', ['-C', checkout, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const commit = (checkout, label) => {
    fs.mkdirSync(checkout, { recursive: true });
    git(checkout, 'init', '-q');
    fs.writeFileSync(path.join(checkout, 'identity.txt'), label);
    git(checkout, 'add', 'identity.txt');
    git(checkout, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
      'commit', '-qm', label);
    return git(checkout, 'rev-parse', 'HEAD');
  };
  try {
    const coreHead = commit(vault, 'selected Core');
    const uiHead = commit(ui, 'selected UI');
    fs.mkdirSync(path.join(ui, 'scripts'));
    for (const name of ['check-install-current.mjs', 'plugin-assets.mjs']) {
      fs.copyFileSync(path.join(root, 'scripts', name), path.join(ui, 'scripts', name));
    }
    fs.copyFileSync(path.join(root, 'plugin-assets.json'), path.join(ui, 'plugin-assets.json'));
    const assets = JSON.parse(fs.readFileSync(path.join(ui, 'plugin-assets.json'), 'utf8'));
    const installed = path.join(vault, '.obsidian', 'plugins', 'learningos-ui');
    fs.mkdirSync(path.join(ui, 'plugin'));
    fs.mkdirSync(installed, { recursive: true });
    for (const name of assets.shipped) {
      const bytes = name === 'build-info.json'
        ? JSON.stringify({ core_revision: coreHead, source_revision: uiHead,
          core_dirty: false, source_dirty: false })
        : `fixture ${name}\n`;
      fs.writeFileSync(path.join(ui, 'plugin', name), bytes);
      fs.writeFileSync(path.join(installed, name), bytes);
    }
    const check = () => spawnSync(process.execPath,
      [path.join(ui, 'scripts', 'check-install-current.mjs'), vault], { encoding: 'utf8' });
    body({ directory, ui, vault, installed, commit, check });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('CLI uses the explicit Core vault when the default sibling is absent or stale', () => {
  withInstallPair(({ directory, vault, commit, check }) => {
    const absent = check();
    assert.equal(absent.status, 0, absent.stdout + absent.stderr);
    assert.ok(absent.stdout.includes(`Core comparison checkout ${vault}`));
    assert.match(absent.stdout, /installed files match this build/);
    commit(path.join(directory, 'repository'), 'unrelated default Core');
    const stale = check();
    assert.equal(stale.status, 0, stale.stdout + stale.stderr);
  });
});

test('CLI still refuses stale or unavailable Git identity in the selected Core vault', () => {
  withInstallPair(({ directory, vault, commit, check }) => {
    commit(vault, 'selected Core advanced');
    const stale = check();
    assert.equal(stale.status, 1, stale.stdout + stale.stderr);
    assert.match(stale.stdout, /PROVENANCE MISMATCH/);
    fs.rmSync(path.join(vault, '.git'), { recursive: true });
    // A usable default sibling must never mask the selected vault's unknown state.
    commit(path.join(directory, 'repository'), 'unrelated default Core');
    const missing = check();
    assert.equal(missing.status, 1, missing.stdout + missing.stderr);
    assert.match(missing.stdout, /current Core checkout HEAD is unknown/);
  });
});

test('CLI asset checks still refuse a changed installed file with current provenance', () => {
  withInstallPair(({ installed, check }) => {
    fs.appendFileSync(path.join(installed, 'styles.css'), 'changed');
    const result = check();
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /DIFFERENT BUILD/);
    assert.match(result.stdout, /styles\.css differs/);
  });
});

if (failures) {
  console.error(`\n${failures} install-current test failure(s)`);
  process.exit(1);
}
console.log(`\n${checks} install-current tests passed`);
