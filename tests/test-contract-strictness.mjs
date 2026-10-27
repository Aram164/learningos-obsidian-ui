import assert from 'node:assert/strict';
import { createAjv2020 } from '../scripts/ajv-options.mjs';

assert.throws(() => createAjv2020().compile({
  type: 'object', properties: { evidence: { minItems: 1 } },
}), /strictTypes/);
assert.throws(() => createAjv2020().compile({
  type: 'array', prefixItems: [{ type: 'string' }],
}), /tuple/);
assert.doesNotThrow(() => createAjv2020().compile({
  type: 'object', properties: { evidence: { type: 'array', minItems: 1, items: { type: 'string' } } },
}));
console.log('contract: type and tuple strictness findings fail compilation');
