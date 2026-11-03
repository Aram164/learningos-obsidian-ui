'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'learningos-loader-test-'));
const loaderPath = path.join(__dirname, 'source-module-loader.js');
try {
  const compilerDir = path.join(temporary, 'typescript');
  const compilerFile = path.join(compilerDir, 'lib', 'typescript.js');
  fs.mkdirSync(path.dirname(compilerFile), { recursive: true });
  const root = path.join(temporary, 'source');
  fs.mkdirSync(root);
  const sourceFile = path.join(root, 'value.ts');
  fs.writeFileSync(sourceFile, 'first');
  const script = `
    const Module = require('module');
    const os = require('os');
    const [loader, root, compiler, temporary, warm] = process.argv.slice(1);
    os.tmpdir = () => temporary;
    const resolve = Module._resolveFilename;
    Module._resolveFilename = function (request, ...args) {
      return request === 'typescript' ? compiler : resolve.call(this, request, ...args);
    };
    if (warm === 'warm') {
      const load = Module._load;
      Module._load = function (request, ...args) {
        if (request === compiler) throw new Error('warm cache loaded compiler');
        return load.call(this, request, ...args);
      };
    }
    const { createSourceModuleLoader } = require(loader);
    process.stdout.write(JSON.stringify(createSourceModuleLoader(root)('value.ts')));
  `;
  const run = (warm = '') => JSON.parse(execFileSync(process.execPath,
    ['-e', script, loaderPath, root, compilerFile, temporary, warm], { encoding: 'utf8' }));
  function compiler(version) {
    fs.writeFileSync(path.join(compilerDir, 'package.json'), JSON.stringify({ version }));
    fs.writeFileSync(compilerFile, `
      module.exports = {
        ScriptTarget: { ES2022: 1 }, ModuleKind: { CommonJS: 1 },
        DiagnosticCategory: { Error: 1 },
        transpileModule(source) {
          return { outputText: 'module.exports = ' + JSON.stringify({ source, compiler: '${version}' }), diagnostics: [] };
        },
      };
    `);
  }
  compiler('1.0.0');
  assert.deepEqual(run(), { source: 'first', compiler: '1.0.0' });
  assert.deepEqual(run('warm'), { source: 'first', compiler: '1.0.0' });
  fs.writeFileSync(sourceFile, 'second');
  assert.deepEqual(run(), { source: 'second', compiler: '1.0.0' });
  compiler('2.0.0');
  assert.deepEqual(run(), { source: 'second', compiler: '2.0.0' });
  assert.deepEqual(run('warm'), { source: 'second', compiler: '2.0.0' });
  // An unavailable cache must still execute current source through the compiler.
  const cacheDir = path.join(temporary, 'learningos-ui-ts-cache-v1');
  fs.rmSync(cacheDir, { recursive: true, force: true });
  fs.writeFileSync(cacheDir, 'cache directory unavailable');
  fs.writeFileSync(sourceFile, 'third');
  assert.deepEqual(run(), { source: 'third', compiler: '2.0.0' });
  console.log('Source loader: source/compiler invalidation, lazy warm hits and cache fallback passed');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
