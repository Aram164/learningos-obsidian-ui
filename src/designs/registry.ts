import type { ManifestStore } from '../manifest-store';
import { normalizeInterfaceDesign } from '../app/interface-design';
import type { DesignScreens } from './screens';
import { studyDeskScreens } from './study-desk';

/** Classic has no entry on purpose: it is what every view draws when no design answers. */
const SCREENS: Readonly<Record<string, DesignScreens>> = {
  'study-desk': studyDeskScreens,
};

/**
 * Draw `key` with the active design, or report that the view should draw itself.
 *
 * An unavailable projection stays on the classic path, because that path is the
 * one that explains the failure and offers the rebuild. A design that throws is
 * not caught: a half-drawn screen that looks finished is worse than a visible
 * error in a tool people trust with their study state.
 */
export function drawDesignScreen<K extends keyof DesignScreens>(
  plugin: { readonly settings: { uiDesign: string }; readonly store: Pick<ManifestStore, 'ready'> },
  key: K,
  host: Parameters<NonNullable<DesignScreens[K]>>[0],
): boolean {
  if (!plugin.store.ready) return false;
  const screen = SCREENS[normalizeInterfaceDesign(plugin.settings.uiDesign)]?.[key] as
    | ((host: Parameters<NonNullable<DesignScreens[K]>>[0]) => boolean | void)
    | undefined;
  return screen ? screen(host) !== false : false;
}
