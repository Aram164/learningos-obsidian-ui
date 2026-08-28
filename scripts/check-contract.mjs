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
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifestLock, yamlStringList } from './contract-locks.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const manifestContract = manifestLock(root);
const lock = manifestContract.value;
const fixture = readJson('fixture-vault/generated/manifest.json');

function yamlScalar(text, key) {
  const match = text.match(new RegExp(`^${key}:\\s*(\\S+)\\s*$`, 'm'));
  return match?.[1] ?? null;
}

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
if (fixture?._generated?.schema_sha256 !== lock.schema_sha256) {
  throw new Error(
    `Fixture schema ${fixture?._generated?.schema_sha256 ?? 'unknown'} does not match lock ${lock.schema_sha256 ?? 'unknown'}.`,
  );
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
const typedSchema = typed.match(/MANIFEST_SCHEMA_SHA256\s*=\s*['"]([^'"]+)['"]/)?.[1];
if (typedSchema !== lock.schema_sha256) {
  throw new Error(`Typed schema hash ${typedSchema ?? 'unknown'} does not match lock ${lock.schema_sha256 ?? 'unknown'}.`);
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
  const producerSchemaPath = yamlScalar(producer, 'schema_path');
  const producerSchemaSha256 = yamlScalar(producer, 'schema_sha256');
  if (producerSchemaPath !== lock.schema_path) {
    throw new Error(
      `Core manifest schema path ${producerSchemaPath ?? 'unknown'} does not match UI lock ${lock.schema_path ?? 'unknown'}.`,
    );
  }
  if (producerSchemaSha256 !== lock.schema_sha256) {
    throw new Error(
      `Core manifest schema hash ${producerSchemaSha256 ?? 'unknown'} does not match UI lock ${lock.schema_sha256 ?? 'unknown'}.`,
    );
  }
  const producerSchemaFile = path.resolve(producerRoot, producerSchemaPath);
  if (!fs.existsSync(producerSchemaFile)) {
    throw new Error(`Core manifest producer schema is missing: ${producerSchemaFile}`);
  }
  const actualSchemaSha256 = `sha256:${crypto.createHash('sha256')
    .update(fs.readFileSync(producerSchemaFile))
    .digest('hex')}`;
  if (actualSchemaSha256 !== lock.schema_sha256) {
    throw new Error(
      `Core manifest schema bytes hash to ${actualSchemaSha256}; UI lock expects ${lock.schema_sha256}.`,
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
