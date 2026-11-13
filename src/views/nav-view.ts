import { manifestFreshness } from '../components';
import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { icon } from '../components';
import { VIEW_NAV } from '../constants';
import type { AppSurface } from '../app/surface';
import type { AppNavigator } from '../app/navigator';
import { enableButtonGroupKeyboardNavigation } from '../accessibility/button-group';
import { mountNavMore, primaryNavItems, renderNavItems } from '../app/nav-shared';
import { drawDesignScreen } from '../designs/registry';

type NavPlugin = Pick<
  AppSurface,
  | 'abilityHorizon'
  | 'generate'
  | 'listAbilityDrafts'
  | 'scheduleDraftSave'
  | 'setDesignPalette'
  | 'setInterfaceDesign'
  | 'settings'
  | 'store'
> & {
  readonly nav: Pick<
    AppNavigator,
    | 'openAbilities'
    | 'openAtlas'
    | 'openBoundary'
    | 'openCapture'
    | 'openDiagnostics'
    | 'openGarden'
    | 'openGlobalSearch'
    | 'openHome'
    | 'openLearn'
    | 'openLibrary'
    | 'openModules'
    | 'openProjects'
    | 'openReview'
  >;
} & {
  readonly activeNav: string;
};

/**
 * Eight permanent destinations, nothing else. Areas (Bachelor's / Skills /
 * Thesis) are sub-areas of Learn; the decision queues (Shelving / Garden /
 * Inbox / ability drafts) are Review, which carries its live count; the Atlas
 * opens on Concepts (Figma concept-first workspace, 2026-10-01). Boundaries, diagnostics
 * and maintenance live under More. The sidebar's job is to make the next step
 * obvious, not to prove the system is large.
 */
export class NavView extends ItemView {
  readonly plugin: NavPlugin;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: NavPlugin,
  ) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() { return VIEW_NAV; }
  getDisplayText() { return 'LearningOS · Navigator'; }
  getIcon() { return 'route'; }
  async onOpen() { this.render(); }

  nav(
    parent: HTMLElement,
    iconName: string,
    label: string,
    key: string,
    action: (event: MouseEvent) => unknown,
    count: number | null = null,
  ): HTMLButtonElement {
    const active = this.plugin.activeNav === key;
    const row = parent.createEl('button', {
      cls: `los-app-nav-item is-clickable${active ? ' is-active' : ''}`,
      attr: { type: 'button', 'aria-current': active ? 'page' : 'false' },
    });
    icon(row.createSpan(), iconName);
    row.createSpan({ text: label });
    if (count) {
      row.createSpan({ cls: 'los-nav-count', text: String(count) });
      row.setAttr('aria-label', `${label}, ${count} waiting`);
    }
    row.addEventListener('click', action);
    return row;
  }

  render() {
    if (drawDesignScreen(this.plugin, 'nav', this)) return;
    const root = this.contentEl; root.empty();
    manifestFreshness(root, this.plugin.store); root.addClass('los-root', 'los-app-nav');
    const brand = root.createDiv({ cls: 'los-nav-brand' });
    icon(brand.createSpan({ cls: 'los-brand-mark' }), 'route');
    brand.createEl('strong', { text: 'LearningOS' });
    const search = brand.createEl('button', {
      cls: 'los-nav-search is-clickable',
      attr: { type: 'button', 'aria-label': 'Search LearningOS', title: 'Search LearningOS' },
    });
    icon(search.createSpan(), 'search');
    search.addEventListener('click', () => this.plugin.nav.openGlobalSearch());

    const draw = (
      parent: HTMLElement,
      glyph: string,
      label: string,
      key: string,
      go: () => unknown,
      count?: number,
    ) => this.nav(parent, glyph, label, key, go, count ?? null);

    const primary = root.createDiv({ cls: 'los-nav-primary' });
    enableButtonGroupKeyboardNavigation(primary, 'vertical');
    renderNavItems(primary, primaryNavItems(this.plugin), draw);

    mountNavMore(root, this.plugin, {
      detailsCls: 'los-nav-more',
      secondaryCls: 'los-nav-secondary',
      keyboardGroup: true,
      buildSummary: (more) => more.createEl('summary', { cls: 'los-nav-more-trigger', text: 'More' }),
      draw,
    });
  }
}
