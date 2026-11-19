/**
 * Focus 2.0 Unit workspace:
 * - 48 px Horizontal Stage Timeline Strip (01 ✓ .. 05 ● .. 06 ○),
 * - 60 / 40 Split Session Cockpit (Start here, inline If you get stuck, Folded Kept for reference | Prove to complete, Complete/Next action bar, Working scratch, Stage concepts + Open in Atlas),
 * - Dynamic proof-to-complete CTA shift (Open -> Complete stage when all criteria verified),
 * - Purpose-first Materials scope with S1..SN matrix + Course source detours & Back button,
 * - Mapless unit "Needs a study map" state (never returns false silently when a projected unit lacks a map).
 */
import { badge, button, chip, disclosure, filterTabs, overflowMenu, plural } from '../../components';
import { withRenderFocus } from '../../accessibility/render-focus';
import { currentWorkResource, triageSummary, type StageResourceView } from '../../features/stage-resources';
import { triageGroup } from '../../features/unit/material-drawer';
import { emptyMaterialFilters, materialMatches, renderMaterialFilters, type MaterialFacet, type MaterialFilters } from '../../features/unit/material-filters';
import { placementAvailability, projectedAvailability, purposeLabel, renderPlacementCard, renderRouteCard, routeForResource } from '../../features/unit/material-card';
import {
  lectureMaterialsFacts,
  lectureMaterialsFor,
  materialAvailability,
  splitStage,
} from '../../features/unit/lecture-materials';
import { materialTypeDef, purposeDef, type LectureMaterial } from '../../features/unit/material-purpose';
import { learningActionLabel, materialTypeKey, materialTypeLabel } from '../../features/unit/material-types';
import { renderMaterialOverview } from '../../features/unit/materials';
import { materialsState } from '../../features/unit/materials-state';
import {
  nextOpenStage,
  readStudyMap,
  readUnitRecord,
  stageProgress,
  type MaterialOptionView,
  type StageRecordView,
  type StudyMapView,
  type UnitRecordView,
} from '../../features/unit/model';
import { renderPlanControls, selectedStage, sittingStudyMap } from '../../features/unit/shell';
import { stageMaterialOptions, stageMenuItems, stageResourceRenderer } from '../../features/unit/stage';
import { asLabel, asString } from '../../projection/readers';
import type { UnitScreenHost } from '../screens';
import { consumeFocusUnitHint, requestFocusSession } from './collection';
import { renderKeptReference, renderPurposeGroupedMaterials, renderStuckHelpers } from './materials';
import { chevron, commandBar, heading, moduleName, page, progress, row, sideCard, textLink, unitLabel } from './parts';

export { requestFocusSession };

type Mode = 'plan' | 'session' | 'materials' | 'overview' | 'wrapup';
type MaterialScope = 'stage' | 'unit' | 'course';

interface Attention {
  unitId: string;
  mode: Mode;
  materialScope: MaterialScope;
  filters: Record<MaterialScope, MaterialFilters>;
  scroll: Map<string, number>;
  lastKey?: string;
  materialsReturn: 'plan' | 'session' | 'overview';
  materialsVisited: boolean;
}

interface Detour {
  readonly origin: {
    readonly unitId: string;
    readonly title: string;
    readonly stageId: string;
    readonly stageNumber: number;
    readonly attention: Attention;
  };
  destinationId: string;
}

interface HostAttention {
  readonly units: Map<string, Attention>;
  shownUnitId: string | null;
  detour: Detour | null;
}

const ATTENTION_LIMIT = 8;
const attention = new WeakMap<UnitScreenHost, HostAttention>();

const isComplete = (stage: StageRecordView): boolean => stage.status === 'complete';
const isSkipped = (stage: StageRecordView): boolean => stage.status === 'skipped';

function hostAttention(view: UnitScreenHost): HostAttention {
  let host = attention.get(view);
  if (!host) {
    host = { units: new Map(), shownUnitId: null, detour: null };
    attention.set(view, host);
  }
  return host;
}

function freshAttention(unitId: string): Attention {
  return {
    unitId,
    mode: 'plan',
    materialScope: 'stage',
    filters: { stage: emptyMaterialFilters(), unit: emptyMaterialFilters(), course: emptyMaterialFilters() },
    scroll: new Map(),
    materialsReturn: 'plan',
    materialsVisited: false,
  };
}

function copyAttention(state: Attention): Attention {
  const copy: Attention = {
    ...state,
    scroll: new Map(state.scroll),
    filters: {
      stage: { ...state.filters.stage },
      unit: { ...state.filters.unit },
      course: { ...state.filters.course },
    },
  };
  delete copy.lastKey;
  return copy;
}

