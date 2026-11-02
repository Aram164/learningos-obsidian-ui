import { button, filterTabs } from '../../components';
import { MODULE_TABS, nonNull, normalizeUnitRecord, orderModuleUnits, readModuleRecord } from '../../features/module/model';
import { readResumePointer } from '../../features/home/model';
import { asLabel, asRecords, asString } from '../../projection/readers';
import { compareStrings, foldCase } from '../../sorting';
import type { ModuleDetailScreenHost, ModuleListScreenHost } from '../screens';
import { chevron, heading, moduleRow, page, row, toolbar } from './parts';
import { requestFocusSession } from './unit';

const showAll = new WeakMap<ModuleListScreenHost, boolean>();
export function renderFocusModules(view: ModuleListScreenHost): boolean {
  if (view.groupId) return false;
  const { plugin } = view;
  const root = page(view.contentEl, 'modules', plugin.store);
  toolbar(root, 'Modules', 'Across semesters');
  const body = root.createDiv({ cls: 'focus-page' });
  heading(body, 'Your curriculum', 'Modules', 'Keep every open module within reach.');
  const filters = body.createDiv({ cls: 'focus-filters' });
  filterTabs(filters, 'Module status', [['open', 'Open'], ['all', 'All']], showAll.get(view) ? 'all' : 'open', key => { showAll.set(view, key === 'all'); view.render(); });
  const input = filters.createEl('input', { cls: 'los-search focus-search', attr: { type: 'search', placeholder: 'Find a module', 'aria-label': 'Find a module' } });
  input.value = view.query;
  const list = body.createDiv({ cls: 'focus-module-list' });
  const draw = () => {
    list.empty();
    const academicIds = new Set(plugin.store.openAcademicModules().map(module => module.id));
    const modules = (showAll.get(view) ? plugin.store.modules() : plugin.store.modules().filter(module => academicIds.has(module.id) || module.is_actionable === true))
      .filter(module => foldCase(asLabel(module)).includes(foldCase(view.query.trim())))
      .sort((a, b) => compareStrings(asLabel(a), asLabel(b)));
    for (const module of modules) moduleRow(list, plugin.store, module, () => {
      view.selectedElementId = asString(module.id);
      return plugin.nav.openModuleDetail(asString(module.id) ?? '');
    });
    if (!modules.length) list.createEl('p', { cls: 'focus-muted', text: 'No modules match. Try another search or choose All.' });
  };
  input.addEventListener('input', () => { view.query = input.value; draw(); });
  draw();
  body.createEl('p', { cls: 'focus-muted', text: 'Click anywhere on a row to open the module.' });
  return true;
}
export function renderFocusModule(view: ModuleDetailScreenHost): boolean {
  const record = view.moduleId ? view.plugin.store.get(view.moduleId) : null;
  const module = readModuleRecord(record, view.moduleId);
  if (!module) return false;
  const { plugin } = view;
  const root = page(view.contentEl, 'module', plugin.store);
  toolbar(root, 'Modules', module.title, () => plugin.nav.openModules());
  const body = root.createDiv({ cls: 'focus-page' });
  heading(body, module.kind === 'academic' ? 'Academic module' : 'Module', module.title, view.headline(module));
  const controls = body.createDiv({ cls: 'focus-filters' });
  const tab = view.tab ?? view.defaultTab(module);
  filterTabs(controls, 'Module sections', MODULE_TABS, tab, next => view.selectTab(next));
  const pointer = readResumePointer(plugin.store.data?.resume_pointer);
  if (pointer.module_id === module.id && pointer.unit_id && pointer.stage_id) {
    const unitId = pointer.unit_id, stageId = pointer.stage_id;
    button(controls, 'Resume session', () => { requestFocusSession(unitId); return plugin.nav.openUnit(unitId, stageId); }, 'cta');
  }
  if (tab === 'overview') view.renderOverview(body, module);
  else if (tab === 'resources') view.renderSources(body, module);
  else if (tab === 'logistics') view.renderLogistics(body, module);
  else {
    if (module.components.length) filterTabs(body, 'Module components', [['', 'All components'], ...module.components.map(item => [item.id, item.title] as const)], view.componentId ?? '', id => view.selectComponent(id || null));
    body.createEl('h2', { text: 'Units' });
    const units = orderModuleUnits(module, plugin.store.unitsFor(module.id, view.componentId).map(normalizeUnitRecord).filter(nonNull));
    for (const unit of units) {
      const stages = asRecords(plugin.store.mapForUnit(unit.id)?.stages);
      const done = stages.filter(stage => stage.status === 'complete').length;
      const target = row(body, `Open unit: ${unit.title}`, () => { view.selectedElementId = unit.id; return plugin.nav.openUnit(unit.id); });
      const copy = target.createDiv({ cls: 'focus-row-copy' });
      copy.createEl('strong', { text: unit.title });
      copy.createSpan({ cls: 'focus-muted', text: stages.length ? `${stages.length} stages · ${done} complete` : 'No study map yet' });
      target.createSpan({ cls: 'focus-row-state', text: unit.status.replaceAll('-', ' ') });
      chevron(target);
    }
    if (!units.length) body.createEl('p', { cls: 'focus-muted', text: 'No units in this component. Choose All components.' });
  }
  button(body, 'Back to modules', () => plugin.nav.openModules(), 'quiet');
  return true;
}
