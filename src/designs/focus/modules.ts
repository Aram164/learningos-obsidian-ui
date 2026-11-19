/**
 * Focus 2.0 Modules catalog & Module Detail screens.
 * Shared entry for both Modules navigation and legacy Learn area links.
 */
import { filterTabs, icon, button } from '../../components';
import { readResumePointer, resolveResumeTarget } from '../../features/home/model';
import { todayItems } from '../../features/home/focus';
import { currentSemesterKey, unitWork } from '../../features/home/study-work';
import { moduleMap, moduleMapFacts } from '../../features/atlas/module-map';
import { MODULE_TABS, nonNull, normalizeUnitRecord, orderModuleUnits, readModuleRecord } from '../../features/module/model';
import { renderModuleUnitGroups } from '../../features/module/detail';
import type { ProjectionRecord } from '../../contracts/manifest';
import { asLabel, asString, asText } from '../../projection/readers';
import { compareStrings, foldCase } from '../../sorting';
import type { LearnScreenHost, ModuleDetailScreenHost, ModuleListScreenHost } from '../screens';
import { focusCollection, openFocusCollection, requestFocusSession, type FocusAreaScope } from './collection';
import {
  chevron,
  commandBar,
  coverOf,
  heading,
  moduleLongTitle,
  moduleName,
  moduleRow,
  page,
  row,
  sideCard,
  stageBars,
  textLink,
  unitLabel,
} from './parts';

const AREAS: ReadonlyArray<readonly [FocusAreaScope, string]> = [
  ['all', 'All'],
  ['program-bachelors', 'Bachelor’s'],
  ['program-skills', 'Skills'],
  ['program-job', 'Job'],
  ['projects', 'Thesis & projects'],
];

function areaOf(module: ProjectionRecord): string {
  return module.kind === 'project' ? 'projects' : asString(module.area_id) ?? '';
}

export function renderFocusModules(view: ModuleListScreenHost): boolean {
  if (view.groupId) return false;
  const state = focusCollection(view.contentEl);
  state.refresh = () => view.render();
  renderModulesCatalog(view, state, view.query, (query) => {
    state.query = query;
    view.query = query;
  });
  return true;
}

export function renderFocusModulesForLearn(view: LearnScreenHost): boolean {
  const mapped: FocusAreaScope | undefined =
    view.programId === 'program-all' ? 'all'
      : view.programId === 'program-thesis-projects' ? 'projects'
        : AREAS.find(([key]) => key === view.programId)?.[0];
  if (!mapped) return false;
  const state = focusCollection(view.contentEl);
  if (state.scope !== mapped) Object.assign(state, { scope: mapped, scroll: 0, selected: null });
  state.refresh = () => renderFocusModulesForLearn(view);
  renderModulesCatalog(view, state, state.query);
  return true;
}

