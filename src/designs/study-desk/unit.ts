import { button, disclosure, filterTabs, icon, overflowMenu } from '../../components';
import { placementAvailability, routeForResource } from '../../features/unit/material-card';
import { renderMaterialOverview } from '../../features/unit/materials';
import { readStudyMap, readUnitRecord, type MaterialOptionView, type StageRecordView, type StudyMapView, type UnitRecordView } from '../../features/unit/model';
import { renderPlanControls, selectedStage, sittingStudyMap } from '../../features/unit/shell';
import { completeStage, openMaterialComparison, stageMaterialOptions, stageMenuItems } from '../../features/unit/stage';
import { currentWorkResource, type StageResourceView } from '../../features/stage-resources';
import { hasDirectResourceTarget } from '../../infrastructure/resource-target';
import { asLabel, asString, asText } from '../../projection/readers';
import type { UnitScreenHost } from '../screens';
import { chevron, deskHead, deskPage, moduleShort, sideGroup, textLink, unitLabel } from './parts';
import { setUnitMode, unitMode } from './unit-mode';

interface UnitContext {
  readonly view: UnitScreenHost;
  readonly unit: UnitRecordView;
  readonly durable: StudyMapView;
  readonly studyMap: StudyMapView;
  readonly temporary: boolean;
  readonly stage: StageRecordView;
  readonly options: MaterialOptionView[];
}

const required = (resource: StageResourceView) => resource.scopeTriage === 'required-now' || !resource.scopeTriage;
const count = (amount: number, noun: string) => `${amount} ${noun}${amount === 1 ? '' : 's'}`;

function materialsLine(stage: StageRecordView): string {
  const need = stage.resources.filter(required).length;
  return [count(stage.resources.length, 'material'), need ? `${need} required` : ''].filter(Boolean).join(' · ');
}

function crumbsFor(context: UnitContext, last?: string) {
  const { view, unit } = context;
  const module = view.plugin.store.get(unit.moduleId);
  const here = unitLabel(unit.record, module);
  return [
    { label: 'Modules', go: () => view.plugin.nav.openModule(unit.moduleId) },
    { label: moduleShort(module), go: () => view.plugin.nav.openModule(unit.moduleId) },
    { label: last ? `${here.place} · ${here.title}` : here.place },
  ];
}

/** Open a placement by whichever target it has, the same order the classic card uses. */
function opener(context: UnitContext, resource: StageResourceView): (() => unknown) | null {
  const { view } = context;
  const route = routeForResource(resource, context.options);
  if (resource.canOpen) return () => view.plugin.openResource(resource.record);
  if (route?.canOpen) return () => view.plugin.openResource(route.record);
  const source = resource.sourceId ? view.plugin.store.get(resource.sourceId) : null;
  return source && hasDirectResourceTarget(source) ? () => view.plugin.openResource(source) : null;
}

function materialKey(resource: StageResourceView): string {
  return asString(resource.record.route_id) ?? `${resource.sourceId ?? ''}\u0000${resource.locator ?? ''}\u0000${resource.label}`;
}

function distinctMaterials(map: StudyMapView): Map<string, StageResourceView> {
  const materials = new Map<string, StageResourceView>();
  for (const stage of map.stages) {
    for (const resource of stage.resources) {
      const key = materialKey(resource);
      if (!materials.has(key)) materials.set(key, resource);
    }
  }
  return materials;
}

export function renderDeskUnit(view: UnitScreenHost): boolean {
  const projectedUnit = view.unitId ? view.plugin.store.get(view.unitId) : null;
  const unit = readUnitRecord(projectedUnit, view.unitId);
  const projectedMap = unit ? view.plugin.store.mapForUnit(unit.id) : null;
  // No plan or no stages: the classic screen is the one that explains the obligation.
  if (!unit || !projectedMap) return false;
  const durable = readStudyMap(projectedMap);
  const { studyMap, temporary } = sittingStudyMap(view, unit.id, durable);
  const first = studyMap.stages[0];
  if (!first) return false;
  const stage = selectedStage(view, unit.id, studyMap, first, Boolean(temporary));
  const context: UnitContext = {
    view, unit, durable, studyMap, temporary: Boolean(temporary), stage,
    options: stageMaterialOptions(view, unit),
  };
  const mode = unitMode(unit.id);
  if (mode === 'session') renderSession(context);
  else renderPlan(context, mode);
  return true;
}

