import { ItemView, Notice } from 'obsidian';
import { badge, button, chip, disclosure, empty, icon, overflowMenu, pageHeader, section } from '../components';
import { VIEW_UNIT } from '../constants';

/**
 * The Unit is where learning actually happens, so it gets the strictest
 * discipline: a stage rail and one current-work panel. Notes are added once
 * after a learning session from the action at the end of the rail; they never
 * occupy a permanent panel or become mandatory per stage.
 */
export class UnitView extends ItemView {
  [key: string]: any;
  constructor(leaf, plugin) {
    super(leaf); this.plugin = plugin; this.unitId = null; this.stageId = null;
  }
  getViewType() { return VIEW_UNIT; }
  getDisplayText() { return 'LearningOS · Unit'; }
  async setState(state) {
    const nextUnitId = state?.unitId || this.unitId;
    if (nextUnitId !== this.unitId) this.stageId = null;
    this.unitId = nextUnitId;
    const requested = Object.prototype.hasOwnProperty.call(state || {}, 'stageId') ? state.stageId : null;
    this.stageId = this.plugin.getSelectedStage(this.unitId) || requested || this.stageId;
    this.render();
  }
  getState() { return { unitId: this.unitId, stageId: this.stageId }; }
  async onOpen() {
    this.unitId = this.leaf.state?.unitId || this.unitId;
    this.stageId = this.plugin.getSelectedStage(this.unitId) || this.leaf.state?.stageId || this.stageId;
    this.render();
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-unit-view');
    const unit = this.plugin.store.get(this.unitId);
    if (!unit) { empty(root, 'Unit unavailable', 'Return to its module.'); return; }
    const module = this.plugin.store.get(unit.module_id);
    const project = this.plugin.store.projectForUnit(unit);
    const owner = project || module;
    const ownerLabel = owner?.title || unit.module_id;
    const header = pageHeader(root, `${ownerLabel} · ${unit.kind}`, unit.title, unit.scope);
    const headerActions = header.createDiv({ cls: 'los-actions' });
    if (project) button(headerActions, 'Back to project', () => this.plugin.back(), 'quiet');
    else button(headerActions, 'Back to module', () => this.plugin.openModule(unit.module_id), 'quiet');

    const studyMap = this.plugin.store.mapForUnit(unit.id);
    if (!studyMap) {
      const missing = section(root, 'Study map needed');
      empty(missing, 'This unit has no current study script',
        'AI may propose a scoped map; the core imports it only after review.',
        'Create map with AI', () => this.plugin.askAiScoped(
          'Propose one study-map JSON document for this unit. Do not write files; include exact source actions and done-when criteria.',
          { moduleId: unit.module_id, projectId: project?.id, unitId: unit.id, componentId: unit.component_id }));
      this.renderArtifacts(root, unit);
      return;
    }
    // A study map whose `stages` is missing or not an array used to throw here
    // and blank the whole workspace. Normalise once, then work from `map`.
    const stages = Array.isArray(studyMap.stages)
      ? studyMap.stages.filter((row) => row && typeof row === 'object') : [];
    if (!stages.length) {
      const bare = section(root, 'Study map needs stages');
      empty(bare, 'This study map has no stages yet',
        'Stage authoring belongs to the core — import a map or add stages there, then rebuild views.');
      this.renderArtifacts(root, unit);
      return;
    }
    const map = { ...studyMap, stages };
    if (!this.stageId || !stages.some((row) => row.id === this.stageId)) {
      this.stageId = map.current_stage;
      this.plugin.setSelectedStage(unit.id, this.stageId);
    }
    const stage = stages.find((row) => row.id === this.stageId) || stages[0];
    const layout = root.createDiv({ cls: 'los-unit-layout' });
    this.renderRail(layout, unit, map, stage);
    this.renderStage(layout, unit, map, stage);
    this.renderActionBar(root, unit, map, stage);
    const more = disclosure(root, 'Unit artifacts and evidence', 'los-unit-extras');
    this.renderArtifacts(more, unit);
  }

