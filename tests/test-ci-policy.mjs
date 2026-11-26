import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { checkSourceGraph } from '../scripts/check-source-graph.mjs';

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
    // The paired gate is Core's full collected suite (live_install retired).
    // Phase 4 Linux pytest alone took 86 minutes and the exact-pair run
    // exhausted 90 minutes before artifact creation.
    assert.ok(!yml.includes('not live_install'), 'deprecated live_install deselection must stay removed');
    assert.match(yml, /python3 install\.py --local-build\b/);
    const timeout = Number(yml.match(/timeout-minutes:\s*(\d+)/)?.[1]);
    assert.equal(timeout, 180, `timeout-minutes ${timeout} is not the 180-minute bound`);
    // SPEC (bm): the paired gate reproduces the verified project
    // environment — the exact interpreter patch and Core's repository venv
    // the procedure transcripts invoke — never the runner's interpreter.
    assert.match(yml, /python-version: "3\.14\.4"/);
    assert.match(yml, /runs-on: ubuntu-24\.04/);
    assert.ok(!yml.includes('runs-on: ubuntu-latest'), 'the release image must stay pinned');
    assert.ok(!/python-version: "3\.14"/.test(yml), 'unpinned python-version "3.14" silently selects a new patch');
    const pipInstalls = runScripts(yml).filter((script) => script.includes('pip install'));
    assert.equal(pipInstalls.length, 1);
    const venvAt = pipInstalls[0].indexOf('python -m venv .venv');
    assert.ok(venvAt >= 0, 'Core dependencies must install into a repository .venv');
    assert.ok(pipInstalls[0].indexOf('.venv/bin/python -m pip install -e ".[dev]"') > venvAt);
    // Core's suite runs its procedure transcripts under the pinned Scrut and
    // compares its ratchets against a dynamically resolved base != HEAD.
    assert.match(yml, /scrut-v0\.5\.0-linux-x86_64\.tar\.gz/);
    assert.match(yml, /5c373d077a73dc4a5d4b43f3474e0f443dc72fb42f89b312ef55f934e6e6ba15 {2}\$dir\/scrut\.tar\.gz" \| sha256sum -c -/);
    assert.match(yml, /echo "LOS_SCRUT_BIN=\$bin" >> "\$GITHUB_ENV"/);
    assert.ok(!yml.includes('LOS_RATCHET_BASE: origin/main'), 'LOS_RATCHET_BASE must be computed dynamically rather than hardcoded to origin/main');
    assert.match(yml, /id:\s*ratchet/);
    assert.match(yml, /LOS_RATCHET_BASE:\s*\$\{\{ steps\.ratchet\.outputs\.base \}\}/);
    assert.match(yml, /path: repository\n\s*# Full history[^\n]*\n\s*fetch-depth: 0/);
    // Core's test_flows_pin resolves the UI commit FLOWS.md pins, which a
    // depth-1 UI checkout cannot reach: UI main's 2026-11-06 run failed on it.
    assert.match(yml, /path: obsidian-ui\n\s*# Full history[^\n]*\n\s*fetch-depth: 0/);
    // Phase 1 provenance and override hardening: explicit empty overrides and
    // separate producer-identity artifact (never placed inside plugin/).
    assert.match(yml, /LEARNINGOS_ALLOW_FALLBACK:\s*""/);
    assert.match(yml, /LEARNINGOS_ALLOW_MISSING_CORE:\s*""/);
    assert.match(yml, /PYTEST_ADDOPTS:\s*""/);
    assert.match(yml, /GITHUB_STEP_SUMMARY/);
    assert.match(yml, /name: ui-ci-provenance/);
    assert.ok(!yml.includes('plugin/ci-resolved-core.json'), 'provenance artifact must stay outside plugin/');
});

test('source graph bans Node builtins outside host adapters and view imports across pure layers', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'los-source-graph-'));
    try {
        const write = (rel, body) => {
            const full = path.join(tmp, rel);
            mkdirSync(path.dirname(full), { recursive: true });
            writeFileSync(full, body, 'utf8');
        };
        write('src/main.ts', "import * as fs from 'node:fs';\nimport './gateway-client';\nimport './infrastructure/helper';\nimport './views/sample-view';\nimport './contracts/c';\nimport './projection/p';\nimport './application/a';\nimport './designs/d';\nimport './features/f';\nexport const m = fs;\n");
        write('src/gateway-client.ts', "import { join } from 'node:path';\nexport const g = join;\n");
        write('src/infrastructure/helper.ts', "import { createHash } from 'node:crypto';\nexport const h = createHash;\n");
        write('src/views/sample-view.ts', 'export const v = 1;\n');
        write('src/contracts/c.ts', 'export const c = 1;\n');
        write('src/projection/p.ts', 'export const p = 1;\n');
        write('src/application/a.ts', 'export const a = 1;\n');
        write('src/designs/d.ts', 'export const d = 1;\n');
        write('src/features/f.ts', 'export const f = 1;\n');

        const clean = checkSourceGraph(tmp);
        assert.equal(clean.ok, true, clean.failures.join('\n'));

        write('src/contracts/c.ts', "import fs from 'node:fs';\nexport const c = fs;\n");
        const nodePrefixed = checkSourceGraph(tmp);
        assert.equal(nodePrefixed.ok, false);
        assert.deepEqual(nodePrefixed.disallowedNodeImports, ['src/contracts/c.ts imports node:fs']);

        write('src/contracts/c.ts', "import { readFileSync } from 'fs';\nexport const c = readFileSync;\n");
        const bareBuiltin = checkSourceGraph(tmp);
        assert.equal(bareBuiltin.ok, false);
        assert.deepEqual(bareBuiltin.disallowedNodeImports, ['src/contracts/c.ts imports fs']);
        write('src/contracts/c.ts', 'export const c = 1;\n');

        for (const [rel, imp] of [
            ['src/contracts/c.ts', '../views/sample-view'],
            ['src/projection/p.ts', '../views/sample-view'],
            ['src/application/a.ts', '../views/sample-view'],
            ['src/designs/d.ts', '../views/sample-view'],
            ['src/features/f.ts', '../views/sample-view'],
        ]) {
            write(rel, `import { v } from '${imp}';\nexport const x = v;\n`);
            const badView = checkSourceGraph(tmp);
            assert.equal(badView.ok, false, `${rel} -> views must be refused`);
            assert.deepEqual(badView.forbidden, [`${rel} -> src/views/sample-view.ts`]);
            write(rel, 'export const x = 1;\n');
        }
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }
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
