import { filterTabs, icon } from '../../components';
import { readResumePointer } from '../../features/home/model';
import { todayItems } from '../../features/home/focus';
import { MODULE_TABS, nonNull, normalizeUnitRecord, orderModuleUnits, readModuleRecord } from '../../features/module/model';
import { renderModuleUnitGroups } from '../../features/module/detail';
import type { ProjectionRecord } from '../../contracts/manifest';
import { asLabel, asString, asText } from '../../projection/readers';
import { compareStrings, foldCase } from '../../sorting';
import type { LearnScreenHost, ModuleDetailScreenHost, ModuleListScreenHost } from '../screens';
import { chevron, coverOf, deskHead, deskPage, deskRow, moduleLongTitle, moduleName, moduleRow, moduleShort, sideGroup, stageBars, textLink, unitLabel } from './parts';
import { currentSemesterKey, unitWork } from './study-work';

const AREAS = [
  ['all', 'All'], ['program-bachelors', 'Bachelor’s'], ['program-skills', 'Skills'],
  ['program-job', 'Job'], ['projects', 'Thesis & projects'],
] as const;

type Area = typeof AREAS[number][0];
const moduleFilters = new WeakMap<object, { initial: Area; area: Area }>();

function areaOf(module: ProjectionRecord): string {
  return module.kind === 'project' ? 'projects' : asString(module.area_id) ?? '';
}

export function renderDeskModuleList(view: ModuleListScreenHost): boolean {
  if (view.groupId) return false;
  renderModules(view, 'all', view.query, (query) => { view.query = query; });
  return true;
}

/** Old program and Learn links land on the same screen with their area selected. */
export function renderDeskLearn(view: LearnScreenHost): boolean {
  const area = view.programId === 'program-thesis-projects' ? 'projects' : AREAS.find(([key]) => key === view.programId)?.[0];
  if (!area || area === 'all') return false;
  renderModules(view, area);
  return true;
}

