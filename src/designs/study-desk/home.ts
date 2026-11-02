import { button, empty } from '../../components';
import { elsewhereRows } from '../../features/home/elsewhere';
import { todayItems } from '../../features/home/focus';
import { readResumePointer } from '../../features/home/model';
import { LEARN_AREAS } from '../../constants';
import { readStudyMap } from '../../features/unit/model';
import { currentWorkResource } from '../../features/stage-resources';
import type { AppNavigator } from '../../app/navigator';
import type { ManifestStore } from '../../manifest-store';
import { asLabel, asString } from '../../projection/readers';
import type { HomeScreenHost, LearnScreenHost } from '../screens';
import { requestSession } from './unit-mode';
import { deskHead, deskPage, deskRow, moduleLongTitle, moduleRow, moduleState, stageBars, textLink, unitLabel } from './parts';

interface HeroPlugin {
  readonly store: ManifestStore;
  readonly nav: Pick<AppNavigator, 'openLearn' | 'openUnit'>;
}

/**
 * "Continue where you stopped": the only filled block on Home and Learn.
 *
 * It reads Core's resume pointer and nothing else. With no pointer it says so,
 * because a guessed next stage here would look exactly like a recorded one.
 */
function renderHero(parent: HTMLElement, plugin: HeroPlugin): void {
  const { store } = plugin;
  const pointer = readResumePointer(store.data?.resume_pointer);
  const unit = pointer.unit_id ? store.get(pointer.unit_id) : null;
  const stage = pointer.stage_id ? store.stage(pointer.stage_id) : null;
  const projectedMap = pointer.unit_id ? store.mapForUnit(pointer.unit_id) : null;
  if (!unit || !stage || !pointer.unit_id || !pointer.stage_id || !projectedMap) {
    const quiet = parent.createDiv({ cls: 'sd-hero is-empty' });
    const copy = quiet.createDiv({ cls: 'sd-hero-copy' });
    copy.createDiv({ cls: 'sd-hero-kicker', text: 'Nothing to pick up yet' });
    copy.createEl('h1', { cls: 'sd-hero-title', text: 'Choose where to begin' });
    copy.createDiv({ cls: 'sd-hero-facts', text: 'LearningOS records where you stop once you finish a stage or end a session. Nothing has been recorded yet.' });
    const action = quiet.createDiv({ cls: 'sd-hero-action' });
    button(action, 'Open Learn', () => plugin.nav.openLearn(), 'cta');
    return;
  }
  const map = readStudyMap(projectedMap);
  const moduleId = asString(unit.module_id);
  const module = moduleId ? store.get(moduleId) : null;
  const position = Math.max(map.stages.findIndex((row) => row.id === pointer.stage_id), 0);
  const done = map.stages.filter((row) => row.status === 'complete').length;
  const here = unitLabel(unit, module);
  const hero = parent.createDiv({ cls: 'sd-hero' });
  const copy = hero.createDiv({ cls: 'sd-hero-copy' });
  copy.createDiv({ cls: 'sd-hero-kicker', text: 'Continue where you stopped' });
  copy.createEl('h1', { cls: 'sd-hero-title', text: asLabel(stage) });
  copy.createDiv({
    cls: 'sd-hero-facts',
    text: [module ? moduleLongTitle(module) : null, here.place, `Stage ${position + 1} of ${map.stages.length}`].filter(Boolean).join(' · '),
  });
  stageBars(copy, map.stages.length, done, position);
  const action = hero.createDiv({ cls: 'sd-hero-action' });
  const unitId = pointer.unit_id, stageId = pointer.stage_id;
  button(action, 'Continue studying', () => {
    requestSession(unitId);
    return plugin.nav.openUnit(unitId, stageId);
  }, 'choice').addClass('sd-hero-button');
  const start = currentWorkResource(map.stages[position]?.resources ?? []);
  if (start) action.createDiv({ cls: 'sd-hero-note', text: `Starts with ${start.label}` });
}