/* ─────────────────────────────── the study plan ─────────────────────────── */

function openStage(context: UnitContext, stageId: string): void {
  setUnitMode(context.unit.id, 'session');
  if (context.stage.id === stageId) context.view.render();
  else void context.view.selectStage(stageId);
}

function renderPlan(context: UnitContext, mode: 'plan' | 'materials'): void {
  const { view, unit, studyMap } = context;
  const root = deskPage(view.contentEl, 'plan', view.plugin.store);
  const actions = deskHead(root, crumbsFor(context));
  button(actions, 'End session', () => view.plugin.reviewSessionEnd(), 'quiet');
  const module = view.plugin.store.get(unit.moduleId);
  const done = studyMap.stages.filter((stage) => stage.status === 'complete').length;
  const layout = root.createDiv({ cls: 'sd-plan-layout' });
  const main = layout.createDiv({ cls: 'sd-plan-main' });
  main.createEl('h1', { cls: 'sd-title', text: unitLabel(unit.record, module).title });
  const allCritical = studyMap.stages.every((stage) => stage.examCritical);
  main.createDiv({ cls: 'sd-facts', text: [
    `${done} of ${count(studyMap.stages.length, 'stage')} done.`,
    allCritical ? 'Every stage in this lecture is exam-critical.' : '',
  ].filter(Boolean).join(' ') });
  filterTabs(main, 'Plan view', [['plan', 'Stages'], ['materials', 'Materials']] as const, mode, (next) => {
    setUnitMode(unit.id, next);
    view.render();
  });
  if (context.temporary) {
    main.createDiv({ cls: 'sd-callout', text: `For this sitting: ${studyMap.stages.length} of ${context.durable.stages.length} stages. Recording work or a new snapshot ends this order.` });
  }
  if (mode === 'materials') renderMaterialGrid(main, context);
  else renderRoute(main, context);
  renderPlanSide(layout, context);
}

function renderRoute(parent: HTMLElement, context: UnitContext): void {
  const { studyMap } = context;
  const route = parent.createDiv({ cls: 'sd-route', attr: { role: 'list', 'aria-label': 'Stages in order' } });
  const here = studyMap.currentStageId;
  studyMap.stages.forEach((stage, index) => {
    const isDone = stage.status === 'complete';
    const isHere = stage.id === here && !isDone;
    const stop = route.createDiv({ cls: `sd-stop${isDone ? ' is-done' : ''}${isHere ? ' is-here' : ''}`, attr: { role: 'listitem' } });
    const marker = stop.createDiv({ cls: 'sd-stop-marker', attr: { 'aria-hidden': 'true' } });
    if (isDone) icon(marker.createSpan(), 'check');
    else marker.createSpan({ text: String(index + 1) });
    const body = stop.createDiv({ cls: 'sd-stop-body' });
    if (isHere) {
      body.createDiv({ cls: 'sd-stop-here', text: 'You are here' });
      body.createEl('h2', { cls: 'sd-heading', text: stage.title });
      if (stage.objective) body.createEl('p', { cls: 'sd-reading', text: stage.objective });
      const foot = body.createDiv({ cls: 'sd-stop-foot' });
      foot.createSpan({ cls: 'sd-row-facts', text: [materialsLine(stage), stage.doneWhen.length ? `${count(stage.doneWhen.length, 'thing')} to prove` : ''].filter(Boolean).join(' · ') });
      button(foot, 'Continue stage', () => openStage(context, stage.id), 'cta');
      renderStopMaterials(body, context, stage);
      return;
    }
    const head = body.createEl('button', {
      cls: 'sd-stop-head is-clickable',
      attr: { type: 'button', 'aria-label': `Open stage: ${stage.title}` },
    });
    const copy = head.createDiv({ cls: 'sd-row-copy' });
    copy.createEl('strong', { cls: 'sd-heading', text: stage.title });
    if (stage.objective) copy.createDiv({ cls: 'sd-row-facts', text: stage.objective });
    head.addEventListener('click', () => openStage(context, stage.id));
    head.createSpan({ cls: 'sd-row-next', text: stage.status === 'skipped' ? `Skipped · ${materialsLine(stage)}` : materialsLine(stage) });
    renderStopMaterials(body, context, stage);
  });
}