function renderModules(
  view: ModuleListScreenHost | LearnScreenHost,
  initial: Area,
  query = '',
  onQuery?: (query: string) => void,
): void {
  const { plugin: { store, nav }, leaf } = view;
  let filter = moduleFilters.get(leaf);
  if (!filter || filter.initial !== initial) {
    filter = { initial, area: initial };
    moduleFilters.set(leaf, filter);
  }
  const state = filter;
  const root = deskPage(view.contentEl, 'modules', store);
  deskHead(root, [{ label: 'Modules' }], view);
  const head = root.createDiv({ cls: 'sd-title-row' });
  const copy = head.createDiv({ cls: 'sd-title-copy' });
  copy.createEl('h1', { cls: 'sd-title', text: 'Modules' });
  const facts = copy.createDiv({ cls: 'sd-facts' });
  const field = head.createEl('label', { cls: 'sd-search' });
  icon(field.createSpan({ cls: 'sd-search-glyph' }), 'search');
  const input = field.createEl('input', {
    cls: 'sd-search-input',
    attr: { type: 'search', placeholder: 'Find a module or lecture', 'aria-label': 'Find a module or lecture' },
  });
  input.value = query;
  const controls = root.createDiv({ cls: 'sd-title-tools' });
  const layout = root.createDiv({ cls: 'sd-plan-layout sd-modules-layout' });
  const body = layout.createDiv({ cls: 'sd-modules-body' });
  const side = layout.createDiv({ cls: 'sd-side sd-modules-side' });
  const upcoming = sideGroup(side, 'Coming up');
  const dates = todayItems(view).filter((item) => item.actionLabel !== 'Open review');
  if (!dates.length) upcoming.createEl('p', { cls: 'sd-note', text: 'No dates ahead.' });
  for (const item of dates) {
    if (item.action) textLink(upcoming, item.title, item.action);
    else upcoming.createSpan({ text: item.title });
    upcoming.createDiv({ cls: 'sd-row-facts', text: item.detail });
  }
  const modules = store.modules().filter((module) => !module.compatibility_only)
    .sort((a, b) => compareStrings(asLabel(a), asLabel(b)));
  const actionable = modules.filter((module) => module.is_actionable === true);
  const current = currentSemesterKey(store);
  const counts = AREAS.map(([key, label]) => {
    const count = actionable.filter((module) => areaOf(module) === key).length;
    return [key, key === 'all' ? label : `${label} · ${count}`] as const;
  });
  const open = (module: ProjectionRecord) => {
    const id = asString(module.id);
    if (!id) return;
    if ('selectedElementId' in view) view.selectedElementId = id;
    return nav.openModule(id);
  };
  function drawFilters() {
    controls.empty();
    filterTabs(controls, 'Module areas', counts, state.area, (area) => {
      state.area = area;
      draw();
      drawFilters();
      controls.querySelector?.<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    });
  }

  function draw() {
    body.empty();
    const needle = foldCase(input.value.trim());
    const scoped = modules.filter((module) => state.area === 'all' || areaOf(module) === state.area);
    const lectureMatches = new Map<ProjectionRecord, ProjectionRecord[]>();
    const shown = scoped.filter((module) => {
      const matches = needle && module.id ? store.unitsFor(module.id).filter((unit) => foldCase(asLabel(unit)).includes(needle)) : [];
      if (matches.length) lectureMatches.set(module, matches);
      return !needle || matches.length || foldCase(asLabel(module)).includes(needle);
    });
    const active = shown.filter((module) => module.is_actionable === true);
    const closed = shown.filter((module) => module.is_actionable !== true);
    facts.setText(`${active.length} open · ${closed.length} closed`);
    if (!shown.length) {
      body.createEl('p', { cls: 'sd-quiet', text: needle ? `No module or lecture matches “${input.value.trim()}”.` : 'No modules in this area.' });
      return;
    }

    const academics = active.filter((module) => module.kind === 'academic');
    const currentCourses = current ? academics.filter((module) => module.semester === current) : [];
    const past = academics.filter((module) => !currentCourses.includes(module));
    const projects = active.filter((module) => areaOf(module) === 'projects');
    const tracks = active.filter((module) => !academics.includes(module) && !projects.includes(module));
    const append = (parent: HTMLElement, rows: readonly ProjectionRecord[]) => {
      for (const module of rows) {
        moduleRow(parent, store, module, () => open(module));
        for (const unit of lectureMatches.get(module) ?? []) {
          const id = asString(unit.id);
          if (!id) continue;
          const hit = deskRow(parent, 'sd-module-hit', asLabel(unit), () => nav.openUnit(id));
          hit.createSpan({ cls: 'sd-row-copy', text: asLabel(unit) });
          chevron(hit);
        }
      }
    };
    const groups = [
      [store.currentSemester() ? `This semester · ${asLabel(store.currentSemester())}` : 'This semester', currentCourses],
      [currentCourses.length ? 'Still open from earlier semesters' : 'Open courses', past],
      ['Skills and job', tracks], ['Thesis and projects', projects],
    ] as const;
    for (const [title, rows] of groups) {
      if (!rows.length) continue;
      const group = body.createDiv({ cls: 'sd-sheet sd-module-list' });
      group.createEl('h2', { cls: 'sd-group-head', text: `${title} · ${rows.length}` });
      append(group, rows);
    }
    if (closed.length) {
      const details = body.createEl('details', { cls: 'sd-more-modules' });
      details.open = Boolean(needle);
      details.createEl('summary', { cls: 'sd-more-summary', text: `${closed.length} closed module${closed.length === 1 ? '' : 's'}` });
      append(details.createDiv({ cls: 'sd-sheet sd-module-list' }), closed);
    }
  }

  input.addEventListener('input', () => { onQuery?.(input.value); draw(); });
  drawFilters();
  draw();
}

