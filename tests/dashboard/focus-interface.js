'use strict';
const { boot, check, heading, waitFor, frame, stub, VIEW, FIXTURE_SNAPSHOT } = require('./support');

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
};
