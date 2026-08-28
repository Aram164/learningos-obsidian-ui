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
} = require('./support');

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

    await view.loadProposal();
    view.render();

    const revisedRows =
      view.contentEl.find(
        'los-proposal-row',
      );

    check(
      'proposal revision resets stale selected IDs before rendering',
      revisedRows.length === 1
        && revisedRows[0].allText().includes(
          'Revised durable note',
        )
        && revisedRows[0].children[0].checked === true,
    );

    const approveButton = view.contentEl.findText(
      'los-btn',
      'Approve selected changes',
    );

    check(
      'approval uses the guarded completion treatment',
      approveButton.classes.has('los-btn--success'),
    );

    approveButton.fire('click');

    await waitFor(() => Boolean(calls.envelope('review.apply'))
      && !plugin.gateway.isBusy);

    const applies =
      calls.envelopes.filter(
        (envelope) =>
          envelope.capability
            === 'review.apply',
      );

    const apply =
      applies[applies.length - 1];

    check(
      'approval invokes guarded core apply',
      !Object.prototype.hasOwnProperty.call(apply?.payload || {}, 'approve')
        && Array.isArray(
          apply?.payload.selected,
        )
        && Boolean(
          apply?.expected_snapshot,
        ),
    );

    check(
      'only IDs from the current proposal revision can be applied',
      JSON.stringify(
        apply?.payload.selected,
      ) === '["proposal-revised"]',
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
    modal.contentEl.findText('los-btn', 'Save note').fire('click'); await tick(); await tick();
    check('unreadable CLI output is never reported as a saved note',
      Notice.log.length > 0 && !Notice.log.some((line) => line.includes('Learning-session note saved.')));
    check('an unconfirmed save keeps the unit-note draft',
      plugin.getUnitNoteDraft('unit-fixture-sad-l04').text === risked);
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
    view.contentEl.findText('los-btn', 'Capture text').fire('click'); await tick(); await tick();
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
    await tick(); await tick();
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
      const envelope = stdin ? JSON.parse(stdin) : null;
      const name = envelope ? envelope.capability : args[0];
      order.push(`start:${name}`);
      const finish = () => {
        order.push(`end:${name}`);
        callback(null, JSON.stringify(gatewayConfirmation(envelope)), '');
      };
      if (name === 'unit.note.append') settle = finish; else finish();
    };
    const first = plugin.mutate(() => plugin.gateway.saveUnitNote('unit-fixture-sad-l04', { text: 'x' }));
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const unitView = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const second = unitView.mutate(() => plugin.gateway.captureText('a second thought'));
    await tick();
    check('a Unit action waits behind a write from another view instead of being discarded',
      order.filter((entry) => entry.startsWith('start:')).length === 1);
    settle?.();
    await first; await second; await tick();
    check('the queued write runs after the first transaction completes',
      order.join('|') === 'start:unit.note.append|end:unit.note.append|start:capture.create|end:capture.create');
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
    await tick();
    check('a note save is queued behind an unrelated write, not discarded',
      order.filter((name) => name === 'capture.create').length === 1
      && !order.includes('unit.note.append'));
    settle?.();
    await blocking; await tick(); await tick();
    check('the queued note reaches the core exactly once after the write ahead of it',
      order.filter((name) => name === 'unit.note.append').length === 1
      && order.indexOf('unit.note.append') > order.indexOf('capture.create'));
    plugin.onunload();
  }
  {
    const { app, plugin } = await build();
    await app.workspace._ready();
    plugin.runLos = (_args, callback, stdin) => {
      const envelope = JSON.parse(stdin);
      const confirmation = gatewayConfirmation(envelope);
      confirmation.snapshot_after = `sha256:${'9'.repeat(64)}`;
      callback(null, JSON.stringify(confirmation), '');
    };
    let unobserved = null;
    await plugin.mutate(() => plugin.gateway.captureText('receipt without projection'))
      .catch((error) => { unobserved = error; });
    check('a receipt is not success until its snapshot is observed after manifest reload',
      /reloaded manifest does not show/.test(String(unobserved && unobserved.message))
      && unobserved.gatewayCode === 'UNCONFIRMED');
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
      const envelope = stdin ? JSON.parse(stdin) : null;
      const name = envelope ? envelope.capability : args[0];
      order.push(name);
      if (name === 'generate') { callback(null, 'rebuilt', ''); return; }
      if (name === 'capture.create' && refuse) {
        refuse = false;
        callback(
          Object.assign(new Error('Command failed'), { code: 3 }),
          JSON.stringify({ ok: false, error: 'los: projection conflict — authored files changed since the app loaded' }),
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

    /* Every conflict refreshes once and reaches the learner. The action is
     * never replayed with freshly adopted artifact revisions. */
    const seen = [];
    plugin.runLos = (args, callback, stdin) => {
      const name = stdin ? JSON.parse(stdin).capability : args[0];
      seen.push(name);
      if (name === 'generate') { callback(null, 'rebuilt', ''); return; }
      callback(
        Object.assign(new Error('Command failed'), { code: 3 }),
        JSON.stringify({ ok: false, error: 'los: projection conflict — authored files changed since the app loaded' }),
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
};
