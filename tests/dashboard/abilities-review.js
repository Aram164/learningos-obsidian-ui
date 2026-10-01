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
const { browserDom } = require('./browser-dom');
const { abilityFocus } = require('../ability-fixtures');
const reviewRow = (root, text) => root.find('los-review-item').find((row) => row.allText().includes(text)) ?? null;

module.exports = async function run() {
  heading('the Atlas ability plane: complete loaded groups, one-hop attention, explicit evidence and camera');
  {
    const { app, plugin, calls } = await boot();
    await plugin.nav.openAbilities();
    const root = () => leafOf(app, VIEW.abilities).contentEl;
    await waitFor(() => root().find('los-ability-node').length === 6);
    check('the ability section displays every loaded group from one bounded read',
      root().find('los-ability-node').length === 6
      && new Set(root().find('los-ability-node').map((node) => node.getAttribute('data-ability'))).size === 6
      && root().find('los-ability-region-head').length === 3
      && root().allText().includes('6 of 6 abilities loaded')
      && calls.some((args) => args.join(' ') === 'ability-context --limit 50')
      && leafOf(app, VIEW.nav).contentEl.findText('los-app-nav-item', 'Atlas')?.classes.has('is-active'));
    const outline = root().find('los-ability-edge-outline')[0]?.children.map((item) => item.allText()) ?? [];
    check('the reduced preparation graph stays available as text with all full routes retained',
      outline.length === 3
      && outline.includes('Apply the probability axioms to finite events prepares Compute a conditional probability from a joint table')
      && !outline.some((line) => line.includes('Apply the probability axioms to finite events prepares Invert')));
    check('reviewed bridges are explicitly disclosed, never preparation arrows',
      root().find('los-ability-bridge').length === 0
      && Boolean(root().findText('los-btn', 'Bridges · 1')));
    const cameraBefore = JSON.stringify(leafOf(app, VIEW.abilities).attention.camera);
    const readsBefore = calls.filter((args) => args[0] === 'ability-context').length;
    abilityNode(root(), 'ability-fixture-bayes-m2').fire('click');
    await waitFor(() => Boolean(root().find('los-ability-selection-dock')[0]));
    check('selection highlights only immediate reduced-edge neighbours and opens no evidence inspector or read',
      abilityNode(root(), 'ability-fixture-bayes-m2').classes.has('is-selected')
      && abilityNode(root(), 'ability-fixture-conditional').classes.has('is-neighbour')
      && abilityNode(root(), 'ability-fixture-probability-rules').classes.has('is-muted')
      && !abilityNode(root(), 'ability-fixture-bayes-aml').classes.has('is-neighbour')
      && root().find('los-ability-inspector').length === 0
      && calls.filter((args) => args[0] === 'ability-context').length === readsBefore
      && JSON.stringify(leafOf(app, VIEW.abilities).attention.camera) === cameraBefore);
    root().findText('los-btn', 'Routes').fire('click');
    check('Routes discloses complete authored AND membership including transitive foundation',
      root().find('los-ability-inspector')[0].allText().includes('Apply the probability axioms to finite events')
      && root().find('los-ability-inspector')[0].allText().includes('Compute a conditional probability from a joint table')
      && root().find('los-ability-inspector')[0].allText().includes('All members of a route are required together')
      && JSON.stringify(leafOf(app, VIEW.abilities).attention.camera) === cameraBefore);
    root().findText('los-btn', 'Close routes').fire('click');
    root().findText('los-btn', 'Bridges · 1').fire('click');
    check('reviewed immediate bridge peer has separate styling and count',
      abilityNode(root(), 'ability-fixture-bayes-aml').classes.has('is-bridged')
      && root().find('los-ability-selection-dock')[0].allText().includes('1 reviewed bridge peers')
      && root().find('los-ability-bridge').length === 1);
    const band = root().find('los-ability-bridge')[0];
    const bridgeViewport = root().find('los-ability-viewport')[0];
    const bandTarget = { closest: () => band };
    const pointer = (kind, values) => bridgeViewport.listeners[kind].forEach((listener) => listener({
      target: bandTarget, preventDefault() {}, ...values,
    }));
    const beforeBandDrag = JSON.stringify(leafOf(app, VIEW.abilities).attention.camera);
    pointer('pointerdown', { button: 0, pointerId: 22, clientX: 200, clientY: 100 });
    pointer('pointermove', { pointerId: 22, clientX: 280, clientY: 140 });
    pointer('pointerup', { pointerId: 22 }); band.fire('click');
    check('bridge-origin drag neither pans the canvas nor opens bridge detail',
      root().find('los-ability-inspector').length === 0 && JSON.stringify(leafOf(app, VIEW.abilities).attention.camera) === beforeBandDrag);
    pointer('pointerdown', { button: 0, pointerId: 23, clientX: 200, clientY: 100 });
    pointer('pointermove', { pointerId: 23, clientX: 202, clientY: 101 });
    pointer('pointerup', { pointerId: 23 }); band.fire('click');
    const bridgePanel = root().find('los-ability-inspector')[0];
    check('bridge inspector retains reviewed conditions, source and freshness',
      bridgePanel.allText().includes('stated prior and likelihoods')
      && bridgePanel.allText().includes('knowledge/notes/note-fixture-bayes-bridge.md')
      && bridgePanel.allText().includes('Source current'));
    bridgePanel.findText('los-btn', 'Close bridge').fire('click');
    abilityNode(root(), 'ability-fixture-conditional').fire('click');
    await waitFor(() => root().find('los-ability-selection-dock')[0]?.allText().includes('Compute a conditional'));
    root().findText('los-btn', 'Details').fire('click');
    await waitFor(() => root().find('los-ability-inspector')[0]?.allText().includes('Compute P(A|B)'));
    const inspector = root().find('los-ability-inspector')[0];
    check('Details explicitly expands one snapshot-bound record and retains recorded evidence semantics',
      inspector.allText().includes('Compute P(A|B) from a joint table and name the conditioning event.')
      && inspector.allText().includes('No learner attempt has been recorded.')
      && calls.some((args) => args.join(' ') === `ability-context ability-fixture-conditional --expected-snapshot ${FIXTURE_SNAPSHOT}`)
      && JSON.stringify(leafOf(app, VIEW.abilities).attention.camera) === cameraBefore);
    root().findText('los-btn', 'Open full ability detail').fire('click');
    await waitFor(() => root().find('los-ability-detail').length === 1);
    const detail = root().find('los-ability-detail')[0];
    check('full ability detail preserves conditions, encounters and explicit draft actions',
      detail.allText().includes('joint table given') && detail.allText().includes('names the conditioning event')
      && Boolean(detail.findText('los-btn', 'Open stage'))
      && !detail.findText('los-btn', 'Draft a worked attempt').disabled
      && detail.allText().includes('Completing a stage never records ability evidence.'));
    root().findText('los-btn', 'Back to map').fire('click');
    await waitFor(() => root().find('los-ability-viewport').length === 1);
    check('return from full detail restores presentation camera without persisting it into the route',
      JSON.stringify(leafOf(app, VIEW.abilities).attention.camera) === cameraBefore
      && !Object.hasOwn(leafOf(app, VIEW.abilities).getState(), 'camera'));
    const beforeFold = root().find('los-ability-node').map((node) => [node.getAttribute('data-ability'), node.getAttribute('style')]);
    root().find('los-ability-endcap').find((cap) => cap.getAttribute('data-fold-ability') === 'ability-fixture-conditional').fire('click');
    check('folding hides only records without another expanded claim while preserving selected anchor',
      root().find('los-ability-node').length === 4 && Boolean(abilityNode(root(), 'ability-fixture-conditional'))
      && !abilityNode(root(), 'ability-fixture-bayes-m2')
      && root().allText().includes('2 folded preparation connections')
      && JSON.stringify(leafOf(app, VIEW.abilities).attention.camera) === cameraBefore);
    root().find('los-ability-endcap').find((cap) => cap.getAttribute('data-fold-ability') === 'ability-fixture-conditional').fire('click');
    check('reopening restores same unique identities at stable positions',
      JSON.stringify(root().find('los-ability-node').map((node) => [node.getAttribute('data-ability'), node.getAttribute('style')])) === JSON.stringify(beforeFold));
    root().find('los-btn').find((button) => button.getAttribute('aria-label') === 'Zoom in').fire('click');
    const zoomed = leafOf(app, VIEW.abilities).attention.camera.scale;
    const search = root().find('los-ability-search')[0]; search.value = 'naive'; search.fire('input'); await frame();
    check('search finds a loaded title and offers every match', root().find('los-ability-search-hit').length === 1);
    root().find('los-ability-search-hit')[0].fire('click');
    await waitFor(() => abilityNode(root(), 'ability-fixture-bayes-aml').getAttribute('aria-pressed') === 'true');
    check('search-to-selection reveals existing identity without resetting camera scale', leafOf(app, VIEW.abilities).attention.camera.scale === zoomed);
    const clicked = abilityNode(root(), 'ability-fixture-logistic');
    leafOf(app, VIEW.abilities).attention.lastActivation = null;
    clicked.fire('click', { detail: 1 });
    await waitFor(() => abilityNode(root(), 'ability-fixture-logistic').getAttribute('aria-pressed') === 'true');
    const replacement = abilityNode(root(), 'ability-fixture-logistic');
    const beforeSecondClick = JSON.stringify(leafOf(app, VIEW.abilities).attention.camera);
    replacement.fire('click', { detail: 1 });
    check('double activation fits after the first click replaces the DOM target',
      clicked !== replacement && JSON.stringify(leafOf(app, VIEW.abilities).attention.camera) !== beforeSecondClick);
    let escapeTransitions = 0;
    const originalOpen = plugin.nav.openAbilities.bind(plugin.nav);
    plugin.nav.openAbilities = (...args) => { escapeTransitions++; return originalOpen(...args); };
    const focusedNode = abilityNode(root(), 'ability-fixture-logistic');
    const oldViewport = root().find('los-ability-viewport')[0];
    const escape = { key: 'Escape', target: focusedNode, defaultPrevented: false, stopped: false,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } };
    focusedNode.listeners.keydown[0](escape);
    for (const listener of oldViewport.listeners.keydown) listener(escape);
    check('one Escape action clears selection with exactly one route transition', escapeTransitions === 1 && escape.stopped);
    plugin.nav.openAbilities = originalOpen;
    check('all canvas interaction remains read-only', calls.envelopes.length === 0);
    plugin.onunload();
  }

  heading('bounded ability horizons and snapshot reconciliation stay honest');
  {
    const { app, plugin } = await boot({ patchBrief: (brief) => { brief.total = 70; brief.truncated = true; } });
    await plugin.nav.openAbilities(); const root = () => leafOf(app, VIEW.abilities).contentEl;
    await waitFor(() => root().find('los-ability-node').length === 6);
    check('loaded/total scope remains explicit and never implies global completeness',
      root().allText().includes('6 of 70 abilities loaded · bounded horizon')
      && root().allText().includes('Unloaded prerequisites remain named in Routes'));
    plugin.onunload();
  }

  heading('general shared-foundation folding retains convergent identities');
  {
    const { app, plugin } = await boot({ patchBrief: (brief) => {
      const byId = new Map(brief.abilities.map((row) => [row.id, row]));
      const gate = (members) => ({ reason: 'Disposable shared-foundation gate', source: 'knowledge/notes/fixture.md', supported: [], missing_or_uncertain: members, remaining_work: members });
      byId.get('ability-fixture-conditional').preparation_routes = [];
      for (const id of ['ability-fixture-bayes-m2', 'ability-fixture-bayes-aml']) byId.get(id).preparation_routes = [gate(['ability-fixture-probability-rules', 'ability-fixture-conditional'])];
      byId.get('ability-fixture-logistic').preparation_routes = [gate(['ability-fixture-bayes-m2']), gate(['ability-fixture-bayes-aml'])];
    } });
    await plugin.nav.openAbilities(); const root = () => leafOf(app, VIEW.abilities).contentEl;
    await waitFor(() => root().find('los-ability-node').length === 6);
    const before = root().find('los-ability-node').map((node) => [node.getAttribute('data-ability'), node.getAttribute('style')]);
    const cap = (id) => root().find('los-ability-endcap').find((node) => node.getAttribute('data-fold-ability') === id);
    cap('ability-fixture-probability-rules').fire('click');
    check('withdrawing one foundation retains shared local targets through the other path',
      root().find('los-ability-node').length === 6
      && root().find('los-ability-edge-outline')[0].children.filter((row) => row.allText().includes('· folded')).length === 2
      && Boolean(abilityNode(root(), 'ability-fixture-bayes-m2')) && Boolean(abilityNode(root(), 'ability-fixture-bayes-aml')));
    cap('ability-fixture-conditional').fire('click');
    check('folding both claims removes only downstream unanchored records', root().find('los-ability-node').length === 3);
    cap('ability-fixture-probability-rules').fire('click'); cap('ability-fixture-conditional').fire('click');
    check('general shared frontier reopens with exact ID and position parity',
      JSON.stringify(root().find('los-ability-node').map((node) => [node.getAttribute('data-ability'), node.getAttribute('style')])) === JSON.stringify(before));
    plugin.onunload();
  }

  heading('empty/stale horizons and changed snapshots do not retain vanished presentation records');
  {
    let phase = 0;
    const { app, plugin } = await boot({ patchBrief: (brief) => {
      if (!phase) return;
      brief.snapshot_id = `sha256:${'a'.repeat(64)}`;
      brief.abilities = brief.abilities.filter((row) => row.id !== 'ability-fixture-conditional');
      brief.total = brief.abilities.length;
    } });
    await plugin.nav.openAbilities(); const root = () => leafOf(app, VIEW.abilities).contentEl;
    await waitFor(() => root().find('los-ability-node').length === 6);
    const view = leafOf(app, VIEW.abilities);
    view.attention.folded.add('ability-fixture-conditional'); view.attention.retained.add('ability-fixture-conditional');
    const camera = JSON.stringify(view.attention.camera); phase = 1;
    await plugin.abilityHorizon.refresh();
    await waitFor(() => root().find('los-ability-node').length === 5);
    check('changed snapshot removes stale folds/anchors, retains overlapping world camera and reports stale projection',
      !view.attention.folded.has('ability-fixture-conditional') && !view.attention.retained.has('ability-fixture-conditional')
      && JSON.stringify(view.attention.camera) === camera && root().allText().includes('records changed since the projection'));
    plugin.onunload();
    const emptyContext = await boot({ patchBrief: (brief) => { brief.abilities = []; brief.total = 0; brief.bridges = []; brief.candidate_connections = []; } });
    await emptyContext.plugin.nav.openAbilities();
    const emptyRoot = leafOf(emptyContext.app, VIEW.abilities).contentEl;
    await waitFor(() => emptyRoot.allText().includes('No abilities are mapped yet'));
    check('empty corpus remains an honest accessible empty state', emptyRoot.find('los-ability-node').length === 0 && emptyRoot.allText().includes('An empty map says nothing about what you know'));
    emptyContext.plugin.onunload();
  }

  heading('focused details outside the horizon never stitch extra records into the plane');
  {
    const { app, plugin, calls } = await boot({ patchBrief: (brief) => {
      brief.abilities = brief.abilities.filter((row) => row.id !== 'ability-fixture-bayes-m2');
      brief.bridges = []; brief.truncated = true;
    } });
    await plugin.nav.openAbilities({ ability: 'ability-fixture-bayes-m2' });
    const root = () => leafOf(app, VIEW.abilities).contentEl;
    await waitFor(() => Boolean(root().findText('los-btn', 'Read requested ability')));
    check('outside-horizon deep link retains its requested identity and offers explicit focused read',
      root().allText().includes('outside this loaded horizon') && root().find('los-ability-node').length === 5);
    root().findText('los-btn', 'Read requested ability').fire('click');
    await waitFor(() => root().find('los-ability-detail').length === 1 && root().allText().includes('stated prior and likelihoods'));
    check('outside focused detail uses the original snapshot and does not expand global scope',
      root().allText().includes('Invert a conditional probability with Bayes theorem')
      && calls.some((args) => args.join(' ') === `ability-context ability-fixture-bayes-m2 --expected-snapshot ${FIXTURE_SNAPSHOT}`)
      && plugin.abilityHorizon.current().abilities.length === 5);
    root().findText('los-btn', 'Back to map').fire('click');
    await waitFor(() => root().find('los-ability-node').length === 5);
    check('return keeps bounded corpus and camera while restoring outside-horizon notice',
      root().find('los-ability-node').length === 5 && root().allText().includes('5 of 6 abilities loaded'));
    plugin.onunload();
  }

  heading('focused responses are bound to requested identity and snapshot before any presentation');
  for (const outside of [false, true]) for (const mismatch of ['identity', 'snapshot']) {
    const requested = outside ? 'ability-fixture-bayes-m2' : 'ability-fixture-conditional';
    const sentinel = `FOREIGN ${mismatch.toUpperCase()} CLAIM`;
    const { app, plugin, calls } = await boot({
      patchBrief: (brief) => {
        if (!outside) return;
        brief.abilities = brief.abilities.filter((row) => row.id !== requested);
        brief.bridges = []; brief.truncated = true;
      },
      patchFocus: (focus) => {
        if (mismatch === 'identity') {
          const wrong = abilityFocus('ability-fixture-logistic');
          Object.keys(focus).forEach((key) => delete focus[key]); Object.assign(focus, wrong);
        } else focus.snapshot_id = `sha256:${'a'.repeat(64)}`;
        focus.ability.claim = sentinel;
      },
    });
    await plugin.nav.openAbilities({ ability: requested, detail: outside });
    const root = () => leafOf(app, VIEW.abilities).contentEl;
    if (!outside) {
      await waitFor(() => Boolean(root().findText('los-btn', 'Details')));
      root().findText('los-btn', 'Details').fire('click');
    }
    await waitFor(() => Boolean(plugin.abilityHorizon.expansionError(requested)));
    check(`${outside ? 'outside' : 'loaded'} detail refuses foreign ${mismatch} without rendering its claim`,
      plugin.abilityHorizon.expansion(requested) === null && !root().allText().includes(sentinel)
      && root().allText().includes(mismatch === 'identity' ? 'different ability' : 'different snapshot')
      && Boolean(root().findText('los-btn', 'Try again')) && Boolean(root().findText('los-btn', 'Read ability map again'))
      && calls.filter((args) => args[0] === 'ability-context').length === 2
      && plugin.abilityHorizon.current().abilities.length === (outside ? 5 : 6));
    plugin.onunload();
  }

  heading('overview-scale orientation and group fits include branching-region headings');
  {
    const { app, plugin } = await boot({ patchBrief: (brief) => {
      const foundations = brief.abilities.slice(0, 5).map((row) => row.id);
      for (const row of brief.abilities) row.preparation_routes = [];
      brief.abilities[5].preparation_routes = [{ reason: 'All five foundations are authored together', source: null,
        supported: [], missing_or_uncertain: foundations, remaining_work: foundations }];
      brief.bridges = []; brief.candidate_connections = [];
    } });
    await plugin.nav.openAbilities(); const root = () => leafOf(app, VIEW.abilities).contentEl;
    await waitFor(() => root().find('los-ability-node').length === 6);
    root().findText('los-btn', 'Fit group').fire('click');
    const head = root().find('los-ability-region-head')[0];
    const worldY = Number(head.getAttribute('style').match(/top:([0-9.]+)px/)[1]);
    const camera = leafOf(app, VIEW.abilities).attention.camera;
    check('Fit group retains the heading of a five-foundation AND branch', worldY * camera.scale + camera.y >= 43);
    for (let count = 0; count < 5; count++) root().find('los-btn').find((button) => button.getAttribute('aria-label') === 'Zoom out').fire('click');
    check('distant canvas keeps readable group orientation outside its transform',
      root().find('los-ability-viewport')[0].classes.has('is-distant')
      && root().find('los-ability-overview-nav')[0].hidden === false
      && root().find('los-ability-overview-group').length === root().find('los-ability-region-head').length
      && root().find('los-ability-overview-group')[0].allText().includes('6 abilities · 5 preparation connections')
      && root().find('los-ability-canvas')[0].find('los-ability-overview-nav').length === 0);
    root().find('los-ability-overview-group')[0].fire('click');
    const refit = leafOf(app, VIEW.abilities).attention.camera;
    check('overview group action actually fits the retained region', worldY * refit.scale + refit.y >= 43);
    plugin.onunload();
  }

  heading('keyboard bridge attention and simultaneous search labels stay scoped to their leaves');
  {
    const { app, plugin, calls } = await boot(); await plugin.nav.openAbilities();
    const firstView = leafOf(app, VIEW.abilities);
    await waitFor(() => firstView.contentEl.find('los-ability-node').length === 6);
    const root = browserDom(firstView.contentEl);
    root.findText('los-btn', 'Bridges · 1').fire('click');
    const band = root.find('los-ability-bridge')[0]; band.focus().fire('click', { detail: 0 });
    const focusedBand = root.find('los-ability-bridge')[0];
    check('native keyboard bridge activation restores focus by stable bridge identity',
      focusedBand !== band && global.document.activeElement === focusedBand
      && focusedBand.getAttribute('data-los-tab') === band.getAttribute('data-los-tab')
      && focusedBand.closest('[role="group"]').getAttribute('aria-label') === 'Bridge connections');
    root.findText('los-btn', 'Close bridge').focus().fire('click');
    check('closing bridge details returns focus to the retained band', global.document.activeElement === root.find('los-ability-bridge')[0]);
    for (let count = 0; count < 5; count++) root.find('los-btn').find((button) => button.getAttribute('aria-label') === 'Zoom out').fire('click');
    root.find('los-ability-overview-group')[0].focus().fire('click', { detail: 0 });
    check('fitting from keyboard overview transfers focus when its navigation hides',
      root.find('los-ability-overview-nav')[0].hidden && global.document.activeElement === root.find('los-ability-viewport')[0]);
    const secondLeaf = app.workspace.getLeaf(true);
    await secondLeaf.setViewState({ type: VIEW.abilities, state: { layout: 'plane' } });
    const secondRoot = browserDom(secondLeaf.view.contentEl);
    let field = root.find('los-ability-search')[0]; const secondField = secondRoot.find('los-ability-search')[0];
    field.focus();
    for (const char of 'bay') { field.typeText(char); field = root.find('los-ability-search')[0]; }
    check('two ability leaves use independent nested native labels with no duplicate search ID',
      field.getAttribute('id') === null && secondField.getAttribute('id') === null
      && field.parentElement?.tag === 'label' && secondField.parentElement?.tag === 'label'
      && global.document.activeElement === field && field.value === 'bay' && field.selectionStart === 3 && secondField.value === '');
    const firstRoute = JSON.stringify(firstView.getState());
    const firstCamera = JSON.stringify(firstView.attention.camera);
    app.workspace.setActiveLeaf(secondLeaf);
    abilityNode(secondRoot, 'ability-fixture-conditional').fire('click');
    await waitFor(() => secondLeaf.view.state.ability === 'ability-fixture-conditional');
    check('ability selection changes and activates its originating leaf only',
      secondLeaf.view.state.ability === 'ability-fixture-conditional' && app.workspace.active === secondLeaf
      && JSON.stringify(firstView.getState()) === firstRoute && firstView.query === 'bay'
      && JSON.stringify(firstView.attention.camera) === firstCamera);
    secondRoot.findText('los-btn', 'Routes').fire('click');
    secondRoot.find('los-ability-detail-link')[0].fire('click');
    await waitFor(() => secondLeaf.view.state.detail);
    check('full ability detail remains in the selected second leaf',
      secondLeaf.view.state.detail && secondLeaf.view.state.ability === 'ability-fixture-conditional'
      && app.workspace.active === secondLeaf && JSON.stringify(firstView.getState()) === firstRoute);
    secondRoot.findText('los-ability-crumb', 'Plane').fire('click');
    await waitFor(() => !secondLeaf.view.state.detail);
    secondRoot.findText('los-filter-tab', 'List').fire('click');
    await waitFor(() => secondLeaf.view.state.layout === 'list');
    check('return and layout controls preserve the other leaf camera, query and route without Core writes',
      secondLeaf.view.state.layout === 'list' && app.workspace.active === secondLeaf
      && JSON.stringify(firstView.getState()) === firstRoute && firstView.query === 'bay'
      && JSON.stringify(firstView.attention.camera) === firstCamera && calls.envelopes.length === 0);
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
