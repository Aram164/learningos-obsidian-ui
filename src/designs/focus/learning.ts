import { button, empty, filterTabs } from '../../components';
import { elsewhereRows } from '../../features/home/elsewhere';
import { todayItems } from '../../features/home/focus';
import { readResumePointer } from '../../features/home/model';
import { readStudyMap } from '../../features/unit/model';
import { LEARN_AREAS } from '../../constants';
import type { ManifestStore } from '../../manifest-store';
import type { HomeScreenHost, LearnScreenHost } from '../screens';
import type { AppNavigator } from '../../app/navigator';
import { asLabel, asString } from '../../projection/readers';
import { heading, moduleRow, page, progress, row, toolbar } from './parts';
import { requestFocusSession } from './unit';
import { openFocusCollection } from './collection';

function resume(parent: HTMLElement, plugin: { store: ManifestStore; nav: Pick<AppNavigator, 'openUnit'> }): boolean {
  const pointer = readResumePointer(plugin.store.data?.resume_pointer);
  const unit = pointer.unit_id ? plugin.store.get(pointer.unit_id) : null;
  const projected = pointer.unit_id ? plugin.store.mapForUnit(pointer.unit_id) : null;
  const map = projected ? readStudyMap(projected) : null;
  const stage = map?.stages.find(item => item.id === pointer.stage_id);
  if (!unit || !stage || !map || !pointer.unit_id) return false;
  const unitId = pointer.unit_id;
  const card = parent.createDiv({ cls: 'focus-resume' });
  const module = plugin.store.get(asString(unit.module_id) ?? '');
  card.createDiv({ cls: 'focus-eyebrow', text: 'Continue' });
  card.createSpan({ cls: 'focus-muted', text: module ? asLabel(module) : '' });
  card.createEl('h2', { text: asLabel(unit) });
  card.createEl('p', { text: `Next: ${stage.title}` });
  const foot = card.createDiv({ cls: 'focus-resume-foot' });
  progress(foot, map.stages.filter(item => item.status === 'complete').length, map.stages.length);
  button(foot, 'Resume session', () => { requestFocusSession(unitId); return plugin.nav.openUnit(unitId, stage.id); }, 'cta');
  return true;
}
export function renderFocusLearn(view: LearnScreenHost): boolean {
  const { plugin } = view;
  if (!view.programId || !plugin.store.get(view.programId) || ['inbox', 'queue-needs-map'].includes(view.programId)) return false;
  const root = page(view.contentEl, 'learn', plugin.store);
  toolbar(root, 'Learn', 'Your study workspace');
  const body = root.createDiv({ cls: 'focus-page' });
  heading(body, 'Your learning', 'Pick up where you left off.', 'Resume a session, or choose another module.');
  const areas = body.createDiv({ cls: 'focus-area-tabs' });
  filterTabs(areas, 'Study areas', LEARN_AREAS, view.programId, id => plugin.nav.openLearn(id));
  button(areas, 'Thesis & projects', () => openFocusCollection(plugin.nav, 'projects'), 'quiet');
  if (!resume(body, plugin)) empty(body.createDiv({ cls: 'focus-resume is-empty' }), 'Choose where to begin', 'No previous study session has been recorded. Open a module below.');
  const head = body.createDiv({ cls: 'focus-section-head' });
  head.createEl('h2', { text: 'Continue elsewhere' });
  button(head, 'All modules', () => openFocusCollection(plugin.nav, 'all'), 'quiet');
  const list = body.createDiv({ cls: 'focus-module-list' });
  const modules = plugin.store.modulesFor(view.programId).filter(module => module.is_actionable === true);
  for (const module of modules) moduleRow(list, plugin.store, module, () => plugin.nav.openModule(asString(module.id) ?? ''));
  if (!modules.length) empty(list, 'No open modules in this area', 'All modules keeps the complete curriculum available.');
  return true;
}
export function renderFocusHome(view: HomeScreenHost): void {
  const { plugin } = view;
  const root = page(view.contentEl, 'home', plugin.store);
  const actions = toolbar(root, 'Home', 'Your study workspace');
  button(actions, 'Capture', () => plugin.nav.openCapture(), 'quiet');
  const body = root.createDiv({ cls: 'focus-page' });
  heading(body, 'LearningOS', 'A clear place to begin.');
  if (!resume(body, plugin)) {
    const card = body.createDiv({ cls: 'focus-resume' });
    empty(card, 'Choose where to begin', 'No previous study session has been recorded.');
    button(card, 'Open Learn', () => plugin.nav.openLearn(), 'cta');
  }
  body.createEl('h2', { text: 'Today' });
  const items = todayItems(view);
  if (!items.length) body.createEl('p', { cls: 'focus-muted', text: 'Nothing time-sensitive is recorded.' });
  for (const item of items.slice(0, 4)) {
    const target = row(body, item.title, () => item.action?.());
    const copy = target.createDiv({ cls: 'focus-row-copy' });
    copy.createEl('strong', { text: item.title });
    copy.createSpan({ cls: 'focus-muted', text: item.detail });
    target.createSpan({ cls: 'focus-row-state', text: item.actionLabel });
    target.disabled = !item.action;
  }
  body.createEl('h2', { text: 'Continue elsewhere' });
  for (const item of elsewhereRows(view).slice(0, 5)) moduleRow(body, plugin.store, item.record, item.open);
}
