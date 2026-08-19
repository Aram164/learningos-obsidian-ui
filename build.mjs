import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STYLESHEET_MODULES, stylesheetSources, writeStylesheet } from './build-styles.mjs';
import { manifestLock, namedLock } from './scripts/contract-locks.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const pluginDir = path.join(root, 'plugin');
const outfile = path.join(pluginDir, 'main.js');
fs.mkdirSync(pluginDir, { recursive: true });

async function loadEsbuild() {
  try {
    const module = await import('esbuild');
    return module.build;
  } catch (error) {
    if ((process.env.CI || process.env.LEARNINGOS_REQUIRE_ESBUILD === '1')
        && process.env.LEARNINGOS_ALLOW_FALLBACK !== '1') {
      throw new Error(`esbuild is required in CI/production builds: ${error.message}`);
    }
    return null;
  }
}

async function loadTypeScript() {
  try {
    const module = await import('typescript');
    return module.default || module;
  } catch (_) {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    const module = await import(pathToFileURL(path.join(globalRoot, 'typescript', 'lib', 'typescript.js')).href);
    return module.default || module;
  }
}

function resolveInternal(parentId, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(parentId), specifier));
  for (const candidate of [`${base}.ts`, path.posix.join(base, 'index.ts')]) {
    if (fs.existsSync(path.join(root, candidate))) return candidate;
  }
  throw new Error(`Cannot resolve ${specifier} from ${parentId}`);
}

async function fallbackBundle() {
  const ts = await loadTypeScript();
  const entry = 'src/main.ts';
  const queue = [entry];
  const sources = new Map();

  while (queue.length) {
    const id = queue.shift();
    if (sources.has(id)) continue;
    const source = fs.readFileSync(path.join(root, id), 'utf8');
    sources.set(id, source);
    const imports = ts.preProcessFile(source, true, true).importedFiles
      .map((item) => resolveInternal(id, item.fileName)).filter(Boolean);
    for (const dependency of imports) if (!sources.has(dependency)) queue.push(dependency);
  }

  const modules = [...sources].sort(([left], [right]) => left.localeCompare(right));
  const wrappers = modules.map(([id, source]) => {
    const transpiled = ts.transpileModule(source, {
      fileName: id,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      },
      reportDiagnostics: true,
    });
    const errors = (transpiled.diagnostics || []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
    if (errors.length) {
      const formatted = ts.formatDiagnosticsWithColorAndContext(errors, {
        getCurrentDirectory: () => root,
        getCanonicalFileName: (name) => name,
        getNewLine: () => '\n',
      });
      throw new Error(formatted);
    }
    return `${JSON.stringify(id)}: function(module, exports, require) {\n${transpiled.outputText}\n}`;
  });

  const output = `'use strict';\n` +
`// Offline verification fallback. CI and release builds require esbuild.\n` +
`const __nativeRequire = require;\n` +
`const __modules = {\n${wrappers.join(',\n')}\n};\n` +
`const __cache = Object.create(null);\n` +
`function __resolve(parentId, specifier) {\n` +
`  if (!specifier.startsWith('.')) return null;\n` +
`  const parent = parentId.split('/'); parent.pop();\n` +
`  for (const part of specifier.split('/')) {\n` +
`    if (!part || part === '.') continue;\n` +
`    if (part === '..') parent.pop(); else parent.push(part);\n` +
`  }\n` +
`  const base = parent.join('/');\n` +
`  if (__modules[base + '.ts']) return base + '.ts';\n` +
`  if (__modules[base + '/index.ts']) return base + '/index.ts';\n` +
`  throw new Error('Cannot resolve ' + specifier + ' from ' + parentId);\n` +
`}\n` +
`function __load(id) {\n` +
`  if (__cache[id]) return __cache[id].exports;\n` +
`  const factory = __modules[id];\n` +
`  if (!factory) return __nativeRequire(id);\n` +
`  const module = { exports: {} }; __cache[id] = module;\n` +
`  factory(module, module.exports, (specifier) => {\n` +
`    const resolved = __resolve(id, specifier);\n` +
`    return resolved ? __load(resolved) : __nativeRequire(specifier);\n` +
`  });\n` +
`  return module.exports;\n` +
`}\n` +
`module.exports = __load('src/main.ts').default;\n`;
  fs.writeFileSync(outfile, output, 'utf8');
  return { bundler: 'typescript-fallback', modules: modules.map(([id]) => id) };
}

async function esbuildBundle(build) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: ['src/main.ts'],
    outfile,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'es2022',
    external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*', 'node:*'],
    treeShaking: true,
    sourcemap: false,
    metafile: true,
    logLevel: 'silent',
    banner: { js: "'use strict';" },
    // Preserve the plugin's historical CommonJS surface while source code uses
    // the standard Obsidian default export.
    footer: { js: 'module.exports = module.exports.default;' },
  });
  return {
    bundler: 'esbuild',
    modules: Object.keys(result.metafile.inputs)
      .filter((relative) => relative.startsWith('src/') && relative.endsWith('.ts'))
      .sort(),
  };
}