  renderRail(layout, unit, studyMap, current) {
    const rail = layout.createDiv({ cls: 'los-stage-rail' });
    rail.createEl('h2', { text: 'Stages' });
    for (const [index, stage] of studyMap.stages.entries()) {
      const row = rail.createEl('button', {
        cls: `los-stage-row los-s-${stage.status} ${stage.id === current.id ? 'is-selected' : ''} is-clickable`,
        attr: { type: 'button', 'aria-current': stage.id === current.id ? 'step' : 'false' },
      });
      row.createSpan({ cls: 'los-stage-index', text: String(index + 1).padStart(2, '0') });
      const copy = row.createSpan({ cls: 'los-stage-copy' });
      copy.createSpan({ text: stage.title });
      const marker = stage.status === 'complete' ? 'Complete' : stage.status === 'skipped' ? 'Skipped' : '';
      if (marker) copy.createSpan({ cls: 'los-micro', text: marker });
      row.addEventListener('click', () => this.selectStage(stage.id));
    }
    const add = button(rail, 'Add note', () => this.plugin.openUnitNote(unit, studyMap), 'quiet');
    add.addClass('los-add-unit-note');
    const draft = this.plugin.getUnitNoteDraft(unit.id, studyMap.stages);
    if (draft.text.trim()) rail.createDiv({ cls: 'los-micro los-unit-note-draft', text: 'Unsaved unit-note draft kept locally.' });
  }

  renderStage(layout, unit, studyMap, stage) {
    const center = layout.createDiv({ cls: 'los-stage-workspace' });
    const top = center.createDiv({ cls: 'los-stage-heading' });
    top.createDiv({ cls: 'los-kicker', text: stage.exam_critical ? 'Exam-critical stage' : stage.scope_triage });
    top.createEl('h2', { text: stage.title });
    if (stage.objective) {
      const goal = center.createDiv({ cls: 'los-stage-goal' });
      goal.createDiv({ cls: 'los-kicker', text: 'Goal' });
      goal.createEl('p', { text: stage.objective });
    }
    if (stage.estimate_minutes) badge(top, `${stage.estimate_minutes} min`, 'role');

    const resources = section(center, 'Resources');
    // Array.isArray, not a truthy length check: a string here used to render
    // one blank row per character, because for...of walks a string by character.
    const stageResources = Array.isArray(stage.resources)
      ? stage.resources.filter((row) => row && typeof row === 'object') : [];
    if (!stageResources.length) empty(resources, 'No source action selected', 'Use the unit scope and ask AI for a proposal.');
    for (const resource of stageResources) {
      const row = resources.createDiv({ cls: 'los-resource-row' });
      icon(row.createSpan(), resource.kind === 'watch' ? 'play' : resource.kind === 'practise' ? 'pencil-line' : 'book-open');
      const copy = row.createDiv({ cls: 'los-resource-copy' });
      copy.createEl('strong', { text: resource.label });
      if (resource.locator) copy.createDiv({ cls: 'los-micro', text: resource.locator });
      if (resource.source_id) {
        const source = this.plugin.store.get(resource.source_id);
        chip(copy, source, (record) => this.plugin.openLibrary(record.id));
      }
      const actions = row.createDiv({ cls: 'los-actions los-resource-actions' });
      if (resource.url || resource.vault_path) button(actions, 'Open', () => this.plugin.openResource(resource), 'quiet');
      // Three feedback buttons per resource used to outweigh the resource
      // itself; the judgment is still one click away, it just no longer
      // competes with the thing the learner came to read.
      if (resource.source_id) {
        overflowMenu(actions, [
          ['Helpful', () => this.mutate(() => this.plugin.gateway.feedback(unit.id, stage.id, resource.source_id, 'helpful'))],
          ['Too advanced', () => this.mutate(() => this.plugin.gateway.feedback(unit.id, stage.id, resource.source_id, 'too-advanced'))],
          ['Useful for review', () => this.mutate(() => this.plugin.gateway.feedback(unit.id, stage.id, resource.source_id, 'useful-for-review'))],
        ], `Rate ${resource.label}`);
      }
    }

    const criteria = Array.isArray(stage.done_when)
      ? stage.done_when.filter((row) => typeof row === 'string' && row.trim()) : [];
    if (criteria.length) {
      const done = section(center, 'Done when');
      const marks = this.plugin.getDoneWhen(unit.id, stage.id);
      const list = done.createDiv({ cls: 'los-donewhen-list' });
      for (const [index, criterion] of criteria.entries()) {
        const row = list.createEl('label', { cls: 'los-donewhen-row' });
        const box = row.createEl('input', {
          attr: { type: 'checkbox', 'aria-label': criterion },
        });
        if (marks[index]) box.setAttr('checked', 'checked');
        box.checked = Boolean(marks[index]);
        box.addEventListener('change', () => {
          this.plugin.setDoneWhen(unit.id, stage.id, index, Boolean(box.checked));
          row.toggleClass('is-checked', Boolean(box.checked));
        });
        row.toggleClass('is-checked', Boolean(marks[index]));
        row.createSpan({ text: criterion });
      }
    }
    this.renderStageContext(center, unit, studyMap, stage);
  }

