/*
 * Phase 3 live-write contract harness against the real Core CLI (`tools/los.py`).
 *
 * Exercises ALL 7 persistence/recovery scenarios across EACH of the three live
 * UI-to-Core writes:
 *   1. `unit.source-selection.set` (`toggleRouteChoice` + `GatewayClient.sourceSelection`)
 *   2. `unit.map.import` (`UnitMapImportModal` two-step preview -> overrides -> check -> import)
 *   3. `ai-action.delivery.apply` (`GardenView` / `AIActionClient.applyApprovedDelivery`
 *      -> `previewDelivery` -> `approved-delivery` Gateway V2 -> recovery)
 *
 * Driven either by `../repository/tests/test_ui_phase3_live_writes.py --plan ...`
 * (which prepares 21 isolated temp Core repos and asserts on-disk YAML/receipts in
 * Python) or standalone when `--core-root` / `--work-dir` / `--plan` are passed.
 */
'use strict';

const assert = require('assert/strict');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

require('./harness');
const { createSourceModuleLoader } = require('./source-module-loader');

const ROOT = path.dirname(__dirname);
const load = createSourceModuleLoader(ROOT);
const { GatewayClient } = load('src/gateway-client.ts');
const {
  GATEWAY_SCHEMA_VERSION,
  gatewayApprovalSubject,
  gatewaySubjectSha256,
  requestArtifactId,
  isRequestScopedCapability,
} = load('src/contracts/gateway-v2.ts');
const { SettingsGatewayRecoveryStore } = load('src/application/gateway-recovery.ts');
const { emptyUiDrafts } = load('src/application/draft-store.ts');
const { ManifestStore } = load('src/manifest-store.ts');
const { toggleRouteChoice } = load('src/features/unit/material-card.ts');
const { UnitMapImportModal } = load('src/features/unit/map-import.ts');
const { AIActionClient } = load('src/infrastructure/ai-action-client.ts');
const { GardenView } = load('src/views/garden-view.ts');

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) {
    throw new Error(`${name} is required`);
  }
  return process.argv[index + 1];
}

const coreRoot = path.resolve(argument('--core-root'));
const python = argument('--python');
const planPath = path.resolve(argument('--plan'));
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

