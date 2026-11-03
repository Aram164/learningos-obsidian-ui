'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

let cachedTs = null;
let compiler = null;
function compilerIdentity() {
  if (compiler) return compiler;
  let filename;
  try { filename = require.resolve('typescript'); }
  catch (_) {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    filename = path.join(globalRoot, 'typescript', 'lib', 'typescript.js');
  }
  const metadata = JSON.parse(fs.readFileSync(path.join(path.dirname(filename), '..', 'package.json'), 'utf8'));
  compiler = { filename, version: metadata.version };
  return compiler;
}

function loadTypeScript() {
  if (cachedTs) return cachedTs;
  cachedTs = require(compilerIdentity().filename);
  return cachedTs;
}

const TS_CACHE_DIR = path.join(os.tmpdir(), 'learningos-ui-ts-cache-v1');
try {
  fs.mkdirSync(TS_CACHE_DIR, { recursive: true });
} catch (_) {
  // Ignore if tmpdir is unavailable; transpile in memory.
}

function transpileCached(root, filename, source) {
  const { filename: compilerFile, version } = compilerIdentity();
  const key = crypto
    .createHash('sha256')
    .update('ES2022:CommonJS:esModuleInterop:v1\0')
    .update(compilerFile)
    .update('\0')
    .update(version)
    .update('\0')
    .update(filename)
    .update('\0')
    .update(source)
    .digest('hex');
  const cacheFile = path.join(TS_CACHE_DIR, `${key}.cjs`);
  try {
    return fs.readFileSync(cacheFile, 'utf8');
  } catch (_) {
    // Cache miss; transpile with TypeScript below.
  }

  const ts = loadTypeScript();
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

  try {
    const tmpFile = `${cacheFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, transpiled.outputText, 'utf8');
    fs.renameSync(tmpFile, cacheFile);
  } catch (_) {
    // Ignore cache write races or read-only tmpdir.
  }
  return transpiled.outputText;
}

/** Load TypeScript source modules directly, preserving their real import graph. */
function createSourceModuleLoader(root, mocks = {}) {
  const cache = new Map();

  function resolve(parentFile, specifier) {
    if (!specifier.startsWith('.')) return null;
    const base = path.resolve(path.dirname(parentFile), specifier);
    for (const candidate of [`${base}.ts`, path.join(base, 'index.ts'), base, `${base}.cjs`]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    throw new Error(`Cannot resolve ${specifier} from ${parentFile}`);
  }

  function load(relativePath) {
    const filename = path.resolve(root, relativePath);
    if (cache.has(filename)) return cache.get(filename).exports;

    const module = { exports: {} };
    cache.set(filename, module);
    const source = fs.readFileSync(filename, 'utf8');
    const outputText = transpileCached(root, filename, source);

    const localRequire = (specifier) => {
      if (Object.prototype.hasOwnProperty.call(mocks, specifier)) return mocks[specifier];
      const internal = resolve(filename, specifier);
      if (!internal) return require(specifier);
      if (internal.endsWith('.cjs')) return require(internal);
      return load(path.relative(root, internal));
    };
    const execute = new Function('module', 'exports', 'require', '__filename', '__dirname', outputText);
    execute(module, module.exports, localRequire, filename, path.dirname(filename));
    return module.exports;
  }

  return load;
}

module.exports = { createSourceModuleLoader };
