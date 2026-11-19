/**
 * Focus 2.0 Home & Learn landing screens.
 * Home uses a 2-column workspace: Continue where you stopped + Continue elsewhere on
 * the left; Plans suggest, Today/Coming up, and Needs a study map on the right.
 */
import { button, empty } from '../../components';
import { currentWorkResource } from '../../features/stage-resources';
import { elsewhereRows } from '../../features/home/elsewhere';
import { todayItems } from '../../features/home/focus';
import { candidateModules, resolveResumeTarget } from '../../features/home/model';
import { orderedUnits } from '../../features/home/study-work';
import { readStudyMap, stageProgress } from '../../features/unit/model';
import type { ProjectionRecord } from '../../contracts/manifest';
import { asLabel, asString, asText } from '../../projection/readers';
import type { HomeScreenHost, LearnScreenHost } from '../screens';
import { openFocusCollection, requestFocusPlan, requestFocusSession } from './collection';
import { renderFocusModulesForLearn } from './modules';
import {
  commandBar,
  heading,
  moduleName,
  moduleRow,
  page,
  progress,
  sideCard,
  stageBars,
  textLink,
  unitLabel,
} from './parts';

function renderResumeHero(parent: HTMLElement, view: HomeScreenHost): boolean {
  const { plugin } = view;
  const { pointer, unit, unitMap: projected, module } = resolveResumeTarget(plugin.store);
  const map = projected ? readStudyMap(projected) : null;
  const stage = map?.stages.find((item) => item.id === pointer.stage_id);
  if (!unit || !stage || !map || !pointer.unit_id) return false;
  const unitId = pointer.unit_id;
  const stageIndex = map.stages.indexOf(stage);
  const { done, total } = stageProgress(map.stages);
  const startsWith = currentWorkResource(stage.resources);

  const card = parent.createDiv({ cls: 'focus-resume' });
  const top = card.createDiv({ cls: 'focus-resume-head' });
  top.createDiv({ cls: 'focus-eyebrow', text: 'Continue where you stopped' });
  if (module) top.createSpan({ cls: 'focus-pill is-accent', text: moduleName(module) });
  card.createEl('h2', { text: asLabel(unit) });
  card.createEl('p', {
    cls: 'focus-resume-meta',
    text: `Next: Stage ${stageIndex + 1} · ${stage.title}`,
  });
  if (startsWith) {
    card.createEl('p', {
      cls: 'focus-muted',
      text: `Starts with: ${startsWith.label}`,
    });
  }
  const foot = card.createDiv({ cls: 'focus-resume-foot' });
  stageBars(foot, total, done, stageIndex >= 0 ? stageIndex : null);
  progress(foot, done, total);
  const actions = foot.createDiv({ cls: 'focus-resume-actions' });
  button(actions, 'Study plan', () => {
    requestFocusPlan(unitId);
    return plugin.nav.openUnit(unitId, stage.id);
  }, 'quiet');
  button(actions, 'Resume session', () => {
    requestFocusSession(unitId);
    return plugin.nav.openUnit(unitId, stage.id);
  }, 'cta');
  return true;
}

export function renderFocusLearn(view: LearnScreenHost): boolean {
  const { plugin } = view;
  if (!view.programId || !plugin.store.get(view.programId) || ['inbox', 'queue-needs-map'].includes(view.programId)) {
    return false;
  }
  return renderFocusModulesForLearn(view);
}

