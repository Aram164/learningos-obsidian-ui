/* Session-end modal flow: review, then commit or dismiss. Fixture-only. */
'use strict';

const {
  stub,
  frame,
  waitFor,
  check,
  heading,
  boot,
  makeApp,
  FIXTURE,
  ROOT,
  VIEW,
} = require('./support');
const { createSourceModuleLoader } = require('../source-module-loader');

module.exports = async function run() {
  heading('session-end review then commit');
  {
    const { plugin, calls } = await boot();
    const sessionEnds = () => calls.filter((args) => args[0] === 'session-end');
    await plugin.reviewSessionEnd();
    const modal = stub.Modal.last;
    await frame();
    const message = modal.contentEl.find('los-search')[0];
    const commitBtn = modal.contentEl.findText('los-btn', 'Commit session-owned files');
    check('End learning session opens the change review with no commit flags and focuses message box',
      sessionEnds().length === 1
      && JSON.stringify(sessionEnds()[0])
        === JSON.stringify(['session-end', '--session-id', 'ui', '--json'])
      && modal?.contentEl?.getAttribute('aria-labelledby') === 'los-session-end-heading'
      && global.document.activeElement === message
      && commitBtn.disabled === true);
    message.value = '   ';
    message.fire('input');
    check('blank commit message keeps Commit session-owned files disabled (#22)',
      commitBtn.disabled === true && commitBtn.getAttribute('aria-disabled') === 'true');
    message.value = 'Evening session';
    message.fire('input');
    check('non-blank commit message with owned changes enables Commit session-owned files (#22)',
      commitBtn.disabled === false);
    commitBtn.fire('click');
    await waitFor(() => sessionEnds().length === 2 && !plugin.gateway.isBusy);
    check('Commit session-owned files commits exactly the reviewed session',
      sessionEnds().length === 2
      && JSON.stringify(sessionEnds()[1]) === JSON.stringify(
        ['session-end', '--session-id', 'ui', '--commit-message', 'Evening session', '--json']));
    plugin.onunload();
  }

  heading('session-end empty owned_changes and double-submit guard (#22)');
  {
    const { plugin, calls } = await boot({
      runLosOverride: (args, callback) => {
        if (args[0] === 'session-end') {
          return callback(null, JSON.stringify({
            ok: true, client: 'ui', committed: false, other_sessions: {},
            owned_changes: [], ownership_conflicts: [], pushed: false,
            session_closed: false, session_id: 'ui', stale_hours: 24,
            stale_paths: [], touched: [], unrelated_changes: ['README.md'],
            validation: 'ok',
          }), '');
        }
        return callback(null, JSON.stringify({ ok: true }), '');
      },
    });
    const sessionEnds = () => calls.filter((args) => args[0] === 'session-end');
    await plugin.reviewSessionEnd();
    const modal = stub.Modal.last;
    await frame();
    const message = modal.contentEl.find('los-search')[0];
    const commitBtn = modal.contentEl.findText('los-btn', 'Commit session-owned files');
    const closeBtn = modal.contentEl.findText('los-btn', 'Close without committing');
    check('empty owned_changes disables message input and commit button, focusing close button',
      message.disabled === true
      && commitBtn.disabled === true
      && global.document.activeElement === closeBtn);
    message.value = 'Should not commit';
    message.fire('input');
    commitBtn.fire('click');
    await frame();
    check('clicking disabled Commit when nothing is owned makes no Core commit call',
      sessionEnds().length === 1);
    modal.close();
    plugin.onunload();
  }

  heading('session-end Commit double-submit guard and error recovery (#22)');
  {
    let finishCommit = null;
    let shouldFail = true;
    const { plugin, calls } = await boot({
      runLosOverride: (args, callback) => {
        if (args[0] === 'session-end') {
          if (args.includes('--commit-message')) {
            finishCommit = () => {
              if (shouldFail) {
                return callback(Object.assign(new Error('commit hook refused'), { code: 1 }), '', 'hook refused');
              }
              return callback(null, JSON.stringify({
                ok: true, client: 'ui', committed: true, other_sessions: {},
                owned_changes: [], ownership_conflicts: [], pushed: false,
                session_closed: true, session_id: 'ui', stale_hours: 24,
                stale_paths: [], touched: [], unrelated_changes: [],
                validation: 'ok',
              }), '');
            };
            return;
          }
          return callback(null, JSON.stringify({
            ok: true, client: 'ui', committed: false, other_sessions: {},
            owned_changes: ['learner/unit-notes/fixture.md'], ownership_conflicts: [], pushed: false,
            session_closed: false, session_id: 'ui', stale_hours: 24,
            stale_paths: [], touched: [], unrelated_changes: [], validation: 'ok',
          }), '');
        }
        return callback(null, JSON.stringify({ ok: true }), '');
      },
    });
    const sessionEnds = () => calls.filter((args) => args[0] === 'session-end');
    await plugin.reviewSessionEnd();
    const modal = stub.Modal.last;
    await frame();
    const message = modal.contentEl.find('los-search')[0];
    const commitBtn = modal.contentEl.findText('los-btn', 'Commit session-owned files');
    message.value = 'Retryable commit';
    message.fire('input');
    commitBtn.fire('click');
    check('clicking Commit disables button immediately and sets Committing… label',
      commitBtn.disabled === true && commitBtn.allText() === 'Committing…');
    commitBtn.fire('click');
    await waitFor(() => sessionEnds().length === 2);
    await frame();
    check('double-clicking Commit while in flight sends only one session-end commit command',
      sessionEnds().length === 2);
    finishCommit();
    await waitFor(() => !plugin.gateway.isBusy && commitBtn.disabled === false);
    check('failed commit restores Commit button label and enabled state',
      commitBtn.allText() === 'Commit session-owned files' && commitBtn.disabled === false);

    shouldFail = false;
    commitBtn.fire('click');
    await waitFor(() => sessionEnds().length === 3);
    finishCommit();
    await waitFor(() => !plugin.gateway.isBusy);
    modal.close();
    plugin.onunload();
  }

  heading('UnitMapImportModal and StructuralEditModal set initialFocus through makeModalAccessible (#22)');
  {
    const load = createSourceModuleLoader(ROOT, { obsidian: stub });
    const { UnitMapImportModal, StructuralEditModal } = load('src/features/unit/map-import.ts');
    const app = makeApp(FIXTURE);
    const importModal = new UnitMapImportModal(app, {
      unitId: 'unit-fixture-sad-l04',
      unitTitle: 'Fixture SaD L04',
      replacing: true,
      check: async () => ({}),
      submit: async () => ({}),
    });
    importModal.open();
    await frame();
    const fileField = importModal.contentEl.find('los-map-import-field')[0]?.children[1];
    check('UnitMapImportModal focuses path input via makeModalAccessible on animation frame',
      Boolean(fileField) && global.document.activeElement === fileField);
    importModal.close();

    const structuralModal = new StructuralEditModal(app, {
      studyMap: {
        id: 'study-map-fixture',
        unitId: 'unit-fixture-sad-l04',
        title: 'Fixture map',
        stages: [{
          id: 'stage-1', title: 'Stage 1', objective: 'Learn', status: 'pending',
          isOpen: true, resources: [], criteria: [], concepts: [],
        }],
      },
      materials: [],
      check: async () => ({}),
      submit: async () => ({}),
    });
    structuralModal.open();
    await frame();
    const actionSelect = structuralModal.contentEl.find('los-map-import-field')[0]?.children[0];
    check('StructuralEditModal focuses Change select via makeModalAccessible on animation frame',
      Boolean(actionSelect) && global.document.activeElement === actionSelect);
    structuralModal.close();
  }

  heading('session-end close without committing');
  {
    const { plugin, calls } = await boot();
    await plugin.reviewSessionEnd();
    const modal = stub.Modal.last;
    const before = calls.length;
    modal.contentEl.findText('los-btn', 'Close without committing').fire('click');
    await frame();
    check('Close without committing makes no Core call',
      calls.length === before);
    plugin.onunload();
  }
};
