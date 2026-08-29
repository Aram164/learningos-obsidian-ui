/*
 * The one list of what this repository ships into a vault.
 *
 * There were three: a tuple in `install.py` (a `plugin/*` wildcard, in fact),
 * an array in `check-install-current.mjs`, and a copy of that array in
 * `tests/test_installer.py`. Three lists that must agree is a list that
 * eventually does not, and the failure is quiet in the worst direction: the
 * installer copies a file nobody checks, or the checker approves an install
 * that is missing one.
 *
 * `plugin-assets.json` is now the declaration and this module is its only Node
 * reader. It validates rather than trusts — a manifest is a file on disk, and a
 * malformed one must fail loudly here rather than produce an empty shipping
 * list that makes every check trivially pass.
 *
 * Unknown files are refused, never removed. An installer that deletes what it
 * does not recognise is a worse failure than one that stops: the thing it
 * deletes may be the only copy.
 */
import fs from 'node:fs';
import path from 'node:path';

const MANIFEST_KEYS = ['schema_version', 'type', 'shipped', 'vault_owned'];
const MANIFEST_TYPE = 'learningos-ui-plugin-assets';

class PluginAssetsError extends Error {}

function fail(message) {
  throw new PluginAssetsError(`plugin-assets.json: ${message}`);
}

/** A shipped name is one path component: no separators, no `.`, no `..`. */
function checkName(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${field} entries must be non-empty strings (got ${JSON.stringify(value)})`);
  }
  if (value.includes('/') || value.includes('\\')) {
    fail(`${field} entry ${JSON.stringify(value)} must be a bare filename, not a path`);
  }
  if (value === '.' || value === '..') {
    fail(`${field} entry ${JSON.stringify(value)} is a path component, not a file`);
  }
}

function checkList(value, field) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${field} must be a non-empty array`);
  }
  for (const entry of value) checkName(entry, field);
  if (new Set(value).size !== value.length) fail(`${field} repeats an entry`);
  return value;
}

/** Parse and validate the manifest. Throws on anything it cannot vouch for. */
export function readPluginAssets(root) {
  const file = path.join(root, 'plugin-assets.json');
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`could not be read: ${error.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('is not an object');
  }
  const keys = Object.keys(parsed).sort();
  if (keys.length !== MANIFEST_KEYS.length
      || !MANIFEST_KEYS.every((key) => keys.includes(key))) {
    fail(`must carry exactly ${MANIFEST_KEYS.join(', ')} (got ${keys.join(', ') || 'nothing'})`);
  }
  if (parsed.schema_version !== 1) fail(`unsupported schema_version ${JSON.stringify(parsed.schema_version)}`);
  if (parsed.type !== MANIFEST_TYPE) fail(`unsupported type ${JSON.stringify(parsed.type)}`);
  const shipped = checkList(parsed.shipped, 'shipped');
  const vaultOwned = checkList(parsed.vault_owned, 'vault_owned');
  const overlap = shipped.filter((name) => vaultOwned.includes(name));
  if (overlap.length) {
    fail(`${overlap.join(', ')} cannot be both shipped and vault-owned`);
  }
  return { shipped, vaultOwned, owned: [...shipped, ...vaultOwned] };
}

/**
 * Everything in `directory` that the manifest does not account for.
 *
 * `lstat`, not `stat`: a symlink named `main.js` is not the shipped `main.js`,
 * and following it would let a link decide what "current" means.
 */
export function unexpectedEntries(directory, owned) {
  let stats;
  try { stats = fs.lstatSync(directory); }
  catch (_) { return []; }
  // Never let this helper turn a symlink into a directory walk. Callers report
  // the root shape separately through `directoryProblem`.
  if (stats.isSymbolicLink() || !stats.isDirectory()) return [];
  return fs.readdirSync(directory)
    .filter((name) => !owned.includes(name))
    .map((name) => path.join(directory, name));
}

/** A shipped file must be a real, present, regular file — never a link. */
export function shippedFileProblem(file) {
  let stats;
  try {
    stats = fs.lstatSync(file);
  } catch (_) {
    return 'is missing';
  }
  if (stats.isSymbolicLink()) return 'is a symlink';
  if (stats.isDirectory()) return 'is a directory';
  if (!stats.isFile()) return 'is not a regular file';
  return null;
}

/** A managed directory is either absent or one real, non-symlink directory. */
export function directoryProblem(directory, { missingOk = false } = {}) {
  let stats;
  try {
    stats = fs.lstatSync(directory);
  } catch (_) {
    return missingOk ? null : 'is missing';
  }
  if (stats.isSymbolicLink()) return 'is a symlink';
  if (!stats.isDirectory()) return 'is not a directory';
  return null;
}

export { PluginAssetsError };