function rememberAttention(host: HostAttention, unitId: string, state = host.units.get(unitId) ?? freshAttention(unitId)): Attention {
  host.units.delete(unitId);
  host.units.set(unitId, state);
  for (const oldest of host.units.keys()) {
    if (host.units.size <= ATTENTION_LIMIT) break;
    host.units.delete(oldest);
  }
  return state;
}

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

function leaveForLecture(context: Context, destinationId: string): void {
  const { view, unit, stage, map, state, host } = context;
  if (state.lastKey) state.scroll.set(state.lastKey, view.contentEl.scrollTop);
  if (host.detour?.destinationId === unit.id) {
    host.detour.destinationId = destinationId;
  } else {
    host.detour = {
      destinationId,
      origin: {
        unitId: unit.id,
        title: unit.title,
        stageId: stage.id,
        stageNumber: map.stages.findIndex((item) => item.id === stage.id) + 1,
        attention: copyAttention(state),
      },
    };
  }
  void view.plugin.nav.openUnit(destinationId);
}

function returnFromDetour(context: Context, detour: Detour): void {
  const { host, view } = context;
  host.detour = null;
  rememberAttention(host, detour.origin.unitId, copyAttention(detour.origin.attention));
  void view.plugin.nav.openUnit(detour.origin.unitId, detour.origin.stageId);
}

function stageState(stage: StageRecordView, map: StudyMapView): string {
  return isComplete(stage) ? 'Complete'
    : isSkipped(stage) ? 'Skipped'
      : stage.id === map.currentStageId ? 'Current' : 'Not started';
}

function countDone(map: StudyMapView): number {
  return stageProgress(map.stages).done;
}

function adjust(parent: HTMLElement, context: Context): void {
  const details = disclosure(parent, 'Adjust study plan', 'focus-adjust-plan');
  renderPlanControls(context.view, details, context.unit, context.durable, context.map, context.temporary, context.options);
}

function note(context: Context): void {
  context.view.plugin.openUnitNote(context.unit.record, context.durable.record);
}

function collectButtons(root: HTMLElement): HTMLButtonElement[] {
  const out: HTMLButtonElement[] = [];
  const walk = (node: Element) => {
    const tag = ((node as unknown as { tag?: string }).tag ?? node.tagName ?? '').toLowerCase();
    if (tag === 'button') out.push(node as HTMLButtonElement);
    for (const child of Array.from(node.children ?? [])) walk(child);
  };
  walk(root);
  return out;
}

function buttonText(node: HTMLElement): string {
  const stub = node as unknown as { text?: string; allText?: () => string };
  return (stub.allText?.() ?? node.textContent ?? stub.text ?? '').trim();
}

export function renderFocusUnit(view: UnitScreenHost): boolean {
  let rendered = false;
  withRenderFocus(view.contentEl, () => { rendered = renderFocusUnitContent(view); });
  return rendered;
}

function renderMaplessUnit(view: UnitScreenHost, unit: UnitRecordView): true {
  const { plugin } = view;
  const module = plugin.store.get(unit.moduleId);
  const here = unitLabel(unit.record, module);
  const root = page(view.contentEl, 'mapless', plugin.store);
  commandBar(root, [
    { label: 'Modules', go: () => plugin.nav.openModules() },
    { label: module ? moduleName(module) : 'Module', go: () => plugin.nav.openModule(unit.moduleId) },
    { label: here.place },
  ], view);
  const body = root.createDiv({ cls: 'focus-page' });
  heading(body, module ? asLabel(module) : 'Unit', unit.title, unit.knowledgeSummary ?? '');
  const callout = body.createDiv({ cls: 'focus-callout' });
  callout.createEl('strong', { text: 'Needs a study map' });
  callout.createEl('p', {
    cls: 'focus-muted',
    text: unit.record.needs_study_map === true
      ? 'This unit has not yet been broken down into stages. Open your module overview or author a study map to start studying.'
      : 'No study map is published for this unit yet.',
  });
  button(callout, 'Back to module', () => plugin.nav.openModule(unit.moduleId), 'quiet');
  view.renderArtifacts(body, unit);
  return true;
}

