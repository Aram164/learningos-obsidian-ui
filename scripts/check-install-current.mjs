/*
 * Is the plugin running in the vault the plugin this source builds?
 *
 * Nothing answered that question before. The vault ran a build from 32 commits
 * back for a day without a word, because the app can only ever read the
 * build-info of the copy it *is* — it has no way to learn that a newer one
 * exists. That comparison has to happen out here, where both copies are
 * visible at once.
 *
 * It compares every shipped file, not just `main.js`. Checking one of four and
 * reporting "the vault is running this build ✓" is worse than checking none:
 * a stale `styles.css` or a `manifest.json` naming the wrong version is exactly
 * the kind of partial install that looks fine and behaves strangely, and the
 * check that was supposed to catch it said the vault was current.
 *
 * `data.json` is deliberately not compared. It is the vault's own settings
 * file, written by Obsidian, and it is not shipped by this repository — an
 * install that differs there is not stale.
 *
 * Read-only: it never installs anything, and says what to run instead.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Everything `install.py` copies out of `plugin/`. Keep the two in step. */
const SHIPPED = ['main.js', 'styles.css', 'manifest.json', 'build-info.json'];

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vault = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(path.dirname(root), 'repository');
const installedDir = path.join(vault, '.obsidian', 'plugins', 'learningos-ui');

const sha = (file) => (fs.existsSync(file)
  ? `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`
  : null);
const json = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
};

const builtInfo = json(path.join(root, 'plugin', 'build-info.json')) ?? {};
const installedInfo = json(path.join(installedDir, 'build-info.json')) ?? {};
const short = (value) => String(value ?? 'unknown').slice(0, 12);

const assets = SHIPPED.map((name) => ({
  name,
  built: sha(path.join(root, 'plugin', name)),
  installed: sha(path.join(installedDir, name)),
}));

const missingBuilt = assets.filter((asset) => !asset.built);
if (missingBuilt.length) {
  for (const asset of missingBuilt) {
    console.log(`install: no built ${asset.name} — plugin/${asset.name} is missing.`);
  }
  console.log('install: run `npm run build` (and `npm run build:info`).');
  process.exit(1);
}

const missingInstalled = assets.filter((asset) => !asset.installed);
if (missingInstalled.length === assets.length) {
  console.log(`install: nothing installed at ${installedDir}`);
  console.log('install: run `python3 install.py` to put this build in the vault.');
  process.exit(1);
}

console.log(`install: built    ${short(assets[0].built.slice(7))}  from ${short(builtInfo.source_revision)}${builtInfo.source_dirty ? ' (uncommitted sources)' : ''}`);
console.log(`install: in vault ${short(String(assets[0].installed ?? 'missing').slice(7))}  from ${short(installedInfo.source_revision)}${installedInfo.source_dirty ? ' (uncommitted sources)' : ''}`);

const problems = assets.filter((asset) => asset.built !== asset.installed);
if (!problems.length) {
  console.log(`install: the vault is running this build ✓ (${assets.length} shipped files match)`);
  process.exit(0);
}

console.log('');
console.log('install: THE VAULT IS RUNNING A DIFFERENT BUILD.');
for (const asset of problems) {
  console.log(asset.installed
    ? `install:   ${asset.name} differs (built ${short(asset.built.slice(7))}, in vault ${short(asset.installed.slice(7))})`
    : `install:   ${asset.name} is MISSING from the vault`);
}
// Build-info-only drift is still drift: the code can be byte-identical while
// having been built beside a different Core commit, which is what a paired
// release is supposed to make impossible to miss.
if (problems.length === 1 && problems[0].name === 'build-info.json') {
  console.log('install: only build-info.json differs — the shipped code matches, but this');
  console.log('install: build was produced from a different source revision.');
}
if (installedInfo.source_committed_at && builtInfo.source_committed_at
    && installedInfo.source_committed_at < builtInfo.source_committed_at) {
  console.log(`install: the installed copy is older (${installedInfo.source_committed_at} < ${builtInfo.source_committed_at}).`);
}
console.log('install: run `python3 install.py`, then reload Obsidian with Cmd+R.');
process.exit(1);
