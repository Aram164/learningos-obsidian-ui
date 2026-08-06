/**
 * Provider-independent client for the core AI-action gateway. The UI never
 * sends an open-ended prompt or grants a provider direct vault access: it asks
 * the core to persist an exact request bundle and later applies only a delivery
 * that the core has already validated against the locked contract.
 */
export class AIActionClient {
  [key: string]: any;
  constructor(plugin) { this.plugin = plugin; }

  providers() { return this.plugin.store.aiProviders(); }

  prepareGardenShelving(targetId, provider = 'manual-bundle', jobExportConfirmed = false) {
    const args = ['ai-action-prepare', '--action-id', 'garden.shelve',
      '--target-kind', 'garden-note', '--target-id', targetId,
      '--provider', provider, ...this.plugin.gateway.guard()];
    if (jobExportConfirmed) args.push('--confirm-job-export');
    return this.plugin.mutate(() => this.plugin.gateway.call(args));
  }

  status(requestId) {
    return this.plugin.gateway.call(['ai-action-status', requestId]);
  }

  applyApprovedDelivery(deliveryId) {
    return this.plugin.mutate(() => this.plugin.gateway.call([
      'ai-action-apply-delivery', deliveryId,
    ]));
  }
}