function renderFocusUnitContent(view: UnitScreenHost): boolean {
  const host = hostAttention(view);
  if (host.shownUnitId !== view.unitId) {
    const left = host.shownUnitId ? host.units.get(host.shownUnitId) : undefined;
    if (left?.lastKey) {
      left.scroll.set(left.lastKey, view.contentEl.scrollTop);
      delete left.lastKey;
    }
    host.shownUnitId = view.unitId;
  }

  const unit = readUnitRecord(view.unitId ? view.plugin.store.get(view.unitId) : null, view.unitId);
  if (!unit) return false;
  const projected = view.plugin.store.mapForUnit(unit.id);
  if (!projected) return renderMaplessUnit(view, unit);
  const durable = readStudyMap(projected);
  const { studyMap: map, temporary } = sittingStudyMap(view, unit.id, durable);
  if (!map.stages[0]) return renderMaplessUnit(view, unit);

  if (host.detour?.origin.unitId === unit.id) host.detour = null;
  const state = rememberAttention(host, unit.id);
  const hint = consumeFocusUnitHint(unit.id);
  if (hint) state.mode = hint;

  const stage = selectedStage(view, unit.id, map, map.stages[0], Boolean(temporary));
  const context: Context = {
    view,
    unit,
    durable,
    map,
    stage,
    temporary: Boolean(temporary),
    options: stageMaterialOptions(view, unit),
    state,
    host,
    guards: view.plugin.store.artifactGuard(unit.id, asString(durable.record.id)),
  };

  if (state.lastKey) state.scroll.set(state.lastKey, view.contentEl.scrollTop);
  const scrollKey = locationKey(state.mode, stage.id, state.materialScope);
  state.lastKey = scrollKey;

  const root = page(view.contentEl, state.mode, view.plugin.store);
  const module = view.plugin.store.get(unit.moduleId);
  const here = unitLabel(unit.record, module);
  const position = map.stages.findIndex((item) => item.id === stage.id) + 1;
  const modeLabel = state.mode === 'materials' ? 'Materials'
    : state.mode === 'overview' ? 'Overview'
      : state.mode === 'wrapup' ? 'End session'
        : `Stage ${position}`;

  const crumbs = [
    { label: 'Modules', go: () => view.plugin.nav.openModules() },
    { label: module ? moduleName(module) : 'Module', go: () => view.plugin.nav.openModule(unit.moduleId) },
    { label: here.place, go: () => show(context, 'plan') },
    ...(state.mode === 'plan' ? [] : [{ label: modeLabel }]),
  ];
  const barActions = commandBar(root, crumbs, view);
  const detour = host.detour;
  if (detour?.destinationId === unit.id) {
    button(barActions, `Back to ${detour.origin.title} · Stage ${detour.origin.stageNumber}`, () => returnFromDetour(context, detour), 'quiet');
  }
  if (state.mode !== 'wrapup') {
    const peers = barActions.createDiv({ cls: 'focus-peer-nav' });
    filterTabs(
      peers,
      'Unit sections',
      [['plan', 'Study plan'], ['session', 'Session'], ['materials', 'Materials'], ['overview', 'Overview']],
      state.mode,
      (next) => show(context, next as Mode),
    );
    button(barActions, 'End session', () => show(context, 'wrapup'), 'quiet');

    // 48 px Horizontal Stage Timeline Bar directly below Top Command Bar
    const strip = root.createDiv({
      cls: 'focus-stage-strip',
      attr: { role: 'navigation', 'aria-label': 'Stages in sequence' },
    });
    for (const [index, item] of map.stages.entries()) {
      const done = isComplete(item);
      const current = item.id === stage.id;
      const glyph = done ? '✓' : current ? '●' : '○';
      const pill = strip.createEl('button', {
        cls: `focus-stage-pill${done ? ' is-done' : ''}${current ? ' is-current' : ''}`,
        attr: {
          type: 'button',
          'aria-current': current ? 'step' : 'false',
          'aria-label': `Stage ${index + 1}: ${item.title}`,
        },
      });
      pill.createSpan({ cls: 'focus-stage-pill-num focus-mono', text: `${String(index + 1).padStart(2, '0')} ${glyph}` });
      pill.createSpan({ text: item.title });
      pill.addEventListener('click', () => openStage(context, item.id));
    }
    button(strip, `Study plan · Stage ${position} of ${map.stages.length}`, () => show(context, 'plan'), 'quiet')
      .addClass('focus-compact-plan');
  }

  if (context.temporary) {
    root.createDiv({
      cls: 'focus-callout',
      text: `For this sitting: ${map.stages.length} of ${durable.stages.length} stages. Recording work or a new snapshot ends this order.`,
    });
  }

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
  const head = body.createDiv({ cls: 'focus-page-head' });
  const copy = head.createDiv({ cls: 'focus-heading-copy' });
  heading(
    copy,
    state.mode === 'overview' ? 'Overview' : 'Study plan',
    unit.title,
    state.mode === 'overview'
      ? 'The lecture’s knowledge, material comparison and existing artifacts.'
      : 'An ordered path through the lecture, with materials and completion criteria at each stage.',
  );
  if (state.mode === 'plan') {
    button(head, 'Resume stage', () => openStage(context, map.currentStageId ?? context.stage.id), 'cta');
  }
  const meta = body.createDiv({ cls: 'focus-plan-meta' });
  progress(meta, countDone(map), map.stages.length);
  adjust(meta, context);

  if (state.mode === 'overview') {
    renderMaterialOverview(view, body, unit, context.options, view.plugin.store.materialSynthesisForUnit(unit.id), false);
    view.renderArtifacts(body, unit);
    return;
  }

  const list = body.createDiv({ cls: 'focus-plan-list', attr: { role: 'list', 'aria-label': 'Stages in order' } });
  for (const [index, item] of map.stages.entries()) {
    const entry = list.createDiv({ attr: { role: 'listitem' } });
    const target = row(entry, `Open stage: ${item.title}`, () => openStage(context, item.id));
    if (item.id === map.currentStageId) target.addClass('is-current');
    target.createSpan({ cls: 'focus-stage-number focus-mono', text: String(index + 1).padStart(2, '0') });
    const rowCopy = target.createDiv({ cls: 'focus-row-copy' });
    rowCopy.createEl('strong', { text: item.title });
    rowCopy.createSpan({
      cls: 'focus-muted',
      text: item.objective ?? `${item.resources.length} materials · ${item.doneWhen.length} completion criteria`,
    });
    target.createSpan({ cls: `focus-row-state${isComplete(item) ? ' is-complete' : ''}`, text: stageState(item, map) });
    chevron(target);
  }
  const nearby = body.createDiv({ cls: 'focus-nearby' });
  button(nearby, 'Add session note', () => note(context), 'quiet');
  const artifacts = disclosure(body, 'Unit artifacts and evidence');
  view.renderArtifacts(artifacts, unit);
}