function renderModulesCatalog(
  view: ModuleListScreenHost | LearnScreenHost,
  state: ReturnType<typeof focusCollection>,
  initialQuery = '',
  onQuery?: (query: string) => void,
): void {
  const { plugin: { store, nav } } = view;
  const root = page(view.contentEl, 'modules', store);
  root.setAttr('data-focus-collection', state.scope);
  const barActions = commandBar(root, [{ label: 'Modules' }], view);
  const tabsSlot = barActions.createDiv({ cls: 'focus-area-tabs' });
  const searchWrap = barActions.createEl('label', { cls: 'focus-search-field' });
  icon(searchWrap.createSpan({ attr: { 'aria-hidden': 'true' } }), 'search');
  const input = searchWrap.createEl('input', {
    cls: 'focus-search',
    attr: { type: 'search', placeholder: 'Find a module or lecture', 'aria-label': 'Find a module or lecture' },
  });
  input.value = state.query || initialQuery;

  const body = root.createDiv({ cls: 'focus-page' });
  const head = body.createDiv({ cls: 'focus-page-head' });
  const copy = head.createDiv({ cls: 'focus-heading-copy' });
  heading(copy, state.scope === 'projects' ? 'Your projects' : 'Curriculum', 'Modules', 'Across semesters, skill tracks and projects.');
  const status = head.createSpan({ cls: 'focus-muted', attr: { role: 'status', 'aria-live': 'polite' } });

  const layout = body.createDiv({ cls: 'focus-module-layout' });
  const listCol = layout.createDiv({ cls: 'focus-module-groups' });
  const sideCol = layout.createDiv({ cls: 'focus-home-dock' });

  const upcomingCard = sideCard(sideCol, 'Coming up');
  const dates = todayItems(view as unknown as Parameters<typeof todayItems>[0]).filter((item) => item.actionLabel !== 'Open review');
  if (!dates.length) upcomingCard.createEl('p', { cls: 'focus-muted', text: 'No dates ahead.' });
  for (const item of dates.slice(0, 5)) {
    const slot = item.action
      ? upcomingCard.createEl('button', { cls: 'focus-dock-item is-clickable', attr: { type: 'button' } })
      : upcomingCard.createDiv({ cls: 'focus-dock-item' });
    slot.createEl('strong', { text: item.title });
    slot.createSpan({ cls: 'focus-muted', text: item.detail });
    if (item.action) slot.addEventListener('click', () => item.action?.());
  }

  const allModules = store.modules().filter((module) => !module.compatibility_only)
    .sort((a, b) => compareStrings(asLabel(a), asLabel(b)));
  const actionable = allModules.filter((module) => module.is_actionable === true);
  const current = currentSemesterKey(store);
  const areaCounts = AREAS.map(([key, label]) => {
    const count = key === 'all' ? actionable.length : actionable.filter((module) => areaOf(module) === key).length;
    return [key, `${label} · ${count}`] as const;
  });

  const openModule = (module: ProjectionRecord) => {
    const id = asString(module.id);
    if (!id) return;
    if ('selectedElementId' in view) view.selectedElementId = id;
    state.selected = id;
    state.scroll = root.scrollTop;
    return nav.openModule(id);
  };

  function drawTabs() {
    tabsSlot.empty();
    filterTabs<FocusAreaScope>(tabsSlot, 'Module areas', areaCounts, state.scope, (next) => {
      Object.assign(state, { scope: next, scroll: 0, selected: null });
      root.setAttr('data-focus-collection', state.scope);
      draw();
      drawTabs();
      tabsSlot.querySelector?.<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    });
  }

  function draw() {
    listCol.empty();
    const needle = foldCase(input.value.trim());
    const scoped = allModules.filter((module) => state.scope === 'all' || areaOf(module) === state.scope);
    const lectureHits = new Map<ProjectionRecord, ProjectionRecord[]>();
    const shown = scoped.filter((module) => {
      const moduleId = asString(module.id);
      const matches = needle && moduleId ? store.unitsFor(moduleId).filter((unit) => foldCase(asLabel(unit)).includes(needle)) : [];
      if (matches.length) lectureHits.set(module, matches);
      return !needle || matches.length > 0 || foldCase(asLabel(module)).includes(needle);
    });
    const openRows = shown.filter((module) => module.is_actionable === true);
    const closedRows = shown.filter((module) => module.is_actionable !== true);
    status.setText(`${openRows.length} open · ${closedRows.length} closed${needle ? ` matching “${input.value.trim()}”` : ''}`);

    if (!shown.length) {
      listCol.createEl('p', {
        cls: 'focus-muted',
        text: needle ? `No module or lecture matches “${input.value.trim()}”.` : 'No modules in this area.',
      });
      return;
    }

    const academics = openRows.filter((module) => module.kind === 'academic');
    const currentCourses = current ? academics.filter((module) => module.semester === current) : [];
    const past = academics.filter((module) => !currentCourses.includes(module));
    const projects = openRows.filter((module) => areaOf(module) === 'projects');
    const tracks = openRows.filter((module) => !academics.includes(module) && !projects.includes(module));

    const appendRows = (parent: HTMLElement, rows: readonly ProjectionRecord[]) => {
      for (const module of rows) {
        const target = moduleRow(parent, store, module, () => openModule(module));
        target.toggleClass('is-current', state.selected === asString(module.id));
        for (const unit of lectureHits.get(module) ?? []) {
          const unitId = asString(unit.id);
          if (!unitId) continue;
          const hit = row(parent, `Open lecture: ${asLabel(unit)}`, () => nav.openUnit(unitId));
          hit.addClass('focus-module-hit');
          hit.createDiv({ cls: 'focus-row-copy' }).createEl('strong', { text: asLabel(unit) });
          chevron(hit);
        }
      }
    };

    const semesterTitle = store.currentSemester() ? `This semester · ${asLabel(store.currentSemester())}` : 'This semester';
    const groups = [
      [semesterTitle, currentCourses],
      [currentCourses.length ? 'Still open from earlier semesters' : 'Open courses', past],
      ['Skills and job', tracks],
      ['Thesis and projects', projects],
    ] as const;
    for (const [title, rows] of groups) {
      if (!rows.length) continue;
      const section = listCol.createDiv({ cls: 'focus-module-group' });
      section.createDiv({ cls: 'focus-eyebrow', text: `${title} · ${rows.length}` });
      appendRows(section, rows);
    }

    if (closedRows.length) {
      const closed = listCol.createEl('details', { cls: 'focus-closed-modules' });
      closed.open = Boolean(needle);
      closed.createEl('summary', { text: `${closedRows.length} closed module${closedRows.length === 1 ? '' : 's'}` });
      appendRows(closed.createDiv({ cls: 'focus-module-list' }), closedRows);
    }
  }

  input.addEventListener('input', () => {
    state.query = input.value;
    onQuery?.(input.value);
    draw();
  });
  drawTabs();
  draw();
  root.scrollTop = state.scroll;
}

