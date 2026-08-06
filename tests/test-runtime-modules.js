'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { createSourceModuleLoader } = require('./source-module-loader');

const ROOT = path.dirname(__dirname);
const FIXTURE_MANIFEST = path.join(ROOT, 'fixture-vault', 'generated', 'manifest.json');
const load = createSourceModuleLoader(ROOT);
const { ManifestStore } = load('src/manifest-store.ts');
const { GatewayClient } = load('src/gateway-client.ts');
const { ApplicationRouter } = load('src/app/router.ts');
const constants = load('src/constants.ts');

let failures = 0;
let checks = 0;
async function test(name, body) {
  try {
    await body();
    checks += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL ${name}`);
    console.error(error.stack || error);
  }
}

function manifestApp(transform = (value) => value) {
  return {
    vault: {
      adapter: {
        exists: async () => true,
        read: async () => transform(fs.readFileSync(FIXTURE_MANIFEST, 'utf8')),
      },
    },
  };
}

function routerPlugin(settings = {}) {
  return {
    settings,
    store: { get: () => null },
    app: { workspace: {} },
    saveData: async () => undefined,
    setActiveNav: () => undefined,
  };
}

(async () => {
  console.log('\nDirect TypeScript module tests');

  await test('ManifestStore loads a contract-valid v2 fixture', async () => {
    const store = new ManifestStore(manifestApp());
    assert.equal(await store.load(), true);
    assert.equal(store.ready, true);
    assert.equal(store.contractVersion, 2);
    assert.ok(store.records.length > 0);
  });

  await test('ManifestStore rejects an old contract before exposing data', async () => {
    const store = new ManifestStore(manifestApp((text) =>
      text.replace('"contract_version": 2', '"contract_version": 1')));
    assert.equal(await store.load(), false);
    assert.equal(store.ready, false);
    assert.equal(store.data, null);
    assert.match(store.error, /requires contract 2/);
  });

  await test('ManifestStore assertion rejects a missing required array', async () => {
    const store = new ManifestStore(manifestApp((text) => {
      const manifest = JSON.parse(text);
      delete manifest.units;
      return JSON.stringify(manifest);
    }));
    assert.equal(await store.load(), false);
    assert.match(store.error, /field units must be an array/);
    assert.deepEqual(store.units(), []);
  });

  await test('ManifestStore list accessors remain safe before load', async () => {
    const store = new ManifestStore({ vault: { adapter: {} } });
    assert.deepEqual(store.modules(), []);
    assert.deepEqual(store.projects(), []);
    assert.equal(store.get('missing'), null);
  });

  await test('GatewayClient refuses empty and unreadable write confirmations', async () => {
    const outputs = ['', 'not-json'];
    const plugin = {
      runLos: (_args, callback) => callback(null, outputs.shift(), ''),
      store: { snapshotId: 'snapshot-test' },
    };
    const gateway = new GatewayClient(plugin);
    await assert.rejects(gateway.call(['stage-note']), /unconfirmed/);
    await assert.rejects(gateway.call(['stage-note']), /unreadable output/);
  });

  await test('GatewayClient accepts one confirmed JSON result and carries the snapshot guard', async () => {
    let received = null;
    const plugin = {
      runLos: (args, callback) => { received = args; callback(null, '{"ok":true,"transaction_id":"tx-1"}', ''); },
      store: { snapshotId: 'snapshot-test' },
    };
    const gateway = new GatewayClient(plugin);
    const result = await gateway.saveNote('unit-a', 'stage-a', 'text');
    assert.equal(result.transaction_id, 'tx-1');
    assert.deepEqual(received.slice(-2), ['--expected-snapshot', 'snapshot-test']);
  });

  await test('GatewayClient serializes writes and recovers after rejection', async () => {
    const gateway = new GatewayClient({ store: { snapshotId: 'snapshot-test' } });
    const order = [];
    let releaseFirst;
    const gate = new Promise((resolve) => { releaseFirst = resolve; });
    const first = gateway.enqueue(async () => { order.push('first:start'); await gate; order.push('first:end'); });
    const second = gateway.enqueue(async () => { order.push('second'); throw new Error('expected'); });
    const third = gateway.enqueue(async () => { order.push('third'); });
    await Promise.resolve();
    assert.deepEqual(order, ['first:start']);
    releaseFirst();
    await first;
    await assert.rejects(second, /expected/);
    await third;
    await gateway.chain;
    assert.deepEqual(order, ['first:start', 'first:end', 'second', 'third']);
    assert.equal(gateway.isBusy, false);
  });

  await test('ApplicationRouter converts legacy leaves to product routes', async () => {
    const router = new ApplicationRouter(routerPlugin({
      lastView: { type: constants.VIEW_MODULE, state: { screen: 'list', groupId: 'group-ml', query: 'regression' } },
    }));
    assert.deepEqual(router.navigation.current,
      { name: 'module-list', groupId: 'group-ml', query: 'regression' });
  });

  await test('ApplicationRouter descriptors centralize all leaf knowledge', async () => {
    const router = new ApplicationRouter(routerPlugin({}));
    assert.deepEqual(router.descriptor({ name: 'project-detail', projectId: 'project-a' }), {
      type: constants.VIEW_PROJECT,
      state: { screen: 'detail', projectId: 'project-a', tab: 'overview' },
      nav: 'projects',
    });
    assert.equal(router.descriptor({ name: 'garden' }).type, constants.VIEW_GARDEN);
    assert.equal(router.descriptor({ name: 'unknown' }).type, constants.VIEW_HOME);
  });

  await test('ApplicationRouter overlay state is transient and snapshot-safe', async () => {
    const router = new ApplicationRouter(routerPlugin({}));
    router.openOverlay({ kind: 'global-search', query: 'ml', filter: 'all' });
    router.updateOverlay({ query: 'systems' });
    const snapshot = router.snapshot();
    assert.equal(snapshot.overlay.query, 'systems');
    router.clearOverlay();
    assert.equal(router.snapshot().overlay, null);
    assert.equal(snapshot.overlay.query, 'systems');
  });

  if (failures) {
    console.error(`\n${failures} module test failure(s)`);
    process.exit(1);
  }
  console.log(`\n${checks} direct module tests passed`);
})();
