import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert';
import path from 'node:path';
import ts from 'typescript';

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

// These two calls only format display prose; neither supplies a match/sort key.
const displayCalls = new Map([
    ['src/features/library/filters.ts', 'label.toLocaleLowerCase()'],
    ['src/features/module/logistics.ts', 'normalized[0]!.toLocaleUpperCase()'],
]);
function localeCalls(filename, content) {
    if (filename === 'src/sorting.ts') return [];
    const source = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, true);
    const violations = [];
    function visit(node) {
        if (ts.isCallExpression(node)) {
            const member = node.expression;
            const name = ts.isPropertyAccessExpression(member) ? member.name.text
                : ts.isElementAccessExpression(member) && ts.isStringLiteral(member.argumentExpression)
                    ? member.argumentExpression.text : '';
            if (['localeCompare', 'toLocaleLowerCase', 'toLocaleUpperCase'].includes(name)
                && node.getText(source) !== displayCalls.get(filename)) {
                violations.push(node.getText(source));
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
    return violations;
}

test('locale policy detects comparisons, multiline calls and case conversion', () => {
    for (const call of ['a.localeCompare(b)', 'a\n.localeCompare(\nb\n)',
        'a.toLocaleLowerCase()', 'a.toLocaleUpperCase()', 'a["localeCompare"](b)']) {
        assert.equal(localeCalls('src/example.ts', call).length, 1, call);
    }
});

test('source code uses shared locale helpers', () => {
    function check(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const filename = path.posix.join(dir, entry.name);
            if (entry.isDirectory()) check(filename);
            else if (entry.name.endsWith('.ts')) {
                assert.deepEqual(localeCalls(filename, readFileSync(filename, 'utf8')), [], filename);
            }
        }
    }
    check('src');
});
