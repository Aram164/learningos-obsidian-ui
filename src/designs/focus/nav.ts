import { icon } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import { mountNavMore, primaryNavItems, renderNavItems } from '../../app/nav-shared';
import type { NavScreenHost } from '../screens';
import { designPalette } from '../../app/interface-design';
import { openFocusCollection } from './collection';

export function renderFocusNav(view: NavScreenHost): void {
  const { plugin, contentEl: root } = view;
  root.empty();
  root.addClass('los-root', 'los-app-nav', 'focus-root', 'focus-nav');
  const brand = root.createDiv({ cls: 'focus-brand' });
  brand.createEl('strong', { text: 'LearningOS' });
  brand.createDiv({ cls: 'focus-eyebrow', text: 'Focus' });
  const search = root.createEl('button', { cls: 'focus-nav-search is-clickable', attr: { type: 'button', 'aria-label': 'Search LearningOS' } });
  icon(search.createSpan({ attr: { 'aria-hidden': 'true' } }), 'search');
  search.createSpan({ text: 'Search LearningOS' });
  search.addEventListener('click', () => plugin.nav.openGlobalSearch());
  const item = (parent: HTMLElement, glyph: string, label: string, key: string, go: () => unknown, count = 0) => {
    const current = plugin.activeNav === key || (plugin.activeNav === 'learn' && key === plugin.settings.learnArea);
    const control = parent.createEl('button', { cls: `focus-nav-item is-clickable${current ? ' is-active' : ''}`, attr: { type: 'button', 'aria-current': current ? 'page' : 'false', 'aria-label': count ? `${label}, ${count} waiting` : label } });
    icon(control.createSpan({ cls: 'focus-nav-icon', attr: { 'aria-hidden': 'true' } }), glyph);
    control.createSpan({ text: label });
    if (count) control.createSpan({ cls: 'focus-nav-count', text: String(count) });
    control.addEventListener('click', () => go());
  };
  const primary = root.createDiv({ cls: 'focus-nav-primary', attr: { role: 'navigation', 'aria-label': 'Main destinations' } });
  enableButtonGroupKeyboardNavigation(primary, 'vertical');
  renderNavItems(
    primary,
    primaryNavItems(plugin, {
      icons: { garden: 'leaf', review: 'circle-check' },
      learnFirst: true,
      openModules: () => openFocusCollection(plugin.nav, 'open'),
    }),
    item,
  );
  const areas = root.createDiv({ cls: 'focus-nav-areas', attr: { role: 'navigation', 'aria-label': 'Study areas' } });
  areas.createDiv({ cls: 'focus-eyebrow', text: 'Study areas' });
  for (const [id, label] of [['program-bachelors', 'Bachelor’s'], ['program-skills', 'Skills'], ['program-job', 'Job']] as const) {
    item(areas, 'chevron-right', label, id, () => plugin.nav.openLearn(id));
  }
  item(areas, 'chevron-right', 'Thesis & projects', 'projects', () => openFocusCollection(plugin.nav, 'projects'));
  const footer = root.createDiv({ cls: 'focus-nav-footer' });
  item(footer, 'plus', 'Capture', 'capture', () => plugin.nav.openCapture());
  mountNavMore(footer, plugin, {
    detailsCls: 'focus-nav-more',
    secondaryCls: 'focus-nav-secondary',
    includeCapture: false,
    buildSummary: (more) => more.createEl('summary', { text: 'More', cls: 'focus-nav-item' }),
    draw: item,
  });
  footer.createDiv({ cls: 'focus-nav-status', text: `Focus · ${designPalette(plugin.settings) === 'nightfall' ? 'Dark' : 'Light'}` });
}
