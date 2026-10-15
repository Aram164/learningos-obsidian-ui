'use strict';

const assert = require('node:assert/strict');

function runCoverageControls({ buildIndependentSchemaInventory, bindInventoryToSeeds, reconcileInventoryCoverage, coverageBindingKey }) {
  const root = {
    $id: 'urn:learningos:coverage-controls', type: 'object', additionalProperties: false,
    properties: {
      aliases: {
        type: 'object', properties: { declared: { type: 'integer' } },
        additionalProperties: { type: 'string' },
      },
      entries: {
        type: 'object', additionalProperties: {
          oneOf: [
            { type: 'object', additionalProperties: false, required: ['kind', 'count'],
              properties: { kind: { const: 'count' }, count: { type: 'integer' } } },
            { type: 'object', additionalProperties: false, required: ['kind', 'labels'],
              properties: { kind: { const: 'labels' }, labels: {
                type: 'array', items: { type: 'object', additionalProperties: false,
                  required: ['value'], properties: { value: { type: 'string' } } },
              } } },
          ],
        },
      },
      unused: { type: 'object', properties: { value: { type: 'string' } } },
      choice: { oneOf: ['alpha', 'beta'].map((kind) => ({
        type: 'object', additionalProperties: false, required: ['kind', 'value'],
        properties: { kind: { const: kind }, value: { type: 'string', pattern: '^' + kind } },
      })) },
    },
  };
  const seed = {
    aliases: { declared: 7, first: 'one', second: 'two' },
    entries: { counter: { kind: 'count', count: 1 }, labelled: { kind: 'labels', labels: [{ value: 'x' }] } },
    choice: { kind: 'alpha', value: 'alpha value' },
  };
  const inventory = buildIndependentSchemaInventory({ root, root_uri: root.$id });
  bindInventoryToSeeds(inventory, {
    controls: seed, alternate: { ...seed, choice: { kind: 'beta', value: 'beta value' } },
  }, root);
  const siteAt = (ptr, keyword = 'type') => inventory.get(`${root.$id}::${ptr}::${keyword}`);
  const aliases = siteAt('#/properties/aliases/additionalProperties');
  assert.deepEqual([...aliases.boundPaths].sort(), ['/aliases/first', '/aliases/second'],
    'Dictionary values must bind every undeclared key, excluding declared properties');
  assert.deepEqual([...siteAt('#/properties/entries/additionalProperties').boundPaths].sort(),
    ['/entries/counter', '/entries/labelled']);
  assert.ok(siteAt('#/properties/entries/additionalProperties/oneOf/0/properties/count').boundPaths.has('/entries/counter/count'));
  assert.ok(siteAt('#/properties/entries/additionalProperties/oneOf/1/properties/labels/items/properties/value')
    .boundPaths.has('/entries/labelled/labels/0/value'), 'Dictionary alternatives must recurse through arrays and nested objects');

  const targetMap = new Map();
  for (const site of inventory.values()) {
    for (const [bindingKey, binding] of site.bindings) {
      if (!targetMap.has(bindingKey)) targetMap.set(bindingKey, []);
      targetMap.get(bindingKey).push({ id: 'CONTROL-' + targetMap.get(bindingKey).length,
        seed: binding.seed, category: site.category });
    }
  }
  const requiredPaths = ['/aliases/first', '/aliases/second', '/entries/counter/count', '/entries/labelled/labels/0/value'];
  const covered = reconcileInventoryCoverage(inventory, targetMap, requiredPaths);
  assert.ok(covered.uninstantiatedSites.length > 0);
  for (const site of covered.uninstantiatedSites) {
    assert.equal(site.coverage, 'UNEXERCISED');
    assert.equal(site.deletionEligible, false);
    assert.ok(!Object.hasOwn(site, 'retainedGuard'));
  }

  // A populated dictionary cannot disappear behind an uninstantiated label.
  const savedPaths = aliases.boundPaths;
  aliases.boundPaths = new Set();
  aliases.status = 'UNINSTANTIATED';
  assert.throws(() => reconcileInventoryCoverage(inventory, targetMap, requiredPaths),
    /bound paths disagree with seed bindings/);
  aliases.boundPaths = savedPaths;
  aliases.status = 'INSTANTIATED';

  const missingMutation = new Map(targetMap);
  missingMutation.delete(coverageBindingKey('controls', '/aliases/first'));
  // Coverage is per schema site, so another true binding remains sufficient.
  reconcileInventoryCoverage(inventory, missingMutation, requiredPaths);
  for (const bindingKey of aliases.bindings.keys()) missingMutation.delete(bindingKey);
  missingMutation.set(coverageBindingKey('unbound-seed', '/aliases/first'), [{ category: aliases.category }]);
  assert.throws(() => reconcileInventoryCoverage(inventory, missingMutation, requiredPaths),
    /Schema property coverage incomplete/);

  const alpha = siteAt('#/properties/choice/oneOf/0/properties/value', 'pattern');
  const beta = siteAt('#/properties/choice/oneOf/1/properties/value', 'pattern');
  assert.deepEqual([...alpha.bindings.values()], [{ seed: 'controls', instancePath: '/choice/value' }]);
  assert.deepEqual([...beta.bindings.values()], [{ seed: 'alternate', instancePath: '/choice/value' }]);
  const wrongBranchOnly = new Map(targetMap);
  const alphaKey = coverageBindingKey('controls', '/choice/value');
  wrongBranchOnly.set(alphaKey, targetMap.get(alphaKey).filter((mutation) => mutation.category !== alpha.category));
  const betaKey = coverageBindingKey('alternate', '/choice/value');
  wrongBranchOnly.set(betaKey, targetMap.get(betaKey).map((mutation) => ({
    ...mutation, schemaPointer: alpha.schemaPointer,
  })));
  assert.throws(() => reconcileInventoryCoverage(inventory, wrongBranchOnly, requiredPaths),
    /choice\/oneOf\/0\/properties\/value: missing required E\. STRING_CONSTRAINT/,
    'A different seed at the same path must not credit another union branch, even with forged schemaPointer metadata');

  const unexercised = [...inventory.values()].find((site) => site.status === 'UNINSTANTIATED');
  for (const guard of ['T-27', 'T-31', 'T-DOES-NOT-EXIST']) {
    unexercised.retainedGuard = guard;
    assert.throws(() => reconcileInventoryCoverage(inventory, targetMap, requiredPaths),
      /Unsupported retained protection claim/);
  }
  delete unexercised.retainedGuard;
  reconcileInventoryCoverage(inventory, targetMap, requiredPaths);
  console.log('[PASS] Coverage controls: dictionary/union bindings, same-path seed isolation, all-witness removal, false relabels and retained claims.');
}

module.exports = { runCoverageControls };
if (require.main === module) {
  runCoverageControls(require('./test-manifest-validation-diff'));
}
