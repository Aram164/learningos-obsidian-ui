/*
 * Is the plugin running in the vault the plugin this source builds?
 *
 * Nothing answered that question before. The vault ran a build from 32 commits
 * back for a day without a word, because the app can only ever read the
 * build-info of the copy it *is* — it has no way to learn that a newer one
 * exists. That comparison has to happen out here, where both copies are
 * visible at once.
 *
 * Read-only: it never installs anything, and says what to run instead.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const built = sha(path.join(root, 'plugin', 'main.js'));
const installed = sha(path.join(installedDir, 'main.js'));
const builtInfo = json(path.join(root, 'plugin', 'build-info.json')) ?? {};
const installedInfo = json(path.join(installedDir, 'build-info.json')) ?? {};
const short = (value) => String(value ?? 'unknown').slice(0, 12);

if (!built) {
  console.log('install: no local build yet — run `npm run build`.');
  process.exit(0);
}
if (!installed) {
  console.log(`install: nothing installed at ${installedDir}`);
  console.log('install: run `python3 install.py` to put this build in the vault.');
  process.exit(1);
}

console.log(`install: built    ${short(built.slice(7))}  from ${short(builtInfo.source_revision)}${builtInfo.source_dirty ? ' (uncommitted sources)' : ''}`);
console.log(`install: in vault ${short(installed.slice(7))}  from ${short(installedInfo.source_revision)}${installedInfo.source_dirty ? ' (uncommitted sources)' : ''}`);

if (built === installed) {
  console.log('install: the vault is running this build ✓');
  process.exit(0);
}

console.log('');
console.log('install: THE VAULT IS RUNNING A DIFFERENT BUILD.');
if (installedInfo.source_committed_at && builtInfo.source_committed_at
    && installedInfo.source_committed_at < builtInfo.source_committed_at) {
  console.log(`install: the installed copy is older (${installedInfo.source_committed_at} < ${builtInfo.source_committed_at}).`);
}
console.log('install: run `python3 install.py`, then reload Obsidian with Cmd+R.');
process.exit(1);
