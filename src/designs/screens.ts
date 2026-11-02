/**
 * The screens an interface design may replace.
 *
 * Every member is optional. A design supplies only what it redraws; anything it
 * leaves out, and any screen that returns `false`, falls through to the existing
 * feature renderer, which the design then restyles from its own stylesheet. That
 * is what keeps every capability reachable while a design is only part-built.
 *
 * A screen receives the view it draws into, so it reaches the same store,
 * navigator and gateway as the classic renderer. It adds no write path.
 */
import type { AtlasHost } from '../features/atlas/ports';
import type { HomeElsewhereHost } from '../features/home/ports';
import type { ModuleDetailHost, ModuleNavigationHost } from '../features/module/ports';
import type { UnitShellHost, UnitStageHost } from '../features/unit/ports';
import type { AppNavigator } from '../app/navigator';
import type { AppSurface } from '../app/surface';

export interface DesignView {
  readonly contentEl: HTMLElement;
}

export type NavScreenPlugin = Pick<
  AppSurface,
  'abilityHorizon' | 'generate' | 'listAbilityDrafts' | 'scheduleDraftSave' | 'store' | 'settings' | 'setInterfaceDesign' | 'setDesignPalette'
> & {
  readonly activeNav: string;
  readonly nav: Pick<
    AppNavigator,
    | 'openAtlas' | 'openBoundary' | 'openCapture' | 'openDiagnostics' | 'openGarden' | 'openGlobalSearch'
    | 'openHome' | 'openLearn' | 'openLibrary' | 'openModules' | 'openReview'
  >;
};

export interface NavScreenHost extends DesignView {
  readonly plugin: NavScreenPlugin;
}

export type HomeScreenHost = DesignView & HomeElsewhereHost;

export interface LearnScreenHost extends DesignView {
  readonly plugin: Pick<AppSurface, 'store'> & {
    readonly nav: Pick<AppNavigator, 'openLearn' | 'openModule' | 'openModules' | 'openUnit'>;
  };
  readonly programId: string | null;
}

export type ModuleListScreenHost = DesignView & ModuleNavigationHost;
export type ModuleDetailScreenHost = DesignView & ModuleDetailHost;
export type UnitScreenHost = DesignView & UnitShellHost & UnitStageHost;
export type AtlasScreenHost = DesignView & AtlasHost;

/** `false` means "draw the classic screen for this state"; anything else means handled. */
type Screen<Host> = (host: Host) => boolean | void;

export interface DesignScreens {
  readonly nav?: Screen<NavScreenHost>;
  readonly home?: Screen<HomeScreenHost>;
  readonly learn?: Screen<LearnScreenHost>;
  readonly moduleList?: Screen<ModuleListScreenHost>;
  readonly moduleDetail?: Screen<ModuleDetailScreenHost>;
  readonly unit?: Screen<UnitScreenHost>;
  readonly atlas?: Screen<AtlasScreenHost>;
}
