'use strict';

const { boot, VIEW, check, heading, waitFor, gatewayConfirmation } = require('./support');
const { browserDom } = require('./browser-dom');

module.exports = async function run() {
  heading('Practice context and the exact verification gesture');
  const note = 'note-fixture-probability';
  const item = note + '#A1';
  const digest = 'a'.repeat(64);
  const storedBinding = {
    source_id: 'source-fixture-book',
    material_relpath: 'source-fixture-book/official answers.pdf',
    file_sha256: 'b'.repeat(64),
    page: 29,
  };
  const stored = {
    status: 'source-matched',
    source_bindings: [storedBinding],
    verifications: [{ method: 'official-source', source_binding: storedBinding }],
  };
  let invalid = true;
  const { app, plugin, calls } = await boot({
    patchManifest(manifest) {
      const practice = manifest.records.find((record) => record.id === note);
      practice.role = 'exercise-bank';
      practice.sources = ['source-fixture-book', 'source-fixture-islp'];
      const book = manifest.records.find((record) => record.id === 'source-fixture-book');
      book.material = 'material://source-fixture-book/official answers.pdf#page=2';
      book.material_path = 'materials/topic/book/official answers.pdf';
      const collection = manifest.records.find((record) => record.id === 'source-fixture-islp');
      collection.material = 'material://source-fixture-islp/exercises';
      collection.material_path = 'materials/topic/exercises';
    },
    runLosOverride(args, callback, stdin) {
      if (args[0] === 'practice-context') {
        return callback(null, JSON.stringify({
          schema_version: 1, contract: 'practice-context-v1', snapshot_id: args[3],
          note_id: invalid ? 'note-other' : note, note_revision: 7, practice_index_revision: 3,
          diagnostics: invalid ? [] : ['A9: labeled item has no details answer'], items: [{
            item_id: item, label: 'A1', kind: 'flashcard', prompt: 'Synthetic prompt',
            status: 'unverified', checked: false, ineligibility: ['Fixture content changed'],
            content_sha256: digest, concept_ids: ['concept-bayes'], stored_row: stored,
          }],
        }), '');
      }
      if (stdin) return callback(null, JSON.stringify(gatewayConfirmation(JSON.parse(stdin))), '');
      return callback(null, '{}', '');
    },
  });
  try {
    await plugin.nav.openAtlas({ concept: 'concept-bayes', lens: 'prerequisites' });
    const view = app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
    const root = browserDom(view.contentEl);
    const load = root.findText('los-btn', 'Load practice items');
    load.fire('click');
    await waitFor(() => root.allText().includes('mismatched practice context'));
    check('mismatched note identity refuses before exposing a form',
      root.allText().includes('mismatched practice context') && !root.findText('los-btn', 'Record verification'));
    invalid = false;
    load.fire('click');
    await waitFor(() => root.findText('los-btn', 'Record verification'));
    check('Atlas displays exact item, kind, status and ineligibility',
      root.allText().includes(item + ' · flashcard · unverified')
      && root.allText().includes('Fixture content changed'));
    check('a diagnostic about another item does not hide this item\'s gesture',
      root.allText().includes('labeled item has no details answer')
      && Boolean(root.findText('los-btn', 'Record verification')));
    root.findText('los-btn', 'Record verification').fire('click');
    check('answer review uses the existing note opener', Boolean(root.findText('los-btn', 'Open note to review answer')));
    const labels = root.find('los-atlas-practice-field').map((row) => row.children[0].text);
    check('the form asks for no digest and no reviewer identity',
      !labels.some((label) => /SHA-256|Reviewer/.test(label)));
    const field = (label) => root.find('los-atlas-practice-field')
      .find((row) => row.children[0].text === label).children[1];
    field('Verification method').value = 'source-matched';
    field('Verification method').fire('change');
    const source = field('Primary evidence source');
    const pdfPath = field('PDF path relative to materials');
    source.value = 'source-fixture-islp';
    source.fire('change');
    check('a directory source requires a specific PDF', pdfPath.value === '');
    source.value = 'source-fixture-book';
    source.fire('change');
    check('a file source prefills the registered material path without its selector',
      pdfPath.value === 'source-fixture-book/official answers.pdf');
    field('Physical PDF page').value = '29';
    field('Evidence excerpt').value = 'Quoted answer';
    root.findText('los-btn', 'Preview verification').fire('click');
    check('preview names exact reviewed fields before sending',
      root.allText().includes('"method": "official-source"')
      && root.allText().includes('"material_relpath": "source-fixture-book/official answers.pdf"')
      && root.allText().includes('"reviewer_id": "aram"')
      && root.allText().includes(`"artifact_sha256": "${digest}"`)
      && !root.allText().includes('Synthetic prompt')
      && !calls.envelope('practice.verification.record'));
    const snapshot = plugin.store.snapshotId;
    root.findText('los-btn', 'Confirm and record').fire('click');
    await waitFor(() => calls.envelope('practice.verification.record'));
    const envelope = calls.envelope('practice.verification.record');
    check('confirmation sends one UI gesture with the reviewed snapshot, exact row and both revisions',
      calls.envelopes.filter((e) => e.capability === 'practice.verification.record').length === 1
      && envelope?.channel === 'ui' && envelope.approval.kind === 'direct-user-gesture'
      && envelope.expected_snapshot === snapshot
      && envelope.expected_revisions[note] === 7
      && envelope.expected_revisions['registry-practice-index'] === 3
      && JSON.stringify(envelope.payload.record.expected_old) === JSON.stringify(stored)
      && !Object.prototype.hasOwnProperty.call(envelope.payload.record.expected_old.source_bindings[0], 'quote')
      && !Object.prototype.hasOwnProperty.call(
        envelope.payload.record.expected_old.verifications[0].source_binding, 'quote',
      )
      && envelope.payload.record.artifact_sha256 === digest);
    check('the reviewed alias, page and excerpt reach Core without a user supplied digest',
      JSON.stringify(envelope.payload.record.source_binding) === JSON.stringify({
        source_id: 'source-fixture-book',
        material_relpath: 'source-fixture-book/official answers.pdf',
        page: 29,
        quote: 'Quoted answer',
      }));

    // Domains lens: live search filtering must keep an open practice form and its focus alive.
    await plugin.nav.openAtlas({ lens: 'domains' });
    const domainRoot = () => browserDom(view.contentEl);
    const selectDomainNote = () => domainRoot().find('los-domain-select-note')
      .find((btn) => btn.getAttribute('data-los-tab') === note);
    await waitFor(() => Boolean(selectDomainNote()));
    selectDomainNote().fire('click');
    await waitFor(() => Boolean(domainRoot().find('los-domain-inspector')[0]
      ?.findText('los-btn', 'Load practice items')));
    domainRoot().find('los-domain-inspector')[0]
      .findText('los-btn', 'Load practice items').fire('click');
    await waitFor(() => Boolean(domainRoot().find('los-domain-inspector')[0]
      ?.findText('los-btn', 'Record verification')));
    const toggle = domainRoot().find('los-domain-inspector')[0]
      .findText('los-btn', 'Record verification');
    toggle.fire('click');
    const inspectorDom = domainRoot().find('los-domain-inspector')[0];
    const formEl = inspectorDom.find('los-atlas-practice-form')[0];
    const excerptInput = inspectorDom.find('los-atlas-practice-field')
      .find((row) => row.children[0].text === 'Evidence excerpt').children[1];
    excerptInput.value = 'Draft excerpt';
    excerptInput.focus();
    const searchInput = domainRoot().find('los-domain-search')[0];
    searchInput.value = 'no-such-note-match';
    searchInput.fire('input');
    const afterSearchInspector = domainRoot().find('los-domain-inspector')[0];
    const afterSearchForm = afterSearchInspector.find('los-atlas-practice-form')[0];
    const afterSearchExcerpt = afterSearchInspector.find('los-atlas-practice-field')
      .find((row) => row.children[0].text === 'Evidence excerpt').children[1];
    check('Domains search input preserves open practice form, draft value and focus',
      afterSearchForm === formEl && afterSearchForm.hidden === false
      && afterSearchExcerpt.value === 'Draft excerpt'
      && global.document.activeElement === afterSearchExcerpt);
    afterSearchForm.fire('keydown', { key: 'Escape' });
    check('Escape inside Domains practice form closes the form and returns focus to its toggle',
      afterSearchForm.hidden === true && global.document.activeElement === toggle);
  } finally {
    plugin.onunload();
  }
};
