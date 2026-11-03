import type { AppNavigator } from '../../app/navigator';

export type FocusCollection = 'open' | 'all' | 'projects';
export interface CollectionAttention {
  scope: FocusCollection;
  query: string;
  scroll: number;
  selected: string | null;
  refresh?: () => void;
}

// Presentation attention belongs to the receiving leaf, never a global project
// selection or an extra application route.
const collections = new WeakMap<object, CollectionAttention>();
export function focusCollection(root: object): CollectionAttention {
  let state = collections.get(root);
  if (!state) {
    state = { scope: 'open', query: '', scroll: 0, selected: null };
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
  if (scope && scope !== state.scope) {
    Object.assign(state, { scope, query: '', scroll: 0, selected: null });
  }
  state.refresh?.();
}
