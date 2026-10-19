/*
 * Differential verdict helper for the contract prototype (Point 3).
 *
 * Validates JSON samples with the generated Ajv standalone validator and
 * prints machine-readable verdicts for the Core differential pytest driver:
 *
 *   node scripts/ajv-verdict.mjs <validator.mjs> <sample.json> [sample.json ...]
 *   node scripts/ajv-verdict.mjs --subschema <schema.json> <sample.json> [...]
 *
 * The --subschema mode compiles one extracted subschema on the fly with the
 * same Ajv construction (see ajv-options.mjs) and exists for the per-format
 * vocabulary checks, which do not need full manifests.
 *
 * Stdout is always a JSON array of {sample, valid, errors}; harness failures
 * exit 2 with a message on stderr. Verdicts are data and always exit 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAjv2020 } from './ajv-options.mjs';

function fail(message) {
  console.error(`ajv-verdict: ${message}`);
  process.exit(2);
}

const argv = process.argv.slice(2);
let validate;
let samples;
if (argv[0] === '--subschema') {
  const schemaPath = argv[1];
  if (!schemaPath) fail('missing schema path after --subschema.');
  samples = argv.slice(2);
  if (!samples.length) fail('no samples given.');
  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  } catch (error) {
    fail(`cannot read subschema ${schemaPath}: ${error.message}.`);
  }
  try {
    validate = createAjv2020().compile(schema);
  } catch (error) {
    fail(`subschema does not compile: ${error.message}.`);
  }
} else {
  const validatorPath = argv[0];
  samples = argv.slice(1);
  if (!validatorPath) fail('missing validator path.');
  if (!samples.length) fail('no samples given.');
  let module;
  try {
    module = await import(pathToFileURL(path.resolve(validatorPath)).href);
  } catch (error) {
    fail(`cannot import validator ${validatorPath}: ${error.message}.`);
  }
  validate = module.default
    ?? module.validate
    ?? Object.values(module).find((value) => typeof value === 'function');
  if (typeof validate !== 'function') fail('validator module exports no function.');
}

const results = samples.map((sample) => {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(sample, 'utf8'));
  } catch (error) {
    fail(`cannot read sample ${sample}: ${error.message}.`);
  }
  const valid = validate(value);
  return {
    sample: path.basename(sample),
    valid: valid === true,
    errors: (validate.errors ?? []).map((error) => ({
      instancePath: error.instancePath,
      keyword: error.keyword,
      message: error.message,
    })),
  };
});
console.log(JSON.stringify(results));