function sha256File(filePath) {
  return 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function spawnCore(repo, args, stdin = '') {
  const result = spawnSync(
    python,
    [path.join(coreRoot, 'tools', 'los.py'), '--root', repo, ...args],
    {
      cwd: repo,
      input: stdin,
      encoding: 'utf8',
      timeout: 180000,
      env: { ...process.env, LOS_SESSION_ID: 'channel:ui' },
    },
  );
  if (result.error) throw result.error;
  const error = result.status === 0
    ? null
    : Object.assign(new Error(`los exited ${result.status}`), { code: result.status });
  return { error, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function generateManifest(repo) {
  const res = spawnCore(repo, ['generate']);
  if (res.error) throw new Error(`generate failed in ${repo}: ${res.stderr || res.stdout}`);
}

async function loadManifestStore(repo) {
  const store = new ManifestStore({
    vault: {
      adapter: {
        exists: async (rel) => fs.existsSync(path.join(repo, rel)),
        read: async (rel) => fs.readFileSync(path.join(repo, rel), 'utf8'),
      },
    },
  });
  await store.load();
  return store;
}

async function createSession(repo, settingsFile, { wrapRunLos } = {}) {
  const raw = fs.existsSync(settingsFile)
    ? JSON.parse(fs.readFileSync(settingsFile, 'utf8'))
    : {};
  const settings = {
    gatewayRecovery: raw.gatewayRecovery ?? null,
    uiDrafts: raw.uiDrafts ?? emptyUiDrafts(),
    preferredAiProvider: raw.preferredAiProvider ?? 'manual-bundle',
  };
  const recovery = new SettingsGatewayRecoveryStore(settings, async () => {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
  });
  await recovery.load();
  const store = await loadManifestStore(repo);
  const envelopes = [];
  const calls = [];
  const defaultRunLos = (args, callback, stdin) => {
    if (stdin && args[0] === 'ui-capability') {
      envelopes.push(JSON.parse(stdin));
    }
    calls.push({ args: [...args], stdin: stdin ?? null });
    const res = wrapRunLos
      ? wrapRunLos(args, stdin, (a, s) => spawnCore(repo, a, s))
      : spawnCore(repo, args, stdin);
    callback(res.error, res.stdout, res.stderr);
  };
  const notices = [];
  let reloading = Promise.resolve();
  const plugin = {
    store,
    settings,
    recovery,
    runLos: defaultRunLos,
    notify: (msg) => notices.push(msg),
    diagnostics: () => {},
    isLifecycleActive: () => true,
    gateway: null,
    aiActions: null,
    async reloadAndSettle(confirmation) {
      generateManifest(repo);
      await store.load();
      if (confirmation) {
        const settled = await plugin.gateway.projectionObservation({
          receipt_path: confirmation.receipt_path,
          snapshot_after: confirmation.snapshot_after,
        });
        if (settled.settled) {
          await recovery.settleConfirmed();
          plugin.gateway.noteSettlementObserved(confirmation);
        }
      }
    },
    mutate(action) {
      const next = reloading.then(() => plugin.gateway.enqueue(async () => {
        const res = await action();
        if (res && typeof res === 'object' && 'receipt_path' in res && 'snapshot_after' in res) {
          await plugin.reloadAndSettle(res);
        } else {
          generateManifest(repo);
          await store.load();
        }
        return res;
      }));
      reloading = next.catch(() => {});
      return next;
    },
    openVaultPath() {},
    copyText() {},
    getGardenDraft() { return { title: '', text: '' }; },
    setGardenDraft() {},
    clearGardenDraft() {},
    scheduleDraftSave() {},
    async generate() { generateManifest(repo); },
  };
  plugin.gateway = new GatewayClient(plugin);
  plugin.aiActions = new AIActionClient(plugin);
  return { plugin, store, gateway: plugin.gateway, aiActions: plugin.aiActions, recovery, envelopes, calls, notices };
}

function receiptIds(repo) {
  const dir = path.join(repo, 'operations', 'transactions');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('transaction-') && f.endsWith('.yaml'))
    .map((f) => f.slice(0, -'.yaml'.length))
    .sort();
}

function receiptCount(repo) {
  return receiptIds(repo).length;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 10));
async function waitUntil(pred, label = 'condition') {
  const deadline = Date.now() + 15000;
  while (!pred()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await flush();
  }
}

async function sendExternalV2(repo, capability, payload, expectedSnapshot, expectedRevisions = {}) {
  const reqId = `req-ext-${capability.replace(/\./g, '-')}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  const idem = `idem-${reqId}`;
  const effRevs = isRequestScopedCapability(capability)
    ? { [requestArtifactId(capability, idem)]: 0 }
    : expectedRevisions;
  const subject = gatewayApprovalSubject(capability, expectedSnapshot, effRevs, payload);
  const envelope = {
    schema_version: GATEWAY_SCHEMA_VERSION,
    request_id: reqId,
    idempotency_key: idem,
    capability,
    channel: 'ui',
    expected_snapshot: expectedSnapshot,
    expected_revisions: effRevs,
    approval: {
      kind: 'direct-user-gesture',
      subject_sha256: await gatewaySubjectSha256(subject),
    },
    payload,
  };
  const res = spawnCore(repo, ['ui-capability', capability, '--payload-file', '-'], JSON.stringify(envelope));
  if (res.error) throw new Error(`external ${capability} failed: ${res.stderr || res.stdout}`);
  return JSON.parse(res.stdout);
}

/* ================================================================ #1 */
async function runSourceSelectionScenarios(repos) {
  const out = {};
  const targetUnit = 'unit-demo-l02';
  const sourceId = 'source-demo-book';
  const locator = 'lecture-02.pdf';

  // 1. Valid request commits canonically on disk (remove + select round-trip).
  {
    const repo = repos.valid;
    const baseIds = new Set(receiptIds(repo));
    const baseReceipts = baseIds.size;
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    const unitBefore = s.store.get(targetUnit);
    const rev0 = Number(s.store.artifactRevision(targetUnit) ?? 0);
    const removeTx = await toggleRouteChoice(
      s.plugin,
      targetUnit,
      {
        routeId: 'route-ignored',
        sourceId,
        locator,
        angle: 'Follow-up derivation',
        selected: true,
      },
      { [targetUnit]: rev0 },
    );
    assert.equal(removeTx.ok, true);
    assert.ok(!('route_id' in s.envelopes[0].payload), 'must not send route_id');
    assert.equal(s.envelopes[0].payload.action, 'remove');
    assert.ok(!s.store.get(targetUnit).source_selections.some(
      (row) => row.source_id === sourceId && row.locator === locator,
    ));

    const rev1 = Number(s.store.artifactRevision(targetUnit));
    assert.equal(rev1, rev0 + 1);
    const selectTx = await toggleRouteChoice(
      s.plugin,
      targetUnit,
      {
        routeId: 'route-ignored',
        sourceId,
        locator,
        angle: 'Round-trip re-selection.',
        selected: false,
      },
      { [targetUnit]: rev1 },
    );
    assert.equal(selectTx.ok, true);
    assert.equal(s.envelopes[1].payload.action, 'select');
    assert.ok(s.store.get(targetUnit).source_selections.some(
      (row) => row.source_id === sourceId && row.locator === locator
        && row.purpose === 'Round-trip re-selection.',
    ));
    const newIds = receiptIds(repo).filter((id) => !baseIds.has(id));
    assert.equal(newIds.length, 2);
    assert.ok(newIds.includes(removeTx.transaction_id));
    assert.ok(newIds.includes(selectTx.transaction_id));
    out.valid = {
      removeTx: removeTx.transaction_id,
      selectTx: selectTx.transaction_id,
      initialCount: unitBefore.source_selections.length,
      receiptDelta: receiptCount(repo) - baseReceipts,
    };
  }

  // 2. Invalid request refuses with zero canonical disk mutation.
  {
    const repo = repos.invalid;
    const baseReceipts = receiptCount(repo);
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    const rev = Number(s.store.artifactRevision(targetUnit) ?? 0);
    await assert.rejects(
      () => s.gateway.sourceSelection(
        targetUnit,
        'source-does-not-exist',
        locator,
        'Invalid selection',
        true,
        { [targetUnit]: rev },
      ),
      (err) => err && (err.gatewayCode === 'INVALID_REQUEST' || /source/i.test(err.message)),
    );
    assert.equal(s.recovery.unresolved, false);
    assert.equal(receiptCount(repo), baseReceipts);
    out.invalid = { refused: true, receiptDelta: receiptCount(repo) - baseReceipts };
  }

  // 3. Artifact/snapshot change after preview/load refuses stale approval.
  {
    const repo = repos.stalePreview;
    const baseReceipts = receiptCount(repo);
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    const revBefore = Number(s.store.artifactRevision(targetUnit) ?? 0);
    const snapBefore = s.store.snapshotId;
    await sendExternalV2(
      repo,
      'capture.create',
      { text: 'external snapshot bump', title: 'Bump' },
      snapBefore,
      {},
    );
    await assert.rejects(
      () => s.gateway.sourceSelection(
        targetUnit,
        sourceId,
        locator,
        'Should refuse stale snapshot',
        true,
        { [targetUnit]: revBefore },
      ),
      (err) => err && ['STALE_SNAPSHOT', 'REVISION_CONFLICT'].includes(err.gatewayCode),
    );
    assert.equal(receiptCount(repo), baseReceipts + 1);
    out.stalePreview = { refused: true, receiptDelta: receiptCount(repo) - baseReceipts };
  }

  // 4. Concurrent canonical modification preserves newer canonical state.
  {
    const repo = repos.concurrent;
    const baseReceipts = receiptCount(repo);
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    const revBefore = Number(s.store.artifactRevision(targetUnit) ?? 0);
    const snapBefore = s.store.snapshotId;
    await sendExternalV2(
      repo,
      'unit.source-selection.set',
      {
        unit_id: targetUnit,
        source_id: sourceId,
        locator,
        action: 'select',
        purpose: 'Concurrent canonical winner',
      },
      snapBefore,
      { [targetUnit]: revBefore },
    );
    await assert.rejects(
      () => s.gateway.sourceSelection(
        targetUnit,
        sourceId,
        locator,
        'Stale UI loser',
        true,
        { [targetUnit]: revBefore },
      ),
      (err) => err && ['STALE_SNAPSHOT', 'REVISION_CONFLICT'].includes(err.gatewayCode),
    );
    assert.equal(receiptCount(repo), baseReceipts + 1);
    out.concurrent = { refused: true, receiptDelta: receiptCount(repo) - baseReceipts };
  }

  // 5. Duplicate / rapid repeated submissions do not duplicate writes or receipts.
  {
    const repo = repos.duplicate;
    const baseIds = new Set(receiptIds(repo));
    const baseReceipts = baseIds.size;
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    const snap = s.store.snapshotId;
    const rev = Number(s.store.artifactRevision(targetUnit) ?? 0);
    const identity = { requestId: 'req-dup-src-1', idempotencyKey: 'idem-dup-src-1' };
    const envJson = await s.gateway.prepareCapability(
      'unit.source-selection.set',
      {
        unit_id: targetUnit,
        source_id: sourceId,
        locator,
        action: 'select',
        purpose: 'Idempotent check',
      },
      snap,
      { [targetUnit]: rev },
      undefined,
      identity,
    );
    const first = await s.gateway.dispatchPreparedEnvelope(envJson);
    assert.equal(first.outcome, 'confirmed');
    await s.gateway.settle(first);
    await s.plugin.reloadAndSettle(first.confirmation);

    // Rapid second dispatch with exact same envelope replays idempotently.
    const secondRes = spawnCore(repo, ['ui-capability', 'unit.source-selection.set', '--payload-file', '-'], envJson);
    assert.equal(secondRes.error, null, secondRes.stderr);
    const secondJson = JSON.parse(secondRes.stdout);
    assert.equal(secondJson.replayed, true);
    assert.equal(secondJson.transaction_id, first.confirmation.transaction_id);

    // Also rapid parallel toggle calls serialized cleanly through plugin.mutate:
    const p1 = toggleRouteChoice(
      s.plugin,
      targetUnit,
      {
        routeId: 'r',
        sourceId,
        locator,
        angle: 'First winner',
        selected: false,
      },
      { [targetUnit]: Number(s.store.artifactRevision(targetUnit)) },
    );
    const p2 = toggleRouteChoice(
      s.plugin,
      targetUnit,
      {
        routeId: 'r',
        sourceId,
        locator,
        angle: 'Second loser',
        selected: false,
      },
      // Re-using stale rev intentionally proves serialization prevents silent overwrite.
      { [targetUnit]: rev + 1 },
    );
    const settled = await Promise.allSettled([p1, p2]);
    assert.equal(settled[0].status, 'fulfilled');
    assert.equal(settled[1].status, 'rejected');
    const newIds = receiptIds(repo).filter((id) => !baseIds.has(id));
    assert.equal(newIds.length, 2);
    out.duplicate = {
      replayedTx: secondJson.transaction_id,
      receiptDelta: receiptCount(repo) - baseReceipts,
    };
  }

  // 6. Lost response after commit recovers committed outcome via recovery.
  {
    const repo = repos.recovery;
    const baseIds = new Set(receiptIds(repo));
    const baseReceipts = baseIds.size;
    const settings = path.join(repo, '.ui-settings.json');
    let attempt = 0;
    const s1 = await createSession(repo, settings, {
      wrapRunLos: (args, stdin, real) => {
        attempt += 1;
        if (attempt === 1) {
          const committed = real(args, stdin);
          assert.equal(committed.error, null, committed.stderr);
          return {
            error: Object.assign(new Error('EIO lost response'), { code: 5 }),
            stdout: '',
            stderr: 'connection reset after commit',
          };
        }
        return {
          error: Object.assign(new Error('EIO retry disconnected'), { code: 5 }),
          stdout: '',
          stderr: 'disconnected during auto-replay',
        };
      },
    });
    const rev = Number(s1.store.artifactRevision(targetUnit) ?? 0);
    await assert.rejects(
      () => s1.gateway.sourceSelection(
        targetUnit,
        sourceId,
        locator,
        'Recovered after drop',
        true,
        { [targetUnit]: rev },
      ),
      (err) => err && err.gatewayCode === 'RECOVERY_BLOCKED',
    );
    assert.equal(s1.recovery.unresolved, true);

    const s2 = await createSession(repo, settings);
    assert.equal(s2.recovery.unresolved, true);
    const outcome = await s2.gateway.recoverPreparedEnvelope();
    const confirmation = await s2.gateway.settle(outcome);
    assert.equal(confirmation.replayed, true);
    await s2.plugin.reloadAndSettle(confirmation);
    assert.equal(s2.recovery.unresolved, false);
    const newIds = receiptIds(repo).filter((id) => !baseIds.has(id));
    assert.deepEqual(newIds, [confirmation.transaction_id]);
    out.recovery = { transactionId: confirmation.transaction_id, receiptDelta: receiptCount(repo) - baseReceipts };
  }

  // 7. Application reload displays exact persisted state read back from canonical state.
  {
    const repo = repos.reload;
    const baseIds = new Set(receiptIds(repo));
    const settings = path.join(repo, '.ui-settings.json');
    const s1 = await createSession(repo, settings);
    const rev = Number(s1.store.artifactRevision(targetUnit) ?? 0);
    const tx = await toggleRouteChoice(
      s1.plugin,
      targetUnit,
      {
        routeId: 'r',
        sourceId,
        locator,
        angle: 'Persisted across reload',
        selected: false,
      },
      { [targetUnit]: rev },
    );
    assert.equal(tx.ok, true);
    assert.deepEqual(receiptIds(repo).filter((id) => !baseIds.has(id)), [tx.transaction_id]);

    const reloadedStore = await loadManifestStore(repo);
    const unit = reloadedStore.get(targetUnit);
    assert.ok(unit.source_selections.some(
      (row) => row.source_id === sourceId
        && row.locator === locator
        && row.purpose === 'Persisted across reload',
    ));
    out.reload = { transactionId: tx.transaction_id, selectionCount: unit.source_selections.length };
  }

  return out;
}

function findByTag(root, tag) {
  const out = [];
  if (root.tag === tag) out.push(root);
  for (const child of root.children || []) out.push(...findByTag(child, tag));
  return out;
}

function clickEvent() {
  return { preventDefault() {}, stopPropagation() {} };
}

function clickButtonAsync(btn) {
  return btn.listeners.click[0](clickEvent());
}

/* ================================================================ #2 */
async function runMapImportScenarios(repos) {
  const out = {};
  const draftRel = 'work/inbox/reorder-retire-reset.yaml';

  // Helper to drive real UnitMapImportModal two-step flow with minimal DOM shim.
  async function driveModalTwoStep(s, draftFile, { doubleClick = false, repo = null } = {}) {
    const basePreviewReceipts = repo ? receiptCount(repo) : null;
    const mapPath = repo
      ? path.join(repo, 'curriculum/modules/module-demo/units/unit-demo-l01/study-map.yaml')
      : null;
    const mapBefore = mapPath ? fs.readFileSync(mapPath, 'utf8') : null;
    const unit = s.store.get('unit-demo-l01');
    const { stub } = require('./harness');
    const modal = new UnitMapImportModal(
      { workspace: {} },
      {
        unitId: unit.id,
        unitTitle: unit.title,
        replacing: true,
        preview: (file, replace, overrides) => s.gateway.previewUnitMapImport(unit.id, file, replace, overrides),
        check: (file, replace, overrides) => s.gateway.checkUnitMapImport(unit.id, file, replace, overrides),
        submit: (review) => s.plugin.mutate(() => s.gateway.importUnitMap(review)),
      },
    );
    modal.open();
    const root = modal.contentEl;
    const findInput = (prefix) => {
      const box = root.find('los-map-import-field').find((d) =>
        findByTag(d, 'label').some((l) => l.text.startsWith(prefix)),
      );
      return box ? findByTag(box, 'input')[0] : null;
    };
    const fileInput = findInput('Reviewed map file');
    const reorderInput = findInput('Reason for reordering');
    const resetInput = findInput('Reason to reset preserved');
    const retireFieldDiv = root.find('los-map-import-field').find((d) =>
      findByTag(d, 'label').some((l) => l.text.startsWith('Stages to retire')),
    );
    const retireReasonInput = findByTag(retireFieldDiv, 'input').at(-1);
    const checkBtn = root.findText('los-btn', 'Check');
    const replaceBtn = root.findText('los-btn', 'Replace map');
    assert.equal(replaceBtn.disabled, true);

    fileInput.value = draftFile;
    fileInput.fire('input');
    const statusEl = root.find('los-draft-status')[0];
    clickButtonAsync(checkBtn);
    await waitUntil(() => !checkBtn.disabled && statusEl.text !== 'Checking — nothing is written…', 'step-1 check');
    // Step 1 preview discovered required overrides -> Replace stays disabled!
    assert.equal(replaceBtn.disabled, true);
    if (repo) {
      assert.equal(receiptCount(repo), basePreviewReceipts, 'step-1 check must write zero receipts');
      assert.equal(fs.readFileSync(mapPath, 'utf8'), mapBefore, 'step-1 check must leave map untouched');
    }
    const retireList = root.find('los-map-import-retire-list')[0];
    const retireBox = retireList ? findByTag(retireList, 'input')[0] : null;
    const statusBeforeOverrides = statusEl ? statusEl.text : '';
    assert.ok(retireBox && retireBox.value === 'stage-retired',
      `missing stage-retired checkbox; status=${statusBeforeOverrides}`);
    assert.equal(retireBox.checked, false, 'retired stage checkbox starts unchecked');
    assert.ok(statusBeforeOverrides.length > 0);

    // Fill all required decisions simultaneously: reorder + reset + retire_stage + retire_reason.
    reorderInput.value = 'Teach intuition before formal derivation.';
    reorderInput.fire('input');
    resetInput.value = 'Clear stale open detour referencing retired stage.';
    resetInput.fire('input');
    retireBox.checked = true;
    retireBox.fire('change');
    retireReasonInput.value = 'Consolidated stage-retired into surviving stages.';
    retireReasonInput.fire('input');

    // Step 2: Re-check passes preview AND --check preflight -> Replace enables!
    clickButtonAsync(checkBtn);
    await waitUntil(() => !checkBtn.disabled && statusEl.text !== 'Checking — nothing is written…', 'step-2 check');
    assert.equal(replaceBtn.disabled, false, `step-2 failed: ${statusEl.text}`);
    const previewReceiptDelta = repo ? receiptCount(repo) - basePreviewReceipts : 0;
    if (repo) {
      assert.equal(previewReceiptDelta, 0, 'step-2 check must write zero receipts before apply');
      assert.equal(fs.readFileSync(mapPath, 'utf8'), mapBefore, 'step-2 check must leave map untouched');
    }

    // Submit (plus optional rapid second click test).
    let closed = false;
    const origClose = modal.close.bind(modal);
    modal.close = () => { closed = true; origClose(); };
    clickButtonAsync(replaceBtn);
    assert.equal(replaceBtn.disabled, true, 'Submit disables immediately while importing');
    if (doubleClick) {
      clickButtonAsync(replaceBtn);
    }
    await waitUntil(() => closed, 'modal submit close');
    stub.Modal.last = modal;
    return { statusBeforeOverrides, previewReceiptDelta };
  }

  // 1. Valid request commits canonically on disk (simultaneous reorder + state reset + stage retire via modal).
  {
    const repo = repos.valid;
    const baseIds = new Set(receiptIds(repo));
    const baseReceipts = baseIds.size;
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    const modalMeta = await driveModalTwoStep(s, path.join(repo, draftRel), { repo });
    assert.equal(s.envelopes.length, 1);
    const env = s.envelopes[0];
    assert.equal(env.capability, 'unit.map.import');
    assert.equal(env.payload.intentional_reorder, 'Teach intuition before formal derivation.');
    assert.equal(env.payload.intentional_state_reset, 'Clear stale open detour referencing retired stage.');
    assert.deepEqual(env.payload.retire_stage, ['stage-retired']);
    assert.equal(env.payload.retire_reason, 'Consolidated stage-retired into surviving stages.');
    const newIds = receiptIds(repo).filter((id) => !baseIds.has(id));
    assert.equal(newIds.length, 1);
    out.valid = {
      statusBeforeOverrides: modalMeta.statusBeforeOverrides,
      previewReceiptDelta: modalMeta.previewReceiptDelta,
      transactionId: newIds[0],
      receiptDelta: receiptCount(repo) - baseReceipts,
    };
  }

  // 2. Invalid request refuses with zero canonical disk mutation.
  {
    const repo = repos.invalid;
    const baseReceipts = receiptCount(repo);
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    const draftFile = path.join(repo, draftRel);
    const mapPath = path.join(repo, 'curriculum/modules/module-demo/units/unit-demo-l01/study-map.yaml');
    const mapBefore = fs.readFileSync(mapPath, 'utf8');
    // Preview reports can_apply === false when overrides missing, and --check refuses.
    const preview = await s.gateway.previewUnitMapImport('unit-demo-l01', draftFile, true);
    assert.equal(receiptCount(repo), baseReceipts, 'previewUnitMapImport must write zero receipts');
    assert.equal(fs.readFileSync(mapPath, 'utf8'), mapBefore, 'previewUnitMapImport must leave map untouched');
    assert.equal(preview.can_apply, false);
    assert.equal(preview.required_decisions.reorder_required, true);
    assert.equal(preview.required_decisions.state_reset_required, true);
    assert.deepEqual(preview.required_decisions.missing_retire_stages, ['stage-retired']);
    assert.equal(preview.required_decisions.retire_reason_required, true);
    await assert.rejects(
      () => s.gateway.checkUnitMapImport('unit-demo-l01', draftFile, true, {
        intentionalReorder: 'Only reorder provided; missing retire/reset',
      }),
      /preflight failed/i,
    );
    assert.equal(receiptCount(repo), baseReceipts);
    out.invalid = { refused: true, receiptDelta: receiptCount(repo) - baseReceipts };
  }

  // 3. Artifact change after preview refuses stale approval.
  {
    const repo = repos.stalePreview;
    const baseReceipts = receiptCount(repo);
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    const draftFile = path.join(repo, draftRel);
    const overrides = {
      intentionalReorder: 'Teach intuition before formal derivation.',
      intentionalStateReset: 'Clear stale detour.',
      retireStages: ['stage-retired'],
      retireReason: 'Consolidated.',
    };
    const review = await s.gateway.checkUnitMapImport('unit-demo-l01', draftFile, true, overrides);
    // Prepare exact sealed envelope bound to review.fileSha256, then mutate draft file on disk!
    const envJson = await s.gateway.prepareCapability(
      'unit.map.import',
      {
        unit_id: review.unitId,
        file: review.file,
        file_sha256: review.fileSha256,
        replace: true,
        intentional_reorder: overrides.intentionalReorder,
        intentional_state_reset: overrides.intentionalStateReset,
        retire_stage: overrides.retireStages,
        retire_reason: overrides.retireReason,
      },
      review.expectedSnapshot,
      review.expectedRevisions,
    );
    fs.appendFileSync(draftFile, '\n# modified after check\n', 'utf8');
    // Both client-side importUnitMap and Core-side dispatch refuse stale digest.
    await assert.rejects(() => s.gateway.importUnitMap(review), /changed after review/i);
    const coreRes = spawnCore(repo, ['ui-capability', 'unit.map.import', '--payload-file', '-'], envJson);
    assert.notEqual(coreRes.error, null);
    assert.equal(receiptCount(repo), baseReceipts);
    out.stalePreview = { refused: true, receiptDelta: receiptCount(repo) - baseReceipts };
  }

  // 4. Concurrent canonical modification preserves newer canonical state.
  {
    const repo = repos.concurrent;
    const baseReceipts = receiptCount(repo);
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    const draftFile = path.join(repo, draftRel);
    const overrides = {
      intentionalReorder: 'Teach intuition before formal derivation.',
      intentionalStateReset: 'Clear stale detour.',
      retireStages: ['stage-retired'],
      retireReason: 'Consolidated.',
    };
    const review = await s.gateway.checkUnitMapImport('unit-demo-l01', draftFile, true, overrides);
    await sendExternalV2(
      repo,
      'stage.progress.update',
      { unit_id: 'unit-demo-l01', stage_id: 'stage-demo', status: 'complete' },
      review.expectedSnapshot,
      {
        'unit-demo-l01': Number(s.store.artifactRevision('unit-demo-l01') ?? 0),
        'study-map-demo-l01': Number(s.store.artifactRevision('study-map-demo-l01') ?? 0),
      },
    );
    await assert.rejects(
      () => s.gateway.importUnitMap(review),
      (err) => err && ['STALE_SNAPSHOT', 'REVISION_CONFLICT'].includes(err.gatewayCode),
    );
    assert.equal(receiptCount(repo), baseReceipts + 1);
    out.concurrent = { refused: true, receiptDelta: receiptCount(repo) - baseReceipts };
  }

  // 5. Duplicate / rapid repeated submissions do not duplicate writes or receipts.
  {
    const repo = repos.duplicate;
    const baseIds = new Set(receiptIds(repo));
    const baseReceipts = baseIds.size;
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    const draftFile = path.join(repo, draftRel);
    await driveModalTwoStep(s, draftFile, { doubleClick: true, repo });
    assert.equal(s.envelopes.length, 1, 'modal button disable must prevent duplicate send');
    const envJson = JSON.stringify(s.envelopes[0]);
    const replay = spawnCore(repo, ['ui-capability', 'unit.map.import', '--payload-file', '-'], envJson);
    assert.equal(replay.error, null, replay.stderr);
    assert.equal(JSON.parse(replay.stdout).replayed, true);
    const newIds = receiptIds(repo).filter((id) => !baseIds.has(id));
    assert.equal(newIds.length, 1);
    out.duplicate = { transactionId: newIds[0], receiptDelta: receiptCount(repo) - baseReceipts, envelopes: s.envelopes.length };
  }

  // 6. Lost response after commit recovers committed outcome via recovery.
  {
    const repo = repos.recovery;
    const baseIds = new Set(receiptIds(repo));
    const baseReceipts = baseIds.size;
    const settings = path.join(repo, '.ui-settings.json');
    const draftFile = path.join(repo, draftRel);
    let attempt = 0;
    const s1 = await createSession(repo, settings, {
      wrapRunLos: (args, stdin, real) => {
        if (args[0] === 'ui-capability') {
          attempt += 1;
          if (attempt === 1) {
            const res = real(args, stdin);
            assert.equal(res.error, null, res.stderr);
            return {
              error: Object.assign(new Error('EIO lost map response'), { code: 5 }),
              stdout: '',
              stderr: 'connection lost after commit',
            };
          }
          return {
            error: Object.assign(new Error('EIO retry lost'), { code: 5 }),
            stdout: '',
            stderr: 'connection lost on auto-replay',
          };
        }
        return real(args, stdin);
      },
    });
    const overrides = {
      intentionalReorder: 'Teach intuition before formal derivation.',
      intentionalStateReset: 'Clear stale detour.',
      retireStages: ['stage-retired'],
      retireReason: 'Consolidated.',
    };
    const review = await s1.gateway.checkUnitMapImport('unit-demo-l01', draftFile, true, overrides);
    await assert.rejects(
      () => s1.gateway.importUnitMap(review),
      (err) => err && err.gatewayCode === 'RECOVERY_BLOCKED',
    );
    const s2 = await createSession(repo, settings);
    assert.equal(s2.recovery.unresolved, true);
    const confirmation = await s2.gateway.settle(await s2.gateway.recoverPreparedEnvelope());
    assert.equal(confirmation.replayed, true);
    await s2.plugin.reloadAndSettle(confirmation);
    assert.equal(s2.recovery.unresolved, false);
    assert.deepEqual(receiptIds(repo).filter((id) => !baseIds.has(id)), [confirmation.transaction_id]);
    out.recovery = { transactionId: confirmation.transaction_id, receiptDelta: receiptCount(repo) - baseReceipts };
  }

  // 7. Application reload displays exact persisted state read back from canonical state.
  {
    const repo = repos.reload;
    const baseIds = new Set(receiptIds(repo));
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    await driveModalTwoStep(s, path.join(repo, draftRel));
    const newIds = receiptIds(repo).filter((id) => !baseIds.has(id));
    assert.equal(newIds.length, 1);
    const reloaded = await loadManifestStore(repo);
    const map = reloaded.mapForUnit('unit-demo-l01');
    assert.deepEqual(map.stages.map((st) => st.id), ['stage-demo-pending', 'stage-demo']);
    assert.deepEqual(map.detours ?? [], []);
    out.reload = { transactionId: newIds[0], stages: map.stages.map((st) => st.id) };
  }

  return out;
}

/* ================================================================ #3 */
async function runDeliveryApplyScenarios(repos, deliveryId) {
  const out = {};

  // 1. Valid request commits canonically on disk via preview -> approved-delivery Gateway V2.
  {
    const repo = repos.valid;
    const baseIds = new Set(receiptIds(repo));
    const baseReceipts = baseIds.size;
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    const noteFile = path.join(repo, 'knowledge/garden/transcriptions/garden-note-seed.md');
    const reqFile = path.join(repo, 'operations/ai-actions/requests/ai-request-scenario-shelve/request.yaml');
    const reqBefore = fs.readFileSync(reqFile, 'utf8');
    await s.gateway.previewDelivery(deliveryId);
    const previewReceiptDelta = receiptCount(repo) - baseReceipts;
    assert.equal(previewReceiptDelta, 0, 'previewDelivery must write zero receipts');
    assert.equal(fs.existsSync(noteFile), false, 'previewDelivery must not create transcription note');
    assert.equal(fs.readFileSync(reqFile, 'utf8'), reqBefore, 'previewDelivery must leave request untouched');
    const res = await s.aiActions.applyApprovedDelivery(deliveryId);
    assert.equal(res.ok, true);
    assert.equal(s.envelopes.length, 1);
    assert.equal(s.envelopes[0].capability, 'ai-action.delivery.apply');
    assert.equal(s.envelopes[0].approval.kind, 'approved-delivery');
    assert.deepEqual(receiptIds(repo).filter((id) => !baseIds.has(id)), [res.transaction_id]);
    out.valid = { previewReceiptDelta, transactionId: res.transaction_id, receiptDelta: receiptCount(repo) - baseReceipts };
  }

  // 2. Invalid request refuses with zero canonical disk mutation.
  {
    const repo = repos.invalid;
    const baseReceipts = receiptCount(repo);
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    await assert.rejects(
      () => s.aiActions.applyApprovedDelivery('ai-delivery-nonexistent'),
      /AI delivery not found/i,
    );
    await assert.rejects(
      async () => s.gateway.capability('ai-action.delivery.apply', {
        delivery_id: deliveryId,
        delivery_sha256: `sha256:${'a'.repeat(64)}`,
        artifact_sha256: {},
      }),
      (err) => err && err.gatewayCode === 'UNCONFIRMED',
    );
    assert.equal(s.recovery.unresolved, false);
    assert.equal(receiptCount(repo), baseReceipts);
    out.invalid = { refused: true, receiptDelta: receiptCount(repo) - baseReceipts };
  }

  // 3. Artifact change after preview refuses stale approval.
  {
    const repo = repos.stalePreview;
    const baseReceipts = receiptCount(repo);
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    const preview = await s.gateway.previewDelivery(deliveryId);
    assert.equal(receiptCount(repo), baseReceipts, 'previewDelivery must leave receipts unchanged before apply');
    const artifactFile = path.join(
      repo, 'operations', 'ai-actions', 'deliveries', deliveryId, 'artifacts', 'transcription.md',
    );
    fs.writeFileSync(artifactFile, '# Tampered transcription after preview\n', 'utf8');
    await assert.rejects(
      () => s.gateway.applyApprovedDelivery(deliveryId, preview),
      (err) => err && ['UNCONFIRMED', 'INVALID_REQUEST'].includes(err.gatewayCode),
    );
    assert.equal(receiptCount(repo), baseReceipts);
    out.stalePreview = { refused: true, receiptDelta: receiptCount(repo) - baseReceipts };
  }

  // 4. Concurrent canonical modification preserves newer canonical state.
  {
    const repo = repos.concurrent;
    const baseReceipts = receiptCount(repo);
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    const preview = await s.gateway.previewDelivery(deliveryId);
    assert.equal(receiptCount(repo), baseReceipts, 'previewDelivery must leave receipts unchanged before apply');
    await sendExternalV2(
      repo,
      'capture.create',
      { text: 'Concurrent note wins', title: 'Concurrent Winner' },
      preview.expected_snapshot,
      {},
    );
    await assert.rejects(
      () => s.gateway.applyApprovedDelivery(deliveryId, preview),
      (err) => err && ['STALE_SNAPSHOT', 'REVISION_CONFLICT'].includes(err.gatewayCode),
    );
    assert.equal(receiptCount(repo), baseReceipts + 1);
    out.concurrent = { refused: true, receiptDelta: receiptCount(repo) - baseReceipts };
  }

  // 5. Duplicate / rapid repeated submissions do not duplicate writes or receipts.
  {
    const repo = repos.duplicate;
    const baseIds = new Set(receiptIds(repo));
    const baseReceipts = baseIds.size;
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    const view = new GardenView({ _viewType: 'learningos-garden', app: { workspace: {} } }, s.plugin);
    view.render();
    const applyBtn = view.contentEl.findText('los-btn', 'Apply approved delivery');
    assert.ok(applyBtn, 'GardenView must render Apply approved delivery button');
    clickButtonAsync(applyBtn);
    assert.equal(applyBtn.disabled, true, 'GardenView disables button immediately on click');
    clickButtonAsync(applyBtn);
    await waitUntil(() => !s.gateway.isBusy && s.store.aiRequestsForTarget('garden-note-seed').some((r) => r.status === 'completed'), 'garden delivery apply');
    assert.equal(s.envelopes.length, 1, 'rapid double click must only submit once');
    const replay = spawnCore(
      repo,
      ['ui-capability', 'ai-action.delivery.apply', '--payload-file', '-'],
      JSON.stringify(s.envelopes[0]),
    );
    assert.equal(replay.error, null, replay.stderr);
    assert.equal(JSON.parse(replay.stdout).replayed, true);
    const newIds = receiptIds(repo).filter((id) => !baseIds.has(id));
    assert.equal(newIds.length, 1);
    out.duplicate = { transactionId: newIds[0], receiptDelta: receiptCount(repo) - baseReceipts, envelopes: s.envelopes.length };
  }

  // 6. Lost response after commit recovers committed outcome via recovery.
  {
    const repo = repos.recovery;
    const baseIds = new Set(receiptIds(repo));
    const baseReceipts = baseIds.size;
    const settings = path.join(repo, '.ui-settings.json');
    let attempt = 0;
    const s1 = await createSession(repo, settings, {
      wrapRunLos: (args, stdin, real) => {
        if (args[0] === 'ui-capability') {
          attempt += 1;
          if (attempt === 1) {
            const committed = real(args, stdin);
            assert.equal(committed.error, null, committed.stderr);
            return {
              error: Object.assign(new Error('EIO lost ai delivery response'), { code: 5 }),
              stdout: '',
              stderr: 'connection lost after delivery apply commit',
            };
          }
          return {
            error: Object.assign(new Error('EIO retry lost'), { code: 5 }),
            stdout: '',
            stderr: 'connection lost during auto-replay',
          };
        }
        return real(args, stdin);
      },
    });
    await assert.rejects(
      () => s1.aiActions.applyApprovedDelivery(deliveryId),
      (err) => err && err.gatewayCode === 'RECOVERY_BLOCKED',
    );
    assert.equal(s1.recovery.unresolved, true);
    const s2 = await createSession(repo, settings);
    assert.equal(s2.recovery.unresolved, true);
    const confirmation = await s2.gateway.settle(await s2.gateway.recoverPreparedEnvelope());
    assert.equal(confirmation.replayed, true);
    await s2.plugin.reloadAndSettle(confirmation);
    assert.equal(s2.recovery.unresolved, false);
    assert.deepEqual(receiptIds(repo).filter((id) => !baseIds.has(id)), [confirmation.transaction_id]);
    out.recovery = { transactionId: confirmation.transaction_id, receiptDelta: receiptCount(repo) - baseReceipts };
  }

  // 7. Application reload displays exact persisted state read back from canonical state.
  {
    const repo = repos.reload;
    const baseIds = new Set(receiptIds(repo));
    const settings = path.join(repo, '.ui-settings.json');
    const s = await createSession(repo, settings);
    const res = await s.aiActions.applyApprovedDelivery(deliveryId);
    assert.deepEqual(receiptIds(repo).filter((id) => !baseIds.has(id)), [res.transaction_id]);
    const reloaded = await loadManifestStore(repo);
    const requests = reloaded.aiRequestsForTarget('garden-note-seed');
    const completed = requests.find((r) => r.delivery_id === deliveryId);
    assert.equal(completed?.status, 'completed');
    assert.equal(completed?.receipt_id, res.transaction_id);
    const note = reloaded.gardenEntries().find((entry) => entry.id === 'garden-note-seed');
    assert.ok(String(note?.transcription_path || '').includes('garden-note-seed.md'));
    const reloadedSession = await createSession(repo, settings);
    const gardenView = new GardenView(
      { _viewType: 'learningos-garden', app: { workspace: {} } },
      reloadedSession.plugin,
    );
    await gardenView.onOpen();
    assert.equal(gardenView.contentEl.findText('los-btn', 'Apply approved delivery'), null);
    assert.ok(gardenView.contentEl.allText().includes('AI request · completed'));
    out.reload = { transactionId: res.transaction_id, requestStatus: completed.status, transcriptionPath: note.transcription_path };
  }

  return out;
}

(async () => {
  const results = {
    sourceSelection: await runSourceSelectionScenarios(plan.sourceSelection),
    unitMapImport: await runMapImportScenarios(plan.unitMapImport),
    deliveryApply: await runDeliveryApplyScenarios(plan.deliveryApply, plan.deliveryId),
  };
  await flush();
  process.stdout.write(`LIVE_WRITES_RESULT ${JSON.stringify(results)}\n`);
})().catch((error) => {
  process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
  process.exit(1);
});
