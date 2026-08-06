import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const lock = readJson('contracts/manifest-v2.lock.json');
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

console.log(`contract: manifest v${lock.contract_version} lock verified (${lock.top_level_keys.length} top-level keys)`);
