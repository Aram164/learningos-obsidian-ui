'use strict';
const { boot, check, heading, waitFor, frame, stub, VIEW, FIXTURE_SNAPSHOT } = require('./support');
const { browserDom } = require('./browser-dom');

module.exports = async function run() {
  heading('Focus: a third interface preserves design choices and local work');
  {
    const { app, plugin, calls } = await boot({ patchManifest(manifest) {
      const map = manifest.module_source_maps.find(item => item.module_id === 'module-fixture-m2');
      map.sources[0].unit_routes.push({ id: 'route-focus-chapter', unit_id: 'unit-fixture-sad-l04',
        title: 'Focus probability chapter', format: 'book', angle: 'Worked examples',
        depth: 'derivation', scope: 'current', locator: 'Chapter 2', url: 'https://example.com/chapter',
        source_id: 'source-fixture-book', covers: ['knowledge-fixture-conditioning'] });
    } });
    plugin.settings.palette = 'carbon';
    await plugin.setInterfaceDesign('study-desk');
    await plugin.setDesignPalette('lamplight');
    await plugin.setInterfaceDesign('focus');
    const home = app.workspace.getLeavesOfType(VIEW.home)[0].view.contentEl;
    check('Focus is a third registered interface with its own light scheme',
      global.document.body.getAttribute('data-los-ui') === 'focus'
      && global.document.body.getAttribute('data-los-palette') === 'daylight'
      && home.find('focus-resume').length === 1);
    await plugin.setDesignPalette('nightfall');
    await plugin.setInterfaceDesign('classic');
    check('Classic retains Carbon and its own renderer',
      global.document.body.getAttribute('data-los-palette') === 'carbon' && home.find('los-continue').length === 1);
    await plugin.setInterfaceDesign('study-desk');
    check('Study Desk retains Lamplight and its renderer',
      global.document.body.getAttribute('data-los-palette') === 'lamplight' && home.find('sd-hero').length === 1);
    await plugin.setInterfaceDesign('focus');
    check('Focus restores its dark scheme',
      global.document.body.getAttribute('data-los-palette') === 'nightfall');
    const before = calls.envelopes.length;
    home.findText('los-btn', 'Resume session').fire('click');
    await waitFor(() => app.workspace.getLeavesOfType(VIEW.unit).length > 0);
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    check('Resume enters a focused session on the recorded stage', view.contentEl.getAttribute('data-focus-screen') === 'session'
      && view.contentEl.allText().includes('Conditional probability and Bayes'));
    check('an unclassified route leads with its authored action rather than an evaluation placeholder',
      view.contentEl.find('focus-current-work')[0].find('los-material-purpose')[0].allText() === 'Watch');
    const box = view.contentEl.find('focus-criterion')[0].children.find(node => node.tag === 'input');
    box.checked = true; box.fire('change');
    check('criteria update independent local marks and the count without a write',
      view.contentEl.allText().includes('1 of 1') && calls.envelopes.length === before);
    view.contentEl.findText('los-btn', 'Compare all').fire('click');
    check('comparison reconciles every placement in three groups',
      view.contentEl.getAttribute('data-focus-screen') === 'materials'
      && view.contentEl.find('los-material-card').length === 3
      && view.contentEl.allText().includes('Required now · 2')
      && view.contentEl.allText().includes('Depth & reference · 1'));
    view.contentEl.findText('los-filter-tab', 'Unit materials').fire('click');
    check('the complete lecture menu retains source selection', view.contentEl.allText().includes('Choose your learning material')
      && view.contentEl.findText('los-btn', 'Choose') !== null);
    view.contentEl.findText('los-btn', 'Back to session').fire('click');
    check('returning from comparison retains the criterion mark',
      view.contentEl.find('focus-criterion')[0].children.find(node => node.tag === 'input').checked === true);
    view.contentEl.findText('los-btn', 'End session').fire('click');
    const wrapup = view.contentEl.find('focus-wrapup')[0];
    check('wrap-up puts the concrete change review and return point before optional writing',
      wrapup.find('focus-callout')[0].findText('los-btn', 'Review session changes') !== null
      && wrapup.children.indexOf(wrapup.find('focus-return-point')[0]) < wrapup.children.indexOf(wrapup.find('focus-note-editor')[0]));
    const editor = view.contentEl.find('focus-note-editor')[0];
    editor.value = 'A useful stopping point for the next fixture session.'; editor.fire('input');
    check('wrap-up only saves a local unit-note draft', calls.envelopes.length === before
      && plugin.getUnitNoteDraft('unit-fixture-sad-l04').text === editor.value);
    view.contentEl.findText('los-btn', 'Keep studying').fire('click');
    view.contentEl.findText('los-btn', 'End session').fire('click');
    check('wrap-up text survives leaving and returning', view.contentEl.find('focus-note-editor')[0].value === editor.value);
    view.contentEl.findText('los-btn', 'Review and save note').fire('click');
    await frame();
    const modal = stub.Modal.last;
    check('explicit note review opens the existing guarded note dialog with the draft',
      modal.contentEl.getAttribute('role') === 'dialog' && modal.editor.value === editor.value
      && calls.envelopes.length === before);
    modal.contentEl.findText('los-btn', 'Save note').fire('click');
    await waitFor(() => Boolean(calls.envelope('unit.note.append')) && !plugin.gateway.isBusy);
    const envelope = calls.envelope('unit.note.append');
    check('only explicit Save records the unit note under the current snapshot',
      envelope?.payload.unit_id === 'unit-fixture-sad-l04' && envelope?.payload.text === editor.value
      && envelope?.expected_snapshot === FIXTURE_SNAPSHOT);
    await plugin.nav.openUnit('unit-fixture-sad-l04');
    view.contentEl.findText('los-btn', 'Keep studying')?.fire('click');
    if (view.contentEl.getAttribute('data-focus-screen') !== 'session') view.contentEl.findText('los-btn', 'Resume stage')?.fire('click');
    const complete = view.contentEl.findText('los-btn', 'Complete stage');
    complete.fire('click');
    await waitFor(() => Boolean(calls.envelope('stage.progress.update')) && !plugin.gateway.isBusy);
    check('completion uses the shared progress capability and records no learner evidence',
      Boolean(calls.envelope('stage.progress.update'))
      && !calls.envelopes.some(item => item.capability.startsWith('learner.') || item.capability.startsWith('ability.')));
    plugin.onunload();
  }
  heading('Focus: blocked instructions, independent material facets and safe returns');
  {
    const { app, plugin, calls } = await boot({ patchManifest(manifest) {
      const stage = manifest.study_maps.find(item => item.unit_id === 'unit-fixture-sad-l04').stages[1];
      const sourceMap = manifest.module_source_maps.find(item => item.module_id === 'module-fixture-m2');
      sourceMap.sources[0].unit_routes.push({ id: 'route-focus-setup', unit_id: 'unit-fixture-sad-l04',
        title: 'Fixture environment instructions', format: 'documentation', depth: 'implementation', scope: 'current',
        angle: 'Pin the environment before checking the backend.', source_id: 'source-fixture-book', covers: ['knowledge-fixture-conditioning'] },
      { id: 'route-focus-exercise', unit_id: 'unit-fixture-sad-l04', title: 'Fixture parity notebook',
        format: 'code', depth: 'practice', scope: 'current', angle: 'Work through the parity checks.',
        source_id: 'source-fixture-islp', covers: ['knowledge-fixture-conditioning'] },
      { id: 'route-focus-other-unit', unit_id: 'unit-fixture-sad-l02', title: 'Fixture background chapter',
        format: 'book', depth: 'orientation', scope: 'current', angle: 'Prepare for the later lecture.',
        source_id: 'source-fixture-book', covers: ['knowledge-fixture-conditioning'] });
      stage.resources[0] = { id: 'resource-fixture-setup', kind: 'read', route_id: 'route-focus-setup',
        scope_triage: 'required-now', label: 'Freeze the fixture environment', locator: 'fixture.lock',
        angle: 'Pin the environment before checking the backend.',
        angle_detail: 'Run the version probe.\nKeep its exact output with the parity results.' };
      stage.resources[1].scope_triage = 'required-now';
      stage.resources[1].route_id = 'route-focus-exercise';
    } });
    await plugin.setInterfaceDesign('focus');
    await plugin.nav.openUnit('unit-fixture-sad-l04');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const root = browserDom(view.contentEl);
    if (!plugin.store.ready) throw new Error(`Invalid research fixture: ${plugin.store.error}`);
    root.scrollTop = 147;
    const materialTab = root.findText('los-filter-tab', 'Materials');
    materialTab.focus(); materialTab.fire('click');
    check('Plan opens the unit material scope at its heading with a truthful return',
      root.getAttribute('data-focus-screen') === 'materials' && root.scrollTop === 0
      && root.find('focus-title')[0].allText() === 'Unit materials'
      && root.allText().includes('2 material routes for this lecture.')
      && root.findText('los-btn', 'Back to study plan') !== null);
    root.findText('los-btn', 'Back to study plan').fire('click');
    check('Materials returns to the exact Study plan entry and its scroll',
      root.getAttribute('data-focus-screen') === 'plan' && root.scrollTop === 147);
    const sessionTab = root.findText('los-filter-tab', 'Session');
    sessionTab.focus(); sessionTab.fire('click');
    check('focused peer navigation starts Session at its own heading',
      root.scrollTop === 0 && global.document.activeElement.getAttribute('data-los-tab') === 'session');
    const before = calls.envelopes.length;
    const session = view.contentEl.find('focus-stage')[0];
    const work = session.find('focus-current-work')[0];
    check('current work precedes criteria, with the exact authored missing-location instructions',
      session.children.indexOf(work) < session.children.indexOf(session.find('focus-criteria')[0])
      && work.find('los-material-instructions')[0].allText().includes('Run the version probe.\nKeep its exact output with the parity results.')
      && work.allText().includes('Location needed') && work.allText().includes('Access details'));
    check('the next authored required task is inspectable without advancing or waiving setup',
      work.find('focus-next-required')[0].allText().includes('Fixture exercise B3')
      && calls.envelopes.length === before);
    view.contentEl.scrollTop = 272;
    view.contentEl.findText('los-btn', 'Compare all').fire('click');
    const fields = view.contentEl.find('los-material-filter-field');
    const search = fields[0].children.find(node => node.tag === 'input');
    const medium = fields[1].children.find(node => node.tag === 'select');
    const action = fields[2].children.find(node => node.tag === 'select');
    const access = fields[3].children.find(node => node.tag === 'select');
    medium.value = 'code'; medium.fire('change');
    check('a medium filter preserves the full group count and the authored exercise placement',
      view.contentEl.find('los-material-card').length === 1
      && view.contentEl.find('los-material-card')[0].allText().includes('Fixture exercise B3')
      && view.contentEl.allText().includes('1 of 3 materials')
      && view.contentEl.allText().includes('Required now · 1 of 3'));
    action.value = 'read'; action.fire('change');
    check('action and medium are independent, with an honest empty filtered view',
      view.contentEl.find('los-material-card').length === 0
      && view.contentEl.allText().includes('0 of 3 materials')
      && view.contentEl.allText().includes('Clear the filters to restore this group.'));
    view.contentEl.findText('los-btn', 'Clear filters').fire('click');
    access.value = 'none'; access.fire('change');
    check('missing access is searchable without silently omitting required setup',
      view.contentEl.find('los-material-card').some(card => card.allText().includes('Freeze the fixture environment')));
    view.contentEl.findText('los-btn', 'Clear filters').fire('click');
    search.value = 'version probe'; search.focus(); search.setSelectionRange(7, 7); search.fire('input');
    check('search finds authored instructions and retains its focused input and caret',
      view.contentEl.find('los-material-card').length === 1
      && view.contentEl.find('los-material-filter-field')[0].children.includes(search)
      && global.document.activeElement === search && search.selectionStart === 7);
    view.contentEl.findText('los-btn', 'Back to session').fire('click');
    check('returning from Materials restores the same stage and session scroll',
      view.contentEl.scrollTop === 272 && view.contentEl.allText().includes('Freeze the fixture environment'));
    view.contentEl.findText('los-filter-tab', 'Materials').fire('click');
    check('Materials retains its scoped search when revisited',
      view.contentEl.find('los-material-filter-field')[0].children.find(node => node.tag === 'input').value === 'version probe');
    view.contentEl.findText('los-btn', 'Clear filters').fire('click');
    check('clearing all facets restores every placement in authored order without writes',
      view.contentEl.find('los-material-card').map(card => card.find('los-material-title')[0].allText()).join('|')
        === 'Freeze the fixture environment|Fixture exercise B3|Fixture unranked reading'
      && calls.envelopes.length === before);
    root.scrollTop = 196;
    const unitScope = root.findText('los-filter-tab', 'Unit materials');
    unitScope.focus(); unitScope.fire('click');
    check('changing scope uses its own heading, inventory count and scroll context',
      root.scrollTop === 0 && root.find('focus-title')[0].allText() === 'Unit materials'
      && root.allText().includes('2 of 2 materials') && root.find('los-material-option').length === 2);
    const courseScope = root.findText('los-filter-tab', 'Course sources');
    courseScope.focus(); courseScope.fire('click');
    check('course scope names its complete other-lecture inventory without suggesting required study work',
      root.find('focus-title')[0].allText() === 'Course sources'
      && root.allText().includes('1 of 1 materials')
      && root.find('los-material-card')[0].allText().includes('Fixture background chapter'));
    const stageScope = root.findText('los-filter-tab', 'This stage');
    stageScope.focus(); stageScope.fire('click');
    check('returning to stage scope restores its position and complete current-stage count',
      root.scrollTop === 196 && root.find('focus-title')[0].allText() === 'Stage materials'
      && root.allText().includes('3 of 3 materials'));
    const overview = root.findText('los-filter-tab', 'Overview');
    overview.focus(); overview.fire('click');
    root.findText('los-filter-tab', 'Materials').fire('click');
    check('Materials records Overview as a distinct return origin',
      root.findText('los-btn', 'Back to overview') !== null);
    root.findText('los-btn', 'Back to overview').fire('click');
    check('the Overview material round trip retains the overview mode without a write',
      root.getAttribute('data-focus-screen') === 'overview' && calls.envelopes.length === before);
    plugin.onunload();
  }
  heading('Focus: complete row targets and shared feature reachability');
  {
    const { app, plugin } = await boot();
    await plugin.setInterfaceDesign('focus');
    await plugin.nav.openModules();
    const modules = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    const target = modules.contentEl.find('focus-row').find(node => node.allText().includes('Fixture Statistics'));
    check('module whitespace belongs to one native button target', target?.tag === 'button' && !target.children.some(node => node.tag === 'button'));
    target.fire('click');
    await waitFor(() => modules.contentEl.getAttribute('data-focus-screen') === 'module');
    check('the whole module row opens its complete tabbed detail',
      modules.contentEl.allText().includes('Logistics') && modules.contentEl.allText().includes('Resources'));
    modules.contentEl.find('focus-row').find(node => node.allText().includes('Probability & Bayes')).fire('click');
    await waitFor(() => app.workspace.getLeavesOfType(VIEW.unit).length > 0);
    const unit = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    check('opening a lecture starts on its plan with all stages and editing controls',
      unit.contentEl.getAttribute('data-focus-screen') === 'plan' && unit.contentEl.find('focus-row').length === 3
      && unit.contentEl.allText().includes('Sequence for this sitting'));
    unit.contentEl.findText('los-btn', 'Resume stage').fire('click');
    check('compact plan access and every secondary stage action stay reachable',
      unit.contentEl.find('focus-compact-plan').length === 1
      && ['Pause unit', 'Skip stage', 'Prepare shelving', 'Report prerequisite gap'].every(label => unit.contentEl.allText().includes(label)));
    await plugin.nav.openAtlas({ concept: null, lens: 'prerequisites' });
    check('Atlas retains its complete feature renderer',
      app.workspace.getLeavesOfType(VIEW.atlas)[0].view.contentEl.allText().includes('Notes & shelves'));
    plugin.onunload();
  }
  heading('Focus: a placement keeps its route when its stage overrides the locator');
  {
    // Core manifest v18 writes the resolved route_id onto every expanded
    // material_ref. Two routes share one source here; the second placement
    // overrides its locator, so source + locator can no longer find its route.
    const { app, plugin } = await boot({ patchManifest(manifest) {
      const stage = manifest.study_maps.find(item => item.unit_id === 'unit-fixture-sad-l04').stages[1];
      const sourceMap = manifest.module_source_maps.find(item => item.module_id === 'module-fixture-m2');
      sourceMap.sources[0].unit_routes.push(
        { id: 'route-identity-one', unit_id: 'unit-fixture-sad-l04', title: 'Identity part one',
          format: 'book', depth: 'derivation', scope: 'current', locator: 'pdf pp. 1-5',
          angle: 'Part one angle', source_id: 'source-fixture-book', covers: ['knowledge-fixture-conditioning'] },
        { id: 'route-identity-two', unit_id: 'unit-fixture-sad-l04', title: 'Identity part two',
          format: 'book', depth: 'intuition', scope: 'current', locator: 'pdf pp. 6-10',
          angle: 'Part two angle', source_id: 'source-fixture-book', covers: ['knowledge-fixture-conditioning'] });
      stage.resources = [
        { id: 'resource-identity-one', kind: 'read', route_id: 'route-identity-one', source_id: 'source-fixture-book',
          label: 'Identity part one', locator: 'pdf pp. 1-5', angle: 'Part one angle', scope_triage: 'required-now' },
        { id: 'resource-identity-two', kind: 'read', route_id: 'route-identity-two', source_id: 'source-fixture-book',
          label: 'Identity part two', locator: 'pdf p. 7', angle: 'Part two angle', scope_triage: 'required-now' },
        { id: 'resource-identity-unnamed', kind: 'read', source_id: 'source-fixture-book',
          label: 'Identity part two', locator: 'pdf p. 8', angle: 'Part two angle', scope_triage: 'helpful-now' },
      ];
    } });
    await plugin.setInterfaceDesign('focus');
    await plugin.nav.openUnit('unit-fixture-sad-l04');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    if (!plugin.store.ready) throw new Error(`Invalid route-identity fixture: ${plugin.store.error}`);
    view.contentEl.findText('los-filter-tab', 'Session').fire('click');
    view.contentEl.findText('los-btn', 'Compare all').fire('click');
    const cards = view.contentEl.find('los-material-card');
    const card = (locator) => cards.find(item => item.find('los-resource-locator')[0]?.allText() === locator);
    const purpose = (locator) => card(locator)?.find('los-material-purpose')[0].allText();
    check('both placements of the shared source show their own route purpose, the overridden one included',
      cards.length === 3 && purpose('pdf pp. 1-5') === 'Derive it' && purpose('pdf p. 7') === 'Build intuition');
    check('a placement without the id falls back to its authored action, never to a sibling route',
      purpose('pdf p. 8') === 'Read');

  /*
   * A lecture detour (product research 2026-11-11, §5 and the evidence
   * appendix). Course sources → Go to lecture replaces the unit in the same
   * tab. Before Plan B nothing on the destination led back, and the
   * application's Back landed on the origin's Study plan with the comparison,
   * its scope, filters and scroll discarded.
   */
  const ORIGIN = 'unit-fixture-sad-l04';
  const ORIGIN_TITLE = 'SaD Lecture 04 — Probability & Bayes';
  const DESTINATION = 'unit-fixture-sad-l02';
  const otherLectureRoute = (manifest) => {
    manifest.module_source_maps.find(item => item.module_id === 'module-fixture-m2').sources[0].unit_routes.push({
      id: 'route-focus-other-unit', unit_id: DESTINATION, title: 'Fixture background chapter',
      format: 'book', depth: 'orientation', scope: 'current', angle: 'Prepare for the later lecture.',
      source_id: 'source-fixture-book', covers: ['knowledge-fixture-conditioning'] });
  };
  const detourReturn = (view) => view.contentEl.find('los-btn')
    .find(node => node.allText().startsWith(`Back to ${ORIGIN_TITLE}`)) ?? null;
  const criterion = (view) => view.contentEl.find('focus-criterion')[0]?.children.find(node => node.tag === 'input') ?? null;
  const courseQuery = (view) => view.contentEl.find('los-material-filter-field')[0]?.children.find(node => node.tag === 'input') ?? null;
  const where = (view) => `unit=${view.unitId} stage=${view.stageId} screen=${view.contentEl.getAttribute('data-focus-screen')}`
    + ` title=${view.contentEl.find('focus-title')[0]?.allText() ?? ''} scroll=${view.contentEl.scrollTop} query=${courseQuery(view)?.value ?? ''}`
    + ` return=${detourReturn(view)?.allText() ?? 'none'}`;
  /** Stage N of the origin → tick → Compare all → Course sources → filter → scroll → Go to lecture. */
  async function leaveForAnotherLecture(view, stageTitle, { tickCriterion = true, query = 'background', scroll = 333 } = {}) {
    view.contentEl.find('focus-row').find(node => node.getAttribute('aria-label') === `Open stage: ${stageTitle}`).fire('click');
    await waitFor(() => view.contentEl.getAttribute('data-focus-screen') === 'session');
    if (tickCriterion) { const box = criterion(view); box.checked = true; box.fire('change'); }
    view.contentEl.findText('los-btn', 'Compare all').fire('click');
    view.contentEl.findText('los-filter-tab', 'Course sources').fire('click');
    const search = courseQuery(view);
    search.value = query; search.fire('input');
    view.contentEl.scrollTop = scroll;
    view.contentEl.findText('los-btn', 'Go to lecture').fire('click');
    await waitFor(() => view.unitId === DESTINATION);
  }

  heading('Focus: a lecture detour returns to the exact comparison');
  {
    const { app, plugin, calls } = await boot({ patchManifest: otherLectureRoute });
    await plugin.setInterfaceDesign('focus');
    await plugin.nav.openUnit(ORIGIN);
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    check('a lecture opened in the ordinary way offers no detour return', detourReturn(view) === null);
    const callsBefore = calls.length;
    await leaveForAnotherLecture(view, 'Conditional probability and Bayes');
    check('Go to lecture replaces the lecture in the same unit tab',
      view.unitId === DESTINATION && app.workspace.getLeavesOfType(VIEW.unit).length === 1);
    check('the destination names the way back to the origin and its stage',
      detourReturn(view)?.allText() === `Back to ${ORIGIN_TITLE} · Stage 2`, where(view));
    view.contentEl.findText('los-filter-tab', 'Overview')?.fire('click');
    check('the way back survives moving around the destination lecture',
      detourReturn(view) !== null);
    view.contentEl.scrollTop = 0;
    detourReturn(view)?.fire('click');
    await waitFor(() => view.unitId === ORIGIN);
    check('one click returns to the origin comparison, its course scope and its stage',
      view.unitId === ORIGIN && view.stageId === 'stage-fixture-conditioning'
      && view.contentEl.getAttribute('data-focus-screen') === 'materials'
      && view.contentEl.find('focus-title')[0]?.allText() === 'Course sources'
      && view.contentEl.allText().includes('This stage · 3'), where(view));
    check('the return restores the course filter and the scroll position',
      courseQuery(view)?.value === 'background' && view.contentEl.scrollTop === 333, where(view));
    check('a used return is gone', detourReturn(view) === null);
    view.contentEl.findText('los-btn', 'Back to session')?.fire('click');
    check('the criterion ticked before the detour is still ticked',
      view.contentEl.getAttribute('data-focus-screen') === 'session'
      && view.contentEl.allText().includes('Conditional probability and Bayes')
      && criterion(view)?.checked === true);
    check('the whole detour and return makes no gateway or CLI call', calls.length === callsBefore);
    check('remembered lecture attention stays out of the plugin’s saved settings',
      !/materialScope|materialsReturn|Course sources|"background"/.test(JSON.stringify(plugin.settings)));
    await plugin.nav.openUnit(DESTINATION);
    check('reopening the destination in the ordinary way offers no detour return', detourReturn(view) === null);
    plugin.onunload();
  }
  heading('Focus: the application Back also restores the lecture left for a detour');
  {
    const { app, plugin, calls } = await boot({ patchManifest: otherLectureRoute });
    await plugin.setInterfaceDesign('focus');
    await plugin.nav.openUnit(ORIGIN);
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const callsBefore = calls.length;
    await leaveForAnotherLecture(view, 'Conditional probability and Bayes', { scroll: 120 });
    await plugin.nav.back();
    await waitFor(() => view.unitId === ORIGIN);
    check('Back to the origin keeps its comparison, course scope and stage',
      view.unitId === ORIGIN && view.stageId === 'stage-fixture-conditioning'
      && view.contentEl.getAttribute('data-focus-screen') === 'materials'
      && view.contentEl.find('focus-title')[0]?.allText() === 'Course sources'
      && courseQuery(view)?.value === 'background' && view.contentEl.scrollTop === 120, where(view));
    check('showing the origin again ends the detour', detourReturn(view) === null);
    await plugin.nav.openUnit(DESTINATION);
    check('the destination reached afterwards in the ordinary way has no return', detourReturn(view) === null);
    check('Back and ordinary navigation make no gateway or CLI call', calls.length === callsBefore);
    plugin.onunload();
  }
  heading('Focus: a detour return survives a snapshot that removed the origin stage');
  {
    let removeStage = false;
    const { app, plugin } = await boot({ patchManifest(manifest) {
      otherLectureRoute(manifest);
      if (!removeStage) return;
      const map = manifest.study_maps.find(item => item.unit_id === ORIGIN);
      map.stages = map.stages.filter(stage => stage.id !== 'stage-fixture-self-test');
    } });
    await plugin.setInterfaceDesign('focus');
    await plugin.nav.openUnit(ORIGIN);
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    await leaveForAnotherLecture(view, 'Practice and self-test', { tickCriterion: false });
    check('the return names the stage that was open', detourReturn(view)?.allText() === `Back to ${ORIGIN_TITLE} · Stage 3`);
    removeStage = true;
    await plugin.reloadStore();
    detourReturn(view)?.fire('click');
    await waitFor(() => view.unitId === ORIGIN);
    check('a removed origin stage falls back to the recorded current stage',
      view.unitId === ORIGIN && view.stageId === 'stage-fixture-conditioning', where(view));
    check('the fallback still restores the comparison and its course scope',
      view.contentEl.getAttribute('data-focus-screen') === 'materials'
      && view.contentEl.find('focus-title')[0]?.allText() === 'Course sources'
      && view.contentEl.allText().includes('This stage · 3'));
    plugin.onunload();
  }
  heading('Focus: remembered lecture attention is bounded to eight lectures');
  {
    const extras = ['x1', 'x2', 'x3', 'x4'].map(suffix => `unit-fixture-sad-${suffix}`);
    const { app, plugin } = await boot({ patchManifest(manifest) {
      const unit = manifest.units.find(item => item?.id === DESTINATION);
      const map = manifest.study_maps.find(item => item.unit_id === DESTINATION);
      for (const [index, id] of extras.entries()) {
        const mapId = `study-map-fixture-sad-${id.slice(-2)}`;
        manifest.units.push({ ...unit, id, title: `SaD extra lecture ${index + 1}`, order: 10 + index,
          current_study_map: mapId, path: `curriculum/modules/module-fixture-m2/units/${id}.yaml` });
        manifest.study_maps.push({ ...map, id: mapId, unit_id: id,
          path: `curriculum/modules/module-fixture-m2/study-maps/${mapId}.yaml` });
        manifest.indexes.unit_to_study_map[id] = mapId;
      }
    } });
    await plugin.setInterfaceDesign('focus');
    await plugin.nav.openUnit(ORIGIN);
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    view.contentEl.findText('los-filter-tab', 'Materials').fire('click');
    const others = ['unit-fixture-sad-l02', 'unit-fixture-aml-l03', 'unit-fixture-aml-l04',
      'unit-fixture-python-oop', 'unit-fixture-thesis-landscape', ...extras];
    const visit = async (ids) => { for (const id of ids) { await plugin.nav.openUnit(id); await waitFor(() => view.unitId === id); } };
    await visit(others.slice(0, 7));
    await plugin.nav.openUnit(ORIGIN);
    await waitFor(() => view.unitId === ORIGIN);
    check('the synthetic lectures load as ordinary units', plugin.store.ready
      && others.every(id => plugin.store.mapForUnit(id)), plugin.store.error);
    check('a lecture revisited within eight keeps its attention',
      view.contentEl.getAttribute('data-focus-screen') === 'materials', where(view));
    await visit(others.slice(1, 9));
    await plugin.nav.openUnit(ORIGIN);
    await waitFor(() => view.unitId === ORIGIN);
    check('the least recently shown lecture is forgotten once eight others were shown',
      view.contentEl.getAttribute('data-focus-screen') === 'plan', where(view));
    plugin.onunload();
  }
};