export function renderFocusModule(view: ModuleDetailScreenHost): boolean {
  const record = view.moduleId ? view.plugin.store.get(view.moduleId) : null;
  const module = readModuleRecord(record, view.moduleId);
  if (!module || !record) return false;
  const { plugin } = view;
  const root = page(view.contentEl, 'module', plugin.store);
  const collection = focusCollection(root);
  const actions = commandBar(root, [
    { label: collection.scope === 'projects' ? 'Thesis & projects' : 'Modules', go: () => openFocusCollection(plugin.nav) },
    { label: moduleName(record) },
  ], view);
  const pointer = readResumePointer(plugin.store.data?.resume_pointer);
  if (pointer.module_id === module.id && pointer.unit_id && pointer.stage_id) {
    const unitId = pointer.unit_id;
    const stageId = pointer.stage_id;
    button(actions, 'Resume session', () => {
      requestFocusSession(unitId);
      return plugin.nav.openUnit(unitId, stageId);
    }, 'cta');
  }

  const body = root.createDiv({ cls: 'focus-page' });
  const header = body.createDiv({ cls: 'focus-module-header', attr: { 'data-cover': coverOf(record) } });
  const copy = header.createDiv({ cls: 'focus-heading-copy' });
  heading(copy, module.kind === 'academic' ? 'Academic module' : 'Module', moduleLongTitle(record), view.headline(module));

  const tab = view.tab ?? view.defaultTab(module);
  const tabRow = body.createDiv({ cls: 'focus-filters' });
  filterTabs(
    tabRow,
    'Module sections',
    [...MODULE_TABS].sort(([a], [b]) => (a === 'units' ? -1 : b === 'units' ? 1 : 0)),
    tab,
    (next) => view.selectTab(next),
  );
  const mMap = moduleMap(plugin.store, module.id);
  if (mMap) {
    button(tabRow, `Revision map · ${moduleMapFacts(mMap)}`, () => plugin.router.navigate({ name: 'atlas', concept: null, module: module.id, lens: 'prerequisites' }), 'quiet');
  }

  if (tab === 'overview') {
    view.renderOverview(body, module);
  } else if (tab === 'resources') {
    view.renderSources(body, module);
  } else if (tab === 'logistics') {
    view.renderLogistics(body, module);
  } else {
    const layout = body.createDiv({ cls: 'focus-module-layout' });
    const main = layout.createDiv({ cls: 'focus-module-groups' });
    if (module.components.length) {
      filterTabs(
        main,
        'Module components',
        [['', 'All components'], ...module.components.map((item) => [item.id, item.title] as const)],
        view.componentId ?? '',
        (id) => view.selectComponent(id || null),
      );
    }
    const units = orderModuleUnits(module, plugin.store.unitsFor(module.id, view.componentId).map(normalizeUnitRecord).filter(nonNull));
    const resumed = resolveResumeTarget(plugin.store);
    const pointerUnitId = resumed.unit ? resumed.pointer.unit_id : null;

    if (!units.length) {
      main.createEl('p', { cls: 'focus-muted', text: 'No units in this component. Choose All components.' });
    } else {
      renderModuleUnitGroups(main, units, (parent, unit) => {
        const work = unitWork(plugin.store, unit.id);
        const stages = work?.map.stages ?? [];
        const done = work?.done ?? 0;
        const label = unitLabel(plugin.store.get(unit.id), record);
        const target = row(parent, `Open unit: ${unit.title}`, () => {
          view.selectedElementId = unit.id;
          return plugin.nav.openUnit(unit.id);
        });
        if (pointerUnitId && pointerUnitId === unit.id) target.addClass('is-current');
        if (label.number) target.createSpan({ cls: 'focus-stage-number focus-mono', text: label.number.padStart(2, '0') });
        const rowCopy = target.createDiv({ cls: 'focus-row-copy' });
        rowCopy.createEl('strong', { text: label.number ? label.title : unit.title });
        rowCopy.createSpan({
          cls: 'focus-muted',
          text: stages.length ? `${done} of ${stages.length} stages complete` : (unit.record.needs_study_map === true ? 'Needs a study map' : 'No study map yet'),
        });
        if (stages.length) stageBars(target, stages.length, done);
        const complete = Boolean(stages.length && done === stages.length);
        const nextText = !work
          ? (unit.record.needs_study_map === true ? 'Needs a study map' : 'No study plan yet')
          : complete ? 'Done'
            : work.next ? `Stage ${stages.indexOf(work.next) + 1} · ${work.next.title}` : 'No open stage';
        target.createSpan({ cls: `focus-row-state${complete ? ' is-complete' : ''}`, text: nextText });
        chevron(target);
      });
    }

    const side = layout.createDiv({ cls: 'focus-home-dock' });
    const workspace = plugin.store.workspacesForModule(module.id).find((entry) => entry.is_open === true && asText(entry.next_action));
    if (workspace) {
      const plan = sideCard(side, 'Your plan');
      plan.createEl('strong', { text: asLabel(workspace) });
      plan.createEl('p', { cls: 'focus-muted', text: asText(workspace.next_action) ?? '' });
      textLink(plan, 'Open plan', () => view.selectTab('overview'));
    }
    const deadlines = view.deadlinesFor(module);
    if (deadlines.length) {
      const dates = sideCard(side, 'Academic dates');
      view.renderDeadlineRows(dates, module, deadlines);
    }
  }

  button(body, collection.scope === 'projects' ? 'Back to projects' : 'Back to modules', () => openFocusCollection(plugin.nav), 'quiet');
  return true;
}
