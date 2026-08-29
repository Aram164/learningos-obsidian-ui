import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';

test('UI CI policy', () => {
    const yml = readFileSync('.github/workflows/ui-ci.yml', 'utf8');
    assert.match(yml, /make system-check/);
    assert.match(yml, /permissions:\s*\n\s*contents: read/);
    assert.match(yml, /Core commit checked out:/);
});
