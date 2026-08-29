import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STYLESHEET_MODULES, stylesheetSources, writeStylesheet } from './build-styles.mjs';
import { manifestLock } from './scripts/contract-locks.mjs';
import {
  readPluginAssets,
  directoryProblem,
  shippedFileProblem,
  unexpectedEntries,
} from './scripts/plugin-assets.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const pluginDir = path.join(root, 'plugin');
const outfile = path.join(pluginDir, 'main.js');
const existingPluginDirectoryProblem = directoryProblem(pluginDir, { missingOk: true });
if (existingPluginDirectoryProblem) {
  throw new Error(`build: plugin/ ${existingPluginDirectoryProblem}; refusing an indirect or misshapen output directory`);
}
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

async function esbuildBundle(build, define) {
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
    define,
  });
  return {
    bundler: 'esbuild',
    modules: Object.keys(result.metafile.inputs)
      .filter((relative) => relative.startsWith('src/') && relative.endsWith('.ts'))
      .sort(),
  };
}

/*
 * Two-pass build.
 *
 * `src/build-identity.ts` exposes the running bundle's own source fingerprint
 * and contract version (see that file). Those values are computed *from* the
 * module graph, so the graph has to be resolved once before either constant
 * exists — pass one runs with placeholder identity values purely to learn
 * which files esbuild actually pulled in. Pass two then rebuilds with the
 * real values injected and is the build that ships; its module graph is
 * asserted equal to pass one's, so a source-conditional import (there are
 * none today, but nothing here assumes there never will be) cannot silently
 * make the shipped bundle describe a graph other than the one it actually
 * has.
 *
 * The offline TypeScript-fallback bundler does not participate: it has no
 * `define` mechanism, always resolves the same graph regardless of identity
 * values, and is never used for a release build, so one pass is sufficient
 * and its build-identity constants read as the documented 'unavailable' / 0.
 */
async function bundleOnce(esbuild, define) {
  return esbuild ? esbuildBundle(esbuild, define) : fallbackBundle();
}

const PLACEHOLDER_DEFINE = {
  __LEARNINGOS_SOURCE_FINGERPRINT__: JSON.stringify('pending-build-pass'),
  __LEARNINGOS_CONTRACT_VERSION__: JSON.stringify(0),
};

const esbuild = await loadEsbuild();
const passOne = await bundleOnce(esbuild, PLACEHOLDER_DEFINE);
/* The stylesheet is built the same way and for the same reason as the bundle:
 * it has source modules and one composed artifact, and the artifact is
 * fingerprinted so a stale plugin/styles.css cannot masquerade as current. */
const stylesheet = writeStylesheet(path.join(pluginDir, 'styles.css'));
const passOneSources = [
  ...passOne.modules.map((relative) => ({
    relative,
    source: fs.readFileSync(path.join(root, relative), 'utf8'),
  })),
  ...stylesheetSources(),
];
const sha256 = (value) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
const pluginManifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'manifest.json'), 'utf8'));
const manifestContract = manifestLock(root);
const contract = manifestContract.value;
/*
 * `source_revision` names the exact commit only; it is never a substitute for
 * a workflow's own SHA. A Core CI workflow's GITHUB_SHA is the Core commit —
 * using it here for the UI would silently claim the UI's own current checkout
 * is whatever commit Core's workflow happens to be running, which is simply
 * false whenever the two differ. LEARNINGOS_UI_SOURCE_REVISION is this
 * repository's own explicit override, set only by a workflow that actually
 * checked out this UI at a specific SHA (see .github/workflows/*.yml).
 */
