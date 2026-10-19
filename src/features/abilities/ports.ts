import type { App } from 'obsidian';
import type { AppNavigator } from '../../app/navigator';
import type { AppSurface } from '../../app/surface';
import type { AbilityLayoutV1 } from '../../contracts/route-v1';
import type { AbilityCamera } from './viewport';

/**
 * The narrow host the Ability map needs.
 *
 * Reads come from the manifest store (labels, workspaces, stage records) and
 * from the shared ability horizon (Core's `ability.context`). There is no
 * write member here at all: the map drafts, and drafts are UI-owned. The only
 * canonical writes an ability surface can cause happen in Review, after the
 * exact record is on screen.
 */
export type AbilityPlugin = Pick<
  AppSurface,
  | 'abilityHorizon'
  | 'discardAbilityDraft'
  | 'generate'
  | 'listAbilityDrafts'
  | 'openAuthoredPath'
  | 'saveAbilityDraft'
  | 'store'
> & {
  readonly nav: Pick<
    AppNavigator,
    | 'openAbilities'
    | 'openAtlas'
    | 'openModule'
    | 'openReview'
    | 'openSourceDetail'
    | 'openUnit'
  >;
};

/** What Back restores and a link reproduces. */
export interface AbilityRouteState {
  readonly group: string | null;
  readonly ability: string | null;
  readonly layout: AbilityLayoutV1;
  readonly detail: boolean;
}

export interface AbilityHost {
  readonly app: App;
  readonly plugin: AbilityPlugin;
  readonly state: AbilityRouteState;
  /** "Find an ability" text. Working state, never route state. */
  query: string;
  /** The bridge whose inspector is open. Working state. */
  bridgeKey: string | null;
  readonly attention: AbilityAttention;
  ownInteraction(cleanup: () => void): void;
  go(target: Partial<AbilityRouteState>): void;
  render(): void;
}

/** Presentation only: excluded from persisted route state and learner records. */
export interface AbilityAttention {
  camera: AbilityCamera | null;
  folded: Set<string>;
  retained: Set<string>;
  bridgesVisible: boolean;
  inspector: boolean;
  routes: boolean;
  snapshot: string | null;
  ids: Set<string>;
  fitRequest: 'all' | 'selection' | 'group' | 'reveal' | null;
  fitGroup: string | null;
  lastActivation: { id: string; at: number } | null;
}
