import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { VIEW_ABILITIES } from '../constants';
import { asAbilityLayout } from '../contracts/route-v1';
import { renderAbilityMap } from '../features/abilities/plane';
import type {
  AbilityHost,
  AbilityPlugin,
  AbilityRouteState,
} from '../features/abilities/ports';

interface AbilityViewState {
  group?: string | null;
  ability?: string | null;
  layout?: unknown;
  detail?: unknown;
}

/**
 * The Ability map leaf: the primary Atlas destination.
 *
 * It owns the route state Obsidian persists — group, selected ability, layout
 * and whether the full detail is open — and the working state that must not
 * enter a route: the search text and the open bridge. Rendering belongs to
 * `features/abilities`.
 */
export class AbilitiesView extends ItemView implements AbilityHost {
  readonly plugin: AbilityPlugin;
  private route: AbilityRouteState = { group: null, ability: null, layout: 'plane', detail: false };
  query = '';
  bridgeKey: string | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: AbilityPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_ABILITIES; }
  getDisplayText() { return 'LearningOS · Atlas'; }
  getIcon() { return 'map'; }

  get state(): AbilityRouteState { return this.route; }

  private adopt(state: AbilityViewState): void {
    const ability = typeof state.ability === 'string' && state.ability ? state.ability : null;
    if (ability !== this.route.ability) this.bridgeKey = null;
    this.route = {
      group: typeof state.group === 'string' && state.group ? state.group : null,
      ability,
      layout: asAbilityLayout(state.layout),
      detail: state.detail === true && ability !== null,
    };
  }

  async setState(state: AbilityViewState = {}): Promise<void> {
    this.adopt(state);
    this.render();
  }

  getState(): Record<string, unknown> {
    return { ...this.route };
  }

  async onOpen(): Promise<void> {
    this.adopt(this.leaf.getViewState().state ?? {});
    this.render();
  }

  go(target: Partial<AbilityRouteState>): void {
    const next = { ...this.route, ...target };
    void this.plugin.nav.openAbilities({
      group: next.group,
      ability: next.ability,
      layout: next.layout,
      detail: next.detail,
    });
  }

  render(): void {
    renderAbilityMap(this.contentEl, this);
  }
}
