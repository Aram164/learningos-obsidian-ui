/*
 * Contract emitter.
 *
 * Reads a Core contract bundle (tools/contract_bundle.py) and emits consumer
 * artifacts for the typed contract layer:
 *
 *   - Ajv standalone validator (manifest.validator.cjs)
 *   - TypeScript wire types (manifest.types.ts) via scripts/emit-contract-types.mjs
 *   - manifest.meta.ts + manifest.contract.lock.json, rendered from bundle metadata.
 *
 * Usage:
 *   node scripts/generate-contract.mjs [--bundle <path> --meta <path>] [--out <dir>]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { createAjv2020, registerBundleIdentities } from './ajv-options.mjs';
import { generateCoreBundle } from './core-contract-bundle.mjs';
import { emitTypes } from './emit-contract-types.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function argValue(argv, name, fallback = null) {
  const index = argv.indexOf(name);
  if (index === -1) return fallback;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}.`);
  return value;
}

let bundlePath = argValue(process.argv, '--bundle');
let metaPath = argValue(process.argv, '--meta');
const outDir = argValue(process.argv, '--out', 'src/contracts/generated');

let scratchDir = null;
let bundle;
let meta;
try {
  if (!bundlePath) {
    scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'los-contract-gen-'));
    const coreRoot = path.resolve(root, '../repository');
    const generated = generateCoreBundle(coreRoot, scratchDir);
    bundlePath = generated.bundlePath;
    metaPath = metaPath ?? generated.metaPath;
  }

  bundle = JSON.parse(fs.readFileSync(path.resolve(root, bundlePath), 'utf8'));
  if (bundle.format !== 'learningos-contract-bundle/1') {
    throw new Error(`Unsupported bundle format: ${bundle.format}.`);
  }
  meta = metaPath ? JSON.parse(fs.readFileSync(path.resolve(root, metaPath), 'utf8')) : null;
} finally {
  if (scratchDir) fs.rmSync(scratchDir, { recursive: true, force: true });
}
if (meta && meta.format !== 'learningos-contract-meta/1') {
  throw new Error(`Unsupported meta format: ${meta.format}.`);
}

const resolvedOut = path.resolve(root, outDir);
fs.mkdirSync(resolvedOut, { recursive: true });

/* ---- Ajv standalone validator ---- */
const ajv = createAjv2020();
registerBundleIdentities(ajv, bundle);
const validate = ajv.getSchema(bundle.root_uri);
if (!validate) throw new Error(`Root ${bundle.root_uri} did not compile to a validator.`);

const code = standaloneCode(ajv, validate);
// The header carries no invocation paths: it must be identical no matter
// which checkout or temporary directory the bundle was read from, or the
// regenerate-and-diff gate can never pass. The closure digest already
// identifies the exact source content.
const header = [
  '// GENERATED — do not edit. Regenerate with `npm run contract:generate`.',
  `// Root: ${bundle.root_uri}`,
  `// Resources: ${(bundle.resources || []).length}`,
  ...(meta ? [`// Closure: ${meta.closure_sha256}`] : []),
  '',
].join('\n');
const validatorPath = path.join(resolvedOut, 'manifest.validator.cjs');
fs.writeFileSync(validatorPath, header + code);
console.log(`validator: ${path.relative(root, validatorPath)} `
  + `(${(bundle.resources || []).length} resources, ${fs.statSync(validatorPath).size} bytes)`);

/* ---- TypeScript wire types (local symbolic emitter) ---- */
{
  const aliases = JSON.parse(
    fs.readFileSync(path.join(root, 'scripts', 'contract-type-aliases.json'), 'utf8'),
  ).aliases;
  const types = emitTypes(bundle, aliases);
  const typesPath = path.join(resolvedOut, 'manifest.types.ts');
  fs.writeFileSync(typesPath, types.source);
  console.log(`types: ${path.relative(root, typesPath)} (${types.symbols.length} symbols, `
    + `${Object.keys(aliases).length} public aliases)`);
}

/* ---- Version/hash metadata + generated contract lock ---- */
if (typeof meta?.contract_version !== 'number') {
  throw new Error('Metadata emission needs --meta with a numeric contract_version.');
}
if (!meta.root_schema || !meta.root_schema_sha256 || !meta.closure_sha256 || !meta.contract_keys) {
  throw new Error('Meta is missing root_schema, hashes, or contract_keys.');
}
{
  const metaTs = [
    '// GENERATED — do not edit. Regenerate with `npm run contract:generate`.',
    `export const MANIFEST_CONTRACT_VERSION = ${meta.contract_version} as const;`,
    `export const MANIFEST_SCHEMA_SHA256 = '${meta.root_schema_sha256}' as const;`,
    `export const MANIFEST_CLOSURE_SHA256 = '${meta.closure_sha256}' as const;`,
    '',
  ].join('\n');
  const metaTsPath = path.join(resolvedOut, 'manifest.meta.ts');
  fs.writeFileSync(metaTsPath, metaTs);
  console.log(`meta: ${path.relative(root, metaTsPath)}`);

  const lock = {
    _comment: [
      'GENERATED — do not edit. Regenerate with `npm run contract:generate`.',
      'Generated companion to contracts/manifest-v<N>.lock.json, rendered from',
      'Core bundle metadata.',
    ],
    contract_version: meta.contract_version,
    mirrors: '../repository/system/contracts/manifest-contract.yaml',
    schema_path: meta.root_schema,
    schema_sha256: meta.root_schema_sha256,
    closure_sha256: meta.closure_sha256,
    top_level_keys: meta.contract_keys.top_level_keys,
    generated_keys: meta.contract_keys.generated_keys,
    index_keys: meta.contract_keys.index_keys,
    forbidden_top_level_keys: meta.contract_keys.forbidden_top_level_keys,
  };
  const lockPath = path.join(resolvedOut, 'manifest.contract.lock.json');
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`lock: ${path.relative(root, lockPath)}`);
}
