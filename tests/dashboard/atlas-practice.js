'use strict';

const { boot, VIEW, check, heading, waitFor, gatewayConfirmation } = require('./support');
const { browserDom } = require('./browser-dom');

module.exports = async function run() {
  heading('Practice context and the exact verification gesture');
  const note = 'note-fixture-probability';
  const item = note + '#A1';
  const digest = 'a'.repeat(64);
  const stored = { status: 'source-matched', verifications: [{ method: 'official-source' }] };
  let invalid = true;
  const { app, plugin, calls } = await boot({
    patchManifest(manifest) {
      manifest.records.find((record) => record.id === note).role = 'exercise-bank';
    },
    runLosOverride(args, callback, stdin) {
      if (args[0] === 'practice-context') {
        return callback(null, JSON.stringify({
          schema_version: 1, contract: 'practice-context-v1', snapshot_id: args[3],
          note_id: invalid ? 'note-other' : note, note_revision: 7, practice_index_revision: 3,
          diagnostics: [], items: [{
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
    root.findText('los-btn', 'Record verification').fire('click');
    check('answer review uses the existing note opener', Boolean(root.findText('los-btn', 'Open note to review answer')));
    const field = (label) => root.find('los-atlas-practice-field')
      .find((row) => row.children[0].text === label).children[1];
    field('Verification method').value = 'confirmed';
    field('Verification method').fire('change');
    field('Reviewer ID').value = 'synthetic-reviewer';
    field('Review artifact SHA-256').value = digest;
    root.findText('los-btn', 'Preview verification').fire('click');
    check('preview names exact reviewed fields before sending',
      root.allText().includes('"method": "explicit-review"')
      && root.allText().includes('"reviewer_id": "synthetic-reviewer"')
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
      && JSON.stringify(envelope.payload.record.expected_old) === JSON.stringify(stored));
  } finally {
    plugin.onunload();
  }
};
