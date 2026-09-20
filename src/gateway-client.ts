import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, sep } from 'node:path';
import type { PlanProfile } from './contracts/plan-template';
import type { JsonRecord, ProjectionRecord } from './contracts/manifest';
import {
  GatewayError, exitCodeOf, structuredError,
  type GatewayResultV1,
} from './contracts/gateway-v1';
import {
  GATEWAY_SCHEMA_VERSION,
  asGatewayFailureV2,
  asGatewaySuccessV2,
  gatewayApprovalSubject,
  gatewaySubjectSha256,
  gestureUnavailableMessage,
  isDefinitiveNoCommitCode,
  isGestureCapability,
  isRequestScopedCapability,
  isSha256,
  requestArtifactId,
  type GatewayFailureV2,
  type GatewaySuccessV2,
} from './contracts/gateway-v2';
import {
  MemoryGatewayRecoveryStore,
  type GatewayRecoveryErrorV1,
  type GatewayRecoveryPort,
} from './application/gateway-recovery';
import {
  childAttemptContext,
  diagnosticEvent,
  formatTraceparent,
  newOperationContext,
  type DiagnosticEvent,
  type TraceContext,
} from './infrastructure/trace-context';

type LosCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

/** Everything the gateway needs from its host: one process runner, one snapshot id. */
interface GatewayHost {
  runLos(args: string[], callback: LosCallback, stdin?: string, traceParent?: string): void;
  /**
   * Optional diagnostic sink (track #2, Phase 2A): receives UI-side span
   * events shaped like Core's records. Absent in production, wired by tests
   * and harnesses. Throwing here must never break a write — the client
   * guards every call.
   */
  diagnostics?(event: DiagnosticEvent): void;
  store: {
    snapshotId: string | null;
  };
  /**
   * Where an in-flight write is remembered. Optional so a test can exercise
   * transmission alone; the plugin always supplies the persisted store, and
   * `LearningOSUI` is where that wiring is asserted.
   */
  recovery?: GatewayRecoveryPort;
  /** Recovery is never silent — the learner is told before a replay is sent. */
  notify?(message: string): void;
  /** False once this plugin instance has yielded ownership during unload. */
  isLifecycleActive?(): boolean;
}

/** The exact file and repository state inspected by the import preflight. */
export interface UnitMapImportReview {
  unitId: string;
  file: string;
  replace: boolean;
  fileSha256: string;
  expectedSnapshot: string;
  expectedRevisions: Readonly<Record<string, number>>;
  result: Record<string, unknown>;
}

export const GATEWAY_RECOVERY_NOTICE =
  'The Gateway response was interrupted. Replaying the same approved request; '
  + 'no new write will be created.';

export const GATEWAY_RECOVERY_BLOCKED =
  'LearningOS could not confirm whether the previous write landed, so it will '
  + 'not send another. Your draft was kept. Open Diagnostics → Gateway recovery '
  + 'to retry the same request.';

/**
 * What one attempt at a prepared envelope produced.
 *
 * Three outcomes, not two: "it worked", "Core refused before writing anything",
 * and "nobody knows". The third is the one the old code did not have, and
 * collapsing it into either of the others is how one gesture became two writes
 * (collapse into failure, learner retries) or lost a capture (collapse into
 * success, draft cleared).
 */
export type GatewayDispatchOutcome =
  | { outcome: 'confirmed'; confirmation: GatewaySuccessV2 }
  | { outcome: 'refused'; failure: GatewayFailureV2 }
  | { outcome: 'ambiguous'; error: GatewayRecoveryErrorV1 };

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

let requestCounter = 0;

/** A per-write id, so a response can be matched to the request that caused it. */
function nextRequestId(capability: string): string {
  requestCounter += 1;
  return `req-${capability.replace(/\./g, '-')}-${Date.now()}-${requestCounter}`;
}

function nextIdempotencyKey(requestId: string): string {
  return `idem-${requestId}`;
}

function expandedLocalPath(filePath: string): string {
  if (filePath === '~') return homedir();
  if (filePath.startsWith(`~${sep}`)) return join(homedir(), filePath.slice(2));
  return filePath;
}

