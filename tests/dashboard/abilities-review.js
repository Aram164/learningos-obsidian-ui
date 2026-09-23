'use strict';

/*
 * The Atlas (ability map) and the ability records Review sends.
 *
 * Reads are Core-shaped synthetic answers (tests/ability-fixtures.js). The two
 * guarded writes are asserted on the envelope the gateway would receive: only
 * Review's "Confirm & record" may send one, it sends exactly the record shown,
 * and nothing else in the Atlas writes at all.
 */

const {
  Notice,
  stub,
  VIEW,
  frame,
  waitFor,
  check,
  heading,
  boot,
  FIXTURE_SNAPSHOT,
  gatewayRefusal,
} = require('./support');

const leafOf = (app, type) => app.workspace.getLeavesOfType(type)[0]?.view ?? null;
const abilityNode = (root, id) => root.find('los-ability-node')
  .find((node) => node.getAttribute('data-ability') === id) ?? null;
const reviewRow = (root, text) => root.find('los-review-item').find((row) => row.allText().includes(text)) ?? null;

module.exports = async function run() {
  heading('the Atlas: separate ability groups, directed preparation, distinct bridges');
  {
    const { app, plugin, calls } = await boot();
    const nav = leafOf(app, VIEW.nav).contentEl;
    nav.findText('los-app-nav-item', 'Atlas').fire('click');
    await waitFor(() => Boolean(leafOf(app, VIEW.abilities))
      && leafOf(app, VIEW.abilities).contentEl.find('los-ability-group').length > 0);
    /* A route change may replace the leaf's view, so always read the live one. */
    const root = () => leafOf(app, VIEW.abilities).contentEl;

    check('the Atlas destination opens the ability map from one bounded Core read',
      Boolean(leafOf(app, VIEW.abilities))
      && root().allText().includes('Ability map')
      && calls.filter((args) => args[0] === 'ability-context').length === 1
      && calls.some((args) => args.join(' ') === 'ability-context --limit 50')
      && nav.findText('los-app-nav-item', 'Atlas')?.classes.has('is-active'));

    const groups = root().find('los-ability-group');
    check('ability groups are separate, selectable and counted',
      groups.length === 3
      && groups[0].getAttribute('aria-pressed') === 'true'
      && groups[0].allText().includes('Bayes theorem')
      && groups[0].allText().includes('4 abilities · 1 reviewed bridge')
      && root().allText().includes('Groups are separate; no path joins them.')
      && root().allText().includes('1 tentative connection crosses groups'));

    const outline = root().find('los-ability-edge-outline')[0]?.children.map((item) => item.allText()) ?? [];
    check('the preparation graph is directed, reduced and readable in words',
      root().find('los-ability-node').length === 4
      && outline.length === 3
      && outline.includes('Apply the probability axioms to finite events prepares Compute a conditional probability from a joint table')
      && outline.includes('Compute a conditional probability from a joint table prepares Score a naive Bayes classifier by hand')
      && root().find('los-ability-column-head').map((head) => head.allText()).join('|')
        .startsWith('Foundations'));

    const bands = root().find('los-ability-bridge');
    check('a reviewed bridge is its own band, never a preparation arrow',
      bands.length === 1
      && bands[0].classes.has('is-reviewed')
      && bands[0].classes.has('is-equivalence')
      && !bands[0].classes.has('is-not-current')
      && bands[0].allText().includes('Reviewed equivalence bridge')
      && !outline.some((line) => line.includes('Invert a conditional probability with Bayes theorem prepares')));

    check('state is a word on the node; colour only repeats it',
      abilityNode(root(), 'ability-fixture-probability-rules').allText().includes('Supported')
      && abilityNode(root(), 'ability-fixture-conditional').allText().includes('Nearby')
      && !abilityNode(root(), 'ability-fixture-bayes-m2').allText().includes('Supported')
      && abilityNode(root(), 'ability-fixture-bayes-m2').classes.has('los-ability-state-uncertain')
      && abilityNode(root(), 'ability-fixture-bayes-m2').getAttribute('aria-label').includes('Uncertain'));

    groups.find((group) => group.allText().includes('Logistic regression')).fire('click');
    await waitFor(() => Boolean(abilityNode(root(), 'ability-fixture-logistic')));
    check('choosing another group shows only that group',
      root().find('los-ability-node').length === 1
      && Boolean(abilityNode(root(), 'ability-fixture-logistic'))
      && root().find('los-ability-group').find((group) => group.getAttribute('aria-pressed') === 'true')
        .allText().includes('Logistic regression')
      && root().allText().includes('No learner attempt recorded. Ability states stay uncertain until confirmed work exists.'));

    root().find('los-ability-group')[0].fire('click');
    await waitFor(() => Boolean(abilityNode(root(), 'ability-fixture-conditional')));
    abilityNode(root(), 'ability-fixture-conditional').fire('click');
    await waitFor(() => root().find('los-ability-inspector').length === 1
      && root().find('los-ability-inspector')[0].allText().includes('Compute P(A|B)'));
    const inspector = root().find('los-ability-inspector')[0];
    check('a node click opens the inspector beside the graph',
      Boolean(inspector)
      && root().find('los-ability-groups').length === 0
      && Boolean(root().findText('los-btn', 'All groups'))
      && inspector.allText().includes('Selected ability · M2F')
      && inspector.allText().includes('Nearby')
      && inspector.allText().includes('Compute P(A|B) from a joint table and name the conditioning event.')
      && inspector.allText().includes('Apply the probability axioms to finite events.')
      && inspector.allText().includes('No learner attempt has been recorded.')
      && abilityNode(root(), 'ability-fixture-conditional').getAttribute('aria-pressed') === 'true');
    check('the expansion is snapshot-bound to the horizon it expands',
      calls.some((args) => args.join(' ')
        === `ability-context ability-fixture-conditional --expected-snapshot ${FIXTURE_SNAPSHOT}`));

    root().findText('los-btn', 'Open full ability detail').fire('click');
    await waitFor(() => root().find('los-ability-detail').length === 1);
    const detail = root().find('los-ability-detail')[0];
    check('the inspector opens the full detail with what counts and where it is met',
      detail.allText().includes('Ability · M2F · reviewed 2099-04-01')
      && detail.allText().includes('joint table given')
      && detail.allText().includes('names the conditioning event')
      && Boolean(detail.findText('los-btn', 'Open stage'))
      && !detail.findText('los-btn', 'Draft a worked attempt').disabled
      && detail.allText().includes('Completing a stage never records ability evidence.'));

    root().findText('los-btn', 'Back to map').fire('click');
    await waitFor(() => root().find('los-ability-bridge').length === 1);
    root().find('los-ability-bridge')[0].fire('click');
    await waitFor(() => Boolean(root().findText('los-btn', 'Close bridge')));
    const bridgePanel = root().find('los-ability-inspector')[0];
    check('a bridge opens its own conditions, source and freshness',
      Boolean(bridgePanel)
      && bridgePanel.allText().includes('stated prior and likelihoods')
      && bridgePanel.allText().includes('knowledge/notes/note-fixture-bayes-bridge.md')
      && root().find('los-ability-node').filter((node) => node.classes.has('is-bridged')).length === 2
      && Boolean(bridgePanel.findText('los-btn', 'Close bridge')));

    const search = root().find('los-ability-search')[0];
    search.value = 'naive'; search.fire('input');
    await frame();
    check('search finds an ability by title, course or concept',
      root().find('los-ability-search-hit').length === 1
      && root().find('los-ability-search-hit')[0].allText().includes('Score a naive Bayes classifier by hand'));

    check('reading the map never writes', calls.envelopes.length === 0);
    plugin.onunload();
  }

  heading('the Atlas says what it could not read, and draws nothing it did not read');
  {
    const { app, plugin } = await boot({
      patchBrief: (brief) => { brief.abilities[0].state = 'mastered'; },
    });
    await plugin.nav.openAbilities();
    const root = () => leafOf(app, VIEW.abilities).contentEl;
    await waitFor(() => root().allText().includes('cannot read'));
    check('an unreadable horizon is an explicit error, not an empty or invented map',
      root().allText().includes('Core answered the ability horizon in a shape this build cannot read.')
      && root().find('los-ability-node').length === 0);
    plugin.onunload();
  }

  heading('ability drafts wait in Review; only Confirm & record writes');
  {
    Notice.log.length = 0;
    const { app, plugin, calls } = await boot();
    await plugin.nav.openAbilities({ ability: 'ability-fixture-conditional', detail: true });
    const map = () => leafOf(app, VIEW.abilities).contentEl;
    await waitFor(() => {
      const draft = map().findText('los-btn', 'Draft a worked attempt');
      return Boolean(draft) && !draft.disabled;
    });
    map().findText('los-btn', 'Draft a worked attempt').fire('click');
    const modal = stub.Modal.last.contentEl;
    const selects = modal.find('los-ability-form-select');
    const inputs = modal.find('los-ability-form-input');
    check('the draft form says it records nothing and offers only covering workspaces',
      modal.allText().includes('Nothing is recorded until you confirm the exact claim there')
      && selects[0].value === 'workspace-fixture-m2'
      && selects[selects.length - 1].value.startsWith('curriculum/'));
    inputs[0].value = 'Worked the fixture table exercise.'; inputs[0].fire('input');
    selects[1].value = 'correct'; selects[1].fire('change');
    inputs[1].value = 'none'; inputs[1].fire('input');
    selects[2].value = 'met'; selects[2].fire('change');
    selects[3].value = 'met'; selects[3].fire('change');
    for (const box of modal.find('los-ability-form-check')) box.children[0].checked = true;
    const composed = modal.find('los-ability-form-textarea')[0].value;
    modal.findText('los-btn', 'Save draft').fire('click');
    const drafts = plugin.listAbilityDrafts();
    check('saving a draft keeps it UI-owned and sends nothing',
      drafts.length === 1
      && drafts[0].kind === 'claim'
      && composed === 'Correct attempt · no assistance · every stated condition met'
      && calls.envelopes.length === 0
      && Notice.log.some((line) => line.includes('Nothing is recorded until you confirm it in Review')));

    await plugin.nav.openReview();
    const review = () => leafOf(app, VIEW.review).contentEl;
    await waitFor(() => {
      const confirm = review().findText('los-btn', 'Confirm & record');
      return Boolean(confirm) && !confirm.disabled;
    });
    const row = reviewRow(review(), 'Worked attempt');
    const detail = review().find('los-review-detail')[0];
    check('Review shows the draft first, labelled, with its claim, evidence and effect',
      Boolean(row)
      && review().find('los-review-item')[0] === row
      && row.allText().includes('draft, not recorded')
      && detail.getAttribute('data-review-id') === drafts[0].id
      && detail.allText().includes('Not recorded')
      && detail.allText().includes('Correct attempt · no assistance · every stated condition met')
      && detail.allText().includes('Records one learner-confirmed observation for this ability in Fixture M2 exam prep.')
      && detail.allText().includes('Stage completion stays a separate action.')
      && review().find('los-review-item').length === plugin.store.reviewItems().length + 1);
    check('the navigator counts the draft with the Core queue',
      leafOf(app, VIEW.nav).contentEl.findText('los-app-nav-item', 'Review').find('los-nav-count')[0]?.allText()
        === String(plugin.store.reviewItems().length + 1));

    detail.findText('los-btn', 'Confirm & record').fire('click');
    await waitFor(() => Boolean(calls.envelope('learner.ability-observation.append'))
      && !plugin.gateway.isBusy && plugin.listAbilityDrafts().length === 0);
    const envelope = calls.envelope('learner.ability-observation.append');
    check('Confirm & record sends exactly the reviewed record over the ui channel',
      Boolean(envelope)
      && envelope.channel === 'ui'
      && envelope.payload.confirmation_ref === `conversation://learningos-app/${envelope.idempotency_key}`
      && envelope.payload.ability === 'ability-fixture-conditional'
      && envelope.payload.workspace === 'workspace-fixture-m2'
      && envelope.payload.result === 'correct'
      && envelope.payload.assistance === 'none'
      && envelope.payload.work_ref.startsWith('curriculum/')
      && envelope.payload.claim === 'Correct attempt · no assistance · every stated condition met'
      && envelope.payload.condition.length === 2
      && envelope.payload.evidence_tag.length === 2
      && envelope.expected_snapshot === FIXTURE_SNAPSHOT
      && JSON.stringify(envelope.expected_revisions)
        === JSON.stringify(plugin.store.artifactGuard('workspace-fixture-m2')));
    check('one confirmation is one write: no stage progress, no candidate, and the draft is cleared',
      calls.envelopes.length === 1
      && plugin.listAbilityDrafts().length === 0
      && calls.filter((args) => args[0] === 'ability-context' && args.length <= 3).length >= 2);
    plugin.onunload();
  }

  heading('a refused ability record keeps the draft and says why');
  {
    Notice.log.length = 0;
    const { app, plugin, calls } = await boot({
      runLosOverride: (args, callback, stdin) => {
        const envelope = stdin ? JSON.parse(stdin) : null;
        if (envelope?.capability === 'ability.candidate.append') {
          return callback(null, JSON.stringify(gatewayRefusal(envelope, 'INVALID_REQUEST',
            'from_ability is not a reviewed ability')), '');
        }
        const { answerAbilityRead } = require('../ability-fixtures');
        const read = answerAbilityRead(args);
        return callback(null, JSON.stringify(read ?? { ok: true }), '');
      },
    });
    await plugin.nav.openAbilities({ ability: 'ability-fixture-logistic', detail: true });
    const map = () => leafOf(app, VIEW.abilities).contentEl;
    await waitFor(() => Boolean(map().findText('los-btn', 'Note a possible connection')));
    map().findText('los-btn', 'Note a possible connection').fire('click');
    const modal = stub.Modal.last.contentEl;
    const selects = modal.find('los-ability-form-select');
    const areas = modal.find('los-ability-form-textarea');
    selects[0].value = 'ability-fixture-interval';
    areas[0].value = 'Both reason from a likelihood.';
    areas[1].value = 'One fits, one bounds.';
    modal.findText('los-btn', 'Save draft').fire('click');
    check('a possible connection is drafted, not recorded',
      plugin.listAbilityDrafts().length === 1
      && plugin.listAbilityDrafts()[0].kind === 'connection'
      && calls.envelopes.length === 0);
    await plugin.nav.openReview();
    const review = () => leafOf(app, VIEW.review).contentEl;
    await waitFor(() => {
      const confirm = review().findText('los-btn', 'Confirm & record');
      return Boolean(confirm) && !confirm.disabled;
    });
    check('Review states that a tentative connection carries nothing',
      review().allText().includes('It carries no evidence and changes no ability state or readiness'));
    review().findText('los-btn', 'Confirm & record').fire('click');
    await waitFor(() => Boolean(calls.envelope('ability.candidate.append')) && !plugin.gateway.isBusy
      && Notice.log.some((line) => line.includes('not a reviewed ability')));
    const envelope = calls.envelope('ability.candidate.append');
    check('the candidate names this request as where it was noticed',
      envelope?.payload.source_ref === `conversation://learningos-app/${envelope?.idempotency_key}`
      && envelope?.payload.from_ability === 'ability-fixture-logistic'
      && envelope?.payload.to_ability === 'ability-fixture-interval');
    check('a refusal keeps the draft and shows Core’s reason',
      plugin.listAbilityDrafts().length === 1
      && Notice.log.some((line) => line.includes('from_ability is not a reviewed ability')));
    plugin.onunload();
  }
};
