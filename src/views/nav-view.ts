import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { icon } from '../components';
import { VIEW_NAV } from '../constants';
import type { AppSurface } from '../app/surface';
import type { AppNavigator } from '../app/navigator';
import { enableButtonGroupKeyboardNavigation } from '../accessibility/button-group';
import { reviewQueueCount } from '../features/review/queue';

interface NavSettings {
  navMoreOpen: boolean;
}

type NavPlugin = Pick<
  AppSurface,
  | 'abilityHorizon'
  | 'generate'
  | 'listAbilityDrafts'
  | 'scheduleDraftSave'
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
  readonly settings: NavSettings;
};

/**
 * Eight permanent destinations, nothing else. Areas (Bachelor's / Skills /
 * Thesis) are sub-areas of Learn; the decision queues (Shelving / Garden /
 * Inbox / ability drafts) are Review, which carries its live count; the Atlas
 * opens on the ability map (Figma v4, 2026-09-23). Boundaries, diagnostics
 * and maintenance live under More. The sidebar's job is to make the next step
 * obvious, not to prove the system is large.
 */
export class NavView extends ItemView {
  private readonly plugin: NavPlugin;

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

  /** Review's live count: the same queue Review lists, never a second tally. */
  private reviewCount(): number {
    if (!this.plugin.store?.ready) return 0;
    return reviewQueueCount({
      items: this.plugin.store.reviewItems(),
      drafts: this.plugin.listAbilityDrafts(),
      horizon: this.plugin.abilityHorizon.current(),
    });
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-app-nav');
    const brand = root.createDiv({ cls: 'los-nav-brand' });
    icon(brand.createSpan({ cls: 'los-brand-mark' }), 'route');
    brand.createEl('strong', { text: 'LearningOS' });
    const search = brand.createEl('button', {
      cls: 'los-nav-search is-clickable',
      attr: { type: 'button', 'aria-label': 'Search LearningOS', title: 'Search LearningOS' },
    });
    icon(search.createSpan(), 'search');
    search.addEventListener('click', () => this.plugin.nav.openGlobalSearch());

    const primary = root.createDiv({ cls: 'los-nav-primary' });
    enableButtonGroupKeyboardNavigation(primary, 'vertical');
    this.nav(primary, 'home', 'Home', 'home', () => this.plugin.nav.openHome());
    this.nav(primary, 'layout-grid', 'Modules', 'modules', () => this.plugin.nav.openModules());
    this.nav(primary, 'graduation-cap', 'Learn', 'learn', () => this.plugin.nav.openLearn());
    this.nav(primary, 'briefcase-business', 'Projects', 'projects', () => this.plugin.nav.openProjects());
    this.nav(primary, 'library', 'Library', 'library', () => this.plugin.nav.openLibrary());
    this.nav(primary, 'map', 'Atlas', 'abilities', () => this.plugin.nav.openAbilities());
    this.nav(primary, 'sprout', 'Garden', 'garden', () => this.plugin.nav.openGarden());
    this.nav(primary, 'check-check', 'Review', 'review', () => this.plugin.nav.openReview(),
      this.reviewCount());

    const more = root.createEl('details', { cls: 'los-nav-more' });
    if (this.plugin.settings.navMoreOpen) more.setAttr('open', 'open');
    more.createEl('summary', { cls: 'los-nav-more-trigger', text: 'More' });
    more.addEventListener('toggle', () => {
      this.plugin.settings.navMoreOpen = more.hasAttribute('open');
      this.plugin.scheduleDraftSave();
    });
    const secondary = more.createDiv({ cls: 'los-nav-secondary' });
    enableButtonGroupKeyboardNavigation(secondary, 'vertical');
    this.nav(secondary, 'plus', 'Capture', 'capture', () => this.plugin.nav.openCapture());
    this.nav(secondary, 'network', 'Concept atlas', 'atlas', () => this.plugin.nav.openAtlas());
    this.nav(secondary, 'shield', 'Future Master’s Planning', 'masters',
      () => this.plugin.nav.openBoundary('program-masters-planning'));
    this.nav(secondary, 'activity', 'Diagnostics', 'diagnostics', () => this.plugin.nav.openDiagnostics());
    this.nav(secondary, 'refresh-cw', 'Rebuild projection', 'rebuild', () => this.plugin.generate());
  }
}
