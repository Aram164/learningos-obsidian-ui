'use strict';
const { boot, VIEW, tick, check, heading, waitFor, Notice } = require('./support');
const { browserDom } = require('./browser-dom');

/**
 * P4 step 29 parity: one task list, three designs, one renderer.
 *
 * Every task runs against the shared list/inspector under the base view and
 * both interface designs. A design that redraws the Atlas fails here, which
 * is the point: spatial presentation belongs to the board, not to a second
 * in-app graph renderer.
 */

const SECTIONS = ['Definition', 'Prerequisites', 'Dependents', 'Related concepts',
  'Path', 'Sources', 'Practice', 'Questions', 'History'];

function patchEvidence(manifest) {
  manifest.relations.push({
    from: 'concept-logistic-regression', type: 'derives', to: 'concept-bayes',
    context: 'Synthetic parity relation.', source: 'source-fixture-book',
    origin: 'aram', status: 'active', pinned: false, status_reason: null,
    evidence_disputed: false,
    evidence: [{
      source_id: 'source-fixture-book', material_relpath: 'fixture/book.pdf',
      file_sha256: 'b'.repeat(64), page: 29, quote: 'Parity quote',
    }],
    evidence_state: 'verified',
  });
}

async function runDesign(design) {
  const { app, plugin, calls } = await boot({
    settings: design === '__base_views__' ? {} : { uiDesign: design },
    patchManifest: patchEvidence,
  });
  const view = () => app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
  const root = () => browserDom(view().contentEl);
  const inspectorText = () => root().find('los-atlas-inspector')[0]?.allText() ?? '';

  await plugin.nav.openAtlas({ concept: 'concept-bayes', lens: 'prerequisites' });
  await waitFor(() => root().find('los-atlas-inspector').length === 1);
  const titles = root().find('los-atlas-section-title').map((node) => node.allText());
  check(`${design}: inspector sections render in the specified order`,
    JSON.stringify(titles) === JSON.stringify(SECTIONS), titles.join('|'));

  // Relation inspector + cross-module endpoint navigation.
  root().find('los-atlas-outline-row')
    .find((row) => row.getAttribute('data-relation-id')
      === 'concept-bayes--requires--concept-bedingte-wahrscheinlichkeit').fire('click');
  await tick();
  check(`${design}: a relation row opens the relation inspector`,
    inspectorText().includes('Selected connection')
    && inspectorText().includes('From') && inspectorText().includes('To'));
  root().find('los-btn')
    .find((btn) => btn.getAttribute('data-row-key') === 'concept:concept-bedingte-wahrscheinlichkeit')
    .fire('click');
  await waitFor(() => view().state.concept === 'concept-bedingte-wahrscheinlichkeit');
  check(`${design}: a named endpoint navigates to the cross-module target`,
    view().state.concept === 'concept-bedingte-wahrscheinlichkeit');

  // Escape closes the connection inspector and focus returns to the row.
  await plugin.nav.openAtlas({ concept: 'concept-bayes', lens: 'prerequisites' });
  await waitFor(() => root().find('los-atlas-inspector').length === 1);
  root().find('los-atlas-outline-row')
    .find((row) => row.getAttribute('data-relation-id')
      === 'concept-bayes--requires--concept-bedingte-wahrscheinlichkeit').fire('click');
  await tick();
  root().find('los-atlas-inspector')[0].fire('keydown', { key: 'Escape' });
  await tick();
  check(`${design}: Escape closes the connection inspector`,
    inspectorText().includes('Selected concept'));

  // Escape cancels an unsubmitted relation editor without writing.
  root().findText('los-btn', 'Connect this concept').fire('click');
  await tick();
  check(`${design}: Connect opens the relation editor`,
    root().find('los-atlas-editor').length === 1);
  root().find('los-atlas-editor')[0].fire('keydown', { key: 'Escape' });
  await tick();
  check(`${design}: Escape closes an unsubmitted relation editor`,
    root().find('los-atlas-editor').length === 0 && calls.envelopes.length === 0);

  // Verified-evidence filter reaches the pinned binding at physical page 29.
  const evidenceSelect = root().find('los-atlas-filter-select')
    .find((select) => select.getAttribute('data-atlas-filter') === 'evidence');
  evidenceSelect.value = 'verified';
  evidenceSelect.fire('change');
  await tick();
  const verifiedRow = root().find('los-atlas-results')[0]?.find('los-btn')
    .find((row) => row.getAttribute('data-relation-id')
      === 'concept-logistic-regression--derives--concept-bayes');
  check(`${design}: the Evidence filter lists only verified connections`,
    Boolean(verifiedRow) && root().find('los-atlas-match-count')[0].allText().includes('match'));
  verifiedRow.fire('click');
  await tick();
  check(`${design}: the inspector shows the binding and its physical page`,
    inspectorText().includes('physical page 29')
    && inspectorText().includes('Parity quote')
    && Boolean(root().findText('los-btn', 'Open evidence')));

  // Filtering out the inspected connection clears selection and announces why.
  const evidenceSelectAfter = root().find('los-atlas-filter-select')
    .find((select) => select.getAttribute('data-atlas-filter') === 'evidence');
  evidenceSelectAfter.value = 'disputed';
  evidenceSelectAfter.fire('change');
  await tick();
  check(`${design}: eliminating a selected connection clears it and announces why`,
    view().edgeId === null
    && root().find('los-atlas-match-count')[0].allText().includes('The selected connection no longer matches the filters.'));
  const restoreEvidence = root().find('los-atlas-filter-select')
    .find((select) => select.getAttribute('data-atlas-filter') === 'evidence');
  restoreEvidence.value = 'verified';
  restoreEvidence.fire('change');
  await tick();

  // Search composes with filters over labels and aliases.
  const clear = root().findText('los-btn', 'Clear filters');
  clear.fire('click');
  await tick();
  const search = root().find('los-atlas-search-input')[0];
  search.value = 'bedingte';
  search.fire('input');
  await tick();
  check(`${design}: alias search finds the concept as a keyboard row`,
    Boolean(root().find('los-btn')
      .find((row) => row.getAttribute('data-row-key') === 'concept:concept-bedingte-wahrscheinlichkeit')));

  // Path lens is an ordered text list.
  await plugin.nav.openAtlas({ concept: 'concept-logistic-regression', lens: 'path' });
  await waitFor(() => root().find('los-atlas-path-step-button').length > 0);
  check(`${design}: the path lens lists ordered steps as buttons`,
    root().find('los-atlas-path-step-button').length >= 2);

  // Authoring surface: pinning sends exactly one guarded replace.
  await plugin.nav.openAtlas({ concept: 'concept-bayes', lens: 'prerequisites' });
  await waitFor(() => root().find('los-atlas-inspector').length === 1);
  root().find('los-atlas-outline-row')
    .find((row) => row.getAttribute('data-relation-id')
      === 'concept-bayes--requires--concept-bedingte-wahrscheinlichkeit').fire('click');
  await tick();
  root().findText('los-btn', 'Pin').fire('click');
  await waitFor(() => Boolean(calls.envelope('concept.relations.change')));
  const pin = calls.envelope('concept.relations.change');
  check(`${design}: pinning sends one guarded exact-row replace`,
    pin?.payload?.change?.operations?.[0]?.new?.pinned === true);

  check(`${design}: questions stay attached to the concept`,
    inspectorText().includes('Selected connection')
    && inspectorText().includes('My questions'));
  plugin.onunload();
}

