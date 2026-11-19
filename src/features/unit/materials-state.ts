/**
 * Ephemeral pane-local materials and stage disclosure state.
 * Keyed by leaf/view in a WeakMap so separate panes stay independent.
 */
import { NO_FILTER, type MaterialFilter, type PurposeKey } from './material-purpose';

export interface MaterialsState {
  filter: MaterialFilter;
  /** Row keys whose details are open. */
  readonly open: Set<string>;
  /** A purpose's explicit fold, when the learner chose one. */
  readonly folded: Map<PurposeKey, boolean>;
  /** Groups the learner asked to see whole while a search or filter is on. */
  readonly whole: Set<PurposeKey>;
  /** Rows opened inside one stage's list, by stage id. */
  readonly stageOpen: Map<string, Set<string>>;
  /** The "If you get stuck" purpose each stage last showed. */
  readonly stuck: Map<string, PurposeKey>;
  /** Folded lines the learner opened so a redraw keeps them open. */
  readonly folds: Set<string>;
}

const statesByHost = new WeakMap<object, Map<string, MaterialsState>>();

export function materialsState(host: object, unitId: string): MaterialsState {
  let states = statesByHost.get(host);
  if (!states) {
    states = new Map<string, MaterialsState>();
    statesByHost.set(host, states);
  }
  let state = states.get(unitId);
  if (!state) {
    state = { filter: NO_FILTER, open: new Set(), folded: new Map(), whole: new Set(), stageOpen: new Map(), stuck: new Map(), folds: new Set() };
    states.set(unitId, state);
  }
  return state;
}

/** A changed filter opens the groups it matches and folds the rest. */
export function setFilter(state: MaterialsState, filter: MaterialFilter): void {
  state.filter = filter;
  state.whole.clear();
  state.folded.clear();
}

/** The open rows of one stage's list. */
export function openInStage(state: MaterialsState, stageId: string): Set<string> {
  let open = state.stageOpen.get(stageId);
  if (!open) {
    open = new Set();
    state.stageOpen.set(stageId, open);
  }
  return open;
}

/** Keep a native `<details>` fold open across redraws. */
export function keepFold(fold: HTMLDetailsElement, state: MaterialsState, key: string, openNow = false): void {
  fold.open = openNow || state.folds.has(key);
  if (fold.open) fold.setAttr('open', '');
  fold.addEventListener('toggle', () => {
    if (fold.open) state.folds.add(key);
    else state.folds.delete(key);
  });
}