function materialCard(parent: HTMLElement, context: Context, resource: StageResourceView, prominent = false): HTMLElement {
  const { view, unit, stage, guards, options } = context;
  const route = routeForResource(resource, options);
  const source = resource.sourceId ? view.plugin.store.get(resource.sourceId) : null;
  const availability = placementAvailability(resource, route, source);
  return renderPlacementCard(parent, resource, route, source, {
    plugin: view.plugin,
    unitId: unit.id,
    stageId: stage.id,
    renderer: stageResourceRenderer(view, unit, stage, guards, options),
    refresh: () => view.render(),
  }, {
    prominent,
    purposeFallback: learningActionLabel(resource.kind),
    missingLocationLabel: 'Location needed',
    showInstructions: prominent && (availability.kind === 'none' || availability.kind === 'local-missing'),
  });
}

function session(root: HTMLElement, context: Context): void {
  const { view, unit, stage, map, durable } = context;
  const position = map.stages.findIndex((item) => item.id === stage.id) + 1;
  const allMaterials = lectureMaterialsFor(view.plugin.store, unit, durable, context.options);
  const split = splitStage(allMaterials, durable, stage);
  const mState = materialsState(view.leaf, unit.id);
  const doneWhenCount = stage.doneWhen.length;
  const marks = doneWhenCount ? view.plugin.getDoneWhen(unit.id, stage.id, stage.doneWhen) : [];

  const cockpit = root.createDiv({ cls: 'focus-cockpit' });
  const main = cockpit.createDiv({ cls: 'focus-cockpit-main focus-stage' });
  const dock = cockpit.createDiv({ cls: 'focus-cockpit-dock' });

  // ── Left 60 %: Stage Head + Start here + If you get stuck + Kept for reference
  const head = main.createDiv({ cls: 'focus-stage-head' });
  const badges = head.createDiv({ cls: 'focus-stage-badges' });
  badge(badges, `Stage ${String(position).padStart(2, '0')} / ${String(map.stages.length).padStart(2, '0')}`, 'role').addClass('focus-stage-position');
  badge(badges, stageState(stage, map), 'role');
  if (stage.examCritical) badge(badges, 'Exam-critical', 'status');
  const verifiedPill = doneWhenCount
    ? badges.createSpan({ cls: 'focus-pill' })
    : null;
  heading(head, '', stage.title, stage.objective ?? '');

  const current = main.createDiv({ cls: 'focus-current-work' });
  const workHead = current.createDiv({ cls: 'focus-section-head' });
  workHead.createEl('h2', { text: 'Start here' });
  workHead.createSpan({
    cls: 'focus-muted',
    text: `${stage.resources.filter((item) => !item.scopeTriage || item.scopeTriage === 'required-now').length} required`,
  });
  const resource = currentWorkResource(stage.resources);
  let openCardBtn: HTMLButtonElement | null = null;
  if (resource) {
    const card = materialCard(current, context, resource, true);
    openCardBtn = collectButtons(card).find((btn) => buttonText(btn) === 'Open' || buttonText(btn) === 'Open source') ?? null;
    const nextRequired = stage.resources.slice(stage.resources.indexOf(resource) + 1)
      .find((item) => triageGroup(item) === 'required');
    if (nextRequired) {
      const next = disclosure(current, `Next required task in the authored order · ${nextRequired.label}`, 'focus-next-required');
      next.createEl('p', { cls: 'focus-muted', text: 'This is also required. Opening it does not resolve the current task; follow any prerequisites in the authored instructions.' });
      materialCard(next, context, nextRequired, true);
    }
  } else {
    current.createEl('p', { cls: 'focus-muted', text: 'No required material is named for this stage. The complete catalogue remains available below.' });
  }

  if (split.helps.length && split.index >= 0) {
    renderStuckHelpers(main, split.helps, split.index, mState, {
      view,
      unit,
      stages: durable.stages,
      expected: context.guards,
      stage,
      refresh: () => view.render(),
    });
  }

  renderKeptReference(main, split.kept, mState, {
    view,
    unit,
    stages: durable.stages,
    expected: context.guards,
    stage,
    refresh: () => view.render(),
  });

  const all = main.createDiv({ cls: 'focus-material-total' });
  const copy = all.createDiv({ cls: 'focus-row-copy' });
  copy.createEl('strong', { text: `All ${stage.resources.length} stage materials` });
  copy.createSpan({ cls: 'focus-muted', text: triageSummary(stage.resources) || 'No material placements on this stage.' });
  button(all, 'Compare all', () => {
    context.state.materialScope = 'stage';
    show(context, 'materials');
  }, 'quiet');

  // ── Right 40 %: Prove to complete + Action Bar + Working scratch + Stage concepts
  const proofCard = dock.createDiv({ cls: 'focus-proof-card' });
  const criteriaSection = proofCard.createDiv({ cls: 'focus-criteria' });
  const criteriaHead = criteriaSection.createDiv({ cls: 'focus-section-head' });
  criteriaHead.createEl('h2', { text: doneWhenCount ? 'Done when' : 'Stage completion' });
  const countEl = doneWhenCount
    ? criteriaHead.createSpan({ cls: 'focus-muted', attr: { 'aria-live': 'polite' } })
    : null;

  const foot = proofCard.createDiv({ cls: 'focus-stage-footer' });
  const prevStage = position > 1 ? map.stages[position - 2] : null;
  if (prevStage) {
    button(foot, `‹ Stage ${String(position - 1).padStart(2, '0')}`, () => openStage(context, prevStage.id), 'quiet');
  }
  let completeBtn: HTMLButtonElement | null = null;
  if (isComplete(stage)) {
    const bar = foot.createDiv({ cls: 'los-unit-actionbar' });
    bar.createSpan({ cls: 'los-micro los-unit-actionbar-rule', text: 'Recorded complete. Completion is study progress, not learner evidence.' });
    const next = nextOpenStage(map.stages, stage.id);
    button(bar, next ? 'Next stage' : 'Review session', () => (next ? openStage(context, next.id) : show(context, 'wrapup')), 'cta');
    overflowMenu(bar, stageMenuItems(view, unit, stage, context.guards), 'More unit actions');
  } else {
    view.renderActionBar(foot, unit, stage, context.guards);
    completeBtn = collectButtons(foot).find((btn) => buttonText(btn) === 'Complete stage') ?? null;
  }

  const proofStateSpans: HTMLElement[] = [];
  const syncProofState = () => {
    const checked = marks.filter(Boolean).length;
    const allVerified = !doneWhenCount || checked === doneWhenCount;
    if (countEl) countEl.setText(`${checked} of ${doneWhenCount} criteria checked`);
    if (verifiedPill) {
      verifiedPill.setText(`${checked}/${doneWhenCount} Proofs Verified`);
      verifiedPill.toggleClass('is-success', allVerified);
    }
    proofStateSpans.forEach((span, idx) => {
      span.setText(marks[idx] ? 'Verified in session' : `Required proof ${String(idx + 1).padStart(2, '0')}`);
    });
    proofCard.toggleClass('is-verified', Boolean(doneWhenCount && allVerified));
    if (!isComplete(stage) && completeBtn) {
      const promoteComplete = allVerified || !openCardBtn;
      completeBtn.toggleClass('los-btn--cta', promoteComplete);
      completeBtn.toggleClass('los-btn--quiet', !promoteComplete);
      if (openCardBtn) {
        openCardBtn.toggleClass('los-btn--cta', !promoteComplete);
        openCardBtn.toggleClass('los-btn--quiet', promoteComplete);
      }
    }
  };

  if (doneWhenCount) {
    criteriaSection.createEl('p', {
      cls: 'focus-muted focus-criteria-meaning',
      text: 'Checks are your local working marks. Complete stage records progress; learner evidence is recorded separately.',
    });
    stage.doneWhen.forEach((criterion, index) => {
      const label = criteriaSection.createEl('label', { cls: 'focus-criterion' });
      const box = label.createEl('input', { attr: { type: 'checkbox', 'aria-label': criterion } });
      box.checked = Boolean(marks[index]);
      const copyBox = label.createDiv({ cls: 'focus-criterion-body' });
      copyBox.createSpan({ text: criterion });
      const sub = copyBox.createSpan({ cls: 'focus-eyebrow focus-criterion-state' });
      proofStateSpans.push(sub);
      box.addEventListener('change', () => {
        marks[index] = box.checked;
        view.plugin.setDoneWhen(unit.id, stage.id, index, box.checked, stage.doneWhen);
        syncProofState();
      });
    });
  } else {
    criteriaSection.createEl('p', {
      cls: 'focus-muted focus-criteria-meaning',
      text: 'No explicit completion checklist is recorded for this stage.',
    });
  }
  syncProofState();

  // Inline Working scratch bound to getUnitNoteDraft / setUnitNoteDraft
  const scratch = dock.createDiv({ cls: 'focus-scratch' });
  const scratchHead = scratch.createDiv({ cls: 'focus-section-head' });
  scratchHead.createDiv({ cls: 'focus-eyebrow', text: 'Working scratch · Session note draft' });
  textLink(scratchHead, 'Review and save →', () => note(context));
  const draft = view.plugin.getUnitNoteDraft(unit.id, map.stages.map((item) => item.record));
  const scratchEditor = scratch.createEl('textarea', {
    cls: 'focus-note-scratch',
    attr: {
      'aria-label': 'Working session scratch',
      placeholder: 'Jot derivations, rough intuitions or questions as you work…',
    },
  });
  scratchEditor.value = draft.text;
  const scratchFoot = scratch.createDiv({ cls: 'focus-section-head' });
  const scratchHint = scratchFoot.createSpan({ cls: 'focus-muted', attr: { 'aria-live': 'polite' } });
  const syncScratchHint = () => {
    scratchHint.setText(scratchEditor.value.trim() ? 'Local draft kept across tabs until saved.' : 'Optional scratchpad.');
  };
  syncScratchHint();
  scratchEditor.addEventListener('input', () => {
    view.plugin.setUnitNoteDraft(
      unit.id,
      draft.title,
      scratchEditor.value,
      Object.keys(draft.expectedRevisions).length ? draft.expectedRevisions : context.guards,
    );
    syncScratchHint();
  });
  button(scratchFoot, 'Review and save note', () => note(context), 'quiet');

  // Builds on & stage concepts
  const conceptsCard = sideCard(dock, 'Builds on & stage concepts');
  if (prevStage) {
    conceptsCard.createDiv({
      cls: 'focus-muted',
      text: `Builds on: Stage ${String(position - 1).padStart(2, '0')} · ${prevStage.title}`,
    });
  }
  if (stage.concepts.length) {
    const chips = conceptsCard.createDiv({ cls: 'focus-concept-chips' });
    for (const id of stage.concepts) {
      const record = view.plugin.store.get(id);
      if (record) chip(chips, record, (target) => view.plugin.nav.openRecord(target));
    }
  } else {
    conceptsCard.createEl('p', { cls: 'focus-muted', text: 'No concepts linked on this stage.' });
  }
  textLink(conceptsCard, 'Open in Atlas', () => view.plugin.nav.openAtlas({
    concept: stage.concepts[0] ?? null,
    module: stage.concepts[0] ? null : unit.moduleId,
    lens: 'prerequisites',
  }));

  const contextBox = sideCard(dock, 'Session context');
  const details = disclosure(contextBox, 'Stage notes, history and connections', 'focus-stage-context');
  view.renderStageContext(details, unit, map, stage);
}

