import {
  asAbilityBrief,
  asAbilityFocus,
  asAbilityUnmapped,
  type AbilityBriefV1,
  type AbilityFocusV1,
  type AbilityUnmappedV1,
} from '../contracts/ability-context';
import { GatewayError } from '../contracts/gateway-v1';

/** Enough for every ability Core has today; the page states when it is cut. */
export const ABILITY_HORIZON_LIMIT = 50;

export type AbilityExpansion = AbilityFocusV1 | AbilityUnmappedV1;

interface AbilityHorizonHost {
  readonly gateway: {
    abilityContext(options: {
      abilityId?: string;
      limit?: number;
      expectedSnapshot?: string | null;
    }): Promise<unknown>;
  };
  readonly store: { readonly snapshotId: string | null };
  /** Redraw the surfaces that read the horizon: Atlas, Review, navigator. */
  horizonChanged(): void;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function snapshotRefused(error: unknown): boolean {
  return error instanceof GatewayError && error.exitCode === 3;
}

/**
 * One shared, read-only copy of Core's ability horizon for the projection on
 * screen.
 *
 * Atlas, Review and the navigator all read the same answer, so they cannot
 * disagree about what exists. It is a cache, never a record: it is keyed to
 * the manifest snapshot it was read under, dropped the moment that snapshot
 * changes (every confirmed write reloads the manifest), and it holds nothing
 * Core did not say. Focused expansions are read against the horizon's own
 * snapshot, so an expansion from newer records is refused by Core and the
 * horizon is reread rather than mixed.
 */
export class AbilityHorizon {
  private brief: AbilityBriefV1 | null = null;
  private briefFor: string | null = null;
  private readAt: Date | null = null;
  private pending: Promise<void> | null = null;
  private failure: string | null = null;
  private failureFor: string | null = null;
  private readonly expansions = new Map<string, AbilityExpansion>();
  private readonly expansionPending = new Map<string, Promise<void>>();
  private readonly expansionFailures = new Map<string, string>();

  constructor(private readonly host: AbilityHorizonHost) {}

  private get projection(): string | null {
    return this.host.store.snapshotId;
  }

  /** The horizon for the projection on screen, or null. Never starts a read. */
  current(): AbilityBriefV1 | null {
    return this.brief && this.briefFor === this.projection ? this.brief : null;
  }

  get loading(): boolean {
    return this.pending !== null;
  }

  /** Why the last read for this projection failed, or null. */
  get error(): string | null {
    return this.failureFor === this.projection ? this.failure : null;
  }

  /** When the horizon on screen was read. */
  get readTime(): Date | null {
    return this.current() ? this.readAt : null;
  }

  /**
   * Core's records moved on since the projection on screen was built — the
   * map may be behind them until the projection is rebuilt.
   */
  get recordsAhead(): boolean {
    const brief = this.current();
    return Boolean(brief && this.projection && brief.snapshot_id !== this.projection);
  }

  /** Start a read when none is current. A failed read waits for `refresh`. */
  ensure(): void {
    if (this.current() || this.pending || this.error) return;
    void this.read();
  }

  /** Read again now, whatever is cached. */
  async refresh(): Promise<void> {
    this.failure = null;
    this.failureFor = null;
    this.drop();
    await this.read();
  }

  private drop(): void {
    this.brief = null;
    this.briefFor = null;
    this.expansions.clear();
    this.expansionFailures.clear();
  }

  private read(): Promise<void> {
    if (this.pending) return this.pending;
    const projection = this.projection;
    const run = (async () => {
      try {
        const value = await this.host.gateway.abilityContext({ limit: ABILITY_HORIZON_LIMIT });
        const brief = asAbilityBrief(value);
        if (!brief) {
          throw new Error('Core answered the ability horizon in a shape this build cannot read. Nothing was changed.');
        }
        this.expansions.clear();
        this.expansionFailures.clear();
        this.brief = brief;
        this.briefFor = projection;
        this.readAt = new Date();
        this.failure = null;
        this.failureFor = null;
      } catch (error: unknown) {
        this.failure = message(error);
        this.failureFor = projection;
      } finally {
        this.pending = null;
        this.host.horizonChanged();
      }
    })();
    this.pending = run;
    return run;
  }

  /** One ability expanded under the horizon's snapshot, or null while unread. */
  expansion(abilityId: string): AbilityExpansion | null {
    return this.current() ? this.expansions.get(abilityId) ?? null : null;
  }

  expansionError(abilityId: string): string | null {
    return this.current() ? this.expansionFailures.get(abilityId) ?? null : null;
  }

  expanding(abilityId: string): boolean {
    return this.expansionPending.has(abilityId);
  }

  /** Start one focused read if the horizon is current and it is not cached. */
  ensureExpansion(abilityId: string): void {
    const brief = this.current();
    if (!brief || this.expansions.has(abilityId) || this.expansionPending.has(abilityId)
      || this.expansionFailures.has(abilityId)) return;
    const run = (async () => {
      try {
        const value = await this.host.gateway.abilityContext({
          abilityId,
          expectedSnapshot: brief.snapshot_id,
        });
        const expanded = asAbilityFocus(value) ?? asAbilityUnmapped(value);
        if (!expanded) {
          throw new Error('Core answered this ability in a shape this build cannot read. Nothing was changed.');
        }
        if (this.brief === brief) this.expansions.set(abilityId, expanded);
      } catch (error: unknown) {
        if (snapshotRefused(error)) {
          // The records changed under the horizon: reread both rather than
          // show an expansion from a different set of records.
          this.expansionPending.delete(abilityId);
          await this.refresh();
          return;
        }
        if (this.brief === brief) this.expansionFailures.set(abilityId, message(error));
      } finally {
        this.expansionPending.delete(abilityId);
        this.host.horizonChanged();
      }
    })();
    this.expansionPending.set(abilityId, run);
  }

  /** Forget one failed expansion so the next render may try again. */
  retryExpansion(abilityId: string): void {
    this.expansionFailures.delete(abilityId);
    this.ensureExpansion(abilityId);
  }
}
