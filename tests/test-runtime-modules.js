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
const { isProjectionConflict, GatewayError } = load('src/contracts/gateway-v1.ts');
const { ApplicationRouter } = load('src/app/router.ts');
const constants = load('src/constants.ts');

/*
 * Host mocks for the modules that import 'obsidian' / 'electron'.
 *
 * Deliberately minimal and faithful: each mock provides exactly what the real
 * host provides and nothing more. A mock that is more permissive than the host
 * is what produced RC-7 — see the note in tests/harness.js. These tests only
 * exercise query logic, so Modal needs a constructor and nothing else; if a
 * test ever needs contentEl it should build a real element, not have the mock
 * invent one.
 */
const hostMocks = {
  obsidian: {
    Modal: class Modal { constructor(app) { this.app = app; } },
    setIcon: () => undefined,
  },
  electron: { webUtils: { getPathForFile: () => '' } },
};
const loadWithHost = createSourceModuleLoader(ROOT, hostMocks);
const { GlobalSearchModal } = loadWithHost('src/app/global-search.ts');

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

  await test('ManifestStore loads a contract-valid v4 fixture', async () => {
    const store = new ManifestStore(manifestApp());
    assert.equal(await store.load(), true);
    assert.equal(store.ready, true);
    assert.equal(store.contractVersion, 4);
    assert.ok(store.records.length > 0);
  });

  await test('ManifestStore rejects an old contract before exposing data', async () => {
    const store = new ManifestStore(manifestApp((text) =>
      text.replace('"contract_version": 4', '"contract_version": 1')));
    assert.equal(await store.load(), false);
    assert.equal(store.ready, false);
    assert.equal(store.data, null);
    assert.match(store.error, /requires contract 4/);
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
    let sent = null;
    const plugin = {
      runLos: (args, callback, stdin) => {
        received = args; sent = stdin;
        callback(null, '{"ok":true,"transaction_id":"tx-1"}', '');
      },
      store: { snapshotId: 'snapshot-test' },
    };
    const gateway = new GatewayClient(plugin);
    const result = await gateway.saveNote('unit-a', 'stage-a', 'text');
    assert.equal(result.transaction_id, 'tx-1');
    // One write shape: a declared capability, its payload on stdin.
    assert.deepEqual(received, ['capability', 'stage.note.write', '--payload-file', '-']);
    const envelope = JSON.parse(sent);
    assert.equal(envelope.capability, 'stage.note.write');
    assert.equal(envelope.expected_snapshot, 'snapshot-test',
      'the snapshot guard must travel with the write');
    assert.deepEqual(envelope.payload,
      { unit_id: 'unit-a', stage_id: 'stage-a', text: 'text', replace: true });
    assert.ok(envelope.request_id, 'every write is identifiable');
  });

  /*
   * The core answers a refusal on stdout and leaves stderr empty. Preferring
   * stderr meant the learner saw Node's "Command failed: python …" instead of
   * the sentence explaining what was refused and why.
   */
  await test('a refusal surfaces the reason the core gave, not the process failure', async () => {
    const refusal = JSON.stringify({
      ok: false,
      error: 'los: projection conflict — authored files changed since the app loaded',
    });
    const failure = Object.assign(new Error('Command failed: python tools/los.py capability'), { code: 3 });
    const plugin = {
      runLos: (_args, callback) => callback(failure, refusal, ''),
      store: { snapshotId: 'snapshot-test' },
    };
    const gateway = new GatewayClient(plugin);
    await assert.rejects(
      gateway.progress('u', 's', 'complete'),
      (error) => {
        assert.match(error.message, /projection conflict/,
          'the core’s reason must reach the learner');
        assert.doesNotMatch(error.message, /Command failed/);
        assert.equal(error.exitCode, 3, 'the exit code decides whether this is recoverable');
        assert.equal(isProjectionConflict(error), true);
        return true;
      },
    );
  });

  await test('an ordinary failure with a real stderr still reports it', async () => {
    const failure = Object.assign(new Error('spawn ENOENT'), { code: 2 });
    const plugin = {
      runLos: (_args, callback) => callback(failure, '', 'python: no such interpreter'),
      store: { snapshotId: 'snapshot-test' },
    };
    const gateway = new GatewayClient(plugin);
    await assert.rejects(gateway.progress('u', 's', 'complete'), (error) => {
      assert.match(error.message, /no such interpreter/);
      assert.equal(isProjectionConflict(error), false,
        'only exit 3 may trigger an automatic rebuild');
      return true;
    });
  });

  await test('every porcelain method sends one declared capability envelope', async () => {
    const calls = [];
    const plugin = {
      runLos: (args, callback, stdin) => {
        calls.push({ args, envelope: JSON.parse(stdin) });
        callback(null, '{"ok":true}', '');
      },
      store: { snapshotId: 'snapshot-test' },
    };
    const gateway = new GatewayClient(plugin);
    await gateway.progress('u', 's', 'complete');
    await gateway.feedback('u', 's', 'src', 'helpful');
    await gateway.detour('u', 's', 'a gap');
    await gateway.resolveDetour('u', 'd', 'done');
    await gateway.attach('u', 's', '/tmp/f.pdf');
    await gateway.captureText('note text', 'a title');
    await gateway.captureFile('/tmp/f.pdf');
    await gateway.prepareShelving('u');
    await gateway.applyShelving('u', ['p1']);
    await gateway.saveUnitNote('u', { text: 'body', stageIds: ['s'] });

    assert.deepEqual(calls.map((c) => c.envelope.capability), [
      'stage.progress.update', 'source.feedback.record', 'detour.create',
      'detour.resolve', 'stage.attachment.add', 'capture.create',
      'capture.create', 'review.prepare', 'review.apply', 'unit.note.append',
    ]);
    for (const call of calls) {
      assert.equal(call.args[0], 'capability', 'one call shape for every write');
      assert.deepEqual(call.args.slice(2), ['--payload-file', '-']);
      assert.equal(call.envelope.expected_snapshot, 'snapshot-test');
      assert.ok(!('expected_snapshot' in call.envelope.payload),
        'the payload must not restate what the envelope owns');
    }
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

  /* ----------------------------------------------------------------------
   * Global search ranking and matching.
   *
   * These exercise the pure query logic directly, with no DOM. The defect
   * that made "SaD Lecture 06" return nothing was a crash in renderTabs(),
   * not a matching failure — but nothing in the suite proved the pipeline
   * returned that unit for that query shape, so the data was suspected first.
   * These tests make that question answerable without opening Obsidian.
   * -------------------------------------------------------------------- */

  async function searchStore() {
    const store = new ManifestStore(manifestApp());
    await store.load();
    return store;
  }

  function searchModal(store, query, filter = 'all') {
    const modal = new GlobalSearchModal({}, { store, router: { clearOverlay() {} } }, query);
    modal.filter = filter;
    return modal;
  }

  await test('search matches every query word, not just the first', async () => {
    const modal = searchModal(await searchStore(), 'sad lecture 02');
    const candidate = {
      id: 'unit-fixture-sad-l02', title: 'SaD Lecture 02 — Descriptive statistics',
      subtitle: 'Unit', aliases: [], authors: [],
    };
    assert.equal(modal.matches(candidate), true);
    modal.query = 'sad lecture 99';
    assert.equal(modal.matches(candidate), false, 'one absent word must reject the candidate');
  });

  await test('search reads aliases and authors, not only the title', async () => {
    const modal = searchModal(await searchStore(), 'wahrscheinlichkeitsbuch');
    const byAlias = {
      id: 'source-fixture-book', title: 'A fixture book', subtitle: 'Learning source',
      aliases: ['Wahrscheinlichkeitsbuch'], authors: [],
    };
    assert.equal(modal.matches(byAlias), true, 'German alias must be reachable');
    modal.query = 'fixture';
    assert.equal(modal.matches({ ...byAlias, aliases: [], authors: ['B. Fixture'] }), true);
  });

  await test('an empty query matches everything rather than nothing', async () => {
    const modal = searchModal(await searchStore(), '   ');
    assert.equal(modal.matches({ id: 'x', title: 'y', subtitle: '', aliases: [], authors: [] }), true);
    assert.ok(modal.rankedCandidates().length > 0);
  });

  await test('regression: a lecture query returns its unit', async () => {
    // The exact query shape that appeared to fail in Obsidian. The fixture's
    // own SaD unit stands in for SaD Lecture 06 in the live vault; adding a
    // unit here would break the fixture's atomic collection counts.
    const rows = searchModal(await searchStore(), 'SaD Lecture 02').rankedCandidates();
    assert.ok(rows.length > 0, 'the query must return at least one row');
    assert.ok(
      rows.some((row) => row.id === 'unit-fixture-sad-l02'),
      `expected unit-fixture-sad-l02 in [${rows.map((r) => r.id).join(', ')}]`,
    );
  });

  await test('ranking prefers an exact title, then a prefix, then alphabetical', async () => {
    const modal = searchModal(await searchStore(), 'sad lecture');
    const titles = modal.rankedCandidates().map((row) => row.title);
    const sorted = [...titles].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(titles, sorted, 'equal-rank rows must be alphabetical');
  });

  await test('a kind filter narrows results without changing the query', async () => {
    const store = await searchStore();
    const all = searchModal(store, '', 'all').rankedCandidates();
    const sources = searchModal(store, '', 'sources').rankedCandidates();
    assert.ok(sources.length > 0 && sources.length < all.length);
    assert.ok(sources.every((row) => row.kind === 'sources'));
  });

  await test('a query matching nothing returns an empty list, not everything', async () => {
    assert.deepEqual(
      searchModal(await searchStore(), 'zzzz-no-such-record').rankedCandidates(),
      [],
    );
  });

  /* ----------------------------------------------------------------------
   * Snapshot guard. guard() refuses rather than sending the string "null"
   * when no manifest has loaded — a guarded write with no snapshot cannot be
   * refused by the core, which is the whole point of the guard.
   * -------------------------------------------------------------------- */

  await test('the snapshot guard refuses to build without a loaded snapshot', async () => {
    const unloaded = new GatewayClient({ runLos: () => {}, store: { snapshotId: null } });
    assert.throws(() => unloaded.guard(), /no loaded snapshot/);
    const loaded = new GatewayClient({ runLos: () => {}, store: { snapshotId: 'snapshot-test' } });
    assert.deepEqual(loaded.guard(), ['--expected-snapshot', 'snapshot-test']);
  });

  await test('a guarded write never reaches the CLI without a snapshot', async () => {
    let invoked = false;
    const gateway = new GatewayClient({
      runLos: () => { invoked = true; },
      store: { snapshotId: null },
    });
    assert.throws(() => gateway.saveNote('unit-a', 'stage-a', 'text'), /no loaded snapshot/);
    assert.equal(invoked, false, 'the CLI must not be invoked at all');
  });

  if (failures) {
    console.error(`\n${failures} module test failure(s)`);
    process.exit(1);
  }
  console.log(`\n${checks} direct module tests passed`);
})();