const esbuild = await loadEsbuild();
const buildResult = esbuild ? await esbuildBundle(esbuild) : await fallbackBundle();
const output = fs.readFileSync(outfile);
/* The stylesheet is built the same way and for the same reason as the bundle:
 * it has source modules and one composed artifact, and the artifact is
 * fingerprinted so a stale plugin/styles.css cannot masquerade as current. */
const stylesheet = writeStylesheet(path.join(pluginDir, 'styles.css'));
const sources = [
  ...buildResult.modules.map((relative) => ({
    relative,
    source: fs.readFileSync(path.join(root, relative), 'utf8'),
  })),
  ...stylesheetSources(),
];
const sha256 = (value) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
const pluginManifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'manifest.json'), 'utf8'));
const manifestContract = manifestLock(root);
const jobDashboardContract = namedLock(root, 'job-dashboard-v2.lock.json');
const contract = manifestContract.value;
let sourceRevision = process.env.LEARNINGOS_UI_SOURCE_REVISION || process.env.GITHUB_SHA || '';
if (!sourceRevision) {
  try {
    sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch (_) {
    sourceRevision = 'working-tree';
  }
}
const sourceMaterial = [
  fs.readFileSync(path.join(root, 'build.mjs'), 'utf8'),
  fs.readFileSync(path.join(root, 'build-styles.mjs'), 'utf8'),
  fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
  fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8'),
  manifestContract.text,
  jobDashboardContract.text,
  ...sources.flatMap(({ relative, source }) => [relative, source]),
].join('\0');
/*
 * `source_revision` alone is a claim with no honesty in it: it records what
 * HEAD pointed at when the build ran, so a build from an edited working tree
 * reports its parent commit and looks like a clean build of it. The core
 * solved the same problem with `_generated.source_dirty`; this is its
 * counterpart, so Diagnostics can say which of the two it is looking at.
 *
 * Both values must be deterministic — check-build.mjs requires two consecutive
 * builds to produce byte-identical build-info — so the date is the commit's,
 * never the clock's.
 */
const gitOrNull = (args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch (_) {
    return null;
  }
};
const dirtyPaths = gitOrNull(['status', '--porcelain', '--', 'src', 'build.mjs', 'build-styles.mjs', 'package.json', 'tsconfig.json', 'contracts']);
const sourceDirty = dirtyPaths === null ? null : dirtyPaths.length > 0;
const sourceCommittedAt = gitOrNull(['show', '-s', '--format=%cI', 'HEAD']);

/*
 * Which core this bundle was built beside.
 *
 * "Core and UI are released together" is the rule the manifest contract states
 * and the reason contracts/manifest-v<N>.lock.json exists. Nothing recorded the
 * pairing: after the fact there was no artifact anywhere that could answer
 * "which core commit was this plugin checked against?" — not the bundle, not
 * build-info, not a lockfile. So a mismatched pair could only ever be diagnosed
 * by re-running the check, never by inspecting what shipped.
 *
 * `scripts/check-contract.mjs` compares this build's lock against that core's
 * declaration in the same `npm run check` run and fails it on disagreement, so
 * a green run plus this SHA is the pairing, recorded.
 *
 * null means core was not checked out for this build — a weaker claim than a
 * SHA, and deliberately distinguishable from one. CI checks core out.
 * Deterministic across two consecutive builds, as check-build.mjs requires.
 */
const producerContract = path.resolve(root, contract.mirrors ?? '../repository/system/contracts/manifest-contract.yaml');
const coreRoot = path.resolve(path.dirname(producerContract), '..', '..');
const coreRevision = fs.existsSync(producerContract)
  ? (gitOrNull(['-C', coreRoot, 'rev-parse', 'HEAD']) ?? 'unknown')
  : null;

const buildInfo = {
  /* 3: the stylesheet stopped being a hand-edited file and became a composed
   *    artifact, so build-info describes its modules and fingerprint too.
   * 4: `core_revision` — the plugin now states which core it was verified
   *    against, so the release-together rule leaves evidence. */
  schema_version: 4,
  bundler: buildResult.bundler,
  entry_point: 'src/main.ts',
  ui_version: pluginManifest.version,
  manifest_contract_version: contract.contract_version,
  core_revision: coreRevision,
  source_revision: sourceRevision,
  source_dirty: sourceDirty,
  source_committed_at: sourceCommittedAt,
  source_fingerprint: sha256(sourceMaterial),
  bundle_sha256: sha256(output),
  stylesheet_sha256: sha256(stylesheet),
  node_version: process.version,
  modules: buildResult.modules,
  stylesheet_modules: STYLESHEET_MODULES.map((name) => `src/styles/${name}`),
};
fs.writeFileSync(path.join(pluginDir, 'build-info.json'), `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8');
console.log(`build: ${buildResult.bundler} bundled ${buildResult.modules.length} modules -> plugin/main.js (${output.byteLength} bytes, ${buildInfo.bundle_sha256})`);
console.log(`build: composed ${STYLESHEET_MODULES.length} style modules -> plugin/styles.css (${Buffer.byteLength(stylesheet)} bytes, ${buildInfo.stylesheet_sha256})`);
