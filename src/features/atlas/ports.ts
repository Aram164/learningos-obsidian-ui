import type { AppNavigator } from '../../app/navigator';
import type { AppSurface } from '../../app/surface';
import type { AtlasDepthV1, AtlasLensV1 } from '../../contracts/route-v1';

/**
 * The narrow host the Atlas feature needs.
 *
 * The store members are the read boundary; `nav` is the five destinations a
 * concept can lead to.
 *
 * Until ADR-017 nothing here could write at all — ADR-016 decision 9 made the
 * first release read-only, and a feature that cannot reach the gateway cannot
 * grow an authoring affordance by accident. ADR-017 amends that decision, so
 * the gateway is reachable now. What replaces the old blanket ban is a named
 * surface: `AtlasHost` below exposes one method per authored change, never a
 * general `mutate`. A view can only do the things this file lists, and adding
 * a new one is a visible edit to a contract rather than a call site nobody
 * reviews.
 */
export type AtlasPlugin = Pick<
  AppSurface,
  | 'gateway'
  | 'generate'
  | 'mutate'
  | 'openVaultPath'
  | 'settings'
  | 'store'
> & {
  readonly nav: Pick<
    AppNavigator,
    | 'openAtlas'
    | 'openModule'
    | 'openRecord'
    | 'openSourceDetail'
    | 'openUnit'
  >;
};

/**
 * A relation exactly as Core stores it: optional keys absent, never explicit
 * nulls. The projection turns an absent `context` or `source` into null, so a
 * row rebuilt for an edit has to drop what the projection added.
 */
export interface RelationRow {
  readonly from: string;
  readonly type: string;
  readonly to: string;
  readonly context?: string;
  readonly source?: string;
}

/** The only three things that may happen to the relation registry. */
export type RelationOperation =
  | { readonly action: 'add'; readonly new: RelationRow }
  | { readonly action: 'replace'; readonly old: RelationRow; readonly new: RelationRow }
  | { readonly action: 'remove'; readonly old: RelationRow };

/** The connection being authored. Working state, never route state. */
export interface RelationDraft {
  readonly mode: 'add' | 'edit';
  from: string;
  type: string;
  to: string;
  context: string;
  source: string;
  /** The exact stored row an edit replaces. Core matches it byte for byte. */
  readonly original: RelationRow | null;
  /** Endpoint being chosen, when the picker is open. */
  picking: 'from' | 'to' | null;
  search: string;
  error: string | null;
}

/** The four route fields, resolved. */
export interface AtlasRouteState {
  readonly concept: string | null;
  readonly module: string | null;
  readonly lens: AtlasLensV1;
  readonly depth: AtlasDepthV1;
}

/**
 * The inspector's tab.
 *
 * View-owned rather than route state, and deliberately so: changing a lens is
 * a change of question and pushes history, while changing a tab is a change of
 * attention within one answer and must not (Figma 88:3).
 */
export type AtlasInspectorTab =
  | 'summary'
  | 'connections'
  | 'evidence'
  | 'sources';

export interface AtlasHost {
  readonly plugin: AtlasPlugin;
  readonly state: AtlasRouteState;
  /** Search text. Working state, never route state. */
  query: string;
  tab: AtlasInspectorTab;
  /** Whether the inspector's semantic group is expanded. */
  semanticOpen: boolean;
  /** Whether the depth remainder has been expanded into a named list. */
  remainderOpen: boolean;
  edgeId: string | null;
  inspectEdge(id: string): void;
  addRenderCleanup(cleanup: () => void): void;
  /** Navigate, merging the given fields over the current route. */
  go(target: Partial<AtlasRouteState>): void;
  /** Redraw without navigating — for working state only. */
  render(): void;

  /**
   * Change the state of a question the learner already recorded (ADR-017).
   *
   * Resolving is an explicit act by Aram about his own question. It says he is
   * done asking, and nothing else: not that the concept is understood, not that
   * a stage is complete, not that the graph changed. The note's target and
   * wording are Core's to preserve, and this cannot carry either.
   */
  setQuestionState(noteId: string, state: 'open' | 'resolved'): Promise<void>;

  /**
   * The open connection editor, or null. Working state, never route state: a
   * half-typed connection is not a place Back should return to.
   */
  editor: RelationDraft | null;

  /**
   * Apply exactly the authored operations, and nothing inferred from them
   * (ADR-017 decision 1). A replace or remove binds the exact previous row, so
   * a stale screen is refused rather than allowed to overwrite a change made
   * somewhere else.
   */
  changeRelations(operations: readonly RelationOperation[]): Promise<void>;
}
