import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const validate = require('../src/contracts/generated/manifest.validator.cjs');
const fixture = JSON.parse(fs.readFileSync(
  new URL('../fixture-vault/generated/manifest.json', import.meta.url), 'utf8',
));
assert.equal(validate(fixture), true, JSON.stringify(validate.errors));

for (const type of ['module', 'unit', 'workspace']) {
  // Endpoint resolution is proved by Core's migration fixture suite.
  // This test checks the consumer's wire admission for each owner family.
  const owner = { id: `${type}-canonical-owner` };
  const candidate = structuredClone(fixture);
  const alias = {
    id: `project-legacy-${type}`, type: 'compatibility-alias',
    target_id: owner.id, target_type: type, path: 'projects/aliases.yaml',
  };
  candidate.records.push(alias);
  candidate.project_aliases[alias.id] = owner.id;
  assert.equal(validate(candidate), true, JSON.stringify(validate.errors));
  alias.target_type = 'unknown-owner';
  assert.equal(validate(candidate), false, 'unknown owner types must fail admission');
  alias.target_type = type;
  alias.target_id = 'source-invalid-owner';
  assert.equal(validate(candidate), false, 'aliases cannot target arbitrary record families');
}
console.log('Compatibility aliases: Module, Unit and workspace contract admission verified');
