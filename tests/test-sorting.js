'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createSourceModuleLoader } = require('./source-module-loader');
const root = path.dirname(__dirname);
const load = createSourceModuleLoader(root);

const { compareStrings, foldCase } = load('src/sorting.ts');

const xs = ['Zebra', 'ähnlich', 'apple', 'Émile', 'zoo', 'a10', 'a2', 'Apple', 'apple'];
const sorted = [...xs].sort(compareStrings);

const expected = [
  'a2',
  'a10',
  'ähnlich',
  'apple',
  'apple',
  'Apple',
  'Émile',
  'Zebra',
  'zoo'
];

assert.deepStrictEqual(sorted, expected);
assert.strictEqual(foldCase('ÉMILE'), 'émile');
assert.strictEqual(foldCase('Zebra'), 'zebra');
assert.strictEqual(foldCase('I'), 'i');
assert.deepStrictEqual(['item-2', 'item-02', 'item-10'].sort(compareStrings),
  ['item-02', 'item-2', 'item-10']);

// Run fresh runtimes: changing process.env after ICU starts cannot test defaults.
if (!process.env.SORTING_LOCALE_CHILD) {
  for (const locale of ['en_US.UTF-8', 'sv_SE.UTF-8', 'tr_TR.UTF-8']) {
    execFileSync(process.execPath, [__filename], {
      env: { ...process.env, LANG: locale, LC_ALL: locale, SORTING_LOCALE_CHILD: '1' },
      stdio: 'pipe',
    });
  }
}

console.log('Sorting OK');