async function runSafetyAndFocusRegressions() {
  // 1. Focus restore on Escape / Cancel across connect editor, relation action form, and inspector.
  const storedRow = {
    from: 'concept-bayes', type: 'requires', to: 'concept-bedingte-wahrscheinlichkeit', pinned: true,
  };
  let atlasContextMode = 'ok';
  const { app, plugin, calls } = await boot({
    patchManifest: patchEvidence,
    runLosOverride(args, callback, stdin) {
      if (args[0] === 'atlas-context') {
        if (atlasContextMode === 'fail') return callback(new Error('CLI down'), '', 'atlas-context failed');
        if (atlasContextMode === 'missing-relations') return callback(null, JSON.stringify({ ok: true }), '');
        if (atlasContextMode === 'non-array-relations') return callback(null, JSON.stringify({ ok: true, relations: {} }), '');
        return callback(null, JSON.stringify({ ok: true, relations: [storedRow] }), '');
      }
      if (stdin) {
        const env = JSON.parse(stdin);
        return callback(null, JSON.stringify({
          schema_version: 2, request_id: env.request_id, idempotency_key: env.idempotency_key,
          capability: env.capability, ok: true, replayed: false, transaction_id: 'tx-fixture',
          receipt_path: 'operations/transactions/tx-fixture/receipt.json',
          snapshot_after: plugin.store.snapshotId, result: { ok: true, operation_count: 1 }, error: null,
        }), '');
      }
      return callback(null, JSON.stringify({ ok: true }), '');
    },
  });
  try {
    const view = () => app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    const root = () => browserDom(view().contentEl);
    await plugin.nav.openAtlas({ concept: 'concept-bayes', lens: 'prerequisites' });
    await waitFor(() => root().find('los-atlas-inspector').length === 1);

    // Connect editor Escape and Cancel both return focus to Connect button.
    root().findText('los-btn', 'Connect this concept').fire('click');
    await tick();
    root().find('los-atlas-editor')[0].fire('keydown', { key: 'Escape' });
    await tick();
    check('Connect editor Escape returns focus to Connect button',
      global.document.activeElement?.getAttribute('data-row-key') === 'connect-action');

    root().findText('los-btn', 'Connect this concept').fire('click');
    await tick();
    root().findText('los-btn', 'Cancel').fire('click');
    await tick();
    check('Connect editor Cancel returns focus to Connect button',
      global.document.activeElement?.getAttribute('data-row-key') === 'connect-action');

    // Action form Escape returns to Veto trigger, and closing inspector still returns to row.
    const rowId = 'concept-bayes--requires--concept-bedingte-wahrscheinlichkeit';
    root().find('los-atlas-outline-row')
      .find((row) => row.getAttribute('data-relation-id') === rowId).fire('click');
    await tick();
    root().findText('los-btn', 'Veto').fire('click');
    await tick();
    root().find('los-atlas-action-form')[0].fire('keydown', { key: 'Escape' });
    await tick();
    check('Relation action Escape returns focus to action button',
      global.document.activeElement?.getAttribute('data-row-key') === 'relation-action:veto');
    root().findText('los-btn', 'Close connection').fire('click');
    await tick();
    check('Closing relation inspector restores focus to original relation row even after sub-form',
      global.document.activeElement?.getAttribute('data-row-key') === `relation:${rowId}`);

    // Concept switch clears stale relationAction so it does not resurrect when returning.
    root().find('los-atlas-outline-row')
      .find((row) => row.getAttribute('data-relation-id') === rowId).fire('click');
    await tick();
    root().findText('los-btn', 'Veto').fire('click');
    await tick();
    await plugin.nav.openAtlas({ concept: 'concept-logistic-regression', lens: 'prerequisites' });
    await waitFor(() => view().state.concept === 'concept-logistic-regression');
    check('Concept navigation clears relationAction immediately', view().relationAction === null);
    await plugin.nav.openAtlas({ concept: 'concept-bayes', lens: 'prerequisites' });
    await waitFor(() => view().state.concept === 'concept-bayes');
    check('Returning to prior concept does not resurrect stale action form',
      root().find('los-atlas-action-form').length === 0);

    // togglePin negates stored old.pinned (true -> false) even when projected edge.pinned is false.
    root().find('los-atlas-outline-row')
      .find((row) => row.getAttribute('data-relation-id') === rowId).fire('click');
    await tick();
    root().findText('los-btn', 'Pin').fire('click');
    await waitFor(() => calls.envelopes.some((e) => e.capability === 'concept.relations.change'));
    const pinEnv = calls.envelope('concept.relations.change');
    check('togglePin negates exact stored old.pinned instead of stale projected edge.pinned',
      pinEnv?.payload?.change?.operations?.[0]?.new?.pinned === false);

    // exactRow CLI failure surfaces Notice and aborts write without opening editor or sending envelope.
    const beforeEnvelopes = calls.envelopes.length;
    const beforeNotices = Notice.log.length;
    atlasContextMode = 'fail';
    root().findText('los-btn', 'Pin').fire('click');
    await waitFor(() => Notice.log.length > beforeNotices);
    check('exactRow CLI failure shows Notice and aborts togglePin write',
      Notice.log.length > beforeNotices && calls.envelopes.length === beforeEnvelopes);
    const noticesBeforeEdit = Notice.log.length;
    root().findText('los-btn', 'Edit').fire('click');
    await waitFor(() => Notice.log.length > noticesBeforeEdit);
    check('exactRow CLI failure shows Notice and aborts opening Edit draft',
      view().editor === null && calls.envelopes.length === beforeEnvelopes);

    // Malformed atlas-context (omitting relations or non-array relations) aborts cleanly with Notice.
    const noticesBeforeMissing = Notice.log.length;
    atlasContextMode = 'missing-relations';
    root().findText('los-btn', 'Pin').fire('click');
    await waitFor(() => Notice.log.length > noticesBeforeMissing);
    check('exactRow missing relations shows Notice and aborts togglePin write',
      Notice.log.slice(noticesBeforeMissing).some((msg) => msg.includes('Malformed atlas context response'))
      && calls.envelopes.length === beforeEnvelopes);

    const noticesBeforeNonArray = Notice.log.length;
    atlasContextMode = 'non-array-relations';
    root().findText('los-btn', 'Edit').fire('click');
    await waitFor(() => Notice.log.length > noticesBeforeNonArray);
    check('exactRow non-array relations shows Notice and aborts opening Edit draft',
      Notice.log.slice(noticesBeforeNonArray).some((msg) => msg.includes('Malformed atlas context response'))
      && view().editor === null && calls.envelopes.length === beforeEnvelopes);
  } finally {
    plugin.onunload();
  }
}

module.exports = async function run() {
  heading('Atlas parity: one task list under every design');
  for (const design of ['__base_views__', 'focus', 'study-desk']) {
    await runDesign(design);
  }
  await runSafetyAndFocusRegressions();
};
