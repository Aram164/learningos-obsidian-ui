import type { GatewaySuccessV2 } from '../contracts/gateway-v2';
import { GatewayError } from '../contracts/gateway-v1';
import type {
  ProjectionRecord,
} from '../contracts/manifest';
import type { GatewayClient } from '../gateway-client';
import type { ManifestStore } from '../manifest-store';
import type {
  GatewayRecoveryErrorV1,
  GatewayRecoveryRecordV3,
  SettingsGatewayRecoveryStore,
} from '../application/gateway-recovery';

type AIActionPlugin = {
  readonly gateway: Pick<GatewayClient, 'call' | 'guard' | 'applyApprovedDelivery' | 'enqueue'>;
  readonly store: Pick<ManifestStore, 'aiProviders'>;
  readonly recovery: Pick<
    SettingsGatewayRecoveryStore,
    'aiPrepare' | 'beginAiPrepare' | 'markAiPrepare' | 'clearAiPrepare'
  >;
  mutate<T>(action: () => T | PromiseLike<T>): Promise<T>;
};

/** What a retried prepare settled to. */
export type AiPrepareSettlement =
  | { readonly kind: 'prepared'; readonly result: ProjectionRecord }
  | { readonly kind: 'not-prepared'; readonly error: unknown }
  | { readonly kind: 'blocked'; readonly error: unknown }
  | { readonly kind: 'unknown'; readonly error: unknown };

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `ai-request-YYYYMMDD-HHMMSS-<hex>`, the shape Core mints itself. */
export function mintAiRequestId(now: Date = new Date()): string {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const date = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `ai-request-${date}-${time}-${hex}`;
}

function recoveryError(error: unknown): GatewayRecoveryErrorV1 {
  const code = error instanceof GatewayError && error.gatewayCode
    ? error.gatewayCode
    : error instanceof GatewayError && error.exitCode !== null
      ? `EXIT_${error.exitCode}`
      : 'UNCONFIRMED';
  return { code, message: error instanceof Error ? error.message : String(error) };
}

/** Core answered: the process ran and exited with a documented code. */
function coreAnswered(error: unknown): error is GatewayError {
  return error instanceof GatewayError
    && error.exitCode !== null
    && [1, 2, 3].includes(error.exitCode);
}

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

  /**
   * Prepare one Garden shelving request under an identity minted here.
   *
   * The id is recorded in the recovery slot before Core is spawned (CL-03).
   * A response that is lost — Obsidian quit, the process died — is then
   * settled by retrying that same id, which Core answers idempotently, rather
   * than by a second press that would leave an orphaned request behind.
   */
  prepareGardenShelving(
    targetId: string,
    provider = 'manual-bundle',
  ): Promise<ProjectionRecord> {
    return this.plugin.mutate(async () => {
      const guard = this.plugin.gateway.guard();
      const intent: GatewayRecoveryRecordV3 = {
        schema_version: 3,
        kind: 'ai-prepare',
        phase: 'prepared',
        request_id: mintAiRequestId(),
        action_id: 'garden.shelve',
        target_kind: 'garden-note',
        target_id: targetId,
        provider,
        expected_snapshot: guard[1] ?? '',
        created_at: new Date().toISOString(),
        last_error: null,
      };
      await this.plugin.recovery.beginAiPrepare(intent);
      let result: ProjectionRecord;
      try {
        result = await this.plugin.gateway.call(this.prepareArgs(intent));
      } catch (error: unknown) {
        const settled = await this.settlePrepare(intent, error);
        if (settled.kind === 'prepared') return settled.result;
        throw settled.error;
      }
      await this.plugin.recovery.clearAiPrepare(intent);
      return result;
    });
  }

  /**
   * Settle an interrupted prepare (startup or Diagnostics), outside `mutate`:
   * the global write gate is closed exactly because this record is unresolved.
   */
  settleInterruptedPrepare(): Promise<AiPrepareSettlement> {
    return this.plugin.gateway.enqueue(async () => {
      const stored = this.plugin.recovery.aiPrepare();
      if (!stored) throw new Error('There is no interrupted AI request to settle.');
      return this.settlePrepare(stored, null);
    });
  }

  private prepareArgs(intent: GatewayRecoveryRecordV3): string[] {
    return [
      'ai-action-prepare',
      '--action-id',
      intent.action_id,
      '--target-kind',
      intent.target_kind,
      '--target-id',
      intent.target_id,
      '--provider',
      intent.provider,
      '--request-id',
      intent.request_id,
      '--expected-snapshot',
      intent.expected_snapshot,
    ];
  }

  /**
   * One retry under the same id, then a definite classification.
   *
   * Core checks a known id before its snapshot guard, so its answer settles the
   * question: success is the committed request (now or earlier); a refusal for
   * an id with no request on disk means nothing was prepared; a refusal for an
   * id that does exist means a conflicting or damaged request, kept blocked for
   * Diagnostics. A process that never answered leaves the record recovering.
   */
  private async settlePrepare(
    intent: GatewayRecoveryRecordV3,
    first: unknown,
  ): Promise<AiPrepareSettlement> {
    let stored = intent;
    if (first !== null) {
      stored = await this.plugin.recovery.markAiPrepare(intent, 'recovering', recoveryError(first));
    }
    let failure: unknown;
    try {
      const result = await this.plugin.gateway.call(this.prepareArgs(stored));
      await this.plugin.recovery.clearAiPrepare(stored);
      return { kind: 'prepared', result };
    } catch (error: unknown) {
      failure = error;
    }
    if (!coreAnswered(failure)) {
      await this.plugin.recovery.markAiPrepare(stored, 'recovering', recoveryError(failure));
      return { kind: 'unknown', error: failure };
    }
    let exists: boolean;
    try {
      await this.plugin.gateway.call(['ai-action-status', stored.request_id]);
      exists = true;
    } catch (error: unknown) {
      if (!coreAnswered(error)) {
        await this.plugin.recovery.markAiPrepare(stored, 'recovering', recoveryError(failure));
        return { kind: 'unknown', error: failure };
      }
      exists = false;
    }
    if (exists) {
      await this.plugin.recovery.markAiPrepare(stored, 'blocked', recoveryError(failure));
      return { kind: 'blocked', error: failure };
    }
    await this.plugin.recovery.clearAiPrepare(stored);
    return { kind: 'not-prepared', error: first ?? failure };
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
  ): Promise<GatewaySuccessV2> {
    return this.plugin.mutate(
      () => this.plugin.gateway.applyApprovedDelivery(deliveryId),
    );
  }
}
