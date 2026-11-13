import { enableButtonGroupKeyboardNavigation } from '../accessibility/button-group';
import { reviewQueueCount } from '../features/review/queue';
import { renderDesignSwitch } from './design-switch';
import type { InterfaceDesignSettings } from './interface-design';
import type { AppNavigator } from './navigator';
import type { AppSurface } from './surface';

export interface NavItem {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly badge?: number;
  readonly go: () => unknown;
}

export type NavSharedPlugin = Pick<
  AppSurface,
  | 'abilityHorizon'
  | 'generate'
  | 'listAbilityDrafts'
  | 'scheduleDraftSave'
  | 'setDesignPalette'
  | 'setInterfaceDesign'
  | 'store'
> & {
  readonly settings: InterfaceDesignSettings & { navMoreOpen: boolean };
  readonly nav: Pick<
    AppNavigator,
    | 'openAtlas'
    | 'openBoundary'
    | 'openCapture'
    | 'openDiagnostics'
    | 'openGarden'
    | 'openHome'
    | 'openLearn'
    | 'openLibrary'
    | 'openModules'
    | 'openReview'
  >;
};

export type NavRenderer = (
  parent: HTMLElement,
  iconName: string,
  label: string,
  key: string,
  go: () => unknown,
  badge?: number,
) => unknown;

/** Live waiting count shared by every sidebar's Review destination. */
export function reviewWaitingCount(plugin: NavSharedPlugin): number {
  if (!plugin.store?.ready) return 0;
  return reviewQueueCount({
    items: plugin.store.reviewItems(),
    drafts: plugin.listAbilityDrafts(),
    horizon: plugin.abilityHorizon.current(),
  });
}

/** Primary LearningOS sidebar destinations with per-design icon/order options. */
export function primaryNavItems(
  plugin: NavSharedPlugin,
  options: {
    readonly icons?: Partial<Record<'modules' | 'garden' | 'review', string>>;
    readonly learnFirst?: boolean;
    readonly openModules?: () => unknown;
  } = {},
): NavItem[] {
  const icons = options.icons ?? {};
  const modules: NavItem = {
    key: 'modules',
    label: 'Modules',
    icon: icons.modules ?? 'layout-grid',
    go: options.openModules ?? (() => plugin.nav.openModules()),
  };
  const learn: NavItem = {
    key: 'learn',
    label: 'Learn',
    icon: 'graduation-cap',
    go: () => plugin.nav.openLearn(),
  };
  return [
    { key: 'home', label: 'Home', icon: 'home', go: () => plugin.nav.openHome() },
    ...(options.learnFirst ? [learn, modules] : [modules, learn]),
    { key: 'library', label: 'Library', icon: 'library', go: () => plugin.nav.openLibrary() },
    {
      key: 'abilities',
      label: 'Atlas',
      icon: 'map',
      go: () => plugin.nav.openAtlas({ concept: null, lens: 'prerequisites' }),
    },
    { key: 'garden', label: 'Garden', icon: icons.garden ?? 'sprout', go: () => plugin.nav.openGarden() },
    {
      key: 'review',
      label: 'Review',
      icon: icons.review ?? 'check-check',
      badge: reviewWaitingCount(plugin),
      go: () => plugin.nav.openReview(),
    },
  ];
}

export function secondaryNavItems(plugin: NavSharedPlugin, includeCapture = true): NavItem[] {
  const capture: NavItem = { key: 'capture', label: 'Capture', icon: 'plus', go: () => plugin.nav.openCapture() };
  const rest: NavItem[] = [
    {
      key: 'masters',
      label: 'Future Master’s Planning',
      icon: 'shield',
      go: () => plugin.nav.openBoundary('program-masters-planning'),
    },
    { key: 'diagnostics', label: 'Diagnostics', icon: 'activity', go: () => plugin.nav.openDiagnostics() },
    { key: 'rebuild', label: 'Rebuild projection', icon: 'refresh-cw', go: () => plugin.generate() },
  ];
  return includeCapture ? [capture, ...rest] : rest;
}

export function renderNavItems(parent: HTMLElement, items: readonly NavItem[], draw: NavRenderer): void {
  for (const entry of items) {
    draw(parent, entry.icon, entry.label, entry.key, entry.go, entry.badge);
  }
}

/** Shared More disclosure: persists open state, renders secondary destinations and theme controls. */
export function mountNavMore(
  parent: HTMLElement,
  plugin: NavSharedPlugin,
  options: {
    readonly detailsCls: string;
    readonly secondaryCls: string;
    readonly includeCapture?: boolean;
    readonly keyboardGroup?: boolean;
    readonly buildSummary: (details: HTMLElement) => void;
    readonly draw: NavRenderer;
  },
): HTMLElement {
  const more = parent.createEl('details', { cls: options.detailsCls });
  if (plugin.settings.navMoreOpen) more.setAttr('open', 'open');
  options.buildSummary(more);
  more.addEventListener('toggle', () => {
    plugin.settings.navMoreOpen = more.hasAttribute('open');
    plugin.scheduleDraftSave();
  });
  const secondary = more.createDiv({ cls: options.secondaryCls });
  if (options.keyboardGroup) enableButtonGroupKeyboardNavigation(secondary, 'vertical');
  renderNavItems(secondary, secondaryNavItems(plugin, options.includeCapture ?? true), options.draw);
  renderDesignSwitch(secondary, plugin);
  return secondary;
}
