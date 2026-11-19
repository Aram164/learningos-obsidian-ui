/**
 * Focus 2.0 architectural 224 px macOS Sidebar:
 * LearningOS FOCUS 2.0 lockup, Search ⌘K capsule, 6 unified destinations,
 * live In-progress unit shortcuts with done/total counts, + Quick capture,
 * and More disclosure housing Diagnostics / Boundaries / Design switch.
 */
import { icon } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import { designPalette } from '../../app/interface-design';
import { mountNavMore, primaryNavItems, renderNavItems } from '../../app/nav-shared';
import { inProgressUnits } from '../../features/home/study-work';
import type { NavScreenHost } from '../screens';
import { requestFocusSession } from './collection';
import { coverOf, moduleName, unitLabel } from './parts';

export function renderFocusNav(view: NavScreenHost): void {
  const { plugin, contentEl: root } = view;
  root.empty();
  root.addClass('los-root', 'los-app-nav', 'focus-root', 'focus-nav');

  const brand = root.createDiv({ cls: 'focus-brand' });
  brand.createEl('strong', { text: 'LearningOS' });
  brand.createSpan({ cls: 'focus-eyebrow', text: 'Focus 2.0' });

  const search = root.createEl('button', {
    cls: 'focus-nav-search is-clickable',
    attr: { type: 'button', 'aria-label': 'Search LearningOS' },
  });
  icon(search.createSpan({ attr: { 'aria-hidden': 'true' } }), 'search');
  search.createSpan({ text: 'Search' });
  search.createEl('kbd', { cls: 'focus-kbd', text: '⌘K' });
  search.addEventListener('click', () => plugin.nav.openGlobalSearch());

  const item = (parent: HTMLElement, glyph: string, label: string, key: string, go: () => unknown, count = 0) => {
    const current = plugin.activeNav === key || (key === 'modules' && plugin.activeNav === 'learn');
    const control = parent.createEl('button', {
      cls: `focus-nav-item is-clickable${current ? ' is-active' : ''}`,
      attr: {
        type: 'button',
        'aria-current': current ? 'page' : 'false',
        'aria-label': count ? `${label}, ${count} waiting` : label,
      },
    });
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
      includeLearn: false,
      icons: { modules: 'book-open', garden: 'leaf', review: 'circle-check' },
    }),
    item,
  );

  const activeUnits = plugin.store?.ready ? inProgressUnits(plugin.store) : [];
  if (activeUnits.length) {
    const work = root.createDiv({ cls: 'focus-nav-work', attr: { role: 'navigation', 'aria-label': 'In progress units' } });
    work.createDiv({ cls: 'focus-eyebrow', text: 'In progress' });
    const list = work.createDiv({ cls: 'focus-nav-primary' });
    enableButtonGroupKeyboardNavigation(list, 'vertical');
    for (const { module, unit, unitId, done, total, next } of activeUnits.slice(0, 6)) {
      const label = unitLabel(unit, module);
      const short = moduleName(module);
      const text = `${short} · ${label.number ? `L${label.number}` : label.place}`;
      const button = list.createEl('button', {
        cls: 'focus-nav-item is-clickable',
        attr: {
          type: 'button',
          'data-cover': coverOf(module),
          'aria-label': `${short} ${label.title}, ${done} of ${total} stages complete`,
        },
      });
      button.createSpan({ cls: 'focus-nav-dot', attr: { 'aria-hidden': 'true' } });
      button.createSpan({ text });
      button.createSpan({ cls: 'focus-nav-count focus-mono', text: `${done}/${total}` });
      button.addEventListener('click', () => {
        requestFocusSession(unitId);
        void plugin.nav.openUnit(unitId, next.id);
      });
    }
  }

  const footer = root.createDiv({ cls: 'focus-nav-footer' });
  item(footer, 'plus', 'Quick capture', 'capture', () => plugin.nav.openCapture());
  mountNavMore(footer, plugin, {
    detailsCls: 'focus-nav-more',
    secondaryCls: 'focus-nav-secondary',
    includeCapture: false,
    buildSummary: (more) => more.createEl('summary', { text: 'More', cls: 'focus-nav-item' }),
    draw: item,
  });
  footer.createDiv({
    cls: 'focus-nav-status',
    text: `Focus 2.0 · ${designPalette(plugin.settings) === 'nightfall' ? 'Nightfall' : 'Daylight'}`,
  });
}
