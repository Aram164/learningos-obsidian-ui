import { button, disclosure, filterTabs, icon, overflowMenu, plural } from '../../components';
import { placementAvailability, routeForResource } from '../../features/unit/material-card';
import { artifactLabel, nextOpenStage, readArtifacts, readStudyMap, readUnitRecord, stageProgress, type MaterialOptionView, type StageRecordView, type StudyMapView, type UnitRecordView } from '../../features/unit/model';
import { renderPlanControls, selectedStage, sittingStudyMap } from '../../features/unit/shell';
import { openMaterialComparison, runStageAction, stageActionFor, stageMaterialOptions, stageMenuItems } from '../../features/unit/stage';
import { currentWorkResource, type StageResourceView } from '../../features/stage-resources';
import { hasDirectResourceTarget } from '../../infrastructure/resource-target';
import { asLabel, asString, asText } from '../../projection/readers';
import type { UnitScreenHost } from '../screens';
import { chevron, deskHead, deskPage, deskRow, labelControl, moduleName, sideGroup, stageBars, textLink, unitLabel } from './parts';
import { orderedUnits } from './study-work';
import { setUnitMode, unitMode } from './unit-mode';
import { lectureMaterialsFacts, lectureMaterialsFor, renderLectureMaterials } from './lecture-materials';
import { renderSessionMaterials, renderStageMaterialList, type StageMaterialsContext } from './stage-materials';
import type { LectureMaterial } from '../../features/unit/material-purpose';

interface UnitContext {
  readonly view: UnitScreenHost;
  readonly unit: UnitRecordView;
  readonly durable: StudyMapView;
  readonly studyMap: StudyMapView;
  readonly temporary: boolean;
  readonly stage: StageRecordView;
  readonly options: MaterialOptionView[];
  /** The plan's write guard, for every write a row or stage offers. */
  readonly expected: Readonly<Record<string, number>>;
  /** Every material of the lecture, built once per render and only when drawn. */
  readonly materials: () => readonly LectureMaterial[];
}

const required = (resource: StageResourceView) => resource.scopeTriage === 'required-now' || !resource.scopeTriage;

function materialsLine(stage: StageRecordView): string {
  const need = stage.resources.filter(required).length;
  return [plural(stage.resources.length, 'material'), need ? `${need} required` : ''].filter(Boolean).join(' · ');
}

function showMode(context: UnitContext, mode: 'plan' | 'materials') {
  setUnitMode(context.view.leaf, context.unit.id, mode);
  context.view.render();
}

