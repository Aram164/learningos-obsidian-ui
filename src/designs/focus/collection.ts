/**
 * Ephemeral launch hints and module-collection state for Focus 2.0.
 * Keyed per pane or single-shot unit launch; never stored in Core or data.json.
 */
import type { AppNavigator } from '../../app/navigator';

export type FocusAreaScope = 'all' | 'program-bachelors' | 'program-skills' | 'program-job' | 'projects';
export type FocusCollection = FocusAreaScope | 'open';

export interface CollectionAttention {
  scope: FocusAreaScope;
  query: string;
  scroll: number;
  selected: string | null;
  refresh?: () => void;
}

const AREAS = new Set<FocusAreaScope>(['all', 'program-bachelors', 'program-skills', 'program-job', 'projects']);

export function normalizeCollectionScope(scope?: FocusCollection | null): FocusAreaScope {
  if (!scope || scope === 'open') return 'all';
  return AREAS.has(scope) ? scope : 'all';
}

const collections = new WeakMap<object, CollectionAttention>();

export function focusCollection(root: object): CollectionAttention {
  let state = collections.get(root);
  if (!state) {
    state = { scope: 'all', query: '', scroll: 0, selected: null };
    collections.set(root, state);
  }
  return state;
}

export async function openFocusCollection(
  nav: Pick<AppNavigator, 'openModules'>,
  scope?: FocusCollection,
): Promise<void> {
  const leaf = await nav.openModules();
  const root = leaf?.view?.contentEl;
  if (!root) return;
  const state = focusCollection(root);
  const normalized = scope ? normalizeCollectionScope(scope) : undefined;
  if (normalized && normalized !== state.scope) {
    Object.assign(state, { scope: normalized, query: '', scroll: 0, selected: null });
  }
  state.refresh?.();
}

const requestedModes = new Map<string, 'session' | 'plan'>();

/** One-shot hint so Resume links land directly in Session Cockpit while ordinary opens show Plan. */
export function requestFocusSession(unitId: string): void {
  requestedModes.set(unitId, 'session');
}

/** One-shot hint to land in Study plan explicitly. */
export function requestFocusPlan(unitId: string): void {
  requestedModes.set(unitId, 'plan');
}

export function consumeFocusUnitHint(unitId: string): 'session' | 'plan' | null {
  const mode = requestedModes.get(unitId) ?? null;
  requestedModes.delete(unitId);
  return mode;
}