export function renderDeskModuleDetail(view: ModuleDetailScreenHost): boolean {
  const { plugin } = view;
  const record = view.moduleId ? plugin.store.get(view.moduleId) : null;
  const module = readModuleRecord(record, view.moduleId);
  if (!record || !module) return false;
  const tab = view.tab ?? view.defaultTab(module);
  const short = moduleShort(record);
  const root = deskPage(view.contentEl, 'module', plugin.store);
  deskHead(root, [{ label: 'Modules', go: () => plugin.nav.openModules() }, { label: moduleName(record) }], view);

  const head = root.createDiv({ cls: 'sd-module-head', attr: { 'data-cover': coverOf(record) } });
  const cover = head.createDiv({ cls: 'sd-book', attr: { 'aria-hidden': 'true' } });
  cover.createDiv({ cls: 'sd-book-title', text: short });
  if (module.semester) cover.createDiv({ cls: 'sd-book-foot', text: module.semester.replace(/^sose-/i, 'Summer ').replace(/^wise-/i, 'Winter ') });
  const copy = head.createDiv({ cls: 'sd-module-copy' });
  copy.createEl('h1', { cls: 'sd-title', text: moduleLongTitle(record) });
  const facts = view.headline(module);
  if (facts) copy.createDiv({ cls: 'sd-facts', text: facts });
  filterTabs(copy, 'Module sections',
    [...MODULE_TABS].sort(([a], [b]) => (a === 'units' ? -1 : b === 'units' ? 1 : 0)), tab, (key) => view.selectTab(key));

  if (tab === 'overview') view.renderOverview(root, module);
  else if (tab === 'resources') view.renderSources(root, module);
  else if (tab === 'logistics') view.renderLogistics(root, module);
  else {
    const layout = root.createDiv({ cls: 'sd-plan-layout sd-modules-layout' });
    const main = layout.createDiv({ cls: 'sd-plan-main' });
    renderUnitSheet(main, view, record, module);
    const workspace = plugin.store.workspacesForModule(module.id).find((row) => row.archived !== true && row.status !== 'complete' && asText(row.next_action));
    if (workspace) {
      const plan = sideGroup(layout.createDiv({ cls: 'sd-side sd-modules-side' }), 'Your plan');
      plan.createEl('strong', { text: asLabel(workspace) });
      plan.createEl('p', { cls: 'sd-note', text: asText(workspace.next_action) ?? '' });
      textLink(plan, 'Open plan', () => view.selectTab('overview'));
    }
  }
  return true;
}

function renderUnitSheet(
  root: HTMLElement,
  view: ModuleDetailScreenHost,
  record: ProjectionRecord,
  module: NonNullable<ReturnType<typeof readModuleRecord>>,
): void {
  const { plugin } = view;
  if (module.components.length) {
    const options: Array<readonly [string, string]> = [['', 'All components'], ...module.components.map((row) => [row.id, row.title] as const)];
    filterTabs(root, 'Module components', options, view.componentId ?? '', (id) => view.selectComponent(id || null));
  }
  const units = orderModuleUnits(module, plugin.store.unitsFor(module.id, view.componentId)
    .map((row) => normalizeUnitRecord(row)).filter(nonNull));
  if (!units.length) {
    root.createEl('p', { cls: 'sd-quiet', text: 'No units in this component. Choose All components.' });
    return;
  }
  const pointer = readResumePointer(plugin.store.data?.resume_pointer);
  const sheet = root.createDiv({ cls: 'sd-sheet sd-unit-sheet' });
  renderModuleUnitGroups(sheet, units, (parent, unit) => {
    const work = unitWork(plugin.store, unit.id);
    const stages = work?.map.stages ?? [];
    const done = work?.done ?? 0;
    const label = unitLabel(plugin.store.get(unit.id), record);
    const here = pointer.unit_id === unit.id;
    const row = deskRow(parent, `sd-unit-row${here ? ' is-here' : ''}`, `Open unit: ${unit.title}`, () => {
      view.selectedElementId = unit.id;
      return plugin.nav.openUnit(unit.id);
    });
    row.createSpan({ cls: 'sd-unit-number', text: label.number ?? '·' });
    const copy = row.createSpan({ cls: 'sd-row-copy' });
    copy.createSpan({ cls: 'sd-unit-title', text: label.title });
    if (stages.length) copy.createSpan({ cls: 'sd-row-facts', text: `${done} of ${stages.length} stages done` });
    if (stages.length) stageBars(row, stages.length, done);
    row.createSpan({
      cls: `sd-row-next${done === stages.length && stages.length ? ' is-done' : ''}`,
      text: !work ? (unit.record.needs_study_map === true ? 'Needs a study map' : 'No study plan yet')
        : done === stages.length && stages.length ? 'Done'
          : work.next ? `Stage ${stages.indexOf(work.next) + 1} · ${work.next.title}` : 'No open stage',
    });
    chevron(row);
  });
}
