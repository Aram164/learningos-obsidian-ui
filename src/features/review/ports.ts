import type { App } from 'obsidian';
import type { AppNavigator } from '../../app/navigator';
import type { AppSurface } from '../../app/surface';

/**
 * What Review needs from the host: the projection, the shared ability
 * horizon, the ability drafts, and exactly one write path — `mutate` around a
 * named gateway porcelain call, sent only from an item whose exact record is
 * on screen.
 */
export type ReviewPlugin = Pick<
  AppSurface,
  | 'abilityHorizon'
  | 'discardAbilityDraft'
  | 'gateway'
  | 'generate'
  | 'listAbilityDrafts'
  | 'mutate'
  | 'openAuthoredPath'
  | 'openVaultPath'
  | 'saveAbilityDraft'
  | 'store'
> & {
  readonly nav: Pick<
    AppNavigator,
    | 'openAbilities'
    | 'openGarden'
    | 'openReview'
    | 'openShelving'
    | 'openUnit'
  >;
};

export interface ReviewHost {
  readonly app: App;
  readonly plugin: ReviewPlugin;
  /** The selected entry's key; working state mirrored into the route. */
  readonly selected: string | null;
  select(key: string | null): void;
  render(): void;
  /** True while this view's own confirmation is being sent. */
  sending: boolean;
}
