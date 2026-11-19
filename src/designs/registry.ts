import type { ManifestStore } from '../manifest-store';
import { BASE_VIEWS_DESIGN_ID, normalizeInterfaceDesign } from '../app/interface-design';
import type { DesignScreens } from './screens';
import { studyDeskScreens } from './study-desk';
import { focusScreens } from './focus';

const SCREENS: Readonly<Record<string, DesignScreens>> = {
  'study-desk': studyDeskScreens,
  focus: focusScreens,
};

/**
 * Draw `key` with the active design, or report that the base view should draw itself.
 *
 * An unavailable projection stays on the shared base path, because that path is the
 * one that explains the failure and offers the rebuild. A design that throws is
 * not caught: a half-drawn screen that looks finished is worse than a visible
 * error in a tool people trust with their study state.
 */
export function drawDesignScreen<K extends keyof DesignScreens>(
  plugin: { readonly settings: { uiDesign: string }; readonly store: Pick<ManifestStore, 'ready'> },
  key: K,
  host: Parameters<NonNullable<DesignScreens[K]>>[0],
): boolean {
  if (!plugin.store.ready || plugin.settings.uiDesign === BASE_VIEWS_DESIGN_ID) return false;
  const screen = SCREENS[normalizeInterfaceDesign(plugin.settings.uiDesign)]?.[key] as
    | ((host: Parameters<NonNullable<DesignScreens[K]>>[0]) => boolean | void)
    | undefined;
  return screen ? screen(host) !== false : false;
}
