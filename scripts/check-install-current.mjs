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
 * What is shipped is declared once, in `plugin-assets.json`. This file used to
 * carry its own copy of that list beside the installer's and the test suite's;
 * three lists that must agree eventually do not.
 *
 * `data.json` is deliberately not compared. It is the vault's own settings
 * file, written by Obsidian, and it is not shipped by this repository — an
 * install that differs there is not stale. It must still be a regular file: a
 * symlink or directory in its place is not a settings file.
 *
 * Anything else in the installed directory fails the check and is named. It is
 * never deleted, moved, or quarantined — an unexplained file may be the only
 * copy of something, and "I did not expect this" is not grounds to destroy it.
 *
 * Read-only: it never installs anything, and says what to run instead.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PluginAssetsError,
  directoryProblem,
  readPluginAssets,
  shippedFileProblem,
  unexpectedEntries,
} from './plugin-assets.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vault = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(path.dirname(root), 'repository');
const obsidianDir = path.join(vault, '.obsidian');
const pluginsDir = path.join(obsidianDir, 'plugins');
const installedDir = path.join(pluginsDir, 'learningos-ui');
const installJournal = path.join(
  pluginsDir, '.learningos-ui-install-transaction.json',
);

let assets;
try {
  assets = readPluginAssets(root);
} catch (error) {
  console.log(`install: ${error instanceof PluginAssetsError ? error.message : error}`);
  console.log('install: the shipping manifest is the authority here, so an unreadable one is fatal.');
  process.exit(1);
}

for (const directory of [obsidianDir, pluginsDir, installedDir]) {
  const problem = directoryProblem(directory, { missingOk: true });
  if (!problem) continue;
  console.log('install: AN INSTALLED PLUGIN PATH COMPONENT IS NOT A REAL DIRECTORY.');
  console.log(`install:   ${directory} ${problem}`);
  console.log('install: nothing was changed. Review the path yourself.');
  process.exit(1);
}

if (fs.lstatSync(installJournal, { throwIfNoEntry: false }) !== undefined) {
  console.log('install: AN INTERRUPTED PLUGIN INSTALL TRANSACTION IS STILL PRESENT.');
  console.log(`install:   ${installJournal}`);
  console.log('install: the installed asset set may be between builds; review the transaction before retrying.');
  process.exit(1);
}

const builtDirectoryProblem = directoryProblem(path.join(root, 'plugin'));
if (builtDirectoryProblem) {
  console.log(`install: plugin/ ${builtDirectoryProblem}; refusing an indirect or misshapen build source.`);
  process.exit(1);
}

const sha = (file) => (shippedFileProblem(file)
  ? null
  : `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`);
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

const assetRows = assets.shipped.map((name) => ({
  name,
  built: sha(path.join(root, 'plugin', name)),
  installed: sha(path.join(installedDir, name)),
  installedProblem: shippedFileProblem(path.join(installedDir, name)),
}));

const missingBuilt = assetRows.filter((asset) => !asset.built);
if (missingBuilt.length) {
  for (const asset of missingBuilt) {
    console.log(`install: no built ${asset.name} — plugin/${asset.name} ${shippedFileProblem(path.join(root, 'plugin', asset.name))}.`);
  }
  console.log('install: run `npm run build` (and `npm run build:info`).');
  process.exit(1);
}

const surplusBuilt = unexpectedEntries(path.join(root, 'plugin'), assets.shipped);
if (surplusBuilt.length) {
  console.log('install: plugin/ holds files the shipping manifest does not declare:');
  for (const entry of surplusBuilt) console.log(`install:   ${entry}`);
  console.log('install: declare them in plugin-assets.json or remove them; nothing undeclared is shipped.');
  process.exit(1);
}

/*
 * The unknown-entry check runs before the "is it current?" verdict, because a
 * vault holding a file nobody ships is not a vault this build is running
 * cleanly in — reporting ✓ while an unowned entry sits beside the bundle is
 * the reassurance this whole script exists to withhold.
 */
const unknown = unexpectedEntries(installedDir, assets.owned);
const vaultOwnedProblems = assets.vaultOwned
  .map((name) => [name, path.join(installedDir, name)])
  // Absent is fine — Obsidian writes `data.json` only once there are settings.
  .filter(([, file]) => fs.lstatSync(file, { throwIfNoEntry: false }) !== undefined)
  .map(([name, file]) => [name, shippedFileProblem(file)])
  .filter(([, problem]) => problem);
if (unknown.length || vaultOwnedProblems.length) {
  console.log('install: THE INSTALLED PLUGIN DIRECTORY HOLDS ENTRIES THIS BUILD DOES NOT OWN.');
  for (const entry of unknown) console.log(`install:   ${entry}`);
  for (const [name, problem] of vaultOwnedProblems) {
    console.log(`install:   ${path.join(installedDir, name)} ${problem} (expected a regular file)`);
  }
  console.log('install: nothing was changed. Review each path yourself — the installer never');
  console.log('install: deletes, moves, or quarantines a file it cannot account for.');
  process.exit(1);
}

const missingInstalled = assetRows.filter((asset) => !asset.installed);
if (missingInstalled.length === assetRows.length) {
  console.log(`install: nothing installed at ${installedDir}`);
  console.log('install: run `python3 install.py` to put this build in the vault.');
  process.exit(1);
}

console.log(`install: built    ${short(assetRows[0].built.slice(7))}  from ${short(builtInfo.source_revision)}${builtInfo.source_dirty !== false ? ` (UI dirty=${JSON.stringify(builtInfo.source_dirty ?? null)})` : ''}`);
console.log(`install: in vault ${short(String(assetRows[0].installed ?? 'missing').slice(7))}  from ${short(installedInfo.source_revision)}${installedInfo.source_dirty !== false ? ` (UI dirty=${JSON.stringify(installedInfo.source_dirty ?? null)})` : ''}`);
// Core cleanliness travels beside the UI's in the same build-info.json — the
// UI can be byte-identical while having been verified against a dirty or
// unreadable Core, which the checks above alone would never surface.
console.log(`install: built    beside core ${short(builtInfo.core_revision)}${builtInfo.core_dirty !== false ? ` (Core dirty=${JSON.stringify(builtInfo.core_dirty ?? null)})` : ''}`);
console.log(`install: in vault beside core ${short(installedInfo.core_revision)}${installedInfo.core_dirty !== false ? ` (Core dirty=${JSON.stringify(installedInfo.core_dirty ?? null)})` : ''}`);

// The compiled-in runtime identity is what Diagnostics compares against
// build-info.json at reload time; report it here too so a stale in-memory
// plugin is visible from the command line, not only from inside the app.
console.log(`install: built    source fingerprint ${short(builtInfo.source_fingerprint)}`);
console.log(`install: in vault source fingerprint ${short(installedInfo.source_fingerprint)}`);

const problems = assetRows.filter((asset) => asset.built !== asset.installed);
if (!problems.length) {
  console.log(`install: the vault is running this build ✓ (${assetRows.length} shipped files match)`);
  process.exit(0);
}

console.log('');
console.log('install: THE VAULT IS RUNNING A DIFFERENT BUILD.');
for (const asset of problems) {
  console.log(asset.installed
    ? `install:   ${asset.name} differs (built ${short(asset.built.slice(7))}, in vault ${short(asset.installed.slice(7))})`
    : `install:   ${asset.name} ${asset.installedProblem ?? 'is MISSING'} in the vault`);
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
