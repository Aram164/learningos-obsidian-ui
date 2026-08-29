/*
 * Gateway recovery, through the whole plugin and its real persisted settings.
 *
 * The module-level tests exercise the client with an in-memory record. These
 * exercise the thing that actually has to work: a record written to
 * `data.json`, an Obsidian restart, and a plugin that has to decide what the
 * previous session left behind — without ever sending a second write for one
 * gesture.
 *
 * Every fixture record here is *derived* from a real prepared write rather
 * than hand-written. A hand-written envelope would carry an approval hash
 * nobody computed, so the validation these tests are meant to prove would be
 * testing a string the production path never produces.
 */
'use strict';

const {
  Notice,
  VIEW,
  FIXTURE,
  LearningOSUI,
  makeApp,
  check,
  heading,
  build,
  tick,
  waitFor,
  gatewayConfirmation,
  gatewayRefusal,
} = require('./support');

const clone = (value) => JSON.parse(JSON.stringify(value));

/** Run one real capture and keep the record exactly as it was before sending. */
async function preparedFixture() {
  const { plugin } = await build();
  let prepared = null;
  let envelopeJson = null;
  const original = plugin.runLos;
  plugin.runLos = (args, callback, stdin) => {
    if (stdin && !prepared) {
      prepared = clone(plugin.settings.gatewayRecovery);
      envelopeJson = stdin;
    }
    original(args, callback, stdin);
  };
  await plugin.mutate(
    () => plugin.gateway.captureText('a thought worth recovering', 'Recovered'),
  );
  plugin.onunload();
  return { prepared, envelopeJson };
}

