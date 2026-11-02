import { icon } from '../../components';
import { renderDesignSwitch } from '../../app/design-switch';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import { reviewQueueCount } from '../../features/review/queue';
import type { NavScreenHost } from '../screens';

export function renderFocusNav(view: NavScreenHost): void {
  const { plugin, contentEl: root } = view;
  root.empty();
  root.addClass('los-root', 'los-app-nav', 'focus-root', 'focus-nav');
  const brand = root.createDiv({ cls: 'focus-brand' });
  icon(brand.createSpan({ attr: { 'aria-hidden': 'true' } }), 'network');
  brand.createEl('strong', { text: 'LearningOS' });
  const search = root.createEl('button', { cls: 'focus-nav-search is-clickable', attr: { type: 'button', 'aria-label': 'Search LearningOS' } });
  icon(search.createSpan({ attr: { 'aria-hidden': 'true' } }), 'search');
  search.createSpan({ text: 'Search' });
  search.addEventListener('click', () => plugin.nav.openGlobalSearch());
  const item = (parent: HTMLElement, glyph: string, label: string, key: string, go: () => unknown, count = 0) => {
    const current = plugin.activeNav === key;
    const control = parent.createEl('button', { cls: `focus-nav-item is-clickable${current ? ' is-active' : ''}`, attr: { type: 'button', 'aria-current': current ? 'page' : 'false', 'aria-label': count ? `${label}, ${count} waiting` : label } });
    icon(control.createSpan({ cls: 'focus-nav-icon', attr: { 'aria-hidden': 'true' } }), glyph);
    control.createSpan({ text: label });
    if (count) control.createSpan({ cls: 'focus-nav-count', text: String(count) });
    control.addEventListener('click', () => go());
  };
  const primary = root.createDiv({ cls: 'focus-nav-primary' });
  enableButtonGroupKeyboardNavigation(primary, 'vertical');
  item(primary, 'home', 'Home', 'home', () => plugin.nav.openHome());
  item(primary, 'layout-grid', 'Modules', 'modules', () => plugin.nav.openModules());
  item(primary, 'graduation-cap', 'Learn', 'learn', () => plugin.nav.openLearn());
  item(primary, 'library', 'Library', 'library', () => plugin.nav.openLibrary());
  item(primary, 'map', 'Atlas', 'abilities', () => plugin.nav.openAtlas({ concept: null, lens: 'prerequisites' }));
  item(primary, 'leaf', 'Garden', 'garden', () => plugin.nav.openGarden());
  item(primary, 'circle-check', 'Review', 'review', () => plugin.nav.openReview(), reviewQueueCount({ items: plugin.store.reviewItems(), drafts: plugin.listAbilityDrafts(), horizon: plugin.abilityHorizon.current() }));
  const areas = root.createDiv({ cls: 'focus-nav-areas' });
  areas.createDiv({ cls: 'focus-eyebrow', text: 'Study areas' });
  for (const [id, label] of [['program-bachelors', 'Bachelor’s'], ['program-skills', 'Skills'], ['program-job', 'Job']] as const) {
    item(areas, 'chevron-right', label, id, () => plugin.nav.openLearn(id));
  }
  item(areas, 'chevron-right', 'Thesis & projects', 'projects', () => plugin.nav.openModules());
  const more = root.createEl('details', { cls: 'focus-nav-more' });
  if (plugin.settings.navMoreOpen) more.setAttr('open', 'open');
  more.createEl('summary', { text: 'More', cls: 'focus-nav-item' });
  more.addEventListener('toggle', () => { plugin.settings.navMoreOpen = more.hasAttribute('open'); plugin.scheduleDraftSave(); });
  const secondary = more.createDiv({ cls: 'focus-nav-secondary' });
  item(secondary, 'plus', 'Capture', 'capture', () => plugin.nav.openCapture());
  item(secondary, 'shield', 'Future Master’s Planning', 'masters', () => plugin.nav.openBoundary('program-masters-planning'));
  item(secondary, 'activity', 'Diagnostics', 'diagnostics', () => plugin.nav.openDiagnostics());
  item(secondary, 'refresh-cw', 'Rebuild projection', 'rebuild', () => plugin.generate());
  renderDesignSwitch(secondary, plugin);
}