function placementFacet(context: Context, resource: StageResourceView): MaterialFacet {
  const route = routeForResource(resource, context.options);
  const source = resource.sourceId ? context.view.plugin.store.get(resource.sourceId) : null;
  const format = asString(resource.record.format) ?? route?.format ?? asString(source?.source_type)
    ?? (resource.kind === 'watch' ? 'video' : resource.kind === 'practise' ? 'exercise' : '');
  return {
    medium: materialTypeKey(format),
    mediumLabel: materialTypeLabel(format),
    action: resource.kind,
    actionLabel: learningActionLabel(resource.kind),
    access: placementAvailability(resource, route, source).kind,
    search: [
      resource.label,
      resource.locator,
      learningActionLabel(resource.kind),
      format,
      route?.angle,
      resource.record.angle,
      resource.record.angle_detail,
      source?.title,
    ].filter(Boolean).join(' '),
  };
}

function lectureMaterialFacet(context: Context, material: LectureMaterial): MaterialFacet {
  const source = material.sourceId ? context.view.plugin.store.get(material.sourceId) : null;
  const typeDef = materialTypeDef(material.type);
  const pDef = purposeDef(material.purpose);
  return {
    medium: material.type,
    mediumLabel: typeDef.singular,
    action: material.purpose,
    actionLabel: pDef.label,
    access: materialAvailability(context.view.plugin.store, material).kind,
    search: [
      material.title,
      asString(source?.title),
      material.locator,
      material.why,
      typeDef.plural,
      pDef.label,
    ].filter(Boolean).join(' '),
  };
}

