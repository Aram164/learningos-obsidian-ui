import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkAbilityContractMirror } from '../scripts/ability-contract-mirror.mjs';

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ability-contract-'));
try {
  const ui = path.join(sandbox, 'ui');
  const core = path.join(sandbox, 'core');
  fs.mkdirSync(path.join(ui, 'contracts'), { recursive: true });
  fs.mkdirSync(path.join(core, 'system/schema'), { recursive: true });
  const schema = { $id: 'ability-context-v1', type: 'object', properties: {
    reason_codes: { type: 'array', items: { type: 'string' } },
  } };
  const mirrorPath = path.join(ui, 'contracts/ability-context-v1.schema.json');
  const producerPath = path.join(core, 'system/schema/ability-context.schema.json');
  fs.writeFileSync(mirrorPath, JSON.stringify(schema));
  fs.writeFileSync(producerPath, JSON.stringify(schema, null, 2));
  assert.deepEqual(checkAbilityContractMirror(ui, core), schema);
  fs.writeFileSync(producerPath, JSON.stringify({ ...schema, properties: {} }));
  assert.throws(() => checkAbilityContractMirror(ui, core), /schema drifted/);
  fs.unlinkSync(producerPath);
  assert.throws(() => checkAbilityContractMirror(ui, core), /ENOENT/);
  fs.writeFileSync(producerPath, JSON.stringify(schema));
  fs.writeFileSync(mirrorPath, '{invalid');
  assert.throws(() => checkAbilityContractMirror(ui, core), SyntaxError);
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}
console.log('Ability query contract mirror OK: same shape, drift, absence and malformed schema');
