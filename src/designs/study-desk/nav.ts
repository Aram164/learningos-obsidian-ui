import { icon } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import { renderDesignSwitch } from '../../app/design-switch';
import { reviewQueueCount } from '../../features/review/queue';
import type { NavScreenHost } from '../screens';

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
  row(primary, 'home', 'Home', 'home', () => plugin.nav.openHome());
  row(primary, 'folder', 'Modules', 'modules', () => plugin.nav.openModules());
  row(primary, 'graduation-cap', 'Learn', 'learn', () => plugin.nav.openLearn());
  row(primary, 'library', 'Library', 'library', () => plugin.nav.openLibrary());
  row(primary, 'map', 'Atlas', 'abilities', () => plugin.nav.openAtlas({ concept: null, lens: 'prerequisites' }));
  row(primary, 'leaf', 'Garden', 'garden', () => plugin.nav.openGarden());
  row(primary, 'circle-check', 'Review', 'review', () => plugin.nav.openReview(), reviewQueueCount({
    items: plugin.store.reviewItems(),
    drafts: plugin.listAbilityDrafts(),
    horizon: plugin.abilityHorizon.current(),
  }));

  const more = root.createEl('details', { cls: 'sd-nav-more' });
  if (plugin.settings.navMoreOpen) more.setAttr('open', 'open');
  const summary = more.createEl('summary', { cls: 'sd-nav-item is-clickable' });
  icon(summary.createSpan({ cls: 'sd-nav-glyph' }), 'ellipsis');
  summary.createSpan({ cls: 'sd-nav-label', text: 'More' });
  more.addEventListener('toggle', () => {
    plugin.settings.navMoreOpen = more.hasAttribute('open');
    plugin.scheduleDraftSave();
  });
  const secondary = more.createDiv({ cls: 'sd-nav-secondary' });
  enableButtonGroupKeyboardNavigation(secondary, 'vertical');
  row(secondary, 'plus', 'Capture', 'capture', () => plugin.nav.openCapture());
  row(secondary, 'shield', 'Future Master’s Planning', 'masters', () => plugin.nav.openBoundary('program-masters-planning'));
  row(secondary, 'activity', 'Diagnostics', 'diagnostics', () => plugin.nav.openDiagnostics());
  row(secondary, 'refresh-cw', 'Rebuild projection', 'rebuild', () => plugin.generate());
  renderDesignSwitch(secondary, plugin);
}
