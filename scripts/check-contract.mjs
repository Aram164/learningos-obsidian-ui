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
 * the two declarations until UI CI went red.
 *
 * Enforcement (added 2026-08-18): skipping the outward check used to be
 * unconditional, and CI checked out only this repository — so the branch that
 * skipped was the only branch CI ever took. "Producer owns the contract" was
 * therefore a local-development guarantee enforced by remembering to run
 * `npm run check` in the right working directory, while every other contract in
 * the system is enforced by code. It now refuses in CI. A developer working
 * without core checked out still gets the loud skip, and
 * LEARNINGOS_ALLOW_MISSING_CORE=1 is the deliberate escape hatch.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, manifestLock, namedLock } from './contract-locks.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const manifestContract = manifestLock(root);
const lock = manifestContract.value;
const jobDashboardContract = namedLock(root, 'job-dashboard-v2.lock.json');
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
if (!/MANIFEST_CONTRACT_VERSION\s+as\s+CONTRACT_VERSION/.test(constants)) {
  throw new Error('src/constants.ts must re-export the typed manifest version instead of duplicating it.');
}

const typed = fs.readFileSync(path.join(root, 'src/contracts/manifest.ts'), 'utf8');
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
const producerRoot = path.resolve(path.dirname(producerPath), '..', '..');
if (!fs.existsSync(producerPath)) {
  /*
   * Two different absences, and conflating them wastes the first red run.
   * "No core here" is a checkout problem. "Core is here but declares no
   * manifest contract" means the checked-out commit predates the declaration —
   * which is what a UI released against an unpushed core looks like from CI,
   * and is exactly the drift this check exists to surface.
   */
  const skip = fs.existsSync(producerRoot)
    ? `core is checked out at ${producerRoot} but declares no manifest contract `
      + `(${producerPath} is missing) — cross-repo mirror NOT verified`
    : `core not checked out beside this repo (${producerPath}) `
      + '— cross-repo mirror NOT verified';
  const mustVerify = process.env.LEARNINGOS_ALLOW_MISSING_CORE !== '1'
    && Boolean(process.env.CI || process.env.LEARNINGOS_REQUIRE_CORE_MIRROR);
  if (mustVerify) {
    throw new Error(
      `${skip}. Check out the producer (Aram164/LearningOS) at that path and make `
      + 'sure the commit CI sees is the one that declares this contract — an '
      + 'unpushed core is the usual cause. LEARNINGOS_ALLOW_MISSING_CORE=1 '
      + 'accepts an unverified lock deliberately.',
    );
  }
  console.log(`contract: ${skip}`);
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
  const jobProducerPath = path.join(producerRoot, 'system', 'schema', 'job-dashboard.schema.json');
  if (!fs.existsSync(jobProducerPath)) {
    throw new Error(`Core is missing the Job dashboard producer schema: ${jobProducerPath}`);
  }
  const producerJob = JSON.parse(fs.readFileSync(jobProducerPath, 'utf8'));
  if (JSON.stringify(canonicalJson(producerJob))
      !== JSON.stringify(canonicalJson(jobDashboardContract.value))) {
    throw new Error(
      'Core/UI Job dashboard contract drifted. Mirror system/schema/job-dashboard.schema.json '
      + 'to contracts/job-dashboard-v2.lock.json in the same release.',
    );
  }
  console.log(`contract: mirror of core v${producerVersion} verified`);
}

const jobTyped = fs.readFileSync(path.join(root, 'src/contracts/job-dashboard.ts'), 'utf8');
const jobDeclared = jobTyped.match(/JOB_DASHBOARD_CONTRACT\s*=\s*['"]([^'"]+)['"]/)?.[1];
const jobSchemaId = String(jobDashboardContract.value.$id || '').split('/').pop();
if (jobDeclared !== jobSchemaId) {
  throw new Error(`Typed Job contract ${jobDeclared ?? 'unknown'} does not match lock ${jobSchemaId}.`);
}

const jobModel = fs.readFileSync(path.join(root, 'src/features/job/model.ts'), 'utf8');
if (!jobModel.includes("from '../../contracts/job-dashboard'")) {
  throw new Error('Job feature model must consume the stable typed Job contract.');
}
if (!jobModel.includes("from '../../projection/readers'")) {
  throw new Error('Job feature model must use the shared projection boundary readers.');
}
for (const duplicatedHelper of ['record', 'rows', 'string', 'strings', 'numberRecord']) {
  if (new RegExp(`function\\s+${duplicatedHelper}\\s*\\(`).test(jobModel)) {
    throw new Error(`Job feature model redeclared shared reader ${duplicatedHelper}().`);
  }
}

console.log(`contract: manifest v${lock.contract_version} lock verified (${lock.top_level_keys.length} top-level keys)`);
console.log(`contract: ${jobDeclared} schema lock verified`);
