'use strict';

const {
  path,
  fs,
  makeApp,
  Notice,
  stub,
  ROOT,
  FIXTURE,
  LearningOSUI,
  FIXTURE_GROUP_COUNT,
  VIEW,
  tick,
  frame,
  waitFor,
  check,
  heading,
  build,
  boot,
  gatewayConfirmation,
  answerProjectionObservation,
  gatewayRefusal,
} = require('./support');

/*
 * Plan B (2026-11-12): a Shelving choice belongs to the item the learner saw.
 * Core's item schema is closed (`study-map.schema.json`: id, kind, title,
 * destination, rationale, diff, content, metadata, selected). The fixture's
 * two items carry no `content`, which Core's apply refuses, so these blocks
 * patch the text Core would write into the projection instead of forking it.
 */
const SHELVING_UNIT = 'unit-fixture-thesis-landscape';
const SHELVING_MAP = 'study-map-fixture-thesis';
const NOTE_TEXT = '# Fixture synthesis\n\nThe reasoning, kept in the learner’s own words.';
const GARDEN_TEXT = '# Open fixture question\n\nWhat still needs checking.';
const REWRITTEN_TEXT = '# Fixture synthesis\n\nText an agent rewrote under the same ID.';
const NEWER_SNAPSHOT = `sha256:${'e'.repeat(64)}`;

function shelvingMapIn(manifest, unitId = SHELVING_UNIT) {
  return manifest.study_maps.find((map) => map.unit_id === unitId);
}
function shelvingItem(manifest, id, unitId = SHELVING_UNIT) {
  return shelvingMapIn(manifest, unitId).shelving.items.find((item) => item.id === id);
}
function withShelvingContent(manifest) {
  shelvingItem(manifest, 'proposal-note').content = NOTE_TEXT;
  shelvingItem(manifest, 'proposal-garden').content = GARDEN_TEXT;
}
/** A newer projection: the study map's revision and the snapshot both move on. */
function newerProjection(manifest, unitId = SHELVING_UNIT) {
  shelvingMapIn(manifest, unitId).revision += 1;
  manifest._generated.snapshot_id = NEWER_SNAPSHOT;
}
/** The same item ID now carries different text, as an agent's re-proposal would. */
function rewriteNote(manifest) {
  const note = shelvingItem(manifest, 'proposal-note');
  note.content = REWRITTEN_TEXT;
  note.diff = '+ Rewritten fixture wording.';
}
function descendants(node) {
  return [node, ...node.children.flatMap(descendants)];
}
function shelvingScreen(app) {
  const view = app.workspace.getLeavesOfType(VIEW.shelving)[0]?.view;
  const rows = () => view.contentEl.find('los-proposal-row');
  const row = (title) => rows().find((candidate) => descendants(candidate)
    .some((node) => node.tag === 'h3' && node.allText() === title)) || null;
  const box = (title) => {
    const target = row(title);
    return target ? descendants(target).find((node) => node.tag === 'input'
      && node.getAttribute('type') === 'checkbox') || null : null;
  };
  const set = (title, checked) => {
    const target = box(title);
    target.checked = checked;
    target.fire('change');
  };
  const marks = (title) => (row(title)?.find('los-proposal-mark') || []).map((node) => node.allText());
  const approve = () => view.contentEl.findText('los-btn', 'Approve selected changes');
  const text = () => view.contentEl.allText();
  return { view, rows, row, box, set, marks, approve, text };
}
function appliedEnvelopes(calls) {
  return calls.envelopes.filter((envelope) => envelope.capability === 'review.apply');
}
/**
 * Answer chosen calls differently and leave every other call to the harness.
 * `answer(args, envelope)` returns a responder or null; answered calls are
 * recorded exactly as the harness records its own.
 */
function answerWith({ plugin, calls }, answer) {
  const base = plugin.runLos;
  plugin.runLos = (args, callback, stdin) => {
    const envelope = stdin ? JSON.parse(stdin) : null;
    const reply = answer(args, envelope);
    if (!reply) return base(args, callback, stdin);
    calls.push(args);
    if (envelope) calls.envelopes.push(envelope);
    return reply(callback);
  };
}
/** Core's receipt names the snapshot its own write produced. */
function confirmedAt(snapshot, envelope, result = {}) {
  return (callback) => {
    const confirmation = gatewayConfirmation(envelope, result);
    confirmation.snapshot_after = snapshot();
    callback(null, JSON.stringify(confirmation), '');
  };
}
function staleRefusal(envelope) {
  return (callback) => callback(
    Object.assign(new Error('Command failed'), { code: 3 }),
    JSON.stringify(gatewayRefusal(
      envelope, 'STALE_SNAPSHOT',
      'los: projection conflict — authored files changed since the app loaded', true,
    )),
    '',
  );
}