function routeFacet(option: MaterialOptionView, ownerTitle = ''): MaterialFacet {
  return {
    medium: materialTypeKey(option.format),
    mediumLabel: materialTypeLabel(option.format),
    action: option.depth,
    actionLabel: purposeLabel(option.depth),
    access: projectedAvailability(option.record).kind,
    search: [
      option.title,
      option.locator,
      option.angle,
      option.record.angle_detail,
      option.format,
      purposeLabel(option.depth),
      ownerTitle,
    ].filter(Boolean).join(' '),
  };
}

function filteredMaterials<T>(
  body: HTMLElement,
  entries: readonly T[],
  state: MaterialFilters,
  facet: (entry: T) => MaterialFacet,
  render: (root: HTMLElement, visible: readonly T[]) => void,
  actionHeading = 'Learning action',
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
  const { view, unit, stage, state, durable } = context;
  const owners = view.plugin.store.unitsFor(unit.moduleId, unit.componentId)
    .map((record) => readUnitRecord(record, asString(record.id)))
    .filter((other): other is UnitRecordView => Boolean(other && other.id !== unit.id));
  const courseEntries = owners.flatMap((owner) => stageMaterialOptions(view, owner).map((option) => ({ owner, option })));
  const module = view.plugin.store.get(unit.moduleId);
  const courseTitle = module ? asLabel(module) : 'this module';
  const body = root.createDiv({ cls: 'focus-page' });
  const actions = body.createDiv({ cls: 'focus-section-head' });
  const stageNumber = context.map.stages.findIndex((item) => item.id === stage.id) + 1;
  const unitMaterials = lectureMaterialsFor(view.plugin.store, unit, durable, context.options);

  const scopes = {
    stage: {
      title: 'Stage materials',
      location: `${unit.title} · Stage ${stageNumber} of ${context.map.stages.length}`,
      description: `${plural(stage.resources.length, 'material')} for ${stage.title}. Required now, If stuck and Reference keep the authored task order. Filters change only what is shown.`,
    },
    unit: {
      title: 'Unit materials',
      location: unit.title,
      description: lectureMaterialsFacts(unitMaterials, durable.stages.length),
    },
    course: {
      title: 'Course sources',
      location: courseTitle,
      description: `${plural(courseEntries.length, 'material route')} from other lectures in ${courseTitle}. Each stays with its own lecture.`,
    },
  };
  const scope = scopes[state.materialScope];
  heading(actions.createDiv({ cls: 'focus-heading-copy' }), scope.location, scope.title);
  const returnLabel = state.materialsReturn === 'plan'
    ? 'Back to study plan'
    : state.materialsReturn === 'overview'
      ? 'Back to overview'
      : 'Back to session';
  button(actions, returnLabel, () => show(context, state.materialsReturn), 'quiet');
  body.createEl('p', { cls: 'focus-lede', text: scope.description });
  filterTabs(
    body,
    'Material scope',
    [
      ['stage', `This stage · ${stage.resources.length}`],
      ['unit', `Unit materials · ${unitMaterials.length}`],
      ['course', `Course sources · ${courseEntries.length}`],
    ],
    state.materialScope,
    (next) => {
      prepareLocation(context, 'materials', stage.id, next);
      view.render();
    },
  );

  if (state.materialScope === 'unit') {
    const mState = materialsState(view.leaf, unit.id);
    filteredMaterials(
      body,
      unitMaterials,
      state.filters.unit,
      (material) => lectureMaterialFacet(context, material),
      (results, visible) => {
        const split = results.createDiv({ cls: 'focus-materials-split' });
        const mainCol = split.createDiv({ cls: 'focus-module-groups' });
        if (durable.stages.length && durable.stages.length <= 9) {
          const matrixBar = mainCol.createDiv({ cls: 'focus-matrix-header' });
          matrixBar.createSpan({ cls: 'focus-eyebrow', text: 'Stage matrix' });
          const headerCells = matrixBar.createDiv({ cls: 'focus-stage-matrix' });
          durable.stages.forEach((_, idx) => {
            headerCells.createSpan({ cls: 'focus-stage-cell focus-mono', text: `S${idx + 1}` });
          });
        }
        renderPurposeGroupedMaterials(mainCol, visible, durable, mState, {
          view,
          unit,
          stages: durable.stages,
          expected: context.guards,
          refresh: () => view.render(),
        });
        const sideCol = split.createDiv({ cls: 'focus-home-dock' });
        const legend = sideCard(sideCol, 'Stage matrix legend');
        for (const [glyph, desc] of [
          ['●', 'Required in that stage'],
          ['◐', 'Helps if you get stuck'],
          ['○', 'Kept for reference'],
          ['·', 'Not used in that stage'],
        ] as const) {
          legend.createDiv({ cls: 'focus-muted', text: `${glyph}  ${desc}` });
        }
      },
      'Purpose',
    );
  } else if (state.materialScope === 'course') {
    filteredMaterials(
      body,
      courseEntries,
      state.filters.course,
      ({ option, owner }) => routeFacet(option, owner.title),
      (results, visible) => {
        if (!visible.length) {
          results.createEl('p', {
            cls: 'focus-muted',
            text: courseEntries.length
              ? 'No course material matches. Clear the filters to restore the complete list.'
              : 'No additional material routes are registered for the other lectures.',
          });
        }
        for (const owner of owners) {
          const routes = visible.filter((entry) => entry.owner.id === owner.id);
          if (!routes.length) continue;
          const section = results.createDiv({ cls: 'focus-course-unit' });
          section.createEl('h2', { text: owner.title });
          for (const { option } of routes) {
            renderRouteCard(
              section,
              option,
              option.sourceId ? view.plugin.store.get(option.sourceId) : null,
              {
                plugin: view.plugin,
                unitId: owner.id,
                renderer: stageResourceRenderer(view, unit, stage, context.guards, context.options),
                refresh: () => view.render(),
              },
              { missingLocationLabel: 'Location needed' },
            );
          }
          button(section, 'Go to lecture', () => leaveForLecture(context, owner.id), 'quiet');
        }
      },
      'Purpose',
    );
  } else {
    filteredMaterials(
      body,
      stage.resources,
      state.filters.stage,
      (resource) => placementFacet(context, resource),
      (results, visible) => {
        const columns = results.createDiv({ cls: 'focus-material-columns' });
        const needed = columns.createDiv({ cls: 'focus-material-needed' });
        const reference = columns.createDiv({ cls: 'focus-material-reference' });
        for (const [key, label, parent] of [['required', 'Required now', needed], ['stuck', 'If stuck', needed], ['reference', 'Depth & reference', reference]] as const) {
          const all = stage.resources.filter((resource) => triageGroup(resource) === key);
          const resources = visible.filter((resource) => triageGroup(resource) === key);
          const section = parent.createDiv({ cls: `focus-material-group is-${key}` });
          section.createEl('h2', {
            cls: 'focus-eyebrow',
            text: `${label} · ${resources.length}${resources.length === all.length ? '' : ` of ${all.length}`}`,
          });
          for (const resource of resources) materialCard(section, context, resource, key === 'required');
          if (!resources.length) {
            section.createEl('p', {
              cls: 'focus-muted',
              text: all.length ? 'No matches here. Clear the filters to restore this group.' : 'No materials in this group.',
            });
          }
        }
      },
    );
    body.createEl('p', {
      cls: 'focus-muted',
      text: 'A material’s learning action, medium and access are separate. Filtering never completes, removes or reorders required work.',
    });
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
  const current = map.stages.find((item) => item.id === map.currentStageId) ?? stage;
  next.createEl('h2', { text: current.title });
  next.createEl('p', { cls: 'focus-muted', text: `${unit.title} · Stage ${map.stages.findIndex((item) => item.id === current.id) + 1}` });

  body.createEl('h2', { text: 'Session note · optional' });
  const draft = view.plugin.getUnitNoteDraft(unit.id, map.stages.map((item) => item.record));
  const editor = body.createEl('textarea', {
    cls: 'los-note-editor focus-note-editor',
    attr: {
      'aria-label': 'Optional session note',
      placeholder: 'What did you work out? Where did you get stuck? What should you try next?',
    },
  });
  editor.value = draft.text;
  const local = body.createDiv({ cls: 'focus-section-head' });
  const hint = local.createSpan({ cls: 'focus-muted', attr: { 'aria-live': 'polite' } });
  const updateHint = () => {
    hint.setText(editor.value.trim() ? 'Draft kept locally. Review and save it to attach it to this lecture.' : 'Optional. Nothing entered yet.');
  };
  updateHint();
  editor.addEventListener('input', () => {
    view.plugin.setUnitNoteDraft(
      unit.id,
      draft.title,
      editor.value,
      Object.keys(draft.expectedRevisions).length ? draft.expectedRevisions : context.guards,
    );
    updateHint();
  });
  button(local, 'Review and save note', () => note(context), 'quiet');

  const actions = body.createDiv({ cls: 'focus-wrapup-actions' });
  button(actions, 'Keep studying', () => show(context, 'session'), 'quiet');
  body.createEl('p', { cls: 'focus-muted', text: 'Review the exact changes before choosing whether to commit or push them. Unsaved note text remains a local draft.' });
}
