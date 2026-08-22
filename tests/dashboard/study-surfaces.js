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
  VIEW,
  tick,
  frame,
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
    /* Three, not two: the fixture gained an unranked, id-less resource when
     * ADR-008/009 landed, so that the triage renderer is exercised against the
     * pre-v2 shape as well as the ranked one. */
    check('stage has exact resources and done-when criteria', element.find('los-resource-row').length === 3
      && text.includes('Explain the medical-test result cold'));
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
      element.find('los-stage-concepts')[0].find('los-chip').length === 1
      && element.find('los-stage-concepts')[0].allText().includes('Conditional probability'));
    check('the resource list is headed Exact work', text.includes('Exact work'));
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
    check('resource feedback collapses into a rate menu instead of three buttons',
      element.find('los-resource-row').some((row) => row.find('los-overflow').length === 1)
      && element.find('los-resource-actions').every((row) =>
        row.children.filter((child) => child.classes.has('los-btn')).length <= 1));

    /* ADR-008/009 integration. The Core has carried resource rank and resource
     * identity since contract v2/v3; until the UI read them, a required stage
     * still showed the deck, the depth paper and the preserved bibliography at
     * one weight, and every verdict still landed on the whole source. */
    check('resource triage tiers are visible, not just stored',
      text.includes('Do this') && text.includes('Depth — not now')
      && element.find('los-triage-required-now').length >= 1
      && element.find('los-triage-deferred').length >= 1);
    check('an unranked resource sorts with the primaries, never below them',
      element.find('los-triage-unranked').length === 1
      && element.find('los-resource-row')
        .findIndex((row) => row.classes.has('los-triage-unranked'))
      < element.find('los-resource-row')
        .findIndex((row) => row.classes.has('los-triage-deferred')));
    check('done-when criteria are interactive checkboxes',
      element.find('los-donewhen-row').length >= 1
      && element.find('los-donewhen-row')[0].children[0].getAttribute('type') === 'checkbox');
    const criterion = element.find('los-donewhen-row')[0].children[0];
    criterion.checked = true; criterion.fire('change');
    check('a ticked criterion is UI-owned state, never a second completion record',
      plugin.getDoneWhen('unit-fixture-sad-l04', 'stage-fixture-conditioning')[0] === true
      && !calls.some((args) => args[0] === 'stage-progress'));

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
    noteModal.fileInput.files = [{ name: 'notes.png', __path: '/tmp/notes.png' }];
    noteModal.fileInput.fire('change');
    noteModal.contentEl.findText('los-btn', 'Save note').fire('click'); await tick(); await tick();
    const noteCall = calls.find((args) => args[0] === 'unit-note');
    const noteEnvelope = calls.envelope('unit.note.append');
    check('session note save uses the unit-level action-specific gateway',
      noteEnvelope?.payload.unit_id === 'unit-fixture-sad-l04'
      && noteEnvelope?.payload.text === 'Updated fixture session synthesis.');
    check('unit note attachments use Electron webUtils instead of the removed File.path',
      (noteEnvelope?.payload.attachment || []).includes('/tmp/notes.png'));
    check('mutation carries optimistic snapshot token',
      noteEnvelope?.expected_snapshot === 'sha256:fixture-v2-snapshot');

    element = view.contentEl;
    element.findText('los-btn', 'Helpful').fire('click'); await tick();
    const feedback = calls.envelope('source.feedback.record')?.payload;
    check('source feedback is unit/stage/source-specific',
      feedback?.unit_id === 'unit-fixture-sad-l04'
      && feedback?.stage_id === 'stage-fixture-conditioning'
      && feedback?.source_id === 'source-fixture-islp' && feedback?.feedback === 'helpful');
    element = view.contentEl;
    element.findText('los-btn', 'Report prerequisite gap').fire('click'); await tick();
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
          source_id: 'source-fixture-islp',
          locator: 'Episode 4',
          purpose: 'Use the visual train-versus-test explanation.',
        }];
        const sourceMap = manifest.module_source_maps.find((row) => row.module_id === 'module-fixture-m2');
        sourceMap.sources[0].unit_routes.push({
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
    choose.fire('click'); await tick(); await tick();
    const selection = calls.envelope('unit.source-selection.set');
    check('choosing a material persists the exact lecture option through the guarded gateway',
      selection?.payload.unit_id === 'unit-fixture-analysis'
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
    const menu = text.indexOf('Choose your learning material');
    check('the ordered stages and the selected stage come before the menu',
      route !== -1 && knowledge !== -1 && menu !== -1
      && route < knowledge && knowledge < menu);
    check('the complete menu is still rendered in full, not truncated',
      view.contentEl.find('los-material-option').length === 1
      && view.contentEl.find('los-knowledge-node').length === 1
      && text.includes('Works the conditioning rule through a medical-test example.'));
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
      && prompt.includes('sha256:fixture-v2-snapshot'));
    check('active file is supplementary only', prompt.includes('knowledge/notes/supplementary.md')
      && prompt.includes('supplementary context only'));
    plugin.onunload();
  }
};
