'use strict';

/*
 * Point 4 — Projection Consumption Cost: Node batch harness.
 *
 * Measures what the consumer boundary costs on the REAL vault, never fixtures:
 *
 *   A. STORE LOAD — read / parse / handwritten-validate / total ManifestStore.load
 *      (index+byId derived by same-iteration subtraction, labeled as such),
 *      plus handwritten-vs-generated-Ajv timing on identical input.
 *   C. LIBRARY (Node-observable part) — FinderIndex construction alone, then the
 *      full per-render cost (buildIndex + unregistered-material disk discovery
 *      through the real MaterialTree against the real materials/ tree), with
 *      synchronous-fs call counts for one root render.
 *
 * Deliberately NOT here (needs the live app — see the console battery that
 * ships with the Point 4 record): reconciliation across open leaves,
 * keypress→paint, rememberFolder's saveData cost, DOM construction.
 *
 * Conventions: real modules via tests/source-module-loader, zero mocks (the
 * vault hosts passed to constructors are the only doubles); the manifest path
 * mirrors tests/test-library-finder.js. Not wired into package.json: a
 * benchmark is replayed by hand (`node tests/bench-point4-consumption.js`),
 * never in CI.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createSourceModuleLoader } = require('./source-module-loader');

const root = path.dirname(__dirname);
const learningRoot = path.dirname(root);
const repositoryDir = path.join(learningRoot, 'repository');
const manifestPath = path.join(repositoryDir, 'generated', 'manifest.json');
const ajvValidatorPath = path.join(root, 'contract-prototype', 'generated', 'manifest.validator.cjs');

function fail(message) {
  console.error(`BENCH FATAL: ${message}`);
  process.exit(2);
}

if (!fs.existsSync(manifestPath)) {
  fail(`real manifest missing: ${manifestPath} — Point 4 measures the real vault, never fixtures.`);
}
if (!fs.existsSync(ajvValidatorPath)) {
  fail(`generated validator missing: ${ajvValidatorPath}`);
}

const manifestStat = fs.statSync(manifestPath);

// ---- real modules, zero mocks ----
const load = createSourceModuleLoader(root);
const { ManifestStore } = load('src/manifest-store.ts');
const { assertManifest } = load('src/contracts/manifest.ts');
const { createFinderContext, unregisteredMaterial, folderAt } = load('src/features/library/finder-tree.ts');
const { MaterialTree } = load('src/infrastructure/material-tree.ts');
let ApplicationRouter = null;
try {
  ({ ApplicationRouter } = load('src/app/router.ts'));
} catch (error) {
  console.error(`BENCH NOTE: ApplicationRouter not loadable in Node (${error.message}); rememberFolder JS-side skipped, live battery covers it.`);
}
const validateAjv = require(ajvValidatorPath);

// ---- helpers ----
function r3(x) { return Math.round(x * 1000) / 1000; }

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const q = (p) => sorted[Math.min(n - 1, Math.floor(p * n))];
  return {
    n,
    min: r3(sorted[0]),
    p50: r3(q(0.5)),
    p95: r3(q(0.95)),
    max: r3(sorted[n - 1]),
    mean: r3(sorted.reduce((a, b) => a + b, 0) / n),
  };
}

function elapsedMs(t0) { return Number(process.hrtime.bigint() - t0) / 1e6; }

function section(title) { console.log(`\n### ${title}`); }

function report(name, samples, unit = 'ms') {
  const s = stats(samples);
  console.log(`${name}: n=${s.n} min=${s.min} p50=${s.p50} p95=${s.p95} max=${s.max} mean=${s.mean} ${unit}`);
  return s;
}

const result = {
  point: 4,
  harness: 'node-batch',
  node: process.version,
  platform: process.platform,
  manifest: { path: manifestPath, bytes: manifestStat.size, mtime: manifestStat.mtime.toISOString() },
};

async function main() {
  console.log(`manifest: ${manifestPath} (${manifestStat.size} bytes, mtime ${manifestStat.mtime.toISOString()})`);

  // ------------------------------------------------ A. STORE LOAD (paired stages)
  section('A. store load — paired per-iteration stages (identical bytes each iteration)');
  const text = fs.readFileSync(manifestPath, 'utf8');
  // Warmup: one full pass so measured iterations are steady-state; the first
  // measured iteration is still reported separately as firstMeasured.
  assertManifest(JSON.parse(text));
  if (validateAjv(JSON.parse(text)) !== true) {
    fail(`generated Ajv validator REJECTS the real manifest: ${JSON.stringify(validateAjv.errors?.slice(0, 2))}`);
  }

  const internalRead = [];
  const store = new ManifestStore({
    vault: {
      adapter: {
        exists: async () => true,
        read: async () => {
          const t0 = process.hrtime.bigint();
          const s = fs.readFileSync(manifestPath, 'utf8');
          internalRead.push(elapsedMs(t0));
          return s;
        },
      },
    },
  });
  if (!(await store.load())) fail(`warmup store.load() failed: ${store.error}`);
  internalRead.length = 0;
  result.contractVersion = store.contractVersion;
  console.log(`contract_version: ${store.contractVersion} snapshot: ${store.snapshotId}`);

  // Structural cache-safety evidence, Node-observable part: two consecutive
  // loads of identical bytes. Fresh data identity per load is EXPECTED (each
  // load publishes a new snapshot); the live battery checks identity across
  // consecutive RENDERS without an intervening load, which is the case a
  // snapshot-scoped Finder cache would rely on.
  const snap1 = store.snapshotId;
  const data1 = store.data;
  if (!(await store.load())) fail(`second store.load() failed: ${store.error}`);
  result.loadIdentity = {
    sameSnapshotAcrossLoads: store.snapshotId === snap1,
    freshDataAcrossLoads: store.data !== data1,
  };
  console.log(`loads of identical bytes: same snapshot=${result.loadIdentity.sameSnapshotAcrossLoads} fresh data=${result.loadIdentity.freshDataAcrossLoads}`);

  const N_A = 11;
  const tRead = [];
  const tParse = [];
  const tValidHw = [];
  const tValidAjv = [];
  const tLoad = [];
  const tDerivedIndex = [];
  for (let i = 0; i < N_A; i += 1) {
    let t0 = process.hrtime.bigint();
    const raw = fs.readFileSync(manifestPath, 'utf8');
    tRead.push(elapsedMs(t0));
    t0 = process.hrtime.bigint();
    const parsed = JSON.parse(raw);
    tParse.push(elapsedMs(t0));
    t0 = process.hrtime.bigint();
    assertManifest(parsed);
    tValidHw.push(elapsedMs(t0));
    t0 = process.hrtime.bigint();
    const ajvOk = validateAjv(parsed);
    tValidAjv.push(elapsedMs(t0));
    if (ajvOk !== true) fail(`Ajv rejected the manifest on iteration ${i}: ${JSON.stringify(validateAjv.errors?.slice(0, 2))}`);
    t0 = process.hrtime.bigint();
    const ok = await store.load();
    if (!ok) fail(`store.load() failed on iteration ${i}: ${store.error}`);
    const total = elapsedMs(t0);
    tLoad.push(total);
    // load()'s own internal read was captured by the adapter wrapper above;
    // parse/validate stages ran on identical bytes in this same iteration.
    const internal = internalRead[internalRead.length - 1];
    tDerivedIndex.push(total - internal - tParse[i] - tValidHw[i]);
  }
  result.read = report('A.read fs.readFileSync', tRead);
  result.parse = report('A.parse JSON.parse', tParse);
  result.validateHandwritten = report('A.validate handwritten assertManifest', tValidHw);
  result.validateAjv = report('A.validate generated Ajv (identical input)', tValidAjv);
  result.loadTotal = report('A.load ManifestStore.load total (fs-backed host)', tLoad);
  result.indexDerived = report('A.index byId+indexes+publish, DERIVED by subtraction', tDerivedIndex);
  result.firstMeasured = {
    read: r3(tRead[0]), parse: r3(tParse[0]), validateHw: r3(tValidHw[0]),
    validateAjv: r3(tValidAjv[0]), load: r3(tLoad[0]),
  };

  // ------------------------------------------------ cold-start validators
  section('A.validate cold — fresh-process first validate() call (module load excluded)');
  const testsDir = __dirname;
  const coldAjvScript = `const fs=require('node:fs');`
    + `const v=require(${JSON.stringify(ajvValidatorPath)});`
    + `const p=JSON.parse(fs.readFileSync(${JSON.stringify(manifestPath)},'utf8'));`
    + `const t0=process.hrtime.bigint();const ok=v(p);`
    + `console.log(JSON.stringify({ms:Number(process.hrtime.bigint()-t0)/1e6,ok,errors:ok===true?[]:(v.errors||[]).slice(0,1)}));`;
  const coldHwScript = `const fs=require('node:fs');const path=require('node:path');`
    + `const {createSourceModuleLoader}=require('./source-module-loader');`
    + `const load=createSourceModuleLoader(path.dirname(process.cwd()));`
    + `const {assertManifest}=load('src/contracts/manifest.ts');`
    + `const p=JSON.parse(fs.readFileSync(${JSON.stringify(manifestPath)},'utf8'));`
    + `const t0=process.hrtime.bigint();let ok=true,err='';`
    + `try{assertManifest(p);}catch(e){ok=false;err=String(e&&e.message||e);}`
    + `console.log(JSON.stringify({ms:Number(process.hrtime.bigint()-t0)/1e6,ok,err}));`;
  function cold(script) {
    const runs = [];
    for (let i = 0; i < 3; i += 1) {
      const spawned = spawnSync('node', ['-e', script], { cwd: testsDir, encoding: 'utf8' });
      if (spawned.status !== 0) fail(`cold probe failed: ${(spawned.stderr || '').slice(0, 300)}`);
      runs.push(JSON.parse(spawned.stdout));
    }
    return runs;
  }
  const coldAjv = cold(coldAjvScript);
  const coldHw = cold(coldHwScript);
  if (coldAjv.some((r) => r.ok !== true)) fail(`Ajv cold probe rejected manifest: ${JSON.stringify(coldAjv)}`);
  if (coldHw.some((r) => r.ok !== true)) fail(`handwritten cold probe rejected manifest: ${JSON.stringify(coldHw)}`);
  result.validateAjvCold = report('A.validate Ajv cold (fresh process)', coldAjv.map((r) => r.ms));
  result.validateHwCold = report('A.validate handwritten cold (fresh process)', coldHw.map((r) => r.ms));

  // ------------------------------------------------ C. LIBRARY (no DOM)
  section('C. library per-render cost — buildIndex + real disk discovery (DOM excluded)');
  const NO_MATERIALS = { isDirectory: () => false, list: () => [], count: () => 0 };
  createFinderContext(store, NO_MATERIALS); // warmup
  const N_C = 21;
  const tBuild = [];
  for (let i = 0; i < N_C; i += 1) {
    const t0 = process.hrtime.bigint();
    createFinderContext(store, NO_MATERIALS);
    tBuild.push(elapsedMs(t0));
  }
  result.buildIndex = report('C.buildIndex createFinderContext, no materials', tBuild);

  // Production passes plugin.isMaterialFolder/listMaterialFolder/
  // materialFolderCount, which delegate straight through with no cache
  // (main.ts). This adapter is the identical call shape over the real tree.
  const tree = new MaterialTree({ vault: { adapter: { getBasePath: () => repositoryDir } } });
  const realAdapter = {
    isDirectory: (p) => tree.isDirectory(p),
    list: (p) => tree.list(p),
    count: (p) => tree.count(p),
  };
  const probe = createFinderContext(store, realAdapter);
  const parents = [...(probe.index.materialParents ?? [])];
  const claimedSize = probe.index.claimedMaterial?.size ?? probe.index.claimedMaterial?.length ?? 'unknown';
  const unregistered = unregisteredMaterial(probe);
  result.materialContext = {
    materialParents: parents.length,
    claimedMaterial: claimedSize,
    unregisteredEntries: unregistered.length,
  };
  console.log(`material context: parents=${parents.length} claimed=${claimedSize} unregistered=${unregistered.length}`);

  // Syscall counts for ONE root render. The transpiled module holds the same
  // node:fs object this file requires, so the wrappers observe every sync call
  // the render path makes; nothing else runs in this synchronous window.
  const fsMod = require('node:fs');
  const watched = ['realpathSync', 'statSync', 'readdirSync'];
  const originals = Object.fromEntries(watched.map((k) => [k, fsMod[k]]));
  const counts = { realpathSync: 0, statSync: 0, readdirSync: 0 };
  for (const k of watched) fsMod[k] = (...args) => { counts[k] += 1; return originals[k](...args); };
  try {
    folderAt(createFinderContext(store, realAdapter), []);
  } finally {
    for (const k of watched) fsMod[k] = originals[k];
  }
  result.syscallsPerRootRender = counts;
  console.log(`syscalls for one root render: realpathSync=${counts.realpathSync} statSync=${counts.statSync} readdirSync=${counts.readdirSync}`);

  const tRender = [];
  for (let i = 0; i < N_C; i += 1) {
    const t0 = process.hrtime.bigint();
    folderAt(createFinderContext(store, realAdapter), []);
    tRender.push(elapsedMs(t0));
  }
  result.libraryRenderNoDom = report('C.render context + root folderAt, REAL materials', tRender);

  // ------------------------------------------------ rememberFolder, JS side only
  section('rememberFolder — in-memory + stubbed persist (saveData disk cost needs the live app)');
  if (ApplicationRouter) {
    let persists = 0;
    const router = new ApplicationRouter({
      settings: {},
      persistSettings: async () => { persists += 1; },
      setActiveNav: () => {},
      app: {},
    });
    const route = { name: 'library-folder', path: [], selected: null, layout: 'grid', query: 'regression' };
    await router.remember(route); // warmup
    const tRemember = [];
    for (let i = 0; i < N_C; i += 1) {
      const t0 = process.hrtime.bigint();
      await router.remember({ ...route, query: `regression-${i}` });
      tRemember.push(elapsedMs(t0));
    }
    result.rememberFolderJs = report('rememberFolder JS-side', tRemember);
    result.rememberFolderJs.persistCalls = persists;
  } else {
    result.rememberFolderJs = { skipped: 'ApplicationRouter not loadable in Node' };
    console.log('rememberFolder JS-side: SKIPPED');
  }

  // ------------------------------------------------ Node-answerable gates
  section('Node-answerable gates (interaction gate needs the live battery)');
  const gates = {
    storeLoad: { p50: result.loadTotal.p50, budget: 250, trip: result.loadTotal.p50 > 250 },
    validationHw: { p50: result.validateHandwritten.p50, budget: 100, trip: result.validateHandwritten.p50 > 100 },
    libraryRenderNoDom: { p50: result.libraryRenderNoDom.p50, budget: 50, trip: result.libraryRenderNoDom.p50 > 50 },
  };
  for (const [name, g] of Object.entries(gates)) {
    console.log(`gate ${name}: p50=${g.p50}ms budget=${g.budget}ms -> ${g.trip ? 'TRIP' : 'PASS'}`);
  }
  result.gates = gates;

  console.log('\n__POINT4_JSON__');
  console.log(JSON.stringify(result, null, 1));
}

main().catch((error) => fail(error?.stack || String(error)));
