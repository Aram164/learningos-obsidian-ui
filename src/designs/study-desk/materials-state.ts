/**
 * What the learner is looking at in a lecture's materials: the filter, which
 * rows are open and which groups are folded.
 *
 * Attention, not a route (decision I10; docs/interface-designs.md): it belongs
 * to the view that drew it, keyed by the view host in a WeakMap, so two open
 * panes never share it and it is collected with the leaf. Nothing here is
 * written to Core or to the URL.
 */
import { NO_FILTER, type MaterialFilter, type PurposeKey } from '../../features/unit/material-purpose';

export interface MaterialsState {
  filter: MaterialFilter;
  /** Row keys whose details are open. */
  readonly open: Set<string>;
  /** A purpose's explicit fold, when the learner chose one; otherwise the volume rule decides. */
  readonly folded: Map<PurposeKey, boolean>;
  /** Groups the learner asked to see whole while a search or filter is on. */
  readonly whole: Set<PurposeKey>;
  /**
   * Rows opened inside one stage's list, by stage id. One material can sit in
   * several stages; opening it under one stage must not open it under all.
   */
  readonly stageOpen: Map<string, Set<string>>;
  /** The "If you get stuck" purpose each stage last showed (Figma D1's tabs). */
  readonly stuck: Map<string, PurposeKey>;
  /** Folded lines the learner opened (a stage's list, its kept-for-reference line), so a redraw keeps them open. */
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

/**
 * A changed filter starts from the volume rule again: a filter opens the groups
 * it matches and folds the rest, so nothing stays open, or shut, by accident.
 */
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

/**
 * Keep a native fold open across redraws: opening a row redraws the view, and
 * a fold that forgot it was open would hide the row the learner just opened.
 */
export function keepFold(fold: HTMLDetailsElement, state: MaterialsState, key: string, openNow = false): void {
  fold.open = openNow || state.folds.has(key);
  if (fold.open) fold.setAttr('open', '');
  fold.addEventListener('toggle', () => {
    if (fold.open) state.folds.add(key);
    else state.folds.delete(key);
  });
}
