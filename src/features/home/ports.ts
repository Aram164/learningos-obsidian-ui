import type { ProjectionRecord } from '../../contracts/manifest';
import type {
  HomeItem,
  HomePlugin,
} from './model';

/** Host capabilities used by the focused Home sections. */
export interface HomeFocusHost {
  readonly plugin: HomePlugin;
  renderHomeRow(
    parent: HTMLElement,
    item: HomeItem,
  ): HTMLElement;
}

/** Host capabilities used by the secondary-work Home section. */
export interface HomeElsewhereHost
  extends HomeFocusHost {
  moduleNextAction(
    module: ProjectionRecord,
  ): string;
  nextWorkspaceDate(
    workspace: ProjectionRecord,
  ): string;
}