export function renderDeskHome(view: HomeScreenHost): void {
  const { plugin } = view;
  const root = deskPage(view.contentEl, 'home', plugin.store);
  const actions = deskHead(root, [{ label: 'Home' }]);
  button(actions, 'Capture', () => plugin.nav.openCapture(), 'quiet');

  renderHero(root, plugin);

  const columns = root.createDiv({ cls: 'sd-home-columns' });
  const today = columns.createDiv({ cls: 'sd-home-today' });
  today.createEl('h2', { cls: 'sd-heading', text: 'Today' });
  const items = todayItems(view);
  if (!items.length) today.createEl('p', { cls: 'sd-quiet', text: 'Nothing time-sensitive is recorded.' });
  for (const item of items.slice(0, 4)) {
    const row = deskRow(today, 'sd-today-row', item.title, () => item.action?.());
    const copy = row.createDiv({ cls: 'sd-row-copy' });
    copy.createEl('strong', { cls: 'sd-row-strong', text: item.title });
    if (item.detail) copy.createDiv({ cls: 'sd-row-facts', text: item.detail });
    if (item.actionLabel) row.createSpan({ cls: 'sd-row-next', text: 'Open' });
    if (!item.action) row.disabled = true;
  }

  const elsewhere = columns.createDiv({ cls: 'sd-home-elsewhere' });
  elsewhere.createEl('h2', { cls: 'sd-heading', text: 'Continue elsewhere' });
  const rows = elsewhereRows(view).slice(0, 5);
  if (!rows.length) empty(elsewhere, 'No other active work', 'New modules and projects appear here when they are projected.');
  for (const row of rows) moduleRow(elsewhere, plugin.store, row.record, row.open);
}

/** Bachelor's, Skills and Job are routes today; Thesis & projects opens its module directly. */
function renderAreas(parent: HTMLElement, view: LearnScreenHost): void {
  const { store, nav } = view.plugin;
  const grid = parent.createDiv({ cls: 'sd-area-grid' });
  const open = store.of('module').filter((module) => module.is_actionable === true);
  const isThesis = (id: string | null) => Boolean(id?.startsWith('module-project-'));
  for (const [areaId, title] of LEARN_AREAS) {
    const count = open.filter((module) => asString(module.area_id) === areaId && !isThesis(asString(module.id))).length;
    const card = grid.createEl('button', {
      cls: `sd-area-card is-clickable${view.programId === areaId ? ' is-active' : ''}`,
      attr: { type: 'button', 'aria-pressed': String(view.programId === areaId) },
    });
    card.createEl('strong', { cls: 'sd-area-title', text: title });
    card.createDiv({ cls: 'sd-row-facts', text: `${count} ${areaId === 'program-bachelors' ? 'open ' : ''}module${count === 1 ? '' : 's'}` });
    card.addEventListener('click', () => nav.openLearn(areaId));
  }
  const thesis = open.filter((module) => isThesis(asString(module.id)));
  const card = grid.createEl('button', { cls: 'sd-area-card is-clickable', attr: { type: 'button' } });
  card.createEl('strong', { cls: 'sd-area-title', text: 'Thesis & projects' });
  card.createDiv({ cls: 'sd-row-facts', text: `${thesis.length} module${thesis.length === 1 ? '' : 's'}` });
  card.addEventListener('click', () => {
    const first = thesis[0] && asString(thesis[0].id);
    return first ? nav.openModule(first) : nav.openModules();
  });
}

export function renderDeskLearn(view: LearnScreenHost): boolean {
  // Capture and the planning queue share this view; they keep their own screens.
  if (view.programId === 'inbox' || view.programId === 'queue-needs-map') return false;
  const { plugin } = view;
  const program = view.programId ? plugin.store.get(view.programId) : null;
  if (!program) return false;
  const root = deskPage(view.contentEl, 'learn', plugin.store);
  deskHead(root, [{ label: 'Learn' }]);
  renderHero(root, plugin as unknown as HeroPlugin);
  renderAreas(root, view);
  const head = root.createDiv({ cls: 'sd-section-head' });
  head.createEl('h2', { cls: 'sd-heading', text: view.programId === 'program-bachelors' ? 'Your modules' : asLabel(program) });
  textLink(head, 'All modules', () => plugin.nav.openModules());
  const modules = plugin.store.modulesFor(view.programId ?? '')
    .filter((module) => module.is_actionable === true && !asString(module.id)?.startsWith('module-project-'));
  if (!modules.length) root.createEl('p', { cls: 'sd-quiet', text: 'Nothing open in this area right now. All modules lists the closed ones.' });
  const list = root.createDiv({ cls: 'sd-module-list' });
  for (const module of modules) {
    moduleRow(list, plugin.store, module, () => plugin.nav.openModule(asString(module.id) ?? ''), moduleState(plugin.store, module));
  }
  return true;
}
