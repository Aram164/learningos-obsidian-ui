/*
 * The UI's read contract, checked from both sides.
 *
 * Inward: the fixture vault, src/constants.ts and the typed contract layer must
 * all agree with contracts/manifest-v<N>.lock.json. That has always been here.
 *
 * Outward (added 2026-08-08): the lock is a MIRROR of the producer's
 * declaration in the core repository, not the original. When core is checked
 * out beside this repo, verify the mirror still matches. Finding 1 of the
 * engineering audit was precisely this gap — core added a top-level `topics`
 * collection while still announcing contract_version 2, and nothing compared
 * the two declarations until UI CI went red. The cross-repo check is skipped,
 * loudly, when core is not present, so this repository still builds alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const lock = readJson('contracts/manifest-v3.lock.json');
const fixture = readJson('fixture-vault/generated/manifest.json');

function sameKeys(actualObject, expectedKeys, label) {
  const actual = Object.keys(actualObject || {}).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const missing = expected.filter((key) => !actual.includes(key));
    const added = actual.filter((key) => !expected.includes(key));
    throw new Error(`${label} drifted. Missing: ${missing.join(', ') || 'none'}. Added: ${added.join(', ') || 'none'}.`);
  }
}

if (fixture?._generated?.contract_version !== lock.contract_version) {
  throw new Error(`Fixture contract ${fixture?._generated?.contract_version ?? 'unknown'} does not match lock ${lock.contract_version}.`);
}
sameKeys(fixture, lock.top_level_keys, 'Manifest top-level contract');
sameKeys(fixture._generated, lock.generated_keys, 'Manifest _generated contract');
sameKeys(fixture.indexes, lock.index_keys, 'Manifest indexes contract');
for (const key of lock.forbidden_top_level_keys || []) {
  if (Object.prototype.hasOwnProperty.call(fixture, key)) throw new Error(`Retired manifest key returned: ${key}`);
}

const constants = fs.readFileSync(path.join(root, 'src/constants.ts'), 'utf8');
const declared = Number(constants.match(/CONTRACT_VERSION\s*=\s*(\d+)/)?.[1]);
if (declared !== lock.contract_version) {
  throw new Error(`src/constants.ts expects contract ${declared}; lock expects ${lock.contract_version}.`);
}

const typed = fs.readFileSync(path.join(root, 'src/contracts/manifest-v2.ts'), 'utf8');
const typedDeclared = Number(typed.match(/MANIFEST_CONTRACT_VERSION\s*=\s*(\d+)/)?.[1]);
if (typedDeclared !== lock.contract_version) {
  throw new Error(`Typed contract expects ${typedDeclared}; lock expects ${lock.contract_version}.`);
}

/*
 * Enough YAML for a block list of plain strings, which is all the producer's
 * contract contains. A dependency to read four key lists would be a worse
 * trade than nine lines, and `yaml.safe_dump` writes exactly this shape.
 */
function yamlStringList(text, key) {
  const lines = text.split('\n');
  const start = lines.indexOf(`${key}:`);
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('- ')) { out.push(line.slice(2).trim()); continue; }
    if (line.trim() === '' || line.startsWith('#')) continue;
    break;
  }
  return out;
}

const producerPath = path.resolve(root, lock.mirrors ?? '../repository/system/contracts/manifest-contract.yaml');
if (!fs.existsSync(producerPath)) {
  console.log(`contract: core not checked out beside this repo (${producerPath}) — cross-repo mirror NOT verified`);
} else {
  const producer = fs.readFileSync(producerPath, 'utf8');
  const producerVersion = Number(producer.match(/^contract_version:\s*(\d+)/m)?.[1]);
  if (producerVersion !== lock.contract_version) {
    throw new Error(
      `Core declares manifest contract v${producerVersion}; this lock mirrors v${lock.contract_version}. `
      + 'Core and the UI release together — mirror the bump instead of shipping half of it.',
    );
  }
  for (const key of ['top_level_keys', 'generated_keys', 'index_keys', 'forbidden_top_level_keys']) {
    const producerKeys = yamlStringList(producer, key);
    if (producerKeys === null) throw new Error(`Core contract has no ${key} block.`);
    sameKeys(Object.fromEntries(producerKeys.map((k) => [k, true])), lock[key] || [],
      `Core/UI ${key} mirror`);
  }
  console.log(`contract: mirror of core v${producerVersion} verified`);
}

console.log(`contract: manifest v${lock.contract_version} lock verified (${lock.top_level_keys.length} top-level keys)`);
