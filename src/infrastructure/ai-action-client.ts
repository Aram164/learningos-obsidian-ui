import type {
  ProjectionRecord,
} from '../contracts/manifest';
import type { AppSurface } from '../app/surface';

type AIActionPlugin = Pick<
  AppSurface,
  | 'gateway'
  | 'mutate'
  | 'store'
>;

/**
 * Provider-independent client for the core AI-action gateway. The UI never
 * sends an open-ended prompt or grants a provider direct vault access: it asks
 * the core to persist an exact request bundle and later applies only a delivery
 * that the core has already validated against the locked contract.
 */
export class AIActionClient {
  private readonly plugin: AIActionPlugin;

  constructor(
    plugin: AIActionPlugin,
  ) {
    this.plugin = plugin;
  }

  providers(): ProjectionRecord[] {
    return this.plugin.store.aiProviders();
  }

  prepareGardenShelving(
    targetId: string,
    provider = 'manual-bundle',
  ): Promise<ProjectionRecord> {
    const args = [
      'ai-action-prepare',
      '--action-id',
      'garden.shelve',
      '--target-kind',
      'garden-note',
      '--target-id',
      targetId,
      '--provider',
      provider,
      ...this.plugin.gateway.guard(),
    ];

    return this.plugin.mutate(
      () => this.plugin.gateway.call(args),
    );
  }

  status(
    requestId: string,
  ): Promise<ProjectionRecord> {
    return this.plugin.gateway.call([
      'ai-action-status',
      requestId,
    ]);
  }

  applyApprovedDelivery(
    deliveryId: string,
  ): Promise<ProjectionRecord> {
    return this.plugin.mutate(
      () => this.plugin.gateway.call([
        'ai-action-apply-delivery',
        deliveryId,
      ]),
    );
  }
}
