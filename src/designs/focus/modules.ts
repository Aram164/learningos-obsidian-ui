import { button, filterTabs } from '../../components';
import { MODULE_TABS, nonNull, normalizeUnitRecord, orderModuleUnits, readModuleRecord } from '../../features/module/model';
import { renderModuleUnitGroups } from '../../features/module/detail';
import { readResumePointer } from '../../features/home/model';
import { asLabel, asRecords, asString } from '../../projection/readers';
import { compareStrings, foldCase } from '../../sorting';
import type { ModuleDetailScreenHost, ModuleListScreenHost } from '../screens';
import { chevron, heading, moduleRow, page, row, toolbar } from './parts';
import { requestFocusSession } from './unit';
import { focusCollection, openFocusCollection, type FocusCollection } from './collection';

export function renderFocusModules(view: ModuleListScreenHost): boolean {
  if (view.groupId) return false;
  const { plugin } = view;
  const state = focusCollection(view.contentEl);
  state.refresh = () => view.render();
  const root = page(view.contentEl, 'modules', plugin.store);
  root.setAttr('data-focus-collection', state.scope);
  toolbar(root, 'Modules', state.scope === 'projects' ? 'Thesis & projects' : 'Across semesters');
  const body = root.createDiv({ cls: 'focus-page' });
  heading(body, state.scope === 'projects' ? 'Your projects' : 'Your curriculum', state.scope === 'projects' ? 'Thesis & projects' : 'Modules', state.scope === 'projects' ? 'Every project, with its units, materials and study plan.' : 'Keep every open module within reach.');
  const filters = body.createDiv({ cls: 'focus-filters' });
  filterTabs<FocusCollection>(filters, 'Module collection', [['open', 'Open'], ['all', 'All'], ['projects', 'Thesis & projects']], state.scope, key => {
    Object.assign(state, { scope: key, query: '', scroll: 0, selected: null }); view.render();
  });
  const input = filters.createEl('input', { cls: 'los-search focus-search', attr: { type: 'search', placeholder: 'Find a module', 'aria-label': 'Find a module' } });
  input.value = state.query;
  const result = body.createDiv({ cls: 'focus-muted', attr: { role: 'status', 'aria-live': 'polite' } });
  const list = body.createDiv({ cls: 'focus-module-list' });
  const draw = () => {
    list.empty();
    const academicIds = new Set(plugin.store.openAcademicModules().map(module => module.id));
    const collection = state.scope === 'projects' ? plugin.store.modules().filter(module => module.kind === 'project')
      : state.scope === 'all' ? plugin.store.modules() : plugin.store.modules().filter(module => academicIds.has(module.id) || module.is_actionable === true);
    const modules = collection
      .filter(module => foldCase(asLabel(module)).includes(foldCase(state.query.trim())))
      .sort((a, b) => compareStrings(asLabel(a), asLabel(b)));
    result.setText(`${modules.length} of ${collection.length} ${state.scope === 'projects' ? 'projects' : 'modules'}${state.query ? ' match your search' : ''}`);
    for (const module of modules) {
      const target = moduleRow(list, plugin.store, module, () => {
        view.selectedElementId = asString(module.id);
        state.selected = view.selectedElementId;
        state.scroll = root.scrollTop;
        return plugin.nav.openModuleDetail(asString(module.id) ?? '');
      });
      target.toggleClass('is-current', state.selected === asString(module.id));
    }
    if (!modules.length) list.createEl('p', { cls: 'focus-muted', text: collection.length ? 'No matches. Clear the search to see the complete collection.' : state.scope === 'projects' ? 'No projects are recorded yet. All modules remains available above.' : 'No modules in this collection. Choose All to browse the curriculum.' });
  };
  input.addEventListener('input', () => { state.query = view.query = input.value; draw(); });
  draw();
  body.createEl('p', { cls: 'focus-muted', text: 'Click anywhere on a row to open the module.' });
  root.scrollTop = state.scroll;
  return true;
}
export function renderFocusModule(view: ModuleDetailScreenHost): boolean {
  const record = view.moduleId ? view.plugin.store.get(view.moduleId) : null;
  const module = readModuleRecord(record, view.moduleId);
  if (!module) return false;
  const { plugin } = view;
  const root = page(view.contentEl, 'module', plugin.store);
  const collection = focusCollection(root);
  toolbar(root, collection.scope === 'projects' ? 'Thesis & projects' : 'Modules', module.title, () => openFocusCollection(plugin.nav));
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
    renderModuleUnitGroups(body, units, (parent, unit) => {
      const stages = asRecords(plugin.store.mapForUnit(unit.id)?.stages);
      const done = stages.filter(stage => stage.status === 'complete').length;
      const target = row(parent, `Open unit: ${unit.title}`, () => { view.selectedElementId = unit.id; return plugin.nav.openUnit(unit.id); });
      const copy = target.createDiv({ cls: 'focus-row-copy' });
      copy.createEl('strong', { text: unit.title });
      copy.createSpan({ cls: 'focus-muted', text: stages.length ? `${stages.length} stages · ${done} complete` : 'No study map yet' });
      target.createSpan({ cls: 'focus-row-state', text: unit.status.replaceAll('-', ' ') });
      chevron(target);
    });
    if (!units.length) body.createEl('p', { cls: 'focus-muted', text: 'No units in this component. Choose All components.' });
  }
  button(body, collection.scope === 'projects' ? 'Back to projects' : 'Back to modules', () => openFocusCollection(plugin.nav), 'quiet');
  return true;
}