/** Each stage opens to its own full list in place: counted, and never only the first few. */
function renderStopMaterials(parent: HTMLElement, context: UnitContext, stage: StageRecordView): void {
  if (!stage.resources.length) return;
  const details = parent.createEl('details', { cls: 'sd-stop-materials' });
  details.createEl('summary', { cls: 'sd-stop-summary', text: `Materials for this stage · ${stage.resources.length}` });
  const list = details.createDiv({ cls: 'sd-material-list' });
  for (const resource of stage.resources) renderMaterialRow(list, context, resource);
}

function renderMaterialRow(parent: HTMLElement, context: UnitContext, resource: StageResourceView): void {
  const route = routeForResource(resource, context.options);
  const open = opener(context, resource);
  const row = parent.createEl('button', {
    cls: `sd-material-row is-clickable${required(resource) ? ' is-required' : ''}`,
    attr: { type: 'button', 'aria-label': `Open ${resource.label}` },
  });
  const copy = row.createDiv({ cls: 'sd-row-copy' });
  copy.createSpan({ cls: 'sd-material-title', text: resource.label });
  copy.createDiv({
    cls: 'sd-row-facts',
    text: [required(resource) ? 'Required' : '', resource.locator, placementAvailability(resource, route).label].filter(Boolean).join(' · '),
  });
  chevron(row);
  if (open) row.addEventListener('click', () => open());
  else row.disabled = true;
}

function renderPlanSide(layout: HTMLElement, context: UnitContext): void {
  const { view, unit, durable, studyMap } = context;
  const side = layout.createDiv({ cls: 'sd-side' });
  const materials = distinctMaterials(studyMap);
  const placements = studyMap.stages.reduce((sum, stage) => sum + stage.resources.length, 0);
  const about = sideGroup(side, 'Materials');
  about.createEl('p', { cls: 'sd-note', text: `${count(materials.size, 'different material')} across the ${count(studyMap.stages.length, 'stage')}, placed ${placements} time${placements === 1 ? '' : 's'}.` });
  textLink(about, `See all ${materials.size}`, () => { setUnitMode(unit.id, 'materials'); view.render(); });

  const notes = sideGroup(side, 'Notes');
  notes.createEl('p', { cls: 'sd-note', text: 'One session note stays with this lecture.' });
  textLink(notes, 'Add note', () => view.plugin.openUnitNote(unit.record, studyMap.record));
  const draft = view.plugin.getUnitNoteDraft(unit.id, studyMap.stages.map((stage) => stage.record));
  if (typeof draft.text === 'string' && draft.text.trim()) notes.createDiv({ cls: 'sd-row-facts', text: 'Unsaved draft kept locally.' });

  const module = view.plugin.store.get(unit.moduleId);
  const order = view.plugin.store.unitsFor(unit.moduleId, unit.componentId);
  const position = order.findIndex((row) => row.id === unit.id);
  const after = position >= 0 ? order[position + 1] : null;
  const afterId = asString(after?.id);
  if (after && afterId) {
    const next = unitLabel(after, module);
    const group = sideGroup(side, 'After this');
    group.createEl('p', { cls: 'sd-note', text: next.number ? `${next.place}, ${next.title}.` : `${next.title}.` });
    textLink(group, 'Open', () => view.plugin.nav.openUnit(afterId));
  }

  const adjust = disclosure(side, 'Adjust this plan', 'sd-side-disclosure');
  renderPlanControls(view, adjust, unit, durable, studyMap, context.temporary, context.options);
  view.renderArtifacts(disclosure(side, 'Unit artifacts and evidence', 'sd-side-disclosure'), unit);
}

