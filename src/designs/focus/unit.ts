import { badge, button, chip, disclosure, filterTabs, overflowMenu } from '../../components';
import { renderPlacementCard, renderRouteCard, routeForResource } from '../../features/unit/material-card';
import { triageGroup } from '../../features/unit/material-drawer';
import { renderMaterialOverview } from '../../features/unit/materials';
import { readStudyMap, readUnitRecord, type MaterialOptionView, type StageRecordView, type StudyMapView, type UnitRecordView } from '../../features/unit/model';
import { renderPlanControls, selectedStage, sittingStudyMap } from '../../features/unit/shell';
import { stageMaterialOptions, stageMenuItems, stageResourceRenderer } from '../../features/unit/stage';
import { currentWorkResource, triageSummary, type StageResourceView } from '../../features/stage-resources';
import { asLabel, asString } from '../../projection/readers';
import type { UnitScreenHost } from '../screens';
import { chevron, heading, page, progress, row, toolbar } from './parts';

type Mode = 'plan' | 'session' | 'materials' | 'overview' | 'wrapup';
type MaterialScope = 'stage' | 'unit' | 'course';
interface Attention { unitId: string; mode: Mode; materialScope: MaterialScope }
const attention = new WeakMap<UnitScreenHost, Attention>();
const requestedSessions = new Set<string>();
/** A launch hint is consumed once; plan/session attention thereafter belongs to its leaf. */
export function requestFocusSession(unitId: string): void { requestedSessions.add(unitId); }
interface Context {
  view: UnitScreenHost;
  unit: UnitRecordView;
  durable: StudyMapView;
  map: StudyMapView;
  stage: StageRecordView;
  temporary: boolean;
  options: MaterialOptionView[];
  state: Attention;
  guards: Readonly<Record<string, number>>;
}
function show(context: Context, mode: Mode): void { context.state.mode = mode; context.view.render(); }
function openStage(context: Context, stageId: string): void {
  context.state.mode = 'session';
  if (context.stage.id === stageId) context.view.render();
  else void context.view.selectStage(stageId);
}
function stageState(stage: StageRecordView, map: StudyMapView): string {
  return stage.status === 'complete' ? 'Complete' : stage.status === 'skipped' ? 'Skipped' : stage.id === map.currentStageId ? 'Current' : 'Not started';
}
function countDone(map: StudyMapView): number { return map.stages.filter(stage => stage.status === 'complete').length; }
function adjust(parent: HTMLElement, context: Context): void {
  const details = disclosure(parent, 'Adjust study plan', 'focus-adjust-plan');
  renderPlanControls(context.view, details, context.unit, context.durable, context.map, context.temporary, context.options);
}
function note(context: Context): void {
  context.view.plugin.openUnitNote(context.unit.record, context.durable.record);
}
export function renderFocusUnit(view: UnitScreenHost): boolean {
  const unit = readUnitRecord(view.unitId ? view.plugin.store.get(view.unitId) : null, view.unitId);
  const projected = unit ? view.plugin.store.mapForUnit(unit.id) : null;
  if (!unit || !projected) return false;
  const durable = readStudyMap(projected);
  const { studyMap: map, temporary } = sittingStudyMap(view, unit.id, durable);
  if (!map.stages[0]) return false;
  let state = attention.get(view);
  if (!state || state.unitId !== unit.id) {
    state = { unitId: unit.id, mode: 'plan', materialScope: 'stage' };
    attention.set(view, state);
  }
  if (requestedSessions.delete(unit.id)) state.mode = 'session';
  const stage = selectedStage(view, unit.id, map, map.stages[0], Boolean(temporary));
  const context: Context = { view, unit, durable, map, stage, temporary: Boolean(temporary),
    options: stageMaterialOptions(view, unit), state,
    guards: view.plugin.store.artifactGuard(unit.id, asString(durable.record.id)) };
  const root = page(view.contentEl, state.mode, view.plugin.store);
  const module = view.plugin.store.get(unit.moduleId);
  const actions = toolbar(root, state.mode === 'wrapup' ? 'End session' : unit.title,
    module ? asLabel(module) : '', () => view.plugin.nav.openModule(unit.moduleId));
  if (state.mode !== 'plan') button(actions, 'Study plan', () => show(context, 'plan'), 'quiet');
  if (state.mode !== 'wrapup') button(actions, 'End session', () => show(context, 'wrapup'), 'quiet');
  if (context.temporary) root.createDiv({ cls: 'focus-callout', text: `For this sitting: ${map.stages.length} of ${durable.stages.length} stages. Recording work or a new snapshot ends this order.` });
  if (state.mode === 'session') session(root, context);
  else if (state.mode === 'materials') materials(root, context);
  else if (state.mode === 'wrapup') wrapup(root, context);
  else plan(root, context);
  return true;
}
function plan(root: HTMLElement, context: Context): void {
  const { view, unit, map, state } = context;
  const body = root.createDiv({ cls: 'focus-page' });
  heading(body, 'Study plan', unit.title, 'A clear path through the lecture, with materials and completion criteria at each stage.');
  const controls = body.createDiv({ cls: 'focus-filters' });
  filterTabs(controls, 'Plan view', [['plan', 'Study plan'], ['materials', 'Materials'], ['overview', 'Overview']], state.mode, next => {
    if (next === 'materials') state.materialScope = 'unit';
    show(context, next as Mode);
  });
  if (state.mode === 'plan') button(controls, 'Resume stage', () => openStage(context, map.currentStageId ?? context.stage.id), 'cta');
  const meta = body.createDiv({ cls: 'focus-plan-meta' });
  progress(meta, countDone(map), map.stages.length);
  adjust(meta, context);
  if (state.mode === 'overview') {
    renderMaterialOverview(view, body, unit, context.options, view.plugin.store.materialSynthesisForUnit(unit.id), false);
    view.renderArtifacts(body, unit);
    return;
  }
  const list = body.createDiv({ cls: 'focus-plan-list', attr: { role: 'list', 'aria-label': 'Stages in order' } });
  for (const [index, stage] of map.stages.entries()) {
    const item = list.createDiv({ attr: { role: 'listitem' } });
    const target = row(item, `Open stage: ${stage.title}`, () => openStage(context, stage.id));
    if (stage.id === map.currentStageId) target.addClass('is-current');
    target.createSpan({ cls: 'focus-stage-number', text: String(index + 1).padStart(2, '0') });
    const copy = target.createDiv({ cls: 'focus-row-copy' });
    copy.createEl('strong', { text: stage.title });
    copy.createSpan({ cls: 'focus-muted', text: stage.objective ?? `${stage.resources.length} materials · ${stage.doneWhen.length} completion criteria` });
    target.createSpan({ cls: `focus-row-state${stage.status === 'complete' ? ' is-complete' : ''}`, text: stageState(stage, map) });
    chevron(target);
  }
  const nearby = body.createDiv({ cls: 'focus-nearby' });
  button(nearby, 'Add session note', () => note(context), 'quiet');
  const artifacts = disclosure(body, 'Unit artifacts and evidence');
  view.renderArtifacts(artifacts, unit);
}
function materialCard(parent: HTMLElement, context: Context, resource: StageResourceView, prominent = false): void {
  const { view, unit, stage, guards, options } = context;
  const route = routeForResource(resource, options);
  renderPlacementCard(parent, resource, route, resource.sourceId ? view.plugin.store.get(resource.sourceId) : null, {
    plugin: view.plugin, unitId: unit.id, stageId: stage.id,
    renderer: stageResourceRenderer(view, unit, stage, guards, options),
    refresh: () => view.render(),
  }, { prominent });
}
function session(root: HTMLElement, context: Context): void {
  const { view, unit, stage, map } = context;
  const workspace = root.createDiv({ cls: 'focus-workspace' });
  const rail = workspace.createDiv({ cls: 'focus-stage-rail' });
  rail.createDiv({ cls: 'focus-eyebrow', text: 'Study plan' });
  progress(rail, countDone(map), map.stages.length);
  for (const [index, item] of map.stages.entries()) {
    const target = row(rail, `Stage ${index + 1}: ${item.title}`, () => openStage(context, item.id));
    target.setAttr('aria-current', item.id === stage.id ? 'step' : 'false');
    if (item.id === stage.id) target.addClass('is-current');
    target.createSpan({ cls: 'focus-stage-number', text: item.status === 'complete' ? '✓' : String(index + 1).padStart(2, '0') });
    const copy = target.createDiv({ cls: 'focus-row-copy' });
    copy.createEl('strong', { text: item.title });
    copy.createSpan({ cls: 'focus-muted', text: stageState(item, map) });
  }
  button(rail, 'View full plan', () => show(context, 'plan'), 'quiet');
  button(rail, 'Add session note', () => note(context), 'quiet');
  const center = workspace.createDiv({ cls: 'focus-stage' });
  const position = map.stages.findIndex(item => item.id === stage.id) + 1;
  const badges = center.createDiv({ cls: 'focus-stage-badges' });
  button(badges, `Study plan · Stage ${position} of ${map.stages.length}`, () => show(context, 'plan'), 'quiet').addClass('focus-compact-plan');
  badge(badges, `Stage ${String(position).padStart(2, '0')} / ${String(map.stages.length).padStart(2, '0')}`, 'role').addClass('focus-stage-position');
  badge(badges, stageState(stage, map), 'role');
  if (stage.examCritical) badge(badges, 'Exam-critical', 'status');
  heading(center, '', stage.title, stage.objective ?? '');
  center.createEl('hr');
  if (stage.doneWhen.length) {
    const marks = view.plugin.getDoneWhen(unit.id, stage.id, stage.doneWhen);
    const section = center.createDiv({ cls: 'focus-criteria' });
    const head = section.createDiv({ cls: 'focus-section-head' });
    head.createEl('h2', { text: 'Done when' });
    const count = head.createSpan({ cls: 'focus-muted', attr: { 'aria-live': 'polite' } });
    const recount = () => count.setText(`${stage.doneWhen.filter((_, index) => marks[index]).length} of ${stage.doneWhen.length}`);
    recount();
    stage.doneWhen.forEach((criterion, index) => {
      const label = section.createEl('label', { cls: 'focus-criterion' });
      const box = label.createEl('input', { attr: { type: 'checkbox', 'aria-label': criterion } });
      box.checked = Boolean(marks[index]);
      label.createSpan({ text: criterion });
      box.addEventListener('change', () => {
        marks[index] = box.checked;
        view.plugin.setDoneWhen(unit.id, stage.id, index, box.checked, stage.doneWhen);
        recount();
      });
    });
  }
  const current = center.createDiv({ cls: 'focus-current-work' });
  const head = current.createDiv({ cls: 'focus-section-head' });
  head.createEl('h2', { text: 'Current work' });
  head.createSpan({ cls: 'focus-muted', text: `${stage.resources.filter(item => !item.scopeTriage || item.scopeTriage === 'required-now').length} required` });
  const resource = currentWorkResource(stage.resources);
  if (resource) materialCard(current, context, resource, true);
  else current.createEl('p', { cls: 'focus-muted', text: 'No required material is named for this stage. The complete catalogue remains available below.' });
  const all = center.createDiv({ cls: 'focus-material-total' });
  const copy = all.createDiv({ cls: 'focus-row-copy' });
  copy.createEl('strong', { text: `All ${stage.resources.length} stage materials` });
  copy.createSpan({ cls: 'focus-muted', text: triageSummary(stage.resources) || 'No material placements on this stage.' });
  button(all, 'Compare all', () => { context.state.materialScope = 'stage'; show(context, 'materials'); }, 'quiet');
  const details = disclosure(center, 'Stage notes, history and connections', 'focus-stage-context');
  view.renderStageContext(details, unit, map, stage);
  for (const id of stage.concepts) {
    const record = view.plugin.store.get(id);
    if (record) chip(details, record, target => view.plugin.nav.openRecord(target));
  }
  const foot = center.createDiv({ cls: 'focus-stage-footer' });
  if (stage.status === 'complete') {
    const bar = foot.createDiv({ cls: 'los-unit-actionbar' });
    bar.createSpan({ cls: 'los-micro los-unit-actionbar-rule', text: 'This stage is recorded complete. Completion is study progress, not learner evidence.' });
    const next = map.stages.slice(position).find(item => item.status !== 'complete' && item.status !== 'skipped');
    button(bar, next ? 'Next stage' : 'Review session', () => next ? openStage(context, next.id) : show(context, 'wrapup'), 'cta');
    overflowMenu(bar, stageMenuItems(view, unit, stage, context.guards), 'More unit actions');
  } else view.renderActionBar(foot, unit, stage, context.guards);
}
function materials(root: HTMLElement, context: Context): void {
  const { view, unit, stage, state } = context;
  const body = root.createDiv({ cls: 'focus-page' });
  const actions = body.createDiv({ cls: 'focus-section-head' });
  heading(actions, `Stage ${context.map.stages.findIndex(item => item.id === stage.id) + 1}`, 'Choose what helps now.');
  button(actions, 'Back to session', () => show(context, 'session'), 'quiet');
  body.createEl('p', { cls: 'focus-lede', text: `All ${stage.resources.length} materials stay available, grouped by their purpose in this stage.` });
  filterTabs(body, 'Material scope', [['stage', `This stage · ${stage.resources.length}`], ['unit', 'Unit materials'], ['course', 'Course sources']], state.materialScope, next => { state.materialScope = next; view.render(); });
  if (state.materialScope === 'unit') renderMaterialOverview(view, body, unit, context.options, view.plugin.store.materialSynthesisForUnit(unit.id), true);
  else if (state.materialScope === 'course') {
    body.createEl('h2', { text: 'Other lectures in this module' });
    for (const record of view.plugin.store.unitsFor(unit.moduleId, unit.componentId)) {
      const other = readUnitRecord(record, asString(record.id));
      if (!other || other.id === unit.id) continue;
      const section = body.createDiv({ cls: 'focus-course-unit' });
      section.createEl('h3', { text: other.title });
      const options = stageMaterialOptions(view, other);
      for (const option of options) renderRouteCard(section, option,
        option.sourceId ? view.plugin.store.get(option.sourceId) : null, {
          plugin: view.plugin, unitId: other.id,
          renderer: stageResourceRenderer(view, unit, stage, context.guards, context.options),
          refresh: () => view.render(),
        });
      button(section, 'Go to lecture', () => view.plugin.nav.openUnit(other.id), 'quiet');
    }
  } else {
    const columns = body.createDiv({ cls: 'focus-material-columns' });
    const needed = columns.createDiv({ cls: 'focus-material-needed' });
    const reference = columns.createDiv({ cls: 'focus-material-reference' });
    for (const [key, label, parent] of [['required', 'Required now', needed], ['stuck', 'If stuck', needed], ['reference', 'Depth & reference', reference]] as const) {
      const resources = stage.resources.filter(resource => triageGroup(resource) === key);
      const section = parent.createDiv({ cls: `focus-material-group is-${key}` });
      section.createEl('h2', { cls: 'focus-eyebrow', text: `${label} · ${resources.length}` });
      for (const resource of resources) materialCard(section, context, resource, key === 'required');
      if (!resources.length) section.createEl('p', { cls: 'focus-muted', text: 'No materials in this group.' });
    }
    body.createEl('p', { cls: 'focus-muted', text: 'Stage placement and the full unit material menu remain distinct.' });
  }
}
function wrapup(root: HTMLElement, context: Context): void {
  const { view, unit, map, stage } = context;
  const body = root.createDiv({ cls: 'focus-page focus-wrapup' });
  heading(body, 'Session wrap-up', 'Leave a clear place to return.', 'Review what was recorded. Add one note for the session if it will help next time.');
  const status = body.createDiv({ cls: 'focus-callout' });
  status.createEl('strong', { text: 'Review your recorded changes' });
  status.createEl('p', { text: 'Stage progress and saved notes appear in the session’s exact change review. Drafts below stay on this device until explicitly saved.' });
  body.createEl('h2', { text: 'Session note · optional' });
  const draft = view.plugin.getUnitNoteDraft(unit.id, map.stages.map(item => item.record));
  const editor = body.createEl('textarea', { cls: 'los-note-editor focus-note-editor', attr: { 'aria-label': 'Optional session note', placeholder: 'What did you work out? Where did you get stuck? What should you try next?' } });
  editor.value = draft.text;
  const local = body.createDiv({ cls: 'focus-section-head' });
  const hint = local.createSpan({ cls: 'focus-muted', attr: { 'aria-live': 'polite' } });
  const updateHint = () => hint.setText(editor.value.trim() ? 'Draft kept locally. Review and save it to attach it to this lecture.' : 'Optional. Nothing entered yet.');
  updateHint();
  editor.addEventListener('input', () => {
    view.plugin.setUnitNoteDraft(unit.id, draft.title, editor.value, Object.keys(draft.expectedRevisions).length ? draft.expectedRevisions : context.guards);
    updateHint();
  });
  button(local, 'Review and save note', () => note(context), 'quiet');
  const next = body.createDiv({ cls: 'focus-return-point' });
  next.createDiv({ cls: 'focus-eyebrow', text: 'When you return' });
  // Keep the recorded current stage; entering wrap-up never advances progress.
  const current = map.stages.find(item => item.id === map.currentStageId) ?? stage;
  next.createEl('h2', { text: current.title });
  next.createEl('p', { cls: 'focus-muted', text: `${unit.title} · Stage ${map.stages.findIndex(item => item.id === current.id) + 1}` });
  const actions = body.createDiv({ cls: 'focus-wrapup-actions' });
  button(actions, 'Keep studying', () => show(context, 'session'), 'quiet');
  button(actions, 'Review session changes', () => view.plugin.reviewSessionEnd(), 'cta');
  body.createEl('p', { cls: 'focus-muted', text: 'Review the exact changes before choosing whether to commit or push them. Unsaved note text remains a local draft.' });
}
