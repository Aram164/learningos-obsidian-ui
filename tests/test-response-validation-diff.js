'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createSourceModuleLoader } = require('./source-module-loader');
const root = path.dirname(__dirname);
const load = createSourceModuleLoader(root);
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'response-validation-golden.json')));
const validators = require('../src/contracts/generated/responses.validator.cjs');
const schemas = { asHealthReport: 'HealthReportV1', asLegacyArchiveLock: 'LegacyArchiveLockV1',
  asLegacyArchiveStatus: 'LegacyArchiveStatusV1', asMastersPlanningDashboard: 'MastersPlanningDashboardV1',
  asAbilityBrief: 'AbilityBriefWire', asAbilityFocus: 'AbilityFocusWire', asAbilityUnmapped: 'AbilityUnmappedWire',
  asMaterialSpan: 'MaterialSpanWire', asOperationsList: 'OperationsListV1', asOperationDetail: 'OperationDetailV1',
  asGatewaySuccessV2: 'GatewaySuccessV2', asGatewayFailureV2: 'GatewayFailureV2', asGatewayRequestV2: 'GatewayRequestV2' };
function canonical(value) {
  return Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
}
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function outcome(fn, args) {
  try {
    const value = fn(...JSON.parse(JSON.stringify(args), (_, item) => item && item.__set ? new Set(item.__set) : item));
    return value === null ? { kind: 'reject' } : { kind: 'value', value };
  } catch (error) {
    return JSON.parse(JSON.stringify({ kind: 'throw', message: error.message, code: error.code, retryable: error.retryable }));
  }
}
const coverage = new Map();
for (const [index, test] of golden.cases.entries()) {
  const seed = golden.seeds[test.seed];
  const args = JSON.parse(JSON.stringify(seed.args));
  const mutation = test.mutation;
  if (mutation) {
    if (mutation.path.length === 0) args[0] = mutation.value;
    else {
      let parent = args[0];
      for (const key of mutation.path.slice(0, -1)) parent = parent[key];
      const key = mutation.path.at(-1);
      if (mutation.delete) delete parent[key];
      else parent[key] = mutation.value;
    }
  }
  const schema = schemas[seed.name];
  assert(schema, seed.name);
  assert.equal(Boolean(validators['validate' + schema](args[0])), test.shape, `Core shape ${index} ${seed.name}`);
  const fn = load('src/contracts/' + seed.file + '.ts')[seed.name];
  assert.equal(hash(outcome(fn, args)), test.expected, `Decoder verdict/projection ${index} ${seed.name}`);
  const counts = coverage.get(seed.name) || { accepts: 0, rejects: 0 };
  counts[test.shape ? 'accepts' : 'rejects'] += 1;
  coverage.set(seed.name, counts);
}
assert.equal(coverage.size, 13);
for (const [name, count] of coverage) assert(count.accepts > 0 && count.rejects > 0, name);
assert.equal(golden.core_shape_comparisons, golden.cases.length);
assert.equal(golden.cases.length, 12750);
// A counterfactual decoder that silently changes projection content must fail.
assert.notEqual(hash({ kind: 'value', value: { corrupted: true } }), golden.cases[0].expected);
console.log(`Response differential OK: ${golden.cases.length} cases, 13 endpoints; ${golden.stricter_malformed_rejections} malformed values rejected by producer shape`);