function crumbsFor(context: UnitContext, mode: 'plan' | 'materials' | 'session') {
  const { view, unit } = context;
  const module = view.plugin.store.get(unit.moduleId);
  const here = unitLabel(unit.record, module);
  const position = context.studyMap.stages.indexOf(context.stage);
  const page = mode === 'session' ? `Stage ${position + 1}` : 'Materials';
  return [
    { label: 'Modules', go: () => view.plugin.nav.openModules() },
    { label: moduleName(module), go: () => view.plugin.nav.openModule(unit.moduleId) },
    { label: here.place, go: () => showMode(context, 'plan') },
    ...(mode === 'plan' ? [] : [{ label: page }]),
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

export function renderDeskUnit(view: UnitScreenHost): boolean {
  view.contentEl.removeClass('sd-lecture-materials');
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
  const options = stageMaterialOptions(view, unit);
  let materials: readonly LectureMaterial[] | null = null;
  const context: UnitContext = {
    view, unit, durable, studyMap, temporary: Boolean(temporary), stage, options,
    expected: view.plugin.store.artifactGuard(unit.id, typeof studyMap.record.id === 'string' ? studyMap.record.id : null),
    materials: () => (materials ??= lectureMaterialsFor(view, unit, durable, options)),
  };
  const mode = unitMode(view.leaf, unit.id);
  if (mode === 'session') renderSession(context);
  else renderPlan(context, mode);
  return true;
}

/* ─────────────────────────────── the study plan ─────────────────────────── */

function openStage(context: UnitContext, stageId: string): void {
  setUnitMode(context.view.leaf, context.unit.id, 'session');
  if (context.stage.id === stageId) context.view.render();
  else void context.view.selectStage(stageId);
}

function renderPlan(context: UnitContext, mode: 'plan' | 'materials'): void {
  const { view, unit, studyMap } = context;
  const root = deskPage(view.contentEl, 'plan', view.plugin.store);
  const actions = deskHead(root, crumbsFor(context, mode), view);
  button(actions, 'End session', () => view.plugin.reviewSessionEnd(), 'quiet');
  const module = view.plugin.store.get(unit.moduleId);
  const { done } = stageProgress(studyMap.stages);
  // Title on the left, the lecture's views on the right (Figma C1, C2).
  const head = root.createDiv({ cls: 'sd-title-row sd-plan-head' });
  const copy = head.createDiv({ cls: 'sd-title-copy' });
  copy.createEl('h1', { cls: 'sd-title', text: unitLabel(unit.record, module).title });
  const allCritical = studyMap.stages.every((stage) => stage.examCritical);
  copy.createDiv({ cls: 'sd-facts', text: mode === 'materials'
    ? lectureMaterialsFacts(context.materials(), context.durable.stages.length)
    : [
      plural(studyMap.stages.length, 'stage'),
      `${done} done`,
      allCritical ? 'every stage exam-critical' : '',
      plural(context.materials().length, 'material'),
    ].filter(Boolean).join(' · ') });
  filterTabs(head.createDiv({ cls: 'sd-title-tools' }), 'Plan view', [['plan', 'Stages'], ['materials', 'Materials']] as const, mode, (next) => {
    showMode(context, next);
  });
  const layout = root.createDiv({ cls: `sd-plan-layout${mode === 'materials' ? ' is-materials' : ''}` });
  const main = layout.createDiv({ cls: 'sd-plan-main' });
  if (context.temporary) {
    main.createDiv({ cls: 'sd-callout', text: `For this sitting: ${studyMap.stages.length} of ${context.durable.stages.length} stages. Recording work or a new snapshot ends this order.` });
  }
  if (mode === 'materials') {
    root.addClass('sd-lecture-materials');
    renderLectureMaterials(main, layout.createDiv({ cls: 'sd-side sd-mat-side' }), {
      view, unit, durable: context.durable, options: context.options, expected: context.expected,
    });
    return;
  }
  renderRoute(main, context);
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
      foot.createSpan({ cls: 'sd-row-facts', text: [materialsLine(stage), stage.doneWhen.length ? `${plural(stage.doneWhen.length, 'thing')} to prove` : ''].filter(Boolean).join(' · ') });
      const start = currentWorkResource(stage.resources);
      const action = body.createDiv({ cls: 'sd-stop-start' });
      if (start) {
        icon(action.createSpan({ cls: 'sd-kit-icon' }), 'book-open');
        const copy = action.createDiv({ cls: 'sd-row-copy' });
        copy.createSpan({ cls: 'sd-eyebrow', text: 'Start with' });
        copy.createSpan({ text: start.label });
      }
      button(action, 'Continue stage', () => openStage(context, stage.id), 'cta');
      renderStageMaterialList(body, stageMaterials(context, stage));
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
    renderStageMaterialList(body, stageMaterials(context, stage));
  });
}

/** Each stage opens to its own full list in place, with the one Material row: counted, triage first, every material once. */
function stageMaterials(context: UnitContext, stage: StageRecordView): StageMaterialsContext {
  return { view: context.view, unit: context.unit, durable: context.durable, stage, materials: context.materials(), expected: context.expected };
}

