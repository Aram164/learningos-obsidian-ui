import { filterTabs, icon } from '../../components';
import { readResumePointer } from '../../features/home/model';
import { MODULE_TABS, nonNull, normalizeUnitRecord, orderModuleUnits, readModuleRecord } from '../../features/module/model';
import type { ProjectionRecord } from '../../contracts/manifest';
import { asRecords, asString } from '../../projection/readers';
import { compareStrings, foldCase } from '../../sorting';
import type { ModuleDetailScreenHost, ModuleListScreenHost } from '../screens';
import { chevron, coverOf, deskHead, deskPage, deskRow, moduleLongTitle, moduleRow, moduleShort, stageBars, unitLabel } from './parts';

const JOB_VISIBLE = 5;

function group(parent: HTMLElement, title: string, count: string): HTMLElement {
  const head = parent.createDiv({ cls: 'sd-group-head' });
  head.createSpan({ cls: 'sd-group-title', text: title });
  head.createSpan({ cls: 'sd-group-count', text: count });
  return parent.createDiv({ cls: 'sd-module-list' });
}

/**
 * Every module, grouped by what you would look for: enrolled first, then job,
 * skills and projects, with closed ones one click away rather than gone.
 */
export function renderDeskModuleList(view: ModuleListScreenHost): boolean {
  // A thematic group's list keeps its own screen for now, restyled.
  if (view.groupId) return false;
  const { plugin } = view;
  const root = deskPage(view.contentEl, 'modules', plugin.store);
  deskHead(root, [{ label: 'Modules' }]);
  const head = root.createDiv({ cls: 'sd-title-row' });
  head.createEl('h1', { cls: 'sd-title', text: 'Modules' });
  const field = head.createEl('label', { cls: 'sd-search' });
  icon(field.createSpan({ cls: 'sd-search-glyph' }), 'search');
  const input = field.createEl('input', {
    cls: 'sd-search-input',
    attr: { type: 'search', placeholder: 'Search', 'aria-label': 'Search modules' },
  });
  input.value = view.query;

  const body = root.createDiv({ cls: 'sd-modules-body' });
  const openModule = (module: ProjectionRecord) => {
    view.selectedElementId = asString(module.id);
    return plugin.nav.openModuleDetail(asString(module.id) ?? '');
  };
  const draw = () => {
    body.empty();
    const needle = foldCase(view.query.trim());
    const all = plugin.store.of('module')
      .filter((module) => !needle || foldCase(String(module.title ?? '')).includes(needle))
      .sort((a, b) => compareStrings(String(a.title ?? ''), String(b.title ?? '')));
    const academic = new Set(plugin.store.openAcademicModules().map((module) => module.id));
    const enrolled = all.filter((module) => academic.has(module.id) && module.is_actionable === true && asString(module.area_id) === 'program-bachelors' && !asString(module.id)?.startsWith('module-project-'));
    const shown = new Set(enrolled.map((module) => module.id));
    const others = all.filter((module) => module.is_actionable === true && !shown.has(module.id));
    const closed = all.filter((module) => module.is_actionable !== true);
    if (!all.length) {
      body.createEl('p', { cls: 'sd-quiet', text: `No module matches “${view.query.trim()}”.` });
      return;
    }
    if (enrolled.length) {
      const list = group(body, 'Enrolled', String(enrolled.length));
      for (const module of enrolled) moduleRow(list, plugin.store, module, () => openModule(module));
    }
    if (others.length) {
      const visible = needle ? others : others.slice(0, JOB_VISIBLE);
      const list = group(body, 'Job, skills and projects', visible.length < others.length ? `${visible.length} of ${others.length}` : String(others.length));
      for (const module of visible) moduleRow(list, plugin.store, module, () => openModule(module));
      closedDisclosure(body, others.slice(visible.length), closed, openModule, plugin.store);
    } else {
      closedDisclosure(body, [], closed, openModule, plugin.store);
    }
  };
  input.addEventListener('input', () => { view.query = input.value; draw(); });
  draw();
  return true;
}

function closedDisclosure(
  parent: HTMLElement,
  more: readonly ProjectionRecord[],
  closed: readonly ProjectionRecord[],
  open: (module: ProjectionRecord) => unknown,
  store: ModuleListScreenHost['plugin']['store'],
): void {
  if (!more.length && !closed.length) return;
  const parts = [more.length ? `${more.length} more` : '', closed.length ? `${closed.length} closed module${closed.length === 1 ? '' : 's'}` : ''].filter(Boolean);
  const details = parent.createEl('details', { cls: 'sd-more-modules' });
  details.createEl('summary', { cls: 'sd-more-summary', text: `Show ${parts.join(' and ')}` });
  const list = details.createDiv({ cls: 'sd-module-list' });
  for (const module of [...more, ...closed]) moduleRow(list, store, module, () => open(module));
}

export function renderDeskModuleDetail(view: ModuleDetailScreenHost): boolean {
  const { plugin } = view;
  const record = view.moduleId ? plugin.store.get(view.moduleId) : null;
  const module = readModuleRecord(record, view.moduleId);
  if (!record || !module) return false;
  const tab = view.tab ?? view.defaultTab(module);
  const short = moduleShort(record);
  const root = deskPage(view.contentEl, 'module', plugin.store);
  deskHead(root, [{ label: 'Modules', go: () => plugin.nav.openModules() }, { label: short }]);

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
  else renderUnitSheet(root, view, record, module);
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
  for (const unit of units) {
    const map = plugin.store.mapForUnit(unit.id);
    const stages = asRecords(map?.stages);
    const done = stages.filter((stage) => stage.status === 'complete').length;
    const label = unitLabel(plugin.store.get(unit.id), record);
    const here = pointer.unit_id === unit.id;
    const row = deskRow(sheet, `sd-unit-row${here ? ' is-here' : ''}`, `Open unit: ${unit.title}`, () => {
      view.selectedElementId = unit.id;
      return plugin.nav.openUnit(unit.id);
    });
    row.createSpan({ cls: 'sd-unit-number', text: label.number ?? '·' });
    row.createSpan({ cls: 'sd-unit-title', text: label.title });
    if (stages.length) stageBars(row, stages.length, done);
    row.createSpan({
      cls: `sd-row-next${done === stages.length && stages.length ? ' is-done' : ''}`,
      text: !map ? 'No study plan yet'
        : done === stages.length && stages.length ? 'Done'
          : done ? `${done} of ${stages.length}`
            : `${stages.length} stage${stages.length === 1 ? '' : 's'}`,
    });
    chevron(row);
  }
}