  /** One primary action and one menu. The primary is filled; nothing else on this
   *  screen may be. */
  renderActionBar(root, unit, studyMap, stage) {
    const bar = root.createDiv({ cls: 'los-unit-actionbar' });
    button(bar, 'Mark complete', () => this.mutate(
      () => this.plugin.gateway.progress(unit.id, stage.id, 'complete'),
      () => this.plugin.clearDoneWhen(unit.id, stage.id)), 'cta');
    overflowMenu(bar, [
      stage.status !== 'active' && ['Revisit stage', () => this.mutate(
        () => this.plugin.gateway.progress(unit.id, stage.id, 'revisit'))],
      ['Pause unit', () => this.mutate(() => this.plugin.gateway.progress(unit.id, stage.id, 'paused'))],
      ['Skip stage', () => this.mutate(() => this.plugin.gateway.progress(unit.id, stage.id, 'skipped'))],
      ['Report prerequisite gap', () => this.mutate(
        () => this.plugin.gateway.detour(unit.id, stage.id, 'Prerequisite gap', 'required-now'))],
      ['Prepare shelving', () => this.plugin.openShelving(unit.id)],
      this.plugin.settings.showAiRecommendation && ['Ask AI with stage context', () => this.plugin.askAiScoped(
        'Help with this stage. Treat the active file as supplementary context only.',
        { moduleId: unit.module_id, projectId: this.plugin.store.projectForUnit(unit)?.id, unitId: unit.id, stageId: stage.id })],
      ['End learning session', () => this.plugin.reviewSessionEnd()],
    ], 'More unit actions');
  }

  renderStageContext(center, unit, studyMap, stage) {
    const stageAttachments = Array.isArray(stage.attachments) ? stage.attachments.filter(Boolean) : [];
    const detours = (studyMap.detours || []).filter((row) => row.spawned_by_stage === stage.id && row.status !== 'resolved');
    const feedbackRows = Array.isArray(stage.source_feedback) ? stage.source_feedback : [];
    if (!stageAttachments.length && !detours.length && !feedbackRows.length) return;
    const detail = disclosure(center, 'Stage context');
    for (const attachment of stageAttachments) {
      const path = typeof attachment === 'string' ? attachment : attachment.path || attachment.vault_path;
      const label = typeof attachment === 'string' ? attachment.split('/').pop() : attachment.label || path;
      if (path) button(detail, label, () => this.plugin.openAuthoredPath(path), 'quiet');
    }
    for (const detour of detours) {
      const row = detail.createDiv({ cls: 'los-detour-row' });
      row.createEl('strong', { text: 'Open prerequisite detour' });
      row.createEl('p', { text: `${detour.title} · ${detour.classification} · returns here` });
      button(row, 'Resolve and return', () => this.mutate(
        () => this.plugin.gateway.resolveDetour(unit.id, detour.id, 'Resolved from the unit workspace.')), 'quiet');
    }
    for (const row of feedbackRows) detail.createDiv({ cls: 'los-row', text: `${row.source_id} · ${row.feedback}` });
  }

  renderArtifacts(root, unit) {
    const wrap = section(root, 'Unit artifacts', 'Durable notes remain globally canonical; this unit owns stable references.');
    const labels = { ultimate_reference: 'Ultimate Reference', exercise_bank: 'Exercise Bank', mock_exam: 'Mock Exam' };
    let count = 0;
    for (const [key, label] of Object.entries(labels)) {
      const id = unit.artifacts?.[key];
      if (!id) continue;
      count += 1;
      const card = wrap.createDiv({ cls: 'los-artifact-card' });
      card.createEl('h3', { text: label });
      chip(card, this.plugin.store.get(id), (record) => this.plugin.openRecord(record));
    }
    for (const id of unit.artifacts?.other || []) {
      count += 1; chip(wrap, this.plugin.store.get(id), (record) => this.plugin.openRecord(record));
    }
    if (!count) empty(wrap, 'No durable artifact linked yet', 'Working notes stay with the stage until shelving is approved.');
  }

  /**
   * Every write goes through the plugin-wide queue, so two clicks in two views
   * can no longer race the same `--expected-snapshot`.
   */
  async mutate(action, onConfirmed = null) {
    // A second click on the same control is a slip, not a second intention, so
    // the view drops it. The queue below still serializes anything that does
    // get through from another view.
    if (this.plugin.gateway.isBusy) { new Notice('A LearningOS write is already running.'); return; }
    try {
      await this.plugin.mutate(action);
      onConfirmed?.();
      this.render();
    } catch (error) { new Notice(error?.message || String(error)); }
  }


  async selectStage(stageId) {
    this.stageId = stageId;
    this.plugin.setSelectedStage(this.unitId, stageId);
    await this.leaf.setViewState({
      type: VIEW_UNIT,
      active: true,
      state: { unitId: this.unitId, stageId: this.stageId },
    });
  }
}