function renderPlanSide(layout: HTMLElement, context: UnitContext): void {
  const { view, unit, durable, studyMap } = context;
  const side = layout.createDiv({ cls: 'sd-side' });
  const progress = sideGroup(side, 'Progress');
  const { done } = stageProgress(studyMap.stages);
  stageBars(progress, studyMap.stages.length, done, studyMap.stages.findIndex((stage) => stage.id === studyMap.currentStageId));
  progress.createEl('p', { cls: 'sd-note', text: `${done} of ${plural(studyMap.stages.length, 'stage')} done.` });

  const { store, nav } = view.plugin;
  const module = store.get(unit.moduleId);
  const order = orderedUnits(store, unit.moduleId, unit.componentId);
  const position = order.findIndex((row) => row.id === unit.id);
  if (position >= 0 && (position > 0 || position < order.length - 1)) {
    const adjacent = sideGroup(side, 'Before and after');
    for (const [label, record] of [['Before', order[position - 1]], ['After', order[position + 1]]] as const) {
      const id = asString(record?.id);
      if (!record || !id) continue;
      const place = unitLabel(record, module);
      adjacent.createDiv({ cls: 'sd-row-facts', text: label });
      textLink(adjacent, place.number ? `${place.place} · ${place.title}` : place.title, () => nav.openUnit(id));
    }
  }

  const concepts = [...new Set([
    ...durable.stages.flatMap((stage) => stage.concepts),
    ...unit.knowledgeNodes.flatMap((node) => node.conceptIds),
  ])].flatMap((id) => {
    const record = store.get(id);
    return record ? [{ id, title: asLabel(record) }] : [];
  });
  if (concepts.length) {
    const group = sideGroup(side, 'Concepts in this lecture');
    const chips = group.createDiv({ cls: 'sd-concept-chips' });
    for (const { id, title } of concepts) {
      button(chips, title, () => nav.openAtlas({ concept: id, lens: 'prerequisites' }), 'quiet').addClass('sd-concept-chip');
    }
  }

  const artifacts = readArtifacts(unit.record.artifacts);
  const kit = artifacts.named.flatMap(([key, id]) => {
    const record = store.get(id);
    return record ? [{ key, record }] : [];
  });
  if (kit.length) {
    const group = sideGroup(side, 'Lecture kit');
    const glyphs: Record<string, string> = { ultimate_reference: 'file-text', exercise_bank: 'list-checks', mock_exam: 'graduation-cap' };
    for (const { key, record } of kit) {
      const label = key === 'ultimate_reference' ? 'Reference note' : artifactLabel(key);
      const row = deskRow(group, 'sd-kit-card', `${label}: ${asLabel(record)}`, () => nav.openRecord(record));
      icon(row.createSpan({ cls: 'sd-kit-icon' }), glyphs[key] ?? 'file-text');
      const copy = row.createSpan({ cls: 'sd-row-copy' });
      copy.createEl('strong', { text: label });
      copy.createSpan({ cls: 'sd-row-facts', text: asLabel(record) });
      chevron(row);
    }
  }

  const notes = sideGroup(side, 'Notes');
  notes.createEl('p', { cls: 'sd-note', text: 'One session note stays with this lecture.' });
  textLink(notes, 'Add note', () => view.plugin.openUnitNote(unit.record, studyMap.record));
  const draft = view.plugin.getUnitNoteDraft(unit.id, studyMap.stages.map((stage) => stage.record));
  if (typeof draft.text === 'string' && draft.text.trim()) notes.createDiv({ cls: 'sd-row-facts', text: 'Unsaved draft kept locally.' });

  const adjust = disclosure(side, 'Adjust this plan', 'sd-side-disclosure');
  renderPlanControls(view, adjust, unit, durable, studyMap, context.temporary, context.options);
  view.renderArtifacts(disclosure(side, 'Unit artifacts and evidence', 'sd-side-disclosure'), unit);
}

/* ───────────────────────────── the open-book session ─────────────────────── */

