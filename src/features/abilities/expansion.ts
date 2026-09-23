import { button } from '../../components';
import { sentence } from './model';
import type { AbilityHost } from './ports';

/** What to show while an ability's focused expansion is unread, failed or unmapped. */
export function renderExpansionState(parent: HTMLElement, host: AbilityHost, abilityId: string): void {
  const horizon = host.plugin.abilityHorizon;
  const error = horizon.expansionError(abilityId);
  if (error) {
    parent.createEl('p', { cls: 'los-micro', text: `Could not expand this ability: ${error}` });
    button(parent, 'Try again', () => {
      horizon.retryExpansion(abilityId);
      host.render();
    }, 'tertiary');
    return;
  }
  const expansion = horizon.expansion(abilityId);
  if (expansion && !('ability' in expansion)) {
    parent.createEl('p', { cls: 'los-micro', text: sentence(expansion.reason) });
    return;
  }
  parent.createEl('p', { cls: 'los-micro', text: 'Reading this ability’s conditions from Core…' });
}
