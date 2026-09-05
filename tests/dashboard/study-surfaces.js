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
  FIXTURE_SNAPSHOT,
  NOTE_ATTACHMENT_FIXTURE_PATH,
  fileDigest,
  VIEW,
  tick,
  frame,
  waitFor,
  check,
  heading,
  build,
  boot,
} = require('./support');

module.exports = async function run() {
  heading('module and component ownership');
  {
    const { app, plugin } = await boot();
    await plugin.nav.openModules();
    let view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    let text = view.contentEl.allText();
    check('Modules contains only the current semester',
      view.screen === 'groups'
      && view.contentEl.find('los-semester-module-row').length === 2
      && text.includes('SoSe 2099')
      && text.includes('Fixture Statistics & Analysis')
      && text.includes('Fixture Advanced ML')
      && !text.includes('Python')
      && view.contentEl.find('los-group-card').length === 0);
    view.contentEl.findText('los-semester-module-row', 'Fixture Statistics & Analysis')
      .fire('click'); await tick();
    view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    text = view.contentEl.allText();
    check('a module opens as a full-page detail route',
      view.screen === 'detail' && plugin.router.snapshot().current.name === 'module-detail');
    /* Units is the default: a learner opens a module to study, not to read a
     * credit count. Administration is one tab away, never in the header. */
    check('the module opens on Units, not on administration',
      view.contentEl.find('los-module-unit-list').length === 1
      && view.contentEl.find('los-record-row').length > 0);
    check('the header carries one line of facts, not six labelled rows',
      view.contentEl.find('los-module-facts').length === 1
      && !text.includes('Institution') && !text.includes('Credits'));
    check('structured component controls render', text.includes('SaD') && text.includes('Analysis'));
    check('Lecture 02 and Lecture 04 retain distinct state', text.includes('Lecture 02') && text.includes('Lecture 04')
      && text.includes('ready') && text.includes('active'));
    const orderedUnitText = view.contentEl.find('los-module-unit-list')[0].allText();
    check('module units follow canonical unit_order instead of status or title',
      orderedUnitText.indexOf('Lecture 02') < orderedUnitText.indexOf('Lecture 04')
      && orderedUnitText.indexOf('Lecture 04') < orderedUnitText.indexOf('Analysis exam prep'));
    check('needs-map is explicit', text.includes('needs map') || text.includes('needs-map'));
    view.contentEl.findText('los-btn', 'Analysis').fire('click'); await tick();
    view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    const unitText = view.contentEl.find('los-module-unit-list')[0].allText();
    check('component selection filters units without merging state', unitText.includes('Analysis exam prep') && !unitText.includes('Lecture 04'));
    view.contentEl.findText('los-btn', 'Logistics').fire('click'); await tick();
    view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    text = view.contentEl.allText();
    check('academic facts stay on the academic module with human labels',
      text.includes('Fixture University')
      && text.includes('Written exam')
      && text.includes('Summer semester 2099')
      && !text.includes('klausur')
      && !text.includes('sose-2099')
      && text.includes('10'));
    check('logistics does not block unit browsing',
      view.contentEl.find('los-module-unit-list').length === 0);
    view.contentEl.findText('los-btn', 'Overview').fire('click'); await tick();
    text = app.workspace.getLeavesOfType(VIEW.module)[0].view.contentEl.allText();
    check('related workspaces render their next action instead of a raw CONTEXT link',
      text.includes('Next action') && text.includes('Work the Conditional probability and Bayes stage'));
    await plugin.nav.back();
    view = app.workspace.getLeavesOfType(VIEW.module)[0].view;
    check('Back restores the current-semester module list',
      view.screen === 'groups'
      && view.contentEl.find('los-semester-module-row').length === 2);
    plugin.onunload();
  }

  heading('first-class project navigation');
  {
    const { app, plugin } = await boot();
    await plugin.nav.openProjects();
    const listLeaf = app.workspace.getLeavesOfType(VIEW.project)[0];
    const listText = listLeaf.view.contentEl.allText();
    check('Projects opens as a full-page first-class list',
      plugin.router.snapshot().current.name === 'project-list'
      && listText.includes('Bachelor thesis') && listLeaf.view.contentEl.find('los-project-row').length === 1);
    check('the project list does not render a universal completion percentage', !/\d+%/.test(listText));
    listLeaf.view.contentEl.scrollTop = 177;
    listLeaf.view.selectedElementId = 'project-fixture-thesis';
    listLeaf.view.contentEl.find('los-project-row')[0].fire('click');
    await tick(); await tick();
    const detail = app.workspace.getLeavesOfType(VIEW.project)[0].view;
    check('opening a project replaces the route rather than splitting the screen',
      plugin.router.snapshot().current.name === 'project-detail'
      && detail.contentEl.allText().includes('Structure')
      && detail.contentEl.find('los-project-list').length === 0);
    check('project detail exposes the approved five tabs',
      ['Structure', 'Decisions', 'Materials', 'Files', 'Logistics']
        .every((label) => detail.contentEl.allText().includes(label)));
    detail.contentEl.findText('los-chip', 'Thesis landscape').fire('click'); await tick();
    const projectUnit = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    check('project-owned units retain first-class project context',
      projectUnit.contentEl.allText().includes('Bachelor thesis')
      && projectUnit.contentEl.findText('los-btn', 'Back to project'));
    projectUnit.contentEl.findText('los-btn', 'Back to project').fire('click'); await tick();
    await plugin.nav.openProject('project-fixture-thesis', 'structure');
    const structure = app.workspace.getLeavesOfType(VIEW.project)[0].view.contentEl.allText();
    check('parallel and nested project structure renders without a percentage',
      structure.includes('Landscape and scope') && structure.includes('Confirm scope')
      && structure.includes('Experiments') && structure.includes('Baseline map') && !/\d+%/.test(structure));
    await plugin.nav.openProject('project-fixture-thesis', 'linked-materials');
    const linked = app.workspace.getLeavesOfType(VIEW.project)[0].view.contentEl;
    check('linked modules and Topic Packs render from projected relationships',
      linked.allText().includes('Fixture Advanced ML') && linked.allText().includes('Fixture ML evaluation pack'));
    linked.findText('los-btn', 'Why linked').fire('click');
    check('Why linked is an inspect-only temporary drawer/modal with a core-authored reason',
      stub.Modal.last?.contentEl?.allText().includes('Advanced ML supplies the evaluation vocabulary')
      && stub.Modal.last?.contentEl?.allText().includes('Provides evaluation vocabulary and systems methods')
      && stub.Modal.last?.contentEl?.findText('los-btn', 'Open target')
      && stub.Modal.last?.contentEl?.getAttribute('role') === 'dialog'
      && stub.Modal.last?.contentEl?.getAttribute('aria-modal') === 'true'
      && plugin.router.snapshot().overlay?.kind === 'linked-material-reason');
    stub.Modal.last.close();
    check('closing Why linked restores the project route and clears transient state',
      plugin.router.snapshot().current.name === 'project-detail' && plugin.router.snapshot().overlay === null);
    await plugin.nav.back();
    const restored = app.workspace.getLeavesOfType(VIEW.project)[0];
    check('Back restores the project list selection and scroll position',
      plugin.router.snapshot().current.name === 'project-list'
      && restored.view.contentEl.scrollTop === 177
      && restored.view.selectedElementId === 'project-fixture-thesis');
    plugin.onunload();
  }

  heading('unit stage workspace and guarded actions');
  {
    const { app, plugin, calls } = await boot();
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    let element = view.contentEl;
    let text = element.allText();
    check('ordered stages and one current workspace render', element.find('los-stage-row').length === 3
      && text.includes('medical-test fixture'));
    /* Figma 05 · 36:5. The stage shows ONE current action; the catalogue moved
     * into the comparison drawer. What must not happen is a material becoming
     * unreachable, so the page states the full total and the triage split, and
     * the drawer below is asserted to contain every row. */
    check('the stage promotes exactly one current action',
      element.find('los-current-work-card').length === 1
      && element.find('los-current-work-card')[0].find('los-resource-row').length === 1
      && text.includes('Explain the medical-test result cold'));
    /* Both totals, each owned. The stage's count and the unit's are different
     * questions, and a single "All N materials" line let them be read as one
     * (2026-09-05 audit, F04). */
    check('collapsing the catalogue still counts every material, on both scopes',
      text.includes('3 materials on this stage')
      && element.find('los-stage-materials-summary')[0].allText().includes('required')
      && element.find('los-stage-materials-summary')[0].allText().includes('on the unit'));
    check('no permanent stage note editor remains', element.find('los-note-editor').length === 0);
    /* Fidelity against Figma 04 · Unit workspace (14:462). Each of these was
       a visible difference from the frame, so each is pinned by what renders
       rather than by the CSS that renders it. */
    check('rail rows carry a state dot and the ordinal inside the title',
      element.find('los-stage-marker').length === 3
      && element.find('los-stage-index').length === 0
      && element.findText('los-stage-title', '2 · ') !== null);
    check('the rail is labelled Stages and states the completed total once',
      element.find('los-stage-rail-summary')[0].allText().includes('Stages')
      && element.find('los-stage-progress').length === 0
      && element.find('los-stage-rail-summary')[0].allText().includes('of 3 complete'));
    check('the stage head is one accent eyebrow naming position and state',
      element.find('los-stage-heading')[0].findText('los-kicker', 'Stage 2 of 3') !== null
      && element.find('los-stage-order-context').length === 0);
    check('stage concepts render as typed chips resolved from their records',
      element.find('los-stage-concepts')[0].find('los-chip').length === 2
      && element.find('los-stage-concepts')[0].allText().includes('Conditional probability')
      && element.find('los-stage-concepts')[0].allText().includes('Bayes theorem'));
    check('the current action and the catalogue are named separately',
      text.includes('Current work') && text.includes('Compare all'));
    check('the completion rule is stated beside the completion action',
      text.includes('Finish only when the criterion above is true.'));
    check('Add note follows the final stage in the rail', element.find('los-stage-rail')[0].findText('los-btn', 'Add note'));
    check('existing unit note sections are projected', plugin.store.get('unit-fixture-sad-l04').note_sections[0].title === 'Foundations session');
    check('durable unit artifact remains a reference', text.includes('Ultimate Reference') && text.includes('Fixture probability reference'));
    /* Three visible actions, one of them a menu. Sixteen equally-weighted
     * buttons is a control panel, not a workspace. */
    const bar = element.find('los-unit-actionbar')[0];
    check('the action bar carries one primary button and one overflow',
      bar.children.filter((child) => child.classes.has('los-btn')).length === 1
      && bar.find('los-overflow').length === 1);
    /* Figma 14:600 names it "Complete stage" and paints it bg/accent, not
       green: Primary is the one action the screen exists for, and a second
       decisive colour would have competed with the brand accent for it. */
    check('only one action on the screen is a filled completion action',
      element.find('los-btn--cta').length === 1
      && bar.findText('los-btn', 'Complete stage').classes.has('los-btn--cta'));
    check('secondary operations are discoverable in one menu',
      ['Pause unit', 'Skip stage', 'Report prerequisite gap', 'Prepare shelving']
        .every((label) => bar.find('los-overflow')[0].allText().includes(label)));
    /* 14:502 lists End session once, at the top right. It used to sit sixth in
       the overflow, so the check is that it is in exactly one of the two. */
    check('End session is a header action and not also an overflow item',
      element.find('los-page-header')[0].findText('los-btn', 'End session') !== null
      && !bar.find('los-overflow')[0].allText().includes('End session'));
    check('one filled action per context survives the promotion',
      element.find('los-resource-actions').every((row) =>
        row.children.filter((child) => child.classes.has('los-btn')).length <= 1));

    /* The comparison drawer (Figma 05 · 36:12). "Compare all" is where the
     * complete catalogue went, so this is where the guarantees that used to be
     * checked on the page are checked now. */
    element.findText('los-btn', 'Compare all').fire('click');
    await frame();
    const drawer = stub.Modal.last.contentEl;
    const drawerText = drawer.allText();
    check('the drawer is a named dialog carrying the honesty note',
      drawer.getAttribute('role') === 'dialog'
      && drawer.getAttribute('aria-labelledby') === 'los-material-drawer-heading'
      && drawerText.includes('Choose learning material')
      && drawerText.includes('never deletes or hides the complete source record'));
    check('every material the page counted is reachable in the drawer',
      drawer.find('los-resource-row').length === 3);

    /* ADR-008/009 integration. The Core has carried resource rank and resource
     * identity since contract v2/v3; until the UI read them, a required stage
     * still showed the deck, the depth paper and the preserved bibliography at
     * one weight, and every verdict still landed on the whole source. */
    check('resource triage tiers are visible, not just stored',
      drawerText.includes('Do this') && drawerText.includes('Depth — not now')
      && drawer.find('los-triage-required-now').length >= 1
      && drawer.find('los-triage-deferred').length >= 1);
    check('an unranked resource sorts with the primaries, never below them',
      drawer.find('los-triage-unranked').length === 1
      && drawer.find('los-resource-row')
        .findIndex((row) => row.classes.has('los-triage-unranked'))
      < drawer.find('los-resource-row')
        .findIndex((row) => row.classes.has('los-triage-deferred')));
    check('resource feedback collapses into a rate menu instead of three buttons',
      drawer.find('los-resource-row').some((row) => row.find('los-overflow').length === 1)
      && drawer.find('los-resource-actions').every((row) =>
        row.children.filter((child) => child.classes.has('los-btn')).length <= 1));
    check('done-when criteria are interactive checkboxes',
      element.find('los-donewhen-row').length >= 1
      && element.find('los-donewhen-row')[0].children[0].getAttribute('type') === 'checkbox');
    const criterionRow = element.find('los-donewhen-row')[0];
    const criterion = criterionRow.children[0];
    const criterionText = criterion.getAttribute('aria-label');
    criterion.checked = true; criterion.fire('change');
    check('a ticked criterion is UI-owned state, never a second completion record',
      plugin.getDoneWhen(
        'unit-fixture-sad-l04', 'stage-fixture-conditioning', [criterionText],
      )[0] === true
      && !calls.some((args) => args[0] === 'stage-progress'));
    /* F08 (2026-09-05 audit): the mark certifies that sentence, so a stage
     * revision that replaces the criterion does not inherit it. */
    check('a tick does not survive a revision of the criterion it certifies',
      plugin.getDoneWhen(
        'unit-fixture-sad-l04', 'stage-fixture-conditioning',
        ['Derive the normal equation instead'],
      )[0] === false);

    const noteModal = plugin.openUnitNote(plugin.store.get('unit-fixture-sad-l04'), plugin.store.mapForUnit('unit-fixture-sad-l04'));
    await frame();
    check('the note modal references completed stages not already recorded',
      noteModal.referencedStageIds.length === 0 && noteModal.contentEl.allText().includes('unit-level observation'));
    check('the note modal is a named dialog and blocks an empty save',
      noteModal.contentEl.getAttribute('role') === 'dialog'
      && noteModal.contentEl.getAttribute('aria-modal') === 'true'
      && noteModal.contentEl.findText('los-btn', 'Save note').disabled === true);
    check('the learning-session note opens ready for writing',
      global.document.activeElement === noteModal.editor);
    noteModal.editor.value = 'Updated fixture session synthesis.';
    noteModal.editor.fire('input');
    check('the note save enables when required text is present',
      noteModal.contentEl.findText('los-btn', 'Save note').disabled === false);
    noteModal.fileInput.files = [{
      name: 'notes.png', __path: NOTE_ATTACHMENT_FIXTURE_PATH,
    }];
    noteModal.fileInput.fire('change');
    noteModal.contentEl.findText('los-btn', 'Save note').fire('click');
    await waitFor(() => Boolean(calls.envelope('unit.note.append'))
      && !plugin.gateway.isBusy);
    const noteCall = calls.find((args) => args[0] === 'unit-note');
    const noteEnvelope = calls.envelope('unit.note.append');
    check('session note save uses the unit-level action-specific gateway',
      noteEnvelope?.payload.unit_id === 'unit-fixture-sad-l04'
      && noteEnvelope?.payload.text === 'Updated fixture session synthesis.');
    check('unit note attachments use Electron webUtils instead of the removed File.path',
      (noteEnvelope?.payload.attachment || []).includes(NOTE_ATTACHMENT_FIXTURE_PATH)
      && (noteEnvelope?.payload.attachment_sha256 || [])[0]
        === fileDigest(NOTE_ATTACHMENT_FIXTURE_PATH));
    check('mutation carries optimistic snapshot token',
      noteEnvelope?.expected_snapshot === FIXTURE_SNAPSHOT);

    /* Rating a material the stage is not currently on belongs where the
     * comparison happens. The capability, the scope and the payload are
     * unchanged — only the surface moved. */
    element.findText('los-btn', 'Compare all').fire('click');
    await frame();
    stub.Modal.last.contentEl.findText('los-btn', 'Helpful').fire('click');
    await waitFor(() => Boolean(calls.envelope('source.feedback.record'))
      && !plugin.gateway.isBusy);
    element = view.contentEl;
    const feedback = calls.envelope('source.feedback.record')?.payload;
    check('source feedback is unit/stage/source-specific',
      feedback?.unit_id === 'unit-fixture-sad-l04'
      && feedback?.stage_id === 'stage-fixture-conditioning'
      && feedback?.source_id === 'source-fixture-islp' && feedback?.feedback === 'helpful');
    element = view.contentEl;
    element.findText('los-btn', 'Report prerequisite gap').fire('click');
    await waitFor(() => Boolean(calls.envelope('detour.create'))
      && !plugin.gateway.isBusy);
    const detour = calls.envelope('detour.create')?.payload;
    check('gap action creates a scoped detour',
      detour?.stage_id === 'stage-fixture-conditioning' && detour?.classification === 'required-now');
    await plugin.reviewSessionEnd();
    check('session closure first requests an exact change review',
      calls.some((args) => args.length === 1 && args[0] === 'session-end')
      && stub.Modal.last?.contentEl?.getAttribute('role') === 'dialog'
      && stub.Modal.last?.contentEl?.getAttribute('aria-labelledby') === 'los-session-end-heading');
    plugin.onunload();
  }

  heading('the stage comparison drawer');
  {
    const { app, plugin, calls } = await boot({
      patchManifest: (manifest) => {
        const sourceMap = manifest.module_source_maps.find(
          (row) => row.module_id === 'module-fixture-m2');
        sourceMap.sources[0].unit_routes = [
          {
            id: 'route-drawer-deck', unit_id: 'unit-fixture-sad-l04',
            title: 'Current L02 lecture deck', format: 'book',
            angle: 'Scope authority for the current unit.',
            angle_detail: 'Derives the geometry and connects scaling and validation.',
            covers: ['knowledge-fixture-conditioning'],
            depth: 'derivation', scope: 'current',
            locator: 'lecture-slides/VL_02.pdf', source_id: 'source-fixture-book',
          },
          {
            id: 'route-drawer-intuition', unit_id: 'unit-fixture-sad-l04',
            title: 'Domingos perspective', format: 'article',
            angle: 'Why similarity deteriorates in high dimensions.',
            angle_detail: 'Argues the geometry informally and assumes no measure theory.',
            covers: ['knowledge-fixture-conditioning'],
            depth: 'intuition', scope: 'complementary',
            locator: 'papers/domingos.pdf', source_id: 'source-fixture-book',
          },
        ];
      },
    });
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;

    view.contentEl.findText('los-btn', 'Compare all').fire('click');
    await frame();
    let drawer = stub.Modal.last.contentEl;
    /* F05 (2026-09-05 audit): focusing Close sent the learner to the end of a
     * long list, so the drawer opened showing its bottom rather than its
     * heading and recommendation. */
    check('the drawer opens at its heading, not at the foot of the list',
      global.document.activeElement
        === drawer.find('los-page-header')[0].children.find(
          (child) => child.getAttribute('id') === 'los-material-drawer-heading'));
    check('the drawer recommends for the selected need and says which need',
      drawer.allText().includes('Recommended for derivation')
      && drawer.find('los-material-recommended')[0].allText()
        .includes('Current L02 lecture deck'));
    check('value, angle, depth, scope and the exact locator all survive',
      ['Value · Scope authority', 'Angle · Derives the geometry',
        'Depth · derivation · scope current', 'Locator · lecture-slides/VL_02.pdf']
        .every((line) => drawer.allText().includes(line)));

    /* The lens is the whole reason a filter here would be a defect: switching
     * need must change what is offered first and nothing else. */
    const beforeTotal = drawer.find('los-material-alternative').length
      + drawer.find('los-material-recommended').length;
    drawer.findText('los-btn', 'Intuition 1').fire('click');
    drawer = stub.Modal.last.contentEl;
    check('switching the lens re-ranks without hiding a single source',
      drawer.allText().includes('Recommended for intuition')
      && drawer.find('los-material-recommended')[0].allText()
        .includes('Domingos perspective')
      && drawer.find('los-material-alternative').length
        + drawer.find('los-material-recommended').length === beforeTotal);
    check('an unpromoted source is named by the need it serves',
      drawer.find('los-material-alternative')[0].allText().includes('Derivation'));

    /* F04 (2026-09-05 audit): reading why an alternative is worth choosing must
     * not require choosing it. `Choose` is a canonical preference mutation, so
     * an alternative that withheld its long-form angle and its Open action
     * could only be inspected by making that write first. */
    const alternative = drawer.find('los-material-alternative')[0];
    check('an alternative discloses the same authored fields as the promoted card',
      alternative.allText().includes('Angle · Derives the geometry')
      && alternative.allText().includes('Depth · derivation · scope current')
      && alternative.allText().includes('Locator · lecture-slides/VL_02.pdf'));
    check('the drawer states which total is the unit\'s and which the stage\'s',
      drawer.allText().includes('routes on this unit')
      && drawer.allText().includes('placed on this stage')
      && drawer.allText().includes('Chosen across all 2 routes on this unit'));

    /* D4: the surface moved, the governed write did not. */
    drawer.findText('los-btn', 'Choose').fire('click');
    await waitFor(() => Boolean(calls.envelope('unit.source-selection.set'))
      && !plugin.gateway.isBusy);
    const selection = calls.envelope('unit.source-selection.set');
    check('choosing from the drawer sends the unchanged governed selection',
      selection?.payload.unit_id === 'unit-fixture-sad-l04'
      && selection?.payload.route_id === 'route-drawer-intuition'
      && selection?.payload.source_id === 'source-fixture-book'
      && selection?.payload.locator === 'papers/domingos.pdf'
      && selection?.payload.action === 'select'
      && selection?.payload.purpose === 'Why similarity deteriorates in high dimensions.'
      && selection?.expected_snapshot === FIXTURE_SNAPSHOT);
    plugin.onunload();
  }

  heading('lecture knowledge map and material choice');
  {
    const { app, plugin, calls } = await boot({
      patchManifest: (manifest) => {
        const unit = manifest.units.find((row) => row.id === 'unit-fixture-analysis');
        unit.knowledge_map = {
          summary: 'Two connected ideas define this lecture.',
          nodes: [
            {
              id: 'knowledge-fixture-formulation',
              title: 'Problem formulation',
              summary: 'State the inputs, target, and learning objective.',
            },
            {
              id: 'knowledge-fixture-generalization',
              title: 'Generalization',
              summary: 'Separate fitting the sample from performing on new data.',
              builds_on: ['knowledge-fixture-formulation'],
            },
          ],
        };
        unit.source_selections = [{
          route_id: 'route-fixture-analysis-video',
          source_id: 'source-fixture-islp',
          locator: 'Episode 4',
          purpose: 'Use the visual train-versus-test explanation.',
        }];
        const sourceMap = manifest.module_source_maps.find((row) => row.module_id === 'module-fixture-m2');
        sourceMap.sources[0].unit_routes.push({
          id: 'route-fixture-analysis-book',
          unit_id: 'unit-fixture-analysis',
          title: 'Fixture book — derivation angle',
          format: 'book',
          angle: 'Builds the generalization argument from a worked mathematical example.',
          covers: ['knowledge-fixture-formulation', 'knowledge-fixture-generalization'],
          depth: 'derivation',
          scope: 'current',
          locator: 'Chapter 2 §§2.1–2.3',
          source_id: 'source-fixture-book',
          material_path: '.flat/source-fixture-book/chapter-2.pdf',
        });
        sourceMap.sources.push({
          source_id: 'source-fixture-islp',
          role: 'intuition',
          why: 'Alternate visual explanation.',
          priority: 2,
          unit_routes: [{
            id: 'route-fixture-analysis-video',
            unit_id: 'unit-fixture-analysis',
            title: 'Fixture video — intuition angle',
            format: 'video',
            angle: 'Uses a visual train-versus-test story without the derivation.',
            covers: ['knowledge-fixture-generalization'],
            depth: 'intuition',
            scope: 'complementary',
            locator: 'Episode 4',
            source_id: 'source-fixture-islp',
            url: 'https://example.org/generalization',
          }],
        });
      },
    });
    await plugin.nav.openUnit('unit-fixture-analysis');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const text = view.contentEl.allText();
    check('knowledge nodes render as a dependency-aware lecture overview',
      view.contentEl.find('los-knowledge-node').length === 2
      && text.includes('Lecture knowledge map')
      && text.includes('Builds on: Problem formulation'));
    check('all material options are grouped by material type instead of sequenced',
      view.contentEl.find('los-material-option').length === 2
      && text.includes('Choose your learning material')
      && text.includes('Books') && text.includes('Videos'));
    check('material cards preserve the source angle, locator, coverage, depth, and scope',
      text.includes('Builds the generalization argument from a worked mathematical example.')
      && text.includes('Chapter 2 §§2.1–2.3')
      && text.includes('derivation') && text.includes('current')
      && text.includes('Generalization'));
    check('the complete material menu renders alongside an unmet map obligation',
      text.includes('Choose your learning material')
      && text.includes('Study map required')
      && text.includes('This unit has no ordered study map')
      // The menu says what may be used; the map says in what order and against
      // what proof. Rendering the first must never be read as discharging the
      // second (OPERATOR.md rule 6).
      && text.includes('A map says in what order and against what proof'));
    check('openable material choices expose a direct action',
      view.contentEl.findText('los-btn', 'Open') !== null);
    const choose = view.contentEl.findText('los-btn', 'Choose');
    check('material choice is an explicit pressed-state control',
      choose !== null && choose.getAttribute('aria-pressed') === 'false'
      && choose.classes.has('los-btn--choice')
      && view.contentEl.findText('los-btn', 'Open')?.classes.has('los-btn--info')
      && view.contentEl.findText('los-btn', 'Remove choice')?.getAttribute('aria-pressed') === 'true');
    choose.fire('click');
    await waitFor(() => Boolean(calls.envelope('unit.source-selection.set'))
      && !plugin.gateway.isBusy);
    const selection = calls.envelope('unit.source-selection.set');
    check('choosing a material persists the exact lecture option through the guarded gateway',
      selection?.payload.unit_id === 'unit-fixture-analysis'
      && selection?.payload.route_id === 'route-fixture-analysis-book'
      && selection?.payload.source_id === 'source-fixture-book'
      && selection?.payload.locator === 'Chapter 2 §§2.1–2.3'
      && selection?.payload.action === 'select'
      && selection?.payload.purpose === 'Builds the generalization argument from a worked mathematical example.');
    await plugin.askAiScoped('Build a path from my choices.', {
      moduleId: 'module-fixture-m2',
      unitId: 'unit-fixture-analysis',
    });
    check('optional-path AI context uses unit choices when no stage exists',
      plugin.lastAiPrompt.includes('source-fixture-islp')
      && plugin.lastAiPrompt.includes('Episode 4'));
    plugin.onunload();
  }

  heading('the stage workspace leads a unit that has a map');
  {
    /* Handoff §7.5: `/learn/:unit` is ordered stages plus the selected stage.
     * The knowledge map and the complete menu are Figma screen 11 and belong
     * after it, not stacked on top pushing the workspace off the first screen.
     * Order is asserted on rendered text position because that is what the
     * learner actually meets; a presence check passed throughout the period
     * this was wrong. */
    const { app, plugin } = await boot({
      patchManifest: (manifest) => {
        const unit = manifest.units.find((row) => row.id === 'unit-fixture-sad-l04');
        unit.knowledge_map = {
          summary: 'One idea defines this lecture.',
          nodes: [{
            id: 'knowledge-fixture-conditioning',
            title: 'Conditioning',
            summary: 'Update belief once evidence arrives.',
          }],
        };
        const sourceMap = manifest.module_source_maps.find(
          (row) => row.module_id === 'module-fixture-m2');
        sourceMap.sources[0].unit_routes.push({
          id: 'route-fixture-sad-l04-book',
          unit_id: 'unit-fixture-sad-l04',
          title: 'Fixture book — conditioning angle',
          format: 'book',
          angle: 'Works the conditioning rule through a medical-test example.',
          covers: ['knowledge-fixture-conditioning'],
          depth: 'derivation',
          scope: 'current',
          locator: 'Chapter 3 §3.1',
          source_id: 'source-fixture-book',
          material_path: '.flat/source-fixture-book/chapter-3.pdf',
        });
      },
    });
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const text = view.contentEl.allText();
    const route = text.indexOf('Stages');
    const knowledge = text.indexOf('Lecture knowledge map');
    /* The stage leads the route it is named after. The choose-a-source menu is
     * no longer on the page beneath it — Figma 05 moved it into the comparison
     * drawer so the stage shows one current action — so what is checked here is
     * that the workspace comes first and the menu is not competing with it. */
    check('the ordered stages and the selected stage lead the page',
      route !== -1 && knowledge !== -1 && route < knowledge
      && text.indexOf('Choose your learning material') === -1);
    check('the complete menu is still rendered in full, not truncated',
      view.contentEl.find('los-knowledge-node').length === 1
      && (() => {
        view.contentEl.findText('los-btn', 'Compare all').fire('click');
        const drawer = stub.Modal.last.contentEl;
        return drawer.allText().includes(
          'Works the conditioning rule through a medical-test example.',
        );
      })());
    check('approved material synthesis stays distinct from the option menu',
      text.includes('Approved material synthesis')
      && text.includes('current basis')
      && text.includes('complete route coverage')
      && text.includes('1/1 current routes assessed')
      && text.includes('screened')
      && text.includes('The route was screened for scope')
      && text.includes('Concept bridges'));
    plugin.onunload();
  }

  {
    const { app, plugin } = await boot({
      patchManifest: (manifest) => {
        const synthesis = manifest.unit_material_syntheses[0];
        synthesis.freshness = {
          status: 'stale',
          reasons: ['source_map_revision', 'material_checksums'],
        };
        synthesis.completeness = {
          ...synthesis.completeness,
          complete: false,
          current_route_count: 2,
          missing_route_ids: ['route-fixture-new-current'],
        };
      },
    });
    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const text = app.workspace.getLeavesOfType(VIEW.unit)[0].view.contentEl.allText();
    check('stale synthesis is labelled while its approved dossier remains visible',
      text.includes('stale basis')
      && text.includes('incomplete route coverage')
      && text.includes('source map revision, material checksums')
      && text.includes('Missing: route-fixture-new-current')
      && text.includes('The route was screened for scope'));
    plugin.onunload();
  }

  heading('missing map and explicit AI context');
  {
    const { app, plugin } = await boot();
    await plugin.nav.openUnit('unit-fixture-analysis');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    check('unit owed a map says so and offers both routes to one',
      view.contentEl.allText().includes('Study map required')
      && view.contentEl.allText().includes('Create map with AI')
      && view.contentEl.findText('los-btn', 'Import reviewed map') !== null);
    await plugin.askAiScoped('Propose a scoped next action.', {
      moduleId: 'module-fixture-m2', componentId: 'component-fixture-sad',
      unitId: 'unit-fixture-sad-l04', stageId: 'stage-fixture-conditioning',
    });
    const prompt = plugin.lastAiPrompt;
    check('AI prompt names area/module/component/unit/stage', ['program-bachelors', 'module-fixture-m2',
      'component-fixture-sad', 'unit-fixture-sad-l04', 'stage-fixture-conditioning'].every((id) => prompt.includes(id)));
    check('AI prompt carries sources and snapshot', prompt.includes('source-fixture-islp')
      && prompt.includes(FIXTURE_SNAPSHOT));
    check('active file is supplementary only', prompt.includes('knowledge/notes/supplementary.md')
      && prompt.includes('supplementary context only'));
    plugin.onunload();
  }
};