/** Bind a user-selected path to the exact bytes Core is approved to consume. */
async function fileSha256(filePath: string): Promise<string> {
  const bytes = await readFile(expandedLocalPath(filePath));
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function gatewayErrorDetails(value: unknown): {
  message: string;
  code?: string;
  retryable?: boolean;
} {
  const response = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
  const error = typeof response.error === 'object' && response.error !== null
    ? response.error as Record<string, unknown>
    : null;
  if (error) {
    return {
      message: typeof error.message === 'string' && error.message.trim()
        ? error.message.trim()
        : 'LearningOS refused the change; your draft was kept.',
      ...(typeof error.code === 'string' ? { code: error.code } : {}),
      ...(typeof error.retryable === 'boolean' ? { retryable: error.retryable } : {}),
    };
  }
  return {
    message: typeof response.error === 'string' && response.error.trim()
      ? response.error.trim()
      : 'LearningOS refused the change; your draft was kept.',
  };
}

export class GatewayClient {
  private readonly plugin: GatewayHost;
  private chain: Promise<void>;
  readonly recovery: GatewayRecoveryPort;
  pending: number;
  constructor(plugin: GatewayHost) {
    this.plugin = plugin;
    // The write lock lives here, not in a view, because the thing being
    // protected is the single CLI process and the snapshot it was handed.
    this.chain = Promise.resolve();
    this.pending = 0;
    this.recovery = plugin.recovery ?? new MemoryGatewayRecoveryStore();
  }

  private announce(message: string): void {
    if (!this.lifecycleActive()) return;
    this.plugin.notify?.(message);
  }

  private lifecycleActive(): boolean {
    return this.plugin.isLifecycleActive?.() ?? true;
  }

  assertLifecycleActive(): void {
    if (this.lifecycleActive()) return;
    throw new GatewayError(
      'This LearningOS plugin instance has been unloaded; its pending operation was left for the active instance to recover.',
      null,
      { code: 'PLUGIN_UNLOADED', retryable: false },
    );
  }

  /**
   * The global write gate while any earlier transaction is unresolved.
   *
   * `capability()` is not the only mutating route: session closure and the
   * provider-independent AI action commands still use positional CLI calls.
   * Their hosts call this same guard before starting those processes, so
   * recovery cannot be bypassed by choosing a different write surface.
   */
  assertMutationAllowed(): void {
    this.assertLifecycleActive();
    if (!this.recovery.unresolved) return;
    throw new GatewayError(
      'LearningOS has an unresolved Gateway write and will not start another until it is settled. Open Diagnostics → Gateway recovery.',
      null,
      { code: 'RECOVERY_REQUIRED', retryable: false },
    );
  }

  /**
   * Serialize every mutation, wherever it was clicked. Failures do not poison
   * the chain: the next task runs regardless of how the previous one settled,
   * but never alongside it.
   */
  enqueue<T>(task: () => T | PromiseLike<T>): Promise<T> {
    this.pending += 1;
    const guarded = () => {
      this.assertLifecycleActive();
      return task();
    };
    const run = this.chain.then(guarded, guarded);
    this.chain = run.then(() => undefined, () => undefined)
      .then(() => { this.pending -= 1; });
    return run;
  }

  get isBusy() { return this.pending > 0; }

  /**
   * Every mutating command answers in JSON. Unreadable or empty output means
   * the write was NOT confirmed, so this must reject: call sites clear
   * UI-owned drafts on resolve, and resolving on garbage would destroy the
   * learner's text behind a success notice. `expectJson: false` is only for
   * the text-reporting commands (`validate`, `generate`).
   */
  call(
    args: string[],
    { expectJson = true, stdin, traceParent }: {
      expectJson?: boolean; stdin?: string; traceParent?: string;
    } = {},
  ): Promise<GatewayResultV1> {
    this.assertLifecycleActive();
    return new Promise((resolve, reject) => {
      this.plugin.runLos(
        args,
        (error: Error | null, stdout: string, stderr: string) => {
        if (!this.lifecycleActive()) {
          reject(new GatewayError(
            'This LearningOS plugin instance was unloaded while Core was finishing; its durable recovery record was left untouched.',
            null,
            { code: 'PLUGIN_UNLOADED', retryable: false },
          ));
          return;
        }
        if (error) {
          // A refusal puts its reason on stdout and leaves stderr empty, so
          // reading stderr first threw the sentence away and reported Node's
          // "Command failed: python …" instead. The exit code travels with it
          // because code 3 (projection conflict) is recoverable and the
          // caller has to be able to tell.
          let refusal: ReturnType<typeof gatewayErrorDetails> | null = null;
          try { refusal = gatewayErrorDetails(JSON.parse(String(stdout || ''))); }
          catch (_) { /* A non-JSON process failure is reported from stderr below. */ }
          const reason = structuredError(stdout) || stderr.trim()
            || error.message || String(error);
          reject(new GatewayError(reason, exitCodeOf(error), refusal || {}));
          return;
        }
        const raw = String(stdout ?? '').trim();
        if (!expectJson) { resolve({ ok: true, stdout: raw }); return; }
        if (!raw) {
          reject(new Error('LearningOS wrote nothing back, so the change is unconfirmed. Your draft was kept.'));
          return;
        }
        let parsed = null;
        try { parsed = JSON.parse(raw); }
        catch (_) {
          reject(new Error(`LearningOS answered with unreadable output, so the change is unconfirmed and your draft was kept: ${raw.slice(0, 160)}`));
          return;
        }
        if (!parsed || typeof parsed !== 'object' || parsed.ok === false) {
          const refusal = gatewayErrorDetails(parsed);
          reject(new GatewayError(
            refusal.message,
            exitCodeOf(error),
            refusal,
          ));
          return;
        }
        resolve(parsed);
        },
        stdin,
        traceParent,
      );
    });
  }

  /**
   * The one write shape.
   *
   * Every canonical mutation is a declared capability sent as an envelope, so
   * there is a single call shape, a single response shape and a single error
   * path — instead of one positional signature per command, each with its own
   * flag order to get wrong. The named methods below are porcelain over this.
   */
  capability(
    name: string,
    payload: Record<string, unknown>,
    options: {
      expectedSnapshot?: string;
      expectedRevisions?: Readonly<Record<string, number>>;
    } = {},
  ): Promise<GatewaySuccessV2> {
    // Every envelope this client sends claims `direct-user-gesture`, because
    // that is honestly what it is. Core admits that claim only where a click
    // is sufficient authority, so a capability outside that set is refused
    // here — with the route back to a permitted write, and before a request
    // identity, a recovery record or a draft-losing round trip exists.
    if (!isGestureCapability(name)) {
      throw new GatewayError(
        gestureUnavailableMessage(name),
        null,
        { code: 'UNCONFIRMED', retryable: false },
      );
    }
    const expectedSnapshot = options.expectedSnapshot || this.snapshotId();
    if (!isSha256(expectedSnapshot)) {
      throw new GatewayError(
        'LearningOS has no valid sha256 snapshot to guard this change against; nothing was written.',
        null,
        { code: 'INVALID_REQUEST', retryable: false },
      );
    }
    const expectedRevisions = options.expectedRevisions || {};
    if (Object.entries(expectedRevisions).some(
      ([id, revision]) => !id || !Number.isInteger(revision) || revision < 0,
    )) {
      throw new GatewayError(
        'LearningOS has invalid artifact revision guards; nothing was written.',
        null,
        { code: 'INVALID_REQUEST', retryable: false },
      );
    }
    // The guard for these two is derived below from an idempotency key that
    // does not exist yet, so a caller-supplied map cannot be honoured and must
    // not be silently replaced or merged either: quietly discarding a guard the
    // caller asked for is how a stale-revision refusal turns into an
    // unguarded write. Refuse here, before anything is sent.
    if (isRequestScopedCapability(name)
        && Object.keys(expectedRevisions).length > 0) {
      throw new GatewayError(
        `LearningOS guards ${name} against its own request, so it cannot also be guarded against caller-supplied artifact revisions; nothing was written.`,
        null,
        { code: 'INVALID_REQUEST', retryable: false },
      );
    }
    // A second write while the first outcome is unknown is exactly the
    // duplicate this whole path exists to prevent, and it must be refused
    // before the envelope is built rather than after it is sent.
    this.assertMutationAllowed();
    return this.sendCapability(
      name,
      payload,
      expectedSnapshot,
      expectedRevisions,
    );
  }

  /**
   * Phase one: build the request, persist it, send nothing.
   *
   * Identity, guards, approval and serialization all happen exactly once here,
   * and the record is durably saved before this returns — so the process that
   * comes next can be interrupted at any point and still be recognisable.
   */
  /** Emit one UI-side event; a throwing sink must never break a write. */
  private diagnose(event: DiagnosticEvent): void {
    try { this.plugin.diagnostics?.(event); } catch (_) { /* sink is best-effort */ }
  }

  async prepareCapability(
    name: string,
    payload: Record<string, unknown>,
    expectedSnapshot: string,
    expectedRevisions: Readonly<Record<string, number>>,
    trace?: TraceContext,
  ): Promise<string> {
    this.assertLifecycleActive();
    const requestId = nextRequestId(name);
    const idempotencyKey = nextIdempotencyKey(requestId);
    // Order matters, and it is the whole defect this method once had. A
    // request-scoped guard can only be built once the idempotency key exists,
    // and Core hashes the approval subject over `expected_revisions` — so the
    // map has to be final *before* the subject is hashed, and the identical map
    // has to travel in the envelope. Deriving it afterwards produced a
    // correctly-signed approval for a guard Core never received, and every
    // capture and Garden seed was refused.
    const effectiveRevisions: Readonly<Record<string, number>> =
      isRequestScopedCapability(name)
        ? { [requestArtifactId(name, idempotencyKey)]: 0 }
        : expectedRevisions;
    const subject = gatewayApprovalSubject(
      name,
      expectedSnapshot,
      effectiveRevisions,
      payload,
    );
    const envelope = {
      schema_version: GATEWAY_SCHEMA_VERSION,
      request_id: requestId,
      idempotency_key: idempotencyKey,
      capability: name,
      channel: 'ui',
      expected_snapshot: expectedSnapshot,
      expected_revisions: effectiveRevisions,
      approval: {
        kind: 'direct-user-gesture',
        subject_sha256: await gatewaySubjectSha256(subject),
      },
      payload,
    };
    const envelopeJson = JSON.stringify(envelope);
    this.assertLifecycleActive();
    await this.recovery.begin({
      schema_version: 1,
      phase: 'prepared',
      created_at: new Date().toISOString(),
      envelope_json: envelopeJson,
      confirmation: null,
      last_error: null,
    });
    if (trace !== undefined) {
      this.diagnose(diagnosticEvent(trace, 'gateway.envelope.prepared', {
        request_id: requestId,
        idempotency_key: envelope.idempotency_key,
        capability: name,
      }));
    }
    return envelopeJson;
  }

  /** The raw process result, before anything has been believed about it. */
  private runRaw(
    args: string[],
    stdin?: string,
    traceParent?: string,
  ): Promise<{ error: Error | null; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      this.plugin.runLos(args, (error, stdout, stderr) => {
        resolve({ error, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
      }, stdin, traceParent);
    });
  }

  /**
   * Phase two: send the stored string, byte for byte.
   *
   * It generates nothing. Reconstructing the envelope here — even "identically"
   * — would defeat the point: a rebuilt envelope carries a fresh identity, and
   * Core would treat the retry as a new write.
   */
  async dispatchPreparedEnvelope(
    envelopeJson: string,
    { replayOnly = false, trace }: { replayOnly?: boolean; trace?: TraceContext } = {},
  ): Promise<GatewayDispatchOutcome> {
    this.assertLifecycleActive();
    // One physical dispatch, one attempt span. The operation stays stable
    // across a send and its in-session replay (same trace id, fresh span
    // id); a caller without an operation — e.g. recovery after a restart —
    // mints a fresh one rather than borrowing a stale identity.
    const attemptCtx = trace === undefined ? newOperationContext() : childAttemptContext(trace);
    const attempt = formatTraceparent(attemptCtx);
    const received = (result: GatewayDispatchOutcome): GatewayDispatchOutcome => {
      const code = result.outcome === 'refused'
        ? result.failure.error.code
        : result.outcome === 'ambiguous'
          ? result.error.code
          : null;
      this.diagnose(diagnosticEvent(attemptCtx, 'ui.response.received', {
        outcome: result.outcome,
        code,
        replayed: result.outcome === 'confirmed' ? result.confirmation.replayed : false,
      }, attemptCtx.spanId));
      return result;
    };
    let envelope: { capability?: unknown; request_id?: unknown; idempotency_key?: unknown };
    try {
      envelope = JSON.parse(envelopeJson);
    } catch (_) {
      return received({
        outcome: 'ambiguous',
        error: { code: 'INVALID_REQUEST', message: 'the prepared envelope is unreadable' },
      });
    }
    const expected = {
      requestId: String(envelope.request_id ?? ''),
      idempotencyKey: String(envelope.idempotency_key ?? ''),
      capability: String(envelope.capability ?? ''),
    };
    const args = ['capability', expected.capability, '--payload-file', '-'];
    if (replayOnly) args.push('--replay-only');
    this.diagnose(diagnosticEvent(attemptCtx, 'gateway.envelope.dispatched', {
      capability: expected.capability,
      request_id: expected.requestId,
      replay_only: replayOnly,
    }, attemptCtx.spanId));
    const { error, stdout, stderr } = await this.runRaw(args, envelopeJson, attempt);
    this.assertLifecycleActive();
    const raw = stdout.trim();
    let parsed: unknown = null;
    let readable = false;
    if (raw) {
      try { parsed = JSON.parse(raw); readable = true; }
      catch (_) { readable = false; }
    }
    if (!readable) {
      return received({
        outcome: 'ambiguous',
        error: {
          code: 'UNREADABLE_RESPONSE',
          message: raw
            ? `LearningOS answered with unreadable output: ${raw.slice(0, 160)}`
            : (stderr.trim() || error?.message || 'LearningOS wrote nothing back.'),
        },
      });
    }
    const failure = asGatewayFailureV2(parsed, expected);
    if (failure) {
      // Only a definitive code retires the record. Everything else — an
      // internal failure, an idempotency conflict, a code this build does not
      // know — leaves the write's fate open, which is the safe reading.
      return received(isDefinitiveNoCommitCode(failure.error.code)
        ? { outcome: 'refused', failure }
        : {
          outcome: 'ambiguous',
          error: { code: failure.error.code, message: failure.error.message },
        });
    }
    let confirmation: GatewaySuccessV2 | null = null;
    try { confirmation = asGatewaySuccessV2(parsed, expected); }
    catch (_) { confirmation = null; }
    if (confirmation && !error) return received({ outcome: 'confirmed', confirmation });
    if (confirmation && error) {
      // Success-shaped JSON from a process that failed contradicts itself; the
      // receipt cannot be trusted and the write cannot be assumed absent.
      return received({
        outcome: 'ambiguous',
        error: {
          code: 'PROCESS_CONTRADICTION',
          message: 'LearningOS printed a receipt but the process reported failure.',
        },
      });
    }
    // Readable, but not a Gateway V2 answer to *this* request. Whatever it is,
    // it does not establish that nothing was written — so the core's own words
    // are carried forward for the learner while the outcome stays open.
    const identity = record(parsed);
    const claimsAnother = identity !== null
      && (typeof identity.request_id === 'string'
        || typeof identity.idempotency_key === 'string')
      && (identity.request_id !== expected.requestId
        || identity.idempotency_key !== expected.idempotencyKey
        || identity.capability !== expected.capability);
    return received({
      outcome: 'ambiguous',
      error: {
        code: claimsAnother ? 'IDENTITY_MISMATCH' : 'UNRECOGNISED_RESPONSE',
        message: structuredError(raw)
          || 'LearningOS answered with a response that does not match this request.',
      },
    });
  }

  /**
   * Phase three: resend what was persisted.
   *
   * Used both for the one in-session replay and for a replay after restart, so
   * there is only one code path that can send a retry, and it can only send the
   * stored string.
   */
  async recoverPreparedEnvelope(trace?: TraceContext): Promise<GatewayDispatchOutcome> {
    this.assertLifecycleActive();
    const entry = this.recovery.replayable();
    if (!entry) {
      return {
        outcome: 'ambiguous',
        error: { code: 'RECOVERY_REQUIRED', message: 'There is no replayable Gateway request.' },
      };
    }
    await this.recovery.markRecovering(entry.record.last_error);
    const result = await this.dispatchPreparedEnvelope(
      entry.record.envelope_json, trace === undefined ? {} : { trace });
    if (result.outcome !== 'refused') return result;
    /*
     * The refusal proves only that *this replay* wrote nothing. It cannot prove
     * the earlier, interrupted attempt left nothing behind: a killed process or
     * an incomplete rollback can change canonical bytes without reaching the
     * idempotency ledger, after which the exact retry legitimately answers
     * STALE_SNAPSHOT or REVISION_CONFLICT. Clearing here would erase the only
     * evidence and invite a fresh-key duplicate.
     */
    return {
      outcome: 'ambiguous',
      error: {
        code: result.failure.error.code,
        message: `The recovery attempt was refused (${result.failure.error.code}): ${result.failure.error.message}`,
      },
    };
  }

  /**
   * Ask Core to prove a persisted confirmation without running its handler.
   *
   * `data.json` is not an authority boundary: a syntactically valid success
   * body can be corrupted or fabricated there.  Core's idempotency ledger and
   * Receipt V2 are the authority, so startup and Diagnostics retire a stored
   * confirmation only after this read-only lookup returns the exact replay.
   */
  async verifyConfirmedEnvelope(trace?: TraceContext): Promise<GatewayDispatchOutcome> {
    this.assertLifecycleActive();
    const entry = this.recovery.replayable();
    if (!entry || entry.record.confirmation === null) {
      return {
        outcome: 'ambiguous',
        error: {
          code: 'RECOVERY_REQUIRED',
          message: 'There is no persisted confirmation for Core to verify.',
        },
      };
    }
    const result = await this.dispatchPreparedEnvelope(
      entry.record.envelope_json,
      trace === undefined ? { replayOnly: true } : { replayOnly: true, trace },
    );
    if (result.outcome === 'confirmed' && result.confirmation.replayed) {
      return result;
    }
    if (result.outcome === 'confirmed') {
      return {
        outcome: 'ambiguous',
        error: {
          code: 'UNVERIFIED_CONFIRMATION',
          message: 'Core returned a non-replay response to a receipt-only lookup.',
        },
      };
    }
    if (result.outcome === 'refused') {
      return {
        outcome: 'ambiguous',
        error: {
          code: result.failure.error.code,
          message: `Core could not verify the persisted receipt (${result.failure.error.code}): ${result.failure.error.message}`,
        },
      };
    }
    return result;
  }

  /**
   * The shared write path for every V2 porcelain method.
   *
   * One ambiguous result buys exactly one visible replay. A second ambiguity
   * blocks: looping in the background is how an interrupted write becomes many,
   * and a blocked record deliberately does not retry itself on the next launch.
   */
  private async sendCapability(
    name: string,
    payload: Record<string, unknown>,
    expectedSnapshot: string,
    expectedRevisions: Readonly<Record<string, number>>,
  ): Promise<GatewaySuccessV2> {
    // One operation for the send and its in-session replay: the same trace
    // id reaches Core on every event and both attempts, each attempt with
    // its own span id.
    const operation = newOperationContext();
    const envelopeJson = await this.prepareCapability(
      name, payload, expectedSnapshot, expectedRevisions, operation,
    );
    let result = await this.dispatchPreparedEnvelope(envelopeJson, { trace: operation });
    if (result.outcome === 'ambiguous') {
      this.announce(GATEWAY_RECOVERY_NOTICE);
      await this.recovery.markRecovering(result.error);
      result = await this.recoverPreparedEnvelope(operation);
    }
    return this.settle(result, operation);
  }

  /** Turn one settled outcome into the record state and the caller's answer. */
  async settle(result: GatewayDispatchOutcome, trace?: TraceContext): Promise<GatewaySuccessV2> {
    this.assertLifecycleActive();
    // Without an operation there is no stream to join: restart-path callers
    // settle here with none, and their settlement linkage is Phase 3 work.
    const settled = (outcome: string, code: string | null): void => {
      if (trace === undefined) return;
      const snapshotAfter = result.outcome === 'confirmed'
        ? result.confirmation.snapshot_after
        : null;
      const observed = this.plugin.store.snapshotId;
      this.diagnose(diagnosticEvent(trace, 'recovery.settled', {
        outcome,
        code,
        snapshot_after: snapshotAfter,
        observed_snapshot: observed,
        observed: snapshotAfter !== null && observed === snapshotAfter,
      }));
    };
    if (result.outcome === 'confirmed') {
      // Not cleared here: a receipt is not yet an observation. The record is
      // retired only after the projection has been reconciled with it.
      await this.recovery.markConfirmed(result.confirmation);
      settled('confirmed', null);
      return result.confirmation;
    }
    if (result.outcome === 'refused') {
      await this.recovery.discardRefused();
      settled('refused', result.failure.error.code);
      throw new GatewayError(
        result.failure.error.message,
        null,
        {
          code: result.failure.error.code,
          retryable: result.failure.error.retryable,
        },
      );
    }
    await this.recovery.markBlocked(result.error);
    settled('blocked', result.error.code);
    throw new GatewayError(
      // The last thing Core said travels with the refusal. The learner cannot
      // act on "unknown", but they can act on the sentence underneath it.
      `${GATEWAY_RECOVERY_BLOCKED}\nLast response: ${result.error.message}`,
      null,
      { code: 'RECOVERY_BLOCKED', retryable: false },
    );
  }

  /**
   * The snapshot guard is what makes a write refusable, so a missing snapshot
   * id must stop the write rather than travel to the CLI as the string
   * "null" — which would be compared against a real snapshot and refused with
   * a misleading message, or worse, matched by accident.
   */
  snapshotId(): string {
    const snapshotId = this.plugin.store.snapshotId;
    if (!snapshotId) {
      throw new Error('LearningOS has no loaded snapshot to guard this change against; nothing was written.');
    }
    return snapshotId;
  }

  /** Positional-flag form, kept for the commands that are not capabilities. */
  guard(): string[] {
    return ['--expected-snapshot', this.snapshotId()];
  }

  // ---- porcelain: each is one declared capability, nothing more ----------
  saveNote(unitId: string, stageId: string, text: string,
    expectedRevisions: Readonly<Record<string, number>> = {}) {
    return this.capability('stage.note.write',
      { unit_id: unitId, stage_id: stageId, text, replace: true },
      { expectedRevisions });
  }
  async saveUnitNote(
    unitId: string,
    {
      title = '',
      text,
      stageIds = [],
      filePaths = [],
    }: {
      title?: string;
      text: string;
      stageIds?: readonly string[];
      filePaths?: readonly string[];
    },
    expectedRevisions: Readonly<Record<string, number>> = {},
  ) {
    const payload: Record<string, unknown> = { unit_id: unitId, text };
    if (String(title).trim()) payload.title = String(title).trim();
    if (stageIds.length) payload.stage_id = [...stageIds];
    if (filePaths.length) {
      payload.attachment = [...filePaths];
      payload.attachment_sha256 = await Promise.all(filePaths.map(fileSha256));
    }
    return this.capability('unit.note.append', payload, { expectedRevisions });
  }
  progress(unitId: string, stageId: string, status: string,
    expectedRevisions: Readonly<Record<string, number>> = {}) {
    return this.capability('stage.progress.update',
      { unit_id: unitId, stage_id: stageId, status }, { expectedRevisions });
  }
  sourceSelection(
    unitId: string,
    routeId: string,
    sourceId: string,
    locator: string,
    purpose: string,
    selected: boolean,
    expectedRevisions: Readonly<Record<string, number>> = {},
  ) {
    return this.capability(
      'unit.source-selection.set',
      {
        unit_id: unitId,
        route_id: routeId,
        source_id: sourceId,
        locator,
        action: selected ? 'select' : 'remove',
        ...(selected ? { purpose } : {}),
      },
      { expectedRevisions },
    );
  }
  feedback(
    unitId: string,
    stageId: string,
    sourceId: string,
    feedback: string,
    // ADR-009: when the rated resource has its own identity, narrow the
    // judgment to it. source_id stays required so provenance survives —
    // course → paper → verdict, never a paper severed from its bundle.
    // Omitted (undefined) means source-level feedback, the pre-v3 shape.
    resourceId?: string | null,
    expectedRevisions: Readonly<Record<string, number>> = {},
  ) {
    return this.capability('source.feedback.record', {
      unit_id: unitId,
      stage_id: stageId,
      source_id: sourceId,
      feedback,
      ...(resourceId ? { resource_id: resourceId } : {}),
    }, { expectedRevisions });
  }
  detour(
    unitId: string,
    stageId: string,
    title: string,
    classification = 'required-now',
    expectedRevisions: Readonly<Record<string, number>> = {},
  ) {
    return this.capability('detour.create',
      { unit_id: unitId, stage_id: stageId, title, classification },
      { expectedRevisions });
  }
  resolveDetour(
    unitId: string,
    detourId: string,
    resolution = '',
    expectedRevisions: Readonly<Record<string, number>> = {},
  ) {
    const payload: Record<string, unknown> = { unit_id: unitId, detour_id: detourId };
    if (resolution) payload.resolution = resolution;
    return this.capability('detour.resolve', payload, { expectedRevisions });
  }
  async attach(
    unitId: string,
    stageId: string,
    filePath: string,
    label = '',
    expectedRevisions: Readonly<Record<string, number>> = {},
  ) {
    const payload: Record<string, unknown> = {
      unit_id: unitId,
      stage_id: stageId,
      file: filePath,
      file_sha256: await fileSha256(filePath),
    };
    if (label) payload.label = label;
    return this.capability('stage.attachment.add', payload, { expectedRevisions });
  }
  captureText(text: string, title = '') {
    const payload: Record<string, unknown> = { text };
    if (title) payload.title = title;
    return this.capability('capture.create', payload);
  }
  async captureFile(filePath: string) {
    return this.capability('capture.create', {
      file: filePath,
      file_sha256: await fileSha256(filePath),
    });
  }
  createGardenSeed(
    text: string,
    title = '',
  ) {
    const payload: Record<string, unknown> = { text };
    if (title.trim()) payload.title = title.trim();
    return this.capability(
      'garden.seed.create',
      payload,
    );
  }
  /**
   * Save one of the learner's own Atlas questions (ADR-017).
   *
   * Artifact-scoped, not request-scoped: the note id is the artifact, so the
   * write is guarded against that note's current revision and a stale view
   * refuses rather than overwrites. Core preserves the original target and the
   * learner's wording; this only ever carries the fields the caller names, so
   * resolving a question cannot silently rewrite its text.
   */
  saveAtlasQuestion(
    question: Readonly<Record<string, unknown>>,
    expectedRevisions: Readonly<Record<string, number>> = {},
  ) {
    return this.capability(
      'atlas.question.save',
      { question: { ...question } },
      { expectedRevisions },
    );
  }
  /**
   * Apply explicitly authored changes to the concept relation registry
   * (ADR-017 decision 1).
   *
   * Core takes only `add`, `replace` and `remove` and matches every `old` row
   * exactly and uniquely, so an edit made from a stale screen is refused rather
   * than resolved by guessing. The whole batch commits or none of it does.
   */
  changeConceptRelations(
    operations: readonly Readonly<Record<string, unknown>>[],
    expectedRevisions: Readonly<Record<string, number>> = {},
  ) {
    return this.capability(
      'concept.relations.change',
      { change: { operations: operations.map((operation) => ({ ...operation })) } },
      { expectedRevisions },
    );
  }
  prepareShelving(unitId: string,
    expectedRevisions: Readonly<Record<string, number>> = {}) {
    return this.capability('review.prepare', { unit_id: unitId }, { expectedRevisions });
  }
  applyShelving(unitId: string, selected: readonly string[],
    expectedRevisions: Readonly<Record<string, number>> = {}) {
    return this.capability('review.apply',
      { unit_id: unitId, selected: [...selected] },
      { expectedRevisions });
  }
  endSession(commitMessage: string | null = null, push = false) {
    // Review-only session closure still publishes the projection and removes
    // the ownership ledger, so it is a mutation even without a commit message.
    this.assertMutationAllowed();
    const args = ['session-end'];
    if (commitMessage) args.push('--commit-message', commitMessage);
    if (push) args.push('--push');
    return this.call(args);
  }

  /**
   * Apply a study map that has already been through the SOP's coverage audit.
   * The interface carries the reviewed file's path and exact content digest.
   * Core reads it once, verifies those approved bytes, checks them against the
   * creation template and study-map schema, and refuses it as a whole. Gate 1
   * stays where the SOP put it — this applies a reviewed result; it does not
   * skip the review.
   */
  async importUnitMap(review: UnitMapImportReview) {
    if (!isSha256(review.fileSha256) || !isSha256(review.expectedSnapshot)) {
      throw new Error('Check this map again before importing; its review has no valid binding.');
    }
    if (await fileSha256(review.file) !== review.fileSha256) {
      throw new Error('The map file changed after review. Check it again before importing.');
    }
    return this.capability('unit.map.import', {
      unit_id: review.unitId,
      file: review.file,
      file_sha256: review.fileSha256,
      ...(review.replace ? { replace: true } : {}),
    }, { expectedRevisions: review.expectedRevisions, expectedSnapshot: review.expectedSnapshot });
  }

  /**
   * The no-write preflight that has to run before an import is approved.
   *
   * Core's `--check` prints the concrete replacement diff and writes nothing.
   * Naming a file is not approval to import it — the learner approves *this
   * diff*, which is what makes the Import control an explicit review rather
   * than a file picker with consequences (review
   * `workbench/audits/repair-review-2026-09-13`, D1). No snapshot guard:
   * nothing is written, so there is nothing to guard against.
   */
  async checkUnitMapImport(unitId: string, file: string, replace = false): Promise<UnitMapImportReview> {
    const digest = await fileSha256(file);
    const args = ['unit-map-import', unitId, '--file', file,
      '--file-sha256', digest, '--check'];
    if (replace) args.push('--replace');
    const result = record(await this.call(args));
    const revisions = record(result?.expected_revisions);
    if (!result || result.ok !== true || result.mode !== 'check'
      || result.canonical_files_written !== 0 || !record(result.diff)
      || result.unit_id !== unitId || result.file_sha256 !== digest
      || !isSha256(result.snapshot_id) || !revisions
      || Object.keys(revisions).length !== 2
      || !Object.values(revisions).every(v => Number.isInteger(v) && Number(v) >= 0)
      || !(unitId in revisions) || !(String(result.study_map_id) in revisions)) {
      throw new Error('LearningOS could not provide a complete, bound no-write review. Nothing was imported.');
    }
    return { unitId, file, replace, fileSha256: digest,
      expectedSnapshot: result.snapshot_id,
      expectedRevisions: revisions as Record<string, number>, result };
  }

  /**
   * The declared read-only `plan.template` query. Core generates and validates
   * the starting record; the interface never authors defaults of its own, so
   * "the standard" and "what the Create dialog offers" cannot drift apart.
   * No snapshot guard: this reads no repository file and writes nothing.
   */
  planTemplate(
    profile: PlanProfile,
    title: string,
    ids: { unitId?: string; moduleId?: string } = {},
  ) {
    const args = ['plan-template', profile, '--title', title, '--json'];
    if (ids.unitId) args.push('--unit-id', ids.unitId);
    if (ids.moduleId) args.push('--module-id', ids.moduleId);
    return this.call(args);
  }

  /** Versioned read-only status surfaces. Their feature layers decode the
   *  exact producer schemas before rendering any field. */
  healthReport() {
    return this.call(['health-report', '--json']);
  }

  /** Recent causal operations, newest first (Diagnostics → Operations). */
  operationsList(limit = 30) {
    return this.call(['operations', '--limit', String(limit)]);
  }

  /** Full diagnosis plus timeline for one request id. */
  operationsDetail(requestId: string) {
    return this.call(['operations', '--request-id', requestId]);
  }

  legacyArchiveStatus() {
    return this.call(['legacy-archive-status', '--json']);
  }

  mastersPlanningDashboard() {
    return this.call([
      'masters-planning-dashboard',
      '--confirm-masters-planning',
    ]);
  }

}

/**
 * A wider surface than GatewayHost: building an AI context bundle is a read
 * across the projection plus the one supplementary fact about the editor.
 */
interface AiContextHost {
  store: {
    get(id: string): ProjectionRecord | null;
    mapForUnit(unitId: string): ProjectionRecord | null;
    stage(stageId: string): ProjectionRecord | null;
    snapshotId: string | null;
  };
  app: {
    workspace: {
      getActiveFile?(): { readonly path: string } | null;
    };
  };
}

export function explicitAiContext(
  plugin: AiContextHost,
  context: Record<string, string | undefined> = {},
): JsonRecord {
  const unit = context.unitId ? plugin.store.get(context.unitId) : null;
  const module = context.moduleId ? plugin.store.get(context.moduleId) :
    (unit?.module_id ? plugin.store.get(unit.module_id) : null);
  const stage = context.stageId ? plugin.store.stage(context.stageId) : null;
  const stageResources: ProjectionRecord[] = Array.isArray(stage?.resources)
    ? stage.resources
    : [];
  const unitSelections: ProjectionRecord[] = Array.isArray(unit?.source_selections)
    ? unit.source_selections.filter(
      (row): row is ProjectionRecord =>
        typeof row === 'object'
        && row !== null
        && !Array.isArray(row),
    )
    : [];
  const resources = stageResources.length
    ? stageResources
    : unitSelections;
  return {
    area_program_id: context.programId || module?.area_id || null,
    module_id: module?.id || context.moduleId || null,
    component_id: context.componentId || unit?.component_id || null,
    unit_id: unit?.id || context.unitId || null,
    stage_id: stage?.id || context.stageId || null,
    selected_source_ids: [...new Set(resources.map((row) => row.source_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0))],
    selected_materials: resources
      .map((row) => row.material_uri
        || row.vault_path
        || row.url
        || row.material_path
        || row.locator)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
    manifest_snapshot: plugin.store.snapshotId,
    active_file_supplement: plugin.app.workspace.getActiveFile?.()?.path || null,
  };
}
