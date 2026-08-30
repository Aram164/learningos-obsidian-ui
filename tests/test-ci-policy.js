import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';

function runScripts(yml) {
    const lines = yml.split('\n');
    const scripts = [];
    for (let index = 0; index < lines.length; index += 1) {
        const match = lines[index].match(/^(\s*)run:\s*(.*)$/);
        if (!match) continue;
        const indent = match[1].length;
        if (match[2] && match[2] !== '|') {
            scripts.push(match[2]);
            continue;
        }
        const block = [];
        for (index += 1; index < lines.length; index += 1) {
            const nextIndent = lines[index].match(/^\s*/)[0].length;
            if (lines[index].trim() && nextIndent <= indent) {
                index -= 1;
                break;
            }
            block.push(lines[index]);
        }
        scripts.push(block.join('\n'));
    }
    return scripts;
}

test('UI CI policy', () => {
    const yml = readFileSync('.github/workflows/ui-ci.yml', 'utf8');
    assert.match(yml, /make system-check/);
    assert.match(yml, /permissions:\s*\n\s*contents: read/);
    assert.match(yml, /Core commit checked out:/);
    assert.ok(
        runScripts(yml).every((script) => !script.includes('${{')),
        'GitHub expressions must cross into run-shell steps through env, never interpolation',
    );
    assert.match(yml, /RESOLVED_CORE_REF:\s*\$\{\{ steps\.producer-ref\.outputs\.ref \}\}/);
});
