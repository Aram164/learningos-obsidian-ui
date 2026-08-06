'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function loadTypeScript() {
  try { return require('typescript'); }
  catch (_) {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    return require(path.join(globalRoot, 'typescript', 'lib', 'typescript.js'));
  }
}

/** Load TypeScript source modules directly, preserving their real import graph. */
function createSourceModuleLoader(root, mocks = {}) {
  const ts = loadTypeScript();
  const cache = new Map();

  function resolve(parentFile, specifier) {
    if (!specifier.startsWith('.')) return null;
    const base = path.resolve(path.dirname(parentFile), specifier);
    for (const candidate of [`${base}.ts`, path.join(base, 'index.ts')]) {
      if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error(`Cannot resolve ${specifier} from ${parentFile}`);
  }

  function load(relativePath) {
    const filename = path.resolve(root, relativePath);
    if (cache.has(filename)) return cache.get(filename).exports;

    const module = { exports: {} };
    cache.set(filename, module);
    const source = fs.readFileSync(filename, 'utf8');
    const transpiled = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
      reportDiagnostics: true,
    });
    const errors = (transpiled.diagnostics || [])
      .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
    if (errors.length) {
      throw new Error(ts.formatDiagnostics(errors, {
        getCurrentDirectory: () => root,
        getCanonicalFileName: (name) => name,
        getNewLine: () => '\n',
      }));
    }

    const localRequire = (specifier) => {
      if (Object.prototype.hasOwnProperty.call(mocks, specifier)) return mocks[specifier];
      const internal = resolve(filename, specifier);
      return internal ? load(path.relative(root, internal)) : require(specifier);
    };
    const execute = new Function('module', 'exports', 'require', '__filename', '__dirname', transpiled.outputText);
    execute(module, module.exports, localRequire, filename, path.dirname(filename));
    return module.exports;
  }

  return load;
}

module.exports = { createSourceModuleLoader };
