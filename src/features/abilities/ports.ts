import type { App } from 'obsidian';
import type { AppNavigator } from '../../app/navigator';
import type { AppSurface } from '../../app/surface';
import type { AbilityLayoutV1 } from '../../contracts/route-v1';

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
  go(target: Partial<AbilityRouteState>): void;
  render(): void;
}