function renderSession(context: UnitContext): void {
  const { view, unit, studyMap, stage, expected } = context;
  const root = deskPage(view.contentEl, 'session', view.plugin.store);
  const actions = deskHead(root, crumbsFor(context, 'session'), view);
  button(actions, 'All stages', () => showMode(context, 'plan'), 'quiet');
  button(actions, 'Materials', () => showMode(context, 'materials'), 'quiet');
  button(actions, 'Add note', () => view.plugin.openUnitNote(unit.record, studyMap.record), 'quiet');
  button(actions, 'End session', () => view.plugin.reviewSessionEnd(), 'quiet');

  const position = Math.max(studyMap.stages.findIndex((row) => row.id === stage.id), 0);
  const done = stage.status === 'complete';
  const next = nextOpenStage(studyMap.stages, stage.id);
  const strip = root.createDiv({ cls: 'sd-strip', attr: { role: 'group', 'aria-label': 'Stages in this lecture' } });
  studyMap.stages.forEach((row, index) => {
    const state = row.id === stage.id ? 'is-current' : row.status === 'complete' ? 'is-done' : '';
    const status = row.status === 'pending' ? 'not started' : row.status.replaceAll('-', ' ');
    const labelText = `Stage ${index + 1} · ${row.title} · ${plural(row.doneWhen.length, 'proof')} · ${status}`;
    const tab = strip.createEl('button', {
      cls: `sd-strip-tab is-clickable ${state}`.trim(),
      attr: { type: 'button', 'aria-pressed': String(row.id === stage.id), title: labelText },
    });
    labelControl(tab, labelText);
    tab.createSpan({ cls: 'sd-strip-bar' });
    const label = tab.createSpan({ cls: 'sd-strip-label' });
    if (row.status === 'complete' && row.id !== stage.id) icon(label.createSpan({ cls: 'sd-strip-check' }), 'check');
    else label.createSpan({ cls: 'sd-strip-number', text: String(index + 1) });
    label.createSpan({ cls: 'sd-strip-title', text: row.title });
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
    left.createEl('p', { cls: 'sd-quiet', text: 'No material is placed on this stage. All of the lecture’s materials are one click away.' });
  }

  renderSessionMaterials(left, stageMaterials(context, stage), current, (links) => {
    textLink(links, 'Compare', () => openMaterialComparison(view, unit, stage, expected));
    textLink(links, `All ${context.materials().length} in this lecture`, () => showMode(context, 'materials'));
  });

  /* The proof page. Ticks are the same UI-owned working state as Classic's; they
   * never reach Core and they do not gate Complete, which Core alone decides. */
  right.createEl('h2', { cls: 'sd-heading', text: done ? 'Completion criteria' : current ? 'Then close it and prove it' : 'What proves this stage' });
  const marks = done ? [] : view.plugin.getDoneWhen(unit.id, stage.id, stage.doneWhen);
  const total = stage.doneWhen.length;
  const tally = right.createDiv({ cls: 'sd-row-facts sd-proof-tally' });
  let complete: HTMLButtonElement | null = null;
  const refresh = () => {
    if (done) {
      tally.setText(total ? 'Proof checks are session-only.' : 'This stage declares no proof.');
      openButton?.toggleClass('los-btn--cta', false);
      return;
    }
    const ticked = marks.filter(Boolean).length;
    const rule = total === 1 ? 'The stage is finished when it is true.' : total === 2 ? 'The stage is finished when both are true.' : `The stage is finished when all ${total} are true.`;
    tally.setText(total ? `${ticked} of ${total} · ${rule}` : 'This stage declares no proof.');
    // One filled action: Open until the proofs are all true, then Complete.
    const ready = total > 0 ? ticked === total : !openButton;
    complete?.toggleClass('los-btn--cta', ready);
    openButton?.toggleClass('los-btn--cta', !ready);
  };
  if (done && total) {
    const criteria = right.createEl('ul', { cls: 'sd-proofs sd-proof-criteria' });
    for (const criterion of stage.doneWhen) criteria.createEl('li', { cls: 'sd-reading', text: criterion });
  }
  if (!done) {
    const proofs = right.createDiv({ cls: 'sd-proofs' });
    stage.doneWhen.forEach((criterion, index) => {
      const row = proofs.createEl('label', { cls: `sd-proof${marks[index] ? ' is-checked' : ''}` });
      const box = row.createEl('input', { attr: { type: 'checkbox' } });
      box.checked = Boolean(marks[index]);
      if (marks[index]) box.setAttr('checked', 'checked');
      row.createSpan({ cls: 'sd-reading', text: criterion });
      box.addEventListener('change', () => {
        marks[index] = box.checked;
        view.plugin.setDoneWhen(unit.id, stage.id, index, box.checked, stage.doneWhen);
        row.toggleClass('is-checked', box.checked);
        refresh();
      });
    });
  }

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
  foot.createSpan({ cls: 'sd-row-facts', text: done
    ? `Stage ${position + 1} is complete.`
    : 'Tick each one only when it is honestly true. Completing records progress, not a learner attempt.' });
  const footActions = foot.createDiv({ cls: 'sd-foot-actions' });
  overflowMenu(footActions, stageMenuItems(view, unit, stage, expected), 'More stage actions');
  if (before) button(footActions, 'Previous stage', () => { void view.selectStage(before.id); }, 'quiet');
  if (done) {
    if (next) button(footActions, `Next: stage ${studyMap.stages.indexOf(next) + 1} · ${next.title}`, () => view.selectStage(next.id), 'cta');
    else button(footActions, 'Return to all stages', () => showMode(context, 'plan'), 'cta');
  } else {
    const action = stageActionFor(stage);
    complete = button(footActions, action.label, () => runStageAction(view, unit, stage, expected));
  }
  refresh();
}
