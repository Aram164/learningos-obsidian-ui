import { icon } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import { mountNavMore, primaryNavItems, renderNavItems } from '../../app/nav-shared';
import type { NavScreenHost } from '../screens';
import { coverOf, moduleName, unitLabel } from './parts';
import { inProgressUnits } from './study-work';
import { setUnitMode } from './unit-mode';

/**
 * The one sidebar: search, seven destinations, the Review count, and maintenance
 * under More (Figma component `Desk / Sidebar`, 16:1682).
 *
 * The row is the kit's Sidebar Item measured off the design: 32 px, radius 8,
 * 13 px medium, a 16 px glyph. The kit's SF Symbols are not redistributable, so
 * the glyphs are Obsidian's bundled Lucide set.
 */
export function renderDeskNav(view: NavScreenHost): void {
  const { plugin } = view;
  const root = view.contentEl;
  root.empty();
  root.addClass('los-root', 'los-app-nav', 'sd-nav');

  const row = (parent: HTMLElement, iconName: string, label: string, key: string, action: () => unknown, count = 0) => {
    const active = plugin.activeNav === key;
    const item = parent.createEl('button', {
      cls: `sd-nav-item is-clickable${active ? ' is-active' : ''}`,
      attr: { type: 'button', 'aria-current': active ? 'page' : 'false' },
    });
    icon(item.createSpan({ cls: 'sd-nav-glyph' }), iconName);
    item.createSpan({ cls: 'sd-nav-label', text: label });
    if (count) {
      item.createSpan({ cls: 'sd-nav-count', text: String(count) });
      item.setAttr('aria-label', `${label}, ${count} waiting`);
    }
    item.addEventListener('click', () => action());
  };

  const search = root.createEl('button', {
    cls: 'sd-nav-search is-clickable',
    attr: { type: 'button', 'aria-label': 'Search LearningOS' },
  });
  icon(search.createSpan({ cls: 'sd-nav-search-glyph' }), 'search');
  search.createSpan({ text: 'Search LearningOS' });
  search.addEventListener('click', () => plugin.nav.openGlobalSearch());

  const primary = root.createDiv({ cls: 'sd-nav-primary' });
  enableButtonGroupKeyboardNavigation(primary, 'vertical');
  renderNavItems(
    primary,
    primaryNavItems(plugin, { icons: { modules: 'folder', garden: 'leaf', review: 'circle-check' } }).filter((item) => item.key !== 'learn'),
    row,
  );

  const work = inProgressUnits(plugin.store);
  if (work.length) {
    const list = root.createDiv({ cls: 'sd-nav-work' });
    list.createDiv({ cls: 'sd-eyebrow', text: 'In progress' });
    const shortcuts = list.createDiv({ cls: 'sd-nav-primary' });
    enableButtonGroupKeyboardNavigation(shortcuts, 'vertical');
    for (const { module, unit, unitId, done, total, next } of work) {
      const item = shortcuts.createEl('button', { cls: 'sd-nav-item sd-nav-shortcut', attr: { type: 'button', 'data-cover': coverOf(module) } });
      const title = `${moduleName(module)} · ${unitLabel(unit, module).title}`;
      item.createSpan({ cls: 'sd-nav-label', text: title, attr: { title } });
      item.createSpan({ cls: 'sd-nav-count', text: `${done}/${total}` });
      item.addEventListener('click', () => {
        void plugin.nav.openUnit(unitId, next?.id, (leaf) => setUnitMode(leaf, unitId, next ? 'session' : 'plan'));
      });
    }
  }

  const foot = root.createDiv({ cls: 'sd-nav-foot' });
  row(foot, 'plus', 'Capture', 'capture', () => plugin.nav.openCapture());

  mountNavMore(foot, plugin, {
    detailsCls: 'sd-nav-more',
    secondaryCls: 'sd-nav-secondary',
    keyboardGroup: true,
    includeCapture: false,
    buildSummary: (more) => {
      const summary = more.createEl('summary', { cls: 'sd-nav-item is-clickable' });
      icon(summary.createSpan({ cls: 'sd-nav-glyph' }), 'ellipsis');
      summary.createSpan({ cls: 'sd-nav-label', text: 'More' });
    },
    draw: row,
  });
}