/** Every material against every stage: what each is for, and where it is used. */
function renderMaterialGrid(parent: HTMLElement, context: UnitContext): void {
  const { view, unit, studyMap } = context;
  const materials = [...distinctMaterials(studyMap).entries()];
  const placementIn = (stage: StageRecordView, key: string) => stage.resources.find((resource) => materialKey(resource) === key) ?? null;
  const uses = (key: string) => studyMap.stages.filter((stage) => placementIn(stage, key)).length;
  materials.sort(([a], [b]) => uses(b) - uses(a));
  parent.createDiv({ cls: 'sd-row-facts sd-grid-legend', text: 'Filled: required for that stage. Ring: there to help. Empty: not placed on that stage.' });
  const scroll = parent.createDiv({ cls: 'sd-sheet sd-grid-scroll' });
  const table = scroll.createEl('table', { cls: 'sd-material-grid' });
  const head = table.createEl('thead').createEl('tr');
  head.createEl('th', { cls: 'sd-grid-corner', text: 'Material', attr: { scope: 'col' } });
  studyMap.stages.forEach((stage, index) => {
    head.createEl('th', { text: String(index + 1), attr: { scope: 'col', title: stage.title, 'aria-label': `Stage ${index + 1}: ${stage.title}` } });
  });
  const body = table.createEl('tbody');
  for (const [key, resource] of materials) {
    const tr = body.createEl('tr');
    const cell = tr.createEl('th', { attr: { scope: 'row' } });
    const open = opener(context, resource);
    const title = cell.createEl('button', { cls: 'sd-grid-title is-clickable', text: resource.label, attr: { type: 'button' } });
    if (open) title.addEventListener('click', () => open());
    else title.disabled = true;
    if (resource.locator) cell.createDiv({ cls: 'sd-row-facts', text: resource.locator });
    for (const stage of studyMap.stages) {
      const placed = placementIn(stage, key);
      const td = tr.createEl('td');
      if (!placed) { td.createSpan({ cls: 'los-sr-only', text: 'Not placed' }); continue; }
      td.createSpan({ cls: `sd-grid-mark${required(placed) ? ' is-required' : ''}`, attr: { 'aria-hidden': 'true' } });
      td.createSpan({ cls: 'los-sr-only', text: required(placed) ? 'Required' : 'Helps' });
    }
  }
  const full = disclosure(parent, 'This lecture’s full menu', 'sd-side-disclosure');
  renderMaterialOverview(view, full, unit, context.options, view.plugin.store.materialSynthesisForUnit(unit.id), true);
}

/* ───────────────────────────── the open-book session ─────────────────────── */