module.exports = async function run() {
  heading('gateway recovery across a restart');

  const { prepared, envelopeJson } = await preparedFixture();

  {
    const { plugin } = await build();
    const savesBeforeSend = [];
    const saved = [];
    plugin.saveData = async (data) => { saved.push(clone(data)); };
    const original = plugin.runLos;
    plugin.runLos = (args, callback, stdin) => {
      if (stdin) savesBeforeSend.push(saved.length);
      original(args, callback, stdin);
    };
    await plugin.mutate(() => plugin.gateway.captureText('durable before it is sent'));
    check('the record reaches disk before the process is started',
      savesBeforeSend.length > 0
      && savesBeforeSend[0] > 0
      && saved[savesBeforeSend[0] - 1].gatewayRecovery
      && saved[savesBeforeSend[0] - 1].gatewayRecovery.phase === 'prepared');
    check('a settled write leaves nothing behind on disk',
      saved[saved.length - 1].gatewayRecovery === null);
    plugin.onunload();
  }

  {
    /* The restart. The previous session persisted a prepared request and then
     * died; this one must send that exact string and nothing else. */
    const sent = [];
    Notice.log.length = 0;
    const { plugin } = await build({
      settings: { gatewayRecovery: clone(prepared) },
      spy: (_args, stdin) => { if (stdin) sent.push(stdin); },
    });
    await waitFor(() => !plugin.gateway.isBusy
      && plugin.settings.gatewayRecovery === null);
    check('a prepared record is replayed after a restart, byte for byte',
      sent.length === 1 && sent[0] === envelopeJson,
      `sent ${sent.length} envelope(s)`);
    check('the restarted replay settles and retires the record',
      plugin.settings.gatewayRecovery === null);
    check('the learner is told a replay happened rather than it being silent',
      Notice.log.some((line) => /Replaying the same approved request/.test(line)));
    plugin.onunload();
  }

  {
    /* Core already committed and answered; only this vault's view is behind.
     * The persisted JSON is not trusted by itself: Core receives the exact
     * envelope in replay-only mode, which can inspect the receipt but cannot
     * run the capability handler. */
    const envelope = JSON.parse(envelopeJson);
    const confirmed = {
      ...clone(prepared),
      phase: 'confirmed',
      confirmation: gatewayConfirmation(envelope),
    };
    const sent = [];
    const { plugin } = await build({
      settings: { gatewayRecovery: confirmed },
      spy: (args, stdin) => { if (stdin) sent.push({ args, stdin }); },
    });
    await waitFor(() => !plugin.gateway.isBusy
      && plugin.settings.gatewayRecovery === null);
    check('a confirmed record is reconciled only after a read-only Core proof',
      plugin.settings.gatewayRecovery === null
      && sent.length === 1
      && sent[0].stdin === envelopeJson
      && sent[0].args.includes('--replay-only'));
    plugin.onunload();
  }

  {
    /* A complete success-shaped object in data.json is still not a receipt.
     * If Core has no ledger entry, the stored draft and evidence must survive. */
    const envelope = JSON.parse(envelopeJson);
    const confirmed = {
      ...clone(prepared),
      phase: 'confirmed',
      confirmation: gatewayConfirmation(envelope),
    };
    confirmed.confirmation.receipt_path = 'operations/transactions/nonexistent.yaml';
    const seed = await build();
    const uiDrafts = clone(seed.plugin.settings.uiDrafts);
    seed.plugin.onunload();
    uiDrafts.inbox = { title: 'Recovered', text: 'a thought worth recovering' };
    const sent = [];
    const { plugin } = await build({
      settings: { gatewayRecovery: confirmed, uiDrafts },
      spy: (args, stdin) => { if (stdin) sent.push({ args, stdin }); },
      runLosOverride: (args, callback, stdin) => {
        const request = JSON.parse(stdin);
        const refusal = gatewayRefusal(
          request,
          'UNCONFIRMED',
          'no committed receipt exists for this exact request',
        );
        callback(Object.assign(new Error('los exited 2'), { code: 2 }), JSON.stringify(refusal), '');
      },
    });
    check('persisted confirmation alone never clears recovery evidence',
      sent.length === 1
      && sent[0].args.includes('--replay-only')
      && plugin.settings.gatewayRecovery.phase === 'blocked');
    check('an unverified persisted confirmation never clears its draft',
      plugin.settings.uiDrafts.inbox.text === 'a thought worth recovering');
    plugin.onunload();
  }

  {
    /* `recovering` is persisted before an automatic replay begins. A crash in
     * that replay must not buy another automatic attempt on every launch. */
    const recovering = {
      ...clone(prepared),
      phase: 'recovering',
      last_error: { code: 'UNREADABLE_RESPONSE', message: 'the first answer was lost' },
    };
    const sent = [];
    const { plugin } = await build({
      settings: { gatewayRecovery: recovering },
      spy: (_args, stdin) => { if (stdin) sent.push(stdin); },
    });
    check('a replay interrupted in the prior session waits for an explicit retry',
      sent.length === 0
      && plugin.recoveryBlocked === true
      && plugin.settings.gatewayRecovery.phase === 'recovering');
    plugin.onunload();
  }

  {
    /* A confirmed receipt whose projection cannot be loaded must leave the app
     * alive: Diagnostics is the only safe place from which to finish it. */
    const envelope = JSON.parse(envelopeJson);
    const confirmed = {
      ...clone(prepared),
      phase: 'confirmed',
      confirmation: gatewayConfirmation(envelope),
    };
    const sent = [];
    let started = null;
    try {
      started = await build({
        settings: { gatewayRecovery: confirmed },
        patchManifest: (manifest) => { delete manifest._generated; },
        spy: (_args, stdin) => { if (stdin) sent.push(stdin); },
      });
    } catch (_) { /* asserted below */ }
    check('a failed confirmed-write reconciliation does not reject plugin startup',
      started !== null);
    check('the confirmed record remains blocked after receipt verification',
      started !== null
      && started.plugin.recoveryBlocked === true
      && started.plugin.settings.gatewayRecovery.phase === 'blocked'
      && sent.length === 1);
    started?.plugin.onunload();
  }

  {
    /* One automatic attempt has already failed. Trying again on every launch
     * would turn one ambiguity into an unbounded loop against canonical data. */
    const blocked = {
      ...clone(prepared),
      phase: 'blocked',
      last_error: { code: 'INTERNAL_FAILURE', message: 'the pipe closed mid-write' },
    };
    const sent = [];
    const { plugin, calls } = await build({
      settings: { gatewayRecovery: blocked },
      spy: (_args, stdin) => { if (stdin) sent.push(stdin); },
    });
    check('a blocked record does not replay itself on the next launch',
      sent.length === 0 && plugin.settings.gatewayRecovery.phase === 'blocked');
    check('the blocked record keeps its evidence for Diagnostics',
      plugin.settings.gatewayRecovery.envelope_json === blocked.envelope_json
      && plugin.settings.gatewayRecovery.last_error.code === 'INTERNAL_FAILURE');
    check('nothing new may be written while it is unresolved',
      plugin.gateway.recovery.unresolved === true);
    let aiError = null;
    await plugin.aiActions.prepareGardenShelving('garden-fixture-seed')
      .catch((error) => { aiError = error; });
    let sessionError = null;
    try { plugin.gateway.endSession('must not run'); }
    catch (error) { sessionError = error; }
    check('non-capability mutation paths are blocked before Core starts',
      aiError?.gatewayCode === 'RECOVERY_REQUIRED'
      && sessionError?.gatewayCode === 'RECOVERY_REQUIRED'
      && calls.length === 0);
    plugin.onunload();
  }

  {
    /* An unreadable record is evidence that *something* happened. Normalising
     * it to null would erase the only trace of a possibly-committed write. */
    const malformed = { schema_version: 1, phase: 'finished' };
    const sent = [];
    const { plugin } = await build({
      settings: { gatewayRecovery: malformed },
      spy: (_args, stdin) => { if (stdin) sent.push(stdin); },
    });
    check('a malformed record starts no process',
      sent.length === 0);
    check('the raw malformed value is kept exactly as it was written',
      JSON.stringify(plugin.settings.gatewayRecovery) === JSON.stringify(malformed));
    check('the application knows it is blocked',
      plugin.recoveryBlocked === true
      && plugin.gatewayRecoveryState().kind === 'malformed');
    plugin.onunload();
  }

  heading('gateway recovery in Diagnostics');

  {
    const { app, plugin } = await build();
    await app.workspace._ready();
    await plugin.nav.openDiagnostics();
    const view = app.workspace.getLeavesOfType(VIEW.diagnostics)[0].view;
    check('a clean gateway says so in one sentence',
      view.contentEl.allText().includes('No unresolved Gateway write.'));
    plugin.onunload();
  }

  {
    const blocked = {
      ...clone(prepared),
      phase: 'blocked',
      last_error: { code: 'INTERNAL_FAILURE', message: 'the pipe closed mid-write' },
    };
    const { app, plugin } = await build({ settings: { gatewayRecovery: blocked } });
    await app.workspace._ready();
    await plugin.nav.openDiagnostics();
    const view = app.workspace.getLeavesOfType(VIEW.diagnostics)[0].view;
    const text = view.contentEl.allText();
    check('Diagnostics names the capability, phase and identity of the stuck write',
      text.includes('Gateway recovery')
      && text.includes('capture.create')
      && text.includes('blocked')
      && text.includes(JSON.parse(blocked.envelope_json).idempotency_key));
    check('Diagnostics never shows the payload the learner wrote',
      !text.includes('a thought worth recovering'));
    check('Diagnostics offers a retry and a summary, and no way to discard',
      Boolean(view.contentEl.findText('los-btn', 'Retry exact request'))
      && Boolean(view.contentEl.findText('los-btn', 'Copy recovery summary'))
      && !text.includes('Discard') && !text.includes('Start over'));

    view.contentEl.findText('los-btn', 'Retry exact request').fire('click');
    await waitFor(() => plugin.settings.gatewayRecovery === null && !plugin.gateway.isBusy);
    check('the explicit retry settles the same request rather than creating one',
      plugin.settings.gatewayRecovery === null);
    plugin.onunload();
  }

  heading('one serialized writer for data.json');

  {
    /*
     * Drafts, navigation and the recovery record share one settings file, and
     * each used to call `saveData` on its own. Two in flight together is a lost
     * update: whichever `await` resolved last wrote the object it had captured.
     * For a debounced draft that is an annoyance; for the record that says a
     * write may be in flight, it is the difference between recovering and
     * duplicating.
     */
    const { plugin } = await build();
    const started = [];
    const written = [];
    const releases = [];
    plugin.saveData = (data) => {
      started.push(data.uiDrafts.inbox.text);
      return new Promise((resolve) => {
        releases.push(() => {
          // Whatever the settings hold *now* is what a real save would write.
          written.push(plugin.settings.uiDrafts.inbox.text);
          resolve();
        });
      });
    };

    // Set directly rather than through the debounced draft path: this is a
    // test of the writer, not of when the writer is triggered.
    plugin.settings.uiDrafts.inbox = { title: '', text: 'first' };
    const slow = plugin.persistSettings();
    plugin.settings.uiDrafts.inbox = { title: '', text: 'second' };
    const fast = plugin.persistSettings();
    await tick();
    check('a second save waits for the first rather than racing it',
      releases.length === 1, `${releases.length} saves started`);

    releases[0]();
    await slow;
    await tick();
    check('the queued save starts only after its predecessor settles',
      releases.length === 2);
    releases[1]();
    await fast;
    check('each save serialized the newest state, never a captured snapshot',
      written.join('|') === 'second|second',
      `wrote ${written.join('|')}`);

    // A failed save must reject its own caller and leave the queue usable.
    plugin.saveData = async () => { throw new Error('disk full'); };
    let rejected = null;
    await plugin.persistSettings().catch((error) => { rejected = error; });
    plugin.saveData = async () => undefined;
    let recovered = true;
    await plugin.persistSettings().catch(() => { recovered = false; });
    check('a failed save rejects its caller without poisoning later ones',
      rejected !== null && recovered === true);
    plugin.onunload();
  }

  {
    /* Disable/re-enable can overlap one old child callback with a new plugin
     * instance.  The old instance may let Core finish, but it must neither
     * start queued work nor save stale settings after yielding ownership. */
    let disk = {};
    const appA = makeApp(FIXTURE);
    const oldPlugin = new LearningOSUI(appA, { id: 'learningos-ui', version: 'test' });
    appA._plugin = oldPlugin;
    oldPlugin.loadData = async () => clone(disk);
    oldPlugin.saveData = async (data) => { disk = clone(data); };
    await oldPlugin.onload();

    let oldCallback = null;
    let oldEnvelope = null;
    let oldStarts = 0;
    oldPlugin.runLos = (_args, callback, stdin) => {
      oldStarts += 1;
      oldEnvelope = JSON.parse(stdin);
      oldCallback = callback;
    };
    oldPlugin.setInboxDraft('', 'the old in-flight thought');
    const inFlight = oldPlugin.mutate(
      () => oldPlugin.gateway.captureText('the old in-flight thought'),
    );
    await waitFor(() => oldCallback !== null);
    const queued = oldPlugin.mutate(
      () => oldPlugin.gateway.captureText('must never start after unload'),
    );
    oldPlugin.onunload();

    const appB = makeApp(FIXTURE);
    const newPlugin = new LearningOSUI(appB, { id: 'learningos-ui', version: 'test' });
    appB._plugin = newPlugin;
    newPlugin.loadData = async () => clone(disk);
    newPlugin.saveData = async (data) => { disk = clone(data); };
    newPlugin.runLos = (_args, callback) => {
      callback(Object.assign(new Error('response unavailable'), { code: null }), '', '');
    };
    await newPlugin.onload();
    newPlugin.setInboxDraft('', 'the newer instance owns this draft');
    await newPlugin.persistSettings();
    const savesOwnedByNewInstance = JSON.stringify(disk);

    oldCallback?.(
      null,
      JSON.stringify(gatewayConfirmation(oldEnvelope)),
      '',
    );
    await Promise.allSettled([inFlight, queued]);
    await tick();

    check('an unloaded instance starts no queued Core work', oldStarts === 1);
    check('a late old callback cannot overwrite the active instance settings',
      JSON.stringify(disk) === savesOwnedByNewInstance
      && disk.uiDrafts.inbox.text === 'the newer instance owns this draft'
      && disk.gatewayRecovery.phase === 'blocked');
    newPlugin.onunload();
  }

  heading('drafts and the record are settled together');

  {
    const { app, plugin } = await build();
    await app.workspace._ready();
    await plugin.nav.openProgram('inbox');
    const view = app.workspace.getLeavesOfType(VIEW.program)[0].view;
    const editor = view.contentEl.find('los-capture-editor')[0];
    editor.value = 'a captured thought';
    editor.fire('input');
    const saves = [];
    plugin.saveData = async (data) => { saves.push(clone(data)); };
    view.contentEl.findText('los-btn', 'Capture text').fire('click');
    await waitFor(() => plugin.settings.gatewayRecovery === null && !plugin.gateway.isBusy);
    const settling = saves.filter(
      (state) => state.gatewayRecovery === null && state.uiDrafts.inbox.text === '',
    );
    check('the matching draft and the record are cleared in one saved state',
      settling.length > 0
      && !saves.some((state) => state.gatewayRecovery === null
        && state.uiDrafts.inbox.text === 'a captured thought'),
      'a save that forgot the write but kept its draft would offer the text back for a write that landed');
    plugin.onunload();
  }

  {
    const { app, plugin } = await build();
    await app.workspace._ready();
    await plugin.nav.openProgram('inbox');
    const view = app.workspace.getLeavesOfType(VIEW.program)[0].view;
    const editor = view.contentEl.find('los-capture-editor')[0];
    editor.value = 'a captured thought';
    editor.fire('input');
    const original = plugin.runLos;
    plugin.runLos = (args, callback, stdin) => {
      // The learner keeps typing while the write is in flight.
      if (stdin) plugin.setInboxDraft('', 'a captured thought and a second one');
      original(args, callback, stdin);
    };
    view.contentEl.findText('los-btn', 'Capture text').fire('click');
    await waitFor(() => plugin.settings.gatewayRecovery === null && !plugin.gateway.isBusy);
    check('text written while the write ran is newer, and is not cleared',
      plugin.getInboxDraft().text === 'a captured thought and a second one');
    plugin.onunload();
  }

  {
    const { app, plugin } = await build();
    await app.workspace._ready();
    await plugin.nav.openGarden();
    const garden = app.workspace.getLeavesOfType(VIEW.garden)[0].view.contentEl;
    const editor = garden.find('los-garden-seed-editor')[0];
    editor.value = 'a seed that must outlive a restart';
    editor.fire('input');
    const carried = clone(plugin.settings.uiDrafts);
    plugin.onunload();

    const restarted = await build({ settings: { uiDrafts: carried } });
    await restarted.app.workspace._ready();
    await restarted.plugin.nav.openGarden();
    const reopened = restarted.app.workspace
      .getLeavesOfType(VIEW.garden)[0].view.contentEl;
    check('a Garden seed draft survives an Obsidian restart',
      reopened.find('los-garden-seed-editor')[0].value
        === 'a seed that must outlive a restart');
    restarted.plugin.onunload();
  }
};
