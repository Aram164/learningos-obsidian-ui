import { badge, button, chip, disclosure, filterTabs, overflowMenu } from '../../components';
import { placementAvailability, projectedAvailability, purposeLabel, renderPlacementCard, renderRouteCard, routeForResource } from '../../features/unit/material-card';
import { triageGroup } from '../../features/unit/material-drawer';
import { renderMaterialMenu, renderMaterialOverview } from '../../features/unit/materials';
import { emptyMaterialFilters, materialMatches, renderMaterialFilters, type MaterialFacet, type MaterialFilters } from '../../features/unit/material-filters';
import { learningActionLabel, materialTypeKey, materialTypeLabel } from '../../features/unit/material-types';
import { readStudyMap, readUnitRecord, type MaterialOptionView, type StageRecordView, type StudyMapView, type UnitRecordView } from '../../features/unit/model';
import { renderPlanControls, selectedStage, sittingStudyMap } from '../../features/unit/shell';
import { stageMaterialOptions, stageMenuItems, stageResourceRenderer } from '../../features/unit/stage';
import { currentWorkResource, triageSummary, type StageResourceView } from '../../features/stage-resources';
import { asLabel, asString } from '../../projection/readers';
import type { UnitScreenHost } from '../screens';
import { withRenderFocus } from '../../accessibility/render-focus';
import { chevron, heading, page, progress, row, toolbar } from './parts';

type Mode = 'plan' | 'session' | 'materials' | 'overview' | 'wrapup';
type MaterialScope = 'stage' | 'unit' | 'course';
interface Attention {
  unitId: string; mode: Mode; materialScope: MaterialScope;
  filters: Record<MaterialScope, MaterialFilters>;
  scroll: Map<string, number>; lastKey?: string;
  materialsReturn: 'plan' | 'session' | 'overview'; materialsVisited: boolean;
}
/**
 * Where a lecture detour left from. It carries its own copy of the origin's
 * attention, so the way back stays exact even after the bounded map below has
 * forgotten the origin.
 */
interface Detour {
  readonly origin: { readonly unitId: string; readonly title: string; readonly stageId: string; readonly stageNumber: number; readonly attention: Attention };
  /** The lecture the way back is offered on. A detour continued from it moves it on. */
  destinationId: string;
}
/**
 * Attention per lecture, per unit tab, in memory only (Plan B step 2). The map
 * is kept in recency order and bounded, so a long-lived tab cannot grow it.
 */
interface HostAttention {
  readonly units: Map<string, Attention>;
  shownUnitId: string | null;
  detour: Detour | null;
}
const ATTENTION_LIMIT = 8;
const attention = new WeakMap<UnitScreenHost, HostAttention>();
function hostAttention(view: UnitScreenHost): HostAttention {
  let host = attention.get(view);
  if (!host) { host = { units: new Map(), shownUnitId: null, detour: null }; attention.set(view, host); }
  return host;
}
function freshAttention(unitId: string): Attention {
  return { unitId, mode: 'plan', materialScope: 'stage',
    filters: { stage: emptyMaterialFilters(), unit: emptyMaterialFilters(), course: emptyMaterialFilters() },
    scroll: new Map(), materialsReturn: 'plan', materialsVisited: false };
}
/** A resting copy: no location is "current" until the copy is drawn again. */
function copyAttention(state: Attention): Attention {
  const copy: Attention = { ...state, scroll: new Map(state.scroll),
    filters: { stage: { ...state.filters.stage }, unit: { ...state.filters.unit }, course: { ...state.filters.course } } };
  delete copy.lastKey;
  return copy;
}
/** The lecture's attention, now the most recent; the least recent beyond the bound is forgotten. */
function rememberAttention(host: HostAttention, unitId: string, state = host.units.get(unitId) ?? freshAttention(unitId)): Attention {
  host.units.delete(unitId);
  host.units.set(unitId, state);
  for (const oldest of host.units.keys()) {
    if (host.units.size <= ATTENTION_LIMIT) break;
    host.units.delete(oldest);
  }
  return state;
}
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
  host: HostAttention;
  guards: Readonly<Record<string, number>>;
}
function locationKey(mode: Mode, stageId: string, scope: MaterialScope): string {
  return `${mode}|${stageId}|${mode === 'materials' ? scope : ''}`;
}
/** Set the destination's scroll before the shared focus-restorer captures it. */
function prepareLocation(context: Context, mode: Mode, stageId = context.stage.id, scope = context.state.materialScope): void {
  const { state, view } = context;
  if (state.lastKey) state.scroll.set(state.lastKey, view.contentEl.scrollTop);
  state.mode = mode;
  state.materialScope = scope;
  delete state.lastKey;
  view.contentEl.scrollTop = state.scroll.get(locationKey(mode, stageId, scope)) ?? 0;
}
function show(context: Context, mode: Mode): void {
  const { state } = context;
  if (mode === 'materials' && state.mode !== 'materials') {
    state.materialsReturn = state.mode === 'plan' || state.mode === 'overview' ? state.mode : 'session';
    if (!state.materialsVisited) state.materialScope = state.mode === 'session' ? 'stage' : 'unit';
    state.materialsVisited = true;
  }
  prepareLocation(context, mode);
  context.view.render();
}
function openStage(context: Context, stageId: string): void {
  prepareLocation(context, 'session', stageId);
  if (context.stage.id === stageId) context.view.render();
  else void context.view.selectStage(stageId);
}
/**
 * Leave for another lecture from Course sources. The origin is recorded before
 * the destination opens; a detour continued from its own destination keeps the
 * place the learner first left.
 */