let sourceRevision = process.env.LEARNINGOS_UI_SOURCE_REVISION || '';
if (!sourceRevision) {
  try {
    sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch (_) {
    sourceRevision = 'working-tree';
  }
}
/* One inventory for direct build/packaging inputs. It drives the content
 * fingerprint, so a newly authoritative input cannot be added to the claim
 * without also becoming visible in it. */
const DIRECT_BUILD_INPUTS = [
  'build.mjs',
  'build-styles.mjs',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'plugin-assets.json',
  'scripts/plugin-assets.mjs',
  'scripts/contract-locks.mjs',
  'plugin/manifest.json',
];
const invalidDirectBuildInputs = DIRECT_BUILD_INPUTS
  .map((relative) => [relative, shippedFileProblem(path.join(root, relative))])
  .filter(([, problem]) => problem);
if (invalidDirectBuildInputs.length) {
  throw new Error(`build: required direct input is missing, misshapen, or indirect:\n${
    invalidDirectBuildInputs
      .map(([relative, problem]) => `  ${relative} ${problem}`)
      .join('\n')
  }`);
}
const sourceMaterial = [
  ...DIRECT_BUILD_INPUTS.flatMap((relative) => [
    relative,
    fs.readFileSync(path.join(root, relative), 'utf8'),
  ]),
  'manifest-contract-lock',
  manifestContract.text,
  ...passOneSources.flatMap(({ relative, source }) => [relative, source]),
].join('\0');
const sourceFingerprint = sha256(sourceMaterial);

/* Pass two: the real build, with the real identity injected. Its module graph
 * must equal pass one's exactly — anything else means the graph esbuild
 * actually resolved depends on the identity values themselves, which would
 * make `source_fingerprint` describe a bundle other than the one it ships in. */
const passTwo = await bundleOnce(esbuild, {
  __LEARNINGOS_SOURCE_FINGERPRINT__: JSON.stringify(sourceFingerprint),
  __LEARNINGOS_CONTRACT_VERSION__: JSON.stringify(contract.contract_version),
});
if (JSON.stringify(passTwo.modules) !== JSON.stringify(passOne.modules)) {
  throw new Error(
    'build: the module graph changed between the two build passes — refusing '
    + 'to ship a bundle whose fingerprint may not describe its own contents.',
  );
}
const buildResult = passTwo;
const output = fs.readFileSync(outfile);

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
/* An unreadable Git state is unknown, never clean — a consumer (install.py,
 * the release-pair workflow) that cannot tell "unknown" from "false" would
 * treat a broken checkout as a green light. */
const GENERATED_PLUGIN_OUTPUTS = new Set(['plugin/main.js', 'plugin/styles.css', 'plugin/build-info.json']);
function worktreeDirty(cwd) {
  let raw;
  try {
    raw = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' });
  } catch (_) {
    return null;
  }
  return raw.split('\n').some((line) => {
    if (!line.trim()) return false;
    // Porcelain v1: two status characters, a space, then the path (renames
    // add " -> new"). The generated plugin/ artifacts are excluded because
    // this very build is about to rewrite them — treating that as "dirty
    // source" would make the flag true after every single build.
    const filePath = line.slice(3).split(' -> ').pop();
    return !GENERATED_PLUGIN_OUTPUTS.has(filePath);
  });
}
/* The complete UI worktree, not the narrower fingerprint-input list above:
 * a dirty file that is not a *build* input (a stray edit to README.md, an
 * uncommitted test) is still a dirty *release*, and a real-vault install
 * must refuse it just the same. */
const sourceDirty = worktreeDirty(root);
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
const coreCheckedOut = fs.existsSync(producerContract);
const coreRevision = coreCheckedOut
  ? (gitOrNull(['-C', coreRoot, 'rev-parse', 'HEAD']) ?? 'unknown')
  : null;
const coreDirty = coreCheckedOut ? worktreeDirty(coreRoot) : null;

const buildInfo = {
  /* 3: the stylesheet stopped being a hand-edited file and became a composed
   *    artifact, so build-info describes its modules and fingerprint too.
   * 4: `core_revision` — the plugin now states which core it was verified
   *    against, so the release-together rule leaves evidence.
   * 5: `core_dirty` and a `source_dirty` computed over the complete worktree,
   *    not just the fingerprint's direct inputs — a real-vault install must
   *    refuse on either repository being dirty in any file, not only a file
   *    that happens to feed the bundle. */
  schema_version: 5,
  bundler: buildResult.bundler,
  entry_point: 'src/main.ts',
  ui_version: pluginManifest.version,
  manifest_contract_version: contract.contract_version,
  core_revision: coreRevision,
  core_dirty: coreDirty,
  source_revision: sourceRevision,
  source_dirty: sourceDirty,
  source_committed_at: sourceCommittedAt,
  source_fingerprint: sourceFingerprint,
  bundle_sha256: sha256(output),
  stylesheet_sha256: sha256(stylesheet),
  node_version: process.version,
  modules: buildResult.modules,
  stylesheet_modules: STYLESHEET_MODULES.map((name) => `src/styles/${name}`),
};
fs.writeFileSync(path.join(pluginDir, 'build-info.json'), `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8');

/*
 * `plugin/` is what the installer copies, so the build is the right place to
 * insist it is exactly the declared set. A missing file would be discovered by
 * the installer; a *surplus* one would not be discovered at all — it would be
 * copied into the vault by the old `plugin/*` wildcard and then reported as
 * unknown by every check afterwards, with nothing able to say where it came
 * from.
 */
const assets = readPluginAssets(root);
const built = assets.shipped
  .map((name) => [name, shippedFileProblem(path.join(pluginDir, name))])
  .filter(([, problem]) => problem);
if (built.length) {
  throw new Error(`build: plugin/ ${built.map(([name, problem]) => `${name} ${problem}`).join('; ')}`);
}
const surplus = unexpectedEntries(pluginDir, assets.shipped);
if (surplus.length) {
  throw new Error(
    'build: plugin/ contains files the shipping manifest does not declare:\n  '
    + `${surplus.join('\n  ')}\n`
    + 'Declare them in plugin-assets.json or remove them; they are never shipped silently.',
  );
}

console.log(`build: ${buildResult.bundler} bundled ${buildResult.modules.length} modules -> plugin/main.js (${output.byteLength} bytes, ${buildInfo.bundle_sha256})`);
console.log(`build: composed ${STYLESHEET_MODULES.length} style modules -> plugin/styles.css (${Buffer.byteLength(stylesheet)} bytes, ${buildInfo.stylesheet_sha256})`);