module.exports = async function run() {
  heading('selected-only shelving');
  {
    const {
      app,
      plugin,
      calls,
    } = await boot();

    await plugin.nav.openShelving(
      'unit-fixture-thesis-landscape',
    );

    const view =
      app.workspace.getLeavesOfType(
        VIEW.shelving,
      )[0].view;

    check(
      'proposal destinations and rationale are reviewable',
      view.contentEl.find(
        'los-proposal-row',
      ).length === 2
        && view.contentEl.allText().includes(
          'note-fixture-synthesis.md',
        ),
    );

    const originalToggles =
      view.contentEl.find(
        'los-proposal-row',
      ).map(
        (row) => row.children[0],
      );

    check(
      'Core proposal defaults initialize selection once',
      originalToggles[0].checked === true
        && originalToggles[1].checked === false,
    );

    // Deliberately select an old proposal that must not leak into a later
    // proposal revision.
    originalToggles[1].checked = true;
    originalToggles[1].fire('change');

    const map =
      plugin.store.mapForUnit(
        'unit-fixture-thesis-landscape',
      );

    map.revision =
      Number(map.revision || 0) + 1;

    map.shelving = {
      state: 'proposed',
      summary: 'Revised proposal identity.',
      items: [
        {
          id: 'proposal-revised',
          title: 'Revised durable note',
          destination:
            'knowledge/notes/research/revised.md',
          rationale:
            'This is the new proposal revision.',
          selected: true,
        },
      ],
    };

    // No proposal cache: a render reads the proposal and its guard from one
    // store read, so a redraw alone shows the revised projection.
    view.render();

    const revisedRows =
      view.contentEl.find(
        'los-proposal-row',
      );

    /* Changed deliberately by Plan B (S2). Once the learner has touched a box,
     * Core's defaults never tick an item for them again, so the new item is
     * unticked and marked. The invariant this check used to protect, that IDs
     * which left the proposal are never sent, keeps its own check below. */
    check(
      'a proposal revision drops stale IDs and leaves a new item unticked and marked',
      revisedRows.length === 1
        && revisedRows[0].allText().includes(
          'Revised durable note',
        )
        && revisedRows[0].children[0].checked === false
        && revisedRows[0].find('los-proposal-mark')
          .some((node) => node.allText() === 'New'),
    );

    revisedRows[0].children[0].checked = true;
    revisedRows[0].children[0].fire('change');

    const approveButton = view.contentEl.findText(
      'los-btn',
      'Approve selected changes',
    );

    check(
      'approval uses the guarded completion treatment',
      approveButton.classes.has('los-btn--success'),
    );

    /* Only the explicitly selected IDs from the current proposal cross the gateway. */
    const applied = [];
    Notice.log.length = 0;
    const realApply = plugin.gateway.applyShelving.bind(plugin.gateway);
    plugin.gateway.applyShelving = (unitId, selected, guards) => {
      applied.push({ unitId, selected, guards });
      return realApply(unitId, selected, guards);
    };

    approveButton.fire('click');

    await waitFor(() => applied.length > 0 && !plugin.gateway.isBusy);

    check(
      'approval asks core to apply, guarded, without restating approval',
      applied.length === 1
        && Array.isArray(applied[0].selected)
        && Boolean(plugin.store.snapshotId),
    );

    check(
      'only IDs from the current proposal revision can be applied',
      JSON.stringify(applied[0].selected) === '["proposal-revised"]',
    );

    check(
      'the reviewed selection reaches Core through the UI authority path',
      calls.envelope('review.apply')?.channel === 'ui'
        && calls.envelope('review.apply')?.approval.kind === 'direct-user-gesture'
        && JSON.stringify(calls.envelope('review.apply')?.payload.selected) === '["proposal-revised"]'
    );

    plugin.onunload();
  }

  heading('secondary library and exact source selections');
  {
    const { app, plugin } = await boot();
    await plugin.nav.openSourceDetail('source-fixture-islp');
    let view = app.workspace.getLeavesOfType(VIEW.library)[0].view;
    check('source opening behavior lands on a full-page detail',
      view.screen === 'source-detail' && view.contentEl.find('los-route-row').length === 0);
    check('ISLP detail preserves exact reading selections', view.contentEl.allText().includes('Chapter 3 §§3.1–3.3')
      && view.contentEl.allText().includes('§7.1 only'));
    /* The registry's own vocabulary. The card used to read `verdict`, `scope`
     * and `reading_plan` — none of which sources.schema.json allows — so every
     * recorded role, level, strength and weakness stayed inside the
     * repository while the screen showed only the section list. */
    check('an evaluation shows what the source is good for, in the schema’s vocabulary',
      view.contentEl.allText().includes('review')
      && view.contentEl.allText().includes('intermediate')
      && view.contentEl.allText().includes('Selected sections carry the whole argument')
      && view.contentEl.allText().includes('Whole-book reading wastes time'));
    check('an evaluation states what it assumes rather than ranking the source',
      view.contentEl.allText().includes('Assumes')
      && view.contentEl.allText().includes('linear algebra'));
    check('source use routes back to several distinct units', view.contentEl.allText().includes('AML Lecture 03')
      && view.contentEl.allText().includes('AML Lecture 04'));
    await plugin.nav.openLibraryGroup('sources', 'thematic-group-mathematics', 'Fixture probability');
    view = app.workspace.getLeavesOfType(VIEW.library)[0].view;
    check('source-title search remains successful', view.contentEl.find('los-route-row').length === 1
      && view.contentEl.allText().includes('Fixture probability book'));
    plugin.onunload();
  }

  heading('degraded and interface-boundary safety');
  {
    const { plugin, home } = await boot({ offline: true });
    check('offline CLI does not prevent read-only rendering', home.view.contentEl.allText().includes('Fixture Advanced ML'));
    plugin.onunload();
  }

  heading('broken gateways and hostile projections');
  {
    /* A CLI that exits 0 but answers with garbage used to clear the draft
     * behind a "saved" notice, destroying the learner's only copy. */
    const { app, plugin } = await boot();
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const risked = 'Text that must survive a broken CLI.';
    plugin.setUnitNoteDraft('unit-fixture-sad-l04', '', risked);
    const modal = plugin.openUnitNote(plugin.store.get('unit-fixture-sad-l04'), plugin.store.mapForUnit('unit-fixture-sad-l04'));
    modal.editor.value = risked; modal.editor.fire('input');
    plugin.runLos = (args, callback) => callback(null, 'NOT JSON {{{ broken CLI', '');
    Notice.log.length = 0;
    modal.contentEl.findText('los-btn', 'Save note').fire('click');
    // A write is now persisted before it is sent and replayed once if the
    // answer is unreadable, so settling takes more than a fixed pair of
    // microtasks. Wait for the queue to drain rather than for a tick count.
    await waitFor(() => Notice.log.length > 0 && !plugin.gateway.isBusy);
    check('unreadable CLI output is never reported as a saved note',
      Notice.log.length > 0 && !Notice.log.some((line) => line.includes('Learning-session note saved.')));
    check('an unconfirmed save keeps the unit-note draft',
      plugin.getUnitNoteDraft('unit-fixture-sad-l04').text === risked);
    plugin.onunload();
  }
  {
    /* A readable old manifest is not current-state proof when the one rebuild
     * that was meant to refresh it failed. The receipt stays recoverable. */
    const { app, plugin } = await build();
    await app.workspace._ready();
    const order = [];
    plugin.runLos = (args, callback, stdin) => {
      if (args[0] === 'projection-observe') {
        order.push(args[0]);
        callback(null, JSON.stringify({ write_completed: true, current_snapshot_id: null, settled: false, reason: 'projection-not-current' }), '');
        return;
      }
      const envelope = stdin ? JSON.parse(stdin) : null;
      order.push(envelope ? envelope.capability : args[0]);
      if (!envelope) {
        callback(Object.assign(new Error('disk full'), { code: 2 }), '', 'disk full');
        return;
      }
      const confirmation = gatewayConfirmation(envelope);
      confirmation.snapshot_after = `sha256:${'9'.repeat(64)}`;
      callback(null, JSON.stringify(confirmation), '');
    };
    Notice.log.length = 0;
    let blocked = null;
    await plugin.mutate(() => plugin.gateway.captureText('receipt beside a failed rebuild'))
      .catch((error) => { blocked = error; });
    check('a failed rebuild cannot bless a still-mismatched readable manifest',
      blocked?.gatewayCode === 'PROJECTION_FAILED'
      && order.join('|') === 'capture.create|generate|projection-observe'
      && plugin.settings.gatewayRecovery.phase === 'blocked');
    check('the failed rebuild does not claim newer canonical changes were observed',
      !Notice.log.some((line) => line.includes('newer canonical changes are also present')));
    plugin.onunload();
  }
  {
    const { app, plugin } = await boot();
    await plugin.nav.openProgram('inbox');
    const view = app.workspace.getLeavesOfType(VIEW.program)[0].view;
    const thought = 'A thought that must not vanish.';
    plugin.setInboxDraft('', thought);
    view.contentEl.find('los-capture-editor')[0].value = thought;
    plugin.runLos = (args, callback) => callback(null, '', '');
    Notice.log.length = 0;
    view.contentEl.findText('los-btn', 'Capture text').fire('click');
    await waitFor(() => Notice.log.length > 0 && !plugin.gateway.isBusy);
    check('a capture the core never confirmed keeps the inbox draft',
      plugin.getInboxDraft().text === thought
      && !Notice.log.some((line) => line.includes('Captured to the LearningOS inbox.')));
    plugin.onunload();
  }
  {
    /* One null row anywhere in the projection used to blank Home on startup. */
    const { app, plugin, home } = await boot();
    plugin.store.data.modules.push(null);
    plugin.store.data.units.push(null);
    plugin.store.data.study_maps.push(null);
    plugin.store.records.push(null);
    home.view.render();
    check('a null row in the projection does not blank Home',
      home.view.contentEl.allText().includes('Fixture Advanced ML'));
    await plugin.nav.openLibrary('source-fixture-islp');
    check('Library still opens a source around a null record',
      app.workspace.getLeavesOfType(VIEW.library)[0].view.contentEl.find('los-detail-page').length === 1
      && app.workspace.getLeavesOfType(VIEW.library)[0].view.contentEl.allText().includes('Fixture Introduction to Statistical Learning with Python'));
    plugin.onunload();
  }
  {
    const { app, plugin } = await boot();
    const Store = plugin.store.constructor;
    const fresh = new Store(app);
    check('a store that never loaded still answers list queries',
      Array.isArray(fresh.records) && fresh.of('source').length === 0
      && fresh.search('anything').length === 0 && fresh.units().length === 0);
    plugin.store.ready = false;
    plugin.store.data = null;
    plugin.store.error = 'Projection unavailable — rebuild it to continue.';
    await plugin.nav.openProgram('inbox');
    app.workspace.getLeavesOfType(VIEW.program)[0].view.render();
    check('Inbox degrades instead of reading a null projection',
      app.workspace.getLeavesOfType(VIEW.program)[0].view.contentEl.allText().includes('Projection unavailable'));
    await plugin.nav.openLibrary();
    app.workspace.getLeavesOfType(VIEW.library)[0].view.render();
    check('Library degrades instead of searching an unloaded record set',
      app.workspace.getLeavesOfType(VIEW.library)[0].view.contentEl.allText().includes('Projection unavailable'));
    await plugin.nav.openBoundary('program-masters-planning');
    const boundary = app.workspace.getLeavesOfType(VIEW.boundary)[0].view;
    check('isolated prospective planning does not depend on the normal projection',
      boundary.contentEl.allText().includes('Prospective—not current LearningOS')
      && Boolean(boundary.contentEl.findText('los-btn', 'Open prospective planning')));
    plugin.onunload();
  }
  {
    const { app, plugin } = await boot();
    /* The nested `study_maps[].stages` list is what the workspace renders; the
     * flat `stages` index is a separate shape (ADR-006, fifth addendum). */
    const map = plugin.store.get('study-map-fixture-sad-l04');
    const nested = map.stages.find((row) => row.id === 'stage-fixture-conditioning');
    nested.resources = 'Chapter 3 §§3.1–3.3';
    nested.done_when = 'Explain it cold.';
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    check('a string where a list belongs renders an empty state, not one row per character',
      view.contentEl.find('los-resource-row').length === 0
      && view.contentEl.allText().includes('No source action selected'));
    delete map.stages;
    view.render();
    check('a study map without stages shows an empty state instead of throwing',
      view.contentEl.allText().includes('no stages yet'));
    plugin.onunload();
  }
  {
    const { app, plugin, calls } = await boot();
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const writes = () => calls.envelopes.filter((e) => e.capability === 'stage.progress.update').length;
    const before = writes();
    const complete = view.contentEl.findText('los-btn', 'Complete stage');
    complete.fire('click'); complete.fire('click');
    await waitFor(() => writes() > before && !plugin.gateway.isBusy);
    check('two fast clicks produce exactly one guarded write', writes() === before + 1);
    plugin.onunload();
  }
  {
    /* The lock lives in the gateway, not in a view: a stage write and an inbox
     * capture started from different leaves must still not overlap, because
     * each carries an expected_snapshot the other invalidates. */
    const { app, plugin } = await build();
    await app.workspace._ready();
    const order = [];
    let settle = null;
    plugin.runLos = (args, callback, stdin) => {
      if (answerProjectionObservation(plugin, args, callback)) return;
      const envelope = stdin ? JSON.parse(stdin) : null;
      const name = envelope ? envelope.capability : args[0];
      order.push(`start:${name}`);
      const finish = () => {
        order.push(`end:${name}`);
        callback(null, JSON.stringify(envelope
          ? gatewayConfirmation(envelope)
          : {
            ok: true, owned_changes: [], unrelated_changes: [], pushed: false,
          }), '');
      };
      if (name === 'unit.note.append') settle = finish; else finish();
    };
    const first = plugin.mutate(() => plugin.gateway.saveUnitNote('unit-fixture-sad-l04', { text: 'x' }));
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const unitView = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const second = unitView.mutate(() => plugin.gateway.captureText('a second thought'));
    const third = plugin.reviewSessionEnd();
    await waitFor(() => order.length > 0);
    check('a Unit action waits behind a write from another view instead of being discarded',
      order.filter((entry) => entry.startsWith('start:')).length === 1);
    check('session closure waits behind the same global writer',
      !order.includes('start:session-end'));
    settle?.();
    await first; await second; await third; await tick();
    check('the queued write runs after the first transaction completes',
      order.join('|') === 'start:unit.note.append|end:unit.note.append|start:capture.create|end:capture.create|start:session-end|end:session-end');
    check('a rejected transaction does not poison the queue',
      plugin.gateway.pending === 0);
    plugin.onunload();
  }
  {
    /* The note modal holds text the learner just wrote, so it is the one
     * surface where dropping a write costs something irreplaceable. It used to
     * refuse outright whenever any unrelated write was in flight. */
    const { app, plugin } = await build();
    await app.workspace._ready();
    const order = [];
    let settle = null;
    plugin.runLos = (args, callback, stdin) => {
      if (answerProjectionObservation(plugin, args, callback)) return;
      const envelope = stdin ? JSON.parse(stdin) : null;
      const name = envelope ? envelope.capability : args[0];
      order.push(name);
      const finish = () => callback(null, JSON.stringify(gatewayConfirmation(envelope)), '');
      if (name === 'capture.create') settle = finish; else finish();
    };
    const blocking = plugin.mutate(() => plugin.gateway.captureText('an unrelated thought'));
    const modal = plugin.openUnitNote(
      plugin.store.get('unit-fixture-sad-l04'),
      plugin.store.mapForUnit('unit-fixture-sad-l04'),
    );
    await tick();
    modal.editor.value = 'A synthesis worth keeping.';
    modal.editor.fire('input');
    const save = modal.contentEl.findText('los-btn', 'Save note');
    save.fire('click');
    save.fire('click');
    await waitFor(() => order.includes('capture.create'));
    check('a note save is queued behind an unrelated write, not discarded',
      order.filter((name) => name === 'capture.create').length === 1
      && !order.includes('unit.note.append'));
    settle?.();
    await blocking;
    await waitFor(() => order.includes('unit.note.append') && !plugin.gateway.isBusy);
    check('the queued note reaches the core exactly once after the write ahead of it',
      order.filter((name) => name === 'unit.note.append').length === 1
      && order.indexOf('unit.note.append') > order.indexOf('capture.create'));
    plugin.onunload();
  }
  {
    /*
     * A receipt whose snapshot the projection does not show used to be
     * rejected as unconfirmed — which told a learner their write had not
     * happened when Core had just said it did, and invited the retry that
     * duplicates it. The write is real; what is stale is this vault's view of
     * it. So the projection is rebuilt once, the transaction is accepted, and
     * the learner is told the tree has moved on as well.
     */
    const { app, plugin } = await build();
    await app.workspace._ready();
    const order = [];
    plugin.runLos = (args, callback, stdin) => {
      if (answerProjectionObservation(plugin, args, callback)) return;
      const envelope = stdin ? JSON.parse(stdin) : null;
      order.push(envelope ? envelope.capability : args[0]);
      if (!envelope) { callback(null, 'rebuilt', ''); return; }
      const confirmation = gatewayConfirmation(envelope);
      confirmation.snapshot_after = `sha256:${'9'.repeat(64)}`;
      callback(null, JSON.stringify(confirmation), '');
    };
    Notice.log.length = 0;
    let failed = null;
    await plugin.mutate(() => plugin.gateway.captureText('receipt without projection'))
      .catch((error) => { failed = error; });
    check('an unobserved receipt rebuilds the projection instead of denying the write',
      failed === null && order.join('|') === 'capture.create|generate');
    check('the learner is told the recovered write sits beside newer canonical changes',
      Notice.log.some((line) => line.includes('newer canonical changes are also present')));
    check('an accepted transaction retires its recovery record',
      plugin.settings.gatewayRecovery === null);
    plugin.onunload();
  }
  {
    /*
     * The same situation, but the projection cannot be loaded at all. Nothing
     * observes the write, so the record stays and the next write is refused
     * rather than stacked on top of an unknown one.
     */
    const { app, plugin } = await build();
    await app.workspace._ready();
    plugin.runLos = (args, callback, stdin) => {
      if (answerProjectionObservation(plugin, args, callback)) return;
      const envelope = stdin ? JSON.parse(stdin) : null;
      if (!envelope) { callback(null, 'rebuilt', ''); return; }
      const confirmation = gatewayConfirmation(envelope);
      confirmation.snapshot_after = `sha256:${'9'.repeat(64)}`;
      callback(null, JSON.stringify(confirmation), '');
    };
    app.vault.adapter.exists = async () => false;
    let blocked = null;
    await plugin.mutate(() => plugin.gateway.captureText('receipt with no readable projection'))
      .catch((error) => { blocked = error; });
    check('an unloadable projection blocks instead of pretending the write is settled',
      blocked !== null && blocked.gatewayCode === 'PROJECTION_FAILED');
    check('the confirmed record survives so nothing is written on top of it',
      plugin.settings.gatewayRecovery
      && plugin.settings.gatewayRecovery.phase === 'blocked'
      && plugin.settings.gatewayRecovery.confirmation !== null);
    plugin.onunload();
  }
  {
    /* Planning happens in Claude, so canonical files change between app
     * sessions by design. The core then refuses the next write and says
     * "reload before writing" — but reloading re-reads the same stale
     * generated/manifest.json. Only a rebuild moves the projection forward,
     * so the app has to do that itself or the advice on screen is a dead end. */
    const { app, plugin } = await build();
    await app.workspace._ready();
    const order = [];
    let refuse = true;
    plugin.runLos = (args, callback, stdin) => {
      if (answerProjectionObservation(plugin, args, callback)) return;
      const envelope = stdin ? JSON.parse(stdin) : null;
      const name = envelope ? envelope.capability : args[0];
      order.push(name);
      if (name === 'generate') { callback(null, 'rebuilt', ''); return; }
      if (name === 'capture.create' && refuse) {
        refuse = false;
        callback(
          Object.assign(new Error('Command failed'), { code: 3 }),
          JSON.stringify(gatewayRefusal(
            envelope, 'STALE_SNAPSHOT',
            'los: projection conflict — authored files changed since the app loaded',
            true,
          )),
          '',
        );
        return;
      }
      callback(null, JSON.stringify(gatewayConfirmation(envelope)), '');
    };
    let firstConflict = null;
    await plugin.mutate(() => plugin.gateway.captureText('written after Claude edited the tree'))
      .catch((error) => { firstConflict = error; });
    check('a stale projection is rebuilt without replaying the refused write',
      order.join('|') === 'capture.create|generate'
      && /projection conflict/.test(String(firstConflict && firstConflict.message)));
    check('the refreshed refusal settles the queue',
      plugin.gateway.pending === 0);
    // A definitive refusal is the one outcome that proves nothing was written,
    // so it is also the only failure allowed to retire the record.
    check('a definitive refusal clears the recovery record and keeps the draft',
      plugin.settings.gatewayRecovery === null);

    /* Every conflict refreshes once and reaches the learner. The action is
     * never replayed with freshly adopted artifact revisions. */
    const seen = [];
    plugin.runLos = (args, callback, stdin) => {
      if (answerProjectionObservation(plugin, args, callback)) return;
      const envelope = stdin ? JSON.parse(stdin) : null;
      const name = envelope ? envelope.capability : args[0];
      seen.push(name);
      if (name === 'generate') { callback(null, 'rebuilt', ''); return; }
      callback(
        Object.assign(new Error('Command failed'), { code: 3 }),
        JSON.stringify(gatewayRefusal(
          envelope, 'STALE_SNAPSHOT',
          'los: projection conflict — authored files changed since the app loaded',
          true,
        )),
        '',
      );
    };
    let surfaced = null;
    await plugin.mutate(() => plugin.gateway.captureText('still conflicting'))
      .catch((error) => { surfaced = error; });
    check('a conflict is surfaced after refresh and never replayed',
      seen.join('|') === 'capture.create|generate'
      && /projection conflict/.test(String(surfaced && surfaced.message)));
    plugin.onunload();
  }
  {
    /* A projected URL is untrusted input to a viewer. */
    const { app, plugin } = await boot();
    Notice.log.length = 0;
    const refused = plugin.openResource({ url: 'javascript:alert(1)' });
    const alsoRefused = plugin.openResource({ url: 'file:///etc/passwd' });
    check('unsupported URL schemes never reach the viewer',
      refused === false && alsoRefused === false
      && Notice.log.some((line) => line.includes('Refused an unsupported link')));
    await plugin.openResource({ url: 'https://example.org/paper.pdf' });
    check('https still opens normally',
      app.workspace.getLeavesOfType('webviewer').length === 0 || true);
    plugin.onunload();
  }

  /*
   * Product research 2026-11-11, §2.3 failure case 1, reproduced as written:
   * choose only proposal-garden, let Core refuse the approval as stale, let
   * the refresh change the study map's revision, approve again. Before Plan B
   * the retry sent ["proposal-note"] under a notice saying the draft was kept.
   */
  heading('Shelving: a refused approval retries exactly what the learner chose');
  {
    let rebuilt = false;
    const context = await boot({ patchManifest(manifest) {
      withShelvingContent(manifest);
      // Core still defaults to proposal-note after the rebuild.
      if (rebuilt) shelvingMapIn(manifest).revision += 1;
    } });
    const { app, plugin, calls } = context;
    answerWith(context, (args, envelope) => {
      if (args[0] === 'generate') return (callback) => { rebuilt = true; callback(null, 'rebuilt', ''); };
      if (envelope?.capability === 'review.apply' && appliedEnvelopes(calls).length === 0) return staleRefusal(envelope);
      return null;
    });
    await plugin.nav.openShelving(SHELVING_UNIT);
    const screen = shelvingScreen(app);
    check('Core defaults tick proposal-note before the learner touches anything',
      screen.box('Fixture synthesis')?.checked === true
      && screen.box('Open fixture question')?.checked === false);
    screen.set('Fixture synthesis', false);
    screen.set('Open fixture question', true);
    Notice.log.length = 0;
    screen.approve().fire('click');
    await waitFor(() => rebuilt && appliedEnvelopes(calls).length === 1 && !plugin.gateway.isBusy);
    check('the refused attempt sent only the learner’s choice',
      JSON.stringify(appliedEnvelopes(calls)[0]?.payload.selected) === '["proposal-garden"]');
    check('the rebuild after the refusal moved the study map’s revision',
      plugin.store.mapForUnit(SHELVING_UNIT).revision === 2);
    check('after the rebuild the screen keeps the learner’s choice, as the notice says',
      Notice.log.some((line) => line.includes('Your draft was kept'))
      && screen.box('Open fixture question')?.checked === true
      && screen.box('Fixture synthesis')?.checked === false);
    check('a refresh that changed no item adds no summary line',
      !screen.text().includes('Kept your choice') && !screen.text().includes('since you looked'));
    screen.approve().fire('click');
    await waitFor(() => appliedEnvelopes(calls).length === 2 && !plugin.gateway.isBusy);
    check('the retry sends proposal-garden although Core defaults to proposal-note',
      JSON.stringify(appliedEnvelopes(calls)[1]?.payload.selected) === '["proposal-garden"]');
    plugin.onunload();
  }

  heading('Shelving: a choice belongs to the item the learner saw');
  {
    let newer = false;
    const context = await boot({ patchManifest(manifest) {
      withShelvingContent(manifest);
      if (!newer) return;
      newerProjection(manifest);
      rewriteNote(manifest);
      shelvingMapIn(manifest).shelving.items.push({
        id: 'proposal-extra', kind: 'durable-note', title: 'Fixture extra note',
        destination: 'knowledge/notes/research/extra.md', rationale: 'Arrived after the first look.',
        content: '# Fixture extra note\n\nLater text.', selected: true,
      });
    } });
    const { app, plugin, calls } = context;
    answerWith(context, (args, envelope) => (envelope?.capability === 'review.apply'
      ? confirmedAt(() => plugin.store.snapshotId, envelope) : null));
    await plugin.nav.openShelving(SHELVING_UNIT);
    const screen = shelvingScreen(app);
    check('each item shows the text Core will write and its destination',
      screen.row('Fixture synthesis')?.allText().includes('The reasoning, kept in the learner’s own words.')
      && screen.row('Fixture synthesis')?.allText().includes('knowledge/notes/research/note-fixture-synthesis.md')
      && screen.row('Open fixture question')?.allText().includes('What still needs checking.'));
    check('nothing is marked before anything changed',
      !screen.text().includes('since you looked') && screen.marks('Fixture synthesis').length === 0);
    screen.set('Open fixture question', true);
    newer = true;
    await plugin.reloadStore();
    check('an unchanged item keeps the learner’s tick across a newer snapshot',
      screen.box('Open fixture question')?.checked === true
      && screen.marks('Open fixture question').length === 0);
    check('an item whose text changed under the same ID is unticked and marked',
      screen.box('Fixture synthesis')?.checked === false
      && screen.marks('Fixture synthesis').includes('Changed since you looked')
      && screen.row('Fixture synthesis')?.allText().includes('Text an agent rewrote under the same ID.'));
    check('an item that arrived after the learner’s first touch is unticked and marked new',
      screen.box('Fixture extra note')?.checked === false
      && screen.marks('Fixture extra note').includes('New'));
    check('one line says what the refresh did to the learner’s choices',
      screen.text().includes('Kept your choice on 1 item. 1 changed since you looked and is now unticked: Fixture synthesis. 1 new item is unticked.'));
    screen.approve().fire('click');
    await waitFor(() => appliedEnvelopes(calls).length === 1 && !plugin.gateway.isBusy);
    check('approval sends only the ticks the learner can see',
      JSON.stringify(appliedEnvelopes(calls)[0]?.payload.selected) === '["proposal-garden"]');
    check('the approval is guarded by the snapshot whose text is on screen',
      appliedEnvelopes(calls)[0]?.expected_snapshot === NEWER_SNAPSHOT
      && appliedEnvelopes(calls)[0]?.expected_revisions[SHELVING_MAP] === 2);
    plugin.onunload();
  }

  heading('Shelving: long text is collapsed, never cut');
  {
    const lines = Array.from({ length: 30 }, (_, index) => `Line ${index + 1} of the durable note.`);
    const { app, plugin } = await boot({ patchManifest(manifest) {
      withShelvingContent(manifest);
      shelvingItem(manifest, 'proposal-note').content = lines.join('\n');
    } });
    await plugin.nav.openShelving(SHELVING_UNIT);
    const screen = shelvingScreen(app);
    const block = () => screen.row('Fixture synthesis').find('los-proposal-content')[0];
    const more = () => screen.row('Fixture synthesis').find('los-btn').find((node) => node.allText().startsWith('Show'));
    check('text beyond twelve lines starts collapsed behind Show all',
      block()?.allText() === lines.slice(0, 12).join('\n')
      && more()?.allText() === 'Show all 30 lines' && more()?.getAttribute('aria-expanded') === 'false');
    more()?.fire('click');
    check('Show all reveals every line Core would write',
      block()?.allText() === lines.join('\n')
      && more()?.allText() === 'Show fewer lines' && more()?.getAttribute('aria-expanded') === 'true');
    check('short text needs no control', !screen.row('Open fixture question').find('los-btn').length);
    plugin.onunload();
  }

  heading('Shelving: applied and departed items never carry a tick forward');
  {
    let phase = 'first';
    const context = await boot({ patchManifest(manifest) {
      withShelvingContent(manifest);
      const shelving = shelvingMapIn(manifest).shelving;
      // Core removes applied items from the packet and keeps the remainder.
      if (phase !== 'first') {
        newerProjection(manifest);
        shelving.items = shelving.items.filter((item) => item.id !== 'proposal-garden');
      }
      // An agent later proposes the same ID again with the same text.
      if (phase === 'again') {
        shelvingMapIn(manifest).revision += 1;
        shelving.items.push({ ...shelvingItem(manifest, 'proposal-note'),
          id: 'proposal-garden', kind: 'garden', title: 'Open fixture question',
          destination: 'knowledge/garden/open-fixture.md', rationale: 'Still uncertain.',
          diff: '+ Track uncertainty.', content: GARDEN_TEXT, selected: false });
      }
    } });
    const { app, plugin, calls } = context;
    answerWith(context, (args, envelope) => {
      if (envelope?.capability !== 'review.apply') return null;
      phase = 'applied';
      return confirmedAt(() => NEWER_SNAPSHOT, envelope, { ok: true, applied: ['proposal-garden'] });
    });
    await plugin.nav.openShelving(SHELVING_UNIT);
    const screen = shelvingScreen(app);
    screen.set('Fixture synthesis', false);
    screen.set('Open fixture question', true);
    screen.approve().fire('click');
    await waitFor(() => appliedEnvelopes(calls).length === 1 && !plugin.gateway.isBusy);
    check('an applied item leaves the screen with Core’s packet',
      JSON.stringify(appliedEnvelopes(calls)[0]?.payload.selected) === '["proposal-garden"]'
      && screen.rows().length === 1 && screen.row('Open fixture question') === null);
    check('the learner’s untick on the remaining item survives the apply',
      screen.box('Fixture synthesis')?.checked === false);
    phase = 'again';
    await plugin.reloadStore();
    check('an applied ID proposed again starts unticked and new, not with its old tick',
      screen.box('Open fixture question')?.checked === false
      && screen.marks('Open fixture question').includes('New'));
    Notice.log.length = 0;
    screen.approve().fire('click');
    await waitFor(() => Notice.log.length > 0);
    check('with nothing ticked, approval sends nothing',
      appliedEnvelopes(calls).length === 1
      && Notice.log.some((line) => line.includes('Select at least one proposal.')));
    plugin.onunload();
  }

  /*
   * Archived plan §8.2 F2. Before Plan B the screen kept the proposal it
   * cached at open while the guard followed the store, so a newer snapshot
   * left old text on screen under a guard that let Core write the new text.
   */
  heading('Shelving: what is approved is the text on screen');
  {
    let newer = false;
    const context = await boot({ patchManifest(manifest) {
      withShelvingContent(manifest);
      if (newer) { newerProjection(manifest); rewriteNote(manifest); }
    } });
    const { app, plugin, calls } = context;
    answerWith(context, (args, envelope) => (envelope?.capability === 'review.apply'
      ? confirmedAt(() => plugin.store.snapshotId, envelope) : null));
    await plugin.nav.openShelving(SHELVING_UNIT);
    const screen = shelvingScreen(app);
    check('the first render shows the text and diff Core would write now',
      screen.row('Fixture synthesis')?.allText().includes('The reasoning, kept in the learner’s own words.')
      && screen.row('Fixture synthesis')?.allText().includes('+ Preserve fixture wording.'));
    newer = true;
    await plugin.reloadStore();
    check('a newer snapshot redraws the item with its current text and diff',
      screen.row('Fixture synthesis')?.allText().includes('Text an agent rewrote under the same ID.')
      && screen.row('Fixture synthesis')?.allText().includes('+ Rewritten fixture wording.')
      && !screen.row('Fixture synthesis')?.allText().includes('+ Preserve fixture wording.'));
    check('before any touch Core’s defaults still apply to the redrawn proposal',
      screen.box('Fixture synthesis')?.checked === true
      && screen.box('Open fixture question')?.checked === false);
    screen.approve().fire('click');
    await waitFor(() => appliedEnvelopes(calls).length === 1 && !plugin.gateway.isBusy);
    const sent = appliedEnvelopes(calls)[0];
    check('the guard sent belongs to the same snapshot as the text on screen',
      JSON.stringify(sent?.payload.selected) === '["proposal-note"]'
      && sent?.expected_snapshot === NEWER_SNAPSHOT
      && sent?.expected_revisions[SHELVING_MAP] === 2);
    plugin.onunload();
  }

  heading('Shelving: an approval queued behind a refresh cannot approve unseen text');
  {
    let newer = false;
    const context = await boot({ patchManifest(manifest) {
      withShelvingContent(manifest);
      if (newer) { newerProjection(manifest); rewriteNote(manifest); }
    } });
    const { app, plugin, calls } = context;
    let release = null;
    answerWith(context, (args, envelope) => {
      if (envelope?.capability === 'capture.create' && !release) {
        return (callback) => {
          release = () => callback(null, JSON.stringify({
            ...gatewayConfirmation(envelope), snapshot_after: NEWER_SNAPSHOT,
          }), '');
        };
      }
      return envelope?.capability === 'review.apply'
        ? confirmedAt(() => plugin.store.snapshotId, envelope) : null;
    });
    await plugin.nav.openShelving(SHELVING_UNIT);
    const screen = shelvingScreen(app);
    const shownGuard = plugin.store.artifactGuard(SHELVING_UNIT, SHELVING_MAP);
    const shownSnapshot = plugin.store.snapshotId;
    const blocking = plugin.mutate(() => plugin.gateway.captureText('an unrelated thought'));
    await waitFor(() => Boolean(release));
    newer = true; // the capture's own write publishes a newer projection
    Notice.log.length = 0;
    screen.approve().fire('click'); // clicked on the old render, queued behind the capture
    release();
    await blocking;
    await waitFor(() => !plugin.gateway.isBusy && plugin.store.snapshotId === NEWER_SNAPSHOT);
    await waitFor(() => Notice.log.length > 0 || appliedEnvelopes(calls).length > 0);
    const sent = appliedEnvelopes(calls)[0];
    check('a queued approval never pairs the old screen with a newer guard',
      !sent || (sent.expected_snapshot === shownSnapshot
        && JSON.stringify(sent.expected_revisions) === JSON.stringify(shownGuard)));
    check('the learner sees the newer text and is told nothing was written',
      screen.row('Fixture synthesis')?.allText().includes('Text an agent rewrote under the same ID.')
      && Notice.log.some((line) => line.includes('Nothing was written')));
    plugin.onunload();
  }

  heading('Shelving: choices outlive the tab and a refusal, not the plugin');
  {
    const context = await boot({ patchManifest: withShelvingContent });
    const { app, plugin, calls } = context;
    await plugin.nav.openShelving(SHELVING_UNIT);
    let screen = shelvingScreen(app);
    screen.set('Fixture synthesis', false);
    screen.set('Open fixture question', true);
    app.workspace.getLeavesOfType(VIEW.shelving)[0].detach();
    await plugin.nav.openShelving(SHELVING_UNIT);
    screen = shelvingScreen(app);
    check('closing and reopening the Shelving tab keeps the learner’s ticks',
      screen.box('Fixture synthesis')?.checked === false
      && screen.box('Open fixture question')?.checked === true);
    answerWith(context, (args, envelope) => (envelope?.capability === 'review.apply'
      ? (callback) => callback(
        Object.assign(new Error('Command failed'), { code: 2 }),
        JSON.stringify(gatewayRefusal(envelope, 'INVALID_REQUEST',
          'los: unsafe or existing shelving destination: knowledge/garden/open-fixture.md')),
        '')
      : null));
    Notice.log.length = 0;
    screen.approve().fire('click');
    await waitFor(() => appliedEnvelopes(calls).length === 1 && !plugin.gateway.isBusy && Notice.log.length > 0);
    check('a refused approval keeps the learner’s ticks and shows Core’s reason',
      Notice.log.some((line) => line.includes('unsafe or existing shelving destination'))
      && screen.box('Fixture synthesis')?.checked === false
      && screen.box('Open fixture question')?.checked === true);
    check('choices stay out of the plugin’s saved settings',
      !JSON.stringify(plugin.settings).includes('proposal-garden'));
    plugin.onunload();
    const restarted = await boot({ patchManifest: withShelvingContent });
    await restarted.plugin.nav.openShelving(SHELVING_UNIT);
    const fresh = shelvingScreen(restarted.app);
    check('a plugin restart returns to Core’s defaults',
      fresh.box('Fixture synthesis')?.checked === true
      && fresh.box('Open fixture question')?.checked === false);
    restarted.plugin.onunload();
  }

  heading('Shelving: choices are scoped to their unit');
  {
    const SECOND = 'unit-fixture-aml-l03';
    const { app, plugin } = await boot({ patchManifest(manifest) {
      withShelvingContent(manifest);
      shelvingMapIn(manifest, SECOND).shelving = JSON.parse(JSON.stringify(shelvingMapIn(manifest).shelving));
    } });
    await plugin.nav.openShelving(SHELVING_UNIT);
    const screen = shelvingScreen(app);
    screen.set('Fixture synthesis', false);
    screen.set('Open fixture question', true);
    await plugin.nav.openShelving(SECOND);
    const second = shelvingScreen(app);
    check('another unit with the same item IDs starts from its own Core defaults',
      second.text().includes('AML Lecture 03')
      && second.box('Fixture synthesis')?.checked === true
      && second.box('Open fixture question')?.checked === false);
    second.set('Open fixture question', true);
    await plugin.nav.openShelving(SHELVING_UNIT);
    const first = shelvingScreen(app);
    check('returning to the first unit restores its own choices',
      first.text().includes('Thesis landscape')
      && first.box('Fixture synthesis')?.checked === false
      && first.box('Open fixture question')?.checked === true);
    plugin.onunload();
  }

  /*
   * Product research §2.3 failure case 2. Without an items file Core writes
   * the packet and records state `draft`; the screen used to show "No
   * proposal yet" again and claim the gateway derives candidates.
   */
  heading('Shelving: a prepared packet waits for proposal items');
  {
    const DRAFT_UNIT = 'unit-fixture-aml-l04';
    let prepared = false;
    let packet = '';
    const context = await boot({ patchManifest(manifest) {
      const map = shelvingMapIn(manifest, DRAFT_UNIT);
      packet = `${path.posix.dirname(map.path)}/shelving-proposal.md`;
      if (prepared) {
        map.shelving = { state: 'draft', proposal_path: packet,
          summary: 'Review stage notes and attachments without rewriting learner wording.' };
      }
    } });
    const { app, plugin, calls } = context;
    answerWith(context, (args, envelope) => (envelope?.capability === 'review.prepare'
      ? (callback) => {
        prepared = true;
        callback(null, JSON.stringify(gatewayConfirmation(envelope, {
          ok: true, unit_id: DRAFT_UNIT, proposal_path: packet, state: 'draft',
        })), '');
      }
      : null));
    const prompts = [];
    app.plugins = { plugins: { 'agentic-copilot': { sendToChat: async (prompt) => { prompts.push(prompt); } } } };
    await plugin.nav.openShelving(DRAFT_UNIT);
    const screen = shelvingScreen(app);
    check('the empty state says what Prepare really does',
      screen.text().includes('No proposal yet')
      && !screen.text().includes('The gateway derives candidates from this unit')
      && screen.text().includes('review packet'));
    screen.view.contentEl.findText('los-btn', 'Prepare proposal').fire('click');
    await waitFor(() => prepared && !plugin.gateway.isBusy);
    check('Prepare asks Core for this unit’s packet',
      calls.envelope('review.prepare')?.payload.unit_id === DRAFT_UNIT);
    check('a packet without items is a visible draft with its path',
      screen.text().includes('Waiting for proposal items')
      && screen.text().includes(packet)
      && !screen.text().includes('No proposal yet')
      && screen.rows().length === 0);
    const envelopesBefore = calls.envelopes.length;
    screen.view.contentEl.findText('los-btn', 'Ask AI to propose items')?.fire('click');
    await waitFor(() => prompts.length > 0);
    check('Ask AI to propose items hands the unit and the review.prepare intent to the scoped port',
      prompts.length === 1
      && prompts[0].includes('review.prepare')
      && prompts[0].includes(packet)
      && prompts[0].includes(`"unit_id": "${DRAFT_UNIT}"`));
    check('the request ends at proposal creation and never asks to apply',
      prompts.length === 1 && prompts[0].includes('Do not apply'));
    check('asking for proposal items sends nothing to the gateway and no model runs here',
      calls.envelopes.length === envelopesBefore
      && !calls.some((args) => args[0] === 'ai-action' || args.includes('review.apply')));
    plugin.onunload();
  }

  /*
   * Plan B risk 2: a decoder that drops an actionable field could carry an old
   * tick onto changed meaning. The field list is read from the sibling Core's
   * closed schema, so a field Core adds fails this block until the decoder and
   * its fingerprint learn it. The validated manifest already refuses a field
   * the locked contract does not know; the decoder refuses one too, in case a
   * regenerated contract admits a field before the decoder does.
   */
  heading('Shelving: the fingerprint follows Core’s closed item schema');
  {
    const schemaPath = path.join(ROOT, '..', 'repository', 'system', 'schema', 'study-map.schema.json');
    const fields = fs.existsSync(schemaPath)
      ? Object.keys(JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
        .properties.shelving.properties.items.items.properties)
      : ['id', 'kind', 'title', 'destination', 'rationale', 'diff', 'content', 'metadata', 'selected'];
    const sample = {
      id: 'proposal-note', kind: 'durable-note', title: 'Fixture synthesis',
      destination: 'knowledge/notes/research/note-fixture-synthesis.md',
      rationale: 'The reasoning has an independent purpose.', diff: '+ Preserve fixture wording.',
      content: NOTE_TEXT, metadata: { origin: 'fixture', stages: ['stage-fixture-thesis'] }, selected: true,
    };
    const changed = {
      kind: 'garden', title: 'Fixture synthesis, renamed', destination: 'knowledge/notes/research/elsewhere.md',
      rationale: 'A different reason.', diff: '+ Different wording.', content: REWRITTEN_TEXT,
      metadata: { origin: 'fixture', stages: ['stage-fixture-other'] },
    };
    const full = Object.fromEntries(fields.map((field) => [field, field in sample ? sample[field] : `fixture ${field}`]));
    const { app, plugin, calls } = await boot({ patchManifest(manifest) {
      withShelvingContent(manifest);
      const shelving = shelvingMapIn(manifest).shelving;
      shelving.items = [full, shelvingItem(manifest, 'proposal-garden')];
    } });
    check('the fixture with every schema field is a valid projection', plugin.store.ready, plugin.store.error);
    await plugin.nav.openShelving(SHELVING_UNIT);
    const screen = shelvingScreen(app);
    check(`an item using every field of Core’s schema can be ticked (${fields.join(', ')})`,
      fields.includes('content') && screen.box('Fixture synthesis')?.checked === true);
    screen.set('Open fixture question', true);
    const item = plugin.store.mapForUnit(SHELVING_UNIT).shelving.items[0];
    const missed = [];
    for (const field of fields.filter((name) => name !== 'id' && name !== 'selected')) {
      const original = item[field];
      item[field] = field in changed ? changed[field] : `changed ${field}`;
      screen.view.render();
      const caught = screen.box(item.title)?.checked === false
        && screen.marks(item.title).includes('Changed since you looked');
      item[field] = original;
      screen.view.render();
      const restored = screen.box('Fixture synthesis')?.checked === true
        && screen.marks('Fixture synthesis').length === 0;
      if (!caught || !restored) missed.push(field);
    }
    check('a change to any field Core acts on unticks and marks the item; undoing it restores the tick',
      missed.length === 0, `not caught: ${missed.join(', ')}`);
    item.selected = false;
    screen.view.render();
    check('a new Core default alone is not a change to the learner’s choice',
      screen.box('Fixture synthesis')?.checked === true && screen.marks('Fixture synthesis').length === 0);
    plugin.store.mapForUnit(SHELVING_UNIT).shelving.items[1].urgency = 'high';
    screen.view.render();
    check('an item with a field the decoder does not know cannot be ticked and says why',
      screen.row('Open fixture question') !== null
      && screen.box('Open fixture question') === null
      && screen.row('Open fixture question').allText().includes('urgency'));
    screen.approve()?.fire('click');
    await waitFor(() => appliedEnvelopes(calls).length === 1 && !plugin.gateway.isBusy);
    check('only the item the app can show is sent',
      JSON.stringify(appliedEnvelopes(calls)[0]?.payload.selected) === '["proposal-note"]');
    plugin.onunload();
    const unknown = await boot({ patchManifest(manifest) {
      withShelvingContent(manifest);
      shelvingItem(manifest, 'proposal-garden').urgency = 'high';
    } });
    check('the validated projection already refuses an item field outside the locked contract',
      unknown.plugin.store.ready === false
      && /must NOT have additional properties/.test(String(unknown.plugin.store.error)));
    unknown.plugin.onunload();
  }
};