function leaveForLecture(context: Context, destinationId: string): void {
  const { view, unit, stage, map, state, host } = context;
  if (state.lastKey) state.scroll.set(state.lastKey, view.contentEl.scrollTop);
  if (host.detour?.destinationId === unit.id) host.detour.destinationId = destinationId;
  else {
    host.detour = { destinationId, origin: { unitId: unit.id, title: unit.title, stageId: stage.id,
      stageNumber: map.stages.findIndex(item => item.id === stage.id) + 1, attention: copyAttention(state) } };
  }
  void view.plugin.nav.openUnit(destinationId);
}
/** Back to the origin by ID, never by history, with the attention it had. */
function returnFromDetour(context: Context, detour: Detour): void {
  const { host, view } = context;
  host.detour = null;
  rememberAttention(host, detour.origin.unitId, copyAttention(detour.origin.attention));
  // A stage the newer snapshot removed falls back in selectedStage().
  void view.plugin.nav.openUnit(detour.origin.unitId, detour.origin.stageId);
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
  let rendered = false;
  withRenderFocus(view.contentEl, () => { rendered = renderFocusUnitContent(view); });
  return rendered;
}
function renderFocusUnitContent(view: UnitScreenHost): boolean {
  const host = hostAttention(view);
  if (host.shownUnitId !== view.unitId) {
    // The tab still shows the lecture being left: keep its scroll with it, and
    // never let its last location absorb the next lecture's scroll.
    const left = host.shownUnitId ? host.units.get(host.shownUnitId) : undefined;
    if (left?.lastKey) { left.scroll.set(left.lastKey, view.contentEl.scrollTop); delete left.lastKey; }
    host.shownUnitId = view.unitId;
  }
  const unit = readUnitRecord(view.unitId ? view.plugin.store.get(view.unitId) : null, view.unitId);
  const projected = unit ? view.plugin.store.mapForUnit(unit.id) : null;
  if (!unit || !projected) return false;
  const durable = readStudyMap(projected);
  const { studyMap: map, temporary } = sittingStudyMap(view, unit.id, durable);
  if (!map.stages[0]) return false;
  // The origin on screen again, by any route, ends the detour it started.
  if (host.detour?.origin.unitId === unit.id) host.detour = null;
  const state = rememberAttention(host, unit.id);
  if (requestedSessions.delete(unit.id)) state.mode = 'session';
  const stage = selectedStage(view, unit.id, map, map.stages[0], Boolean(temporary));
  const context: Context = { view, unit, durable, map, stage, temporary: Boolean(temporary),
    options: stageMaterialOptions(view, unit), state, host,
    guards: view.plugin.store.artifactGuard(unit.id, asString(durable.record.id)) };
  if (state.lastKey) state.scroll.set(state.lastKey, view.contentEl.scrollTop);
  const scrollKey = locationKey(state.mode, stage.id, state.materialScope);
  state.lastKey = scrollKey;
  const root = page(view.contentEl, state.mode, view.plugin.store);
  const module = view.plugin.store.get(unit.moduleId);
  const actions = toolbar(root, state.mode === 'wrapup' ? 'End session' : unit.title,
    module ? asLabel(module) : '', () => view.plugin.nav.openModule(unit.moduleId));
  const detour = host.detour;
  if (detour?.destinationId === unit.id) {
    button(actions, `Back to ${detour.origin.title} · Stage ${detour.origin.stageNumber}`,
      () => returnFromDetour(context, detour), 'quiet');
  }
  if (state.mode !== 'wrapup') button(actions, 'End session', () => show(context, 'wrapup'), 'quiet');
  if (state.mode !== 'wrapup') {
    const peers = root.createDiv({ cls: 'focus-peer-nav' });
    filterTabs(peers, 'Unit sections', [['plan', 'Study plan'], ['session', 'Session'], ['materials', 'Materials'], ['overview', 'Overview']], state.mode, next => show(context, next as Mode));
  }
  if (context.temporary) root.createDiv({ cls: 'focus-callout', text: `For this sitting: ${map.stages.length} of ${durable.stages.length} stages. Recording work or a new snapshot ends this order.` });
  if (state.mode === 'session') session(root, context);
  else if (state.mode === 'materials') materials(root, context);
  else if (state.mode === 'wrapup') wrapup(root, context);
  else plan(root, context);
  root.scrollTop = state.scroll.get(scrollKey) ?? 0;
  return true;
}
function plan(root: HTMLElement, context: Context): void {
  const { view, unit, map, state } = context;
  const body = root.createDiv({ cls: 'focus-page' });
  heading(body, state.mode === 'overview' ? 'Overview' : 'Study plan', unit.title, state.mode === 'overview' ? 'The lecture’s knowledge, material comparison and existing artifacts.' : 'An ordered path through the lecture, with materials and completion criteria at each stage.');
  const controls = body.createDiv({ cls: 'focus-filters' });
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
  const source = resource.sourceId ? view.plugin.store.get(resource.sourceId) : null;
  const availability = placementAvailability(resource, route, source);
  renderPlacementCard(parent, resource, route, source, {
    plugin: view.plugin, unitId: unit.id, stageId: stage.id,
    renderer: stageResourceRenderer(view, unit, stage, guards, options),
    refresh: () => view.render(),
  }, { prominent, purposeFallback: learningActionLabel(resource.kind), missingLocationLabel: 'Location needed',
    showInstructions: prominent && (availability.kind === 'none' || availability.kind === 'local-missing') });
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
  const current = center.createDiv({ cls: 'focus-current-work' });
  const head = current.createDiv({ cls: 'focus-section-head' });
  head.createEl('h2', { text: 'Current work' });
  head.createSpan({ cls: 'focus-muted', text: `${stage.resources.filter(item => !item.scopeTriage || item.scopeTriage === 'required-now').length} required` });
  const resource = currentWorkResource(stage.resources);
  if (resource) materialCard(current, context, resource, true);
  else current.createEl('p', { cls: 'focus-muted', text: 'No required material is named for this stage. The complete catalogue remains available below.' });
  if (resource) {
    const nextRequired = stage.resources.slice(stage.resources.indexOf(resource) + 1)
      .find(item => triageGroup(item) === 'required');
    if (nextRequired) {
      const next = disclosure(current, `Next required task in the authored order · ${nextRequired.label}`, 'focus-next-required');
      next.createEl('p', { cls: 'focus-muted', text: 'This is also required. Opening it does not resolve the current task; follow any prerequisites in the authored instructions.' });
      materialCard(next, context, nextRequired, true);
    }
  }
  const all = center.createDiv({ cls: 'focus-material-total' });
  const copy = all.createDiv({ cls: 'focus-row-copy' });
  copy.createEl('strong', { text: `All ${stage.resources.length} stage materials` });
  copy.createSpan({ cls: 'focus-muted', text: triageSummary(stage.resources) || 'No material placements on this stage.' });
  button(all, 'Compare all', () => { context.state.materialScope = 'stage'; show(context, 'materials'); }, 'quiet');
  if (stage.doneWhen.length) {
    const marks = view.plugin.getDoneWhen(unit.id, stage.id, stage.doneWhen);
    const section = center.createDiv({ cls: 'focus-criteria' });
    const head = section.createDiv({ cls: 'focus-section-head' });
    head.createEl('h2', { text: 'Done when' });
    const count = head.createSpan({ cls: 'focus-muted', attr: { 'aria-live': 'polite' } });
    const recount = () => count.setText(`${stage.doneWhen.filter((_, index) => marks[index]).length} of ${stage.doneWhen.length} criteria checked`);
    recount();
    section.createEl('p', { cls: 'focus-muted focus-criteria-meaning', text: 'Checks are your local working marks. Complete stage records progress; learner evidence is recorded separately.' });
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
function placementFacet(context: Context, resource: StageResourceView): MaterialFacet {
  const route = routeForResource(resource, context.options);
  const source = resource.sourceId ? context.view.plugin.store.get(resource.sourceId) : null;
  const format = asString(resource.record.format) ?? route?.format ?? asString(source?.source_type)
    ?? (resource.kind === 'watch' ? 'video' : resource.kind === 'practise' ? 'exercise' : '');
  return {
    medium: materialTypeKey(format), mediumLabel: materialTypeLabel(format),
    action: resource.kind, actionLabel: learningActionLabel(resource.kind),
    access: placementAvailability(resource, route, source).kind,
    search: [resource.label, resource.locator, learningActionLabel(resource.kind), format,
      route?.angle, resource.record.angle, resource.record.angle_detail, source?.title].filter(Boolean).join(' '),
  };
}
function routeFacet(option: MaterialOptionView, ownerTitle = ''): MaterialFacet {
  return {
    medium: materialTypeKey(option.format), mediumLabel: materialTypeLabel(option.format),
    action: option.depth, actionLabel: purposeLabel(option.depth),
    access: projectedAvailability(option.record).kind,
    search: [option.title, option.locator, option.angle, option.record.angle_detail, option.format,
      purposeLabel(option.depth), ownerTitle].filter(Boolean).join(' '),
  };
}
/** Filters redraw only the result region so typing never loses focus or its caret. */
function filteredMaterials<T>(
  body: HTMLElement, entries: readonly T[], state: MaterialFilters, facet: (entry: T) => MaterialFacet,
  render: (root: HTMLElement, visible: readonly T[]) => void, actionHeading = 'Learning action',
): void {
  const facets = entries.map(facet);
  const controls = renderMaterialFilters(body, facets, state, () => draw(), actionHeading);
  const result = body.createDiv({ cls: 'focus-material-results' });
  const draw = () => {
    const visible = entries.filter((_, index) => materialMatches(facets[index]!, state));
    controls.updateCount(visible.length, entries.length);
    result.empty();
    render(result, visible);
  };
  draw();
}
function materials(root: HTMLElement, context: Context): void {
  const { view, unit, stage, state } = context;
  const owners = view.plugin.store.unitsFor(unit.moduleId, unit.componentId)
    .map(record => readUnitRecord(record, asString(record.id)))
    .filter((other): other is UnitRecordView => Boolean(other && other.id !== unit.id));
  const courseEntries = owners.flatMap(owner => stageMaterialOptions(view, owner).map(option => ({ owner, option })));
  const module = view.plugin.store.get(unit.moduleId);
  const courseTitle = module ? asLabel(module) : 'this module';
  const body = root.createDiv({ cls: 'focus-page' });
  const actions = body.createDiv({ cls: 'focus-section-head' });
  const stageNumber = context.map.stages.findIndex(item => item.id === stage.id) + 1;
  const scopes = {
    stage: { title: 'Stage materials', location: `${unit.title} · Stage ${stageNumber} of ${context.map.stages.length}`,
      description: `${stage.resources.length} material${stage.resources.length === 1 ? '' : 's'} for ${stage.title}. Required now, If stuck and Reference keep the authored task order. Filters change only what is shown.` },
    unit: { title: 'Unit materials', location: unit.title,
      description: `${context.options.length} material route${context.options.length === 1 ? '' : 's'} for this lecture. This complete menu is a set of options, not additional required tasks.` },
    course: { title: 'Course sources', location: courseTitle,
      description: `${courseEntries.length} material route${courseEntries.length === 1 ? '' : 's'} from other lectures in ${courseTitle}. Each stays with its own lecture.` },
  };
  const scope = scopes[state.materialScope];
  heading(actions.createDiv({ cls: 'focus-heading-copy' }), scope.location, scope.title);
  const returnLabel = state.materialsReturn === 'plan' ? 'Back to study plan' : state.materialsReturn === 'overview' ? 'Back to overview' : 'Back to session';
  button(actions, returnLabel, () => show(context, state.materialsReturn), 'quiet');
  body.createEl('p', { cls: 'focus-lede', text: scope.description });
  filterTabs(body, 'Material scope', [['stage', `This stage · ${stage.resources.length}`], ['unit', `Unit materials · ${context.options.length}`], ['course', `Course sources · ${courseEntries.length}`]], state.materialScope, next => {
    prepareLocation(context, 'materials', stage.id, next); view.render();
  });
  if (state.materialScope === 'unit') {
    filteredMaterials(body, context.options, state.filters.unit, option => routeFacet(option),
      (results, visible) => renderMaterialMenu(view, results, unit, visible, true), 'Purpose');
  } else if (state.materialScope === 'course') {
    filteredMaterials(body, courseEntries, state.filters.course, ({ option, owner }) => routeFacet(option, owner.title),
      (results, visible) => {
        if (!visible.length) results.createEl('p', { cls: 'focus-muted', text: courseEntries.length ? 'No course material matches. Clear the filters to restore the complete list.' : 'No additional material routes are registered for the other lectures.' });
        for (const owner of owners) {
          const routes = visible.filter(entry => entry.owner.id === owner.id);
          if (!routes.length) continue;
          const section = results.createDiv({ cls: 'focus-course-unit' });
          section.createEl('h2', { text: owner.title });
          for (const { option } of routes) renderRouteCard(section, option,
            option.sourceId ? view.plugin.store.get(option.sourceId) : null, {
              plugin: view.plugin, unitId: owner.id,
              renderer: stageResourceRenderer(view, unit, stage, context.guards, context.options),
              refresh: () => view.render(),
            }, { missingLocationLabel: 'Location needed' });
          button(section, 'Go to lecture', () => leaveForLecture(context, owner.id), 'quiet');
        }
      }, 'Purpose');
  } else {
    filteredMaterials(body, stage.resources, state.filters.stage, resource => placementFacet(context, resource),
      (results, visible) => {
        const columns = results.createDiv({ cls: 'focus-material-columns' });
        const needed = columns.createDiv({ cls: 'focus-material-needed' });
        const reference = columns.createDiv({ cls: 'focus-material-reference' });
        for (const [key, label, parent] of [['required', 'Required now', needed], ['stuck', 'If stuck', needed], ['reference', 'Depth & reference', reference]] as const) {
          const all = stage.resources.filter(resource => triageGroup(resource) === key);
          const resources = visible.filter(resource => triageGroup(resource) === key);
          const section = parent.createDiv({ cls: `focus-material-group is-${key}` });
          section.createEl('h2', { cls: 'focus-eyebrow', text: `${label} · ${resources.length}${resources.length === all.length ? '' : ` of ${all.length}`}` });
          for (const resource of resources) materialCard(section, context, resource, key === 'required');
          if (!resources.length) section.createEl('p', { cls: 'focus-muted', text: all.length ? 'No matches here. Clear the filters to restore this group.' : 'No materials in this group.' });
        }
      });
    body.createEl('p', { cls: 'focus-muted', text: 'A material’s learning action, medium and access are separate. Filtering never completes, removes or reorders required work.' });
  }
}
function wrapup(root: HTMLElement, context: Context): void {
  const { view, unit, map, stage } = context;
  const body = root.createDiv({ cls: 'focus-page focus-wrapup' });
  heading(body, 'Session wrap-up', 'Leave a clear place to return.', 'Review what was recorded. Add one note for the session if it will help next time.');
  const status = body.createDiv({ cls: 'focus-callout' });
  status.createEl('strong', { text: 'Review your recorded changes' });
  status.createEl('p', { text: 'Stage progress and saved notes appear in the session’s exact change review. Drafts below stay on this device until explicitly saved.' });
  button(status, 'Review session changes', () => view.plugin.reviewSessionEnd(), 'cta');
  const next = body.createDiv({ cls: 'focus-return-point' });
  next.createDiv({ cls: 'focus-eyebrow', text: 'When you return' });
  // Keep the recorded current stage; entering wrap-up never advances progress.
  const current = map.stages.find(item => item.id === map.currentStageId) ?? stage;
  next.createEl('h2', { text: current.title });
  next.createEl('p', { cls: 'focus-muted', text: `${unit.title} · Stage ${map.stages.findIndex(item => item.id === current.id) + 1}` });
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
  const actions = body.createDiv({ cls: 'focus-wrapup-actions' });
  button(actions, 'Keep studying', () => show(context, 'session'), 'quiet');
  body.createEl('p', { cls: 'focus-muted', text: 'Review the exact changes before choosing whether to commit or push them. Unsaved note text remains a local draft.' });
}