export function renderFocusHome(view: HomeScreenHost): void {
  const { plugin } = view;
  const { store, nav } = plugin;
  const root = page(view.contentEl, 'home', store);
  const barActions = commandBar(root, [{ label: 'Home' }], view);
  button(barActions, 'Search', () => nav.openGlobalSearch(), 'quiet');
  button(barActions, 'Quick capture', () => nav.openCapture(), 'quiet');

  const body = root.createDiv({ cls: 'focus-page' });
  heading(body, 'LearningOS', 'Focus workspace');

  const grid = body.createDiv({ cls: 'focus-home-grid' });
  const main = grid.createDiv({ cls: 'focus-home-main' });
  if (!renderResumeHero(main, view)) {
    const card = main.createDiv({ cls: 'focus-resume' });
    empty(card, 'Choose where to begin', 'No previous study session has been recorded.');
    button(card, 'Open Modules', () => openFocusCollection(nav, 'all'), 'cta');
  }

  const elsewhereHead = main.createDiv({ cls: 'focus-section-head' });
  elsewhereHead.createEl('h2', { text: 'Continue elsewhere' });
  textLink(elsewhereHead, 'All modules', () => openFocusCollection(nav, 'all'));
  const elsewhereList = main.createDiv({ cls: 'focus-module-list' });
  const elsewhere = elsewhereRows(view).slice(0, 5);
  for (const item of elsewhere) moduleRow(elsewhereList, store, item.record, item.open);
  if (!elsewhere.length) {
    elsewhereList.createEl('p', { cls: 'focus-muted', text: 'No other open study modules right now.' });
  }

  const dock = grid.createDiv({ cls: 'focus-home-dock' });

  const openPlans: { readonly module: ProjectionRecord; readonly workspace: ProjectionRecord }[] = [];
  for (const module of candidateModules(store)) {
    const moduleId = asString(module.id);
    if (!moduleId) continue;
    const workspace = store.workspacesForModule(moduleId).find((entry) => entry.is_open === true && asText(entry.next_action));
    if (workspace) openPlans.push({ module, workspace });
  }
  if (openPlans.length) {
    const plansCard = sideCard(dock, 'Plans suggest', { text: `${openPlans.length}` });
    const list = plansCard.createDiv({ cls: 'focus-dock-list' });
    for (const { module, workspace } of openPlans.slice(0, 3)) {
      const moduleId = asString(module.id) ?? '';
      const entry = list.createEl('button', { cls: 'focus-dock-item is-clickable', attr: { type: 'button' } });
      entry.createEl('strong', { text: `${moduleName(module)} · ${asLabel(workspace)}` });
      entry.createSpan({ cls: 'focus-muted', text: asText(workspace.next_action) ?? '' });
      entry.addEventListener('click', () => { void nav.openModule(moduleId); });
    }
  }

  const todayCard = sideCard(dock, 'Today & coming up');
  const items = todayItems(view).slice(0, 5);
  if (!items.length) {
    todayCard.createEl('p', { cls: 'focus-muted', text: 'Nothing time-sensitive is recorded.' });
  } else {
    const list = todayCard.createDiv({ cls: 'focus-dock-list' });
    for (const item of items) {
      const rowEl = item.action
        ? list.createEl('button', { cls: 'focus-dock-item is-clickable', attr: { type: 'button' } })
        : list.createDiv({ cls: 'focus-dock-item' });
      rowEl.createEl('strong', { text: item.title });
      rowEl.createSpan({ cls: 'focus-muted', text: item.detail });
      if (item.actionLabel) rowEl.createSpan({ cls: 'focus-eyebrow', text: item.actionLabel });
      if (item.action) rowEl.addEventListener('click', () => item.action?.());
    }
  }

  const unmappedUnits: { readonly module: ProjectionRecord; readonly unit: ProjectionRecord }[] = [];
  for (const module of candidateModules(store)) {
    const moduleId = asString(module.id);
    if (!moduleId) continue;
    for (const unit of orderedUnits(store, moduleId)) {
      if (unit.needs_study_map === true) unmappedUnits.push({ module, unit });
    }
  }
  if (unmappedUnits.length) {
    const needMapCard = sideCard(dock, 'Needs a study map', { text: `${unmappedUnits.length}`, tone: 'warning' });
    const list = needMapCard.createDiv({ cls: 'focus-dock-list' });
    for (const { module, unit } of unmappedUnits.slice(0, 4)) {
      const unitId = asString(unit.id) ?? '';
      const label = unitLabel(unit, module);
      const entry = list.createEl('button', { cls: 'focus-dock-item is-clickable', attr: { type: 'button' } });
      entry.createEl('strong', { text: `${moduleName(module)} · ${label.title}` });
      entry.createSpan({ cls: 'focus-muted', text: 'Ready for a study map' });
      entry.addEventListener('click', () => { void nav.openUnit(unitId); });
    }
  }
}