function renderSession(context: UnitContext): void {
  const { view, unit, studyMap, stage } = context;
  const expected = view.plugin.store.artifactGuard(unit.id, typeof studyMap.record.id === 'string' ? studyMap.record.id : null);
  const root = deskPage(view.contentEl, 'session', view.plugin.store);
  const actions = deskHead(root, crumbsFor(context, 'full'));
  button(actions, 'Study plan', () => { setUnitMode(unit.id, 'plan'); view.render(); }, 'quiet');
  button(actions, 'Add note', () => view.plugin.openUnitNote(unit.record, studyMap.record), 'quiet');
  button(actions, 'End session', () => view.plugin.reviewSessionEnd(), 'quiet');

  const position = Math.max(studyMap.stages.findIndex((row) => row.id === stage.id), 0);
  const strip = root.createDiv({ cls: 'sd-strip', attr: { role: 'group', 'aria-label': 'Stages in this lecture' } });
  studyMap.stages.forEach((row, index) => {
    const state = row.id === stage.id ? 'is-current' : row.status === 'complete' ? 'is-done' : '';
    const tab = strip.createEl('button', {
      cls: `sd-strip-tab is-clickable ${state}`.trim(),
      attr: { type: 'button', 'aria-pressed': String(row.id === stage.id), 'aria-label': `Stage ${index + 1}: ${row.title}${row.status === 'complete' ? ', complete' : ''}` },
    });
    tab.createSpan({ cls: 'sd-strip-bar' });
    const label = tab.createSpan({ cls: 'sd-strip-label' });
    if (row.status === 'complete' && row.id !== stage.id) icon(label.createSpan({ cls: 'sd-strip-check' }), 'check');
    else label.createSpan({ cls: 'sd-strip-number', text: String(index + 1) });
    label.createSpan({ text: row.title });
    tab.addEventListener('click', () => { void view.selectStage(row.id); });
  });

  const book = root.createDiv({ cls: 'sd-book-spread' });
  const left = book.createDiv({ cls: 'sd-page-left' });
  const right = book.createDiv({ cls: 'sd-page-right' });

  const eyebrow = left.createDiv({ cls: 'sd-stage-eyebrow' });
  eyebrow.createSpan({ cls: 'sd-stage-position', text: `Stage ${position + 1} of ${studyMap.stages.length}` });
  if (stage.examCritical) eyebrow.createSpan({ cls: 'sd-chip is-warning', text: 'Exam-critical' });
  if (stage.status === 'complete') eyebrow.createSpan({ cls: 'sd-chip is-success', text: 'Complete' });
  if (stage.status === 'skipped') eyebrow.createSpan({ cls: 'sd-chip', text: 'Skipped' });
  left.createEl('h1', { cls: 'sd-title', text: stage.title });
  if (stage.objective) left.createEl('p', { cls: 'sd-lede', text: stage.objective });

  const current = currentWorkResource(stage.resources);
  const others = stage.resources.filter((resource) => resource !== current);
  let openButton: HTMLButtonElement | null = null;
  if (current) {
    left.createEl('h2', { cls: 'sd-heading', text: 'Start here' });
    const card = left.createDiv({ cls: 'sd-start-card' });
    const thumb = card.createDiv({ cls: 'sd-start-thumb', attr: { 'aria-hidden': 'true' } });
    for (let line = 0; line < 4; line += 1) thumb.createSpan();
    const copy = card.createDiv({ cls: 'sd-row-copy' });
    copy.createEl('strong', { cls: 'sd-heading', text: current.label });
    const route = routeForResource(current, context.options);
    copy.createDiv({ cls: 'sd-row-facts', text: [current.locator, placementAvailability(current, route).label].filter(Boolean).join(' · ') });
    const open = opener(context, current);
    if (open) openButton = button(card, 'Open', () => open(), 'cta');
  } else if (stage.resources.length) {
    left.createEl('p', { cls: 'sd-quiet', text: 'Nothing is marked required for this stage. Everything below is there for depth and reference.' });
  } else {
    left.createEl('p', { cls: 'sd-quiet', text: 'No material is placed on this stage. The lecture’s full menu is still one click away.' });
  }

  const listHead = left.createDiv({ cls: 'sd-section-head' });
  const title = listHead.createDiv({ cls: 'sd-section-title' });
  title.createEl('h2', { cls: 'sd-heading', text: current ? 'All materials for this stage' : 'Materials for this stage' });
  const need = stage.resources.filter(required).length;
  title.createSpan({ cls: 'sd-row-facts', text: [need ? `${need} required` : '', stage.resources.length - need ? `${stage.resources.length - need} that help` : ''].filter(Boolean).join(' + ') });
  const links = listHead.createDiv({ cls: 'sd-section-links' });
  textLink(links, 'Compare', () => openMaterialComparison(view, unit, stage, expected));
  textLink(links, `All ${distinctMaterials(studyMap).size} in this lecture`, () => { setUnitMode(unit.id, 'materials'); view.render(); });
  const list = left.createDiv({ cls: 'sd-material-list' });
  for (const resource of others) renderMaterialRow(list, context, resource);

  /* The proof page. Ticks are the same UI-owned working state as Classic's; they
   * never reach Core and they do not gate Complete, which Core alone decides. */
  right.createEl('h2', { cls: 'sd-heading', text: current ? 'Then close it and prove it' : 'What proves this stage' });
  const marks = view.plugin.getDoneWhen(unit.id, stage.id, stage.doneWhen);
  const total = stage.doneWhen.length;
  const tally = right.createDiv({ cls: 'sd-row-facts sd-proof-tally' });
  const proofs = right.createDiv({ cls: 'sd-proofs' });
  let complete: HTMLButtonElement | null = null;
  const refresh = () => {
    const ticked = marks.filter(Boolean).length;
    const rule = total === 1 ? 'The stage is finished when it is true.' : total === 2 ? 'The stage is finished when both are true.' : `The stage is finished when all ${total} are true.`;
    tally.setText(total ? `${ticked} of ${total} · ${rule}` : 'This stage declares no proof.');
    // One filled action: Open until the proofs are all true, then Complete.
    const ready = total > 0 ? ticked === total : !openButton;
    complete?.toggleClass('los-btn--cta', ready);
    openButton?.toggleClass('los-btn--cta', !ready);
  };
  stage.doneWhen.forEach((criterion, index) => {
    const row = proofs.createEl('label', { cls: `sd-proof${marks[index] ? ' is-checked' : ''}` });
    const box = row.createEl('input', { attr: { type: 'checkbox', 'aria-label': criterion } });
    box.checked = Boolean(marks[index]);
    if (marks[index]) box.setAttr('checked', 'checked');
    row.createSpan({ cls: 'sd-reading', text: criterion });
    box.addEventListener('change', () => {
      marks[index] = Boolean(box.checked);
      view.plugin.setDoneWhen(unit.id, stage.id, index, marks[index] ?? false, stage.doneWhen);
      row.toggleClass('is-checked', Boolean(box.checked));
      refresh();
    });
  });

  const why = current ? (asText(current.record.angle) ?? routeForResource(current, context.options)?.angle ?? null) : null;
  if (why) {
    const group = sideGroup(right, 'Why this one');
    group.createEl('p', { cls: 'sd-note', text: why });
  }
  const before = position > 0 ? studyMap.stages[position - 1] : null;
  if (before) {
    const group = sideGroup(right, 'Builds on');
    group.createEl('p', { cls: 'sd-note', text: `Stage ${position}, ${before.title}.` });
    textLink(group, 'Go back', () => { void view.selectStage(before.id); });
  }
  const concepts = stage.concepts.flatMap((id) => {
    const record = view.plugin.store.get(id);
    return record ? [{ id, label: asLabel(record) }] : [];
  });
  if (concepts.length) {
    const group = sideGroup(right, concepts.length === 1 ? 'Concept' : 'Concepts');
    for (const concept of concepts) {
      group.createEl('p', { cls: 'sd-note', text: concept.label });
      textLink(group, 'Open in Atlas', () => view.plugin.nav.openAtlas({ concept: concept.id, lens: 'prerequisites' }));
    }
  }
  view.renderStageContext(disclosure(right, 'Stage notes and history', 'sd-side-disclosure'), unit, studyMap, stage);

  const foot = book.createDiv({ cls: 'sd-spread-foot' });
  foot.createSpan({ cls: 'sd-row-facts', text: 'Tick each one only when it is honestly true. Completing records progress, not a learner attempt.' });
  const footActions = foot.createDiv({ cls: 'sd-foot-actions' });
  overflowMenu(footActions, stageMenuItems(view, unit, stage, expected), 'More stage actions');
  if (before) button(footActions, 'Previous stage', () => { void view.selectStage(before.id); }, 'quiet');
  complete = button(footActions, 'Complete stage', () => completeStage(view, unit, stage, expected));
  refresh();
}
