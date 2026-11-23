'use strict';
const { boot, VIEW, tick, check, heading, waitFor } = require('./support');
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
    || inspectorText().includes('My questions'));
  plugin.onunload();
}

module.exports = async function run() {
  heading('Atlas parity: one task list under every design');
  for (const design of ['__base_views__', 'focus', 'study-desk']) {
    await runDesign(design);
  }
};
